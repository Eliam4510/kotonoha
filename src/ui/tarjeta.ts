// La tarjeta para compartir una palabra o un punto de gramática: una imagen PNG con la palabra, lo que significa en la
// frase y la frase donde apareció, lista para pegarla en un chat. Se dibuja a mano en un canvas, con la tipografía y la hoja
// de Kotonoha, para que salga igual se abra la ficha donde se abra: sobre un video, en el Cuaderno o en el visor.

import { type Linea, partirLineas, tamanoQueCabe } from '../nucleo/lineas';
import { cargarFuentes } from './fuentes';
import { dibujarFirma, dibujarHoja } from './marca';

export type EstiloTarjeta = 'oscuro' | 'claro';

export interface TrozoTitulo {
  texto: string;
  /** La lectura que va encima, como el furigana de la ficha. */
  lectura?: string;
}

export interface DatosTarjeta {
  /** «Palabra» o «Gramática», en el idioma de la interfaz. */
  etiqueta: string;
  nivel?: string;
  titulo: TrozoTitulo[];
  /** Cómo se pronuncia, cuando no se escribe encima: el AFI del inglés. */
  pronunciacion?: string;
  /** La curva del acento tonal, con el color de su patrón en cada estilo. */
  acento?: { moras: string[]; posicion: number; color: Record<EstiloTarjeta, string> };
  /** Lo que encabeza el significado: «En esta frase» si lo dijo Claude, «Significado» si es del diccionario. */
  rotulo: string;
  deClaude?: boolean;
  uso?: string;
  significado?: string;
  otros?: string[];
  nota?: string;
  frase?: string;
  /** Qué parte de la frase es la palabra o el patrón, para resaltarla. */
  resaltado?: { inicio: number; fin: number };
  traduccion?: string;
  /** De dónde salió: el título del video, del libro o de la página. */
  fuente?: string;
}

const LETRA = "'Kotonoha Latin', 'Kotonoha JP', 'Hiragino Maru Gothic ProN', 'Yu Gothic UI', Meiryo, 'Segoe UI', 'Malgun Gothic', 'Microsoft YaHei', system-ui, sans-serif";
const LETRA_LATIN = "'Kotonoha Latin', 'Segoe UI', system-ui, sans-serif";
const LETRA_JAPONES = "'Kotonoha JP', 'Hiragino Maru Gothic ProN', 'Yu Gothic UI', Meiryo, sans-serif";

type Rgba = [number, number, number, number];
const rgba = ([r, g, b, a]: Rgba, alfa = a) => `rgba(${r}, ${g}, ${b}, ${alfa})`;

/** Los colores de la interfaz (estilos.css) en sus dos temas. */
const COLORES = {
  oscuro: {
    fondoA: '#131C17', fondoB: '#090D0B', brilloHoja: [169, 228, 91, 0.17] as Rgba, brilloFuji: [188, 169, 255, 0.13] as Rgba,
    carta: '#151B18', borde: 'rgba(226, 240, 226, 0.10)', luz: 'rgba(255, 255, 255, 0.06)', caja: '#1C2420', sombra: 'rgba(0, 0, 0, 0.5)',
    texto: '#F2F5EE', texto2: '#B5BFB5', texto3: '#828E85', hoja: '#A9E45B', hojaSuave: 'rgba(169, 228, 91, 0.13)', hojaMedia: 'rgba(169, 228, 91, 0.27)',
    fuji: '#BCA9FF', fujiSuave: 'rgba(188, 169, 255, 0.13)', marcaAgua: 0.07,
  },
  claro: {
    fondoA: '#F3EFE3', fondoB: '#E4DDCA', brilloHoja: [140, 200, 80, 0.24] as Rgba, brilloFuji: [110, 82, 217, 0.11] as Rgba,
    carta: '#FFFEFA', borde: 'rgba(46, 56, 34, 0.10)', luz: 'rgba(255, 255, 255, 0)', caja: '#F4F1E7', sombra: 'rgba(52, 60, 36, 0.18)',
    texto: '#1B2217', texto2: '#525C4C', texto3: '#848D7C', hoja: '#4C9A1F', hojaSuave: 'rgba(92, 170, 40, 0.11)', hojaMedia: 'rgba(92, 170, 40, 0.22)',
    fuji: '#6E52D9', fujiSuave: 'rgba(110, 82, 217, 0.09)', marcaAgua: 0.1,
  },
};
type Colores = (typeof COLORES)[EstiloTarjeta];

/** Medidas en píxeles CSS; la imagen se guarda al doble para que se lea nítida en cualquier pantalla. */
const ANCHO = 1080;
const MARGEN = 40;
const RELLENO = 64;
const ESCALA = 2;
const X0 = MARGEN + RELLENO;
const CONTENIDO = ANCHO - 2 * X0;

type Paso = (ctx: CanvasRenderingContext2D) => void;

function escribir(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, letra: string, color: string, alinear: CanvasTextAlign = 'left', espaciado = 0) {
  ctx.font = letra;
  ctx.fillStyle = color;
  ctx.textAlign = alinear;
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = `${espaciado}px`;
  ctx.fillText(s, x, y);
  ctx.letterSpacing = '0px';
}

function medidor(ctx: CanvasRenderingContext2D, letra: string, espaciado = 0) {
  return (s: string) => {
    ctx.font = letra;
    ctx.letterSpacing = `${espaciado}px`;
    const ancho = ctx.measureText(s).width;
    ctx.letterSpacing = '0px';
    return ancho;
  };
}

/** Una etiqueta redondeada; devuelve su ancho. */
function pastilla(ctx: CanvasRenderingContext2D, pasos: Paso[], texto: string, x: number, y: number, letra: string, color: string, fondo: string, borde?: string): number {
  const ancho = medidor(ctx, letra, 1.4)(texto) + 36;
  pasos.push((c) => {
    c.beginPath();
    c.roundRect(x, y, ancho, 42, 21);
    if (fondo) {
      c.fillStyle = fondo;
      c.fill();
    }
    if (borde) {
      c.lineWidth = 2;
      c.strokeStyle = borde;
      c.stroke();
    }
    escribir(c, texto, x + 18, y + 21.5, letra, color, 'left', 1.4);
  });
  return ancho;
}

/** El destello de cuatro puntas que acompaña en la interfaz a lo que dijo Claude. */
function destello(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + r * 0.16, y - r * 0.16, x + r, y);
  ctx.quadraticCurveTo(x + r * 0.16, y + r * 0.16, x, y + r);
  ctx.quadraticCurveTo(x - r * 0.16, y + r * 0.16, x - r, y);
  ctx.quadraticCurveTo(x - r * 0.16, y - r * 0.16, x, y - r);
  ctx.fillStyle = color;
  ctx.fill();
}

/** Un bloque de líneas de texto; devuelve el alto que ocupa. */
function parrafo(ctx: CanvasRenderingContext2D, pasos: Paso[], texto: string, y: number, letra: string, color: string, interlineado: number, maximo: number, x = X0, ancho = CONTENIDO): number {
  const lineas = partirLineas(texto, medidor(ctx, letra), ancho, maximo);
  pasos.push((c) => lineas.forEach((l, i) => escribir(c, l.texto, x, y + interlineado * i + interlineado / 2, letra, color)));
  return lineas.length * interlineado;
}

function componer(ctx: CanvasRenderingContext2D, d: DatosTarjeta, c: Colores, estilo: EstiloTarjeta, letraLengua: string): { alto: number; pasos: Paso[] } {
  const pasos: Paso[] = [];
  let y = MARGEN + RELLENO;

  // Qué es: palabra o gramática, y su nivel.
  const letraEtiqueta = `800 20px ${LETRA}`;
  const anchoEtiqueta = pastilla(ctx, pasos, d.etiqueta.toLocaleUpperCase(), X0, y, letraEtiqueta, c.hoja, c.hojaSuave);
  if (d.nivel) pastilla(ctx, pasos, d.nivel, X0 + anchoEtiqueta + 10, y, letraEtiqueta, c.texto2, c.caja);
  y += 42 + 40;

  // La palabra, lo más grande, con su lectura encima.
  const conLectura = d.titulo.some((t) => t.lectura);
  const letraTitulo = (t: number) => `900 ${t}px ${letraLengua}`;
  const letraLectura = (t: number) => `700 ${Math.round(t * 0.3)}px ${letraLengua}`;
  const anchoTrozo = (s: TrozoTitulo, t: number) => Math.max(medidor(ctx, letraTitulo(t))(s.texto), s.lectura ? medidor(ctx, letraLectura(t))(s.lectura) + t * 0.1 : 0);
  const anchoTitulo = (t: number) => d.titulo.reduce((n, s) => n + anchoTrozo(s, t), 0);
  const tamano = tamanoQueCabe(anchoTitulo, CONTENIDO, conLectura ? 136 : 124, conLectura ? 44 : 60);
  if (!conLectura && anchoTitulo(tamano) > CONTENIDO) {
    // Un patrón largo o una expresión de varias palabras: en varias líneas.
    const texto = d.titulo.map((t) => t.texto).join('');
    y += parrafo(ctx, pasos, texto, y, letraTitulo(tamano), c.texto, tamano * 1.18, 3);
  } else {
    const altoLectura = conLectura ? Math.round(tamano * 0.3 * 1.4) : 0;
    const yLectura = y + altoLectura / 2;
    const yBase = y + altoLectura + tamano * 0.6;
    pasos.push((cx) => {
      let x = X0;
      for (const s of d.titulo) {
        const ancho = anchoTrozo(s, tamano);
        escribir(cx, s.texto, x + ancho / 2, yBase, letraTitulo(tamano), c.texto, 'center');
        if (s.lectura) escribir(cx, s.lectura, x + ancho / 2, yLectura, letraLectura(tamano), c.texto2, 'center');
        x += ancho;
      }
    });
    y += altoLectura + tamano * 1.2;
  }

  // Cómo suena: la curva del acento sobre las moras, o el AFI.
  if (d.acento?.moras.length) {
    const { moras, posicion } = d.acento;
    const color = d.acento.color[estilo];
    const letraMora = `700 30px ${letraLengua}`;
    const paso = Math.max(42, ...moras.map((m) => medidor(ctx, letraMora)(m) + 10));
    const alta = y + 8;
    const baja = y + 32;
    const yMora = y + 70;
    const esBaja = moras.map((_, i) => (posicion === 0 ? i === 0 : posicion === 1 ? i !== 0 : i === 0 || i >= posicion));
    const finalBaja = posicion !== 0 && moras.length >= posicion;
    const xDe = (i: number) => X0 + paso / 2 + i * paso;
    pasos.push((cx) => {
      cx.beginPath();
      esBaja.forEach((b, i) => (i ? cx.lineTo(xDe(i), b ? baja : alta) : cx.moveTo(xDe(i), b ? baja : alta)));
      cx.lineTo(xDe(moras.length), finalBaja ? baja : alta);
      cx.strokeStyle = color;
      cx.lineWidth = 3.5;
      cx.lineJoin = 'round';
      cx.lineCap = 'round';
      cx.stroke();
      esBaja.forEach((b, i) => {
        cx.beginPath();
        cx.arc(xDe(i), b ? baja : alta, 6, 0, Math.PI * 2);
        cx.fillStyle = color;
        cx.fill();
      });
      cx.beginPath();
      cx.arc(xDe(moras.length), finalBaja ? baja : alta, 5.5, 0, Math.PI * 2);
      cx.fillStyle = c.carta;
      cx.fill();
      cx.lineWidth = 3;
      cx.stroke();
      moras.forEach((m, i) => escribir(cx, m, xDe(i), yMora, letraMora, c.texto2, 'center'));
    });
    y += 96;
  } else if (d.pronunciacion) {
    const letraAfi = `600 32px ${LETRA}`;
    pasos.push((cx) => escribir(cx, d.pronunciacion!, X0, y + 22, letraAfi, c.texto2));
    y += 60;
  }

  // Lo que significa.
  const otros = d.otros?.filter(Boolean) ?? [];
  if (d.significado || d.nota || otros.length) {
    y += 22;
    const yLinea = y;
    pasos.push((cx) => {
      cx.fillStyle = c.borde;
      cx.fillRect(X0, yLinea, CONTENIDO, 2);
    });
    y += 42;
    const letraRotulo = `800 20px ${LETRA}`;
    const colorRotulo = d.deClaude ? c.fuji : c.hoja;
    const rotulo = d.rotulo.toLocaleUpperCase();
    const anchoRotulo = medidor(ctx, letraRotulo, 2)(rotulo);
    const yRotulo = y + 15;
    pasos.push((cx) => {
      if (d.deClaude) destello(cx, X0 + 10, yRotulo, 10, colorRotulo);
      else dibujarHoja(cx, X0, yRotulo - 11, 22);
      escribir(cx, rotulo, X0 + 32, yRotulo, letraRotulo, colorRotulo, 'left', 2);
    });
    if (d.uso) {
      const letraUso = `700 18px ${LETRA}`;
      const anchoUso = medidor(ctx, letraUso)(d.uso) + 28;
      const xUso = X0 + 32 + anchoRotulo + 16;
      pasos.push((cx) => {
        cx.beginPath();
        cx.roundRect(xUso, yRotulo - 16, anchoUso, 32, 16);
        cx.fillStyle = d.deClaude ? c.fujiSuave : c.hojaSuave;
        cx.fill();
        escribir(cx, d.uso!, xUso + 14, yRotulo + 1, letraUso, c.texto2);
      });
    }
    y += 30 + 18;
    if (d.significado) y += parrafo(ctx, pasos, d.significado, y, `800 50px ${LETRA}`, c.texto, 64, 3) + 6;
    if (otros.length) y += parrafo(ctx, pasos, otros.join('  ·  '), y, `600 29px ${LETRA}`, c.texto2, 42, 2) + 6;
    if (d.nota) y += 8 + parrafo(ctx, pasos, d.nota, y + 8, `500 30px ${LETRA}`, c.texto2, 45, 5);
  }

  // La frase donde apareció, con la palabra resaltada.
  if (d.frase) {
    y += 40;
    const letraFrase = `500 40px ${letraLengua}`;
    const letraResaltada = `800 40px ${letraLengua}`;
    const xTexto = X0 + 58;
    const anchoTexto = CONTENIDO - 58 - 40;
    const interlineado = 66;
    const lineas = partirLineas(d.frase, medidor(ctx, letraFrase), anchoTexto, 4);
    const letraTraduccion = `500 28px ${LETRA}`;
    const lineasTraduccion = d.traduccion ? partirLineas(d.traduccion, medidor(ctx, letraTraduccion), anchoTexto, 3) : [];
    const alto = 34 + lineas.length * interlineado + (lineasTraduccion.length ? 12 + lineasTraduccion.length * 40 : 0) + 30;
    const yCaja = y;
    pasos.push((cx) => {
      cx.beginPath();
      cx.roundRect(X0, yCaja, CONTENIDO, alto, 28);
      cx.fillStyle = c.caja;
      cx.fill();
      cx.beginPath();
      cx.roundRect(X0 + 28, yCaja + 30, 6, alto - 60, 3);
      cx.fillStyle = c.hoja;
      cx.fill();
      lineas.forEach((l, i) => fraseResaltada(cx, d.frase!, l, d.resaltado, xTexto, yCaja + 34 + i * interlineado + interlineado / 2, letraFrase, letraResaltada, c));
      lineasTraduccion.forEach((l, i) => escribir(cx, l.texto, xTexto, yCaja + 34 + lineas.length * interlineado + 12 + i * 40 + 20, letraTraduccion, c.texto3));
    });
    y += alto;
  }

  // De dónde salió, y la firma.
  y += d.frase ? 40 : 34;
  const yPie = y + 22;
  const anchoFirma = dibujarFirma(ctx, 0, 0, 38, { texto: c.texto, tenue: c.texto3 }, { latin: LETRA_LATIN, japones: LETRA_JAPONES }, false);
  pasos.push((cx) => dibujarFirma(cx, X0 + CONTENIDO, yPie, 38, { texto: c.texto, tenue: c.texto3 }, { latin: LETRA_LATIN, japones: LETRA_JAPONES }));
  if (d.fuente) {
    const letraFuente = `700 22px ${LETRA}`;
    const [l] = partirLineas(d.fuente.replace(/\s+/g, ' '), medidor(ctx, letraFuente), CONTENIDO - anchoFirma - 40, 1);
    if (l) pasos.push((cx) => escribir(cx, l.texto, X0, yPie, letraFuente, c.texto3));
  }
  y += 44;
  return { alto: Math.ceil(y + RELLENO + MARGEN), pasos };
}

/** Una línea de la frase, con lo resaltado en negrita, en verde y sobre un trazo de rotulador. */
function fraseResaltada(ctx: CanvasRenderingContext2D, frase: string, l: Linea, r: DatosTarjeta['resaltado'], x: number, y: number, letra: string, letraResaltada: string, c: Colores) {
  const a = r ? Math.min(Math.max(r.inicio, l.inicio), l.fin) : l.fin;
  const b = r ? Math.min(Math.max(r.fin, l.inicio), l.fin) : l.fin;
  const partes: [string, boolean][] = [
    [frase.slice(l.inicio, a), false],
    [frase.slice(a, b), true],
    [frase.slice(b, l.fin) + (l.cortada ? '…' : ''), false],
  ];
  for (const [texto, resaltado] of partes) {
    if (!texto) continue;
    const ancho = medidor(ctx, resaltado ? letraResaltada : letra)(texto);
    if (resaltado) {
      ctx.beginPath();
      ctx.roundRect(x - 4, y - 2, ancho + 8, 26, 7);
      ctx.fillStyle = c.hojaMedia;
      ctx.fill();
    }
    escribir(ctx, texto, x, y, resaltado ? letraResaltada : letra, resaltado ? c.hoja : c.texto);
    x += ancho;
  }
}

function fondo(ctx: CanvasRenderingContext2D, alto: number, c: Colores) {
  const g = ctx.createLinearGradient(0, 0, ANCHO, alto);
  g.addColorStop(0, c.fondoA);
  g.addColorStop(1, c.fondoB);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ANCHO, alto);
  for (const [x, y, radio, color] of [
    [ANCHO * 0.86, 0, 640, c.brilloHoja],
    [0, alto, 560, c.brilloFuji],
  ] as [number, number, number, Rgba][]) {
    const r = ctx.createRadialGradient(x, y, 0, x, y, radio);
    r.addColorStop(0, rgba(color));
    r.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, ANCHO, alto);
  }
  ctx.save();
  ctx.shadowColor = c.sombra;
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 18;
  ctx.beginPath();
  ctx.roundRect(MARGEN, MARGEN, ANCHO - 2 * MARGEN, alto - 2 * MARGEN, 44);
  ctx.fillStyle = c.carta;
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = 2;
  ctx.strokeStyle = c.borde;
  ctx.stroke();
  // La silueta de la hoja, enorme y casi invisible, asoma por la esquina como una marca de agua.
  ctx.save();
  ctx.clip();
  dibujarHoja(ctx, ANCHO - MARGEN - 268, MARGEN - 84, 380, c.marcaAgua, true);
  ctx.beginPath();
  ctx.moveTo(MARGEN + 44, MARGEN + 1);
  ctx.lineTo(ANCHO - MARGEN - 44, MARGEN + 1);
  ctx.strokeStyle = c.luz;
  ctx.stroke();
  ctx.restore();
}

/** La letra de una variable CSS como `var(--letra-japones)`, resuelta en un elemento que la conoce. */
export function resolverLetra(el: Element | null | undefined, letra: string): string {
  const m = /^var\((--[\w-]+)\)$/.exec(letra.trim());
  if (!m) return letra;
  const valor = el ? getComputedStyle(el).getPropertyValue(m[1]).trim() : '';
  return valor || LETRA;
}

/** Dibuja la tarjeta y la devuelve como PNG. */
export async function crearTarjeta(d: DatosTarjeta, estilo: EstiloTarjeta, letraLengua = LETRA): Promise<Blob> {
  await cargarFuentes().catch(() => {});
  await document.fonts.ready;
  const lienzo = document.createElement('canvas');
  lienzo.width = ANCHO * ESCALA;
  lienzo.height = 16;
  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('canvas');
  const c = COLORES[estilo];
  const { alto, pasos } = componer(ctx, d, c, estilo, letraLengua);
  lienzo.height = alto * ESCALA;
  ctx.scale(ESCALA, ESCALA);
  fondo(ctx, alto, c);
  for (const p of pasos) p(ctx);
  return new Promise<Blob>((ok, mal) => lienzo.toBlob((b) => (b ? ok(b) : mal(new Error('canvas'))), 'image/png'));
}

/**
 * Copia la imagen al portapapeles. Se llama en el mismo clic, con la imagen aún dibujándose: el navegador solo deja escribir
 * en el portapapeles mientras dura el gesto, y una promesa dentro de ClipboardItem lo conserva hasta que la imagen está lista.
 */
export function copiarImagen(imagen: Promise<Blob>): Promise<void> {
  return navigator.clipboard.write([new ClipboardItem({ 'image/png': imagen })]);
}

export function guardarImagen(imagen: Blob, nombre: string) {
  const url = URL.createObjectURL(imagen);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nombre.replace(/[^\p{L}\p{N}\p{M}_-]+/gu, '-').replace(/^-+|-+$/g, '') || 'kotonoha'}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** El primer punto de una explicación de Claude, sin las marcas de Markdown: lo que cabe en una tarjeta. */
export function primerPunto(texto: string): string {
  const lineas = texto
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*\s][^*]*)\*/g, '$1').trim())
    .filter(Boolean);
  return lineas[0] ?? '';
}
