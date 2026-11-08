import { describe, expect, it } from 'vitest';
import { escalaDe, pasoDeZoom, pliegoDe, pliegos } from './paginas';

describe('los pliegos del visor', () => {
  it('de una en una', () => {
    expect(pliegos(3, false, true)).toEqual([[0], [1], [2]]);
  });

  it('en doble página con la portada sola, como un libro impreso', () => {
    expect(pliegos(6, true, true)).toEqual([[0], [1, 2], [3, 4], [5]]);
  });

  it('en doble página sin portada sola', () => {
    expect(pliegos(5, true, false)).toEqual([[0, 1], [2, 3], [4]]);
  });

  it('una página apaisada ya es una doble página: va sola y las parejas siguen tras ella', () => {
    // Como las primeras de un tomo con páginas a color: la portada, cuatro dobles escaneadas de una pieza y el resto.
    expect(pliegos(9, true, true, new Set([1, 2, 3, 4]))).toEqual([[0], [1], [2], [3], [4], [5, 6], [7, 8]]);
    expect(pliegos(6, true, true, new Set([2]))).toEqual([[0], [1], [2], [3, 4], [5]]);
    expect(pliegos(4, false, true, new Set([1]))).toEqual([[0], [1], [2], [3]]);
  });

  it('encuentra el pliego de una página', () => {
    expect(pliegoDe(pliegos(6, true, true), 4)).toBe(2);
    expect(pliegoDe([], 3)).toBe(0);
  });
});

describe('el zoom', () => {
  it('sube y baja por pasos desde el porcentaje real', () => {
    expect(pasoDeZoom(100, true)).toBe(110);
    expect(pasoDeZoom(83.4, true)).toBe(90);
    expect(pasoDeZoom(83.4, false)).toBe(80);
    expect(pasoDeZoom(400, true)).toBe(400);
    expect(pasoDeZoom(25, false)).toBe(25);
  });

  it('página entera, al ancho o en porcentaje', () => {
    const pagina = { ancho: 844, alto: 1200 };
    const hueco = { ancho: 1000, alto: 600 };
    expect(escalaDe([pagina], hueco, 'pagina')).toBeCloseTo(0.5);
    expect(escalaDe([pagina], hueco, 'ancho')).toBeCloseTo(1000 / 844);
    expect(escalaDe([pagina], hueco, 150)).toBe(1.5);
    // Dos páginas juntas comparten el ancho.
    expect(escalaDe([pagina, pagina], { ancho: 1000, alto: 2000 }, 'pagina')).toBeCloseTo(1000 / 1688);
  });
});
