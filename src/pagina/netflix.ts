// Adaptador de Netflix.
//
// La lista de pistas viene de la API interna del reproductor. Las URL se encuentran recorriendo su
// estado, buscando objetos por su forma (type === 'timedtext' con urls), sin depender de nombres
// minificados. Si una pista aún no tiene URL se activa un momento para que Netflix la pida.

import { type Adaptador, esperar, normalizarIdioma, sondear } from './adaptador';
import { pistasDetectadas } from './generico';
import type { PistaInfo } from '../compartido/tipos';

declare const netflix: {
  appContext?: { state?: { playerApp?: { getAPI?(): ApiNetflix; getState?(): { videoPlayer?: { cadmiumPlayerRepository?: { playersById?: Record<string, unknown> } } } } } };
  player?: { MediaSession?: unknown };
} | undefined;

interface ApiNetflix {
  videoPlayer?: {
    getAllPlayerSessionIds?(): string[];
    getVideoPlayerBySessionId?(id: string): JugadorNetflix | undefined;
  };
  getVideoMetadataByVideoId?(id: number): { getCurrentVideo?(): { getTitle?(): string } } | undefined;
}

interface PistaNetflix {
  trackId: string;
  displayName?: string;
  bcp47?: string;
  rawTrackType?: string;
  trackType?: string;
  isNoneTrack?: boolean;
  isForcedNarrative?: boolean;
  isImageBased?: boolean;
}

interface JugadorNetflix {
  getTimedTextTrackList?(): PistaNetflix[];
  getTimedTextTrack?(): PistaNetflix;
  setTimedTextTrack?(p: PistaNetflix): Promise<void> | void;
  seek?(ms: number): void;
  play?(): void;
  pause?(): void;
  getMovieId?(): number;
}

const api = () => (typeof netflix === 'undefined' ? undefined : netflix?.appContext?.state?.playerApp?.getAPI?.());

function idSesion(): string | undefined {
  const ids = api()?.videoPlayer?.getAllPlayerSessionIds?.() ?? [];
  return ids.find((i) => i.startsWith('watch')) ?? ids[ids.length - 1];
}

function jugador(): JugadorNetflix | undefined {
  const id = idSesion();
  return id ? api()?.videoPlayer?.getVideoPlayerBySessionId?.(id) : undefined;
}

function urlsTexto(): Map<string, string> {
  const urls = new Map<string, string>();
  const id = idSesion();
  const raiz = id
    ? typeof netflix !== 'undefined'
      ? netflix?.appContext?.state?.playerApp?.getState?.()?.videoPlayer?.cadmiumPlayerRepository?.playersById?.[id]
      : undefined
    : undefined;
  if (!raiz) return urls;

  const vistos = new WeakSet<object>();
  const pila: { n: unknown; d: number }[] = [{ n: raiz, d: 0 }];
  while (pila.length) {
    const { n, d } = pila.pop()!;
    if (n === null || typeof n !== 'object' || d > 20 || vistos.has(n)) continue;
    vistos.add(n);
    if (n instanceof ArrayBuffer || ArrayBuffer.isView(n)) continue;
    const o = n as Record<string, unknown>;
    try {
      if (o.type === 'timedtext' && typeof o.trackId === 'string' && Array.isArray(o.urls) && o.urls.length) {
        const u = (o.urls[0] as { url?: unknown }).url;
        if (typeof u === 'string' && !urls.has(o.trackId)) urls.set(o.trackId, u);
      }
    } catch {
      // Propiedad con getter que lanza: se ignora.
    }
    const hijos = Array.isArray(n) ? n : Object.keys(o).map((k) => {
      try {
        return o[k];
      } catch {
        return null;
      }
    });
    for (const h of hijos) if (h && typeof h === 'object') pila.push({ n: h, d: d + 1 });
  }
  return urls;
}

/** Respaldo: el reproductor guarda el TTML en memoria tras cargar una pista. */
function ttmlEnMemoria(bcp47: string): string | null {
  const raiz = typeof netflix === 'undefined' ? undefined : netflix?.player?.MediaSession;
  if (!raiz) return null;
  const vistos = new WeakSet<object>();
  const cola: object[] = [raiz as object];
  const objetivo = bcp47.toLowerCase();
  const base = objetivo.split('-')[0];
  let visitados = 0;
  let mejor: string | null = null;
  while (cola.length && visitados < 60000) {
    const o = cola.shift()!;
    visitados++;
    let claves: string[];
    try {
      claves = Object.getOwnPropertyNames(o);
    } catch {
      continue;
    }
    for (const k of claves) {
      let v: unknown;
      try {
        v = (o as Record<string, unknown>)[k];
      } catch {
        continue;
      }
      if (typeof v === 'string') {
        if (v.length > 5000 && v.includes('<tt') && v.includes('ttml')) {
          const lang = /xml:lang="([^"]+)"/.exec(v)?.[1]?.toLowerCase() ?? '';
          if (lang === objetivo) return v;
          if (lang.startsWith(base)) mejor = v;
        }
      } else if (v && typeof v === 'object' && !(v instanceof Element) && v !== window && v !== document && !vistos.has(v)) {
        vistos.add(v);
        cola.push(v);
      }
    }
  }
  return mejor;
}

const esPistaTexto = (p: PistaNetflix) => !!p.bcp47 && !p.isNoneTrack && !p.isForcedNarrative && !p.isImageBased;

let cola: Promise<unknown> = Promise.resolve();

export const adaptadorNetflix: Adaptador = {
  nombre: 'netflix',
  cssOcultarNativos: '.player-timedtext, .player-timedtext-text-container { display: none !important; }',

  activo: () => /\/watch\/\d+/.test(location.pathname),
  idVideo: () => /\/watch\/(\d+)/.exec(location.pathname)?.[1] ?? null,
  titulo() {
    const id = jugador()?.getMovieId?.();
    const t = id !== undefined ? api()?.getVideoMetadataByVideoId?.(id)?.getCurrentVideo?.()?.getTitle?.() : undefined;
    return t ?? document.title.replace(/ - Netflix$/, '');
  },
  anuncio: () => !!document.querySelector('.watch-video--modular-ads-container'),

  async listarPistas(): Promise<PistaInfo[]> {
    const p = await sondear(() => {
      const j = jugador();
      return j?.getTimedTextTrackList?.()?.length ? j : null;
    }, 45000, 500);
    const propias: PistaInfo[] = (p?.getTimedTextTrackList?.() ?? []).filter(esPistaTexto).map((t) => {
      const cc = t.rawTrackType?.toUpperCase() === 'CLOSEDCAPTIONS' || t.trackType === 'CLOSEDCAPTIONS';
      return {
        id: t.trackId,
        idioma: normalizarIdioma(t.bcp47),
        nombre: `${t.displayName ?? t.bcp47}${cc ? ' [CC]' : ''}`,
        cc,
        origen: 'sitio' as const,
      };
    });
    return propias.length ? propias : pistasDetectadas();
  },

  cargarPista(id: string): Promise<string> {
    // Cambiar de pista es global al reproductor: las descargas van de una en una.
    const tarea = cola.then(async () => {
      const p = jugador();
      const pista = p?.getTimedTextTrackList?.()?.find((t) => t.trackId === id);
      if (!p || !pista) throw new Error('Pista de Netflix no encontrada');

      let url = urlsTexto().get(id);
      const previa = p.getTimedTextTrack?.();
      let cambiada = false;
      try {
        if (!url) {
          await p.setTimedTextTrack?.(pista);
          cambiada = true;
          url = (await sondear(() => urlsTexto().get(id), 8000, 150)) ?? undefined;
        }
        if (url) {
          const r = await fetch(url);
          if (r.ok) {
            const texto = await r.text();
            if (texto.trim()) return texto;
          }
        }
        const enMemoria = await sondear(() => ttmlEnMemoria(pista.bcp47 ?? ''), 4000, 400);
        if (enMemoria) return enMemoria;
      } finally {
        if (cambiada && previa) {
          await esperar(50);
          try {
            await p.setTimedTextTrack?.(previa);
          } catch {
            // Si no se puede restaurar no es grave: los subtítulos nativos van ocultos.
          }
        }
      }
      throw new Error('No se pudieron obtener los subtítulos de Netflix');
    });
    cola = tarea.catch(() => {});
    return tarea;
  },

  // Netflix no admite cambiar video.currentTime: hay que pasar por su reproductor.
  saltar(ms) {
    jugador()?.seek?.(Math.max(0, Math.round(ms)));
  },
  reproducir() {
    jugador()?.play?.();
  },
  pausar() {
    jugador()?.pause?.();
  },

  prepararPanel(ancho) {
    const ID = 'kotonoha-panel-netflix';
    document.getElementById(ID)?.remove();
    if (ancho > 0) {
      const s = document.createElement('style');
      s.id = ID;
      s.textContent = `.watch-video--player-view, .watch-video, [data-uia="player"] { width: calc(100vw - ${ancho}px) !important; max-width: calc(100vw - ${ancho}px) !important; }`;
      document.head.appendChild(s);
    }
    window.dispatchEvent(new Event('resize'));
  },
};
