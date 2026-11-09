// Las voces neuronales del inglés (Kokoro) y del alemán (Piper), en el propio equipo: un trabajador aparte las lee con
// ONNX, y aquí se guarda cada frase en una caché, en MP3, como las de la voz local del japonés. El trabajador se cierra
// tras unos minutos sin uso: sus modelos ocupan cientos de MB de memoria.

import { type Ajustes, vozNeuronalActiva } from '../compartido/ajustes';
import { tr } from '../compartido/i18n';
import { aMp3, bytesABase64 } from './grabacion';
import type { MotorVoz, PedidoVoz, RespuestaVoz } from './vozTrabajador';

const CACHE = 'kotonoha-voz-neuronal';
const MAXIMO_EN_CACHE = 600;
const LIBERAR_TRAS_MS = 3 * 60 * 1000;
/** Kokoro en el procesador tarda algo más de lo que dura la frase: margen de sobra, contando la primera descarga. */
const ESPERA_MAXIMA_MS = 10 * 60 * 1000;

let trabajador: Worker | null = null;
let temporizador: ReturnType<typeof setTimeout> | null = null;
let siguienteId = 1;
const pendientes = new Map<number, { ok: (r: { muestras: Float32Array; frecuencia: number }) => void; mal: (e: Error) => void }>();

function trabajadorListo(): Worker {
  if (temporizador) clearTimeout(temporizador);
  temporizador = null;
  if (trabajador) return trabajador;
  const t = new Worker(chrome.runtime.getURL('voz.js'), { type: 'module' });
  t.onmessage = (e: MessageEvent<RespuestaVoz>) => {
    const r = e.data;
    if (r.tipo === 'descarga') return;
    const p = pendientes.get(r.id);
    pendientes.delete(r.id);
    if (r.tipo === 'audio') p?.ok({ muestras: r.muestras, frecuencia: r.frecuencia });
    else p?.mal(new Error(r.mensaje));
    if (!pendientes.size) programarCierre();
  };
  t.onerror = (e) => {
    for (const p of pendientes.values()) p.mal(new Error(e.message || tr('No se pudo leer la frase con la voz neuronal.')));
    pendientes.clear();
    trabajador = null;
  };
  trabajador = t;
  return t;
}

function programarCierre() {
  if (temporizador) clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    trabajador?.terminate();
    trabajador = null;
  }, LIBERAR_TRAS_MS);
}

function pedir(motor: MotorVoz, voz: string, texto: string): Promise<{ muestras: Float32Array; frecuencia: number }> {
  return new Promise((ok, mal) => {
    const id = siguienteId++;
    const limite = setTimeout(() => {
      pendientes.delete(id);
      mal(new Error(tr('La voz neuronal tardó demasiado.')));
    }, ESPERA_MAXIMA_MS);
    pendientes.set(id, {
      ok: (r) => {
        clearTimeout(limite);
        ok(r);
      },
      mal: (e) => {
        clearTimeout(limite);
        mal(e);
      },
    });
    trabajadorListo().postMessage({ tipo: 'leer', id, motor, voz, texto, velocidad: 1 } satisfies PedidoVoz);
  });
}

const claveDeAudio = (motor: MotorVoz, voz: string, texto: string): string => {
  let h = 0x811c9dc5;
  const s = `${motor}\u0000${voz}\u0000${texto}`;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return `${(h >>> 0).toString(36)}-${s.length}`;
};
const urlDeCache = (clave: string) => `https://kotonoha.invalid/voz-neuronal/${clave}`;

async function deCache(clave: string): Promise<string | null> {
  try {
    const r = await (await caches.open(CACHE)).match(urlDeCache(clave));
    return r ? await r.text() : null;
  } catch {
    return null;
  }
}

async function aCache(clave: string, datos: string): Promise<void> {
  try {
    const cache = await caches.open(CACHE);
    await cache.put(urlDeCache(clave), new Response(datos));
    const claves = await cache.keys();
    for (const viejo of claves.slice(0, Math.max(0, claves.length - MAXIMO_EN_CACHE))) await cache.delete(viejo);
  } catch {
    // Sin caché, se vuelve a leer la próxima vez.
  }
}

/** Si las frases se leen con una voz neuronal: al estudiar inglés o alemán, con la opción activada. */
export const usarVozNeuronal = (a: Ajustes): boolean => vozNeuronalActiva(a);

/** La frase leída con la voz neuronal de la lengua que se estudia, en MP3 y en base64. */
export async function leer(a: Ajustes, texto: string): Promise<string> {
  const motor: MotorVoz = a.idiomaObjetivo === 'de' ? 'piper' : 'kokoro';
  const voz = motor === 'piper' ? 'thorsten' : a.vozNeuronal.vozIngles;
  const clave = claveDeAudio(motor, voz, texto);
  const guardado = await deCache(clave);
  if (guardado) return guardado;
  const { muestras, frecuencia } = await pedir(motor, voz, texto);
  if (!muestras.length) throw new Error(tr('No se pudo leer la frase con la voz neuronal.'));
  const datos = bytesABase64(aMp3([muestras], frecuencia));
  await aCache(clave, datos);
  return datos;
}
