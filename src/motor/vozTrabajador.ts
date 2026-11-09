// Las voces neuronales del inglés y del alemán, en un trabajador aparte: Kokoro-82M (Apache-2.0) para el inglés y Piper
// con la voz Thorsten (MIT, entrenada con un conjunto de datos CC0) para el alemán, las dos con ONNX en el procesador.
// Los fonemas salen de piper-phonemize, el espeak-ng con el que se entrenó Piper, en WebAssembly; sus datos van en la
// extensión con solo los diccionarios de esas dos lenguas. Los modelos se bajan una vez, fijados a un commit de Hugging
// Face, y se guardan en su propia caché.

import * as ort from 'onnxruntime-web/webgpu';
import { fonemasKokoro, frasesParaVoz, idsKokoro, prepararTextoIngles, unirAudio } from '../nucleo/vozNeuronal';
import { leerModelo, urlDeModelo } from './modelos';

export type MotorVoz = 'kokoro' | 'piper';

export type PedidoVoz = { tipo: 'leer'; id: number; motor: MotorVoz; texto: string; voz: string; velocidad: number } | { tipo: 'liberar' };

export type RespuestaVoz =
  | { tipo: 'descarga'; archivo: string; cargado: number; total: number }
  | { tipo: 'audio'; id: number; muestras: Float32Array; frecuencia: number; ms: number }
  | { tipo: 'error'; id: number; mensaje: string };

export const CACHE_MODELOS_VOZ = 'kotonoha-modelos-voz';

const MODELOS = {
  kokoro: {
    repositorio: 'onnx-community/Kokoro-82M-v1.0-ONNX',
    revision: '1939ad2a8e416c0acfeecc08a694d14ef25f2231',
    modelo: 'onnx/model_quantized.onnx',
    tokenizador: 'tokenizer.json',
    frecuencia: 24000,
  },
  piper: {
    repositorio: 'rhasspy/piper-voices',
    revision: 'e7229f7d33a10e145e109b886d661984201ac3c4',
    modelo: 'de/de_DE/thorsten/medium/de_DE-thorsten-medium.onnx',
    configuracion: 'de/de_DE/thorsten/medium/de_DE-thorsten-medium.onnx.json',
  },
};

// El motor de ONNX se sirve desde la propia extensión, como para Whisper y el OCR.
ort.env.wasm.wasmPaths = new URL('./ort/', self.location.href).href;
ort.env.logLevel = 'error';

const avisar = (r: RespuestaVoz, transferir: Transferable[] = []) => self.postMessage(r, { transfer: transferir });
const avance = (p: { archivo: string; cargado: number; total: number }) => avisar({ tipo: 'descarga', archivo: p.archivo, cargado: p.cargado, total: p.total });
const descargar = (repositorio: string, revision: string, archivo: string) => leerModelo(urlDeModelo(repositorio, revision, archivo), archivo.split('/').pop()!, avance, CACHE_MODELOS_VOZ);
const sesion = (datos: Uint8Array) => ort.InferenceSession.create(datos, { executionProviders: ['wasm'] });

// ---------- Fonemas ----------

interface Fonetizador {
  callMain(argumentos: string[]): number;
}
interface Fonemas {
  phoneme_ids: number[];
  phonemes: string[];
}

let fonetizador: Promise<{ m: Fonetizador; salida: string[] }> | null = null;

function cargarFonetizador() {
  fonetizador ??= (async () => {
    const base = new URL('./voz/', self.location.href).href;
    const { default: crear } = (await import(`${base}piper_phonemize.mjs`)) as { default: (o: object) => Promise<Fonetizador> };
    const salida: string[] = [];
    const m = await crear({ print: (t: string) => salida.push(t), printErr: () => {}, locateFile: (f: string) => base + f });
    return { m, salida };
  })().catch((e) => {
    fonetizador = null;
    throw e;
  });
  return fonetizador;
}

/** Los fonemas de una frase con la voz de espeak-ng indicada («en-us», «en», «de»). */
async function fonetizar(texto: string, voz: string): Promise<Fonemas> {
  const f = await cargarFonetizador();
  f.salida.length = 0;
  f.m.callMain(['-l', voz, '--input', JSON.stringify([{ text: texto }]), '--espeak_data', '/espeak-ng-data']);
  const linea = f.salida.find((x) => x.startsWith('{'));
  if (!linea) throw new Error('espeak-ng no devolvió fonemas');
  return JSON.parse(linea) as Fonemas;
}

// ---------- Kokoro ----------

interface Kokoro {
  sesion: ort.InferenceSession;
  vocabulario: Map<string, number>;
  voces: Map<string, Float32Array>;
}
let kokoro: Promise<Kokoro> | null = null;

/**
 * Kokoro va en el procesador, cuantizado (92 MB). En la GPU, con WebGPU, sus tres versiones (fp32, fp16 y cuantizada)
 * dieron audio roto en una Radeon RX 9060 XT (valores de cientos o NaN), y en el procesador sale bien: unos 5 s para
 * 4 s de habla, que la caché solo hace esperar la primera vez.
 */
function cargarKokoro(): Promise<Kokoro> {
  kokoro ??= (async () => {
    const k = MODELOS.kokoro;
    const [modelo, tokenizador] = await Promise.all([descargar(k.repositorio, k.revision, k.modelo), descargar(k.repositorio, k.revision, k.tokenizador)]);
    const vocabulario = new Map(Object.entries((JSON.parse(new TextDecoder().decode(tokenizador)) as { model: { vocab: Record<string, number> } }).model.vocab));
    return { sesion: await sesion(modelo), vocabulario, voces: new Map() };
  })().catch((e) => {
    kokoro = null;
    throw e;
  });
  return kokoro;
}

/** El estilo de una voz de Kokoro: 510 filas de 256, una por largo de la frase en fonemas. */
async function vozKokoro(k: Kokoro, voz: string): Promise<Float32Array> {
  if (!/^[ab][fm]_[a-z]+$/.test(voz)) throw new Error(`Voz de Kokoro desconocida: ${voz}`);
  let v = k.voces.get(voz);
  if (!v) {
    const datos = await descargar(MODELOS.kokoro.repositorio, MODELOS.kokoro.revision, `voices/${voz}.bin`);
    v = new Float32Array(datos.buffer.slice(datos.byteOffset, datos.byteOffset + datos.byteLength));
    k.voces.set(voz, v);
  }
  return v;
}

async function leerKokoro(texto: string, voz: string, velocidad: number): Promise<{ muestras: Float32Array; frecuencia: number }> {
  const k = await cargarKokoro();
  const estilo = await vozKokoro(k, voz);
  // Las voces que empiezan por «a» son del inglés americano; las de «b», del británico.
  const americano = voz.startsWith('a');
  const trozos: Float32Array[] = [];
  for (const frase of frasesParaVoz(prepararTextoIngles(texto))) {
    const { phonemes } = await fonetizar(frase, americano ? 'en-us' : 'en');
    const ids = idsKokoro(fonemasKokoro(phonemes.join(''), americano), k.vocabulario);
    if (ids.length <= 2) continue;
    const fila = Math.min(Math.max(ids.length - 2, 0), 509);
    const salida = await k.sesion.run({
      input_ids: new ort.Tensor('int64', BigInt64Array.from(ids, (x) => BigInt(x)), [1, ids.length]),
      style: new ort.Tensor('float32', estilo.slice(fila * 256, fila * 256 + 256), [1, 256]),
      speed: new ort.Tensor('float32', new Float32Array([velocidad]), [1]),
    });
    trozos.push(new Float32Array(salida[k.sesion.outputNames[0]].data as Float32Array));
  }
  return { muestras: unirAudio(trozos, MODELOS.kokoro.frecuencia), frecuencia: MODELOS.kokoro.frecuencia };
}

// ---------- Piper ----------

interface Piper {
  sesion: ort.InferenceSession;
  voz: string;
  frecuencia: number;
  escalas: [number, number, number];
}
let piper: Promise<Piper> | null = null;

function cargarPiper(): Promise<Piper> {
  piper ??= (async () => {
    const p = MODELOS.piper;
    const [modelo, configuracion] = await Promise.all([descargar(p.repositorio, p.revision, p.modelo), descargar(p.repositorio, p.revision, p.configuracion)]);
    const c = JSON.parse(new TextDecoder().decode(configuracion)) as { audio: { sample_rate: number }; espeak: { voice: string }; inference: { noise_scale: number; length_scale: number; noise_w: number } };
    return { sesion: await sesion(modelo), voz: c.espeak.voice, frecuencia: c.audio.sample_rate, escalas: [c.inference.noise_scale, c.inference.length_scale, c.inference.noise_w] as [number, number, number] };
  })().catch((e) => {
    piper = null;
    throw e;
  });
  return piper;
}

async function leerPiper(texto: string, velocidad: number): Promise<{ muestras: Float32Array; frecuencia: number }> {
  const p = await cargarPiper();
  const trozos: Float32Array[] = [];
  for (const frase of frasesParaVoz(texto)) {
    const { phoneme_ids: ids } = await fonetizar(frase, p.voz);
    if (ids.length <= 2) continue;
    const salida = await p.sesion.run({
      input: new ort.Tensor('int64', BigInt64Array.from(ids, (x) => BigInt(x)), [1, ids.length]),
      input_lengths: new ort.Tensor('int64', BigInt64Array.from([BigInt(ids.length)]), [1]),
      // Más velocidad es menos duración por fonema.
      scales: new ort.Tensor('float32', new Float32Array([p.escalas[0], p.escalas[1] / velocidad, p.escalas[2]]), [3]),
    });
    trozos.push(new Float32Array(salida[p.sesion.outputNames[0]].data as Float32Array));
  }
  return { muestras: unirAudio(trozos, p.frecuencia), frecuencia: p.frecuencia };
}

// ---------- Mensajes ----------

let cola: Promise<unknown> = Promise.resolve();

self.onmessage = (e: MessageEvent<PedidoVoz>) => {
  const p = e.data;
  // Una lectura detrás de otra: ONNX en un solo hilo no gana nada leyendo dos a la vez.
  cola = cola.then(async () => {
    if (p.tipo === 'liberar') {
      for (const promesa of [kokoro, piper]) await (await promesa?.catch(() => null))?.sesion.release().catch(() => {});
      kokoro = null;
      piper = null;
      return;
    }
    const inicio = performance.now();
    try {
      const { muestras, frecuencia } = p.motor === 'piper' ? await leerPiper(p.texto, p.velocidad) : await leerKokoro(p.texto, p.voz, p.velocidad);
      avisar({ tipo: 'audio', id: p.id, muestras, frecuencia, ms: Math.round(performance.now() - inicio) }, [muestras.buffer]);
    } catch (err) {
      avisar({ tipo: 'error', id: p.id, mensaje: err instanceof Error ? err.message : String(err) });
    }
  });
};
