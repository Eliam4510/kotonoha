// Las peticiones a los proveedores con la API de OpenAI (OpenRouter, DeepSeek, OpenAI, LM Studio, Ollama), en flujo. Lo
// que se manda y cómo se lee está en nucleo/compatible.ts; aquí van la red, los reintentos y los errores dichos con el
// nombre del proveedor. Las claves se piden al service worker en cada petición: nunca pasan por los ajustes.

import { tr } from '../compartido/i18n';
import type { ProveedorIA } from '../compartido/proveedores';
import { CLAVES_PROVEEDORES } from '../compartido/proveedores';
import { fondo } from '../compartido/rpc';
import { ajusteDelMaximo, cuerpoCompatible, jsonDeRespuesta, leerFlujo, type PeticionCompatible, rechazaEsquema, type TrozoCompatible, type UsoCompatible } from '../nucleo/compatible';

export interface ResultadoCompatible {
  texto: string;
  uso?: UsoCompatible;
  modelo?: string;
}

async function claveDe(p: ProveedorIA): Promise<string> {
  if (!p.conClave) return '';
  const claves = await fondo.clavesProveedores().catch(() => ({}) as Record<string, string>);
  const clave = claves[p.id] ?? '';
  if (!clave) throw new Error(tr('Falta la clave de {0}. Añádela en Ajustes.', p.nombre));
  return clave;
}

function cabeceras(p: ProveedorIA, clave: string): Record<string, string> {
  return {
    'content-type': 'application/json',
    ...(clave ? { authorization: `Bearer ${clave}` } : {}),
    // OpenRouter pide saber qué aplicación llama; no lleva nada del usuario.
    ...(p.id === 'openrouter' ? { 'HTTP-Referer': 'https://github.com/Eliam4510/kotonoha', 'X-Title': 'Kotonoha' } : {}),
  };
}

const base = (p: ProveedorIA) => p.url.trim().replace(/\/+$/, '');

function errorDe(p: ProveedorIA, estado: number, texto: string): Error {
  let detalle = texto.slice(0, 300);
  try {
    const j = JSON.parse(texto) as { error?: { message?: string } | string; message?: string };
    detalle = (typeof j.error === 'string' ? j.error : j.error?.message) ?? j.message ?? detalle;
  } catch {
    // No era JSON: va tal cual.
  }
  if (estado === 401 || estado === 403) return new Error(tr('La clave de {0} no es válida, o no puede usar ese modelo. Revísala en Ajustes.', p.nombre));
  if (estado === 402) return new Error(tr('No queda saldo en {0}.', p.nombre));
  if (estado === 429) return new Error(tr('Se superó el límite de {0}. Espera un momento y vuelve a intentarlo.', p.nombre));
  return new Error(tr('Error de {0} ({1}): {2}', p.nombre, estado, detalle));
}

async function conectar(p: ProveedorIA, ruta: string, opciones: RequestInit): Promise<Response> {
  try {
    return await fetch(`${base(p)}${ruta}`, opciones);
  } catch (e) {
    if ((opciones.signal as AbortSignal | undefined)?.aborted) throw e;
    throw new Error(tr('No se pudo conectar con {0} en {1}. Si es un programa de este equipo, comprueba que está abierto.', p.nombre, base(p)));
  }
}

/** Pide la respuesta en flujo y la va emitiendo. Con esquema, devuelve solo el JSON aunque el modelo añada algo alrededor. */
export async function pedir(
  p: ProveedorIA,
  peticion: Omit<PeticionCompatible, 'modoJson' | 'pedirCoste' | 'campoMaximo'>,
  emitir?: (t: string) => void,
  senal?: AbortSignal
): Promise<ResultadoCompatible> {
  const clave = await claveDe(p);
  let modoJson: PeticionCompatible['modoJson'] = p.esquemas === 'no' ? 'instrucciones' : 'esquema';
  let maximo = { campo: 'max_tokens' as 'max_tokens' | 'max_completion_tokens', tokens: peticion.maxTokens };
  // Unos pocos reintentos con lo que el servidor diga que no admite: el esquema o el límite de tokens.
  for (let intento = 0; ; intento++) {
    const r = await conectar(p, '/chat/completions', {
      method: 'POST',
      headers: cabeceras(p, clave),
      body: JSON.stringify(cuerpoCompatible({ ...peticion, modoJson, pedirCoste: p.id === 'openrouter', campoMaximo: maximo.campo, maxTokens: maximo.tokens })),
      signal: senal,
    });
    if (!r.ok) {
      const texto = await r.text();
      if (intento < 3 && peticion.esquema && modoJson === 'esquema' && p.esquemas !== 'si' && rechazaEsquema(r.status, texto)) {
        modoJson = 'instrucciones';
        continue;
      }
      const otro = intento < 3 ? ajusteDelMaximo(r.status, texto, maximo) : null;
      if (otro) {
        maximo = otro;
        continue;
      }
      throw errorDe(p, r.status, texto);
    }
    return leer(p, r, peticion.esquema !== undefined, emitir);
  }
}

async function leer(p: ProveedorIA, r: Response, conEsquema: boolean, emitir?: (t: string) => void): Promise<ResultadoCompatible> {
  const salida: ResultadoCompatible = { texto: '' };
  let fin = '';
  const tomar = (trozos: TrozoCompatible[]) => {
    for (const t of trozos) {
      if (t.error) throw new Error(tr('{0}: {1}', p.nombre, t.error));
      if (t.texto) {
        salida.texto += t.texto;
        emitir?.(t.texto);
      }
      if (t.uso) salida.uso = t.uso;
      if (t.modelo) salida.modelo = t.modelo;
      if (t.fin) fin = t.fin;
    }
  };
  if (!r.body) throw new Error(tr('{0} no devolvió nada.', p.nombre));
  const lector = r.body.getReader();
  const decodificador = new TextDecoder();
  let pendiente = '';
  for (;;) {
    const { value, done } = await lector.read();
    if (done) break;
    pendiente += decodificador.decode(value, { stream: true });
    const { trozos, resto } = leerFlujo(pendiente);
    pendiente = resto;
    tomar(trozos);
  }
  tomar(leerFlujo(`${pendiente}\n`).trozos);
  if (fin === 'length' && conEsquema) throw new Error(tr('{0} cortó la respuesta por el límite de tokens: prueba con un modelo que admita respuestas más largas.', p.nombre));
  if (conEsquema) salida.texto = jsonDeRespuesta(salida.texto);
  return salida;
}

/** Los modelos que ofrece, por orden alfabético. */
export async function modelos(p: ProveedorIA): Promise<string[]> {
  const clave = await claveDe(p).catch(() => '');
  const r = await conectar(p, '/models', { headers: cabeceras(p, clave), signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw errorDe(p, r.status, await r.text());
  const j = (await r.json()) as { data?: { id: string }[]; models?: { id?: string; name?: string }[] };
  const ids = (j.data ?? []).map((m) => m.id).concat((j.models ?? []).map((m) => m.id ?? m.name ?? '')).filter(Boolean);
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
}

export { CLAVES_PROVEEDORES };
