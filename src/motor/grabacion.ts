// Grabación del audio de la pestaña para las tarjetas, y recorte de capturas.

import { Mp3Encoder } from '@breezystack/lamejs';
import { imagenNegra, tramoConSonido } from '../nucleo/medios';

let flujo: MediaStream | null = null;
let contexto: AudioContext | null = null;
let fuente: MediaStreamAudioSourceNode | null = null;
let grabador: MediaRecorder | null = null;
let trozos: Blob[] = [];

export const capturaActiva = () => flujo !== null;

export async function iniciarCaptura(streamId: string): Promise<void> {
  await detenerCaptura();
  flujo = await navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } } as unknown as MediaTrackConstraints,
    video: false,
  });
  // Si la pestaña se cierra o la captura se corta, no debe seguir figurando como activa.
  const pista = flujo.getAudioTracks()[0];
  if (pista) {
    pista.onended = () => {
      if (flujo?.getAudioTracks()[0] === pista) detenerCaptura().catch(() => {});
    };
  }
  // Capturar una pestaña la silencia: hay que devolver el sonido a los altavoces.
  contexto = new AudioContext();
  fuente = contexto.createMediaStreamSource(flujo);
  fuente.connect(contexto.destination);
}

export async function detenerCaptura(): Promise<void> {
  grabador = null;
  fuente?.disconnect();
  fuente = null;
  await contexto?.close().catch(() => {});
  contexto = null;
  flujo?.getTracks().forEach((t) => t.stop());
  flujo = null;
}

/** Escucha la captura como audio mono a 16 kHz, el formato de Whisper. Devuelve la función para parar. */
export function escucharPcm(alDatos: (pcm: Float32Array) => void): () => void {
  if (!flujo) throw new Error('La captura de audio no está activa: pulsa Alt+R o actívala en el menú de la extensión.');
  const ctx = new AudioContext({ sampleRate: 16000 });
  const origen = ctx.createMediaStreamSource(flujo);
  const procesador = ctx.createScriptProcessor(4096, 2, 1);
  procesador.onaudioprocess = (e) => {
    const b = e.inputBuffer;
    const mono = new Float32Array(b.length);
    for (let c = 0; c < b.numberOfChannels; c++) {
      const canal = b.getChannelData(c);
      for (let i = 0; i < mono.length; i++) mono[i] += canal[i] / b.numberOfChannels;
    }
    alDatos(mono);
  };
  // Un nodo mudo mantiene vivo el procesador sin que el sonido se oiga dos veces.
  const mudo = ctx.createGain();
  mudo.gain.value = 0;
  origen.connect(procesador);
  procesador.connect(mudo);
  mudo.connect(ctx.destination);
  ctx.resume().catch(() => {});
  return () => {
    procesador.onaudioprocess = null;
    origen.disconnect();
    procesador.disconnect();
    mudo.disconnect();
    ctx.close().catch(() => {});
  };
}

/** Solo para las pruebas automáticas: usa el micrófono falso del navegador en lugar de la pestaña. */
export async function iniciarCapturaPrueba(): Promise<void> {
  await detenerCaptura();
  flujo = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
}

export async function empezarClip(): Promise<void> {
  if (!flujo) throw new Error('La captura no está activa: pulsa Alt+R o actívala en el menú de la extensión.');
  if (contexto?.state === 'suspended') await contexto.resume();
  trozos = [];
  // Se transcodifica después a MP3: conviene partir de más calidad de la que se va a guardar.
  grabador = new MediaRecorder(flujo, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 192000 });
  grabador.ondataavailable = (e) => {
    if (e.data.size) trozos.push(e.data);
  };
  grabador.start();
}

/** Margen que se conserva antes y después del sonido, para no cortar en seco. */
const MARGEN_CLIP_S = 0.04;

export async function terminarClip(): Promise<{ datos: string; tipo: string } | { mudo: true } | null> {
  const r = grabador;
  if (!r) return null;
  grabador = null;
  await new Promise<void>((ok) => {
    r.onstop = () => ok();
    r.stop();
  });
  const webm = new Blob(trozos, { type: 'audio/webm' });
  trozos = [];
  if (!webm.size) return null;
  const audio = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(await webm.arrayBuffer());
  // El grabador arranca antes que el video: lo que hay hasta que empieza a sonar es silencio, y no debe quedarse.
  const canales = Array.from({ length: Math.min(audio.numberOfChannels, 2) }, (_, i) => audio.getChannelData(i));
  const tramo = tramoConSonido(canales);
  if (!tramo) return { mudo: true };
  const margen = Math.round(MARGEN_CLIP_S * audio.sampleRate);
  const desde = Math.max(0, tramo.inicio - margen);
  const hasta = Math.min(audio.length, tramo.fin + margen);
  const mp3 = aMp3(canales.map((c) => c.subarray(desde, hasta)), audio.sampleRate);
  return { datos: bytesABase64(mp3), tipo: 'audio/mpeg' };
}

function aMp3(canales: Float32Array[], frecuencia: number): Uint8Array {
  const codificador = new Mp3Encoder(canales.length, frecuencia, 128);
  const aEntero = (f: Float32Array) => {
    const s = new Int16Array(f.length);
    for (let i = 0; i < f.length; i++) s[i] = Math.max(-1, Math.min(1, f[i])) * 0x7fff;
    return s;
  };
  const izq = aEntero(canales[0]);
  const der = canales.length > 1 ? aEntero(canales[1]) : null;
  const partes: Uint8Array[] = [];
  const BLOQUE = 1152;
  for (let i = 0; i < izq.length; i += BLOQUE) {
    const a = izq.subarray(i, i + BLOQUE);
    const b = der ? der.subarray(i, i + BLOQUE) : undefined;
    const salida = b ? codificador.encodeBuffer(a, b) : codificador.encodeBuffer(a);
    if (salida.length) partes.push(new Uint8Array(salida));
  }
  const fin = codificador.flush();
  if (fin.length) partes.push(new Uint8Array(fin));
  const total = partes.reduce((n, p) => n + p.length, 0);
  const unido = new Uint8Array(total);
  let pos = 0;
  for (const p of partes) {
    unido.set(p, pos);
    pos += p.length;
  }
  return unido;
}

export function bytesABase64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Recorta la captura de la pestaña al rectángulo del video, y dice si el resultado es un fotograma negro. */
export async function recortarImagen(dataUrl: string, r: { x: number; y: number; w: number; h: number; anchoVentana: number }): Promise<{ url: string; negra: boolean }> {
  const img = await createImageBitmap(await (await fetch(dataUrl)).blob());
  // La escala sale de la propia captura: el zoom y la pantalla pueden hacer que no sea devicePixelRatio.
  const escala = img.width / r.anchoVentana;
  const ancho = Math.round(r.w * escala);
  const alto = Math.round(r.h * escala);
  const lienzo = new OffscreenCanvas(ancho, alto);
  lienzo.getContext('2d')!.drawImage(img, Math.round(r.x * escala), Math.round(r.y * escala), ancho, alto, 0, 0, ancho, alto);
  const blob = await lienzo.convertToBlob({ type: 'image/jpeg', quality: 0.88 });
  const muestra = new OffscreenCanvas(64, 36);
  const ctx = muestra.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(lienzo, 0, 0, 64, 36);
  const negra = imagenNegra(ctx.getImageData(0, 0, 64, 36).data);
  return { url: `data:image/jpeg;base64,${bytesABase64(new Uint8Array(await blob.arrayBuffer()))}`, negra };
}
