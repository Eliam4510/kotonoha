// YAMNet en un trabajador aparte: cuánto «canto» suena en cada momento de una canción, para no poner versos de su letra
// en un pasaje instrumental. Pesa 16 MB: se baja una vez a su propia caché y se comprueba con su SHA-256. Va en el
// procesador, que le basta (un minuto de audio en unas décimas), y así no le quita la tarjeta gráfica a Whisper.

import * as ort from 'onnxruntime-web/webgpu';
import { MODELO_CANTO } from '../compartido/modelosGuardados';

export type PedidoCanto = { tipo: 'puntuar'; id: number; muestras: Float32Array };

export type RespuestaCanto = { tipo: 'canto'; id: number; marcos: Float32Array; ms: number } | { tipo: 'error'; id: number; mensaje: string };

/** La clase «Singing» de las 521 de AudioSet que da YAMNet. */
const CANTO = 24;

// El motor de ONNX se sirve desde la propia extensión, como para Whisper, el OCR, las voces y narabas.
ort.env.wasm.wasmPaths = new URL('./ort/', self.location.href).href;
ort.env.logLevel = 'error';

const avisar = (r: RespuestaCanto, transferir: Transferable[] = []) => self.postMessage(r, { transfer: transferir });

async function sha256(datos: ArrayBuffer): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', datos)), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** El modelo, de la caché o de GitHub. Si el descargado no es el publicado, se borra y no se usa. */
async function leerModelo(): Promise<ArrayBuffer> {
  const cache = await caches.open(MODELO_CANTO.cache);
  const guardado = await cache.match(MODELO_CANTO.url);
  if (guardado) return guardado.arrayBuffer();
  const r = await fetch(MODELO_CANTO.url);
  if (!r.ok) throw new Error(`HTTP ${r.status}: yamnet.onnx`);
  const datos = await r.arrayBuffer();
  if ((await sha256(datos)) !== MODELO_CANTO.sha256) throw new Error('El modelo descargado no es el esperado.');
  await cache.put(MODELO_CANTO.url, new Response(datos, { headers: { 'content-type': 'application/octet-stream', 'content-length': String(datos.byteLength) } }));
  return datos;
}

let sesion: Promise<ort.InferenceSession> | null = null;

function cargar() {
  sesion ??= (async () => ort.InferenceSession.create(new Uint8Array(await leerModelo()), { executionProviders: ['wasm'] }))().catch((e) => {
    sesion = null;
    throw e;
  });
  return sesion;
}

let cola: Promise<unknown> = Promise.resolve();

self.onmessage = (e: MessageEvent<PedidoCanto>) => {
  const p = e.data;
  // Un bloque detrás de otro: el modelo es uno solo.
  cola = cola.then(async () => {
    try {
      const inicio = performance.now();
      const s = await cargar();
      const salida = (await s.run({ waveform: new ort.Tensor('float32', p.muestras, [p.muestras.length]) })).output_0;
      const [marcos, clases] = salida.dims as number[];
      const datos = salida.data as Float32Array;
      const canto = new Float32Array(marcos);
      for (let f = 0; f < marcos; f++) canto[f] = datos[f * clases + CANTO];
      avisar({ tipo: 'canto', id: p.id, marcos: canto, ms: Math.round(performance.now() - inicio) }, [canto.buffer]);
    } catch (err) {
      avisar({ tipo: 'error', id: p.id, mensaje: err instanceof Error ? err.message : String(err) });
    }
  });
};
