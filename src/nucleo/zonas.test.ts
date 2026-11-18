import { describe, expect, it } from 'vitest';
import type { LineaOcr } from './ocr';
import { comoGlobo, conZonas, lineasDeZona, recorteDeZona } from './zonas';

const linea = (texto: string, x0: number, y0: number, x1: number, y1: number, vertical = false): LineaOcr => ({ caja: { x0, y0, x1, y1 }, texto, vertical });

describe('recorteDeZona', () => {
  it('recorta la zona de una imagen que es la página entera, a píxeles enteros', () => {
    const r = recorteDeZona({ x0: 0.1, y0: 0.2, x1: 0.35, y1: 0.4 }, 1000, 2000);
    expect(r).toMatchObject({ x: 100, y: 400, ancho: 250, alto: 400 });
    expect(r!.marco.x0).toBeCloseTo(0.1);
    expect(r!.marco.y1).toBeCloseTo(0.4);
  });

  it('el marco sale de los píxeles redondeados: lo leído cae justo en su sitio', () => {
    const r = recorteDeZona({ x0: 0.1004, y0: 0.2, x1: 0.3, y1: 0.4 }, 1000, 1000)!;
    // 100,4 px se redondea hacia fuera, a 100: el marco empieza donde empieza el recorte.
    expect(r.x).toBe(100);
    expect(r.marco.x0).toBeCloseTo(0.1, 9);
  });

  it('en un escaneo que no llena la página, solo lo que la zona tiene dentro de la imagen', () => {
    // La imagen va de 0,1 a 0,9 en x y de 0,05 a 0,95 en y; la zona se sale por la izquierda.
    const marco = { x0: 0.1, y0: 0.05, x1: 0.9, y1: 0.95 };
    const r = recorteDeZona({ x0: 0, y0: 0.5, x1: 0.5, y1: 0.95 }, 800, 900, marco)!;
    expect(r).toMatchObject({ x: 0, y: 450, ancho: 400, alto: 450 });
    expect(r.marco.x0).toBeCloseTo(0.1);
    expect(r.marco.x1).toBeCloseTo(0.5);
    expect(r.marco.y0).toBeCloseTo(0.5);
    expect(r.marco.y1).toBeCloseTo(0.95);
  });

  it('nada si la zona cae fuera de la imagen o es una raya', () => {
    const marco = { x0: 0.1, y0: 0.1, x1: 0.9, y1: 0.9 };
    expect(recorteDeZona({ x0: 0, y0: 0, x1: 0.08, y1: 0.5 }, 800, 800, marco)).toBeNull();
    expect(recorteDeZona({ x0: 0.2, y0: 0.2, x1: 0.6, y1: 0.205 }, 800, 800)).toBeNull();
  });
});

describe('conZonas', () => {
  const pagina = [linea('一行目', 0.1, 0.1, 0.9, 0.15), linea('ずれた行', 0.1, 0.4, 0.9, 0.45), linea('最後の行', 0.1, 0.8, 0.9, 0.85)];

  it('lo leído en una zona sin texto va al final', () => {
    const z = [linea('看板', 0.4, 0.6, 0.6, 0.65)];
    expect(conZonas(pagina, [{ caja: { x0: 0.3, y0: 0.55, x1: 0.7, y1: 0.7 }, lineas: z }]).map((l) => l.texto)).toEqual(['一行目', 'ずれた行', '最後の行', '看板']);
  });

  it('lo que había dentro se cambia por lo leído, en su sitio del orden de lectura', () => {
    const z = [linea('正しい行', 0.1, 0.4, 0.9, 0.45)];
    expect(conZonas(pagina, [{ caja: { x0: 0, y0: 0.35, x1: 1, y1: 0.5 }, lineas: z }]).map((l) => l.texto)).toEqual(['一行目', '正しい行', '最後の行']);
  });

  it('una zona leída después manda sobre otra en lo que tienen en común', () => {
    const a = { caja: { x0: 0, y0: 0.55, x1: 1, y1: 0.7 }, lineas: [linea('前', 0.1, 0.6, 0.4, 0.65), linea('右', 0.6, 0.6, 0.9, 0.65)] };
    const b = { caja: { x0: 0, y0: 0.55, x1: 0.5, y1: 0.7 }, lineas: [linea('後', 0.1, 0.6, 0.4, 0.65)] };
    expect(conZonas(pagina, [a, b]).map((l) => l.texto)).toEqual(['一行目', 'ずれた行', '最後の行', '後', '右']);
  });

  it('sin zonas, las mismas líneas', () => {
    expect(conZonas(pagina, [])).toBe(pagina);
  });
});

describe('comoGlobo', () => {
  it('une las columnas de un globo sin espacio en japonés, con la caja de todas', () => {
    const g = comoGlobo([linea('もしもし', 0.6, 0.1, 0.65, 0.4, true), linea('聞こえる？', 0.5, 0.1, 0.55, 0.45, true)])!;
    expect(g.texto).toBe('もしもし聞こえる？');
    expect(g.vertical).toBe(true);
    expect(g.caja).toEqual({ x0: 0.5, y0: 0.1, x1: 0.65, y1: 0.45 });
    expect(g.cortes).toBeUndefined();
  });

  it('con un espacio donde se separan las palabras, y sin el guion que parte una', () => {
    expect(comoGlobo([linea('Das ist', 0.1, 0.1, 0.4, 0.15), linea('ein Ver-', 0.1, 0.16, 0.4, 0.2), linea('such!', 0.1, 0.21, 0.2, 0.25)])!.texto).toBe('Das ist ein Versuch!');
  });

  it('nada si no se leyó nada', () => {
    expect(comoGlobo([linea('  ', 0, 0, 1, 1)])).toBeNull();
  });
});

describe('lineasDeZona', () => {
  it('encuentra lo leído en la página por sus cajas, aunque sean copias', () => {
    const leidas = [linea('看板', 0.4, 0.6, 0.6, 0.65)];
    const pagina = [linea('一行目', 0.1, 0.1, 0.9, 0.15), { ...leidas[0], texto: '看板です' }];
    expect(lineasDeZona(pagina, leidas)).toEqual([1]);
  });
});
