// Orden de los trazos, con datos de KanjiVG (Ulrich Apel, CC BY-SA 3.0, https://kanjivg.tagaini.net).
// Se pide carácter a carácter y se guarda: cada kanji solo se descarga una vez, y después funciona sin conexión.

import { tr } from '../compartido/i18n';
import { archivoTrazos, type DatosTrazos, leerTrazos } from '../nucleo/trazos';
import { db } from './db';

// La versión va fijada: los datos no cambian sin que se decida, y el CDN puede guardarlos para siempre.
const BASE = 'https://cdn.jsdelivr.net/gh/KanjiVG/kanjivg@r20260714/kanji/';

export async function trazosDe(caracter: string): Promise<DatosTrazos | null> {
  const guardado = await db.trazos.get(caracter);
  if (guardado) return guardado.datos;
  const r = await fetch(BASE + archivoTrazos(caracter));
  // Lo que KanjiVG no tiene tampoco lo tendrá mañana: se recuerda, para no volver a preguntar.
  if (r.status === 404) {
    await db.trazos.put({ caracter, datos: null });
    return null;
  }
  // Un 403 o un 429 son del CDN, no del carácter: puede que más tarde sí responda.
  if (r.status >= 400 && r.status < 500) return null;
  if (!r.ok) throw new Error(tr('No se pudieron descargar los trazos ({0})', r.status));
  const datos = leerTrazos(await r.text());
  await db.trazos.put({ caracter, datos });
  return datos;
}
