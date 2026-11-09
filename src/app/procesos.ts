// El procesado de libros enteros con el OCR desde la Biblioteca: de uno en uno, con el avance a la vista en la
// tarjeta de cada libro y con pausa. Dura lo que dure abierta la página; lo ya leído queda guardado, y al volver a pedirlo
// sigue por donde iba.

import { signal } from '@preact/signals';
import type { ElementoBiblioteca } from '../compartido/tipos';
import { type Descarga, LectorOcr } from '../visor/ocr';
import { procesarLibro } from '../visor/procesador';

export interface Proceso {
  estado: 'en-cola' | 'procesando' | 'en-pausa' | 'listo' | 'error';
  hechas: number;
  total: number;
  error?: string;
}

/** Cómo va cada libro que se ha pedido procesar mientras la página está abierta. */
export const procesos = signal<Record<string, Proceso>>({});
/** La primera descarga de los modelos del OCR, mientras dura. */
export const descargaOcr = signal<Descarga | null>(null);

let lector: LectorOcr | null = null;
const cola: ElementoBiblioteca[] = [];
const pausados = new Set<string>();
let enMarcha = false;
let alTerminar: () => void = () => {};

function fijar(id: string, cambio: Partial<Proceso>) {
  const antes = procesos.value[id] ?? { estado: 'en-cola', hechas: 0, total: 0 };
  procesos.value = { ...procesos.value, [id]: { ...antes, ...cambio } };
}

/** Pide leer un libro entero. Si ya se está leyendo otro, espera su turno. `terminado` se llama al acabar cada libro. */
export function procesar(e: ElementoBiblioteca, terminado: () => void): void {
  alTerminar = terminado;
  pausados.delete(e.id);
  const estado = procesos.value[e.id]?.estado;
  if (estado === 'procesando' || estado === 'en-cola') return;
  fijar(e.id, { estado: 'en-cola', total: procesos.value[e.id]?.total || e.documento?.paginas || 0, error: undefined });
  cola.push(e);
  void siguiente();
}

/** Para el libro después de la página que se esté leyendo; o, si aún esperaba turno, lo saca de la cola. */
export function pausar(id: string): void {
  pausados.add(id);
  const i = cola.findIndex((x) => x.id === id);
  if (i >= 0) {
    cola.splice(i, 1);
    fijar(id, { estado: 'en-pausa' });
  }
}

async function siguiente(): Promise<void> {
  if (enMarcha) return;
  const e = cola.shift();
  if (!e) return;
  enMarcha = true;
  fijar(e.id, { estado: 'procesando' });
  lector ??= new LectorOcr((d) => (descargaOcr.value = d.cargado >= d.total ? null : d));
  try {
    const acabado = await procesarLibro(e, lector, (a) => fijar(e.id, a), () => !pausados.has(e.id));
    fijar(e.id, { estado: acabado ? 'listo' : 'en-pausa' });
    if (acabado) alTerminar();
  } catch (x) {
    fijar(e.id, { estado: 'error', error: x instanceof Error ? x.message : String(x) });
  } finally {
    enMarcha = false;
    void siguiente();
  }
}
