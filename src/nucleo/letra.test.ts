import { describe, expect, it } from 'vitest';
import { aplicarAjuste, ID_LETRA, mensajeAjuste, versosDeLetra } from './letra';
import type { Linea } from './subtitulos';

// Versos inventados para estas pruebas.
const VERSOS = ['Camino por el río de noche', 'La luna se queda conmigo', 'Vuelve la mañana sin avisar', 'Y yo sigo cantando'];
const lin = (id: number, inicio: number, fin: number, texto = `oído mal ${id}`): Linea => ({ id, inicio, fin, texto });
const LINEAS = [lin(1, 10000, 13000), lin(2, 14000, 17000), lin(3, 18000, 21000), lin(4, 22000, 25000), lin(5, 26000, 29000)];
const tiempos = (l: Linea[]) => l.map((x) => [x.inicio, x.fin]);
const textos = (l: Linea[]) => l.map((x) => x.texto);

describe('versosDeLetra', () => {
  it('un verso por línea, sin las vacías', () => {
    expect(versosDeLetra('uno\n\n  dos  \r\n\r\ntres')).toEqual(['uno', 'dos', 'tres']);
  });

  it('quita los adornos, que no se cantan', () => {
    expect(versosDeLetra('♪♪♪\n---\nverso\n～～\n* * *')).toEqual(['verso']);
  });

  it('quita la marca de tiempo que traen algunos comentarios', () => {
    expect(versosDeLetra('0:15 primer verso\n[1:02] segundo verso\n1:02:33 tercer verso')).toEqual(['primer verso', 'segundo verso', 'tercer verso']);
  });

  it('no toca lo que forma parte del verso', () => {
    expect(versosDeLetra('夜の川を　歩いて\n3 de mayo')).toEqual(['夜の川を　歩いて', '3 de mayo']);
    expect(versosDeLetra('palabra\u200b unida')).toEqual(['palabra unida']);
  });

  it('una marca como [Coro] se queda: es Claude quien decide que no se canta', () => {
    expect(versosDeLetra('[Coro]\nverso')).toEqual(['[Coro]', 'verso']);
  });
});

describe('mensajeAjuste', () => {
  it('numera las dos listas, con los tiempos de la transcripción', () => {
    const m = mensajeAjuste([lin(7, 1500, 3000, 'hola')], ['verso'], 'Una canción');
    expect(m).toBe('Título: Una canción\n\nTRANSCRIPCIÓN:\n0 [1.5-3.0] hola\n\nLETRA:\n0: verso');
  });

  it('el número es la posición en la lista, no el identificador de la línea', () => {
    expect(mensajeAjuste([lin(40, 0, 1000, 'a'), lin(41, 1000, 2000, 'b')], ['v'])).toContain('0 [0.0-1.0] a\n1 [1.0-2.0] b');
  });
});

describe('aplicarAjuste', () => {
  it('el texto sale tal cual de la letra y los tiempos, de la transcripción', () => {
    const r = aplicarAjuste(VERSOS.slice(0, 2), LINEAS, [{ v: 0, de: 0, a: 0 }, { v: 1, de: 1, a: 1 }]);
    expect(textos(r.lineas)).toEqual([VERSOS[0], VERSOS[1]]);
    expect(tiempos(r.lineas)).toEqual([[10000, 13000], [14000, 17000]]);
    expect(r.conTiempo).toBe(2);
    expect(r.estimadas).toBe(0);
  });

  it('un verso que ocupa varias líneas va de la primera a la última', () => {
    const r = aplicarAjuste(VERSOS.slice(0, 1), LINEAS, [{ v: 0, de: 1, a: 3 }]);
    expect(tiempos(r.lineas)).toEqual([[14000, 25000]]);
  });

  it('un estribillo que la letra escribe una vez puede sonar varias', () => {
    const r = aplicarAjuste(VERSOS, LINEAS, [{ v: 1, de: -2, a: -2 }, { v: 3, de: -2, a: -2 }, { v: 2, de: 0, a: 0 }, { v: 0, de: 1, a: 1 }, { v: 2, de: 2, a: 2 }, { v: 2, de: 4, a: 4 }]);
    expect(textos(r.lineas)).toEqual([VERSOS[2], VERSOS[0], VERSOS[2], VERSOS[2]]);
    expect(r.lineas[3].inicio).toBe(26000);
  });

  it('dos versos en una sola línea se reparten su tiempo, sin pisarse', () => {
    const r = aplicarAjuste(['aaaa', 'bbbbbbbbbbbb'], LINEAS, [{ v: 0, de: 0, a: 0 }, { v: 1, de: 0, a: 0 }]);
    // Tres segundos a repartir entre 4 y 12 caracteres.
    expect(tiempos(r.lineas)).toEqual([[10000, 10750], [10750, 13000]]);
    expect(r.conTiempo).toBe(2);
  });

  it('también si solo comparten una parte', () => {
    const r = aplicarAjuste(['aaaa', 'aaaa'], LINEAS, [{ v: 0, de: 0, a: 1 }, { v: 1, de: 1, a: 2 }]);
    expect(tiempos(r.lineas)).toEqual([[10000, 15500], [15500, 21000]]);
  });

  it('un verso que no se oyó se coloca justo antes del siguiente', () => {
    const r = aplicarAjuste(['abcde', 'fghij', 'klmno'], LINEAS, [{ v: 0, de: 0, a: 0 }, { v: 1, de: -1, a: -1 }, { v: 2, de: 3, a: 3 }]);
    expect(textos(r.lineas)).toEqual(['abcde', 'fghij', 'klmno']);
    // 5 caracteres a 300 ms son 1,5 s, y la línea 3 empieza a los 22 s.
    expect(tiempos(r.lineas)[1]).toEqual([20500, 22000]);
    expect(r.conTiempo).toBe(2);
    expect(r.estimadas).toBe(1);
  });

  it('lo que no se canta no entra, ni se confunde con lo que no se oyó', () => {
    const r = aplicarAjuste(['Título', ...VERSOS.slice(0, 2)], LINEAS, [{ v: 0, de: -2, a: -2 }, { v: 1, de: 0, a: 0 }, { v: 2, de: 1, a: 1 }]);
    expect(textos(r.lineas)).toEqual([VERSOS[0], VERSOS[1]]);
    expect(r.estimadas).toBe(0);
  });

  it('un verso que Claude se salta no se pierde: va detrás del anterior de la letra', () => {
    const r = aplicarAjuste(VERSOS.slice(0, 4), LINEAS, [{ v: 0, de: 0, a: 0 }, { v: 2, de: 2, a: 2 }, { v: 3, de: 3, a: 3 }]);
    expect(textos(r.lineas)).toEqual(VERSOS.slice(0, 4));
    expect(r.conTiempo).toBe(3);
    expect(r.estimadas).toBe(1);
    expect(r.lineas[1].inicio).toBeGreaterThanOrEqual(r.lineas[0].fin);
    expect(r.lineas[1].fin).toBeLessThanOrEqual(r.lineas[2].inicio);
  });

  it('el primero también, delante de todo', () => {
    const r = aplicarAjuste(VERSOS.slice(0, 2), LINEAS, [{ v: 1, de: 1, a: 1 }]);
    expect(textos(r.lineas)).toEqual(VERSOS.slice(0, 2));
    expect(r.lineas[0].fin).toBeLessThanOrEqual(r.lineas[1].inicio);
  });

  it('con un estribillo repetido, lo saltado va tras su primera aparición', () => {
    const r = aplicarAjuste(['a', 'b', 'c'], LINEAS, [{ v: 0, de: 0, a: 0 }, { v: 2, de: 1, a: 1 }, { v: 0, de: 2, a: 2 }, { v: 2, de: 3, a: 3 }]);
    expect(textos(r.lineas)).toEqual(['a', 'b', 'c', 'a', 'c']);
  });

  it('si nada tiene tiempo no se completa: no es la letra de esta canción', () => {
    const r = aplicarAjuste(VERSOS.slice(0, 3), LINEAS, [{ v: 0, de: -1, a: -1 }]);
    expect(r.conTiempo).toBe(0);
    expect(textos(r.lineas)).toEqual([VERSOS[0]]);
  });

  it('un pasaje instrumental no estira el verso que no se oyó', () => {
    const lejos = [lin(1, 0, 3000), lin(2, 60000, 63000)];
    const largo = 'x'.repeat(100);
    const r = aplicarAjuste(['a', largo, 'b'], lejos, [{ v: 0, de: 0, a: 0 }, { v: 1, de: -1, a: -1 }, { v: 2, de: 1, a: 1 }]);
    expect(tiempos(r.lineas)[1]).toEqual([52000, 60000]);
  });

  it('el primer verso sin tiempo no empieza antes del video', () => {
    const r = aplicarAjuste(['larguísimo verso que no se oyó', 'b'], [lin(1, 2000, 4000)], [{ v: 0, de: -1, a: -1 }, { v: 1, de: 0, a: 0 }]);
    expect(r.lineas[0].inicio).toBe(0);
    expect(r.lineas[0].fin).toBe(2500);
  });

  it('el último sin tiempo va detrás del anterior', () => {
    const r = aplicarAjuste(['a', 'abcdefghij'], [lin(1, 2000, 4000)], [{ v: 0, de: 0, a: 0 }, { v: 1, de: -1, a: -1 }]);
    expect(tiempos(r.lineas)[1]).toEqual([4000, 7000]);
  });

  it('sin hueco, los versos sin tiempo toman lo que le sobra a una línea larga del reconocedor', () => {
    const larga = [lin(1, 10000, 12000), lin(2, 12000, 32000)];
    const r = aplicarAjuste(['aaaa', 'bbbb', 'cccc', 'dddd'], larga, [{ v: 0, de: 0, a: 0 }, { v: 1, de: -1, a: -1 }, { v: 2, de: -1, a: -1 }, { v: 3, de: 1, a: 1 }]);
    expect(textos(r.lineas)).toEqual(['aaaa', 'bbbb', 'cccc', 'dddd']);
    // Cada verso de cuatro caracteres necesita 1,5 s, así que no se aplastan en un instante.
    expect(r.lineas[1].fin - r.lineas[1].inicio).toBeGreaterThanOrEqual(1400);
    expect(r.lineas[2].fin - r.lineas[2].inicio).toBeGreaterThanOrEqual(1400);
    expect(r.lineas[3].fin).toBe(32000);
    expect(r.lineas[3].inicio).toBeGreaterThanOrEqual(r.lineas[2].fin);
  });

  it('y también lo que le sobra a la anterior', () => {
    const larga = [lin(1, 10000, 25000), lin(2, 25000, 28000)];
    const r = aplicarAjuste(['aaaa', 'bbbb', 'cccc'], larga, [{ v: 0, de: 0, a: 0 }, { v: 1, de: -1, a: -1 }, { v: 2, de: 1, a: 1 }]);
    expect(r.lineas[1].fin - r.lineas[1].inicio).toBeGreaterThanOrEqual(1400);
    expect(r.lineas[0].fin).toBeLessThan(25000);
    expect(r.lineas[2].inicio).toBe(25000);
  });

  it('a la línea anterior le quita lo que le sobra, y le deja lo suyo', () => {
    const pegadas = [lin(1, 0, 4000), lin(2, 4000, 8000)];
    const r = aplicarAjuste(['a', 'bbbbb', 'c'], pegadas, [{ v: 0, de: 0, a: 0 }, { v: 1, de: -1, a: -1 }, { v: 2, de: 1, a: 1 }]);
    expect(tiempos(r.lineas)).toEqual([[0, 2500], [2500, 4000], [4000, 8000]]);
  });

  it('una entrada fuera de orden pierde su tiempo, pero no se lleva por delante a las demás', () => {
    const r = aplicarAjuste(VERSOS, LINEAS, [{ v: 0, de: 0, a: 0 }, { v: 1, de: 4, a: 4 }, { v: 2, de: 1, a: 1 }, { v: 3, de: 2, a: 2 }]);
    expect(textos(r.lineas)).toEqual(VERSOS);
    expect(r.conTiempo).toBe(3);
    expect(r.estimadas).toBe(1);
    for (let i = 1; i < r.lineas.length; i++) expect(r.lineas[i].inicio).toBeGreaterThanOrEqual(r.lineas[i - 1].fin);
  });

  it('lo que no tiene sentido se descarta sin romper nada', () => {
    const r = aplicarAjuste(VERSOS.slice(0, 3), LINEAS, [
      { v: 99, de: 0, a: 0 },
      { v: -1, de: 0, a: 0 },
      { v: 1.5, de: 0, a: 0 },
      { v: 0, de: 0, a: 99 },
      { v: 1, de: 2, a: 1 },
      { v: 2, de: 99, a: 99 },
    ]);
    expect(textos(r.lineas)).toEqual([VERSOS[0], VERSOS[1], VERSOS[2]]);
    expect(tiempos(r.lineas)[0]).toEqual([10000, 13000]);
    expect(r.estimadas).toBe(1);
  });

  it('sin nada que colocar, no hay líneas', () => {
    expect(aplicarAjuste(VERSOS, LINEAS, []).lineas).toEqual([]);
    expect(aplicarAjuste([], LINEAS, [{ v: 0, de: 0, a: 0 }]).lineas).toEqual([]);
  });

  it('los identificadores no chocan con los de la transcripción', () => {
    const r = aplicarAjuste(VERSOS.slice(0, 2), LINEAS, [{ v: 0, de: 0, a: 0 }, { v: 1, de: 1, a: 1 }]);
    expect(r.lineas.map((l) => l.id)).toEqual([ID_LETRA, ID_LETRA + 1]);
    expect(LINEAS.some((l) => l.id >= ID_LETRA)).toBe(false);
  });

  it('una línea muy corta dura lo bastante para leerla, sin pisar la siguiente', () => {
    const cortas = [lin(1, 1000, 1100), lin(2, 1500, 1600), lin(3, 5000, 5100)];
    const r = aplicarAjuste(['a', 'b', 'c'], cortas, [{ v: 0, de: 0, a: 0 }, { v: 1, de: 1, a: 1 }, { v: 2, de: 2, a: 2 }]);
    expect(tiempos(r.lineas)).toEqual([[1000, 1500], [1500, 2200], [5000, 5700]]);
  });

  it('nunca se pisan y los tiempos son enteros, pase lo que pase', () => {
    const r = aplicarAjuste(['uno', 'dos', 'tres', 'cuatro', 'cinco'], LINEAS, [
      { v: 0, de: 0, a: 1 },
      { v: 1, de: 1, a: 1 },
      { v: 2, de: -1, a: -1 },
      { v: 3, de: 2, a: 2 },
      { v: 4, de: 2, a: 4 },
    ]);
    expect(r.lineas).toHaveLength(5);
    for (const [i, l] of r.lineas.entries()) {
      expect(Number.isInteger(l.inicio) && Number.isInteger(l.fin)).toBe(true);
      expect(l.fin).toBeGreaterThan(l.inicio);
      if (i) expect(l.inicio).toBeGreaterThanOrEqual(r.lineas[i - 1].fin);
    }
  });
});
