import { describe, expect, it } from 'vitest';
import { conImanes, enZonaActivacion, enZonaSegura, factorLargo, pixelesDe, posicionDesde, posicionInicial } from './presentacion';
import { lineaConPuente } from './subtitulos';

describe('barra superior', () => {
  const caja = { izq: 500, der: 1400, abajo: 66 };

  it('despierta arriba del todo, a la altura de la barra', () => {
    expect(enZonaActivacion(900, 5, caja)).toBe(true);
    expect(enZonaActivacion(900, 40, caja)).toBe(false);
  });

  it('no despierta en las esquinas, donde están el menú del sitio y sus botones', () => {
    expect(enZonaActivacion(100, 5, caja)).toBe(false);
    expect(enZonaActivacion(1800, 5, caja)).toBe(false);
  });

  it('una vez visible aguanta con margen alrededor', () => {
    expect(enZonaSegura(900, 30, caja)).toBe(true);
    expect(enZonaSegura(900, 130, caja)).toBe(true);
    expect(enZonaSegura(440, 30, caja)).toBe(true);
    expect(enZonaSegura(900, 200, caja)).toBe(false);
    expect(enZonaSegura(300, 30, caja)).toBe(false);
  });

  it('la zona segura contiene a la de activación en altura: nunca se muestra para ocultarse al instante', () => {
    for (const y of [0, 5, 14]) expect(enZonaSegura(900, y, caja)).toBe(true);
  });
});

describe('posición de los subtítulos', () => {
  const c = { W: 1600, H: 900, w: 800, h: 120 };

  it('por omisión va centrada, abajo', () => {
    const { left, top } = pixelesDe(posicionInicial(c.H), c);
    expect(left).toBe(400);
    expect(top).toBeCloseTo(900 - 72 - 120);
  });

  it('ida y vuelta entre fracciones y píxeles', () => {
    const p = posicionDesde(100, 200, c);
    const { left, top } = pixelesDe(p, c);
    expect(left).toBeCloseTo(100);
    expect(top).toBeCloseTo(200);
  });

  it('nunca se sale del video', () => {
    expect(pixelesDe({ x: 0, y: 0 }, c)).toEqual({ left: 0, top: 780 });
    expect(pixelesDe({ x: 1, y: 1 }, c)).toEqual({ left: 800, top: 0 });
  });

  it('una línea más larga en el mismo sitio se sigue ajustando dentro', () => {
    const p = posicionDesde(0, 0, c);
    const { left, top } = pixelesDe(p, { ...c, w: 1200, h: 300 });
    expect(left).toBeGreaterThanOrEqual(0);
    expect(left + 1200).toBeLessThanOrEqual(1600);
    expect(top).toBeGreaterThanOrEqual(0);
  });

  it('se mantiene al cambiar el tamaño del video, como al pasar a pantalla completa', () => {
    const p = { x: 0.25, y: 0.5 };
    const grande = pixelesDe(p, { W: 3200, H: 1800, w: 800, h: 120 });
    expect(grande.left + 400).toBeCloseTo(800);
    expect(1800 - grande.top - 120).toBeCloseTo(900);
  });

  it('el centro atrae al arrastrar cerca de él', () => {
    const r = conImanes(410, 300, c);
    expect(r.centrado).toBe(true);
    expect(r.left).toBe(400);
    const lejos = conImanes(300, 300, c);
    expect(lejos.centrado).toBe(false);
    expect(lejos.left).toBe(300);
  });

  it('la altura de siempre también atrae', () => {
    const base = 900 - 72 - 120;
    const r = conImanes(100, base + 8, c);
    expect(r.enBase).toBe(true);
    expect(r.top).toBeCloseTo(base);
  });

  it('el arrastre tampoco saca el bloque del video', () => {
    const r = conImanes(-500, -500, c);
    expect(r.left).toBe(0);
    expect(r.top).toBe(0);
  });
});

describe('líneas largas', () => {
  it('una línea normal conserva su tamaño', () => {
    expect(factorLargo(20)).toBe(1);
    expect(factorLargo(42)).toBe(1);
  });

  it('un párrafo se reduce, sin llegar a ser ilegible', () => {
    expect(factorLargo(84)).toBeLessThan(1);
    expect(factorLargo(84)).toBeGreaterThan(0.6);
    expect(factorLargo(1000)).toBe(0.6);
  });
});

describe('cambio de línea sin parpadeo', () => {
  const lineas = [
    { id: 1, inicio: 1000, fin: 3000, texto: 'uno' },
    { id: 2, inicio: 3100, fin: 5000, texto: 'dos' },
    { id: 3, inicio: 9000, fin: 11000, texto: 'tres' },
  ];

  it('dentro de una línea, esa línea', () => {
    expect(lineaConPuente(lineas, 2000)).toBe(0);
    expect(lineaConPuente(lineas, 3100)).toBe(1);
  });

  it('un hueco corto entre dos líneas no se ve: sigue la primera hasta que entra la siguiente', () => {
    expect(lineaConPuente(lineas, 3050)).toBe(0);
  });

  it('un hueco largo sí deja la pantalla libre, tras una breve cola', () => {
    expect(lineaConPuente(lineas, 5100)).toBe(1);
    expect(lineaConPuente(lineas, 6000)).toBe(-1);
  });

  it('antes de la primera línea no hay nada', () => {
    expect(lineaConPuente(lineas, 500)).toBe(-1);
  });

  it('tras la última hay una breve cola y luego nada', () => {
    expect(lineaConPuente(lineas, 11100)).toBe(2);
    expect(lineaConPuente(lineas, 12000)).toBe(-1);
  });

  it('sin líneas no falla', () => {
    expect(lineaConPuente([], 1000)).toBe(-1);
  });
});
