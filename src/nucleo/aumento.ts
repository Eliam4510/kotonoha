// La página aumentada, sin navegador: dónde va cada palabra analizada sobre la imagen de la página, con el sitio de su
// furigana, para subrayarla por su estado y ponerle la lectura encima, como en los subtítulos. También la gramática de cada
// frase, las frases con su sitio (para leer en voz alta siguiéndolas) y cuánto se entiende de lo que hay en la página.
// Solo con texto que sabe dónde va cada letra: el de un PDF o el del OCR de libros; en un globo de manga, no.

import type { PalabraToken } from '../compartido/tipos';
import type { PuntoGramatica, SignosFrase } from '../lenguas/tipos';
import { alinearSuperficies } from './lectorTexto';
import type { Caja } from './ocr';
import { cajasDeTrozo, frasesConSitio, type PaginaLeida, type Posicion } from './seleccion';

/** Un trozo de una palabra con su lectura encima: el kanji y su furigana. */
export interface LecturaEnPagina {
  lectura: string;
  cajas: Caja[];
  /** Si la página ya trae ese furigana impreso: entonces no se le pone otro encima. */
  impreso: boolean;
}

/** Una palabra analizada, en su sitio de la página. */
export interface PalabraEnPagina {
  /** Cuál de las palabras analizadas es. */
  token: number;
  /** Dónde está en el texto seguido de la página. */
  inicio: number;
  fin: number;
  /** Una caja por renglón que ocupa. */
  cajas: Caja[];
  lecturas: LecturaEnPagina[];
  /** Si va en una columna: entonces el furigana va a su derecha y el subrayado a su izquierda. */
  vertical: boolean;
}

/** Si alguna letra de un trozo del texto seguido lleva furigana impreso en la página. */
function conRubi(p: PaginaLeida, inicio: number, fin: number): boolean {
  for (let k = inicio; k < fin; k++) {
    const s = p.corrido.sitios[k];
    const rubi = s && p.lineas[s.linea]?.rubi;
    if (rubi?.some(([a, b]) => s.letra >= a && s.letra < b)) return true;
  }
  return false;
}

/**
 * Las palabras de lo analizado, en su sitio. `tokens` es el análisis del texto seguido de la página, en su orden; los que
 * no se encuentran en él (un desajuste del analizador) se dejan fuera. Una lectura igual a su texto (kana) no se pone.
 */
export function palabrasEnPagina(p: PaginaLeida, tokens: PalabraToken[]): PalabraEnPagina[] {
  const sitios = alinearSuperficies(p.corrido.texto, tokens.map((t) => t.superficie));
  const salida: PalabraEnPagina[] = [];
  tokens.forEach((t, i) => {
    const s = sitios[i];
    if (!s || !t.esPalabra) return;
    const lecturas: LecturaEnPagina[] = [];
    // Los trozos del furigana van por orden y juntos son la palabra: si no casan, la palabra va sin lecturas.
    if (t.furigana.map((f) => f.texto).join('') === t.superficie) {
      let k = s.inicio;
      for (const f of t.furigana) {
        const fin = k + f.texto.length;
        if (f.lectura && f.lectura !== f.texto) lecturas.push({ lectura: f.lectura, cajas: cajasDeTrozo(p.lineas, p.corrido, k, fin, true), impreso: conRubi(p, k, fin) });
        k = fin;
      }
    }
    const vertical = !!p.lineas[p.corrido.sitios[s.inicio]?.linea ?? -1]?.vertical;
    salida.push({ token: i, inicio: s.inicio, fin: s.fin, cajas: cajasDeTrozo(p.lineas, p.corrido, s.inicio, s.fin, true), lecturas, vertical });
  });
  return salida;
}

/** La palabra que hay en un sitio de la página, o -1: su índice entre las palabras en su sitio. */
export function palabraEn(p: PaginaLeida, palabras: PalabraEnPagina[], pos: Posicion): number {
  const base = p.inicios[pos.linea];
  if (base < 0) return -1;
  const k = base + pos.letra;
  return palabras.findIndex((w) => k >= w.inicio && k < w.fin);
}

/** Cuánto se entiende de un texto: las palabras que no son nuevas, sin contar las ignoradas, como en el Cuaderno. */
export function comprensionDe(tokens: PalabraToken[]): { total: number; nuevas: number; porcentaje: number } {
  let total = 0;
  let nuevas = 0;
  for (const t of tokens) {
    if (!t.esPalabra || t.estado === 'ignorada') continue;
    total++;
    if (t.estado === 'desconocida') nuevas++;
  }
  return { total, nuevas, porcentaje: total ? Math.round(((total - nuevas) / total) * 100) : 0 };
}

/** Una frase de la página, con su texto y su sitio. */
export interface FraseEnPagina {
  inicio: number;
  fin: number;
  frase: string;
  cajas: Caja[];
}

/** Las frases de la página, en el orden en que se leen, cada una con sus cajas. */
export function frasesEnPagina(p: PaginaLeida, signos: SignosFrase, porLetra = true): FraseEnPagina[] {
  return frasesConSitio(p.corrido.texto, signos)
    .filter((f) => f.frase.trim())
    .map((f) => ({ ...f, cajas: cajasDeTrozo(p.lineas, p.corrido, f.inicio, f.fin, porLetra) }));
}

/** Un punto de gramática en la página: lo que se marca debajo de su forma. */
export interface GramaticaEnPagina {
  patron: string;
  significado: string;
  nivel?: string;
  cajas: Caja[];
  vertical: boolean;
}

/**
 * La gramática de las frases de la página, en su sitio: cada punto que encuentra `detectar` en una frase se marca donde
 * aparece su forma dentro de ella. Si la forma no aparece tal cual (la regla la reconoce flexionada), no se marca.
 */
export function gramaticaEnPagina(p: PaginaLeida, frases: FraseEnPagina[], detectar: (frase: string) => PuntoGramatica[]): GramaticaEnPagina[] {
  const salida: GramaticaEnPagina[] = [];
  for (const f of frases) {
    let desde = 0;
    for (const g of detectar(f.frase)) {
      const i = g.fragmento ? f.frase.indexOf(g.fragmento, desde) : -1;
      const j = i >= 0 ? i : g.fragmento ? f.frase.indexOf(g.fragmento) : -1;
      if (j < 0) continue;
      desde = j + g.fragmento.length;
      const k = f.inicio + j;
      const vertical = !!p.lineas[p.corrido.sitios[k]?.linea ?? -1]?.vertical;
      salida.push({ patron: g.patron, significado: g.significado, nivel: g.nivel, cajas: cajasDeTrozo(p.lineas, p.corrido, k, k + g.fragmento.length, true), vertical });
    }
  }
  return salida;
}
