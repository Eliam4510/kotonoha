// Base de datos local (IndexedDB con Dexie).

import Dexie, { type Table } from 'dexie';
import type { AnalisisLinea } from '../nucleo/analisisProfundo';
import type { FilaConsumo } from '../nucleo/precios';
import type { Linea } from '../nucleo/subtitulos';
import type { ElementoBiblioteca, EstadoPalabra, InfoDiccionario, TarjetaMemoria } from '../compartido/tipos';
import type { Transcripcion } from '../lenguas/tipos';
import type { DatosTrazos } from '../nucleo/trazos';

export interface FilaTermino {
  id?: number;
  dic: string;
  termino: string;
  lectura: string;
  tags: string;
  reglas: string;
  puntuacion: number;
  glosas: string[];
  seq: number;
}

export interface FilaFrecuencia {
  dic: string;
  termino: string;
  lectura: string;
  rango: number;
  texto?: string;
}

export interface FilaAcento {
  /** Cómo se pronuncia, en las lenguas donde se guarda aparte de la palabra. */
  transcripciones?: Transcripcion[];
  termino: string;
  lectura: string;
  posiciones: number[];
}

export interface FilaPalabraDb {
  clave: string;
  lema: string;
  lectura: string;
  estado: EstadoPalabra;
  rastreada: 0 | 1;
  creada: number;
  actualizada: number;
}

export interface FilaFrase {
  id: string; // Hash del texto
  texto: string;
  lemas: string[];
  fuente?: string;
  url?: string;
  inicio?: number;
  creada: number;
}

export interface FilaCacheIA {
  clave: string;
  texto: string;
  creada: number;
}

export interface FilaSubtitulosGenerados {
  clave: string; // idVideo|idioma
  idVideo: string;
  idioma: string;
  lineas: Linea[];
  /** De dónde salió: whisper, claude, importada o recordada. */
  origen?: string;
  creado: number;
}

/** Lo que Claude corrigió de una pista automática, por id de línea. Así no se vuelve a pagar. */
export interface FilaCorrecciones {
  clave: string; // idVideo|idPista
  cambios: Record<number, string>;
  completa: boolean;
  creado: number;
}

/** Lo que Claude averiguó de una línea. Se guarda por texto: sirve para cualquier video que la repita. */
export interface FilaAnalisis extends AnalisisLinea {
  clave: string;
  creado: number;
}

export interface FilaGlosa {
  clave: string;
  glosa: string;
}

/** Trazos de un carácter ya descargados. Sin datos: KanjiVG no lo tiene, y no hace falta volver a preguntar. */
export interface FilaTrazos {
  caracter: string;
  datos: DatosTrazos | null;
}

class BaseKotonoha extends Dexie {
  diccionarios!: Table<InfoDiccionario, string>;
  terminos!: Table<FilaTermino, number>;
  frecuencias!: Table<FilaFrecuencia, [string, string, string]>;
  acentos!: Table<FilaAcento, [string, string]>;
  palabras!: Table<FilaPalabraDb, string>;
  frases!: Table<FilaFrase, string>;
  cacheIA!: Table<FilaCacheIA, string>;
  glosas!: Table<FilaGlosa, string>;
  biblioteca!: Table<ElementoBiblioteca, string>;
  memoria!: Table<TarjetaMemoria, string>;
  generados!: Table<FilaSubtitulosGenerados, string>;
  analisis!: Table<FilaAnalisis, string>;
  correcciones!: Table<FilaCorrecciones, string>;
  consumo!: Table<FilaConsumo, number>;
  trazos!: Table<FilaTrazos, string>;

  constructor(nombre: string) {
    super(nombre);
    this.version(1).stores({
      diccionarios: 'id, orden, tipo',
      terminos: '++id, termino, lectura, dic',
      frecuencias: '[dic+termino+lectura], dic, termino',
      acentos: '[termino+lectura], termino',
      palabras: 'clave, estado, lema, actualizada, rastreada',
      frases: 'id, *lemas, creada',
      cacheIA: 'clave, creada',
      glosas: 'clave',
      biblioteca: 'id, creado',
      memoria: 'id, vence, mazo',
      generados: 'clave, idVideo',
    });
    this.version(2).stores({ analisis: 'clave' });
    this.version(3).stores({ correcciones: 'clave' });
    this.version(4).stores({ consumo: '++id, mes, t' });
    this.version(5).stores({ trazos: 'caracter' });
  }
}

/**
 * Cada lengua tiene su propia base: sus palabras, diccionarios y tarjetas no se pueden mezclar con los de otra, aunque
 * se escriban igual, y quitar una lengua es borrar su base. La del japonés conserva el nombre de la primera versión:
 * cambiarlo dejaría atrás los diccionarios y palabras ya guardados.
 */
export const nombreBase = (idLengua: string) => (idLengua === 'ja' ? 'kikitori' : `kikitori-${idLengua}`);

const bases = new Map<string, BaseKotonoha>();

export function baseDe(idLengua: string): BaseKotonoha {
  let base = bases.get(idLengua);
  if (!base) {
    base = new BaseKotonoha(nombreBase(idLengua));
    bases.set(idLengua, base);
  }
  return base;
}

/** Si esa lengua se ha usado alguna vez. Preguntarlo no crea su base, a diferencia de abrirla. */
export const existeBaseDe = (idLengua: string) => Dexie.exists(nombreBase(idLengua));

/** Lo que no depende de la lengua, como lo gastado en Claude, está siempre en la base original. */
export const baseGeneral = baseDe('ja');

/** La base de la lengua que se estudia. */
export let db = baseGeneral;

export function usarBaseDe(idLengua: string) {
  db = baseDe(idLengua);
}
