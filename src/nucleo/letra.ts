// Coloca la letra verdadera de una canción sobre los tiempos de una transcripción que la oyó mal. Claude solo dice qué
// verso suena sobre qué líneas; el resto sale de aquí. Así no puede cambiar una palabra de la letra ni inventarse un tiempo.

import { alinearCtc, bandaPorVersos, type ProbabilidadesCtc, zonasDeVersos } from './alineacionForzada';
import { letrasComparables, versosOidos } from './casarLetra';
import { desplegarMarcas } from './marcasLetra';
import { noSeCanta, versosDelRenglon } from './noSeCanta';
import { analizarLrc, type Linea } from './subtitulos';

/**
 * El verso `v` suena sobre las líneas `de` a `a` de la transcripción. Con -1, se canta pero la transcripción no lo recoge;
 * con -2, no se canta: una marca de sección o un crédito.
 */
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

const NO_SE_CANTA = -2;

const DURACION_MINIMA_MS = 700;
const ESTIMADA_MINIMA_MS = 1500;
const ESTIMADA_MAXIMA_MS = 8000;
const MS_POR_CARACTER = 300;
const HUECO_POR_LINEA_MS = 400;

/** Una letra pegada en LRC: la mayoría de sus renglones con letra empiezan por su hora, «[00:12.34]». */
function esLetraLrc(texto: string): boolean {
  const renglones = texto.split(/\r?\n/).filter((l) => /[\p{L}\p{N}]/u.test(l));
  const conHora = renglones.filter((l) => /^\s*\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/.test(l)).length;
  return conHora >= 3 && conHora >= renglones.length * 0.6;
}

/**
 * Los versos de una letra pegada, tal cual, sin líneas vacías, adornos ni la marca de tiempo que traen algunos
 * comentarios. Tampoco lo que no se canta (las marcas de sección y los créditos), y un verso con «×2» va dos veces.
 * Una letra en LRC se lee en el orden de sus horas, sin ellas: un estribillo con dos marcas va en sus dos sitios.
 */
export function versosDeLetra(texto: string): string[] {
  const fuente = esLetraLrc(texto) ? analizarLrc(texto).map((l) => l.texto).join('\n') : desplegarMarcas(texto);
  return fuente
    .split(/\r?\n/)
    .map((l) => l.replace(/[\u200b-\u200d\u2060\ufeff]/g, '').replace(/^\s*\[?\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]?\s*/, '').trim())
    .filter((l) => /[\p{L}\p{N}]/u.test(l) && !noSeCanta(l))
    .flatMap(versosDelRenglon)
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


/**
 * Un verso que Claude se salta se sigue cantando, y faltaría en pantalla. Entra sin tiempo, detrás de donde suena por primera
 * vez el anterior de la letra. Si nada tiene tiempo no se completa: esa letra no es de esta canción.
 */
function completar(versos: string[], ajuste: EntradaAjuste[]): EntradaAjuste[] {
  if (!ajuste.some((e) => e.de >= 0)) return ajuste;
  const salida = [...ajuste];
  const vistos = new Set(ajuste.map((e) => e.v));
  for (let v = 0; v < versos.length; v++) {
    if (vistos.has(v)) continue;
    let pos = 0;
    for (let anterior = v - 1; anterior >= 0; anterior--) {
      const i = salida.findIndex((e) => e.v === anterior);
      if (i >= 0) {
        pos = i + 1;
        break;
      }
    }
    salida.splice(pos, 0, { v, de: -1, a: -1 });
  }
  return salida;
}

/** Las entradas utilizables, en el orden en que suenan. Lo que no encaje en ese orden se queda sin tiempo, no sin verso. */
function depurar(versos: string[], lineas: Linea[], ajuste: EntradaAjuste[]): Pendiente[] {
  const validas = completar(versos, ajuste.filter((e) => Number.isInteger(e.v) && e.v >= 0 && e.v < versos.length)).filter((e) => e.de !== NO_SE_CANTA);
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
 * pegan al verso siguiente, que es adonde llevan; si no hay siguiente, al anterior. Si no caben, toman lo que les sobra a sus
 * vecinos: el reconocedor suele alargar una línea sobre lo que no entendió, y ahí es donde suenan. Devuelve dónde acaban.
 */
function colocarEstimadas(textos: string[], salida: Linea[], siguiente: number | null, holguraSiguiente: number, idDe: (k: number) => number, voz?: Voz): number {
  if (voz) {
    const puesto = colocarDondeSeCanta(textos, salida, siguiente, idDe, voz);
    if (puesto !== null) return puesto;
  }
  const previa = salida[salida.length - 1];
  const finPrevia = previa?.fin ?? 0;
  const total = textos.reduce((s, t) => s + duracionEstimada(t), 0);
  let desde: number;
  let hasta: number;
  if (siguiente === null) {
    desde = finPrevia;
    hasta = desde + total;
  } else if (siguiente - finPrevia >= total) {
    desde = siguiente - total;
    hasta = siguiente;
  } else {
    const falta = total - (siguiente - finPrevia);
    const dePrevia = previa ? Math.min(falta, Math.max(0, previa.fin - previa.inicio - duracionEstimada(previa.texto))) : 0;
    if (previa) previa.fin -= dePrevia;
    desde = finPrevia - dePrevia;
    hasta = siguiente + Math.min(falta - dePrevia, holguraSiguiente);
    // Y si aun así no caben, se le quita la mitad a la línea anterior.
    if (previa && hasta - desde < HUECO_POR_LINEA_MS * textos.length) {
      previa.fin = previa.inicio + (previa.fin - previa.inicio) / 2;
      desde = previa.fin;
    }
  }
  for (const [k, t] of repartir(textos, desde, hasta).entries()) {
    salida.push({ id: idDe(salida.length), inicio: t.inicio, fin: t.fin, texto: textos[k] });
  }
  return hasta;
}

/** Los versos que comparten alguna línea de la transcripción, desde el que empieza en `i`. */
function bloqueDesde(entradas: Pendiente[], i: number): { versos: Pendiente[]; hasta: number } {
  const versos = [entradas[i]];
  let hasta = entradas[i].a;
  for (let k = i + 1; k < entradas.length && entradas[k].de >= 0 && entradas[k].de <= hasta; k++) {
    versos.push(entradas[k]);
    hasta = Math.max(hasta, entradas[k].a);
  }
  return { versos, hasta };
}

// ---------- Dónde se canta ----------

/** La puntuación de «canto» de YAMNet en cada tramo de `pasoMs`, desde el principio del audio. */
export interface CantoPorTramos {
  pasoMs: number;
  puntos: number[];
}

/**
 * Por debajo de esto un tramo no lleva voz. En J-pop real el canto puntúa muy bajo, casi nunca por encima de 0,1:
 * medido con 21 canciones y la letra sincronizada de cada una, separa lo cantado de lo instrumental con un AUC de 0,9.
 */
const UMBRAL_CANTO = 0.02;

/** Los tramos donde se canta, para colocar los versos que la transcripción no recogió. */
export interface Voz {
  /** Los tramos con voz entre dos momentos, en ms, en orden y sin solaparse. */
  tramos(desde: number, hasta: number): [number, number][];
  /** Lo que dura el audio, en ms. */
  duracion: number;
}

/** Un hueco sin voz de un solo tramo se rellena: casi nunca es un pasaje instrumental, sino voz que YAMNet no vio. */
export function vozDeCanto(c: CantoPorTramos): Voz {
  const tramos: [number, number][] = [];
  c.puntos.forEach((x, w) => {
    if (x < UMBRAL_CANTO) return;
    const a = w * c.pasoMs;
    const ultimo = tramos[tramos.length - 1];
    if (ultimo && a - ultimo[1] <= c.pasoMs) ultimo[1] = a + c.pasoMs;
    else tramos.push([a, a + c.pasoMs]);
  });
  return {
    duracion: c.puntos.length * c.pasoMs,
    tramos: (desde, hasta) => tramos.map(([a, b]): [number, number] => [Math.max(a, desde), Math.min(b, hasta)]).filter(([a, b]) => b - a >= 200),
  };
}

/** Coloca los versos en el tiempo con voz elegido, en orden y según lo que hay que cantar en cada uno. */
function enTramos(textos: string[], salida: Linea[], tramos: [number, number][], idDe: (k: number) => number): number {
  const conVoz = tramos.reduce((s, [a, b]) => s + (b - a), 0);
  const enReal = (x: number, alFinal: boolean) => {
    let resto = x;
    for (const [a, b] of tramos) {
      if (alFinal ? resto <= b - a : resto < b - a) return a + resto;
      resto -= b - a;
    }
    return tramos[tramos.length - 1][1];
  };
  const total = textos.reduce((s, t) => s + peso(t), 0);
  let cursor = 0;
  let fin = tramos[0][0];
  for (const t of textos) {
    const largo = (conVoz * peso(t)) / total;
    fin = enReal(cursor + largo, true);
    salida.push({ id: idDe(salida.length), inicio: enReal(cursor, false), fin, texto: t });
    cursor += largo;
  }
  return fin;
}

/**
 * Como siempre, pegados al verso siguiente, pero contando solo el tiempo con voz: si justo antes del siguiente hay un
 * pasaje instrumental, van antes de él. Al final de la canción, detrás del anterior, también solo donde hay voz. Si el
 * hueco no da para cantarlos o casi no tiene voz, null: se colocan como siempre, que toma tiempo de los vecinos.
 * Medido con 164 versos que Whisper no oyó en 17 canciones: mejora 22 en más de un segundo y empeora 3.
 */
function colocarDondeSeCanta(textos: string[], salida: Linea[], siguiente: number | null, idDe: (k: number) => number, voz: Voz): number | null {
  const desde = salida[salida.length - 1]?.fin ?? 0;
  const hasta = siguiente ?? voz.duracion;
  const necesario = textos.reduce((s, t) => s + duracionEstimada(t), 0);
  if (hasta - desde < necesario) return null;
  const tramos = voz.tramos(desde, hasta);
  const conVoz = tramos.reduce((s, [a, b]) => s + (b - a), 0);
  if (conVoz < necesario * 0.5) return null;
  let falta = Math.min(necesario, conVoz);
  const elegidos: [number, number][] = [];
  if (siguiente !== null) {
    for (let i = tramos.length - 1; i >= 0 && falta > 0; i--) {
      const [a, b] = tramos[i];
      const toma = Math.min(falta, b - a);
      elegidos.unshift([b - toma, b]);
      falta -= toma;
    }
  } else {
    for (const [a, b] of tramos) {
      if (falta <= 0) break;
      const toma = Math.min(falta, b - a);
      elegidos.push([a, a + toma]);
      falta -= toma;
    }
  }
  return enTramos(textos, salida, elegidos, idDe);
}

/**
 * Construye las líneas finales: el texto, de la letra; los tiempos, de la transcripción. Con `voz`, los versos que la
 * transcripción no recogió no caen en un pasaje instrumental.
 */
export function aplicarAjuste(versos: string[], lineas: Linea[], ajuste: EntradaAjuste[], idInicial = ID_LETRA, voz?: Voz): ResultadoAjuste {
  const entradas = depurar(versos, lineas, ajuste);
  const salida: Linea[] = [];
  const idDe = (k: number) => idInicial + k;
  let conTiempo = 0;
  let estimadas = 0;
  let i = 0;
  let noAntesDe = 0;
  while (i < entradas.length) {
    if (entradas[i].de < 0) {
      const sinTiempo: string[] = [];
      while (i < entradas.length && entradas[i].de < 0) sinTiempo.push(entradas[i++].texto);
      let siguiente: number | null = null;
      let holgura = 0;
      if (i < entradas.length) {
        const { versos, hasta } = bloqueDesde(entradas, i);
        siguiente = lineas[entradas[i].de].inicio;
        holgura = Math.max(0, lineas[hasta].fin - siguiente - versos.reduce((s, e) => s + duracionEstimada(e.texto), 0));
      }
      noAntesDe = colocarEstimadas(sinTiempo, salida, siguiente, holgura, idDe, voz);
      estimadas += sinTiempo.length;
      continue;
    }
    // Los versos que comparten alguna línea de la transcripción se reparten su tiempo entre todos.
    const { versos, hasta } = bloqueDesde(entradas, i);
    const textos = versos.map((e) => e.texto);
    for (const [k, t] of repartir(textos, Math.max(lineas[entradas[i].de].inicio, noAntesDe), lineas[hasta].fin).entries()) {
      salida.push({ id: idDe(salida.length), inicio: t.inicio, fin: t.fin, texto: textos[k] });
    }
    i += versos.length;
    conTiempo += versos.length;
  }
  rematar(salida);
  return { lineas: salida, conTiempo, estimadas };
}

/** Una línea no sigue en pantalla cuando empieza la siguiente, ni pasa tan deprisa que no se pueda leer. */
function rematar(salida: Linea[]) {
  for (let k = 0; k < salida.length; k++) {
    const siguiente = salida[k + 1]?.inicio ?? Number.POSITIVE_INFINITY;
    const l = salida[k];
    l.fin = Math.min(Math.max(l.fin, l.inicio + DURACION_MINIMA_MS), Math.max(siguiente, l.inicio + 1));
    l.inicio = Math.round(l.inicio);
    l.fin = Math.round(l.fin);
  }
}

/**
 * Coloca la letra casándola letra a letra con la transcripción (ver casarLetra.ts), sin preguntar a nadie. Cada verso
 * oído empieza donde se oye su primera letra, aunque el reconocedor lo juntara con otros en una línea: repartir esa línea
 * entre sus versos según lo que se canta en cada uno los desfasaba cuando tras un silencio venían dos versos muy rápidos.
 * Los que no se oyeron van entre sus vecinos como siempre, y con `voz`, donde se canta.
 */
export function alinearPorLetras(versos: string[], lineas: Linea[], idInicial = ID_LETRA, voz?: Voz): ResultadoAjuste {
  const oidos = versosOidos(versos, lineas);
  const salida: Linea[] = [];
  const idDe = (k: number) => idInicial + k;
  let conTiempo = 0;
  let estimadas = 0;
  let v = 0;
  while (v < versos.length) {
    const oido = oidos[v];
    if (!oido) {
      const sinTiempo: string[] = [];
      while (v < versos.length && !oidos[v]) sinTiempo.push(versos[v++]);
      colocarEstimadas(sinTiempo, salida, v < versos.length ? oidos[v]!.inicio : null, 0, idDe, voz);
      estimadas += sinTiempo.length;
      continue;
    }
    // En orden: un verso no empieza antes que el anterior, y el anterior acaba donde empieza este.
    const previa = salida[salida.length - 1];
    const inicio = previa ? Math.max(oido.inicio, previa.inicio + DURACION_MINIMA_MS / 2) : oido.inicio;
    if (previa && previa.fin > inicio) previa.fin = inicio;
    salida.push({ id: idDe(salida.length), inicio, fin: Math.max(oido.fin, inicio + DURACION_MINIMA_MS), texto: versos[v] });
    conTiempo++;
    v++;
  }
  rematar(salida);
  return { lineas: salida, conTiempo, estimadas };
}

/** La vocal del final de un verso se alarga más allá de donde la marca el modelo, que solo da su comienzo. */
const COLA_VERSO_MS = 400;

/**
 * Coloca la letra con la voz. Lo que oyó Whisper dice dónde va cada verso a grandes rasgos (alinearPorLetras), y la
 * alineación forzada de sus fonemas con lo que oye un modelo de fonemas (narabas, `p`), dónde empieza exactamente: cada
 * verso se busca solo en su zona, así que una parte en otra lengua o un verso que no se canta no la desvían. `fonemas`
 * son las clases del modelo de cada verso; uno sin fonemas (en otra escritura), o una alineación que no cabe, se queda
 * donde lo pone lo que oyó Whisper. Medido con canciones japonesas y su letra sincronizada: ver la 0.50.0 en el CHANGELOG.
 */
export function alinearConVoz(versos: string[], lineas: Linea[], fonemas: number[][], p: ProbabilidadesCtc, msPorMarco: number, idInicial = ID_LETRA, voz?: Voz): ResultadoAjuste & { conVoz: number } {
  const toscas = alinearPorLetras(versos, lineas, idInicial, voz);
  // Un verso igual que su vecino (un estribillo repetido) no se sabe a qué copia de lo oído corresponde: se busca entre los
  // versos anclados de antes y de después, y la alineación, que va en orden, pone cada copia en su repetición.
  const normales = versos.map((v) => letrasComparables(v).join(''));
  const oidos = versosOidos(versos, lineas).map((o, v) => o !== null && normales[v] !== normales[v - 1] && normales[v] !== normales[v + 1]);
  const zonas = zonasDeVersos(toscas.lineas, oidos, p.marcos * msPorMarco, msPorMarco);
  const colocados = alinearCtc(
    p,
    fonemas.flat(),
    bandaPorVersos(
      zonas,
      fonemas.map((f) => f.length),
      p.marcos
    )
  );
  if (!colocados) return { ...toscas, conVoz: 0 };
  const salida = toscas.lineas.map((l) => ({ ...l }));
  let k = 0;
  let conVoz = 0;
  fonemas.forEach((f, v) => {
    if (!f.length) return;
    salida[v].inicio = colocados[k].primero * msPorMarco;
    salida[v].fin = (colocados[k + f.length - 1].ultimo + 1) * msPorMarco + COLA_VERSO_MS;
    k += f.length;
    conVoz++;
  });
  // Un verso que se quedó con el tiempo de Whisper no empieza antes que el anterior, colocado con la voz.
  for (let v = 1; v < salida.length; v++) if (salida[v].inicio <= salida[v - 1].inicio) salida[v].inicio = salida[v - 1].inicio + 1;
  rematar(salida);
  return { lineas: salida, conTiempo: toscas.conTiempo, estimadas: toscas.estimadas, conVoz };
}
