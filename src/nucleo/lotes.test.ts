import { describe, expect, it } from 'vitest';
import { ordenarPorCercania, partirEnLotes } from './lotes';

describe('lotes para Claude', () => {
  const lotes = partirEnLotes(250, 100);

  it('reparte todo sin solapes', () => {
    expect(lotes).toEqual([{ desde: 0, hasta: 100 }, { desde: 100, hasta: 200 }, { desde: 200, hasta: 250 }]);
    expect(partirEnLotes(0, 100)).toEqual([]);
  });

  it('empieza por lo que estás viendo y sigue hacia delante', () => {
    expect(ordenarPorCercania(lotes, 120).map((l) => l.desde)).toEqual([100, 200, 0]);
  });

  it('lo anterior va al final, del más cercano al más lejano', () => {
    const muchos = partirEnLotes(500, 100);
    expect(ordenarPorCercania(muchos, 250).map((l) => l.desde)).toEqual([200, 300, 400, 100, 0]);
  });

  it('sin posición conocida mantiene el orden', () => {
    expect(ordenarPorCercania(lotes, -1)).toBe(lotes);
    expect(ordenarPorCercania(lotes, 999)).toBe(lotes);
  });
});
