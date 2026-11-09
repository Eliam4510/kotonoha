// narabas, el modelo de fonemas del japonés de la práctica del acento, en un trabajador aparte: un wav2vec2 de 1,26 GB que
// dice qué fonema suena cada 20 ms. Se baja una vez a su propia caché, sin pasar entero por la memoria, y se comprueba con
// su SHA-256. Va en la GPU con WebGPU si da lo mismo que en el procesador; si no, en el procesador.

import * as ort from 'onnxruntime-web/webgpu';
import { MODELO_MORAS } from '../compartido/modelosGuardados';
import { fonemasOidos } from '../nucleo/alineacion';

export type PedidoNarabas = { tipo: 'oir'; id: number; muestras: Float32Array; cpu: boolean } | { tipo: 'preparar'; cpu: boolean };

export type RespuestaNarabas =
  | { tipo: 'descarga'; cargado: number; total: number }
  | { tipo: 'comprobando' }
  | { tipo: 'preparando' }
  | { tipo: 'procesando' }
  | { tipo: 'fonemas'; id: number; fonemas: string[]; ms: number; dispositivo: Dispositivo }
  | { tipo: 'error'; id: number; mensaje: string; codigo?: 'modelo-distinto'; dispositivo?: Dispositivo };

export type Dispositivo = 'webgpu' | 'wasm';

// El motor de ONNX se sirve desde la propia extensión, como para Whisper, el OCR y las voces.
ort.env.wasm.wasmPaths = new URL('./ort/', self.location.href).href;
ort.env.logLevel = 'error';

const avisar = (r: RespuestaNarabas) => self.postMessage(r);

class ModeloDistinto extends Error {}

async function sha256(datos: ArrayBuffer): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', datos)), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** El modelo, de la caché o de GitHub. La descarga va directa a la caché; si se corta, no queda nada guardado. */
async function leerModelo(): Promise<ArrayBuffer> {
  const cache = await caches.open(MODELO_MORAS.cache);
  const guardado = await cache.match(MODELO_MORAS.url);
  if (guardado) return guardado.arrayBuffer();
  const r = await fetch(MODELO_MORAS.url);
  if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}: narabas-v0.onnx`);
  const total = Number(r.headers.get('content-length') ?? 0) || MODELO_MORAS.bytes;
  let cargado = 0;
  let avisado = 0;
  const contar = new TransformStream<Uint8Array, Uint8Array>({
    transform(trozo, salida) {
      cargado += trozo.byteLength;
      // Un aviso por cada medio por ciento basta.
      if (cargado - avisado >= total / 200 || cargado >= total) {
        avisado = cargado;
        avisar({ tipo: 'descarga', cargado, total });
      }
      salida.enqueue(trozo);
    },
  });
  await cache.put(MODELO_MORAS.url, new Response(r.body.pipeThrough(contar), { headers: { 'content-type': 'application/octet-stream', 'content-length': String(total) } }));
  avisar({ tipo: 'comprobando' });
  const datos = await (await cache.match(MODELO_MORAS.url))!.arrayBuffer();
  if ((await sha256(datos)) !== MODELO_MORAS.sha256) {
    await caches.delete(MODELO_MORAS.cache);
    throw new ModeloDistinto('El modelo descargado no es el esperado.');
  }
  return datos;
}

/**
 * Una señal fija de un segundo (una vocal sintética con su tono) y la media de lo que da el modelo en cada clase, medida
 * en el procesador con ONNX Runtime. Una GPU que se aparta de esto calcula mal: con Kokoro, una Radeon daba valores de
 * cientos o NaN.
 */
function senalDePrueba(): Float32Array {
  const x = new Float32Array(16000);
  for (let i = 0; i < x.length; i++) {
    const t = i / 16000;
    x[i] = 0.3 * Math.sin(2 * Math.PI * (140 * t + 20 * t * t)) * (0.5 + 0.5 * Math.sin(2 * Math.PI * 3 * t)) + 0.1 * Math.sin(2 * Math.PI * 800 * t) + 0.05 * Math.sin(2 * Math.PI * 1200 * t);
  }
  return x;
}
const HUELLA = [
  7.11, -9.54, -10.29, -5.03, -2.25, -1.22, -5.55, -8.79, -6.08, -4.69, -3.85, -13.09, -3.11, -4.6, -3.75, -21.49, -8.62, -2.26, -7.22, -2.66, -5.26, -2.78,
  -21.43, -7.19, -3.45, -9.44, -2.67, -8.37, -1.76, -6.78, -10.92, -3.3, -6.98, -3.11, -5.04, -3.61, -6.68, -20.67, -1.94, -12.92, -2.02, -3.78, -5.49,
];
const TOLERANCIA = 0.25;

async function calcula(sesion: ort.InferenceSession): Promise<boolean> {
  const x = senalDePrueba();
  const salida = (await sesion.run({ input: new ort.Tensor('float32', x, [1, x.length]) })).output;
  const [, marcos, clases] = salida.dims as number[];
  const datos = salida.data as Float32Array;
  if (clases !== HUELLA.length || !marcos) return false;
  for (let k = 0; k < clases; k++) {
    let media = 0;
    for (let t = 0; t < marcos; t++) media += datos[t * clases + k] / marcos;
    if (!(Math.abs(media - HUELLA[k]) <= TOLERANCIA)) return false;
  }
  return true;
}

let sesion: Promise<{ s: ort.InferenceSession; dispositivo: Dispositivo }> | null = null;

function cargar(cpu: boolean) {
  sesion ??= (async () => {
    const datos = new Uint8Array(await leerModelo());
    avisar({ tipo: 'preparando' });
    if (!cpu && 'gpu' in navigator) {
      try {
        const s = await ort.InferenceSession.create(datos, { executionProviders: ['webgpu'] });
        if (await calcula(s)) return { s, dispositivo: 'webgpu' as const };
        await s.release();
      } catch {
        // Sin WebGPU, o sin memoria en la GPU: al procesador.
      }
    }
    return { s: await ort.InferenceSession.create(datos, { executionProviders: ['wasm'] }), dispositivo: 'wasm' as const };
  })().catch((e) => {
    sesion = null;
    throw e;
  });
  return sesion;
}

let cola: Promise<unknown> = Promise.resolve();

self.onmessage = (e: MessageEvent<PedidoNarabas>) => {
  const p = e.data;
  // Solo cargar, para que la grabación que viene no espere (el modelo ya está en la caché: lo mira quien lo pide).
  if (p.tipo === 'preparar') {
    cola = cola.then(() => cargar(p.cpu).catch(() => {}));
    return;
  }
  // Una grabación detrás de otra.
  cola = cola.then(async () => {
    let dispositivo: Dispositivo | undefined;
    try {
      const inicio = performance.now();
      const cargada = await cargar(p.cpu);
      dispositivo = cargada.dispositivo;
      avisar({ tipo: 'procesando' });
      const salida = (await cargada.s.run({ input: new ort.Tensor('float32', p.muestras, [1, p.muestras.length]) })).output;
      const [, marcos, clases] = salida.dims as number[];
      avisar({ tipo: 'fonemas', id: p.id, fonemas: fonemasOidos(salida.data as Float32Array, marcos, clases), ms: Math.round(performance.now() - inicio), dispositivo });
    } catch (err) {
      avisar({ tipo: 'error', id: p.id, mensaje: err instanceof Error ? err.message : String(err), codigo: err instanceof ModeloDistinto ? 'modelo-distinto' : undefined, dispositivo });
    }
  });
};
