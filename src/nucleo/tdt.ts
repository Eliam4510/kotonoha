// Lógica pura de los modelos transductores (TDT), como Haas-ja o Parakeet: las características de audio que esperan, el
// vocabulario y cómo se convierten sus tokens, cada uno con su instante, en segmentos de subtítulo.

import { FRECUENCIA, partirTexto, type ReglasTranscripcion, type SegmentoWhisper } from './transcripcion';

const N_FFT = 512;
const VENTANA = 400;
const SALTO = 160;
const RELLENO_A = 16;

export interface ConfigMel {
  nMels: number;
  /** Algunos modelos guardan ventana y banco de filtros en bfloat16 y calculan con eso: hay que redondear igual. */
  bf16: boolean;
}

function aBf16(valor: number): number {
  const f = new Float32Array([valor]);
  const b = new Uint32Array(f.buffer);
  b[0] = ((b[0] + 0x7fff + ((b[0] >>> 16) & 1)) & 0xffff0000) >>> 0;
  return f[0];
}

// La escala mel de Slaney, como librosa.
const PASO_LOG = Math.log(6.4) / 27;
const hzAMel = (f: number) => (f >= 1000 ? 15 + Math.log(f / 1000) / PASO_LOG : (3 * f) / 200);
const melAHz = (m: number) => (m >= 15 ? 1000 * Math.exp(PASO_LOG * (m - 15)) : (200 * m) / 3);

function bancoMel({ nMels, bf16 }: ConfigMel): Float32Array[] {
  const redondeo = bf16 ? aBf16 : (x: number) => x;
  const bins = N_FFT / 2 + 1;
  const frecuencias = Array.from({ length: bins }, (_, i) => (i * (FRECUENCIA / 2)) / (bins - 1));
  const maximo = hzAMel(FRECUENCIA / 2);
  const puntos = Array.from({ length: nMels + 2 }, (_, i) => melAHz((i * maximo) / (nMels + 1)));
  return Array.from({ length: nMels }, (_, m) => {
    const fila = new Float32Array(bins);
    const norma = 2 / (puntos[m + 2] - puntos[m]);
    for (let k = 0; k < bins; k++) {
      const sube = (frecuencias[k] - puntos[m]) / (puntos[m + 1] - puntos[m]);
      const baja = (puntos[m + 2] - frecuencias[k]) / (puntos[m + 2] - puntos[m + 1]);
      fila[k] = redondeo(Math.max(0, Math.min(sube, baja)) * norma);
    }
    return fila;
  });
}

const COSENOS = Float64Array.from({ length: N_FFT / 2 }, (_, i) => Math.cos((2 * Math.PI * i) / N_FFT));
const SENOS = Float64Array.from({ length: N_FFT / 2 }, (_, i) => -Math.sin((2 * Math.PI * i) / N_FFT));
const INVERSOS = Uint16Array.from({ length: N_FFT }, (_, i) => {
  let x = i;
  let y = 0;
  for (let b = 0; b < Math.log2(N_FFT); b++) {
    y = (y << 1) | (x & 1);
    x >>= 1;
  }
  return y;
});

function fft(re: Float64Array, im: Float64Array) {
  for (let i = 0; i < N_FFT; i++) {
    const j = INVERSOS[i];
    if (j > i) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let tam = 2; tam <= N_FFT; tam <<= 1) {
    const mitad = tam >> 1;
    const paso = N_FFT / tam;
    for (let i = 0; i < N_FFT; i += tam) {
      for (let j = 0, k = 0; j < mitad; j++, k += paso) {
        const a = i + j;
        const b = a + mitad;
        const tr = re[b] * COSENOS[k] - im[b] * SENOS[k];
        const ti = re[b] * SENOS[k] + im[b] * COSENOS[k];
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }
}

export interface Mel {
  /** Fila a fila: [mel 0, marco 0..T-1], [mel 1, ...]. */
  datos: Float32Array;
  marcos: number;
  /** Cuántos marcos son de verdad: el resto es relleno. */
  validos: number;
}

/** Log-mel compatible con el preprocesador de NeMo: preénfasis, Hann simétrica centrada y normalización por banda. */
export function crearMel(config: ConfigMel): (audio: Float32Array) => Mel {
  const banco = bancoMel(config);
  const redondeo = config.bf16 ? aBf16 : (x: number) => x;
  const ventana = new Float32Array(N_FFT);
  const borde = (N_FFT - VENTANA) >> 1;
  for (let i = 0; i < VENTANA; i++) ventana[borde + i] = redondeo(0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (VENTANA - 1)));
  const { nMels } = config;
  return (audio) => {
    const validos = Math.floor(audio.length / SALTO);
    const x = new Float32Array(audio.length + N_FFT);
    x[N_FFT / 2] = audio[0] ?? 0;
    for (let i = 1; i < audio.length; i++) x[N_FFT / 2 + i] = audio[i] - 0.97 * audio[i - 1];
    const n = 1 + Math.floor((x.length - N_FFT) / SALTO);
    const mel = Array.from({ length: nMels }, () => new Float32Array(n));
    const re = new Float64Array(N_FFT);
    const im = new Float64Array(N_FFT);
    const potencia = new Float32Array(N_FFT / 2 + 1);
    for (let t = 0; t < n; t++) {
      for (let i = 0; i < N_FFT; i++) {
        re[i] = x[t * SALTO + i] * ventana[i];
        im[i] = 0;
      }
      fft(re, im);
      for (let k = 0; k <= N_FFT / 2; k++) potencia[k] = re[k] * re[k] + im[k] * im[k];
      for (let m = 0; m < nMels; m++) {
        const f = banco[m];
        let s = 0;
        for (let k = 0; k <= N_FFT / 2; k++) s += f[k] * potencia[k];
        mel[m][t] = Math.log(s + 2 ** -24);
      }
    }
    const marcos = n % RELLENO_A ? n + RELLENO_A - (n % RELLENO_A) : n;
    const datos = new Float32Array(nMels * marcos);
    for (let m = 0; m < nMels; m++) {
      const f = mel[m];
      let media = 0;
      for (let t = 0; t < validos; t++) media += f[t];
      media /= Math.max(validos, 1);
      let suma = 0;
      for (let t = 0; t < validos; t++) suma += (f[t] - media) ** 2;
      const desviacion = Math.sqrt(suma / Math.max(validos - 1, 1)) + 1e-5;
      for (let t = 0; t < validos; t++) datos[m * marcos + t] = (f[t] - media) / desviacion;
    }
    return { datos, marcos, validos };
  };
}

// ---------- El vocabulario ----------

/** Las piezas de un modelo de SentencePiece, en orden: su posición es el identificador del token. Es un protobuf muy simple. */
export function parsearPiezas(bytes: Uint8Array): string[] {
  const piezas: string[] = [];
  const texto = new TextDecoder();
  let p = 0;
  const varint = (limite: number) => {
    let v = 0;
    let d = 1;
    while (p < limite) {
      const b = bytes[p++];
      v += (b & 0x7f) * d;
      if (b < 0x80) break;
      d *= 128;
    }
    return v;
  };
  const saltar = (tipo: number, limite: number) => {
    if (tipo === 0) varint(limite);
    else if (tipo === 1) p += 8;
    else if (tipo === 2) {
      const largo = varint(limite);
      p += largo;
    } else if (tipo === 5) p += 4;
    else throw new Error(`Vocabulario no válido: tipo de campo ${tipo}`);
  };
  while (p < bytes.length) {
    const clave = varint(bytes.length);
    if (clave !== 0x0a) {
      saltar(clave & 7, bytes.length);
      continue;
    }
    const largo = varint(bytes.length);
    const fin = p + largo;
    let pieza = '';
    while (p < fin) {
      const c = varint(fin);
      if (c === 0x0a) {
        const l = varint(fin);
        pieza = texto.decode(bytes.subarray(p, p + l));
        p += l;
      } else {
        saltar(c & 7, fin);
      }
    }
    piezas.push(pieza);
  }
  return piezas;
}

/** Un vocabulario escrito como «pieza número» en cada línea. La pieza puede llevar espacios: el número es lo último. */
export function parsearLista(texto: string): string[] {
  const piezas: string[] = [];
  for (const linea of texto.split(/\r?\n/)) {
    const i = linea.lastIndexOf(' ');
    if (i <= 0) continue;
    const id = Number(linea.slice(i + 1));
    if (Number.isInteger(id) && id >= 0) piezas[id] = linea.slice(0, i);
  }
  return Array.from(piezas, (p) => p ?? '');
}

/**
 * Convierte cada token en su texto. Los caracteres raros van byte a byte, en varios tokens: el texto de los primeros queda
 * vacío, y el carácter sale con el último.
 */
export function decodificarTokens(ids: number[], piezas: string[]): string[] {
  const decodificador = new TextDecoder();
  const codificador = new TextEncoder();
  return ids.map((id) => {
    const pieza = piezas[id] ?? '';
    const m = /^<0x([0-9A-Fa-f]{2})>$/.exec(pieza);
    const bytes = m ? Uint8Array.of(parseInt(m[1], 16)) : codificador.encode(pieza);
    return decodificador.decode(bytes, { stream: true }).replaceAll('▁', ' ');
  });
}

// ---------- De tokens a segmentos ----------

export interface TokenConTiempo {
  texto: string;
  /** Segundos desde el inicio del audio. */
  t: number;
}

/** Con una pausa así entre dos tokens, ya es otra línea aunque no haya puntuación. */
const PAUSA_ENTRE_TOKENS_S = 1;
/** El token da solo cuándo empieza: lo que tarda el último en acabar. */
const COLA_S = 0.35;

/**
 * Agrupa los tokens en segmentos del tamaño de una línea. Cada uno empieza justo donde empieza su primer token: con un
 * modelo que da tiempos por token no hace falta repartirlos en proporción.
 */
export function segmentosDeTokens(tokens: TokenConTiempo[], reglas: ReglasTranscripcion): SegmentoWhisper[] {
  const grupos: TokenConTiempo[][] = [];
  for (const [i, t] of tokens.entries()) {
    if (!grupos.length || t.t - tokens[i - 1].t > PAUSA_ENTRE_TOKENS_S) grupos.push([]);
    grupos[grupos.length - 1].push(t);
  }
  const salida: SegmentoWhisper[] = [];
  for (const grupo of grupos) {
    const texto = grupo.map((t) => t.texto).join('');
    // El instante de cada carácter, para poder buscar dónde cae cada parte.
    const instantes: number[] = [];
    for (const t of grupo) for (let k = 0; k < t.texto.length; k++) instantes.push(t.t);
    const final = grupo[grupo.length - 1].t + COLA_S;
    const partes = partirTexto(texto, reglas);
    let cursor = 0;
    const inicios = partes.map((parte) => {
      const i = texto.indexOf(parte, cursor);
      const posicion = i < 0 ? cursor : i;
      cursor = posicion + parte.length;
      return instantes[Math.min(posicion, instantes.length - 1)] ?? grupo[0].t;
    });
    partes.forEach((parte, k) => salida.push({ texto: parte, inicio: inicios[k], fin: k + 1 < partes.length ? inicios[k + 1] : final }));
  }
  return salida;
}
