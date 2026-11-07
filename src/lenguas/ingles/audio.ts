// Audio de las palabras en inglés: grabaciones de Wikimedia Commons, que no necesitan clave.

import type { ResultadoAudio } from '../../compartido/tipos';
import { audioLinguaLibre } from '../linguaLibre';

/** Commons guarda muchas palabras con un nombre fijo: En-us-hello.ogg, En-uk-hello.ogg. */
async function audioCommons(lema: string, prefijo: string, etiqueta: string): Promise<ResultadoAudio | null> {
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(`${prefijo}-${lema.replace(/ /g, '_')}.ogg`)}`;
  try {
    const r = await fetch(url, { method: 'HEAD' });
    return r.ok ? { etiqueta, url, origen: 'commons' } : null;
  } catch {
    return null;
  }
}

export async function audiosIngles(lema: string): Promise<ResultadoAudio[]> {
  const [us, uk, l] = await Promise.all([audioCommons(lema, 'En-us', 'Commons (US)'), audioCommons(lema, 'En-uk', 'Commons (UK)'), audioLinguaLibre(lema, 'Q1860', 'eng')]);
  return [...(us ? [us] : []), ...(uk ? [uk] : []), ...l];
}
