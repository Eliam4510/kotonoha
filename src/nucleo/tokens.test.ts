import { createRequire } from 'node:module';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  alinearFurigana,
  contarMoras,
  kataAHira,
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

  it('une compuestos conjugados usando el lema final', () => {
    const existe = (t: string) => t === '読み始める';
    const p = palabras('読み始めた', existe);
    expect(p[0]).toMatchObject({ superficie: '読み始めた', lema: '読み始める' });
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

