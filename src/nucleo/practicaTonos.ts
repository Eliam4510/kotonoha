// La práctica de los tonos de una lengua tonal, como el chino: dónde suena cada sílaba en la grabación y si la curva de
// su tono tiene la forma del que le toca. Sin transcribir: la frase se conoce, y en chino cada sílaba tiene su núcleo
// con voz, separado del de la siguiente por una consonante sorda o por una bajada de la energía. Lo que se juzga es la
// forma (alto y llano, sube, bajo, cae), medida contra la voz de quien habla y con margen: es una orientación.

import { trozosDeVoz } from './practicaAcento';
import { type MarcoTono, mediana, semitonos } from './tono';

/** Una sílaba de la frase, con el tono con que se dice en ella (tras los cambios de tono que pida la frase). */
export interface SilabaTonal {
  /** Lo escrito: un carácter, o dos con el 儿 que se le pega. */
  texto: string;
  /** Su lectura como se dice: ní. */
  lectura: string;
  /** El tono que se espera oír: del 1 al 4; el 5 es el neutro, que no se juzga. */
  tono: number;
  /** Otro tono que también vale: el tercero que, al hablar deprisa, pasa al segundo. */
  tambien?: number;
  /** Detrás va una pausa (un signo) o el final: ahí la voz baja, y el tercero puede volver a subir. */
  pausa: boolean;
}

export interface TramoSilaba {
  inicio: number;
  fin: number;
}

// ---------- Dónde suena cada sílaba ----------

/** Un marco cada 10 ms (nucleo/tono.ts). Una sílaba dura entre esto y 2,5 s, con lo que la rodea de silencio. */
const MARCOS_MINIMOS = 4;
const MARCOS_MAXIMOS = 250;
/** Toda sílaba tiene voz: su vocal. */
const VOZ_MINIMA = 2;
/**
 * Un hueco sin voz dentro de una sílaba, entre dos tramos con ella, es raro: su consonante va delante y su vocal es
 * seguida. Uno corto sí cabe, porque el tercer tono a veces se vuelve áspero en lo más bajo y YIN pierde el tono.
 */
const HUECO_LIBRE = 6;
/**
 * Lo hondo que es una frontera clara: el cierre de una consonante, o el silencio entre dos palabras, queda esto por debajo
 * de la voz de alrededor. Una frontera cuesta menos cuanto más honda: así cae en lo más callado y no en la bajada de antes.
 */
const HONDURA_DB = 20;
/** Lo que pesa cada cosa al elegir dónde partir. */
const PESO_FRONTERA = 1;
const PESO_DURACION = 0.8;
const PESO_HUECO = 0.25;

/** Lo que dura con voz cada sílaba, en proporción: la del tono neutro es corta, y antes de una pausa se alarga. */
const peso = (s: SilabaTonal) => (s.tono === 5 ? 0.55 : 1) * (s.pausa ? 1.3 : 1);

/**
 * Dónde suena cada sílaba. Se elige la partición de la voz en tantas sílabas como tiene la frase que mejor cuadra con
 * tres cosas: las fronteras caen donde no hay voz o donde baja la energía; cada sílaba se lleva una parte de la voz
 * parecida a la que le toca; y ninguna tiene dentro un hueco sin voz largo. Sin voz bastante para todas, null.
 */
export function tramosDeSilabas(curva: MarcoTono[], silabas: SilabaTonal[]): TramoSilaba[] | null {
  const n = silabas.length;
  const trozos = trozosDeVoz(curva);
  if (!n || !trozos.length) return null;
  const primero = curva.findIndex((m) => m.t >= trozos[0].inicio - 0.05);
  let ultimo = curva.length - 1;
  while (ultimo > primero && curva[ultimo].t > trozos[trozos.length - 1].fin + 0.05) ultimo--;
  const marcos = curva.slice(primero, ultimo + 1);
  const f = marcos.length;
  const sonoro = marcos.map((m) => m.f0 !== null);
  const totalVoz = sonoro.filter(Boolean).length;
  if (totalVoz < n * VOZ_MINIMA) return null;

  // Lo que cuesta poner una frontera delante de cada marco: según lo que baja la energía respecto a la voz de alrededor,
  // tenga voz o no. Lo más callado (el cierre de una d, una pausa) es lo más barato.
  const db = marcos.map((m) => 20 * Math.log10(m.energia + 1e-5));
  const suave = db.map((_, i) => {
    const v = db.slice(Math.max(0, i - 1), i + 2);
    return v.reduce((a, b) => a + b, 0) / v.length;
  });
  const frontera = new Float64Array(f + 1);
  for (let i = 1; i < f; i++) {
    const antes = Math.max(...suave.slice(Math.max(0, i - 15), i + 1));
    const despues = Math.max(...suave.slice(i, i + 16));
    frontera[i] = Math.min(1, Math.max(0, 1 - (Math.min(antes, despues) - suave[i]) / HONDURA_DB));
  }

  const pesos = silabas.map(peso);
  const suma = pesos.reduce((a, b) => a + b, 0);
  const esperada = pesos.map((p) => (totalVoz * p) / suma);
  // coste[k][i]: lo mejor para repartir los marcos hasta i en k sílabas; de dónde, el inicio de la última.
  const coste = Array.from({ length: n + 1 }, () => new Float64Array(f + 1).fill(Infinity));
  const desde = Array.from({ length: n + 1 }, () => new Int32Array(f + 1).fill(-1));
  coste[0][0] = 0;
  for (let i = 1; i <= f; i++) {
    let voz = 0;
    let izquierda = -1;
    let hueco = 0;
    for (let j = i - 1; j >= Math.max(0, i - MARCOS_MAXIMOS); j--) {
      if (sonoro[j]) {
        if (izquierda >= 0) hueco = Math.max(hueco, izquierda - j - 1);
        izquierda = j;
        voz++;
      }
      if (i - j < MARCOS_MINIMOS || voz < VOZ_MINIMA) continue;
      const fijo = (j > 0 ? PESO_FRONTERA * frontera[j] : 0) + PESO_HUECO * Math.max(0, hueco - HUECO_LIBRE);
      for (let k = 1; k <= n; k++) {
        const previo = coste[k - 1][j];
        if (previo === Infinity) continue;
        const d = (voz - esperada[k - 1]) / esperada[k - 1];
        const c = previo + fijo + PESO_DURACION * d * d;
        if (c < coste[k][i]) {
          coste[k][i] = c;
          desde[k][i] = j;
        }
      }
    }
  }
  if (coste[n][f] === Infinity) return null;
  const bordes = [f];
  for (let k = n, i = f; k > 0; k--) {
    i = desde[k][i];
    bordes.unshift(i);
  }
  const tiempo = (i: number) => (i < f ? marcos[i].t - 0.005 : marcos[f - 1].t + 0.005);
  return silabas.map((_, k) => ({ inicio: tiempo(bordes[k]), fin: tiempo(bordes[k + 1]) }));
}

// ---------- La forma del tono de cada sílaba ----------

/** La voz de quien habla: su tono central y lo que abarca, de lo grave a lo agudo, en semitonos respecto a ese centro. */
export interface RegistroVoz {
  referencia: number;
  bajo: number;
  alto: number;
  /**
   * Si abarca bastantes sílabas para saber qué es alto y qué es bajo en esta voz. En una palabra suelta, lo que abarca
   * lo marca ella misma: solo cuenta la forma de cada sílaba, no su altura.
   */
  fiable: boolean;
}

/** Lo que abarca una voz que casi no se mueve: con menos, cualquier vaivén parecería un tono. */
const REGISTRO_MINIMO = 5;
/** Con menos sílabas con tono, la altura de una no dice nada: el registro lo marca ella. */
const SILABAS_REGISTRO = 3;

export function registroDeVoz(curva: MarcoTono[], silabasConTono = SILABAS_REGISTRO): RegistroVoz {
  const conTono = curva.filter((m) => m.f0 !== null).map((m) => m.f0!);
  const referencia = mediana(conTono);
  const st = conTono.map((f) => semitonos(f, referencia)).sort((a, b) => a - b);
  const percentil = (p: number) => st[Math.min(st.length - 1, Math.max(0, Math.round((st.length - 1) * p)))] ?? 0;
  let bajo = percentil(0.1);
  let alto = percentil(0.9);
  if (alto - bajo < REGISTRO_MINIMO) {
    const medio = (alto + bajo) / 2;
    bajo = medio - REGISTRO_MINIMO / 2;
    alto = medio + REGISTRO_MINIMO / 2;
  }
  return { referencia, bajo, alto, fiable: silabasConTono >= SILABAS_REGISTRO };
}

/** En cuántos puntos se mira la curva de una sílaba. */
const PUNTOS = 10;

/**
 * La curva de una sílaba, en diez puntos repartidos por lo que tiene voz, en semitonos respecto a la voz; null sin datos.
 * Se suaviza con una mediana de cinco marcos, que quita los saltos sueltos, y se dejan fuera los bordes: al principio
 * suena aún el tono de la sílaba de antes, y al final la voz se apaga.
 */
export function curvaDeSilaba(curva: MarcoTono[], tramo: TramoSilaba, registro: RegistroVoz): number[] | null {
  const voz = curva.filter((m) => m.f0 !== null && m.t >= tramo.inicio && m.t < tramo.fin).map((m) => semitonos(m.f0!, registro.referencia));
  if (voz.length < 4) return null;
  const suave = voz.map((_, i) => mediana(voz.slice(Math.max(0, i - 2), i + 3)));
  const borde = suave.length >= 8 ? Math.round(suave.length * 0.1) : 0;
  const propio = suave.slice(borde, suave.length - borde);
  return Array.from({ length: PUNTOS }, (_, k) => {
    const x = (k / (PUNTOS - 1)) * (propio.length - 1);
    const a = Math.floor(x);
    const b = Math.min(propio.length - 1, a + 1);
    return propio[a] + (propio[b] - propio[a]) * (x - a);
  });
}

/** Lo que se oye en una sílaba que no tiene la forma de su tono. */
export type FormaOida = 'cae' | 'sube' | 'alto' | 'bajo' | 'llano';

export type VeredictoTono = 'bien' | 'revisar' | 'sin-datos' | 'sin-juzgar';

export interface JuicioTono {
  veredicto: VeredictoTono;
  oida?: FormaOida;
}

/**
 * Lo que tiene que caer o subir una sílaba, en semitonos, y dónde tiene que quedar en el registro (0 lo más grave, 1 lo
 * más agudo). Las caídas y subidas son las mayores dentro de la sílaba, de un punto a otro posterior: así no las tapa lo
 * que arrastra del tono anterior. Calibrados tono a tono con 182 palabras de Lingua Libre dichas por hablantes nativos,
 * sueltas y juntas de tres en tres, y comprobados con otras 182 de hablantes distintos: en frases se da por buena el
 * 70 % de las sílabas dichas con su tono, y el 19 % de las dichas con otro (ver la memoria de la 0.44.0). El tercero es
 * el que menos se distingue: en lo más grave la voz se vuelve áspera y se pierde el tono.
 */
export const UMBRALES = {
  caidaPrimero: 2,
  subidaPrimero: 2,
  nivelPrimero: 0.4,
  subidaSegundo: 1.5,
  caidaTercero: 5,
  subidaTercero: 1.5,
  nivelTercero: 0.4,
  caidaCuarto: 1.5,
  nivelCuarto: 0.5,
};

/** La caída y la subida mayores de una curva, desde dónde cae, dónde está su punto más bajo, su media y su mínimo. */
function formaDe(puntos: number[]) {
  let caida = 0;
  let desde = puntos[0];
  let subida = 0;
  for (let i = 0; i < puntos.length; i++) {
    for (let j = i + 1; j < puntos.length; j++) {
      if (puntos[i] - puntos[j] > caida) {
        caida = puntos[i] - puntos[j];
        desde = puntos[i];
      }
      subida = Math.max(subida, puntos[j] - puntos[i]);
    }
  }
  const minimo = Math.min(...puntos);
  return { caida, desde, subida, minimo, dondeMinimo: puntos.indexOf(minimo), media: puntos.reduce((a, b) => a + b, 0) / puntos.length };
}

const BIEN: JuicioTono = { veredicto: 'bien' };
const revisar = (oida: FormaOida): JuicioTono => ({ veredicto: 'revisar', oida });

/**
 * Si la curva de una sílaba cuadra con un tono, y si no, qué se oye en ella. Con `final`, delante de una pausa: el tercero
 * puede volver a subir tras lo más bajo (214). La altura solo cuenta si el registro es fiable.
 */
export function cuadraConTono(puntos: number[], tono: number, registro: RegistroVoz, final = false, u = UMBRALES): JuicioTono {
  const { caida, desde, subida, minimo, dondeMinimo, media } = formaDe(puntos);
  const nivel = (x: number) => (x - registro.bajo) / (registro.alto - registro.bajo);
  switch (tono) {
    case 1:
      if (caida >= u.caidaPrimero && caida >= subida) return revisar('cae');
      if (subida >= u.subidaPrimero) return revisar('sube');
      if (registro.fiable && nivel(media) < u.nivelPrimero) return revisar('bajo');
      return BIEN;
    case 2:
      if (subida >= u.subidaSegundo && subida > caida) return BIEN;
      return revisar(caida >= u.subidaSegundo && caida > subida ? 'cae' : 'llano');
    case 3:
      if (caida >= u.caidaTercero && caida > subida) return revisar('cae');
      if (subida >= u.subidaTercero && !(final && dondeMinimo >= 2)) return revisar('sube');
      if (registro.fiable && nivel(minimo) > u.nivelTercero) return revisar('alto');
      return BIEN;
    case 4:
      // Cae desde arriba: un tercero también cae un poco, pero desde la parte baja.
      if (caida >= u.caidaCuarto && caida > subida && (!registro.fiable || nivel(desde) >= u.nivelCuarto)) return BIEN;
      if (subida > caida && subida >= u.caidaCuarto) return revisar('sube');
      return revisar(caida >= u.caidaCuarto && caida > subida ? 'bajo' : 'llano');
    default:
      return { veredicto: 'sin-juzgar' };
  }
}

/** El juicio de una sílaba: con su tono, o con el que también vale. El neutro no se juzga. */
export function juzgarSilaba(s: SilabaTonal, puntos: number[] | null, registro: RegistroVoz): JuicioTono {
  if (s.tono === 5) return { veredicto: 'sin-juzgar' };
  if (!puntos) return { veredicto: 'sin-datos' };
  const juicio = cuadraConTono(puntos, s.tono, registro, s.pausa);
  if (juicio.veredicto === 'bien' || !s.tambien) return juicio;
  return cuadraConTono(puntos, s.tambien, registro, s.pausa).veredicto === 'bien' ? BIEN : juicio;
}

export interface ResultadoTonos {
  tramos: TramoSilaba[];
  registro: RegistroVoz;
  curvas: (number[] | null)[];
  juicios: JuicioTono[];
}

/** Todo junto: dónde suena cada sílaba, su curva y su juicio. null si no se distinguen las sílabas en la grabación. */
export function juzgarTonos(curva: MarcoTono[], silabas: SilabaTonal[]): ResultadoTonos | null {
  const tramos = tramosDeSilabas(curva, silabas);
  if (!tramos) return null;
  const registro = registroDeVoz(curva, silabas.filter((s) => s.tono !== 5).length);
  const curvas = tramos.map((t) => curvaDeSilaba(curva, t, registro));
  return { tramos, registro, curvas, juicios: silabas.map((s, i) => juzgarSilaba(s, curvas[i], registro)) };
}
