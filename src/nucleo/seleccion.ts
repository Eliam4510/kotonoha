// Seleccionar en una página del visor, sin navegador. Qué letra hay bajo el ratón, con un imán que perdona los huecos
// entre renglones; el texto de lo seleccionado de una letra a otra aunque cambie de renglón, y las cajas que ocupa en la
// página; y la frase o el párrafo donde está una letra, que en un libro casi nunca caben en un renglón. Las líneas van en
// el orden en que se leen, como las da el visor.

import type { SignosFrase } from '../lenguas/tipos';
import { cajaDeTramo, caracterEn, type LineaTexto } from './capaTexto';
import { fraseAlrededor } from './lectorTexto';
import type { Caja } from './ocr';
import { GUION_BLANDO, parrafosDe, separador } from './parrafos';

/** Un sitio del texto de una página: la línea y la unidad (UTF-16) de su texto. */
export interface Posicion {
  linea: number;
  letra: number;
}

/** Un trozo del texto de una página, en el orden de lectura: de una posición a otra, que ya no entra. */
export interface TramoPagina {
  desde: Posicion;
  hasta: Posicion;
}

/** Un trozo de una sola línea: de qué letra a qué letra. */
export interface TrozoLinea {
  linea: number;
  inicio: number;
  fin: number;
}

/** Un texto hecho con trozos de la página, sabiendo de qué sitio sale cada unidad. */
export interface Corrido {
  texto: string;
  /** Por cada unidad del texto, su sitio en la página. Lo que se añade al unir renglones lleva el de la letra de antes. */
  sitios: Posicion[];
}

/** Lo que se abre al tocar: una frase, un párrafo o lo seleccionado, con su texto y su sitio en la página. */
export interface Unidad extends Corrido {
  tramo: TramoPagina;
}

/** Cuánto se puede alejar un toque de una línea, a través de ella, y seguir siendo suyo: casi todo el hueco entre renglones. */
const IMAN_TRAVES = 0.9;
/** Y a lo largo, pasado el principio o el final del renglón. */
const IMAN_A_LO_LARGO = 1.5;

/** Lo que mide de grueso una línea, en anchos de página: su alto en horizontal y su ancho en vertical. */
function grueso(l: LineaTexto, proporcion: number): number {
  return l.vertical ? l.caja.x1 - l.caja.x0 : (l.caja.y1 - l.caja.y0) * proporcion;
}

/** La unidad donde empieza la letra que ocupa `k`: la segunda mitad de un par sustituto es de la letra de antes. */
function inicioDeLetra(texto: string, k: number): number {
  const c = texto.charCodeAt(k);
  return k > 0 && c >= 0xdc00 && c <= 0xdfff ? k - 1 : k;
}

/** Dónde acaba la letra que empieza en `k`. */
function finDeLetra(texto: string, k: number): number {
  return k + ((texto.codePointAt(k) ?? 0) > 0xffff ? 2 : 1);
}

/**
 * La letra que hay en un punto de la página (`x` e `y` en fracciones; `proporcion` es el alto de la página entre su
 * ancho). Si el punto cae en el hueco entre dos renglones, o justo pasado el final de uno, la de la línea más cercana.
 * Lejos de todo texto, null: ese toque no era para el texto. Con `siempre`, la más cercana esté donde esté, como al
 * arrastrar una selección fuera de las líneas.
 */
export function posicionEn(lineas: LineaTexto[], x: number, y: number, o: { proporcion?: number; siempre?: boolean } = {}): Posicion | null {
  const proporcion = o.proporcion ?? 1;
  let mejor = -1;
  let distancia = Number.POSITIVE_INFINITY;
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    if (!l.texto) continue;
    const g = Math.max(grueso(l, proporcion), 1e-6);
    const dx = Math.max(l.caja.x0 - x, 0, x - l.caja.x1);
    const dy = Math.max(l.caja.y0 - y, 0, y - l.caja.y1) * proporcion;
    const [traves, largo] = l.vertical ? [dx, dy] : [dy, dx];
    if (!o.siempre && (traves > IMAN_TRAVES * g || largo > IMAN_A_LO_LARGO * g)) continue;
    const d = Math.hypot(dx, dy);
    if (d < distancia) {
      mejor = i;
      distancia = d;
    }
  }
  if (mejor < 0) return null;
  const l = lineas[mejor];
  return { linea: mejor, letra: inicioDeLetra(l.texto, Math.min(caracterEn(l, x, y), l.texto.length - 1)) };
}

/** Si `a` va antes que `b` al leer. */
export const vaAntes = (a: Posicion, b: Posicion) => a.linea < b.linea || (a.linea === b.linea && a.letra < b.letra);

/** Lo seleccionado arrastrando de una letra a otra, en cualquier sentido: las dos letras entran. */
export function tramoEntre(lineas: LineaTexto[], a: Posicion, b: Posicion): TramoPagina {
  const [p, q] = vaAntes(b, a) ? [b, a] : [a, b];
  return { desde: p, hasta: { linea: q.linea, letra: finDeLetra(lineas[q.linea]?.texto ?? '', q.letra) } };
}

/** Los trozos de cada línea que ocupa un tramo, sin los que quedan vacíos. */
export function trozosDe(lineas: LineaTexto[], t: TramoPagina): TrozoLinea[] {
  const salida: TrozoLinea[] = [];
  for (let i = t.desde.linea; i <= t.hasta.linea; i++) {
    const texto = lineas[i]?.texto ?? '';
    const inicio = i === t.desde.linea ? t.desde.letra : 0;
    const fin = Math.min(texto.length, i === t.hasta.linea ? t.hasta.letra : texto.length);
    if (fin > inicio) salida.push({ linea: i, inicio, fin });
  }
  return salida;
}

/**
 * Las cajas de un tramo en la página, una por línea. Sin la posición de cada letra (un globo de manga) no se sabe dónde
 * acaba un trozo dentro de su línea: va la línea entera.
 */
export function cajasDe(lineas: LineaTexto[], t: TramoPagina, porLetra: boolean): Caja[] {
  return trozosDe(lineas, t).map(({ linea, inicio, fin }) => {
    const l = lineas[linea];
    return porLetra && (inicio > 0 || fin < l.texto.length) ? cajaDeTramo(l, inicio, fin) : l.caja;
  });
}

/**
 * Junta trozos de líneas como los renglones de un párrafo: sin espacio en japonés, con uno donde se separan las palabras
 * y sin el guion que parte una palabra al final del renglón, como `unirRenglones`. Entre dos párrafos, un salto de línea.
 */
function unir(lineas: LineaTexto[], trozos: TrozoLinea[], parrafoDe?: (linea: number) => number): Corrido {
  let texto = '';
  const sitios: Posicion[] = [];
  let anterior = -1;
  for (const t of trozos) {
    const parte = (lineas[t.linea]?.texto ?? '').slice(t.inicio, t.fin);
    if (!parte) continue;
    if (texto) {
      const ultimo = sitios[sitios.length - 1];
      if (parrafoDe && anterior >= 0 && parrafoDe(t.linea) !== parrafoDe(anterior)) {
        texto += '\n';
        sitios.push(ultimo);
      } else if (texto.endsWith(GUION_BLANDO)) {
        texto = texto.slice(0, -1);
        sitios.pop();
      } else if (/\p{L}-$/u.test(texto) && /^\p{L}/u.test(parte)) {
        // Con minúscula detrás, el guion partía la palabra; con mayúscula, es de la palabra («Rhein-Main»).
        if (/^\p{Ll}/u.test(parte)) {
          texto = texto.slice(0, -1);
          sitios.pop();
        }
      } else {
        const s = separador(texto, parte);
        for (let k = 0; k < s.length; k++) sitios.push(ultimo);
        texto += s;
      }
    }
    for (let k = 0; k < parte.length; k++) sitios.push({ linea: t.linea, letra: t.inicio + k });
    texto += parte;
    anterior = t.linea;
  }
  return { texto, sitios };
}

/** El tramo de la página que ocupan unos sitios seguidos. */
function tramoDeSitios(lineas: LineaTexto[], sitios: Posicion[]): TramoPagina | null {
  const a = sitios[0];
  const b = sitios[sitios.length - 1];
  if (!a || !b) return null;
  return { desde: a, hasta: { linea: b.linea, letra: finDeLetra(lineas[b.linea]?.texto ?? '', b.letra) } };
}

/** Una página lista para tocarla: su texto seguido, párrafo a párrafo, y de qué párrafo es cada línea. */
export interface PaginaLeida {
  lineas: LineaTexto[];
  /** Todo el texto de la página, con un salto de línea entre dos párrafos. */
  corrido: Corrido;
  /** Las líneas de cada párrafo, en el orden de lectura. */
  parrafos: number[][];
  /** El párrafo de cada línea, o -1 si no tiene texto. */
  parrafoDe: number[];
  /** Dónde empieza cada línea en el texto seguido, o -1. */
  inicios: number[];
}

/**
 * Prepara una página para tocarla. Los párrafos son los de la vista de texto (`parrafosDe`); lo que no entra en ninguno,
 * como el número de la página, va solo, que también se puede tocar. Con `globos`, cada línea es un globo de un manga.
 */
export function leerPagina(lineas: LineaTexto[], o: { globos?: boolean; marca?: RegExp } = {}): PaginaLeida {
  const encontrados = parrafosDe(lineas, o).map((p) => [...p.lineas]);
  const usadas = new Set(encontrados.flat());
  for (let i = 0; i < lineas.length; i++) if (lineas[i].texto.trim() && !usadas.has(i)) encontrados.push([i]);
  const parrafos = encontrados.sort((a, b) => a[0] - b[0]);
  const parrafoDe = new Array<number>(lineas.length).fill(-1);
  parrafos.forEach((p, k) => p.forEach((i) => (parrafoDe[i] = k)));
  const trozos = parrafos.flatMap((p) => p.map((i) => ({ linea: i, inicio: 0, fin: lineas[i].texto.length })));
  const corrido = unir(lineas, trozos, (i) => parrafoDe[i]);
  const inicios = new Array<number>(lineas.length).fill(-1);
  corrido.sitios.forEach((s, k) => {
    if (inicios[s.linea] < 0 && s.letra === 0) inicios[s.linea] = k;
  });
  return { lineas, corrido, parrafos, parrafoDe, inicios };
}

/** Dónde está una posición en el texto seguido de la página, o -1. */
function desplazamiento(p: PaginaLeida, pos: Posicion): number {
  const base = p.inicios[pos.linea];
  return base < 0 ? -1 : Math.min(p.corrido.texto.length - 1, base + pos.letra);
}

/** La unidad que ocupa un trozo [inicio, fin) del texto seguido de la página. */
function unidadDe(p: PaginaLeida, inicio: number, fin: number): Unidad | null {
  const sitios = p.corrido.sitios.slice(inicio, fin);
  const tramo = tramoDeSitios(p.lineas, sitios);
  return tramo && { texto: p.corrido.texto.slice(inicio, fin), sitios, tramo };
}

/** La frase donde está una letra: de un final de frase al siguiente, aunque ocupe varios renglones, sin salirse del párrafo. */
export function fraseEn(p: PaginaLeida, pos: Posicion, signos: SignosFrase): Unidad | null {
  const k = desplazamiento(p, pos);
  if (k < 0) return null;
  const f = fraseAlrededor(p.corrido.texto, k, k, signos);
  return f.frase ? unidadDe(p, f.inicio, f.fin) : null;
}

/** El párrafo donde está una letra; en un manga, su globo. */
export function parrafoEn(p: PaginaLeida, pos: Posicion): Unidad | null {
  const lineas = p.parrafos[p.parrafoDe[pos.linea]];
  if (!lineas) return null;
  // Las líneas de un párrafo van seguidas en el texto de la página, y el párrafo acaba en el salto de línea siguiente.
  const inicio = p.inicios[lineas[0]];
  if (inicio < 0) return null;
  const salto = p.corrido.texto.indexOf('\n', inicio);
  return unidadDe(p, inicio, salto >= 0 ? salto : p.corrido.texto.length);
}

/** Lo seleccionado, con su texto: los renglones unidos y un salto de línea donde cambia de párrafo. */
export function seleccionEn(p: PaginaLeida, t: TramoPagina): Unidad {
  const c = unir(p.lineas, trozosDe(p.lineas, t), (i) => p.parrafoDe[i]);
  return { ...c, tramo: t };
}

/** Las frases de un texto, con dónde empieza y acaba cada una. */
export function frasesConSitio(texto: string, signos: SignosFrase): { inicio: number; fin: number; frase: string }[] {
  const salida: { inicio: number; fin: number; frase: string }[] = [];
  let a = 0;
  while (a < texto.length) {
    const t = fraseAlrededor(texto, a, a, signos);
    if (t.frase) salida.push(t);
    let b = Math.max(t.fin, a + 1);
    while (b < texto.length && /\s/.test(texto[b])) b++;
    a = b;
  }
  return salida;
}

/** Lo que Claude necesita de una unidad: la frase o frases que la contienen y unas pocas de antes y de después. */
export function contextoDe(p: PaginaLeida, u: Unidad, signos: SignosFrase, cuantas = 4): { frase: string; antes: string[]; despues: string[] } {
  const a = desplazamiento(p, u.sitios[0] ?? u.tramo.desde);
  const ultimo = u.sitios[u.sitios.length - 1] ?? u.tramo.desde;
  const b = desplazamiento(p, ultimo);
  if (a < 0 || b < 0) return { frase: u.texto, antes: [], despues: [] };
  const texto = p.corrido.texto;
  const envolvente = fraseAlrededor(texto, a, b, signos);
  const frases = frasesConSitio(texto, signos);
  return {
    frase: envolvente.frase || u.texto,
    antes: frases.filter((f) => f.fin <= envolvente.inicio).slice(-cuantas).map((f) => f.frase),
    despues: frases.filter((f) => f.inicio >= envolvente.fin).slice(0, cuantas).map((f) => f.frase),
  };
}

/** Dónde está en la página un trozo [inicio, fin) del texto de una unidad, en cajas, una por línea. */
export function cajasDeTrozo(lineas: LineaTexto[], u: Corrido, inicio: number, fin: number, porLetra: boolean): Caja[] {
  const tramo = tramoDeSitios(lineas, u.sitios.slice(inicio, fin));
  return tramo ? cajasDe(lineas, tramo, porLetra) : [];
}

/** La caja que envuelve otras. */
export function envolvente(cajas: Caja[]): Caja | null {
  if (!cajas.length) return null;
  return {
    x0: Math.min(...cajas.map((c) => c.x0)),
    y0: Math.min(...cajas.map((c) => c.y0)),
    x1: Math.max(...cajas.map((c) => c.x1)),
    y1: Math.max(...cajas.map((c) => c.y1)),
  };
}

/** Si dos tramos son el mismo. */
export const mismoTramo = (a: TramoPagina | null | undefined, b: TramoPagina | null | undefined) =>
  !!a && !!b && a.desde.linea === b.desde.linea && a.desde.letra === b.desde.letra && a.hasta.linea === b.hasta.linea && a.hasta.letra === b.hasta.letra;

/** Si una posición cae dentro de un tramo. */
export const dentroDeTramo = (t: TramoPagina, p: Posicion) => !vaAntes(p, t.desde) && vaAntes(p, t.hasta);
