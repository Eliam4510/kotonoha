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

/**
 * Las medidas de la entrada del detector DB: el lado mayor en `limite`, y los dos múltiplos de 32. Una imagen pequeña se
 * amplía: el detector parte mejor las líneas a la escala de una página de libro pintada a 192 ppp, con la que se ajustó.
 * En un escaneo a 144 ppp, el error baja así del 1,4 % al 1,2 % en el visor. Las líneas se leen después de la imagen
 * original, sin ampliar.
 */
export function medidaDeDeteccion(w: number, h: number, limite = 1920): { w: number; h: number } {
  const escala = limite / Math.max(w, h);
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
 * Quita el furigana impreso: líneas solo de kana pegadas a una línea al menos 1,45 veces más gruesa, en el sentido en que
 * va el furigana (encima o debajo de una línea horizontal, a un lado de una vertical) y a lo largo de ella. Se compara con
 * la línea vecina y no con la mediana de la página: en un libro para estudiantes con furigana en casi cada kanji, la
 * mitad de las líneas son furigana y la mediana es la suya. Kotonoha pone su propio furigana, y leído como texto
 * mezclaría las lecturas con la frase.
 */
export function quitarFurigana(lineas: LineaOcr[]): LineaOcr[] {
  return lineas.filter((l) => {
    if (!SOLO_KANA.test(l.texto)) return true;
    return !lineas.some((o) => {
      if (o === l) return false;
      const v = o.vertical;
      const grueso = (c: Caja) => (v ? ancho(c) : alto(c));
      const largo = (c: Caja) => (v ? alto(c) : ancho(c));
      if (grueso(o.caja) < 1.45 * grueso(l.caja)) return false;
      const solapa = v ? Math.min(o.caja.y1, l.caja.y1) - Math.max(o.caja.y0, l.caja.y0) : Math.min(o.caja.x1, l.caja.x1) - Math.max(o.caja.x0, l.caja.x0);
      if (solapa <= 0.5 * largo(l.caja)) return false;
      // El hueco entre las dos, negativo si se montan: el furigana va pegado o encima.
      const hueco = v ? Math.max(o.caja.x0 - l.caja.x1, l.caja.x0 - o.caja.x1) : Math.max(o.caja.y0 - l.caja.y1, l.caja.y0 - o.caja.y1);
      return hueco < 0.5 * grueso(o.caja);
    });
  });
}

/**
 * El orden de lectura de una página de libro, por cortes: se parte la página por el hueco más ancho que la cruza entera
 * (un canal entre columnas, el aire bajo un título) y se repite en cada parte. Los canales que separan bloques de texto
 * (verticales en un libro horizontal, horizontales en uno vertical) pesan el doble que el aire entre renglones: así una
 * página a dos columnas se lee columna a columna y no renglón a renglón. Las partes que ya no se pueden partir van por
 * renglones (o por columnas en vertical).
 */
export function ordenarLineas(lineas: LineaOcr[]): LineaOcr[] {
  const verticales = lineas.filter((l) => l.vertical).length > lineas.length / 2;
  // En horizontal, el canal de bloques es vertical (eje x) y el aire entre renglones horizontal (eje y); al revés en vertical.
  const ejeBloques = verticales ? 'y' : 'x';
  const huecos = (grupo: LineaOcr[], eje: 'x' | 'y') => {
    const tramos = grupo.map((l) => (eje === 'x' ? [l.caja.x0, l.caja.x1] : [l.caja.y0, l.caja.y1])).sort((a, b) => a[0] - b[0]);
    const salida: { eje: 'x' | 'y'; en: number; ancho: number }[] = [];
    let fin = tramos[0][1];
    for (const [a, b] of tramos.slice(1)) {
      if (a > fin) salida.push({ eje, en: (a + fin) / 2, ancho: a - fin });
      fin = Math.max(fin, b);
    }
    return salida;
  };
  // Lo que ocupa un grupo a lo largo de un eje: una columna de números (「問1」, 「(2)」) es estrecha y no es un bloque.
  const extension = (grupo: LineaOcr[], eje: 'x' | 'y') => Math.max(...grupo.map((l) => (eje === 'x' ? l.caja.x1 : l.caja.y1))) - Math.min(...grupo.map((l) => (eje === 'x' ? l.caja.x0 : l.caja.y0)));
  const partir = (grupo: LineaOcr[]): LineaOcr[] => {
    if (grupo.length < 2) return grupo;
    const peso = (h: { eje: 'x' | 'y'; ancho: number }) => h.ancho * (h.eje === ejeBloques ? 2 : 1);
    const candidatos = [...huecos(grupo, 'x'), ...huecos(grupo, 'y')].filter((h) => h.ancho > (h.eje === ejeBloques ? 0.012 : 0.002)).sort((a, b) => peso(b) - peso(a));
    for (const corte of candidatos) {
      const centro = (l: LineaOcr) => (corte.eje === 'x' ? (l.caja.x0 + l.caja.x1) / 2 : (l.caja.y0 + l.caja.y1) / 2);
      const antes = grupo.filter((l) => centro(l) < corte.en);
      const despues = grupo.filter((l) => centro(l) >= corte.en);
      if (!antes.length || !despues.length) continue;
      if (corte.eje === ejeBloques && Math.min(extension(antes, corte.eje), extension(despues, corte.eje)) < 0.12) continue;
      // Arriba antes que abajo; a izquierda antes que a derecha en horizontal, y al revés en vertical.
      const [primero, segundo] = corte.eje === 'x' && verticales ? [despues, antes] : [antes, despues];
      return [...partir(primero), ...partir(segundo)];
    }
    return porRenglones(grupo, verticales);
  };
  return partir(lineas);
}

/** Por renglones de arriba abajo y de izquierda a derecha; en vertical, por columnas de derecha a izquierda. */
function porRenglones(lineas: LineaOcr[], verticales: boolean): LineaOcr[] {
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

/**
 * Las viñetas de una página de manga, a partir de una versión pequeña de la página en grises (de unos 300 a 400 px de
 * ancho): el blanco que toca el borde de la página es el canal entre viñetas, y lo que ese canal deja separado son las
 * viñetas. A diferencia de los cortes en línea recta, sirve también con los bordes inclinados. Devuelve sus cajas en
 * fracciones de la página; las muy pequeñas (dibujo suelto, letras fuera de viñeta) no cuentan, y una viñeta metida dentro
 * de otra se queda en la de fuera.
 */
export function vinetasDeImagen(gris: ArrayLike<number>, w: number, h: number, blanco = 235, ensanche = 2): Caja[] {
  let canal = new Uint8Array(w * h);
  const pila: number[] = [];
  const empujar = (i: number) => {
    if (!canal[i] && gris[i] >= blanco) {
      canal[i] = 1;
      pila.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    empujar(x);
    empujar((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    empujar(y * w);
    empujar(y * w + w - 1);
  }
  while (pila.length) {
    const p = pila.pop()!;
    const x = p % w;
    if (x > 0) empujar(p - 1);
    if (x < w - 1) empujar(p + 1);
    if (p >= w) empujar(p - w);
    if (p < (h - 1) * w) empujar(p + w);
  }
  // El canal se ensancha unos píxeles: así lo cortan los trazos finos que lo cruzan (el borde de un globo que se sale de
  // su viñeta, una línea de movimiento) y no unen dos viñetas.
  for (const eje of [1, w]) {
    const ancho = new Uint8Array(w * h);
    for (let p = 0; p < w * h; p++) {
      if (!canal[p]) continue;
      for (let d = -ensanche; d <= ensanche; d++) {
        const q = p + d * eje;
        // En horizontal no se salta de una fila a otra.
        if (q >= 0 && q < w * h && (eje === w || Math.floor(q / w) === Math.floor(p / w))) ancho[q] = 1;
      }
    }
    canal = ancho;
  }
  // Las partes que no son canal, con su caja; las que ocupan menos de un 2 % de la página no son viñetas.
  const visto = new Uint8Array(w * h);
  const cajas: (Caja & { area: number })[] = [];
  for (let inicio = 0; inicio < w * h; inicio++) {
    if (canal[inicio] || visto[inicio]) continue;
    let [x0, y0, x1, y1, area] = [w, h, 0, 0, 0];
    pila.push(inicio);
    visto[inicio] = 1;
    while (pila.length) {
      const p = pila.pop()!;
      const x = p % w;
      const y = (p - x) / w;
      area++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
        if (q >= 0 && !canal[q] && !visto[q]) {
          visto[q] = 1;
          pila.push(q);
        }
      }
    }
    // La caja vuelve a su tamaño: el canal ensanchado se comió `ensanche` píxeles por cada lado.
    const e = ensanche;
    if (area >= 0.02 * w * h) cajas.push({ x0: Math.max(0, x0 - e) / w, y0: Math.max(0, y0 - e) / h, x1: Math.min(w, x1 + 1 + e) / w, y1: Math.min(h, y1 + 1 + e) / h, area });
  }
  const dentro = (a: Caja, b: Caja) => {
    const ix = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
    const iy = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
    return (ix * iy) / (ancho(a) * alto(a)) > 0.8;
  };
  return cajas.filter((c) => !cajas.some((o) => o !== c && o.area > c.area && dentro(c, o))).map(({ x0, y0, x1, y1 }) => ({ x0, y0, x1, y1 }));
}

/**
 * El orden de las viñetas de una página de manga: se parte por el hueco horizontal más claro (franjas de arriba abajo) y,
 * dentro de cada franja, por el vertical (de derecha a izquierda), y así sucesivamente. Si ningún corte separa las viñetas
 * (se solapan sus cajas, como con los bordes inclinados), van por franjas como los globos.
 */
export function ordenVinetas(vinetas: Caja[]): Caja[] {
  if (vinetas.length < 2) return vinetas;
  const holgura = 0.02;
  const cortes = (eje: 'x' | 'y') => {
    const tramos = vinetas.map((c) => (eje === 'y' ? [c.y0, c.y1] : [c.x0, c.x1])).sort((a, b) => a[0] - b[0]);
    const salida: number[] = [];
    let fin = tramos[0][1];
    for (const [a, b] of tramos.slice(1)) {
      if (a >= fin - holgura) salida.push((a + fin) / 2);
      fin = Math.max(fin, b);
    }
    return salida;
  };
  for (const eje of ['y', 'x'] as const) {
    const c = cortes(eje);
    if (!c.length) continue;
    const centro = (v: Caja) => (eje === 'y' ? (v.y0 + v.y1) / 2 : (v.x0 + v.x1) / 2);
    const bordes = [-Infinity, ...c, Infinity];
    const partes = bordes.slice(1).map((b, i) => vinetas.filter((v) => centro(v) >= bordes[i] && centro(v) < b));
    if (partes.filter((p) => p.length).length < 2) continue;
    // En vertical, la parte de la derecha va primero.
    return (eje === 'x' ? partes.reverse() : partes).flatMap((p) => ordenVinetas(p));
  }
  return ordenManga(vinetas.map((caja) => ({ caja }))).map((v) => v.caja);
}

/**
 * El orden de lectura de los bloques de un manga con sus viñetas: cada bloque va a la viñeta que más lo contiene (o a la
 * más cercana si cae en el canal), las viñetas en su orden y, dentro de cada una, el orden de siempre. Sin viñetas, el
 * orden de siempre.
 */
export function ordenMangaPorVinetas<T extends { caja: Caja }>(bloques: T[], vinetas: Caja[]): T[] {
  if (vinetas.length < 2) return ordenManga(bloques);
  const orden = ordenVinetas(vinetas);
  const comun = (a: Caja, b: Caja) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const distancia = (a: Caja, b: Caja) => Math.hypot(Math.max(0, b.x0 - a.x1, a.x0 - b.x1), Math.max(0, b.y0 - a.y1, a.y0 - b.y1));
  const grupos = orden.map(() => [] as T[]);
  for (const b of bloques) {
    let mejor = 0;
    for (let i = 1; i < orden.length; i++) {
      const [ci, cm] = [comun(b.caja, orden[i]), comun(b.caja, orden[mejor])];
      if (ci > cm || (ci === cm && distancia(b.caja, orden[i]) < distancia(b.caja, orden[mejor]))) mejor = i;
    }
    grupos[mejor].push(b);
  }
  return grupos.flatMap((g) => ordenManga(g));
}

/** Un bloque de texto del detector de globos: 1 si va dentro de un globo, 2 si va suelto; y su puntuación. */
export interface BloqueManga extends Caja {
  etiqueta: number;
  puntuacion: number;
}

/**
 * Del detector de globos (RT-DETR, exportación oficial): los bloques de texto, sin los globos vacíos ni los repetidos. El
 * texto dentro de un globo se acepta con menos seguridad que el suelto: un globo con solo «……» puntúa bajo y es diálogo,
 * mientras que lo suelto con poca seguridad suele ser fondo, onomatopeyas o marcas de agua (medido en 18 páginas de cinco
 * series: con 0,25 y 0,4, de 7 globos perdidos a 4 sin más ruido).
 */
export function bloquesDeDetector(etiquetas: ArrayLike<number | bigint>, cajas: ArrayLike<number>, puntos: ArrayLike<number>, w: number, h: number, umbrales = { globo: 0.25, suelto: 0.4 }): BloqueManga[] {
  const candidatas: BloqueManga[] = [];
  for (let q = 0; q < puntos.length; q++) {
    // 0 es el globo; 1, el texto dentro de un globo; 2, el texto suelto.
    const etiqueta = Number(etiquetas[q]);
    if (etiqueta === 0 || puntos[q] < (etiqueta === 1 ? umbrales.globo : umbrales.suelto)) continue;
    const x0 = Math.max(0, Math.floor(cajas[q * 4]));
    const y0 = Math.max(0, Math.floor(cajas[q * 4 + 1]));
    const x1 = Math.min(w, Math.ceil(cajas[q * 4 + 2]));
    const y1 = Math.min(h, Math.ceil(cajas[q * 4 + 3]));
    if (x1 - x0 >= 6 && y1 - y0 >= 6) candidatas.push({ x0, y0, x1, y1, etiqueta, puntuacion: puntos[q] });
  }
  candidatas.sort((a, b) => b.puntuacion - a.puntuacion);
  const salida: BloqueManga[] = [];
  for (const c of candidatas) {
    const repetida = salida.some((o) => {
      const ix = Math.max(0, Math.min(o.x1, c.x1) - Math.max(o.x0, c.x0));
      const iy = Math.max(0, Math.min(o.y1, c.y1) - Math.max(o.y0, c.y0));
      return (ix * iy) / Math.min(ancho(c) * alto(c), ancho(o) * alto(o)) > 0.6;
    });
    if (!repetida) salida.push(c);
  }
  return salida;
}

/**
 * Los signos que de verdad se repiten en un globo, por su categoría y no por su letra (el texto japonés vive en el paquete
 * de la lengua): la puntuación corriente y las rayas (puntos, punto medio, admiración, interrogación, ondulada) y las
 * letras modificadoras (la raya larga de vocal).
 */
const REPETIBLE = /^(?:\p{Po}|\p{Pd}|\p{Lm}|~)$/u;

/** Los ids de los signos repetibles en el vocabulario de manga-ocr. */
export const idsRepetibles = (vocabulario: string[]): Set<number> => new Set(vocabulario.flatMap((t, i) => (REPETIBLE.test(t) ? [i] : [])));

/**
 * El siguiente token de manga-ocr, voraz y sin repetir trigramas, como su configuración no_repeat_ngram_size = 3. Los
 * signos repetibles quedan fuera de esa regla: si no, «……» (seis puntos) no puede salir nunca y se queda en «…». Para
 * que no se enrede, un signo no sigue más de 8 veces seguidas: ahí acaba el globo (3 es el final de manga-ocr).
 */
export function siguienteToken(logits: ArrayLike<number>, base: number, V: number, ids: number[], repetibles: ReadonlySet<number> = new Set()): number {
  const prohibidos = new Set<number>();
  if (ids.length >= 2) {
    const a = ids[ids.length - 2];
    const b = ids[ids.length - 1];
    for (let i = 0; i + 2 < ids.length; i++) if (ids[i] === a && ids[i + 1] === b && !repetibles.has(ids[i + 2])) prohibidos.add(ids[i + 2]);
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
  if (repetibles.has(mejor) && ids.length >= 8 && ids.slice(-8).every((x) => x === mejor)) return 3;
  return mejor;
}

/**
 * Los ids de manga-ocr a texto: sin los especiales (los cinco primeros del vocabulario) ni espacios. Los puntos van a
 * «…» enteros: de dos a cuatro son uno, y cinco o más, «……» (el modelo a veces se queda corto o se alarga); los demás
 * signos repetidos se recortan a lo razonable.
 */
export function textoDeMangaOcr(ids: number[], vocabulario: string[]): string {
  return ids
    .filter((i) => i > 4)
    .map((i) => vocabulario[i] ?? '')
    .join('')
    .replace(/\s+/g, '')
    .replace(/\.{2,}/g, (m) => (m.length >= 5 ? '……' : '…'))
    .replace(/(\p{Lm})\1{4,}/gu, '$1$1$1$1')
    .replace(/([!?！？])\1{3,}/g, '$1$1$1')
    .replace(/(\p{Po})\1{6,}/gu, (_, c: string) => c.repeat(6));
}

const JAPONES = /[\p{scx=Hiragana}\p{scx=Katakana}\p{scx=Han}]/u;

/**
 * Lo que el modo Manga no debe dar como texto: marcas de agua de las webs de descarga y números de página (letras latinas
 * o cifras sin nada japonés), y texto suelto que manga-ocr lee con poca seguridad (fondos, onomatopeyas a mano). En 18
 * páginas de cinco series quitó 8 de 13 falsos y ningún globo de verdad. La confianza es la media de la probabilidad de
 * cada token elegido.
 */
export function esRuidoManga(texto: string, etiqueta: number, confianza: number): boolean {
  if (!JAPONES.test(texto) && /[A-Za-z0-9]/.test(texto)) return true;
  return etiqueta === 2 && confianza < 0.6;
}
