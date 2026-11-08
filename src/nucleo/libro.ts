// Qué hay dentro de un libro: los EPUB hechos de imágenes (manga y libros escaneados), los CBZ y los EPUB de texto. Saca
// el título, el idioma, el sentido de lectura, el índice y, según el libro, la imagen de cada página o el archivo de cada
// capítulo. Se lee con expresiones regulares para poder probarlo sin navegador.

import { type EntradaZip, type FuenteBytes, leerEntrada, leerIndiceZip, ordenNatural } from './zip';

export type Direccion = 'rtl' | 'ltr';

export interface EntradaIndice {
  titulo: string;
  /** Página donde empieza, contando desde 0. */
  pagina: number;
}

export interface LibroDePaginas {
  formato: 'epub' | 'cbz';
  titulo: string;
  idioma?: string;
  direccion: Direccion;
  /** Si el propio archivo dice el sentido de lectura; si no, se puede cambiar sin contradecirlo. */
  direccionDelArchivo: boolean;
  /** La ruta dentro del ZIP de la imagen de cada página, en orden de lectura. */
  paginas: string[];
  indice: EntradaIndice[];
}

const IMAGEN = /\.(jpe?g|png|webp|gif|avif|bmp)$/i;

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
export const sinEntidades = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
    e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTIDADES[e.toLowerCase()] ?? m
  );

/** Los atributos de una etiqueta, en minúsculas y con sus entidades resueltas. */
export function atributos(etiqueta: string): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const m of etiqueta.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) salida[m[1].toLowerCase()] = sinEntidades(m[2] ?? m[3] ?? '');
  return salida;
}

export const etiquetas = (xml: string, nombre: string) => [...xml.matchAll(new RegExp(`<(?:[\\w-]+:)?${nombre}\\b[^>]*>`, 'gi'))].map((m) => m[0]);
export const contenido = (xml: string, nombre: string) =>
  sinEntidades(new RegExp(`<(?:[\\w-]+:)?${nombre}\\b[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${nombre}>`, 'i').exec(xml)?.[1]?.replace(/<[^>]+>/g, '').trim() ?? '');

/** Une una ruta relativa con la carpeta de un archivo, resolviendo «..» y quitando el fragmento. */
export function resolverRuta(desdeArchivo: string, relativa: string): string {
  let r = relativa.split('#')[0];
  try {
    r = decodeURIComponent(r);
  } catch {
    // Una ruta con un % suelto se queda como está.
  }
  if (r.startsWith('/')) return r.slice(1);
  const partes = desdeArchivo.split('/').slice(0, -1);
  for (const p of r.split('/')) {
    if (p === '..') partes.pop();
    else if (p && p !== '.') partes.push(p);
  }
  return partes.join('/');
}

const texto = (b: Uint8Array) => new TextDecoder('utf-8').decode(b);
/** El texto visible de un documento XHTML, sin el título ni las etiquetas. */
const textoVisible = (xhtml: string) =>
  sinEntidades(xhtml.replace(/<head\b[\s\S]*?<\/head>/i, '').replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, '')).replace(/\s+/g, '');

/** La primera imagen de una página: <img src> o la <image> de un SVG, que es como suelen venir el manga y los escaneos. */
function imagenDe(xhtml: string, ruta: string): string | null {
  for (const e of [...etiquetas(xhtml, 'img'), ...etiquetas(xhtml, 'image')]) {
    const a = atributos(e);
    const src = a.src ?? a['xlink:href'] ?? a.href;
    if (src) return resolverRuta(ruta, src);
  }
  return null;
}

async function leerTexto(f: FuenteBytes, indice: Map<string, EntradaZip>, ruta: string): Promise<string | null> {
  const e = indice.get(ruta);
  return e ? texto(await leerEntrada(f, e)) : null;
}

/** Una entrada del índice tal como la escribe el libro: el archivo al que lleva y, si lo dice, el punto dentro de él. */
interface EntradaDeIndice {
  titulo: string;
  ruta: string;
  fragmento?: string;
}

/** Los dos índices que puede traer un EPUB: el de EPUB 3 (nav) y el de EPUB 2 (NCX), por ese orden. */
async function indicesDelLibro(f: FuenteBytes, indice: Map<string, EntradaZip>, opf: string, rutaOpf: string): Promise<EntradaDeIndice[][]> {
  const items = etiquetas(opf, 'item').map(atributos);
  const entrada = (titulo: string, href: string, desde: string): EntradaDeIndice[] => {
    if (!titulo || !href) return [];
    let fragmento = href.includes('#') ? href.slice(href.indexOf('#') + 1) : '';
    try {
      fragmento = decodeURIComponent(fragmento);
    } catch {
      // Un fragmento con un % suelto se queda como está.
    }
    return [{ titulo, ruta: resolverRuta(desde, href), ...(fragmento ? { fragmento } : {}) }];
  };
  const salida: EntradaDeIndice[][] = [];
  const nav = items.find((i) => (i.properties ?? '').split(/\s+/).includes('nav'));
  if (nav?.href) {
    const ruta = resolverRuta(rutaOpf, nav.href);
    const xhtml = await leerTexto(f, indice, ruta);
    const toc = xhtml && (/<nav\b[^>]*epub:type\s*=\s*["']toc["'][^>]*>([\s\S]*?)<\/nav>/i.exec(xhtml)?.[1] ?? /<nav\b[^>]*>([\s\S]*?)<\/nav>/i.exec(xhtml)?.[1]);
    salida.push([...(toc ?? '').matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].flatMap((m) => entrada(sinEntidades(m[2].replace(/<[^>]+>/g, '')).trim(), atributos(m[1]).href ?? '', ruta)));
  }
  const ncx = items.find((i) => i['media-type'] === 'application/x-dtbncx+xml');
  if (ncx?.href) {
    const ruta = resolverRuta(rutaOpf, ncx.href);
    const xml = await leerTexto(f, indice, ruta);
    salida.push([...(xml ?? '').matchAll(/<navPoint\b[\s\S]*?<text>([\s\S]*?)<\/text>[\s\S]*?<content\b([^>]*)>/gi)].flatMap((m) => entrada(sinEntidades(m[1]).trim(), atributos(m[2]).src ?? '', ruta)));
  }
  return salida;
}

/** El primer índice del libro que lleva a alguna parte, con cada entrada traducida por `donde`. */
async function indiceTraducido<T>(f: FuenteBytes, indice: Map<string, EntradaZip>, opf: string, rutaOpf: string, donde: (e: EntradaDeIndice) => T | undefined): Promise<T[]> {
  for (const lista of await indicesDelLibro(f, indice, opf, rutaOpf)) {
    const salida = lista.flatMap((e) => {
      const t = donde(e);
      return t === undefined ? [] : [t];
    });
    if (salida.length) return salida;
  }
  return [];
}

/** El índice de un libro de páginas, con cada entrada en la página donde empieza. */
function leerIndiceDelLibro(f: FuenteBytes, indice: Map<string, EntradaZip>, opf: string, rutaOpf: string, paginaDe: Map<string, number>): Promise<EntradaIndice[]> {
  return indiceTraducido(f, indice, opf, rutaOpf, (e) => {
    const pagina = paginaDe.get(e.ruta);
    return pagina === undefined ? undefined : { titulo: e.titulo, pagina };
  });
}

/** El paquete del EPUB (el OPF) y dónde está, que es desde donde se resuelven sus rutas. */
async function abrirOpf(f: FuenteBytes, indice: Map<string, EntradaZip>): Promise<{ opf: string; rutaOpf: string }> {
  const contenedor = await leerTexto(f, indice, 'META-INF/container.xml');
  const rutaOpf = contenedor ? atributos(etiquetas(contenedor, 'rootfile')[0] ?? '')['full-path'] : [...indice.keys()].find((n) => n.endsWith('.opf'));
  const opf = rutaOpf ? await leerTexto(f, indice, rutaOpf) : null;
  if (!rutaOpf || !opf) throw new Error('EPUB sin índice');
  return { opf, rutaOpf };
}

const sentidoDelSpine = (opf: string) => {
  const spine = atributos(etiquetas(opf, 'spine')[0] ?? '');
  const declarado = spine['page-progression-direction'];
  return declarado === 'rtl' || declarado === 'ltr' ? { direccion: declarado as Direccion, direccionDelArchivo: true } : { direccion: 'ltr' as Direccion, direccionDelArchivo: false };
};

/**
 * Un EPUB de páginas, o null si es de texto: entonces se importa como texto, con su estructura. Es de páginas si lo dice
 * su maquetación fija o si casi todas sus páginas son una sola imagen sin texto.
 */
export async function leerEpub(f: FuenteBytes, indice: Map<string, EntradaZip>, nombre: string): Promise<LibroDePaginas | null> {
  const { opf, rutaOpf } = await abrirOpf(f, indice);
  const items = new Map(etiquetas(opf, 'item').map((e) => atributos(e)).filter((a) => a.id && a.href).map((a) => [a.id, a]));
  const orden = etiquetas(opf, 'itemref').map((e) => atributos(e).idref).filter(Boolean);
  const fija = /rendition:layout"?[^>]*>\s*pre-paginated/i.test(opf) || /name="fixed-layout"\s+content="true"/i.test(opf);

  const paginas: string[] = [];
  const paginaDe = new Map<string, number>();
  let deImagen = 0;
  let conTexto = 0;
  for (const id of orden) {
    const item = items.get(id);
    if (!item) continue;
    const ruta = resolverRuta(rutaOpf, item.href);
    if (IMAGEN.test(ruta)) {
      paginaDe.set(ruta, paginas.length);
      paginas.push(ruta);
      deImagen++;
      continue;
    }
    const xhtml = await leerTexto(f, indice, ruta);
    if (!xhtml) continue;
    const imagen = imagenDe(xhtml, ruta);
    // Una página de imagen no lleva texto a la vista; el japonés es denso, así que el margen es pequeño.
    if (imagen && indice.has(imagen) && textoVisible(xhtml).length < 10) {
      paginaDe.set(ruta, paginas.length);
      paginas.push(imagen);
      deImagen++;
    } else conTexto++;
  }
  if (!paginas.length || (!fija && deImagen < (deImagen + conTexto) * 0.8)) return null;

  // Sin declarar, un EPUB va de izquierda a derecha, como dice la norma: los manga sí lo declaran, y un libro de texto
  // horizontal japonés, como los de preparación del JLPT, se lee así.
  return {
    formato: 'epub',
    titulo: contenido(opf, 'title') || nombre,
    idioma: contenido(opf, 'language') || undefined,
    ...sentidoDelSpine(opf),
    paginas,
    indice: await leerIndiceDelLibro(f, indice, opf, rutaOpf, paginaDe),
  };
}

/** Una entrada del índice de un EPUB de texto: el capítulo y, si lo dice, el punto dentro de él. */
export interface EntradaCapitulo {
  titulo: string;
  capitulo: number;
  fragmento?: string;
}

/** Un EPUB de texto, como una novela: se pinta capítulo a capítulo, con su propio formato. */
export interface EpubDeTexto {
  titulo: string;
  idioma?: string;
  direccion: Direccion;
  direccionDelArchivo: boolean;
  /** La ruta de cada capítulo dentro del ZIP, en el orden del libro. */
  capitulos: string[];
  indice: EntradaCapitulo[];
  /** La ruta de la imagen de la portada, si el libro dice cuál es. */
  portada?: string;
}

const DOCUMENTO = /\.(x?html?|xht)$/i;

/** Lo que hace falta para leer un EPUB de texto: sus capítulos en orden, el índice y la portada. */
export async function leerEpubDeTexto(f: FuenteBytes, indice: Map<string, EntradaZip>, nombre: string): Promise<EpubDeTexto> {
  const { opf, rutaOpf } = await abrirOpf(f, indice);
  const items = new Map(etiquetas(opf, 'item').map((e) => atributos(e)).filter((a) => a.id && a.href).map((a) => [a.id, a]));
  const capitulos: string[] = [];
  for (const ref of etiquetas(opf, 'itemref').map(atributos)) {
    const item = items.get(ref.idref);
    if (!item) continue;
    const ruta = resolverRuta(rutaOpf, item.href);
    if (indice.has(ruta) && (DOCUMENTO.test(ruta) || /html/i.test(item['media-type'] ?? '')) && !capitulos.includes(ruta)) capitulos.push(ruta);
  }
  if (!capitulos.length) throw new Error('EPUB sin capítulos');
  const capituloDe = new Map(capitulos.map((r, i) => [r, i]));
  const entradas = await indiceTraducido(f, indice, opf, rutaOpf, (e) => {
    const capitulo = capituloDe.get(e.ruta);
    return capitulo === undefined ? undefined : { titulo: e.titulo, capitulo, ...(e.fragmento ? { fragmento: e.fragmento } : {}) };
  });
  // La portada: la imagen marcada como tal en EPUB 3, o la que nombra el <meta name="cover"> de EPUB 2.
  const todos = [...items.values()];
  const meta = etiquetas(opf, 'meta').map(atributos).find((m) => m.name === 'cover')?.content;
  const item = todos.find((i) => (i.properties ?? '').split(/\s+/).includes('cover-image')) ?? (meta ? items.get(meta) : undefined);
  const portada = item ? resolverRuta(rutaOpf, item.href) : undefined;
  return {
    titulo: contenido(opf, 'title') || nombre,
    idioma: contenido(opf, 'language') || undefined,
    ...sentidoDelSpine(opf),
    capitulos,
    indice: entradas,
    ...(portada && indice.has(portada) && IMAGEN.test(portada) ? { portada } : {}),
  };
}

/** Un CBZ: sus imágenes en orden natural. ComicInfo.xml, si lo trae, dice el título y si se lee como manga. */
export async function leerCbz(f: FuenteBytes, indice: Map<string, EntradaZip>, nombre: string, porDefecto: Direccion): Promise<LibroDePaginas> {
  const paginas = [...indice.keys()].filter((n) => IMAGEN.test(n) && !/(^|\/)(__MACOSX|\.)/.test(n)).sort(ordenNatural);
  if (!paginas.length) throw new Error('El CBZ no trae imágenes');
  const info = [...indice.keys()].find((n) => /(^|\/)ComicInfo\.xml$/i.test(n));
  const xml = info ? await leerTexto(f, indice, info) : null;
  const manga = xml ? contenido(xml, 'Manga') : '';
  const direccionDelArchivo = /^(yes|no)/i.test(manga);
  return {
    formato: 'cbz',
    titulo: (xml && contenido(xml, 'Title')) || nombre,
    idioma: (xml && contenido(xml, 'LanguageISO')) || undefined,
    direccion: direccionDelArchivo ? (/RightToLeft/i.test(manga) ? 'rtl' : 'ltr') : porDefecto,
    direccionDelArchivo,
    paginas,
    indice: [],
  };
}

/** Lee un EPUB o un CBZ. Para un EPUB de texto devuelve null. El sentido por defecto solo vale para un CBZ sin ComicInfo. */
export async function leerLibro(f: FuenteBytes, nombreArchivo: string, porDefecto: Direccion): Promise<{ libro: LibroDePaginas | null; indice: Map<string, EntradaZip> }> {
  const indice = await leerIndiceZip(f);
  const nombre = nombreArchivo.replace(/\.[^.]+$/, '');
  const libro = /\.epub$/i.test(nombreArchivo) || indice.has('META-INF/container.xml') ? await leerEpub(f, indice, nombre) : await leerCbz(f, indice, nombre, porDefecto);
  return { libro, indice };
}
