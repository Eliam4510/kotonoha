// Las listas por nivel del examen de la lengua (en japonés, el JLPT), leídas del paquete de la extensión y cruzadas con las
// palabras guardadas. Las cuentas están en nucleo/niveles.ts.

import type { CaracterConNivel, FraseEjemplo, ListaNivel, PuntoEncontrado, ResumenNivel } from '../compartido/tipos';
import { buscarGramatica as buscarEnGramatica } from '../nucleo/explorar';
import { normalizarPatron } from '../nucleo/gramaticaAnki';
import {
  caracteresDelNivel,
  clavesDe,
  type DatosNivel,
  type FilaCaracter,
  type FilaGramatica,
  type FilaVocabulario,
  fraseConPatron,
  gramaticaDelNivel,
  type PalabraGuardada,
  palabrasDelNivel,
  resumirNivel,
  trozosDePatron,
} from '../nucleo/niveles';
import { db } from './db';
import { motorLengua } from './lengua';

const leidos = new Map<string, Promise<unknown>>();

/** Un JSON del paquete de la extensión, leído una sola vez. */
function leer<T>(ruta: string): Promise<T> {
  let p = leidos.get(ruta);
  if (!p) {
    p = fetch(chrome.runtime.getURL(ruta)).then((r) => {
      if (!r.ok) throw new Error(`${ruta}: ${r.status}`);
      return r.json();
    });
    p.catch(() => leidos.delete(ruta));
    leidos.set(ruta, p);
  }
  return p as Promise<T>;
}

async function guardadas(): Promise<PalabraGuardada[]> {
  return (await db.palabras.toArray()).map((f) => ({ clave: f.clave, lema: f.lema, lectura: f.lectura, estado: f.estado, rastreada: !!f.rastreada }));
}

async function listas(carpeta: string) {
  const [vocabulario, kanji, gramatica] = await Promise.all([
    leer<DatosNivel<FilaVocabulario>>(`${carpeta}/vocabulario.json`),
    leer<DatosNivel<FilaCaracter>>(`${carpeta}/kanji.json`).catch(() => null),
    leer<DatosNivel<FilaGramatica>>(`${carpeta}/gramatica.json`).catch(() => null),
  ]);
  return { vocabulario, kanji, gramatica };
}

export async function listaNivel(carpeta: string, nivel: string): Promise<ListaNivel> {
  const [l, todas] = await Promise.all([listas(carpeta), guardadas()]);
  return {
    nivel,
    palabras: palabrasDelNivel(l.vocabulario.niveles[nivel] ?? [], new Map(todas.map((p) => [p.clave, p]))),
    caracteres: caracteresDelNivel(l.kanji?.niveles[nivel] ?? [], todas),
    gramatica: gramaticaDelNivel(l.gramatica?.niveles[nivel] ?? []),
  };
}

export async function resumenNiveles(carpeta: string, niveles: string[]): Promise<ResumenNivel[]> {
  const [l, todas] = await Promise.all([listas(carpeta), guardadas()]);
  const mapa = new Map(todas.map((p) => [p.clave, p]));
  return niveles.map((nivel) =>
    resumirNivel(nivel, palabrasDelNivel(l.vocabulario.niveles[nivel] ?? [], mapa), caracteresDelNivel(l.kanji?.niveles[nivel] ?? [], todas), l.gramatica?.niveles[nivel]?.length ?? 0)
  );
}

const nivelesPorCarpeta = new Map<string, Promise<Map<string, string>>>();

/**
 * El nivel de cada palabra de las listas, por su clave y por las de sus otras formas y lecturas. Una palabra que está en
 * dos niveles se queda con el más fácil, que es el primero de la lista.
 */
export function nivelesDeVocabulario(carpeta: string): Promise<Map<string, string>> {
  let p = nivelesPorCarpeta.get(carpeta);
  if (!p) {
    p = leer<DatosNivel<FilaVocabulario>>(`${carpeta}/vocabulario.json`).then((v) => {
      const salida = new Map<string, string>();
      for (const [nivel, filas] of Object.entries(v.niveles)) for (const f of filas) for (const c of clavesDe(f)) if (!salida.has(c)) salida.set(c, nivel);
      return salida;
    });
    p.catch(() => nivelesPorCarpeta.delete(carpeta));
    nivelesPorCarpeta.set(carpeta, p);
  }
  return p;
}

/** Todos los patrones de gramática de las listas, de todos los niveles. */
export async function patronesDeLasListas(carpeta: string): Promise<string[]> {
  const g = await leer<DatosNivel<FilaGramatica>>(`${carpeta}/gramatica.json`).catch(() => null);
  return Object.values(g?.niveles ?? {}).flatMap((filas) => filas.map(([patron]) => patron));
}

/** Los caracteres de una palabra con su nivel, sus lecturas y su glosa, si están en las listas. */
export async function caracteresConNivel(carpeta: string, caracteres: string[]): Promise<CaracterConNivel[]> {
  const k = await leer<DatosNivel<FilaCaracter>>(`${carpeta}/kanji.json`).catch(() => null);
  const mapa = new Map<string, CaracterConNivel>();
  for (const [nivel, filas] of Object.entries(k?.niveles ?? {})) for (const [caracter, on, kun, glosa] of filas) if (!mapa.has(caracter)) mapa.set(caracter, { caracter, nivel, on, kun, glosa });
  return caracteres.map((c) => mapa.get(c) ?? { caracter: c, on: '', kun: '', glosa: '' });
}

/** Los puntos de gramática de las listas que encajan con lo buscado, por su forma o por su significado. */
export async function buscarGramatica(carpeta: string, texto: string, idioma: string): Promise<PuntoEncontrado[]> {
  const g = await leer<DatosNivel<FilaGramatica>>(`${carpeta}/gramatica.json`).catch(() => null);
  const puntos = Object.entries(g?.niveles ?? {}).flatMap(([nivel, filas]) => gramaticaDelNivel(filas).map((x) => ({ nivel, g: x })));
  return buscarEnGramatica(puntos, texto, idioma);
}

/**
 * Frases ya vistas (en videos, páginas y libros) que llevan un punto de gramática: ejemplos reales de lo que se estudia.
 * Valen las que detectan las reglas de la lengua y las que llevan los trozos fijos del patrón, en orden.
 */
export async function frasesConPatron(patron: string, limite = 4): Promise<FraseEjemplo[]> {
  const trozos = trozosDePatron(patron);
  // La regla de la lengua puede escribir el patrón algo distinto del temario: 虽然…但是 es 虽然……，但是…….
  const objetivo = normalizarPatron(patron);
  const coincide = (texto: string) => fraseConPatron(texto, trozos) || motorLengua().detectarGramatica(texto).some((p) => p.patron === patron || normalizarPatron(p.patron) === objetivo);
  const filas = await db.frases
    .orderBy('creada')
    .reverse()
    .filter((f) => coincide(f.texto))
    .limit(limite)
    .toArray();
  return filas.map((f) => ({ texto: f.texto, fuente: f.fuente, url: f.url, inicio: f.inicio }));
}
