// Base de datos local (IndexedDB con Dexie).

import Dexie, { type Table } from 'dexie';
import type { AnalisisLinea } from '../nucleo/analisisProfundo';
import type { Linea } from '../nucleo/subtitulos';
import type { ElementoBiblioteca, EstadoPalabra, InfoDiccionario, TarjetaMemoria } from '../compartido/tipos';

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

  constructor() {
    // Nombre de la primera versión. Cambiarlo dejaría atrás los diccionarios y palabras ya guardados.
    super('kikitori');
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
  }
}

export const db = new BaseKotonoha();
