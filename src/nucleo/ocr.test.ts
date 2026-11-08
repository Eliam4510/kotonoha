import { describe, expect, it } from 'vitest';
import {
  aTensor,
  bloquesDeDetector,
  type Caja,
  cajasDeMapa,
  decodificarCtc,
  esRuidoManga,
  esVertical,
  idsRepetibles,
  type LineaOcr,
  medidaDeDeteccion,
  ordenarLineas,
  ordenManga,
  ordenMangaPorVinetas,
  ordenVinetas,
  quitarFurigana,
  siguienteToken,
  textoDeMangaOcr,
  vinetasDeImagen,
} from './ocr';

const linea = (texto: string, x0: number, y0: number, x1: number, y1: number, vertical = false): LineaOcr => ({ texto, vertical, caja: { x0, y0, x1, y1 } });

describe('preparar la imagen', () => {
  it('RGBA a CHW, en BGR para PaddleOCR', () => {
    const t = aTensor([255, 0, 0, 255, 0, 0, 255, 255], 2, 1, (v) => v, true);
    // El primer canal es el azul: 0 en el píxel rojo y 1 en el azul.
    expect([...t]).toEqual([0, 1, 0, 0, 1, 0]);
  });

  it('la entrada del detector, en múltiplos de 32 y sin pasar del límite', () => {
    expect(medidaDeDeteccion(1358, 1920)).toEqual({ w: 1344, h: 1920 });
    expect(medidaDeDeteccion(3000, 1000, 960)).toEqual({ w: 960, h: 320 });
  });
});

describe('las cajas del detector DB', () => {
  it('cada mancha del mapa es una caja, ensanchada y llevada a la imagen original', () => {
    const W = 20;
    const H = 10;
    const mapa = new Float32Array(W * H);
    const pintar = (x0: number, y0: number, x1: number, y1: number) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) mapa[y * W + x] = 0.9;
    };
    pintar(2, 2, 9, 4);
    pintar(12, 6, 17, 8);
    const cajas = cajasDeMapa(mapa, W, H, 200, 100);
    expect(cajas).toHaveLength(2);
    // La primera mancha va de x 2 a 9: en la original, de 20 a 100, algo más ancha por la expansión.
    expect(cajas[0].x0).toBeLessThan(20);
    expect(cajas[0].x1).toBeGreaterThan(100);
  });

  it('una mancha floja no es texto', () => {
    const mapa = new Float32Array(100).fill(0.35);
    expect(cajasDeMapa(mapa, 10, 10, 10, 10)).toEqual([]);
  });
});

describe('la salida CTC', () => {
  it('junta los repetidos, salta los blancos y el último índice es un espacio', () => {
    const dic = ['a', 'b'];
    // Clases: 0 blanco, 1 «a», 2 «b», 3 espacio.
    const pasos = [1, 1, 0, 1, 2, 3, 2];
    const probs = pasos.flatMap((k) => [0, 1, 2, 3].map((c) => (c === k ? 1 : 0)));
    expect(decodificarCtc(probs, pasos.length, 4, dic)).toBe('aab b');
  });
});

describe('el furigana impreso', () => {
  it('se quita el kana pequeño pegado a una línea, y se queda lo demás', () => {
    const lineas = [
      linea('母親は節水をしている。', 100, 100, 600, 140),
      linea('ははおや せっすい', 100, 142, 260, 158),
      linea('災害のため、水が止まってしまった。', 100, 200, 650, 240),
      linea('注', 700, 300, 716, 316),
    ];
    expect(quitarFurigana(lineas).map((l) => l.texto)).toEqual(['母親は節水をしている。', '災害のため、水が止まってしまった。', '注']);
  });

  it('también cuando casi la mitad de las líneas son furigana, como en los libros para estudiantes', () => {
    // Antes se comparaba con la mediana de la página, y aquí la mediana es la del furigana: no se quitaba nada.
    const lineas = [
      linea('去年の地震から十年が経ち、町の図書館で', 0.1, 0.3, 0.9, 0.33),
      linea('じしん', 0.4, 0.284, 0.48, 0.298),
      linea('写真の展示が始まった。', 0.1, 0.36, 0.5, 0.39),
      linea('てんじ', 0.2, 0.344, 0.26, 0.358),
      linea('すいどう', 0.6, 0.444, 0.68, 0.458),
      linea('すいどうかん', 0.1, 0.5, 0.3, 0.53),
    ];
    // «すいどう» no tiene una línea más gruesa justo debajo; «すいどうかん» tiene el grosor de una línea normal.
    expect(quitarFurigana(lineas).map((l) => l.texto)).toEqual(['去年の地震から十年が経ち、町の図書館で', '写真の展示が始まった。', 'すいどう', 'すいどうかん']);
  });

  it('en vertical, el furigana va a la derecha de la columna', () => {
    const lineas = [linea('私は今友だちと話している', 0.5, 0.1, 0.54, 0.6, true), linea('わたし', 0.545, 0.1, 0.56, 0.16, true), linea('別の列', 0.3, 0.1, 0.34, 0.3, true)];
    expect(quitarFurigana(lineas).map((l) => l.texto)).toEqual(['私は今友だちと話している', '別の列']);
  });
});

describe('el orden de lectura', () => {
  it('una página horizontal, por renglones', () => {
    const lineas = [linea('b', 300, 100, 400, 130), linea('c', 100, 200, 400, 230), linea('a', 100, 102, 280, 128)];
    expect(ordenarLineas(lineas).map((l) => l.texto)).toEqual(['a', 'b', 'c']);
  });

  it('una página vertical, por columnas de derecha a izquierda', () => {
    const lineas = [linea('izquierda', 100, 50, 130, 400, true), linea('derecha', 300, 50, 330, 400, true), linea('centro', 200, 50, 230, 400, true)];
    expect(ordenarLineas(lineas).map((l) => l.texto)).toEqual(['derecha', 'centro', 'izquierda']);
  });

  it('una página a dos columnas con título, columna a columna y no renglón a renglón', () => {
    const lineas = [
      linea('título', 0.1, 0.05, 0.9, 0.09),
      linea('izq 1', 0.1, 0.12, 0.47, 0.14),
      linea('der 1', 0.53, 0.12, 0.9, 0.14),
      linea('izq 2', 0.1, 0.15, 0.47, 0.17),
      linea('der 2', 0.53, 0.15, 0.9, 0.17),
      linea('izq 3', 0.1, 0.18, 0.47, 0.2),
    ];
    expect(ordenarLineas(lineas).map((l) => l.texto)).toEqual(['título', 'izq 1', 'izq 2', 'izq 3', 'der 1', 'der 2']);
  });

  it('una columna de números al margen no se lee aparte del texto', () => {
    const lineas = [linea('問1', 0.08, 0.1, 0.12, 0.12), linea('Aの元素名を記せ。', 0.16, 0.1, 0.8, 0.12), linea('問2', 0.08, 0.14, 0.12, 0.16), linea('Bの化学式を答えよ。', 0.16, 0.14, 0.8, 0.16)];
    expect(ordenarLineas(lineas).map((l) => l.texto)).toEqual(['問1', 'Aの元素名を記せ。', '問2', 'Bの化学式を答えよ。']);
  });

  it('un manga, por franjas y de derecha a izquierda', () => {
    const bloque = (t: string, x0: number, y0: number, x1: number, y1: number) => ({ t, caja: { x0, y0, x1, y1 } });
    const orden = ordenManga([bloque('abajo', 100, 700, 200, 900), bloque('izq', 100, 100, 200, 300), bloque('der', 600, 120, 700, 330)]);
    expect(orden.map((b) => b.t)).toEqual(['der', 'izq', 'abajo']);
  });

  it('una caja alta es una columna vertical', () => {
    expect(esVertical({ x0: 0, y0: 0, x1: 30, y1: 200 })).toBe(true);
    expect(esVertical({ x0: 0, y0: 0, x1: 300, y1: 30 })).toBe(false);
  });
});

describe('el detector de globos', () => {
  it('deja el texto, quita los globos, lo flojo y lo repetido', () => {
    const etiquetas = [1, 0, 2, 1, 1];
    const cajas = [10, 10, 110, 210, 0, 0, 500, 500, 300, 50, 360, 150, 12, 12, 108, 205, 400, 400, 420, 420];
    const puntos = [0.9, 0.95, 0.8, 0.85, 0.2];
    const salida: Caja[] = bloquesDeDetector(etiquetas, cajas, puntos, 800, 1200).map(({ x0, y0, x1, y1 }) => ({ x0, y0, x1, y1 }));
    expect(salida).toEqual([{ x0: 10, y0: 10, x1: 110, y1: 210 }, { x0: 300, y0: 50, x1: 360, y1: 150 }]);
  });

  it('el texto de un globo se acepta con menos seguridad que el suelto', () => {
    // Un globo con solo «……» puntúa bajo; lo suelto con la misma puntuación suele ser fondo o una marca de agua.
    const salida = bloquesDeDetector([1, 2], [10, 10, 60, 120, 300, 10, 360, 120], [0.3, 0.3], 800, 1200);
    expect(salida.map((b) => [b.etiqueta, b.puntuacion])).toEqual([[1, 0.3]]);
  });
});

describe('manga-ocr', () => {
  it('no repite trigramas', () => {
    // Vocabulario de 3; el mejor siempre sería el 2, pero «1 2» ya fue seguido de «2».
    const logits = [0, 0.5, 1];
    expect(siguienteToken(logits, 0, 3, [1, 2, 2, 1, 2])).toBe(1);
    expect(siguienteToken(logits, 0, 3, [1, 2])).toBe(2);
  });

  it('los signos repetibles sí se repiten, para que «……» no se quede en «…», pero sin enredarse', () => {
    const vocab = ['[PAD]', '[UNK]', '[CLS]', '[SEP]', '[MASK]', 'あ', '.'];
    const repetibles = idsRepetibles(vocab);
    expect([...repetibles]).toEqual([6]);
    // El mejor es siempre el punto (6).
    const logits = [0, 0, 0, 0, 0, 0.5, 1];
    expect(siguienteToken(logits, 0, 7, [2, 6, 6, 6])).toBe(5);
    expect(siguienteToken(logits, 0, 7, [2, 6, 6, 6], repetibles)).toBe(6);
    // Ocho puntos seguidos y uno más: se acaba el globo.
    expect(siguienteToken(logits, 0, 7, [2, 6, 6, 6, 6, 6, 6, 6, 6], repetibles)).toBe(3);
  });

  it('del vocabulario al texto, sin especiales y con los puntos suspensivos enteros', () => {
    const vocab = ['[PAD]', '[UNK]', '[CLS]', '[SEP]', '[MASK]', 'あ', '.', '…', 'ー', '!'];
    expect(textoDeMangaOcr([2, 5, 6, 6, 6, 3], vocab)).toBe('あ…');
    expect(textoDeMangaOcr([2, 6, 6, 6, 6, 6, 6, 5], vocab)).toBe('……あ');
    expect(textoDeMangaOcr([2, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6], vocab)).toBe('あ……');
    expect(textoDeMangaOcr([2, 5, 8, 8, 8, 8, 8, 8, 9, 9, 9, 9, 9], vocab)).toBe('あーーーー!!!');
  });

  it('lo que no es texto de la página: marcas de agua, números y texto suelto dudoso', () => {
    expect(esRuidoManga('MangaEjemplo.Net', 2, 0.9)).toBe(true);
    expect(esRuidoManga('—59—', 2, 0.9)).toBe(true);
    expect(esRuidoManga('うわーーーっ', 2, 0.42)).toBe(true);
    expect(esRuidoManga('また明日ね', 1, 0.99)).toBe(false);
    expect(esRuidoManga('……', 1, 0.5)).toBe(false);
    expect(esRuidoManga('ほぼ100%', 2, 0.9)).toBe(false);
  });
});

describe('las viñetas del manga', () => {
  /** Una página en grises: blanca, con rectángulos negros por viñeta (el dibujo) y canales blancos entre ellos. */
  const pagina = (w: number, h: number, vinetas: [number, number, number, number][], trazos: [number, number, number, number][] = []) => {
    const gris = new Uint8Array(w * h).fill(255);
    for (const [x0, y0, x1, y1] of [...vinetas, ...trazos]) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) gris[y * w + x] = 20;
    return gris;
  };

  it('encuentra las viñetas por los canales blancos, aunque un trazo fino cruce el canal', () => {
    // Arriba, dos viñetas lado a lado; abajo, una ancha. Una línea de un píxel une la de arriba a la derecha con la de abajo.
    const gris = pagina(100, 140, [[5, 5, 47, 60], [53, 5, 95, 60], [5, 66, 95, 135]], [[70, 60, 71, 66]]);
    const v = vinetasDeImagen(gris, 100, 140);
    expect(v).toHaveLength(3);
    expect(ordenVinetas(v).map((c) => [Math.round(c.x0 * 100), Math.round(c.y0 * 140)])).toEqual([
      [53, 5],
      [5, 5],
      [5, 66],
    ]);
  });

  it('los globos van por viñetas: la viñeta de la derecha entera antes que la de la izquierda', () => {
    const vinetas = [
      { x0: 0.05, y0: 0.05, x1: 0.47, y1: 0.45 },
      { x0: 0.53, y0: 0.05, x1: 0.95, y1: 0.45 },
    ];
    const bloque = (t: string, x0: number, y0: number, x1: number, y1: number) => ({ t, caja: { x0, y0, x1, y1 } });
    // «izq» está más arriba que «der abajo», pero en la viñeta de la izquierda: por franjas saldría antes.
    const bloques = [bloque('der arriba', 0.8, 0.06, 0.9, 0.2), bloque('izq', 0.1, 0.08, 0.2, 0.25), bloque('der abajo', 0.6, 0.25, 0.7, 0.4)];
    expect(ordenManga(bloques).map((b) => b.t)).toEqual(['der arriba', 'izq', 'der abajo']);
    expect(ordenMangaPorVinetas(bloques, vinetas).map((b) => b.t)).toEqual(['der arriba', 'der abajo', 'izq']);
  });

  it('sin viñetas claras, el orden de siempre', () => {
    const bloque = (t: string, x0: number, y0: number) => ({ t, caja: { x0, y0, x1: x0 + 0.1, y1: y0 + 0.1 } });
    expect(ordenMangaPorVinetas([bloque('b', 0.2, 0.1), bloque('a', 0.7, 0.1)], []).map((b) => b.t)).toEqual(['a', 'b']);
  });
});
