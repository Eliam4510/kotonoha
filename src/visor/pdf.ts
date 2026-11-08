// Los PDF del visor, pintados con pdf.js. Se leen a trozos desde el archivo guardado, sin cargarlo entero: un libro
// escaneado puede pasar de 300 MB. Cada página se pinta con el doble de resolución de su tamaño natural, para que se vea
// nítida en pantallas densas y con algo de zoom, y la imagen se guarda en la caché del paginador como las demás. Si el
// PDF trae su texto, se lee de él, sin OCR: cada trozo con su posición, para saber qué palabra se toca. Si la página es
// un escaneo, el OCR lee la imagen escaneada tal cual, sin pintarla (nucleo/escaneo.ts).

import { AnnotationMode, getDocument, GlobalWorkerOptions, OPS, PDFDataRangeTransport, type PDFDocumentProxy, type PDFPageProxy, Util } from 'pdfjs-dist';
import { type LineaTexto, lineasDePdf, type TrozoPdf } from '../nucleo/capaTexto';
import { escaneoDe, LADO_MAXIMO_OCR, recorteVisible, rgbaDe } from '../nucleo/escaneo';
import type { Tamano } from '../nucleo/imagenes';
import type { Direccion, EntradaIndice } from '../nucleo/libro';
import { CachePaginas, type ImagenOcr, miniaturaDe, type Paginador } from './paginador';

const base = () => chrome.runtime.getURL('pdfjs/');
/** Puntos de PDF a píxeles de pantalla al 100 %, como en cualquier lector de PDF. */
const PUNTO = 96 / 72;
/** La resolución con que se pinta cada página, sobre su tamaño natural. */
const NITIDEZ = 2;
/** Lo que se espera a que pdf.js entregue la imagen de un escaneo; si no llega, el OCR lee la página pintada. */
const ESPERA_IMAGEN = 30_000;

/** Una imagen tal como la entrega pdf.js: como mapa de bits o con sus píxeles (rgbaDe dice de qué tipos). */
interface ObjetoImagen {
  width: number;
  height: number;
  kind?: number;
  data?: ArrayLike<number>;
  bitmap?: ImageBitmap;
}

/** Una imagen de la página, cuando pdf.js termina de descodificarla. Las que comparten varias páginas van aparte. */
function objetoDe(pagina: PDFPageProxy, id: string): Promise<ObjetoImagen> {
  const objetos = id.startsWith('g_') ? pagina.commonObjs : pagina.objs;
  return new Promise((ok, mal) => {
    const plazo = setTimeout(() => mal(new Error(`La imagen ${id} no llega`)), ESPERA_IMAGEN);
    objetos.get(
      id,
      (o: ObjetoImagen | null) => {
        clearTimeout(plazo);
        if (o?.width && o.height) ok(o);
        else mal(new Error(`La imagen ${id} está vacía`));
      },
      (e: unknown) => {
        clearTimeout(plazo);
        mal(e instanceof Error ? e : new Error(String(e)));
      }
    );
  });
}

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
  const textos = new Map<number, Promise<LineaTexto[]>>();
  const leerTexto = async (n: number): Promise<LineaTexto[]> => {
    const pagina = await doc.getPage(n + 1);
    const vista = pagina.getViewport({ scale: 1 });
    const contenido = await pagina.getTextContent();
    const trozos: TrozoPdf[] = [];
    for (const it of contenido.items) {
      if (!('str' in it) || !it.str) continue;
      const estilo = contenido.styles[it.fontName];
      const vertical = !!estilo?.vertical;
      // La parte de la letra sobre la línea base; si la fuente no la dice bien, la de casi todas.
      const ascenso = estilo && estilo.ascent > 0 && estilo.ascent < 1.5 && estilo.descent <= 0 ? estilo.ascent / (estilo.ascent - estilo.descent) : 0.8;
      trozos.push({ texto: it.str, tx: Util.transform(vista.transform, it.transform), avance: vertical ? it.height : it.width, vertical, ascenso });
    }
    return lineasDePdf(trozos, vista.width, vista.height);
  };
  // Al limpiar una página, pdf.js suelta sus imágenes: no se limpia mientras otro la esté usando (pintándola o sacando el
  // escaneo para el OCR), y la limpia el último que termine.
  const usos = new Map<number, number>();
  const usar = async <T>(n: number, f: (p: PDFPageProxy) => Promise<T>): Promise<T> => {
    usos.set(n, (usos.get(n) ?? 0) + 1);
    let pagina: PDFPageProxy | null = null;
    try {
      pagina = await doc.getPage(n + 1);
      return await f(pagina);
    } finally {
      const quedan = (usos.get(n) ?? 1) - 1;
      if (quedan > 0) usos.set(n, quedan);
      else {
        usos.delete(n);
        pagina?.cleanup();
      }
    }
  };
  /** El escaneo de una página, recortado a lo que se ve de él y en un mapa de bits propio, o null si no es un escaneo. */
  const escaneo = async (pagina: PDFPageProxy): Promise<ImagenOcr | null> => {
    const vista = pagina.getViewport({ scale: 1 });
    // Sin anotaciones: lo que se busca es lo que trae la página en sí.
    const ops = await pagina.getOperatorList({ annotationMode: AnnotationMode.DISABLE });
    const e = escaneoDe(ops, OPS, vista.transform, vista.width, vista.height);
    if (!e) return null;
    const o = await objetoDe(pagina, e.id);
    const r = recorteVisible(e.marco, o.width, o.height);
    if (!r) return null;
    // La copia es propia: el mapa de bits de pdf.js se cierra al limpiar la página, y el del OCR se pasa al trabajador.
    const fuente = o.bitmap ?? (o.data && o.kind ? new ImageData(rgbaDe(o.kind, o.data, o.width, o.height), o.width, o.height) : null);
    if (!fuente) return null;
    const escala = Math.min(1, LADO_MAXIMO_OCR / Math.max(r.ancho, r.alto));
    const imagen = await createImageBitmap(
      fuente,
      r.x,
      r.y,
      r.ancho,
      r.alto,
      escala < 1 ? { resizeWidth: Math.round(r.ancho * escala), resizeHeight: Math.round(r.alto * escala), resizeQuality: 'high' } : {}
    );
    return { imagen, marco: r.marco };
  };
  return {
    total: doc.numPages,
    indice: await indiceDe(doc),
    direccion,
    direccionDelArchivo: !!declarada,
    tamano: (n) => tamanos.get(n) ?? tamanos.get(0) ?? null,
    imagen: (n) =>
      cache.obtener(n, () =>
        usar(n, async (pagina) => {
          const natural = pagina.getViewport({ scale: PUNTO });
          const viewport = pagina.getViewport({ scale: PUNTO * NITIDEZ });
          const lienzo = document.createElement('canvas');
          lienzo.width = Math.ceil(viewport.width);
          lienzo.height = Math.ceil(viewport.height);
          await pagina.render({ canvas: lienzo, viewport }).promise;
          // JPEG de calidad alta: en PNG cada página ocuparía varios MB en memoria. El OCR no lee esto si hay escaneo.
          const blob = await new Promise<Blob>((ok, mal) => lienzo.toBlob((b) => (b ? ok(b) : mal(new Error('toBlob'))), 'image/jpeg', 0.94));
          const t = { ancho: Math.round(natural.width), alto: Math.round(natural.height) };
          tamanos.set(n, t);
          return { url: URL.createObjectURL(blob), ...t };
        })
      ),
    imagenOcr: (n) => usar(n, escaneo),
    textoPropio: (n) => {
      let t = textos.get(n);
      if (!t) {
        t = leerTexto(n);
        textos.set(n, t);
        t.catch(() => textos.delete(n));
      }
      return t;
    },
    cerrar: () => {
      cache.vaciar();
      tarea.destroy().catch(() => {});
    },
  };
}

/** Lo que la estantería guarda de un PDF al importarlo: cuántas páginas tiene, su sentido de lectura y su portada en pequeño. */
export async function datosDePdf(archivo: Blob): Promise<{ paginas: number; direccion: Direccion; portada?: string }> {
  const p = await paginadorDePdf(archivo);
  try {
    const portada = await p
      .imagen(0)
      .then(async (primera) => miniaturaDe(await (await fetch(primera.url)).blob()))
      .catch(() => undefined);
    return { paginas: p.total, direccion: p.direccion, ...(portada ? { portada } : {}) };
  } finally {
    p.cerrar();
  }
}
