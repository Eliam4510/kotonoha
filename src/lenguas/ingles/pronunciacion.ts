// La pronunciación de cada palabra sale de Wiktionary, que da muchas: de cada país, de cada región y hasta de otras
// épocas. Aquí se elige una americana y una británica, y dónde cae el acento. Lógica pura.

import type { PronunciacionImportada } from '../../nucleo/yomitan';
import type { Transcripcion } from '../tipos';

const INGLATERRA = '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}';
const ES_DE_EEUU = new Set(['🇺🇸', 'General-American', 'US', 'California']);
const ES_BRITANICA = new Set(['🇬🇧', INGLATERRA, 'British', 'RP', 'Received-Pronunciation', 'UK', 'London']);
/** Lo que no es lo que se quiere enseñar: formas débiles, dialectos, otras notaciones y la pronunciación del plural. */
const DESCARTAR = /SAMPA|^XS$|dialect|weak|unstress|North|Midlands|Scot|Irish|India|Africa|South|Early|Modern|archaic|obsolete|dated|rare|uncommon|uncmmn|colloquial|non-rhotic|without|merger|raising|fronting|^pl$|Local|Upper|^some/i;

interface Candidata {
  ipa: string;
  tags: string[];
}

/** Una notación legible: entre barras o corchetes, sin mayúsculas de otras notaciones ni variantes con tilde. */
const esLegible = (ipa: string) => /^(\/[^/]+\/|\[[^\]]+\])$/.test(ipa) && !/[A-Z"@~^]/.test(ipa);

/**
 * Como en los diccionarios para estudiantes. Wiktionary anota detalles de la pronunciación real que aquí despistan: la
 * aspiración, la t que suena casi como una r en americano, los puntos de sílaba, y la r escrita como ɹ.
 */
function limpiar(ipa: string): string {
  const cuerpo = ipa
    .slice(1, -1)
    .replace(/[.ʰʷ̯̝̠̪̟̚͡]/g, '')
    .replace(/ɾ/g, 't')
    .replace(/ɫ/g, 'l')
    .replace(/ε/g, 'ɛ')
    .replace(/ɹ/g, 'r');
  const palabraSola = !/\s/.test(cuerpo);
  // En una palabra de una sílaba no hay dónde más cargar el acento: marcarlo no dice nada.
  const sinAcento = palabraSola && (cuerpo.match(VOCALES)?.length ?? 0) < 2 ? cuerpo.replace(/[ˈˌ]/g, '') : cuerpo;
  return `/${sinAcento}/`;
}

/** La primera que valga: Wiktionary pone delante las de su edición en inglés, que son las más cuidadas. */
function mejorDe(lista: Candidata[], esDeZona: (t: string) => boolean): string | undefined {
  return lista.find((t) => esLegible(t.ipa) && t.tags.some(esDeZona) && !t.tags.some((x) => DESCARTAR.test(x)))?.ipa;
}

export function elegirTranscripciones(lista: Candidata[]): Transcripcion[] {
  const salida: Transcripcion[] = [];
  const us = mejorDe(lista, (t) => ES_DE_EEUU.has(t));
  const uk = mejorDe(lista, (t) => ES_BRITANICA.has(t));
  if (us) salida.push({ zona: 'us', ipa: limpiar(us) });
  if (uk) salida.push({ zona: 'uk', ipa: limpiar(uk) });
  if (salida.length) return salida;
  // Sin zona, vale la primera legible que no sea una rareza.
  const una = lista.find((t) => esLegible(t.ipa) && !t.tags.some((x) => DESCARTAR.test(x)))?.ipa;
  return una ? [{ zona: 'us', ipa: limpiar(una) }] : [];
}

const VOCALES = /[aeiouyæɑɒɔəɛɜɪʊʌɚɝʉɐɘɵɨøœɯɤ]+/g;

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

/** Sobre las palabras se guardan las dos, y se elige al escribirla: así cambiar de una a otra no obliga a analizar de nuevo. */
export const dePronunciacion = (t: Transcripcion[]) => `${t.find((x) => x.zona === 'us')?.ipa ?? ''}|${t.find((x) => x.zona === 'uk')?.ipa ?? ''}`;

export function lecturaVisible(lectura: string, formato: string | undefined): string {
  const [us, uk] = lectura.split('|');
  return (formato === 'uk' ? uk || us : us || uk) ?? lectura;
}
