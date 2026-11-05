// Detección genérica: observa las peticiones de la página y reconoce subtítulos sin reglas por sitio.
// Cubre archivos sueltos, listas HLS y DASH, y respuestas JSON con enlaces a subtítulos.
// Con esto funcionan sitios como Disney+, Crunchyroll, Viki o Bilibili, y cualquier reproductor web.

import { type Adaptador, normalizarIdioma, videoPrincipal } from './adaptador';
import type { PistaInfo } from '../compartido/tipos';

interface Detectada extends PistaInfo {
  url?: string;
  segmentos?: boolean;
  texto?: string;
}

const detectadas = new Map<string, Detectada>();

const RE_ARCHIVO = /\.(vtt|webvtt|srt|ass|ssa|ttml|dfxp|xml)(\?|#|$)/i;
const RE_POSIBLE_JSON = /(subtitle|caption|play|player|dash|manifest|stream|videos?\/)/i;

function idiomaDeUrl(url: string): string {
  try {
    const u = new URL(url, location.href);
    for (const p of ['lang', 'language', 'locale', 'lan', 'hl', 'tl']) {
      const v = u.searchParams.get(p);
      if (v) return normalizarIdioma(v);
    }
    const m = /[/_.\-](ja|jpn|jp|es|spa|en|eng|ko|zh|fr|de|pt|it)(?:[-_][a-z]{2,4})?[/_.\-]/i.exec(u.pathname);
    if (m) return { jpn: 'ja', jp: 'ja', spa: 'es', eng: 'en' }[m[1].toLowerCase()] ?? m[1].toLowerCase();
  } catch {
    // URL relativa o no válida.
  }
  return 'und';
}

function anotar(url: string, datos: { idioma?: string; nombre?: string; segmentos?: boolean; texto?: string } = {}) {
  const absoluta = new URL(url, location.href).toString();
  const id = absoluta.split('?')[0];
  if (detectadas.has(id)) return;
  const idioma = normalizarIdioma(datos.idioma) || idiomaDeUrl(absoluta);
  detectadas.set(id, {
    id,
    idioma,
    nombre: datos.nombre || `${idioma} (detectado)`,
    origen: 'sitio',
    url: absoluta,
    segmentos: datos.segmentos,
    texto: datos.texto,
  });
}

/** Lista maestra HLS: #EXT-X-MEDIA:TYPE=SUBTITLES,...,LANGUAGE="ja",NAME="日本語",URI="sub.m3u8" */
export function leerHls(texto: string, base: string): { url: string; idioma: string; nombre: string }[] {
  const salida: { url: string; idioma: string; nombre: string }[] = [];
  for (const fila of texto.split(/\r?\n/)) {
    if (!fila.startsWith('#EXT-X-MEDIA') || !/TYPE=SUBTITLES/.test(fila)) continue;
    const dato = (k: string) => new RegExp(`${k}="([^"]*)"`).exec(fila)?.[1];
    const uri = dato('URI');
    if (uri) salida.push({ url: new URL(uri, base).toString(), idioma: dato('LANGUAGE') ?? 'und', nombre: dato('NAME') ?? '' });
  }
  return salida;
}

/** Manifiesto DASH: AdaptationSet de texto con BaseURL directa. */
export function leerDash(texto: string, base: string): { url: string; idioma: string; nombre: string }[] {
  const salida: { url: string; idioma: string; nombre: string }[] = [];
  for (const m of texto.matchAll(/<AdaptationSet\b([^>]*)>([\s\S]*?)<\/AdaptationSet>/g)) {
    const attrs = m[1];
    if (!/contentType="text"|mimeType="(text\/vtt|application\/ttml\+xml)"/.test(attrs + m[2])) continue;
    const idioma = /lang="([^"]+)"/.exec(attrs)?.[1] ?? 'und';
    const baseUrl = /<BaseURL>([^<]+)<\/BaseURL>/.exec(m[2])?.[1];
    if (baseUrl) salida.push({ url: new URL(baseUrl, base).toString(), idioma, nombre: idioma });
  }
  return salida;
}

/** Busca en un JSON objetos con forma de pista: enlace a un archivo y, cerca, un idioma. */
export function olfatearJson(raiz: unknown): { url: string; idioma?: string; nombre?: string }[] {
  const salida: { url: string; idioma?: string; nombre?: string }[] = [];
  const vistos = new WeakSet<object>();
  const visitar = (n: unknown, claveMadre: string, profundidad: number) => {
    if (!n || typeof n !== 'object' || profundidad > 12 || vistos.has(n)) return;
    vistos.add(n);
    const o = n as Record<string, unknown>;
    let enlace: string | undefined;
    let idioma: string | undefined;
    let nombre: string | undefined;
    for (const [k, v] of Object.entries(o)) {
      if (typeof v !== 'string') continue;
      const kl = k.toLowerCase();
      if (/^(url|src|href|uri|subtitle_url|subtitleurl|file|path)$/.test(kl) && (RE_ARCHIVO.test(v) || /subtitle|caption/i.test(k + v))) enlace = v;
      if (/^(lang|language|lan|locale|srclang|languagecode|language_code|code)$/.test(kl)) idioma = v;
      if (/^(label|name|title|lan_doc|displayname|display_name)$/.test(kl)) nombre = v;
    }
    if (enlace && /^(https?:)?\/\//.test(enlace)) {
      // Crunchyroll y otros usan el idioma como clave: { "ja-JP": { url: ... } }
      if (!idioma && /^[a-z]{2}(-[a-zA-Z]{2,4})?$/.test(claveMadre)) idioma = claveMadre;
      salida.push({ url: enlace.startsWith('//') ? `https:${enlace}` : enlace, idioma, nombre });
    }
    for (const [k, v] of Object.entries(o)) visitar(v, k, profundidad + 1);
  };
  visitar(raiz, '', 0);
  return salida;
}

function revisarRespuesta(url: string, tipo: string, obtener: () => Promise<string>) {
  const absoluta = (() => {
    try {
      return new URL(url, location.href).toString();
    } catch {
      return url;
    }
  })();
  const camino = absoluta.split('?')[0];
  if (RE_ARCHIVO.test(camino) && !/\.xml$/i.test(camino)) {
    anotar(absoluta);
    return;
  }
  if (/text\/vtt|ttml|application\/x-subrip/i.test(tipo)) {
    anotar(absoluta);
    return;
  }
  if (/\.m3u8/i.test(camino) || /mpegurl/i.test(tipo)) {
    obtener().then((t) => {
      for (const p of leerHls(t, absoluta)) anotar(p.url, { idioma: p.idioma, nombre: p.nombre, segmentos: true });
    }).catch(() => {});
    return;
  }
  if (/\.mpd/i.test(camino) || /dash\+xml/i.test(tipo)) {
    obtener().then((t) => {
      for (const p of leerDash(t, absoluta)) anotar(p.url, { idioma: p.idioma, nombre: p.nombre });
    }).catch(() => {});
    return;
  }
  if (/json/i.test(tipo) && RE_POSIBLE_JSON.test(camino)) {
    obtener().then((t) => {
      if (t.length > 8_000_000 || !/subtitle|caption|\.vtt|\.ass|\.srt/i.test(t)) return;
      for (const p of olfatearJson(JSON.parse(t))) anotar(p.url, { idioma: p.idioma, nombre: p.nombre });
    }).catch(() => {});
  }
}

let instalada = false;

export function instalarEscucha(): void {
  if (instalada) return;
  instalada = true;

  const originalFetch = window.fetch;
  window.fetch = function (this: unknown, ...args: Parameters<typeof fetch>) {
    const promesa = originalFetch.apply(this as typeof globalThis, args);
    promesa.then((r) => {
      revisarRespuesta(r.url, r.headers.get('content-type') ?? '', () => r.clone().text());
    }).catch(() => {});
    return promesa;
  } as typeof fetch;

  const abrir = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, m: string, url: string | URL, ...resto: unknown[]) {
    this.addEventListener('load', () => {
      try {
        if (this.responseType === '' || this.responseType === 'text') {
          revisarRespuesta(this.responseURL || String(url), this.getResponseHeader('content-type') ?? '', async () => this.responseText);
        } else if (this.responseType === 'json') {
          revisarRespuesta(this.responseURL || String(url), 'application/json', async () => JSON.stringify(this.response));
        }
      } catch {
        // Respuesta no legible: se ignora.
      }
    });
    return (abrir as (...a: unknown[]) => void).call(this, m, url, ...resto);
  } as typeof XMLHttpRequest.prototype.open;
}

function pistasDeElemento(): Detectada[] {
  const v = videoPrincipal();
  if (!v) return [];
  return [...v.querySelectorAll('track')]
    .filter((t) => t.src && (t.kind === 'subtitles' || t.kind === 'captions' || !t.kind))
    .map((t) => ({
      id: t.src.split('?')[0],
      idioma: normalizarIdioma(t.srclang) || 'und',
      nombre: t.label || t.srclang || 'Pista',
      origen: 'sitio' as const,
      url: t.src,
    }));
}

export function pistasDetectadas(): PistaInfo[] {
  const todas = new Map<string, Detectada>();
  for (const p of [...pistasDeElemento(), ...detectadas.values()]) if (!todas.has(p.id)) todas.set(p.id, p);
  return [...todas.values()].map(({ id, idioma, nombre, origen }) => ({ id, idioma, nombre, origen }));
}

async function descargarSegmentado(url: string): Promise<string> {
  const lista = await (await fetch(url, { credentials: 'include' })).text();
  if (!lista.startsWith('#EXTM3U')) return lista;
  const partes = lista.split(/\r?\n/).filter((f) => f && !f.startsWith('#')).map((f) => new URL(f, url).toString());
  const textos: string[] = [];
  // Unos pocos a la vez, para no saturar el sitio.
  for (let i = 0; i < partes.length; i += 6) {
    const lote = await Promise.all(partes.slice(i, i + 6).map(async (p) => (await fetch(p, { credentials: 'include' })).text()));
    textos.push(...lote);
  }
  return ['WEBVTT\n', ...textos.map((t) => t.replace(/^WEBVTT[^\n]*\n/, '').replace(/^X-TIMESTAMP-MAP[^\n]*\n/m, ''))].join('\n');
}

/** Bilibili entrega sus subtítulos en un JSON propio. */
function convertirSiBilibili(texto: string): string {
  if (!texto.trimStart().startsWith('{') || !texto.includes('"body"')) return texto;
  try {
    const d = JSON.parse(texto) as { body?: { from: number; to: number; content: string }[] };
    if (!d.body) return texto;
    const h = (s: number) => new Date(s * 1000).toISOString().slice(11, 23);
    return 'WEBVTT\n\n' + d.body.map((l) => `${h(l.from)} --> ${h(l.to)}\n${l.content}`).join('\n\n');
  } catch {
    return texto;
  }
}

export const adaptadorGenerico: Adaptador = {
  nombre: 'generico',
  activo: () => videoPrincipal() !== null,
  idVideo: () => location.pathname + location.search,
  titulo: () => document.title,
  anuncio: () => false,
  async listarPistas() {
    return pistasDetectadas();
  },
  async cargarPista(id: string) {
    const p = detectadas.get(id) ?? pistasDeElemento().find((t) => t.id === id);
    if (!p?.url) throw new Error('Pista no encontrada');
    if (p.texto) return p.texto;
    return convertirSiBilibili(await descargarSegmentado(p.url));
  },
  saltar(ms) {
    const v = videoPrincipal();
    if (v) v.currentTime = ms / 1000;
  },
  async reproducir() {
    await videoPrincipal()?.play();
  },
  pausar() {
    videoPrincipal()?.pause();
  },
};
