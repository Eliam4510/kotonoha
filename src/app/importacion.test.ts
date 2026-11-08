import { describe, expect, it } from 'vitest';
import type { LibroDeImagenes } from '../nucleo/carpetas';
import { fuenteDeArchivo, leerEntrada, leerIndiceZip } from '../nucleo/zip';
import { archivosElegidos, cbzDe, recorrerEntradas, tamanoDe } from './importacion';

// Lo que se suelta, como lo ve el navegador: entradas de archivo y de carpeta, que dan sus hijos por tandas.
const archivo = (nombre: string, contenido = nombre) =>
  ({ isFile: true, isDirectory: false, name: nombre, file: (ok: (f: File) => void) => ok(new File([contenido], nombre)) }) as unknown as FileSystemFileEntry;
function carpeta(nombre: string, hijos: FileSystemEntry[], tanda = 2): FileSystemDirectoryEntry {
  const createReader = () => {
    let i = 0;
    return { readEntries: (ok: (l: FileSystemEntry[]) => void) => ok(hijos.slice(i, (i += tanda))) };
  };
  return { isFile: false, isDirectory: true, name: nombre, createReader } as unknown as FileSystemDirectoryEntry;
}

describe('lo que llega para importar', () => {
  it('recorre las carpetas soltadas hasta el fondo, tanda a tanda, con la ruta de cada archivo', async () => {
    const lista = await recorrerEntradas([carpeta('Serie', [carpeta('第01巻', [archivo('001.jpg'), archivo('002.jpg'), archivo('003.jpg')]), archivo('notas.txt')]), archivo('suelta.png')]);
    expect(lista.map((a) => a.ruta)).toEqual(['Serie/第01巻/001.jpg', 'Serie/第01巻/002.jpg', 'Serie/第01巻/003.jpg', 'Serie/notas.txt', 'suelta.png']);
    expect(await lista[0].archivo.text()).toBe('001.jpg');
  });

  it('del selector toma la ruta dentro de la carpeta elegida, o el nombre si el archivo va suelto', () => {
    const enCarpeta = new File(['x'], '001.jpg');
    Object.defineProperty(enCarpeta, 'webkitRelativePath', { value: 'MiSerie/14巻/001.jpg' });
    expect(archivosElegidos([enCarpeta, new File(['y'], 'suelta.jpg')] as unknown as FileList).map((a) => a.ruta)).toEqual(['MiSerie/14巻/001.jpg', 'suelta.jpg']);
    expect(archivosElegidos(null)).toEqual([]);
  });

  it('hace un CBZ con las páginas en orden y la ficha del tomo', async () => {
    const pagina = (n: string) => new File([`imagen ${n}`], n);
    const libro: LibroDeImagenes<File> = { titulo: 'Serie 第01巻', paginas: [{ nombre: 'cover.jpg', archivo: pagina('cover.jpg') }, { nombre: '00001.jpg', archivo: pagina('00001.jpg') }], info: new File(['<ComicInfo/>'], 'ComicInfo.xml') };
    const cbz = await cbzDe(libro);
    expect(cbz.name).toBe('Serie 第01巻.cbz');
    expect(tamanoDe(libro)).toBe('imagen cover.jpg'.length + 'imagen 00001.jpg'.length + '<ComicInfo/>'.length);
    const f = fuenteDeArchivo(cbz);
    const indice = await leerIndiceZip(f);
    expect([...indice.keys()]).toEqual(['ComicInfo.xml', 'cover.jpg', '00001.jpg']);
    expect(new TextDecoder().decode(await leerEntrada(f, indice.get('00001.jpg')!))).toBe('imagen 00001.jpg');
  });
});
