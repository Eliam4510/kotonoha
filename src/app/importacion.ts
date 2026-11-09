// Lo que llega a la Biblioteca para importarlo: archivos sueltos y carpetas enteras, del selector o soltados en la
// página. De una carpeta se recorre todo; sus imágenes se convierten en libros (nucleo/carpetas) y cada libro, en un CBZ
// hecho con los propios archivos, que se importa como cualquier otro.

import type { ArchivoEnCarpeta, LibroDeImagenes } from '../nucleo/carpetas';
import { crearZip } from '../nucleo/zip';

export type ArchivoImportado = ArchivoEnCarpeta<File>;

/** Los archivos del selector. Si se eligió una carpeta, cada uno trae su ruta dentro de ella. */
export const archivosElegidos = (lista: FileList | null | undefined): ArchivoImportado[] => [...(lista ?? [])].map((f) => ({ ruta: f.webkitRelativePath || f.name, archivo: f }));

/** Recorre archivos y carpetas soltados, con la ruta de cada archivo desde lo que se soltó. */
export async function recorrerEntradas(entradas: FileSystemEntry[]): Promise<ArchivoImportado[]> {
  const salida: ArchivoImportado[] = [];
  const recorrer = async (e: FileSystemEntry, ruta: string): Promise<void> => {
    if (e.isFile) {
      salida.push({ ruta, archivo: await new Promise<File>((ok, mal) => (e as FileSystemFileEntry).file(ok, mal)) });
      return;
    }
    if (!e.isDirectory) return;
    const lector = (e as FileSystemDirectoryEntry).createReader();
    // Las entradas llegan por tandas (de cien en Chrome), hasta una vacía.
    for (;;) {
      const tanda = await new Promise<FileSystemEntry[]>((ok, mal) => lector.readEntries(ok, mal));
      if (!tanda.length) break;
      for (const h of tanda) await recorrer(h, `${ruta}/${h.name}`);
    }
  };
  for (const e of entradas) await recorrer(e, e.name);
  return salida;
}

/**
 * Lo que se soltó en la página: archivos y carpetas. Hay que llamarla durante el propio evento, antes de esperar nada:
 * después, el navegador ya no deja ver qué se soltó.
 */
export function archivosSoltados(dt: DataTransfer | null | undefined): Promise<ArchivoImportado[]> {
  if (!dt) return Promise.resolve([]);
  const entradas = [...dt.items].filter((i) => i.kind === 'file').map((i) => i.webkitGetAsEntry()).filter((e): e is FileSystemEntry => !!e);
  return entradas.length ? recorrerEntradas(entradas) : Promise.resolve(archivosElegidos(dt.files));
}

/** Lo que ocupan las páginas de un libro de imágenes. */
export const tamanoDe = (libro: LibroDeImagenes<File>) => libro.paginas.reduce((s, p) => s + p.archivo.size, 0) + (libro.info?.size ?? 0);

/** Un libro de imágenes como archivo CBZ: sin comprimir y sin copiar las imágenes en memoria. */
export async function cbzDe(libro: LibroDeImagenes<File>, alAvanzar?: (hechas: number, total: number) => void): Promise<File> {
  const archivos = libro.paginas.map((p) => ({ nombre: p.nombre, datos: p.archivo, fecha: p.archivo.lastModified }));
  if (libro.info) archivos.unshift({ nombre: 'ComicInfo.xml', datos: libro.info, fecha: libro.info.lastModified });
  const zip = await crearZip(archivos, alAvanzar);
  return new File([zip], `${libro.titulo}.cbz`, { type: 'application/vnd.comicbook+zip' });
}
