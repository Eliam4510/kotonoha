// El vocabulario de un libro o de una colección: las palabras de su texto, contadas, con lo que se sabe de cada una.
// Aquí está lo que no necesita navegador: el recuento frase a frase, las frases de ejemplo que se eligen, cómo se juntan
// los trozos de un libro y los tomos de una colección, la comprensión, cuántas palabras hacen falta para entender un tanto
// por ciento del texto y cómo se ordena la lista.

import type { CuentaTexto, DatoPalabra, EjemploTexto, EstadoPalabra, GramaticaContada, PalabraContada } from '../compartido/tipos';

/** Cuántas frases de ejemplo se guardan de cada palabra y de cada punto de gramática. */
export const EJEMPLOS = 3;

/** El largo de una frase de ejemplo: el ideal, desde cuándo es larga y hasta cuándo es corta, en letras o en palabras. */
const LARGO = {
  letras: { ideal: 16, largo: 60, corto: 5 },
  palabras: { ideal: 10, largo: 30, corto: 3 },
};

/** Lo que mide una frase: en letras si la lengua se escribe sin espacios, y si no, en palabras. */
function medida(texto: string, sinEspacios: boolean): number {
  if (sinEspacios) return [...texto.replace(/\s/g, '')].length;
  return texto.split(/\s+/).filter(Boolean).length;
}

/**
 * Cuánto se aparta una frase de lo que se busca en un ejemplo: menos es mejor. Una frase larga o muy corta solo se queda
 * si no hay otra; entre las demás, gana la que más se acerca al largo ideal, que se lee de un vistazo en una tarjeta.
 */
export function distanciaEjemplo(texto: string, sinEspacios: boolean): number {
  const n = medida(texto, sinEspacios);
  const l = sinEspacios ? LARGO.letras : LARGO.palabras;
  let d = Math.abs(n - l.ideal);
  if (n > l.largo) d += 1000;
  if (n < l.corto) d += 100;
  return d;
}

interface Candidato {
  e: EjemploTexto;
  d: number;
}

/** Mete una frase entre los ejemplos si está entre las mejores, sin repetir la misma frase. */
function meterEjemplo(lista: Candidato[], e: EjemploTexto, d: number, maximo = EJEMPLOS): void {
  if (lista.some((c) => c.e.texto === e.texto)) return;
  if (lista.length < maximo) {
    lista.push({ e, d });
    return;
  }
  let peor = 0;
  for (let i = 1; i < lista.length; i++) if (lista[i].d > lista[peor].d) peor = i;
  // A igualdad se queda la de antes: la que sale primero en el libro.
  if (d < lista[peor].d) lista[peor] = { e, d };
}

const mejores = (lista: Candidato[]) => lista.sort((a, b) => a.d - b.d).map((c) => c.e);

/** Una palabra de una frase, tal como la da el analizador, con lo justo para contarla. */
export interface PalabraDeFrase {
  clave: string;
  lema: string;
  lectura: string;
  categoria: string;
  superficie: string;
  gramatica: boolean;
  nombre: boolean;
}

/** Un punto de gramática de una frase. */
export interface PuntoDeFrase {
  patron: string;
  nivel?: string;
  significado: string;
}

/**
 * El recuento de un texto, frase a frase: cada palabra con sus veces, su primera aparición y sus mejores frases, y cada
 * punto de gramática con las frases donde sale. La gramática cuenta una vez por frase.
 */
export class Recuento {
  private palabras = new Map<string, PalabraContada & { candidatos: Candidato[] }>();
  private puntos = new Map<string, GramaticaContada & { candidatos: Candidato[] }>();
  private total = 0;
  private frases = 0;

  constructor(private readonly sinEspacios: boolean) {}

  frase(texto: string, lugar: number, palabras: PalabraDeFrase[], puntos: PuntoDeFrase[] = []): void {
    const limpio = texto.trim();
    if (!limpio) return;
    this.frases++;
    const d = distanciaEjemplo(limpio, this.sinEspacios);
    const vistas = new Set<string>();
    for (const p of palabras) {
      this.total++;
      let c = this.palabras.get(p.clave);
      if (!c) {
        c = {
          clave: p.clave,
          lema: p.lema,
          lectura: p.lectura,
          categoria: p.categoria,
          veces: 0,
          ...(p.gramatica ? { gramatica: true } : {}),
          ...(p.nombre ? { nombre: true } : {}),
          lugar,
          orden: this.palabras.size,
          ejemplos: [],
          candidatos: [],
        };
        this.palabras.set(p.clave, c);
      }
      c.veces++;
      if (p.gramatica) c.gramatica = true;
      if (!p.nombre) delete c.nombre;
      if (vistas.has(p.clave)) continue;
      vistas.add(p.clave);
      meterEjemplo(c.candidatos, { texto: limpio, lugar, superficie: p.superficie }, d);
    }
    const vistos = new Set<string>();
    for (const g of puntos) {
      if (vistos.has(g.patron)) continue;
      vistos.add(g.patron);
      let c = this.puntos.get(g.patron);
      if (!c) {
        c = { patron: g.patron, ...(g.nivel ? { nivel: g.nivel } : {}), significado: g.significado, veces: 0, lugar, ejemplos: [], candidatos: [] };
        this.puntos.set(g.patron, c);
      }
      c.veces++;
      meterEjemplo(c.candidatos, { texto: limpio, lugar }, d);
    }
  }

  resultado(): CuentaTexto {
    return {
      total: this.total,
      frases: this.frases,
      palabras: [...this.palabras.values()].map(({ candidatos, ...p }) => ({ ...p, ejemplos: mejores(candidatos) })),
      gramatica: [...this.puntos.values()].map(({ candidatos, ...g }) => ({ ...g, ejemplos: mejores(candidatos) })),
    };
  }
}

// ---------- Juntar trozos y tomos ----------

/** Dónde está algo: en qué libro (su posición en la colección; 0 si es uno solo) y en qué sitio de él. */
export interface Sitio {
  libro: number;
  lugar: number;
}

export type EjemploVocabulario = EjemploTexto & { libro: number };

export interface PalabraVocabulario extends Omit<PalabraContada, 'lugar' | 'orden' | 'ejemplos'> {
  primera: Sitio;
  /** El orden de la primera aparición en todo lo junto: el de lectura. */
  orden: number;
  ejemplos: EjemploVocabulario[];
  /** Las veces que sale en cada libro, por su posición. */
  porLibro: number[];
}

export interface GramaticaVocabulario extends Omit<GramaticaContada, 'lugar' | 'ejemplos'> {
  primera: Sitio;
  ejemplos: EjemploVocabulario[];
}

export interface Vocabulario {
  total: number;
  frases: number;
  libros: number;
  palabras: PalabraVocabulario[];
  gramatica: GramaticaVocabulario[];
}

/** Lo que se suma a `orden` por cada trozo: así lo que aparece en un trozo va detrás de todo lo del anterior. */
const ORDEN_POR_TROZO = 1e7;

/**
 * Junta los recuentos de varios trozos de texto seguidos: los de un libro largo, que se cuentan por partes, o los libros
 * de una colección. Van en orden de lectura, cada uno con la posición de su libro.
 */
export function juntarCuentas(partes: { cuenta: CuentaTexto; libro: number }[], sinEspacios: boolean): Vocabulario {
  const libros = partes.reduce((n, p) => Math.max(n, p.libro + 1), 0);
  const palabras = new Map<string, PalabraVocabulario & { candidatos: Candidato[] }>();
  const puntos = new Map<string, GramaticaVocabulario & { candidatos: Candidato[] }>();
  let total = 0;
  let frases = 0;
  partes.forEach(({ cuenta, libro }, trozo) => {
    total += cuenta.total;
    frases += cuenta.frases;
    for (const p of cuenta.palabras) {
      let c = palabras.get(p.clave);
      if (!c) {
        const { lugar, orden, ejemplos: _e, ...resto } = p;
        c = { ...resto, veces: 0, primera: { libro, lugar }, orden: trozo * ORDEN_POR_TROZO + orden, ejemplos: [], porLibro: new Array(libros).fill(0), candidatos: [] };
        palabras.set(p.clave, c);
      }
      c.veces += p.veces;
      c.porLibro[libro] += p.veces;
      if (p.gramatica) c.gramatica = true;
      if (!p.nombre) delete c.nombre;
      for (const e of p.ejemplos) meterEjemplo(c.candidatos, { ...e, libro } as EjemploVocabulario, distanciaEjemplo(e.texto, sinEspacios));
    }
    for (const g of cuenta.gramatica) {
      let c = puntos.get(g.patron);
      if (!c) {
        const { lugar, ejemplos: _e, ...resto } = g;
        c = { ...resto, veces: 0, primera: { libro, lugar }, ejemplos: [], candidatos: [] };
        puntos.set(g.patron, c);
      }
      c.veces += g.veces;
      for (const e of g.ejemplos) meterEjemplo(c.candidatos, { ...e, libro } as EjemploVocabulario, distanciaEjemplo(e.texto, sinEspacios));
    }
  });
  return {
    total,
    frases,
    libros,
    palabras: [...palabras.values()].map(({ candidatos, ...p }) => ({ ...p, ejemplos: mejores(candidatos) as EjemploVocabulario[] })),
    gramatica: [...puntos.values()].map(({ candidatos, ...g }) => ({ ...g, ejemplos: mejores(candidatos) as EjemploVocabulario[] })),
  };
}

// ---------- Lo que se sabe ----------

export type FilaVocabulario = PalabraVocabulario & DatoPalabra;

/** Cada palabra con lo que se sabe de ella, en el mismo orden. Sin datos, desconocida. */
export function conDatos(palabras: PalabraVocabulario[], datos: (DatoPalabra | undefined)[]): FilaVocabulario[] {
  return palabras.map((p, i) => ({ ...p, ...(datos[i] ?? { estado: 'desconocida' as EstadoPalabra, rastreada: false }) }));
}

/** Las veces que sale una palabra en un libro, o en todos. */
const vecesEn = (f: PalabraVocabulario, libro?: number) => (libro === undefined ? f.veces : (f.porLibro[libro] ?? 0));

export interface ResumenVocabulario {
  /** Las palabras del texto, contando cada vez que sale cada una, sin las ignoradas. */
  total: number;
  /** De ellas, las que no son desconocidas: conocidas o en aprendizaje. */
  conocidas: number;
  /** De 0 a 100, sin redondear hacia arriba: con alguna desconocida nunca llega a 100. */
  comprension: number;
  /** Palabras distintas, sin las ignoradas. */
  distintas: number;
  porAprender: number;
  aprendiendo: number;
  sabidas: number;
}

/** Cuánto se entiende de un texto con lo que se sabe hoy, como en un video: las ignoradas no cuentan. */
export function resumirVocabulario(filas: FilaVocabulario[], libro?: number): ResumenVocabulario {
  const r: ResumenVocabulario = { total: 0, conocidas: 0, comprension: 0, distintas: 0, porAprender: 0, aprendiendo: 0, sabidas: 0 };
  for (const f of filas) {
    const v = vecesEn(f, libro);
    if (!v || f.estado === 'ignorada') continue;
    r.total += v;
    r.distintas++;
    if (f.estado === 'desconocida') r.porAprender++;
    else {
      r.conocidas += v;
      if (f.estado === 'aprendiendo') r.aprendiendo++;
      else r.sabidas++;
    }
  }
  r.comprension = porcentaje(r.conocidas, r.total);
  return r;
}

/** Un tanto por ciento entero que no exagera: 99,7 es 99 mientras falte algo. */
export const porcentaje = (parte: number, total: number) => (total ? Math.floor((100 * parte) / total) : 0);

/**
 * Cuántas palabras por aprender, de las que más salen, hacen falta para entender cada tanto por ciento del texto (0,9 es
 * el 90 %). 0 si ya se llega. Las ignoradas no cuentan.
 */
export function palabrasParaLlegar(filas: FilaVocabulario[], metas: number[], libro?: number): { meta: number; palabras: number }[] {
  const r = resumirVocabulario(filas, libro);
  const nuevas = filas
    .filter((f) => f.estado === 'desconocida' && vecesEn(f, libro) > 0)
    .map((f) => vecesEn(f, libro))
    .sort((a, b) => b - a);
  return metas.map((meta) => {
    let conocidas = r.conocidas;
    let n = 0;
    while (r.total && conocidas / r.total < meta && n < nuevas.length) conocidas += nuevas[n++];
    return { meta, palabras: n };
  });
}

export interface ResumenLibro extends ResumenVocabulario {
  libro: number;
  /** Las palabras por aprender que salen en este libro por primera vez en la colección. */
  nuevas: number;
}

/** Cómo está cada libro de una colección: lo que se entiende de él y cuántas palabras por aprender trae de nuevo. */
export function resumenPorLibro(filas: FilaVocabulario[], libros: number): ResumenLibro[] {
  return Array.from({ length: libros }, (_, libro) => ({
    libro,
    ...resumirVocabulario(filas, libro),
    nuevas: filas.filter((f) => f.estado === 'desconocida' && f.primera.libro === libro).length,
  }));
}

// ---------- La lista ----------

export type OrdenVocabulario = 'veces' | 'aparicion' | 'comunes';
export type FiltroVocabulario = 'nuevas' | 'aprendiendo' | 'conocidas' | 'todas';

/** Si una palabra entra con un filtro de estado. Las ignoradas van con las conocidas: no hay que aprenderlas. */
export const pasaFiltro = (estado: EstadoPalabra, f: FiltroVocabulario) =>
  f === 'todas' || (f === 'nuevas' ? estado === 'desconocida' : f === 'aprendiendo' ? estado === 'aprendiendo' : estado === 'conocida' || estado === 'ignorada');

const SIN_RANGO = Number.MAX_SAFE_INTEGER;

/**
 * La lista en el orden pedido: las que más salen en el libro, las que aparecen antes (para estudiarlas al ritmo de la
 * lectura) o las más comunes de la lengua, según la lista de frecuencia.
 */
export function ordenarVocabulario<T extends PalabraVocabulario & { rango?: number }>(filas: T[], orden: OrdenVocabulario): T[] {
  const copia = [...filas];
  if (orden === 'aparicion') return copia.sort((a, b) => a.orden - b.orden);
  if (orden === 'comunes') return copia.sort((a, b) => (a.rango ?? SIN_RANGO) - (b.rango ?? SIN_RANGO) || b.veces - a.veces || a.orden - b.orden);
  return copia.sort((a, b) => b.veces - a.veces || (a.rango ?? SIN_RANGO) - (b.rango ?? SIN_RANGO) || a.orden - b.orden);
}

/** Una frase partida para resaltar la palabra: lo de antes, la palabra tal como está escrita y lo de después. */
export function partirEjemplo(texto: string, ...formas: (string | undefined)[]): { antes: string; palabra: string; despues: string } | null {
  for (const f of formas) {
    if (!f) continue;
    const i = texto.indexOf(f);
    if (i >= 0) return { antes: texto.slice(0, i), palabra: f, despues: texto.slice(i + f.length) };
  }
  // En las lenguas con mayúsculas, la palabra puede empezar la frase.
  for (const f of formas) {
    if (!f) continue;
    const i = texto.toLocaleLowerCase().indexOf(f.toLocaleLowerCase());
    if (i >= 0) return { antes: texto.slice(0, i), palabra: texto.slice(i, i + f.length), despues: texto.slice(i + f.length) };
  }
  return null;
}
