// Modelos transductores (TDT) en el trabajador: el codificador en la GPU y el decodificador, que va token a token, en WASM.
// Transformers.js no los conoce, así que se descargan y se ejecutan aquí, pero se guardan en la misma caché que los demás.
// Sirve igual para Haas-ja que para Parakeet: cambian el vocabulario, el ancho del estado y la precisión de cada grafo.

import * as ort from 'onnxruntime-web/webgpu';
import type { ConfigTdt } from '../compartido/ajustes';
import { crearMel, decodificarTokens, type Mel, parsearLista, parsearPiezas, type TokenConTiempo } from '../nucleo/tdt';
import { type AvanceDescarga, leerModelo as leerArchivo } from './modelos';

export type { AvanceDescarga };

/** Cada marco del codificador son 8 de audio, de 10 ms cada uno. */
const SEGUNDOS_POR_MARCO = 0.08;
/** Tope de tokens en un mismo marco: evita que el decodificador se quede dando vueltas. */
const MAXIMO_POR_MARCO = 10;

type TipoReal = 'float32' | 'float16';

interface Cargado {
  codificador: ort.InferenceSession;
  decodificador: ort.InferenceSession;
  piezas: string[];
  blanco: number;
  mel: (audio: Float32Array) => Mel;
  config: ConfigTdt;
  tipos: { audio: TipoReal; marco: TipoReal; estado: TipoReal };
  forma: { capas: number; ancho: number };
}

let cargado: Cargado | null = null;

export async function liberarTdt() {
  const c = cargado;
  cargado = null;
  await c?.codificador.release().catch(() => {});
  await c?.decodificador.release().catch(() => {});
}

interface MetadatoEntrada {
  name: string;
  type?: string;
  shape?: (number | string)[];
}

const metadatos = (s: ort.InferenceSession) => ((s as unknown as { inputMetadata?: MetadatoEntrada[] }).inputMetadata ?? []);
const tipoDe = (s: ort.InferenceSession, nombre: string): TipoReal => (metadatos(s).find((m) => m.name === nombre)?.type === 'float16' ? 'float16' : 'float32');

/** Un tensor real en la precisión que pide el grafo: algunos modelos en fp16 también quieren las entradas en fp16. */
function tensorReal(tipo: TipoReal, datos: Float32Array, forma: number[]): ort.Tensor {
  if (tipo === 'float16') {
    const Float16 = (globalThis as unknown as { Float16Array?: new (d: Float32Array) => ArrayLike<number> }).Float16Array;
    if (!Float16) throw new Error('El navegador no admite Float16Array');
    return new ort.Tensor('float16', new Float16(datos) as never, forma);
  }
  return new ort.Tensor('float32', datos, forma);
}

export async function cargarTdt(id: string, config: ConfigTdt, conGpu: boolean, avance: AvanceDescarga) {
  await liberarTdt();
  const url = (archivo: string) => `https://huggingface.co/${id}/resolve/${config.revision}/${archivo}`;
  const leer = (archivo: string | undefined) => (archivo ? leerArchivo(url(archivo), archivo, avance) : Promise.resolve(null));
  const [vocabulario, grafoCodificador, datosCodificador, grafoDecodificador, datosDecodificador] = await Promise.all([
    leer(config.vocabulario),
    leer(config.codificador),
    leer(config.datosCodificador),
    leer(config.decodificador),
    leer(config.datosDecodificador),
  ]);
  const nombre = (ruta: string) => ruta.split('/').pop() as string;
  const externos = (ruta: string | undefined, datos: Uint8Array | null) => (ruta && datos ? { externalData: [{ path: nombre(ruta), data: datos }] } : {});
  const codificador = await ort.InferenceSession.create(grafoCodificador as Uint8Array, {
    executionProviders: conGpu ? ['webgpu', 'wasm'] : ['wasm'],
    ...externos(config.datosCodificador, datosCodificador),
  });
  const decodificador = await ort.InferenceSession.create(grafoDecodificador as Uint8Array, {
    executionProviders: ['wasm'],
    ...externos(config.datosDecodificador, datosDecodificador),
  });
  const piezas = config.formatoVocabulario === 'lista' ? parsearLista(new TextDecoder().decode(vocabulario as Uint8Array)) : parsearPiezas(vocabulario as Uint8Array);
  // El blanco va justo detrás del vocabulario, salvo que la lista lo incluya con su nombre.
  const conNombre = piezas.indexOf('<blk>');
  const forma = metadatos(decodificador).find((m) => m.name === 'input_states_1')?.shape;
  cargado = {
    codificador,
    decodificador,
    piezas,
    blanco: conNombre >= 0 ? conNombre : piezas.length,
    mel: crearMel({ nMels: config.nMels, bf16: config.bf16 }),
    config,
    tipos: { audio: tipoDe(codificador, 'audio_signal'), marco: tipoDe(decodificador, 'encoder_outputs'), estado: tipoDe(decodificador, 'input_states_1') },
    forma: {
      capas: typeof forma?.[0] === 'number' ? forma[0] : config.capasEstado,
      ancho: typeof forma?.[2] === 'number' ? forma[2] : config.anchoEstado,
    },
  };
}

export const tdtCargado = () => cargado !== null;

/** Decodificación voraz de TDT: en cada marco, un token o un salto de los marcos que dure el silencio. */
export async function transcribirTdt(pcm: Float32Array): Promise<TokenConTiempo[]> {
  if (!cargado) throw new Error('El modelo no está cargado');
  const { codificador, decodificador, piezas, blanco, mel, config, tipos, forma } = cargado;
  const { datos, marcos, validos } = mel(pcm);
  if (validos < 2) return [];
  const salida = await codificador.run({
    audio_signal: tensorReal(tipos.audio, datos, [1, config.nMels, marcos]),
    length: new ort.Tensor('int64', BigInt64Array.from([BigInt(validos)]), [1]),
  });
  const encoded = salida.outputs;
  const nT = Number(salida.encoded_lengths.data[0]);
  const dimension = encoded.dims[1];
  const anchoT = encoded.dims[2];
  const valores = encoded.data as ArrayLike<number>;
  const marco = (t: number) => {
    const m = new Float32Array(dimension);
    // [B, dimensión, T]: el tiempo es el último eje.
    for (let d = 0; d < dimension; d++) m[d] = valores[d * anchoT + t];
    return tensorReal(tipos.marco, m, [1, dimension, 1]);
  };

  const estadoVacio = () => tensorReal(tipos.estado, new Float32Array(forma.capas * forma.ancho), [forma.capas, 1, forma.ancho]);
  let estado1: ort.Tensor = estadoVacio();
  let estado2: ort.Tensor = estadoVacio();
  let ultimo = blanco;
  const largoObjetivo = new ort.Tensor('int32', Int32Array.from([1]), [1]);
  const ids: number[] = [];
  const instantes: number[] = [];
  let t = 0;
  let ultimoMarco = -1;
  let enEsteMarco = 0;

  while (t < nT) {
    let token = blanco;
    let marcoToken = t;
    let n1: ort.Tensor = estado1;
    let n2: ort.Tensor = estado2;
    for (;;) {
      const r = await decodificador.run({
        encoder_outputs: marco(t),
        targets: new ort.Tensor('int32', Int32Array.from([ultimo]), [1, 1]),
        target_length: largoObjetivo,
        input_states_1: estado1,
        input_states_2: estado2,
      });
      const l = r.outputs.data as ArrayLike<number>;
      // Tras los tokens y el blanco vienen las duraciones: cuántos marcos avanzar.
      const inicioDuracion = blanco + 1;
      const duraciones = l.length - inicioDuracion;
      let k = 0;
      for (let i = 1; i < inicioDuracion; i++) if (l[i] > l[k]) k = i;
      let d = 0;
      for (let i = 1; i < duraciones; i++) if (l[inicioDuracion + i] > l[inicioDuracion + d]) d = i;
      if (k === blanco && d === 0) d = 1;
      token = k;
      marcoToken = t;
      n1 = r.output_states_1;
      n2 = r.output_states_2;
      t += d;
      if (k !== blanco || t >= nT) break;
    }
    if (token !== blanco) {
      ids.push(token);
      instantes.push(marcoToken * SEGUNDOS_POR_MARCO);
      enEsteMarco = marcoToken === ultimoMarco ? enEsteMarco + 1 : 1;
      ultimoMarco = marcoToken;
      estado1 = n1;
      estado2 = n2;
      ultimo = token;
      if (enEsteMarco >= MAXIMO_POR_MARCO && ultimoMarco === t) t += 1;
    }
  }
  encoded.dispose();
  const textos = decodificarTokens(ids, piezas);
  // Un carácter escrito byte a byte deja tokens vacíos: su instante lo da el primero de ellos.
  const tokens: TokenConTiempo[] = [];
  let pendiente: number | null = null;
  for (const [i, texto] of textos.entries()) {
    if (!texto) {
      pendiente ??= instantes[i];
      continue;
    }
    tokens.push({ texto, t: pendiente ?? instantes[i] });
    pendiente = null;
  }
  return tokens;
}
