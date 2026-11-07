// Cómo se reconoce el inglés en un texto y dónde terminan sus frases. Lógica pura: se puede probar sin navegador.
//
// El alfabeto no sirve de pista, como sí el kana: lo comparte con el español o el alemán. Lo delatan sus palabras más
// frecuentes, elegidas entre las que casi no existen en otras lenguas (fuera quedan «a», «no», «has» o «was»).

import type { RecuentoEscritura, SignosFrase } from '../tipos';

const DELATORAS = new Set([
  'the', 'and', 'of', 'to', 'is', 'are', 'that', 'this', 'with', 'you', 'for', 'not', 'have', 'they', 'from', 'what', 'which', 'would', 'there', 'their',
  'been', 'but', 'about', 'your', 'when', 'who', 'how', 'because', 'these', 'those', 'some', 'more', 'very', 'than', 'them', 'then', 'into', 'only', 'after',
  'before', 'where', 'while', 'she', 'could', 'should', 'just',
]);

const PALABRA = /[A-Za-z][A-Za-z'’-]*/g;
const LETRAS = /[A-Za-z]{2}/;

export const tieneIngles = (texto: string) => LETRAS.test(texto);

export function contarEscrituras(texto: string): RecuentoEscritura {
  let propios = 0;
  let compartidos = 0;
  for (const m of texto.matchAll(PALABRA)) {
    if (DELATORAS.has(m[0].toLowerCase())) propios++;
    else compartidos++;
  }
  return { propios, compartidos };
}

/** Si una página está en inglés: unas pocas palabras sueltas en una página en español no bastan. */
export function paginaEnIngles(r: RecuentoEscritura): boolean {
  return r.propios >= 8 && r.propios / (r.propios + r.compartidos) >= 0.15;
}

function pareceIngles(texto: string): boolean {
  const r = contarEscrituras(texto);
  return r.propios >= 2 && r.propios / (r.propios + r.compartidos) >= 0.2;
}

/**
 * Si merece la pena analizar un texto. Con la página declarada en inglés, basta con que tenga letras. En otra lengua, o
 * sin declarar, tiene que parecerlo por sí mismo, o estar en una página que ya se ha visto que está en inglés.
 */
export function esTextoIngles(texto: string, idiomaDeclarado: string | undefined, paginaEnLengua: boolean): boolean {
  if (!LETRAS.test(texto)) return false;
  if (idiomaDeclarado && /^en\b/i.test(idiomaDeclarado)) return true;
  if (idiomaDeclarado) return pareceIngles(texto);
  return paginaEnLengua || pareceIngles(texto);
}

const ABREVIATURAS = String.raw`\b(?:Mr|Mrs|Ms|Dr|Prof|St|vs|etc|e\.g|i\.e)\.\s`;

export const SIGNOS_FRASE: SignosFrase = {
  fin: /[.!?\n]/,
  cierres: /["'’”)\]]/,
  // Tras el espacio: así cada frase conserva el suyo y, juntas, siguen dando el texto.
  partir: new RegExp(String.raw`(?<=[.!?]["'’”)\]]?\s)(?<!${ABREVIATURAS})`),
  cortes: ['. ', '! ', '? ', '\n'],
};

export const pareceFrase = (texto: string) => texto.trim().split(/\s+/).length >= 4 || /[.!?,;:]/.test(texto);
