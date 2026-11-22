// Bilibili: los subtítulos del autor y los de su IA (ai-zh), que da la API de su reproductor, y solo con la sesión
// iniciada. Qué video suena lo dice el propio reproductor (window.player.getManifest()), también tras cambiar de parte o
// de episodio sin recargar la página. Los subtítulos están en su CDN, que responde a cualquiera
// (Access-Control-Allow-Origin: *): se piden sin cookies, porque con ellas el navegador rechaza la respuesta.

import { tm } from '../compartido/i18n';
import type { PistaInfo } from '../compartido/tipos';
import { coincide, esZonaDeMusica, idDeVideo, idiomaDeBilibili, tituloDePagina, type VideoBilibili, videoDeUrl, vttDeBilibili } from '../nucleo/bilibili';
import { type Adaptador, sondear, videoPrincipal } from './adaptador';

/** Lo que el reproductor de Bilibili dice del video en curso. */
interface Manifiesto extends VideoBilibili {
  aid: number;
  cid: number;
  seasonId?: number | null;
}

/** Lo que se usa del reproductor de Bilibili (window.player). */
interface ReproductorBilibili {
  getManifest?(): Manifiesto | null;
  seek?(segundos: number): unknown;
  play?(): unknown;
  pause?(): unknown;
}

interface SubtituloApi {
  id?: number;
  id_str?: string;
  lan: string;
  lan_doc?: string;
  subtitle_url?: string;
}

interface RespuestaReproductor {
  code: number;
  message?: string;
  data?: { need_login_subtitle?: boolean; subtitle?: { subtitles?: SubtituloApi[] } };
}

/** El fetch de la página, tomado antes de que nadie lo envuelva: este script corre antes que los del sitio. */
const pedir = window.fetch.bind(window);

const reproductor = () => (window as unknown as { player?: ReproductorBilibili }).player;

/** El video en curso según el reproductor; si aún no lo dice, según el estado de la página. */
function manifiesto(): Manifiesto | null {
  try {
    const m = reproductor()?.getManifest?.();
    if (m?.aid && m.cid) return m;
  } catch {
    // El reproductor aún no está listo.
  }
  const s = (window as unknown as { __INITIAL_STATE__?: { aid?: number; bvid?: string; cid?: number; p?: number } }).__INITIAL_STATE__;
  return s?.aid && s.cid ? { aid: s.aid, cid: s.cid, bvid: s.bvid, p: s.p } : null;
}

/** El video en curso, cuando el reproductor ya está en el de la dirección: tras cambiar de parte tarda un poco. */
async function videoEnCurso(): Promise<Manifiesto | null> {
  const url = videoDeUrl(location.href);
  const listo = await sondear(() => {
    const m = manifiesto();
    return m && coincide(m, url) ? m : null;
  }, 8000);
  return listo ?? manifiesto();
}

async function json<T>(url: string): Promise<T> {
  const r = await pedir(url, { credentials: 'include' });
  if (!r.ok) throw new Error(`Bilibili ${r.status}`);
  return (await r.json()) as T;
}

/** Dónde está cada pista, por su identificador. */
const urlsPistas = new Map<string, string>();
/** Lo que se sabe de cada video aparte de sus pistas: su título original, su zona y su portada. */
const datos = new Map<string, { titulo?: string; zona?: number; portada?: string }>();

/**
 * El título original del video, su zona y su portada, una vez por video. La página puede estar traducida (bilibili.com/es),
 * y su título con ella; la API da el de su autor.
 */
async function cargarDatos(m: Manifiesto, id: string): Promise<void> {
  if (datos.has(id)) return;
  datos.set(id, {});
  try {
    if (m.episodeId) {
      type Temporada = { result?: { title?: string; cover?: string; episodes?: { ep_id?: number; id?: number; title?: string; long_title?: string; cover?: string }[] } };
      const d = await json<Temporada>(`https://api.bilibili.com/pgc/view/web/season?ep_id=${m.episodeId}`);
      const ep = d.result?.episodes?.find((e) => String(e.ep_id ?? e.id) === String(m.episodeId));
      const numero = ep?.title && /^\d+$/.test(ep.title) ? `第${ep.title}话` : ep?.title;
      const titulo = [d.result?.title, numero, ep?.long_title].filter(Boolean).join(' ');
      datos.set(id, { titulo: titulo || undefined, portada: ep?.cover ?? d.result?.cover });
    } else if (m.bvid) {
      type Vista = { data?: { title?: string; tid?: number; pic?: string; pages?: { page: number; part: string }[] } };
      const v = (await json<Vista>(`https://api.bilibili.com/x/web-interface/view?bvid=${m.bvid}`)).data;
      // De un video con varias partes, también la parte.
      const parte = v?.pages && v.pages.length > 1 ? v.pages.find((x) => x.page === (m.p ?? 1))?.part : undefined;
      datos.set(id, { titulo: v?.title && parte ? `${v.title} · P${m.p ?? 1} ${parte}` : v?.title, zona: v?.tid, portada: v?.pic });
    }
  } catch {
    // Sin la API se queda el título de la página.
  }
}

/** El nombre del video de la dirección; si no se saca de ella (una lista, una página especial), el del reproductor. */
const idActual = () => idDeVideo(videoDeUrl(location.href) ?? manifiesto() ?? {});

export const adaptadorBilibili: Adaptador = {
  nombre: 'bilibili',
  cssOcultarNativos: '.bpx-player-subtitle-wrap { display: none !important; }',
  activo: () => videoPrincipal() !== null && manifiesto() !== null,
  idVideo: idActual,
  titulo() {
    const id = idActual();
    return (id && datos.get(id)?.titulo) || tituloDePagina(document.title);
  },
  categoria() {
    const id = idActual();
    return id && esZonaDeMusica(datos.get(id)?.zona) ? 'Music' : '';
  },
  anuncio: () => false,
  async listarPistas(): Promise<PistaInfo[]> {
    const m = await videoEnCurso();
    if (!m) return [];
    // El título y la zona, a la vez: al acabar la lista, Kotonoha vuelve a preguntar por ellos.
    const id = idDeVideo(m);
    const datosListos = id ? cargarDatos(m, id) : Promise.resolve();
    const q = new URLSearchParams({ aid: String(m.aid), cid: String(m.cid) });
    if (m.episodeId) q.set('ep_id', String(m.episodeId));
    if (m.seasonId) q.set('season_id', String(m.seasonId));
    // La que usa el reproductor; la anterior, por si cambia.
    let d = await json<RespuestaReproductor>(`https://api.bilibili.com/x/player/wbi/v2?${q}`).catch(() => null);
    if (!d || d.code !== 0) d = await json<RespuestaReproductor>(`https://api.bilibili.com/x/player/v2?${q}`);
    if (d.code !== 0) throw new Error(`Bilibili: ${d.message ?? d.code}`);
    const lista = (d.data?.subtitle?.subtitles ?? []).filter((s) => s.subtitle_url);
    await datosListos;
    if (!lista.length && d.data?.need_login_subtitle) {
      throw new Error(tm('Bilibili solo da sus subtítulos con la sesión iniciada. Inicia sesión en Bilibili y recarga la página, o crea los subtítulos con Whisper.'));
    }
    return lista.map((s) => {
      const { idioma, automatica } = idiomaDeBilibili(s.lan);
      const pista = `bilibili:${s.id_str ?? s.id ?? s.lan}`;
      urlsPistas.set(pista, s.subtitle_url!.startsWith('//') ? `https:${s.subtitle_url}` : s.subtitle_url!);
      return { id: pista, idioma, nombre: s.lan_doc || s.lan, origen: 'sitio' as const, ...(automatica ? { automatica: true } : {}) };
    });
  },
  async cargarPista(id: string) {
    const url = urlsPistas.get(id);
    if (!url) throw new Error('Pista no encontrada');
    const r = await pedir(url, { credentials: 'omit' });
    if (!r.ok) throw new Error(`Bilibili ${r.status}`);
    return vttDeBilibili(await r.text());
  },
  // Con el reproductor de Bilibili, si lo hay: así su barra y sus comentarios siguen al video.
  saltar(ms) {
    try {
      const p = reproductor();
      if (p?.seek) return void p.seek(ms / 1000);
    } catch {
      // Se mueve el video directamente.
    }
    const v = videoPrincipal();
    if (v) v.currentTime = ms / 1000;
  },
  async reproducir() {
    try {
      const p = reproductor();
      if (p?.play) return void (await p.play());
    } catch {
      // Se reproduce el video directamente.
    }
    await videoPrincipal()?.play();
  },
  pausar() {
    try {
      const p = reproductor();
      if (p?.pause) return void p.pause();
    } catch {
      // Se para el video directamente.
    }
    videoPrincipal()?.pause();
  },
  imagenOficial() {
    const id = idActual();
    const portada = id ? datos.get(id)?.portada : undefined;
    return portada ? portada.replace(/^http:/, 'https:') : null;
  },
};
