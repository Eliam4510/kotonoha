// Lo que el lector de páginas necesita saber del texto, sin tocar el DOM: así se puede probar sin navegador.

import type { SegmentoLectura, SignosFrase } from '../lenguas/tipos';

export interface TramoTexto {
  inicio: number;
  fin: number;
}

/**
 * Sitúa cada palabra en el texto original. Sus superficies juntas deberían dar el texto, pero no se da por hecho:
 * si el analizador cambió algo, se busca la siguiente aparición y lo que no se encuentre queda sin sitio.
 */
export function alinearSuperficies(texto: string, superficies: string[]): (TramoTexto | null)[] {
  let pos = 0;
  return superficies.map((s) => {
    if (!s) return null;
    if (texto.startsWith(s, pos)) {
      const t = { inicio: pos, fin: pos + s.length };
      pos = t.fin;
      return t;
    }
    // Un desajuste no debe arrastrar al resto: se busca cerca, y si no aparece se sigue desde donde se estaba.
    const i = texto.indexOf(s, pos);
    if (i < 0 || i - pos > 40) return null;
    pos = i + s.length;
    return { inicio: i, fin: pos };
  });
}

/** La frase que contiene un tramo: de un final de frase al siguiente, con sus comillas de cierre. */
export function fraseAlrededor(texto: string, inicio: number, fin: number, signos: SignosFrase): TramoTexto & { frase: string } {
  let a = inicio;
  while (a > 0 && !signos.fin.test(texto[a - 1])) a--;
  let b = fin;
  while (b < texto.length && !signos.fin.test(texto[b])) b++;
  if (b < texto.length && texto[b] !== '\n') b++;
  while (b < texto.length && signos.cierres.test(texto[b])) b++;
  const crudo = texto.slice(a, b);
  const izquierda = crudo.length - crudo.trimStart().length;
  const frase = crudo.trim();
  return { inicio: a + izquierda, fin: a + izquierda + frase.length, frase };
}

/** Divide un texto en frases, para dar a Claude las que rodean a la consultada. */
export function partirEnFrases(texto: string, signos: SignosFrase): string[] {
  const salida: string[] = [];
  let a = 0;
  while (a < texto.length) {
    const t = fraseAlrededor(texto, a, a, signos);
    if (t.frase) salida.push(t.frase);
    let b = Math.max(t.fin, a + 1);
    while (b < texto.length && /\s/.test(texto[b])) b++;
    a = b;
  }
  return salida;
}

/** Dónde va cada lectura dentro de una palabra: solo sobre los kanji. Los desplazamientos son respecto a la palabra. */
export function tramosConLectura(segmentos: SegmentoLectura[]): (TramoTexto & { lectura: string })[] {
  const salida: (TramoTexto & { lectura: string })[] = [];
  let pos = 0;
  for (const s of segmentos) {
    const fin = pos + s.texto.length;
    if (s.lectura) salida.push({ inicio: pos, fin, lectura: s.lectura });
    pos = fin;
  }
  return salida;
}

/**
 * Cuánto ha de estrecharse una lectura para no invadir a las vecinas: una lectura larga sobre un solo kanji
 * se comprime, hasta un límite a partir del cual se dejaría de leer bien.
 */
export function compresionLectura(anchoBase: number, caracteres: number, tamano: number, anchoPorCaracter = 1): number {
  const ancho = caracteres * tamano * anchoPorCaracter;
  if (ancho <= anchoBase || ancho === 0) return 1;
  return Math.max(0.62, anchoBase / ancho);
}

/**
 * Tamaño de la lectura según la letra y el aire entre líneas. Se reduce si no cabe, pero no por debajo de lo legible:
 * mejor rozar la línea de arriba que no poder leerla.
 */
export function tamanoLectura(tamanoLetra: number, huecoEntreLineas: number): number {
  const ideal = Math.max(9, tamanoLetra * 0.5);
  if (huecoEntreLineas >= ideal) return ideal;
  return Math.max(8, Math.min(ideal, huecoEntreLineas + 2));
}

/**
 * Cuánto tiene que medir una línea, en proporción a su letra, para que quepan la lectura y el subrayado de la línea de arriba.
 * Es un número sin unidad, como en CSS: así lo que vaya dentro con otra letra sigue guardando la proporción.
 */
export function interlineadoNecesario(tamanoLetra: number): number {
  const SUBRAYADO = 3;
  return (tamanoLetra + tamanoLectura(tamanoLetra, Infinity) + SUBRAYADO) / tamanoLetra;
}

/** Hasta dónde se abre una línea que no llega a lo necesario: justo lo necesario se ve apretado. */
export function interlineadoAbierto(tamanoLetra: number): number {
  return interlineadoNecesario(tamanoLetra) * 1.05;
}

/** Si un color de fondo se ve. Un elemento transparente encima de un texto no lo tapa. */
export function esFondoVisible(color: string): boolean {
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (!m) return color !== 'transparent';
  const [, , , a = 1] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  return a > 0.05;
}

/** Claro u oscuro según el color de fondo. Un fondo transparente no dice nada y devuelve null. */
export function esFondoOscuro(color: string): boolean | null {
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const partes = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  const [r, g, b, a = 1] = partes;
  if (a < 0.5) return null;
  const canal = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b) < 0.3;
}
