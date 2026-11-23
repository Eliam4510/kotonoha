// Alineación forzada (CTC): coloca en el audio una secuencia de fonemas conocida, con un modelo que dice cada pocos
// milisegundos cuánto se parece lo que suena a cada fonema (narabas, cada 20 ms). Con la letra de una canción, cada verso
// empieza en el primer marco de su primer fonema, con la precisión del modelo: unas centésimas. Sola se pierde en una
// canción entera (partes en otra lengua, versos de la letra que no se cantan, pasajes instrumentales largos): por eso cada
// verso se busca solo en su zona, la que da lo que oyó Whisper.

/** Lo que oye el modelo: log-probabilidades marco a marco (marcos × clases), y qué clase es el blanco del CTC. */
export interface ProbabilidadesCtc {
  logp: Float32Array;
  marcos: number;
  clases: number;
  blanco: number;
}

/** Para cada estado del CTC (2·fonemas + 1: un blanco antes de cada fonema y otro al final), dónde puede estar. */
export interface BandaCtc {
  desde: Int32Array;
  hasta: Int32Array;
}

export interface FonemaColocado {
  /** El primer y el último marco en que suena. */
  primero: number;
  ultimo: number;
}

/**
 * El camino más probable que recorre los fonemas en orden, cada uno al menos un marco, con blancos entre medias. Devuelve
 * dónde suena cada fonema, o null si la secuencia no cabe en la banda.
 */
export function alinearCtc(p: ProbabilidadesCtc, fichas: readonly number[], banda?: BandaCtc): FonemaColocado[] | null {
  const { logp, marcos, clases, blanco } = p;
  const S = 2 * fichas.length + 1;
  if (!marcos || marcos < fichas.length) return null;
  const clase = (s: number) => (s % 2 === 0 ? blanco : fichas[(s - 1) >> 1]);
  const dentro = (t: number, s: number) => !banda || (t >= banda.desde[s] && t <= banda.hasta[s]);
  let previa = new Float64Array(S).fill(Number.NEGATIVE_INFINITY);
  let actual = new Float64Array(S);
  // De dónde viene cada estado en cada marco: 0, de sí mismo; 1, del anterior; 2, saltando un blanco.
  const atras = new Uint8Array(marcos * S);
  if (dentro(0, 0)) previa[0] = logp[blanco];
  if (S > 1 && dentro(0, 1)) previa[1] = logp[clase(1)];
  for (let t = 1; t < marcos; t++) {
    const base = t * clases;
    const fila = t * S;
    for (let s = 0; s < S; s++) {
      if (!dentro(t, s)) {
        actual[s] = Number.NEGATIVE_INFINITY;
        continue;
      }
      let mejor = previa[s];
      let paso = 0;
      if (s >= 1 && previa[s - 1] > mejor) {
        mejor = previa[s - 1];
        paso = 1;
      }
      // Un fonema puede seguir a otro sin blanco entre medias, salvo que sean el mismo.
      if (s >= 2 && s % 2 === 1 && clase(s) !== clase(s - 2) && previa[s - 2] > mejor) {
        mejor = previa[s - 2];
        paso = 2;
      }
      actual[s] = mejor + logp[base + clase(s)];
      atras[fila + s] = paso;
    }
    [previa, actual] = [actual, previa];
  }
  let s = S > 1 && previa[S - 2] > previa[S - 1] ? S - 2 : S - 1;
  if (!Number.isFinite(previa[s])) return null;
  const colocados: FonemaColocado[] = fichas.map(() => ({ primero: -1, ultimo: -1 }));
  for (let t = marcos - 1; t >= 0; t--) {
    if (s % 2 === 1) {
      const f = colocados[(s - 1) >> 1];
      if (f.ultimo < 0) f.ultimo = t;
      f.primero = t;
    }
    if (t > 0) s -= atras[t * S + s];
  }
  return colocados.every((f) => f.primero >= 0) ? colocados : null;
}

/** Lo que se busca alrededor de donde pone un verso lo que oyó Whisper. */
export const MARGEN_ZONA_MS = 2000;

/**
 * La zona de cada verso, en marcos, a partir de dónde los pone lo que oyó Whisper (`toscas`). Un verso que Whisper oyó se
 * busca a ±2 s de ahí; uno que no oyó, entre sus vecinos oídos. Hasta el final de la zona cabe además lo que dura.
 */
export function zonasDeVersos(toscas: readonly { inicio: number; fin: number }[], oidos: readonly boolean[], duracionMs: number, msPorMarco: number): [number, number][] {
  const marcos = Math.floor(duracionMs / msPorMarco);
  const anclas = toscas.map((l, v) => (oidos[v] ? l.inicio : null));
  return toscas.map((l, v) => {
    let antes = 0;
    for (let k = v - 1; k >= 0; k--) {
      const a = anclas[k];
      if (a !== null) {
        antes = a;
        break;
      }
    }
    let despues = duracionMs;
    for (let k = v + 1; k < toscas.length; k++) {
      const a = anclas[k];
      if (a !== null) {
        despues = a;
        break;
      }
    }
    const propia = anclas[v];
    const desde = propia !== null ? propia - MARGEN_ZONA_MS : antes;
    const empiezaHasta = propia !== null ? propia + MARGEN_ZONA_MS : despues;
    const hasta = empiezaHasta + (l.fin - l.inicio) + MARGEN_ZONA_MS;
    return [Math.max(0, Math.floor(desde / msPorMarco)), Math.max(0, Math.min(marcos - 1, Math.ceil(hasta / msPorMarco)))];
  });
}

/**
 * La banda a partir de la zona de cada verso, en marcos: sus fonemas y los blancos entre ellos van en la suya, y el blanco
 * de antes de cada verso puede estar también en la del anterior. `fonemas` es cuántos tiene cada verso; uno sin fonemas
 * (una línea en otra escritura) no ocupa nada.
 */
export function bandaPorVersos(zonas: readonly [number, number][], fonemas: readonly number[], marcos: number): BandaCtc {
  const total = fonemas.reduce((s, n) => s + n, 0);
  const S = 2 * total + 1;
  const desde = new Int32Array(S);
  const hasta = new Int32Array(S).fill(marcos - 1);
  let k = 0;
  let anterior = 0;
  fonemas.forEach((n, v) => {
    if (!n) return;
    const [d, h] = zonas[v];
    desde[2 * k] = Math.min(anterior, d);
    hasta[2 * k] = h;
    for (let i = 0; i < n; i++) {
      desde[2 * (k + i) + 1] = d;
      hasta[2 * (k + i) + 1] = h;
      if (i > 0) {
        desde[2 * (k + i)] = d;
        hasta[2 * (k + i)] = h;
      }
    }
    anterior = d;
    k += n;
  });
  desde[S - 1] = anterior;
  hasta[S - 1] = marcos - 1;
  return { desde, hasta };
}
