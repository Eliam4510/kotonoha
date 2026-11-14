import { describe, expect, it } from 'vitest';
import type { DatoPalabra, EstadoPalabra } from '../compartido/tipos';
import {
  conDatos,
  distanciaEjemplo,
  juntarCuentas,
  ordenarVocabulario,
  palabrasParaLlegar,
  type PalabraDeFrase,
  partirEjemplo,
  porcentaje,
  Recuento,
  resumenPorLibro,
  resumirVocabulario,
} from './vocabulario';

const p = (lema: string, extra: Partial<PalabraDeFrase> = {}): PalabraDeFrase => ({
  clave: `${lema}|${extra.lectura ?? lema}`,
  lema,
  lectura: lema,
  categoria: '名詞',
  superficie: lema,
  gramatica: false,
  nombre: false,
  ...extra,
});

describe('Recuento', () => {
  it('cuenta cada vez que sale una palabra, su primera aparición y el orden en que aparecen', () => {
    const r = new Recuento(true);
    r.frase('猫が好きだ。', 0, [p('猫'), p('が', { gramatica: true }), p('好き')]);
    r.frase('猫と犬。', 2, [p('猫'), p('と', { gramatica: true }), p('犬')]);
    const c = r.resultado();
    expect(c.total).toBe(6);
    expect(c.frases).toBe(2);
    const gato = c.palabras.find((x) => x.lema === '猫')!;
    expect(gato.veces).toBe(2);
    expect(gato.lugar).toBe(0);
    expect(c.palabras.find((x) => x.lema === '犬')).toMatchObject({ lugar: 2, orden: 4 });
    expect(c.palabras.find((x) => x.lema === 'が')?.gramatica).toBe(true);
  });

  it('una palabra repetida en la misma frase suma sus veces, pero la frase va una sola vez de ejemplo', () => {
    const r = new Recuento(true);
    r.frase('猫と猫と猫の話です。', 0, [p('猫'), p('猫'), p('猫'), p('話')]);
    const gato = r.resultado().palabras.find((x) => x.lema === '猫')!;
    expect(gato.veces).toBe(3);
    expect(gato.ejemplos).toHaveLength(1);
  });

  it('se queda con las frases de ejemplo de largo más cómodo, y guarda cómo estaba escrita la palabra', () => {
    const r = new Recuento(true);
    const larga = `${'とても長い文章が続きます。'.repeat(8)}食べた。`;
    r.frase(larga, 0, [p('食べる', { superficie: '食べた' })]);
    r.frase('食べ', 1, [p('食べる', { superficie: '食べ' })]);
    r.frase('昨日は寿司をたくさん食べました。', 2, [p('食べる', { superficie: '食べ' })]);
    r.frase('朝ご飯をゆっくり食べたい気分です。', 3, [p('食べる', { superficie: '食べ' })]);
    const e = r.resultado().palabras[0].ejemplos;
    expect(e).toHaveLength(3);
    expect(e.map((x) => x.lugar)).not.toContain(0);
    expect(e[0].superficie).toBe('食べ');
  });

  it('cuenta cada punto de gramática una vez por frase', () => {
    const r = new Recuento(true);
    const g = { patron: '〜たい', nivel: 'N5', significado: 'querer' };
    r.frase('食べたいし、飲みたい。', 0, [], [g, g]);
    r.frase('行きたい。', 1, [], [g]);
    expect(r.resultado().gramatica).toEqual([expect.objectContaining({ patron: '〜たい', veces: 2, lugar: 0, nivel: 'N5' })]);
  });

  it('una palabra es gramatical si lo es alguna vez, y nombre propio solo si lo es siempre', () => {
    // El の nominalizador es un sustantivo para IPADIC; el posesivo, una partícula: la misma palabra.
    const r = new Recuento(true);
    r.frase('食べるのが好き。', 0, [p('の')]);
    r.frase('僕の本。', 1, [p('の', { gramatica: true })]);
    r.frase('日本へ行く。', 2, [p('日本', { nombre: true })]);
    r.frase('アイが来た。', 3, [p('アイ', { nombre: true })]);
    r.frase('アイを見る。', 4, [p('アイ')]);
    const c = r.resultado().palabras;
    expect(c.find((x) => x.lema === 'の')?.gramatica).toBe(true);
    expect(c.find((x) => x.lema === '日本')?.nombre).toBe(true);
    expect(c.find((x) => x.lema === 'アイ')?.nombre).toBeUndefined();
  });

  it('no cuenta frases vacías', () => {
    const r = new Recuento(false);
    r.frase('   ', 0, []);
    expect(r.resultado().frases).toBe(0);
  });
});

describe('distanciaEjemplo', () => {
  it('prefiere una frase cómoda a una larguísima o a una de dos palabras', () => {
    const comoda = distanciaEjemplo('The cat sat quietly on the warm windowsill all afternoon.', false);
    expect(comoda).toBeLessThan(distanciaEjemplo('Cat.', false));
    expect(comoda).toBeLessThan(distanciaEjemplo('word '.repeat(50), false));
  });
});

describe('juntarCuentas', () => {
  const cuenta = (frases: [string, number, PalabraDeFrase[]][]) => {
    const r = new Recuento(true);
    for (const [t, l, ps] of frases) r.frase(t, l, ps);
    return r.resultado();
  };

  it('suma las veces de cada libro y deja la primera aparición en el primero que la trae', () => {
    const tomo1 = cuenta([['猫が来た。', 3, [p('猫'), p('来る')]]]);
    const tomo2 = cuenta([['犬と猫。', 0, [p('犬'), p('猫')]], ['猫だ。', 1, [p('猫')]]]);
    const v = juntarCuentas([{ cuenta: tomo1, libro: 0 }, { cuenta: tomo2, libro: 1 }], true);
    expect(v.libros).toBe(2);
    expect(v.total).toBe(5);
    const gato = v.palabras.find((x) => x.lema === '猫')!;
    expect(gato).toMatchObject({ veces: 3, porLibro: [1, 2], primera: { libro: 0, lugar: 3 } });
    expect(v.palabras.find((x) => x.lema === '犬')).toMatchObject({ porLibro: [0, 1], primera: { libro: 1, lugar: 0 } });
    // Lo que aparece en el segundo tomo va detrás de todo lo del primero.
    const orden = ordenarVocabulario(v.palabras, 'aparicion').map((x) => x.lema);
    expect(orden).toEqual(['猫', '来る', '犬']);
  });

  it('los ejemplos dicen de qué libro son', () => {
    const v = juntarCuentas([{ cuenta: cuenta([['夏の海で泳ぎました。', 7, [p('海')]]]), libro: 1 }], true);
    expect(v.palabras[0].ejemplos[0]).toMatchObject({ libro: 1, lugar: 7 });
  });
});

describe('comprensión', () => {
  const v = (() => {
    const r = new Recuento(true);
    r.frase('あ', 0, [p('の'), p('の'), p('の'), p('の'), p('猫'), p('猫'), p('猫'), p('犬'), p('犬'), p('鳥')]);
    return juntarCuentas([{ cuenta: r.resultado(), libro: 0 }], true);
  })();
  const estados: Record<string, EstadoPalabra> = { の: 'conocida', 猫: 'desconocida', 犬: 'aprendiendo', 鳥: 'desconocida' };
  const filas = conDatos(v.palabras, v.palabras.map((x): DatoPalabra => ({ estado: estados[x.lema], rastreada: false })));

  it('cuenta como entendido lo conocido y lo que se está aprendiendo', () => {
    expect(resumirVocabulario(filas)).toEqual({ total: 10, conocidas: 6, comprension: 60, distintas: 4, porAprender: 2, aprendiendo: 1, sabidas: 1 });
  });

  it('las ignoradas no cuentan', () => {
    const sinPajaro = filas.map((f) => (f.lema === '鳥' ? { ...f, estado: 'ignorada' as const } : f));
    expect(resumirVocabulario(sinPajaro)).toMatchObject({ total: 9, comprension: 66, distintas: 3, porAprender: 1 });
  });

  it('dice cuántas palabras de las que más salen hacen falta para cada meta', () => {
    expect(palabrasParaLlegar(filas, [0.5, 0.9, 1])).toEqual([
      { meta: 0.5, palabras: 0 },
      { meta: 0.9, palabras: 1 },
      { meta: 1, palabras: 2 },
    ]);
  });

  it('no exagera: con algo por aprender no llega al 100 %', () => {
    expect(porcentaje(999, 1000)).toBe(99);
    expect(porcentaje(0, 0)).toBe(0);
  });

  it('da lo de cada libro de una colección y las palabras por aprender que trae cada uno', () => {
    const r1 = new Recuento(true);
    r1.frase('あ', 0, [p('猫'), p('の')]);
    const r2 = new Recuento(true);
    r2.frase('い', 0, [p('猫'), p('鳥'), p('の'), p('の')]);
    const w = juntarCuentas([{ cuenta: r1.resultado(), libro: 0 }, { cuenta: r2.resultado(), libro: 1 }], true);
    const f = conDatos(w.palabras, w.palabras.map((x): DatoPalabra => ({ estado: x.lema === 'の' ? 'conocida' : 'desconocida', rastreada: false })));
    const [a, b] = resumenPorLibro(f, 2);
    expect(a).toMatchObject({ libro: 0, total: 2, comprension: 50, nuevas: 1 });
    expect(b).toMatchObject({ libro: 1, total: 4, comprension: 50, nuevas: 1, porAprender: 2 });
  });
});

describe('ordenarVocabulario', () => {
  const filas = [
    { lema: 'a', veces: 2, orden: 0, rango: 900 },
    { lema: 'b', veces: 5, orden: 1, rango: undefined },
    { lema: 'c', veces: 2, orden: 2, rango: 10 },
  ].map((x) => ({ ...x, clave: x.lema, lectura: x.lema, categoria: '', primera: { libro: 0, lugar: 0 }, ejemplos: [], porLibro: [x.veces] }));

  it('por veces en el libro, y a igualdad, las más comunes de la lengua', () => {
    expect(ordenarVocabulario(filas, 'veces').map((x) => x.lema)).toEqual(['b', 'c', 'a']);
  });

  it('por orden de aparición', () => {
    expect(ordenarVocabulario(filas, 'aparicion').map((x) => x.lema)).toEqual(['a', 'b', 'c']);
  });

  it('por lo comunes que son en la lengua, sin puesto al final', () => {
    expect(ordenarVocabulario(filas, 'comunes').map((x) => x.lema)).toEqual(['c', 'a', 'b']);
  });
});

describe('partirEjemplo', () => {
  it('encuentra la palabra como está escrita en la frase', () => {
    expect(partirEjemplo('昨日は寿司を食べました。', '食べ', '食べる')).toEqual({ antes: '昨日は寿司を', palabra: '食べ', despues: 'ました。' });
  });

  it('con mayúscula al principio de la frase', () => {
    expect(partirEjemplo('House prices rose.', 'house')).toEqual({ antes: '', palabra: 'House', despues: ' prices rose.' });
  });

  it('si no está, nada', () => {
    expect(partirEjemplo('猫です。', '犬')).toBeNull();
  });
});
