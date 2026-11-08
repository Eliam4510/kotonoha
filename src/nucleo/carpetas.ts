// El manga que viene en carpetas de imágenes, convertido en libros. Recibe las rutas de los archivos tal como llegan al
// elegir o soltar una carpeta («Serie/Tomo 1/001.jpg») y decide qué libros salen y con qué páginas. Una carpeta con
// imágenes es un libro, y sus subcarpetas, los capítulos de su índice. Una carpeta que solo trae otras carpetas se
// reparte: si parecen tomos, cada una es un libro; si parecen capítulos, son un solo libro. Una carpeta que solo envuelve
// a otra no cuenta. Sin navegador, para poder probarlo con rutas.

import { IMAGEN, ordenDePaginas } from './libro';
import { ordenNatural } from './zip';

export interface ArchivoEnCarpeta<T> {
  /** La ruta con «/», desde la carpeta elegida o soltada, ella incluida; o solo el nombre, si el archivo venía suelto. */
  ruta: string;
  archivo: T;
}

export interface LibroDeImagenes<T> {
  titulo: string;
  /** Las páginas en orden de lectura, con su ruta dentro del libro: las subcarpetas se conservan y hacen el índice. */
  paginas: { nombre: string; archivo: T }[];
  /** El ComicInfo.xml de la carpeta, si lo trae: dice el título y el sentido de lectura. */
  info?: T;
  /** La carpeta de la que es uno de los tomos («Serie», o «Mangas/Serie»): la de su colección. */
  carpeta?: string;
}

/** Lo que no es del libro: archivos y carpetas ocultos, y lo que deja macOS al comprimir. */
const OCULTO = /(^|\/)(\.|__MACOSX(\/|$))/;
const INFO = /(^|\/)ComicInfo\.xml$/i;

/** Un nombre de carpeta que dice que es un tomo: «第02巻», «3卷», «2권», «Vol. 3», «v01», «Mi_Serie_v07s», «サンプル（4）». */
const TOMO = /\d\s*[巻卷冊册권]|(^|[^a-z])(vol(ume)?|tomo|book)(?![a-z])|(^|[^a-z])v\d|[（(]\d+[）)]/i;
/** Y uno que dice que es un capítulo: «第1話», «12话», «5화», «Chapter 12», «Ch.3», «Capítulo 4», «#5». */
const CAPITULO = /\d\s*[話话章回화]|(^|[^a-z])(ch(ap(ter)?)?|cap([ií]tulo)?|ep(isode)?)(?![a-z])\.?\s*\d|#\d/i;

/** Un tomo de manga trae unas doscientas páginas; un capítulo, de veinte a cuarenta. */
const PAGINAS_DE_UN_TOMO = 80;

/** Un nombre que empieza por el número del tomo: «14巻», «第02巻 (otra edición)», «Vol. 3», «v01», «（4）». */
const EMPIEZA_POR_TOMO = /^\s*(?:第?\s*\d+\s*[巻卷冊册권]|(?:vol(?:ume)?|tomo|book)\.?\s*\d|v\d|[（(]?\d{1,3}[）)]?\s*(?:[（(\[].*)?$)/i;

/** El título de una subcarpeta: su nombre, con el de la carpeta de arriba delante si el suyo empieza por el número del tomo. */
const unir = (arriba: string, nombre: string) => (arriba && EMPIEZA_POR_TOMO.test(nombre) ? `${arriba} ${nombre}` : nombre);

/** Sin el dominio de la web de donde se bajó: «Descargas.APP-月の物語 1» es «月の物語 1». */
const DOMINIO = /[\w-]+\.(?:com|net|org|app|io|to|me|info|cc|tv|xyz|site|online|club|top|biz|ws)(?![a-z])[\s_-]*/gi;
const limpio = (titulo: string) => titulo.replace(DOMINIO, '').trim() || titulo;

/** El nombre de una carpeta a partir de su ruta («Mangas/Mi serie» es «Mi serie»), sin la web de donde se bajó. */
export const nombreDeCarpeta = (ruta: string) => limpio(ruta.slice(ruta.lastIndexOf('/') + 1));

/** Orden natural sin distinguir «Mi_Serie_v02» de «Mi Serie v02»: así los tomos se importan en orden. */
export const porNombre = (a: string, b: string) => ordenNatural(a.replace(/[\s_]+/g, ' '), b.replace(/[\s_]+/g, ' '));

/** Los archivos por su primera carpeta, en orden, con las rutas ya relativas a ella. */
function agrupar<T>(lista: ArchivoEnCarpeta<T>[]): Map<string, ArchivoEnCarpeta<T>[]> {
  const grupos = new Map<string, ArchivoEnCarpeta<T>[]>();
  for (const a of lista) {
    const corte = a.ruta.indexOf('/');
    const grupo = a.ruta.slice(0, corte);
    if (!grupos.has(grupo)) grupos.set(grupo, []);
    grupos.get(grupo)!.push({ ruta: a.ruta.slice(corte + 1), archivo: a.archivo });
  }
  return new Map([...grupos].sort(([a], [b]) => porNombre(a, b)));
}

const esTomo = (nombre: string) => TOMO.test(nombre) && !CAPITULO.test(nombre);

/**
 * Si las subcarpetas son tomos, cada uno su libro, o los capítulos de uno solo. Primero por sus nombres; si no dicen nada,
 * por lo que traen. «nombre» dice que se llaman como tomos: entonces la carpeta es una serie.
 */
function sonTomos<T>(subcarpetas: Map<string, ArchivoEnCarpeta<T>[]>): 'nombre' | 'paginas' | false {
  const nombres = [...subcarpetas.keys()];
  const tomos = nombres.filter(esTomo).length;
  const capitulos = nombres.filter((n) => CAPITULO.test(n)).length;
  if (tomos !== capitulos) return tomos > capitulos ? 'nombre' : false;
  const cuantas = [...subcarpetas.values()].map((l) => l.filter((a) => IMAGEN.test(a.ruta)).length).sort((a, b) => a - b);
  return cuantas[Math.floor(cuantas.length / 2)] >= PAGINAS_DE_UN_TOMO ? 'paginas' : false;
}

function libro<T>(titulo: string, archivos: ArchivoEnCarpeta<T>[]): LibroDeImagenes<T> {
  const imagenes = new Map(archivos.filter((a) => IMAGEN.test(a.ruta)).map((a) => [a.ruta, a.archivo]));
  // El ComicInfo de la propia carpeta, no el de un capítulo.
  const info = archivos.filter((a) => INFO.test(a.ruta)).sort((a, b) => a.ruta.split('/').length - b.ruta.split('/').length)[0]?.archivo;
  return { titulo: limpio(titulo), paginas: ordenDePaginas([...imagenes.keys()]).map((nombre) => ({ nombre, archivo: imagenes.get(nombre)! })), ...(info ? { info } : {}) };
}

/** Los libros de una carpeta, con las rutas ya relativas a ella. `ruta` es la de la carpeta, desde lo elegido. */
function librosDeCarpeta<T>(titulo: string, archivos: ArchivoEnCarpeta<T>[], ruta: string): LibroDeImagenes<T>[] {
  const directas = archivos.filter((a) => !a.ruta.includes('/') && IMAGEN.test(a.ruta)).length;
  const subcarpetas = agrupar(archivos.filter((a) => a.ruta.includes('/')));
  for (const [nombre, lista] of subcarpetas) if (!lista.some((a) => IMAGEN.test(a.ruta))) subcarpetas.delete(nombre);
  if (!subcarpetas.size) return directas ? [libro(titulo, archivos)] : [];
  // Una carpeta que solo envuelve a otra («Tomo 4/サンプル（4）»): el libro es el de dentro. Si la de dentro se llama como
  // un tomo, esta es su serie, aunque solo traiga uno.
  if (!directas && subcarpetas.size === 1) {
    const [[nombre, lista]] = subcarpetas;
    const dentro = librosDeCarpeta(unir(titulo, nombre), lista, `${ruta}/${nombre}`);
    return esTomo(nombre) ? dentro.map((l) => ({ ...l, carpeta: ruta })) : dentro;
  }
  // Tomos, cada uno su libro. Si se llaman como tomos, esta carpeta es su serie, y la de todos los que salgan de dentro
  // («Serie/v02-03/第02巻»); si solo se parecen por lo que traen, pueden ser series distintas, y cada una se queda la suya.
  // Si al lado hay una o dos imágenes sueltas, son la portada de la serie y no de un tomo.
  const tomos = directas <= 2 && sonTomos(subcarpetas);
  if (tomos) {
    return [...subcarpetas].flatMap(([nombre, lista]) =>
      librosDeCarpeta(unir(titulo, nombre), lista, `${ruta}/${nombre}`).map((l) => (tomos === 'nombre' || !l.carpeta ? { ...l, carpeta: ruta } : l))
    );
  }
  return [libro(titulo, archivos)];
}

/** El título de unas imágenes sueltas: lo que comparten sus nombres («Tomo_01_001.jpg», «Tomo_01_002.jpg»…). */
function tituloDeSueltas(nombres: string[]): string {
  const sinExtension = nombres.map((n) => n.replace(/\.[^.]+$/, ''));
  if (sinExtension.length === 1) return sinExtension[0];
  let comun = sinExtension[0];
  for (const n of sinExtension) while (!n.startsWith(comun)) comun = comun.slice(0, -1);
  return comun.replace(/[\uD800-\uDBFF]$/, '').replace(/[\s_.-]*\d*$/, '').replace(/[\s_.-]+$/, '');
}

/**
 * Los libros que salen de unos archivos elegidos o soltados: uno por carpeta, o por tomo, y otro con las imágenes que
 * vengan sueltas. Lo que no es imagen ni ComicInfo.xml se ignora: lo importa quien llama, si es un libro.
 * @param titulo El de las imágenes sueltas si sus nombres no comparten nada.
 */
export function librosDeImagenes<T>(archivos: ArchivoEnCarpeta<T>[], titulo: string): LibroDeImagenes<T>[] {
  const utiles = archivos.filter((a) => !OCULTO.test(a.ruta) && (IMAGEN.test(a.ruta) || INFO.test(a.ruta)));
  const salida: LibroDeImagenes<T>[] = [];
  for (const [nombre, lista] of agrupar(utiles.filter((a) => a.ruta.includes('/')))) salida.push(...librosDeCarpeta(nombre, lista, nombre));
  const sueltas = utiles.filter((a) => !a.ruta.includes('/') && IMAGEN.test(a.ruta));
  if (sueltas.length) salida.push(libro(tituloDeSueltas(sueltas.map((a) => a.ruta)) || titulo, sueltas));
  return salida;
}
