// Las frases acentuales de una frase japonesa, para practicar su acento: cada palabra con las partículas y auxiliares que
// se le pegan, sus moras y dónde debe caer el tono. El diccionario (Kanjium) da el acento de la forma de diccionario. De
// las formas conjugadas solo se sabe con seguridad el de las corteses: 〜ます lleva el núcleo en la ま (〜ません, en la
// せ), sea cual sea el verbo. Las demás formas conjugadas se dibujan sin juzgar: sus reglas tienen demasiadas excepciones
// para dar un veredicto que oriente.

import type { PalabraToken } from '../../compartido/tipos';
import type { FraseAcentual } from '../../nucleo/practicaAcento';
import { separarMoras } from './tokens';

/** Las colas corteses y cuántas moras van detrás de su núcleo: たべま\す, たべませ\ん, たべませ\んでした. */
const CORTESES: [string, number][] = (
  [
    ['ませんでした', 4],
    ['ましょう', 1],
    ['ました', 2],
    ['ません', 1],
    ['まして', 2],
    ['ます', 1],
  ] as [string, number][]
).sort((a, b) => b[0].length - a[0].length);

/** La cópula tras una palabra sin núcleo pone el suyo: がくせいで\す. Lo que va antes de él en la cópula. */
const COPULAS: [string, number][] = [
  ['です', 1],
  ['でした', 1],
  ['でしょう', 2],
];

/** Dónde cae el tono en esta forma de la palabra, en moras desde su principio; null si no se sabe. */
export function nucleosDeForma(p: Pick<PalabraToken, 'superficie' | 'lema' | 'lectura' | 'lecturaLema' | 'flexion' | 'acentos'>): number[] | null {
  const moras = separarMoras(p.lectura);
  if (!moras.length) return null;
  if (p.flexion.length) {
    const cortes = CORTESES.find(([cola]) => p.lectura.endsWith(cola));
    return cortes ? [moras.length - cortes[1]] : null;
  }
  if (!p.acentos?.length) return null;
  // Sin conjugar: la del diccionario, si es la misma palabra que se leyó.
  if (p.superficie !== p.lema && p.lectura !== p.lecturaLema) return null;
  const validos = [...new Set(p.acentos)].filter((n) => n >= 0 && n <= moras.length);
  return validos.length ? validos : null;
}

/** Los signos tras los que una pausa es natural. */
const PUNTUACION = /[。、．，！？!?,.…・「」『』（）()]/;

/** Las moras con i o u tras consonante sorda: al final de lo que se dice suelen perder la voz, como la su de です. */
const ENSORDECIBLES = /^(す|し|く|き|つ|ち|ふ|ひ|ぷ|ぴ|しゅ|ちゅ|きゅ|ひゅ|ぴゅ)$/;

/** Las frases acentuales de una frase ya analizada. */
export function frasesAcentuales(palabras: PalabraToken[]): FraseAcentual[] {
  const frases: FraseAcentual[] = [];
  let actual: FraseAcentual | null = null;
  for (const p of palabras) {
    if (!p.esPalabra) {
      if (actual && PUNTUACION.test(p.superficie)) actual.pausaNatural = true;
      if (p.superficie.trim()) actual = null;
      continue;
    }
    const moras = separarMoras(p.lectura);
    if (!moras.length) continue;
    if (!p.esGramatica || !actual) {
      actual = { texto: p.superficie, moras, morasPalabra: moras.length, nucleos: p.esGramatica ? null : nucleosDeForma(p), pausaNatural: false };
      frases.push(actual);
      continue;
    }
    // Lo que se pega detrás de la palabra.
    const antes = actual.moras.length;
    actual.texto += p.superficie;
    actual.moras = [...actual.moras, ...moras];
    const copula = COPULAS.find(([l]) => l === p.lectura);
    if (copula && actual.nucleos) actual.nucleos = actual.nucleos.map((n) => (n === 0 ? antes + copula[1] : n));
  }
  for (const f of frases) if (ENSORDECIBLES.test(f.moras[f.moras.length - 1])) f.ultimaSorda = true;
  return frases;
}
