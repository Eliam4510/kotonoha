// Los fonemas de cada mora como los escribe OpenJTalk (pyopenjtalk), que son los que aprendió narabas, el alineador por
// fonemas de la práctica del acento: «か» es k a, «しゃ» sh a, «っ» cl, «ん» N, y la raya larga repite la vocal anterior.

import type { TipoMoraEspecial } from '../../nucleo/alineacion';

const VOCAL: Record<string, string> = { あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o', ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o' };

/** Consonante y vocal de cada kana suelto. */
const KANA: Record<string, [string, string]> = {
  か: ['k', 'a'], き: ['k', 'i'], く: ['k', 'u'], け: ['k', 'e'], こ: ['k', 'o'],
  が: ['g', 'a'], ぎ: ['g', 'i'], ぐ: ['g', 'u'], げ: ['g', 'e'], ご: ['g', 'o'],
  さ: ['s', 'a'], し: ['sh', 'i'], す: ['s', 'u'], せ: ['s', 'e'], そ: ['s', 'o'],
  ざ: ['z', 'a'], じ: ['j', 'i'], ず: ['z', 'u'], ぜ: ['z', 'e'], ぞ: ['z', 'o'],
  た: ['t', 'a'], ち: ['ch', 'i'], つ: ['ts', 'u'], て: ['t', 'e'], と: ['t', 'o'],
  だ: ['d', 'a'], ぢ: ['j', 'i'], づ: ['z', 'u'], で: ['d', 'e'], ど: ['d', 'o'],
  な: ['n', 'a'], に: ['n', 'i'], ぬ: ['n', 'u'], ね: ['n', 'e'], の: ['n', 'o'],
  は: ['h', 'a'], ひ: ['h', 'i'], ふ: ['f', 'u'], へ: ['h', 'e'], ほ: ['h', 'o'],
  ば: ['b', 'a'], び: ['b', 'i'], ぶ: ['b', 'u'], べ: ['b', 'e'], ぼ: ['b', 'o'],
  ぱ: ['p', 'a'], ぴ: ['p', 'i'], ぷ: ['p', 'u'], ぺ: ['p', 'e'], ぽ: ['p', 'o'],
  ま: ['m', 'a'], み: ['m', 'i'], む: ['m', 'u'], め: ['m', 'e'], も: ['m', 'o'],
  や: ['y', 'a'], ゆ: ['y', 'u'], よ: ['y', 'o'],
  ら: ['r', 'a'], り: ['r', 'i'], る: ['r', 'u'], れ: ['r', 'e'], ろ: ['r', 'o'],
  わ: ['w', 'a'], を: ['', 'o'], ゔ: ['v', 'u'],
};

/** La consonante palatal de un kana en «i» seguido de ゃ, ゅ o ょ: き → ky, し → sh, に → ny... */
const PALATAL: Record<string, string> = {
  き: 'ky', ぎ: 'gy', し: 'sh', じ: 'j', ち: 'ch', ぢ: 'j', に: 'ny', ひ: 'hy', び: 'by', ぴ: 'py', み: 'my', り: 'ry',
};

/** Lo que cambia la consonante delante de una vocal pequeña: てぃ es t i, ふぁ es f a, うぃ es w i, くぁ es kw a. */
const CON_VOCAL_PEQUENA: Record<string, string> = {
  て: 't', で: 'd', ふ: 'f', う: 'w', ゔ: 'v', し: 'sh', じ: 'j', ち: 'ch', つ: 'ts', と: 't', ど: 'd', く: 'kw', ぐ: 'gw',
};

const PEQUENA_Y: Record<string, string> = { ゃ: 'a', ゅ: 'u', ょ: 'o' };

/** De katakana a hiragana; lo demás, tal cual. */
const aHiragana = (s: string) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

/** Los fonemas de una mora. `vocalAnterior` es la de la mora de antes, para la raya larga. Sin fonemas, vacío. */
export function fonemasDeMora(mora: string, vocalAnterior: string | null): string[] {
  const m = aHiragana(mora);
  if (m === 'っ') return ['cl'];
  if (m === 'ん') return ['N'];
  if (m === 'ー' || m === '〜') return vocalAnterior ? [vocalAnterior] : [];
  if (VOCAL[m]) return [VOCAL[m]];
  const [base, pequena] = [m[0], m.slice(1)];
  if (pequena && PEQUENA_Y[pequena]) {
    const c = PALATAL[base] ?? (base === 'て' ? 'ty' : base === 'で' ? 'dy' : null);
    if (c) return [c, PEQUENA_Y[pequena]];
  }
  if (pequena && VOCAL[pequena]) {
    const c = CON_VOCAL_PEQUENA[base];
    if (c) return [c, VOCAL[pequena]];
  }
  const kana = KANA[base];
  if (!kana) return [];
  return kana[0] ? [kana[0], kana[1]] : [kana[1]];
}

/**
 * Las moras que más se acortan al hablar japonés como segunda lengua: la っ, la ん y la segunda mitad de una vocal larga
 * (la raya, una vocal repetida, o la い tras e y la う tras o, que suenan como e y o largas: せんせい, とうきょう).
 */
export function morasEspeciales(fonemasPorMora: string[][]): (TipoMoraEspecial | null)[] {
  return fonemasPorMora.map((f, i) => {
    if (f.length === 1 && f[0] === 'cl') return 'sokuon';
    if (f.length === 1 && f[0] === 'N') return 'hatsuon';
    const anterior = fonemasPorMora[i - 1]?.at(-1);
    if (f.length !== 1 || !anterior) return null;
    const v = f[0];
    if (v === anterior && /^[aiueo]$/.test(v)) return 'larga';
    if ((anterior === 'e' && v === 'i') || (anterior === 'o' && v === 'u')) return 'larga';
    return null;
  });
}

/**
 * Los fonemas de cada mora de una frase acentual. La partícula は del final se dice わ, y へ, え: el diccionario las da con
 * la letra, y así se escriben también こんにちは o では.
 */
export function fonemasDeMoras(frase: { texto: string; moras: string[] }): string[][] {
  let vocal: string | null = null;
  const ultima = frase.moras.length - 1;
  return frase.moras.map((mora, i) => {
    const dicha = i === ultima && i > 0 && mora === 'は' && frase.texto.endsWith('は') ? 'わ' : i === ultima && i > 0 && mora === 'へ' && frase.texto.endsWith('へ') ? 'え' : mora;
    const f = fonemasDeMora(dicha, vocal);
    const fin = f[f.length - 1];
    if (fin && /^[aiueo]$/.test(fin)) vocal = fin;
    return f;
  });
}

/** La kana pequeña que va con la anterior en la misma mora. */
const DE_LA_ANTERIOR = new Set(['ゃ', 'ゅ', 'ょ', 'ぁ', 'ぃ', 'ぅ', 'ぇ', 'ぉ', 'ゎ']);

/**
 * Los fonemas de narabas de una pronunciación en kana, mora a mora: la っ, la ん y la raya larga, que repite la vocal
 * anterior (`vocal`), también.
 */
export function fonemasDePronunciacion(kana: string, vocal: string | null = null): string[] {
  const moras: string[] = [];
  for (const c of aHiragana(kana)) {
    if (DE_LA_ANTERIOR.has(c) && moras.length) moras[moras.length - 1] += c;
    else moras.push(c);
  }
  const salida: string[] = [];
  let anterior = vocal;
  for (const m of moras) {
    const f = fonemasDeMora(m, anterior);
    const fin = f[f.length - 1];
    if (fin && /^[aiueo]$/.test(fin)) anterior = fin;
    salida.push(...f);
  }
  return salida;
}

/** Cada letra latina como suena más o menos en japonés: narabas solo conoce los fonemas del japonés. */
const LATINA: Record<string, string[]> = {
  a: ['a'], b: ['b'], c: ['k'], d: ['d'], e: ['e'], f: ['f'], g: ['g'], h: ['h'], i: ['i'], j: ['j'], k: ['k'], l: ['r'], m: ['m'],
  n: ['n'], o: ['o'], p: ['p'], q: ['k'], r: ['r'], s: ['s'], t: ['t'], u: ['u'], v: ['b'], w: ['w'], x: ['k', 's'], y: ['y'], z: ['z'],
};
const DIGRAFOS: [string, string[]][] = [['sh', ['sh']], ['ch', ['ch']], ['th', ['s']], ['ph', ['f']], ['wh', ['w']], ['ck', ['k']], ['ts', ['ts']]];

/**
 * Unos fonemas aproximados para una palabra en letras latinas («Oh», «Whoa», «baby»): narabas no la entiende, pero así
 * ocupa su sitio antes de lo que sigue. Una h tras vocal no suena, ni las letras repetidas.
 */
export function fonemasDeLatina(palabra: string): string[] {
  const p = palabra.toLowerCase().replace(/[^a-z]/g, '');
  const salida: string[] = [];
  for (let i = 0; i < p.length; ) {
    const digrafo = DIGRAFOS.find(([d]) => p.startsWith(d, i));
    if (digrafo) {
      salida.push(...digrafo[1]);
      i += 2;
      continue;
    }
    const c = p[i];
    const tras = salida[salida.length - 1];
    if (!(c === 'h' && tras && /^[aiueo]$/.test(tras)) && c !== p[i - 1]) salida.push(...(LATINA[c] ?? []));
    i++;
  }
  return salida;
}

/** Un token del analizador, con lo que hace falta para saber cómo suena. */
export interface TokenSonoro {
  surface_form: string;
  pronunciation?: string;
  reading?: string;
}

const SOLO_KANA = /^[ぁ-ゖァ-ヺー]+$/;

/**
 * Los fonemas de narabas de un verso ya analizado: la pronunciación que da el diccionario (la partícula は como わ, las
 * vocales largas con raya) y, para una palabra en letras latinas, unos aproximados. Para colocar una letra con la voz.
 */
export function fonemasDeTokens(tokens: readonly TokenSonoro[]): string[] {
  const salida: string[] = [];
  let vocal: string | null = null;
  for (const t of tokens) {
    const kana = t.pronunciation && t.pronunciation !== '*' ? t.pronunciation : t.reading && t.reading !== '*' ? t.reading : SOLO_KANA.test(t.surface_form) ? t.surface_form : '';
    const f: string[] = kana ? fonemasDePronunciacion(kana, vocal) : /[a-z]/i.test(t.surface_form) ? fonemasDeLatina(t.surface_form) : [];
    const fin: string | undefined = f[f.length - 1];
    if (fin && /^[aiueo]$/.test(fin)) vocal = fin;
    salida.push(...f);
  }
  return salida;
}
