// Del texto a las palabras que ve el programa, en alemán. Lógica pura.
//
// No hay un analizador que sepa qué es cada palabra en su frase, como el del inglés. Lo sabe el diccionario: Wiktionary
// recoge cada forma conjugada o declinada y de qué palabra sale (ging de gehen, Häuser de Haus). Cuando una forma
// puede salir de dos (schönen: el verbo, o el adjetivo schön), gana la más frecuente.

import { tm, tr } from '../../compartido/i18n';
import type { ConsultasAnalisis, FormaFlexionada, TokenUnido } from '../tipos';

/** Palabras que hacen de engranaje: se dan por conocidas para que no ahoguen a las demás. Van por su forma de diccionario. */
const GRAMATICALES = new Set([
  // Artículos y determinantes
  'der', 'die', 'das', 'ein', 'eine', 'kein', 'dieser', 'jener', 'jeder', 'welcher', 'mancher', 'alle',
  // Pronombres y posesivos
  'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'Sie', 'man', 'sich', 'mein', 'dein', 'sein', 'unser', 'euer', 'Ihr', 'wer', 'was',
  // Preposiciones
  'an', 'auf', 'aus', 'bei', 'bis', 'durch', 'für', 'gegen', 'hinter', 'in', 'mit', 'nach', 'neben', 'ohne', 'seit', 'über', 'um', 'unter', 'von',
  'vor', 'während', 'wegen', 'zu', 'zwischen', 'am', 'im', 'ins', 'zum', 'zur', 'vom', 'beim', 'ans', 'aufs',
  // Conjunciones
  'und', 'oder', 'aber', 'denn', 'sondern', 'dass', 'weil', 'wenn', 'als', 'ob', 'damit', 'obwohl', 'sowie',
  // Auxiliares y modales
  'sein', 'haben', 'werden', 'können', 'müssen', 'sollen', 'wollen', 'dürfen', 'mögen',
  // Partículas
  'nicht', 'ja', 'nein', 'doch', 'so', 'auch', 'noch', 'schon', 'nur', 'zu',
]);

/** Las partículas de los verbos separables: se escriben aparte en la frase (fängt … an) y juntas en el diccionario. */
export const PREFIJOS_SEPARABLES = new Set([
  'ab', 'an', 'auf', 'aus', 'bei', 'ein', 'fest', 'fort', 'her', 'heraus', 'herein', 'herum', 'hin', 'hinaus', 'hinein', 'los', 'mit', 'nach',
  'vor', 'voran', 'vorbei', 'weg', 'weiter', 'zu', 'zurück', 'zusammen', 'um', 'durch', 'über', 'wieder', 'dar', 'kennen', 'statt', 'teil',
]);

/** Palabras con letras, y dentro, apóstrofos o guiones: gibt's, E-Mail. */
const PALABRA = /\p{L}[\p{L}\p{M}]*(?:['’-]\p{L}[\p{L}\p{M}]*)*/gu;

function noEsPalabra(superficie: string, categoria = 'PUNCT'): TokenUnido {
  return { superficie, lema: superficie, lectura: '', categoria, esPalabra: false, esGramatica: false, flexion: [], furigana: [{ texto: superficie }], inflexionado: false };
}

const CATEGORIAS: Record<string, string> = { v: 'VERB', n: 'NOUN', adj: 'ADJ' };

/** El nombre corto de una flexión, a partir de la descripción de Wiktionary: «first/third-person singular preterite». */
export function colasDe(descripcion: string): string[] {
  const d = descripcion.toLowerCase();
  const colas: string[] = [];
  if (/past participle/.test(d)) colas.push('Partizip II');
  else if (/present participle/.test(d)) colas.push('Partizip I');
  else if (/\bzu-infinitive\b/.test(d)) colas.push('zu + Infinitiv');
  if (/subjunctive ii/.test(d)) colas.push('Konjunktiv II');
  else if (/subjunctive i\b/.test(d)) colas.push('Konjunktiv I');
  else if (/preterite|\bpast\b/.test(d) && !colas.includes('Partizip II')) colas.push('Präteritum');
  else if (/imperative/.test(d)) colas.push('Imperativ');
  else if (/present/.test(d) && !colas.includes('Partizip I')) colas.push('Präsens');
  if (/comparative/.test(d)) colas.push('Komparativ');
  if (/superlative/.test(d)) colas.push('Superlativ');
  if (/plural/.test(d) && !/singular/.test(d)) colas.push('Plural');
  if (/genitive/.test(d) && !/nominative|accusative|dative/.test(d)) colas.push('Genitiv');
  if (/dative/.test(d) && !/nominative|accusative|genitive/.test(d)) colas.push('Dativ');
  return colas;
}

/** En la ficha se ve el nombre alemán de la forma, el de las gramáticas, y a su lado qué es en el idioma de la interfaz. */
const NOMBRES_FLEXION: Record<string, string> = {
  'Partizip II': tm('participio'),
  'Partizip I': tm('participio de presente'),
  'zu + Infinitiv': tm('infinitivo con zu'),
  Präteritum: tm('pretérito'),
  Präsens: tm('presente'),
  Imperativ: tm('imperativo'),
  'Konjunktiv I': tm('subjuntivo I'),
  'Konjunktiv II': tm('subjuntivo II'),
  Komparativ: tm('comparativo'),
  Superlativ: tm('superlativo'),
  Plural: tm('plural'),
  Genitiv: tm('genitivo'),
  Dativ: tm('dativo'),
};

export function nombreFlexion(cola: string): string | undefined {
  return tr(NOMBRES_FLEXION[cola] ?? tm('forma declinada o conjugada'));
}

interface Candidata {
  lema: string;
  forma?: FormaFlexionada;
}

/**
 * Las palabras más frecuentes en las que el diccionario no ayuda a decidir: Wiktionary da «die» como forma de cinco
 * artículos, y «sein» y «war» como palabras propias además de formas de sein. Se resuelven como los lematizadores del
 * alemán: los artículos van a der y a ein, y las formas de sein, a sein.
 */
const LEMAS_FIJOS: Record<string, string> = {
  der: 'der', die: 'der', das: 'der', den: 'der', dem: 'der', des: 'der',
  ein: 'ein', eine: 'ein', einen: 'ein', einem: 'ein', einer: 'ein', eines: 'ein',
  kein: 'kein', keine: 'kein', keinen: 'kein', keinem: 'kein', keiner: 'kein', keines: 'kein',
  sein: 'sein', bin: 'sein', bist: 'sein', ist: 'sein', sind: 'sein', seid: 'sein', war: 'sein', warst: 'sein', waren: 'sein', wart: 'sein',
  wäre: 'sein', wärst: 'sein', wären: 'sein', gewesen: 'sein',
};

/**
 * Cuánto más frecuente tiene que ser la palabra de la que sale una forma para ganarle a la forma como palabra propia:
 * schönen le gana al verbo schönen, pero bekannt sigue siendo el adjetivo y no el participio de bekennen.
 */
const VENTAJA_DE_LA_FORMA = 3;

/**
 * De qué palabra del diccionario sale una forma. `inicio` dice si abre la frase: ahí la mayúscula no indica un sustantivo.
 * Sin diccionarios, cada palabra es su propia forma de diccionario.
 */
export function lemaDe(superficie: string, inicio: boolean, existe?: (termino: string) => boolean, consultas?: ConsultasAnalisis): Candidata {
  const minuscula = superficie.toLocaleLowerCase('de');
  const todaMayuscula = superficie.length > 1 && superficie === superficie.toLocaleUpperCase('de');
  const capitalizada = superficie.charAt(0) + superficie.slice(1).toLocaleLowerCase('de');
  // En mayúsculas o al principio de la frase, la palabra puede ser cualquiera de sus formas escritas. Al principio va
  // antes la minúscula: si las dos existen, como gestern y das Gestern, la mayúscula solo la puso el comienzo de la frase.
  const variantes = [...new Set(todaMayuscula ? [capitalizada, minuscula] : inicio ? [minuscula, superficie] : [superficie])];
  const fijo = LEMAS_FIJOS[minuscula];
  if (fijo) return { lema: fijo, forma: variantes.flatMap((v) => consultas?.formas?.(v) ?? []).find((f) => f.lema === fijo) };
  const propias: Candidata[] = [];
  const deFormas: Candidata[] = [];
  for (const v of variantes) {
    if (existe?.(v)) propias.push({ lema: v });
    for (const f of consultas?.formas?.(v) ?? []) deFormas.push({ lema: f.lema, forma: f });
  }
  // Sin nada en los diccionarios, la palabra es su propia forma. En mayúsculas se deja con la inicial, como un sustantivo.
  if (!propias.length && !deFormas.length) return { lema: todaMayuscula ? capitalizada : superficie };
  const rango = (c: Candidata) => consultas?.rango?.(c.lema) ?? Number.MAX_SAFE_INTEGER;
  const mejor = (lista: Candidata[]) => lista.reduce<Candidata | undefined>((m, c) => (!m || rango(c) < rango(m) ? c : m), undefined);
  const propia = mejor(propias);
  const deForma = mejor(deFormas);
  if (!propia || !deForma) return (propia ?? deForma)!;
  // La palabra tal cual gana salvo que aquella de la que es forma sea bastante más frecuente. Sin frecuencias, gana ella.
  return rango(deForma) * VENTAJA_DE_LA_FORMA < rango(propia) ? deForma : propia;
}

function palabra(superficie: string, inicio: boolean, existe?: (termino: string) => boolean, consultas?: ConsultasAnalisis): TokenUnido {
  const { lema, forma } = lemaDe(superficie, inicio, existe, consultas);
  const mayuscula = /^\p{Lu}/u.test(lema);
  const categoria = forma?.pos ? (CATEGORIAS[forma.pos] ?? 'X') : mayuscula ? 'NOUN' : 'X';
  return {
    superficie,
    lema,
    // Aquí la lectura no distingue nada: la palabra es su propia lectura, como la de una palabra en kana.
    lectura: lema,
    categoria,
    esPalabra: true,
    esGramatica: GRAMATICALES.has(lema) || GRAMATICALES.has(lema.toLocaleLowerCase('de')),
    flexion: forma ? colasDe(forma.flexion) : [],
    furigana: [{ texto: superficie }],
    inflexionado: false,
  };
}

/**
 * Parte el texto en palabras y lo que hay entre ellas. Las superficies juntas reproducen el texto tal cual, porque de eso
 * depende que el lector encuentre cada palabra.
 */
export function analizarAleman(texto: string, existe?: (termino: string) => boolean, consultas?: ConsultasAnalisis): TokenUnido[] {
  const salida: TokenUnido[] = [];
  let pos = 0;
  for (const m of texto.matchAll(PALABRA)) {
    const i = m.index;
    if (i > pos) salida.push(noEsPalabra(texto.slice(pos, i), /\S/.test(texto.slice(pos, i)) ? 'PUNCT' : 'SPACE'));
    salida.push(palabra(m[0], esInicioDeFrase(salida), existe, consultas));
    pos = i + m[0].length;
  }
  if (pos < texto.length) salida.push(noEsPalabra(texto.slice(pos), /\S/.test(texto.slice(pos)) ? 'PUNCT' : 'SPACE'));
  return salida;
}

/** Si la próxima palabra abre una frase: al principio del texto, o tras un punto, una interrogación o unas comillas. */
function esInicioDeFrase(previos: TokenUnido[]): boolean {
  for (let i = previos.length - 1; i >= 0; i--) {
    const t = previos[i];
    if (t.esPalabra) return false;
    if (/[.!?:]/.test(t.superficie)) return true;
    if (/[„“"«»‚‘]/.test(t.superficie)) return true;
  }
  return true;
}

const SIGNOS_DE_CIERRE = /^[,.!?;:)\]"“”’‘«»…]/u;
const SIGNOS_DE_APERTURA = /[(["„‚»«]$/u;
const UNIR = '⁠';

/** Cada palabra se pinta como un bloque, y entre bloques el navegador puede cortar la línea: una coma no debe quedar sola. */
export function pegarSignos(signos: string): string {
  const conCierre = SIGNOS_DE_CIERRE.test(signos) ? `${UNIR}${signos}` : signos;
  return SIGNOS_DE_APERTURA.test(conCierre) ? `${conCierre}${UNIR}` : conCierre;
}
