// La grabación del micrófono para el dictado del Portapapeles. Se graba en la propia página, en Opus, y a la vez se mide
// cuánto suena, para que se vea que el micrófono oye. El navegador pide permiso la primera vez; el permiso es de la
// extensión entera, así que vale igual en la ventana de la app que en la pestaña del Portapapeles.

import { tr } from '../compartido/i18n';
import { nivelDeVoz } from '../nucleo/dictado';

export interface GrabacionHecha {
  audio: Blob;
  duracionMs: number;
}

export interface Grabadora {
  /** Cuánto suena ahora, de 0 a 1. */
  nivel(): number;
  /** Lo que lleva grabado, en milisegundos. */
  duracion(): number;
  /** Termina y devuelve lo grabado; null si no llegó a grabarse nada. */
  terminar(): Promise<GrabacionHecha | null>;
  /** Termina sin quedarse con nada. */
  cancelar(): void;
}

const TIPO = 'audio/webm;codecs=opus';
/** Para la voz basta: un minuto ocupa unos 360 kB. */
const BITS_POR_SEGUNDO = 48000;

/** `alCortarse` avisa si el micrófono deja de dar audio por su cuenta: se desenchufa, u otra aplicación se lo queda. */
export async function empezarGrabacion(alCortarse: () => void): Promise<Grabadora> {
  const flujo = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    video: false,
  });
  const ctx = new AudioContext();
  const fuente = ctx.createMediaStreamSource(flujo);
  const analizador = ctx.createAnalyser();
  analizador.fftSize = 2048;
  fuente.connect(analizador);
  ctx.resume().catch(() => {});
  const muestras = new Float32Array(analizador.fftSize);

  const grabador = new MediaRecorder(flujo, MediaRecorder.isTypeSupported(TIPO) ? { mimeType: TIPO, audioBitsPerSecond: BITS_POR_SEGUNDO } : {});
  const trozos: Blob[] = [];
  grabador.ondataavailable = (e) => {
    if (e.data.size) trozos.push(e.data);
  };
  const inicio = performance.now();
  let fin: number | null = null;
  // Por trozos de un segundo: si algo falla al final, lo grabado hasta ahí ya está fuera del grabador.
  grabador.start(1000);

  let cerrado = false;
  const cerrar = () => {
    if (cerrado) return;
    cerrado = true;
    for (const p of flujo.getTracks()) {
      p.onended = null;
      p.stop();
    }
    fuente.disconnect();
    ctx.close().catch(() => {});
  };
  for (const p of flujo.getAudioTracks()) p.onended = () => alCortarse();

  return {
    nivel() {
      if (cerrado) return 0;
      analizador.getFloatTimeDomainData(muestras);
      return nivelDeVoz(muestras);
    },
    duracion: () => (fin ?? performance.now()) - inicio,
    async terminar() {
      if (grabador.state === 'inactive') {
        cerrar();
        return null;
      }
      fin = performance.now();
      await new Promise<void>((ok) => {
        grabador.onstop = () => ok();
        grabador.stop();
      });
      cerrar();
      const audio = new Blob(trozos, { type: grabador.mimeType || 'audio/webm' });
      return audio.size ? { audio, duracionMs: Math.round(fin - inicio) } : null;
    },
    cancelar() {
      if (grabador.state !== 'inactive') grabador.stop();
      cerrar();
    },
  };
}

/** Lo que pasó al pedir el micrófono, dicho para quien lo usa. `permiso` dice si se arregla dándole permiso. */
export function errorDeMicrofono(e: unknown): { mensaje: string; permiso: boolean } {
  const nombre = e instanceof DOMException ? e.name : '';
  if (nombre === 'NotAllowedError' || nombre === 'SecurityError') {
    return { mensaje: tr('El navegador no deja usar el micrófono. Permítelo en los permisos de Kotonoha y vuelve a intentarlo.'), permiso: true };
  }
  if (nombre === 'NotFoundError' || nombre === 'OverconstrainedError') return { mensaje: tr('No se encontró ningún micrófono.'), permiso: false };
  if (nombre === 'NotReadableError' || nombre === 'AbortError') {
    return { mensaje: tr('El micrófono no responde. Puede que otra aplicación lo esté usando.'), permiso: false };
  }
  return { mensaje: tr('No se pudo usar el micrófono: {0}', e instanceof Error ? e.message : String(e)), permiso: false };
}

/** Los permisos de la extensión en los ajustes del navegador, donde se permite el micrófono. */
export function abrirPermisosMicrofono(): void {
  chrome.tabs.create({ url: `chrome://settings/content/siteDetails?site=${encodeURIComponent(location.origin)}` }).catch(console.error);
}
