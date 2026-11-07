// La pronunciación de cada palabra sale de Wiktionary, que reúne la de varias ediciones: la del plural, la de cada región
// y otras notaciones. Aquí se elige la estándar de la palabra misma, y dónde cae el acento. Lógica pura.

import type { PronunciacionImportada } from '../../nucleo/yomitan';
import type { Transcripcion } from '../tipos';

/** Lo que no es lo que se quiere enseñar: las variantes regionales, otras notaciones y las rarezas. */
const DESCARTAR = /SAMPA|^XS$|rare|uncmmn|altmod|less often|dialect|colloquial|obsolete|dated|Southern|Northern|Bavarian|Swabian|Austria|Swiss|🇦🇹|🇨🇭|regio|BY$|⬆|⬅|➡|⬇/i;
/** La del plural, si no vale también para el singular: Haus se pronuncia [haʊs], no como Häuser. */
const esDelPlural = (tags: string[]) => tags.includes('pl') && !tags.includes('Sing');

interface Candidata {
  ipa: string;
  tags: string[];
}

/** Una notación legible: entre barras o corchetes, sin mayúsculas de otras notaciones, sin dudas ni comentarios. */
const esLegible = (ipa: string) => /^(\/[^/]+\/|\[[^\]]+\])$/.test(ipa) && !/[A-Z"@~^?()]/.test(ipa) && !/\s/.test(ipa.slice(1, -1).trim());

/**
 * Como en los diccionarios para estudiantes: sin los detalles de la pronunciación real que aquí despistan, como la marca
 * de diptongo, los puntos de sílaba o el golpe de glotis delante de la vocal inicial.
 */
function limpiar(ipa: string): string {
  const cuerpo = ipa
    .slice(1, -1)
    .trim()
    .replace(/[.̯͡ʰ]/g, '')
    .replace(/^(ˈ?)ʔ/, '$1')
    .replace(/'/g, 'ˈ')
    .replace(/g/g, 'ɡ');
  const silabas = cuerpo.match(VOCALES)?.length ?? 0;
  // En una palabra de una sílaba no hay dónde más cargar el acento: marcarlo no dice nada.
  return `/${silabas < 2 ? cuerpo.replace(/[ˈˌ]/g, '') : cuerpo}/`;
}

export function elegirTranscripciones(lista: Candidata[]): Transcripcion[] {
  // La primera que valga: Wiktionary pone delante las de su edición en inglés, que son las más cuidadas.
  const una = lista.find((t) => esLegible(t.ipa) && !esDelPlural(t.tags) && !t.tags.some((x) => DESCARTAR.test(x)));
  return una ? [{ zona: 'de', ipa: limpiar(una.ipa) }] : [];
}

const VOCALES = /[aeiouyäöüæɑɒɔəɛɜɪʊʌɐɘɵɨøœɯɤ]+/g;

/** En qué parte de la palabra cae el acento: 0 si no se puede decir o tiene una sola sílaba, 1 la primera, 2 en medio y 3 la última. */
export function codigoAcento(ipa: string): number {
  const limpio = ipa.replace(/[/[\]\s]/g, '');
  const acento = limpio.indexOf('ˈ');
  const total = limpio.match(VOCALES)?.length ?? 0;
  if (acento < 0 || total < 2) return 0;
  const antes = limpio.slice(0, acento).match(VOCALES)?.length ?? 0;
  if (antes === 0) return 1;
  return antes >= total - 1 ? 3 : 2;
}

export function filaPronunciacion(p: PronunciacionImportada) {
  const transcripciones = elegirTranscripciones(p.transcripciones);
  if (!transcripciones.length) return null;
  return { termino: p.termino, lectura: p.lectura, posiciones: [codigoAcento(transcripciones[0].ipa)], transcripciones };
}

const PATRONES: Record<number, string> = { 1: 'atamadaka', 2: 'nakadaka', 3: 'odaka' };

/** Reutiliza los colores del acento: lo que importa es dónde cae, no cómo se llame en cada lengua. */
export const patronAcento = (codigo: number): string | undefined => PATRONES[codigo];

export const dePronunciacion = (t: Transcripcion[]) => t[0]?.ipa ?? '';

export const lecturaVisible = (lectura: string) => lectura;
