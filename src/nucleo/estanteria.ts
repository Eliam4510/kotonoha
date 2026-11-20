// Las cuentas de la estantería, sin navegador: cuánto se ha leído de cada libro, qué se está leyendo, cómo va una
// colección, qué colecciones salen de una carpeta importada y cómo se aplica un cambio sobre lo guardado.

import type { CambioBiblioteca, ColeccionBiblioteca, ElementoBiblioteca, TipoColeccion } from '../compartido/tipos';
import { nombreDeCarpeta, porNombre } from './carpetas';

/** Un cambio sobre lo último guardado de un elemento: los campos que trae, y null quita el campo. */
export function aplicarCambio(e: ElementoBiblioteca, c: CambioBiblioteca): ElementoBiblioteca {
  const { documento, ...resto } = c;
  const salida: Record<string, unknown> = { ...e };
  for (const [k, v] of Object.entries(resto)) {
    if (v === null) delete salida[k];
    else if (v !== undefined) salida[k] = v;
  }
  const s = salida as unknown as ElementoBiblioteca;
  if (documento && s.documento) s.documento = { ...s.documento, ...documento };
  return s;
}

/** Lo que ocupa una página de un texto de la Biblioteca, en letras. */
export const TAM_PAGINA_TEXTO = 2500;

/** Parte un texto en páginas: entre párrafos si se puede, y si no, al final de una línea. */
export function paginasDeTexto(texto: string): string[] {
  const salida: string[] = [];
  let i = 0;
  while (i < texto.length) {
    let fin = Math.min(i + TAM_PAGINA_TEXTO, texto.length);
    if (fin < texto.length) {
      const parrafo = texto.lastIndexOf('\n\n', fin);
      const linea = texto.lastIndexOf('\n', fin);
      if (parrafo > i + TAM_PAGINA_TEXTO / 2) fin = parrafo + 2;
      else if (linea > i + TAM_PAGINA_TEXTO / 2) fin = linea + 1;
    }
    salida.push(texto.slice(i, fin));
    i = fin;
  }
  return salida.length ? salida : [''];
}

export interface Avance {
  /** La página, o el capítulo, por el que se va, desde 1. */
  actual: number;
  total: number;
  /** Lo leído, de 0 a 1. */
  fraccion: number;
  empezado: boolean;
  terminado: boolean;
}

/** Cuánto se ha leído de un elemento de `total` páginas (o capítulos, en un libro de texto). */
export function avanceDe(e: ElementoBiblioteca, total: number): Avance {
  const t = Math.max(1, total);
  const actual = Math.min((e.pagina ?? 0) + 1, t);
  // En un libro de texto, también lo que se lleva del capítulo.
  const dentro = e.documento?.texto ? Math.min(1, Math.max(0, e.documento.posicion ?? 0)) : 0;
  const terminado = !!e.terminado;
  const fraccion = terminado ? 1 : Math.min(1, e.documento?.texto ? (actual - 1 + dentro) / t : actual / t);
  return { actual, total: t, fraccion, empezado: terminado || actual > 1 || dentro > 0, terminado };
}

export type FiltroEstanteria = 'todo' | 'leyendo' | 'sin-empezar' | 'terminados';

/** Los elementos que muestra un filtro de la estantería. */
export function filtrar(lista: ElementoBiblioteca[], filtro: FiltroEstanteria, avance: (e: ElementoBiblioteca) => Avance): ElementoBiblioteca[] {
  if (filtro === 'todo') return lista;
  return lista.filter((e) => {
    const a = avance(e);
    return filtro === 'terminados' ? a.terminado : filtro === 'leyendo' ? a.empezado && !a.terminado : !a.empezado;
  });
}

/** Lo que se está leyendo: lo empezado y sin terminar, lo último que se abrió primero. */
export function enCurso(lista: ElementoBiblioteca[], avance: (e: ElementoBiblioteca) => Avance, cuantos = 4): ElementoBiblioteca[] {
  return lista
    .filter((e) => {
      const a = avance(e);
      return a.empezado && !a.terminado;
    })
    .sort((a, b) => (b.abierto ?? b.creado) - (a.abierto ?? a.creado))
    .slice(0, cuantos);
}

/** En una colección de manga o de novelas, sus libros son tomos. */
export const deTomos = (tipo?: TipoColeccion) => tipo === 'manga' || tipo === 'novela';

/** Los libros de una colección, en orden: por su título, con los números en orden natural («Tomo 2» antes que «Tomo 10»). */
export const librosDe = (c: ColeccionBiblioteca, lista: ElementoBiblioteca[]) => lista.filter((e) => e.coleccion === c.id).sort((a, b) => porNombre(a.titulo, b.titulo));

export interface ResumenColeccion {
  libros: ElementoBiblioteca[];
  terminados: number;
  /** El libro por el que se va: el último abierto sin terminar. */
  actual?: ElementoBiblioteca;
  /** Su lugar en la colección, desde 1. */
  posicion?: number;
  /** Lo leído de toda la colección, de 0 a 1: los libros terminados y lo que se lleva de los demás. */
  fraccion: number;
  /** La elegida o, si no, la del primer libro que tenga. */
  portada?: string;
}

export function resumenDe(c: ColeccionBiblioteca, lista: ElementoBiblioteca[], avance: (e: ElementoBiblioteca) => Avance): ResumenColeccion {
  const libros = librosDe(c, lista);
  const avances = libros.map(avance);
  const abiertos = libros.filter((e, i) => e.abierto && !avances[i].terminado).sort((a, b) => (b.abierto ?? 0) - (a.abierto ?? 0));
  const actual = abiertos[0];
  return {
    libros,
    terminados: avances.filter((a) => a.terminado).length,
    ...(actual ? { actual, posicion: libros.indexOf(actual) + 1 } : {}),
    fraccion: libros.length ? avances.reduce((s, a) => s + (a.empezado ? a.fraccion : 0), 0) / libros.length : 0,
    portada: c.portada ?? libros.find((e) => e.documento?.portada)?.documento?.portada,
  };
}

/** Un libro recién importado: de qué carpeta venía y si se lee de derecha a izquierda. */
export interface Importado {
  id: string;
  carpeta?: string;
  rtl: boolean;
}

export interface PlanColecciones {
  nuevas: { nombre: string; tipo?: TipoColeccion; libros: string[] }[];
  /** A colecciones que ya existían: las que se llaman como su carpeta. */
  anadir: { coleccion: string; libros: string[] }[];
}

const mismoNombre = (a: string, b: string) => a.trim().normalize('NFKC').toLowerCase() === b.trim().normalize('NFKC').toLowerCase();

/**
 * Las colecciones que salen de lo importado de unas carpetas. Los libros de una misma carpeta van a la colección que se
 * llame como ella; si no hay, se crea una, siempre que sean al menos dos (un libro suelto no es una colección). Si todos se
 * leen de derecha a izquierda, la colección es de manga.
 */
/**
 * Los libros (PDF, EPUB y CBZ) de una carpeta importada, en el orden natural de su ruta (los años y los meses de unas
 * revistas, por orden), con el título que lleva cada uno: el nombre de su archivo o, si ese nombre se repite en otras
 * subcarpetas, el nombre con las subcarpetas en que está, sin la elegida: «本誌 (2023/04)».
 */
export function titulosDeDocumentos<T extends { ruta: string }>(archivos: T[]): { archivo: T; titulo: string }[] {
  const partes = (r: string) => r.split('/');
  const nombre = (r: string) => (partes(r).at(-1) ?? r).replace(/\.[^.]+$/, '');
  const veces = new Map<string, number>();
  for (const a of archivos) veces.set(nombre(a.ruta).normalize('NFC'), (veces.get(nombre(a.ruta).normalize('NFC')) ?? 0) + 1);
  return [...archivos]
    .sort((a, b) => porNombre(a.ruta, b.ruta))
    .map((archivo) => {
      const n = nombre(archivo.ruta);
      const subcarpetas = partes(archivo.ruta).slice(1, -1).join('/');
      return { archivo, titulo: (veces.get(n.normalize('NFC')) ?? 0) > 1 && subcarpetas ? `${n} (${subcarpetas})` : n };
    });
}

/**
 * El libro de la biblioteca que ya es este archivo, si lo hay: el mismo formato y el mismo tamaño y, en un PDF, un título
 * que empieza por su nombre (el de un EPUB o un CBZ sale de dentro del libro). Así, importar otra vez una carpeta solo
 * trae lo nuevo.
 */
export function yaImportado(lista: ElementoBiblioteca[], nombre: string, tamano: number): ElementoBiblioteca | undefined {
  const formato = /\.pdf$/i.test(nombre) ? 'pdf' : /\.cbz$/i.test(nombre) ? 'cbz' : /\.epub$/i.test(nombre) ? 'epub' : null;
  if (!formato) return undefined;
  const base = nombre.replace(/\.[^.]+$/, '').normalize('NFC');
  return lista.find((e) => e.documento?.formato === formato && e.documento.tamano === tamano && (formato !== 'pdf' || e.titulo.normalize('NFC').startsWith(base)));
}

export function coleccionesDeImportados(importados: Importado[], existentes: ColeccionBiblioteca[]): PlanColecciones {
  const grupos = new Map<string, Importado[]>();
  for (const i of importados) {
    if (!i.carpeta) continue;
    grupos.set(i.carpeta, [...(grupos.get(i.carpeta) ?? []), i]);
  }
  const plan: PlanColecciones = { nuevas: [], anadir: [] };
  for (const [carpeta, libros] of grupos) {
    const nombre = nombreDeCarpeta(carpeta);
    if (!nombre) continue;
    const ids = libros.map((l) => l.id);
    const ya = existentes.find((c) => mismoNombre(c.nombre, nombre));
    const nueva = plan.nuevas.find((n) => mismoNombre(n.nombre, nombre));
    if (ya) plan.anadir.push({ coleccion: ya.id, libros: ids });
    else if (nueva) nueva.libros.push(...ids);
    else if (libros.length >= 2) plan.nuevas.push({ nombre, ...(libros.every((l) => l.rtl) ? { tipo: 'manga' as const } : {}), libros: ids });
  }
  return plan;
}
