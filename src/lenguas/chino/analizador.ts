// El análisis del chino. Las palabras salen de los diccionarios instalados y de la lista de frecuencia (ver tokens.ts), y
// la lectura en contexto, de pinyin-pro (MIT): sabe que en 银行 el 行 es háng y que en 睡着 el 着 es zháo. pinyin-pro y las
// tablas de OpenCC van aparte, en chino.js (ver bibliotecas.ts), y solo se cargan si se estudia chino.

import type { Analizador } from '../tipos';
import { normalizarPinyin } from './pinyin';
import { analizarChino } from './tokens';

/** Lo que trae chino.js. */
export interface BibliotecasChino {
  /** La sílaba de cada carácter de un texto, leída en su frase. */
  pinyin(texto: string): string[];
  pinyinDeCaracter(caracter: string): string;
  /** Las palabras que pinyin-pro conoce por su lectura especial (银行, 睡着): para cuando aún no hay diccionarios. */
  segmentar(texto: string): string[];
  /** De caracteres tradicionales a simplificados. */
  simplificar(texto: string): string;
}

declare global {
  // Lo deja ahí bibliotecas.ts, que se empaqueta como un script aparte.
  // eslint-disable-next-line no-var
  var kkChino: BibliotecasChino | undefined;
}

let cargando: Promise<void> | null = null;

/** Lo pone chino.js al cargarse, o a mano quien ya las tiene: las pruebas, por ejemplo. */
export function fijarBibliotecas(b: BibliotecasChino) {
  globalThis.kkChino = b;
}

/** La sílaba de cada ideograma, leída en su frase. */
function enContexto(ideogramas: string): string[] {
  const b = globalThis.kkChino!;
  const caracteres = [...ideogramas];
  const silabas = b.pinyin(ideogramas);
  // Con caracteres fuera del plano básico, pinyin-pro puede contar distinto: entonces, uno a uno.
  if (silabas.length === caracteres.length) return silabas;
  return caracteres.map((c) => b.pinyinDeCaracter(c));
}

export const ANALIZADOR: Analizador = {
  // Sin los términos de los diccionarios, el texto saldría carácter a carácter.
  terminosOpcionales: false,
  listo: () => !!globalThis.kkChino,
  cargar() {
    if (globalThis.kkChino) return Promise.resolve();
    cargando ??= new Promise((ok, mal) => {
      const s = document.createElement('script');
      s.src = 'chino.js';
      s.onload = () => ok();
      s.onerror = () => {
        cargando = null;
        mal(new Error('No se pudo cargar el analizador de chino'));
      };
      document.head.appendChild(s);
    });
    return cargando;
  },
  analizar: (texto, existe, consultas) => analizarChino(texto, enContexto, existe, consultas, (ideogramas) => globalThis.kkChino!.segmentar(ideogramas)),
  // El chino no se conjuga: la palabra es su propia forma de diccionario, y su lectura, la de pinyin-pro.
  lecturaDeLema: (lema) => normalizarPinyin(enContexto(lema).join(' ')),
};

/** El texto en caracteres simplificados, si ya están cargadas las tablas (se cargan con el analizador, antes de analizar). */
export const simplificar = (texto: string): string => globalThis.kkChino?.simplificar(texto) ?? texto;
