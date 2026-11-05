// Audio de palabras, voces de frases e imágenes.

import type { Ajustes } from '../compartido/ajustes';
import type { ResultadoAudio, ResultadoImagen } from '../compartido/tipos';
import { bytesABase64 } from './grabacion';

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

/** Grabaciones de Lingua Libre en Wikimedia Commons. */
async function audioLinguaLibre(lema: string): Promise<ResultadoAudio[]> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    list: 'search',
    srnamespace: '6',
    srlimit: '6',
    srsearch: `intitle:"LL-Q5287 (jpn)" intitle:"${lema}"`,
  });
  try {
    const d = (await (await fetch(`https://commons.wikimedia.org/w/api.php?${params}`)).json()) as {
      query?: { search?: { title: string }[] };
    };
    const salida: ResultadoAudio[] = [];
    for (const s of d.query?.search ?? []) {
      const m = /^File:LL-Q5287 \(jpn\)-([^-]+)-(.+)\.(wav|ogg|mp3)$/.exec(s.title);
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

export async function audiosPalabra(lema: string, lectura: string): Promise<ResultadoAudio[]> {
  const [p, l] = await Promise.all([audioPod101(lema, lectura), audioLinguaLibre(lema)]);
  return [...(p ? [p] : []), ...l];
}

/** Voz neuronal de Azure con tu propia clave (el nivel gratuito incluye 0,5 M de caracteres al mes). */
export async function vozAzure(a: Ajustes, texto: string, voz: string): Promise<string> {
  if (!a.azureClave || !a.azureRegion) throw new Error('Configura Azure Speech en Ajustes para usar voces sintéticas.');
  const escapado = texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const r = await fetch(`https://${a.azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': a.azureClave,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3',
    },
    body: `<speak version="1.0" xml:lang="ja-JP"><voice name="${voz}">${escapado}</voice></speak>`,
  });
  if (!r.ok) throw new Error(`Azure Speech respondió ${r.status}`);
  return bytesABase64(new Uint8Array(await r.arrayBuffer()));
}

export async function descargarMedio(url: string): Promise<{ datos: string; tipo: string }> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`No se pudo descargar (${r.status})`);
  return { datos: bytesABase64(new Uint8Array(await r.arrayBuffer())), tipo: r.headers.get('content-type') ?? 'application/octet-stream' };
}

/** Imágenes con licencia abierta de Openverse; no necesita clave. */
export async function buscarImagenes(consulta: string): Promise<ResultadoImagen[]> {
  const params = new URLSearchParams({ q: consulta, page_size: '12', mature: 'false' });
  const r = await fetch(`https://api.openverse.org/v1/images/?${params}`);
  if (!r.ok) throw new Error(`La búsqueda de imágenes falló (${r.status})`);
  const d = (await r.json()) as { results?: { url: string; thumbnail?: string; title?: string }[] };
  return (d.results ?? []).map((x) => ({ url: x.url, miniatura: x.thumbnail ?? x.url, titulo: x.title }));
}
