// Audio de las palabras en alemán: grabaciones de Wikimedia Commons y de Lingua Libre, que no necesitan clave.

import type { ResultadoAudio } from '../../compartido/tipos';
import { audioLinguaLibre } from '../linguaLibre';

/** Commons guarda muchas palabras con un nombre fijo: De-Haus.ogg, De-gehen.ogg. */
async function audioCommons(lema: string): Promise<ResultadoAudio | null> {
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(`De-${lema.replace(/ /g, '_')}.ogg`)}`;
  try {
    const r = await fetch(url, { method: 'HEAD' });
    return r.ok ? { etiqueta: 'Commons', url, origen: 'commons' } : null;
  } catch {
    return null;
  }
}

export async function audiosAleman(lema: string): Promise<ResultadoAudio[]> {
  const [commons, l] = await Promise.all([audioCommons(lema), audioLinguaLibre(lema, 'Q188', 'deu')]);
  return [...(commons ? [commons] : []), ...l];
}
