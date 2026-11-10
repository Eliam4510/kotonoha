import { describe, expect, it } from 'vitest';
import { JAPONES } from '../lenguas/japones';
import { INGLES } from '../lenguas/ingles';
import { gruposSinCorte, UNION } from './sinCorte';

/** Las piezas de una línea como las ve quien las pinta: null si es una palabra, y si no, sus signos ya pegados. */
const piezas = (pegar: (s: string) => string, linea: (string | null)[]) => linea.map((p) => (p === null ? null : pegar(p)));

describe('gruposSinCorte', () => {
  it('deja cada palabra suelta si no hay signos', () => {
    expect(gruposSinCorte([null, null, null])).toEqual([[0], [1], [2]]);
  });

  it('pega el signo de cierre a la palabra de antes', () => {
    const pegar = JAPONES.escritura.pegarSignos;
    // palabra 、 palabra palabra 。
    expect(gruposSinCorte(piezas(pegar, [null, '、', null, null, '。']))).toEqual([[0, 1], [2], [3, 4]]);
  });

  it('pega el de apertura a la palabra que sigue, y los dos de una cita a lo suyo', () => {
    const pegar = JAPONES.escritura.pegarSignos;
    // 「 palabra 」 。 palabra
    expect(gruposSinCorte(piezas(pegar, ['「', null, '」', '。', null]))).toEqual([[0, 1, 2, 3], [4]]);
  });

  it('un cierre seguido de una apertura une lo de los dos lados', () => {
    const pegar = JAPONES.escritura.pegarSignos;
    // palabra 」「 palabra: los dos signos van en una misma pieza.
    expect(gruposSinCorte(piezas(pegar, [null, '」「', null]))).toEqual([[0, 1, 2]]);
  });

  it('un espacio no pega nada', () => {
    const pegar = INGLES.escritura.pegarSignos;
    expect(gruposSinCorte(piezas(pegar, [null, ' ', null]))).toEqual([[0], [1], [2]]);
  });

  it('en inglés la coma y el punto van con su palabra', () => {
    const pegar = INGLES.escritura.pegarSignos;
    const grupos = gruposSinCorte(piezas(pegar, [null, ', ', null, '.']));
    expect(grupos[0]).toEqual([0, 1]);
    expect(grupos.at(-1)).toEqual([2, 3]);
  });

  it('el signo de unión es el que usan las lenguas', () => {
    expect(JAPONES.escritura.pegarSignos('。').startsWith(UNION)).toBe(true);
    expect(JAPONES.escritura.pegarSignos('「').endsWith(UNION)).toBe(true);
  });
});
