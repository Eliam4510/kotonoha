import { describe, expect, it } from 'vitest';
import { contarEscrituras, esTextoChino, paginaEnChino, pareceChino } from './escritura';
import { detectarGramatica } from './gramatica';
import { limpiarGlosa, recortarGlosa } from './motor';
import { analizarChino, corregirContexto, elegirLectura, partirIdeogramas } from './tokens';
import { CHINO } from '.';

describe('cuándo un texto es chino', () => {
  it('con kana o hangul no lo es; declarado en chino, basta con ideogramas', () => {
    expect(esTextoChino('我们去银行吧', undefined, false)).toBe(true);
    expect(esTextoChino('日本語を勉強する', 'ja', false)).toBe(false);
    expect(esTextoChino('日本語を勉強する', undefined, true)).toBe(false);
    // Un の suelto se usa a veces como adorno en chino: en una página china, sigue siendo chino.
    expect(esTextoChino('我の小店', undefined, true)).toBe(true);
    expect(esTextoChino('한국어 공부', 'zh', true)).toBe(false);
    expect(esTextoChino('日本語能力試験', 'zh-CN', false)).toBe(true);
  });

  it('un título solo de ideogramas en una página que no es china, solo si lo parece', () => {
    expect(esTextoChino('日本語能力試験', undefined, false)).toBe(false);
    expect(esTextoChino('日本語能力試験', 'ja', true)).toBe(false);
    expect(esTextoChino('你好', 'es', false)).toBe(true);
    expect(pareceChino('银行')).toBe(false);
    expect(pareceChino('这个')).toBe(true);
  });

  it('una página es china con muchos ideogramas y casi nada de kana', () => {
    expect(paginaEnChino(contarEscrituras('我们今天去银行取钱，然后去学校看朋友。'.repeat(2)))).toBe(true);
    expect(paginaEnChino(contarEscrituras('今日は銀行へ行ってから、学校で友達に会いました。'.repeat(2)))).toBe(false);
  });
});

// Un diccionario y una lista de frecuencia de juguete, con los puestos de FrequencyWords.
const TERMINOS = new Set(['我', '我们', '今天', '去', '银行', '银', '行', '取', '钱', '然后', '学校', '学', '校', '他', '长', '得', '很', '高', '意思', '有', '有点儿', '点', '儿', '研究', '研究生', '生命', '的', '起源', '北京', '北京大学', '大学']);
const PUESTOS: Record<string, number> = { 我: 2, 我们: 8, 去: 21, 今天: 156, 然后: 120, 银行: 1202, 行: 300, 银: 9000, 学校: 575, 他: 7, 很: 23, 高: 600, 得: 150, 长: 900, 意思: 217, 有: 13, 有点儿: 6079, 研究: 1500, 研究生: 8000, 生命: 2000, 的: 1, 起源: 9000, 北京: 5775, 大学: 1500 };
const existe = (t: string) => TERMINOS.has(t);
const rango = (t: string) => PUESTOS[t];
const LECTURAS: Record<string, string[]> = { 行: ['xíng', 'háng', 'Háng'], 长: ['cháng', 'zhǎng'], 得: ['dé', 'de', 'děi'], 意思: ['yìsi'], 银行: ['yínháng'], 我们: ['wǒmen'], 北京: ['Běijīng'] };

describe('partir en palabras', () => {
  it('gana la palabra del diccionario más usada', () => {
    expect(partirIdeogramas('我们今天去银行取钱', existe, rango)).toEqual(['我们', '今天', '去', '银行', '取', '钱']);
  });

  it('entre dos cortes posibles, el más probable: 研究 生命, y no 研究生 命', () => {
    expect(partirIdeogramas('研究生命的起源', existe, rango)).toEqual(['研究', '生命', '的', '起源']);
  });

  it('sin diccionario, carácter a carácter', () => {
    expect(partirIdeogramas('银行')).toEqual(['银', '行']);
  });
});

describe('el pinyin de cada palabra', () => {
  it('el del diccionario si solo hay uno: 意思 es yìsi, aunque en contexto salga yì sī', () => {
    expect(elegirLectura(['yìsi'], 'yìsī')).toBe('yìsi');
  });

  it('entre varios, el que casa con el contexto; en minúscula antes que un nombre propio', () => {
    expect(elegirLectura(LECTURAS['行'], 'háng')).toBe('háng');
    expect(elegirLectura(LECTURAS['行'], 'xíng')).toBe('xíng');
    expect(elegirLectura(['Zhāng', 'zhāng'], 'zhāng')).toBe('zhāng');
  });

  it('sin entrada en el diccionario, el del contexto', () => {
    expect(elegirLectura(undefined, 'nǐhǎo')).toBe('nǐhǎo');
  });

  it('corrige donde pinyin-pro se equivoca: 长得 es zhǎng de', () => {
    expect(corregirContexto(['他', '长', '得', '很', '高'], [['tā'], ['cháng'], ['dé'], ['hěn'], ['gāo']])).toEqual([['tā'], ['zhǎng'], ['de'], ['hěn'], ['gāo']]);
  });
});

describe('el análisis entero', () => {
  // La lectura en contexto, de juguete: la primera del diccionario, sílaba a sílaba.
  const SILABA: Record<string, string> = { 我: 'wǒ', 们: 'men', 去: 'qù', 银: 'yín', 行: 'háng', 吧: 'ba', 北: 'běi', 京: 'jīng' };
  const enContexto = (s: string) => [...s].map((c) => SILABA[c] ?? '');
  const consultas = { rango, lecturas: (t: string) => LECTURAS[t] };

  it('cada palabra con su pinyin repartido, y los signos aparte', () => {
    const t = analizarChino('我们去银行吧。', enContexto, existe, consultas);
    expect(t.map((x) => x.superficie)).toEqual(['我们', '去', '银行', '吧', '。']);
    expect(t[2]).toMatchObject({ lema: '银行', lectura: 'yínháng', esPalabra: true, furigana: [{ texto: '银', lectura: 'yín' }, { texto: '行', lectura: 'háng' }] });
    expect(t[3]).toMatchObject({ esGramatica: true, categoria: 'particula' });
    expect(t[4]).toMatchObject({ esPalabra: false });
    expect(t.map((x) => x.superficie).join('')).toBe('我们去银行吧。');
  });

  it('un nombre propio, por la mayúscula de su pinyin', () => {
    const [b] = analizarChino('北京', enContexto, existe, consultas);
    expect(b).toMatchObject({ lectura: 'Běijīng', nombre: true });
  });

  it('las letras latinas y las cifras no son palabras chinas', () => {
    const t = analizarChino('我有3个iPhone', enContexto, existe, consultas);
    expect(t.find((x) => x.superficie === 'iPhone')).toMatchObject({ esPalabra: false });
    expect(t.find((x) => x.superficie === '3')).toMatchObject({ esPalabra: false, categoria: 'numero' });
  });
});

describe('la gramática sin IA', () => {
  const patrones = (t: string) => detectarGramatica(t).map((p) => p.patron);

  it('encuentra las construcciones comunes', () => {
    expect(patrones('我把书放在桌子上了。')).toContain('把');
    expect(patrones('他比我高很多。')).toContain('比');
    expect(patrones('天气越来越冷了。')).toContain('越来越');
    expect(patrones('虽然很累，但是很开心。')).toContain('虽然…但是');
    expect(patrones('他跑得很快。')).toContain('得');
    expect(patrones('你是不是学生？')).toContain('A不A');
  });

  it('y no marca lo que solo se le parece', () => {
    expect(patrones('我觉得很好。')).not.toContain('得');
    expect(patrones('我们去比赛吧。')).not.toContain('比');
    expect(patrones('我了解这个问题。')).not.toContain('了');
    expect(patrones('被子很暖和。')).not.toContain('被');
  });
});

describe('el paquete', () => {
  it('prefiere las pistas simplificadas', () => {
    const p = CHINO.pistasPreferidas!;
    expect(p.indexOf('zh-Hans')).toBeLessThan(p.indexOf('zh-Hant'));
  });

  it('las definiciones de CC-CEDICT, como se enseñan: el clasificador y las referencias en simplificado', () => {
    expect(limpiarGlosa('CL:家,個｜个')).toBe('量词：家、个');
    expect(limpiarGlosa('variant of 個｜个')).toBe('variant of 个');
    expect(limpiarGlosa('bank')).toBe('bank');
  });

  it('la glosa corta de CC-CEDICT, sin notas', () => {
    expect(recortarGlosa('bank')).toBe('bank');
    expect(recortarGlosa('(bound form) row; line')).toBe('row');
    expect(recortarGlosa('to grow; to develop')).toBe('to grow');
    expect(recortarGlosa('(third-person singular) (since the early 20th century, usu. male) he; him; his')).toBe('he');
  });

  it('el saludo, según la hora', () => {
    expect(CHINO.saludo(8, '')).toBe('早上好');
    expect(CHINO.saludo(21, 'Ana')).toBe('Ana，晚上好');
  });
});
