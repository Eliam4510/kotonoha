// El reconocimiento de texto (OCR) del visor, en un trabajador: la página no se congela mientras lee. Dos juegos de modelos,
// medidos con libros reales antes de elegirlos. Para libros impresos, PP-OCRv5 (21 MB): entre un 1 y un 4 % de error por
// carácter, en un segundo por página. Para el manga, un detector de globos y manga-ocr (178 MB), que lee el texto vertical
// y no confunde el furigana: menos de un 1 % en tres páginas de un tomo, en un segundo y medio por página. Sobre lo que
// leen los modelos, el manga deja repetir los signos («……»), quita las marcas de agua y lo suelto dudoso, y ordena los
// globos por viñetas; en 18 páginas de cinco series, en el navegador, de 4,3 % a 2,8 % de error y de 11 falsos a 4.
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
  esRuidoManga,
  esVertical,
  idsRepetibles,
  type LineaOcr,
  medidaDeDeteccion,
  ordenarLineas,
  ordenMangaPorVinetas,
  quitarFurigana,
  siguienteToken,
  textoDeMangaOcr,
  vinetasDeImagen,
} from '../nucleo/ocr';

export type ModoOcr = 'libro' | 'manga';

export type PedidoOcr = { tipo: 'leer'; id: number; modo: ModoOcr; imagen: ImageBitmap } | { tipo: 'liberar' };

export type RespuestaOcr =
  | { tipo: 'descarga'; archivo: string; cargado: number; total: number }
  | { tipo: 'lineas'; id: number; lineas: LineaOcr[]; ms: number; dispositivo: string; fases: Record<string, number> }
  | { tipo: 'error'; id: number; mensaje: string };

/** Los modelos, fijados a un commit de Hugging Face: se descarga siempre lo que se midió. */
const MODELOS = {
  libro: { repositorio: 'nakamura196/ppocrv5-mobile-web-onnx', revision: 'dc7e2271c00d961a4c0a38dcebe23beb735ba33e', detector: 'PP-OCRv5_mobile_det.onnx', lector: 'PP-OCRv5_mobile_rec.onnx', diccionario: 'PP-OCRv5_mobile_rec.dict.json' },
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

async function sesion(datos: Uint8Array, enGpu: boolean): Promise<ort.InferenceSession> {
  return ort.InferenceSession.create(datos, { executionProviders: enGpu && (await hayGpu()) ? ['webgpu', 'wasm'] : ['wasm'] });
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

function cargarLibro(): Promise<ModelosLibro> {
  libro ??= (async () => {
    const m = MODELOS.libro;
    const leer = (archivo: string) => descargar(m.repositorio, m.revision, archivo);
    const [det, rec, dic] = await Promise.all([leer(m.detector), leer(m.lector), leer(m.diccionario)]);
    return { detector: await sesion(det, true), lector: await sesion(rec, true), diccionario: JSON.parse(new TextDecoder().decode(dic)) as string[] };
  })().catch((e) => {
    libro = null;
    throw e;
  });
  return libro;
}

function cargarManga(): Promise<ModelosManga> {
  manga ??= (async () => {
    const g = MODELOS.globos;
    const o = MODELOS.mangaOcr;
    const v = MODELOS.vocabulario;
    const [globos, codificador, decodificador, vocabulario] = await Promise.all([
      descargar(g.repositorio, g.revision, g.archivo),
      descargar(o.repositorio, o.revision, o.codificador),
      descargar(o.repositorio, o.revision, o.decodificador),
      descargar(v.repositorio, v.revision, v.archivo),
    ]);
    const lista = new TextDecoder().decode(vocabulario).split(/\r?\n/);
    return {
      globos: await sesion(globos, true),
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

async function leerLibro(imagen: ImageBitmap): Promise<LineaOcr[]> {
  const m = await cargarLibro();
  fase('modelos');
  const { width: w, height: h } = imagen;
  const medida = medidaDeDeteccion(w, h);
  const media = [0.485, 0.456, 0.406];
  const desv = [0.229, 0.224, 0.225];
  const entrada = aTensor(pixeles(imagen, { x0: 0, y0: 0, x1: w, y1: h }, medida.w, medida.h), medida.w, medida.h, (v, c) => (v - media[c]) / desv[c], true);
  const det = await m.detector.run({ [m.detector.inputNames[0]]: new ort.Tensor('float32', entrada, [1, 3, medida.h, medida.w]) });
  const cajas = cajasDeMapa(det[m.detector.outputNames[0]].data as Float32Array, medida.w, medida.h, w, h);
  fase('deteccion');

  // Cada línea a 48 píxeles de alto; las de ancho parecido se leen de una vez, rellenas hasta el mismo ancho.
  const grupos = new Map<number, { caja: Caja; vertical: boolean; ancho: number }[]>();
  for (const caja of cajas) {
    const vertical = esVertical(caja);
    const proporcion = vertical ? (caja.y1 - caja.y0) / (caja.x1 - caja.x0) : (caja.x1 - caja.x0) / (caja.y1 - caja.y0);
    const ancho = Math.min(ANCHO_MAXIMO, Math.max(16, Math.round(ALTO_LINEA * proporcion)));
    const tramo = Math.ceil(ancho / TRAMO_ANCHO) * TRAMO_ANCHO;
    grupos.set(tramo, [...(grupos.get(tramo) ?? []), { caja, vertical, ancho }]);
  }
  const lineas: LineaOcr[] = [];
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
    grupo.forEach((g, i) => {
      const texto = decodificarCtc(datos.subarray(i * T * C, (i + 1) * T * C), T, C, m.diccionario);
      if (texto) lineas.push({ caja: fraccion(g.caja, w, h), texto, vertical: g.vertical });
    });
  }
  fase('lectura');
  return ordenarLineas(quitarFurigana(lineas));
}

async function leerManga(imagen: ImageBitmap): Promise<LineaOcr[]> {
  const m = await cargarManga();
  fase('modelos');
  const { width: w, height: h } = imagen;
  const entrada = aTensor(pixeles(imagen, { x0: 0, y0: 0, x1: w, y1: h }, LADO_GLOBOS, LADO_GLOBOS), LADO_GLOBOS, LADO_GLOBOS, (v) => v);
  const det = await m.globos.run({
    [m.globos.inputNames[0]]: new ort.Tensor('float32', entrada, [1, 3, LADO_GLOBOS, LADO_GLOBOS]),
    [m.globos.inputNames[1]]: new ort.Tensor('int64', BigInt64Array.from([BigInt(w), BigInt(h)]), [1, 2]),
  });
  const nombre = (patron: RegExp) => m.globos.outputNames.find((x) => patron.test(x))!;
  const bloques = bloquesDeDetector(det[nombre(/label/)].data as BigInt64Array, det[nombre(/box/)].data as Float32Array, det[nombre(/score/)].data as Float32Array, w, h);
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
  const alto = Math.max(1, Math.round((h * ANCHO_VINETAS) / w));
  const px = pixeles(imagen, { x0: 0, y0: 0, x1: w, y1: h }, ANCHO_VINETAS, alto);
  const gris = new Uint8Array(ANCHO_VINETAS * alto);
  for (let i = 0; i < gris.length; i++) gris[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
  const orden = ordenMangaPorVinetas(lineas, vinetasDeImagen(gris, ANCHO_VINETAS, alto));
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
    for (const promesa of [libro, manga]) {
      const modelos = (await promesa?.catch(() => null)) as Record<string, unknown> | null;
      for (const s of Object.values(modelos ?? {})) {
        const liberable = s as { release?: () => Promise<void> };
        if (typeof liberable?.release === 'function') await liberable.release().catch(() => {});
      }
    }
    libro = null;
    manga = null;
    return;
  }
  const inicio = performance.now();
  fases = {};
  desde = inicio;
  try {
    const lineas = p.modo === 'manga' ? await leerManga(p.imagen) : await leerLibro(p.imagen);
    avisar({ tipo: 'lineas', id: p.id, lineas, ms: Math.round(performance.now() - inicio), dispositivo: (await hayGpu()) ? 'webgpu' : 'wasm', fases });
  } catch (err) {
    avisar({ tipo: 'error', id: p.id, mensaje: err instanceof Error ? err.message : String(err) });
  } finally {
    p.imagen.close();
  }
};
