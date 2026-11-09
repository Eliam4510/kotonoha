// Orden de los trazos, con datos de KanjiVG (Ulrich Apel, CC BY-SA 3.0, https://kanjivg.tagaini.net).

// La versión va fijada: los datos no cambian sin que se decida, y el CDN puede guardarlos para siempre.
const BASE = 'https://cdn.jsdelivr.net/gh/KanjiVG/kanjivg@r20260714/kanji/';

const ES_KANJI = /[㐀-鿿豈-﫿\u{20000}-\u{2ffff}]/u;
const ES_KANA = /[ぁ-ゖァ-ヺ]/;

/** El nombre del archivo: el punto de código en hexadecimal, con cinco cifras. */
export const archivoTrazos = (caracter: string) => `${caracter.codePointAt(0)!.toString(16).padStart(5, '0')}.svg`;

/** Qué caracteres de una palabra se enseñan: sus kanji, sin repetir. Una palabra solo en kana enseña su kana. */
export function caracteresConTrazos(palabra: string): string[] {
  const unicos = [...new Set(palabra)];
  const kanji = unicos.filter((c) => ES_KANJI.test(c));
  return kanji.length ? kanji : unicos.filter((c) => ES_KANA.test(c));
}

/** Los kanji de una palabra, sin repetir: los que se buscan entre las palabras que ya se conocen. */
export const kanjiDe = (palabra: string): string[] => [...new Set(palabra)].filter((c) => ES_KANJI.test(c));

export const urlTrazos = (caracter: string) => BASE + archivoTrazos(caracter);
