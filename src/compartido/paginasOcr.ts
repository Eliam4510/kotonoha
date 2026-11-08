// Lo que el OCR leyó en cada página de cada libro, para no volver a leerlo. Va en una base propia, no en la de cada
// lengua: un libro es de su archivo, y su archivo se guarda aparte. Al borrar un libro se borra también lo leído.

import Dexie, { type Table } from 'dexie';
import type { LineaOcr } from '../nucleo/ocr';

export interface FilaOcr {
  /** Libro, modo y página. */
  clave: string;
  libro: string;
  lineas: LineaOcr[];
  creada: number;
}

class BaseOcr extends Dexie {
  paginas!: Table<FilaOcr, string>;

  constructor() {
    super('kotonoha-ocr');
    this.version(1).stores({ paginas: 'clave, libro' });
  }
}

let base: BaseOcr | null = null;
export const baseOcr = () => (base ??= new BaseOcr());

export const claveOcr = (libro: string, modo: string, pagina: number) => `${libro}:${modo}:${pagina}`;

export async function olvidarOcr(libro: string): Promise<void> {
  await baseOcr().paginas.where('libro').equals(libro).delete();
}
