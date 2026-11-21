import { describe, expect, it } from 'vitest';
import { esSoloPinyin, normalizarPinyin, numerosAMarcas, pinyinVisible, repartirPinyin, silabas, sinTonos, tonoDe } from './pinyin';

describe('las sílabas del pinyin', () => {
  it('parte la lectura de un diccionario, que va junta', () => {
    expect(silabas('yínháng')).toEqual(['yín', 'háng']);
    expect(silabas('yìsi')).toEqual(['yì', 'si']);
    expect(silabas('zhōnghuárénmíngònghéguó')).toEqual(['zhōng', 'huá', 'rén', 'mín', 'gòng', 'hé', 'guó']);
  });

  it('con el número de caracteres, elige la que da justo esas sílabas', () => {
    expect(silabas('xian', 1)).toEqual(['xian']);
    // En dos sílabas se escribe con apóstrofo; sin él, no las hay.
    expect(silabas("xi'an", 2)).toEqual(['xi', 'an']);
    expect(silabas('xian', 2)).toBeNull();
    expect(silabas('yǒudiǎnr', 3)).toEqual(['yǒu', 'diǎn', 'r']);
    expect(silabas('nǎr', 2)).toEqual(['nǎ', 'r']);
    expect(silabas('yǒudiǎnr', 5)).toBeNull();
  });

  it('el apóstrofo separa: fāng\'àn es 方案, y Xī\'ān, 西安', () => {
    expect(silabas("fāng'àn", 2)).toEqual(['fāng', 'àn']);
    expect(silabas("Xī'ān", 2)).toEqual(['Xī', 'ān']);
    // Sin él, la consonante va con la sílaba siguiente, como manda la ortografía del pinyin.
    expect(silabas('fangan', 2)).toEqual(['fan', 'gan']);
  });

  it('lo que no es pinyin no se parte', () => {
    expect(silabas('bank')).toBeNull();
    expect(silabas('Txù', 1)).toBeNull();
  });
});

describe('el pinyin sobre los caracteres', () => {
  it('una sílaba en cada ideograma', () => {
    expect(repartirPinyin('银行', 'yínháng')).toEqual([
      { texto: '银', lectura: 'yín' },
      { texto: '行', lectura: 'háng' },
    ]);
    expect(repartirPinyin('有点儿', 'yǒudiǎnr')).toEqual([
      { texto: '有', lectura: 'yǒu' },
      { texto: '点', lectura: 'diǎn' },
      { texto: '儿', lectura: 'r' },
    ]);
  });

  it('nada sobre letras y cifras; si no casa, la lectura entera sobre la palabra', () => {
    expect(repartirPinyin('卡拉OK', 'kǎlāOK')).toEqual([{ texto: '卡拉OK', lectura: 'kǎlāOK' }]);
    expect(repartirPinyin('T恤', 'Txù')).toEqual([{ texto: 'T恤', lectura: 'Txù' }]);
  });
});

describe('los tonos', () => {
  it('el de cada sílaba, y el neutro sin marca', () => {
    expect(['mā', 'má', 'mǎ', 'mà', 'ma', 'lǜ', 'ń'].map(tonoDe)).toEqual([1, 2, 3, 4, 5, 4, 2]);
  });

  it('sin tonos, para buscar', () => {
    expect(sinTonos('Běijīng')).toBe('beijing');
    expect(sinTonos('lǜ')).toBe('lü');
    expect(sinTonos("Xī'ān")).toBe('xian');
    expect(sinTonos('lv4')).toBe('lü4');
  });

  it('de números a marcas, y al revés para verlo con números', () => {
    expect(numerosAMarcas('ni3hao3')).toBe('nǐhǎo');
    expect(numerosAMarcas('lv4 se4')).toBe('lǜ sè');
    expect(numerosAMarcas('ma5')).toBe('ma');
    expect(numerosAMarcas('gou3')).toBe('gǒu');
    expect(numerosAMarcas('gui4')).toBe('guì');
    expect(pinyinVisible('yínháng', 'numeros')).toBe('yin2hang2');
    expect(pinyinVisible('yìsi', 'numeros')).toBe('yi4si');
    expect(pinyinVisible('yínháng', 'marcas')).toBe('yínháng');
  });

  it('normalizar deja la forma de CC-CEDICT: junta, y con apóstrofo donde hace falta', () => {
    expect(normalizarPinyin('ni3 hao3')).toBe('nǐhǎo');
    expect(normalizarPinyin('nǐ hǎo')).toBe('nǐhǎo');
    expect(normalizarPinyin("fāng'àn")).toBe("fāng'àn");
    expect(normalizarPinyin('fāng àn')).toBe("fāng'àn");
    expect(normalizarPinyin('Xī ān')).toBe("Xī'ān");
  });
});

describe('si se busca por pinyin', () => {
  it('nihao y ni3hao3 sí; bank o perro, no', () => {
    expect(esSoloPinyin('nihao')).toBe(true);
    expect(esSoloPinyin('ni3hao3')).toBe(true);
    expect(esSoloPinyin('nǐ hǎo')).toBe(true);
    expect(esSoloPinyin('bank')).toBe(false);
    expect(esSoloPinyin('perro')).toBe(false);
    expect(esSoloPinyin('你好')).toBe(false);
  });
});
