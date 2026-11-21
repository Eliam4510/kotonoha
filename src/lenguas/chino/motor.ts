// Lo que pesa más del chino. Solo lo cargan el motor y la ventana de la aplicación, nunca las páginas. pinyin-pro y las
// tablas de OpenCC, aún más pesados, van aparte en chino.js y se cargan con el analizador (ver bibliotecas.ts).

import type { MotorLengua } from '../tipos';
import { ANALIZADOR, simplificar } from './analizador';
import { audiosChino } from './audio';
import { FUENTES, SECCIONES_OMITIDAS } from './diccionarios';
import { detectarGramatica, puntosGramatica } from './gramatica';
import { normalizarPinyin } from './pinyin';
import { PROMPTS_CHINO } from './prompts';
import { REGLAS_TRANSCRIPCION } from './transcripcion';

/**
 * Cada definición de CC-CEDICT, como se enseña aquí: de las referencias en dos escrituras (個｜个) queda la simplificada,
 * y el clasificador («CL:家,個｜个») se escribe como en clase: 量词：家、个.
 */
export function limpiarGlosa(glosa: string): string {
  return glosa
    .replace(/(\p{Script=Han}+)｜(\p{Script=Han}+)/gu, '$2')
    .replace(/^CL:\s*/, '量词：')
    .replace(/(?<=\p{Script=Han}),\s*(?=\p{Script=Han})/gu, '、');
}

/** La parte de una definición que cabe bajo una palabra: «bank (financial institution)» se queda en «bank». */
export function recortarGlosa(glosa: string): string {
  // Las notas de CC-CEDICT van entre paréntesis, a veces varias seguidas («(third-person singular) (since the early 20th
  // century, usu. male) he»), o son el clasificador («CL:…»): no son la traducción.
  const sinNota = glosa.replace(/^(\([^)]*\)\s*)+/, '');
  const primera = sinNota.split(/[;；,，(]/)[0].trim();
  return primera || glosa.trim();
}

export const MOTOR_CHINO: MotorLengua = {
  analizador: ANALIZADOR,
  detectarGramatica,
  gramaticaAnki: { puntos: puntosGramatica, formas: { colas: [''] } },
  prompts: PROMPTS_CHINO,
  transcripcion: { idioma: 'chinese', reglas: REGLAS_TRANSCRIPCION },
  diccionarios: FUENTES,
  audios: audiosChino,
  recortarGlosa,
  // La lectura de cada palabra es la del diccionario, y la frecuencia decide cómo partir el texto.
  lecturasDeDiccionario: true,
  // Todas las lecturas, como las escribe CC-CEDICT: nǐhǎo, y no nǐ hǎo como Wiktionary.
  normalizarLectura: normalizarPinyin,
  limpiarGlosa,
  // Las pistas en tradicionales y lo que transcribe Whisper, que mezcla las dos, se ven y se analizan en simplificados.
  normalizarTexto: simplificar,
  seccionesOmitidas: SECCIONES_OMITIDAS,
};
