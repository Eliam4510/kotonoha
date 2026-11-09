import { describe, expect, it } from 'vitest';
import { MAXIMO_KOKORO, fonemasKokoro, frasesParaVoz, idsKokoro, prepararTextoIngles, unirAudio } from './vozNeuronal';

describe('las voces neuronales', () => {
  it('parten el texto en frases y las muy largas por las comas', () => {
    expect(frasesParaVoz('Hello world.  How are you today? Fine!')).toEqual(['Hello world.', 'How are you today?', 'Fine!']);
    expect(frasesParaVoz('Die Straßenbahn kommt gleich… Größer als üblich!')).toEqual(['Die Straßenbahn kommt gleich…', 'Größer als üblich!']);
    expect(frasesParaVoz('   ')).toEqual([]);
    const larga = Array.from({ length: 12 }, (_, i) => `this is part number ${i} of a very long sentence`).join(', ');
    const partes = frasesParaVoz(larga);
    expect(partes.length).toBeGreaterThan(1);
    expect(partes.every((p) => p.length <= 260)).toBe(true);
    expect(partes.join(' ')).toBe(larga);
  });

  it('preparan el inglés como kokoro-js: comillas rectas y tratamientos', () => {
    expect(prepararTextoIngles('“Mr. Smith’s car,” said Dr. Jones.')).toBe('"Mister Smith\'s car," said Doctor Jones.');
  });

  it('ajustan los fonemas de espeak-ng a los de Kokoro', () => {
    expect(fonemasKokoro('ðə rˈɛd kˈɑːɹ', true)).toBe('ðə ɹˈɛd kˈɑːɹ');
    expect(fonemasKokoro('nˈaɪnti', true)).toBe('nˈaɪndi');
    expect(fonemasKokoro('nˈaɪnti', false)).toBe('nˈaɪnti');
    expect(fonemasKokoro('lˈɔx ɬ', false)).toBe('lˈɔk l');
  });

  it('dan los identificadores entre dos «$» y sin pasar del máximo', () => {
    const vocabulario = new Map([
      ['h', 50],
      ['ə', 83],
      ['l', 54],
      [' ', 16],
    ]);
    expect(idsKokoro('hə l?', vocabulario)).toEqual([0, 50, 83, 16, 54, 0]);
    const ids = idsKokoro('h'.repeat(MAXIMO_KOKORO + 40), vocabulario);
    expect(ids).toHaveLength(MAXIMO_KOKORO + 2);
    expect(ids[0]).toBe(0);
    expect(ids.at(-1)).toBe(0);
  });

  it('unen el audio de las frases con una pausa', () => {
    const audio = unirAudio([new Float32Array([1, 1]), new Float32Array([2])], 10, 0.3);
    expect([...audio]).toEqual([1, 1, 0, 0, 0, 2]);
  });
});
