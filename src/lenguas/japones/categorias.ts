// La categoría de una palabra según IPADIC frente a las clases de palabra de JMdict, para elegir la glosa que toca: なる
// como verbo es 成る («llegar a ser»), no el sufijo なる de los textos antiguos, y もの como sustantivo es 物 («cosa»), no
// la partícula. Sin navegador, para poder probarlo.

/** Las clases de JMdict (en las etiquetas de cada entrada de Yomitan) que corresponden a cada categoría de IPADIC. */
const CLASES: Record<string, RegExp> = {
  // v1, v5r, v5k-s, vk, vs-i, vz, v2a-s, v4r, vr, vn…, pero no vt ni vi, que solo dicen si es transitivo.
  動詞: /^v(?:[1245knrsz])/,
  形容詞: /^adj-ix?$/,
  // Los sustantivos de IPADIC incluyen los pronombres, los números, la raíz de los adjetivos en -na y los sufijos (さん).
  名詞: /^(?:n|n-.+|pn|adj-na|adj-no|num|ctr|suf)$/,
  副詞: /^adv(?:-to)?$/,
  助詞: /^prt$/,
  助動詞: /^(?:aux|aux-v|aux-adj|cop|cop-da)$/,
  連体詞: /^adj-pn$/,
  接続詞: /^conj$/,
  感動詞: /^int$/,
  接頭詞: /^pref$/,
};

/** Si una entrada de JMdict, por sus etiquetas, es de la categoría que IPADIC da a la palabra. */
export function encajaCategoriaJapones(categoria: string, etiquetas = ''): boolean {
  const clase = CLASES[categoria];
  return !!clase && etiquetas.split(/\s+/).some((t) => clase.test(t));
}

/** Solo hiragana: una palabra que en el texto va sin kanji, aunque su entrada del diccionario los tenga (なる, 成る). */
export const soloHiragana = (s: string) => /^[ぁ-ゖゝゞ]+$/.test(s);
