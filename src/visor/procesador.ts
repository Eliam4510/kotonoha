// Leer un libro entero con el OCR por adelantado, desde la Ayuda de lectura: al abrirlo después, el texto de cada página
// ya está y no hay que esperar. Usa el mismo lector y la misma base que el visor, así que lo que lee uno lo aprovecha el
// otro, y lo que ya estaba leído no se vuelve a leer: pausar y seguir más tarde no pierde nada.

import { archivoDocumento } from '../compartido/documentos';
import { tr } from '../compartido/i18n';
import { motor } from '../compartido/rpc';
import type { DocumentoBiblioteca, ElementoBiblioteca } from '../compartido/tipos';
import type { LectorOcr, ModoOcr } from './ocr';
import { type Paginador, paginadorDeZip } from './paginador';
import { paginadorDePdf } from './pdf';

export interface Avance {
  hechas: number;
  total: number;
}

/** El modo con que se lee un libro: el elegido en el visor o, si no, el de su sentido de lectura, como hace el visor. */
export const modoDe = (d: DocumentoBiblioteca): ModoOcr => d.ocr?.modo ?? (d.direccion === 'rtl' ? 'manga' : 'libro');

/** Si un libro ya está leído entero con el OCR tal como se lee ahora: con el mismo modo y la misma elección del PDF. */
export const estaProcesado = (d: DocumentoBiblioteca) => !!d.procesado && d.procesado.modo === modoDe(d) && d.procesado.textoPdf === (d.ocr?.textoPdf ?? true);

/**
 * Lee con el OCR todas las páginas del libro que aún no lo estén, en orden. Las páginas de un PDF que traen su propio
 * texto se saltan, salvo que se haya quitado «Texto del PDF». Antes de cada página pregunta a `seguir`: así se pausa.
 * Devuelve true si llegó al final; entonces deja el libro marcado como procesado y con el OCR encendido.
 */
export async function procesarLibro(e: ElementoBiblioteca, lector: LectorOcr, alAvanzar: (a: Avance) => void, seguir: () => boolean): Promise<boolean> {
  const d = e.documento;
  if (!d || d.texto) return true;
  const archivo = await archivoDocumento(e.id);
  if (!archivo) throw new Error(tr('El archivo de este libro no está en este equipo. Vuelve a importarlo desde la Ayuda de lectura.'));
  const p: Paginador = d.formato === 'pdf' ? await paginadorDePdf(archivo) : await paginadorDeZip(archivo, `${e.titulo}.${d.formato}`, d.direccion);
  const modo = modoDe(d);
  const textoPdf = d.ocr?.textoPdf ?? true;
  try {
    for (let n = 0; n < p.total; n++) {
      if (!seguir()) return false;
      const conTexto = p.textoPropio && textoPdf ? (await p.textoPropio(n).catch(() => [])).length > 0 : false;
      if (!conTexto) await lector.leer(e.id, n, modo, async () => (await fetch((await p.imagen(n)).url)).blob(), n);
      alAvanzar({ hechas: n + 1, total: p.total });
    }
    // Se guarda sobre lo último de la biblioteca: el visor puede haber guardado mientras tanto por qué página se va.
    const actual = (await motor.bibliotecaObtener(e.id)) ?? e;
    if (actual.documento) {
      await motor.bibliotecaGuardar({ ...actual, documento: { ...actual.documento, paginas: p.total, ocr: { ...actual.documento.ocr, activo: true, modo }, procesado: { modo, textoPdf } } });
    }
    return true;
  } finally {
    p.cerrar();
  }
}
