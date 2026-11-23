// Casa una letra con lo que oyó el reconocedor, letra a letra. Lo oído trae la hora de cada línea; dentro de ella, cada
// letra recibe la suya según lo que se tarda en cantarla. Así se sabe a qué hora suena cada parte de la letra aunque el
// reconocedor juntara varios versos en una línea, escribiera otros kanji o se saltara palabras.

import type { Linea } from './subtitulos';

// El katakana que tiene pareja en hiragana está 0x60 puntos de código por encima.
const KATAKANA_DESDE = 0x30a1;
const KATAKANA_HASTA = 0x30f6;
const DE_KATAKANA_A_HIRAGANA = 0x60;

/** Para comparar: sin signos ni espacios, katakana como hiragana, anchos y mayúsculas igualados. */
export function letrasComparables(texto: string): string[] {
  return [
    ...texto
      .normalize('NFKC')
      .toLowerCase()
      .replace(/\p{Script=Katakana}/gu, (c) => {
        const n = c.charCodeAt(0);
        return n >= KATAKANA_DESDE && n <= KATAKANA_HASTA ? String.fromCharCode(n - DE_KATAKANA_A_HIRAGANA) : c;
      })
      .replace(/[^\p{L}\p{N}]/gu, ''),
  ];
}

const IDEOGRAMA = /\p{Script=Han}/u;
/** La kana pequeña del hiragana (las vocales, y, wa y la っ): se canta en media mora o junto a la anterior. */
const KANA_PEQUENA = new Set([0x3041, 0x3043, 0x3045, 0x3047, 0x3049, 0x3063, 0x3083, 0x3085, 0x3087, 0x308e]);
const LATINA = /[a-z]/;

/** Lo que se tarda en cantar una letra, en «moras»: un ideograma suele leerse con dos; una latina es casi nada. */
export function pesoLetra(c: string): number {
  if (IDEOGRAMA.test(c)) return 1.8;
  if (KANA_PEQUENA.has(c.charCodeAt(0))) return 0.6;
  if (LATINA.test(c)) return 0.35;
  return 1;
}

/** Cada letra de lo oído con la hora a la que suena: la de su línea, repartida según lo que se tarda en cantar cada una. */
export function letrasConHora(lineas: Linea[]): { letras: string[]; horas: number[] } {
  const letras: string[] = [];
  const horas: number[] = [];
  for (const l of lineas) {
    const propias = letrasComparables(l.texto);
    const total = propias.reduce((s, c) => s + pesoLetra(c), 0);
    let hecho = 0;
    for (const c of propias) {
      letras.push(c);
      horas.push(l.inicio + ((l.fin - l.inicio) * hecho) / Math.max(total, 1e-6));
      hecho += pesoLetra(c);
    }
  }
  return { letras, horas };
}

/**
 * Lo que vale que case una letra: lo que dice de dónde se está. Un ideograma casi nunca casa por casualidad (3); una kana,
 * algo más (2); una letra latina, mucho (0,5). En una canción japonesa con el estribillo en inglés, las letras de «a
 * beautiful star» casaban con un «a beautiful day» oído en otra parte y pesaban más que un verso japonés oído entero,
 * que se quedaba sin casar.
 */
function valorCoincidencia(c: string): number {
  if (IDEOGRAMA.test(c)) return 6;
  if (LATINA.test(c) || /\p{N}/u.test(c)) return 1;
  return 4;
}

/** Un tramo de letras seguidas iguales: empieza en la letra `i` de un texto y en la `j` del otro. */
export interface Tramo {
  i: number;
  j: number;
  largo: number;
  valor: number;
}

/**
 * Todos los tramos de dos o más letras seguidas iguales en los dos textos, también los finales de cada uno: si su
 * principio se pisa con el tramo de antes, se puede usar solo el resto («い感じ» tras «なんかすごい» comparte la い, y queda
 * «感じ»). Sirve también para otras tiras, como fonemas, con su propio valor y su largo mínimo.
 */
export function tramosComunes(a: string[], b: string[], valorDe: (c: string) => number = valorCoincidencia, minimo = 2): Tramo[] {
  const posiciones = new Map<string, number[]>();
  b.forEach((c, j) => {
    const lista = posiciones.get(c);
    if (lista) lista.push(j);
    else posiciones.set(c, [j]);
  });
  const valor = a.map(valorDe);
  const tramos: Tramo[] = [];
  a.forEach((c, i) => {
    for (const j of posiciones.get(c) ?? []) {
      // Solo desde el principio de cada tramo: el resto de la diagonal ya lo cuenta él.
      if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) continue;
      let largo = 1;
      while (i + largo < a.length && j + largo < b.length && a[i + largo] === b[j + largo]) largo++;
      for (let d = 0; largo - d >= minimo; d++) {
        let suma = 0;
        for (let k = d; k < largo; k++) suma += valor[i + k];
        tramos.push({ i: i + d, j: j + d, largo: largo - d, valor: suma });
      }
    }
  });
  return tramos;
}

/**
 * Casa dos textos encadenando tramos: se buscan todos los de dos o más letras seguidas iguales en los dos y se elige la
 * cadena en orden (sin que dos se crucen ni se pisen) que más vale. Lo que queda entre tramos, sea lo que el reconocedor
 * oyó mal o versos que no oyó, no cuesta nada: con una alineación letra a letra, saltarse lo mal oído costaba tanto como
 * casar, y se aprovechaban sus letras sueltas en lugar de un verso oído entero. Devuelve las parejas (i, j) de letras
 * iguales, en orden.
 */
export function alinearLetras(a: string[], b: string[]): [number, number][] {
  const tramos = tramosComunes(a, b);
  if (!tramos.length) return [];
  // La mejor cadena que acaba en cada tramo. Se recorren por su principio en la letra; un tramo entra en el árbol (por
  // dónde acaba en lo oído) cuando ya se ha pasado por dónde acaba en la letra, para que el siguiente no lo pise.
  tramos.sort((x, y) => x.i - y.i || x.j - y.j);
  const porFinal = tramos.map((_, k) => k).sort((x, y) => tramos[x].i + tramos[x].largo - (tramos[y].i + tramos[y].largo));
  const arbol = new ArbolMaximos(b.length);
  const mejor = new Float64Array(tramos.length);
  const anterior = new Int32Array(tramos.length).fill(-1);
  let entrados = 0;
  tramos.forEach((t, k) => {
    while (entrados < porFinal.length && tramos[porFinal[entrados]].i + tramos[porFinal[entrados]].largo <= t.i) {
      const p = porFinal[entrados++];
      arbol.poner(tramos[p].j + tramos[p].largo - 1, mejor[p], p);
    }
    const [previo, cual] = t.j > 0 ? arbol.hasta(t.j - 1) : [0, -1];
    mejor[k] = t.valor + Math.max(0, previo);
    anterior[k] = previo > 0 ? cual : -1;
  });
  let k = 0;
  for (let x = 1; x < tramos.length; x++) if (mejor[x] > mejor[k]) k = x;
  const parejas: [number, number][] = [];
  for (; k >= 0; k = anterior[k]) {
    const t = tramos[k];
    for (let d = t.largo - 1; d >= 0; d--) parejas.push([t.i + d, t.j + d]);
  }
  return parejas.reverse();
}

/** Un árbol de Fenwick de máximos: el mejor valor (y de qué tramo) entre las posiciones 0 a k. */
export class ArbolMaximos {
  private valor: Float64Array;
  private cual: Int32Array;
  constructor(private n: number) {
    this.valor = new Float64Array(n + 1).fill(Number.NEGATIVE_INFINITY);
    this.cual = new Int32Array(n + 1).fill(-1);
  }
  poner(posicion: number, v: number, cual: number) {
    for (let k = posicion + 1; k <= this.n; k += k & -k) {
      if (v > this.valor[k]) {
        this.valor[k] = v;
        this.cual[k] = cual;
      }
    }
  }
  hasta(posicion: number): [number, number] {
    let v = Number.NEGATIVE_INFINITY;
    let cual = -1;
    for (let k = posicion + 1; k > 0; k -= k & -k) {
      if (this.valor[k] > v) {
        v = this.valor[k];
        cual = this.cual[k];
      }
    }
    return [v, cual];
  }
}

/** Lo que se tarda en cantar una mora, si no se puede medir: un ritmo medio de J-pop. */
const MS_POR_MORA = 200;
const MS_POR_MORA_MIN = 70;
const MS_POR_MORA_MAX = 500;
/** Un verso cuenta como oído si casa esta parte de sus letras, y al menos dos. */
const PARTE_OIDA = 0.35;
/** Una letra que pondría el verso tan lejos de donde lo ponen las demás casó con otra parte de la canción. */
const LEJOS_MS = 1500;

export interface VersoOido {
  inicio: number;
  fin: number;
  /** Qué parte de sus letras se oyó. */
  oido: number;
}

/**
 * Dónde suena cada verso según lo oído, o null si no se oyó lo bastante. El principio es la hora de su primera letra
 * oída, menos lo que se tarda en cantar las de antes; el final, lo mismo con la última. El ritmo se mide con las letras
 * oídas del propio verso.
 */
export function versosOidos(versos: string[], lineas: Linea[]): (VersoOido | null)[] {
  const a: string[] = [];
  const deVerso: number[] = [];
  const posicion: number[] = [];
  const letrasVerso = versos.map(letrasComparables);
  letrasVerso.forEach((letras, v) =>
    letras.forEach((c, k) => {
      a.push(c);
      deVerso.push(v);
      posicion.push(k);
    })
  );
  const { letras, horas } = letrasConHora(lineas);
  const casadas = versos.map((): { k: number; t: number }[] => []);
  // Solo valen las letras que casan en tramos de dos o más seguidas en las dos: una suelta casa por casualidad, porque
  // dos textos en la misma lengua comparten muchas letras comunes. Con una letra que no es de la canción, casaban así
  // versos enteros en cualquier parte.
  const parejas = alinearLetras(a, letras);
  const seguida = (x: [number, number], y: [number, number] | undefined) => !!y && y[0] === x[0] + 1 && y[1] === x[1] + 1;
  parejas.forEach((x, n) => {
    if (seguida(x, parejas[n + 1]) || seguida(parejas[n - 1] ?? [-2, -2], x)) casadas[deVerso[x[0]]].push({ k: posicion[x[0]], t: horas[x[1]] });
  });
  return letrasVerso.map((propias, v) => {
    const suficiente = (n: number) => propias.length > 0 && n >= Math.min(2, propias.length) && n / propias.length >= PARTE_OIDA;
    if (!suficiente(casadas[v].length)) return null;
    const antes = acumulado(propias);
    // Cada letra oída dice a qué hora empezaría el verso. Las que caen lejos de lo que dicen las demás casaron con otra
    // parte de la canción: se descartan.
    const empiezaria = (x: { k: number; t: number }, ritmo: number) => x.t - antes[x.k] * ritmo;
    const centro = mediana(casadas[v].map((x) => empiezaria(x, MS_POR_MORA)));
    const c = casadas[v].filter((x) => Math.abs(empiezaria(x, MS_POR_MORA) - centro) <= LEJOS_MS);
    if (!suficiente(c.length)) return null;
    const primera = c[0];
    const ultima = c[c.length - 1];
    const medidas = antes[ultima.k] - antes[primera.k];
    const ritmo = medidas > 0 && ultima.t > primera.t ? Math.min(MS_POR_MORA_MAX, Math.max(MS_POR_MORA_MIN, (ultima.t - primera.t) / medidas)) : MS_POR_MORA;
    const total = antes[propias.length];
    return {
      inicio: Math.max(0, mediana(c.map((x) => empiezaria(x, ritmo)))),
      fin: mediana(c.map((x) => x.t + (total - antes[x.k]) * ritmo)),
      oido: c.length / propias.length,
    };
  });
}

/** Lo que se tarda en llegar a cada letra desde el principio del verso, en moras; la última posición es el verso entero. */
function acumulado(letras: string[]): number[] {
  const salida = [0];
  for (const c of letras) salida.push(salida[salida.length - 1] + pesoLetra(c));
  return salida;
}

function mediana(xs: number[]): number {
  const o = [...xs].sort((a, b) => a - b);
  const m = o.length >> 1;
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}
