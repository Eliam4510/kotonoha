// Los libros de páginas (EPUB de imágenes, CBZ y PDF) se guardan tal cual en el almacenamiento privado del navegador
// (OPFS), no en la base de datos: un PDF de cientos de MB se lee a trozos desde ahí, sin cargarlo entero. La biblioteca
// guarda solo lo demás: título, formato, páginas y por dónde se va. Es el mismo origen para la app, el visor y el motor.

const CARPETA = 'documentos';

async function carpeta(): Promise<FileSystemDirectoryHandle> {
  const raiz = await navigator.storage.getDirectory();
  return raiz.getDirectoryHandle(CARPETA, { create: true });
}

/** Copia el archivo elegido al almacenamiento privado, a trozos, sin pasar por la memoria entero. */
export async function guardarArchivoDocumento(id: string, archivo: Blob): Promise<void> {
  const h = await (await carpeta()).getFileHandle(id, { create: true });
  const escritura = await h.createWritable();
  await archivo.stream().pipeTo(escritura);
}

/** El archivo guardado, o null si no está en este equipo (por ejemplo, tras restaurar una copia de seguridad en otro). */
export async function archivoDocumento(id: string): Promise<File | null> {
  try {
    return await (await (await carpeta()).getFileHandle(id)).getFile();
  } catch {
    return null;
  }
}

export async function borrarArchivoDocumento(id: string): Promise<void> {
  await (await carpeta()).removeEntry(id).catch(() => {});
}

/** Los identificadores de todos los archivos guardados: para la copia completa. */
export async function idsDeDocumentos(): Promise<string[]> {
  const ids: string[] = [];
  for await (const [nombre, h] of (await carpeta()) as unknown as AsyncIterable<[string, FileSystemHandle]>) if (h.kind === 'file') ids.push(nombre);
  return ids;
}
