// Las grabaciones del dictado del Portapapeles. Van en una base propia del navegador; el texto solo lleva una marca con su
// id (nucleo/dictado.ts), así que la grabación acompaña al texto también en la biblioteca. Como los archivos de los
// libros, no entran en la copia de seguridad: son audio y pesan. Es el mismo origen para la app, la pestaña del
// Portapapeles y el motor, que es quien borra las que ya nadie usa.

import Dexie, { type Table } from 'dexie';

export interface Grabacion {
  id: string;
  /** El audio tal como lo grabó el navegador, en Opus. */
  audio: Blob;
  duracionMs: number;
  creado: number;
  /** La lengua que se estudiaba al dictar: la limpieza mira la biblioteca de esa lengua. */
  lengua: string;
}

class BaseDictados extends Dexie {
  grabaciones!: Table<Grabacion, string>;

  constructor() {
    super('kotonoha-dictados');
    this.version(1).stores({ grabaciones: 'id, creado, lengua' });
  }
}

let base: BaseDictados | null = null;
const baseDictados = () => (base ??= new BaseDictados());

export async function guardarGrabacion(g: Grabacion): Promise<void> {
  await baseDictados().grabaciones.put(g);
}

export const leerGrabacion = (id: string): Promise<Grabacion | undefined> => baseDictados().grabaciones.get(id);

/** Cuándo se guardó cada grabación de una lengua, sin leer su audio. */
export async function grabacionesDe(lengua: string): Promise<{ id: string; creado: number }[]> {
  const filas: { id: string; creado: number }[] = [];
  await baseDictados()
    .grabaciones.where('lengua')
    .equals(lengua)
    .each((g) => {
      filas.push({ id: g.id, creado: g.creado });
    });
  return filas;
}

export async function borrarGrabaciones(ids: string[]): Promise<void> {
  if (ids.length) await baseDictados().grabaciones.bulkDelete(ids);
}
