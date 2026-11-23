// Demucs (htdemucs, de Meta) separa la voz de la música. El modelo, en ONNX, hace lo pesado; aquí va lo de antes y lo de
// después, como en el original: los trozos de 7,8 s que se solapan una cuarta parte con un peso en triángulo, el
// espectrograma de cada uno (STFT de 4096 con saltos de 1024), la vuelta al tiempo (ISTFT) de la rama de frecuencias y su
// suma con la rama del tiempo. Sigue a demucs-web, de timcsy (MIT), pero solo rearma la voz, y en mono: el motor guarda
// las canciones en mono a 16 kHz y narabas las oye así.

import { remuestreador } from './remuestreo';

export const FRECUENCIA_DEMUCS = 44100;
/** Lo que oye el modelo de una vez: 7,8 s. */
export const MUESTRAS_SEGMENTO = 343980;
const N_FFT = 4096;
const SALTO = 1024;
const BANDAS = 2048;
const MARCOS = 336;
/** drums, bass, other, vocals. */
const PISTA_VOZ = 3;
const SOLAPE = 0.25;

/** Lo que da el modelo para un trozo: la rama del tiempo [4, 2, 343980] y la de frecuencias [4, 4, 2048, 336]. */
export interface SalidaDemucs {
  tiempo: Float32Array;
  frecuencia: Float32Array;
}
/** El modelo: la onda [2, 343980] y el espectrograma con la parte real y la imaginaria como canales [4, 2048, 336]. */
export type CorrerDemucs = (onda: Float32Array, espectro: Float32Array) => Promise<SalidaDemucs>;

/** La transformada rápida de Fourier de 4096 puntos, con sus tablas calculadas una vez. */
class Fft {
  private readonly cos: Float64Array;
  private readonly sin: Float64Array;
  private readonly inverso: Uint32Array;

  constructor(private readonly n: number) {
    this.cos = new Float64Array(n / 2);
    this.sin = new Float64Array(n / 2);
    for (let k = 0; k < n / 2; k++) {
      this.cos[k] = Math.cos((2 * Math.PI * k) / n);
      this.sin[k] = Math.sin((2 * Math.PI * k) / n);
    }
    const bits = Math.log2(n);
    this.inverso = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      let r = 0;
      for (let b = 0, x = i; b < bits; b++, x >>= 1) r = (r << 1) | (x & 1);
      this.inverso[i] = r;
    }
  }

  /** En el sitio. La inversa no divide entre n. */
  transformar(re: Float64Array, im: Float64Array, inversa: boolean) {
    const { n, inverso, cos, sin } = this;
    for (let i = 0; i < n; i++) {
      const j = inverso[i];
      if (j > i) {
        let t = re[i];
        re[i] = re[j];
        re[j] = t;
        t = im[i];
        im[i] = im[j];
        im[j] = t;
      }
    }
    const signo = inversa ? 1 : -1;
    for (let tam = 2; tam <= n; tam *= 2) {
      const mitad = tam / 2;
      const paso = n / tam;
      for (let i = 0; i < n; i += tam) {
        for (let j = 0; j < mitad; j++) {
          const wr = cos[j * paso];
          const wi = signo * sin[j * paso];
          const a = i + j;
          const b = a + mitad;
          const xr = re[b] * wr - im[b] * wi;
          const xi = re[b] * wi + im[b] * wr;
          re[b] = re[a] - xr;
          im[b] = im[a] - xi;
          re[a] += xr;
          im[a] += xi;
        }
      }
    }
  }
}

const fft = new Fft(N_FFT);
/** La ventana de Hann periódica, como `torch.hann_window`. */
const HANN = Float64Array.from({ length: N_FFT }, (_, i) => 0.5 * (1 - Math.cos((2 * Math.PI * i) / N_FFT)));
/** `normalized=True` en PyTorch: la STFT se divide entre la raíz de n, y la inversa se multiplica. */
const ESCALA = 1 / Math.sqrt(N_FFT);

/** Relleno por reflexión, sin repetir el borde, como `F.pad(..., mode='reflect')`. */
function reflejar(x: Float32Array, izquierda: number, derecha: number): Float32Array {
  const n = x.length;
  const y = new Float32Array(izquierda + n + derecha);
  y.set(x, izquierda);
  for (let i = 0; i < izquierda; i++) y[i] = x[Math.min(izquierda - i, n - 1)];
  for (let i = 0; i < derecha; i++) y[izquierda + n + i] = x[Math.max(0, n - 2 - i)];
  return y;
}

/**
 * El espectrograma de un trozo en mono, con el relleno de htdemucs (`_spec`): la parte real y la imaginaria de cada
 * canal, que son iguales, en [4, 2048, 336]. Dos marcos reales van en una sola transformada compleja.
 */
export function espectrograma(x: Float32Array): Float32Array {
  const le = Math.ceil(MUESTRAS_SEGMENTO / SALTO);
  const relleno = (SALTO / 2) * 3;
  const centrado = reflejar(reflejar(x, relleno, relleno + le * SALTO - MUESTRAS_SEGMENTO), N_FFT / 2, N_FFT / 2);
  const salida = new Float32Array(4 * BANDAS * MARCOS);
  const canal = BANDAS * MARCOS;
  const re = new Float64Array(N_FFT);
  const im = new Float64Array(N_FFT);
  // Los marcos 2 a 337 de la STFT, de dos en dos.
  for (let m = 0; m < MARCOS; m += 2) {
    const a = (m + 2) * SALTO;
    const b = (m + 3) * SALTO;
    for (let i = 0; i < N_FFT; i++) {
      re[i] = centrado[a + i] * HANN[i];
      im[i] = centrado[b + i] * HANN[i];
    }
    fft.transformar(re, im, false);
    for (let k = 0; k < BANDAS; k++) {
      const s = (N_FFT - k) % N_FFT;
      const ar = (re[k] + re[s]) / 2;
      const ai = (im[k] - im[s]) / 2;
      const br = (im[k] + im[s]) / 2;
      const bi = (re[s] - re[k]) / 2;
      const o = k * MARCOS + m;
      salida[o] = salida[2 * canal + o] = ar * ESCALA;
      salida[canal + o] = salida[3 * canal + o] = ai * ESCALA;
      salida[o + 1] = salida[2 * canal + o + 1] = br * ESCALA;
      salida[canal + o + 1] = salida[3 * canal + o + 1] = bi * ESCALA;
    }
  }
  return salida;
}

/** La ventana al cuadrado sumada en cada muestra de la ISTFT de 340 marcos: es igual en todos los trozos. */
const LARGO_ISTFT = (MARCOS + 4 - 1) * SALTO + N_FFT;
const ENVOLVENTE = (() => {
  const e = new Float64Array(LARGO_ISTFT);
  for (let m = 0; m < MARCOS + 4; m++) for (let i = 0; i < N_FFT; i++) e[m * SALTO + i] += HANN[i] * HANN[i];
  return e;
})();

/**
 * La voz de un trozo, en mono: la media de los dos canales de la rama del tiempo más la ISTFT de la media de los dos de
 * la rama de frecuencias (`_mask` y `_ispec` de htdemucs). Dos marcos van en una sola transformada inversa.
 */
export function vozDelTrozo({ tiempo, frecuencia }: SalidaDemucs): Float32Array {
  const canal = BANDAS * MARCOS;
  const base = PISTA_VOZ * 4 * canal;
  // La rama de frecuencias tiene dos marcos de silencio a cada lado y una banda más, vacía.
  const salida = new Float64Array(LARGO_ISTFT);
  const re = new Float64Array(N_FFT);
  const im = new Float64Array(N_FFT);
  const media = (c: number, k: number, m: number) => (m < 0 || m >= MARCOS ? 0 : (frecuencia[base + c * canal + k * MARCOS + m] + frecuencia[base + (c + 2) * canal + k * MARCOS + m]) / 2);
  for (let m = 0; m < MARCOS + 4; m += 2) {
    // El marco m de la ISTFT es el m - 2 de lo que da el modelo; el par, en la parte imaginaria.
    re.fill(0);
    im.fill(0);
    for (let k = 0; k < BANDAS; k++) {
      const ar = media(0, k, m - 2);
      const ai = k === 0 ? 0 : media(1, k, m - 2);
      const br = media(0, k, m - 1);
      const bi = k === 0 ? 0 : media(1, k, m - 1);
      // Z = A + iB, con A y B hermíticas: la inversa da a en la parte real y b en la imaginaria.
      re[k] += ar - bi;
      im[k] += ai + br;
      if (k > 0) {
        re[N_FFT - k] += ar + bi;
        im[N_FFT - k] += br - ai;
      }
    }
    fft.transformar(re, im, true);
    const a = m * SALTO;
    const b = (m + 1) * SALTO;
    // La inversa sin dividir entre n, la normalización de PyTorch y la ventana de síntesis.
    const factor = 1 / (N_FFT * ESCALA);
    for (let i = 0; i < N_FFT; i++) {
      salida[a + i] += re[i] * factor * HANN[i];
      if (m + 1 < MARCOS + 4) salida[b + i] += im[i] * factor * HANN[i];
    }
  }
  const voz = new Float32Array(MUESTRAS_SEGMENTO);
  const desde = N_FFT / 2 + (SALTO / 2) * 3;
  const t = PISTA_VOZ * 2 * MUESTRAS_SEGMENTO;
  for (let i = 0; i < MUESTRAS_SEGMENTO; i++) {
    const e = ENVOLVENTE[desde + i];
    const f = e > 1e-11 ? salida[desde + i] / e : 0;
    voz[i] = (tiempo[t + i] + tiempo[t + MUESTRAS_SEGMENTO + i]) / 2 + f;
  }
  return voz;
}

/** El peso de cada muestra de un trozo al juntarlos: un triángulo, como `apply_model` de Demucs. */
function peso(i: number): number {
  const mitad = Math.floor(MUESTRAS_SEGMENTO / 2);
  return (i < mitad ? i + 1 : MUESTRAS_SEGMENTO - i) / mitad;
}

/** Los trozos en que se parte un audio de `muestras` a 44,1 kHz: dónde empieza cada uno. */
export function trozos(muestras: number): number[] {
  const paso = Math.floor((1 - SOLAPE) * MUESTRAS_SEGMENTO);
  const inicios: number[] = [];
  for (let o = 0; o < muestras; o += paso) inicios.push(o);
  return inicios;
}

/**
 * La voz de una canción, a la frecuencia de `pcm` (16 kHz en el motor), sin la música. `correr` es el modelo; `avance`
 * recibe cuántos trozos van de cuántos. Cada trozo se sube a 44,1 kHz, pasa por el modelo y su voz se baja otra vez.
 */
export async function separarVoz(pcm: Float32Array, frecuencia: number, correr: CorrerDemucs, avance?: (hechos: number, total: number) => void): Promise<Float32Array> {
  const subir = remuestreador(frecuencia, FRECUENCIA_DEMUCS);
  const bajar = remuestreador(FRECUENCIA_DEMUCS, frecuencia);
  const largo44 = subir.largo(pcm.length);
  const voz = new Float32Array(pcm.length);
  const pesos = new Float32Array(pcm.length);
  const inicios = trozos(largo44);
  const onda = new Float32Array(2 * MUESTRAS_SEGMENTO);
  for (let n = 0; n < inicios.length; n++) {
    const o = inicios[n];
    const largo = Math.min(MUESTRAS_SEGMENTO, largo44 - o);
    // El trozo, a 44,1 kHz; si es el último y no llega a 7,8 s, con silencio detrás.
    const x = new Float32Array(MUESTRAS_SEGMENTO);
    x.set(subir.tramo(pcm, o, largo));
    onda.set(x, 0);
    onda.set(x, MUESTRAS_SEGMENTO);
    const trozo = vozDelTrozo(await correr(onda, espectrograma(x)));
    // De vuelta a la frecuencia del audio: las muestras que caen dentro del trozo, con el peso del sitio que ocupan.
    const primera = Math.ceil((o * frecuencia) / FRECUENCIA_DEMUCS);
    const ultima = Math.min(pcm.length - 1, Math.floor(((o + largo - 1) * frecuencia) / FRECUENCIA_DEMUCS));
    if (ultima >= primera) {
      const bajada = bajar.tramo(trozo.subarray(0, largo), primera, ultima - primera + 1, o);
      for (let j = primera; j <= ultima; j++) {
        const w = peso(Math.min(largo - 1, Math.round((j * FRECUENCIA_DEMUCS) / frecuencia) - o));
        voz[j] += bajada[j - primera] * w;
        pesos[j] += w;
      }
    }
    avance?.(n + 1, inicios.length);
  }
  const salida = new Float32Array(pcm.length);
  for (let j = 0; j < pcm.length; j++) salida[j] = pesos[j] > 0 ? voz[j] / pesos[j] : 0;
  return salida;
}

/**
 * Una señal fija de 7,8 s para comprobar que la GPU calcula bien: una voz sintética con vibrato sobre un bajo y unos
 * golpes. Con Kokoro, una Radeon daba valores de cientos o NaN; lo que da aquí se compara con lo del procesador.
 */
export function senalDePrueba(): Float32Array {
  const x = new Float32Array(MUESTRAS_SEGMENTO);
  for (let i = 0; i < x.length; i++) {
    const t = i / FRECUENCIA_DEMUCS;
    const f0 = 220 * (1 + 0.02 * Math.sin(2 * Math.PI * 5 * t));
    let voz = 0;
    for (let h = 1; h <= 8; h++) voz += Math.sin(2 * Math.PI * f0 * h * t) / h;
    const bajo = Math.sin(2 * Math.PI * 55 * t);
    const golpe = Math.exp(-(t % 0.5) * 40) * Math.sin(2 * Math.PI * 80 * t);
    x[i] = 0.15 * voz * (0.6 + 0.4 * Math.sin(Math.PI * t)) + 0.2 * bajo + 0.3 * golpe;
  }
  return x;
}

const rms = (x: Float32Array) => {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i] * x[i];
  return Math.sqrt(s / x.length);
};

/** Lo que se compara de una salida: la energía de cada rama y la de la voz rearmada. */
export function huellaDe(salida: SalidaDemucs): number[] {
  return [rms(salida.tiempo), rms(salida.frecuencia), rms(vozDelTrozo(salida))];
}
