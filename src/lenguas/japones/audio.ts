// Audio de las palabras en japonés.

import type { ResultadoAudio } from '../../compartido/tipos';
import { audioLinguaLibre } from '../linguaLibre';

/** JapanesePod101 devuelve este audio cuando no tiene la palabra: «no disponible». */
const TAM_AUDIO_NO_DISPONIBLE = 52288;

async function audioPod101(lema: string, lectura: string): Promise<ResultadoAudio | null> {
  const params = new URLSearchParams({ kana: lectura });
  if (lema !== lectura) params.set('kanji', lema);
  const url = `https://assets.languagepod101.com/dictionary/japanese/audiomp3.php?${params}`;
  try {
    const r = await fetch(url, { method: 'HEAD' });
    const tam = Number(r.headers.get('content-length')) || 0;
    if (!r.ok || tam === TAM_AUDIO_NO_DISPONIBLE) return null;
    return { etiqueta: 'JapanesePod101', url, origen: 'pod101' };
  } catch {
    return null;
  }
}

export async function audiosJapones(lema: string, lectura: string): Promise<ResultadoAudio[]> {
  const [p, l] = await Promise.all([audioPod101(lema, lectura), audioLinguaLibre(lema, 'Q5287', 'jpn')]);
  return [...(p ? [p] : []), ...l];
}
