// El texto del lector en su pestaña propia. Se guarda en el almacenamiento de la extensión: así llega desde la ventana
// de la app, se conserva al recargar la pestaña y no hace falta ponerlo en una dirección, donde no cabría un texto largo.

import { leerEstructura, textoPlano } from '../nucleo/estructura';
import { tr } from './i18n';
import { motor } from './rpc';
import type { ElementoBiblioteca } from './tipos';

const CLAVE = 'lectorTexto';

export async function leerTextoLector(): Promise<string> {
  const d = await chrome.storage.local.get(CLAVE);
  return (d[CLAVE] as string | undefined) ?? '';
}

export function guardarTextoLector(texto: string): Promise<void> {
  return chrome.storage.local.set({ [CLAVE]: texto });
}

export function alCambiarTextoLector(fn: (texto: string) => void): () => void {
  const oyente = (c: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && c[CLAVE]) fn((c[CLAVE].newValue as string | undefined) ?? '');
  };
  chrome.storage.onChanged.addListener(oyente);
  return () => chrome.storage.onChanged.removeListener(oyente);
}

// La nota de la biblioteca en la que se guarda también lo que se escribe en el Cuaderno, si se guardó en ella.
const CLAVE_NOTA = 'notaCuaderno';

export async function leerNotaCuaderno(): Promise<string | null> {
  const d = await chrome.storage.local.get(CLAVE_NOTA);
  return (d[CLAVE_NOTA] as string | undefined) || null;
}

export function guardarNotaCuaderno(id: string | null): Promise<void> {
  return id ? chrome.storage.local.set({ [CLAVE_NOTA]: id }) : chrome.storage.local.remove(CLAVE_NOTA);
}

export function alCambiarNotaCuaderno(fn: (id: string | null) => void): () => void {
  const oyente = (c: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && c[CLAVE_NOTA]) fn((c[CLAVE_NOTA].newValue as string | undefined) || null);
  };
  chrome.storage.onChanged.addListener(oyente);
  return () => chrome.storage.onChanged.removeListener(oyente);
}

/** El título de una nota: su primer título, o el principio de su primera línea. */
export function tituloDeNota(md: string): string {
  const bloques = leerEstructura(md);
  const titulo = bloques.find((b) => b.tipo === 'titulo');
  const texto = titulo?.tipo === 'titulo' ? titulo.linea.texto : textoPlano(bloques).split('\n').find((l) => l.trim()) ?? '';
  return texto.trim().slice(0, 40);
}

/**
 * Lleva un texto de la biblioteca al Cuaderno para seguir escribiendo en él, y abre el Cuaderno con `ir` (en la app, o
 * en su pestaña desde el visor). Lo que hubiera en el Cuaderno sin guardar no se pierde: va antes a la biblioteca.
 */
export async function pasarAlCuaderno(e: ElementoBiblioteca, ir: (ruta: string) => void | Promise<void>): Promise<void> {
  const [actual, enlazada] = await Promise.all([leerTextoLector(), leerNotaCuaderno()]);
  if (actual.trim() && !enlazada && actual.trim() !== e.texto.trim()) {
    await motor.bibliotecaGuardar({ id: crypto.randomUUID(), titulo: tituloDeNota(actual) || tr('Sin título'), texto: actual, origen: 'pegado', creado: Date.now() });
  }
  await guardarTextoLector(e.texto);
  await guardarNotaCuaderno(e.id);
  await ir('lector?editar=1');
}
