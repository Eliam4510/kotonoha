// Las páginas de un libro, como imágenes listas para mostrar. Un EPUB de imágenes o un CBZ se leen del ZIP entrada a
// entrada; un PDF se pinta con pdf.js. El visor solo pide «la página n» y no sabe de formatos.

import { tr } from '../compartido/i18n';
import type { LineaTexto } from '../nucleo/capaTexto';
import { type Tamano, tamanoDeImagen, tipoDeImagen } from '../nucleo/imagenes';
import { type Direccion, type EntradaIndice, leerLibro } from '../nucleo/libro';
import { fuenteDeArchivo, leerEntrada } from '../nucleo/zip';

export interface PaginaImagen extends Tamano {
  url: string;
}

export interface Paginador {
  total: number;
  indice: EntradaIndice[];
  direccion: Direccion;
  direccionDelArchivo: boolean;
  /** El tamaño de una página si ya se conoce; si no, el de otra que sí, que en un libro suele ser el mismo. */
  tamano(n: number): Tamano | null;
  imagen(n: number): Promise<PaginaImagen>;
  /** El texto que trae el propio archivo, por líneas, o ninguna si la página es una imagen. Solo los PDF lo tienen. */
  textoPropio?(n: number): Promise<LineaTexto[]>;
  cerrar(): void;
}

/** Las páginas que se guardan pintadas. Más allá, se sueltan: un libro entero no cabe en memoria. */
const LIMITE_CACHE = 40;

export class CachePaginas {
  private mapa = new Map<number, Promise<PaginaImagen>>();

  obtener(n: number, crear: () => Promise<PaginaImagen>): Promise<PaginaImagen> {
    const guardada = this.mapa.get(n);
    if (guardada) {
      // La usada se pasa al final: así se suelta antes la que lleva más tiempo sin verse.
      this.mapa.delete(n);
      this.mapa.set(n, guardada);
      return guardada;
    }
    const nueva = crear();
    this.mapa.set(n, nueva);
    nueva.catch(() => this.mapa.delete(n));
    while (this.mapa.size > LIMITE_CACHE) {
      const [vieja, promesa] = this.mapa.entries().next().value as [number, Promise<PaginaImagen>];
      this.mapa.delete(vieja);
      promesa.then((p) => URL.revokeObjectURL(p.url)).catch(() => {});
    }
    return nueva;
  }

  vaciar() {
    for (const p of this.mapa.values()) p.then((x) => URL.revokeObjectURL(x.url)).catch(() => {});
    this.mapa.clear();
  }
}

async function medirConNavegador(blob: Blob): Promise<Tamano> {
  const b = await createImageBitmap(blob);
  const t = { ancho: b.width, alto: b.height };
  b.close();
  return t;
}

/** Un EPUB de imágenes o un CBZ. */
export async function paginadorDeZip(archivo: Blob, nombre: string, porDefecto: Direccion): Promise<Paginador> {
  const f = fuenteDeArchivo(archivo);
  const { libro, indice } = await leerLibro(f, nombre, porDefecto);
  if (!libro) throw new Error(tr('Este EPUB es de texto: se lee desde la Ayuda de lectura, como texto.'));
  const cache = new CachePaginas();
  const tamanos = new Map<number, Tamano>();
  return {
    total: libro.paginas.length,
    indice: libro.indice,
    direccion: libro.direccion,
    direccionDelArchivo: libro.direccionDelArchivo,
    tamano: (n) => tamanos.get(n) ?? tamanos.values().next().value ?? null,
    imagen: (n) =>
      cache.obtener(n, async () => {
        const ruta = libro.paginas[n];
        const entrada = ruta ? indice.get(ruta) : undefined;
        if (!entrada) throw new Error(tr('Falta la imagen de la página {0}', n + 1));
        const bytes = await leerEntrada(f, entrada);
        const blob = new Blob([bytes as BlobPart], { type: tipoDeImagen(ruta) });
        const t = tamanoDeImagen(bytes) ?? (await medirConNavegador(blob));
        tamanos.set(n, t);
        return { url: URL.createObjectURL(blob), ...t };
      }),
    cerrar: () => cache.vaciar(),
  };
}

/** Una imagen en pequeño, como JPEG en una URL de datos: la portada de la estantería. */
export async function miniaturaDe(blob: Blob, ancho = 240): Promise<string> {
  const b = await createImageBitmap(blob, { resizeWidth: ancho, resizeQuality: 'medium' });
  const lienzo = document.createElement('canvas');
  lienzo.width = b.width;
  lienzo.height = b.height;
  lienzo.getContext('2d')!.drawImage(b, 0, 0);
  b.close();
  return lienzo.toDataURL('image/jpeg', 0.82);
}

/** La portada de un EPUB de imágenes o un CBZ: su primera página, en pequeño. */
export async function portadaDeZip(archivo: Blob, nombre: string): Promise<string | undefined> {
  const p = await paginadorDeZip(archivo, nombre, 'ltr');
  try {
    const primera = await p.imagen(0);
    return await miniaturaDe(await (await fetch(primera.url)).blob());
  } finally {
    p.cerrar();
  }
}
