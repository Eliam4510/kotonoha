// Voces de frases e imágenes.

import type { Ajustes } from '../compartido/ajustes';
import type { ResultadoImagen } from '../compartido/tipos';
import { lengua } from './lengua';
import { bytesABase64 } from './grabacion';
import { tr } from '../compartido/i18n';

/** Voz neuronal de Azure con tu propia clave (el nivel gratuito incluye 0,5 M de caracteres al mes). */
export async function vozAzure(a: Ajustes, texto: string, voz: string): Promise<string> {
  if (!a.azureClave || !a.azureRegion) throw new Error(tr('Configura Azure Speech en Ajustes para usar voces sintéticas.'));
  const escapado = texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const r = await fetch(`https://${a.azureRegion}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': a.azureClave,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3',
    },
    body: `<speak version="1.0" xml:lang="${lengua().bcp47}"><voice name="${voz}">${escapado}</voice></speak>`,
  });
  if (!r.ok) throw new Error(tr('Azure Speech respondió {0}', r.status));
  return bytesABase64(new Uint8Array(await r.arrayBuffer()));
}

export async function descargarMedio(url: string): Promise<{ datos: string; tipo: string }> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(tr('No se pudo descargar ({0})', r.status));
  return { datos: bytesABase64(new Uint8Array(await r.arrayBuffer())), tipo: r.headers.get('content-type') ?? 'application/octet-stream' };
}

/** Imágenes con licencia abierta de Openverse; no necesita clave. */
export async function buscarImagenes(consulta: string): Promise<ResultadoImagen[]> {
  const params = new URLSearchParams({ q: consulta, page_size: '12', mature: 'false' });
  const r = await fetch(`https://api.openverse.org/v1/images/?${params}`);
  if (!r.ok) throw new Error(tr('La búsqueda de imágenes falló ({0})', r.status));
  const d = (await r.json()) as { results?: { url: string; thumbnail?: string; title?: string }[] };
  return (d.results ?? []).map((x) => ({ url: x.url, miniatura: x.thumbnail ?? x.url, titulo: x.title }));
}
