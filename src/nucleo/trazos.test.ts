import { describe, expect, it } from 'vitest';
import { archivoTrazos, caracteresConTrazos, hechosPorCaracter, leerTrazos } from './trazos';

const SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="109" height="109" viewBox="0 0 109 109" xmlns:kvg="https://kanjivg.tagaini.net/">
<g id="kvg:StrokePaths_04eba" style="fill:none;stroke:#000000;stroke-width:3;">
<g id="kvg:04eba" kvg:element="人">
  <path id="kvg:04eba-s2" kvg:type="㇏" d="M50.5,41.5c5,10,25.5,41,44,50.5"/>
  <path id="kvg:04eba-s1" kvg:type="㇒" d="M53.5,14.5c0,5-15,60-44,78.5"/>
</g>
</g>
<g id="kvg:StrokeNumbers_04eba" style="font-size:8;fill:#808080">
  <text transform="matrix(1 0 0 1 45.50 13.50)">1</text>
  <text transform="matrix(1 0 0 1 57.75 48.50)">2</text>
</g>
</svg>`;

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

describe('leerTrazos', () => {
  it('ordena los trazos por su número, no por su posición en el archivo', () => {
    const d = leerTrazos(SVG);
    expect(d?.trazos).toEqual(['M53.5,14.5c0,5-15,60-44,78.5', 'M50.5,41.5c5,10,25.5,41,44,50.5']);
  });

  it('saca dónde va cada número', () => {
    expect(leerTrazos(SVG)?.numeros).toEqual([{ x: 45.5, y: 13.5 }, { x: 57.75, y: 48.5 }]);
  });

  it('sin números, pone cada uno donde empieza su trazo', () => {
    const sinNumeros = SVG.replace(/<text[^>]*>\d+<\/text>/g, '');
    expect(leerTrazos(sinNumeros)?.numeros).toEqual([{ x: 53.5, y: 14.5 }, { x: 50.5, y: 41.5 }]);
  });

  it('un archivo sin trazos no da nada', () => {
    expect(leerTrazos('<svg></svg>')).toBeNull();
    expect(leerTrazos('Not found')).toBeNull();
  });

  it('descarta lo que no sean órdenes de trazado', () => {
    const malo = '<svg><path id="x-s1" d="M0,0"/><path id="x-s2" d="javascript:alert(1)"/><path id="x-s3" d="M1,1\\"onload=\\"x"/></svg>';
    expect(leerTrazos(malo)?.trazos).toEqual(['M0,0']);
  });
});

describe('hechosPorCaracter', () => {
  it('reparte los trazos dibujados entre los caracteres', () => {
    expect(hechosPorCaracter([4, 6], 0)).toEqual([0, 0]);
    expect(hechosPorCaracter([4, 6], 3)).toEqual([3, 0]);
    expect(hechosPorCaracter([4, 6], 4)).toEqual([4, 0]);
    expect(hechosPorCaracter([4, 6], 7)).toEqual([4, 3]);
    expect(hechosPorCaracter([4, 6], 10)).toEqual([4, 6]);
  });
});
