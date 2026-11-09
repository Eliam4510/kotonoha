// Archivos de video propios: qué pistas traen, sus subtítulos incrustados y sus pistas de audio, con ffmpeg.wasm.

import { analizarInformeFfmpeg, formatoExtraccionAudio, type InformeMedio, type PistaMedio } from '../nucleo/medios';
import { audioParaWhisper, conArchivo, conProgreso } from '../compartido/ffmpeg';
import { tr } from '../compartido/i18n';

export type { InformeMedio, PistaMedio };

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

/**
 * Convierte una pista de audio al formato de Whisper. Devuelve la URL de un blob con muestras
 * flotantes de 32 bits, mono y a 16 kHz, que el motor puede leer: comparten origen.
 */
export async function extraerAudioParaWhisper(archivo: File, pista: PistaMedio | undefined, alProgreso?: (p: number) => void): Promise<string> {
  return URL.createObjectURL(await audioParaWhisper(archivo, pista?.indice ?? 0, alProgreso));
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
