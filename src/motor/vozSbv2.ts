// Las voces de AivisHub (Style-Bert-VITS2 JP-Extra) dentro del trabajador de voz. Reciben las oraciones ya pasadas a
// fonemas, tonos y word2ph por la lengua, en el motor. El BERT va en el procesador: en la gráfica se calcula en fp16 y
// cambia algo la entonación, y en el procesador da lo mismo que AivisSpeech. La voz va en la gráfica con WebGPU, donde
// se midió idéntica a la del procesador (correlación 1,0000 el 2026-11-20); sin WebGPU, también en el procesador, más
// lenta que el habla. Cada archivo se baja una vez y se comprueba con su SHA-256 antes de usarlo.

import * as ort from 'onnxruntime-web/webgpu';
import { leerAivmx, type VozAivm } from '../nucleo/aivm';
import { type EntradaSbv2, expandirRasgos, leerVocabulario, PARAMETROS_SBV2, tensoresSbv2, tokensBert, vectorDeEstilo } from '../nucleo/sbv2';
import { type AvanceDescarga, CACHE_MODELOS_VOZ, enCache, leerModelo } from './modelos';

/** Un archivo de las voces: dónde está, cómo se llama al enseñar la descarga, su huella y su tamaño. */
export interface ArchivoVoz {
  url: string;
  nombre: string;
  sha256: string;
  bytes: number;
}

export interface PedidoSbv2 {
  bert: { modelo: ArchivoVoz; vocabulario: ArchivoVoz };
  voz: ArchivoVoz;
  hablante: number;
  estilo: number;
  velocidad: number;
  oraciones: { entrada: EntradaSbv2; pausaAntesS: number }[];
}

/** Las voces cargadas a la vez: cada una ocupa unos 300 MB en la gráfica. */
const VOCES_CARGADAS = 2;

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');

/** Si ya está en la caché, sin leerlo. */
export const presente = (url: string): Promise<boolean> => enCache(url, CACHE_MODELOS_VOZ);

/** El archivo, de la caché o bajado ahora; si se bajó ahora y su huella no es la esperada, se borra y es un error. */
export async function obtener(a: ArchivoVoz, avance: AvanceDescarga): Promise<Uint8Array> {
  const nuevo = !(await presente(a.url));
  const datos = await leerModelo(a.url, a.nombre, avance, CACHE_MODELOS_VOZ);
  if (nuevo && hex(await crypto.subtle.digest('SHA-256', datos as Uint8Array<ArrayBuffer>)) !== a.sha256) {
    await (await caches.open(CACHE_MODELOS_VOZ)).delete(a.url);
    throw new Error(`${a.nombre}: la descarga no es la esperada`);
  }
  return datos;
}

// ---------- Las sesiones ----------

interface Bert {
  sesion: ort.InferenceSession;
  vocabulario: Map<string, number>;
}
interface VozCargada {
  sesion: ort.InferenceSession;
  aivm: VozAivm;
  dispositivo: 'webgpu' | 'wasm';
}

let bert: Promise<Bert> | null = null;
const voces = new Map<string, Promise<VozCargada>>();
const sinAviso: AvanceDescarga = () => {};

function cargarBert(p: PedidoSbv2['bert']): Promise<Bert> {
  bert ??= (async () => {
    const [modelo, vocabulario] = await Promise.all([obtener(p.modelo, sinAviso), obtener(p.vocabulario, sinAviso)]);
    const sesion = await ort.InferenceSession.create(modelo, { executionProviders: ['wasm'] });
    return { sesion, vocabulario: leerVocabulario(new TextDecoder().decode(vocabulario)) };
  })().catch((e) => {
    bert = null;
    throw e;
  });
  return bert;
}

async function hayWebGpu(): Promise<boolean> {
  try {
    return !!(await (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu?.requestAdapter());
  } catch {
    return false;
  }
}

function cargarVoz(a: ArchivoVoz, forzarProcesador = false): Promise<VozCargada> {
  let v = voces.get(a.url);
  if (v && !forzarProcesador) {
    // La más reciente, al final: así se suelta antes la que lleva más sin usarse.
    voces.delete(a.url);
    voces.set(a.url, v);
    return v;
  }
  // La de la gráfica que dio audio roto se suelta: ocupa unos 300 MB de memoria de vídeo.
  if (v) void v.then((x) => x.sesion.release()).catch(() => {});
  v = (async () => {
    const datos = await obtener(a, sinAviso);
    const aivm = leerAivmx(datos);
    const dispositivo = !forzarProcesador && (await hayWebGpu()) ? 'webgpu' : 'wasm';
    const sesion = await ort.InferenceSession.create(datos, { executionProviders: [dispositivo] });
    return { sesion, aivm, dispositivo } as VozCargada;
  })();
  v.catch(() => voces.delete(a.url));
  voces.set(a.url, v);
  while (voces.size > VOCES_CARGADAS) {
    const [vieja, promesa] = voces.entries().next().value!;
    voces.delete(vieja);
    void promesa.then((x) => x.sesion.release()).catch(() => {});
  }
  return v;
}

export async function liberarSbv2(): Promise<void> {
  const todas = [...voces.values(), ...(bert ? [bert] : [])];
  voces.clear();
  bert = null;
  for (const p of todas) await (await p.catch(() => null))?.sesion.release().catch(() => {});
}

// ---------- Leer ----------

const i64 = (xs: number[]) => new ort.Tensor('int64', BigInt64Array.from(xs, (x) => BigInt(x)), [1, xs.length]);
const escalar = (n: number) => new ort.Tensor('float32', Float32Array.from([n]), []);

/** Valores que una voz sana no da: en la gráfica, Kokoro dio audio roto así en una Radeon. */
const roto = (audio: Float32Array) => audio.some((x) => !Number.isFinite(x) || Math.abs(x) > 10);

async function rasgosBert(b: Bert, entrada: EntradaSbv2): Promise<Float32Array> {
  const tokens = tokensBert(entrada.textoBert, b.vocabulario);
  const salida = await b.sesion.run({ input_ids: i64(tokens), attention_mask: i64(tokens.map(() => 1)) });
  const t = salida[b.sesion.outputNames[0]];
  const datos = await t.getData();
  if (datos instanceof Float32Array) return datos;
  throw new Error(`El BERT dio ${t.type} y se esperaba float32`);
}

async function sintetizar(v: VozCargada, entrada: EntradaSbv2, rasgos: Float32Array, p: PedidoSbv2): Promise<Float32Array> {
  const t = tensoresSbv2(entrada);
  const fonemas = t.x.length;
  const estilo = vectorDeEstilo(v.aivm.estilos, p.estilo, PARAMETROS_SBV2.pesoEstilo, v.aivm.dimension);
  const salida = await v.sesion.run(
    {
      x_tst: i64(t.x),
      x_tst_lengths: new ort.Tensor('int64', BigInt64Array.from([BigInt(fonemas)]), [1]),
      sid: new ort.Tensor('int64', BigInt64Array.from([BigInt(p.hablante)]), [1]),
      tones: i64(t.tonos),
      language: i64(t.lenguas),
      bert: new ort.Tensor('float32', expandirRasgos(rasgos, t.word2ph), [1, 1024, fonemas]),
      style_vec: new ort.Tensor('float32', estilo, [1, v.aivm.dimension]),
      // Más velocidad es menos duración por fonema.
      length_scale: escalar(PARAMETROS_SBV2.duracion / p.velocidad),
      sdp_ratio: escalar(PARAMETROS_SBV2.sdp),
      noise_scale: escalar(PARAMETROS_SBV2.ruido),
      noise_scale_w: escalar(PARAMETROS_SBV2.ruidoDuracion),
    },
    ['output']
  );
  return Float32Array.from((await salida.output.getData()) as Float32Array);
}

/**
 * Las oraciones leídas una tras otra, con su pausa delante. Dice también lo que tardó solo el cálculo, y si hubo que
 * cargar los modelos antes: esa primera vez (con la compilación de la gráfica) no sirve para medir el equipo.
 */
export async function leerSbv2(p: PedidoSbv2): Promise<{ muestras: Float32Array; frecuencia: number; dispositivo: string; msCalculo: number; recienCargada: boolean }> {
  const recienCargada = !bert || !voces.has(p.voz.url);
  const b = await cargarBert(p.bert);
  let v = await cargarVoz(p.voz);
  const inicio = performance.now();
  const trozos: { audio: Float32Array; pausaAntesS: number }[] = [];
  for (const o of p.oraciones) {
    const rasgos = await rasgosBert(b, o.entrada);
    let audio = await sintetizar(v, o.entrada, rasgos, p);
    if (roto(audio) && v.dispositivo === 'webgpu') {
      // La gráfica dio audio roto: esta voz, en el procesador, desde ahora.
      v = await cargarVoz(p.voz, true);
      audio = await sintetizar(v, o.entrada, rasgos, p);
    }
    trozos.push({ audio, pausaAntesS: o.pausaAntesS });
  }
  const msCalculo = performance.now() - inicio;
  const frecuencia = v.aivm.ficha.frecuencia;
  const total = trozos.reduce((n, t) => n + t.audio.length + Math.round(t.pausaAntesS * frecuencia), 0);
  const muestras = new Float32Array(total);
  let i = 0;
  for (const t of trozos) {
    i += Math.round(t.pausaAntesS * frecuencia);
    muestras.set(t.audio, i);
    i += t.audio.length;
  }
  return { muestras, frecuencia, dispositivo: v.dispositivo, msCalculo, recienCargada };
}
