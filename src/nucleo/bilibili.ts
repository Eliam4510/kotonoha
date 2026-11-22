// Lo propio de Bilibili que no depende de la página: cómo llama a sus lenguas, cómo guarda sus subtítulos y cómo se
// nombra cada video. Lógica pura, para probarla sin navegador; el adaptador (pagina/bilibili.ts) la usa en la página.

/**
 * La lengua de una pista de Bilibili, en la forma de las demás pistas, y si la hizo su IA. Las de IA llevan delante «ai-»
 * (ai-zh, ai-ja, ai-en); sin quitarlo, ninguna se reconocería como de su lengua.
 */
export function idiomaDeBilibili(lan: string): { idioma: string; automatica: boolean } {
  const l = lan.trim().toLowerCase().replace(/_/g, '-');
  const ia = /^ai-/.test(l);
  return { idioma: ia ? l.slice(3) || 'und' : l || 'und', automatica: ia };
}

/** Una línea de los subtítulos de Bilibili: de dónde a dónde, en segundos, y su texto. */
interface LineaBilibili {
  from: number;
  to: number;
  content: string;
}

const hora = (s: number) => new Date(Math.max(0, s) * 1000).toISOString().slice(11, 23);

/** Si un texto es un JSON de subtítulos de Bilibili, como lo da su CDN: { body: [{ from, to, content }] }. */
export function esJsonBilibili(texto: string): boolean {
  return texto.trimStart().startsWith('{') && texto.includes('"body"');
}

/** El JSON de subtítulos de Bilibili, en WebVTT. Lo que no lo es se devuelve tal cual. */
export function vttDeBilibili(texto: string): string {
  if (!esJsonBilibili(texto)) return texto;
  try {
    const d = JSON.parse(texto) as { body?: LineaBilibili[] };
    if (!Array.isArray(d.body)) return texto;
    const lineas = d.body.filter((l) => typeof l.content === 'string' && l.content.trim() && l.to > l.from);
    return `WEBVTT\n\n${lineas.map((l) => `${hora(l.from)} --> ${hora(l.to)}\n${l.content.trim()}`).join('\n\n')}\n`;
  } catch {
    return texto;
  }
}

/** Lo que dice el reproductor del video en curso (window.player.getManifest()), o lo que se saca de la dirección. */
export interface VideoBilibili {
  bvid?: string | null;
  p?: number | null;
  episodeId?: number | string | null;
}

/**
 * Cómo se nombra un video de Bilibili en Kotonoha, sin lo que añade la página (spm_id_from, vd_source): el BV y, de la
 * segunda parte en adelante, su número (BV1xx411c7mD?p=2); un episodio de bangumi, por su número (ep779775). Sirve
 * también como camino de su dirección: con él se vuelve a encontrar lo guardado del video.
 */
export function idDeVideo(v: VideoBilibili): string | null {
  if (v.episodeId) return `ep${v.episodeId}`;
  if (!v.bvid) return null;
  return v.p && v.p > 1 ? `${v.bvid}?p=${v.p}` : v.bvid;
}

/** El video de una dirección de Bilibili: /video/BV…/?p=2 (también con la lengua delante, /es/video/), /bangumi/play/ep…, o ?bvid= en las listas. */
export function videoDeUrl(url: string): VideoBilibili | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const ep = /\/bangumi\/play\/ep(\d+)/.exec(u.pathname);
  if (ep) return { episodeId: Number(ep[1]) };
  const bv = /\/video\/(BV[0-9A-Za-z]{10})/.exec(u.pathname)?.[1] ?? /^BV[0-9A-Za-z]{10}$/.exec(u.searchParams.get('bvid') ?? '')?.[0];
  if (!bv) return null;
  const p = Number(u.searchParams.get('p'));
  return { bvid: bv, p: Number.isInteger(p) && p > 0 ? p : 1 };
}

/** Si lo que dice el reproductor es ya el video de la dirección: tras cambiar de parte, tarda un poco en ponerse al día. */
export function coincide(reproductor: VideoBilibili, url: VideoBilibili | null): boolean {
  if (!url) return true;
  if (url.episodeId) return String(reproductor.episodeId ?? '') === String(url.episodeId);
  return reproductor.bvid === url.bvid && (reproductor.p ?? 1) === (url.p ?? 1);
}

/** La dirección limpia de un video, a partir de su nombre en Kotonoha. */
export function urlDeVideo(id: string): string {
  return /^ep\d+$/.test(id) ? `https://www.bilibili.com/bangumi/play/${id}` : `https://www.bilibili.com/video/${id}`;
}

/**
 * Las zonas de música de Bilibili (原创音乐, 翻唱, VOCALOID·UTAU, 演奏, MV, 音乐现场, 音乐综合…): un video de ellas es
 * una canción, y se transcribe con el modelo de las canciones.
 */
const ZONAS_MUSICA = new Set([3, 28, 29, 30, 31, 59, 130, 193, 194, 243, 244]);

export const esZonaDeMusica = (tid: number | undefined | null) => tid !== undefined && tid !== null && ZONAS_MUSICA.has(tid);

/**
 * El título de la página sin lo que añade Bilibili: «_哔哩哔哩_bilibili» en los videos y «-番剧-全集-高清正版在线观看-
 * bilibili-哔哩哔哩» en los bangumi. Es el último recurso: el título original lo da su API, y la página puede estar traducida.
 */
export function tituloDePagina(titulo: string): string {
  return titulo
    .replace(/-(番剧|国创|电影|纪录片|电视剧|综艺)-.*bilibili.*$/, '')
    .replace(/_哔哩哔哩_bilibili$/, '')
    .trim();
}
