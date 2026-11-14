import { createRequire } from 'node:module';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  alinearFurigana,
  contarMoras,
  kanaARomaji,
  kataAHira,
  lecturaVisible,
  patronAcento,
  pegarSignos,
  separarMoras,
  type TokenCrudo,
  unirTokens,
} from './tokens';

const require = createRequire(import.meta.url);
const kuromoji = require('kuromoji');

let tokenizador: { tokenize(t: string): TokenCrudo[] };

beforeAll(async () => {
  tokenizador = await new Promise((ok, mal) => {
    kuromoji.builder({ dicPath: 'node_modules/kuromoji/dict' }).build((e: Error | null, t: typeof tokenizador) => (e ? mal(e) : ok(t)));
  });
}, 60000);

const palabras = (texto: string, existe?: (t: string) => boolean) =>
  unirTokens(tokenizador.tokenize(texto), existe);

describe('furigana', () => {
  it('pone la lectura solo sobre los kanji', () => {
    expect(alinearFurigana('立ち上がる', 'タチアガル')).toEqual([
      { texto: '立', lectura: 'た' },
      { texto: 'ち' },
      { texto: '上', lectura: 'あ' },
      { texto: 'がる' },
    ]);
    expect(alinearFurigana('食べる', 'たべる')).toEqual([{ texto: '食', lectura: 'た' }, { texto: 'べる' }]);
    expect(alinearFurigana('世界', 'せかい')).toEqual([{ texto: '世界', lectura: 'せかい' }]);
    expect(alinearFurigana('ねこ', 'ねこ')).toEqual([{ texto: 'ねこ' }]);
  });

  it('no falla si la lectura no encaja', () => {
    expect(alinearFurigana('今日は', 'あ')).toEqual([{ texto: '今日は', lectura: 'あ' }]);
  });

  it('convierte katakana', () => {
    expect(kataAHira('タベル')).toBe('たべる');
  });
});

describe('unión de tokens con Kuromoji real', () => {
  it('une la conjugación con su verbo', () => {
    const p = palabras('咲いた花');
    expect(p.map((x) => x.superficie)).toEqual(['咲いた', '花']);
    expect(p[0]).toMatchObject({ lema: '咲く', lectura: 'さいた', flexion: ['た'], inflexionado: true });
  });

  it('une cadenas largas', () => {
    const p = palabras('食べている');
    expect(p).toHaveLength(1);
    expect(p[0].lema).toBe('食べる');
    expect(p[0].flexion).toEqual(['て', 'いる']);
  });

  it('une los negativos y adjetivos', () => {
    expect(palabras('行かなかった')[0]).toMatchObject({ superficie: '行かなかった', lema: '行く' });
    expect(palabras('高くない')[0]).toMatchObject({ superficie: '高くない', lema: '高い' });
  });

  it('une する con su sustantivo', () => {
    expect(palabras('勉強します')[0]).toMatchObject({ superficie: '勉強します', lema: '勉強' });
  });

  it('marca las partículas como gramática y los símbolos como no palabra', () => {
    const p = palabras('猫が、鳴く');
    const ga = p.find((x) => x.superficie === 'が')!;
    const coma = p.find((x) => x.superficie === '、')!;
    expect(ga.esGramatica).toBe(true);
    expect(coma.esPalabra).toBe(false);
    expect(p.find((x) => x.superficie === '猫')!.esGramatica).toBe(false);
  });

  it('no trata el texto latino como palabra', () => {
    const p = palabras('I love 猫');
    expect(p.filter((x) => x.esPalabra).map((x) => x.superficie)).toEqual(['猫']);
  });

  it('usa el diccionario para los compuestos', () => {
    const existe = (t: string) => t === '泥だらけ';
    const p = palabras('泥だらけで', existe);
    expect(p[0]).toMatchObject({ superficie: '泥だらけ', lema: '泥だらけ' });
    expect(p[1].superficie).toBe('で');
  });

  it('corrige las lecturas de IPADIC que no valen: 環 suelto y los kanji que van como sufijo', () => {
    const lectura = (texto: string, superficie: string, existe?: (t: string) => boolean) => palabras(texto, existe).find((p) => p.superficie === superficie)?.lectura;
    expect(lectura('この環に結合する', '環')).toBe('かん');
    expect(lectura('ベンゼン環の構造', '環')).toBe('かん');
    expect(lectura('メチル基が結合', '基')).toBe('き');
    expect(lectura('電子殻', '殻')).toBe('かく');
    expect(lectura('炭素鎖が長い', '鎖')).toBe('さ');
    // Con el compuesto en el diccionario, su lectura sale entera y bien.
    expect(lectura('官能基を持つ', '官能基', (t) => t === '官能基')).toBe('かんのうき');
    // Suelto o tras una partícula, la palabra de siempre.
    expect(lectura('卵の殻を割る', '殻')).toBe('から');
    expect(lectura('鎖につながれた', '鎖')).toBe('くさり');
  });

  it('une compuestos conjugados usando el lema final', () => {
    const existe = (t: string) => t === '読み始める';
    const p = palabras('読み始めた', existe);
    expect(p[0]).toMatchObject({ superficie: '読み始めた', lema: '読み始める' });
  });

  it('sin expresiones, las que llevan una partícula dentro quedan en sus palabras, y los compuestos no', () => {
    const existe = (t: string) => t === '雨が降る' || t === '泥だらけ';
    expect(palabras('雨が降っています', existe)[0]).toMatchObject({ superficie: '雨が降っています', lema: '雨が降る' });
    const sueltas = unirTokens(tokenizador.tokenize('雨が降っています。泥だらけで'), existe, { expresiones: false });
    expect(sueltas.filter((x) => x.esPalabra).map((x) => x.superficie)).toEqual(['雨', 'が', '降っています', '泥だらけ', 'で']);
  });

  it('mantiene la frase íntegra', () => {
    const frase = '一日でも休むと、ペースが遅れてしまうので、できるだけ毎日やるようにしています。';
    expect(palabras(frase).map((x) => x.superficie).join('')).toBe(frase);
  });
});

describe('acento', () => {
  it('clasifica los patrones como en las capturas de referencia', () => {
    expect(patronAcento(0, 'わたし')).toBe('heiban');
    expect(patronAcento(1, 'あか')).toBe('atamadaka');
    expect(patronAcento(1, 'せかい')).toBe('atamadaka');
    expect(patronAcento(2, 'はな')).toBe('odaka');
    expect(patronAcento(2, 'たべる')).toBe('nakadaka');
    expect(patronAcento(3, 'みにくい')).toBe('nakadaka');
  });

  it('cuenta moras agrupando las pequeñas', () => {
    expect(contarMoras('きょう')).toBe(2);
    expect(separarMoras('きょう')).toEqual(['きょ', 'う']);
    expect(separarMoras('がっこう')).toEqual(['が', 'っ', 'こ', 'う']);
  });
});

describe('signos y cortes de línea', () => {
  const UNIR = '⁠';

  it('un signo de cierre no puede empezar una línea', () => {
    expect(pegarSignos('。')).toBe(`${UNIR}。`);
    expect(pegarSignos('」、')).toBe(`${UNIR}」、`);
  });

  it('un signo de apertura no puede terminar una línea', () => {
    expect(pegarSignos('「')).toBe(`「${UNIR}`);
  });

  it('el resto no cambia', () => {
    expect(pegarSignos('ABC')).toBe('ABC');
    expect(pegarSignos(' ')).toBe(' ');
  });
});

describe('rōmaji', () => {
  it('convierte con Hepburn', () => {
    expect(kanaARomaji('たべる')).toBe('taberu');
    expect(kanaARomaji('しゃしん')).toBe('shashin');
    expect(kanaARomaji('がっこう')).toBe('gakkou');
    expect(kanaARomaji('まっちゃ')).toBe('matcha');
    expect(kanaARomaji('コーヒー')).toBe('kōhī');
    expect(kanaARomaji('ほんや')).toBe("hon'ya");
    expect(kanaARomaji('ふじさん')).toBe('fujisan');
  });

  it('muestra la lectura en el formato elegido', () => {
    expect(lecturaVisible('たべる', 'hiragana')).toBe('たべる');
    expect(lecturaVisible('たべる', 'katakana')).toBe('タベル');
    expect(lecturaVisible('たべる', 'romaji')).toBe('taberu');
    expect(lecturaVisible('たべる', undefined)).toBe('たべる');
  });
});
