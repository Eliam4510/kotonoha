// La voz neuronal del japonés (las voces de AivisHub, Style-Bert-VITS2 JP-Extra): de un texto a lo que lee la voz.
// yomi, el OpenJTalk reescrito en TypeScript, da la lectura, el acento y las frases acentuales. Aquí se le da el texto
// como lo normaliza AivisSpeech (sus signos), se añaden los enlaces de frase de pyopenjtalk-plus y se pasa todo a fonemas,
// tonos y word2ph, como su g2p.py. Lo que AivisSpeech convierte además (números a palabras, inglés a katakana, fechas y
// unidades) aquí lo lee yomi a su manera.

import { type EntradaSbv2, MAXIMO_CARACTERES_BERT, PARAMETROS_SBV2 } from '../../../nucleo/sbv2';
import type { OracionVoz } from '../../tipos';
import { enlacesDeMas } from './reglas';
import type { JtdDictionary } from './yomi/dict/dictionary';
import { moraToPhones } from './yomi/g2p/phonemes';
import { leadingPunctuationMarks, segmentPhrases } from './yomi/g2p/result';
import { njdSetAccentPhrase } from './yomi/njd/accent_phrase';
import { njdSetAccentType } from './yomi/njd/accent_type';
import { njdSetDigit } from './yomi/njd/digit';
import { njdDigitSequence } from './yomi/njd/digit_sequence';
import { nodesFromTokens } from './yomi/njd/from_tokens';
import { njdSetPronunciation } from './yomi/njd/pronunciation';
import type { NjdNode } from './yomi/njd/types';
import { njdSetUnvoicedVowel } from './yomi/njd/unvoiced_vowel';
import { tokenize } from './yomi/tokenizer/tokenizer';

// ---------- El texto, como lo normaliza AivisSpeech ----------

/** La tabla de signos de su normalizer.py (__SYMBOL_REPLACE_MAP); la barra, que allí se convierte después, ya en punto. */
const SIGNOS: Record<string, string> = {
  '：': ',', '；': ',', '，': ',', '。': '.', '！': '!', '？': '?', '．': '.', '…': '...', '···': '...', '・・・': '...',
  '/': '.', '／': '.', '\\': '.', '＼': '.', '·': ',', '・': ',', '、': ',', $: '.', ':': ',', ';': ',',
  '“': "'", '”': "'", '"': "'", '‘': "'", '’': "'", '（': "'", '）': "'", '(': "'", ')': "'", '「': "'", '」': "'",
  '《': "'", '》': "'", '【': "'", '】': "'", '[': "'", ']': "'",
  '˗': '-', '‐': '-', '‑': '-', '‒': '-', '–': '-', '—': '-', '―': '-', '⁃': '-',
  '−': '-', '⎯': '-', '⏤': '-', '─': '-', '━': '-', '⸺': '-', '⸻': '-',
};
const PATRON_SIGNOS = new RegExp(
  Object.keys(SIGNOS)
    .sort((a, b) => b.length - a.length)
    .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|'),
  'g'
);
/** Lo que se queda: kana, kanji, cifras, letras latinas y griegas, y los signos que la voz lee. El resto no se lee. */
const ILEGIBLE = /[^぀-ゟ゠-ヿ一-鿿㐀-䶿々0-9０-９A-Za-zＡ-Ｚａ-ｚͰ-Ͽἀ-῿!?….,'\-]+/g;

/** Una línea como la deja normalize_text, en lo que toca a los fonemas y a los tonos. */
export function normalizarComoAivis(linea: string): string {
  return linea
    .replace(/　/g, '。')
    .replace(/​/g, '')
    .normalize('NFKC')
    .replace(/[~～〜]/g, 'ー')
    .replace(PATRON_SIGNOS, (s) => SIGNOS[s])
    .replace(ILEGIBLE, '')
    .replace(/[゙゚]/g, '');
}

/** Pausa entre líneas (como AivisSpeech) y entre los trozos de una línea demasiado larga para el BERT. */
const PAUSA_LINEA_S = PARAMETROS_SBV2.pausaEntreOracionesS;
const PAUSA_TROZO_S = 0.15;
/** Con margen: algún carácter puede dar más de un token. */
const LARGO_MAXIMO = MAXIMO_CARACTERES_BERT - 30;

/** Una línea normalizada en trozos que caben en el BERT: por el final de las oraciones, luego por las comas, luego a la fuerza. */
export function partirParaBert(texto: string, maximo = LARGO_MAXIMO): string[] {
  if ([...texto].length <= maximo) return [texto];
  for (const corte of [/(?<=[.!?]+)(?=[^.!?])/u, /(?<=,+)(?=[^,])/u]) {
    const partes = texto.split(corte);
    if (partes.length < 2) continue;
    const trozos: string[] = [];
    let actual = '';
    for (const p of partes) {
      if (actual && [...actual].length + [...p].length > maximo) {
        trozos.push(actual);
        actual = p;
      } else actual += p;
    }
    if (actual) trozos.push(actual);
    return trozos.flatMap((t) => partirParaBert(t, maximo));
  }
  const letras = [...texto];
  const trozos: string[] = [];
  for (let i = 0; i < letras.length; i += maximo) trozos.push(letras.slice(i, i + maximo).join(''));
  return trozos;
}

// ---------- yomi ----------

interface PalabraInterna {
  /** Lo que lee el BERT de ella. */
  letras: string;
  /** Sus fonemas, mora a mora. */
  fonemasPorMora: string[][];
}
interface FraseInterna {
  palabras: PalabraInterna[];
  signos: string[];
}
interface OracionInterna {
  iniciales: string[];
  frases: FraseInterna[];
}

function nodosDe(diccionario: JtdDictionary, texto: string): NjdNode[] {
  let nodos = njdSetPronunciation(nodesFromTokens(tokenize(diccionario, texto)));
  nodos = njdDigitSequence(nodos);
  nodos = njdSetDigit(nodos);
  enlacesDeMas(nodos);
  njdSetAccentPhrase(nodos);
  njdSetAccentType(nodos);
  njdSetUnvoicedVowel(nodos);
  return nodos;
}

/** yomi guarda el texto con el ASCII a lo ancho; el BERT lo leyó estrecho, como lo deja NFKC. */
const aEstrecho = (s: string) => s.replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

/** Las oraciones de un texto: cada línea, y cada trozo si es muy larga, con sus frases acentuales. */
export function analizarVoz(diccionario: JtdDictionary, texto: string): OracionVoz[] {
  const salida: OracionVoz[] = [];
  texto.split(/\r?\n/).forEach((linea, l) => {
    partirParaBert(normalizarComoAivis(linea)).forEach((trozo, t) => {
      const nodos = nodosDe(diccionario, trozo);
      const segmentos = segmentPhrases(nodos);
      if (!segmentos.length) return;
      const interno: OracionInterna = {
        iniciales: leadingPunctuationMarks(nodos).map((m) => m.punct),
        frases: segmentos.map((s) => ({
          palabras: s.words.map((w) => ({ letras: aEstrecho(w.node.surface), fonemasPorMora: w.moras.map(moraToPhones) })),
          signos: s.punctuations.map((m) => m.punct),
        })),
      };
      salida.push({
        frases: segmentos.map((s) => ({ moras: s.words.flatMap((w) => w.moras.map((m) => m.kana)), nucleo: s.accentNucleus })),
        pausaAntesS: !salida.length ? 0 : t === 0 && l > 0 ? PAUSA_LINEA_S : PAUSA_TROZO_S,
        interno,
      });
    });
  });
  return salida;
}

// ---------- La entrada de la voz ----------

/**
 * El tono de cada mora de una frase acentual, como Style-Bert-VITS2 con las etiquetas de OpenJTalk: una frase de una
 * mora, grave; con el núcleo en la primera, aguda y luego graves; si no, grave, agudas hasta el núcleo y graves después.
 * El núcleo 0, o en la última mora, no baja dentro de la frase.
 */
export function tonosDeFrase(moras: number, nucleo: number): number[] {
  if (moras === 1) return [0];
  if (nucleo === 1) return Array.from({ length: moras }, (_, i) => (i === 0 ? 1 : 0));
  const fin = nucleo === 0 || nucleo >= moras ? moras : nucleo;
  return Array.from({ length: moras }, (_, i) => (i === 0 ? 0 : i < fin ? 1 : 0));
}

/** Como __distribute_phone de g2p.py: los fonemas de una palabra, repartidos por igual entre sus caracteres. */
export function repartir(fonemas: number, caracteres: number): number[] {
  const r = new Array<number>(caracteres).fill(0);
  for (let k = 0; k < fonemas; k++) r[r.indexOf(Math.min(...r))]++;
  return r;
}

/** La entrada de la voz para una oración, con los núcleos dados (ya corregidos con el diccionario) o con los suyos. */
export function entradaVoz(oracion: OracionVoz, nucleos?: number[]): EntradaSbv2 {
  const o = oracion.interno as OracionInterna;
  const fonemas = ['_'];
  const tonos = [0];
  const word2ph = [1];
  let textoBert = '';
  const signo = (s: string) => {
    fonemas.push(s);
    tonos.push(0);
    word2ph.push(1);
    textoBert += s;
  };
  o.iniciales.forEach(signo);
  o.frases.forEach((f, i) => {
    const t = tonosDeFrase(oracion.frases[i].moras.length, nucleos?.[i] ?? oracion.frases[i].nucleo);
    let mora = 0;
    for (const p of f.palabras) {
      let cuenta = 0;
      for (const fm of p.fonemasPorMora) {
        for (const ph of fm) {
          fonemas.push(ph);
          tonos.push(t[mora]);
          cuenta++;
        }
        mora++;
      }
      const letras = [...p.letras];
      textoBert += p.letras;
      // Sin letras que leer (no debería pasar), sus fonemas van con lo anterior: la suma tiene que cuadrar.
      if (letras.length) word2ph.push(...repartir(cuenta, letras.length));
      else word2ph[word2ph.length - 1] += cuenta;
    }
    f.signos.forEach(signo);
  });
  fonemas.push('_');
  tonos.push(0);
  word2ph.push(1);
  return { fonemas, tonos, textoBert, word2ph };
}
