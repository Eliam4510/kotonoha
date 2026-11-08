// El texto de todas las páginas de un libro, para buscar en él. Es el mismo que se ve en cada página: el que trae el propio
// PDF y el que leyó el OCR, que está guardado en su base. Lo del OCR sale de la base de una vez. El del PDF se saca página
// a página, que en un libro largo tarda unos segundos, así que se va entregando según llega.

import { baseOcr } from '../compartido/paginasOcr';
import { type LineaTexto, textoDePagina } from '../nucleo/capaTexto';
import type { LineaOcr } from '../nucleo/ocr';
import type { ModoOcr } from './ocr';
import type { Paginador } from './paginador';

export interface TextoDePagina {
  lineas: LineaTexto[];
  /** Si es el texto que trae el PDF: entonces se sabe dónde va cada letra. */
  propias: boolean;
}

/** Lo leído con el OCR en cada página de un libro con un modo, si vale para su formato. */
export async function leidoConOcr(libro: string, modo: ModoOcr, minima: number): Promise<Map<number, LineaOcr[]>> {
  const filas = await baseOcr().paginas.where('libro').equals(libro).toArray();
  const salida = new Map<number, LineaOcr[]>();
  const prefijo = `${libro}:${modo}:`;
  for (const f of filas) {
    if (!f.clave.startsWith(prefijo) || (f.lectura ?? 0) < minima) continue;
    const n = Number(f.clave.slice(prefijo.length));
    if (Number.isInteger(n)) salida.set(n, f.lineas);
  }
  return salida;
}

/** Cada cuánto se entrega lo que ya está, en milisegundos. */
const ENTREGA = 250;

/**
 * Prepara el texto de cada página: la que no tiene ninguno (sin texto propio y sin leer con el OCR) no está. Entrega lo
 * hecho cada poco y, aparte, el texto propio que ha sacado, para que el visor no tenga que sacarlo otra vez.
 */
export async function leerTextoLibro(o: {
  paginador: Paginador;
  libro: string;
  modo: ModoOcr;
  minima: number;
  textoPdf: boolean;
  ocrActivo: boolean;
  /** El texto propio de las páginas que ya se sacó: no se saca dos veces. */
  propias: ReadonlyMap<number, LineaTexto[] | null>;
  alAvanzar: (paginas: Map<number, TextoDePagina>, hechas: number, propiasNuevas: Map<number, LineaTexto[] | null>) => void;
  senal: AbortSignal;
}): Promise<void> {
  const ocr = await leidoConOcr(o.libro, o.modo, o.minima);
  const paginas = new Map<number, TextoDePagina>();
  let nuevas = new Map<number, LineaTexto[] | null>();
  const { total } = o.paginador;
  let ultima = performance.now();
  for (let n = 0; n < total; n++) {
    if (o.senal.aborted) return;
    let propias = o.propias.get(n);
    if (propias === undefined && o.paginador.textoPropio) {
      propias = await o.paginador.textoPropio(n).then(
        (l) => (l.length ? l : null),
        () => null
      );
      nuevas.set(n, propias);
    }
    // Como en la página, salvo que con el OCR apagado también se busca en lo que ya leyó: al ir allí, se vuelve a encender.
    const t = textoDePagina<LineaTexto>(propias ?? null, ocr.get(n), { ocrActivo: o.ocrActivo || !propias, textoPdf: o.textoPdf });
    if (t) paginas.set(n, t);
    if (performance.now() - ultima > ENTREGA || n === total - 1) {
      ultima = performance.now();
      if (o.senal.aborted) return;
      o.alAvanzar(new Map(paginas), n + 1, nuevas);
      nuevas = new Map();
    }
  }
}
