// El texto del OCR añadido a un PDF que ya existe, en una actualización al final del archivo: los objetos nuevos (la
// fuente y la capa de texto de cada página) y las páginas cambiadas van detrás de lo que había, con su propia tabla de
// referencias que apunta a la anterior. Lo de antes no se toca: las imágenes del escaneo quedan idénticas, y el archivo
// solo crece lo que ocupa el texto. pdf-lib se usa solo para leer el PDF y saber qué hay en cada página.

import { zlibSync } from 'fflate';
import { EncryptedPDFError, PDFArray, PDFDict, PDFDocument, PDFName, PDFRef, type PDFPage } from 'pdf-lib';
import type { LineaOcr } from './ocr';
import { capaDeTexto, Codificador, EscritorPdf, type LineaEnPdf, lineaEnPdf, type ObjetoPdf, objetosDeLaFuente, transformadorDePagina, ultimaReferencia } from './pdfConTexto';

/**
 * El PDF está cifrado: no se le puede añadir nada sin su contraseña. Los errores se reconocen por su nombre: este módulo se
 * carga aparte (pdfTexto.js), y sus clases no son las mismas que vería quien lo importa.
 */
export class PdfProtegido extends Error {
  override name = 'PdfProtegido';
}
/** El PDF no dice dónde está su tabla de referencias: está dañado. */
export class PdfDanado extends Error {
  override name = 'PdfDanado';
}

type Lineas = Pick<LineaOcr, 'caja' | 'texto' | 'vertical'>[];

export interface ResultadoActualizacion {
  blob: Blob;
  paginas: number;
  /** Las páginas a las que se les puso texto. */
  conTexto: number;
}

const codificar = (s: string) => new TextEncoder().encode(s);

/** La caja visible de una página, como la calcula pdf.js (donde se leyó el OCR): la de recorte dentro de la del papel. */
export function vistaDe(p: Pick<PDFPage, 'getMediaBox' | 'getCropBox'>): [number, number, number, number] {
  const norma = (b: { x: number; y: number; width: number; height: number }): [number, number, number, number] => [
    Math.min(b.x, b.x + b.width),
    Math.min(b.y, b.y + b.height),
    Math.max(b.x, b.x + b.width),
    Math.max(b.y, b.y + b.height),
  ];
  const m = norma(p.getMediaBox());
  const c = norma(p.getCropBox());
  const v: [number, number, number, number] = [Math.max(m[0], c[0]), Math.max(m[1], c[1]), Math.min(m[2], c[2]), Math.min(m[3], c[3])];
  return v[2] > v[0] && v[3] > v[1] ? v : m;
}

/** El giro de una página como lo toma pdf.js: un giro que no es de 90 en 90 no cuenta. */
const giroDe = (angulo: number) => (angulo % 90 === 0 ? ((angulo % 360) + 360) % 360 : 0);

/** Las primeras letras que hay a partir de una posición, para saber qué empieza allí. */
const principio = (b: Uint8Array, desde: number, n = 32) => new TextDecoder('latin1').decode(b.subarray(desde, desde + n)).trimStart();

/**
 * Cuántos números de objeto usa ya el PDF, por el /Size de su última tabla: el diccionario del flujo de referencias, o el
 * trailer que sigue a la tabla clásica. pdf-lib no cuenta los objetos que solo guardan otros (los flujos de objetos y el
 * de referencias): con su cuenta, un objeto nuevo podía quedarse el número del flujo donde está el catálogo.
 */
export function tamanoDeclarado(b: Uint8Array, desde: number, conFlujo: boolean): number {
  const trozo = new TextDecoder('latin1').decode(b.subarray(desde, Math.min(b.length, desde + 8 * 1024 * 1024)));
  const dic = conFlujo ? trozo.slice(0, trozo.indexOf('stream') > 0 ? trozo.indexOf('stream') : 4096) : trozo.slice(Math.max(0, trozo.indexOf('trailer')));
  const m = /\/Size\s+(\d+)/.exec(dic);
  return m ? Number(m[1]) : 0;
}

/**
 * Añade a un PDF el texto de sus páginas. `lineasDe(n)` da las líneas del OCR de la página n (en fracciones de la página
 * tal como se ve), o null si no tiene; las páginas sin líneas no se tocan.
 */
export async function actualizarConTexto(
  original: Blob,
  lineasDe: (n: number) => Promise<Lineas | null>,
  alAvanzar?: (hechas: number, total: number) => void,
  senal?: AbortSignal
): Promise<ResultadoActualizacion> {
  const bytes = new Uint8Array(await original.arrayBuffer());
  const prev = ultimaReferencia(new TextDecoder('latin1').decode(bytes.subarray(Math.max(0, bytes.length - 4096))));
  if (prev === null || prev >= bytes.length) throw new PdfDanado();
  // La actualización usa el mismo tipo de tabla que la última del archivo: la clásica o un flujo de referencias.
  const conFlujo = !principio(bytes, prev).startsWith('xref');
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { updateMetadata: false, throwOnInvalidObject: false });
  } catch (e) {
    if (e instanceof EncryptedPDFError) throw new PdfProtegido();
    throw e;
  }
  const ctx = doc.context;
  if (ctx.trailerInfo.Encrypt) throw new PdfProtegido();
  const raiz = ctx.trailerInfo.Root;
  if (!raiz) throw new PdfDanado();
  // Los números nuevos, a partir del primero que no use nadie.
  ctx.largestObjectNumber = Math.max(ctx.largestObjectNumber, tamanoDeclarado(bytes, prev, conFlujo) - 1);

  const nuevo = () => ctx.nextRef().objectNumber;
  const fuente = { tipo0: nuevo(), cid: nuevo(), descriptor: nuevo(), archivo: nuevo(), unicode: nuevo(), mapa: nuevo() };
  const codificador = new Codificador();
  const objetos: ObjetoPdf[] = [];
  // Lo que pinta cada página queda entre q y Q: así lo que deje cambiado (la escala, el color) no mueve el texto.
  const guardar = nuevo();
  objetos.push({ num: guardar, cuerpo: '<< >>', flujo: codificar('q\n') });

  const paginas = doc.getPages();
  let conTexto = 0;
  for (const [n, pagina] of paginas.entries()) {
    if (senal?.aborted) throw new DOMException('Cancelado', 'AbortError');
    alAvanzar?.(n, paginas.length);
    const lineas = await lineasDe(n);
    if (!lineas?.length) continue;
    const t = transformadorDePagina(vistaDe(pagina), giroDe(pagina.getRotation().angle));
    const enPdf = lineas.map((l) => lineaEnPdf(l, t)).filter((l): l is LineaEnPdf => !!l);
    if (!enPdf.length) continue;

    const hoja = pagina.node;
    // Sus recursos, aunque los herede del árbol de páginas, con la fuente añadida bajo un nombre que no use.
    const heredados = hoja.getInheritableAttribute(PDFName.of('Resources'));
    const recursos = (heredados ? ctx.lookupMaybe(heredados, PDFDict) : undefined)?.clone(ctx) ?? ctx.obj({});
    const fuentesDe = recursos.get(PDFName.of('Font'));
    const fuentes = (fuentesDe ? ctx.lookupMaybe(fuentesDe, PDFDict) : undefined)?.clone(ctx) ?? ctx.obj({});
    let nombre = 'KkOcr';
    for (let i = 1; fuentes.has(PDFName.of(nombre)); i++) nombre = `KkOcr${i}`;
    fuentes.set(PDFName.of(nombre), PDFRef.of(fuente.tipo0));
    recursos.set(PDFName.of('Font'), fuentes);
    hoja.set(PDFName.of('Resources'), recursos);

    const capa = nuevo();
    objetos.push({ num: capa, cuerpo: '<< /Filter /FlateDecode >>', flujo: zlibSync(codificar(`Q\n${capaDeTexto(enPdf, nombre, codificador)}\n`)) });
    const contenido = hoja.get(PDFName.of('Contents'));
    const resuelto = contenido instanceof PDFRef ? ctx.lookup(contenido) : contenido;
    const antes = resuelto instanceof PDFArray ? resuelto.asArray() : contenido ? [contenido] : [];
    hoja.set(PDFName.of('Contents'), ctx.obj([PDFRef.of(guardar), ...antes, PDFRef.of(capa)]));

    const dic = new Uint8Array(hoja.sizeInBytes());
    hoja.copyBytesInto(dic, 0);
    objetos.push({ num: pagina.ref.objectNumber, gen: pagina.ref.generationNumber, cuerpo: dic });
    conTexto++;
  }
  alAvanzar?.(paginas.length, paginas.length);
  // La fuente, con los caracteres propios de todas las páginas en su mapa a Unicode.
  objetos.unshift(...objetosDeLaFuente(fuente, codificador));

  const escritor = new EscritorPdf(bytes.length);
  // Por si el archivo no acaba en un salto de línea: el primer objeto nuevo debe empezar en una línea propia.
  escritor.escribir('\n');
  for (const o of objetos) escritor.objeto(o);
  const trailer = [`/Root ${raiz.toString()}`, ctx.trailerInfo.Info ? `/Info ${ctx.trailerInfo.Info.toString()}` : '', ctx.trailerInfo.ID ? `/ID ${ctx.trailerInfo.ID.toString()}` : ''].filter(Boolean).join(' ');
  if (conFlujo) {
    const xref = nuevo();
    escritor.terminarConFlujo(trailer, ctx.largestObjectNumber + 1, xref, prev);
  } else escritor.terminarConTabla(trailer, ctx.largestObjectNumber + 1, prev);
  return { blob: new Blob([original, escritor.blob()], { type: 'application/pdf' }), paginas: paginas.length, conTexto };
}
