// Lo que pesa más del inglés. Solo lo cargan el motor y la ventana de la aplicación, nunca las páginas.

import type { FrecuenciaImportada } from '../../nucleo/yomitan';
import type { MotorLengua } from '../tipos';
import { ANALIZADOR, candidatosCompuestos, describirPalabra } from './analizador';
import { audiosIngles } from './audio';
import { FUENTES, SECCIONES_OMITIDAS } from './diccionarios';
import { detectarGramatica } from './gramatica';
import { PROMPTS_INGLES } from './prompts';
import { filaPronunciacion } from './pronunciacion';
import { REGLAS_TRANSCRIPCION } from './transcripcion';

/**
 * La lista cuenta cada forma por separado (go, went, going): aquí se queda cada palabra una vez, con su forma de
 * diccionario, en el puesto de la forma más frecuente. Lo que no son palabras, como «'s» o «a.d.a.», se descarta.
 */
export async function prepararFrecuencias(filas: FrecuenciaImportada[]): Promise<FrecuenciaImportada[]> {
  await ANALIZADOR.cargar();
  const vistas = new Set<string>();
  const salida: FrecuenciaImportada[] = [];
  for (const f of filas) {
    if (!/^\p{L}[\p{L}']*$/u.test(f.termino)) continue;
    const lema = ANALIZADOR.analizar(f.termino).find((t) => t.esPalabra)?.lema ?? f.termino;
    if (vistas.has(lema)) continue;
    vistas.add(lema);
    salida.push({ termino: lema, lectura: lema, rango: salida.length + 1 });
  }
  return salida;
}

/** La parte de una definición que cabe bajo una palabra: «Conocer, saber.» se queda en «conocer». */
export function recortarGlosa(glosa: string): string {
  // Una nota al principio no es la traducción; lo que venga después de la primera, sobra.
  const primera = glosa.replace(/^\([^)]*\)\s*/, '').split(/[;,.(]/)[0].trim();
  const corta = primera || glosa.trim();
  return corta.charAt(0).toLocaleLowerCase() + corta.slice(1);
}

const CATEGORIAS: Record<string, string> = { VERB: 'v', AUX: 'v', NOUN: 'n', PROPN: 'n', ADJ: 'adj', ADV: 'adv' };

export const MOTOR_INGLES: MotorLengua = {
  analizador: ANALIZADOR,
  detectarGramatica,
  prompts: PROMPTS_INGLES,
  transcripcion: { idioma: 'english', reglas: REGLAS_TRANSCRIPCION },
  diccionarios: FUENTES,
  audios: audiosIngles,
  candidatosCompuestos,
  describirPalabra,
  recortarGlosa,
  // Tell como verbo es decir; como sustantivo, un montículo: la traducción tiene que ser de la categoría de la palabra.
  encajaCategoria: (reglas, categoria) => reglas === (CATEGORIAS[categoria] ?? ''),
  prepararFrecuencias,
  seccionesOmitidas: SECCIONES_OMITIDAS,
  filaPronunciacion,
};
