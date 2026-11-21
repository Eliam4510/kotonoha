// Cómo se reconoce el chino en un texto y dónde terminan sus frases. Lógica pura: se puede probar sin navegador.
//
// Los ideogramas los comparte con el japonés: lo que delata una página japonesa es su kana, y una coreana, su hangul.
// Por eso aquí se cuentan como propios los ideogramas, y como compartidos el kana y el hangul, que dicen que el texto es
// de otra lengua. Un trozo solo de ideogramas en una página que no es china (un título japonés, 日本語能力試験) no es
// chino salvo que lo parezca por sí mismo: por sus palabras más comunes, que en japonés casi no se usan.

import type { RecuentoEscritura, SignosFrase } from '../tipos';

const HAN = /[㐀-鿿豈-﫿]|[\u{20000}-\u{3134f}]/u;
/** El kana y el hangul: un texto con ellos es japonés o coreano. Un の suelto se usa a veces como adorno en chino. */
const OTRAS_ESCRITURAS = /[぀-ゟ゠-ヿｦ-ﾟ가-힯ᄀ-ᇿ㄰-㆏]/g;
/** Lenguas que también se escriben con ideogramas y no son el chino. */
const OTRAS_LENGUAS = /^(ja|ko|vi)\b/i;
const CHINO = /^(zh|cmn)\b/i;

/**
 * Caracteres muy comunes en chino que en japonés casi no se ven: pronombres, partículas y formas simplificadas. Uno solo
 * basta para tomar por chino un trozo de ideogramas sin kana: 你好, 我们, 这个, 银行.
 */
const DELATORES = new Set([...'我你她它们这哪么个吗呢吧啊呀还给让对说话请谢东车门问时间见长开关发现听视电脑网页书买卖钱气饭吃喝岁两块怎谁些样儿过从为该应边头']);

export const tieneChino = (texto: string) => HAN.test(texto);

function otrasEscrituras(texto: string): number {
  return texto.replace(/の/g, '').match(OTRAS_ESCRITURAS)?.length ?? 0;
}

/** Cuenta los ideogramas (propios) y el kana y el hangul (compartidos: delatan otra lengua). */
export function contarEscrituras(texto: string): RecuentoEscritura {
  let propios = 0;
  let compartidos = 0;
  for (const c of texto) {
    if (HAN.test(c)) propios++;
    else if (/[぀-ヿｦ-ﾟ가-힯]/.test(c)) compartidos++;
  }
  return { propios, compartidos };
}

/** Si una página está en chino: muchos ideogramas y casi nada de kana o hangul. */
export function paginaEnChino(r: RecuentoEscritura): boolean {
  return r.propios >= 20 && r.compartidos / (r.propios + r.compartidos) < 0.03;
}

/** Si un trozo de ideogramas parece chino por sí mismo, por alguno de sus caracteres más comunes. */
export function pareceChino(texto: string): boolean {
  for (const c of texto) if (DELATORES.has(c)) return true;
  return false;
}

/**
 * Si merece la pena analizar un texto. Con kana o hangul no es chino; declarado en chino, basta con que tenga
 * ideogramas; declarado en japonés o coreano, no lo es; en otra lengua o sin declarar, tiene que parecerlo por sí mismo o
 * estar en una página que ya se ha visto que está en chino.
 */
export function esTextoChino(texto: string, idiomaDeclarado: string | undefined, paginaEnLengua: boolean): boolean {
  if (!HAN.test(texto) || otrasEscrituras(texto) > 0) return false;
  if (idiomaDeclarado && CHINO.test(idiomaDeclarado)) return true;
  if (idiomaDeclarado && OTRAS_LENGUAS.test(idiomaDeclarado)) return false;
  return paginaEnLengua || pareceChino(texto);
}

export const SIGNOS_FRASE: SignosFrase = {
  fin: /[。！？!?．\n]/,
  cierres: /[”’」』）)】》〉"']/,
  partir: /(?<=[。！？!?])/,
  cortes: ['。', '！', '？', '\n'],
};

/** Las palabras chinas son cortas: una selección de más de ocho caracteres, o con signos, ya es una frase. */
export const pareceFrase = (texto: string) => [...texto.trim()].length > 8 || /[。，、！？；,!?;]/.test(texto);

const SIGNOS_DE_CIERRE = /^[，、。．,.!?！？；：”’」』）)】〉》…]/u;
const SIGNOS_DE_APERTURA = /[“‘「『（(【〈《]$/u;
/** La unión invisible (U+2060): pega el signo a lo de al lado sin que se vea. */
const UNIR = String.fromCharCode(0x2060);

/** Evita que un signo quede solo al principio de una línea, o uno de apertura solo al final. */
export function pegarSignos(signos: string): string {
  const conCierre = SIGNOS_DE_CIERRE.test(signos) ? `${UNIR}${signos}` : signos;
  return SIGNOS_DE_APERTURA.test(conCierre) ? `${conCierre}${UNIR}` : conCierre;
}
