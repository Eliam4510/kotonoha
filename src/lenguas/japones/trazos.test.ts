import { describe, expect, it } from 'vitest';
import { archivoTrazos, caracteresConTrazos } from './trazos';

describe('archivoTrazos', () => {
  it('usa el punto de código con cinco cifras', () => {
    expect(archivoTrazos('漢')).toBe('06f22.svg');
    expect(archivoTrazos('一')).toBe('04e00.svg');
    expect(archivoTrazos('あ')).toBe('03042.svg');
  });

  it('también con los caracteres fuera del plano básico', () => {
    expect(archivoTrazos('𠮟')).toBe('20b9f.svg');
  });
});

describe('caracteresConTrazos', () => {
  it('enseña los kanji de la palabra, sin repetir', () => {
    expect(caracteresConTrazos('食べ物')).toEqual(['食', '物']);
    expect(caracteresConTrazos('人人')).toEqual(['人']);
  });

  it('una palabra sin kanji enseña su kana', () => {
    expect(caracteresConTrazos('ねこ')).toEqual(['ね', 'こ']);
    expect(caracteresConTrazos('テスト')).toEqual(['テ', 'ス', 'ト']);
  });

  it('el alargamiento y la marca de repetición no tienen trazos propios', () => {
    expect(caracteresConTrazos('コーヒー')).toEqual(['コ', 'ヒ']);
    expect(caracteresConTrazos('時々')).toEqual(['時']);
  });

  it('sin japonés no hay nada que enseñar', () => {
    expect(caracteresConTrazos('abc')).toEqual([]);
  });
});
