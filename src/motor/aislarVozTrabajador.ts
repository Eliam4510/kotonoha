// Demucs en un trabajador aparte: aísla la voz de una canción para que narabas oiga solo lo que se canta al colocar la
// letra. El modelo (181 MB) se baja una vez a su propia caché, sin pasar entero por la memoria, y se comprueba con su
// SHA-256. Solo en la GPU, con WebGPU, y si calcula lo mismo que el procesador: sin ella, una canción tardaría minutos, y
// la letra se coloca sobre la mezcla, que también funciona.

import * as ort from 'onnxruntime-web/webgpu';
import { MODELO_VOZ } from '../compartido/modelosGuardados';
import { type CorrerDemucs, espectrograma, huellaDe, MUESTRAS_SEGMENTO, senalDePrueba, separarVoz } from '../nucleo/demucs';
import { FRECUENCIA } from '../nucleo/transcripcion';

export type PedidoVoz = { tipo: 'aislar'; id: number; muestras: Float32Array };

export type RespuestaVoz =
  | { tipo: 'descarga'; cargado: number; total: number }
  | { tipo: 'comprobando' }
  | { tipo: 'preparando' }
  | { tipo: 'separando'; hechos: number; total: number }
  | { tipo: 'voz'; id: number; muestras: Float32Array; ms: number }
  | { tipo: 'error'; id: number; mensaje: string; codigo?: 'modelo-distinto' | 'sin-gpu' };

// El motor de ONNX se sirve desde la propia extensión, como para Whisper, el OCR, las voces y narabas.
ort.env.wasm.wasmPaths = new URL('./ort/', self.location.href).href;
ort.env.logLevel = 'error';

const avisar = (r: RespuestaVoz, transferir?: Transferable[]) => self.postMessage(r, { transfer: transferir ?? [] });

class ModeloDistinto extends Error {}
class SinGpu extends Error {}

async function sha256(datos: ArrayBuffer): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', datos)), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** El modelo, de la caché o de GitHub. La descarga va directa a la caché; si se corta, no queda nada guardado. */
async function leerModelo(): Promise<ArrayBuffer> {
  const cache = await caches.open(MODELO_VOZ.cache);
  const guardado = await cache.match(MODELO_VOZ.url);
  if (guardado) return guardado.arrayBuffer();
  const r = await fetch(MODELO_VOZ.url);
  if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}: htdemucs.onnx`);
  const total = Number(r.headers.get('content-length') ?? 0) || MODELO_VOZ.bytes;
  let cargado = 0;
  let avisado = 0;
  const contar = new TransformStream<Uint8Array, Uint8Array>({
    transform(trozo, salida) {
      cargado += trozo.byteLength;
      if (cargado - avisado >= total / 200 || cargado >= total) {
        avisado = cargado;
        avisar({ tipo: 'descarga', cargado, total });
      }
      salida.enqueue(trozo);
    },
  });
  await cache.put(MODELO_VOZ.url, new Response(r.body.pipeThrough(contar), { headers: { 'content-type': 'application/octet-stream', 'content-length': String(total) } }));
  avisar({ tipo: 'comprobando' });
  const datos = await (await cache.match(MODELO_VOZ.url))!.arrayBuffer();
  if ((await sha256(datos)) !== MODELO_VOZ.sha256) {
    await caches.delete(MODELO_VOZ.cache);
    throw new ModeloDistinto('El modelo descargado no es el esperado.');
  }
  return datos;
}

/** Lo que da la señal de prueba en el procesador, con ONNX Runtime: la energía de cada rama y la de la voz. */
const HUELLA = [0.07684, 0.0114, 0.00738];
const TOLERANCIA = 0.03;

function correrCon(s: ort.InferenceSession): CorrerDemucs {
  const [onda, espectro] = s.inputNames;
  return async (x, z) => {
    const r = await s.run({ [onda]: new ort.Tensor('float32', x, [1, 2, MUESTRAS_SEGMENTO]), [espectro]: new ort.Tensor('float32', z, [1, 4, 2048, 336]) });
    let tiempo: Float32Array | undefined;
    let frecuencia: Float32Array | undefined;
    for (const nombre of s.outputNames) {
      const t = r[nombre];
      if (t.dims.length === 4) tiempo = (await t.getData()) as Float32Array;
      else if (t.dims.length === 5) frecuencia = (await t.getData()) as Float32Array;
    }
    if (!tiempo || !frecuencia) throw new Error('Demucs no dio sus dos salidas.');
    return { tiempo, frecuencia };
  };
}

async function calcula(correr: CorrerDemucs): Promise<boolean> {
  const x = senalDePrueba();
  const onda = new Float32Array(2 * MUESTRAS_SEGMENTO);
  onda.set(x, 0);
  onda.set(x, MUESTRAS_SEGMENTO);
  const huella = huellaDe(await correr(onda, espectrograma(x)));
  return huella.every((v, i) => Math.abs(v - HUELLA[i]) <= HUELLA[i] * TOLERANCIA);
}

let sesion: Promise<CorrerDemucs> | null = null;

function cargar() {
  sesion ??= (async () => {
    if (!('gpu' in navigator) || !(await navigator.gpu.requestAdapter())) throw new SinGpu('Sin WebGPU.');
    const datos = new Uint8Array(await leerModelo());
    avisar({ tipo: 'preparando' });
    let s: ort.InferenceSession;
    try {
      s = await ort.InferenceSession.create(datos, { executionProviders: ['webgpu'], graphOptimizationLevel: 'basic' });
    } catch (e) {
      throw new SinGpu(e instanceof Error ? e.message : String(e));
    }
    const correr = correrCon(s);
    if (!(await calcula(correr))) {
      await s.release();
      throw new SinGpu('La GPU no calcula lo mismo que el procesador.');
    }
    return correr;
  })().catch((e) => {
    sesion = null;
    throw e;
  });
  return sesion;
}

let cola: Promise<unknown> = Promise.resolve();

self.onmessage = (e: MessageEvent<PedidoVoz>) => {
  const p = e.data;
  cola = cola.then(async () => {
    try {
      const inicio = performance.now();
      const correr = await cargar();
      const voz = await separarVoz(p.muestras, FRECUENCIA, correr, (hechos, total) => avisar({ tipo: 'separando', hechos, total }));
      avisar({ tipo: 'voz', id: p.id, muestras: voz, ms: Math.round(performance.now() - inicio) }, [voz.buffer]);
    } catch (err) {
      avisar({ tipo: 'error', id: p.id, mensaje: err instanceof Error ? err.message : String(err), codigo: err instanceof ModeloDistinto ? 'modelo-distinto' : err instanceof SinGpu ? 'sin-gpu' : undefined });
    }
  });
};
