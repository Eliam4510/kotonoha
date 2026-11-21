import { describe, expect, it } from 'vitest';
import { expandirRasgos, leerVocabulario, SIMBOLOS_SBV2, tensoresSbv2, tokensBert, vectorDeEstilo } from './sbv2';

const id = (s: string) => SIMBOLOS_SBV2.indexOf(s as (typeof SIMBOLOS_SBV2)[number]);

// こんにちは。, como lo prepara g2p.py: una palabra de 9 fonemas repartidos entre 5 caracteres (2, 2, 2, 2, 1) y el punto.
const KONNICHIWA = {
  fonemas: ['_', 'k', 'o', 'N', 'n', 'i', 'ch', 'i', 'w', 'a', '.', '_'],
  tonos: [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0],
  textoBert: 'こんにちは.',
  word2ph: [1, 2, 2, 2, 2, 1, 1, 1],
};

describe('los tensores de la voz', () => {
  it('la tabla de símbolos es la de Style-Bert-VITS2', () => {
    expect(SIMBOLOS_SBV2.length).toBe(112);
    expect(id('_')).toBe(0);
    expect(id('N')).toBe(5);
    expect(id('q')).toBe(73);
    expect(id('…')).toBe(105);
    expect(id('UNK')).toBe(111);
  });

  it('intercala un 0 entre cada dos fonemas y lleva los tonos y la lengua a su sitio', () => {
    const t = tensoresSbv2(KONNICHIWA);
    expect(t.x).toHaveLength(25);
    expect(t.x.slice(0, 6)).toEqual([0, id('_'), 0, id('k'), 0, id('o')]);
    expect(t.x.at(-1)).toBe(0);
    // Tonos desde el 6; el 0 intercalado no se mueve.
    expect(t.tonos.slice(0, 8)).toEqual([0, 6, 0, 6, 0, 6, 0, 7]);
    expect(new Set(t.lenguas.filter((_, i) => i % 2))).toEqual(new Set([1]));
    expect(t.word2ph).toEqual([3, 4, 4, 4, 4, 2, 2, 2]);
    expect(t.word2ph.reduce((a, b) => a + b, 0)).toBe(t.x.length);
  });

  it('no deja pasar una entrada que no cuadra', () => {
    expect(() => tensoresSbv2({ ...KONNICHIWA, tonos: KONNICHIWA.tonos.slice(1) })).toThrow(/tonos/);
    expect(() => tensoresSbv2({ ...KONNICHIWA, word2ph: [1, 2, 2, 2, 2, 2, 1, 1] })).toThrow(/suma/);
    expect(() => tensoresSbv2({ ...KONNICHIWA, textoBert: 'こんにちは' })).toThrow(/caracteres/);
    expect(() => tensoresSbv2({ ...KONNICHIWA, fonemas: KONNICHIWA.fonemas.map((f) => (f === 'k' ? 'kk' : f)) })).toThrow(/kk/);
  });
});

describe('el BERT', () => {
  const vocabulario = leerVocabulario('[PAD]\r\n[UNK]\r\n[CLS]\r\n[SEP]\r\n[MASK]\r\nこ\r\nん\r\n.');

  it('lee vocab.txt con su número de línea', () => {
    expect(vocabulario.get('[CLS]')).toBe(2);
    expect(vocabulario.get('.')).toBe(7);
  });

  it('un token por carácter, entre [CLS] y [SEP], y [UNK] para lo que no conoce', () => {
    expect(tokensBert('こん.', vocabulario)).toEqual([2, 5, 6, 7, 3]);
    expect(tokensBert('こx', vocabulario)).toEqual([2, 5, 1, 3]);
  });

  it('repite los rasgos de cada token para sus fonemas, por columnas', () => {
    // Dos tokens de dimensión 2: [1, 2] y [3, 4]; al primero le tocan 1 fonema y al segundo 2.
    const r = expandirRasgos(Float32Array.from([1, 2, 3, 4]), [1, 2], 2);
    expect([...r]).toEqual([1, 3, 3, 2, 4, 4]);
    expect(() => expandirRasgos(Float32Array.from([1, 2, 3]), [1, 2], 2)).toThrow();
  });
});

describe('el estilo', () => {
  // Dos estilos de dimensión 2: la media [1, 1] y otro [3, 5].
  const vectores = Float32Array.from([1, 1, 3, 5]);

  it('el 0 es la media, y los demás se alejan de ella según el peso', () => {
    expect([...vectorDeEstilo(vectores, 0, 1, 2)]).toEqual([1, 1]);
    expect([...vectorDeEstilo(vectores, 1, 1, 2)]).toEqual([3, 5]);
    expect([...vectorDeEstilo(vectores, 1, 0.5, 2)]).toEqual([2, 3]);
  });

  it('un estilo que no existe es un error', () => {
    expect(() => vectorDeEstilo(vectores, 2, 1, 2)).toThrow(/estilo 2/);
  });
});
