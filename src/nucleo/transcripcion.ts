// Lógica pura de la transcripción con Whisper: trocear el audio por los silencios, convertir sus
// tiempos en tiempos de video y limpiar lo que Whisper devuelve antes de mostrarlo como subtítulos.

import type { Linea } from './subtitulos';

export const FRECUENCIA = 16000;

/** Lo que cambia con la lengua: las alucinaciones de Whisper y cómo se cortan sus frases. */
export interface ReglasTranscripcion {
  alucinaciones: RegExp[];
  /** Frases cortas que se aceptan en un trozo normal, pero no de un tramo recuperado sobre la música. */
  comunesSobreMusica: RegExp;
  finDeFrase: RegExp;
  pausa: RegExp;
  /** Dónde cortar una frase sin puntuación. Con la marca g. */
  corteSinPuntuacion: RegExp;
  /** Dónde cortar si no se encuentra ninguno de esos sitios. Sin esto, por la mitad: en japonés no molesta. */
  corteDeReserva?: RegExp;
  /** Si una cláusula larga entre comas también se parte, y no solo la última de la frase. */
  partirClausulas?: boolean;
  maximoCaracteres: number;
  /** Lo que se tarda en decir un carácter, para cuando Whisper no da el final de un segmento. */
  msPorCaracter: number;
  /** Si las palabras se separan con espacios: entonces un segmento que no empieza con uno sigue la palabra anterior. */
  espacios?: boolean;
}

/**
 * Whisper pone a veces el límite entre dos segmentos dentro de una palabra: «über da» y «s Zimmer ging». Se nota en que
 * el segundo no empieza con un espacio, como empiezan los demás. Ese trozo vuelve a su palabra, en el segmento anterior.
 */
export function unirPalabrasPartidas(segmentos: SegmentoWhisper[]): SegmentoWhisper[] {
  const salida = segmentos.map((s) => ({ ...s }));
  for (let i = 1; i < salida.length; i++) {
    const previo = salida[i - 1];
    const actual = salida[i];
    if (actual.palabrasEnteras) continue;
    const resto = /^[\p{L}\p{M}'’]{1,6}(?=\s|[,.;:!?…]|$)/u.exec(actual.texto)?.[0];
    if (!resto || !/\p{L}$/u.test(previo.texto.trimEnd())) continue;
    // Una palabra partida no deja hueco entre los dos: con una pausa en medio, son dos palabras.
    if (previo.fin !== null && actual.inicio - previo.fin > 0.3) continue;
    previo.texto = previo.texto.trimEnd() + resto;
    actual.texto = actual.texto.slice(resto.length);
  }
  return salida;
}

/** Whisper procesa ventanas de 30 s: el corte se busca antes de llegar al límite. */
const MINIMO_S = 14;
const MAXIMO_S = 27;
/**
 * Lo que se mira para decidir dónde hay un silencio. Con un cuarto de segundo, en una lectura sin pausas ganaba a veces
 * una consonante sorda, como la s de «das» o la ch de «vermochte», que suena con poca energía: el corte partía la
 * palabra, y Whisper oía «da» en un trozo y «s Zimmer» en el siguiente. Casi medio segundo ya no cabe en una consonante.
 */
const VENTANA_SILENCIO_S = 0.45;

/** Por debajo de esta energía no hay voz: enviarlo a Whisper solo produce alucinaciones. */
const UMBRAL_SILENCIO = 0.004;

export function energia(pcm: Float32Array, desde = 0, hasta = pcm.length): number {
  let suma = 0;
  for (let i = desde; i < hasta; i++) suma += pcm[i] * pcm[i];
  return Math.sqrt(suma / Math.max(hasta - desde, 1));
}

export const esSilencio = (pcm: Float32Array) => energia(pcm) < UMBRAL_SILENCIO;

/**
 * Si en ninguna ventana de medio segundo suena algo que pueda ser voz: una grabación del dictado en la que no se habló.
 * Se mira por ventanas y no entera: en un minuto con una sola frase corta, la energía media quedaría por debajo del
 * umbral aunque la frase esté.
 */
export function esGrabacionMuda(pcm: Float32Array): boolean {
  const ventana = FRECUENCIA / 2;
  for (let i = 0; i < pcm.length; i += ventana) if (!esSilencio(pcm.subarray(i, i + ventana))) return false;
  return true;
}

/** Devuelve la muestra donde conviene cortar: el centro del tramo más silencioso entre min y max. */
export function elegirCorte(pcm: Float32Array, minS = MINIMO_S, maxS = MAXIMO_S): number {
  const paso = Math.floor(FRECUENCIA * 0.05);
  const ventana = Math.floor(FRECUENCIA * VENTANA_SILENCIO_S);
  const inicio = Math.floor(minS * FRECUENCIA);
  const fin = Math.min(Math.floor(maxS * FRECUENCIA), pcm.length - ventana);
  let mejor = Math.min(Math.floor(maxS * FRECUENCIA), pcm.length);
  let menor = Infinity;
  for (let i = inicio; i < fin; i += paso) {
    const e = energia(pcm, i, i + ventana);
    if (e < menor) {
      menor = e;
      mejor = i + Math.floor(ventana / 2);
    }
  }
  return mejor;
}

/** Relación entre muestras de audio y tiempo de video: cambia con las pausas y la velocidad. */
export interface TramoTiempo {
  muestra: number;
  videoMs: number;
}

export function videoEn(mapa: TramoTiempo[], muestra: number): number {
  if (!mapa.length) return (muestra / FRECUENCIA) * 1000;
  let i = 0;
  while (i + 1 < mapa.length && mapa[i + 1].muestra <= muestra) i++;
  const a = mapa[i];
  const b = mapa[i + 1];
  if (!b) return a.videoMs + ((muestra - a.muestra) / FRECUENCIA) * 1000;
  const t = (muestra - a.muestra) / Math.max(b.muestra - a.muestra, 1);
  return a.videoMs + t * (b.videoMs - a.videoMs);
}

export interface TrozoAudio {
  pcm: Float32Array;
  mapa: TramoTiempo[];
}

/** Va guardando el audio capturado y entrega trozos listos para transcribir. */
export class AcumuladorAudio {
  private bloques: Float32Array[] = [];
  private mapa: TramoTiempo[] = [];
  private total = 0;

  get muestras() {
    return this.total;
  }

  agregar(pcm: Float32Array, videoMs: number) {
    if (!pcm.length) return;
    this.mapa.push({ muestra: this.total, videoMs });
    this.bloques.push(pcm);
    this.total += pcm.length;
  }

  private unir(): Float32Array {
    const todo = new Float32Array(this.total);
    let p = 0;
    for (const b of this.bloques) {
      todo.set(b, p);
      p += b.length;
    }
    return todo;
  }

  /** Saca un trozo. Sin `forzar` espera a tener suficiente audio para cortar en un silencio. */
  extraer(forzar = false): TrozoAudio | null {
    if (!this.total) return null;
    if (!forzar && this.total < MAXIMO_S * FRECUENCIA) return null;
    const todo = this.unir();
    const corte = this.total <= MAXIMO_S * FRECUENCIA ? this.total : elegirCorte(todo);
    const pcm = todo.slice(0, corte);
    const mapa = this.mapa.filter((m) => m.muestra < corte);
    // Lo que queda se conserva con su posición desplazada.
    const resto = todo.slice(corte);
    const restoMapa = this.mapa.filter((m) => m.muestra >= corte).map((m) => ({ muestra: m.muestra - corte, videoMs: m.videoMs }));
    if (resto.length && (!restoMapa.length || restoMapa[0].muestra > 0)) {
      restoMapa.unshift({ muestra: 0, videoMs: videoEn(this.mapa, corte) });
    }
    this.bloques = resto.length ? [resto] : [];
    this.mapa = restoMapa;
    this.total = resto.length;
    return { pcm, mapa };
  }
}

export interface SegmentoWhisper {
  texto: string;
  /** Segundos desde el inicio del trozo. */
  inicio: number;
  fin: number | null;
  /**
   * Viene de un transductor, que ya parte por palabras: entre este segmento y el anterior no puede haber una palabra
   * partida. Sus segmentos salen de cortar una frase larga, a menudo justo antes de una palabra corta («going» | «for»).
   */
  palabrasEnteras?: boolean;
}

export const esAlucinacion = (texto: string, reglas: ReglasTranscripcion) => reglas.alucinaciones.some((r) => r.test(texto.trim()));

/** Whisper a veces entra en bucle repitiendo lo mismo: se deja una sola vez. */
export function colapsarRepeticiones(texto: string): string {
  return texto.replace(/(.{1,12}?)\1{3,}/gu, '$1');
}

/** El decodificador se atascó y repitió lo mismo hasta agotarse: ese segmento no es texto real. */
export function esBucle(texto: string): boolean {
  const t = texto.trim();
  return t.length >= 16 && colapsarRepeticiones(t).length < t.length * 0.4;
}

// ---------- Tramos que Whisper se salta ----------
//
// Con música de fondo Whisper puede dar por terminado un trozo, o empezarlo tarde, y saltarse la voz.
// Volver a pasar ese tramo por separado la recupera muchas veces. Pero la mayoría de esos tramos sí
// son solo música, y ahí una segunda oportunidad tiende a inventar frases: lo que salga se exige más.

/** Menos que esto son pausas normales: no merece otra pasada. */
const HUECO_MINIMO_S = 6;
/** Ventana para el audio donde el decodificador se atasca: con menos audio suele salir adelante. */
const VENTANA_HUECO_S = 10;

export interface Hueco {
  desde: number;
  hasta: number;
}

/** Tramos entre `desdeS` y `hastaS` que ningún segmento cubre. */
export function huecosSinTexto(segmentos: SegmentoWhisper[], desdeS: number, hastaS: number, reglas: ReglasTranscripcion, minimoS = HUECO_MINIMO_S): Hueco[] {
  const huecos: Hueco[] = [];
  let cursor = desdeS;
  for (const s of [...segmentos].sort((a, b) => a.inicio - b.inicio)) {
    if (s.inicio - cursor >= minimoS) huecos.push({ desde: cursor, hasta: s.inicio });
    cursor = Math.max(cursor, s.fin ?? s.inicio + (s.texto.length * reglas.msPorCaracter) / 1000);
  }
  if (hastaS - cursor >= minimoS) huecos.push({ desde: cursor, hasta: hastaS });
  return huecos;
}

/** Reparte un tramo en ventanas cortas con un segundo de solape, para no partir una frase. */
export function ventanasDeHueco(h: Hueco, tamS = VENTANA_HUECO_S): Hueco[] {
  const ventanas: Hueco[] = [];
  for (let x = h.desde; x < h.hasta; x += tamS - 1) {
    ventanas.push({ desde: x, hasta: Math.min(x + tamS, h.hasta) });
    if (x + tamS >= h.hasta) break;
  }
  return ventanas;
}

/** Solo se acepta de un hueco lo que claramente es una frase: mejor perder un「うん」que inventarla. */
export function esTextoRecuperable(texto: string, reglas: ReglasTranscripcion): boolean {
  const t = texto.trim();
  if (esAlucinacion(t, reglas) || esBucle(t) || reglas.comunesSobreMusica.test(t)) return false;
  return new Set(t.replace(/[\s\p{P}\p{S}]/gu, '')).size >= 4;
}

/**
 * Sin puntuación, corta donde la lengua lo permite. Se reparte en tantas líneas como hagan falta, y cada corte se busca cerca
 * de donde tocaría para que salgan parecidas: si no, una frase larga podía quedar en un trozo de dos palabras y otro enorme.
 */
function partirSinPuntuacion(texto: string, reglas: ReglasTranscripcion, lineas = Math.ceil(texto.length / reglas.maximoCaracteres)): string[] {
  const maximo = reglas.maximoCaracteres;
  if (texto.length <= maximo) return [texto];
  const piezas = Math.max(lineas, Math.ceil(texto.length / maximo));
  const objetivo = texto.length / piezas;
  // Lo que quede tiene que caber en las líneas que faltan.
  const minimo = texto.length - maximo * (piezas - 1);
  const cortes = (re: RegExp | undefined) => (re ? [...texto.matchAll(re)].map((m) => m.index + 1) : []);
  const masCercano = (lista: number[]) => lista.reduce((mejor, c) => (mejor < 0 || Math.abs(c - objetivo) < Math.abs(mejor - objetivo) ? c : mejor), -1);
  const dentro = (desde: number) => (c: number) => c >= Math.max(objetivo * desde, minimo) && c <= maximo;
  let corte = masCercano(cortes(reglas.corteSinPuntuacion).filter(dentro(0.65)));
  if (corte <= 0) corte = masCercano(cortes(reglas.corteDeReserva).filter(dentro(0.5)));
  if (corte <= 0) corte = masCercano(cortes(reglas.corteSinPuntuacion).filter((c) => c <= maximo));
  if (corte <= 0) corte = Math.round(objetivo);
  return [texto.slice(0, corte), ...partirSinPuntuacion(texto.slice(corte), reglas, piezas - 1)];
}

/** Parte un segmento largo en líneas de subtítulo por la puntuación, sin cortar a mitad de palabra si se puede. */
export function partirTexto(texto: string, reglas: ReglasTranscripcion): string[] {
  const frases = texto.split(reglas.finDeFrase).map((s) => s.trim()).filter(Boolean);
  const salida: string[] = [];
  for (const f of frases) {
    if (f.length <= reglas.maximoCaracteres) {
      salida.push(f);
      continue;
    }
    let actual = '';
    for (const parte of f.split(reglas.pausa)) {
      if (actual && actual.length + parte.length > reglas.maximoCaracteres) {
        salida.push(...(reglas.partirClausulas ? partirSinPuntuacion(actual, reglas) : [actual]).map((t) => t.trim()));
        actual = '';
      }
      actual += parte;
    }
    if (actual) salida.push(...partirSinPuntuacion(actual, reglas).map((t) => t.trim()));
  }
  return salida;
}

const DURACION_MINIMA_MS = 700;

/** Convierte los segmentos de Whisper en líneas con tiempos de video. */
export function segmentosALineas(segmentos: SegmentoWhisper[], mapa: TramoTiempo[], duracionTrozoS: number, idInicial: number, reglas: ReglasTranscripcion): Linea[] {
  const lineas: Linea[] = [];
  let id = idInicial;
  if (reglas.espacios) segmentos = unirPalabrasPartidas(segmentos);
  segmentos.forEach((s, i) => {
    const limpio = colapsarRepeticiones(s.texto.trim());
    if (!limpio || esAlucinacion(limpio, reglas) || esBucle(s.texto)) return;
    const siguiente = segmentos[i + 1]?.inicio;
    const finS = Math.min(s.fin ?? siguiente ?? s.inicio + (limpio.length * reglas.msPorCaracter) / 1000, duracionTrozoS);
    const trozos = partirTexto(limpio, reglas);
    const total = trozos.reduce((n, t) => n + t.length, 0);
    let cursor = s.inicio;
    for (const t of trozos) {
      const parte = ((finS - s.inicio) * t.length) / Math.max(total, 1);
      const inicio = videoEn(mapa, Math.round(cursor * FRECUENCIA));
      const fin = videoEn(mapa, Math.round((cursor + parte) * FRECUENCIA));
      lineas.push({ id: id++, inicio: Math.round(inicio), fin: Math.round(Math.max(fin, inicio + DURACION_MINIMA_MS)), texto: t });
      cursor += parte;
    }
  });
  // Una línea no debe seguir en pantalla cuando empieza la siguiente.
  for (let i = 0; i + 1 < lineas.length; i++) {
    if (lineas[i].fin > lineas[i + 1].inicio) lineas[i].fin = Math.max(lineas[i].inicio + 200, lineas[i + 1].inicio);
  }
  return lineas;
}

/** Añade líneas nuevas: lo que ya había en ese tramo se reemplaza, y si se repite la última línea se une. */
export function fusionarLineas<T extends Linea>(base: T[], nuevas: T[]): T[] {
  if (!nuevas.length) return base;
  const desde = nuevas[0].inicio;
  const hasta = nuevas[nuevas.length - 1].fin;
  const resto = base.filter((l) => l.fin <= desde || l.inicio >= hasta);
  const todas = [...resto, ...nuevas].sort((a, b) => a.inicio - b.inicio);
  const salida: T[] = [];
  for (const l of todas) {
    const previa = salida[salida.length - 1];
    if (previa && previa.texto === l.texto && l.inicio - previa.fin < 1500) {
      salida[salida.length - 1] = { ...previa, fin: Math.max(previa.fin, l.fin) };
      continue;
    }
    salida.push(l);
  }
  return salida;
}

// ---------- Control de carga ----------
//
// Trabajar sin pausas deja la GPU al 100 % durante horas: el escritorio se traba y el controlador
// puede reiniciarse. Por eso tras cada trozo se descansa en proporción a lo que tardó. Si otra
// aplicación ocupa la GPU, el trozo tarda más y el descanso crece solo: se autorregula.

export type IntensidadWhisper = 'auto' | 'suave' | 'rapida';

/** Lo que el reproductor cuenta del video mientras se transcribe su audio entero (un archivo, o con el ayudante). */
export interface RitmoVideo {
  /** Cuánto va lo transcrito por delante de lo que se ve, en segundos; null si el video no se está viendo. */
  ventajaS: number | null;
  /** Si el video ha perdido fotogramas mientras se transcribía. */
  tirones: boolean;
  /** El video está en pausa: nada que se vea necesita la tarjeta gráfica. */
  enPausa?: boolean;
}

/** Con menos ventaja, lo que se ve está a punto de alcanzar a lo transcrito: en automático se trabaja a toda marcha. */
export const VENTAJA_JUSTA_S = 30;
/** Con más ventaja y el video dando tirones, en automático la gráfica descansa como en «Suave»: lo que se ve tardará en llegar. */
export const VENTAJA_HOLGADA_S = 60;

/**
 * Fracción del tiempo que la GPU trabaja para Whisper. Nunca es 1: el escritorio siempre tiene huecos. En automático,
 * además, mira el video que se está viendo: si lo visto va a alcanzar a lo transcrito, trabaja más; si va sobrado y el
 * video da tirones, descansa más. «Suave» y «Rápida» son lo que se eligió, y no cambian.
 */
export function ocupacionObjetivo(intensidad: IntensidadWhisper, enUso: boolean, ritmo?: RitmoVideo): number {
  if (intensidad === 'suave') return 0.3;
  if (intensidad === 'rapida') return 0.9;
  // Con el video en pausa iba más lenta que viéndolo: descansaba como si hubiera algo que reproducir.
  if (ritmo?.enPausa) return 0.9;
  if (ritmo && ritmo.ventajaS !== null) {
    if (ritmo.ventajaS < VENTAJA_JUSTA_S) return 0.9;
    if (ritmo.tirones && ritmo.ventajaS > VENTAJA_HOLGADA_S) return 0.3;
  }
  return enUso ? 0.75 : 0.9;
}

/** Si se sabe dónde va el video y está en pausa: con una marca vieja no se sabe nada. */
export const videoEnPausa = (marca: MarcaVideo, ahora: number): boolean => !marca.reproduciendo && marca.instante > 0 && ahora - marca.instante <= MARCA_VIEJA_MS;

/** Hasta dónde llegó la transcripción del audio entero de un video, y si terminó. */
export interface ProgresoTranscripcion {
  hastaMs: number;
  completa: boolean;
}

/** Lo que se repite al seguir, para no partir una frase por la mitad. */
const SOLAPE_AL_SEGUIR_MS = 1000;
/** Tan cerca del final ya no queda nada que seguir. */
const CASI_AL_FINAL_MS = 2000;

/**
 * Desde dónde sigue una transcripción del audio entero: solo la que se cortó, desde donde iba. Una terminada, o una de la
 * que no se sabe (las guardadas antes de la 0.49.2), empieza de cero. Antes se miraba dónde acababa la última línea, y el
 * final instrumental de una canción parecía una transcripción a medias: se volvía a transcribir solo el final.
 */
export function desdeDondeSeguir(previo: ProgresoTranscripcion | undefined, duracionMs: number): number {
  if (!previo || previo.completa || previo.hastaMs <= SOLAPE_AL_SEGUIR_MS) return 0;
  if (duracionMs > 0 && previo.hastaMs >= duracionMs - CASI_AL_FINAL_MS) return 0;
  return previo.hastaMs - SOLAPE_AL_SEGUIR_MS;
}

/** La última marca del reproductor: dónde iba el video, si se estaba viendo, a qué velocidad y cuándo se marcó. */
export interface MarcaVideo {
  videoMs: number;
  reproduciendo: boolean;
  velocidad: number;
  instante: number;
}

/** Una marca más vieja ya no dice dónde va el video: el reproductor marca cuatro veces por segundo. */
const MARCA_VIEJA_MS = 3000;

/** Cuánto va lo transcrito (hasta `frenteMs`) por delante de lo que se ve, en segundos; null si no se está viendo. */
export function ventajaSobreVideo(frenteMs: number, marca: MarcaVideo, ahora: number): number | null {
  if (!marca.reproduciendo || ahora - marca.instante > MARCA_VIEJA_MS) return null;
  return (frenteMs - (marca.videoMs + (ahora - marca.instante) * marca.velocidad)) / 1000;
}

/** Al empezar aún no hay ritmo: se espera este rato antes de juzgar si la transcripción llega. */
const ARRANQUE_MS = 20000;
/** Lo que se ve está a menos de esto de lo transcrito: ya no quedan subtítulos por delante. */
const MARGEN_ALCANCE_MS = 3000;

/**
 * Si la transcripción de un audio entero no llega a lo que se ve: lo visto ya la alcanzó y, al ritmo que lleva (lo
 * transcrito por segundo de reloj, con los descansos), no la va a dejar atrás. Si lo visto la alcanzó porque se saltó
 * hacia delante, pero la transcripción corre más que el video, sí llegará: no se avisa.
 */
export function noLlega(p: { frenteMs: number; vistoMs: number; avanceMs: number; transcurridoMs: number; velocidadVideo: number }): boolean {
  if (p.transcurridoMs < ARRANQUE_MS || p.frenteMs - p.vistoMs > MARGEN_ALCANCE_MS) return false;
  return p.avanceMs / p.transcurridoMs < p.velocidadVideo * 1.1;
}

/** Con esta ventaja, lo que esperaba a la transcripción puede seguir: hay subtítulos para un buen rato. */
export const VENTAJA_PARA_SEGUIR_S = 45;

/** Lo que el video cuenta de sus fotogramas desde que empezó: los que había que pintar y los que se perdieron. */
export interface CalidadVideo {
  totales: number;
  perdidos: number;
}

const VENTANA_TIRONES_MS = 10000;
/** Con menos fotogramas en la ventana (un video en pausa casi todo el rato), no se juzga. */
const MINIMO_FOTOGRAMAS = 60;
/** Lo normal es perder alguno suelto; perder más de uno de cada veinte ya se nota. */
const PROPORCION_TIRONES = 0.05;

/**
 * Si el video da tirones: los fotogramas perdidos en los últimos diez segundos, frente a los que había que pintar. Se le
 * da lo que cuenta el reproductor cada poco; si la cuenta vuelve a empezar (otro video), empieza de nuevo.
 */
export class MedidorTirones {
  private muestras: (CalidadVideo & { t: number })[] = [];

  medir(c: CalidadVideo, ahora: number): boolean {
    const ultima = this.muestras[this.muestras.length - 1];
    if (ultima && (c.totales < ultima.totales || c.perdidos < ultima.perdidos)) this.muestras = [];
    this.muestras.push({ ...c, t: ahora });
    while (this.muestras.length > 2 && ahora - this.muestras[0].t > VENTANA_TIRONES_MS) this.muestras.shift();
    const totales = c.totales - this.muestras[0].totales;
    const perdidos = c.perdidos - this.muestras[0].perdidos;
    return totales >= MINIMO_FOTOGRAMAS && perdidos / totales > PROPORCION_TIRONES;
  }
}

const PAUSA_MINIMA_MS = 200;
const PAUSA_MAXIMA_MS = 60000;

export function pausaTrasTrozo(msTrozo: number, ocupacion: number): number {
  const pausa = (msTrozo * (1 - ocupacion)) / ocupacion;
  return Math.round(Math.min(PAUSA_MAXIMA_MS, Math.max(PAUSA_MINIMA_MS, pausa)));
}

/** Tiempo estimado para lo que falta, a partir del ritmo real, ya con los descansos incluidos. */
export function segundosRestantes(hechoS: number, totalS: number, transcurridoS: number): number | null {
  if (hechoS <= 0 || transcurridoS <= 0) return null;
  return Math.max(0, Math.round((totalS - hechoS) * (transcurridoS / hechoS)));
}
