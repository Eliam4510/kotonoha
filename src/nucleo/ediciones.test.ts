import { describe, expect, it } from 'vitest';
import type { LineaTexto } from './capaTexto';
import { aplicarEdiciones, type EdicionLinea, solape } from './ediciones';

const linea = (texto: string, x0: number, y0: number, x1: number, y1: number, cortes?: number[]): LineaTexto => ({ texto, caja: { x0, y0, x1, y1 }, vertical: false, ...(cortes ? { cortes } : {}) });
const edicion = (texto: string, x0: number, y0: number, x1: number, y1: number, clave = 'e1'): EdicionLinea => ({ clave, libro: 'l', pagina: 0, caja: { x0, y0, x1, y1 }, original: '', texto, creada: 1 });

describe('lo editado a mano', () => {
  it('mide lo que se solapan dos cajas', () => {
    expect(solape({ x0: 0, y0: 0, x1: 1, y1: 1 }, { x0: 0, y0: 0, x1: 1, y1: 1 })).toBe(1);
    expect(solape({ x0: 0, y0: 0, x1: 1, y1: 1 }, { x0: 2, y0: 2, x1: 3, y1: 3 })).toBe(0);
    expect(solape({ x0: 0, y0: 0, x1: 2, y1: 1 }, { x0: 1, y0: 0, x1: 3, y1: 1 })).toBeCloseTo(1 / 3);
  });

  it('va a la línea del mismo sitio, aunque el OCR la haya vuelto a leer con la caja un poco distinta', () => {
    const leidas = [linea('最初の行', 0.1, 0.1, 0.9, 0.15), linea('二番目の行です', 0.1, 0.2, 0.9, 0.25)];
    const [a, b] = aplicarEdiciones(leidas, [edicion('二番目の行だ', 0.11, 0.2, 0.88, 0.26)]);
    expect(a).toEqual(leidas[0]);
    expect(b).toMatchObject({ texto: '二番目の行だ', original: '二番目の行です', edicion: 'e1' });
  });

  it('si ninguna línea ocupa su sitio, no se pone en ninguna', () => {
    const leidas = [linea('ひとつ', 0.1, 0.1, 0.5, 0.15)];
    expect(aplicarEdiciones(leidas, [edicion('ふたつ', 0.1, 0.6, 0.5, 0.65)])).toEqual(leidas);
  });

  it('con otro largo, la posición de cada letra se reparte por igual; con el mismo, se conserva', () => {
    const cortes = [0.1, 0.2, 0.3, 0.4];
    const [corta] = aplicarEdiciones([linea('あいう', 0.1, 0.1, 0.4, 0.15, cortes)], [edicion('あい', 0.1, 0.1, 0.4, 0.15)]);
    expect(corta.cortes).toBeUndefined();
    const [igual] = aplicarEdiciones([linea('あいう', 0.1, 0.1, 0.4, 0.15, cortes)], [edicion('あいえ', 0.1, 0.1, 0.4, 0.15)]);
    expect(igual.cortes).toEqual(cortes);
  });

  it('no toca las líneas que recibe', () => {
    const leidas = [linea('もと', 0, 0, 1, 1)];
    aplicarEdiciones(leidas, [edicion('かえた', 0, 0, 1, 1)]);
    expect(leidas[0].texto).toBe('もと');
  });
});
