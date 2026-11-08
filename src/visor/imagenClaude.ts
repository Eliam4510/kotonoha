// La imagen de una página para que Claude revise su texto: la misma que lee el OCR (en un PDF escaneado, el escaneo tal
// cual), recortada a lo que ocupa el texto y del tamaño que Claude lee sin reducirla.

import type { ImagenIA } from '../compartido/tipos';
import type { Caja } from '../nucleo/ocr';
import type { ImagenOcr } from './paginador';

/** El lado más largo y la superficie que Claude lee sin reducir la imagen. */
const LADO_MAXIMO = 2576;
const AREA_MAXIMA = 3_750_000;
/** El margen que se deja alrededor del texto, en fracciones de la página. */
const MARGEN = 0.02;

/** La caja que ocupa todo el texto, con un margen, en fracciones de la página; o null si no hay texto. */
export function cajaDelTexto(cajas: Caja[]): Caja | null {
  if (!cajas.length) return null;
  const limitar = (v: number) => Math.max(0, Math.min(1, v));
  return {
    x0: limitar(Math.min(...cajas.map((c) => c.x0)) - MARGEN),
    y0: limitar(Math.min(...cajas.map((c) => c.y0)) - MARGEN),
    x1: limitar(Math.max(...cajas.map((c) => c.x1)) + MARGEN),
    y1: limitar(Math.max(...cajas.map((c) => c.y1)) + MARGEN),
  };
}

async function base64De(b: Blob): Promise<string> {
  const bytes = new Uint8Array(await b.arrayBuffer());
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** La imagen recortada al texto de la página (sus líneas, en fracciones de la página), como JPEG. */
export async function imagenParaClaude(fuente: ImagenOcr, cajas: Caja[]): Promise<ImagenIA> {
  const mapa = fuente.imagen instanceof Blob ? await createImageBitmap(fuente.imagen) : fuente.imagen;
  try {
    const W = mapa.width;
    const H = mapa.height;
    // La imagen puede ser solo una parte de la página: el escaneo dentro de la página de un PDF.
    const m = fuente.marco ?? { x0: 0, y0: 0, x1: 1, y1: 1 };
    const texto = cajaDelTexto(cajas) ?? m;
    const aX = (x: number) => Math.max(0, Math.min(W, ((x - m.x0) / Math.max(1e-6, m.x1 - m.x0)) * W));
    const aY = (y: number) => Math.max(0, Math.min(H, ((y - m.y0) / Math.max(1e-6, m.y1 - m.y0)) * H));
    let [sx, sy, sw, sh] = [aX(texto.x0), aY(texto.y0), aX(texto.x1) - aX(texto.x0), aY(texto.y1) - aY(texto.y0)];
    if (sw < 8 || sh < 8) [sx, sy, sw, sh] = [0, 0, W, H];
    const escala = Math.min(1, LADO_MAXIMO / Math.max(sw, sh), Math.sqrt(AREA_MAXIMA / (sw * sh)));
    const w = Math.max(1, Math.round(sw * escala));
    const h = Math.max(1, Math.round(sh * escala));
    const lienzo = new OffscreenCanvas(w, h);
    const ctx = lienzo.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    // Una imagen con transparencia sale en negro en un JPEG: debajo va blanco, como el papel.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(mapa, sx, sy, sw, sh, 0, 0, w, h);
    const jpeg = await lienzo.convertToBlob({ type: 'image/jpeg', quality: 0.88 });
    return { tipo: 'image/jpeg', datos: await base64De(jpeg) };
  } finally {
    mapa.close();
  }
}
