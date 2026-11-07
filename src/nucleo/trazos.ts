// Orden de los trazos: qué hay dentro de un archivo de trazos. De dónde sale cada carácter lo dice su lengua.

export interface DatosTrazos {
  /** Un trazado SVG por trazo, en el orden en que se escriben, sobre un lienzo de 109 × 109. */
  trazos: string[];
  /** Dónde va el número de cada trazo. */
  numeros: { x: number; y: number }[];
}

/** Solo órdenes de trazado y números: lo que viene de fuera nunca entra en la página tal cual. */
const TRAZADO_VALIDO = /^[MmLlHhVvCcSsQqTtZz0-9,.\s+-]+$/;

/** Donde empieza un trazado: sirve de sitio para el número si el archivo no trae uno. */
function inicioDe(d: string): { x: number; y: number } {
  const m = /^\s*[Mm]\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/.exec(d);
  return m ? { x: Number(m[1]), y: Number(m[2]) } : { x: 0, y: 0 };
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
