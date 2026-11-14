// El texto de un libro de la Biblioteca, para contar sus palabras: el de un texto o una nota, por sus páginas; el de cada
// capítulo de un EPUB de texto, sin el furigana del libro; y el de cada página de un libro de páginas, el del propio PDF
// o el leído con el OCR, con lo editado encima y en párrafos, como en la vista de texto del visor. En un manga, cada globo
// es un párrafo.

import { archivoDocumento } from '../compartido/documentos';
import { edicionesDe, lecturaMinima } from '../compartido/paginasOcr';
import type { ElementoBiblioteca, TrozoTexto } from '../compartido/tipos';
import type { LineaTexto } from '../nucleo/capaTexto';
import { aplicarEdiciones, type EdicionLinea } from '../nucleo/ediciones';
import { paginasDeTexto } from '../nucleo/estanteria';
import { estructuraDeNodo, leerEstructura, type NodoHtml, textoPlano } from '../nucleo/estructura';
import { leerEpubDeTexto } from '../nucleo/libro';
import { parrafosDe } from '../nucleo/parrafos';
import { fuenteDeArchivo, leerEntrada, leerIndiceZip } from '../nucleo/zip';
import { lengua } from '../ui/lengua';
import { estaProcesado, modoDe } from '../visor/procesador';
import { leerTextoLibro } from '../visor/textoLibro';

export interface TextoDeLibro {
  trozos: TrozoTexto[];
  /** Qué es cada sitio de los trozos: una página o un capítulo, desde 0. */
  unidad: 'pagina' | 'capitulo';
  /** Cuántas páginas o capítulos tiene, y cuántos con texto. */
  total: number;
  conTexto: number;
  /**
   * Si está todo su texto. En un libro de páginas sin leer entero con el OCR falta el de las páginas sin leer: las que no
   * tienen texto pueden ser ilustraciones o estar aún por leer.
   */
  completo: boolean;
}

/** El archivo de un libro no está en este equipo: la Biblioteca solo tiene su ficha. */
export class SinArchivo extends Error {}

type Avanzar = (hechas: number, total: number) => void;

/** El texto de un libro de la Biblioteca. `alAvanzar` dice cuántas páginas o capítulos van, en los libros largos. */
export async function textoDeLibro(e: ElementoBiblioteca, alAvanzar?: Avanzar, senal?: AbortSignal): Promise<TextoDeLibro> {
  const d = e.documento;
  if (!d) return textoDeTexto(e.texto);
  if (d.texto) return textoDeEpub(await archivo(e), e.titulo, alAvanzar, senal);
  return textoDePaginas(e, alAvanzar, senal);
}

async function archivo(e: ElementoBiblioteca): Promise<File> {
  const f = await archivoDocumento(e.id);
  if (!f) throw new SinArchivo(e.titulo);
  return f;
}

/** Un texto o una nota: sus páginas, como se leen en la Biblioteca, sin las marcas de títulos, listas y negritas. */
function textoDeTexto(texto: string): TextoDeLibro {
  const paginas = paginasDeTexto(texto);
  const trozos = paginas.map((p, lugar) => ({ texto: textoPlano(leerEstructura(p)), lugar })).filter((t) => t.texto.trim());
  return { trozos, unidad: 'pagina', total: paginas.length, conTexto: trozos.length, completo: true };
}

async function textoDeEpub(f: File, titulo: string, alAvanzar?: Avanzar, senal?: AbortSignal): Promise<TextoDeLibro> {
  const fuente = fuenteDeArchivo(f);
  const indice = await leerIndiceZip(fuente);
  const libro = await leerEpubDeTexto(fuente, indice, titulo);
  const trozos: TrozoTexto[] = [];
  const decodificador = new TextDecoder();
  for (const [lugar, ruta] of libro.capitulos.entries()) {
    if (senal?.aborted) break;
    const entrada = indice.get(ruta);
    if (!entrada) continue;
    const html = new DOMParser().parseFromString(decodificador.decode(await leerEntrada(fuente, entrada)), 'text/html');
    // Con su estructura, para que cada párrafo vaya aparte, y sin el furigana del libro, que no se lee dos veces.
    const texto = html.body ? textoPlano(leerEstructura(estructuraDeNodo(html.body as unknown as NodoHtml))) : '';
    if (texto.trim()) trozos.push({ texto, lugar });
    alAvanzar?.(lugar + 1, libro.capitulos.length);
  }
  return { trozos, unidad: 'capitulo', total: libro.capitulos.length, conTexto: trozos.length, completo: true };
}

/**
 * Un libro de páginas: el texto que trae el PDF y lo leído con el OCR, con las mismas reglas que el visor, lo editado
 * encima y en párrafos. Lo leído con el OCR cuenta aunque el OCR esté apagado: también es texto del libro. El PDF solo se
 * abre si hay que sacar su texto o contar sus páginas, y se cierra al acabar: mientras está abierto, pdf.js reserva
 * tanta memoria como pesa el archivo.
 */
async function textoDePaginas(e: ElementoBiblioteca, alAvanzar?: Avanzar, senal?: AbortSignal): Promise<TextoDeLibro> {
  const d = e.documento!;
  const modo = modoDe(d);
  const textoPdf = d.ocr?.textoPdf ?? true;
  const conPdf = d.formato === 'pdf' && (textoPdf || !d.paginas);
  const pdf = conPdf ? await import('../visor/pdf').then(async (m) => m.paginadorDePdf(await archivo(e))) : null;
  const total = pdf?.total ?? d.paginas;
  let paginas = new Map<number, { lineas: LineaTexto[]; propias: boolean }>();
  try {
    await leerTextoLibro({
      paginador: pdf && textoPdf ? pdf : { total },
      libro: e.id,
      modo,
      minima: lecturaMinima(d.formato),
      textoPdf,
      ocrActivo: true,
      propias: new Map(),
      senal: senal ?? new AbortController().signal,
      alAvanzar: (hechas, n) => {
        paginas = hechas;
        alAvanzar?.(n, total);
      },
    });
  } finally {
    pdf?.cerrar();
  }
  const porPagina = new Map<number, EdicionLinea[]>();
  for (const x of await edicionesDe(e.id).catch(() => [] as EdicionLinea[])) porPagina.set(x.pagina, [...(porPagina.get(x.pagina) ?? []), x]);
  const marca = lengua.value.escritura.marcaDeLista;
  const trozos: TrozoTexto[] = [];
  let conTexto = 0;
  for (const n of [...paginas.keys()].sort((a, b) => a - b)) {
    const t = paginas.get(n)!;
    const suyas = porPagina.get(n);
    const parrafos = parrafosDe(suyas ? aplicarEdiciones(t.lineas, suyas) : t.lineas, { globos: modo === 'manga' && !t.propias, marca });
    if (!parrafos.length) continue;
    conTexto++;
    for (const p of parrafos) trozos.push({ texto: p.texto, lugar: n });
  }
  return { trozos, unidad: 'pagina', total, conTexto, completo: estaProcesado(d) || (total > 0 && conTexto >= total) };
}
