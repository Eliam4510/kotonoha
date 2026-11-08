// El texto de una página como se lee, para la vista de texto del visor. Las líneas del propio PDF o del OCR son renglones
// (o columnas, en vertical), y aquí se juntan en párrafos. Un renglón sigue al anterior si va justo detrás, en la misma
// columna, si el anterior llega hasta el final y si él no empieza con sangría. Un renglón que empieza como un elemento
// de lista, con (1) o ①, abre otro párrafo, y los suyos pueden entrar con sangría francesa. Una línea corta y bastante
// más gruesa que las del texto es un título. En un manga, cada globo es un párrafo. Sin navegador, para poder probarlo.

import { CJK, type LineaTexto } from './capaTexto';

export interface ParrafoPagina {
  texto: string;
  /** Unas líneas bastante más gruesas que las del texto: un título. */
  titulo: boolean;
  /** Las líneas de la página que lo forman, en orden. */
  lineas: number[];
}

/** Lo que va entre dos trozos de texto seguidos: nada en japonés o chino, y un espacio entre palabras separadas. */
export function separador(antes: string, despues: string): string {
  const a = antes.at(-1) ?? '';
  const b = despues[0] ?? '';
  if (!a || !b || /\s/.test(a) || /\s/.test(b)) return '';
  return CJK.test(a) || CJK.test(b) ? '' : ' ';
}

/** El guion blando (U+00AD), que solo se ve cuando parte una palabra al final de un renglón. */
export const GUION_BLANDO = String.fromCharCode(0xad);

/**
 * Dos renglones seguidos de un mismo párrafo. Sin espacio en japonés; con uno en las lenguas que separan las palabras.
 * Sin el guion que parte una palabra al final del renglón («Verständ-» y «nis»). Con una mayúscula detrás, el guion es de
 * un compuesto y se queda («Baden-» y «Württemberg»).
 */
export function unirRenglones(a: string, b: string): string {
  if (a.endsWith(GUION_BLANDO)) return a.slice(0, -1) + b;
  if (/\p{L}-$/u.test(a) && /^\p{L}/u.test(b)) return /^\p{Ll}/u.test(b) ? a.slice(0, -1) + b : a + b;
  return a + separador(a, b) + b;
}

interface Medidas {
  /** Lo que mide de grueso una línea del texto: su alto en horizontal y su ancho en vertical. */
  grueso: number;
  /** Lo que avanza una letra del texto a lo largo de la línea. */
  paso: number;
}

/** Cuánto más gruesa que las del texto es la línea de un título. */
const GRUESO_TITULO = 1.35;
/**
 * Lo más largo que se toma por un título, en letras: un renglón más largo y grueso es texto con algo en negrita o
 * subrayado, que hace más alta su caja.
 */
const LARGO_TITULO = { cjk: 24, latina: 60 };
/** Cuántos párrafos se tienen abiertos a la vez: una letra suelta en el margen no debe partir el párrafo que sigue. */
const ABIERTOS = 3;
/** Cuánto puede entrar el texto tras la marca de un elemento de lista, en letras: la sangría francesa de «(1)». */
const SANGRIA_FRANCESA = 6;

/**
 * Lo que abre un elemento de una lista o de un ejercicio al principio de un renglón, en cualquier lengua: (1), （１）,
 * (a), 1., 1), ①, ⑴, ❶ o una viñeta. Cada lengua puede añadir lo suyo (marcaDeLista).
 */
const MARCA_GENERICA = /^\s*(?:[(（][0-9０-９a-zA-Zａ-ｚＡ-Ｚ]{1,2}[)）]|[0-9０-９]{1,3}[.．)）、](?![0-9０-９])|[①-⑳⑴-⒇❶-❿]|[•●○■□◆◇▶▷※★☆▪◦])/;

const grueso = (l: LineaTexto) => (l.vertical ? l.caja.x1 - l.caja.x0 : l.caja.y1 - l.caja.y0);
const largo = (l: LineaTexto) => (l.vertical ? l.caja.y1 - l.caja.y0 : l.caja.x1 - l.caja.x0);
const desde = (l: LineaTexto) => (l.vertical ? l.caja.y0 : l.caja.x0);
const hasta = (l: LineaTexto) => (l.vertical ? l.caja.y1 : l.caja.x1);
const letras = (t: string) => [...t.replace(/\s/g, '')].length;

function mediana(v: number[]): number {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? s[s.length >> 1] : 0;
}

/** Las medidas de las líneas del texto en un sentido: las de cuatro letras o más, que no son números de página sueltos. */
function medidas(lineas: LineaTexto[], vertical: boolean): Medidas | null {
  const suyas = lineas.filter((l) => l.vertical === vertical && letras(l.texto) >= 4);
  if (!suyas.length) return null;
  return { grueso: mediana(suyas.map(grueso)), paso: mediana(suyas.map((l) => largo(l) / Math.max(1, [...l.texto].length))) };
}

/** Si en la página manda una lengua que separa las palabras: entonces los renglones van menos justos y la sangría es más ancha. */
function esLatina(lineas: LineaTexto[]): boolean {
  let cjk = 0;
  let total = 0;
  for (const l of lineas) {
    for (const c of l.texto) {
      if (/\s/.test(c)) continue;
      total++;
      if (CJK.test(c)) cjk++;
    }
  }
  return total > 0 && cjk / total < 0.3;
}

/** Un número de página o de capítulo suelto, sin más: no se lee como un párrafo. */
const SOLO_NUMERO = /^(?=.*\p{N})[\s\p{N}\p{P}\p{S}]{1,8}$/u;

/** Un párrafo mientras se va juntando. */
interface Abierto {
  lineas: number[];
  texto: string;
  /** Hasta dónde llegan sus renglones a lo largo de la línea. */
  borde: number;
  /** Dónde empieza su primer renglón a lo largo de la línea. */
  inicio: number;
  /** Si empieza con la marca de un elemento de lista: entonces sus renglones pueden ir con sangría francesa. */
  marcado: boolean;
}

/**
 * Los párrafos de una página, en el orden de sus líneas, que es el de lectura. Con `globos`, cada línea es un globo de un
 * manga y va sola. `marca` es lo que abre un elemento de lista en la lengua del libro, además de lo de todas.
 */
export function parrafosDe(lineas: LineaTexto[], o: { globos?: boolean; marca?: RegExp } = {}): ParrafoPagina[] {
  const conTexto = lineas.map((l, i) => ({ l, i })).filter(({ l }) => l.texto.trim());
  if (o.globos) return conTexto.map(({ l, i }) => ({ texto: l.texto.trim(), titulo: false, lineas: [i] }));
  const latina = esLatina(lineas);
  const porSentido = { h: medidas(lineas, false), v: medidas(lineas, true) };
  const medidaDe = (l: LineaTexto) => (l.vertical ? porSentido.v : porSentido.h);
  // Con menos de tres líneas de texto en un sentido no hay con qué comparar para saber qué es un título.
  const delTexto = (vertical: boolean) => lineas.filter((x) => x.vertical === vertical && letras(x.texto) >= 4).length;
  const bastantes = { h: delTexto(false) >= 3, v: delTexto(true) >= 3 };
  const esTitulo = (l: LineaTexto) => {
    const m = medidaDe(l);
    return !!m && (l.vertical ? bastantes.v : bastantes.h) && grueso(l) >= GRUESO_TITULO * m.grueso && letras(l.texto) <= (latina ? LARGO_TITULO.latina : LARGO_TITULO.cjk);
  };
  const esMarca = (t: string) => MARCA_GENERICA.test(t) || !!o.marca?.test(t);
  /**
   * Hasta dónde llega la columna de un renglón: lo más lejos que llegan los renglones de alrededor que van por el mismo
   * sitio. Con eso se sabe si un párrafo de un solo renglón es corto, que entonces no sigue.
   */
  const bordeDe = (l: LineaTexto) => {
    const m = medidaDe(l);
    let borde = hasta(l);
    if (!m) return borde;
    const traves = (x: LineaTexto) => (x.vertical ? (x.caja.x0 + x.caja.x1) / 2 : (x.caja.y0 + x.caja.y1) / 2);
    for (const x of lineas) {
      if (x.vertical !== l.vertical || Math.abs(traves(x) - traves(l)) > 6 * m.grueso) continue;
      const comun = Math.min(hasta(x), hasta(l)) - Math.max(desde(x), desde(l));
      if (comun > 0.5 * Math.min(largo(x), largo(l))) borde = Math.max(borde, hasta(x));
    }
    return borde;
  };

  /** Si `b` sigue el párrafo `p`, que acaba en el renglón `a`. */
  const sigue = (a: LineaTexto, b: LineaTexto, p: Abierto): boolean => {
    const m = medidaDe(a);
    if (!m || a.vertical !== b.vertical || esTitulo(a) !== esTitulo(b)) return false;
    // Un renglón que empieza con la marca de un elemento de lista abre otro párrafo.
    if (esMarca(b.texto)) return false;
    // Justo detrás: debajo en horizontal; a la izquierda en vertical, que las columnas se leen de derecha a izquierda.
    const hueco = a.vertical ? a.caja.x0 - b.caja.x1 : b.caja.y0 - a.caja.y1;
    const g = Math.min(grueso(a), grueso(b));
    if (hueco < -0.4 * g || hueco > 1.1 * g) return false;
    // En la misma columna.
    if (hasta(b) <= desde(a) || desde(b) >= hasta(a)) return false;
    // El anterior llega hasta el final: un renglón corto cierra su párrafo.
    if (hasta(a) < Math.max(p.borde, hasta(b)) - (latina ? 3 : 1.5) * m.paso) return false;
    // Y el siguiente no empieza con sangría, que abre otro; tras la marca de un elemento de lista, el texto puede entrar.
    if (p.marcado) return desde(b) <= p.inicio + SANGRIA_FRANCESA * m.paso;
    return desde(b) <= desde(a) + (latina ? 1.2 : 0.6) * m.paso;
  };

  const hechos: Abierto[] = [];
  // Los últimos párrafos, el más reciente al final: un renglón puede seguir uno anterior si en medio se coló una letra
  // suelta del margen o de un dibujo.
  const abiertos: Abierto[] = [];
  for (const { l, i } of conTexto) {
    const texto = l.texto.trim();
    const destino = [...abiertos].reverse().find((p) => sigue(lineas[p.lineas[p.lineas.length - 1]], l, p));
    if (destino) {
      destino.lineas.push(i);
      destino.texto = unirRenglones(destino.texto, texto);
      destino.borde = Math.max(destino.borde, hasta(l));
      // El que acaba de crecer es el más reciente: las letras sueltas de en medio no deben dejarlo atrás.
      abiertos.splice(abiertos.indexOf(destino), 1);
      abiertos.push(destino);
    } else {
      const nuevo: Abierto = { lineas: [i], texto, borde: bordeDe(l), inicio: desde(l), marcado: esMarca(texto) };
      hechos.push(nuevo);
      abiertos.push(nuevo);
      if (abiertos.length > ABIERTOS) abiertos.shift();
    }
  }
  return hechos
    .filter((p) => !SOLO_NUMERO.test(p.texto) && !(p.lineas.length === 1 && letras(p.texto) <= 1))
    .map((p) => ({ texto: p.texto, titulo: p.lineas.every((i) => esTitulo(lineas[i])), lineas: p.lineas }));
}
