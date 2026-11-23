// Lo que se canta de una letra pegada. Una letra copiada de internet no siempre es la canción tal cual: el estribillo va
// una sola vez aunque se cante tres, o solo su título donde se repite, y a veces falta un verso. Aquí se deduce la
// secuencia que se canta con lo que oyó Whisper: la misma cadena de tramos que casa la letra letra a letra
// (casarLetra.ts), pero que puede volver atrás en la letra, pagando un precio, cuando lo oído repite algo de antes. Sin
// IA y sin inventar nada: la secuencia solo lleva versos de la letra pegada, y cada uno sale al menos una vez.

import { ArbolMaximos, letrasComparables, letrasConHora, pesoLetra, type Tramo, tramosComunes } from './casarLetra';
import type { Linea } from './subtitulos';

/**
 * Lo que cuesta volver atrás en la letra: más que unas letras sueltas casadas por casualidad, menos que un verso oído.
 * Una kana casada vale 4 y un kanji 6.
 */
export const VOLVER_ATRAS = 40;
/** Repetir el verso que acaba de sonar, lo más corriente en un estribillo («うっせぇわ», «No thanks»), cuesta menos. */
export const REPETIR_VERSO = 20;
/**
 * Saltarse versos hacia delante sin oírlos, por cada uno. Whisper deja alguno sin oír, pero no veinte seguidos: sin esto,
 * unas letras casadas por casualidad llevaban la cadena muy adelante, y los versos de en medio parecían cantados.
 */
export const SALTAR_VERSO = 8;

/** Un árbol de segmentos de máximos: el mejor valor (y de qué tramo) entre dos posiciones. */
class RangoMaximos {
  private tam = 1;
  private valor: Float64Array;
  private cual: Int32Array;
  constructor(n: number) {
    while (this.tam < n) this.tam *= 2;
    this.valor = new Float64Array(2 * this.tam).fill(Number.NEGATIVE_INFINITY);
    this.cual = new Int32Array(2 * this.tam).fill(-1);
  }
  poner(posicion: number, v: number, cual: number) {
    let k = posicion + this.tam;
    if (v <= this.valor[k]) return;
    this.valor[k] = v;
    this.cual[k] = cual;
    for (k >>= 1; k >= 1; k >>= 1) {
      const izq = 2 * k;
      const mejorHijo = this.valor[izq] >= this.valor[izq + 1] ? izq : izq + 1;
      this.valor[k] = this.valor[mejorHijo];
      this.cual[k] = this.cual[mejorHijo];
    }
  }
  /** El máximo entre `desde` y `hasta`, las dos incluidas. */
  entre(desde: number, hasta: number): [number, number] {
    let v = Number.NEGATIVE_INFINITY;
    let cual = -1;
    for (let a = desde + this.tam, b = hasta + this.tam + 1; a < b; a >>= 1, b >>= 1) {
      if (a & 1) {
        if (this.valor[a] > v) [v, cual] = [this.valor[a], this.cual[a]];
        a++;
      }
      if (b & 1) {
        b--;
        if (this.valor[b] > v) [v, cual] = [this.valor[b], this.cual[b]];
      }
    }
    return [v, cual];
  }
}
/** Lo que se tarda como poco en cantar una mora: para saber si unos versos que nadie oyó caben en un hueco. */
const MS_POR_MORA_MINIMO = 120;
/** Unos versos que nadie oyó entran en un hueco si cabe esta parte de lo que se tarda en cantarlos deprisa. */
const PARTE_QUE_CABE = 0.5;
/** Una letra pegada que repite al menos esta parte de sus versos ya es la canción entera: no se le añade nada. */
export const LETRA_COMPLETA = 0.25;
/** Hasta cuántos versos saltados son versos que Whisper no oyó; más, es otra parte de la canción. */
const SALTO_CORTO = 3;

export interface LetraCantada {
  /** Los versos en el orden en que se cantan, con sus repeticiones. */
  versos: string[];
  /** De qué verso de la letra pegada es cada uno. */
  indices: number[];
  /** Cuántas veces se vuelve atrás en la letra. */
  repeticiones: number;
}

/**
 * La mejor cadena de tramos en el orden de lo oído, que puede volver atrás en la letra pagando `volver`, o `repetir` si
 * vuelve al mismo verso.
 */
function cadena(tramos: Tramo[], deVerso: number[], volver: number, repetir: number, saltar: number): Tramo[] {
  tramos.sort((x, y) => x.j - y.j || x.i - y.i);
  // Un tramo entra en los árboles (por dónde acaba en la letra) cuando ya se ha pasado por dónde acaba en lo oído. En uno
  // va su valor; en el otro, su valor más lo que se ahorra por cada verso que lleva andado, para cobrar los que se salten.
  const porFinal = tramos.map((_, k) => k).sort((x, y) => tramos[x].j + tramos[x].largo - (tramos[y].j + tramos[y].largo));
  const seguidos = new RangoMaximos(deVerso.length);
  const saltando = new ArbolMaximos(deVerso.length);
  const mejor = new Float64Array(tramos.length);
  const anterior = new Int32Array(tramos.length).fill(-1);
  // Dónde empieza cada verso en la tira.
  const versos = (deVerso.at(-1) ?? 0) + 1;
  const inicioVerso = new Int32Array(versos + 1).fill(-1);
  deVerso.forEach((v, i) => {
    if (inicioVerso[v] < 0) inicioVerso[v] = i;
  });
  inicioVerso[versos] = deVerso.length;
  for (let v = versos - 1; v >= 0; v--) if (inicioVerso[v] < 0) inicioVerso[v] = inicioVerso[v + 1];
  // Lo mejor que acaba en cada verso, para repetirlo.
  const mejorEnVerso = new Float64Array(versos).fill(Number.NEGATIVE_INFINITY);
  const cualEnVerso = new Int32Array(versos).fill(-1);
  let entrados = 0;
  let maximo = Number.NEGATIVE_INFINITY;
  let cualMaximo = -1;
  tramos.forEach((t, k) => {
    while (entrados < porFinal.length && tramos[porFinal[entrados]].j + tramos[porFinal[entrados]].largo <= t.j) {
      const p = porFinal[entrados++];
      const fin = tramos[p].i + tramos[p].largo - 1;
      seguidos.poner(fin, mejor[p], p);
      saltando.poner(fin, mejor[p] + saltar * deVerso[fin], p);
      if (mejor[p] > maximo) {
        maximo = mejor[p];
        cualMaximo = p;
      }
      if (mejor[p] > mejorEnVerso[deVerso[fin]]) {
        mejorEnVerso[deVerso[fin]] = mejor[p];
        cualEnVerso[deVerso[fin]] = p;
      }
    }
    // Siguiendo la letra desde este verso o el anterior, gratis; saltándose versos, cada uno cuesta; repitiendo el verso,
    // poco; volviendo a cualquier otro sitio, más. Empezar, como si se saltaran los versos de antes.
    const verso = deVerso[t.i];
    const desdeAnterior = inicioVerso[Math.max(0, verso - 1)];
    let previo = -saltar * verso;
    let cual = -1;
    if (t.i > desdeAnterior) {
      const [siguiendo, cualSiguiendo] = seguidos.entre(desdeAnterior, t.i - 1);
      if (siguiendo > previo) {
        previo = siguiendo;
        cual = cualSiguiendo;
      }
    }
    if (desdeAnterior > 0) {
      const [saltado, cualSaltado] = saltando.hasta(desdeAnterior - 1);
      if (saltado - saltar * (verso - 1) > previo) {
        previo = saltado - saltar * (verso - 1);
        cual = cualSaltado;
      }
    }
    if (mejorEnVerso[deVerso[t.i]] - repetir > previo) {
      previo = mejorEnVerso[deVerso[t.i]] - repetir;
      cual = cualEnVerso[deVerso[t.i]];
    }
    if (maximo - volver > previo) {
      previo = maximo - volver;
      cual = cualMaximo;
    }
    mejor[k] = t.valor + previo;
    anterior[k] = cual;
  });
  let k = 0;
  for (let x = 1; x < tramos.length; x++) if (mejor[x] > mejor[k]) k = x;
  const salida: Tramo[] = [];
  for (; k >= 0; k = anterior[k]) salida.push(tramos[k]);
  return salida.reverse();
}

/** Una tira (letras o fonemas) con lo que oyó alguien y a qué hora suena cada pieza. */
interface Oido {
  letras: string[];
  horas: number[];
}

/**
 * El núcleo: la letra como una tira de piezas que se sabe de qué verso es cada una, casada con lo oído por tramos
 * encadenados que pueden volver atrás. Devuelve el orden de los versos tal como se cantan.
 */
function estructura(tira: string[], deVerso: number[], moras: number[], oido: Oido, opciones: { volver: number; repetir: number; saltar: number; valor?: (c: string) => number; minimo?: number }): LetraCantada | null {
  const versos = moras.length;
  const tramos = tramosComunes(tira, oido.letras, opciones.valor, opciones.minimo);
  if (!tramos.length) return null;
  const enCadena = cadena(tramos, deVerso, opciones.volver, opciones.repetir, opciones.saltar);
  // Las pasadas por la letra: cada vuelta atrás empieza una. Dentro de una pasada, los versos entre dos tramos que
  // nadie oyó entran si caben en el hueco entre ellos.
  const indices: number[] = [];
  let repeticiones = 0;
  let ultimo = -1;
  let anterior: Tramo | null = null;
  for (const t of enCadena) {
    const primero = deVerso[t.i];
    const final = deVerso[t.i + t.largo - 1];
    const vuelve = anterior !== null && t.i < anterior.i + anterior.largo;
    if (vuelve) {
      repeticiones++;
      ultimo = primero - 1;
    } else if (anterior !== null && primero > ultimo + 1) {
      // Un salto corto es un verso que Whisper no oyó; uno largo, pasar a otra parte de la canción, que no vuelve a cantar
      // lo que ya sonó: de lo saltado entran solo los versos que aún no han sonado nunca.
      let entre = Array.from({ length: primero - ultimo - 1 }, (_, n) => ultimo + 1 + n);
      if (entre.length > SALTO_CORTO) entre = entre.filter((v) => !indices.includes(v));
      const hueco = oido.horas[t.j] - oido.horas[anterior.j + anterior.largo - 1];
      const necesita = entre.reduce((s, v) => s + moras[v], 0) * MS_POR_MORA_MINIMO * PARTE_QUE_CABE;
      if (hueco >= necesita) indices.push(...entre);
    }
    for (let v = Math.max(primero, ultimo + 1); v <= final; v++) indices.push(v);
    ultimo = Math.max(ultimo, final);
    anterior = t;
  }
  // Cada verso de la letra sale al menos una vez: el que nadie oyó, detrás de la primera vez del anterior.
  for (let v = 0; v < versos; v++) {
    if (indices.includes(v)) continue;
    const tras = v === 0 ? -1 : indices.indexOf(v - 1);
    indices.splice(tras + 1, 0, v);
  }
  return { versos: [], indices, repeticiones };
}

const morasDe = (versos: string[]) => versos.map((v) => letrasComparables(v).reduce((s, c) => s + pesoLetra(c), 0));
const comoLetra = (versos: string[], r: LetraCantada | null): LetraCantada => {
  const tal = { versos, indices: versos.map((_, i) => i), repeticiones: 0 };
  if (!r || (r.indices.length === versos.length && r.indices.every((v, k) => v === k))) return tal;
  return { versos: r.indices.map((v) => versos[v]), indices: r.indices, repeticiones: r.repeticiones };
};

/**
 * Los versos tal como se cantan, deducidos de lo que oyó Whisper: un estribillo escrito una vez sale cada vez que se oye,
 * y un verso que Whisper no oyó entra en su sitio si cabe. Si no hay nada que deducir, la letra queda como está.
 */
export function versosCantados(versos: string[], lineas: Linea[], volver = VOLVER_ATRAS, repetir = REPETIR_VERSO, saltar = SALTAR_VERSO): LetraCantada {
  if (versos.length < 2 || !lineas.length) return comoLetra(versos, null);
  // Una letra que ya repite muchos versos es la canción entera: no hay nada que deducir.
  const distintos = new Set(versos.map((v) => letrasComparables(v).join(''))).size;
  if (1 - distintos / versos.length >= LETRA_COMPLETA) return comoLetra(versos, null);
  const tira: string[] = [];
  const deVerso: number[] = [];
  versos.forEach((v, k) => {
    for (const c of letrasComparables(v)) {
      tira.push(c);
      deVerso.push(k);
    }
  });
  return comoLetra(versos, estructura(tira, deVerso, morasDe(versos), letrasConHora(lineas), { volver, repetir, saltar }));
}

/** La cadena de tramos de una letra casada con lo oído, resumida: de qué verso a qué verso va cada tramo y a qué hora. Para medir. */
export function cadenaOida(versos: string[], lineas: Linea[], volver = VOLVER_ATRAS, repetir = REPETIR_VERSO, saltar = SALTAR_VERSO): { desde: number; hasta: number; hora: number; valor: number }[] {
  const tira: string[] = [];
  const deVerso: number[] = [];
  versos.forEach((v, k) => {
    for (const c of letrasComparables(v)) {
      tira.push(c);
      deVerso.push(k);
    }
  });
  const oido = letrasConHora(lineas);
  const tramos = tramosComunes(tira, oido.letras);
  if (!tramos.length) return [];
  return cadena(tramos, deVerso, volver, repetir, saltar).map((t) => ({ desde: deVerso[t.i], hasta: deVerso[t.i + t.largo - 1], hora: Math.round(oido.horas[t.j]), valor: t.valor }));
}
