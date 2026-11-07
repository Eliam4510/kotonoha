// Cómo se reconoce el japonés en un texto y dónde terminan sus frases. Lógica pura: se puede probar sin navegador.

import type { RecuentoEscritura, SignosFrase } from '../tipos';

const KANA = /[぀-ヿｦ-ﾟ]/;
const KANA_GLOBAL = /[぀-ヿｦ-ﾟ]/g;
const KANJI = /[㐀-鿿豈-﫿]/;

/** Lenguas que también se escriben con ideogramas: ahí, unos ideogramas sueltos no son japonés. */
const LENGUAS_CON_IDEOGRAMAS = /^(zh|cmn|yue|wuu|hak|nan|lzh|ko|vi)\b/i;

/**
 * Si merece la pena analizar un texto. Los ideogramas solos también podrían ser chino o coreano, y entonces decide
 * el idioma que declare la página. Un artículo en español sobre Japón sí trae japonés: lo delata el resto de su kana.
 */
export function esTextoJapones(texto: string, idiomaDeclarado: string | undefined, paginaConKana: boolean): boolean {
  const otraLengua = !!idiomaDeclarado && LENGUAS_CON_IDEOGRAMAS.test(idiomaDeclarado);
  if (KANA.test(texto)) {
    // En chino se usa mucho の como adorno: una sola no convierte el texto en japonés.
    return !otraLengua || (texto.replace(/の/g, '').match(KANA_GLOBAL)?.length ?? 0) >= 2;
  }
  if (!KANJI.test(texto)) return false;
  if (idiomaDeclarado && /^ja\b/i.test(idiomaDeclarado)) return true;
  if (otraLengua) return false;
  return paginaConKana;
}

/**
 * Si una página tiene japonés de verdad, según cuánto kana lleva frente a sus ideogramas. Un の o una katakana sueltos
 * en una página en chino sin idioma declarado no bastan para tratar como japoneses todos sus ideogramas.
 */
export function proporcionDeKana(kana: number, kanji: number): boolean {
  return kana >= 8 && kana / (kana + kanji) >= 0.1;
}

/** Cuenta kana e ideogramas de un texto. El kana es propio del japonés; los ideogramas, compartidos. */
export function contarEscrituras(texto: string): RecuentoEscritura {
  let kana = 0;
  let kanji = 0;
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    if ((c >= 0x3040 && c <= 0x30ff) || (c >= 0xff66 && c <= 0xff9f)) kana++;
    else if ((c >= 0x3400 && c <= 0x9fff) || (c >= 0xf900 && c <= 0xfaff)) kanji++;
  }
  return { propios: kana, compartidos: kanji };
}

export const SIGNOS_FRASE: SignosFrase = {
  fin: /[。！？!?．\n]/,
  cierres: /[」』）)】〉》"'’”]/,
  partir: /(?<=[。！？!?])/,
  cortes: ['。', '！', '？', '\n'],
};

export const pareceFrase = (texto: string) => texto.length > 12 || /[。、!?!?]/.test(texto);
