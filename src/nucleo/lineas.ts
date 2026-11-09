// Parte un texto en líneas que caben en un ancho, como lo haría el navegador: las escrituras con espacios, por palabras, y
// las que no los usan, como el japonés o el chino, entre dos caracteres cualesquiera. Una línea no empieza con un signo de
// cierre (si no cabe, cuelga del final de la anterior) ni termina con uno de apertura. Lo usa la tarjeta para compartir,
// que se dibuja en un canvas, donde no hay maquetación del navegador.

export interface Linea {
  /** Dónde empieza y dónde acaba en el texto: sirve para saber qué parte de la línea va resaltada. */
  inicio: number;
  fin: number;
  texto: string;
  ancho: number;
  /** Si la línea termina en «…» porque el texto no cabía en las líneas permitidas. */
  cortada?: boolean;
}

/** Escrituras sin espacios entre palabras: CJK, sus signos y las formas de ancho completo. El hangul usa espacios. */
function sinEspacios(c: number): boolean {
  return (c >= 0x2e80 && c <= 0x9fff) || (c >= 0xf900 && c <= 0xfaff) || (c >= 0xfe30 && c <= 0xfe4f) || (c >= 0xff00 && c <= 0xffef) || (c >= 0x20000 && c <= 0x3134f);
}

const codigos = (s: string) => [...s].map((c) => c.codePointAt(0)!);

/** No empiezan línea: cierres y pausas, la raya de vocal larga, las kana pequeñas y las marcas de repetición. */
const NO_EMPIEZAN = new Set<number>([
  ...codigos('!),.:;?]}%'),
  0x2019, 0x201d, 0x2025, 0x2026,
  0x3001, 0x3002, 0x3005, 0x3009, 0x300b, 0x300d, 0x300f, 0x3011, 0x3015, 0x3017, 0x3019, 0x301f, 0x303b,
  0x3041, 0x3043, 0x3045, 0x3047, 0x3049, 0x3063, 0x3083, 0x3085, 0x3087, 0x308e, 0x3095, 0x3096, 0x309d, 0x309e,
  0x30a1, 0x30a3, 0x30a5, 0x30a7, 0x30a9, 0x30c3, 0x30e3, 0x30e5, 0x30e7, 0x30ee, 0x30f5, 0x30f6, 0x30fb, 0x30fc, 0x30fd, 0x30fe,
  0xff01, 0xff09, 0xff0c, 0xff0e, 0xff1a, 0xff1b, 0xff1f, 0xff3d, 0xff5d, 0xff60, 0xff61, 0xff63, 0xff64,
]);

/** No terminan línea: las aperturas. */
const NO_TERMINAN = new Set<number>([...codigos('([{'), 0x2018, 0x201c, 0x3008, 0x300a, 0x300c, 0x300e, 0x3010, 0x3014, 0x3016, 0x3018, 0x301d, 0xff08, 0xff3b, 0xff5b, 0xff5f, 0xff62]);

const esEspacio = (s: string) => s === ' ' || s === '\t' || s === String.fromCharCode(0x3000) || s === String.fromCharCode(0xa0);

interface Trozo {
  inicio: number;
  /** Hasta dónde se ve: el espacio que sigue a una palabra no cuenta al final de una línea. */
  visible: number;
  fin: number;
}

/** Los trozos que no se parten: una palabra con el espacio que la sigue, o un carácter de una escritura sin espacios. */
function trozos(texto: string, desde: number, hasta: number): Trozo[] {
  const r: Trozo[] = [];
  let i = desde;
  while (i < hasta) {
    const c = texto.codePointAt(i)!;
    const largo = c > 0xffff ? 2 : 1;
    if (esEspacio(texto[i])) {
      let j = i;
      while (j < hasta && esEspacio(texto[j])) j++;
      if (r.length) r[r.length - 1].fin = j;
      else r.push({ inicio: i, visible: i, fin: j });
      i = j;
      continue;
    }
    if (sinEspacios(c) && c !== 0x3000) {
      r.push({ inicio: i, visible: i + largo, fin: i + largo });
      i += largo;
      continue;
    }
    let j = i;
    while (j < hasta) {
      const d = texto.codePointAt(j)!;
      if (esEspacio(texto[j]) || sinEspacios(d)) break;
      j += d > 0xffff ? 2 : 1;
    }
    r.push({ inicio: i, visible: j, fin: j });
    i = j;
  }
  return r;
}

/** Una palabra más ancha que la línea se parte por caracteres, como hace el navegador con overflow-wrap. */
function partirLargos(texto: string, ts: Trozo[], medir: (s: string) => number, ancho: number): Trozo[] {
  return ts.flatMap((t) => {
    if (t.visible - t.inicio < 2 || medir(texto.slice(t.inicio, t.visible)) <= ancho) return [t];
    const piezas: Trozo[] = [];
    for (let i = t.inicio; i < t.visible; ) {
      const largo = texto.codePointAt(i)! > 0xffff ? 2 : 1;
      piezas.push({ inicio: i, visible: i + largo, fin: i + largo });
      i += largo;
    }
    piezas[piezas.length - 1].fin = t.fin;
    return piezas;
  });
}

function linea(texto: string, inicio: number, fin: number, medir: (s: string) => number): Linea {
  const t = texto.slice(inicio, fin).replace(/[ \t]+$/, '');
  return { inicio, fin: inicio + t.length, texto: t, ancho: medir(t) };
}

function partirTramo(texto: string, desde: number, hasta: number, medir: (s: string) => number, ancho: number): Linea[] {
  const ts = partirLargos(texto, trozos(texto, desde, hasta), medir, ancho);
  if (!ts.length) return [linea(texto, desde, hasta, medir)];
  const lineas: Linea[] = [];
  let primero = 0;
  let i = 1;
  while (i < ts.length) {
    const t = ts[i];
    if (medir(texto.slice(ts[primero].inicio, t.visible)) <= ancho) {
      i++;
      continue;
    }
    // Un signo de cierre que no cabe cuelga del final de la línea, en vez de quedarse solo al principio de la siguiente.
    if (t.visible - t.inicio <= 2 && NO_EMPIEZAN.has(texto.codePointAt(t.inicio)!)) {
      i++;
      continue;
    }
    let corte = i;
    if (corte - 1 > primero && NO_TERMINAN.has(texto.codePointAt(ts[corte - 1].inicio)!)) corte--;
    lineas.push(linea(texto, ts[primero].inicio, ts[corte].inicio, medir));
    primero = corte;
    i = corte + 1;
  }
  lineas.push(linea(texto, ts[primero].inicio, hasta, medir));
  return lineas;
}

/** Deja la última línea permitida con «…» al final, quitando lo que haga falta para que quepa. */
function cortar(lineas: Linea[], texto: string, medir: (s: string) => number, ancho: number, maximo: number): Linea[] {
  if (lineas.length <= maximo) return lineas;
  const r = lineas.slice(0, maximo);
  const u = r[r.length - 1];
  let fin = Math.max(u.fin, Math.min(texto.length, lineas[maximo].inicio));
  let t = texto.slice(u.inicio, fin).replace(/\s+$/, '');
  while (t.length && medir(`${t}…`) > ancho) {
    const ultimo = t.codePointAt(t.length - 1)!;
    const largo = ultimo >= 0xdc00 && ultimo <= 0xdfff ? 2 : 1;
    t = t.slice(0, -largo).replace(/\s+$/, '');
  }
  fin = u.inicio + t.length;
  r[r.length - 1] = { inicio: u.inicio, fin, texto: `${t}…`, ancho: medir(`${t}…`), cortada: true };
  return r;
}

/**
 * Las líneas de un texto en un ancho, con `medir` dando el ancho de un trozo en la letra en que se dibujará. Un salto de
 * línea del texto empieza siempre una línea nueva. Con `maximo`, lo que no quepa se corta con «…».
 */
export function partirLineas(texto: string, medir: (s: string) => number, ancho: number, maximo = Infinity): Linea[] {
  const lineas: Linea[] = [];
  let desde = 0;
  for (const parrafo of texto.split('\n')) {
    lineas.push(...partirTramo(texto, desde, desde + parrafo.length, medir, ancho));
    desde += parrafo.length + 1;
  }
  return cortar(lineas, texto, medir, ancho, maximo);
}

/** El mayor tamaño de letra, entre `minimo` y `maximo`, con el que un texto cabe en una línea. */
export function tamanoQueCabe(medirCon: (tamano: number) => number, ancho: number, maximo: number, minimo: number, paso = 2): number {
  let t = maximo;
  while (t > minimo && medirCon(t) > ancho) t -= paso;
  return Math.max(t, minimo);
}
