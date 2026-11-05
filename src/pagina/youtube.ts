// Adaptador de YouTube.
//
// YouTube solo sirve subtítulos a peticiones firmadas con el token del reproductor (pot), atado a
// cada video. Comprobado en vivo: sin él la respuesta es 200 con 0 bytes. No generamos tokens:
// leemos las URL firmadas que expone el propio reproductor o el token de sus peticiones.

import { type Adaptador, esperar, normalizarIdioma, sondear } from './adaptador';
import type { PistaInfo } from '../compartido/tipos';

interface JugadorYT extends HTMLElement {
  getPlayerResponse?(): { videoDetails?: { videoId?: string; title?: string }; captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: PistaYT[] } } };
  getAudioTrack?(): { captionTracks?: PistaYT[] };
  getVideoData?(): { video_id?: string; title?: string };
  loadModule?(m: string): void;
  setOption?(m: string, o: string, v: unknown): void;
  seekTo?(s: number, permitir: boolean): void;
  playVideo?(): void;
  pauseVideo?(): void;
}

interface PistaYT {
  languageCode: string;
  kind?: string;
  vssId?: string;
  baseUrl?: string;
  url?: string;
  name?: { simpleText?: string; runs?: { text: string }[] };
  displayName?: string;
  languageName?: string;
}

const jugador = () => document.querySelector<JugadorYT>('#movie_player');

const idDeUrl = (): string | null => {
  const v = new URLSearchParams(location.search).get('v');
  if (v) return v;
  return /\/(?:shorts|embed|live)\/([^/?#]+)/.exec(location.pathname)?.[1] ?? null;
};

const idPista = (p: PistaYT) => p.vssId || `${p.kind === 'asr' ? 'a.' : '.'}${p.languageCode}`;

// Token capturado de las propias peticiones del reproductor, por video, y respuestas ya recibidas.
const tokens = new Map<string, string>();
const respuestas = new Map<string, string>();

function anotarPeticion(url: string, texto?: string) {
  try {
    const u = new URL(url, location.href);
    if (!u.pathname.includes('/api/timedtext')) return;
    const v = u.searchParams.get('v');
    const pot = u.searchParams.get('pot');
    if (v && pot) tokens.set(v, pot);
    if (v && texto) respuestas.set(`${v}|${u.searchParams.get('lang')}|${u.searchParams.get('kind') ?? ''}`, texto);
  } catch {
    // URL no válida: no es asunto nuestro.
  }
}

/** Observa las peticiones de subtítulos del reproductor. Nunca altera la petición. */
export function instalarEscuchaYouTube(): void {
  const originalFetch = window.fetch;
  window.fetch = function (this: unknown, ...args: Parameters<typeof fetch>) {
    const url = typeof args[0] === 'string' ? args[0] : args[0] instanceof Request ? args[0].url : String(args[0]);
    const promesa = originalFetch.apply(this as typeof globalThis, args);
    if (url.includes('/api/timedtext')) {
      anotarPeticion(url);
      promesa
        .then((r) => r.clone().text())
        .then((t) => anotarPeticion(url, t))
        .catch(() => {});
    }
    return promesa;
  } as typeof fetch;

  const abrir = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, m: string, url: string | URL, ...resto: unknown[]) {
    const u = String(url);
    if (u.includes('/api/timedtext')) {
      anotarPeticion(u);
      this.addEventListener('load', () => {
        try {
          if (this.responseType === '' || this.responseType === 'text') anotarPeticion(u, this.responseText);
        } catch {
          // Respuesta binaria: se ignora.
        }
      });
    }
    return (abrir as (...a: unknown[]) => void).call(this, m, url, ...resto);
  } as typeof XMLHttpRequest.prototype.open;
}

const hayAnuncio = () => !!jugador()?.classList.contains('ad-showing');

async function esperarVideoReal(): Promise<JugadorYT | null> {
  const id = idDeUrl();
  return sondear(() => {
    const p = jugador();
    if (!p?.getPlayerResponse || hayAnuncio()) return null;
    const respuesta = p.getPlayerResponse();
    return respuesta?.videoDetails?.videoId === id ? p : null;
  }, 90000, 300);
}

const pistasDeRespuesta = (p: JugadorYT) => p.getPlayerResponse?.()?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];

const tienePot = (t: PistaYT) => {
  try {
    return !!t.url && new URL(t.url, location.href).searchParams.has('pot');
  } catch {
    return false;
  }
};

function prepararUrl(cruda: string, pot?: string | null): string {
  const u = new URL(cruda, location.href);
  u.searchParams.set('fmt', 'json3');
  if (!u.searchParams.get('c')) u.searchParams.set('c', 'WEB');
  if (pot && !u.searchParams.has('pot')) u.searchParams.set('pot', pot);
  return u.toString();
}

async function descargar(url: string): Promise<string> {
  const r = await fetch(url, { cache: 'no-store', credentials: 'include' });
  return r.ok ? r.text() : '';
}

export const adaptadorYouTube: Adaptador = {
  nombre: 'youtube',
  cssOcultarNativos: '.ytp-caption-window-container, .caption-window, .ytp-caption-segment { display: none !important; }',

  activo: () => idDeUrl() !== null,
  idVideo: idDeUrl,
  titulo: () => jugador()?.getVideoData?.()?.title || document.title.replace(/ - YouTube$/, ''),
  anuncio: hayAnuncio,

  async listarPistas(): Promise<PistaInfo[]> {
    const p = await esperarVideoReal();
    if (!p) return [];
    return pistasDeRespuesta(p).map((t) => ({
      id: idPista(t),
      idioma: normalizarIdioma(t.languageCode),
      nombre: t.name?.simpleText ?? t.name?.runs?.[0]?.text ?? t.displayName ?? t.languageName ?? t.languageCode,
      automatica: t.kind === 'asr',
      origen: 'sitio',
    }));
  },

  async cargarPista(id: string): Promise<string> {
    const p = await esperarVideoReal();
    if (!p) throw new Error('El reproductor de YouTube no está listo');
    const v = idDeUrl()!;
    const pista = pistasDeRespuesta(p).find((t) => idPista(t) === id);
    if (!pista?.baseUrl) throw new Error('Pista no encontrada');
    const claveRespuesta = `${v}|${pista.languageCode}|${pista.kind ?? ''}`;

    // La lista interna del reproductor trae URL firmadas cuando su generador de tokens está listo.
    const firmada = () => p.getAudioTrack?.()?.captionTracks?.find((t) => idPista(t) === id && tienePot(t));
    await sondear(firmada, 2000);

    let pistaActivada = false;
    const activarPista = () => {
      // Activarla (oculta por CSS) hace que el reproductor firme y pida la pista él mismo.
      try {
        p.loadModule?.('captions');
        if (!pistaActivada) p.setOption?.('captions', 'track', { languageCode: pista.languageCode, kind: pista.kind ?? '' });
        else p.setOption?.('captions', 'reload', true); // El token llegó tarde: hay que pedir que recargue.
        pistaActivada = true;
      } catch {
        // El módulo de subtítulos todavía no acepta órdenes; se reintenta en la siguiente vuelta.
      }
    };

    // Recién terminado el anuncio, las URL firmadas pueden responder vacío unos segundos.
    for (let intento = 0; intento < 14; intento++) {
      const crudo = respuestas.get(claveRespuesta);
      if (crudo?.trim()) return crudo;

      const candidatas = [
        firmada()?.url ? prepararUrl(firmada()!.url!) : null,
        tokens.has(v) ? prepararUrl(pista.baseUrl, tokens.get(v)) : null,
      ].filter((u): u is string => !!u);
      for (const url of candidatas) {
        const texto = await descargar(url);
        if (texto.trim()) return texto;
      }

      activarPista();
      await esperar(intento < 4 ? 1500 : 3000);
    }
    throw new Error('YouTube devolvió subtítulos vacíos. Reproduce el video unos segundos y vuelve a intentarlo.');
  },

  saltar(ms) {
    jugador()?.seekTo?.(ms / 1000 + 0.001, true);
  },
  reproducir() {
    jugador()?.playVideo?.();
  },
  pausar() {
    jugador()?.pauseVideo?.();
  },

  prepararPanel(ancho) {
    const ID = 'kotonoha-panel-youtube';
    document.getElementById(ID)?.remove();
    if (ancho > 0) {
      // Modo cine: el reproductor ocupa todo el ancho y se le puede recortar por la derecha.
      const watch = document.querySelector('ytd-watch-flexy');
      if (watch && !watch.hasAttribute('theater')) document.querySelector<HTMLElement>('.ytp-size-button')?.click();
      const s = document.createElement('style');
      s.id = ID;
      s.textContent = `
        ytd-watch-flexy #full-bleed-container, ytd-watch-flexy #player-full-bleed-container {
          width: calc(100vw - ${ancho}px) !important; max-width: calc(100vw - ${ancho}px) !important;
        }
        ytd-watch-flexy #columns { margin-right: ${ancho}px !important; }
      `;
      document.head.appendChild(s);
    }
    window.dispatchEvent(new Event('resize'));
  },
};
