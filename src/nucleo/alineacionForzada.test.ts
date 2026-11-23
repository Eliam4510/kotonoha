import { describe, expect, it } from 'vitest';
import { alinearCtc, bandaPorVersos, type ProbabilidadesCtc } from './alineacionForzada';

/** Un modelo de juguete con tres clases (0 el blanco, 1 y 2 dos fonemas): en cada marco suena lo que diga `oye`. */
function modelo(oye: (number | null)[]): ProbabilidadesCtc {
  const clases = 3;
  const logp = new Float32Array(oye.length * clases);
  oye.forEach((c, t) => {
    for (let k = 0; k < clases; k++) logp[t * clases + k] = Math.log(k === (c ?? 0) ? 0.9 : 0.05);
  });
  return { logp, marcos: oye.length, clases, blanco: 0 };
}

describe('alinearCtc', () => {
  it('pone cada fonema donde suena, en orden', () => {
    const p = modelo([null, null, null, null, null, 1, 1, null, null, null, null, null, 2, null, null]);
    const r = alinearCtc(p, [1, 2]);
    expect(r?.map((f) => [f.primero, f.ultimo])).toEqual([
      [5, 6],
      [12, 12],
    ]);
  });

  it('el mismo fonema dos veces necesita un blanco entre medias', () => {
    const p = modelo([null, null, null, 1, null, null, null, null, 1, null]);
    expect(alinearCtc(p, [1, 1])?.map((f) => f.primero)).toEqual([3, 8]);
  });

  it('con una banda, busca solo en la zona de cada fonema', () => {
    // El fonema 1 suena dos veces, la segunda menos clara; la banda dice que el que se busca es el segundo.
    const p = modelo([null, null, 1, null, null, null, null, null, null, null, null, null, null, null, null, 1, null, null, null, null]);
    p.logp[15 * p.clases + 1] = Math.log(0.6);
    p.logp[15 * p.clases + 0] = Math.log(0.3);
    expect(alinearCtc(p, [1])?.[0].primero).toBe(2);
    const banda = bandaPorVersos([[10, 19]], [1], p.marcos);
    expect(alinearCtc(p, [1], banda)?.[0].primero).toBe(15);
  });

  it('si no cabe, null', () => {
    expect(alinearCtc(modelo([null, 1]), [1, 2, 1])).toBeNull();
    // Una banda que no deja sitio al segundo verso.
    const banda = bandaPorVersos([[0, 4], [0, 0]], [1, 1], 5);
    expect(alinearCtc(modelo([null, 1, null, 2, null]), [1, 2], banda)).toBeNull();
  });
});

describe('bandaPorVersos', () => {
  it('cada verso en su zona, y el blanco de antes en la suya o en la del anterior', () => {
    const b = bandaPorVersos([[0, 50], [40, 90]], [2, 1], 100);
    // Estados: blanco, f0, blanco, f1, blanco (antes del segundo verso), f2, blanco final.
    expect([...b.desde]).toEqual([0, 0, 0, 0, 0, 40, 40]);
    expect([...b.hasta]).toEqual([50, 50, 50, 50, 90, 90, 99]);
  });

  it('un verso sin fonemas no ocupa nada', () => {
    const b = bandaPorVersos([[0, 50], [10, 60], [40, 90]], [1, 0, 1], 100);
    expect(b.desde.length).toBe(5);
    expect([...b.desde]).toEqual([0, 0, 0, 40, 40]);
  });
});
