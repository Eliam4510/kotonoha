// ffmpeg.wasm, para las páginas de la extensión y para el motor: lee archivos montados sin copiarlos, así que sirve
// también para películas enteras. Pesa 32 MB: solo se carga al usarlo y se libera poco después.

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { tr } from './i18n';

const MONTAJE = '/medio';
let ffmpeg: FFmpeg | null = null;
let cargando: Promise<FFmpeg> | null = null;
let temporizador: ReturnType<typeof setTimeout> | null = null;
let cola: Promise<unknown> = Promise.resolve();

async function obtener(): Promise<FFmpeg> {
  if (temporizador) clearTimeout(temporizador);
  temporizador = null;
  if (ffmpeg) return ffmpeg;
  cargando ??= (async () => {
    const f = new FFmpeg();
    await f.load({
      classWorkerURL: chrome.runtime.getURL('ffmpeg/worker.js'),
      coreURL: chrome.runtime.getURL('ffmpeg/ffmpeg-core.js'),
      wasmURL: chrome.runtime.getURL('ffmpeg/ffmpeg-core.wasm'),
    });
    ffmpeg = f;
    return f;
  })().finally(() => {
    cargando = null;
  });
  return cargando;
}

function programarLiberacion() {
  if (temporizador) clearTimeout(temporizador);
  temporizador = setTimeout(liberarFfmpeg, 2 * 60 * 1000);
}

/** El audio de una película ocupa cientos de MB en la memoria de ffmpeg: tras extraerlo conviene soltarlo ya. */
export function liberarFfmpeg() {
  if (temporizador) clearTimeout(temporizador);
  temporizador = null;
  ffmpeg?.terminate();
  ffmpeg = null;
}

/** ffmpeg solo atiende una orden a la vez: se ponen en cola y el archivo se monta para cada una. */
export function conArchivo<T>(archivo: File, tarea: (f: FFmpeg, ruta: string) => Promise<T>): Promise<T> {
  const r = cola.then(async () => {
    const f = await obtener();
    await f.createDir(MONTAJE).catch(() => {});
    await f.mount('WORKERFS' as never, { files: [archivo] }, MONTAJE);
    try {
      return await tarea(f, `${MONTAJE}/${archivo.name}`);
    } finally {
      await f.unmount(MONTAJE).catch(() => {});
      programarLiberacion();
    }
  });
  cola = r.catch(() => {});
  return r;
}

export function conProgreso<T>(f: FFmpeg, alProgreso: ((p: number) => void) | undefined, tarea: () => Promise<T>): Promise<T> {
  const oyente = ({ progress }: { progress: number }) => alProgreso?.(Math.min(100, Math.max(0, Math.round(progress * 100))));
  f.on('progress', oyente);
  return tarea().finally(() => f.off('progress', oyente));
}

/** Una pista de audio en el formato de Whisper: muestras flotantes de 32 bits, mono y a 16 kHz. */
export async function audioParaWhisper(archivo: File, indicePista = 0, alProgreso?: (p: number) => void): Promise<Blob> {
  const blob = await conArchivo(archivo, (f, ruta) =>
    conProgreso(f, alProgreso, async () => {
      const salida = '/whisper.pcm';
      const codigo = await f.exec(['-y', '-i', ruta, '-map', `0:a:${indicePista}`, '-vn', '-ac', '1', '-ar', '16000', '-f', 'f32le', salida]);
      if (codigo !== 0) throw new Error(tr('No se pudo extraer el audio de este archivo.'));
      const datos = (await f.readFile(salida)) as Uint8Array<ArrayBuffer>;
      await f.deleteFile(salida).catch(() => {});
      return new Blob([datos], { type: 'application/octet-stream' });
    })
  );
  liberarFfmpeg();
  return blob;
}
