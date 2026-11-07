// Analizadores de subtítulos y limpieza. Lógica pura, sin dependencias del navegador.

import { tr } from '../compartido/i18n';
export interface Linea {
  id: number;
  inicio: number; // ms
  fin: number; // ms
  texto: string;
  arriba?: boolean; // El sitio la coloca en la parte superior (carteles, rótulos)
}

type LineaCruda = Omit<Linea, 'id'>;

export type FormatoSubtitulo = 'vtt' | 'srt' | 'ass' | 'ttml' | 'json3' | 'srv3';

export function detectarFormato(texto: string): FormatoSubtitulo | null {
  const inicio = texto.trimStart().slice(0, 2000);
  if (inicio.startsWith('WEBVTT')) return 'vtt';
  if (inicio.startsWith('{') && inicio.includes('"events"')) return 'json3';
  if (inicio.startsWith('{') && inicio.includes('wireMagic')) return 'json3';
  if (/<timedtext\b/.test(inicio)) return 'srv3';
  if (/<tt[\s>:]/.test(inicio)) return 'ttml';
  if (/\[Script Info\]|\[V4\+? Styles\]|^Dialogue:/m.test(inicio)) return 'ass';
  if (/\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}\s*-->/.test(inicio)) return inicio.includes(',') ? 'srt' : 'vtt';
  return null;
}

export function analizarSubtitulos(texto: string, formato?: FormatoSubtitulo | null): Linea[] {
  const f = formato ?? detectarFormato(texto);
  switch (f) {
    case 'vtt':
      return normalizar(analizarVtt(texto));
    case 'srt':
      return normalizar(analizarSrt(texto));
    case 'ass':
      return normalizar(analizarAss(texto));
    case 'ttml':
      return normalizar(analizarTtml(texto));
    case 'json3':
      return normalizar(analizarJson3(texto));
    case 'srv3':
      return normalizar(analizarSrv3(texto));
    default:
      throw new Error(tr('Formato de subtítulos no reconocido'));
  }
}

// ---------- Entidades y limpieza de texto ----------

const ENTIDADES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  lrm: '',
  rlm: '',
  hellip: '…',
  ensp: ' ',
  emsp: '　',
  thinsp: ' ',
  zwj: '',
  zwnj: '',
};

export function decodificarEntidades(texto: string): string {
  return texto.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, c: string) => {
    if (c[0] === '#') {
      const n = c[1] === 'x' || c[1] === 'X' ? parseInt(c.slice(2), 16) : parseInt(c.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTIDADES[c] ?? m;
  });
}

function limpiarTexto(texto: string): string {
  return texto
    .replace(/[​-‏‪-‮⁠﻿]/g, '')
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .filter((l) => l.length > 0)
    .join('\n');
}

const ACOTACION = /^[\s]*[(（\[［【〈《♪♫~〜～][^)）\]］】〉》]*[)）\]］】〉》♪♫~〜～]?[\s]*$/;

/** Indica si la línea es solo una acotación: (笑), ［拍手］, ♪〜 */
export function esSoloAcotacion(texto: string): boolean {
  return texto.split('\n').every((l) => ACOTACION.test(l));
}

/** Ordena, une duplicados y numera. */
export function normalizar(crudas: LineaCruda[]): Linea[] {
  const validas = crudas
    .map((l) => ({ ...l, texto: limpiarTexto(l.texto) }))
    .filter((l) => l.texto.length > 0 && l.fin > l.inicio)
    .sort((a, b) => a.inicio - b.inicio || a.fin - b.fin);

  const unidas: LineaCruda[] = [];
  for (const actual of validas) {
    const previa = unidas[unidas.length - 1];
    if (previa) {
      // Mismo tiempo: el sitio partió una frase en dos bloques visuales.
      if (previa.inicio === actual.inicio && previa.fin === actual.fin) {
        if (previa.texto !== actual.texto) previa.texto += '\n' + actual.texto;
        continue;
      }
      // Mismo texto seguido sin pausa: es una sola línea cortada.
      if (previa.texto === actual.texto && actual.inicio - previa.fin <= 100) {
        previa.fin = Math.max(previa.fin, actual.fin);
        continue;
      }
    }
    unidas.push({ ...actual });
  }
  return unidas.map((l, i) => ({ ...l, id: i }));
}

// ---------- Tiempos ----------

/** Admite hh:mm:ss.mmm, mm:ss.mmm y hh:mm:ss,mmm. */
function tiempoReloj(t: string): number {
  const partes = t.trim().replace(',', '.').split(':');
  if (partes.length < 2 || partes.length > 3) return NaN;
  const segundos = parseFloat(partes.pop()!);
  const minutos = parseInt(partes.pop()!, 10);
  const horas = partes.length ? parseInt(partes.pop()!, 10) : 0;
  return Math.round((horas * 3600 + minutos * 60 + segundos) * 1000);
}

// ---------- WebVTT ----------

function quitarEtiquetasVtt(texto: string): string {
  return decodificarEntidades(
    texto
      .replace(/<rt>.*?<\/rt>/gs, '')
      .replace(/<rp>.*?<\/rp>/gs, '')
      .replace(/<[^>]+>/g, '')
  );
}

export function analizarVtt(texto: string): LineaCruda[] {
  const salida: LineaCruda[] = [];
  const bloques = texto.replace(/\r\n?/g, '\n').split(/\n{2,}/);
  for (const bloque of bloques) {
    const filas = bloque.split('\n');
    const i = filas.findIndex((f) => f.includes('-->'));
    if (i < 0) continue;
    const m = filas[i].match(/^\s*([\d:.,]+)\s*-->\s*([\d:.,]+)(.*)$/);
    if (!m) continue;
    const inicio = tiempoReloj(m[1]);
    const fin = tiempoReloj(m[2]);
    if (!Number.isFinite(inicio) || !Number.isFinite(fin)) continue;
    const posicion = m[3].match(/line:(-?\d+(?:\.\d+)?)(%?)/);
    const arriba = posicion
      ? posicion[2] === '%'
        ? parseFloat(posicion[1]) < 30
        : parseFloat(posicion[1]) >= 0 && parseFloat(posicion[1]) < 4
      : false;
    salida.push({ inicio, fin, texto: quitarEtiquetasVtt(filas.slice(i + 1).join('\n')), ...(arriba ? { arriba } : {}) });
  }
  return salida;
}

// ---------- SRT ----------

export function analizarSrt(texto: string): LineaCruda[] {
  const salida: LineaCruda[] = [];
  const bloques = texto.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split(/\n{2,}/);
  for (const bloque of bloques) {
    const filas = bloque.split('\n');
    const i = filas.findIndex((f) => f.includes('-->'));
    if (i < 0) continue;
    const [a, b] = filas[i].split('-->');
    const inicio = tiempoReloj(a);
    const fin = tiempoReloj(b.trim().split(/\s/)[0]);
    if (!Number.isFinite(inicio) || !Number.isFinite(fin)) continue;
    const crudo = filas.slice(i + 1).join('\n');
    const arriba = /\{\\an[789]\}/.test(crudo);
    const limpio = decodificarEntidades(crudo.replace(/\{\\[^}]*\}/g, '').replace(/<[^>]+>/g, ''));
    salida.push({ inicio, fin, texto: limpio, ...(arriba ? { arriba } : {}) });
  }
  return salida;
}

// ---------- ASS / SSA ----------

export function analizarAss(texto: string): LineaCruda[] {
  const salida: LineaCruda[] = [];
  let columnas: string[] = [];
  let enEventos = false;
  for (const fila of texto.replace(/^﻿/, '').split(/\r?\n/)) {
    const t = fila.trim();
    if (t.startsWith('[')) {
      enEventos = t.toLowerCase() === '[events]';
      continue;
    }
    if (!enEventos) continue;
    if (t.toLowerCase().startsWith('format:')) {
      columnas = t.slice(7).split(',').map((c) => c.trim().toLowerCase());
      continue;
    }
    if (!t.startsWith('Dialogue:') || !columnas.length) continue;
    const valores = t.slice(9).split(',');
    const pos = (n: string) => columnas.indexOf(n);
    const posTexto = pos('text');
    if (posTexto < 0) continue;
    const crudo = valores.slice(posTexto).join(',');
    const inicio = tiempoReloj(valores[pos('start')]);
    const fin = tiempoReloj(valores[pos('end')]);
    if (!Number.isFinite(inicio) || !Number.isFinite(fin)) continue;
    const arriba = /\\an[789]/.test(crudo);
    const limpio = crudo.replace(/\{[^}]*\}/g, '').replace(/\\[Nn]/g, '\n').replace(/\\h/g, ' ');
    salida.push({ inicio, fin, texto: limpio, ...(arriba ? { arriba } : {}) });
  }
  return salida;
}

// ---------- YouTube json3 ----------

interface EventoJson3 {
  tStartMs?: number;
  dDurationMs?: number;
  aAppend?: number;
  segs?: { utf8?: string }[];
}

export function analizarJson3(texto: string): LineaCruda[] {
  const datos = JSON.parse(texto) as { events?: EventoJson3[] };
  const salida: LineaCruda[] = [];
  for (const ev of datos.events ?? []) {
    if (!ev.segs) continue;
    const contenido = ev.segs.map((s) => s.utf8 ?? '').join('');
    if (!contenido.trim()) continue;
    const inicio = ev.tStartMs ?? 0;
    const fin = inicio + (ev.dDurationMs ?? 0);
    const previa = salida[salida.length - 1];
    if (ev.aAppend && previa) {
      previa.texto += contenido;
      previa.fin = Math.max(previa.fin, fin);
      continue;
    }
    salida.push({ inicio, fin, texto: contenido });
  }
  // Los subtítulos automáticos se solapan por diseño: cada línea termina donde empieza la siguiente.
  for (let i = 0; i + 1 < salida.length; i++) {
    if (salida[i + 1].inicio < salida[i].fin && salida[i + 1].inicio > salida[i].inicio) {
      salida[i].fin = salida[i + 1].inicio;
    }
  }
  return salida;
}

// ---------- XML mínimo para TTML y srv3 ----------

export interface NodoXml {
  nombre: string;
  attrs: Record<string, string>;
  hijos: (NodoXml | string)[];
}

/** Analizador de XML pequeño y tolerante; basta para TTML y no depende de DOMParser. */
export function analizarXml(texto: string): NodoXml {
  const raiz: NodoXml = { nombre: '#raiz', attrs: {}, hijos: [] };
  const pila: NodoXml[] = [raiz];
  const re = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<!DOCTYPE[^>]*>|<\/([^\s>]+)\s*>|<([^\s/>]+)((?:\s+[^\s=>/]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto))) {
    const actual = pila[pila.length - 1];
    if (m[1] !== undefined) {
      actual.hijos.push(m[1]);
    } else if (m[2]) {
      for (let i = pila.length - 1; i > 0; i--) {
        if (pila[i].nombre === m[2]) {
          pila.length = i;
          break;
        }
      }
    } else if (m[3]) {
      const attrs: Record<string, string> = {};
      const reAttr = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
      let a: RegExpExecArray | null;
      while ((a = reAttr.exec(m[4] ?? ''))) attrs[a[1]] = decodificarEntidades(a[2] ?? a[3] ?? '');
      const nodo: NodoXml = { nombre: m[3], attrs, hijos: [] };
      actual.hijos.push(nodo);
      if (!m[5]) pila.push(nodo);
    } else if (m[6] !== undefined) {
      actual.hijos.push(decodificarEntidades(m[6]));
    }
  }
  return raiz;
}

const sinPrefijo = (nombre: string) => nombre.slice(nombre.indexOf(':') + 1);

function* recorrer(nodo: NodoXml): Generator<NodoXml> {
  for (const h of nodo.hijos) {
    if (typeof h !== 'string') {
      yield h;
      yield* recorrer(h);
    }
  }
}

function attr(nodo: NodoXml, nombreSinPrefijo: string): string | undefined {
  for (const k of Object.keys(nodo.attrs)) if (sinPrefijo(k) === nombreSinPrefijo) return nodo.attrs[k];
  return undefined;
}

// ---------- TTML (Netflix y otros) ----------

function tiempoTtml(t: string | undefined, tickRate: number, frameRate: number): number {
  if (!t) return NaN;
  const v = t.trim();
  let m: RegExpMatchArray | null;
  if ((m = v.match(/^(\d+(?:\.\d+)?)t$/))) return Math.round((parseFloat(m[1]) / tickRate) * 1000);
  if ((m = v.match(/^(\d+(?:\.\d+)?)ms$/))) return Math.round(parseFloat(m[1]));
  if ((m = v.match(/^(\d+(?:\.\d+)?)s$/))) return Math.round(parseFloat(m[1]) * 1000);
  if ((m = v.match(/^(\d+(?:\.\d+)?)m$/))) return Math.round(parseFloat(m[1]) * 60000);
  if ((m = v.match(/^(\d+(?:\.\d+)?)h$/))) return Math.round(parseFloat(m[1]) * 3600000);
  if ((m = v.match(/^(\d+(?:\.\d+)?)f$/))) return Math.round((parseFloat(m[1]) / frameRate) * 1000);
  if ((m = v.match(/^(\d+):(\d{2}):(\d{2}):(\d+(?:\.\d+)?)$/))) {
    return Math.round((+m[1] * 3600 + +m[2] * 60 + +m[3] + parseFloat(m[4]) / frameRate) * 1000);
  }
  return tiempoReloj(v);
}

export function analizarTtml(texto: string): LineaCruda[] {
  const raiz = analizarXml(texto);
  const tt = [...recorrer(raiz)].find((n) => sinPrefijo(n.nombre) === 'tt');
  if (!tt) throw new Error(tr('TTML sin elemento <tt>'));

  const tickRate = parseFloat(attr(tt, 'tickRate') ?? '') || 10000000;
  const multiplicador = (attr(tt, 'frameRateMultiplier') ?? '1 1').split(/\s+/).map(Number);
  const frameRate =
    (parseFloat(attr(tt, 'frameRate') ?? '') || 30) * ((multiplicador[0] || 1) / (multiplicador[1] || 1));

  // Estilos con rubí: el texto de rubí de Netflix no debe mezclarse con la línea.
  const rubiPorEstilo = new Map<string, string>();
  const regiones = new Map<string, NodoXml>();
  for (const n of recorrer(tt)) {
    const nombre = sinPrefijo(n.nombre);
    const id = n.attrs['xml:id'] ?? n.attrs['id'];
    if (nombre === 'style' && id) {
      const rubi = attr(n, 'ruby');
      if (rubi) rubiPorEstilo.set(id, rubi);
    } else if (nombre === 'region' && id) {
      regiones.set(id, n);
    }
  }

  const esRegionSuperior = (id?: string): boolean => {
    const r = id ? regiones.get(id) : undefined;
    if (!r) return false;
    if (attr(r, 'displayAlign') === 'before') return true;
    const origen = attr(r, 'origin')?.match(/([\d.]+)%\s+([\d.]+)%/);
    return origen ? parseFloat(origen[2]) < 30 : false;
  };

  const rubiDe = (n: NodoXml): string | undefined => {
    const directo = attr(n, 'ruby');
    if (directo) return directo;
    for (const id of (n.attrs['style'] ?? '').split(/\s+/)) {
      const r = rubiPorEstilo.get(id);
      if (r) return r;
    }
    return undefined;
  };

  const extraer = (n: NodoXml): string => {
    let salida = '';
    for (const h of n.hijos) {
      if (typeof h === 'string') {
        salida += h.replace(/[\r\n\t]+/g, '');
        continue;
      }
      const nombre = sinPrefijo(h.nombre);
      if (nombre === 'br') {
        salida += '\n';
      } else if (nombre === 'span') {
        const r = rubiDe(h);
        if (r === 'text' || r === 'textContainer' || r === 'delimiter') continue;
        salida += extraer(h);
      } else {
        salida += extraer(h);
      }
    }
    return salida;
  };

  const salida: LineaCruda[] = [];
  for (const n of recorrer(tt)) {
    if (sinPrefijo(n.nombre) !== 'p') continue;
    const inicio = tiempoTtml(n.attrs['begin'], tickRate, frameRate);
    let fin = tiempoTtml(n.attrs['end'], tickRate, frameRate);
    if (!Number.isFinite(fin) && n.attrs['dur']) fin = inicio + tiempoTtml(n.attrs['dur'], tickRate, frameRate);
    if (!Number.isFinite(inicio) || !Number.isFinite(fin)) continue;
    const arriba = esRegionSuperior(n.attrs['region']);
    salida.push({ inicio, fin, texto: extraer(n), ...(arriba ? { arriba } : {}) });
  }
  return salida;
}

// ---------- YouTube srv3 ----------

export function analizarSrv3(texto: string): LineaCruda[] {
  const raiz = analizarXml(texto);
  const salida: LineaCruda[] = [];
  for (const n of recorrer(raiz)) {
    if (n.nombre !== 'p' || n.attrs['t'] === undefined) continue;
    const inicio = parseInt(n.attrs['t'], 10);
    const fin = inicio + parseInt(n.attrs['d'] ?? '0', 10);
    const contenido = (nodo: NodoXml): string =>
      nodo.hijos.map((h) => (typeof h === 'string' ? h : contenido(h))).join('');
    salida.push({ inicio, fin, texto: contenido(n) });
  }
  return salida;
}

// ---------- Exportar ----------

export function aSrt(lineas: Linea[]): string {
  const hora = (ms: number) => {
    const p = (n: number, c = 2) => String(n).padStart(c, '0');
    return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
  };
  return lineas.map((l, i) => `${i + 1}\n${hora(l.inicio)} --> ${hora(l.fin)}\n${l.texto}\n`).join('\n');
}

/** Búsqueda binaria de la línea activa. Devuelve -1 si no hay ninguna en ese instante. */
export function lineaEn(lineas: Linea[], ms: number): number {
  let bajo = 0;
  let alto = lineas.length - 1;
  while (bajo <= alto) {
    const medio = (bajo + alto) >> 1;
    const l = lineas[medio];
    if (ms < l.inicio) alto = medio - 1;
    else if (ms >= l.fin) bajo = medio + 1;
    else return medio;
  }
  return -1;
}

/** Un hueco menor que esto entre dos líneas no se llega a leer como pausa: se mantiene la primera. */
const PUENTE_MS = 800;
/** Tras la última línea de un diálogo, lo que tarda en irse: da tiempo a terminar de leerla. */
const COLA_MS = 240;

/**
 * La línea que conviene tener en pantalla. Los subtítulos suelen dejar unos milisegundos entre línea y
 * línea, y si en ese instante no se muestra nada, todo el bloque parpadea. Solo la lectura la usa: las
 * pausas y el navegador siguen los tiempos reales.
 */
export function lineaConPuente(lineas: Linea[], ms: number, puente = PUENTE_MS, cola = COLA_MS): number {
  const i = lineaEn(lineas, ms);
  if (i >= 0) return i;
  const sig = siguienteLinea(lineas, ms);
  const previa = sig < 0 ? lineas.length - 1 : sig - 1;
  if (previa < 0) return -1;
  const fin = lineas[previa].fin;
  if (ms < fin) return -1;
  if (sig >= 0 && lineas[sig].inicio - fin <= puente) return previa;
  return ms - fin <= cola ? previa : -1;
}

/** Índice de la primera línea que empieza en o después de ms. */
export function siguienteLinea(lineas: Linea[], ms: number): number {
  let bajo = 0;
  let alto = lineas.length;
  while (bajo < alto) {
    const medio = (bajo + alto) >> 1;
    if (lineas[medio].inicio < ms) bajo = medio + 1;
    else alto = medio;
  }
  return bajo < lineas.length ? bajo : -1;
}
