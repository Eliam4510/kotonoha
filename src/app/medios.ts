// Archivos de video propios: qué pistas traen, sus subtítulos incrustados y sus pistas de audio.
// Usa ffmpeg.wasm con el archivo montado sin copiarlo, así que sirve también para películas enteras.
// ffmpeg pesa 32 MB: solo se carga al abrir un archivo y se libera poco después.

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { analizarInformeFfmpeg, formatoExtraccionAudio, type InformeMedio, type PistaMedio } from '../nucleo/medios';
import { tr } from '../compartido/i18n';

export type { InformeMedio, PistaMedio };

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
  temporizador = setTimeout(() => {
    ffmpeg?.terminate();
    ffmpeg = null;
  }, 2 * 60 * 1000);
}

/** ffmpeg solo atiende una orden a la vez: se ponen en cola y el archivo se monta para cada una. */
function conArchivo<T>(archivo: File, tarea: (f: FFmpeg, ruta: string) => Promise<T>): Promise<T> {
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

export function inspeccionarArchivo(archivo: File): Promise<InformeMedio> {
  return conArchivo(archivo, async (f, ruta) => {
    let informe = '';
    const alRegistro = ({ message }: { message: string }) => {
      informe += `${message}\n`;
    };
    f.on('log', alRegistro);
    // Sin salida, ffmpeg escribe el informe y termina con error: es lo esperado.
    await f.exec(['-hide_banner', '-i', ruta]).catch(() => {});
    f.off('log', alRegistro);
    return analizarInformeFfmpeg(informe);
  });
}

/** Devuelve el texto de una pista de subtítulos incrustada, en SRT o ASS según su origen. */
export function extraerSubtitulos(archivo: File, pista: PistaMedio): Promise<string> {
  return conArchivo(archivo, async (f, ruta) => {
    const ass = /^(ass|ssa)$/.test(pista.codec);
    const salida = ass ? '/sub.ass' : '/sub.srt';
    const codigo = await f.exec(['-y', '-i', ruta, '-map', `0:s:${pista.indice}`, ...(ass ? ['-c:s', 'copy'] : ['-c:s', 'srt']), salida]);
    if (codigo !== 0) throw new Error(tr('No se pudieron extraer estos subtítulos.'));
    const datos = (await f.readFile(salida, 'utf8')) as string;
    await f.deleteFile(salida).catch(() => {});
    return datos;
  });
}

function conProgreso<T>(f: FFmpeg, alProgreso: ((p: number) => void) | undefined, tarea: () => Promise<T>): Promise<T> {
  const oyente = ({ progress }: { progress: number }) => alProgreso?.(Math.min(100, Math.max(0, Math.round(progress * 100))));
  f.on('progress', oyente);
  return tarea().finally(() => f.off('progress', oyente));
}

/**
 * Convierte una pista de audio al formato de Whisper. Devuelve la URL de un blob con muestras
 * flotantes de 32 bits, mono y a 16 kHz, que el motor puede leer: comparten origen.
 */
export async function extraerAudioParaWhisper(archivo: File, pista: PistaMedio | undefined, alProgreso?: (p: number) => void): Promise<string> {
  const url = await conArchivo(archivo, (f, ruta) =>
    conProgreso(f, alProgreso, async () => {
      const salida = '/whisper.pcm';
      const codigo = await f.exec(['-y', '-i', ruta, '-map', `0:a:${pista?.indice ?? 0}`, '-vn', '-ac', '1', '-ar', '16000', '-f', 'f32le', salida]);
      if (codigo !== 0) throw new Error(tr('No se pudo extraer el audio de este archivo.'));
      const datos = (await f.readFile(salida)) as Uint8Array<ArrayBuffer>;
      await f.deleteFile(salida).catch(() => {});
      return URL.createObjectURL(new Blob([datos], { type: 'application/octet-stream' }));
    })
  );
  // El audio de una película ocupa cientos de MB en la memoria de ffmpeg: se libera de inmediato.
  ffmpeg?.terminate();
  ffmpeg = null;
  return url;
}

/** Extrae una pista de audio como archivo independiente, para reproducirla junto al video. */
export function extraerPistaAudio(archivo: File, pista: PistaMedio, alProgreso?: (p: number) => void): Promise<string> {
  return conArchivo(archivo, (f, ruta) =>
    conProgreso(f, alProgreso, async () => {
      const formato = formatoExtraccionAudio(pista.codec);
      const salida = `/pista.${formato.extension}`;
      const codigo = await f.exec(['-y', '-i', ruta, '-map', `0:a:${pista.indice}`, '-vn', ...formato.args, salida]);
      if (codigo !== 0) throw new Error(tr('No se pudo extraer esta pista de audio.'));
      const datos = (await f.readFile(salida)) as Uint8Array<ArrayBuffer>;
      await f.deleteFile(salida).catch(() => {});
      return URL.createObjectURL(new Blob([datos], { type: formato.tipo }));
    })
  );
}

/**
 * El navegador no permite elegir la pista de audio de un video, así que la elegida suena desde un
 * elemento <audio> aparte que sigue al video, silenciado. Devuelve la función para deshacerlo.
 */
export function sincronizarAudio(video: HTMLVideoElement, url: string): () => void {
  const audio = new Audio(url);
  const estabaSilenciado = video.muted;
  video.muted = true;
  audio.volume = video.volume;
  const ajustar = () => {
    if (Math.abs(audio.currentTime - video.currentTime) > 0.25) audio.currentTime = video.currentTime;
  };
  const alReproducir = () => {
    ajustar();
    audio.play().catch(() => {});
  };
  const alPausar = () => audio.pause();
  const alSaltar = () => {
    audio.currentTime = video.currentTime;
  };
  const alVelocidad = () => {
    audio.playbackRate = video.playbackRate;
  };
  const alVolumen = () => {
    audio.volume = video.volume;
  };
  video.addEventListener('play', alReproducir);
  video.addEventListener('pause', alPausar);
  video.addEventListener('seeked', alSaltar);
  video.addEventListener('ratechange', alVelocidad);
  video.addEventListener('volumechange', alVolumen);
  const deriva = setInterval(() => {
    if (!video.paused) ajustar();
  }, 2000);
  audio.playbackRate = video.playbackRate;
  audio.currentTime = video.currentTime;
  if (!video.paused) audio.play().catch(() => {});
  return () => {
    clearInterval(deriva);
    video.removeEventListener('play', alReproducir);
    video.removeEventListener('pause', alPausar);
    video.removeEventListener('seeked', alSaltar);
    video.removeEventListener('ratechange', alVelocidad);
    video.removeEventListener('volumechange', alVolumen);
    audio.pause();
    audio.src = '';
    video.muted = estabaSilenciado;
    URL.revokeObjectURL(url);
  };
}
