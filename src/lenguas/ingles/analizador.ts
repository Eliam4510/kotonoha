// El análisis del inglés corre con wink-nlp, que sabe qué es cada palabra en su frase: en «he saw a saw», la primera es
// el verbo see y la segunda la sierra. Su modelo pesa varios megas: va aparte, y solo se carga si se estudia inglés.

import type { Analizador, TokenUnido } from '../tipos';
import { normalizarParaAnalisis, type TokenCrudo, unirTokens } from './tokens';

interface TokenWink {
  out(campo?: unknown): string;
}

export interface MotorWink {
  readDoc(texto: string): { tokens(): { each(f: (t: TokenWink) => void): void } };
  its: { pos: unknown; lemma: unknown; type: unknown };
}

declare global {
  // Lo deja ahí wink.ts, que se empaqueta como un script aparte.
  // eslint-disable-next-line no-var
  var kkWink: MotorWink | undefined;
}

let cargando: Promise<void> | null = null;

/** Lo pone a mano quien ya lo tiene: las pruebas, por ejemplo. */
export function fijarWink(motor: MotorWink) {
  globalThis.kkWink = motor;
}

export const ANALIZADOR: Analizador = {
  // Los términos solo unen palabras con guion, y el diccionario inglés-inglés tarda en cargarlos.
  terminosOpcionales: true,
  listo: () => !!globalThis.kkWink,
  cargar() {
    if (globalThis.kkWink) return Promise.resolve();
    cargando ??= new Promise((ok, mal) => {
      const s = document.createElement('script');
      s.src = 'ingles.js';
      s.onload = () => ok();
      s.onerror = () => mal(new Error('No se pudo cargar el analizador de inglés'));
      document.head.appendChild(s);
    });
    return cargando;
  },
  analizar(texto, existe) {
    const wink = globalThis.kkWink!;
    const normal = normalizarParaAnalisis(texto);
    const crudos: TokenCrudo[] = [];
    wink.readDoc(normal).tokens().each((t) => {
      crudos.push({ valor: t.out(), pos: t.out(wink.its.pos), lema: t.out(wink.its.lemma), tipo: t.out(wink.its.type) });
    });
    return unirTokens(texto, normal, crudos, existe);
  },
  // La palabra es su propia lectura: la pronunciación se guarda aparte.
  lecturaDeLema: (lema) => lema,
};

/** A Claude se le enseña de qué forma de diccionario sale cada palabra, para que pueda corregirla: went(go). */
export function describirPalabra(t: TokenUnido): string {
  return t.lema.toLowerCase() === t.superficie.toLowerCase() ? t.superficie : `${t.superficie}(${t.lema})`;
}

/** Con ellas se forman los verbos con partícula, y a veces van separadas del verbo: pick it up. */
const PARTICULAS = new Set(['up', 'down', 'out', 'off', 'in', 'on', 'away', 'back', 'over', 'around', 'through', 'along', 'about', 'for', 'after', 'into', 'to', 'at', 'by', 'with', 'from', 'of']);
const DISTANCIA_MAXIMA = 3;

/**
 * Qué términos buscar a partir de una palabra: su forma de diccionario con las partículas que la siguen, aunque haya algo
 * en medio (picked it up: pick up), y lo que viene detrás tal cual, por las frases hechas (of course, by the way).
 */
export function candidatosCompuestos(superficies: string[]): string[] {
  const palabras = superficies.filter((s) => /\p{L}/u.test(s)).map((s) => s.replace(/[’ʼ]/g, "'"));
  if (palabras.length < 2) return [];
  const lema = globalThis.kkWink ? (ANALIZADOR.analizar(palabras[0]).find((t) => t.esPalabra)?.lema ?? palabras[0]).toLowerCase() : palabras[0].toLowerCase();
  const siguientes = palabras.slice(1, 1 + DISTANCIA_MAXIMA + 1).map((p) => p.toLowerCase());
  const salida = new Set<string>();
  // Primero lo más largo: look forward to antes que look forward.
  for (let n = Math.min(siguientes.length, 4); n >= 1; n--) {
    salida.add(`${lema} ${siguientes.slice(0, n).join(' ')}`);
    salida.add(`${palabras[0].toLowerCase()} ${siguientes.slice(0, n).join(' ')}`);
  }
  for (let i = 0; i < Math.min(siguientes.length, DISTANCIA_MAXIMA); i++) {
    if (PARTICULAS.has(siguientes[i])) salida.add(`${lema} ${siguientes[i]}`);
  }
  return [...salida];
}
