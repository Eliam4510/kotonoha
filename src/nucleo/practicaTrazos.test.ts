import { describe, expect, it } from 'vitest';
import { evaluarTrazo, type Punto, puntosDeTrazado, remuestrear } from './practicaTrazos';

// Los trazos de 三, 人 y 口 en KanjiVG.
const SAN = [
  'M27.5,23.65c3.09,0.73,6.29,0.36,9.4,0.06c10.2-1,27-2.94,38.97-3.57c3.06-0.16,6.09-0.2,9.14,0.23',
  'M28.75,55.14c3.13,0.76,6.46,0.43,9.64,0.2c10.03-0.72,23.97-2.63,34.73-3.12c2.7-0.12,5.45-0.16,8.13,0.3',
  'M13,87.83c3.94,1.01,7.72,0.96,11.75,0.72c18.41-1.07,41.27-3.39,61.12-4.07c3.63-0.13,7.2-0.1,10.75,0.78',
].map((d) => puntosDeTrazado(d));
const HITO = [
  'M54.5,20c0.37,2.12,0.23,4.03-0.22,6.27C51.68,39.48,38.25,72.25,16.5,87.25',
  'M46,54.25c6.12,6,25.51,22.24,35.52,29.72c3.66,2.73,6.94,4.64,11.48,5.53',
].map((d) => puntosDeTrazado(d));
const KUCHI = [
  'M22.25,33.25c1.25,1.25,2,2.88,2.26,4.43c1.16,7.03,3.15,23.61,4.68,37.85C29.46,78.09,29.73,80.6,30,83',
  'M25.29,35.67c17.46-2.17,41.59-5.04,55.49-5.93c3.94-0.25,6.33,2.72,5.72,5.14c-2.25,8.87-6.62,26.5-9,38.87',
  'M30.25,77.75c10.5-0.5,30.53-2.3,44.99-3.04c2.05-0.11,3.99-0.18,5.76-0.21',
].map((d) => puntosDeTrazado(d));

/** Un trazo hecho a mano: con un temblor de ±`t` unidades, sin repetir siempre el mismo. */
function aMano(ps: Punto[], t = 1.5, desplazar: Punto = { x: 0, y: 0 }): Punto[] {
  return remuestrear(ps, 20).map((p, i) => ({ x: p.x + desplazar.x + Math.sin(i * 1.7) * t, y: p.y + desplazar.y + Math.cos(i * 2.3) * t }));
}

describe('trazados SVG', () => {
  it('recorre rectas y curvas, absolutas y relativas', () => {
    const r = puntosDeTrazado('M10,10 L20,10 l0,10');
    expect(r[0]).toEqual({ x: 10, y: 10 });
    expect(r[r.length - 1]).toEqual({ x: 20, y: 20 });
    const c = SAN[0];
    expect(c[0]).toEqual({ x: 27.5, y: 23.65 });
    expect(c[c.length - 1].x).toBeCloseTo(27.5 + 3.09 + 9.4 - 3.09 + 10.2 + 27 + 38.97 - 37.2 + 3.06 + 6.09 + 9.14 - 9.14 + 0, 0);
  });

  it('refleja el control en S y repite órdenes sin letra', () => {
    const s = puntosDeTrazado('M0,0 C0,10 10,10 10,0 S20,-10 20,0');
    expect(s[s.length - 1]).toEqual({ x: 20, y: 0 });
    const repetida = puntosDeTrazado('M0,0 l5,0 5,0 5,0');
    expect(repetida[repetida.length - 1]).toEqual({ x: 15, y: 0 });
  });

  it('remuestrea a lo largo con los puntos repartidos', () => {
    const xs = remuestrear([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], 5);
    expect(xs.map((p) => [Math.round(p.x), Math.round(p.y)])).toEqual([[0, 0], [5, 0], [10, 0], [10, 5], [10, 10]]);
  });
});

describe('corregir un trazo', () => {
  it('acepta el trazo que toca hecho a mano', () => {
    expect(evaluarTrazo(aMano(SAN[0]), SAN, 0)).toEqual({ acierto: true });
    expect(evaluarTrazo(aMano(HITO[1]), HITO, 1)).toEqual({ acierto: true });
    expect(evaluarTrazo(aMano(KUCHI[1], 2), KUCHI, 1)).toEqual({ acierto: true });
  });

  it('acepta un trazo algo desplazado sin el carácter de fondo, y lo rechaza si se aleja mucho', () => {
    expect(evaluarTrazo(aMano(SAN[0], 1.5, { x: 6, y: 5 }), SAN, 0).acierto).toBe(true);
    expect(evaluarTrazo(aMano(HITO[0], 1.5, { x: 40, y: 0 }), HITO, 0).acierto).toBe(false);
  });

  it('dice si va al revés', () => {
    expect(evaluarTrazo(aMano(SAN[0]).reverse(), SAN, 0)).toEqual({ acierto: false, motivo: 'reves' });
    expect(evaluarTrazo(aMano(KUCHI[0]).reverse(), KUCHI, 0)).toEqual({ acierto: false, motivo: 'reves' });
  });

  it('dice qué trazo se ha hecho si es otro de los que faltan', () => {
    expect(evaluarTrazo(aMano(SAN[2]), SAN, 0)).toEqual({ acierto: false, motivo: 'otro', otro: 2 });
    expect(evaluarTrazo(aMano(KUCHI[2]), KUCHI, 1)).toEqual({ acierto: false, motivo: 'otro', otro: 2 });
  });

  it('rechaza lo que no se parece y lo que no llega a trazo', () => {
    const garabato = [{ x: 20, y: 20 }, { x: 80, y: 80 }, { x: 20, y: 80 }, { x: 80, y: 20 }];
    expect(evaluarTrazo(garabato, SAN, 0)).toEqual({ acierto: false, motivo: 'forma' });
    expect(evaluarTrazo([{ x: 30, y: 24 }], SAN, 0)).toEqual({ acierto: false, motivo: 'forma' });
    // Una diagonal donde va una horizontal.
    expect(evaluarTrazo([{ x: 27, y: 10 }, { x: 85, y: 40 }], SAN, 0).acierto).toBe(false);
  });

  it('un trazo corto solo tiene que ir hacia el mismo lado; un garabato que pasa por encima no vale', () => {
    // Un punto como los de 鬱, entre otros dos trazos.
    const punto = [{ x: 50, y: 50 }, { x: 51.5, y: 52 }, { x: 53, y: 54 }];
    const trazos = [SAN[0], punto, SAN[2]];
    expect(evaluarTrazo([{ x: 49, y: 49.5 }, { x: 51, y: 51 }, { x: 52, y: 54.5 }], trazos, 1, { conFondo: true })).toEqual({ acierto: true });
    // Con el pulso tembloroso, que en un trazo tan corto lo deforma del todo.
    expect(evaluarTrazo([{ x: 50, y: 49 }, { x: 52, y: 50.5 }, { x: 50.5, y: 52 }, { x: 53.5, y: 53 }], trazos, 1, { conFondo: true }).acierto).toBe(true);
    expect(evaluarTrazo([{ x: 53, y: 54 }, { x: 51.5, y: 52 }, { x: 50, y: 50 }], trazos, 1, { conFondo: true })).toEqual({ acierto: false, motivo: 'reves' });
    expect(evaluarTrazo([{ x: 42, y: 40 }, { x: 52, y: 52 }, { x: 62, y: 65 }], trazos, 1, { conFondo: true }).acierto).toBe(false);
  });

  it('con el carácter de fondo pide ir más cerca', () => {
    const lejos = aMano(SAN[1], 1, { x: 0, y: 14 });
    expect(evaluarTrazo(lejos, SAN, 1, { conFondo: true }).acierto).toBe(false);
    expect(evaluarTrazo(lejos, SAN, 1, { conFondo: true, tolerancia: 1.6 }).acierto).toBe(true);
  });
});
