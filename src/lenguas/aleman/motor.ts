// Lo que pesa más del alemán. Solo lo cargan el motor y la ventana de la aplicación, nunca las páginas.

import type { MotorLengua } from '../tipos';
import { ANALIZADOR, candidatosCompuestos, describirPalabra } from './analizador';
import { audiosAleman } from './audio';
import { FUENTES, SECCIONES_OMITIDAS } from './diccionarios';
import { detectarGramatica, puntosGramatica } from './gramatica';
import { PROMPTS_ALEMAN } from './prompts';
import { filaPronunciacion } from './pronunciacion';
import { REGLAS_TRANSCRIPCION } from './transcripcion';

/** La parte de una definición que cabe bajo una palabra: «to go, to walk» se queda en «to go». */
export function recortarGlosa(glosa: string): string {
  // Una nota al principio no es la traducción; lo que venga después de la primera, sobra.
  const primera = glosa.replace(/^\([^)]*\)\s*/, '').split(/[;,.(]/)[0].trim();
  const corta = primera || glosa.trim();
  return corta.charAt(0).toLocaleLowerCase() + corta.slice(1);
}

const CATEGORIAS: Record<string, string> = { VERB: 'v', NOUN: 'n', ADJ: 'adj' };

export const MOTOR_ALEMAN: MotorLengua = {
  analizador: ANALIZADOR,
  detectarGramatica,
  gramaticaAnki: { puntos: puntosGramatica, formas: { colas: [''] } },
  prompts: PROMPTS_ALEMAN,
  transcripcion: { idioma: 'german', reglas: REGLAS_TRANSCRIPCION },
  diccionarios: FUENTES,
  audios: audiosAleman,
  candidatosCompuestos,
  describirPalabra,
  recortarGlosa,
  // Essen como sustantivo es la comida; essen, el verbo: la traducción tiene que ser de la categoría de la palabra.
  encajaCategoria: (reglas, categoria) => reglas === (CATEGORIAS[categoria] ?? ''),
  // La forma de cada palabra flexionada viene en los diccionarios: con ella se sabe que ging es de gehen.
  formasDeDiccionario: true,
  seccionesOmitidas: SECCIONES_OMITIDAS,
  filaPronunciacion,
};
