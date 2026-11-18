import { describe, expect, it } from 'vitest';
import { colocarVentana, type Rect } from './colocarVentana';

const vista = { ancho: 1600, alto: 900 };
const zona: Rect = { left: 0, top: 60, width: 1600, height: 800 };
const base = { zona, vista, ancho: 440, alto: 520 };

describe('dónde va la ventana de lo que se toca', () => {
  it('si junto a la hoja hay sitio, va al margen, a la altura de lo elegido, sin tapar la página', () => {
    const hoja: Rect = { left: 500, top: 70, width: 600, height: 780 };
    const c = colocarVentana({ ...base, hoja, ancla: { left: 560, top: 200, width: 300, height: 30 }, vertical: false });
    expect(c.lado).toBe('margen-derecho');
    expect(c.left).toBe(1110);
    expect(c.top).toBe(192);
    // Más abajo, sube lo justo para no salirse por abajo.
    const abajo = colocarVentana({ ...base, hoja, ancla: { left: 560, top: 700, width: 300, height: 30 }, vertical: false });
    expect(abajo.top).toBe(860 - 12 - 520);
  });

  it('si al margen falta un poco, se estrecha para caber, hasta un mínimo', () => {
    // 418 píxeles libres a cada lado: la ventana de 440 queda en 418 y no tapa la página.
    const hoja: Rect = { left: 440, top: 70, width: 720, height: 780 };
    const c = colocarVentana({ ...base, hoja, ancla: { left: 500, top: 200, width: 300, height: 30 }, vertical: false });
    expect(c.lado).toBe('margen-derecho');
    expect(c.ancho).toBe(1600 - 1160 - 10 - 12);
    // Con un poco más a la izquierda que a la derecha, sigue a la derecha: no salta de lado por unos píxeles.
    const casi = colocarVentana({ ...base, hoja: { left: 450, top: 70, width: 720, height: 780 }, ancla: { left: 500, top: 200, width: 300, height: 30 }, vertical: false });
    expect(casi.lado).toBe('margen-derecho');
    // Con menos de 300, mejor encima del texto ya leído que una ficha apretada.
    const estrecha = colocarVentana({ ...base, hoja: { left: 320, top: 70, width: 1000, height: 780 }, ancla: { left: 500, top: 500, width: 300, height: 30 }, vertical: false });
    expect(estrecha.lado).toBe('encima');
    expect(estrecha.ancho).toBe(440);
  });

  it('con poco sitio a la derecha pero bastante a la izquierda, al margen izquierdo', () => {
    const hoja: Rect = { left: 600, top: 70, width: 900, height: 780 };
    const c = colocarVentana({ ...base, hoja, ancla: { left: 700, top: 300, width: 300, height: 30 }, vertical: false });
    expect(c.lado).toBe('margen-izquierdo');
    expect(c.left).toBe(600 - 10 - 440);
  });

  it('sin margen, en horizontal va encima del renglón, sobre lo ya leído, y crece hacia arriba', () => {
    const hoja: Rect = { left: 20, top: 70, width: 1560, height: 2000 };
    const c = colocarVentana({ ...base, hoja, ancla: { left: 400, top: 600, width: 600, height: 60 }, vertical: false });
    expect(c.lado).toBe('encima');
    expect(c.bottom).toBe(900 - (600 - 10));
    expect(c.top).toBeUndefined();
    expect(c.maxAlto).toBe(600 - 60 - 10 - 12);
  });

  it('si lo elegido está arriba del todo, debajo', () => {
    const hoja: Rect = { left: 20, top: 70, width: 1560, height: 2000 };
    const c = colocarVentana({ ...base, hoja, ancla: { left: 400, top: 120, width: 600, height: 60 }, vertical: false });
    expect(c.lado).toBe('debajo');
    expect(c.top).toBe(190);
  });

  it('en vertical va a la derecha de la columna, que ya se ha leído, y a la izquierda si no cabe', () => {
    const hoja: Rect = { left: 20, top: 70, width: 1560, height: 780 };
    const enMedio = colocarVentana({ ...base, hoja, ancla: { left: 700, top: 100, width: 40, height: 500 }, vertical: true });
    expect(enMedio.lado).toBe('derecha');
    expect(enMedio.left).toBe(750);
    const alBorde = colocarVentana({ ...base, hoja, ancla: { left: 1400, top: 100, width: 40, height: 500 }, vertical: true });
    expect(alBorde.lado).toBe('izquierda');
    expect(alBorde.left).toBe(1400 - 10 - 440);
    // En una vista estrecha, a la derecha de la columna se estrecha para no taparla.
    const estrecha = colocarVentana({ ...base, zona: { left: 48, top: 60, width: 792, height: 800 }, hoja: { left: 60, top: 70, width: 770, height: 780 }, ancla: { left: 391, top: 100, width: 30, height: 500 }, vertical: true });
    expect(estrecha.lado).toBe('derecha');
    expect(estrecha.left).toBe(431);
    expect(estrecha.ancho).toBe(840 - 421 - 10 - 12);
  });

  it('nunca se sale de la zona', () => {
    const c = colocarVentana({ ...base, hoja: null, ancla: { left: 1580, top: 500, width: 10, height: 20 }, vertical: false });
    expect(c.left).toBe(1600 - 12 - 440);
  });
});
