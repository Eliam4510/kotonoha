// Volver al momento de un video donde apareció una frase: cómo se escribe ese momento y cómo se reconoce el video aunque
// su dirección cambie (otra lista, otro minuto, otro idioma de la página).

/** «0:07», «12:34» o «1:02:03»: el momento de un video, como lo enseñan los reproductores. */
export function momentoLegible(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

const YOUTUBE = /(^|\.)youtube\.com$/;
const NETFLIX = /(^|\.)netflix\.com$/;

/**
 * Lo que identifica a un video en su dirección: el mismo video de YouTube puede venir con lista, con minuto o desde un
 * enlace corto; un episodio de Netflix es su número. En los demás sitios, la dirección sin el ancla.
 */
export function claveDeVideo(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  if (YOUTUBE.test(u.hostname)) {
    const v = u.searchParams.get('v') ?? /^\/(?:shorts|live|embed)\/([\w-]{6,})/.exec(u.pathname)?.[1];
    if (v) return `yt:${v}`;
  }
  if (u.hostname === 'youtu.be') {
    const v = /^\/([\w-]{6,})/.exec(u.pathname)?.[1];
    if (v) return `yt:${v}`;
  }
  if (NETFLIX.test(u.hostname)) {
    const id = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?watch\/(\d+)/i.exec(u.pathname)?.[1];
    if (id) return `nf:${id}`;
  }
  return `url:${u.origin}${u.pathname}${u.search}`;
}

/** La dirección que abre el video en ese momento, donde el sitio lo admite (YouTube, con su parámetro t). */
export function urlEnMomento(url: string, ms: number): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  const segundos = Math.max(0, Math.floor(ms / 1000));
  if (YOUTUBE.test(u.hostname) || u.hostname === 'youtu.be') {
    u.searchParams.set('t', `${segundos}s`);
    return u.toString();
  }
  return url;
}
