// Las páginas de un libro, como imágenes listas para mostrar. Un EPUB de imágenes o un CBZ se leen del ZIP entrada a
// entrada; un PDF se pinta con pdf.js. El visor solo pide «la página n» y no sabe de formatos.

import { tr } from '../compartido/i18n';
import type { LineaTexto } from '../nucleo/capaTexto';
import { type Tamano, tamanoDeImagen, tipoDeImagen } from '../nucleo/imagenes';
import { type Direccion, type EntradaIndice, leerLibro } from '../nucleo/libro';
import type { Caja } from '../nucleo/ocr';
import { fuenteDeArchivo, leerEntrada, leerPrincipio } from '../nucleo/zip';

export interface PaginaImagen extends Tamano {
  url: string;
}

/** Lo que lee el OCR de una página: una imagen y, si no es la página entera, dónde está en ella. */
export interface ImagenOcr {
  imagen: Blob | ImageBitmap;
  /** Dónde está la imagen en la página, en fracciones de 0 a 1. Sin él, la imagen es la página entera. */
  marco?: Caja;
}

export interface Paginador {
  total: number;
  indice: EntradaIndice[];
  direccion: Direccion;
  direccionDelArchivo: boolean;
  /** El tamaño de una página si ya se conoce; si no, el de otra que sí, que en un libro suele ser el mismo. */
  tamano(n: number): Tamano | null;
  imagen(n: number): Promise<PaginaImagen>;
  /**
   * La página pintada y además decodificada, para enseñarla: solo las que se van a ver, porque cada una decodificada
   * ocupa decenas de MB (el OCR y las miniaturas piden la imagen sin más).
   */
  imagenParaVer?(n: number): Promise<PaginaImagen>;
  /** La página ya lista para ver, sin esperar: así se enseña en el mismo fotograma, sin fondo vacío antes. */
  imagenYa?(n: number): PaginaImagen | undefined;
  /**
   * Lo que conviene leer con el OCR, si no es la página tal como se ve: en un PDF escaneado, la imagen escaneada tal cual.
   * Null si la página no es solo eso.
   */
  imagenOcr?(n: number): Promise<ImagenOcr | null>;
  /** El texto que trae el propio archivo, por líneas, o ninguna si la página es una imagen. Solo los PDF lo tienen. */
  textoPropio?(n: number): Promise<LineaTexto[]>;
  /** Las páginas apaisadas: una doble página escaneada de una pieza, que en doble página va sola. Solo en los ZIP. */
  anchas?(): Promise<number[]>;
  cerrar(): void;
}

/** Lo que lee el OCR de una página: lo que dé el paginador para eso o, si no da nada, la página tal como se ve. */
export async function imagenParaOcr(p: Paginador, n: number): Promise<ImagenOcr> {
  const propia = await p.imagenOcr?.(n).catch((e) => {
    console.debug('Kotonoha OCR: se lee la página pintada', e);
    return null;
  });
  return propia ?? { imagen: await (await fetch((await p.imagen(n)).url)).blob() };
}

/** Lo que se lee de cada imagen para saber su tamaño: la cabecera suele caber en mucho menos. */
const CABECERA_IMAGEN = 64 * 1024;

/** Las páginas que se guardan pintadas. Más allá, se sueltan: un libro entero no cabe en memoria. */
const LIMITE_CACHE = 40;

export class CachePaginas {
  private mapa = new Map<number, Promise<PaginaImagen>>();
  private listas = new Map<number, PaginaImagen>();

  /** La página ya lista, o nada si aún no lo está. */
  ya(n: number): PaginaImagen | undefined {
    return this.listas.get(n);
  }

  /**
   * La página para verla: cuando llega, queda apuntada como lista y el visor la puede montar en el mismo fotograma. La
   * decodifica el navegador al pintarla (decoding="sync" en el visor), a la escala a que se ve: decodificarla antes
   * aquí, a su tamaño entero, costaba unos 40 MB por página sin evitar nada.
   */
  preparar(n: number, hacer: () => Promise<PaginaImagen>): Promise<PaginaImagen> {
    const promesa = this.obtener(n, hacer);
    if (this.listas.has(n)) return promesa;
    return promesa.then((p) => {
      // Si se soltó mientras se pintaba (o la sustituyó otra), no se da por lista: su dirección ya no vale.
      if (this.mapa.get(n) === promesa) this.listas.set(n, p);
      return p;
    });
  }

  obtener(n: number, hacer: () => Promise<PaginaImagen>): Promise<PaginaImagen> {
    const guardada = this.mapa.get(n);
    if (guardada) {
      // La usada se pasa al final: así se suelta antes la que lleva más tiempo sin verse.
      this.mapa.delete(n);
      this.mapa.set(n, guardada);
      return guardada;
    }
    const nueva = hacer();
    this.mapa.set(n, nueva);
    nueva.catch(() => this.mapa.delete(n));
    while (this.mapa.size > LIMITE_CACHE) {
      const [vieja, promesa] = this.mapa.entries().next().value as [number, Promise<PaginaImagen>];
      this.mapa.delete(vieja);
      this.listas.delete(vieja);
      promesa.then((p) => URL.revokeObjectURL(p.url)).catch(() => {});
    }
    return nueva;
  }

  vaciar() {
    for (const p of this.mapa.values()) p.then((x) => URL.revokeObjectURL(x.url)).catch(() => {});
    this.mapa.clear();
    this.listas.clear();
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
  if (!libro) throw new Error(tr('Este EPUB es de texto: se lee desde la Biblioteca, como texto.'));
  const cache = new CachePaginas();
  const tamanos = new Map<number, Tamano>();
  const leer = (n: number) => async () => {
    const ruta = libro.paginas[n];
    const entrada = ruta ? indice.get(ruta) : undefined;
    if (!entrada) throw new Error(tr('Falta la imagen de la página {0}', n + 1));
    const bytes = await leerEntrada(f, entrada);
    const blob = new Blob([bytes as BlobPart], { type: tipoDeImagen(ruta) });
    const t = tamanoDeImagen(bytes) ?? (await medirConNavegador(blob));
    tamanos.set(n, t);
    return { url: URL.createObjectURL(blob), ...t };
  };
  return {
    total: libro.paginas.length,
    indice: libro.indice,
    direccion: libro.direccion,
    direccionDelArchivo: libro.direccionDelArchivo,
    tamano: (n) => tamanos.get(n) ?? tamanos.values().next().value ?? null,
    imagen: (n) => cache.obtener(n, leer(n)),
    imagenParaVer: (n) => cache.preparar(n, leer(n)),
    // Mide todas las páginas por su cabecera, sin descodificarlas; de paso, el visor ya sabe el tamaño de cada una.
    anchas: async () => {
      const salida: number[] = [];
      for (const [n, ruta] of libro.paginas.entries()) {
        const entrada = indice.get(ruta);
        if (!entrada) continue;
        const t = tamanos.get(n) ?? tamanoDeImagen(await leerPrincipio(f, entrada, CABECERA_IMAGEN)) ?? tamanoDeImagen(await leerEntrada(f, entrada));
        if (!t) continue;
        tamanos.set(n, t);
        if (t.ancho > t.alto) salida.push(n);
      }
      return salida;
    },
    imagenYa: (n) => cache.ya(n),
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

/** Lo que la estantería guarda de un EPUB de imágenes o un CBZ al importarlo: la portada en pequeño y las páginas apaisadas. */
export async function datosDeZip(archivo: Blob, nombre: string): Promise<{ portada?: string; anchas: number[] }> {
  const p = await paginadorDeZip(archivo, nombre, 'ltr');
  try {
    const anchas = await p.anchas!().catch(() => []);
    const portada = await p
      .imagen(0)
      .then(async (primera) => miniaturaDe(await (await fetch(primera.url)).blob()))
      .catch(() => undefined);
    return { portada, anchas };
  } finally {
    p.cerrar();
  }
}
