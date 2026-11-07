// Trabajador de Whisper: carga el modelo y transcribe en la GPU sin bloquear el motor.
// Se empaqueta aparte porque pesa mucho y solo hace falta si generas subtítulos.

import { env, pipeline } from '@huggingface/transformers';
import type { ConfigTdt } from '../compartido/ajustes';
import { cargarTdt, liberarTdt, transcribirTdt } from './motorTdt';

env.allowLocalModels = false;
env.useBrowserCache = true;
// El motor de ONNX se sirve desde la propia extensión: la política de seguridad prohíbe scripts remotos.
const rutaOrt = new URL('./ort/', self.location.href).href;
if (env.backends.onnx?.wasm) env.backends.onnx.wasm.wasmPaths = rutaOrt;
// Con una gráfica integrada y otra dedicada, sin esto el navegador podría elegir la integrada.
if (env.backends.onnx?.webgpu) env.backends.onnx.webgpu.powerPreference = 'high-performance';

type Asr = ((audio: Float32Array, opciones: Record<string, unknown>) => Promise<{ text: string; chunks?: { text: string; timestamp: [number, number | null] }[] }>) & {
  dispose?: () => Promise<void>;
};

interface AdaptadorGpu {
  info?: { vendor?: string; architecture?: string; description?: string };
}

let asr: Asr | null = null;
let conTdt = false;
let claveCargada = '';
let dispositivo: 'webgpu' | 'wasm' = 'wasm';
let nombreDispositivo = '';

async function elegirDispositivo(): Promise<void> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(o: { powerPreference: string }): Promise<AdaptadorGpu | null> } }).gpu;
  const adaptador = gpu ? await gpu.requestAdapter({ powerPreference: 'high-performance' }).catch(() => null) : null;
  dispositivo = adaptador ? 'webgpu' : 'wasm';
  const i = adaptador?.info;
  nombreDispositivo = adaptador ? i?.description || [i?.vendor?.toUpperCase(), i?.architecture].filter(Boolean).join(' ') || 'GPU' : 'procesador (sin GPU)';
}

interface DispositivoGpu {
  lost: Promise<{ message?: string; reason?: string }>;
  destroy(): void;
}

let gpuActual: DispositivoGpu | null = null;

/** Si el controlador se reinicia, la GPU se pierde. Avisar enseguida evita esperar a una respuesta que no llegará. */
async function vigilarGpu() {
  if (dispositivo !== 'webgpu') return;
  try {
    const gpu = (await env.backends.onnx?.webgpu?.device) as unknown as DispositivoGpu | undefined;
    if (!gpu?.lost) return;
    gpuActual = gpu;
    const info = await gpu.lost;
    // Al cambiar de modelo se libera el anterior, y con él puede irse su dispositivo: eso no es un fallo de la GPU.
    if (gpu !== gpuActual) return;
    self.postMessage({ tipo: 'gpuPerdida', motivo: info?.message || info?.reason });
  } catch {
    // Sin acceso al dispositivo queda el vigilante de tiempo del motor.
  }
}

self.onmessage = async (e: MessageEvent) => {
  const m = e.data as
    | { tipo: 'cargar'; modelo: string; dtype: Record<string, string>; externos?: Record<string, number> }
    | { tipo: 'cargarTdt'; modelo: string; tdt: ConfigTdt }
    | { tipo: 'perderGpuPrueba' }
    | { tipo: 'transcribir'; id: number; pcm: Float32Array; idioma: string };
  try {
    if (m.tipo === 'cargarTdt') {
      const clave = `tdt|${m.modelo}|${m.tdt.revision}`;
      if (clave !== claveCargada) {
        gpuActual = null;
        await asr?.dispose?.();
        asr = null;
        claveCargada = '';
        await elegirDispositivo();
        await cargarTdt(m.modelo, m.tdt, dispositivo === 'webgpu', (p) => self.postMessage({ tipo: 'descarga', archivo: p.archivo, cargado: p.cargado, total: p.total, estado: p.estado }));
        conTdt = true;
        claveCargada = clave;
        vigilarGpu();
      }
      self.postMessage({ tipo: 'listo', dispositivo: nombreDispositivo });
      return;
    }
    if (m.tipo === 'cargar') {
      const clave = `${m.modelo}|${JSON.stringify(m.dtype)}`;
      if (clave !== claveCargada) {
        // Al cambiar de modelo se libera el anterior: si no, ambos ocuparían memoria de la GPU.
        gpuActual = null;
        await asr?.dispose?.();
        asr = null;
        await liberarTdt();
        conTdt = false;
        claveCargada = '';
        await elegirDispositivo();
        asr = (await pipeline('automatic-speech-recognition', m.modelo, {
          device: dispositivo,
          dtype: m.dtype as never,
          ...(m.externos ? { use_external_data_format: m.externos } : {}),
          progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number; progress?: number }) => {
            if (p.status === 'progress' || p.status === 'initiate' || p.status === 'done') {
              self.postMessage({ tipo: 'descarga', archivo: p.file, cargado: p.loaded ?? 0, total: p.total ?? 0, estado: p.status });
            }
          },
        })) as unknown as Asr;
        claveCargada = clave;
        vigilarGpu();
      }
      self.postMessage({ tipo: 'listo', dispositivo: nombreDispositivo });
      return;
    }
    if (m.tipo === 'perderGpuPrueba') {
      gpuActual?.destroy();
      return;
    }
    if (conTdt) {
      self.postMessage({ tipo: 'resultado', id: m.id, tokens: await transcribirTdt(m.pcm) });
      return;
    }
    if (!asr) throw new Error('El modelo no está cargado');
    const r = await asr(m.pcm, { language: m.idioma, task: 'transcribe', return_timestamps: true });
    self.postMessage({ tipo: 'resultado', id: m.id, texto: r.text, trozos: r.chunks ?? [] });
  } catch (err) {
    self.postMessage({ tipo: 'error', id: 'id' in m ? m.id : undefined, mensaje: err instanceof Error ? err.message : String(err) });
  }
};
