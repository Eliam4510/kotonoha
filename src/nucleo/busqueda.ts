// Buscar en todo el libro: en el texto de cada página, el del propio PDF o el del OCR con lo editado encima. Sin
// navegador, para poder probarlo. Se busca sin distinguir mayúsculas, anchos (Ａ y A, ｶ y カ) ni hiragana y katakana. En
// japonés, además, sin espacios ni saltos de renglón: un PDF los mete a veces entre letras, y una palabra puede quedar
// partida al final de un renglón.

import { separador } from './parrafos';

export interface OpcionesBusqueda {
  /** En japonés o chino los espacios no separan palabras: se busca sin ellos. */
  sinEspacios: boolean;
}

/** El texto de una página listo para buscar en él, con la línea y la letra de donde sale cada unidad. */
export interface IndicePagina {
  texto: string;
  linea: number[];
  letra: number[];
}

/** Un trozo de lo encontrado dentro de una línea: lo encontrado puede seguir en la siguiente. */
export interface Tramo {
  linea: number;
  inicio: number;
  fin: number;
}

export interface Hallazgo {
  pagina: number;
  tramos: Tramo[];
  /** Lo que se ve en la lista: un poco de texto antes, lo encontrado tal como está escrito y un poco después. */
  antes: string;
  texto: string;
  despues: string;
}

/** El katakana que tiene hiragana, del U+30A1 al U+30F6: cada uno está 0x60 por encima del suyo. */
const KATAKANA_DESDE = 0x30a1;
const KATAKANA_HASTA = 0x30f6;

/** Una letra como se busca: sin anchos ni mayúsculas, y en hiragana si era katakana. */
export function letraDeBusqueda(c: string): string {
  return Array.from(c.normalize('NFKC').toLowerCase(), (k) => {
    const p = k.codePointAt(0) ?? 0;
    return p >= KATAKANA_DESDE && p <= KATAKANA_HASTA ? String.fromCodePoint(p - 0x60) : k;
  }).join('');
}

/** Las líneas de una página seguidas, listas para buscar, sabiendo de dónde sale cada letra. */
export function indiceDe(lineas: { texto: string }[], o: OpcionesBusqueda): IndicePagina {
  const partes: string[] = [];
  const linea: number[] = [];
  const letra: number[] = [];
  let ultima = '';
  const poner = (s: string, l: number, k: number) => {
    for (let u = 0; u < s.length; u++) {
      partes.push(s[u]);
      linea.push(l);
      letra.push(k);
    }
    ultima = s.at(-1) ?? ultima;
  };
  lineas.forEach((l, i) => {
    if (i > 0 && !o.sinEspacios && partes.length) {
      const anterior = lineas[i - 1].texto.trimEnd();
      // Una palabra partida con guion al final del renglón se busca entera.
      if (/\p{L}-$/u.test(anterior) && /^\s*\p{Ll}/u.test(l.texto) && ultima === '-') {
        partes.pop();
        linea.pop();
        letra.pop();
        ultima = partes.at(-1) ?? '';
      } else if (ultima !== ' ' && separador(anterior, l.texto.trimStart()) === ' ') poner(' ', i - 1, lineas[i - 1].texto.length);
    }
    let k = 0;
    for (const c of l.texto) {
      if (/\s/.test(c)) {
        if (!o.sinEspacios && partes.length && ultima !== ' ') poner(' ', i, k);
      } else poner(letraDeBusqueda(c), i, k);
      k += c.length;
    }
  });
  return { texto: partes.join(''), linea, letra };
}

/** Lo que se busca, normalizado igual que las páginas. */
export function consultaDe(consulta: string, o: OpcionesBusqueda): string {
  return indiceDe([{ texto: consulta.trim() }], o).texto.trim();
}

/** Dónde aparece lo buscado en el texto de una página, sin solaparse. */
export function aparicionesEn(texto: string, q: string, maximo = Number.POSITIVE_INFINITY): { inicio: number; fin: number }[] {
  const salida: { inicio: number; fin: number }[] = [];
  if (!q) return salida;
  for (let i = texto.indexOf(q); i >= 0 && salida.length < maximo; i = texto.indexOf(q, i + q.length)) salida.push({ inicio: i, fin: i + q.length });
  return salida;
}

/** Lo encontrado, por líneas: de qué letra a qué letra de cada una. El espacio que se pone entre dos líneas no cuenta. */
export function tramosDe(ind: IndicePagina, lineas: { texto: string }[], inicio: number, fin: number): Tramo[] {
  const tramos: Tramo[] = [];
  for (let k = inicio; k < fin; k++) {
    const l = ind.linea[k];
    const c = ind.letra[k];
    const texto = lineas[l]?.texto ?? '';
    if (c >= texto.length) continue;
    const finLetra = c + ((texto.codePointAt(c) ?? 0) > 0xffff ? 2 : 1);
    const ultimo = tramos[tramos.length - 1];
    if (ultimo && ultimo.linea === l) {
      ultimo.inicio = Math.min(ultimo.inicio, c);
      ultimo.fin = Math.max(ultimo.fin, finLetra);
    } else tramos.push({ linea: l, inicio: c, fin: finLetra });
  }
  return tramos;
}

/** Cuánto texto se muestra a cada lado de lo encontrado. */
const CONTEXTO = 16;

/** Lo encontrado con un poco de texto alrededor, como se lee: las líneas seguidas, como en la vista de texto. */
export function fragmentoDe(lineas: { texto: string }[], tramos: Tramo[]): { antes: string; texto: string; despues: string } {
  let todo = '';
  const inicioDe: number[] = [];
  lineas.forEach((l, i) => {
    if (i > 0) todo += separador(lineas[i - 1].texto, l.texto);
    inicioDe.push(todo.length);
    todo += l.texto;
  });
  const primero = tramos[0];
  const ultimo = tramos[tramos.length - 1];
  const a = inicioDe[primero.linea] + primero.inicio;
  const b = inicioDe[ultimo.linea] + ultimo.fin;
  const desde = Math.max(0, a - CONTEXTO);
  const hasta = Math.min(todo.length, b + CONTEXTO);
  return {
    antes: `${desde > 0 ? '…' : ''}${todo.slice(desde, a).trimStart()}`,
    texto: todo.slice(a, b),
    despues: `${todo.slice(b, hasta).trimEnd()}${hasta < todo.length ? '…' : ''}`,
  };
}

/** Todo lo encontrado en una página, con el índice ya hecho si se tiene. */
export function buscarEnPagina(pagina: number, lineas: { texto: string }[], q: string, o: OpcionesBusqueda, ind = indiceDe(lineas, o), maximo?: number): Hallazgo[] {
  return aparicionesEn(ind.texto, q, maximo)
    .map(({ inicio, fin }) => tramosDe(ind, lineas, inicio, fin))
    .filter((tramos) => tramos.length > 0)
    .map((tramos) => ({ pagina, tramos, ...fragmentoDe(lineas, tramos) }));
}
