// Que un signo no se quede solo al principio de un renglón. Cada palabra se pinta como un bloque, y entre un bloque y
// lo que le sigue el navegador parte el renglón aunque sea un punto o una coma, con signo de unión o sin él: lo único
// que lo impide es meter los dos en una caja que no se parte.

import type { JSX } from 'preact';

/** El signo de unión (U+2060) con que la lengua marca hacia dónde se pega un signo: delante de él, a lo de antes; detrás, a lo que sigue. */
export const UNION = '⁠';

/**
 * Agrupa las piezas de una línea que tienen que ir en el mismo renglón. `textos` lleva, por cada pieza, lo que la
 * lengua devuelve al pegar sus signos (`escritura.pegarSignos`), o null si es una palabra. Devuelve los grupos, cada uno
 * con los índices de sus piezas, en orden.
 */
export function gruposSinCorte(textos: (string | null)[]): number[][] {
  const grupos: number[][] = [];
  let pegaLaSiguiente = false;
  textos.forEach((t, i) => {
    const pegaAtras = !!t && t.startsWith(UNION);
    if (grupos.length && (pegaAtras || pegaLaSiguiente)) grupos[grupos.length - 1].push(i);
    else grupos.push([i]);
    pegaLaSiguiente = !!t && t.endsWith(UNION);
  });
  return grupos;
}

/** Las piezas de una línea, con las que van juntas metidas en una caja que no se parte. */
export function sinCortes(elementos: JSX.Element[], textos: (string | null)[]): JSX.Element[] {
  return gruposSinCorte(textos).map((g) => (g.length === 1 ? elementos[g[0]] : <span class="sin-corte" key={`sc${g[0]}`}>{g.map((i) => elementos[i])}</span>));
}
