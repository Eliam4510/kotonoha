// Los modelos de voz se guardan en el navegador, en la caché de Transformers.js. Aquí se sabe cuáles están, lo que ocupa
// cada uno y cómo quitar uno sin romper otro: dos modelos pueden compartir archivos, como el decodificador de Turbo.

import { MODELOS_WHISPER, type ModeloWhisper } from './ajustes';

export const CACHE_MODELOS = 'transformers-cache';

export type DefinicionModelo = Pick<(typeof MODELOS_WHISPER)[ModeloWhisper], 'id' | 'dtype'>;

export interface ArchivoGuardado {
  url: string;
  bytes: number;
}

export interface ModeloGuardado {
  id: ModeloWhisper;
  bytes: number;
}

export interface ResumenModelos {
  modelos: ModeloGuardado[];
  /** Lo que queda de modelos que ya no se ofrecen, o de una descarga que no terminó. */
  otrosBytes: number;
  totalBytes: number;
}

const LISTA = Object.entries(MODELOS_WHISPER) as [ModeloWhisper, DefinicionModelo][];

const nombreDe = (url: string) => decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
const esDelRepositorio = (url: string, modelo: DefinicionModelo) => url.includes(`/${modelo.id}/`);

/** Sus partes son archivos ONNX de una precisión concreta; la configuración y el tokenizador valen para cualquiera. */
export function archivoDelModelo(url: string, modelo: DefinicionModelo): boolean {
  if (!esDelRepositorio(url, modelo)) return false;
  const nombre = nombreDe(url);
  if (!nombre.includes('.onnx')) return true;
  return Object.entries(modelo.dtype).some(([parte, tipo]) => nombre === `${parte}_${tipo}.onnx` || nombre === `${parte}_${tipo}.onnx_data`);
}

/** Solo cuenta como guardado con todas sus partes: una descarga se puede cortar entre una y otra. */
export function modeloCompleto(urls: string[], modelo: DefinicionModelo): boolean {
  return Object.entries(modelo.dtype).every(([parte, tipo]) => urls.some((u) => esDelRepositorio(u, modelo) && nombreDe(u) === `${parte}_${tipo}.onnx`));
}

export function resumirModelos(archivos: ArchivoGuardado[], lista: [ModeloWhisper, DefinicionModelo][] = LISTA): ResumenModelos {
  const urls = archivos.map((a) => a.url);
  const completos = lista.filter(([, m]) => modeloCompleto(urls, m));
  const modelos = completos.map(([id, m]) => ({ id, bytes: archivos.filter((a) => archivoDelModelo(a.url, m)).reduce((n, a) => n + a.bytes, 0) }));
  const otros = archivos.filter((a) => !completos.some(([, m]) => archivoDelModelo(a.url, m)));
  return { modelos, otrosBytes: otros.reduce((n, a) => n + a.bytes, 0), totalBytes: archivos.reduce((n, a) => n + a.bytes, 0) };
}

/** Lo que se puede borrar al quitar un modelo: lo suyo, salvo lo que también use otro modelo que siga guardado. */
export function archivosAlBorrar(urls: string[], id: ModeloWhisper, lista: [ModeloWhisper, DefinicionModelo][] = LISTA): string[] {
  const propio = lista.find(([otro]) => otro === id)?.[1];
  if (!propio) return [];
  const restantes = lista.filter(([otro, m]) => otro !== id && modeloCompleto(urls, m));
  return urls.filter((u) => archivoDelModelo(u, propio) && !restantes.some(([, m]) => archivoDelModelo(u, m)));
}

/** Los archivos que no son de ningún modelo completo: restos que nadie va a usar tal como están. */
export function archivosSueltos(urls: string[], lista: [ModeloWhisper, DefinicionModelo][] = LISTA): string[] {
  const completos = lista.filter(([, m]) => modeloCompleto(urls, m));
  return urls.filter((u) => !completos.some(([, m]) => archivoDelModelo(u, m)));
}

/** Si un modelo ya está en el disco. Los nombres de esta caché los decide Transformers.js. */
export async function modeloGuardado(modelo: DefinicionModelo): Promise<boolean> {
  const claves = await (await caches.open(CACHE_MODELOS)).keys();
  return modeloCompleto(claves.map((k) => k.url), modelo);
}

export async function leerModelosGuardados(): Promise<ResumenModelos> {
  const cache = await caches.open(CACHE_MODELOS);
  const claves = await cache.keys();
  const archivos = await Promise.all(claves.map(async (k) => {
    const r = await cache.match(k);
    return { url: k.url, bytes: Number(r?.headers.get('content-length') ?? 0) || 0 };
  }));
  return resumirModelos(archivos);
}

export async function borrarModeloGuardado(id: ModeloWhisper): Promise<void> {
  const cache = await caches.open(CACHE_MODELOS);
  const urls = (await cache.keys()).map((k) => k.url);
  await Promise.all(archivosAlBorrar(urls, id).map((u) => cache.delete(u)));
}

export async function borrarArchivosSueltos(): Promise<void> {
  const cache = await caches.open(CACHE_MODELOS);
  const urls = (await cache.keys()).map((k) => k.url);
  await Promise.all(archivosSueltos(urls).map((u) => cache.delete(u)));
}
