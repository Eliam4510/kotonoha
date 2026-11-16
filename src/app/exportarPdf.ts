// Un libro de la Biblioteca como PDF con el texto del OCR, para buscar, seleccionar y copiar en cualquier lector. Un PDF
// recibe el texto al final del archivo, sin tocar sus páginas; un CBZ o un EPUB de imágenes se convierte en un PDF nuevo,
// con cada imagen tal cual si es un JPEG. El texto es el leído con el OCR, con lo editado a mano encima, como en la vista
// de texto del visor.

import { zlibSync } from 'fflate';
import { archivoDocumento } from '../compartido/documentos';
import { tr } from '../compartido/i18n';
import { baseOcr, claveOcr, edicionesDe, lecturaMinima } from '../compartido/paginasOcr';
import { versionInstalada } from '../compartido/proyecto';
import type { ElementoBiblioteca } from '../compartido/tipos';
import { aplicarEdiciones, type EdicionLinea } from '../nucleo/ediciones';
import { cabeceraJpeg, tipoDeImagen } from '../nucleo/imagenes';
import { leerLibro } from '../nucleo/libro';
import type { LineaOcr } from '../nucleo/ocr';
import { type ImagenPdf, PdfDeImagenes } from '../nucleo/pdfConTexto';
import { fuenteDeArchivo, leerEntrada } from '../nucleo/zip';
import { lengua } from '../ui/lengua';
import { modoDeLectura } from '../visor/ocr';
import { modoDe } from '../visor/procesador';
import { SinArchivo } from './textoDeLibro';

/**
 * La parte que usa pdf-lib va en su propio módulo (pdfTexto.js, ver build.mjs): pesa y solo hace falta al exportar un PDF,
 * así que la ventana no la carga cada vez que se abre.
 */
type ModuloPdf = typeof import('../nucleo/pdfActualizar');
let moduloPdf: Promise<ModuloPdf> | null = null;
const cargarModuloPdf = () => (moduloPdf ??= import(chrome.runtime.getURL('pdfTexto.js')) as Promise<ModuloPdf>);

export interface PdfExportado {
  blob: Blob;
  nombre: string;
  paginas: number;
  /** Las páginas que llevan texto del OCR. */
  conTexto: number;
}

/** Si se puede exportar: los libros de páginas, que son los que se leen con el OCR. */
export const sePuedeExportar = (e: ElementoBiblioteca) => !!e.documento && !e.documento.texto;

/** Un nombre de archivo válido en cualquier sistema, a partir del título. */
export const nombreDelPdf = (titulo: string) => `${titulo.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150) || 'Kotonoha'} (OCR).pdf`;

/**
 * Las líneas de cada página leídas con el OCR, con lo editado a mano encima; null si la página no se ha leído. Vale lo
 * leído en cualquier modo, y de cada página, la lectura con más texto: el modo depende de la lengua que se estudia (un
 * manga se lee como cómic si se estudia inglés), y un manga japonés exportado con el inglés puesto salía casi sin texto,
 * con las páginas que se habían leído como cómic, casi vacías.
 */
async function lineasDelLibro(e: ElementoBiblioteca): Promise<(n: number) => Promise<LineaOcr[] | null>> {
  const d = e.documento!;
  const modos = [...new Set([modoDeLectura(modoDe(d)), modoDe(d), d.procesado?.modo, 'manga', 'comic', 'libro'].filter((m): m is string => !!m))];
  const minima = lecturaMinima(d.formato);
  const porPagina = new Map<number, EdicionLinea[]>();
  for (const x of await edicionesDe(e.id).catch(() => [] as EdicionLinea[])) porPagina.set(x.pagina, [...(porPagina.get(x.pagina) ?? []), x]);
  return async (n) => {
    let guardada = null;
    let mejor = -1;
    for (const modo of modos) {
      const g = await baseOcr().paginas.get(claveOcr(e.id, modo, n));
      if (!g || (g.lectura ?? 0) < minima) continue;
      const letras = g.lineas.reduce((s, l) => s + l.texto.trim().length, 0);
      if (letras > mejor) {
        guardada = g;
        mejor = letras;
      }
    }
    if (!guardada) return null;
    const suyas = porPagina.get(n);
    return suyas ? aplicarEdiciones(guardada.lineas, suyas) : guardada.lineas;
  };
}

/** Una imagen de un libro, lista para el PDF: un JPEG corriente tal cual; cualquier otra, con sus píxeles sin perder nada. */
async function imagenParaPdf(bytes: Uint8Array, tipo: string): Promise<{ imagen: ImagenPdf; ppp?: number }> {
  const jpeg = cabeceraJpeg(bytes);
  if (jpeg?.comun && [1, 3, 4].includes(jpeg.componentes)) {
    const espacio = jpeg.componentes === 1 ? 'DeviceGray' : jpeg.componentes === 4 ? 'DeviceCMYK' : 'DeviceRGB';
    return { imagen: { flujo: bytes, filtro: 'DCTDecode', espacio, ancho: jpeg.ancho, alto: jpeg.alto, invertida: jpeg.componentes === 4 && jpeg.adobe }, ppp: jpeg.ppp };
  }
  const mapa = await createImageBitmap(new Blob([bytes as BlobPart], { type: tipo }));
  const lienzo = new OffscreenCanvas(mapa.width, mapa.height);
  const c = lienzo.getContext('2d')!;
  // Lo transparente, sobre blanco, como se ve en el visor.
  c.fillStyle = '#fff';
  c.fillRect(0, 0, mapa.width, mapa.height);
  c.drawImage(mapa, 0, 0);
  mapa.close();
  const { data } = c.getImageData(0, 0, lienzo.width, lienzo.height);
  const n = lienzo.width * lienzo.height;
  // Una página en blanco y negro (casi todas las de manga) ocupa un tercio en gris.
  let gris = true;
  for (let i = 0; i < n && gris; i++) gris = Math.abs(data[i * 4] - data[i * 4 + 1]) <= 2 && Math.abs(data[i * 4 + 1] - data[i * 4 + 2]) <= 2;
  const crudo = new Uint8Array(gris ? n : n * 3);
  for (let i = 0; i < n; i++) {
    if (gris) crudo[i] = data[i * 4];
    else crudo.set(data.subarray(i * 4, i * 4 + 3), i * 3);
  }
  return { imagen: { flujo: zlibSync(crudo, { level: 6 }), filtro: 'FlateDecode', espacio: gris ? 'DeviceGray' : 'DeviceRGB', ancho: lienzo.width, alto: lienzo.height } };
}

/** Un CBZ o un EPUB de imágenes como PDF nuevo, página a página. */
async function deImagenes(e: ElementoBiblioteca, archivo: File, lineasDe: (n: number) => Promise<LineaOcr[] | null>, alAvanzar: (hechas: number, total: number) => void, senal: AbortSignal): Promise<Omit<PdfExportado, 'nombre'>> {
  const d = e.documento!;
  const f = fuenteDeArchivo(archivo);
  const { libro, indice } = await leerLibro(f, `${e.titulo}.${d.formato}`, d.direccion);
  if (!libro) throw new Error(tr('Este EPUB es de texto: ya se puede buscar y copiar, sin OCR.'));
  const total = libro.paginas.length;
  const pdf = new PdfDeImagenes(total, { titulo: e.titulo, lengua: lengua.value.id, derechaAIzquierda: d.direccion === 'rtl', productor: `Kotonoha ${versionInstalada()}` });
  let conTexto = 0;
  for (const [n, ruta] of libro.paginas.entries()) {
    if (senal.aborted) throw new DOMException('Cancelado', 'AbortError');
    alAvanzar(n, total);
    const entrada = indice.get(ruta);
    if (!entrada) throw new Error(tr('Falta la imagen de la página {0}', n + 1));
    const { imagen, ppp } = await imagenParaPdf(await leerEntrada(f, entrada), tipoDeImagen(ruta));
    const lineas = (await lineasDe(n)) ?? [];
    if (lineas.some((l) => l.texto.trim())) conTexto++;
    pdf.pagina(imagen, lineas, ppp);
  }
  alAvanzar(total, total);
  return { blob: pdf.terminar(), paginas: total, conTexto };
}

/** El libro como PDF con su texto. `alAvanzar` cuenta páginas; cancelar con `senal` lo para entre una y otra. */
export async function exportarPdf(e: ElementoBiblioteca, alAvanzar: (hechas: number, total: number) => void, senal: AbortSignal): Promise<PdfExportado> {
  const d = e.documento;
  if (!d || d.texto) throw new Error(tr('Solo los libros de páginas se leen con el OCR.'));
  const archivo = await archivoDocumento(e.id);
  if (!archivo) throw new SinArchivo(e.titulo);
  const lineasDe = await lineasDelLibro(e);
  const r = d.formato === 'pdf' ? await (await cargarModuloPdf()).actualizarConTexto(archivo, lineasDe, alAvanzar, senal) : await deImagenes(e, archivo, lineasDe, alAvanzar, senal);
  return { ...r, nombre: nombreDelPdf(e.titulo) };
}

/** Lo que se le dice a quien exporta cuando algo sale mal. */
export function mensajeDeError(e: unknown): string {
  const nombre = e instanceof Error ? e.name : '';
  if (nombre === 'PdfProtegido') return tr('Este PDF está protegido con contraseña: no se le puede añadir el texto.');
  if (nombre === 'PdfDanado') return tr('Este PDF está dañado: no dice dónde empieza su tabla de referencias.');
  if (e instanceof SinArchivo) return tr('El archivo de este libro no está en este equipo. Vuelve a importarlo desde la Biblioteca.');
  return tr('No se pudo exportar: {0}', e instanceof Error ? e.message : String(e));
}

/** Lo deja en las descargas del navegador. La dirección se suelta más tarde: con un archivo grande, la descarga tarda en empezar. */
export function guardarEnDescargas(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 120_000);
}
