// Lo que Claude devuelve al traducir subtítulos, antes de guardarlo. A veces no traduce una línea (la letra de una
// canción, por sus reglas sobre los derechos de autor) y, obligado a rellenar el JSON, escribe la disculpa en su lugar.
// Guardada como si fuera la traducción, se quedaba en la pista.

export interface ParteTexto {
  i: number;
  t: string;
}

/**
 * Frases con las que Claude dice que no traduce o no reproduce algo, en las lenguas a las que se traduce. Son concretas a
 * propósito: «lo siento» o «no puedo» a secas son versos corrientes.
 */
const NEGATIVA = new RegExp(
  [
    String.raw`derechos de autor|copyright|urheberrecht|droits? d['’]auteur|direitos autorais|diritt[oi] d['’]autore|著作権|저작권|版权|著作权`,
    String.raw`no (?:puedo|podré|me es posible|es posible) (?:traducir|reproducir|transcribir)`,
    String.raw`can(?:not|['’]t) (?:help (?:you )?(?:with )?)?(?:translat|reproduc|transcrib)`,
    String.raw`(?:unable|not able) to (?:translat|reproduc|transcrib)`,
    String.raw`nicht (?:übersetzen|wiedergeben)`,
    String.raw`ne (?:peux|puis) pas (?:traduire|reproduire)`,
    String.raw`não posso (?:traduzir|reproduzir)`,
    String.raw`non posso (?:tradurre|riprodurre)`,
    String.raw`翻訳(?:することは|は)?(?:でき(?:ません|ない)|いたしかね)`,
    String.raw`번역(?:할|해 ?드릴) 수 없`,
    String.raw`(?:无法|不能)(?:翻译|提供)`,
  ].join('|'),
  'i'
);

/** Si un texto es Claude diciendo que no traduce, y no una traducción. */
export function pareceNegativa(texto: string): boolean {
  return NEGATIVA.test(texto);
}

/**
 * Lo que vale de lo que devolvió Claude para las líneas `desde`–`hasta`: solo números de ese tramo, una vez cada uno, con
 * texto y sin disculpas. Si el original ya habla de traducir o de derechos de autor, la frase es la traducción y se queda.
 */
export function traduccionesValidas(entradas: readonly ParteTexto[], originales: readonly string[], desde: number, hasta: number): ParteTexto[] {
  const vistas = new Set<number>();
  const validas: ParteTexto[] = [];
  for (const e of entradas) {
    if (!Number.isInteger(e?.i) || e.i < desde || e.i >= hasta || vistas.has(e.i)) continue;
    const t = typeof e.t === 'string' ? e.t.trim() : '';
    if (!t || (pareceNegativa(t) && !pareceNegativa(originales[e.i] ?? ''))) continue;
    vistas.add(e.i);
    validas.push({ i: e.i, t });
  }
  return validas;
}
