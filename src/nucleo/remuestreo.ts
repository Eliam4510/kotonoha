// Cambiar la frecuencia de muestreo de un audio. El motor guarda las canciones a 16 kHz (lo que oyen Whisper y narabas),
// y Demucs oye a 44,1 kHz. Un filtro sinc con ventana de Kaiser, en fases: de 16 kHz a 44,1 kHz son 441 fases de 34
// coeficientes, calculadas una vez. Sin plegar al bajar lo que pasa de la mitad de la frecuencia menor.

const mcd = (a: number, b: number): number => (b ? mcd(b, a % b) : a);

/** La función de Bessel modificada de orden cero, para la ventana de Kaiser. */
function besselI0(x: number): number {
  let suma = 1;
  let termino = 1;
  for (let k = 1; k < 64; k++) {
    termino *= (x / (2 * k)) ** 2;
    suma += termino;
    if (termino < suma * 1e-12) break;
  }
  return suma;
}

/** Cuántos cruces por cero del sinc caben a cada lado: más, mejor corte y más cálculo. */
const CRUCES = 16;
const BETA = 8;
/** El corte, un poco por debajo de la mitad de la frecuencia menor, para que la transición no pliegue nada. */
const MARGEN_CORTE = 0.95;

export interface Remuestreador {
  /** Cuántas muestras da un audio de `n` muestras. */
  largo(n: number): number;
  /**
   * Las muestras `desde`…`desde + cuantas` del audio remuestreado. `x` es un trozo del original que empieza en su muestra
   * `inicioX`; fuera de él, silencio.
   */
  tramo(x: Float32Array, desde: number, cuantas: number, inicioX?: number): Float32Array;
}

const cache = new Map<string, Remuestreador>();

/** Un remuestreador de `de` a `a` muestras por segundo (enteros). */
export function remuestreador(de: number, a: number): Remuestreador {
  const clave = `${de}>${a}`;
  const hecho = cache.get(clave);
  if (hecho) return hecho;
  const g = mcd(de, a);
  const fases = a / g;
  const paso = de / g;
  // En ciclos por muestra de entrada.
  const corte = 0.5 * Math.min(1, a / de) * MARGEN_CORTE;
  const ancho = Math.ceil(CRUCES / (2 * corte));
  const taps = 2 * ancho;
  const coef = new Float32Array(fases * taps);
  const i0Beta = besselI0(BETA);
  for (let p = 0; p < fases; p++) {
    const delta = p / fases;
    let suma = 0;
    for (let i = 0; i < taps; i++) {
      // La muestra base + (i - ancho + 1), a una distancia u del instante buscado.
      const u = delta - (i - ancho + 1);
      const r = u / ancho;
      const ventana = Math.abs(r) < 1 ? besselI0(BETA * Math.sqrt(1 - r * r)) / i0Beta : 0;
      const x = 2 * corte * u;
      const sinc = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
      const c = 2 * corte * sinc * ventana;
      coef[p * taps + i] = c;
      suma += c;
    }
    // Cada fase deja pasar la continua sin cambiarla.
    for (let i = 0; i < taps; i++) coef[p * taps + i] /= suma;
  }
  const r: Remuestreador = {
    largo: (n) => Math.floor((n * fases) / paso),
    tramo(x, desde, cuantas, inicioX = 0) {
      const y = new Float32Array(cuantas);
      const n = x.length;
      for (let j = 0; j < cuantas; j++) {
        const t = (desde + j) * paso;
        const base = Math.floor(t / fases);
        const fase = t - base * fases;
        const primera = base - ancho + 1 - inicioX;
        const o = fase * taps;
        let acc = 0;
        if (primera >= 0 && primera + taps <= n) {
          for (let i = 0; i < taps; i++) acc += x[primera + i] * coef[o + i];
        } else {
          for (let i = 0; i < taps; i++) {
            const k = primera + i;
            if (k >= 0 && k < n) acc += x[k] * coef[o + i];
          }
        }
        y[j] = acc;
      }
      return y;
    },
  };
  cache.set(clave, r);
  return r;
}

/** Todo un audio, de `de` a `a` muestras por segundo. */
export function remuestrear(x: Float32Array, de: number, a: number): Float32Array {
  if (de === a) return x.slice();
  const r = remuestreador(de, a);
  return r.tramo(x, 0, r.largo(x.length));
}
