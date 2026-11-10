// La copia completa: lo de la copia de seguridad más los archivos de los libros, lo que el OCR leyó y se editó, y los
// dictados, en una carpeta que elige quien la hace. Sirve para pasar Kotonoha a otro equipo, o a otra copia de la
// extensión (por ejemplo, a una instalada con el identificador fijo): cada copia guarda sus datos aparte.
//
// Es una carpeta y no un zip: un zip de más de 4 GB necesita ZIP64, y así cada libro se copia a trozos, sin pasar
// entero por la memoria. Las claves de API no van en ella.

import type { Ajustes } from '../compartido/ajustes';
import { idsDeGrabaciones, leerGrabacion, guardarGrabacion, type Grabacion } from '../compartido/dictados';
import { archivoDocumento, guardarArchivoDocumento, idsDeDocumentos } from '../compartido/documentos';
import { tr } from '../compartido/i18n';
import { librosConOcr, ocrDe, restaurarOcr } from '../compartido/paginasOcr';
import { motor } from '../compartido/rpc';
import { diaLocal } from '../nucleo/inmersion';

const DATOS = 'kotonoha.json';
const LEEME = 'LEEME.txt';

interface Selector {
  showDirectoryPicker(o?: { mode?: 'read' | 'readwrite'; id?: string; startIn?: string }): Promise<FileSystemDirectoryHandle>;
}

export const hayCopiaCompleta = (): boolean => 'showDirectoryPicker' in window;

export type AvanceCopia = (texto: string) => void;

export interface ResumenCopia {
  libros: number;
  librosConOcr: number;
  dictados: number;
}

const elegirCarpeta = (mode: 'read' | 'readwrite') => (window as unknown as Selector).showDirectoryPicker({ mode, id: 'kotonoha-copia', startIn: 'documents' });

async function escribir(dir: FileSystemDirectoryHandle, nombre: string, datos: Blob | string): Promise<void> {
  const w = await (await dir.getFileHandle(nombre, { create: true })).createWritable();
  if (typeof datos === 'string') {
    await w.write(datos);
    await w.close();
  } else {
    // pipeTo cierra el archivo al terminar.
    await datos.stream().pipeTo(w);
  }
}

async function hijos(dir: FileSystemDirectoryHandle): Promise<[string, FileSystemHandle][]> {
  const r: [string, FileSystemHandle][] = [];
  for await (const e of dir as unknown as AsyncIterable<[string, FileSystemHandle]>) r.push(e);
  return r;
}

async function subcarpeta(dir: FileSystemDirectoryHandle, nombre: string): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await dir.getDirectoryHandle(nombre);
  } catch {
    return null;
  }
}

/** Un nombre que no pise una copia anterior del mismo día. */
async function carpetaNueva(dir: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle> {
  const base = `kotonoha-copia-${diaLocal(Date.now())}`;
  for (let n = 1; ; n++) {
    const nombre = n === 1 ? base : `${base}-${n}`;
    if (!(await subcarpeta(dir, nombre))) return dir.getDirectoryHandle(nombre, { create: true });
  }
}

const extensionDeAudio = (tipo: string) => (tipo.includes('ogg') ? 'ogg' : tipo.includes('mp4') ? 'm4a' : 'webm');

/** Pide una carpeta y deja en ella, dentro de una carpeta con la fecha, todo lo de esta copia. Devuelve su nombre. */
export async function exportarCopiaCompleta(ajustes: Ajustes, avance: AvanceCopia): Promise<{ carpeta: string; resumen: ResumenCopia }> {
  const destino = await carpetaNueva(await elegirCarpeta('readwrite'));

  avance(tr('Guardando palabras, tarjetas, biblioteca y ajustes…'));
  await escribir(destino, DATOS, await motor.exportarDatos(ajustes));

  const libros = await idsDeDocumentos();
  const carpetaLibros = await destino.getDirectoryHandle('documentos', { create: true });
  for (const [i, id] of libros.entries()) {
    avance(tr('Copiando los libros: {0} de {1}', i + 1, libros.length));
    const archivo = await archivoDocumento(id);
    if (archivo) await escribir(carpetaLibros, id, archivo);
  }

  const leidos = await librosConOcr();
  const carpetaOcr = await destino.getDirectoryHandle('ocr', { create: true });
  for (const [i, libro] of leidos.entries()) {
    avance(tr('Guardando el texto del OCR: {0} de {1}', i + 1, leidos.length));
    await escribir(carpetaOcr, `${encodeURIComponent(libro)}.json`, JSON.stringify(await ocrDe(libro)));
  }

  const dictados = await idsDeGrabaciones();
  const carpetaDictados = await destino.getDirectoryHandle('dictados', { create: true });
  for (const [i, id] of dictados.entries()) {
    avance(tr('Copiando los dictados: {0} de {1}', i + 1, dictados.length));
    const g = await leerGrabacion(id);
    if (!g) continue;
    const { audio, ...datos } = g;
    const archivoAudio = `${encodeURIComponent(id)}.${extensionDeAudio(audio.type)}`;
    await escribir(carpetaDictados, archivoAudio, audio);
    await escribir(carpetaDictados, `${encodeURIComponent(id)}.json`, JSON.stringify({ ...datos, archivo: archivoAudio, tipo: audio.type }));
  }

  await escribir(
    destino,
    LEEME,
    [
      'Copia completa de Kotonoha',
      '',
      `${DATOS}: palabras, tarjetas, biblioteca, notas, subtítulos generados y ajustes, sin claves de API.`,
      'documentos/: los archivos de los libros, con el nombre que les da la biblioteca.',
      'ocr/: lo que el OCR leyó de cada libro y lo editado a mano.',
      'dictados/: las grabaciones del Portapapeles.',
      '',
      'Se restaura en Kotonoha, Ajustes, Tus datos, «Restaurar de una carpeta», eligiendo esta carpeta.',
      '',
    ].join('\r\n')
  );
  return { carpeta: destino.name, resumen: { libros: libros.length, librosConOcr: leidos.length, dictados: dictados.length } };
}

/** Pide la carpeta de una copia completa y lo pone todo en esta copia, sin borrar lo que ya hubiera. */
export async function restaurarCopiaCompleta(avance: AvanceCopia): Promise<{ ajustes: Partial<Ajustes> | null; resumen: ResumenCopia }> {
  const origen = await elegirCarpeta('read');
  let datos: File;
  try {
    datos = await (await origen.getFileHandle(DATOS)).getFile();
  } catch {
    throw new Error(tr('Esa carpeta no es una copia completa de Kotonoha: le falta {0}.', DATOS));
  }

  avance(tr('Restaurando palabras, tarjetas, biblioteca y ajustes…'));
  const ajustes = await motor.importarDatos(await datos.text());

  const resumen: ResumenCopia = { libros: 0, librosConOcr: 0, dictados: 0 };
  const carpetaLibros = await subcarpeta(origen, 'documentos');
  if (carpetaLibros) {
    const libros = (await hijos(carpetaLibros)).filter(([, h]) => h.kind === 'file');
    for (const [i, [nombre, h]] of libros.entries()) {
      avance(tr('Copiando los libros: {0} de {1}', i + 1, libros.length));
      await guardarArchivoDocumento(nombre, await (h as FileSystemFileHandle).getFile());
      resumen.libros++;
    }
  }

  const carpetaOcr = await subcarpeta(origen, 'ocr');
  if (carpetaOcr) {
    const leidos = (await hijos(carpetaOcr)).filter(([n, h]) => h.kind === 'file' && n.endsWith('.json'));
    for (const [i, [, h]] of leidos.entries()) {
      avance(tr('Guardando el texto del OCR: {0} de {1}', i + 1, leidos.length));
      await restaurarOcr(JSON.parse(await (await (h as FileSystemFileHandle).getFile()).text()));
      resumen.librosConOcr++;
    }
  }

  const carpetaDictados = await subcarpeta(origen, 'dictados');
  if (carpetaDictados) {
    const todos = await hijos(carpetaDictados);
    const fichas = todos.filter(([n, h]) => h.kind === 'file' && n.endsWith('.json'));
    for (const [i, [, h]] of fichas.entries()) {
      avance(tr('Copiando los dictados: {0} de {1}', i + 1, fichas.length));
      const d = JSON.parse(await (await (h as FileSystemFileHandle).getFile()).text()) as Omit<Grabacion, 'audio'> & { archivo: string; tipo: string };
      const audio = todos.find(([n]) => n === d.archivo)?.[1] as FileSystemFileHandle | undefined;
      if (!audio) continue;
      const { archivo: _a, tipo, ...grabacion } = d;
      await guardarGrabacion({ ...grabacion, audio: new Blob([await audio.getFile()], { type: tipo }) });
      resumen.dictados++;
    }
  }
  return { ajustes, resumen };
}
