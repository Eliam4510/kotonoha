// Un PDF con el texto del OCR: encima de cada página, el texto leído en una capa invisible, en su sitio, como el «PDF con
// texto» de los programas de escaneo. Se puede buscar, seleccionar y copiar en cualquier lector de PDF, y la página se ve
// igual que antes. Sin navegador, para poder probarlo.
//
// El texto va con una fuente sin letras: cada carácter es un código de 16 bits (el de UTF-16) que la fuente dibuja con un
// glifo vacío, y el mapa ToUnicode dice qué carácter es. Así sirve cualquier carácter, sin meter una fuente japonesa
// entera, y el archivo apenas crece. Cada línea se estira con la matriz del texto hasta ocupar su caja, en horizontal o
// en vertical.
//
// Dos maneras de escribirlo: un PDF nuevo con las imágenes de un CBZ o un EPUB de imágenes, o una actualización al final
// de un PDF que ya existe, sin tocar nada de lo que tenía. Lo segundo deja sus imágenes tal cual (también las JBIG2 de un
// bit de los escaneos) y no obliga a tener el PDF entero dos veces en memoria.

import { zlibSync } from 'fflate';
import type { LineaOcr } from './ocr';

// ---------- La fuente sin letras ----------

export const NOMBRE_FUENTE = 'KotonohaOCR';
/** Unidades por em: cada carácter avanza un em, y la matriz del texto lo estira a lo que mide en la página. */
const EM = 1000;

/** Bytes en orden de red (el de TrueType). */
class Bytes {
  private partes: number[] = [];
  u8(v: number) {
    this.partes.push(v & 0xff);
    return this;
  }
  u16(v: number) {
    return this.u8(v >> 8).u8(v);
  }
  i16(v: number) {
    return this.u16(v & 0xffff);
  }
  u32(v: number) {
    return this.u16((v >>> 16) & 0xffff).u16(v & 0xffff);
  }
  ascii(s: string) {
    for (let i = 0; i < s.length; i++) this.u8(s.charCodeAt(i));
    return this;
  }
  utf16(s: string) {
    for (let i = 0; i < s.length; i++) this.u16(s.charCodeAt(i));
    return this;
  }
  ceros(n: number) {
    for (let i = 0; i < n; i++) this.u8(0);
    return this;
  }
  get bytes() {
    return Uint8Array.from(this.partes);
  }
}

/** La suma de control de TrueType: palabras de 32 bits, con ceros al final hasta completar la última. */
export function sumaDeControl(d: Uint8Array): number {
  let s = 0;
  for (let i = 0; i < d.length; i += 4) {
    const v = (((d[i] ?? 0) << 24) | ((d[i + 1] ?? 0) << 16) | ((d[i + 2] ?? 0) << 8) | (d[i + 3] ?? 0)) >>> 0;
    s = (s + v) >>> 0;
  }
  return s;
}

const tablaHead = () =>
  new Bytes()
    .u32(0x00010000)
    .u32(0x00010000)
    .u32(0) // checkSumAdjustment: se pone al final
    .u32(0x5f0f3cf5)
    .u16(0x000b)
    .u16(EM)
    .ceros(16) // creada y modificada
    .i16(0)
    .i16(0)
    .i16(EM)
    .i16(EM)
    .u16(0)
    .u16(3)
    .i16(2)
    .i16(0) // loca corta
    .i16(0).bytes;

const tablaHhea = () =>
  new Bytes().u32(0x00010000).i16(EM).i16(0).i16(0).u16(EM).i16(0).i16(0).i16(0).i16(1).i16(0).i16(0).ceros(8).i16(0).u16(2).bytes;

const tablaMaxp = () => new Bytes().u32(0x00010000).u16(2).u16(0).u16(0).u16(0).u16(0).u16(2).ceros(16).bytes;

/** Dos glifos, el obligatorio y el que dibuja todo: los dos vacíos y de un em de ancho. */
const tablaHmtx = () => new Bytes().u16(EM).i16(0).u16(EM).i16(0).bytes;
const tablaLoca = () => new Bytes().u16(0).u16(0).u16(0).bytes;

/** Un cmap que no asigna nada: con CIDToGIDMap no hace falta, pero los lectores estrictos lo piden. */
const tablaCmap = () =>
  new Bytes()
    .u16(0)
    .u16(1)
    .u16(3)
    .u16(1)
    .u32(12)
    // Formato 4 con solo el segmento final, obligatorio.
    .u16(4)
    .u16(24)
    .u16(0)
    .u16(2)
    .u16(2)
    .u16(0)
    .u16(0)
    .u16(0xffff)
    .u16(0)
    .u16(0xffff)
    .i16(1)
    .u16(0).bytes;

function tablaName(): Uint8Array {
  const textos: [number, string][] = [[1, NOMBRE_FUENTE], [2, 'Regular'], [3, NOMBRE_FUENTE], [4, NOMBRE_FUENTE], [5, 'Version 1.0'], [6, NOMBRE_FUENTE]];
  const b = new Bytes().u16(0).u16(textos.length).u16(6 + 12 * textos.length);
  let desde = 0;
  for (const [id, t] of textos) {
    b.u16(3).u16(1).u16(0x0409).u16(id).u16(t.length * 2).u16(desde);
    desde += t.length * 2;
  }
  for (const [, t] of textos) b.utf16(t);
  return b.bytes;
}

const tablaPost = () => new Bytes().u32(0x00030000).u32(0).i16(-100).i16(50).u32(1).ceros(16).bytes;

const tablaOs2 = () =>
  new Bytes()
    .u16(4)
    .i16(EM)
    .u16(400)
    .u16(5)
    .u16(0) // se puede incrustar
    .i16(650)
    .i16(600)
    .i16(0)
    .i16(75)
    .i16(650)
    .i16(600)
    .i16(0)
    .i16(350)
    .i16(50)
    .i16(300)
    .i16(0)
    .ceros(10) // panose
    .ceros(16) // rangos de Unicode
    .ascii('NONE')
    .u16(0x0040)
    .u16(0x20)
    .u16(0xffff)
    .i16(EM)
    .i16(0)
    .i16(0)
    .u16(EM)
    .u16(0)
    .ceros(8) // páginas de códigos
    .i16(500)
    .i16(700)
    .u16(0)
    .u16(0x20)
    .u16(1).bytes;

let fuenteHecha: Uint8Array | null = null;

/** Una fuente TrueType mínima cuyos glifos están vacíos: unos 600 bytes. */
export function fuenteSinLetras(): Uint8Array {
  if (fuenteHecha) return fuenteHecha;
  // En el orden de sus etiquetas, como pide el directorio.
  const tablas: [string, Uint8Array][] = [
    ['OS/2', tablaOs2()],
    ['cmap', tablaCmap()],
    ['glyf', new Uint8Array(0)],
    ['head', tablaHead()],
    ['hhea', tablaHhea()],
    ['hmtx', tablaHmtx()],
    ['loca', tablaLoca()],
    ['maxp', tablaMaxp()],
    ['name', tablaName()],
    ['post', tablaPost()],
  ];
  const n = tablas.length;
  let potencia = 1;
  let exponente = 0;
  while (potencia * 2 <= n) {
    potencia *= 2;
    exponente++;
  }
  const cabecera = new Bytes().u32(0x00010000).u16(n).u16(potencia * 16).u16(exponente).u16(n * 16 - potencia * 16).bytes;
  const directorio = new Bytes();
  let desde = 12 + 16 * n;
  const posiciones: number[] = [];
  for (const [etiqueta, datos] of tablas) {
    directorio.ascii(etiqueta).u32(sumaDeControl(datos)).u32(desde).u32(datos.length);
    posiciones.push(desde);
    desde += (datos.length + 3) & ~3;
  }
  const fuente = new Uint8Array(desde);
  fuente.set(cabecera, 0);
  fuente.set(directorio.bytes, 12);
  for (const [i, [, datos]] of tablas.entries()) fuente.set(datos, posiciones[i]);
  const head = posiciones[tablas.findIndex(([e]) => e === 'head')];
  new DataView(fuente.buffer).setUint32(head + 8, (0xb1b0afba - sumaDeControl(fuente)) >>> 0);
  fuenteHecha = fuente;
  return fuente;
}

/** Los códigos que se usan para los caracteres de fuera del plano básico: los de las mitades sustitutas de UTF-16. */
const PRIMER_PROPIO = 0xd800;
const ULTIMO_PROPIO = 0xdfff;
const hex4 = (v: number) => v.toString(16).padStart(4, '0').toUpperCase();

/**
 * Cada carácter, un código de 16 bits. Los del plano básico llevan su propio número; los de fuera (un emoji, un kanji
 * raro como 𠮟), uno libre de los que UTF-16 reserva a las mitades sustitutas, que solas no son caracteres. Partidos en
 * dos mitades, pdf.js los recomponía mal.
 */
export class Codificador {
  private propios = new Map<number, number>();

  /** El texto en hexadecimal y cuántos códigos lleva. */
  codificar(texto: string): { hex: string; n: number } {
    let hex = '';
    let n = 0;
    for (const c of texto) {
      const p = c.codePointAt(0)!;
      let cid = p;
      if (p > 0xffff || (p >= PRIMER_PROPIO && p <= ULTIMO_PROPIO)) {
        cid = this.propios.get(p) ?? PRIMER_PROPIO + this.propios.size;
        // Si se acabaran, el resto sale como el carácter de sustitución.
        if (cid > ULTIMO_PROPIO) cid = 0xfffd;
        else this.propios.set(p, cid);
      }
      hex += hex4(cid);
      n++;
    }
    return { hex, n };
  }

  /** Los caracteres propios, como pares de código y destino en UTF-16. */
  get asignados(): [number, string][] {
    return [...this.propios].map(([p, cid]) => [cid, aHex(String.fromCodePoint(p))]);
  }
}

/** Cada código es el carácter que se escribió: en bloques de 256, como pide la norma de los CMap, y los propios aparte. */
export function mapaUnicode(codificador = new Codificador()): string {
  const rangos: string[] = [];
  for (let alto = 0; alto < 256; alto++) {
    if (alto >= 0xd8 && alto <= 0xdf) continue;
    const h = alto.toString(16).padStart(2, '0').toUpperCase();
    rangos.push(`<${h}00> <${h}FF> <${h}00>`);
  }
  const bloques: string[] = [];
  for (let i = 0; i < rangos.length; i += 100) {
    const t = rangos.slice(i, i + 100);
    bloques.push(`${t.length} beginbfrange\n${t.join('\n')}\nendbfrange`);
  }
  const propios = codificador.asignados.map(([cid, destino]) => `<${hex4(cid)}> <${destino}>`);
  for (let i = 0; i < propios.length; i += 100) {
    const t = propios.slice(i, i + 100);
    bloques.push(`${t.length} beginbfchar\n${t.join('\n')}\nendbfchar`);
  }
  return [
    '/CIDInit /ProcSet findresource begin',
    '12 dict begin',
    'begincmap',
    '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def',
    '/CMapName /Adobe-Identity-UCS def',
    '/CMapType 2 def',
    '1 begincodespacerange',
    '<0000> <FFFF>',
    'endcodespacerange',
    ...bloques,
    'endcmap',
    'CMapName currentdict /CMap defineresource pop',
    'end',
    'end',
  ].join('\n');
}

/** Todos los códigos van al glifo 1, el vacío. */
export function mapaDeGlifos(): Uint8Array {
  const m = new Uint8Array(65536 * 2);
  for (let i = 1; i < m.length; i += 2) m[i] = 1;
  return m;
}

// ---------- Objetos del PDF ----------

/** Un objeto del PDF: su diccionario (o lo que sea) y, si es un flujo, sus bytes, ya comprimidos si lo dice el diccionario. */
export interface ObjetoPdf {
  num: number;
  gen?: number;
  /** Sin /Length: lo pone el escritor. */
  cuerpo: string | Uint8Array;
  flujo?: Uint8Array;
}

export const ref = (num: number, gen = 0) => `${num} ${gen} R`;

/** Los seis objetos de la fuente, con los números que se les den. El primero es el que se nombra en los recursos. */
export function objetosDeLaFuente(n: { tipo0: number; cid: number; descriptor: number; archivo: number; unicode: number; mapa: number }, codificador?: Codificador): ObjetoPdf[] {
  const fuente = fuenteSinLetras();
  return [
    { num: n.tipo0, cuerpo: `<< /Type /Font /Subtype /Type0 /BaseFont /${NOMBRE_FUENTE} /Encoding /Identity-H /DescendantFonts [${ref(n.cid)}] /ToUnicode ${ref(n.unicode)} >>` },
    {
      num: n.cid,
      cuerpo: `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${NOMBRE_FUENTE} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${ref(n.descriptor)} /DW ${EM} /CIDToGIDMap ${ref(n.mapa)} >>`,
    },
    {
      num: n.descriptor,
      cuerpo: `<< /Type /FontDescriptor /FontName /${NOMBRE_FUENTE} /Flags 5 /FontBBox [0 0 ${EM} ${EM}] /ItalicAngle 0 /Ascent ${EM} /Descent 0 /CapHeight ${EM} /StemV 80 /FontFile2 ${ref(n.archivo)} >>`,
    },
    { num: n.archivo, cuerpo: `<< /Length1 ${fuente.length} /Filter /FlateDecode >>`, flujo: zlibSync(fuente) },
    { num: n.unicode, cuerpo: '<< /Filter /FlateDecode >>', flujo: zlibSync(new TextEncoder().encode(mapaUnicode(codificador))) },
    { num: n.mapa, cuerpo: '<< /Filter /FlateDecode >>', flujo: zlibSync(mapaDeGlifos()) },
  ];
}

// ---------- La capa de texto de una página ----------

/** Pasa un punto de la página tal como se ve (en fracciones, con el origen arriba a la izquierda) al espacio del PDF. */
export type Transformador = (fx: number, fy: number) => [number, number];

/**
 * El de una página de un PDF, con su caja visible ([x0, y0, x1, y1], la que pdf.js llama view) y su giro: lo contrario de
 * lo que hace el visor de pdf.js al pintarla, que es donde se leyó el OCR.
 */
export function transformadorDePagina(vista: [number, number, number, number], giro: number): Transformador {
  const [x0, y0, x1, y1] = vista;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const r = (((Math.round(giro / 90) * 90) % 360) + 360) % 360;
  let [a, b, c, d] = [1, 0, 0, -1];
  if (r === 90) [a, b, c, d] = [0, 1, 1, 0];
  else if (r === 180) [a, b, c, d] = [-1, 0, 0, 1];
  else if (r === 270) [a, b, c, d] = [0, -1, -1, 0];
  const girada = a === 0;
  const ox = girada ? Math.abs(cy - y0) : Math.abs(cx - x0);
  const oy = girada ? Math.abs(cx - x0) : Math.abs(cy - y0);
  const ancho = girada ? y1 - y0 : x1 - x0;
  const alto = girada ? x1 - x0 : y1 - y0;
  const e = ox - a * cx - c * cy;
  const f = oy - b * cx - d * cy;
  const det = a * d - b * c;
  return (fx, fy) => {
    const X = fx * ancho - e;
    const Y = fy * alto - f;
    return [(d * X - c * Y) / det, (-b * X + a * Y) / det];
  };
}

/** El de una página nueva hecha con una imagen, de ancho por alto puntos y sin girar. */
export const transformadorDeImagen = (ancho: number, alto: number): Transformador => (fx, fy) => [fx * ancho, (1 - fy) * alto];

/** Una línea ya en el espacio del PDF: dónde empieza, hacia dónde avanza toda ella y hacia dónde queda arriba. */
export interface LineaEnPdf {
  texto: string;
  origen: [number, number];
  avance: [number, number];
  arriba: [number, number];
}

const SIN_CONTROL = /[\u0000-\u001f\u007f]/g;
const resta = (p: [number, number], q: [number, number]): [number, number] => [p[0] - q[0], p[1] - q[1]];

/**
 * Dónde va una línea del OCR. En horizontal, su caja de izquierda a derecha con la base abajo; en vertical, de arriba
 * abajo, con las letras giradas de modo que su parte de arriba mira a la derecha, como hacen los programas de OCR con el
 * japonés vertical: así la selección sigue a la columna.
 */
export function lineaEnPdf(l: Pick<LineaOcr, 'caja' | 'texto' | 'vertical'>, t: Transformador): LineaEnPdf | null {
  const texto = l.texto.replace(SIN_CONTROL, ' ').trim();
  const { x0, y0, x1, y1 } = l.caja;
  if (!texto || !(x1 > x0) || !(y1 > y0)) return null;
  if (l.vertical) {
    const origen = t(x0, y0);
    return { texto, origen, avance: resta(t(x0, y1), origen), arriba: resta(t(x1, y0), origen) };
  }
  const origen = t(x0, y1);
  return { texto, origen, avance: resta(t(x1, y1), origen), arriba: resta(t(x0, y0), origen) };
}

/** Números cortos y sin notación científica, que un PDF no entiende. */
const num = (v: number) => {
  const r = Math.round(v * 10000) / 10000;
  return Object.is(r, -0) ? '0' : String(r);
};

/** El texto como códigos de 16 bits en hexadecimal: los de UTF-16, uno por cada unidad. */
export const aHex = (texto: string) => Array.from({ length: texto.length }, (_, i) => texto.charCodeAt(i).toString(16).padStart(4, '0')).join('').toUpperCase();

/**
 * Las órdenes de la capa de texto: texto invisible (modo 3), con la fuente a tamaño 1 y cada línea estirada por su matriz
 * hasta ocupar su caja. Vacía si no hay nada que escribir.
 */
export function capaDeTexto(lineas: LineaEnPdf[], fuente: string, codificador: Codificador): string {
  if (!lineas.length) return '';
  const ordenes = ['BT', '3 Tr', `/${fuente} 1 Tf`];
  for (const l of lineas) {
    const { hex, n } = codificador.codificar(l.texto);
    ordenes.push(`${num(l.avance[0] / n)} ${num(l.avance[1] / n)} ${num(l.arriba[0])} ${num(l.arriba[1])} ${num(l.origen[0])} ${num(l.origen[1])} Tm`, `<${hex}> Tj`);
  }
  ordenes.push('ET');
  return ordenes.join('\n');
}

/** Un texto para el diccionario de información (el título): en UTF-16 con su marca, que vale para cualquier lengua. */
export const textoPdf = (s: string) => `<FEFF${aHex(s)}>`;

// ---------- Escribir ----------

const codificar = (s: string) => new TextEncoder().encode(s);

/** Las partes de un objeto, con su /Length si es un flujo (al final de su diccionario, que siempre acaba en «>>»). */
function partesDe(o: ObjetoPdf): Uint8Array[] {
  const cabeza = codificar(`${o.num} ${o.gen ?? 0} obj\n`);
  if (!o.flujo) return [cabeza, typeof o.cuerpo === 'string' ? codificar(o.cuerpo) : o.cuerpo, codificar('\nendobj\n')];
  if (typeof o.cuerpo !== 'string' || !o.cuerpo.trimEnd().endsWith('>>')) throw new Error(`El flujo ${o.num} necesita un diccionario`);
  const dic = `${o.cuerpo.trimEnd().slice(0, -2).trimEnd()} /Length ${o.flujo.length} >>`;
  return [cabeza, codificar(`${dic}\nstream\n`), o.flujo, codificar('\nendstream\nendobj\n')];
}

/** Una entrada de la tabla de referencias: número, generación, posición y si está libre (el objeto 0). */
type EntradaXref = [number, number, number, boolean?];

/** Una tabla de referencias clásica, en subsecciones de números seguidos. Cada entrada mide 20 bytes justos. */
function tablaXref(entradas: EntradaXref[]): string {
  const orden = [...entradas].sort((a, b) => a[0] - b[0]);
  const lineas: string[] = ['xref'];
  for (let i = 0; i < orden.length; ) {
    let j = i;
    while (j + 1 < orden.length && orden[j + 1][0] === orden[j][0] + 1) j++;
    lineas.push(`${orden[i][0]} ${j - i + 1}`);
    for (let k = i; k <= j; k++) lineas.push(`${String(orden[k][2]).padStart(10, '0')} ${String(orden[k][1]).padStart(5, '0')} ${orden[k][3] ? 'f' : 'n'}\r`);
    i = j + 1;
  }
  return `${lineas.join('\n')}\n`;
}

/**
 * Escribe objetos uno tras otro y apunta dónde empieza cada uno. Las partes grandes se pasan cada poco a un Blob: el
 * navegador las guarda fuera de la página (y en disco si hace falta), y la memoria de la página no crece con el libro.
 */
export class EscritorPdf {
  private partes: BlobPart[] = [];
  private enMemoria = 0;
  private escrito = 0;
  /** Número del objeto → [generación, posición desde el principio del archivo]. */
  readonly posiciones = new Map<number, [number, number]>();

  /** `base`: lo que ya ocupa el archivo antes de lo que se escribe aquí (en una actualización, el PDF original). */
  constructor(private readonly base = 0) {}

  get posicion() {
    return this.base + this.escrito;
  }

  escribir(p: string | Uint8Array) {
    const b = typeof p === 'string' ? codificar(p) : p;
    this.partes.push(b as BlobPart);
    this.escrito += b.length;
    this.enMemoria += b.length;
    if (this.enMemoria > 32 * 1024 * 1024) this.soltar();
  }

  objeto(o: ObjetoPdf) {
    this.posiciones.set(o.num, [o.gen ?? 0, this.posicion]);
    for (const p of partesDe(o)) this.escribir(p);
  }

  private soltar() {
    this.partes = [new Blob(this.partes)];
    this.enMemoria = 0;
  }

  /** Lo escrito, como un Blob. */
  blob(tipo = 'application/pdf') {
    return new Blob(this.partes, { type: tipo });
  }

  /** La tabla de referencias y el trailer del final. `trailer`: lo que va en él, sin /Size ni /Prev. */
  terminarConTabla(trailer: string, tamano: number, prev?: number) {
    const entradas: EntradaXref[] = [...this.posiciones].map(([n, [g, p]]) => [n, g, p]);
    // En un archivo nuevo, la tabla empieza por el objeto 0, libre.
    if (prev === undefined) entradas.push([0, 65535, 0, true]);
    const xref = this.posicion;
    this.escribir(tablaXref(entradas));
    this.escribir(`trailer\n<< /Size ${tamano}${prev !== undefined ? ` /Prev ${prev}` : ''} ${trailer} >>\nstartxref\n${xref}\n%%EOF\n`);
  }

  /** Lo mismo con un flujo de referencias (PDF 1.5), para actualizar un PDF que ya las usa. */
  terminarConFlujo(trailer: string, tamano: number, numXref: number, prev: number) {
    const xref = this.posicion;
    const entradas = [...this.posiciones].map(([n, [g, p]]) => [n, g, p] as [number, number, number]);
    entradas.push([numXref, 0, xref]);
    entradas.sort((a, b) => a[0] - b[0]);
    const indice: number[] = [];
    for (let i = 0; i < entradas.length; ) {
      let j = i;
      while (j + 1 < entradas.length && entradas[j + 1][0] === entradas[j][0] + 1) j++;
      indice.push(entradas[i][0], j - i + 1);
      i = j + 1;
    }
    const datos = new Uint8Array(entradas.length * 7);
    const d = new DataView(datos.buffer);
    entradas.forEach(([, g, p], i) => {
      d.setUint8(i * 7, 1);
      d.setUint32(i * 7 + 1, p);
      d.setUint16(i * 7 + 5, g);
    });
    this.objeto({
      num: numXref,
      cuerpo: `<< /Type /XRef /Size ${Math.max(tamano, numXref + 1)} /Index [${indice.join(' ')}] /W [1 4 2] /Prev ${prev} ${trailer} /Filter /FlateDecode >>`,
      flujo: zlibSync(datos),
    });
    this.escribir(`startxref\n${xref}\n%%EOF\n`);
  }
}

// ---------- Un PDF nuevo con las imágenes de un libro ----------

/** Una imagen lista para el PDF: un JPEG tal cual (DCTDecode) o píxeles comprimidos con Flate. */
export interface ImagenPdf {
  flujo: Uint8Array;
  filtro: 'DCTDecode' | 'FlateDecode';
  espacio: 'DeviceGray' | 'DeviceRGB' | 'DeviceCMYK';
  /** En píxeles. */
  ancho: number;
  alto: number;
  /** Los JPEG CMYK de Adobe guardan los valores invertidos. */
  invertida?: boolean;
}

/** El tamaño de la página en puntos: la imagen a sus puntos por pulgada, o a 150 si no los dice o son raros. */
export function tamanoDePagina(ancho: number, alto: number, ppp?: number): [number, number] {
  const p = ppp && ppp >= 72 && ppp <= 1200 ? ppp : 150;
  return [(ancho * 72) / p, (alto * 72) / p];
}

/** El orden de los objetos: el catálogo, las páginas, la información y la fuente; luego, tres por página. */
const CATALOGO = 1;
const PAGINAS = 2;
const INFORMACION = 3;
const FUENTE = { tipo0: 4, cid: 5, descriptor: 6, archivo: 7, unicode: 8, mapa: 9 };
const primeraDe = (i: number) => 10 + 3 * i;

/**
 * Un PDF nuevo, una página por imagen, cada una con su capa de texto. Las páginas se añaden en orden, una a una; lo ya
 * escrito se va guardando en un Blob, así que un tomo entero no se queda en la memoria de la página.
 */
export class PdfDeImagenes {
  private readonly escritor = new EscritorPdf();
  private readonly codificador = new Codificador();
  private hechas = 0;

  constructor(
    private readonly total: number,
    private readonly opciones: { titulo: string; lengua?: string; derechaAIzquierda?: boolean; productor?: string } = { titulo: '' }
  ) {
    this.escritor.escribir('%PDF-1.7\n');
    // Un comentario con bytes altos tras la cabecera, como recomienda la norma, para que se trate como binario.
    this.escritor.escribir(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  }

  /** Añade la página siguiente: su imagen, sus líneas del OCR (en fracciones de la imagen) y sus puntos por pulgada. */
  pagina(imagen: ImagenPdf, lineas: Pick<LineaOcr, 'caja' | 'texto' | 'vertical'>[], ppp?: number) {
    if (this.hechas >= this.total) throw new Error('Sobran páginas');
    const n = primeraDe(this.hechas++);
    const [ancho, alto] = tamanoDePagina(imagen.ancho, imagen.alto, ppp);
    const t = transformadorDeImagen(ancho, alto);
    const texto = capaDeTexto(lineas.map((l) => lineaEnPdf(l, t)).filter((l): l is LineaEnPdf => !!l), 'KkOcr', this.codificador);
    const decode = imagen.invertida ? ' /Decode [1 0 1 0 1 0 1 0]' : '';
    this.escritor.objeto({
      num: n + 2,
      cuerpo: `<< /Type /XObject /Subtype /Image /Width ${imagen.ancho} /Height ${imagen.alto} /ColorSpace /${imagen.espacio} /BitsPerComponent 8 /Filter /${imagen.filtro}${decode} >>`,
      flujo: imagen.flujo,
    });
    const ordenes = `q ${num(ancho)} 0 0 ${num(alto)} 0 0 cm /Im0 Do Q\n${texto}\n`;
    this.escritor.objeto({ num: n + 1, cuerpo: '<< /Filter /FlateDecode >>', flujo: zlibSync(codificar(ordenes)) });
    this.escritor.objeto({
      num: n,
      cuerpo: `<< /Type /Page /Parent ${ref(PAGINAS)} /MediaBox [0 0 ${num(ancho)} ${num(alto)}] /Resources << /XObject << /Im0 ${ref(n + 2)} >> /Font << /KkOcr ${ref(FUENTE.tipo0)} >> >> /Contents ${ref(n + 1)} >>`,
    });
  }

  /** Cierra el PDF: el árbol de páginas, el catálogo, la información y la tabla de referencias. */
  terminar(): Blob {
    // La fuente al final: su mapa a Unicode lleva los caracteres propios de todo el libro.
    for (const o of objetosDeLaFuente(FUENTE, this.codificador)) this.escritor.objeto(o);
    const kids = Array.from({ length: this.hechas }, (_, i) => ref(primeraDe(i))).join(' ');
    this.escritor.objeto({ num: PAGINAS, cuerpo: `<< /Type /Pages /Kids [${kids}] /Count ${this.hechas} >>` });
    const { titulo, lengua, derechaAIzquierda, productor = 'Kotonoha' } = this.opciones;
    const extra = `${lengua ? ` /Lang (${lengua.replace(/[^\w-]/g, '')})` : ''}${derechaAIzquierda ? ' /ViewerPreferences << /Direction /R2L >>' : ''}`;
    this.escritor.objeto({ num: CATALOGO, cuerpo: `<< /Type /Catalog /Pages ${ref(PAGINAS)}${extra} >>` });
    this.escritor.objeto({ num: INFORMACION, cuerpo: `<< /Title ${textoPdf(titulo)} /Producer ${textoPdf(productor)} /Creator ${textoPdf(productor)} >>` });
    const id = aHex(String(Date.now()) + titulo).slice(0, 32).padEnd(32, '0');
    this.escritor.terminarConTabla(`/Root ${ref(CATALOGO)} /Info ${ref(INFORMACION)} /ID [<${id}> <${id}>]`, primeraDe(this.hechas));
    return this.escritor.blob();
  }
}

/** Dónde empieza la última tabla de referencias de un PDF, por lo que dice su final. */
export function ultimaReferencia(cola: string): number | null {
  const m = [...cola.matchAll(/startxref\s+(\d+)/g)].at(-1);
  return m ? Number(m[1]) : null;
}
