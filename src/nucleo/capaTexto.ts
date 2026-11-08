// La capa de texto de una página del visor: líneas que se pueden tocar, con la posición de cada letra para saber qué
// palabra se tocó. Un PDF con texto la trae hecha a trozos sueltos, a veces de una sola letra; aquí se juntan en renglones
// o en columnas. Las líneas del OCR no saben dónde va cada letra: se reparten a lo largo de su caja, que en japonés, con
// letras del mismo ancho, casi coincide. Sin navegador, para poder probarlo.

import { type Caja, type LineaOcr, quitarFurigana } from './ocr';

export interface LineaTexto extends LineaOcr {
  /**
   * Dónde empieza cada unidad del texto a lo largo de la línea, en fracciones de la página, y al final dónde acaba la
   * última: la x en un renglón y la y en una columna. Sin cortes, las letras se reparten por igual en la caja.
   */
  cortes?: number[];
}

/** Un trozo de texto de pdf.js, ya en las coordenadas de la vista, con el origen arriba a la izquierda. */
export interface TrozoPdf {
  texto: string;
  /** La matriz del texto por la de la vista: [a, b, c, d, e, f]. */
  tx: number[];
  /** Lo que avanza el trozo en la vista: su ancho si va en horizontal y su alto si va en vertical. */
  avance: number;
  /** Si la fuente se escribe en vertical: entonces el trozo avanza hacia abajo. */
  vertical: boolean;
  /** La parte de la letra que queda por encima de la línea base, de 0 a 1. */
  ascenso: number;
}

type Eje = 'x' | 'y';

interface Pieza {
  texto: string;
  caja: Caja;
  /** Hacia dónde avanza el trozo, si es lo bastante largo para saberlo: una letra sola vale para un renglón o una columna. */
  eje: Eje | null;
  /** El tamaño de la letra. */
  letra: number;
}

interface Grupo {
  piezas: Pieza[];
  eje: Eje | null;
  caja: Caja;
}

const CJK = /[\p{scx=Han}\p{scx=Hiragana}\p{scx=Katakana}　-〿＀-￯]/u;

/** Los signos que la fuente gira en vertical, con el signo que son: la norma los descompone en los de anchura normal. */
const VERTICALES: Record<string, string> = {
  '︐': '，', '︑': '、', '︒': '。', '︓': '：', '︔': '；', '︕': '！', '︖': '？', '︗': '〖', '︘': '〗', '︙': '…',
  '︰': '‥', '︱': '—', '︲': '–', '︵': '（', '︶': '）', '︷': '｛', '︸': '｝', '︹': '〔', '︺': '〕', '︻': '【', '︼': '】',
  '︽': '《', '︾': '》', '︿': '〈', '﹀': '〉', '﹁': '「', '﹂': '」', '﹃': '『', '﹄': '』', '﹇': '［', '﹈': '］',
};

/**
 * Una letra como se escribe y no como la guarda la fuente. Muchos PDF japoneses, también los que hace el propio
 * navegador, traen radicales Kangxi en lugar del kanji (⽇ por 日, ⾞ por 車) y los signos girados de la escritura
 * vertical (︒ por 。). Siempre una letra por otra, para no descuadrar las posiciones.
 */
export function letraNormal(c: string): string {
  const cp = c.codePointAt(0) ?? 0;
  if ((cp >= 0x2e80 && cp <= 0x2fdf) || (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0x2f800 && cp <= 0x2fa1f)) {
    const n = c.normalize('NFKC');
    return [...n].length === 1 ? n : c;
  }
  return VERTICALES[c] ?? c;
}

/** La caja que ocupa un trozo en la página, como la calcula la capa de texto de pdf.js: así coincide con lo que pinta. */
function piezaDe(t: TrozoPdf): Pieza {
  const [a, b, c, d, e, f] = t.tx;
  const angulo = Math.atan2(b, a) + (t.vertical ? Math.PI / 2 : 0);
  const letra = Math.hypot(c, d);
  const dx = Math.cos(angulo);
  const dy = Math.sin(angulo);
  // «Arriba» de la letra, en la pantalla: con el texto recto apunta hacia y negativa.
  const ax = Math.sin(angulo);
  const ay = -Math.cos(angulo);
  const x0 = e + letra * t.ascenso * ax;
  const y0 = f + letra * t.ascenso * ay;
  const xs = [x0, x0 + t.avance * dx, x0 - letra * ax, x0 + t.avance * dx - letra * ax];
  const ys = [y0, y0 + t.avance * dy, y0 - letra * ay, y0 + t.avance * dy - letra * ay];
  const caja = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  // Un trozo que no pasa de una letra de largo, como el «12» en horizontal dentro de una columna, no dice el sentido.
  const largo = Math.abs(dx) >= Math.abs(dy) ? caja.x1 - caja.x0 : caja.y1 - caja.y0;
  const eje: Eje | null = largo > 1.3 * letra ? (Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y') : null;
  return { texto: t.texto, caja, eje, letra };
}

const centroY = (c: Caja) => (c.y0 + c.y1) / 2;
const centroX = (c: Caja) => (c.x0 + c.x1) / 2;

/** Si la pieza sigue la línea, y hacia dónde: a la derecha en el mismo renglón o debajo en la misma columna. */
function continua(g: Grupo, p: Pieza): Eje | null {
  const u = g.piezas[g.piezas.length - 1];
  const L = Math.min(u.letra, p.letra) || Math.max(u.letra, p.letra);
  if (g.eje !== 'y' && p.eje !== 'y') {
    const hueco = p.caja.x0 - u.caja.x1;
    if (Math.abs(centroY(u.caja) - centroY(p.caja)) < 0.5 * L && hueco > -0.6 * L && hueco < 1.6 * L) return 'x';
  }
  if (g.eje !== 'x' && p.eje !== 'x') {
    const hueco = p.caja.y0 - u.caja.y1;
    if (Math.abs(centroX(u.caja) - centroX(p.caja)) < 0.5 * L && hueco > -0.6 * L && hueco < 1.6 * L) return 'y';
  }
  return null;
}

/** El texto de un grupo y dónde empieza cada letra; con un espacio entre palabras separadas, salvo en japonés o chino. */
function lineaDe(g: Grupo, ancho: number, alto: number): LineaTexto {
  const eje: Eje = g.eje ?? (g.caja.y1 - g.caja.y0 > 1.5 * (g.caja.x1 - g.caja.x0) ? 'y' : 'x');
  const escala = eje === 'x' ? ancho : alto;
  const desde = (c: Caja) => (eje === 'x' ? c.x0 : c.y0);
  const hasta = (c: Caja) => (eje === 'x' ? c.x1 : c.y1);
  const piezas = [...g.piezas].sort((a, b) => desde(a.caja) - desde(b.caja));
  let texto = '';
  const cortes: number[] = [];
  let anterior: Pieza | null = null;
  for (const p of piezas) {
    if (anterior && eje === 'x') {
      const hueco = desde(p.caja) - hasta(anterior.caja);
      const juntas = /\s$/.test(texto) || /^\s/.test(p.texto) || CJK.test(texto.at(-1) ?? '') || CJK.test(p.texto[0] ?? '');
      if (hueco > 0.25 * Math.min(anterior.letra, p.letra) && !juntas) {
        cortes.push(hasta(anterior.caja) / escala);
        texto += ' ';
      }
    }
    const letras = Array.from(p.texto, letraNormal);
    const paso = (hasta(p.caja) - desde(p.caja)) / Math.max(1, letras.length);
    letras.forEach((ch, k) => {
      // Una letra fuera del plano básico ocupa dos unidades: las dos empiezan en el mismo sitio.
      for (let u = 0; u < ch.length; u++) cortes.push((desde(p.caja) + paso * k) / escala);
      texto += ch;
    });
    anterior = p;
  }
  cortes.push((anterior ? hasta(anterior.caja) : hasta(g.caja)) / escala);
  // Sin los espacios de los extremos, que no se pueden tocar.
  const inicio = texto.length - texto.trimStart().length;
  const fin = texto.trimEnd().length;
  const limitar = (v: number) => Math.max(0, Math.min(1, v));
  return {
    texto: texto.slice(inicio, fin),
    vertical: eje === 'y',
    cortes: cortes.slice(inicio, fin + 1).map(limitar),
    caja: { x0: limitar(g.caja.x0 / ancho), y0: limitar(g.caja.y0 / alto), x1: limitar(g.caja.x1 / ancho), y1: limitar(g.caja.y1 / alto) },
  };
}

/**
 * Las líneas de una página de PDF a partir de sus trozos de texto, en el orden en que los trae el archivo, que suele ser
 * el de lectura. Cada trozo se une a una de las últimas líneas si la continúa: el furigana va intercalado con el texto
 * de debajo y no debe partirlo. Después se quita, como en el OCR.
 */
export function lineasDePdf(trozos: TrozoPdf[], ancho: number, alto: number): LineaTexto[] {
  const grupos: Grupo[] = [];
  for (const t of trozos) {
    if (!t.texto) continue;
    const p = piezaDe(t);
    let destino: Grupo | null = null;
    let eje: Eje | null = null;
    for (let i = grupos.length - 1; i >= Math.max(0, grupos.length - 4) && !destino; i--) {
      eje = continua(grupos[i], p);
      if (eje) destino = grupos[i];
    }
    if (destino) {
      destino.piezas.push(p);
      destino.eje ??= eje;
      destino.caja = { x0: Math.min(destino.caja.x0, p.caja.x0), y0: Math.min(destino.caja.y0, p.caja.y0), x1: Math.max(destino.caja.x1, p.caja.x1), y1: Math.max(destino.caja.y1, p.caja.y1) };
    } else if (t.texto.trim()) {
      grupos.push({ piezas: [p], eje: p.eje, caja: { ...p.caja } });
    }
  }
  return quitarFurigana(grupos.map((g) => lineaDe(g, ancho, alto)).filter((l) => l.texto)) as LineaTexto[];
}

/** Dónde empieza la unidad `i` del texto a lo largo de la línea. */
function posicion(l: LineaTexto, i: number): number {
  const n = l.texto.length;
  const k = Math.max(0, Math.min(n, i));
  if (l.cortes?.length === n + 1) return l.cortes[k];
  const [a, b] = l.vertical ? [l.caja.y0, l.caja.y1] : [l.caja.x0, l.caja.x1];
  return a + ((b - a) * k) / Math.max(1, n);
}

/** La letra de la línea que hay en un punto de la página, o la más cercana si cae fuera. */
export function caracterEn(l: LineaTexto, x: number, y: number): number {
  const v = l.vertical ? y : x;
  let bajo = 0;
  let alto = Math.max(0, l.texto.length - 1);
  while (bajo < alto) {
    const m = (bajo + alto + 1) >> 1;
    if (posicion(l, m) <= v) bajo = m;
    else alto = m - 1;
  }
  return bajo;
}

/** La caja de un tramo del texto de la línea, para marcar en la página la palabra elegida. */
export function cajaDeTramo(l: LineaTexto, inicio: number, fin: number): Caja {
  const a = posicion(l, inicio);
  const b = posicion(l, fin);
  return l.vertical ? { x0: l.caja.x0, x1: l.caja.x1, y0: Math.min(a, b), y1: Math.max(a, b) } : { x0: Math.min(a, b), x1: Math.max(a, b), y0: l.caja.y0, y1: l.caja.y1 };
}
