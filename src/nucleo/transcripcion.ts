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
  maximoCaracteres: number;
  /** Lo que se tarda en decir un carácter, para cuando Whisper no da el final de un segmento. */
  msPorCaracter: number;
}

/** Whisper procesa ventanas de 30 s: el corte se busca antes de llegar al límite. */
const MINIMO_S = 14;
const MAXIMO_S = 27;
const VENTANA_SILENCIO_S = 0.25;

/** Por debajo de esta energía no hay voz: enviarlo a Whisper solo produce alucinaciones. */
const UMBRAL_SILENCIO = 0.004;

export function energia(pcm: Float32Array, desde = 0, hasta = pcm.length): number {
  let suma = 0;
  for (let i = desde; i < hasta; i++) suma += pcm[i] * pcm[i];
  return Math.sqrt(suma / Math.max(hasta - desde, 1));
}

export const esSilencio = (pcm: Float32Array) => energia(pcm) < UMBRAL_SILENCIO;

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

/** Sin puntuación, corta donde la lengua lo permite, lo más cerca posible del centro. */
function partirSinPuntuacion(texto: string, reglas: ReglasTranscripcion): string[] {
  if (texto.length <= reglas.maximoCaracteres) return [texto];
  const centro = Math.floor(texto.length / 2);
  let mejor = -1;
  for (const m of texto.matchAll(reglas.corteSinPuntuacion)) {
    const corte = m.index + 1;
    if (mejor < 0 || Math.abs(corte - centro) < Math.abs(mejor - centro)) mejor = corte;
  }
  if (mejor < 0) mejor = centro;
  return [...partirSinPuntuacion(texto.slice(0, mejor), reglas), ...partirSinPuntuacion(texto.slice(mejor), reglas)];
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
        salida.push(actual);
        actual = '';
      }
      actual += parte;
    }
    if (actual) salida.push(...partirSinPuntuacion(actual, reglas));
  }
  return salida;
}

const DURACION_MINIMA_MS = 700;

/** Convierte los segmentos de Whisper en líneas con tiempos de video. */
export function segmentosALineas(segmentos: SegmentoWhisper[], mapa: TramoTiempo[], duracionTrozoS: number, idInicial: number, reglas: ReglasTranscripcion): Linea[] {
  const lineas: Linea[] = [];
  let id = idInicial;
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

/** Fracción del tiempo que la GPU trabaja para Whisper. Nunca es 1: el escritorio siempre tiene huecos. */
export function ocupacionObjetivo(intensidad: IntensidadWhisper, enUso: boolean): number {
  if (intensidad === 'suave') return 0.3;
  if (intensidad === 'rapida') return 0.9;
  return enUso ? 0.75 : 0.9;
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
