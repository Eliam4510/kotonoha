// Descarga de los archivos de un modelo, compartida por los modelos de voz y los de reconocimiento de texto. Los de voz van
// en la caché de Whisper, que lista Ajustes; los del OCR, en una propia, para que esa lista no los tome por archivos sueltos.

import { CACHE_MODELOS } from '../compartido/modelosGuardados';

export const CACHE_MODELOS_OCR = 'kotonoha-modelos-ocr';

export type AvanceDescarga = (p: { archivo: string; cargado: number; total: number; estado: 'progress' | 'done' }) => void;

/** La dirección de un archivo de Hugging Face, fijada a un commit: así se descarga siempre lo que se midió. */
export const urlDeModelo = (repositorio: string, revision: string, archivo: string) => `https://huggingface.co/${repositorio}/resolve/${revision}/${archivo}`;

/** Lo descarga una vez y lo deja en la caché. Se guarda mientras llega: si se corta, no queda nada a medias. */
export async function leerModelo(url: string, archivo: string, avance: AvanceDescarga, nombreCache = CACHE_MODELOS): Promise<Uint8Array> {
  const cache = await caches.open(nombreCache);
  const guardado = await cache.match(url);
  if (guardado) return new Uint8Array(await guardado.arrayBuffer());
  const r = await fetch(url);
  if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}: ${archivo}`);
  const total = Number(r.headers.get('content-length') ?? 0);
  const [paraLeer, paraGuardar] = r.body.tee();
  const guardar = cache.put(url, new Response(paraGuardar, { headers: { 'content-type': 'application/octet-stream', ...(total ? { 'content-length': String(total) } : {}) } }));
  const trozos: Uint8Array[] = [];
  let leidos = 0;
  const lector = paraLeer.getReader();
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    trozos.push(value);
    leidos += value.length;
    avance({ archivo, cargado: leidos, total: total || leidos, estado: 'progress' });
  }
  await guardar;
  avance({ archivo, cargado: leidos, total: total || leidos, estado: 'done' });
  const salida = new Uint8Array(leidos);
  let p = 0;
  for (const t of trozos) {
    salida.set(t, p);
    p += t.length;
  }
  return salida;
}
