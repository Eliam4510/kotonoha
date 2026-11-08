// Las cuentas del reconocimiento de texto (OCR) que no dependen del navegador: preparar la imagen para cada modelo, sacar
// las cajas del mapa del detector, leer lo que devuelve cada reconocedor, quitar el furigana impreso y ordenar las líneas
// para leerlas. Los modelos corren en el trabajador del visor; aquí solo están los números.

export interface Caja {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface LineaOcr {
  /** En fracciones de la página, de 0 a 1: así sirve para cualquier zoom. */
  caja: Caja;
  texto: string;
  vertical: boolean;
}

const ancho = (c: Caja) => c.x1 - c.x0;
const alto = (c: Caja) => c.y1 - c.y0;

/**
 * Píxeles RGBA a un tensor CHW de reales. PaddleOCR lee las imágenes en BGR y aplica la media y la desviación en ese
 * orden; manga-ocr y el detector de globos, en RGB.
 */
export function aTensor(rgba: ArrayLike<number>, w: number, h: number, normalizar: (v: number, canal: number) => number, bgr = false): Float32Array {
  const n = w * h;
  const t = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) {
      const origen = bgr ? 2 - c : c;
      t[c * n + i] = normalizar(rgba[i * 4 + origen] / 255, c);
    }
  }
  return t;
}

/** Las medidas de la entrada del detector DB: el lado mayor como mucho `limite`, y los dos múltiplos de 32. */
export function medidaDeDeteccion(w: number, h: number, limite = 1920): { w: number; h: number } {
  const escala = Math.min(1, limite / Math.max(w, h));
  return { w: Math.max(32, Math.round((w * escala) / 32) * 32), h: Math.max(32, Math.round((h * escala) / 32) * 32) };
}

/**
 * Las cajas de texto del mapa de probabilidad del detector DB, ya en píxeles de la imagen original. Cada mancha del mapa
 * es una línea encogida: se ensancha lo que el modelo encogió al aprender.
 */
export function cajasDeMapa(mapa: ArrayLike<number>, W: number, H: number, wOriginal: number, hOriginal: number, umbral = 0.3, umbralCaja = 0.6, expansion = 1.5): Caja[] {
  const visto = new Uint8Array(W * H);
  const pila: number[] = [];
  const cajas: Caja[] = [];
  const sx = wOriginal / W;
  const sy = hOriginal / H;
  for (let inicio = 0; inicio < W * H; inicio++) {
    if (visto[inicio] || mapa[inicio] <= umbral) continue;
    let x0 = W;
    let x1 = 0;
    let y0 = H;
    let y1 = 0;
    let suma = 0;
    let cuenta = 0;
    pila.push(inicio);
    visto[inicio] = 1;
    while (pila.length) {
      const p = pila.pop()!;
      const x = p % W;
      const y = (p - x) / W;
      suma += mapa[p];
      cuenta++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const q = ny * W + nx;
          if (!visto[q] && mapa[q] > umbral) {
            visto[q] = 1;
            pila.push(q);
          }
        }
      }
    }
    const bw = x1 - x0 + 1;
    const bh = y1 - y0 + 1;
    if (suma / cuenta < umbralCaja || Math.min(bw, bh) < 3) continue;
    const d = (bw * bh * expansion) / (2 * (bw + bh));
    const caja = {
      x0: Math.max(0, Math.floor((x0 - d) * sx)),
      y0: Math.max(0, Math.floor((y0 - d) * sy)),
      x1: Math.min(wOriginal, Math.ceil((x1 + 1 + d) * sx)),
      y1: Math.min(hOriginal, Math.ceil((y1 + 1 + d) * sy)),
    };
    if (ancho(caja) >= 4 && alto(caja) >= 4) cajas.push(caja);
  }
  return cajas;
}

/** La salida CTC del reconocedor de PP-OCR: el índice 0 es el blanco, y el último, el espacio. */
export function decodificarCtc(probs: ArrayLike<number>, T: number, C: number, diccionario: string[]): string {
  let anterior = -1;
  let texto = '';
  for (let t = 0; t < T; t++) {
    let mejor = 0;
    let pm = -Infinity;
    for (let k = 0; k < C; k++) {
      const v = probs[t * C + k];
      if (v > pm) {
        pm = v;
        mejor = k;
      }
    }
    if (mejor !== anterior && mejor !== 0) texto += mejor === C - 1 ? ' ' : (diccionario[mejor - 1] ?? '');
    anterior = mejor;
  }
  return texto.trim();
}

/** Una caja mucho más alta que ancha es una columna de texto vertical. */
export const esVertical = (c: Caja) => alto(c) >= 1.5 * ancho(c);

/** Solo kana: con Script_Extensions entran también la marca de vocal larga y el punto medio, que se escriben con ellos. */
const SOLO_KANA = /^[\p{scx=Hiragana}\p{scx=Katakana}\s]+$/u;

/**
 * Quita el furigana impreso: líneas mucho más pequeñas que las demás, solo de kana, pegadas a una línea normal. Kotonoha
 * pone su propio furigana, y leído como texto mezclaría las lecturas con la frase.
 */
export function quitarFurigana(lineas: LineaOcr[]): LineaOcr[] {
  const grosor = (l: LineaOcr) => (l.vertical ? ancho(l.caja) : alto(l.caja));
  const grosores = lineas.map(grosor).sort((a, b) => a - b);
  const mediana = grosores[Math.floor(grosores.length / 2)] ?? 0;
  return lineas.filter((l) => {
    if (!SOLO_KANA.test(l.texto) || grosor(l) >= mediana * 0.62) return true;
    // Junto a una línea normal, en el sentido en que va el furigana: encima o debajo en horizontal, a un lado en vertical.
    return !lineas.some((o) => {
      if (o === l || grosor(o) < mediana * 0.62) return false;
      if (l.vertical) {
        const solapa = Math.min(o.caja.y1, l.caja.y1) - Math.max(o.caja.y0, l.caja.y0) > 0;
        const cerca = Math.min(Math.abs(l.caja.x0 - o.caja.x1), Math.abs(o.caja.x0 - l.caja.x1)) < grosor(o) * 0.6;
        return solapa && cerca;
      }
      const solapa = Math.min(o.caja.x1, l.caja.x1) - Math.max(o.caja.x0, l.caja.x0) > 0;
      const cerca = Math.min(Math.abs(l.caja.y0 - o.caja.y1), Math.abs(o.caja.y0 - l.caja.y1)) < grosor(o) * 0.6;
      return solapa && cerca;
    });
  });
}

/**
 * El orden de lectura de una página de libro. En horizontal, por renglones de arriba abajo y de izquierda a derecha; en
 * vertical, por columnas de derecha a izquierda y de arriba abajo.
 */
export function ordenarLineas(lineas: LineaOcr[]): LineaOcr[] {
  const verticales = lineas.filter((l) => l.vertical).length > lineas.length / 2;
  const centro = (c: Caja) => (verticales ? (c.x0 + c.x1) / 2 : (c.y0 + c.y1) / 2);
  const grosor = (c: Caja) => (verticales ? ancho(c) : alto(c));
  const grupos: { centro: number; grosor: number; lineas: LineaOcr[] }[] = [];
  for (const l of [...lineas].sort((a, b) => (verticales ? centro(b.caja) - centro(a.caja) : centro(a.caja) - centro(b.caja)))) {
    const g = grupos.find((x) => Math.abs(x.centro - centro(l.caja)) < 0.5 * Math.min(x.grosor, grosor(l.caja)));
    if (g) g.lineas.push(l);
    else grupos.push({ centro: centro(l.caja), grosor: grosor(l.caja), lineas: [l] });
  }
  return grupos.flatMap((g) => g.lineas.sort((a, b) => (verticales ? a.caja.y0 - b.caja.y0 : a.caja.x0 - b.caja.x0)));
}

/**
 * El orden de lectura de los bloques de un manga: de arriba abajo por franjas y, dentro de cada franja, de derecha a
 * izquierda. Dos bloques van en la misma franja si se solapan en altura más de la mitad del menor.
 */
export function ordenManga<T extends { caja: Caja }>(bloques: T[]): T[] {
  const franjas: { y0: number; y1: number; bloques: T[] }[] = [];
  for (const b of [...bloques].sort((a, z) => a.caja.y0 - z.caja.y0)) {
    const f = franjas.find((x) => Math.min(x.y1, b.caja.y1) - Math.max(x.y0, b.caja.y0) > 0.5 * Math.min(x.y1 - x.y0, alto(b.caja)));
    if (f) {
      f.bloques.push(b);
      f.y0 = Math.min(f.y0, b.caja.y0);
      f.y1 = Math.max(f.y1, b.caja.y1);
    } else franjas.push({ y0: b.caja.y0, y1: b.caja.y1, bloques: [b] });
  }
  return franjas.flatMap((f) => f.bloques.sort((a, z) => z.caja.x1 - a.caja.x1));
}

/** Del detector de globos (RT-DETR, exportación oficial): los bloques de texto, sin los globos vacíos ni los repetidos. */
export function bloquesDeDetector(etiquetas: ArrayLike<number | bigint>, cajas: ArrayLike<number>, puntos: ArrayLike<number>, w: number, h: number, umbral = 0.4): Caja[] {
  const candidatas: (Caja & { p: number })[] = [];
  for (let q = 0; q < puntos.length; q++) {
    // 0 es el globo; 1, el texto dentro de un globo; 2, el texto suelto.
    if (puntos[q] < umbral || Number(etiquetas[q]) === 0) continue;
    const x0 = Math.max(0, Math.floor(cajas[q * 4]));
    const y0 = Math.max(0, Math.floor(cajas[q * 4 + 1]));
    const x1 = Math.min(w, Math.ceil(cajas[q * 4 + 2]));
    const y1 = Math.min(h, Math.ceil(cajas[q * 4 + 3]));
    if (x1 - x0 >= 6 && y1 - y0 >= 6) candidatas.push({ x0, y0, x1, y1, p: puntos[q] });
  }
  candidatas.sort((a, b) => b.p - a.p);
  const salida: Caja[] = [];
  for (const c of candidatas) {
    const repetida = salida.some((o) => {
      const ix = Math.max(0, Math.min(o.x1, c.x1) - Math.max(o.x0, c.x0));
      const iy = Math.max(0, Math.min(o.y1, c.y1) - Math.max(o.y0, c.y0));
      return (ix * iy) / Math.min(ancho(c) * alto(c), ancho(o) * alto(o)) > 0.6;
    });
    if (!repetida) salida.push({ x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1 });
  }
  return salida;
}

/** El siguiente token de manga-ocr, voraz y sin repetir trigramas, como su configuración no_repeat_ngram_size = 3. */
export function siguienteToken(logits: ArrayLike<number>, base: number, V: number, ids: number[]): number {
  const prohibidos = new Set<number>();
  if (ids.length >= 2) {
    const a = ids[ids.length - 2];
    const b = ids[ids.length - 1];
    for (let i = 0; i + 2 < ids.length; i++) if (ids[i] === a && ids[i + 1] === b) prohibidos.add(ids[i + 2]);
  }
  let mejor = -1;
  let pm = -Infinity;
  for (let v = 0; v < V; v++) {
    if (prohibidos.has(v)) continue;
    const x = logits[base + v];
    if (x > pm) {
      pm = x;
      mejor = v;
    }
  }
  return mejor;
}

/** Los ids de manga-ocr a texto: sin los especiales (los cinco primeros del vocabulario) ni espacios, y con «…» enteros. */
export function textoDeMangaOcr(ids: number[], vocabulario: string[]): string {
  return ids
    .filter((i) => i > 4)
    .map((i) => vocabulario[i] ?? '')
    .join('')
    .replace(/\s+/g, '')
    .replace(/\.{3}/g, '…');
}
