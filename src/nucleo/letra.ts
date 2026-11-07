// Coloca la letra verdadera de una canción sobre los tiempos de una transcripción que la oyó mal. Claude solo dice qué
// verso suena sobre qué líneas; el resto sale de aquí. Así no puede cambiar una palabra de la letra ni inventarse un tiempo.

import type { Linea } from './subtitulos';

/** El verso `v` suena sobre las líneas `de` a `a` de la transcripción. Con -1, se canta pero la transcripción no lo recoge. */
export interface EntradaAjuste {
  v: number;
  de: number;
  a: number;
}

export interface ResultadoAjuste {
  lineas: Linea[];
  /** Cuántas líneas toman su tiempo de la transcripción, y cuántas lo llevan estimado. */
  conTiempo: number;
  estimadas: number;
}

/** Las líneas de la letra no chocan con las de la transcripción: lo que se guarda por línea no se confunde. */
export const ID_LETRA = 1_000_000;

const DURACION_MINIMA_MS = 700;
const ESTIMADA_MINIMA_MS = 1500;
const ESTIMADA_MAXIMA_MS = 8000;
const MS_POR_CARACTER = 300;
const HUECO_POR_LINEA_MS = 400;

/** Los versos de una letra pegada, tal cual, sin líneas vacías, adornos ni la marca de tiempo que traen algunos comentarios. */
export function versosDeLetra(texto: string): string[] {
  return texto
    .split(/\r?\n/)
    .map((l) => l.replace(/[\u200b-\u200d\u2060\ufeff]/g, '').replace(/^\s*\[?\d{1,2}:\d{2}(?::\d{2})?\]?\s*/, '').trim())
    .filter((l) => /[\p{L}\p{N}]/u.test(l));
}

const segundos = (ms: number) => (ms / 1000).toFixed(1);

/** Lo que se le manda a Claude: las dos listas numeradas. Los tiempos le ayudan a ver dónde hay un pasaje instrumental. */
export function mensajeAjuste(lineas: Linea[], versos: string[], titulo?: string): string {
  return [
    titulo ? `Título: ${titulo}` : '',
    `TRANSCRIPCIÓN:\n${lineas.map((l, i) => `${i} [${segundos(l.inicio)}-${segundos(l.fin)}] ${l.texto}`).join('\n')}`,
    `LETRA:\n${versos.map((v, i) => `${i}: ${v}`).join('\n')}`,
  ].filter(Boolean).join('\n\n');
}

/**
 * La subsecuencia no decreciente más larga. Una entrada fuera de orden es un error de esa entrada: si se comparara cada
 * una solo con la anterior, un único salto hacia delante invalidaría todas las que vienen detrás.
 */
function indicesEnOrden(valores: number[]): Set<number> {
  const colas: number[] = [];
  const previo = new Array<number>(valores.length).fill(-1);
  valores.forEach((valor, i) => {
    let bajo = 0;
    let alto = colas.length;
    while (bajo < alto) {
      const medio = (bajo + alto) >> 1;
      if (valores[colas[medio]] <= valor) bajo = medio + 1;
      else alto = medio;
    }
    if (bajo > 0) previo[i] = colas[bajo - 1];
    colas[bajo] = i;
  });
  const salida = new Set<number>();
  for (let i = colas.length ? colas[colas.length - 1] : -1; i >= 0; i = previo[i]) salida.add(i);
  return salida;
}

// Los espacios no duran: el reparto del tiempo va por lo que se canta.
const peso = (texto: string) => Math.max(1, texto.replace(/\s/g, '').length);

interface Pendiente {
  texto: string;
  de: number;
  a: number;
}

/** Las entradas utilizables, en el orden en que suenan. Lo que no encaje en ese orden se queda sin tiempo, no sin verso. */
function depurar(versos: string[], lineas: Linea[], ajuste: EntradaAjuste[]): Pendiente[] {
  const validas = ajuste.filter((e) => Number.isInteger(e.v) && e.v >= 0 && e.v < versos.length);
  const tieneTiempo = (e: EntradaAjuste) => Number.isInteger(e.de) && e.de >= 0 && e.de < lineas.length;
  const conTiempo = validas.map((e, i) => ({ e, i })).filter(({ e }) => tieneTiempo(e));
  const enOrden = indicesEnOrden(conTiempo.map(({ e }) => e.de));
  const buenas = new Set(conTiempo.filter((_, k) => enOrden.has(k)).map(({ i }) => i));
  return validas.map((e, i) => {
    if (!buenas.has(i)) return { texto: versos[e.v], de: -1, a: -1 };
    const a = Number.isInteger(e.a) && e.a >= e.de && e.a < lineas.length ? e.a : e.de;
    return { texto: versos[e.v], de: e.de, a };
  });
}

/** Reparte un tramo entre varios versos según lo que hay que cantar en cada uno. */
function repartir(textos: string[], inicio: number, fin: number): { inicio: number; fin: number }[] {
  const total = textos.reduce((s, t) => s + peso(t), 0);
  let cursor = inicio;
  return textos.map((t) => {
    const siguiente = cursor + ((fin - inicio) * peso(t)) / total;
    const tramo = { inicio: cursor, fin: siguiente };
    cursor = siguiente;
    return tramo;
  });
}

/** Lo que dura cantar un verso del que no se sabe el tiempo. */
const duracionEstimada = (texto: string) => Math.min(ESTIMADA_MAXIMA_MS, Math.max(ESTIMADA_MINIMA_MS, peso(texto) * MS_POR_CARACTER));

/**
 * Da tiempo a unos versos que la transcripción no recogió. Si el hueco es largo, por ejemplo un pasaje instrumental, se
 * pegan al verso siguiente, que es adonde llevan; si no hay siguiente, al anterior.
 */
function colocarEstimadas(textos: string[], salida: Linea[], siguiente: number | null, idDe: (k: number) => number) {
  const previa = salida[salida.length - 1];
  const finPrevia = previa?.fin ?? 0;
  const deseadas = textos.map(duracionEstimada);
  const total = deseadas.reduce((s, d) => s + d, 0);
  let desde: number;
  let hasta: number;
  if (siguiente === null) {
    desde = finPrevia;
    hasta = desde + total;
  } else if (siguiente - finPrevia >= total) {
    desde = siguiente - total;
    hasta = siguiente;
  } else {
    desde = finPrevia;
    hasta = siguiente;
    // Sin hueco en el que quepan, se le quita la mitad a la línea anterior.
    if (previa && hasta - desde < HUECO_POR_LINEA_MS * textos.length) {
      previa.fin = previa.inicio + (previa.fin - previa.inicio) / 2;
      desde = previa.fin;
    }
  }
  for (const [k, t] of repartir(textos, desde, hasta).entries()) {
    salida.push({ id: idDe(salida.length), inicio: t.inicio, fin: t.fin, texto: textos[k] });
  }
}

/** Construye las líneas finales: el texto, de la letra; los tiempos, de la transcripción. */
export function aplicarAjuste(versos: string[], lineas: Linea[], ajuste: EntradaAjuste[], idInicial = ID_LETRA): ResultadoAjuste {
  const entradas = depurar(versos, lineas, ajuste);
  const salida: Linea[] = [];
  const idDe = (k: number) => idInicial + k;
  let conTiempo = 0;
  let estimadas = 0;
  let i = 0;
  while (i < entradas.length) {
    if (entradas[i].de < 0) {
      const sinTiempo: string[] = [];
      while (i < entradas.length && entradas[i].de < 0) sinTiempo.push(entradas[i++].texto);
      const siguiente = i < entradas.length ? lineas[entradas[i].de].inicio : null;
      colocarEstimadas(sinTiempo, salida, siguiente, idDe);
      estimadas += sinTiempo.length;
      continue;
    }
    // Los versos que comparten alguna línea de la transcripción se reparten su tiempo entre todos.
    const bloque = [entradas[i]];
    let hasta = entradas[i].a;
    for (i++; i < entradas.length && entradas[i].de >= 0 && entradas[i].de <= hasta; i++) {
      bloque.push(entradas[i]);
      hasta = Math.max(hasta, entradas[i].a);
    }
    const textos = bloque.map((e) => e.texto);
    for (const [k, t] of repartir(textos, lineas[bloque[0].de].inicio, lineas[hasta].fin).entries()) {
      salida.push({ id: idDe(salida.length), inicio: t.inicio, fin: t.fin, texto: textos[k] });
    }
    conTiempo += bloque.length;
  }
  // Una línea no sigue en pantalla cuando empieza la siguiente, ni pasa tan deprisa que no se pueda leer.
  for (let k = 0; k < salida.length; k++) {
    const siguiente = salida[k + 1]?.inicio ?? Number.POSITIVE_INFINITY;
    const l = salida[k];
    l.fin = Math.min(Math.max(l.fin, l.inicio + DURACION_MINIMA_MS), Math.max(siguiente, l.inicio + 1));
    l.inicio = Math.round(l.inicio);
    l.fin = Math.round(l.fin);
  }
  return { lineas: salida, conTiempo, estimadas };
}
