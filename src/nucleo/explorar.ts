// Lo que el diccionario hace además de buscar una palabra: buscar por significado («perro» → 犬), buscar un punto de
// gramática por su forma o por lo que significa, y ordenar las listas de una categoría (onomatopeyas, refranes…).

import type { EstadoPalabra, GramaticaNivel } from '../compartido/tipos';

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
  /**
   * Sus sentidos en orden, con el diccionario de cada uno (su posición en los ajustes). Solo en el índice del motor, para
   * los sinónimos; sin ellos, cada glosa cuenta como un sentido de un mismo diccionario.
   */
  sentidos?: { dic: number; glosas: string[] }[];
  /** Sus categorías gramaticales (verbo, adjetivo, nombre, adverbio), de las etiquetas del diccionario. */
  clases?: string[];
  /** Lo que se sabe de ella, en las listas que lo enseñan: así se ve de un vistazo cuáles ya conoces. */
  estado?: EstadoPalabra;
}

/**
 * Las categorías gramaticales de una fila del diccionario, según sus etiquetas en el formato de Yomitan: las de JMdict
 * (v5s, v1, adj-i, adj-na, n, adv…) y las de Wiktionary (verb, noun…). Un nombre que se usa como verbo con su verbo
 * auxiliar (la etiqueta vs) cuenta también como verbo.
 */
export function clasesDe(etiquetas: string): string[] {
  const c = new Set<string>();
  for (const t of etiquetas.split(' ')) {
    if (/^(v\d.*|vs(-[a-z])?|vk|vz|vt|vi|vr|vn|v-unspec|verb)$/.test(t)) c.add('verbo');
    else if (/^adj(-.*)?$/.test(t)) c.add('adjetivo');
    else if (/^(n|n-adv|n-t|n-suf|n-pref|pn|noun)$/.test(t)) c.add('nombre');
    else if (/^adv(-to)?$/.test(t)) c.add('adverbio');
  }
  return [...c];
}

/** Si dos entradas pueden ser sinónimos por su categoría: comparten alguna, o a una le faltan las etiquetas. */
const mismaClase = (a: Pick<EntradaBreve, 'clases'>, b: Pick<EntradaBreve, 'clases'>) => !a.clases?.length || !b.clases?.length || a.clases.some((c) => b.clases!.includes(c));

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

/**
 * Los significados de una glosa, para compararlos con los de otras palabras: «andar, marchar» son dos. En minúsculas y
 * sin tildes, sin lo que va entre paréntesis, sin el «to» de los verbos en inglés y sin el punto final.
 */
export function significadosDe(glosa: string): string[] {
  // Las referencias a otra palabra («see: …», «antonym: …») no son un significado de esta.
  if (/^(see|antonym):/i.test(glosa.trim())) return [];
  return sinAcentos(glosa)
    .replace(/\([^)]*\)/g, ' ')
    .split(/[,;]/)
    .map((p) => p.replace(/\s+/g, ' ').trim().replace(/^to /, '').replace(/\.$/, '').trim())
    .filter((p) => p.length > 1);
}

/** Dónde tiene una entrada un significado: en qué diccionario y en cuál de sus sentidos en él (el 0 es el principal). */
interface Donde {
  dic: number;
  sentido: number;
}

/** Una entrada que tiene un significado, y dónde lo tiene. */
export interface ConSignificado extends Donde {
  e: EntradaBreve;
}

const sentidosDe = (e: Pick<EntradaBreve, 'glosas' | 'sentidos'>) => e.sentidos ?? e.glosas.map((g) => ({ dic: 0, glosas: [g] }));

/** Los significados de una entrada, cada uno con el primer sentido en el que aparece, contado dentro de su diccionario. */
function significadosDeEntrada(e: Pick<EntradaBreve, 'glosas' | 'sentidos'>): Map<string, Donde> {
  const m = new Map<string, Donde>();
  const porDic = new Map<number, number>();
  for (const { dic, glosas } of sentidosDe(e)) {
    const sentido = porDic.get(dic) ?? 0;
    porDic.set(dic, sentido + 1);
    for (const g of glosas) for (const s of significadosDe(g)) if (!m.has(s)) m.set(s, { dic, sentido });
  }
  return m;
}

/** En cuántos diccionarios tiene sentidos una entrada. */
const diccionariosDe = (e: Pick<EntradaBreve, 'glosas' | 'sentidos'>) => new Set(sentidosDe(e).map((s) => s.dic)).size;

/** Cada significado, con las entradas que lo tienen: para encontrar las que comparten alguno. */
export function indiceDeSignificados(entradas: Iterable<EntradaBreve>): Map<string, ConSignificado[]> {
  const indice = new Map<string, ConSignificado[]>();
  for (const e of entradas) {
    for (const [s, donde] of significadosDeEntrada(e)) {
      const lista = indice.get(s);
      if (lista) lista.push({ e, ...donde });
      else indice.set(s, [{ e, ...donde }]);
    }
  }
  return indice;
}

/** Lo que pesa una coincidencia según el sentido en el que está: el principal, entera; los siguientes, cada vez menos. */
const pesoSentido = (sentido: number) => 1 / (1 + sentido);

/**
 * Las palabras que significan lo mismo que otra: las que comparten sus significados, primero las que comparten más y, entre
 * iguales, las de uso común. Pesa más coincidir en los sentidos principales de las dos, que los diccionarios ponen
 * primero, que en uno secundario (勉強 es estudiar antes que hacer un descuento). Un significado que comparten muchas
 * palabras («hacer») pesa menos que uno preciso («fabricar»), como una palabra frecuente en un buscador, y uno que tienen
 * muchísimas no cuenta. Si las dos palabras tienen sentidos en dos diccionarios (español e inglés), tienen que coincidir
 * en los dos: así no cuelan los homónimos de una sola lengua, como «gato», que también es el del coche (ジャッキ, jack).
 * De la palabra se miran solo sus `sentidos` primeros en cada diccionario: una lista sin rótulos tiene que hablar de su
 * sentido principal (犬 es un perro antes que un espía); los matices los explica Claude con «Palabras parecidas». Y un
 * sinónimo es de la misma categoría: el de un verbo es otro verbo o un nombre que se usa como verbo, no un nombre suelto
 * que en inglés se escribe igual («converse», conversar y lo contrario).
 */
export function sinonimosDe(indice: Map<string, ConSignificado[]>, propia: Pick<EntradaBreve, 'termino' | 'glosas' | 'sentidos' | 'clases'>, limite = 12, demasiadas = 60, minimo = 0.15, sentidos = 1): EntradaBreve[] {
  const encontradas = new Map<string, { e: EntradaBreve; peso: number; dics: Set<number> }>();
  for (const [s, donde] of significadosDeEntrada(propia)) {
    if (donde.sentido >= sentidos) continue;
    const con = indice.get(s);
    if (!con || con.length > demasiadas) continue;
    const rareza = 1 / Math.log2(1 + con.length);
    for (const c of con) {
      if (c.e.termino === propia.termino || !mismaClase(propia, c.e)) continue;
      const peso = rareza * pesoSentido(donde.sentido) * pesoSentido(c.sentido);
      const clave = `${c.e.termino}|${c.e.lectura}`;
      const previa = encontradas.get(clave);
      if (previa) {
        previa.peso += peso;
        previa.dics.add(donde.dic);
      } else encontradas.set(clave, { e: c.e, peso, dics: new Set([donde.dic]) });
    }
  }
  const necesarios = Math.min(2, diccionariosDe(propia));
  return [...encontradas.values()]
    .flatMap((x) => {
      if (x.dics.size >= necesarios) return [x];
      // Coincide en un solo idioma: si la otra palabra tiene los dos, es un homónimo; si no tiene el otro (muchas solo están
      // en inglés), cuenta la mitad, porque un homónimo inglés («head», «fast») no se puede descartar de otra manera.
      return diccionariosDe(x.e) < necesarios ? [{ ...x, peso: x.peso / 2 }] : [];
    })
    .filter((x) => x.peso >= minimo)
    .sort((a, b) => b.peso - a.peso || Number(b.e.comun) - Number(a.e.comun) || b.e.puntuacion - a.e.puntuacion || a.e.lectura.localeCompare(b.e.lectura))
    .slice(0, limite)
    .map((x) => x.e);
}

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
