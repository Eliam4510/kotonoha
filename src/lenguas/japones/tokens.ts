// Unión de tokens de Kuromoji en palabras y cálculo de furigana. Lógica pura.

import { tm, tr } from '../../compartido/i18n';
import type { SegmentoLectura, TokenUnido } from '../tipos';

/** Token tal como lo entrega Kuromoji (diccionario IPADIC). */
export interface TokenCrudo {
  surface_form: string;
  pos: string;
  pos_detail_1: string;
  pos_detail_2?: string;
  pos_detail_3?: string;
  conjugated_type?: string;
  conjugated_form?: string;
  basic_form: string;
  reading?: string;
  pronunciation?: string;
  word_type?: string;
}

const KANJI = /[々-〇㐀-䶿一-鿿豈-﫿\u{20000}-\u{2ffff}ヶ〆]/u;
const JAPONES = /[぀-ヿ㐀-䶿一-鿿豈-﫿ｦ-ﾟ々〆]/;

export const tieneKanji = (t: string) => KANJI.test(t);
export const tieneJapones = (t: string) => JAPONES.test(t);

export function kataAHira(texto: string): string {
  return texto.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

export function hiraAKata(texto: string): string {
  return texto.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
}

const SILABAS: Record<string, string> = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o', か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko', さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to', な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no', は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo', や: 'ya', ゆ: 'yu', よ: 'yo', ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro', わ: 'wa', ゐ: 'i', ゑ: 'e', を: 'o', ん: 'n',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go', ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo', だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo', ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po', ゔ: 'vu',
  ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o', ゃ: 'ya', ゅ: 'yu', ょ: 'yo',
  きゃ: 'kya', きゅ: 'kyu', きょ: 'kyo', しゃ: 'sha', しゅ: 'shu', しょ: 'sho', ちゃ: 'cha', ちゅ: 'chu', ちょ: 'cho', にゃ: 'nya', にゅ: 'nyu', にょ: 'nyo',
  ひゃ: 'hya', ひゅ: 'hyu', ひょ: 'hyo', みゃ: 'mya', みゅ: 'myu', みょ: 'myo', りゃ: 'rya', りゅ: 'ryu', りょ: 'ryo', ぎゃ: 'gya', ぎゅ: 'gyu', ぎょ: 'gyo',
  じゃ: 'ja', じゅ: 'ju', じょ: 'jo', ぢゃ: 'ja', ぢゅ: 'ju', ぢょ: 'jo', びゃ: 'bya', びゅ: 'byu', びょ: 'byo', ぴゃ: 'pya', ぴゅ: 'pyu', ぴょ: 'pyo',
  ふぁ: 'fa', ふぃ: 'fi', ふぇ: 'fe', ふぉ: 'fo', うぃ: 'wi', うぇ: 'we', うぉ: 'wo', てぃ: 'ti', でぃ: 'di', とぅ: 'tu', どぅ: 'du', しぇ: 'she', じぇ: 'je', ちぇ: 'che', ゔぁ: 'va', ゔぃ: 'vi', ゔぇ: 've', ゔぉ: 'vo',
};
const VOCALES_LARGAS: Record<string, string> = { a: 'ā', i: 'ī', u: 'ū', e: 'ē', o: 'ō' };

/** Rōmaji Hepburn con vocales largas marcadas, para quien aún no lee kana. */
export function kanaARomaji(kana: string): string {
  const t = kataAHira(kana);
  let salida = '';
  let duplicar = false;
  for (let i = 0; i < t.length; i++) {
    const doble = SILABAS[t.slice(i, i + 2)];
    const silaba = doble ?? SILABAS[t[i]];
    if (doble) i++;
    const c = doble ? '' : t[doble ? i - 1 : i];
    if (c === 'っ') {
      duplicar = true;
      continue;
    }
    if (c === 'ー') {
      const ultima = salida[salida.length - 1];
      if (ultima && VOCALES_LARGAS[ultima]) salida = salida.slice(0, -1) + VOCALES_LARGAS[ultima];
      continue;
    }
    if (!silaba) {
      salida += t[i];
      duplicar = false;
      continue;
    }
    if (duplicar) {
      salida += silaba.startsWith('ch') ? 't' : silaba[0];
      duplicar = false;
    }
    // ん ante vocal o y se separa para que se lea bien: ほんや → hon'ya.
    if (salida.endsWith('n') && t[i - (doble ? 2 : 1)] === 'ん' && /^[aiueoy]/.test(silaba)) salida += "'";
    salida += silaba;
  }
  return salida;
}

/** La lectura como la quiere ver cada cual. */
export function lecturaVisible(kana: string, formato: string | undefined): string {
  if (formato === 'katakana') return hiraAKata(kana);
  if (formato === 'romaji') return kanaARomaji(kana);
  return kana;
}

/**
 * Reparte la lectura sobre los kanji: 立ち上がる + たちあがる -> 立(た)ち上(あ)がる.
 * Si la lectura no encaja devuelve un solo segmento con toda la lectura.
 */
export function alinearFurigana(superficie: string, lectura: string): SegmentoLectura[] {
  if (!tieneKanji(superficie)) return [{ texto: superficie }];
  const trozos: { texto: string; kanji: boolean }[] = [];
  for (const c of superficie) {
    const k = KANJI.test(c);
    const ultimo = trozos[trozos.length - 1];
    if (ultimo && ultimo.kanji === k) ultimo.texto += c;
    else trozos.push({ texto: c, kanji: k });
  }
  const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patron = trozos.map((t) => (t.kanji ? '(.+?)' : `(${escapar(kataAHira(t.texto))})`)).join('');
  const m = kataAHira(lectura).match(new RegExp(`^${patron}$`, 'u'));
  if (!m) return [{ texto: superficie, lectura: kataAHira(lectura) }];
  return trozos.map((t, i) => (t.kanji ? { texto: t.texto, lectura: m[i + 1] } : { texto: t.texto }));
}

const definido = (v?: string) => (v && v !== '*' ? v : '');

function lecturaDe(t: TokenCrudo): string {
  const r = definido(t.reading);
  if (r) return kataAHira(r);
  return tieneJapones(t.surface_form) ? kataAHira(t.surface_form) : '';
}

const TE_Y_CONDICIONAL = new Set(['て', 'で', 'ちゃ', 'じゃ', 'ば', 'たり', 'だり', 'てる', 'ちゃう', 'じゃう']);

/** Colas que pertenecen a la palabra anterior: conjugación, no palabras aparte. */
function esCola(t: TokenCrudo, cabeza: TokenCrudo): boolean {
  const verboOAdj = cabeza.pos === '動詞' || cabeza.pos === '形容詞';
  if (cabeza.pos === '名詞' && cabeza.pos_detail_1 === 'サ変接続') {
    // 勉強 + する: el verbo forma parte de la palabra.
    return t.pos === '動詞' && t.basic_form === 'する';
  }
  if (!verboOAdj) return false;
  if (t.pos === '助動詞') {
    return t.basic_form !== 'だ' && t.basic_form !== 'です' && t.basic_form !== 'らしい' && t.basic_form !== 'じゃ';
  }
  if (t.pos === '動詞') return t.pos_detail_1 === '接尾' || t.pos_detail_1 === '非自立';
  if (t.pos === '形容詞') return t.pos_detail_1 === '非自立';
  if (t.pos === '助詞') {
    return (t.pos_detail_1 === '接続助詞' || t.pos_detail_1 === '副助詞／並立助詞／終助詞' || t.pos_detail_1 === '並立助詞') && TE_Y_CONDICIONAL.has(t.surface_form);
  }
  if (t.pos === '名詞') return t.pos_detail_1 === '接尾' && t.pos_detail_2 === '助動詞語幹'; // 食べ + そう
  return false;
}

const CAT_NO_PALABRA = new Set(['記号', 'BOS/EOS']);

/**
 * Une tokens en palabras:
 * 1. Compuestos que existen en el diccionario (泥 + だらけ, お + 茶).
 * 2. Conjugaciones con su verbo o adjetivo (咲い + た, 食べ + て + いる).
 */
export function unirTokens(crudos: TokenCrudo[], existe?: (termino: string) => boolean): TokenUnido[] {
  const salida: TokenUnido[] = [];
  let i = 0;
  while (i < crudos.length) {
    const cabeza = crudos[i];
    let fin = i + 1;
    let lema = definido(cabeza.basic_form) || cabeza.surface_form;
    let compuesto = false;

    // Compuesto más largo presente en el diccionario, sin arrancar en símbolos.
    if (existe && !CAT_NO_PALABRA.has(cabeza.pos) && tieneJapones(cabeza.surface_form)) {
      for (let j = Math.min(i + 5, crudos.length); j > i + 1; j--) {
        const trozo = crudos.slice(i, j);
        if (trozo.some((t) => CAT_NO_PALABRA.has(t.pos))) continue;
        const superficie = trozo.map((t) => t.surface_form).join('');
        const ultimo = trozo[trozo.length - 1];
        // 今日 + は existe como «こんにちは», pero casi siempre es «hoy» + partícula.
        const terminaEnFuncion = ultimo.pos === '助詞' || ultimo.pos === '助動詞';
        const empiezaEnContenido = cabeza.pos !== '助詞' && cabeza.pos !== '接続詞';
        if (terminaEnFuncion && empiezaEnContenido) continue;
        const conLemaFinal =
          trozo.slice(0, -1).map((t) => t.surface_form).join('') + (definido(ultimo.basic_form) || ultimo.surface_form);
        if (existe(superficie)) {
          fin = j;
          lema = superficie;
          compuesto = true;
          break;
        }
        if (existe(conLemaFinal)) {
          fin = j;
          lema = conLemaFinal;
          compuesto = true;
          break;
        }
      }
    }

    let base = compuesto ? crudos[fin - 1] : cabeza;
    const flexion: string[] = [];
    while (fin < crudos.length && esCola(crudos[fin], base)) {
      flexion.push(crudos[fin].surface_form);
      // 勉強 + し + ます: tras unir する, las colas siguientes se comparan con el verbo.
      if (base.pos === '名詞') base = crudos[fin];
      fin++;
    }

    const grupo = crudos.slice(i, fin);
    const superficie = grupo.map((t) => t.surface_form).join('');
    const lectura = grupo.map(lecturaDe).join('');
    const categoria = cabeza.pos;
    const esPalabra = !CAT_NO_PALABRA.has(categoria) && tieneJapones(superficie);
    salida.push({
      superficie,
      lema,
      lectura,
      categoria,
      esPalabra,
      esGramatica: esPalabra && grupo.every((t) => t.pos === '助詞' || t.pos === '助動詞'),
      flexion,
      furigana: esPalabra ? alinearFurigana(superficie, lectura || superficie) : [{ texto: superficie }],
      inflexionado: superficie !== lema,
    });
    i = fin;
  }
  return salida;
}

// ---------- Acento tonal ----------

export type PatronAcento = 'heiban' | 'atamadaka' | 'nakadaka' | 'odaka';

const PEQUENAS = new Set('ゃゅょぁぃぅぇぉゎャュョァィゥェォヮ');

export function contarMoras(lectura: string): number {
  let n = 0;
  for (const c of lectura) if (!PEQUENAS.has(c)) n++;
  return n;
}

/** Clasifica la posición del descenso de tono según el número de moras. */
export function patronAcento(posicion: number, lectura: string): PatronAcento {
  if (posicion === 0) return 'heiban';
  if (posicion === 1) return 'atamadaka';
  return posicion >= contarMoras(lectura) ? 'odaka' : 'nakadaka';
}

/** Moras de una lectura, agrupando las pequeñas con la anterior: きょう -> [きょ, う]. */
export function separarMoras(lectura: string): string[] {
  const salida: string[] = [];
  for (const c of lectura) {
    if (PEQUENAS.has(c) && salida.length) salida[salida.length - 1] += c;
    else salida.push(c);
  }
  return salida;
}

// ---------- Nombres de las colas de conjugación ----------

const NOMBRES_FLEXION: Record<string, string> = {
  た: tm('pasado'),
  だ: tm('pasado'),
  ない: tm('negativo'),
  ぬ: tm('negativo'),
  ん: tm('negativo'),
  ます: tm('cortés'),
  まし: tm('cortés'),
  ませ: tm('cortés'),
  て: tm('forma て'),
  で: tm('forma て'),
  いる: tm('continuo o estado'),
  い: tm('continuo o estado'),
  てる: tm('continuo o estado'),
  れる: tm('pasiva o potencial'),
  られる: tm('pasiva o potencial'),
  れ: tm('pasiva o potencial'),
  られ: tm('pasiva o potencial'),
  せる: tm('causativa'),
  させる: tm('causativa'),
  せ: tm('causativa'),
  させ: tm('causativa'),
  たい: tm('deseo'),
  たく: tm('deseo'),
  ば: tm('condicional'),
  う: tm('volitiva'),
  よう: tm('volitiva'),
  そう: tm('apariencia'),
  しまう: tm('acción completada'),
  しまっ: tm('acción completada'),
  ちゃう: tm('acción completada'),
  じゃう: tm('acción completada'),
  ちゃっ: tm('acción completada'),
  じゃっ: tm('acción completada'),
  おく: tm('preparación'),
  おい: tm('preparación'),
  くる: tm('acción hacia aquí'),
  き: tm('acción hacia aquí'),
  いく: tm('acción que se aleja'),
  いっ: tm('acción que se aleja'),
  みる: tm('intentar'),
  み: tm('intentar'),
  くれる: tm('favor recibido'),
  くれ: tm('favor recibido'),
  もらう: tm('favor pedido'),
  もらっ: tm('favor pedido'),
  ある: tm('estado resultante'),
  あっ: tm('estado resultante'),
  たり: tm('enumeración'),
  だり: tm('enumeración'),
  する: tm('verbo する'),
  し: tm('verbo する'),
  さ: tm('verbo する'),
};

export function nombreFlexion(cola: string): string | undefined {
  const nombre = NOMBRES_FLEXION[cola];
  return nombre && tr(nombre);
}

const SIGNOS_DE_CIERRE = /^[、。，．,.!?！？」』）)】〉》…]/u;
const SIGNOS_DE_APERTURA = /[「『（(【〈《]$/u;
const UNIR = '⁠';

/**
 * Cada palabra se pinta como un bloque, y entre bloques el navegador puede cortar la línea, así que un
 * 「。」 podría quedar solo al principio de una. La tipografía japonesa lo prohíbe: esto lo impide.
 */
export function pegarSignos(signos: string): string {
  const conCierre = SIGNOS_DE_CIERRE.test(signos) ? `${UNIR}${signos}` : signos;
  return SIGNOS_DE_APERTURA.test(conCierre) ? `${conCierre}${UNIR}` : conCierre;
}

