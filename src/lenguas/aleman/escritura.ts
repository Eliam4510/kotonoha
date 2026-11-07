// Cómo se reconoce el alemán en un texto y dónde terminan sus frases. Lógica pura: se puede probar sin navegador.
//
// Como en inglés, el alfabeto apenas es pista: la ä, la ö, la ü y la ß ayudan, pero muchas frases no las llevan. Lo
// delatan sus palabras más frecuentes, elegidas entre las que casi no existen en otras lenguas: fuera quedan «in»,
// «so», «was», «will» o «man», que también son inglesas, y «es», «mal» o «des», que son españolas o francesas.

import type { RecuentoEscritura, SignosFrase } from '../tipos';

const DELATORAS = new Set([
  'der', 'die', 'das', 'und', 'ist', 'nicht', 'ich', 'sie', 'mit', 'auf', 'für', 'ein', 'eine', 'einen', 'einem', 'einer', 'dem', 'den',
  'sich', 'auch', 'wird', 'werden', 'wurde', 'haben', 'hat', 'sind', 'waren', 'kann', 'können', 'oder', 'aber', 'wenn', 'dass', 'wie', 'noch', 'nur',
  'schon', 'sehr', 'über', 'nach', 'bei', 'aus', 'zum', 'zur', 'vom', 'durch', 'gegen', 'ohne', 'unter', 'zwischen', 'diese', 'dieser', 'dieses',
  'mich', 'mir', 'dich', 'dir', 'uns', 'euch', 'ihr', 'ihre', 'ihren', 'sein', 'seine', 'seinen', 'mein', 'meine', 'dein', 'deine', 'nichts',
  'immer', 'jetzt', 'heute', 'wieder', 'warum', 'weil', 'nein', 'doch', 'gibt', 'geht', 'macht', 'muss', 'müssen', 'soll',
]);

const PALABRA = /\p{L}[\p{L}'’-]*/gu;
const LETRAS = /\p{Script=Latin}{2}/u;
const PROPIAS = /[äöüßÄÖÜ]/;

export const tieneAleman = (texto: string) => LETRAS.test(texto);

export function contarEscrituras(texto: string): RecuentoEscritura {
  let propios = 0;
  let compartidos = 0;
  for (const m of texto.matchAll(PALABRA)) {
    if (DELATORAS.has(m[0].toLowerCase()) || PROPIAS.test(m[0])) propios++;
    else compartidos++;
  }
  return { propios, compartidos };
}

/** Si una página está en alemán: unas pocas palabras sueltas en una página en otra lengua no bastan. */
export function paginaEnAleman(r: RecuentoEscritura): boolean {
  return r.propios >= 8 && r.propios / (r.propios + r.compartidos) >= 0.15;
}

function pareceAleman(texto: string): boolean {
  const r = contarEscrituras(texto);
  return r.propios >= 2 && r.propios / (r.propios + r.compartidos) >= 0.2;
}

/**
 * Si merece la pena analizar un texto. Con la página declarada en alemán, basta con que tenga letras. En otra lengua, o
 * sin declarar, tiene que parecerlo por sí mismo, o estar en una página que ya se ha visto que está en alemán.
 */
export function esTextoAleman(texto: string, idiomaDeclarado: string | undefined, paginaEnLengua: boolean): boolean {
  if (!LETRAS.test(texto)) return false;
  if (idiomaDeclarado && /^de\b/i.test(idiomaDeclarado)) return true;
  if (idiomaDeclarado) return pareceAleman(texto);
  return paginaEnLengua || pareceAleman(texto);
}

// Una letra sola con punto también: z. B., d. h. o u. a. se escriben con espacio.
const ABREVIATURAS = String.raw`\b(?:[A-Za-z]|bzw|ca|Dr|evtl|ggf|Hr|Fr|Nr|Prof|St|usw|vgl|Str)\.\s`;

export const SIGNOS_FRASE: SignosFrase = {
  fin: /[.!?\n]/,
  cierres: /["'’“”«»)\]]/,
  // Tras el espacio: así cada frase conserva el suyo y, juntas, siguen dando el texto. Un número con punto es un
  // ordinal (am 3. Mai), no el final de la frase.
  partir: new RegExp(String.raw`(?<=(?<!\b\d{1,2})[.!?]["'’“”«»)\]]?\s)(?<!${ABREVIATURAS})`),
  cortes: ['. ', '! ', '? ', '\n'],
};

export const pareceFrase = (texto: string) => texto.trim().split(/\s+/).length >= 4 || /[.!?,;:]/.test(texto);
