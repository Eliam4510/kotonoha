import { describe, expect, it } from 'vitest';
import type { AnotacionLibro } from '../compartido/tipos';
import { notasComoTexto, nuevoResaltado, ordenadas, porPagina, resaltadosDe } from './anotaciones';
import type { LineaTexto } from './capaTexto';

/** Un renglón de diez letras repartidas por igual entre x = 0,1 y x = 0,6. */
const renglon: LineaTexto = { caja: { x0: 0.1, y0: 0.2, x1: 0.6, y1: 0.25 }, texto: 'abcdefghij', vertical: false };
const columna: LineaTexto = { caja: { x0: 0.8, y0: 0.1, x1: 0.85, y1: 0.6 }, texto: 'あいうえおかきくけこ', vertical: true };
const base = { libro: 'l', pagina: 3, estilo: 'fondo' as const, color: 'amarillo' as const };

describe('un resaltado', () => {
  it('de un tramo del renglón ocupa solo ese tramo', () => {
    const a = nuevoResaltado({ ...base, linea: renglon, tramo: { inicio: 2, fin: 5 }, porLetra: true });
    expect(a.texto).toBe('cde');
    expect(a.cajas?.[0].x0).toBeCloseTo(0.2);
    expect(a.cajas?.[0].x1).toBeCloseTo(0.35);
    expect(a.cajas?.[0].y0).toBe(0.2);
    expect(a.linea).toEqual(renglon.caja);
    expect(a.vertical).toBe(false);
  });

  it('en una columna, de arriba abajo; y al revés, si se eligió de atrás adelante', () => {
    const a = nuevoResaltado({ ...base, linea: columna, tramo: { inicio: 8, fin: 5 }, porLetra: true });
    expect(a.texto).toBe('かきく');
    expect(a.cajas?.[0].y0).toBeCloseTo(0.35);
    expect(a.cajas?.[0].y1).toBeCloseTo(0.5);
    expect(a.cajas?.[0].x0).toBe(0.8);
    expect(a.vertical).toBe(true);
  });

  it('sin tramo, o en un globo sin letras situadas, la línea entera', () => {
    expect(nuevoResaltado({ ...base, linea: renglon, porLetra: true })).toMatchObject({ texto: 'abcdefghij', cajas: [renglon.caja] });
    expect(nuevoResaltado({ ...base, linea: renglon, tramo: { inicio: 2, fin: 5 }, porLetra: false })).toMatchObject({ texto: 'abcdefghij', cajas: [renglon.caja] });
  });

  it('es de la línea que ocupa su sitio, aunque el OCR la lea otra vez con la caja algo movida', () => {
    const a = nuevoResaltado({ ...base, linea: renglon, tramo: { inicio: 0, fin: 3 }, porLetra: true });
    const movida = { x0: 0.105, y0: 0.201, x1: 0.61, y1: 0.252 };
    expect(resaltadosDe([a], 3, movida)).toEqual([a]);
    expect(resaltadosDe([a], 3, { x0: 0.1, y0: 0.3, x1: 0.6, y1: 0.35 })).toEqual([]);
    expect(resaltadosDe([a], 4, movida)).toEqual([]);
  });
});

const anotacion = (a: Partial<AnotacionLibro>): AnotacionLibro => ({ id: String(Math.random()), libro: 'l', tipo: 'nota', pagina: 0, creada: 1, ...a });

describe('el orden de lo anotado', () => {
  it('por páginas; en cada una, el marcador primero y lo demás por dónde está, también en vertical', () => {
    const abajo = anotacion({ tipo: 'nota', pagina: 2, punto: { x: 0.5, y: 0.9 } });
    const arriba = anotacion({ tipo: 'resaltado', pagina: 2, cajas: [{ x0: 0.1, y0: 0.1, x1: 0.5, y1: 0.15 }] });
    const marcador = anotacion({ tipo: 'marcador', pagina: 2 });
    const antes = anotacion({ tipo: 'nota', pagina: 0, punto: { x: 0, y: 0.5 } });
    expect(ordenadas([abajo, arriba, marcador, antes])).toEqual([antes, marcador, arriba, abajo]);
    // Columnas: la de la derecha se lee antes.
    const derecha = anotacion({ tipo: 'resaltado', pagina: 1, vertical: true, cajas: [{ x0: 0.8, y0: 0.5, x1: 0.85, y1: 0.6 }] });
    const izquierda = anotacion({ tipo: 'resaltado', pagina: 1, vertical: true, cajas: [{ x0: 0.2, y0: 0.1, x1: 0.25, y1: 0.2 }] });
    expect(ordenadas([izquierda, derecha])).toEqual([derecha, izquierda]);
    expect(porPagina([abajo, antes, arriba]).map((g) => [g.pagina, g.anotaciones.length])).toEqual([[0, 1], [2, 2]]);
  });
});

describe('las notas como texto', () => {
  it('con el título, cada página y lo resaltado como cita, con su comentario', () => {
    const texto = notasComoTexto(
      'Mi libro',
      [
        anotacion({ tipo: 'resaltado', pagina: 4, texto: '水に溶ける', nota: 'Repasar', cajas: [{ x0: 0, y0: 0.5, x1: 1, y1: 0.6 }] }),
        anotacion({ tipo: 'marcador', pagina: 4 }),
        anotacion({ tipo: 'nota', pagina: 0, punto: { x: 0.1, y: 0.1 }, nota: 'Empieza\naquí' }),
      ],
      { pagina: (n) => `Página ${n}`, marcador: 'Marcador', nota: 'Nota' }
    );
    expect(texto).toBe('# Mi libro\n\n## Página 1\n\n- Nota: Empieza aquí\n\n## Página 5\n\n- Marcador\n> 水に溶ける\n\nRepasar\n');
  });
});
