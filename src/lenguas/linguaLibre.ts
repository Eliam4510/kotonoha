// Audio de palabras común a todas las lenguas.

import type { ResultadoAudio } from '../compartido/tipos';

/**
 * Grabaciones de Lingua Libre en Wikimedia Commons. Se reconocen por el nombre del archivo, que lleva el identificador
 * de la lengua en Wikidata y su código: LL-Q5287 (jpn)-Usuario-palabra.wav
 */
export async function audioLinguaLibre(lema: string, wikidata: string, codigo: string): Promise<ResultadoAudio[]> {
  const prefijo = `LL-${wikidata} (${codigo})`;
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    list: 'search',
    srnamespace: '6',
    srlimit: '6',
    srsearch: `intitle:"${prefijo}" intitle:"${lema}"`,
  });
  try {
    const d = (await (await fetch(`https://commons.wikimedia.org/w/api.php?${params}`)).json()) as {
      query?: { search?: { title: string }[] };
    };
    const salida: ResultadoAudio[] = [];
    for (const s of d.query?.search ?? []) {
      if (!s.title.startsWith(`File:${prefijo}-`)) continue;
      const m = /^File:LL-[^-]+-([^-]+)-(.+)\.(wav|ogg|mp3)$/.exec(s.title);
      if (!m || m[2] !== lema) continue;
      salida.push({
        etiqueta: `${m[1]} (Lingua Libre)`,
        url: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(s.title.replace(/^File:/, ''))}`,
        origen: 'linguaLibre',
      });
    }
    return salida;
  } catch {
    return [];
  }
}
