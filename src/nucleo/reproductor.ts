// El reproductor de archivos propios, sin navegador: qué es cada archivo, en qué orden van, qué subtítulos son de qué
// video y en qué idioma vienen, desde dónde se sigue viendo y qué línea dice cada momento.

import { porNombre } from './carpetas';
import { idiomaCorto } from './medios';

export type TipoArchivo = 'video' | 'audio' | 'subtitulos';

const EXTENSIONES: Record<TipoArchivo, string[]> = {
  video: ['mp4', 'webm', 'mkv', 'mov', 'm4v', 'ogv'],
  // Podcasts, audiolibros y canciones: suenan en el mismo reproductor, con sus subtítulos o con Whisper.
  audio: ['mp3', 'm4a', 'm4b', 'aac', 'ogg', 'oga', 'opus', 'wav', 'flac', 'weba'],
  subtitulos: ['srt', 'vtt', 'ass', 'ssa', 'ttml', 'dfxp', 'xml'],
};

/** Las extensiones que acepta el selector de archivos, con su punto. */
export const ACEPTADOS = Object.values(EXTENSIONES).flat().map((e) => `.${e}`);

export function tipoDeArchivo(nombre: string): TipoArchivo | null {
  const punto = nombre.lastIndexOf('.');
  if (punto < 0) return null;
  const ext = nombre.slice(punto + 1).toLowerCase();
  for (const [tipo, lista] of Object.entries(EXTENSIONES) as [TipoArchivo, string[]][]) if (lista.includes(ext)) return tipo;
  return null;
}

export const sinExtension = (nombre: string) => nombre.replace(/\.[^./\\]+$/, '');

/** Cómo se llama a veces un idioma en el nombre de un archivo, además de sus códigos (ja, jpn, ja-JP). */
const NOMBRES_IDIOMA: Record<string, string> = {
  japanese: 'ja', jp: 'ja', english: 'en', spanish: 'es', espanol: 'es', español: 'es', castellano: 'es', latino: 'es',
  german: 'de', deutsch: 'de', chinese: 'zh', chs: 'zh', cht: 'zh', korean: 'ko', french: 'fr', italian: 'it',
  portuguese: 'pt', russian: 'ru',
};
const CONOCIDOS = /^(ja|en|es|de|zh|ko|fr|it|pt|ru)$/;
/** Lo que acompaña al idioma en unos subtítulos y no es su nombre: «capítulo.ja.forced.srt». */
const MARCAS = /^(forced|sdh|cc|hi|full|signs|default|subs?)$/i;

function idiomaDeEtiqueta(etiqueta: string): string | null {
  const t = etiqueta.toLowerCase();
  if (NOMBRES_IDIOMA[t]) return NOMBRES_IDIOMA[t];
  const base = t.split(/[-_]/)[0];
  if (NOMBRES_IDIOMA[base]) return NOMBRES_IDIOMA[base];
  const corto = idiomaCorto(base);
  return CONOCIDOS.test(corto) ? corto : null;
}

/**
 * El nombre de unos subtítulos sin su extensión ni lo que dice de su idioma, para casarlos con su video, y ese idioma si
 * lo dice: «Capítulo 01.ja.srt» es de «Capítulo 01» y está en japonés.
 */
export function partesDeSubtitulo(nombre: string): { base: string; idioma: string | null } {
  let resto = sinExtension(nombre);
  let idioma: string | null = null;
  for (let vuelta = 0; vuelta < 3; vuelta++) {
    const m = resto.match(/\.([\p{L}]{2,10}(?:[-_][A-Za-z0-9]{2,4})?)$/u);
    if (!m) break;
    if (MARCAS.test(m[1])) {
      resto = resto.slice(0, -m[0].length);
      continue;
    }
    const encontrado: string | null = idioma ? null : idiomaDeEtiqueta(m[1]);
    if (!encontrado) break;
    idioma = encontrado;
    resto = resto.slice(0, -m[0].length);
  }
  return { base: resto, idioma };
}

const comparable = (s: string) => s.normalize('NFC').toLowerCase().replace(/[\s_]+/g, ' ').trim();

/**
 * Casa cada archivo de subtítulos con su video o su audio: el de nombre igual, sin la extensión ni el idioma; si no, el
 * que empieza igual (con el nombre más largo en común); y si solo hay uno, ese. Lo que no casa con ninguno queda suelto.
 */
export function emparejar<M extends { nombre: string }, S extends { nombre: string }>(medios: M[], subtitulos: S[]): { porMedio: Map<M, S[]>; sueltos: S[] } {
  const porMedio = new Map<M, S[]>();
  const sueltos: S[] = [];
  const bases = medios.map((m) => comparable(sinExtension(m.nombre)));
  for (const s of subtitulos) {
    const base = comparable(partesDeSubtitulo(s.nombre).base);
    let i = bases.indexOf(base);
    if (i < 0) {
      // Por el principio solo si no hay duda: un único candidato, y no por tres letras («Ep 1» no es de «Ep 10»).
      const candidatos = bases.flatMap((b, j) => (b.startsWith(base) || base.startsWith(b) ? [j] : []));
      if (candidatos.length === 1 && Math.min(bases[candidatos[0]].length, base.length) >= 4) i = candidatos[0];
    }
    if (i < 0 && medios.length === 1) i = 0;
    if (i < 0) sueltos.push(s);
    else porMedio.set(medios[i], [...(porMedio.get(medios[i]) ?? []), s]);
  }
  return { porMedio, sueltos };
}

/** Los videos y audios de una carpeta, en el orden de sus nombres: «Capítulo 2» antes que «Capítulo 10». */
export const enOrden = <T extends { nombre: string }>(l: T[]): T[] => [...l].sort((a, b) => porNombre(a.nombre, b.nombre));

/** Para reconocer un archivo cuando vuelve: su nombre y su tamaño. */
export const claveArchivo = (nombre: string, tamano: number) => `${nombre}|${tamano}`;

/** Ya se vio entero: está en los créditos, o en los últimos segundos de algo corto. */
export const haTerminado = (posicion: number, duracion: number) => duracion > 0 && posicion >= duracion - Math.min(30, duracion * 0.05);

/**
 * Desde dónde seguir viendo: unos segundos antes de donde se dejó, para retomar el hilo. Desde el principio, si apenas se
 * había empezado o ya se terminó.
 */
export function puntoDeReanudar(posicion: number, duracion: number): number | null {
  if (!(duracion > 0) || posicion < 15 || haTerminado(posicion, duracion)) return null;
  return Math.max(0, posicion - 3);
}

export const VELOCIDADES = [0.5, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];

export function velocidadVecina(actual: number, paso: 1 | -1): number {
  if (paso > 0) return VELOCIDADES.find((v) => v > actual + 1e-6) ?? VELOCIDADES[VELOCIDADES.length - 1];
  return [...VELOCIDADES].reverse().find((v) => v < actual - 1e-6) ?? VELOCIDADES[0];
}

/** 75 s es «1:15», y una hora y pico, «1:02:05». */
export function reloj(segundos: number): string {
  const s = Number.isFinite(segundos) && segundos > 0 ? Math.floor(segundos) : 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor(s / 60) % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(s % 60)}` : `${m}:${p(s % 60)}`;
}

/** La línea que suena en un momento (en ms), o la que acaba de sonar si es un hueco corto entre dos. */
export function lineaEn<T extends { inicio: number; fin: number }>(lineas: T[], ms: number): T | null {
  let a = 0;
  let b = lineas.length - 1;
  let previa = -1;
  while (a <= b) {
    const m = (a + b) >> 1;
    if (lineas[m].inicio <= ms) {
      previa = m;
      a = m + 1;
    } else b = m - 1;
  }
  if (previa < 0) return null;
  const l = lineas[previa];
  return ms < l.fin + 1500 ? l : null;
}
