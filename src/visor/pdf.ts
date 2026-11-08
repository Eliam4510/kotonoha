// Los PDF del visor, pintados con pdf.js. Se leen a trozos desde el archivo guardado, sin cargarlo entero: un libro
// escaneado puede pasar de 300 MB. Cada página se pinta con el doble de resolución de su tamaño natural, para que se vea
// nítida en pantallas densas y con algo de zoom, y la imagen se guarda en la caché del paginador como las demás.

import { getDocument, GlobalWorkerOptions, PDFDataRangeTransport, type PDFDocumentProxy } from 'pdfjs-dist';
import type { Tamano } from '../nucleo/imagenes';
import type { Direccion, EntradaIndice } from '../nucleo/libro';
import { CachePaginas, type Paginador } from './paginador';

const base = () => chrome.runtime.getURL('pdfjs/');
/** Puntos de PDF a píxeles de pantalla al 100 %, como en cualquier lector de PDF. */
const PUNTO = 96 / 72;
/** La resolución con que se pinta cada página, sobre su tamaño natural. */
const NITIDEZ = 2;

/** Pide a pdf.js solo los trozos que necesita, leyéndolos del archivo guardado. */
class TransporteDeArchivo extends PDFDataRangeTransport {
  constructor(private archivo: Blob) {
    super(archivo.size, new Uint8Array(0));
  }

  override requestDataRange(inicio: number, fin: number) {
    this.archivo
      .slice(inicio, fin)
      .arrayBuffer()
      .then((b) => this.onDataRange(inicio, new Uint8Array(b)))
      .catch(console.error);
  }
}

interface ElementoEsquema {
  title: string;
  dest: string | unknown[] | null;
  items: ElementoEsquema[];
}

/** El índice del PDF, aplanado, con la página de cada entrada. */
async function indiceDe(doc: PDFDocumentProxy): Promise<EntradaIndice[]> {
  const esquema = ((await doc.getOutline().catch(() => null)) ?? []) as ElementoEsquema[];
  const salida: EntradaIndice[] = [];
  const recorrer = async (items: ElementoEsquema[]) => {
    for (const e of items) {
      try {
        const destino = typeof e.dest === 'string' ? await doc.getDestination(e.dest) : e.dest;
        const ref = Array.isArray(destino) ? destino[0] : null;
        const pagina = ref && typeof ref === 'object' ? await doc.getPageIndex(ref as never) : typeof ref === 'number' ? ref : null;
        if (pagina !== null && e.title.trim()) salida.push({ titulo: e.title.trim(), pagina });
      } catch {
        // Una entrada que no lleva a ninguna página se omite.
      }
      if (e.items?.length) await recorrer(e.items);
    }
  };
  await recorrer(esquema);
  return salida;
}

export async function paginadorDePdf(archivo: Blob): Promise<Paginador> {
  GlobalWorkerOptions.workerSrc = `${base()}pdf.worker.min.mjs`;
  const tarea = getDocument({
    range: new TransporteDeArchivo(archivo),
    disableAutoFetch: true,
    disableStream: true,
    // Los PDF japoneses con texto necesitan los mapas de caracteres para que el texto salga bien.
    cMapUrl: `${base()}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${base()}standard_fonts/`,
    wasmUrl: `${base()}wasm/`,
    iccUrl: `${base()}iccs/`,
  });
  const doc = await tarea.promise;
  const tamanos = new Map<number, Tamano>();
  const primera = await doc.getPage(1);
  const vp = primera.getViewport({ scale: PUNTO });
  tamanos.set(0, { ancho: Math.round(vp.width), alto: Math.round(vp.height) });
  // El sentido de lectura, si el PDF lo declara en sus preferencias de visualización.
  const declarada = (await doc.getViewerPreferences().catch(() => null))?.get('Direction') as string | undefined;
  const direccion: Direccion = declarada === 'R2L' ? 'rtl' : 'ltr';
  const cache = new CachePaginas();
  return {
    total: doc.numPages,
    indice: await indiceDe(doc),
    direccion,
    direccionDelArchivo: !!declarada,
    tamano: (n) => tamanos.get(n) ?? tamanos.get(0) ?? null,
    imagen: (n) =>
      cache.obtener(n, async () => {
        const pagina = await doc.getPage(n + 1);
        const natural = pagina.getViewport({ scale: PUNTO });
        const viewport = pagina.getViewport({ scale: PUNTO * NITIDEZ });
        const lienzo = document.createElement('canvas');
        lienzo.width = Math.ceil(viewport.width);
        lienzo.height = Math.ceil(viewport.height);
        await pagina.render({ canvas: lienzo, viewport }).promise;
        pagina.cleanup();
        // JPEG de calidad alta: en PNG cada página ocuparía varios MB en memoria y el OCR no lee mejor.
        const blob = await new Promise<Blob>((ok, mal) => lienzo.toBlob((b) => (b ? ok(b) : mal(new Error('toBlob'))), 'image/jpeg', 0.94));
        const t = { ancho: Math.round(natural.width), alto: Math.round(natural.height) };
        tamanos.set(n, t);
        return { url: URL.createObjectURL(blob), ...t };
      }),
    cerrar: () => {
      cache.vaciar();
      tarea.destroy().catch(() => {});
    },
  };
}
