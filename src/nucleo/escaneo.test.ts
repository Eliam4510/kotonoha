import { describe, expect, it } from 'vitest';
import { type CodigosOps, escaneoDe, lineasEnMarco, OPERACIONES, recorteVisible, rgbaDe } from './escaneo';

// pdf.js de verdad, el de Node: sus códigos de operación y, al final, una página real.
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const O = pdfjs.OPS as unknown as CodigosOps;

/** Una página de 600 × 800 puntos vista a escala 1, como la da pdf.js: el origen arriba y la y hacia abajo. */
const VISTA = [1, 0, 0, -1, 0, 800];
type Op = [keyof CodigosOps, unknown[]?];
const lista = (ops: Op[]) => ({ fnArray: ops.map(([n]) => O[n]), argsArray: ops.map(([, a]) => a ?? []) });
const escaneo = (ops: Op[]) => escaneoDe(lista(ops), O, VISTA, 600, 800);
/** Una imagen pintada en un rectángulo de la página (en puntos, con el origen abajo). */
const imagen = (x: number, y: number, w: number, h: number, id = 'img_p0_1'): Op[] => [['save'], ['transform', [w, 0, 0, h, x, y]], ['paintImageXObject', [id, 100, 100]], ['restore']];
const PAGINA = imagen(0, 0, 600, 800);

describe('el escaneo de una página de PDF', () => {
  it('pdf.js tiene todas las operaciones que se miran', () => {
    for (const nombre of OPERACIONES) expect(typeof O[nombre], nombre).toBe('number');
  });

  it('una imagen que ocupa la página entera es su escaneo', () => {
    expect(escaneo(PAGINA)).toEqual({ id: 'img_p0_1', marco: { x0: 0, y0: 0, x1: 1, y1: 1 } });
  });

  it('con margen, el marco dice dónde está; si se sale de la página, también', () => {
    const e = escaneo(imagen(60, 80, 480, 640));
    expect(e?.marco.x0).toBeCloseTo(0.1);
    expect(e?.marco.y0).toBeCloseTo(0.1);
    expect(e?.marco.x1).toBeCloseTo(0.9);
    expect(e?.marco.y1).toBeCloseTo(0.9);
    const grande = escaneo(imagen(-30, -40, 660, 880));
    expect(grande?.marco.x0).toBeCloseTo(-0.05);
    expect(grande?.marco.y1).toBeCloseTo(1.05);
  });

  it('sigue la matriz por los formularios y lo guardado', () => {
    const ops: Op[] = [['save'], ['transform', [0.5, 0, 0, 0.5, 0, 0]], ['paintFormXObjectBegin', [[2, 0, 0, 2, 0, 0], [0, 0, 600, 800]]], ...PAGINA, ['paintFormXObjectEnd'], ['restore']];
    expect(escaneo(ops)?.marco).toEqual({ x0: 0, y0: 0, x1: 1, y1: 1 });
  });

  it('el texto invisible de otro OCR no estorba; el texto visible, sí', () => {
    const texto = (modo: number): Op[] => [['setTextRenderingMode', [modo]], ['showText', [[]]]];
    expect(escaneo([...PAGINA, ...texto(3)])).not.toBeNull();
    expect(escaneo([...PAGINA, ...texto(7)])).not.toBeNull();
    expect(escaneo([...PAGINA, ...texto(0)])).toBeNull();
    expect(escaneo([...texto(3), ['setTextRenderingMode', [0]], ['showSpacedText', [[]]], ...PAGINA])).toBeNull();
  });

  it('el modo del texto va con el estado gráfico: al recuperarlo, vuelve el de antes', () => {
    expect(escaneo([...PAGINA, ['save'], ['setTextRenderingMode', [3]], ['showText', [[]]], ['restore']])).not.toBeNull();
    expect(escaneo([...PAGINA, ['save'], ['setTextRenderingMode', [3]], ['restore'], ['showText', [[]]]])).toBeNull();
  });

  it('lo que solo recorta o traza una línea no estorba; un relleno grande, sí', () => {
    const trazado = (pinta: number, caja: number[]): Op => ['constructPath', [pinta, [new Float32Array(0)], caja]];
    expect(escaneo([trazado(O.endPath, [0, 0, 600, 800]), ...PAGINA])).not.toBeNull();
    expect(escaneo([...PAGINA, trazado(O.stroke, [0, 0, 600, 800])])).not.toBeNull();
    // Un filete relleno, fino: menos del 2 % de la página.
    expect(escaneo([...PAGINA, trazado(O.fill, [50, 400, 550, 402])])).not.toBeNull();
    // Texto convertido en trazados, o un recuadro que tapa parte del escaneo.
    expect(escaneo([...PAGINA, trazado(O.fill, [50, 50, 550, 750])])).toBeNull();
    expect(escaneo([...PAGINA, trazado(O.eoFill, [100, 100, 200, 200])])).toBeNull();
  });

  it('lo que se pinta antes queda debajo del escaneo: solo cuenta lo que asoma', () => {
    const trazado = (caja: number[]): Op => ['constructPath', [O.fill, [new Float32Array(0)], caja]];
    // El fondo blanco de la página, debajo, como lo dejan algunos programas de escaneo.
    expect(escaneo([trazado([-50, -50, 650, 850]), ...PAGINA])?.id).toBe('img_p0_1');
    // Pero si el escaneo solo ocupa la mitad izquierda, lo que se pinta a su derecha se ve.
    expect(escaneo([trazado([400, 0, 600, 800]), ...imagen(0, 0, 400, 800)])).toBeNull();
    // Una imagen debajo del escaneo tampoco se ve; encima, sí.
    expect(escaneo([...imagen(100, 100, 200, 200, 'img_p0_2'), ...PAGINA])?.id).toBe('img_p0_1');
    expect(escaneo([...PAGINA, ...imagen(100, 100, 200, 200, 'img_p0_2')])).toBeNull();
  });

  it('con máscaras o grupos de imágenes no se sabe qué hay encima: se lee la página pintada', () => {
    for (const op of ['paintImageMaskXObject', 'paintImageMaskXObjectGroup', 'paintSolidColorImageMask', 'paintInlineImageXObjectGroup', 'paintImageXObjectRepeat', 'shadingFill'] as const) {
      expect(escaneo([...PAGINA, [op, [{}]]]), op).toBeNull();
    }
  });

  it('tiene que haber una sola imagen grande, y las demás, sueltas y pequeñas', () => {
    expect(escaneo([...PAGINA, ...imagen(0, 0, 600, 800, 'img_p0_2')])).toBeNull();
    // Media página cada una: una doble página en dos imágenes.
    expect(escaneo([...imagen(0, 0, 300, 800), ...imagen(300, 0, 300, 800, 'img_p0_2')])).toBeNull();
    // Un sello de 40 × 40 puntos: un 0,3 % de la página.
    expect(escaneo([...PAGINA, ...imagen(500, 700, 40, 40, 'img_p0_2')])?.id).toBe('img_p0_1');
    // Un fondo con el texto en otra imagen encima, como en la compresión por capas.
    expect(escaneo([...PAGINA, ...imagen(50, 50, 500, 100, 'img_p0_2')])).toBeNull();
    // Menos de la mitad de la página no es un escaneo.
    expect(escaneo(imagen(0, 0, 300, 700))).toBeNull();
    expect(escaneo([])).toBeNull();
  });

  it('una imagen girada o volteada no casa con la página', () => {
    const con = (m: number[]): Op[] => [['save'], ['transform', m], ['paintImageXObject', ['img_p0_1', 100, 100]], ['restore']];
    // Volteada arriba abajo: su primera fila queda al pie.
    expect(escaneo(con([600, 0, 0, -800, 0, 800]))).toBeNull();
    // En espejo.
    expect(escaneo(con([-600, 0, 0, 800, 600, 0]))).toBeNull();
    // Un cuarto de vuelta.
    expect(escaneo(con([0, 800, -600, 0, 600, 0]))).toBeNull();
    // Una imagen en línea, sin identificador, no se puede pedir a pdf.js.
    expect(escaneo([['save'], ['transform', [600, 0, 0, 800, 0, 0]], ['paintInlineImageXObject', [{}]], ['restore']])).toBeNull();
  });
});

describe('la parte visible del escaneo', () => {
  it('dentro de la página, la imagen entera', () => {
    expect(recorteVisible({ x0: 0.1, y0: 0.1, x1: 0.9, y1: 0.9 }, 800, 1000)).toEqual({ x: 0, y: 0, ancho: 800, alto: 1000, marco: { x0: 0.1, y0: 0.1, x1: 0.9, y1: 0.9 } });
  });

  it('lo que se sale se recorta en píxeles enteros, y el marco sigue a los píxeles', () => {
    // 1000 px en 1,1 de página: lo que sobra a la izquierda, 0,05 de página, son 45,45 px.
    const r = recorteVisible({ x0: -0.05, y0: 0, x1: 1.05, y1: 1 }, 1000, 500)!;
    expect(r.x).toBe(45);
    expect(r.ancho).toBe(1000 - 2 * 45);
    expect(r.y).toBe(0);
    expect(r.alto).toBe(500);
    expect(r.marco.x0).toBeCloseTo(-0.05 + 45 * (1.1 / 1000));
    expect(r.marco.x1).toBeCloseTo(-0.05 + 955 * (1.1 / 1000));
    expect(recorteVisible({ x0: 1.2, y0: 0, x1: 2, y1: 1 }, 100, 100)).toBeNull();
  });
});

describe('los píxeles de una imagen de pdf.js', () => {
  it('un bit por píxel, con las filas en bytes enteros; 1 es blanco', () => {
    // 10 × 2: cada fila ocupa 2 bytes.
    const p = rgbaDe(1, [0b10000000, 0b01000000, 0b00000000, 0b00000000], 10, 2);
    expect(Array.from(p.slice(0, 8))).toEqual([255, 255, 255, 255, 0, 0, 0, 255]);
    expect(p[9 * 4]).toBe(255);
    expect(p[(10 + 0) * 4]).toBe(0);
  });

  it('RGB y RGBA', () => {
    expect(Array.from(rgbaDe(2, [1, 2, 3, 4, 5, 6], 2, 1))).toEqual([1, 2, 3, 255, 4, 5, 6, 255]);
    expect(Array.from(rgbaDe(3, [1, 2, 3, 4], 1, 1))).toEqual([1, 2, 3, 4]);
    expect(() => rgbaDe(9, [], 1, 1)).toThrow();
  });
});

describe('las líneas leídas en el escaneo', () => {
  it('pasan a la página, y lo que queda fuera se quita', () => {
    const marco = { x0: -0.1, y0: 0, x1: 1.1, y1: 1 };
    const linea = (x0: number, x1: number) => ({ caja: { x0, y0: 0.2, x1, y1: 0.3 }, texto: 'あ', vertical: false });
    const [dentro, cortada, ...fuera] = lineasEnMarco([linea(0.5, 0.6), linea(0.9, 1), linea(0, 0.05)], marco);
    expect(dentro.caja.x0).toBeCloseTo(0.5);
    expect(dentro.caja.x1).toBeCloseTo(0.62);
    expect(cortada.caja.x1).toBe(1);
    expect(fuera).toEqual([]);
  });
});

// Un PDF hecho a mano como los de un escáner: la imagen, con un margen y un recorte alrededor, y el texto invisible de
// otro programa de OCR encima. Lo que se comprueba es lo que dice pdf.js de verdad, no lo que se supone que dice.
function pdfEscaneado(): Uint8Array {
  const w = 40;
  const h = 50;
  // En grises: todo blanco salvo el primer píxel.
  const pixeles = new Uint8Array(w * h).fill(255);
  pixeles[0] = 0;
  const contenido = '0 0 600 800 re W n q 480 0 0 640 60 80 cm /Im1 Do Q BT 3 Tr /F1 28 Tf 60 650 Td (capa) Tj ET';
  const objetos: (string | Uint8Array)[][] = [
    ['<< /Type /Catalog /Pages 2 0 R >>'],
    ['<< /Type /Pages /Kids [5 0 R] /Count 1 >>'],
    ['<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'],
    [`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceGray /BitsPerComponent 8 /Length ${pixeles.length} >>\nstream\n`, pixeles, '\nendstream'],
    ['<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Contents 6 0 R /Resources << /Font << /F1 3 0 R >> /XObject << /Im1 4 0 R >> >> >>'],
    [`<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`],
  ];
  const partes: Uint8Array[] = [];
  let largo = 0;
  const poner = (t: string | Uint8Array) => {
    const b = typeof t === 'string' ? new TextEncoder().encode(t) : t;
    partes.push(b);
    largo += b.length;
  };
  poner('%PDF-1.4\n');
  const posiciones = objetos.map((o, i) => {
    const p = largo;
    for (const t of [`${i + 1} 0 obj\n`, ...o, '\nendobj\n']) poner(t);
    return p;
  });
  const xref = largo;
  poner(`xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n${posiciones.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('')}`);
  poner(`trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const salida = new Uint8Array(largo);
  let i = 0;
  for (const b of partes) {
    salida.set(b, i);
    i += b.length;
  }
  return salida;
}

describe('con pdf.js de verdad', () => {
  it('encuentra el escaneo, su sitio y sus píxeles', async () => {
    const tarea = pdfjs.getDocument({ data: pdfEscaneado(), verbosity: 0 });
    const doc = await tarea.promise;
    try {
      const pagina = await doc.getPage(1);
      const vista = pagina.getViewport({ scale: 1 });
      const ops = await pagina.getOperatorList({ annotationMode: pdfjs.AnnotationMode.DISABLE });
      const e = escaneoDe(ops, O, vista.transform, vista.width, vista.height);
      expect(e).not.toBeNull();
      expect(e!.marco.x0).toBeCloseTo(0.1);
      expect(e!.marco.y0).toBeCloseTo(0.1);
      expect(e!.marco.x1).toBeCloseTo(0.9);
      expect(e!.marco.y1).toBeCloseTo(0.9);
      const o = await new Promise<{ width: number; height: number; kind: number; data: Uint8Array }>((ok, mal) => pagina.objs.get(e!.id, ok, mal));
      expect([o.width, o.height]).toEqual([40, 50]);
      const rgba = rgbaDe(o.kind, o.data, o.width, o.height);
      // El primer píxel, arriba a la izquierda, es el negro.
      expect(Array.from(rgba.slice(0, 8))).toEqual([0, 0, 0, 255, 255, 255, 255, 255]);
    } finally {
      await tarea.destroy();
    }
  }, 20000);
});
