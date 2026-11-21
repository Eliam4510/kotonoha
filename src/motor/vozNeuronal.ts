// Las voces neuronales, en el propio equipo: un trabajador aparte las lee con ONNX (Kokoro para el inglés, Piper para el
// alemán y las voces de AivisHub), y aquí se guarda cada frase del inglés y del alemán en una caché, en MP3, como las de
// la voz local del japonés. El trabajador se cierra tras unos minutos sin uso: sus modelos ocupan cientos de MB de memoria.

import { type Ajustes, vozNeuronalActiva } from '../compartido/ajustes';
import { tr } from '../compartido/i18n';
import { aMp3, bytesABase64 } from './grabacion';
import type { ArchivoVoz, PedidoSbv2 } from './vozSbv2';
import type { MotorVoz, PedidoVoz, RespuestaVoz } from './vozTrabajador';

const CACHE = 'kotonoha-voz-neuronal';
const MAXIMO_EN_CACHE = 600;
const LIBERAR_TRAS_MS = 3 * 60 * 1000;
/** Kokoro en el procesador tarda algo más de lo que dura la frase: margen de sobra, contando la primera descarga. */
const ESPERA_MAXIMA_MS = 10 * 60 * 1000;

export type AudioDeVoz = { muestras: Float32Array; frecuencia: number; dispositivo?: string; ms: number; msCalculo?: number; recienCargada?: boolean };
type Avance = (p: { archivo: string; cargado: number; total: number }) => void;

let trabajador: Worker | null = null;
let temporizador: ReturnType<typeof setTimeout> | null = null;
let siguienteId = 1;
const pendientes = new Map<number, { ok: (r: RespuestaVoz) => void; mal: (e: Error) => void; avance?: Avance }>();

function trabajadorListo(): Worker {
  if (temporizador) clearTimeout(temporizador);
  temporizador = null;
  if (trabajador) return trabajador;
  const t = new Worker(chrome.runtime.getURL('voz.js'), { type: 'module' });
  t.onmessage = (e: MessageEvent<RespuestaVoz>) => {
    const r = e.data;
    if (r.tipo === 'descarga') {
      if (r.id !== undefined) pendientes.get(r.id)?.avance?.(r);
      return;
    }
    const p = pendientes.get(r.id);
    pendientes.delete(r.id);
    if (r.tipo === 'error') p?.mal(new Error(r.mensaje));
    else p?.ok(r);
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

/** Un pedido al trabajador. Las lecturas tienen tiempo límite; las descargas, no: pueden ser de cientos de MB. */
function mandar(pedido: (id: number) => PedidoVoz, limiteMs: number | null, avance?: Avance): Promise<RespuestaVoz> {
  return new Promise((ok, mal) => {
    const id = siguienteId++;
    const limite =
      limiteMs === null
        ? null
        : setTimeout(() => {
            pendientes.delete(id);
            mal(new Error(tr('La voz neuronal tardó demasiado.')));
          }, limiteMs);
    pendientes.set(id, {
      ok: (r) => {
        if (limite) clearTimeout(limite);
        ok(r);
      },
      mal: (e) => {
        if (limite) clearTimeout(limite);
        mal(e);
      },
      avance,
    });
    trabajadorListo().postMessage(pedido(id));
  });
}

async function audio(pedido: (id: number) => PedidoVoz): Promise<AudioDeVoz> {
  const r = await mandar(pedido, ESPERA_MAXIMA_MS);
  if (r.tipo !== 'audio') throw new Error(tr('No se pudo leer la frase con la voz neuronal.'));
  return { muestras: r.muestras, frecuencia: r.frecuencia, dispositivo: r.dispositivo, ms: r.ms, msCalculo: r.msCalculo, recienCargada: r.recienCargada };
}

/** Las oraciones ya preparadas, leídas con una voz de AivisHub. */
export const leerSbv2 = (p: PedidoSbv2): Promise<AudioDeVoz> => audio((id) => ({ tipo: 'leerSbv2', id, ...p }));

/** Baja al disco lo que falte de esos archivos, avisando de cómo va. */
export async function instalarArchivos(archivos: ArchivoVoz[], avance: Avance): Promise<void> {
  await mandar((id) => ({ tipo: 'instalar', id, archivos }), null, avance);
}

const claveDeAudio = (motor: MotorVoz, voz: string, texto: string): string => {
  let h = 0x811c9dc5;
  const s = `${motor}\u0000${voz}\u0000${texto}`;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return `${(h >>> 0).toString(36)}-${s.length}`;
};
const urlDeCache = (clave: string) => `https://kotonoha.invalid/voz-neuronal/${clave}`;

export async function deCache(clave: string): Promise<string | null> {
  try {
    const r = await (await caches.open(CACHE)).match(urlDeCache(clave));
    return r ? await r.text() : null;
  } catch {
    return null;
  }
}

export async function aCache(clave: string, datos: string): Promise<void> {
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
  const { muestras, frecuencia } = await audio((id) => ({ tipo: 'leer', id, motor, voz, texto, velocidad: 1 }));
  if (!muestras.length) throw new Error(tr('No se pudo leer la frase con la voz neuronal.'));
  const datos = bytesABase64(aMp3([muestras], frecuencia));
  await aCache(clave, datos);
  return datos;
}
