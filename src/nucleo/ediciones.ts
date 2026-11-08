// Lo que se edita a mano del texto de una página (una línea que salió con un kanji de menos, un globo con una letra
// cambiada). Se guarda aparte de lo leído, con el sitio de la línea, y se vuelve a poner sobre la línea que ocupe ese
// sitio: así no se pierde aunque el OCR vuelva a leer la página, por ejemplo tras una mejora, y sus cajas cambien un poco.

import type { LineaTexto } from './capaTexto';
import type { Caja } from './ocr';

export interface EdicionLinea {
  /** El libro, la página y un número propio. */
  clave: string;
  libro: string;
  pagina: number;
  /** Dónde está la línea, en fracciones de la página. */
  caja: Caja;
  /** El texto que tenía al editarla. */
  original: string;
  texto: string;
  creada: number;
  /** Quién puso el texto: Claude, al revisar la página, o a mano si no lo dice. */
  origen?: 'claude';
}

/** Una línea con lo editado encima: la clave de su edición, el texto que tenía antes y quién la cambió. */
export type LineaEditada<T extends LineaTexto = LineaTexto> = T & { edicion?: string; original?: string; origen?: 'claude' };

/** Lo que se solapan dos cajas, de 0 a 1: su intersección entre su unión. */
export function solape(a: Caja, b: Caja): number {
  const ix = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
  const iy = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const comun = ix * iy;
  const union = (a.x1 - a.x0) * (a.y1 - a.y0) + (b.x1 - b.x0) * (b.y1 - b.y0) - comun;
  return union > 0 ? comun / union : 0;
}

/** Lo mínimo que tiene que solaparse una edición con una línea para ser suya. */
const SOLAPE_MINIMO = 0.5;

/**
 * Las líneas de una página con lo editado encima: cada edición va a la línea que más se solapa con su sitio, si de
 * verdad es la misma. Si el texto cambia de largo, la posición de cada letra ya no vale y se reparte por igual.
 */
export function aplicarEdiciones<T extends LineaTexto>(lineas: T[], ediciones: EdicionLinea[]): LineaEditada<T>[] {
  if (!ediciones.length) return lineas;
  const salida: LineaEditada<T>[] = lineas.map((l) => ({ ...l }));
  for (const e of ediciones) {
    let mejor = -1;
    let maximo = SOLAPE_MINIMO;
    salida.forEach((l, i) => {
      const s = solape(l.caja, e.caja);
      if (s > maximo) [maximo, mejor] = [s, i];
    });
    if (mejor < 0) continue;
    const l = salida[mejor];
    const original = l.original ?? l.texto;
    salida[mejor] = { ...l, texto: e.texto, original, edicion: e.clave, origen: e.origen, cortes: e.texto.length === original.length ? l.cortes : undefined };
  }
  return salida;
}
