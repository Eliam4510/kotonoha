import { describe, expect, it } from 'vitest';
import { referenciaEnGlosa } from './referencias';

describe('referenciaEnGlosa', () => {
  it('saca el opuesto con su lectura', () => {
    expect(referenciaEnGlosa('antonym: 下手（へた） 1. unskillful; poor; awkward')).toEqual({ tipo: 'opuesto', termino: '下手', lectura: 'へた' });
    expect(referenciaEnGlosa('antonym: ブラックリスト blacklist')).toEqual({ tipo: 'opuesto', termino: 'ブラックリスト' });
  });

  it('saca la palabra que hay que ver, sin el número de su sentido', () => {
    expect(referenciaEnGlosa('see: 天狗 1. tengu')).toEqual({ tipo: 'ver', termino: '天狗' });
    expect(referenciaEnGlosa('see: 上手（じょうず）・2 flattery')).toEqual({ tipo: 'ver', termino: '上手', lectura: 'じょうず' });
    expect(referenciaEnGlosa('see: ナイト・2')).toEqual({ tipo: 'ver', termino: 'ナイト' });
  });

  it('una definición normal no es una referencia', () => {
    expect(referenciaEnGlosa('skillful')).toBeNull();
    expect(referenciaEnGlosa('to see (something)')).toBeNull();
    expect(referenciaEnGlosa('antonym:')).toBeNull();
  });
});
