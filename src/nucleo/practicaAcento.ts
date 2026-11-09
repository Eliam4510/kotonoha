// La práctica del acento tonal: qué tono se espera en cada mora, dónde suena cada frase acentual en la grabación y si el
// tono cae donde debe. Se juzga sobre todo dónde cae (el núcleo), que es lo que se oye; la subida del principio, que en
// el habla seguida a veces no se hace, no cuenta. La investigación tampoco acierta siempre con frases leídas, así que el
// resultado orienta: una palabra dudosa es «para revisar», nunca un error. Lo propio de cada lengua (qué es una frase
// acentual y dónde va su núcleo) lo pone su paquete; aquí solo se mide y se compara.

import { type MarcoTono, mediana, semitonos } from './tono';

/** Una frase acentual: una palabra con lo que se le pega detrás (partículas, auxiliares). */
export interface FraseAcentual {
  /** Como se escribe. */
  texto: string;
  /** Su lectura en moras. */
  moras: string[];
  /** Las moras de la palabra sin lo que se le pega: hasta dónde llega. */
  morasPalabra: number;
  /**
   * Dónde cae el tono, en moras desde el principio (1, después de la primera); 0 si no cae. Varios si el diccionario da
   * varios. null si no se sabe para esta forma: se dibuja, pero no se juzga.
   */
  nucleos: number[] | null;
  /** Detrás va un signo de puntuación: ahí una pausa es natural. */
  pausaNatural: boolean;
  /** Su última mora suele perder la voz al final, como la su de です: apenas se oye. */
  ultimaSorda?: boolean;
}

export type Tono = 'alto' | 'bajo';

/** Los tonos de una frase acentual de `moras` moras con el núcleo en `nucleo`: baja la primera, salvo que caiga tras ella. */
export function tonosEsperados(moras: number, nucleo: number): Tono[] {
  return Array.from({ length: moras }, (_, i) => {
    const mora = i + 1;
    if (nucleo === 1) return mora === 1 ? 'alto' : 'bajo';
    if (mora === 1) return 'bajo';
    return nucleo === 0 || mora <= nucleo ? 'alto' : 'bajo';
  });
}

// ---------- Dónde suena cada frase ----------

/** Una letra de la lectura de lo que se oyó, con el instante en que suena. */
export interface KanaOido {
  kana: string;
  t: number;
}

/** Lo que dura cada letra del último token, que no tiene otro detrás que diga cuándo acaba. */
const COLA_TOKEN_S = 0.12;

/**
 * La lectura de lo que se oyó, letra a letra y con su instante. La transcripción da cuándo empieza cada token; el
 * analizador, la lectura de cada palabra. Cada palabra reparte su lectura a partes iguales entre su primera y su última
 * letra escrita.
 */
export function kanaConTiempo(tokens: { texto: string; t: number }[], palabras: { superficie: string; lectura: string }[], finVoz: number): KanaOido[] {
  // El instante de cada letra escrita.
  const letras: { c: string; t: number }[] = [];
  tokens.forEach((tk, i) => {
    const letrasTk = Array.from(tk.texto);
    const siguiente = tokens[i + 1]?.t ?? Math.max(tk.t + COLA_TOKEN_S * letrasTk.length, finVoz);
    letrasTk.forEach((c, k) => letras.push({ c, t: tk.t + ((siguiente - tk.t) * k) / Math.max(letrasTk.length, 1) }));
  });
  const escrito = letras.map((l) => l.c).join('');
  const salida: KanaOido[] = [];
  let cursor = 0;
  for (const p of palabras) {
    if (!p.superficie || !p.lectura) continue;
    const donde = escrito.indexOf(p.superficie, cursor);
    if (donde < 0) continue;
    const inicio = letras[Array.from(escrito.slice(0, donde)).length]?.t;
    const ultima = Array.from(escrito.slice(0, donde + p.superficie.length)).length;
    const fin = letras[ultima]?.t ?? finVoz;
    cursor = donde + p.superficie.length;
    if (inicio === undefined) continue;
    const kana = Array.from(p.lectura);
    kana.forEach((k, i) => salida.push({ kana: k, t: inicio + ((fin - inicio) * i) / kana.length }));
  }
  return salida;
}

export interface TramoFrase {
  inicio: number;
  fin: number;
  /** Qué parte de su lectura se reconoció en la grabación, de 0 a 1. */
  oida: number;
  /** Detrás viene una pausa o el final: su última mora lleva el tono de final de frase. */
  antesDePausa?: boolean;
}

/**
 * Dónde suena cada frase acentual. Se alinean las lecturas letra a letra con la mayor subsecuencia común: así da igual
 * que la transcripción escriba con kanji o con kana. Una frase de la que no se oyó nada va entre sus vecinas, con el
 * tiempo repartido por moras. Sin nada en común, null.
 */
export function tramosDeFrases(frases: FraseAcentual[], oido: KanaOido[], finVoz: number): TramoFrase[] | null {
  const esperado: { c: string; frase: number }[] = [];
  frases.forEach((f, i) => {
    for (const c of Array.from(f.moras.join(''))) esperado.push({ c, frase: i });
  });
  const n = esperado.length;
  const m = oido.length;
  if (!n || !m) return null;
  // Tabla de la subsecuencia común más larga.
  const tabla = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      tabla[i][j] = esperado[i].c === oido[j].kana ? tabla[i + 1][j + 1] + 1 : Math.max(tabla[i + 1][j], tabla[i][j + 1]);
    }
  }
  const instante: (number | null)[] = Array(n).fill(null);
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (esperado[i].c === oido[j].kana) {
      instante[i] = oido[j].t;
      i++;
      j++;
    } else if (tabla[i + 1][j] >= tabla[i][j + 1]) i++;
    else j++;
  }
  if (instante.every((t) => t === null)) return null;

  // Lo que dura una letra, de mediana: para cerrar la última frase oída.
  const pasos: number[] = [];
  let anterior: number | null = null;
  for (const t of instante) {
    if (t === null) continue;
    if (anterior !== null && t > anterior) pasos.push(t - anterior);
    anterior = t;
  }
  const porLetra = pasos.length ? mediana(pasos) : 0.1;

  const tramos: (TramoFrase | null)[] = frases.map((f, k) => {
    const propios = esperado.map((e, i) => (e.frase === k ? instante[i] : undefined)).filter((t) => t !== undefined);
    const oidos = propios.filter((t): t is number => t !== null);
    if (!oidos.length) return null;
    // Si no se reconoció su primera letra, empieza antes de la primera que sí, lo que duran las de delante.
    const primera = propios.findIndex((t) => t !== null);
    return { inicio: Math.max(0, oidos[0] - primera * porLetra), fin: Math.max(...oidos) + porLetra, oida: oidos.length / propios.length };
  });
  // Cada frase acaba donde empieza la siguiente que se oyó; la última, donde acaba la voz.
  for (let k = 0; k < tramos.length; k++) {
    const t = tramos[k];
    if (!t) continue;
    const siguiente = tramos.slice(k + 1).find((x) => x);
    t.fin = siguiente ? siguiente.inicio : Math.max(finVoz, t.inicio + porLetra);
    if (t.fin <= t.inicio) t.fin = t.inicio + porLetra;
  }
  // Las que no se oyeron, repartidas entre sus vecinas por moras.
  for (let k = 0; k < tramos.length; k++) {
    if (tramos[k]) continue;
    let fin = k;
    while (fin < tramos.length && !tramos[fin]) fin++;
    const desde = tramos[k - 1]?.fin ?? Math.max(0, (tramos[fin]?.inicio ?? finVoz) - porLetra * frases[k].moras.length);
    const hasta = tramos[fin]?.inicio ?? finVoz;
    const moras = frases.slice(k, fin).reduce((s, f) => s + f.moras.length, 0);
    let cursor = desde;
    for (let i = k; i < fin; i++) {
      const largo = ((hasta - desde) * frases[i].moras.length) / Math.max(moras, 1);
      tramos[i] = { inicio: cursor, fin: cursor + largo, oida: 0 };
      cursor += largo;
    }
    k = fin - 1;
  }
  return tramos as TramoFrase[];
}

// ---------- Dónde suena cada frase, medido con la voz ----------

/**
 * Un silencio más corto no parte la voz: es una consonante sorda, una vocal ensordecida o una っ (en «mashita», la shi
 * ensordecida y la t juntas pasan de un cuarto de segundo). Es lo mismo que una pausa larga: lo que parte la voz se señala.
 */
const HUECO_DE_PAUSA_S = 0.35;
/** Un trozo de voz más corto, suelto, es un golpe o una respiración. */
const TROZO_MINIMO_S = 0.08;
/**
 * Una racha de voz así de corta en un extremo de un trozo, separada de lo demás por un silencio, no es una mora: es el
 * chasquido o la respiración del final. Si se quedara, alargaría el trozo y retrasaría el reparto de todas sus moras.
 */
const RAFAGA_S = 0.06;
const HUECO_DE_RAFAGA_S = 0.1;
/** Antes de la primera voz puede ir una consonante sorda, como la k de きょう. */
const MARGEN_INICIAL_S = 0.06;
/** Tras la última voz queda el final de la vocal. */
const MARGEN_FINAL_S = 0.04;
/** De una mora final ensordecida suena con voz más o menos esta parte: la s de です, no. */
const PARTE_SONORA_ENSORDECIDA = 0.4;

/** Un trozo de la grabación con voz: de su primer instante con tono al último. */
export interface TrozoDeVoz {
  inicio: number;
  fin: number;
}

/** Los trozos con voz de la grabación, separados por pausas. Los silencios cortos quedan dentro. */
export function trozosDeVoz(curva: MarcoTono[]): TrozoDeVoz[] {
  // Las rachas de instantes seguidos con tono, de 10 en 10 ms.
  const rachas: TrozoDeVoz[] = [];
  for (const m of curva) {
    if (m.f0 === null) continue;
    const ultima = rachas[rachas.length - 1];
    if (ultima && m.t - ultima.fin <= 0.015) ultima.fin = m.t;
    else rachas.push({ inicio: m.t, fin: m.t });
  }
  // Juntas en trozos: un silencio corto no parte la voz.
  const grupos: TrozoDeVoz[][] = [];
  for (const r of rachas) {
    const grupo = grupos[grupos.length - 1];
    if (grupo && r.inicio - grupo[grupo.length - 1].fin <= HUECO_DE_PAUSA_S) grupo.push(r);
    else grupos.push([r]);
  }
  const suelta = (r: TrozoDeVoz, vecina: TrozoDeVoz) => r.fin - r.inicio < RAFAGA_S && Math.max(r.inicio - vecina.fin, vecina.inicio - r.fin) > HUECO_DE_RAFAGA_S;
  const trozos = grupos.map((g) => {
    while (g.length > 1 && suelta(g[g.length - 1], g[g.length - 2])) g.pop();
    while (g.length > 1 && suelta(g[0], g[1])) g.shift();
    return { inicio: g[0].inicio, fin: g[g.length - 1].fin };
  });
  const largos = trozos.filter((t) => t.fin - t.inicio >= TROZO_MINIMO_S);
  return largos.length ? largos : trozos;
}

/**
 * Dónde suena cada frase, medido con la voz. Las marcas de tiempo de la transcripción se desvían un par de décimas, y más
 * dentro de un token de varias moras: sirven para saber en qué trozo de voz va cada frase, pero solas no bastan para el
 * tono de cada mora. Dentro de cada trozo, las moras se reparten a partes iguales, porque el japonés va a tiempo de mora;
 * como no se dice todo a la misma velocidad (la palabra del principio va más despacio que el 〜ます del final), la frontera
 * entre dos frases queda a medio camino entre ese reparto y lo que marca la transcripción: se equivocan en sentidos
 * distintos, y la media se equivoca menos que cualquiera de los dos. Una frase que no se dijo no ocupa tiempo: queda
 * donde acaba la anterior.
 */
export function tramosConVoz(frases: FraseAcentual[], aprox: TramoFrase[], curva: MarcoTono[]): TramoFrase[] {
  const trozos = trozosDeVoz(curva);
  const dichas = frases.map((_, i) => i).filter((i) => aprox[i].oida > 0);
  if (!trozos.length || !dichas.length) return aprox;
  // Cada frase dicha va al trozo más cercano al centro de su tramo aproximado, sin volver atrás.
  const distancia = (t: number, z: TrozoDeVoz) => (t < z.inicio ? z.inicio - t : t > z.fin ? t - z.fin : 0);
  const grupos: number[][] = trozos.map(() => []);
  let desde = 0;
  for (const i of dichas) {
    const centro = (aprox[i].inicio + aprox[i].fin) / 2;
    let mejor = desde;
    for (let k = desde + 1; k < trozos.length; k++) if (distancia(centro, trozos[k]) < distancia(centro, trozos[mejor])) mejor = k;
    grupos[mejor].push(i);
    desde = mejor;
  }
  const salida: TramoFrase[] = aprox.map((t) => ({ ...t }));
  grupos.forEach((grupo, k) => {
    if (!grupo.length) return;
    const inicio = Math.max(0, trozos[k].inicio - MARGEN_INICIAL_S);
    const moras = grupo.reduce((s, i) => s + frases[i].moras.length, 0);
    // Si la última mora pierde la voz, lo que suena acaba antes que ella: el trozo cubre solo una parte suya.
    const cubiertas = frases[grupo[grupo.length - 1]].ultimaSorda ? moras - (1 - PARTE_SONORA_ENSORDECIDA) : moras;
    const porMora = (trozos[k].fin + MARGEN_FINAL_S - inicio) / Math.max(cubiertas, 0.5);
    const fin = inicio + porMora * moras;
    // Dónde empieza cada frase: a medio camino entre el reparto por moras y la transcripción, sin que ninguna se quede
    // con menos de la mitad de lo que le toca por moras.
    const inicios: number[] = [];
    let previas = 0;
    grupo.forEach((i, g) => {
      const uniforme = inicio + porMora * previas;
      previas += frases[i].moras.length;
      if (g === 0) return inicios.push(inicio);
      const transcrito = Math.min(Math.max(aprox[i].inicio, inicio), fin);
      const minimo = inicios[g - 1] + (porMora * frases[grupo[g - 1]].moras.length) / 2;
      const maximo = fin - (porMora * (moras - previas + frases[i].moras.length)) / 2;
      inicios.push(Math.min(Math.max((uniforme + transcrito) / 2, minimo), Math.max(minimo, maximo)));
    });
    grupo.forEach((i, g) => {
      salida[i] = { inicio: inicios[g], fin: inicios[g + 1] ?? fin, oida: aprox[i].oida, antesDePausa: g === grupo.length - 1 };
    });
  });
  for (let i = 0; i < salida.length; i++) {
    if (aprox[i].oida > 0) continue;
    const t = i > 0 ? salida[i - 1].fin : salida[dichas[0]].inicio;
    salida[i] = { inicio: t, fin: t, oida: 0 };
  }
  return salida;
}

// ---------- El tono de cada mora ----------

/**
 * El tono de cada mora de un tramo, en semitonos respecto a la voz de quien habla. Las moras se reparten a partes iguales:
 * el japonés va a tiempo de mora. Cada una se lee hacia su final, donde el tono ya ha llegado a donde va (Minematsu e
 * Hirose); una mora sin voz ahí, como una vocal ensordecida, no tiene valor, aunque al empezar le llegue la cola de la
 * anterior. Un hueco suelto se rellena con sus vecinas.
 *
 * `temprana` es la mora que se lee al principio: la que va antes de una última mora sin voz, como la ま de 〜ます. Si el
 * núcleo está en ella, el tono no tiene dónde caer después y cae dentro de ella misma.
 */
export function valoresPorMora(
  curva: MarcoTono[],
  tramo: { inicio: number; fin: number },
  moras: number,
  referencia: number,
  temprana: number | null = null
): (number | null)[] {
  const ancho = (tramo.fin - tramo.inicio) / Math.max(moras, 1);
  const valores = Array.from({ length: moras }, (_, i) => {
    const a = tramo.inicio + i * ancho;
    const [desde, hasta] = i === temprana ? [a, a + ancho * 0.6] : [a + ancho * 0.4, a + ancho];
    const usados = curva.filter((m) => m.f0 !== null && m.t >= desde && m.t < hasta);
    return usados.length >= 2 ? mediana(usados.map((m) => semitonos(m.f0!, referencia))) : null;
  });
  for (let i = 1; i + 1 < valores.length; i++) {
    const a = valores[i - 1];
    const b = valores[i + 1];
    if (valores[i] === null && a !== null && b !== null) valores[i] = (a + b) / 2;
  }
  return valores;
}

/** Una caída de una mora a la siguiente que se oye como tal, en semitonos. */
const CAIDA_MINIMA = 1.5;
/** Una caída repartida en dos moras seguidas cuenta si entre las dos llega a esto. */
const CAIDA_EN_DOS = 2.5;
/**
 * Para señalar una caída donde no debe haberla, tiene que ser clara: el tono baja algo a lo largo de toda frase, y tras el
 * núcleo sigue bajando.
 */
const CAIDA_CLARA = 2.5;
const CAIDA_CLARA_EN_DOS = 3.5;
/**
 * El pico de la mora del núcleo a veces se retrasa hasta la siguiente, sobre todo al principio de la frase: la caída llega
 * una mora tarde. Se da por buena si la mora del núcleo ya sonaba alta, a menos de esto de la siguiente; si quedaba muy por
 * debajo, lo que se oye es una subida y luego la caída, es decir, el núcleo en otro sitio.
 */
const PICO_RETRASADO = 2;

/** Lo que baja el tono de cada mora a la siguiente; -Infinity donde falta una de las dos. */
function bajadas(valores: (number | null)[]): number[] {
  return valores.slice(0, -1).map((a, i) => {
    const b = valores[i + 1];
    return a === null || b === null || b === undefined ? -Infinity : a - b;
  });
}

const hayDatos = (valores: (number | null)[]) =>
  valores.length >= 2 && valores.filter((v) => v !== null).length >= Math.max(2, Math.ceil(valores.length * 0.6));

/**
 * Dónde cae el tono: tras la primera mora con una caída que se oye como tal y que es al menos la mitad de la mayor, porque
 * tras el núcleo el tono sigue bajando y la bajada de después puede ser más grande que la del núcleo; 0 si no cae. Si no
 * hay una caída así de una mora a la siguiente, vale una repartida en dos moras seguidas, y cuenta tras la primera. null si
 * faltan datos: con voz en menos de seis de cada diez moras no se juzga.
 */
export function caidaOida(valores: (number | null)[]): number | null {
  if (!hayDatos(valores)) return null;
  const d = bajadas(valores);
  const umbral = Math.max(CAIDA_MINIMA, Math.max(...d) / 2);
  const una = d.findIndex((x) => x >= umbral);
  if (una >= 0) return una + 1;
  const dos = d.findIndex((x, j) => x > 0 && d[j + 1] > 0 && x + d[j + 1] >= CAIDA_EN_DOS);
  return dos >= 0 ? dos + 1 : 0;
}

/**
 * Si el tono de estas moras cuadra con el núcleo en `n` (0, sin núcleo). Sin núcleo, no puede haber una caída clara. Con
 * núcleo, el tono tiene que caer tras él, o una mora más tarde si el pico se retrasó; y antes no puede caer de verdad.
 */
export function cuadraConNucleo(valores: (number | null)[], n: number): boolean {
  const d = bajadas(valores);
  if (n === 0) return d.every((x, j) => x < CAIDA_CLARA && !(x > 0 && d[j + 1] > 0 && x + d[j + 1] >= CAIDA_CLARA_EN_DOS));
  const j = n - 1;
  const enSuSitio = d[j] >= CAIDA_MINIMA || (d[j] > 0 && d[j + 1] > 0 && d[j] + d[j + 1] >= CAIDA_EN_DOS);
  const nucleo = valores[j];
  const siguiente = valores[j + 1];
  const retrasada = !enSuSitio && d[j + 1] >= CAIDA_MINIMA && nucleo !== null && siguiente !== null && siguiente !== undefined && nucleo >= siguiente - PICO_RETRASADO;
  if (!enSuSitio && !retrasada) return false;
  const suya = enSuSitio ? Math.max(d[j], d[j] + Math.max(d[j + 1] ?? 0, 0)) : d[j + 1];
  return d.slice(0, j).every((x) => x < CAIDA_CLARA && x < suya * 0.8);
}

export type Veredicto = 'bien' | 'revisar' | 'sin-datos' | 'sin-juzgar' | 'no-oida';

export interface Juicio {
  veredicto: Veredicto;
  /** Tras qué mora cayó el tono en la grabación; 0 si no cayó. */
  caida: number | null;
  /** Dónde debía caer, entre lo que se puede oír: el núcleo que cuadró o, si ninguno, el primero; 0 si no debía caer. */
  esperado: number | null;
}

/**
 * Con menos de esto de su lectura reconocido, la frase no se entendió: si se dijo otra cosa (にほん por にっぽん), sus
 * moras no son las que se esperan y el juicio no valdría.
 */
const OIDA_MINIMA = 0.75;

/**
 * Si el tono cae donde debe. En la última frase no cuenta la última mora: ahí manda la entonación de la frase entera.
 * Una caída que no se puede oír (tras la última mora que cuenta) vale como «no cae»: sin nada detrás, una palabra con el
 * núcleo al final suena igual que una sin núcleo.
 */
export function juzgarFrase(frase: FraseAcentual, valores: (number | null)[], oida: number, ultima: boolean): Juicio {
  if (oida < OIDA_MINIMA) return { veredicto: 'no-oida', caida: null, esperado: null };
  const cuentan = ultima && valores.length > 2 ? valores.slice(0, -1) : valores;
  const caida = caidaOida(cuentan);
  if (!frase.nucleos) return { veredicto: 'sin-juzgar', caida, esperado: null };
  const posibles = [...new Set(frase.nucleos.map((n) => (n >= cuentan.length ? 0 : n)))];
  if (caida === null) return { veredicto: 'sin-datos', caida, esperado: posibles[0] };
  const bueno = posibles.find((n) => cuadraConNucleo(cuentan, n));
  if (bueno !== undefined) return { veredicto: 'bien', caida, esperado: bueno };
  // Si cae donde debe pero ya cayó antes, lo que hay que contar es la caída de antes.
  const antes = caida === posibles[0] ? bajadas(cuentan).findIndex((x) => x >= CAIDA_CLARA) : -1;
  return { veredicto: 'revisar', caida: antes >= 0 && antes + 1 < caida ? antes + 1 : caida, esperado: posibles[0] };
}

/**
 * El juicio de cada frase de una grabación, con el tono de sus moras. Delante de una pausa, de un signo de puntuación o del
 * final, la última mora lleva el tono de final de frase y no cuenta; y si esa mora pierde la voz, la de antes se lee al
 * principio, porque el tono cae dentro de ella.
 */
export function juzgarFrases(frases: FraseAcentual[], tramos: TramoFrase[], curva: MarcoTono[], referencia: number): { juicios: Juicio[]; valores: (number | null)[][] } {
  const valores = frases.map((f, i) => {
    const final = i === frases.length - 1 || f.pausaNatural || !!tramos[i].antesDePausa;
    const temprana = final && f.ultimaSorda && f.moras.length >= 2 ? f.moras.length - 2 : null;
    return valoresPorMora(curva, tramos[i], f.moras.length, referencia, temprana);
  });
  const juicios = frases.map((f, i) => juzgarFrase(f, valores[i], tramos[i].oida, i === frases.length - 1 || f.pausaNatural || !!tramos[i].antesDePausa));
  return { juicios, valores };
}

// ---------- Pausas ----------

export interface Pausa {
  /** La frase dicha tras la que se hizo la pausa. */
  despuesDe: number;
  /** La siguiente frase dicha. */
  antesDe: number;
  duracion: number;
}

/** Una pausa más larga que esto dentro de una frase leída ya se nota. */
const PAUSA_LARGA_S = HUECO_DE_PAUSA_S;

/**
 * Las pausas largas entre frases acentuales, salvo donde la puntuación las pide. Se miden en la voz, entre dos trozos con
 * tono; un silencio antes de empezar o después de acabar no cuenta.
 */
export function pausasLargas(curva: MarcoTono[], tramos: TramoFrase[], frases: FraseAcentual[]): Pausa[] {
  const trozos = trozosDeVoz(curva);
  const salida: Pausa[] = [];
  for (let k = 0; k + 1 < trozos.length; k++) {
    const hueco = trozos[k + 1].inicio - trozos[k].fin;
    if (hueco < PAUSA_LARGA_S) continue;
    const medio = (trozos[k].fin + trozos[k + 1].inicio) / 2;
    let antes = -1;
    tramos.forEach((t, i) => {
      if (t.oida > 0 && t.fin <= medio) antes = i;
    });
    const despues = tramos.findIndex((t, i) => i > antes && t.oida > 0 && t.inicio >= medio);
    if (antes < 0 || despues < 0 || frases[antes].pausaNatural) continue;
    salida.push({ despuesDe: antes, antesDe: despues, duracion: Math.round(hueco * 10) / 10 });
  }
  return salida;
}
