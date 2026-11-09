// Orden de los trazos: qué hay dentro de un archivo de trazos. De dónde sale cada carácter lo dice su lengua.

/** Una pieza de un carácter, como la ve KanjiVG: el 心 de 愛, o el ⺤ que es una forma de 爪. */
export interface PiezaCaracter {
  caracter: string;
  /** El carácter del que es una forma, si lo es. */
  original?: string;
  /** Si es el radical con que lo ordenan los diccionarios. */
  radical?: boolean;
  /** Las piezas que lleva dentro. */
  piezas: PiezaCaracter[];
}

export interface DatosTrazos {
  /** Un trazado SVG por trazo, en el orden en que se escriben, sobre un lienzo de 109 × 109. */
  trazos: string[];
  /** Dónde va el número de cada trazo. */
  numeros: { x: number; y: number }[];
  /** Sus piezas, de la primera a la última. Lo guardado por versiones anteriores no las trae. */
  componentes?: PiezaCaracter[];
  /** La pieza que le da el sonido, si KanjiVG la señala: 𦰩 en 漢. */
  fonetico?: string;
}

/** Solo órdenes de trazado y números: lo que viene de fuera nunca entra en la página tal cual. */
const TRAZADO_VALIDO = /^[MmLlHhVvCcSsQqTtZz0-9,.\s+-]+$/;

/** Donde empieza un trazado: sirve de sitio para el número si el archivo no trae uno. */
function inicioDe(d: string): { x: number; y: number } {
  const m = /^\s*[Mm]\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/.exec(d);
  return m ? { x: Number(m[1]), y: Number(m[2]) } : { x: 0, y: 0 };
}

/** Un solo carácter de una escritura que se compone por piezas: lo que viene de fuera no entra en la página tal cual. */
const PIEZA_VALIDA = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]$/u;

interface Grupo {
  caracter?: string;
  original?: string;
  radical?: boolean;
  fonetico?: string;
  hijos: Grupo[];
}

const atributo = (etiqueta: string, nombre: string) => new RegExp(`\\s${nombre}="([^"]*)"`).exec(etiqueta)?.[1];
const valida = (c: string | undefined) => (c && PIEZA_VALIDA.test(c) ? c : undefined);

/** Las piezas con nombre que cuelgan de un grupo: los grupos sin nombre (la mitad derecha, la de abajo) se atraviesan. */
function piezasDe(g: Grupo, profundidad = 0): PiezaCaracter[] {
  const salida: PiezaCaracter[] = [];
  for (const h of g.hijos) {
    if (!h.caracter) {
      salida.push(...piezasDe(h, profundidad));
      continue;
    }
    // Una pieza partida en dos (衣 alrededor de otra) aparece dos veces: cuenta una.
    if (salida.some((x) => x.caracter === h.caracter)) continue;
    salida.push({
      caracter: h.caracter,
      ...(h.original && h.original !== h.caracter ? { original: h.original } : {}),
      ...(h.radical ? { radical: true } : {}),
      piezas: profundidad < 3 ? piezasDe(h, profundidad + 1) : [],
    });
  }
  return salida;
}

/** El árbol de grupos de KanjiVG: cada pieza con su forma original, si es el radical y si le da el sonido. */
function leerPiezas(svg: string): { componentes: PiezaCaracter[]; fonetico?: string } {
  const raiz: Grupo = { hijos: [] };
  const pila: Grupo[] = [raiz];
  for (const m of svg.matchAll(/<g\b[^>]*>|<\/g>/g)) {
    if (m[0] === '</g>') {
      if (pila.length > 1) pila.pop();
      continue;
    }
    const radical = atributo(m[0], 'kvg:radical');
    const g: Grupo = {
      caracter: valida(atributo(m[0], 'kvg:element')),
      original: valida(atributo(m[0], 'kvg:original')),
      // «general» es el de siempre y «tradit» el de los diccionarios clásicos; «nelson» es solo el de uno de ellos.
      radical: radical === 'general' || radical === 'tradit',
      fonetico: valida(atributo(m[0], 'kvg:phon')),
      hijos: [],
    };
    pila[pila.length - 1].hijos.push(g);
    pila.push(g);
  }
  // El primer grupo con nombre es el propio carácter; sus piezas son lo que lleva dentro.
  const buscarCaracter = (g: Grupo): Grupo | undefined => (g.caracter ? g : g.hijos.map(buscarCaracter).find(Boolean));
  const caracter = buscarCaracter(raiz);
  const buscarFonetico = (g: Grupo): string | undefined => g.fonetico ?? g.hijos.map(buscarFonetico).find(Boolean);
  const fonetico = caracter ? buscarFonetico(caracter) : undefined;
  return { componentes: caracter ? piezasDe(caracter) : [], ...(fonetico ? { fonetico } : {}) };
}

/**
 * Saca de un SVG de KanjiVG los trazos y sus números. Los trazos se ordenan por su identificador y no por su posición
 * en el archivo: este agrupa por componentes, y en algunos kanji el orden de escritura salta de uno a otro.
 */
export function leerTrazos(svg: string): DatosTrazos | null {
  const trazos: { n: number; d: string }[] = [];
  for (const m of svg.matchAll(/<path\b[^>]*>/g)) {
    const d = /\sd="([^"]+)"/.exec(m[0])?.[1];
    if (!d || !TRAZADO_VALIDO.test(d)) continue;
    const n = Number(/-s(\d+)"/.exec(m[0])?.[1] ?? trazos.length + 1);
    trazos.push({ n, d });
  }
  if (!trazos.length) return null;
  trazos.sort((a, b) => a.n - b.n);
  const sitios = new Map<number, { x: number; y: number }>();
  for (const m of svg.matchAll(/<text\b[^>]*transform="matrix\(1 0 0 1 (-?[\d.]+) (-?[\d.]+)\)"[^>]*>(\d+)<\/text>/g)) {
    sitios.set(Number(m[3]), { x: Number(m[1]), y: Number(m[2]) });
  }
  return {
    trazos: trazos.map((t) => t.d),
    numeros: trazos.map((t, i) => sitios.get(i + 1) ?? inicioDe(t.d)),
    ...leerPiezas(svg),
  };
}

/** Cuántos trazos de cada carácter hay ya dibujados, cuando en toda la palabra van `paso`. */
export function hechosPorCaracter(conteos: number[], paso: number): number[] {
  let resto = paso;
  return conteos.map((c) => {
    const hechos = Math.max(0, Math.min(c, resto));
    resto -= hechos;
    return hechos;
  });
}
