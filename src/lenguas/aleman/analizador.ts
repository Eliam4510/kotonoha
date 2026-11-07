// El análisis del alemán. No necesita un modelo aparte: las palabras salen del texto, y su forma de diccionario, de los
// diccionarios instalados (ver tokens.ts).

import type { Analizador, ConsultasAnalisis, TokenUnido } from '../tipos';
import { analizarAleman, lemaDe, PREFIJOS_SEPARABLES } from './tokens';

export const ANALIZADOR: Analizador = {
  // Sin las formas de los diccionarios, cada palabra sería su propia forma de diccionario: ging no llevaría a gehen.
  terminosOpcionales: false,
  listo: () => true,
  cargar: () => Promise.resolve(),
  analizar: analizarAleman,
  // La palabra es su propia lectura: la pronunciación se guarda aparte.
  lecturaDeLema: (lema) => lema,
};

/** A Claude se le enseña de qué forma de diccionario sale cada palabra, para que pueda corregirla: ging(gehen). */
export function describirPalabra(t: TokenUnido): string {
  return t.lema.toLocaleLowerCase('de') === t.superficie.toLocaleLowerCase('de') ? t.superficie : `${t.superficie}(${t.lema})`;
}

/** Hasta dónde llega la oración de la palabra: un verbo separable deja su partícula al final, antes del signo. */
const FIN_DE_ORACION = /[.,;:!?]/;
const DISTANCIA_MAXIMA = 12;

/**
 * Qué términos buscar a partir de una palabra. Un verbo separable deja la partícula al final de la oración (fängt … an)
 * y en el diccionario va delante (anfangen). Y lo que viene detrás tal cual, por las frases hechas (zum Beispiel).
 */
export function candidatosCompuestos(superficies: string[], existe?: (termino: string) => boolean, consultas?: ConsultasAnalisis): string[] {
  const oracion: string[] = [];
  for (const s of superficies) {
    if (FIN_DE_ORACION.test(s) && oracion.length) break;
    if (/\p{L}/u.test(s)) oracion.push(s);
  }
  if (oracion.length < 2) return [];
  const [primera, ...siguientes] = oracion;
  const salida = new Set<string>();
  // Primero lo más largo: auf jeden Fall antes que auf jeden.
  for (let n = Math.min(siguientes.length, 4); n >= 1; n--) salida.add(`${primera} ${siguientes.slice(0, n).join(' ')}`);
  const { lema } = lemaDe(primera, false, existe, consultas);
  const verbo = lema.toLocaleLowerCase('de');
  // La partícula más lejana es la buena: en «fängt mit der Arbeit an», la de verdad es la última.
  for (const p of siguientes.slice(0, DISTANCIA_MAXIMA).reverse()) {
    const particula = p.toLocaleLowerCase('de');
    if (PREFIJOS_SEPARABLES.has(particula)) salida.add(`${particula}${verbo}`);
  }
  return [...salida];
}
