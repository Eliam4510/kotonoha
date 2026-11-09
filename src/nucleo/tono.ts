// La curva del tono de una grabación de voz, medida con YIN (de Cheveigné y Kawahara, 2002) y sin modelos: basta para
// seguir el tono de una frase leída en voz alta y saber dónde sube y dónde cae. Va a 8 kHz, que sobra para el tono de la
// voz humana y cuesta la cuarta parte que a 16 kHz.

export interface MarcoTono {
  /** Segundos desde el principio de la grabación: el centro del marco. */
  t: number;
  /** El tono en hercios; null donde no hay voz. */
  f0: number | null;
  /** La energía del marco (RMS). */
  energia: number;
}

/** Lo que abarca la voz: de un hombre grave a una niña. */
const F0_MIN = 60;
const F0_MAX = 500;
/** Un marco cada 10 ms, de 35 ms: cabe más de un periodo del tono más grave. */
const PASO_S = 0.01;
const VENTANA_S = 0.035;
/** Por debajo de esto en la diferencia normalizada, el marco es periódico (el umbral del artículo de YIN). */
const UMBRAL_YIN = 0.15;
/** Si ni el mínimo baja de esto, no hay tono que medir. */
const UMBRAL_SONORO = 0.35;
/**
 * Un marco menos periódico, hasta esto, es voz si toca a otro con voz y con el mismo tono: la voz algo aireada, el ruido
 * de un micrófono de portátil o la compresión de una grabación lo dejan ahí. El ruido suelto no tiene vecinos con tono.
 */
const UMBRAL_DUDOSO = 0.6;
/** Lo que puede cambiar el tono de un marco al siguiente, en semitonos. */
const SALTO_MAXIMO_ST = 2;
/** Un valle a esto del más hondo cuenta como igual de hondo. */
const MARGEN_VALLE = 0.1;
/** Un tramo con voz más corto que esto es ruido: 3 marcos, 30 ms. */
const TRAMO_MINIMO = 3;

/** A la mitad de la frecuencia, promediando de dos en dos. */
function diezmar(pcm: Float32Array): Float32Array {
  const salida = new Float32Array(Math.floor(pcm.length / 2));
  for (let i = 0; i < salida.length; i++) salida[i] = (pcm[2 * i] + pcm[2 * i + 1]) / 2;
  return salida;
}

/** La curva del tono, un marco cada 10 ms. */
export function curvaDeTono(pcm: Float32Array, frecuencia: number): MarcoTono[] {
  let x = pcm;
  let fs = frecuencia;
  while (fs > 12000) {
    x = diezmar(x);
    fs /= 2;
  }
  const paso = Math.max(1, Math.round(fs * PASO_S));
  const ancho = Math.round(fs * VENTANA_S);
  const tauMin = Math.floor(fs / F0_MAX);
  const tauMax = Math.ceil(fs / F0_MIN);
  const diferencia = new Float64Array(tauMax + 1);
  const normalizada = new Float64Array(tauMax + 1);
  const marcos: MarcoTono[] = [];
  /** El tono de cada marco dudoso; null en los demás. */
  const dudosos: (number | null)[] = [];
  let energiaMaxima = 0;

  for (let s = 0; s + ancho + tauMax < x.length; s += paso) {
    let e = 0;
    for (let j = 0; j < ancho; j++) e += x[s + j] * x[s + j];
    const energia = Math.sqrt(e / ancho);
    energiaMaxima = Math.max(energiaMaxima, energia);

    for (let tau = 1; tau <= tauMax; tau++) {
      let suma = 0;
      for (let j = 0; j < ancho; j++) {
        const d = x[s + j] - x[s + j + tau];
        suma += d * d;
      }
      diferencia[tau] = suma;
    }
    // La diferencia normalizada por su media acumulada: lo que hace a YIN robusto frente a las octavas.
    let acumulada = 0;
    normalizada[0] = 1;
    for (let tau = 1; tau <= tauMax; tau++) {
      acumulada += diferencia[tau];
      normalizada[tau] = acumulada > 0 ? (diferencia[tau] * tau) / acumulada : 1;
    }
    let elegido = -1;
    let minimo = Infinity;
    let tauDelMinimo = -1;
    for (let tau = tauMin; tau <= tauMax; tau++) {
      if (normalizada[tau] < minimo) {
        minimo = normalizada[tau];
        tauDelMinimo = tau;
      }
      if (normalizada[tau] < UMBRAL_YIN) {
        // El primer valle por debajo del umbral, hasta su fondo.
        let fondo = tau;
        while (fondo + 1 <= tauMax && normalizada[fondo + 1] < normalizada[fondo]) fondo++;
        elegido = fondo;
        break;
      }
    }
    // Sin valle por debajo del umbral, el primero casi tan hondo como el más hondo: con ruido, los múltiplos del periodo
    // bajan tanto como el periodo, y quedarse con el más hondo daría la mitad del tono.
    let candidato = tauDelMinimo;
    if (elegido < 0) {
      for (let tau = tauMin + 1; tau < tauMax; tau++) {
        const v = normalizada[tau];
        if (v <= minimo + MARGEN_VALLE && v <= normalizada[tau - 1] && v <= normalizada[tau + 1]) {
          candidato = tau;
          break;
        }
      }
      if (minimo < UMBRAL_SONORO) elegido = candidato;
    }

    /** El fondo del valle entre muestras, con una parábola por sus tres puntos. */
    const hercios = (tau: number): number | null => {
      const a = normalizada[tau - 1];
      const b = normalizada[tau];
      const c = tau + 1 <= tauMax ? normalizada[tau + 1] : b;
      const curvatura = a - 2 * b + c;
      const desplazamiento = curvatura > 0 ? Math.max(-1, Math.min(1, (a - c) / (2 * curvatura))) : 0;
      const hz = fs / (tau + desplazamiento);
      return hz >= F0_MIN && hz <= F0_MAX ? hz : null;
    };
    marcos.push({ t: (s + ancho / 2) / fs, f0: elegido > 0 ? hercios(elegido) : null, energia });
    dudosos.push(elegido < 0 && minimo < UMBRAL_DUDOSO && candidato > 0 ? hercios(candidato) : null);
  }

  // Sin energía no hay voz, aunque el ruido de fondo parezca periódico.
  const energiaMinima = Math.max(0.004, energiaMaxima * 0.06);
  for (const m of marcos) if (m.energia < energiaMinima) m.f0 = null;
  // Los dudosos que siguen a uno con voz y con su mismo tono, hacia delante y hacia atrás.
  const sigue = (i: number, vecino: MarcoTono | undefined) => {
    const hz = dudosos[i];
    if (marcos[i].f0 !== null || hz === null || marcos[i].energia < energiaMinima || !vecino?.f0) return;
    if (Math.abs(12 * Math.log2(hz / vecino.f0)) <= SALTO_MAXIMO_ST) marcos[i].f0 = hz;
  };
  for (let i = 1; i < marcos.length; i++) sigue(i, marcos[i - 1]);
  for (let i = marcos.length - 2; i >= 0; i--) sigue(i, marcos[i + 1]);
  return limpiar(marcos);
}

export const mediana = (v: number[]): number => {
  if (!v.length) return NaN;
  const o = [...v].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
};

/** Los saltos de octava se miden contra el tono de alrededor: 150 ms a cada lado. */
const VECINDAD_OCTAVA = 15;

/**
 * Quita lo que no es tono: los saltos de octava (YIN a veces da el doble o la mitad, varios marcos seguidos), los picos
 * sueltos, con una mediana de cinco marcos, y los tramos con voz demasiado cortos para ser una sílaba. La octava se
 * compara con el tono de alrededor y no con el de toda la grabación: un salto en la parte grave de la voz no llega al doble
 * de su tono medio, y se colaría.
 */
function limpiar(marcos: MarcoTono[]): MarcoTono[] {
  const sonoros = marcos.filter((m) => m.f0 !== null).map((m) => m.f0!);
  if (!sonoros.length) return marcos;
  // Primero contra el tono de toda la grabación, para un tramo entero a otra octava; después contra el de alrededor.
  const central = mediana(sonoros);
  for (const m of marcos) {
    if (m.f0 === null) continue;
    if (m.f0 > central * 1.8 && m.f0 / 2 >= F0_MIN) m.f0 /= 2;
    else if (m.f0 < central * 0.55 && m.f0 * 2 <= F0_MAX) m.f0 *= 2;
  }
  const originales = marcos.map((m) => m.f0);
  for (let i = 0; i < marcos.length; i++) {
    const f = originales[i];
    if (f === null) continue;
    const local = mediana(originales.slice(Math.max(0, i - VECINDAD_OCTAVA), i + VECINDAD_OCTAVA + 1).filter((x): x is number => x !== null));
    if (f > local * 1.7 && f / 2 >= F0_MIN) marcos[i].f0 = f / 2;
    else if (f < local * 0.6 && f * 2 <= F0_MAX) marcos[i].f0 = f * 2;
  }
  const crudo = marcos.map((m) => m.f0);
  for (let i = 0; i < marcos.length; i++) {
    if (crudo[i] === null) continue;
    const vecinos = crudo.slice(Math.max(0, i - 2), i + 3).filter((f): f is number => f !== null);
    marcos[i].f0 = mediana(vecinos);
  }
  // Los tramos sonoros muy cortos.
  let i = 0;
  while (i < marcos.length) {
    if (marcos[i].f0 === null) {
      i++;
      continue;
    }
    let j = i;
    while (j < marcos.length && marcos[j].f0 !== null) j++;
    if (j - i < TRAMO_MINIMO) for (let k = i; k < j; k++) marcos[k].f0 = null;
    i = j;
  }
  return marcos;
}

/** Semitonos respecto a una referencia: la distancia que se oye entre dos tonos. */
export const semitonos = (f0: number, referencia: number): number => 12 * Math.log2(f0 / referencia);

/** El tono central de quien habla, para medir todo en semitonos respecto a su voz. */
export function referenciaDeVoz(curva: MarcoTono[]): number {
  return mediana(curva.filter((m) => m.f0 !== null).map((m) => m.f0!));
}
