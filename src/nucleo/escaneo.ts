// Si una página de PDF es un escaneo y nada más (una sola imagen que la ocupa casi entera, sin texto visible ni dibujo
// encima), cuál es esa imagen y dónde está. El OCR lee entonces la imagen tal cual, a su resolución y sin pérdidas, y no
// la página pintada por el visor, que la reescala y la guarda en JPEG: en el visor, con dos libros de química escaneados,
// el error baja del 3,9 % al 0,2 % a 180 ppp y del 3,7 % al 1,2 % a 144 ppp. Se decide recorriendo las operaciones de
// dibujo de pdf.js con su matriz; aquí no se depende de pdf.js, y así se puede probar.
//
// Ante la duda se lee la página pintada, como antes. Sobre todo si hay máscaras de imagen o varias imágenes: los PDF de
// compresión por capas guardan el fondo en una imagen y el texto en otra encima, y leer solo el fondo perdería el texto.

import type { Caja, LineaOcr } from './ocr';

/** Una matriz afín de PDF, [a, b, c, d, e, f]: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export type Matriz = number[];

/** Las operaciones de pdf.js que se miran. pdfjs-dist exporta OPS con sus códigos. */
export const OPERACIONES = [
  'save',
  'restore',
  'transform',
  'paintFormXObjectBegin',
  'paintFormXObjectEnd',
  'setTextRenderingMode',
  'showText',
  'showSpacedText',
  'nextLineShowText',
  'nextLineSetSpacingShowText',
  'constructPath',
  'fill',
  'eoFill',
  'fillStroke',
  'eoFillStroke',
  'closeFillStroke',
  'closeEOFillStroke',
  'rawFillPath',
  'shadingFill',
  'paintImageXObject',
  'paintInlineImageXObject',
  'paintInlineImageXObjectGroup',
  'paintImageXObjectRepeat',
  'paintImageMaskXObject',
  'paintImageMaskXObjectGroup',
  'paintImageMaskXObjectRepeat',
  'paintSolidColorImageMask',
] as const;
export type CodigosOps = Record<(typeof OPERACIONES)[number], number>;

export interface Escaneo {
  /** El identificador de la imagen en pdf.js. */
  id: string;
  /** Dónde está la imagen entera en la página, en fracciones: puede salirse un poco de la página. */
  marco: Caja;
}

const IDENTIDAD: Matriz = [1, 0, 0, 1, 0, 0];

/** a × b: primero b y después a, como pdf.js y el lienzo. */
export const multiplicar = (a: Matriz, b: Matriz): Matriz => [
  a[0] * b[0] + a[2] * b[1],
  a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3],
  a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4],
  a[1] * b[4] + a[3] * b[5] + a[5],
];
const aplicar = (m: Matriz, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

/** La caja que ocupa en la página un rectángulo de su espacio, con todas sus esquinas por si va girado. */
function cajaDe(m: Matriz, x0: number, y0: number, x1: number, y1: number): Caja {
  const esquinas = [aplicar(m, x0, y0), aplicar(m, x1, y0), aplicar(m, x0, y1), aplicar(m, x1, y1)];
  const xs = esquinas.map((p) => p[0]);
  const ys = esquinas.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

const corte = (a: Caja, b: Caja): Caja => ({ x0: Math.max(a.x0, b.x0), y0: Math.max(a.y0, b.y0), x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1) });
const area = (c: Caja) => Math.max(0, c.x1 - c.x0) * Math.max(0, c.y1 - c.y0);

/** Lo mínimo de la página que tiene que cubrir la imagen escaneada. */
const CUBRE_ESCANEO = 0.5;
/** Otra imagen a la vista de más de esto ya no es un detalle suelto: la página no es solo el escaneo. */
const CUBRE_OTRA = 0.01;
/** Lo que se tolera de dibujo relleno a la vista (un filete, un recuadro pequeño). */
const CUBRE_RELLENO = 0.02;

/**
 * La imagen escaneada de una página, o null si la página no es solo eso. `vista` es la matriz de la página a sus píxeles
 * (la del viewport de pdf.js) y `ancho` y `alto`, su tamaño en ellos. La imagen tiene que ir derecha, sin girar ni voltear:
 * si no, sus filas no son las de la página. Lo que se pinta antes que ella queda debajo y solo cuenta lo que asome fuera;
 * lo que se pinta después, encima, cuenta entero.
 */
export function escaneoDe(ops: { fnArray: ArrayLike<number>; argsArray: ArrayLike<unknown> }, O: CodigosOps, vista: Matriz, ancho: number, alto: number): Escaneo | null {
  // La matriz y el modo del texto van con el estado gráfico: se guardan y se recuperan juntos.
  let ctm = IDENTIDAD;
  let modoTexto = 0;
  const pila: { ctm: Matriz; modoTexto: number }[] = [];
  const pagina: Caja = { x0: 0, y0: 0, x1: ancho, y1: alto };
  const imagenes: { orden: number; id: string | null; caja: Caja; derecha: boolean }[] = [];
  const rellenos: { orden: number; caja: Caja }[] = [];
  const pintaRelleno = new Set([O.fill, O.eoFill, O.fillStroke, O.eoFillStroke, O.closeFillStroke, O.closeEOFillStroke]);
  const recuperar = () => {
    const e = pila.pop();
    if (e) ({ ctm, modoTexto } = e);
  };
  for (let i = 0; i < ops.fnArray.length; i++) {
    const f = ops.fnArray[i];
    const a = (ops.argsArray[i] ?? []) as unknown[];
    switch (f) {
      case O.save:
        pila.push({ ctm, modoTexto });
        break;
      case O.restore:
        recuperar();
        break;
      case O.transform:
        ctm = multiplicar(ctm, a as number[]);
        break;
      case O.paintFormXObjectBegin:
        pila.push({ ctm, modoTexto });
        if (Array.isArray(a[0]) && a[0].length === 6) ctm = multiplicar(ctm, a[0] as number[]);
        break;
      case O.paintFormXObjectEnd:
        recuperar();
        break;
      case O.setTextRenderingMode:
        modoTexto = Number(a[0] ?? 0);
        break;
      case O.showText:
      case O.showSpacedText:
      case O.nextLineShowText:
      case O.nextLineSetSpacingShowText:
        // El texto en modo 3 (o 7) no se ve: es la capa de otro OCR, que acompaña al escaneo.
        if (modoTexto !== 3 && modoTexto !== 7) return null;
        break;
      case O.constructPath: {
        // [operación con que se pinta, trazado, [x0, y0, x1, y1]]. Lo que solo recorta o solo traza una línea no tapa
        // nada; lo que se rellena sin medida se toma por la página entera.
        if (!pintaRelleno.has(a[0] as number)) break;
        const mm = a[2] as number[] | null | undefined;
        rellenos.push({ orden: i, caja: mm && mm.length === 4 ? cajaDe(multiplicar(vista, ctm), mm[0], mm[1], mm[2], mm[3]) : pagina });
        break;
      }
      case O.paintImageXObject:
      case O.paintInlineImageXObject: {
        // La imagen se pinta en el cuadrado unidad, con su primera fila arriba (y = 1).
        const t = multiplicar(vista, ctm);
        const [ax, ay] = aplicar(t, 0, 1);
        const [bx, by] = aplicar(t, 1, 1);
        const [cx, cy] = aplicar(t, 0, 0);
        const derecha = Math.abs(by - ay) < 0.5 && Math.abs(cx - ax) < 0.5 && bx > ax && cy > ay;
        imagenes.push({ orden: i, id: f === O.paintImageXObject && typeof a[0] === 'string' ? a[0] : null, caja: cajaDe(t, 0, 0, 1, 1), derecha });
        break;
      }
      default:
        // Máscaras de imagen, grupos de imágenes, sombreados o rellenos sin medida: la página es algo más que un escaneo.
        if (
          f === O.paintImageMaskXObject ||
          f === O.paintImageMaskXObjectGroup ||
          f === O.paintImageMaskXObjectRepeat ||
          f === O.paintSolidColorImageMask ||
          f === O.paintInlineImageXObjectGroup ||
          f === O.paintImageXObjectRepeat ||
          f === O.shadingFill ||
          f === O.rawFillPath ||
          pintaRelleno.has(f)
        )
          return null;
    }
  }
  // Lo que se ve de cada cosa, en fracción de la página: entera si va encima del escaneo, y si va debajo, lo que asome.
  const total = area(pagina);
  const visible = (x: { orden: number; caja: Caja }, e: { orden: number; caja: Caja }) => {
    const enPagina = area(corte(x.caja, pagina));
    return (x.orden > e.orden ? enPagina : enPagina - area(corte(corte(x.caja, pagina), e.caja))) / total;
  };
  const grandes = imagenes.filter((im) => area(corte(im.caja, pagina)) / total >= CUBRE_ESCANEO);
  if (grandes.length !== 1) return null;
  const [escaneo] = grandes;
  if (!escaneo.id || !escaneo.derecha) return null;
  if (imagenes.some((im) => im !== escaneo && visible(im, escaneo) >= CUBRE_OTRA)) return null;
  if (rellenos.reduce((s, r) => s + visible(r, escaneo), 0) > CUBRE_RELLENO) return null;
  const c = escaneo.caja;
  return { id: escaneo.id, marco: { x0: c.x0 / ancho, y0: c.y0 / alto, x1: c.x1 / ancho, y1: c.y1 / alto } };
}

export interface Recorte {
  /** El trozo de la imagen, en sus píxeles. */
  x: number;
  y: number;
  ancho: number;
  alto: number;
  /** Dónde queda ese trozo en la página, en fracciones. */
  marco: Caja;
}

/**
 * La parte de la imagen que cae dentro de la página, en píxeles enteros de la imagen, y dónde queda: lo que se sale de la
 * página no se ve en el visor y no se lee.
 */
export function recorteVisible(marco: Caja, w: number, h: number): Recorte | null {
  const sx = w / (marco.x1 - marco.x0);
  const sy = h / (marco.y1 - marco.y0);
  if (!(sx > 0 && sy > 0)) return null;
  const x = Math.max(0, Math.floor((0 - marco.x0) * sx + 1e-6));
  const y = Math.max(0, Math.floor((0 - marco.y0) * sy + 1e-6));
  const x1 = Math.min(w, Math.ceil((1 - marco.x0) * sx - 1e-6));
  const y1 = Math.min(h, Math.ceil((1 - marco.y0) * sy - 1e-6));
  if (x1 - x < 1 || y1 - y < 1) return null;
  return { x, y, ancho: x1 - x, alto: y1 - y, marco: { x0: marco.x0 + x / sx, y0: marco.y0 + y / sy, x1: marco.x0 + x1 / sx, y1: marco.y0 + y1 / sy } };
}

/** Lo más que se le da al OCR por lado, como PaddleOCR: un escaneo a 600 ppp se reduce, y aun así sobra resolución. */
export const LADO_MAXIMO_OCR = 4000;

/**
 * Los píxeles RGBA de una imagen de pdf.js que llega con sus datos en lugar de como mapa de bits: tipo 1, un bit por
 * píxel y filas que empiezan en byte entero (1 es blanco); tipo 2, RGB; tipo 3, RGBA.
 */
export function rgbaDe(tipo: number, datos: ArrayLike<number>, w: number, h: number): Uint8ClampedArray<ArrayBuffer> {
  const salida = new Uint8ClampedArray(w * h * 4);
  if (tipo === 1) {
    const porFila = (w + 7) >> 3;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = datos[y * porFila + (x >> 3)] & (0x80 >> (x & 7)) ? 255 : 0;
        const i = (y * w + x) * 4;
        salida[i] = salida[i + 1] = salida[i + 2] = v;
        salida[i + 3] = 255;
      }
    }
  } else if (tipo === 2) {
    for (let p = 0, q = 0; p < w * h; p++, q += 3) {
      salida[p * 4] = datos[q];
      salida[p * 4 + 1] = datos[q + 1];
      salida[p * 4 + 2] = datos[q + 2];
      salida[p * 4 + 3] = 255;
    }
  } else if (tipo === 3) {
    for (let i = 0; i < w * h * 4; i++) salida[i] = datos[i];
  } else throw new Error(`Tipo de imagen desconocido: ${tipo}`);
  return salida;
}

/** Una caja en fracciones de la imagen, pasada a fracciones de la página donde la imagen ocupa `marco`. */
export const enMarco = (c: Caja, marco: Caja): Caja => {
  const w = marco.x1 - marco.x0;
  const h = marco.y1 - marco.y0;
  return { x0: marco.x0 + c.x0 * w, y0: marco.y0 + c.y0 * h, x1: marco.x0 + c.x1 * w, y1: marco.y0 + c.y1 * h };
};

const enUnidad = (v: number) => Math.min(1, Math.max(0, v));

/** Las líneas leídas en una imagen, con sus cajas pasadas a la página. Lo que quedara fuera de la página se quita. */
export function lineasEnMarco(lineas: LineaOcr[], marco: Caja): LineaOcr[] {
  return lineas.flatMap((l) => {
    const c = enMarco(l.caja, marco);
    const caja = { x0: enUnidad(c.x0), y0: enUnidad(c.y0), x1: enUnidad(c.x1), y1: enUnidad(c.y1) };
    return caja.x1 > caja.x0 && caja.y1 > caja.y0 ? [{ ...l, caja }] : [];
  });
}
