// El reconocimiento de texto (OCR) del visor, en un trabajador: la página no se congela mientras lee. Dos juegos de modelos,
// medidos con libros reales antes de elegirlos. Para libros impresos, el detector de PP-OCRv5 mobile y el reconocedor de
// PP-OCRv6 small (25 MB): en tres páginas de referencia, de 2,2 % de error por carácter con todo PP-OCRv5 a 0,9 %, a la
// misma velocidad. PP-OCRv6 entero lee igual de bien pero su detector parte peor las líneas, y PP-OCRv6 medium apenas
// mejora al small con el triple de tiempo; NDLOCR-Lite, con su propio programa, se quedó en un 6 %. Para el manga, un
// detector de globos y manga-ocr (178 MB), que lee el texto vertical
// y no confunde el furigana: menos de un 1 % en tres páginas de un tomo, en un segundo y medio por página. Sobre lo que
// leen los modelos, el manga deja repetir los signos («……»), quita las marcas de agua y lo suelto dudoso, y ordena los
// globos por viñetas; en 18 páginas de cinco series, en el navegador, de 4,3 % a 2,8 % de error y de 11 falsos a 4.
//
// Para los cómics en lenguas con espacios (inglés, alemán), el mismo detector de globos encuentra los bloques de texto y
// el reconocedor de libros lee los renglones de cada uno, de izquierda a derecha: manga-ocr solo sabe japonés.
//
// manga-ocr va con el codificador en q4f16 y el decodificador en fp32: las versiones int8 hacen que ONNX mande a la CPU
// las operaciones con enteros, y en un solo hilo tardaban entre 10 y 30 s por página; las fp16 y q4f16 del decodificador
// no llegan a cargar. Se descargan una vez y se guardan con los demás modelos.

import * as ort from 'onnxruntime-web/webgpu';
import { CACHE_MODELOS_OCR, leerModelo, urlDeModelo } from '../motor/modelos';
import {
  aTensor,
  bloquesDeDetector,
  type Caja,
  cajasDeMapa,
  decodificarCtc,
  esRuidoComic,
  esRuidoManga,
  esVertical,
  idsRepetibles,
  type LineaOcr,
  medidaDeDeteccion,
  ordenarLineas,
  ordenMangaPorVinetas,
  porRenglones,
  quitarFurigana,
  siguienteToken,
  textoDeMangaOcr,
  unirRenglones,
  vinetasDeImagen,
} from '../nucleo/ocr';

export type ModoOcr = 'libro' | 'manga';
/** Lo que de verdad lee el trabajador: el modo Manga de una lengua con espacios es el de los cómics. */
export type ModoLectura = ModoOcr | 'comic';

export type PedidoOcr = { tipo: 'leer'; id: number; modo: ModoLectura; imagen: ImageBitmap } | { tipo: 'liberar' };

export type RespuestaOcr =
  | { tipo: 'descarga'; archivo: string; cargado: number; total: number }
  | { tipo: 'lineas'; id: number; lineas: LineaOcr[]; ms: number; dispositivo: string; fases: Record<string, number> }
  | { tipo: 'error'; id: number; mensaje: string };

/** Los modelos, fijados a un commit de Hugging Face: se descarga siempre lo que se midió. */
const MODELOS = {
  libro: { repositorio: 'nakamura196/ppocrv5-mobile-web-onnx', revision: 'dc7e2271c00d961a4c0a38dcebe23beb735ba33e', detector: 'PP-OCRv5_mobile_det.onnx' },
  // El diccionario va en la propia extensión (publico/modelos): el modelo lo trae dentro de un YAML. Lo saca
  // herramientas/diccionario-ocr.mjs del mismo commit.
  lectorLibro: { repositorio: 'PaddlePaddle/PP-OCRv6_small_rec_onnx', revision: 'b8f84f0b80c529de40b4fbb3544b84fa7233a513', archivo: 'inference.onnx', diccionario: 'modelos/PP-OCRv6_small_rec.dict.json' },
  globos: { repositorio: 'ogkalu/comic-text-and-bubble-detector', revision: '16e8a622f91fabc6b5b65c96d32d1183f8843546', archivo: 'detector-v4-s_int8.onnx' },
  mangaOcr: { repositorio: 'onnx-community/manga-ocr-base-ONNX', revision: 'f9023406bb2f6b17df67bc4a327c56ecd20611f0', codificador: 'onnx/encoder_model_q4f16.onnx', decodificador: 'onnx/decoder_model.onnx' },
  vocabulario: { repositorio: 'kha-white/manga-ocr-base', revision: 'aa6573bd10b0d446cbf622e29c3e084914df9741', archivo: 'vocab.txt' },
};

// El motor de ONNX se sirve desde la propia extensión, como para Whisper: la política de seguridad prohíbe scripts remotos.
ort.env.wasm.wasmPaths = new URL('./ort/', self.location.href).href;
// Sus avisos de nodos que van a la CPU son normales y llenarían la consola.
ort.env.logLevel = 'error';

const ALTO_LINEA = 48;
/** Las líneas se leen juntas si su ancho cae en el mismo tramo: menos formas distintas, menos tiempo preparando la GPU. */
const TRAMO_ANCHO = 16;
const ANCHO_MAXIMO = 3200;
const LADO_MANGA_OCR = 224;
const LADO_GLOBOS = 640;
/** El ancho de la miniatura en grises en la que se buscan las viñetas: de sobra para ver los canales entre ellas. */
const ANCHO_VINETAS = 360;
const MAXIMO_TOKENS = 160;
/**
 * En la GPU, cada forma nueva de un tensor obliga a compilar otra vez. Los globos van siempre en lotes de este tamaño,
 * rellenos con recortes vacíos, y la secuencia crece por tramos fijos: así se compila una vez y se reutiliza.
 */
const LOTE_MANGA = 8;
const TRAMOS_SECUENCIA = [24, 48, 96, MAXIMO_TOKENS];

const avisar = (r: RespuestaOcr) => self.postMessage(r);
/** Cuánto tarda cada fase de la página en curso, para saber dónde se va el tiempo. */
let fases: Record<string, number> = {};
let desde = 0;
const fase = (nombre: string) => {
  const ahora = performance.now();
  fases[nombre] = Math.round((fases[nombre] ?? 0) + ahora - desde);
  desde = ahora;
};
const avance = (p: { archivo: string; cargado: number; total: number }) => avisar({ tipo: 'descarga', archivo: p.archivo, cargado: p.cargado, total: p.total });
/** Un archivo de modelo, de su commit fijo y a la caché del OCR, aparte de la de los modelos de voz. */
const descargar = (repositorio: string, revision: string, archivo: string) => leerModelo(urlDeModelo(repositorio, revision, archivo), archivo, avance, CACHE_MODELOS_OCR);

let gpu: boolean | null = null;
async function hayGpu(): Promise<boolean> {
  if (gpu === null) gpu = !!(await (navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu?.requestAdapter().catch(() => null));
  return gpu;
}

let colaSesiones: Promise<unknown> = Promise.resolve();

/** El proveedor de WebGPU de ONNX no admite crear dos sesiones a la vez («another WebGPU EP inference session is being created»): van en fila. */
function sesion(datos: Uint8Array, enGpu: boolean): Promise<ort.InferenceSession> {
  const r = colaSesiones.then(async () => ort.InferenceSession.create(datos, { executionProviders: enGpu && (await hayGpu()) ? ['webgpu', 'wasm'] : ['wasm'] }));
  colaSesiones = r.catch(() => {});
  return r;
}

interface ModelosLibro {
  detector: ort.InferenceSession;
  lector: ort.InferenceSession;
  diccionario: string[];
}

interface ModelosManga {
  globos: ort.InferenceSession;
  codificador: ort.InferenceSession;
  decodificador: ort.InferenceSession;
  vocabulario: string[];
  /** Los signos que pueden repetirse más allá de la regla de los trigramas («……», «ーーー»). */
  repetibles: Set<number>;
}

let libro: Promise<ModelosLibro> | null = null;
let manga: Promise<ModelosManga> | null = null;
let globos: Promise<ort.InferenceSession> | null = null;

/** El detector de globos, que comparten el manga y los cómics: los cómics no necesitan manga-ocr. */
function cargarGlobos(): Promise<ort.InferenceSession> {
  globos ??= (async () => {
    const g = MODELOS.globos;
    return sesion(await descargar(g.repositorio, g.revision, g.archivo), true);
  })().catch((e) => {
    globos = null;
    throw e;
  });
  return globos;
}

function cargarLibro(): Promise<ModelosLibro> {
  libro ??= (async () => {
    const m = MODELOS.libro;
    const l = MODELOS.lectorLibro;
    const [det, rec, dic] = await Promise.all([
      descargar(m.repositorio, m.revision, m.detector),
      descargar(l.repositorio, l.revision, l.archivo),
      fetch(new URL(l.diccionario, self.location.href)).then((r) => r.json() as Promise<string[]>),
    ]);
    return { detector: await sesion(det, true), lector: await sesion(rec, true), diccionario: dic };
  })().catch((e) => {
    libro = null;
    throw e;
  });
  return libro;
}

function cargarManga(): Promise<ModelosManga> {
  manga ??= (async () => {
    const o = MODELOS.mangaOcr;
    const v = MODELOS.vocabulario;
    const [detector, codificador, decodificador, vocabulario] = await Promise.all([
      cargarGlobos(),
      descargar(o.repositorio, o.revision, o.codificador),
      descargar(o.repositorio, o.revision, o.decodificador),
      descargar(v.repositorio, v.revision, v.archivo),
    ]);
    const lista = new TextDecoder().decode(vocabulario).split(/\r?\n/);
    return {
      globos: detector,
      codificador: await sesion(codificador, true),
      // En la GPU, con formas fijas: lotes de LOTE_MANGA y largos por tramos, para compilar una vez y no en cada paso.
      decodificador: await sesion(decodificador, true),
      vocabulario: lista,
      repetibles: idsRepetibles(lista),
    };
  })().catch((e) => {
    manga = null;
    throw e;
  });
  return manga;
}

/** Los píxeles RGBA de un trozo de la imagen, escalado a la medida pedida, y girado un cuarto de vuelta si se pide. */
function pixeles(imagen: ImageBitmap | OffscreenCanvas, caja: Caja, w: number, h: number, girar = false): Uint8ClampedArray {
  const lienzo = new OffscreenCanvas(w, h);
  const ctx = lienzo.getContext('2d', { willReadFrequently: true })!;
  // Al reducir una línea a 48 píxeles de alto, la calidad baja de serie emborrona el texto pequeño y el lector falla más.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  if (girar) {
    // Como PaddleOCR: una columna vertical se gira en sentido contrario a las agujas del reloj para leerla en horizontal.
    ctx.translate(0, h);
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(imagen, caja.x0, caja.y0, caja.x1 - caja.x0, caja.y1 - caja.y0, 0, 0, h, w);
  } else ctx.drawImage(imagen, caja.x0, caja.y0, caja.x1 - caja.x0, caja.y1 - caja.y0, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h).data;
}

const fraccion = (c: Caja, w: number, h: number): Caja => ({ x0: c.x0 / w, y0: c.y0 / h, x1: c.x1 / w, y1: c.y1 / h });

// Los modelos pensados para la GPU trabajan en media precisión (float16): las entradas se convierten y las salidas se leen.
interface MetadatoEntrada {
  name: string;
  type?: string;
}
const enMedia = (s: ort.InferenceSession, nombre: string) =>
  ((s as unknown as { inputMetadata?: MetadatoEntrada[] }).inputMetadata ?? []).find((m) => m.name === nombre)?.type === 'float16';
const Float16 = (globalThis as unknown as { Float16Array?: new (d: ArrayLike<number>) => ArrayLike<number> & { buffer: ArrayBuffer } }).Float16Array;

function tensorReal(s: ort.InferenceSession, nombre: string, datos: Float32Array, forma: number[]): ort.Tensor {
  if (!enMedia(s, nombre)) return new ort.Tensor('float32', datos, forma);
  if (!Float16) throw new Error('El navegador no admite Float16Array');
  return new ort.Tensor('float16', new Uint16Array(new Float16(datos).buffer), forma);
}

function mitadAReal(h: number): number {
  const signo = h & 0x8000 ? -1 : 1;
  const exponente = (h >> 10) & 0x1f;
  const fraccionBits = h & 0x3ff;
  if (exponente === 0) return signo * 2 ** -14 * (fraccionBits / 1024);
  if (exponente === 31) return fraccionBits ? NaN : signo * Infinity;
  return signo * 2 ** (exponente - 15) * (1 + fraccionBits / 1024);
}

/** Los datos de un tensor como reales de 32 bits, venga en la precisión que venga. */
function reales(t: ort.Tensor): ArrayLike<number> {
  if (t.type !== 'float16') return t.data as Float32Array;
  const d = t.data as ArrayLike<number>;
  if (!(d instanceof Uint16Array)) return d;
  const salida = new Float32Array(d.length);
  for (let i = 0; i < d.length; i++) salida[i] = mitadAReal(d[i]);
  return salida;
}

/** Un tensor en la precisión que espera esa entrada del modelo: el codificador y el decodificador no van en la misma. */
function adaptar(s: ort.InferenceSession, nombre: string, t: ort.Tensor): ort.Tensor {
  if (enMedia(s, nombre) === (t.type === 'float16')) return t;
  return tensorReal(s, nombre, Float32Array.from(reales(t)), t.dims as number[]);
}

/**
 * Las líneas de texto de una región de la imagen, con el detector de libros, en píxeles de la imagen. La región se pinta
 * con su lado mayor en `limite` píxeles, que en una página entera es la escala con la que se ajustó el detector.
 */
async function cajasDeLineas(m: ModelosLibro, imagen: ImageBitmap, region: Caja, limite?: number): Promise<Caja[]> {
  const rw = region.x1 - region.x0;
  const rh = region.y1 - region.y0;
  const medida = medidaDeDeteccion(rw, rh, limite);
  const media = [0.485, 0.456, 0.406];
  const desv = [0.229, 0.224, 0.225];
  const entrada = aTensor(pixeles(imagen, region, medida.w, medida.h), medida.w, medida.h, (v, c) => (v - media[c]) / desv[c], true);
  const det = await m.detector.run({ [m.detector.inputNames[0]]: new ort.Tensor('float32', entrada, [1, 3, medida.h, medida.w]) });
  return cajasDeMapa(det[m.detector.outputNames[0]].data as Float32Array, medida.w, medida.h, rw, rh).map((c) => ({ x0: c.x0 + region.x0, y0: c.y0 + region.y0, x1: c.x1 + region.x0, y1: c.y1 + region.y0 }));
}

/**
 * Lee cada línea a 48 píxeles de alto, de la imagen original; las de ancho parecido se leen de una vez, rellenas hasta el
 * mismo ancho. Devuelve el texto de cada caja, en su orden.
 */
async function leerCajas(m: ModelosLibro, imagen: ImageBitmap, cajas: { caja: Caja; vertical: boolean }[]): Promise<string[]> {
  const textos = cajas.map(() => '');
  const grupos = new Map<number, { i: number; caja: Caja; vertical: boolean; ancho: number }[]>();
  cajas.forEach(({ caja, vertical }, i) => {
    const proporcion = vertical ? (caja.y1 - caja.y0) / (caja.x1 - caja.x0) : (caja.x1 - caja.x0) / (caja.y1 - caja.y0);
    const ancho = Math.min(ANCHO_MAXIMO, Math.max(16, Math.round(ALTO_LINEA * proporcion)));
    const tramo = Math.ceil(ancho / TRAMO_ANCHO) * TRAMO_ANCHO;
    grupos.set(tramo, [...(grupos.get(tramo) ?? []), { i, caja, vertical, ancho }]);
  });
  for (const [tramo, grupo] of grupos) {
    const n = ALTO_LINEA * tramo;
    const lote = new Float32Array(grupo.length * 3 * n);
    grupo.forEach((g, i) => {
      const px = pixeles(imagen, g.caja, g.ancho, ALTO_LINEA, g.vertical);
      const t = aTensor(px, g.ancho, ALTO_LINEA, (v) => (v - 0.5) / 0.5, true);
      // Se copia fila a fila en el ancho del tramo; lo que sobra queda en 0, que es el gris medio ya normalizado.
      for (let c = 0; c < 3; c++) for (let y = 0; y < ALTO_LINEA; y++) lote.set(t.subarray(c * g.ancho * ALTO_LINEA + y * g.ancho, c * g.ancho * ALTO_LINEA + (y + 1) * g.ancho), i * 3 * n + c * n + y * tramo);
    });
    const salida = await m.lector.run({ [m.lector.inputNames[0]]: new ort.Tensor('float32', lote, [grupo.length, 3, ALTO_LINEA, tramo]) });
    const probs = salida[m.lector.outputNames[0]];
    const [, T, C] = probs.dims as number[];
    const datos = probs.data as Float32Array;
    grupo.forEach((g, i) => (textos[g.i] = decodificarCtc(datos.subarray(i * T * C, (i + 1) * T * C), T, C, m.diccionario)));
  }
  return textos;
}

async function leerLibro(imagen: ImageBitmap): Promise<LineaOcr[]> {
  const m = await cargarLibro();
  fase('modelos');
  const { width: w, height: h } = imagen;
  const cajas = (await cajasDeLineas(m, imagen, { x0: 0, y0: 0, x1: w, y1: h })).map((caja) => ({ caja, vertical: esVertical(caja) }));
  fase('deteccion');
  const textos = await leerCajas(m, imagen, cajas);
  const lineas: LineaOcr[] = [];
  cajas.forEach((c, i) => {
    if (textos[i]) lineas.push({ caja: fraccion(c.caja, w, h), texto: textos[i], vertical: c.vertical });
  });
  fase('lectura');
  return ordenarLineas(quitarFurigana(lineas));
}

/** Los bloques de texto de una página de manga o de cómic, con el detector de globos. */
async function bloquesDeGlobos(detector: ort.InferenceSession, imagen: ImageBitmap) {
  const { width: w, height: h } = imagen;
  const entrada = aTensor(pixeles(imagen, { x0: 0, y0: 0, x1: w, y1: h }, LADO_GLOBOS, LADO_GLOBOS), LADO_GLOBOS, LADO_GLOBOS, (v) => v);
  const det = await detector.run({
    [detector.inputNames[0]]: new ort.Tensor('float32', entrada, [1, 3, LADO_GLOBOS, LADO_GLOBOS]),
    [detector.inputNames[1]]: new ort.Tensor('int64', BigInt64Array.from([BigInt(w), BigInt(h)]), [1, 2]),
  });
  const nombre = (patron: RegExp) => detector.outputNames.find((x) => patron.test(x))!;
  return bloquesDeDetector(det[nombre(/label/)].data as BigInt64Array, det[nombre(/box/)].data as Float32Array, det[nombre(/score/)].data as Float32Array, w, h);
}

/** Las viñetas de la página, buscadas en una miniatura en grises. */
function vinetasDePagina(imagen: ImageBitmap): Caja[] {
  const { width: w, height: h } = imagen;
  const alto = Math.max(1, Math.round((h * ANCHO_VINETAS) / w));
  const px = pixeles(imagen, { x0: 0, y0: 0, x1: w, y1: h }, ANCHO_VINETAS, alto);
  const gris = new Uint8Array(ANCHO_VINETAS * alto);
  for (let i = 0; i < gris.length; i++) gris[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
  return vinetasDeImagen(gris, ANCHO_VINETAS, alto);
}

/** Una caja más alta que ancha que toca el borde de la región: un trazo del dibujo o de otro globo, no un renglón. */
function esTrazoDelBorde(c: Caja, region: Caja): boolean {
  const toca = c.x0 - region.x0 <= 2 || region.x1 - c.x1 <= 2 || c.y0 - region.y0 <= 2 || region.y1 - c.y1 <= 2;
  return toca && c.x1 - c.x0 < c.y1 - c.y0;
}

/**
 * Un cómic en una lengua con espacios: cada bloque del detector de globos, con un margen y ampliado, pasa por el detector
 * de líneas de los libros; sus renglones se leen con el reconocedor de libros y se unen en un solo texto. El orden va por
 * viñetas, de izquierda a derecha.
 */
async function leerComic(imagen: ImageBitmap): Promise<LineaOcr[]> {
  const [detector, m] = await Promise.all([cargarGlobos(), cargarLibro()]);
  fase('modelos');
  const { width: w, height: h } = imagen;
  const bloques = await bloquesDeGlobos(detector, imagen);
  fase('deteccion');
  // Las líneas de todos los bloques, y de qué bloque es cada una: se leen todas juntas.
  const porBloque: Caja[][] = [];
  for (const b of bloques) {
    const margen = Math.max(4, Math.round(0.08 * Math.max(b.x1 - b.x0, b.y1 - b.y0)));
    const region = { x0: Math.max(0, b.x0 - margen), y0: Math.max(0, b.y0 - margen), x1: Math.min(w, b.x1 + margen), y1: Math.min(h, b.y1 + margen) };
    // Las letras de un globo son pequeñas: el recorte se amplía al doble, entre 320 y 960 píxeles de lado.
    const limite = Math.min(960, Math.max(320, 2 * Math.max(region.x1 - region.x0, region.y1 - region.y0)));
    // El margen da aire a las letras que se salen un poco del bloque, pero por él asoman también los globos de al lado: solo
    // valen los renglones con el centro dentro del bloque. Y fuera los trazos estrechos pegados al borde del recorte.
    const dentro = (c: Caja) => (c.x0 + c.x1) / 2 >= b.x0 && (c.x0 + c.x1) / 2 <= b.x1 && (c.y0 + c.y1) / 2 >= b.y0 && (c.y0 + c.y1) / 2 <= b.y1;
    const lineas = (await cajasDeLineas(m, imagen, region, limite)).filter((c) => c.x1 - c.x0 >= 4 && c.y1 - c.y0 >= 4 && dentro(c) && !esTrazoDelBorde(c, region));
    // Si no ve renglones, el bloque entero es uno.
    porBloque.push(lineas.length ? lineas : [b]);
  }
  fase('lineas');
  const todas = porBloque.flatMap((cajas) => cajas.map((caja) => ({ caja, vertical: false })));
  const textos = await leerCajas(m, imagen, todas);
  fase('lectura');
  const salida: LineaOcr[] = [];
  let k = 0;
  bloques.forEach((b, i) => {
    const renglones = porBloque[i].map((caja) => ({ caja: fraccion(caja, w, h), texto: textos[k++], vertical: false }));
    // Un globo no tiene columnas: sus renglones van de arriba abajo, aunque unos sean mucho más cortos que otros.
    const texto = unirRenglones(porRenglones(renglones.filter((r) => r.texto), false).map((r) => r.texto));
    if (texto && !esRuidoComic(texto)) salida.push({ caja: fraccion(b, w, h), texto, vertical: false });
  });
  const orden = ordenMangaPorVinetas(salida, vinetasDePagina(imagen), false);
  fase('orden');
  return orden;
}

async function leerManga(imagen: ImageBitmap): Promise<LineaOcr[]> {
  const m = await cargarManga();
  fase('modelos');
  const { width: w, height: h } = imagen;
  const bloques = await bloquesDeGlobos(m.globos, imagen);
  fase('deteccion');

  const lineas: LineaOcr[] = [];
  for (let inicio = 0; inicio < bloques.length; inicio += LOTE_MANGA) {
    const grupo = bloques.slice(inicio, inicio + LOTE_MANGA);
    const leidos = await leerGlobos(m, imagen, grupo);
    grupo.forEach((bloque, b) => {
      const { texto, confianza } = leidos[b];
      // Fuera las marcas de agua, los números de página y lo suelto que se lee con poca seguridad.
      if (texto && !esRuidoManga(texto, bloque.etiqueta, confianza)) lineas.push({ caja: fraccion(bloque, w, h), texto, vertical: esVertical(bloque) });
    });
  }
  // El orden de lectura va por viñetas, buscadas en una miniatura en grises de la página.
  const orden = ordenMangaPorVinetas(lineas, vinetasDePagina(imagen));
  fase('orden');
  return orden;
}

/**
 * Lee hasta LOTE_MANGA globos a la vez, con formas fijas para que la GPU no compile en cada página ni en cada paso. Con
 * cada texto va su confianza: la media de la probabilidad de cada token elegido.
 */
async function leerGlobos(m: ModelosManga, imagen: ImageBitmap, grupo: Caja[]): Promise<{ texto: string; confianza: number }[]> {
  // Como manga-ocr: cada recorte en grises, a 224 × 224 y en [-1, 1]. Los huecos del lote quedan en negro.
  const lado = LADO_MANGA_OCR * LADO_MANGA_OCR;
  const lote = new Float32Array(LOTE_MANGA * 3 * lado);
  grupo.forEach((caja, b) => {
    const px = pixeles(imagen, caja, LADO_MANGA_OCR, LADO_MANGA_OCR);
    for (let i = 0; i < lado; i++) {
      const v = (0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]) / 255 / 0.5 - 1;
      lote[b * 3 * lado + i] = lote[b * 3 * lado + lado + i] = lote[b * 3 * lado + 2 * lado + i] = v;
    }
  });
  const entradaImagen = m.codificador.inputNames[0];
  const oculto = (await m.codificador.run({ [entradaImagen]: tensorReal(m.codificador, entradaImagen, lote, [LOTE_MANGA, 3, LADO_MANGA_OCR, LADO_MANGA_OCR]) }))[m.codificador.outputNames[0]];
  fase('codificador');

  // Voraz y por lotes: cada paso avanza todos los globos a la vez. La secuencia va rellena hasta el tramo en curso: la
  // atención es causal, así que lo que va detrás no cambia lo que sale en la última posición real.
  const ids = Array.from({ length: LOTE_MANGA }, () => [2]);
  const probabilidades = Array.from({ length: LOTE_MANGA }, () => [] as number[]);
  const fin = Array.from({ length: LOTE_MANGA }, (_, b) => b >= grupo.length);
  const nombreOculto = m.decodificador.inputNames.find((n) => /encoder_hidden_states/.test(n)) ?? 'encoder_hidden_states';
  const paraDecodificador = adaptar(m.decodificador, nombreOculto, oculto);
  for (let paso = 0; paso < MAXIMO_TOKENS - 1 && fin.includes(false); paso++) {
    const largo = ids[0].length;
    const tramo = TRAMOS_SECUENCIA.find((t) => t >= largo) ?? MAXIMO_TOKENS;
    const entrada = new BigInt64Array(LOTE_MANGA * tramo);
    ids.forEach((fila, b) => fila.forEach((t, k) => (entrada[b * tramo + k] = BigInt(t))));
    const feeds: Record<string, ort.Tensor> = {};
    for (const n of m.decodificador.inputNames) {
      if (/input_ids/.test(n)) feeds[n] = new ort.Tensor('int64', entrada, [LOTE_MANGA, tramo]);
      else if (/encoder_hidden_states/.test(n)) feeds[n] = paraDecodificador;
      else if (/encoder_attention_mask/.test(n)) feeds[n] = new ort.Tensor('int64', new BigInt64Array(LOTE_MANGA * oculto.dims[1]).fill(1n), [LOTE_MANGA, oculto.dims[1]]);
    }
    const logits = (await m.decodificador.run(feeds)).logits;
    const V = logits.dims[2] as number;
    const datos = reales(logits);
    for (let b = 0; b < LOTE_MANGA; b++) {
      if (fin[b]) {
        ids[b].push(0);
        continue;
      }
      const base = (b * tramo + largo - 1) * V;
      const siguiente = siguienteToken(datos, base, V, ids[b], m.repetibles);
      if (siguiente === 3 || siguiente < 0) {
        fin[b] = true;
        ids[b].push(0);
      } else {
        ids[b].push(siguiente);
        probabilidades[b].push(probabilidad(datos, base, V, siguiente));
      }
    }
  }
  fase('decodificador');
  return grupo.map((_, b) => ({
    texto: textoDeMangaOcr(ids[b].slice(1), m.vocabulario),
    confianza: probabilidades[b].length ? probabilidades[b].reduce((s, p) => s + p, 0) / probabilidades[b].length : 0,
  }));
}

/** La probabilidad de un token entre los logits de un paso (softmax). */
function probabilidad(logits: ArrayLike<number>, base: number, V: number, token: number): number {
  let maximo = -Infinity;
  for (let v = 0; v < V; v++) if (logits[base + v] > maximo) maximo = logits[base + v];
  let suma = 0;
  for (let v = 0; v < V; v++) suma += Math.exp(logits[base + v] - maximo);
  return Math.exp(logits[base + token] - maximo) / suma;
}

self.onmessage = async (e: MessageEvent<PedidoOcr>) => {
  const p = e.data;
  if (p.tipo === 'liberar') {
    // El detector de globos va en el manga y suelto: cada sesión se libera una vez.
    const sesiones = new Set<unknown>([await globos?.catch(() => null)]);
    for (const promesa of [libro, manga]) {
      const modelos = (await promesa?.catch(() => null)) as Record<string, unknown> | null;
      for (const s of Object.values(modelos ?? {})) sesiones.add(s);
    }
    for (const s of sesiones) {
      const liberable = s as { release?: () => Promise<void> } | null;
      if (typeof liberable?.release === 'function') await liberable.release().catch(() => {});
    }
    libro = null;
    manga = null;
    globos = null;
    return;
  }
  const inicio = performance.now();
  fases = {};
  desde = inicio;
  try {
    const lineas = p.modo === 'manga' ? await leerManga(p.imagen) : p.modo === 'comic' ? await leerComic(p.imagen) : await leerLibro(p.imagen);
    avisar({ tipo: 'lineas', id: p.id, lineas, ms: Math.round(performance.now() - inicio), dispositivo: (await hayGpu()) ? 'webgpu' : 'wasm', fases });
  } catch (err) {
    avisar({ tipo: 'error', id: p.id, mensaje: err instanceof Error ? err.message : String(err) });
  } finally {
    p.imagen.close();
  }
};
