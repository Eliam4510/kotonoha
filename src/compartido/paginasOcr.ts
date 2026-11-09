// Lo que el OCR leyó en cada página de cada libro, para no volver a leerlo. Va en una base propia, no en la de cada
// lengua: un libro es de su archivo, y su archivo se guarda aparte. Al borrar un libro se borra también lo leído.

import Dexie, { type Table } from 'dexie';
import type { EdicionLinea } from '../nucleo/ediciones';
import type { LineaOcr } from '../nucleo/ocr';

export interface FilaOcr {
  /** Libro, modo y página. */
  clave: string;
  libro: string;
  lineas: LineaOcr[];
  creada: number;
  /** Con qué lectura se leyó (LECTURA). Lo leído antes de la 0.9.6 no la lleva. */
  lectura?: number;
}

/**
 * La lectura de hoy, que se guarda con cada página leída. Sube cuando cambia lo que el OCR saca de una clase de libros y
 * no de todos: lo de esa clase leído antes se vuelve a leer al abrir cada página, y lo demás se queda.
 * 1: la 0.9.6, que en los PDF escaneados lee la imagen escaneada tal cual en vez de la página pintada.
 */
export const LECTURA = 1;

/** Desde qué lectura vale lo leído de un libro de este formato. */
export const lecturaMinima = (formato: string) => (formato === 'pdf' ? 1 : 0);

/**
 * Cuando cambia lo que el OCR saca de todas las páginas de un modo, la base sube de versión y olvida lo leído antes: así
 * cada página se vuelve a leer con lo nuevo la próxima vez que se abra. Lo que se editó a mano va en su propia tabla y
 * no se olvida nunca: es del lector, no del OCR.
 * 2: la 0.9.2 (manga por viñetas y sin marcas de agua; libros sin furigana impreso y a dos columnas).
 * 3: la 0.9.4 (la tabla de lo editado; lo leído no cambia).
 * 4: la 0.9.5 (el reconocedor de PP-OCRv6 en el modo Libro): se olvida lo leído en modo Libro; lo del manga sigue igual.
 */
class BaseOcr extends Dexie {
  paginas!: Table<FilaOcr, string>;
  ediciones!: Table<EdicionLinea, string>;

  constructor() {
    super('kotonoha-ocr');
    this.version(1).stores({ paginas: 'clave, libro' });
    this.version(2)
      .stores({ paginas: 'clave, libro' })
      .upgrade((tx) => tx.table('paginas').clear());
    this.version(3).stores({ paginas: 'clave, libro', ediciones: 'clave, libro' });
    this.version(4)
      .stores({ paginas: 'clave, libro', ediciones: 'clave, libro' })
      .upgrade((tx) => tx.table('paginas').filter((f: FilaOcr) => f.clave.includes(':libro:')).delete());
  }
}

let base: BaseOcr | null = null;
export const baseOcr = () => (base ??= new BaseOcr());

export const claveOcr = (libro: string, modo: string, pagina: number) => `${libro}:${modo}:${pagina}`;

export async function olvidarOcr(libro: string): Promise<void> {
  await baseOcr().paginas.where('libro').equals(libro).delete();
  await baseOcr().ediciones.where('libro').equals(libro).delete();
}

/** Los libros con algo leído o editado: para la copia completa. */
export async function librosConOcr(): Promise<string[]> {
  const paginas = (await baseOcr().paginas.orderBy('libro').uniqueKeys()) as string[];
  const ediciones = (await baseOcr().ediciones.orderBy('libro').uniqueKeys()) as string[];
  return [...new Set([...paginas, ...ediciones])];
}

/** Lo leído y lo editado de un libro, tal cual, para guardarlo aparte y restaurarlo. */
export async function ocrDe(libro: string): Promise<{ paginas: FilaOcr[]; ediciones: EdicionLinea[] }> {
  return { paginas: await baseOcr().paginas.where('libro').equals(libro).toArray(), ediciones: await edicionesDe(libro) };
}

export async function restaurarOcr(d: { paginas?: FilaOcr[]; ediciones?: EdicionLinea[] }): Promise<void> {
  if (d.paginas?.length) await baseOcr().paginas.bulkPut(d.paginas);
  if (d.ediciones?.length) await baseOcr().ediciones.bulkPut(d.ediciones);
}

/** Todo lo editado de un libro. */
export const edicionesDe = (libro: string) => baseOcr().ediciones.where('libro').equals(libro).toArray();
export const guardarEdicion = (e: EdicionLinea) => baseOcr().ediciones.put(e);
export const quitarEdicion = (clave: string) => baseOcr().ediciones.delete(clave);
