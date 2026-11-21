// Audio de las palabras en chino: grabaciones de Wikimedia Commons y de Lingua Libre, que no necesitan clave.

import type { ResultadoAudio } from '../../compartido/tipos';
import { audioLinguaLibre } from '../linguaLibre';

/** Commons guarda las de Wiktionary por su pinyin con tonos: Zh-yínháng.ogg es 银行. */
async function audioCommons(lectura: string): Promise<ResultadoAudio | null> {
  if (!lectura) return null;
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(`Zh-${lectura.replace(/ /g, '_')}.ogg`)}`;
  try {
    const r = await fetch(url, { method: 'HEAD' });
    return r.ok ? { etiqueta: 'Commons', url, origen: 'commons' } : null;
  } catch {
    return null;
  }
}

export async function audiosChino(lema: string, lectura: string): Promise<ResultadoAudio[]> {
  // Q9192 es el mandarín en Wikidata, y cmn su código.
  const [commons, l] = await Promise.all([audioCommons(lectura), audioLinguaLibre(lema, 'Q9192', 'cmn')]);
  return [...(commons ? [commons] : []), ...l];
}
