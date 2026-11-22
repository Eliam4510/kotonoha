// Las listas del HSK que genera herramientas/hsk.mjs, y la gramática sin IA que las acompaña.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizarPatron } from '../../nucleo/gramaticaAnki';
import { type DatosNivel, type FilaCaracter, type FilaGramatica, type FilaVocabulario, fraseConPatron, trozosDePatron } from '../../nucleo/niveles';
import { detectarGramatica, puntosGramatica } from './gramatica';
import { CHINO } from './index';

const leer = <T>(archivo: string): DatosNivel<T> => JSON.parse(readFileSync(new URL(`../../../publico/datos/hsk/${archivo}`, import.meta.url), 'utf8'));
const vocabulario = leer<FilaVocabulario>('vocabulario.json');
const hanzi = leer<FilaCaracter>('kanji.json');
const gramatica = leer<FilaGramatica>('gramatica.json');

describe('las listas del HSK', () => {
  it('tienen los niveles del paquete, del 1 al 7–9', () => {
    const niveles = CHINO.listasNivel!.niveles;
    expect(Object.keys(vocabulario.niveles)).toEqual(niveles);
    expect(Object.keys(hanzi.niveles)).toEqual(niveles);
    expect(Object.keys(gramatica.niveles)).toEqual(niveles);
  });

  it('con las palabras de cada nivel del temario, una sola vez y en el primero en que salen', () => {
    expect(vocabulario.niveles['HSK 1']).toHaveLength(300);
    const total = Object.values(vocabulario.niveles).reduce((s, f) => s + f.length, 0);
    expect(total).toBeGreaterThan(10_900);
    // 点 es de nivel 1 y el temario lo repite en el 3 por un uso nuevo.
    expect(vocabulario.niveles['HSK 3'].some(([p]) => p === '点')).toBe(false);
  });

  it('con la lectura del diccionario, que es la de las palabras guardadas, y no la del temario con sus cambios de tono', () => {
    const fila = (p: string) => Object.values(vocabulario.niveles).flat().find((f) => f[0] === p);
    expect(fila('不客气')?.[1]).toBe('bùkèqi');
    expect(fila('一点儿')?.[1]).toBe('yīdiǎnr');
    expect(fila('百')?.[1]).toBe('bǎi');
    // Una parte opcional del temario, 没（有）, da la otra forma y su lectura.
    expect(fila('没有')).toEqual(['没有', 'méiyǒu', expect.any(String), ['没'], ['méi']]);
    expect(Object.values(vocabulario.niveles).flat().every((f) => f[1].length > 0)).toBe(true);
    expect(Object.values(vocabulario.niveles).flat().filter((f) => !f[2])).toEqual([]);
  });

  it('los hanzi, con sus lecturas por orden de uso en las palabras de las listas', () => {
    const fila = (c: string) => Object.values(hanzi.niveles).flat().find((f) => f[0] === c);
    expect(fila('么')?.[1]).toBe('me');
    expect(fila('地')?.[1].split('、')[0]).toBe('dì');
    expect(fila('吧')?.[1].split('、')[0]).toBe('ba');
    expect(fila('觉')?.[1].split('、')[0]).toBe('jué');
    // Uno que solo se usa en una palabra lleva la glosa de esa palabra.
    expect(fila('圾')?.[3]).toMatch(/^垃圾: /);
    const todos = Object.values(hanzi.niveles).flat();
    expect(new Set(todos.map((f) => f[0])).size).toBe(todos.length);
    expect(todos.every((f) => f[1] && f[3])).toBe(true);
  });

  it('la gramática, con su explicación en español y en inglés', () => {
    const todos = Object.values(gramatica.niveles).flat();
    expect(todos.every(([, s]) => s.es && s.en)).toBe(true);
    expect(gramatica.niveles['HSK 2'].map(([p]) => p)).toContain('因为……，所以……');
    // Sin los números de los apartados del temario.
    expect(todos.some(([p]) => /^（\d+）/.test(p))).toBe(false);
  });
});

describe('la gramática sin IA, junto al temario', () => {
  const patrones = (t: string) => detectarGramatica(t).map((p) => p.patron);

  it('cada regla está en el nivel en que el temario enseña su punto', () => {
    const delTemario = new Map<string, string[]>();
    for (const [nivel, filas] of Object.entries(gramatica.niveles)) {
      for (const [p] of filas) delTemario.set(normalizarPatron(p), [...(delTemario.get(normalizarPatron(p)) ?? []), nivel]);
    }
    const enOtroNivel = puntosGramatica().filter((r) => delTemario.has(normalizarPatron(r.patron)) && !delTemario.get(normalizarPatron(r.patron))!.includes(r.nivel));
    expect(enOtroNivel).toEqual([]);
    expect(puntosGramatica().every((r) => CHINO.listasNivel!.niveles.includes(r.nivel))).toBe(true);
  });

  it('encuentra las construcciones nuevas', () => {
    expect(patrones('我们还是坐地铁吧。')).toContain('还是…吧');
    expect(patrones('都十点了，他还没来。')).toContain('都…了');
    expect(patrones('我一点儿也不累。')).toContain('一点儿也不');
    expect(patrones('难道你不知道吗？')).toContain('难道…吗');
    expect(patrones('他不是老师，而是学生。')).toContain('不是…而是');
    expect(patrones('快走吧，否则就来不及了。')).toEqual(expect.arrayContaining(['否则', '来得及']));
    expect(patrones('他在房间里走来走去。')).toContain('A来A去');
    expect(patrones('哪怕下雨，我也要去。')).toContain('哪怕…也');
    expect(patrones('除非你去，否则我不去。')).toContain('除非…否则');
    expect(patrones('累死了！')).toContain('…死了');
  });

  it('y no marca lo que solo se le parece', () => {
    expect(patrones('太阳出来了。')).not.toContain('太…了');
    expect(patrones('不如我们去吧。')).not.toContain('A不如B');
    expect(patrones('主要是时间不够。')).not.toContain('要是');
    expect(patrones('我们都一起去了。')).not.toContain('都…了');
    expect(patrones('他从地上拿起书。')).not.toContain('从…起');
  });

  it('una construcción larga se queda con su punto, sin el corto que lleva dentro', () => {
    expect(patrones('除非你去，否则我不去。')).not.toContain('否则');
  });
});

describe('los ejemplos de un punto del temario', () => {
  it('se buscan por sus trozos fijos, sin puntos suspensivos ni comas', () => {
    expect(trozosDePatron('因为……，所以……')).toEqual(['因为', '所以']);
    expect(trozosDePatron('除了 ……（以外），……还/也/都……')).toEqual(['除了', '还/也/都']);
    expect(fraseConPatron('因为下雨，所以我没去。', trozosDePatron('因为……，所以……'))).toBe(true);
    expect(fraseConPatron('所以我没去，因为下雨。', trozosDePatron('因为……，所以……'))).toBe(false);
    // La barra separa formas que valen igual.
    expect(fraseConPatron('除了他，我们都去了。', trozosDePatron('除了 ……（以外），……还/也/都……'))).toBe(true);
  });

  it('y los que tienen huecos, como X是X o 动词+得, no tienen trozos fijos', () => {
    expect(trozosDePatron('X是X，Y是Y')).toEqual([]);
    expect(trozosDePatron('动词+得+形容词性短语')).toEqual([]);
    expect(trozosDePatron('A跟B一样')).toEqual([]);
  });
});
