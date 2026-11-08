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
}

/**
 * Cuando cambia lo que el OCR saca de una página, la base sube de versión y olvida lo leído antes: así cada página se
 * vuelve a leer con lo nuevo la próxima vez que se abra, en lugar de quedarse con lo de la versión anterior. Lo que se
 * editó a mano va en su propia tabla y no se olvida nunca: es del lector, no del OCR.
 * 2: la 0.9.2 (manga por viñetas y sin marcas de agua; libros sin furigana impreso y a dos columnas).
 * 3: la 0.9.4 (la tabla de lo editado; lo leído no cambia).
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
  }
}

let base: BaseOcr | null = null;
export const baseOcr = () => (base ??= new BaseOcr());

export const claveOcr = (libro: string, modo: string, pagina: number) => `${libro}:${modo}:${pagina}`;

export async function olvidarOcr(libro: string): Promise<void> {
  await baseOcr().paginas.where('libro').equals(libro).delete();
  await baseOcr().ediciones.where('libro').equals(libro).delete();
}

/** Todo lo editado de un libro. */
export const edicionesDe = (libro: string) => baseOcr().ediciones.where('libro').equals(libro).toArray();
export const guardarEdicion = (e: EdicionLinea) => baseOcr().ediciones.put(e);
export const quitarEdicion = (clave: string) => baseOcr().ediciones.delete(clave);
