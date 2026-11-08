import { describe, expect, it } from 'vitest';
import { cajaDeTramo, caracterEn, type LineaTexto, leerConOcr, letraNormal, lineasDePdf, textoDePagina, type TrozoPdf } from './capaTexto';

describe('el texto del PDF o el del OCR', () => {
  const propias = ['del PDF'];
  const ocr = ['del OCR'];
  it('con «Texto del PDF», el del PDF donde lo hay y el OCR donde no', () => {
    expect(textoDePagina(propias, ocr, { ocrActivo: true, textoPdf: true })).toEqual({ lineas: propias, propias: true });
    expect(textoDePagina(null, ocr, { ocrActivo: true, textoPdf: true })).toEqual({ lineas: ocr, propias: false });
    expect(leerConOcr(propias, true)).toBe(false);
    expect(leerConOcr(null, true)).toBe(true);
    // Aún sin mirar el texto de la página, no se gasta el OCR en ella.
    expect(leerConOcr(undefined, true)).toBe(false);
  });

  it('sin «Texto del PDF», el OCR en todas las páginas, también las que traen texto (la capa de un OCR antiguo)', () => {
    expect(textoDePagina(propias, ocr, { ocrActivo: true, textoPdf: false })).toEqual({ lineas: ocr, propias: false });
    expect(leerConOcr(propias, false)).toBe(true);
    expect(leerConOcr(undefined, false)).toBe(true);
    // Mientras el OCR lee la página, no se muestra el texto del PDF que se ha pedido no usar.
    expect(textoDePagina(propias, undefined, { ocrActivo: true, textoPdf: false })).toBeUndefined();
  });

  it('con el OCR apagado, siempre el del PDF', () => {
    expect(textoDePagina(propias, ocr, { ocrActivo: false, textoPdf: false })).toEqual({ lineas: propias, propias: true });
    expect(textoDePagina(null, ocr, { ocrActivo: false, textoPdf: true })).toBeUndefined();
  });
});

const ANCHO = 600;
const ALTO = 800;

/** Un trozo en horizontal: x, línea base y tamaño de letra en la vista, con el origen arriba a la izquierda. */
const horizontal = (texto: string, x: number, base: number, letra: number, avance = letra * [...texto].length): TrozoPdf => ({
  texto,
  tx: [letra, 0, 0, -letra, x, base],
  avance,
  vertical: false,
  ascenso: 0.8,
});

const cerca = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-9);

describe('las líneas de un PDF con texto', () => {
  it('junta los trozos de un renglón, con la posición de cada letra', () => {
    const [l] = lineasDePdf([horizontal('今日は', 50, 100, 20), horizontal('雨です。', 110, 100, 20)], ANCHO, ALTO);
    expect(l.texto).toBe('今日は雨です。');
    expect(l.vertical).toBe(false);
    expect(cerca(l.cortes!, [50, 70, 90, 110, 130, 150, 170, 190].map((v) => v / ANCHO))).toBe(true);
    expect(l.caja.x0).toBeCloseTo(50 / ANCHO);
    expect(l.caja.y0).toBeCloseTo(84 / ALTO);
    expect(l.caja.y1).toBeCloseTo(104 / ALTO);
  });

  it('cada renglón es una línea, en el orden del archivo', () => {
    const l = lineasDePdf([horizontal('一行目です。', 50, 100, 20), horizontal('二行目です。', 50, 140, 20)], ANCHO, ALTO);
    expect(l.map((x) => x.texto)).toEqual(['一行目です。', '二行目です。']);
  });

  it('letras sueltas una debajo de otra forman una columna, como en un PDF hecho desde una página vertical', () => {
    const letras = ['縦', '書', 'き'].map((c, k) => horizontal(c, 300, 100 + k * 20, 20));
    const [l] = lineasDePdf(letras, ANCHO, ALTO);
    expect(l.texto).toBe('縦書き');
    expect(l.vertical).toBe(true);
    expect(cerca(l.cortes!, [84, 104, 124, 144].map((v) => v / ALTO))).toBe(true);
  });

  it('una fuente vertical avanza hacia abajo y ocupa su columna como en pdf.js', () => {
    const [l] = lineasDePdf([{ texto: '縦書きの文', tx: [20, 0, 0, -20, 400, 50], avance: 100, vertical: true, ascenso: 0.8 }], ANCHO, ALTO);
    expect(l.vertical).toBe(true);
    expect(l.caja.x0).toBeCloseTo(396 / ANCHO);
    expect(l.caja.x1).toBeCloseTo(416 / ANCHO);
    expect(l.caja.y0).toBeCloseTo(50 / ALTO);
    expect(l.caja.y1).toBeCloseTo(150 / ALTO);
    expect(l.cortes![1]).toBeCloseTo(70 / ALTO);
  });

  it('separa con un espacio las palabras que lo necesitan, y sin espacios en los extremos', () => {
    const [l] = lineasDePdf([horizontal('Hello ', 50, 100, 10, 50), horizontal('world', 105, 100, 10, 50)], ANCHO, ALTO);
    expect(l.texto).toBe('Hello world');
    expect(l.cortes!.length).toBe(l.texto.length + 1);
    const [j] = lineasDePdf([horizontal('日本', 50, 100, 20), horizontal('語', 95, 100, 20)], ANCHO, ALTO);
    expect(j.texto).toBe('日本語');
  });

  it('el furigana intercalado no parte la línea de debajo y luego se quita', () => {
    const l = lineasDePdf([horizontal('漢字', 50, 100, 20), horizontal('かんじ', 50, 82, 10, 30), horizontal('を読む', 90, 100, 20)], ANCHO, ALTO);
    expect(l.map((x) => x.texto)).toEqual(['漢字を読む']);
  });

  it('los radicales Kangxi y los signos verticales pasan a la letra que son, una por una', () => {
    const [l] = lineasDePdf([horizontal('今⽇は⾞で⽂章を', 50, 100, 20), horizontal('︒', 210, 100, 20)], ANCHO, ALTO);
    expect(l.texto).toBe('今日は車で文章を。');
    expect(l.cortes!.length).toBe(l.texto.length + 1);
    expect(letraNormal('…')).toBe('…');
    expect(letraNormal('Ａ')).toBe('Ａ');
  });

  it('sin texto, sin líneas', () => {
    expect(lineasDePdf([horizontal('', 0, 0, 10), horizontal('   ', 10, 10, 10)], ANCHO, ALTO)).toEqual([]);
  });
});

describe('la letra que se toca', () => {
  const linea: LineaTexto = { texto: '今日は雨です。', vertical: false, caja: { x0: 50 / ANCHO, y0: 0.1, x1: 190 / ANCHO, y1: 0.13 }, cortes: [50, 70, 90, 110, 130, 150, 170, 190].map((v) => v / ANCHO) };

  it('con la posición de cada letra', () => {
    expect(caracterEn(linea, 75 / ANCHO, 0.11)).toBe(1);
    expect(caracterEn(linea, 0, 0.11)).toBe(0);
    expect(caracterEn(linea, 1, 0.11)).toBe(6);
  });

  it('sin ella, las letras se reparten por la caja, también en vertical', () => {
    const ocr: LineaTexto = { texto: 'あいうえ', vertical: false, caja: { x0: 0.1, y0: 0.1, x1: 0.5, y1: 0.15 } };
    expect(caracterEn(ocr, 0.32, 0.12)).toBe(2);
    const c = cajaDeTramo(ocr, 1, 3);
    expect(c.x0).toBeCloseTo(0.2);
    expect(c.x1).toBeCloseTo(0.4);
    const columna: LineaTexto = { texto: 'あいうえ', vertical: true, caja: { x0: 0.6, y0: 0.2, x1: 0.65, y1: 0.6 } };
    expect(caracterEn(columna, 0.62, 0.45)).toBe(2);
    const primera = cajaDeTramo(columna, 0, 1);
    expect([primera.x0, primera.x1, primera.y0]).toEqual([0.6, 0.65, 0.2]);
    expect(primera.y1).toBeCloseTo(0.3);
  });
});
