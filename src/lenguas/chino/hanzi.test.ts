import { describe, expect, it } from 'vitest';
import { leerDiccionarioHanzi, leerIds, leerTrazosHanzi } from './hanzi';

// Líneas con la forma de las de Make Me a Hanzi (una por carácter), escritas para la prueba.
const linea = (o: Record<string, unknown>) => JSON.stringify(o);
const MMAH = [
  linea({ character: '江', definition: 'large river; yangtze', pinyin: ['jiāng'], decomposition: '⿰氵工', etymology: { type: 'pictophonetic', phonetic: '工', semantic: '氵', hint: 'water' }, radical: '氵', matches: [[0], [0], [0], [1], [1], [1]] }),
  linea({ character: '工', definition: 'labor, work', pinyin: ['gōng'], decomposition: '？', etymology: { type: 'pictographic', hint: "A carpenter's square" }, radical: '工', matches: [[], [], []] }),
  linea({ character: '红', definition: 'red', pinyin: ['hóng'], decomposition: '⿰纟工', etymology: { type: 'pictophonetic', phonetic: '工', semantic: '纟' }, radical: '纟' }),
  linea({ character: '功', definition: 'merit', pinyin: ['gōng'], decomposition: '⿰工力', etymology: { type: 'pictophonetic', phonetic: '工', semantic: '力' }, radical: '力' }),
  linea({ character: '攻', definition: 'to attack', pinyin: ['gōng'], decomposition: '⿰工攵', etymology: { type: 'pictophonetic', phonetic: '工', semantic: '攵' }, radical: '攵' }),
  linea({ character: '妈', definition: 'mother', pinyin: ['mā'], decomposition: '⿰女马', etymology: { type: 'pictophonetic', phonetic: '马', semantic: '女', hint: 'Simplified form of 媽; woman' }, radical: '女' }),
  linea({ character: '马', definition: 'horse', pinyin: ['mǎ'], decomposition: '？', etymology: { type: 'pictographic', hint: 'Simplified form of 馬' }, radical: '马' }),
  linea({ character: '女', definition: 'woman', pinyin: ['nǚ'], decomposition: '？', radical: '女' }),
  linea({ character: '地', definition: 'earth; structural particle', pinyin: ['de'], decomposition: '⿰土也', etymology: { type: 'pictophonetic', phonetic: '也', semantic: '土' }, radical: '土' }),
  linea({ character: '都', definition: 'metropolis; all', pinyin: ['dōu'], decomposition: '⿰者阝', radical: '阝' }),
  linea({ character: '阳', definition: 'sun', pinyin: ['yáng'], decomposition: '⿰阝日', radical: '阝' }),
  'esta línea está rota',
].join('\n');
const HSK = JSON.stringify({ niveles: { 'HSK 1': [['妈', 'mā', '', 'mom']], 'HSK 2': [['地', 'dì、de', '', 'earth']], 'HSK 4': [['江', 'jiāng', '', 'river']] } });

describe('los trazos de Hanzi Writer', () => {
  it('pasan del lienzo de 1024, con la y hacia arriba, al de 109 de KanjiVG', () => {
    const d = leerTrazosHanzi(JSON.stringify({ strokes: ['M 100 400 L 900 400'], medians: [[[100, 400], [500, 400], [900, 400]]] }))!;
    expect(d.trazos).toHaveLength(1);
    expect(d.trazos[0]).toMatch(/^M10\.6,53\.2 C/);
    // El número va un poco antes de donde empieza el trazo, sin salirse.
    expect(d.numeros[0]).toEqual({ x: 5.6, y: 53.2 });
    // Las piezas las trae el diccionario: la lista vacía dice que no hay que volver a pedirlos.
    expect(d.componentes).toEqual([]);
  });

  it('y lo que no es un archivo de trazos no se lee', () => {
    expect(leerTrazosHanzi('no es JSON')).toBeNull();
    expect(leerTrazosHanzi(JSON.stringify({ strokes: [] }))).toBeNull();
  });
});

describe('las secuencias de descripción ideográfica', () => {
  it('se leen como un árbol', () => {
    expect(leerIds('⿰氵工')).toEqual({ op: '⿰', hijos: [{ c: '氵', hijos: [] }, { c: '工', hijos: [] }] });
    expect(leerIds('⿱艹⿰氵各')?.hijos[1]).toEqual({ op: '⿰', hijos: [{ c: '氵', hijos: [] }, { c: '各', hijos: [] }] });
    expect(leerIds('⿰氵')).toBeNull();
    expect(leerIds(undefined)).toBeNull();
  });
});

describe('el diccionario de hanzi', () => {
  const fichas = new Map(leerDiccionarioHanzi({ makemeahanzi: MMAH, hsk: HSK }).map((f) => [f.caracter, f]));

  it('lee cada carácter, y una línea rota no estropea las demás', () => {
    expect(fichas.size).toBe(11);
    expect(fichas.get('江')?.significados.en).toEqual(['large river', 'yangtze']);
    expect(fichas.get('江')?.trazos).toBe(6);
  });

  it('las lecturas de las listas del HSK van primero, sin repetirse, y con ellas su nivel', () => {
    expect(fichas.get('地')?.on.oficiales.map((l) => l.texto)).toEqual(['dì', 'de']);
    expect(fichas.get('地')?.nivel).toBe('HSK 2');
    expect(fichas.get('江')?.nivel).toBe('HSK 4');
    expect(fichas.get('工')?.nivel).toBeUndefined();
  });

  it('el radical, con la forma que toma y el nombre con que se dice en clase', () => {
    expect(fichas.get('江')?.radical).toEqual({ caracter: '水', forma: '氵', numero: 85, nombres: ['三点水'], significado: 'water' });
    // 阝 es 邑 a la derecha y 阜 a la izquierda.
    expect(fichas.get('都')?.radical).toMatchObject({ caracter: '邑', numero: 163, nombres: ['右耳旁'] });
    expect(fichas.get('阳')?.radical).toMatchObject({ caracter: '阜', numero: 170, nombres: ['左耳旁'] });
  });

  it('cómo se formó: las piezas, la que da el sonido y la que da el significado', () => {
    const j = fichas.get('江')!;
    expect(j.formacion).toBe('fonosemantico');
    expect(j.fonetico).toBe('工');
    expect(j.semantico).toBe('氵');
    expect(j.pista).toBe('water');
    expect(j.componentes).toEqual([
      { caracter: '氵', original: '水', radical: true, piezas: [] },
      { caracter: '工', piezas: [] },
    ]);
    expect(j.piezas).toEqual(expect.arrayContaining(['氵', '工']));
  });

  it('el que da su sonido a otros, y con qué lectura', () => {
    // 江, 红, 功 y 攻 lo llevan; solo 功 y 攻 se leen gong.
    expect(fichas.get('工')?.daSonido).toEqual({ lecturas: ['gong'], tipo: 'varias' });
  });

  it('la forma tradicional y los que se leen igual, con el mismo tono o con otro', () => {
    expect(fichas.get('妈')?.variantes.tradicional).toBe('媽');
    expect(fichas.get('工')?.homonimos).toContainEqual({ lectura: 'gōng', caracteres: ['功', '攻'], mismoAcento: true });
    expect(fichas.get('马')?.homonimos).toContainEqual({ lectura: 'ma', caracteres: ['妈'], mismoAcento: false });
    // Un radical sabe qué formas toma como pieza, para encontrar los caracteres que lo llevan.
    expect(fichas.get('女')?.formasComoPieza).toEqual([]);
  });

  it('sin las listas del HSK, valen las lecturas del diccionario', () => {
    const sola = leerDiccionarioHanzi({ makemeahanzi: MMAH, hsk: 'roto' }).find((f) => f.caracter === '地');
    expect(sola?.on.oficiales.map((l) => l.texto)).toEqual(['de']);
    expect(sola?.nivel).toBeUndefined();
  });
});
