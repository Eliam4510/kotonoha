// Lo que el diccionario hace además de buscar una palabra: buscar por significado («perro» → 犬), buscar un punto de
// gramática por su forma o por lo que significa, y ordenar las listas de una categoría (onomatopeyas, refranes…).

import type { GramaticaNivel } from '../compartido/tipos';

/** En minúsculas y sin tildes: «Canción» y «cancion» son lo mismo al buscar. */
export const sinAcentos = (s: string): string => s.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase();

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Cuánto encaja una glosa con lo buscado: 3 si es justo eso, 2 si empieza por ello, 1 si lo lleva como palabra suelta y 0
 * si no lo lleva. Sin lo que va entre paréntesis ni el «to» de los verbos en inglés: «to eat» es «eat».
 */
export function encajeGlosa(glosa: string, buscado: string): number {
  const q = sinAcentos(buscado).trim();
  if (!q) return 0;
  const g = sinAcentos(glosa).replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim().replace(/^to /, '');
  if (g === q) return 3;
  if (g.startsWith(`${q} `) || g.startsWith(`${q},`) || g.startsWith(`${q};`)) return 2;
  return new RegExp(`(^|[^\\p{L}])${escapar(q)}([^\\p{L}]|$)`, 'u').test(g) ? 1 : 0;
}

/** Una entrada del diccionario, resumida para las listas: la palabra, su lectura, su primera glosa y si es de uso común. */
export interface EntradaBreve {
  termino: string;
  lectura: string;
  glosa: string;
  /** Todas sus glosas, para buscar por significado. */
  glosas: string[];
  comun: boolean;
  puntuacion: number;
}

/**
 * Las entradas que significan lo buscado, de la que mejor encaja a la que menos, y entre iguales las más comunes. Cada una
 * lleva como glosa la que encajó: 獅子 sale por «perro león», no por su primera glosa, «león».
 */
export function buscarPorSignificado(entradas: Iterable<EntradaBreve>, buscado: string, limite = 30): EntradaBreve[] {
  const con: { e: EntradaBreve; n: number }[] = [];
  for (const e of entradas) {
    let n = 0;
    let glosa = e.glosa;
    for (const g of e.glosas) {
      const m = encajeGlosa(g, buscado);
      if (m > n) {
        n = m;
        glosa = g;
      }
    }
    if (n) con.push({ e: { ...e, glosa }, n });
  }
  return con
    .sort((a, b) => b.n - a.n || Number(b.e.comun) - Number(a.e.comun) || b.e.puntuacion - a.e.puntuacion || a.e.lectura.localeCompare(b.e.lectura))
    .slice(0, limite)
    .map((x) => x.e);
}

/** Las de uso común primero; luego por puntuación y por lectura. */
export const ordenarEntradas = (xs: EntradaBreve[]): EntradaBreve[] =>
  [...xs].sort((a, b) => Number(b.comun) - Number(a.comun) || b.puntuacion - a.puntuacion || a.lectura.localeCompare(b.lectura));

/** Un patrón sin las marcas que no se escriben (〜) ni las notas entre paréntesis. */
const nucleoPatron = (p: string) => p.replace(/[（(][^）)]*[）)]/g, '').replace(/[〜～\s]/g, '');

/** Los puntos de gramática que encajan con lo buscado: por su forma, si lo buscado está en la lengua, o por su significado. */
export function buscarGramatica(puntos: { nivel: string; g: GramaticaNivel }[], buscado: string, idioma: string, limite = 12): { nivel: string; g: GramaticaNivel }[] {
  const q = buscado.trim();
  if (!q) return [];
  const forma = nucleoPatron(q);
  const sentido = sinAcentos(q);
  const puntuar = ({ g }: { g: GramaticaNivel }) => {
    const n = nucleoPatron(g.patron);
    if (n && n === forma) return 6;
    if (n && forma && n.startsWith(forma)) return 5;
    if (n && forma && n.includes(forma)) return 4;
    // Una frase entera que lleva el patrón.
    if (n.length >= 2 && forma.includes(n)) return 3;
    const significados = [g.significado[idioma], g.significado.en, g.significado.es].filter(Boolean) as string[];
    const mejor = Math.max(0, ...significados.map((s) => encajeGlosa(s.replace(/[…]/g, ' '), sentido)));
    return mejor ? mejor - 1 + 0.5 : 0;
  };
  return puntos
    .map((p, i) => ({ p, n: puntuar(p), i }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .slice(0, limite)
    .map((x) => x.p);
}
