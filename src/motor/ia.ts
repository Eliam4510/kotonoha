// Cliente de Claude. Toda la IA de la extensión pasa por aquí.

import Anthropic from '@anthropic-ai/sdk';
import type { Ajustes, Esfuerzo, TareaIA } from '../compartido/ajustes';
import type { ContextoIA, ImagenIA, OpcionFalsa, PeticionRevisionOcr, SentidoEnContexto } from '../compartido/tipos';
import type { AnalisisLinea } from '../nucleo/analisisProfundo';
import { type Lote, ordenarPorCercania, partirEnLotes } from '../nucleo/lotes';
import { claveDia, claveMes, costeDe, type UsoTokens } from '../nucleo/precios';
import { type EntradaAjuste, mensajeAjuste } from '../nucleo/letra';
import { mensajeRevision } from '../nucleo/revision';
import type { Linea } from '../nucleo/subtitulos';
import type { PuntoGramatica, TareaPrompt } from '../lenguas/tipos';
import { baseGeneral, db } from './db';
import { tr } from '../compartido/i18n';
import { lengua, motorLengua } from './lengua';
import { rellenar, sinFraseVacia, type VariablesPrompt } from './prompts';
import * as compatible from './compatible';
import { separarModelo, valorDeModelo } from '../compartido/proveedores';
import { usoDeCompatible } from '../nucleo/compatible';

let claveApi = '';
let urlBase: string | undefined;
let cliente: Anthropic | null = null;

export function fijarClave(clave: string, baseURL?: string) {
  claveApi = clave;
  urlBase = baseURL;
  cliente = null;
}

export const hayClave = () => claveApi.length > 0;

function obtenerCliente(): Anthropic {
  if (!claveApi) throw new Error(tr('Falta la clave de la API de Claude. Añádela en Ajustes.'));
  // Corre en el documento offscreen: los scripts de las páginas nunca ven la clave.
  cliente ??= new Anthropic({ apiKey: claveApi, dangerouslyAllowBrowser: true, ...(urlBase ? { baseURL: urlBase } : {}) });
  return cliente;
}

/** Haiku 5.5 no admite respaldo en el servidor; el resto de modelos actuales sí. */
const admiteRespaldo = (modelo: string) => !modelo.startsWith('claude-haiku');

interface OpcionesPeticion {
  a: Ajustes;
  tarea: TareaIA;
  sistema: string;
  usuario: string;
  guion?: string;
  titulo?: string;
  maxTokens?: number;
  formato?: { type: 'json_schema'; schema: unknown };
  /** Usa el modelo y el esfuerzo de «profundizar» en lugar de los de la tarea. */
  profundo?: boolean;
  /** Envía el guion aunque esté desactivado en Ajustes: la tarea no tiene sentido sin él. */
  siempreGuion?: boolean;
  /** Los lotes seguidos de una misma tarea no necesitan que la caché dure una hora, que cuesta más. */
  cacheCorta?: boolean;
  /** Una imagen que va delante del texto del mensaje: la página cuyo texto se revisa. */
  imagen?: ImagenIA;
}

function construirParams(o: OpcionesPeticion) {
  // El guion va en un bloque en caché para que varias consultas del mismo video lo reutilicen.
  const system: { type: 'text'; text: string; cache_control?: { type: 'ephemeral'; ttl?: '5m' | '1h' } }[] = [{ type: 'text', text: o.sistema }];
  if ((o.a.usarGuion || o.siempreGuion) && o.guion) {
    system.push({
      type: 'text',
      text: `${o.titulo ? `Título: ${o.titulo}\n` : ''}Texto completo, como contexto:\n${o.guion}`,
      cache_control: { type: 'ephemeral', ttl: o.cacheCorta ? '5m' : '1h' },
    });
  }
  const tarea = o.profundo ? 'profundo' : o.tarea;
  return {
    model: o.a.modelos[tarea],
    max_tokens: o.maxTokens ?? 16000,
    system,
    messages: [
      {
        role: 'user' as const,
        content: o.imagen
          ? [
              { type: 'image' as const, source: { type: 'base64' as const, media_type: o.imagen.tipo, data: o.imagen.datos } },
              { type: 'text' as const, text: o.usuario },
            ]
          : o.usuario,
      },
    ],
    output_config: {
      effort: o.a.esfuerzos[tarea] as Esfuerzo,
      ...(o.formato ? { format: o.formato } : {}),
    },
  };
}

function abrirFlujo(o: OpcionesPeticion, senal?: AbortSignal) {
  const params = construirParams(o);
  const c = obtenerCliente();
  if (o.a.respaldoSeguridad && admiteRespaldo(params.model)) {
    return c.beta.messages.stream({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } as never, { signal: senal });
  }
  return c.messages.stream(params as never, { signal: senal });
}

function textoDe(m: { content: { type: string; text?: string }[] }): string {
  return m.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('');
}

function mensajeError(e: unknown): Error {
  if (e instanceof Anthropic.AuthenticationError) return new Error(tr('La clave de la API no es válida. Revísala en Ajustes.'));
  if (e instanceof Anthropic.RateLimitError) return new Error(tr('Se superó el límite de la API. Espera un momento y vuelve a intentarlo.'));
  if (e instanceof Anthropic.BadRequestError && /credit balance/i.test(e.message)) return new Error(tr('No queda saldo en la API de Claude.'));
  if (e instanceof Anthropic.APIError) return new Error(tr('Error de la API de Claude ({0}): {1}', e.status ?? tr('sin conexión'), e.message));
  return e instanceof Error ? e : new Error(String(e));
}

interface UsoApi {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_creation?: { ephemeral_5m_input_tokens?: number; ephemeral_1h_input_tokens?: number } | null;
}

/** Deja constancia de lo que costó cada petición, con los tokens que la propia API dice haber usado. */
function anotarConsumo(tarea: string, modelo: string, u: UsoApi | undefined, titulo?: string) {
  if (!u) return;
  const escritura1h = u.cache_creation?.ephemeral_1h_input_tokens ?? 0;
  const escritura5m = u.cache_creation?.ephemeral_5m_input_tokens ?? Math.max(0, (u.cache_creation_input_tokens ?? 0) - escritura1h);
  const uso: UsoTokens = { entrada: u.input_tokens ?? 0, salida: u.output_tokens ?? 0, cacheEscritura5m: escritura5m, cacheEscritura1h: escritura1h, cacheLectura: u.cache_read_input_tokens ?? 0 };
  anotarUso(tarea, modelo, uso, costeDe(modelo, uso), titulo);
}

function anotarUso(tarea: string, modelo: string, uso: UsoTokens, coste: number, titulo?: string) {
  const t = Date.now();
  gastadoCache = null;
  baseGeneral.consumo.add({ ...uso, t, dia: claveDia(t), mes: claveMes(t), tarea, modelo, coste, titulo }).catch((e) => console.warn('Kotonoha: no se pudo anotar el gasto', e));
}

/**
 * Una petición a otro proveedor, con la API de OpenAI. Lo que se manda es lo mismo que a Claude; el guion va dentro de las
 * instrucciones, porque la caché de prompts de Claude no existe allí. El coste es el que dice el proveedor (OpenRouter lo
 * dice); los demás, y los modelos del propio equipo, cuentan cero.
 */
async function ejecutarCompatible(o: OpcionesPeticion, id: string, modelo: string, tarea: TareaIA, emitir?: (t: string) => void, senal?: AbortSignal): Promise<string> {
  const p = o.a.proveedores.find((x) => x.id === id);
  if (!p) throw new Error(tr('El proveedor de esta tarea ya no está en Ajustes: elige otro modelo para ella.'));
  const sistema = (o.a.usarGuion || o.siempreGuion) && o.guion ? `${o.sistema}\n\n${o.titulo ? `Título: ${o.titulo}\n` : ''}Texto completo, como contexto:\n${o.guion}` : o.sistema;
  try {
    const r = await compatible.pedir(p, { modelo, sistema, usuario: o.usuario, imagen: o.imagen, maxTokens: o.maxTokens ?? 16000, esquema: o.formato?.schema }, emitir, senal);
    anotarUso(tarea, valorDeModelo(id, r.modelo ?? modelo), usoDeCompatible(r.uso), r.uso?.cost ?? 0, o.titulo);
    return r.texto;
  } catch (e) {
    if (senal?.aborted) return '';
    throw e instanceof Error ? e : new Error(String(e));
  }
}

/** Lo gastado este mes, para no pasar del tope. Se recuerda un momento: se pregunta en cada petición. */
let gastadoCache: { t: number; total: number } | null = null;
async function gastadoEsteMes(): Promise<number> {
  const ahora = Date.now();
  if (gastadoCache && ahora - gastadoCache.t < 30000) return gastadoCache.total;
  const filas = await baseGeneral.consumo.where('mes').equals(claveMes(ahora)).toArray();
  const total = filas.reduce((s, f) => s + (f.coste ?? 0), 0);
  gastadoCache = { t: ahora, total };
  return total;
}

async function comprobarTope(a: Ajustes) {
  if (a.limiteGasto > 0 && (await gastadoEsteMes()) >= a.limiteGasto) {
    throw new Error(tr('Has llegado a tu tope de {0} dólares este mes. Puedes cambiarlo en Ajustes.', a.limiteGasto));
  }
}

async function ejecutar(o: OpcionesPeticion, emitir?: (t: string) => void, senal?: AbortSignal): Promise<string> {
  await comprobarTope(o.a);
  const { proveedor, modelo } = separarModelo(o.a.modelos[o.profundo ? 'profundo' : o.tarea]);
  if (proveedor) return ejecutarCompatible(o, proveedor, modelo, o.profundo ? 'profundo' : o.tarea, emitir, senal);
  try {
    const flujo = abrirFlujo(o, senal);
    if (emitir) (flujo as unknown as { on(e: 'text', fn: (d: string) => void): void }).on('text', (d) => emitir(d));
    const final = (await flujo.finalMessage()) as unknown as { model?: string; usage?: UsoApi; stop_reason?: string; content: { type: string; text?: string }[] };
    const tarea = o.profundo ? 'profundo' : o.tarea;
    anotarConsumo(tarea, final.model ?? o.a.modelos[tarea], final.usage, o.titulo);
    if (final.stop_reason === 'refusal') throw new Error(tr('Claude rechazó esta petición por sus reglas de seguridad.'));
    return textoDe(final);
  } catch (e) {
    if (senal?.aborted) return '';
    throw mensajeError(e);
  }
}

async function hash(texto: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(d).slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Lo guardado deja de valer al cabo de este tiempo. Una explicación no caduca, pero la base no debe crecer sin fin. */
const CADUCIDAD_CACHE_MS = 90 * 24 * 60 * 60 * 1000;

interface PeticionEnCurso {
  promesa: Promise<string>;
  texto: string;
  oyentes: Set<(t: string) => void>;
}

const enCurso = new Map<string, PeticionEnCurso>();

async function claveDeCache(o: OpcionesPeticion, identidad?: unknown[]): Promise<string> {
  const tarea = o.profundo ? 'profundo' : o.tarea;
  if (identidad) return hash(JSON.stringify([tarea, o.a.modelos[tarea], ...identidad]));
  return hash(JSON.stringify([o.a.modelos[tarea], o.sistema, o.usuario, (o.a.usarGuion || o.siempreGuion) && o.guion ? await hash(o.guion) : '']));
}

async function leerCache(clave: string): Promise<string | null> {
  const guardado = await db.cacheIA.get(clave);
  return guardado && Date.now() - guardado.creada < CADUCIDAD_CACHE_MS ? guardado.texto : null;
}

/**
 * Ejecuta con caché local: lo ya respondido no se vuelve a pedir salvo que lo pidas tú.
 *
 * Una petición en marcha no se cancela aunque cambies de palabra: ya está pagada, y cancelarla obligaría
 * a pagarla entera otra vez al volver. Termina en segundo plano, se guarda, y si vuelves mientras tanto
 * te engancha a la misma respuesta en lugar de lanzar otra.
 */
async function conCache(o: OpcionesPeticion, recargar: boolean, emitir?: (t: string) => void, senal?: AbortSignal, identidad?: unknown[]): Promise<string> {
  const clave = await claveDeCache(o, identidad);
  if (!recargar) {
    const guardado = await leerCache(clave);
    if (guardado !== null) {
      emitir?.(guardado);
      return guardado;
    }
  }
  let peticion = enCurso.get(clave);
  if (peticion) {
    if (peticion.texto) emitir?.(peticion.texto);
  } else {
    const nueva: PeticionEnCurso = { texto: '', oyentes: new Set(), promesa: Promise.resolve('') };
    nueva.promesa = ejecutar(o, (d) => {
      nueva.texto += d;
      for (const f of nueva.oyentes) f(d);
    })
      .then(async (texto) => {
        if (texto) await db.cacheIA.put({ clave, texto, creada: Date.now() });
        return texto;
      })
      .finally(() => enCurso.delete(clave));
    enCurso.set(clave, nueva);
    peticion = nueva;
  }
  if (emitir) peticion.oyentes.add(emitir);
  const soltar = () => {
    if (emitir) peticion!.oyentes.delete(emitir);
  };
  try {
    if (!senal) return await peticion.promesa;
    return await new Promise<string>((ok, mal) => {
      senal.addEventListener('abort', () => ok(''), { once: true });
      peticion!.promesa.then(ok, mal);
    });
  } finally {
    soltar();
  }
}

/** Quita de la base lo guardado hace mucho. Se llama al arrancar. */
export async function limpiarCache(): Promise<void> {
  await db.cacheIA.where('creada').below(Date.now() - CADUCIDAD_CACHE_MS).delete();
}

/** Las líneas que rodean a la frase: lo que hace falta para entenderla de verdad. */
function bloqueEntorno(c: ContextoIA): string {
  const partes: string[] = [];
  if (c.titulo) partes.push(`Título: ${c.titulo}`);
  if (c.antes?.length) partes.push(`Texto anterior:\n${c.antes.join('\n')}`);
  if (c.despues?.length) partes.push(`Texto siguiente:\n${c.despues.join('\n')}`);
  return partes.join('\n\n') + (partes.length ? '\n' : '');
}

type TareaTexto = TareaPrompt;

function plantilla(a: Ajustes, tarea: TareaTexto) {
  const p = a.prompts[tarea];
  return p?.sistema && p.usuario ? p : motorLengua().prompts.base[tarea];
}

function preparar(a: Ajustes, tarea: TareaTexto, c: ContextoIA, extra: Partial<VariablesPrompt> = {}, profundo = false): OpcionesPeticion {
  const p = plantilla(a, tarea);
  const v: VariablesPrompt = {
    palabra: c.lema,
    superficie: c.superficie,
    lectura: c.lectura,
    frase: c.frase,
    entorno: bloqueEntorno(c),
    traduccion: c.traduccion,
    titulo: c.titulo,
    ...extra,
  };
  return {
    a,
    tarea: tarea === 'gramatica' ? 'explicar' : tarea,
    sistema: rellenar(p.sistema, a, v),
    usuario: rellenar(sinFrase(tarea, c) ? sinFraseVacia(p.usuario) : p.usuario, a, v),
    guion: c.guion,
    titulo: c.titulo,
    profundo,
  };
}

/** Las tareas que se pueden pedir de una palabra suelta, en el diccionario, sin la frase donde apareció. */
const sinFrase = (tarea: TareaTexto, c: ContextoIA) => (tarea === 'explicar' || tarea === 'preguntar') && !c.frase?.trim();

/**
 * Qué hace que dos consultas sean la misma: lo que se pregunta, no el texto de alrededor. Las de una palabra suelta
 * llevan una marca: las guardadas antes de quitarles la frase vacía empezaban diciendo que llegó vacía, y se vuelven a
 * pedir una vez.
 */
const identidad = (a: Ajustes, tarea: TareaTexto, c: ContextoIA, ...resto: unknown[]) => [
  tarea, a.nivel, a.idiomaExplicaciones, plantilla(a, tarea), c.lema, c.lectura, c.superficie, c.frase, ...resto, ...(sinFrase(tarea, c) ? ['sin frase'] : []),
];

export const flujos = {
  explicar: (a: Ajustes, c: ContextoIA, recargar: boolean, profundo: boolean, emitir: (t: string) => void, senal: AbortSignal) =>
    conCache(preparar(a, 'explicar', c, {}, profundo), recargar, emitir, senal, identidad(a, 'explicar', c)),
  desglosar: (a: Ajustes, c: ContextoIA, recargar: boolean, emitir: (t: string) => void, senal: AbortSignal) =>
    conCache(preparar(a, 'desglosar', c), recargar, emitir, senal, identidad(a, 'desglosar', { frase: c.frase })),
  traducir: (a: Ajustes, c: ContextoIA, recargar: boolean, emitir: (t: string) => void, senal: AbortSignal) =>
    conCache(preparar(a, 'traducir', c, { idioma: a.idiomaTraduccion }), recargar, emitir, senal, identidad(a, 'traducir', { frase: c.frase }, a.idiomaTraduccion)),
  gramatica: (a: Ajustes, c: ContextoIA, recargar: boolean, emitir: (t: string) => void, senal: AbortSignal) =>
    conCache(preparar(a, 'gramatica', c), recargar, emitir, senal, identidad(a, 'gramatica', { lema: c.lema, frase: c.frase })),
  preguntar: (a: Ajustes, c: ContextoIA, pregunta: string, emitir: (t: string) => void, senal: AbortSignal) =>
    conCache(preparar(a, 'preguntar', c, { pregunta }), false, emitir, senal, identidad(a, 'preguntar', { lema: c.lema, frase: c.frase }, pregunta)),
  historia: (a: Ajustes, tema: string, palabras: string, emitir: (t: string) => void, senal: AbortSignal) =>
    ejecutar(preparar(a, 'historia', { frase: tema, lema: palabras }), emitir, senal),
};

/** Qué significa la palabra en esta frase: resuelve el problema del «siempre el sentido básico». */
function peticionSentido(a: Ajustes, c: ContextoIA, definiciones: string[]): OpcionesPeticion {
  const { comillar } = lengua().escritura;
  const lista = definiciones.slice(0, 12).map((d, i) => `${i}. ${d}`).join('\n');
  return {
    a,
    tarea: 'sentido',
    sistema: rellenar(motorLengua().prompts.sentido, a, {}),
    usuario: `${bloqueEntorno(c)}Frase: ${comillar(c.frase ?? '')}
Palabra: ${c.lema} (en la frase aparece como ${comillar(c.superficie ?? c.lema ?? '')}, lectura ${c.lectura ?? ''})
Definiciones del diccionario:
${lista || '(ninguna)'}`,
    titulo: c.titulo,
    maxTokens: 8000,
    formato: { type: 'json_schema', schema: motorLengua().prompts.esquemaSentido },
  };
}

const identidadSentido = (a: Ajustes, c: ContextoIA) => [a.nivel, a.idiomaExplicaciones, c.lema, c.lectura, c.superficie, c.frase];

export async function sentidoEnContexto(a: Ajustes, c: ContextoIA, definiciones: string[], recargar = false): Promise<SentidoEnContexto> {
  const texto = await conCache(peticionSentido(a, c, definiciones), recargar, undefined, undefined, identidadSentido(a, c));
  return JSON.parse(texto) as SentidoEnContexto;
}

/** Lo que ya se le preguntó a Claude sobre esta palabra en esta frase. No gasta nada. */
export async function sentidoGuardado(a: Ajustes, c: ContextoIA, definiciones: string[]): Promise<SentidoEnContexto | null> {
  const texto = await leerCache(await claveDeCache(peticionSentido(a, c, definiciones), identidadSentido(a, c)));
  return texto ? (JSON.parse(texto) as SentidoEnContexto) : null;
}

export async function generarFrase(a: Ajustes, lema: string): Promise<string> {
  return (await conCache(preparar(a, 'generar', { lema }), false)).trim();
}

export async function traducirBreve(a: Ajustes, texto: string): Promise<string> {
  return (await conCache(preparar(a, 'traducir', { frase: texto }, { idioma: a.idiomaTraduccion }), false)).trim();
}

export async function consultaImagen(a: Ajustes, lema: string, frase?: string): Promise<string> {
  const texto = await conCache(
    {
      a,
      tarea: 'generar',
      sistema: motorLengua().prompts.imagen,
      usuario: frase ? `Término: ${lema}\nFrase: ${frase}` : `Término: ${lema}`,
    },
    false
  );
  return texto.trim();
}

export async function glosaBreve(a: Ajustes, lema: string, frase?: string): Promise<string> {
  const texto = await conCache(
    {
      a,
      tarea: 'sentido',
      sistema: motorLengua().prompts.glosa(a.idiomaTraduccion),
      usuario: frase ? `Término: ${lema}\nContexto: ${frase}` : `Término: ${lema}`,
    },
    false
  );
  return texto.trim();
}

const PROMPT_ORGANIZAR = `Organizas un texto para leerlo y estudiarlo. Recibes un texto, a veces pegado de corrido, y lo devuelves en Markdown con su estructura: # para el título, ## para los subtítulos y ### para los apartados; párrafos separados por una línea en blanco; - para las listas, con dos espacios más por cada subnivel; 1. para las listas numeradas; > para las citas, y ** para lo que ya venía destacado.

Reglas:
- No cambies, quites, añadas, traduzcas ni corrijas ninguna palabra ni ningún signo: solo pones la estructura que el texto ya tiene. Si algo no está claro, déjalo como párrafo.
- Un título solo si el texto lo tiene: una línea corta que encabeza lo que sigue.
- Dentro de un párrafo, conserva los saltos de línea que separan versos, líneas de un diálogo o renglones con sentido propio.
- Conserva tal cual, cada una en su línea, las marcas <!-- dictado:… -->.
- Responde solo con el Markdown, sin explicaciones ni bloque de código alrededor.`;

/** El texto del Cuaderno, organizado por Claude: el mismo texto, con títulos, párrafos y listas. */
export async function organizarTexto(a: Ajustes, md: string): Promise<string> {
  const texto = await ejecutar({ a, tarea: 'generar', sistema: PROMPT_ORGANIZAR, usuario: md, maxTokens: Math.min(64000, Math.ceil(md.length * 2.5) + 2000) });
  // Por si llega envuelto en un bloque de código, a pesar de las instrucciones.
  return texto.trim().replace(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i, '$1').trim();
}

/**
 * Las opciones falsas de una tarjeta de opción múltiple sobre un punto de gramática: tres puntos que se confunden con él,
 * cada uno con por qué no va en esa frase. Se piden una vez: la respuesta queda en la caché.
 */
export async function distractoresGramatica(a: Ajustes, punto: PuntoGramatica, frase: string): Promise<OpcionFalsa[]> {
  const { comillar } = lengua().escritura;
  const texto = await ejecutar({
    a,
    tarea: 'generar',
    sistema: motorLengua().prompts.distractores(a.idiomaExplicaciones),
    usuario: `Nivel del estudiante: ${a.nivel}
Frase: ${comillar(frase)}
Punto de gramática: ${punto.patron}${punto.nivel ? ` (${punto.nivel})` : ''}: ${punto.significado}
Fragmento de la frase: ${comillar(punto.fragmento)}`,
    maxTokens: 4000,
    formato: {
      type: 'json_schema',
      schema: {
        type: 'object',
        properties: {
          opciones: {
            type: 'array',
            items: { type: 'object', properties: { patron: { type: 'string' }, motivo: { type: 'string' } }, required: ['patron', 'motivo'], additionalProperties: false },
          },
        },
        required: ['opciones'],
        additionalProperties: false,
      },
    },
  });
  const { opciones } = JSON.parse(texto) as { opciones: OpcionFalsa[] };
  const vistos = new Set([punto.patron]);
  return opciones.filter((o) => o.patron?.trim() && !vistos.has(o.patron) && vistos.add(o.patron)).slice(0, 3);
}

/** Revisa una lectura concreta que el usuario señaló como dudosa. */
export async function revisarLectura(a: Ajustes, c: ContextoIA): Promise<{ lectura: string; lema: string; lectura_lema: string; motivo: string }> {
  const { comillar } = lengua().escritura;
  const texto = await ejecutar({
    a,
    tarea: 'sentido',
    sistema: motorLengua().prompts.revisarLectura(a.idiomaExplicaciones),
    usuario: `${bloqueEntorno(c)}Frase: ${comillar(c.frase ?? '')}
Palabra: ${comillar(c.superficie ?? c.lema ?? '')}
Lectura actual: ${c.lectura ?? ''}`,
    guion: c.guion,
    titulo: c.titulo,
    maxTokens: 8000,
    formato: {
      type: 'json_schema',
      schema: {
        type: 'object',
        properties: { lectura: { type: 'string' }, lema: { type: 'string' }, lectura_lema: { type: 'string' }, motivo: { type: 'string' } },
        required: ['lectura', 'lema', 'lectura_lema', 'motivo'],
        additionalProperties: false,
      },
    },
  });
  return JSON.parse(texto);
}

const ESQUEMA_LINEAS = {
  type: 'object',
  properties: {
    lineas: {
      type: 'array',
      items: {
        type: 'object',
        properties: { i: { type: 'integer' }, t: { type: 'string' } },
        required: ['i', 't'],
        additionalProperties: false,
      },
    },
  },
  required: ['lineas'],
  additionalProperties: false,
} as const;

const TAM_LOTE_TRADUCCION = 80;
/** Corregir apenas devuelve texto, porque solo vienen las líneas que cambian: caben lotes mayores. */
const TAM_LOTE_CORRECCION = 120;
const MARGEN = 6;
const SIMULTANEOS = 3;

/**
 * Lanza los lotes en paralelo, empezando por el que estás viendo. Con `primeroSolo` el primero va
 * por delante: deja en la caché de la API el texto completo, y los demás lo reutilizan.
 */
async function porLotes(total: number, tam: number, indice: number, primeroSolo: boolean, fn: (l: Lote) => Promise<void>) {
  const cola = ordenarPorCercania(partirEnLotes(total, tam), indice);
  if (primeroSolo && cola.length) await fn(cola.shift()!);
  const trabajar = async () => {
    for (let l = cola.shift(); l; l = cola.shift()) await fn(l);
  };
  await Promise.all(Array.from({ length: Math.min(SIMULTANEOS, cola.length) }, trabajar));
}

const unaLinea = (l: Linea) => l.texto.replace(/\n/g, ' ');

function mensajeLote(lineas: Linea[], { desde, hasta }: Lote, titulo: string | undefined, etiqueta: string): string {
  const antes = lineas.slice(Math.max(0, desde - MARGEN), desde).map(unaLinea).join('\n');
  const despues = lineas.slice(hasta, hasta + MARGEN).map(unaLinea).join('\n');
  const cuerpo = lineas.slice(desde, hasta).map((l, k) => `${desde + k}: ${unaLinea(l)}`).join('\n');
  return [
    titulo ? `Título: ${titulo}` : '',
    antes ? `Líneas anteriores, solo como contexto:\n${antes}` : '',
    `${etiqueta}:\n${cuerpo}`,
    despues ? `Líneas siguientes, solo como contexto:\n${despues}` : '',
  ].filter(Boolean).join('\n\n');
}

export interface ParteTexto {
  i: number;
  t: string;
}

/** Traduce un subtítulo en cualquier dirección. Entrega cada lote al terminarlo, para verlo cuanto antes. */
export async function traducirSubtitulos(
  a: Ajustes,
  lineas: Linea[],
  titulo: string | undefined,
  sistema: string,
  indice: number,
  alLote: (parte: ParteTexto[], hechas: number, total: number) => void,
  senal?: AbortSignal
): Promise<void> {
  let hechas = 0;
  await porLotes(lineas.length, TAM_LOTE_TRADUCCION, indice, false, async (l) => {
    if (senal?.aborted) return;
    const usuario = mensajeLote(lineas, l, titulo, 'Líneas a traducir');
    const texto = await ejecutar({ a, tarea: 'subtitulos', sistema, usuario, titulo, maxTokens: 32000, formato: { type: 'json_schema', schema: ESQUEMA_LINEAS } }, undefined, senal);
    if (!texto) return;
    const datos = JSON.parse(texto) as { lineas: ParteTexto[] };
    hechas += l.hasta - l.desde;
    alLote(datos.lineas, hechas, lineas.length);
  });
}

/**
 * Corrige homófonos y palabras mal oídas de unos subtítulos automáticos, sin preguntar nada.
 * Es rápido y barato porque Claude solo devuelve lo que cambia, y el texto completo que le da el
 * contexto va en la caché de la API: cada lote lo reutiliza en lugar de pagarlo otra vez.
 */
export async function corregirSubtitulos(
  a: Ajustes,
  lineas: Linea[],
  titulo: string | undefined,
  indice: number,
  guion: string | undefined,
  alLote: (cambios: ParteTexto[], hechas: number, total: number) => void,
  senal?: AbortSignal
): Promise<void> {
  const contexto = guion ?? lineas.map(unaLinea).join('\n');
  let hechas = 0;
  await porLotes(lineas.length, TAM_LOTE_CORRECCION, indice, true, async (l) => {
    if (senal?.aborted) return;
    const usuario = mensajeLote(lineas, l, titulo, 'Líneas a revisar');
    const texto = await ejecutar({ a, tarea: 'corregir', sistema: motorLengua().prompts.correccion, usuario, guion: contexto, siempreGuion: true, cacheCorta: true, titulo, maxTokens: 16000, formato: { type: 'json_schema', schema: motorLengua().prompts.esquemaCorrecciones } }, undefined, senal);
    if (!texto) return;
    const datos = JSON.parse(texto) as { correcciones: ParteTexto[] };
    hechas += l.hasta - l.desde;
    alLote(datos.correcciones, hechas, lineas.length);
  });
}

/**
 * Coloca una letra sobre los tiempos de una transcripción. Claude solo dice qué verso suena sobre qué líneas, y la
 * respuesta se guarda: ajustar la misma letra sobre la misma transcripción no se paga dos veces.
 */
export async function ajustarLetra(a: Ajustes, lineas: Linea[], versos: string[], titulo: string | undefined): Promise<EntradaAjuste[]> {
  const { letra, esquemaLetra } = motorLengua().prompts;
  const usuario = mensajeAjuste(lineas, versos, titulo);
  const texto = await conCache({ a, tarea: 'letra', sistema: letra, usuario, titulo, maxTokens: 32000, formato: { type: 'json_schema', schema: esquemaLetra } }, false);
  return texto ? (JSON.parse(texto) as { ajuste: EntradaAjuste[] }).ajuste : [];
}

/**
 * Revisa el texto que el OCR leyó de una página, con la imagen de la página delante: Claude solo devuelve lo que no
 * coincide con ella. La respuesta se guarda, así que volver a revisar la misma página con el mismo texto no se paga.
 */
export async function revisarPaginaOcr(a: Ajustes, p: PeticionRevisionOcr): Promise<ParteTexto[]> {
  const { revisionOcr, esquemaRevisionOcr } = motorLengua().prompts;
  const usuario = mensajeRevision({ titulo: p.titulo, pagina: p.pagina, globos: p.globos, lineas: p.lineas });
  const texto = await conCache(
    { a, tarea: 'ocr', sistema: revisionOcr, usuario, imagen: p.imagen, titulo: p.titulo, maxTokens: 16000, formato: { type: 'json_schema', schema: esquemaRevisionOcr } },
    false,
    undefined,
    undefined,
    [a.esfuerzos.ocr, revisionOcr, p.libro, p.pagina, p.globos, p.lineas]
  );
  return texto ? ((JSON.parse(texto) as { cambios?: ParteTexto[] }).cambios ?? []) : [];
}

export interface EntradaAnalisis {
  texto: string;
  /** Palabras con la lectura que calculó el tokenizador: 咲いた(さいた) 花(はな) */
  palabras: string;
}

/**
 * Análisis profundo: corrige lecturas, detecta sentidos no literales y gramática, línea a línea.
 * Devuelve por el callback cada trozo terminado para guardarlo y mostrarlo cuanto antes.
 */
export async function analisisProfundo(
  a: Ajustes,
  entradas: EntradaAnalisis[],
  titulo: string | undefined,
  alTrozo: (resultado: Map<number, AnalisisLinea>, desde: number, hasta: number, hechas: number, total: number) => Promise<void>,
  senal?: AbortSignal,
  indice = -1,
  todas: EntradaAnalisis[] = entradas
): Promise<void> {
  const sistema = rellenar(motorLengua().prompts.analisis, a, {});
  const posicion = new Map(todas.map((e, i) => [e, i]));
  let hechas = 0;
  await porLotes(entradas.length, 60, indice, false, async ({ desde, hasta }) => {
    if (senal?.aborted) return;
    // El contexto son las líneas que de verdad van al lado, aunque esas ya estén revisadas.
    const primera = posicion.get(entradas[desde]) ?? desde;
    const trasUltima = (posicion.get(entradas[hasta - 1]) ?? hasta - 1) + 1;
    const antes = todas.slice(Math.max(0, primera - MARGEN), primera).map((e) => e.texto).join('\n');
    const despues = todas.slice(trasUltima, trasUltima + MARGEN).map((e) => e.texto).join('\n');
    const cuerpo = entradas.slice(desde, hasta).map((e, k) => `${desde + k}: ${e.texto}\n   Palabras: ${e.palabras}`).join('\n');
    const usuario = [
      titulo ? `Título: ${titulo}` : '',
      antes ? `Líneas anteriores, solo como contexto:\n${antes}` : '',
      `Líneas a revisar:\n${cuerpo}`,
      despues ? `Líneas siguientes, solo como contexto:\n${despues}` : '',
    ].filter(Boolean).join('\n\n');
    // Sin señal a propósito: este lote ya está pagado. Si te vas del video, termina y queda guardado.
    const texto = await ejecutar({ a, tarea: 'analisis', sistema, usuario, titulo, maxTokens: 32000, formato: { type: 'json_schema', schema: motorLengua().prompts.esquemaAnalisis } });
    if (!texto) return;
    const datos = JSON.parse(texto) as { lineas: (AnalisisLinea & { i: number })[] };
    const r = new Map<number, AnalisisLinea>();
    for (const { i, lecturas, sentidos, gramatica } of datos.lineas) r.set(i, { lecturas, sentidos, gramatica });
    hechas += hasta - desde;
    await alTrozo(r, desde, hasta, hechas, entradas.length);
  });
}

/** Una petición mínima a un modelo de otro proveedor: dice si la clave y el modelo funcionan. */
export async function probarProveedor(a: Ajustes, id: string, modelo: string): Promise<string> {
  const p = a.proveedores.find((x) => x.id === id);
  if (!p) throw new Error(tr('El proveedor de esta tarea ya no está en Ajustes: elige otro modelo para ella.'));
  const r = await compatible.pedir(p, { modelo, sistema: 'Eres una prueba de conexión.', usuario: 'Responde únicamente con la palabra 接続.', maxTokens: 200 });
  anotarUso('conexion', valorDeModelo(id, r.modelo ?? modelo), usoDeCompatible(r.uso), r.uso?.cost ?? 0);
  return `${r.texto.trim()} (${r.modelo ?? modelo})`;
}

export async function probarConexion(a: Ajustes): Promise<string> {
  const c = obtenerCliente();
  try {
    const r = await c.messages.create({
      model: a.modelos.traducir,
      max_tokens: 2000,
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: 'Responde únicamente con la palabra 接続.' }],
    } as never);
    anotarConsumo('conexion', (r as unknown as { model: string }).model, (r as unknown as { usage?: UsoApi }).usage);
    return `${textoDe(r as never).trim()} (${(r as unknown as { model: string }).model})`;
  } catch (e) {
    throw mensajeError(e);
  }
}
