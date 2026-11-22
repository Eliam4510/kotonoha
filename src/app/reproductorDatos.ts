// Lo que recuerda el reproductor de archivos: dónde se dejó cada video o audio, cuánto dura, una miniatura y, si el
// navegador lo da, el acceso al archivo para volver a abrirlo con un clic. Todo queda en este navegador, en una base
// aparte: no son datos de estudio, y la copia completa no los necesita.

import { imagenNegra } from '../nucleo/medios';
import { ACEPTADOS, tipoDeArchivo } from '../nucleo/reproductor';

export interface Visto {
  /** Nombre y tamaño: así se reconoce el archivo, venga de donde venga. */
  clave: string;
  nombre: string;
  tamano: number;
  tipo: 'video' | 'audio';
  /** En segundos. */
  duracion: number;
  posicion: number;
  terminado: boolean;
  actualizado: number;
  miniatura?: string;
  /** El acceso al archivo, para abrirlo otra vez sin buscarlo. Solo existe si llegó por el selector o al soltarlo. */
  asa?: FileSystemFileHandle;
}

/** La última lista, para seguir con ella: cada archivo con sus subtítulos. Solo la que tiene acceso a sus archivos. */
export interface ListaGuardada {
  elementos: { nombre: string; asa: FileSystemFileHandle; subtitulos: FileSystemFileHandle[] }[];
  actual: number;
  actualizado: number;
}

const BASE = 'kotonoha-reproductor';
let abierta: Promise<IDBDatabase> | null = null;

function base(): Promise<IDBDatabase> {
  abierta ??= new Promise((ok, mal) => {
    const r = indexedDB.open(BASE, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore('vistos', { keyPath: 'clave' });
      r.result.createObjectStore('listas');
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => {
      abierta = null;
      mal(r.error);
    };
  });
  return abierta;
}

async function pedir<T>(almacen: 'vistos' | 'listas', modo: IDBTransactionMode, hacer: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await base();
  return new Promise((ok, mal) => {
    const tx = db.transaction(almacen, modo);
    const r = hacer(tx.objectStore(almacen));
    tx.oncomplete = () => ok(r.result as T);
    tx.onerror = () => mal(tx.error);
    tx.onabort = () => mal(tx.error);
  });
}

export const leerVisto = (clave: string) => pedir<Visto | undefined>('vistos', 'readonly', (s) => s.get(clave));

/** Junta lo nuevo con lo que ya se sabía del archivo: la miniatura o el acceso no se pierden por no venir esta vez. */
export async function guardarVisto(v: Partial<Visto> & Pick<Visto, 'clave' | 'nombre' | 'tamano' | 'tipo'>): Promise<void> {
  const previo = await leerVisto(v.clave).catch(() => undefined);
  const nuevo: Visto = { duracion: 0, posicion: 0, terminado: false, ...previo, ...v, actualizado: Date.now() };
  if (!v.asa && previo?.asa) nuevo.asa = previo.asa;
  if (!v.miniatura && previo?.miniatura) nuevo.miniatura = previo.miniatura;
  await pedir('vistos', 'readwrite', (s) => s.put(nuevo));
}

/** Lo último que se vio, lo más reciente primero. */
export async function recientes(n = 12): Promise<Visto[]> {
  const todos = await pedir<Visto[]>('vistos', 'readonly', (s) => s.getAll());
  return todos.sort((a, b) => b.actualizado - a.actualizado).slice(0, n);
}

export const olvidarVisto = (clave: string) => pedir('vistos', 'readwrite', (s) => s.delete(clave));

/** Con el tiempo se acumulan: se quedan los 300 más recientes. */
export async function podarVistos(maximo = 300): Promise<void> {
  const todos = await pedir<Visto[]>('vistos', 'readonly', (s) => s.getAll());
  if (todos.length <= maximo) return;
  const viejos = todos.sort((a, b) => b.actualizado - a.actualizado).slice(maximo);
  await pedir('vistos', 'readwrite', (s) => {
    for (const v of viejos) s.delete(v.clave);
    return s.count();
  });
}

export const guardarLista = (l: ListaGuardada) => pedir('listas', 'readwrite', (s) => s.put(l, 'ultima'));
export const leerLista = () => pedir<ListaGuardada | undefined>('listas', 'readonly', (s) => s.get('ultima'));
export const olvidarLista = () => pedir('listas', 'readwrite', (s) => s.delete('ultima'));

// ---------- Los archivos del equipo ----------

type ConSelectores = {
  showOpenFilePicker?(o?: { multiple?: boolean; id?: string; types?: { description?: string; accept: Record<string, string[]> }[] }): Promise<FileSystemFileHandle[]>;
  showDirectoryPicker?(o?: { mode?: 'read'; id?: string }): Promise<FileSystemDirectoryHandle>;
};
type ConPermisos = {
  queryPermission?(o: { mode: 'read' }): Promise<PermissionState>;
  requestPermission?(o: { mode: 'read' }): Promise<PermissionState>;
};

export const haySelectorArchivos = () => 'showOpenFilePicker' in window;
export const haySelectorCarpetas = () => 'showDirectoryPicker' in window;

const cancelado = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

/** Los archivos elegidos con el selector del sistema, con su acceso para volver a abrirlos. Cancelar no es un error. */
export async function elegirArchivos(descripcion: string): Promise<FileSystemFileHandle[]> {
  const extensiones = (tipo: 'video' | 'audio' | 'subtitulos') => ACEPTADOS.filter((e) => tipoDeArchivo(`x${e}`) === tipo);
  try {
    return await (window as unknown as ConSelectores).showOpenFilePicker!({
      multiple: true,
      id: 'kotonoha-reproductor',
      types: [{ description: descripcion, accept: { 'video/*': extensiones('video'), 'audio/*': extensiones('audio'), 'text/plain': extensiones('subtitulos') } }],
    });
  } catch (e) {
    if (cancelado(e)) return [];
    throw e;
  }
}

export async function elegirCarpeta(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await (window as unknown as ConSelectores).showDirectoryPicker!({ mode: 'read', id: 'kotonoha-reproductor' });
  } catch (e) {
    if (cancelado(e)) return null;
    throw e;
  }
}

export interface EnCarpeta {
  /** La ruta dentro de la carpeta elegida, para ordenar y para casar cada subtítulo con los de su misma carpeta. */
  ruta: string;
  nombre: string;
  asa: FileSystemFileHandle;
}

/** Los videos, audios y subtítulos de una carpeta y, si ella no tiene, los de sus subcarpetas (una temporada por carpeta). */
export async function archivosDeCarpeta(dir: FileSystemDirectoryHandle, prefijo = '', profundidad = 2): Promise<EnCarpeta[]> {
  const propios: EnCarpeta[] = [];
  const subcarpetas: FileSystemDirectoryHandle[] = [];
  for await (const [nombre, h] of dir as unknown as AsyncIterable<[string, FileSystemHandle]>) {
    if (h.kind === 'file') {
      if (tipoDeArchivo(nombre)) propios.push({ ruta: prefijo + nombre, nombre, asa: h as FileSystemFileHandle });
    } else if (!nombre.startsWith('.')) subcarpetas.push(h as FileSystemDirectoryHandle);
  }
  if (profundidad <= 0) return propios;
  for (const s of subcarpetas) propios.push(...(await archivosDeCarpeta(s, `${prefijo}${s.name}/`, profundidad - 1)));
  return propios;
}

/** El permiso para leer un archivo guardado. Pedirlo necesita un clic: por eso se pide al pulsar, no al abrir la pantalla. */
export async function permitido(asa: FileSystemHandle, pedirSiHaceFalta = true): Promise<boolean> {
  const h = asa as unknown as ConPermisos;
  try {
    if ((await h.queryPermission?.({ mode: 'read' })) === 'granted') return true;
    return pedirSiHaceFalta && (await h.requestPermission?.({ mode: 'read' })) === 'granted';
  } catch {
    return false;
  }
}

/** Un fotograma pequeño del momento actual, para reconocer el video en la lista. Nada si aún no hay imagen o es negra. */
export function miniaturaDe(v: HTMLVideoElement): string | null {
  if (!v.videoWidth || !v.videoHeight || v.readyState < 2) return null;
  const c = document.createElement('canvas');
  c.width = 320;
  c.height = Math.max(1, Math.round((320 * v.videoHeight) / v.videoWidth));
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  try {
    ctx.drawImage(v, 0, 0, c.width, c.height);
    if (imagenNegra(ctx.getImageData(0, 0, c.width, c.height).data)) return null;
    return c.toDataURL('image/jpeg', 0.72);
  } catch {
    return null;
  }
}
