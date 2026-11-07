// Orden de los trazos. Se pide carácter a carácter y se guarda: cada uno solo se descarga una vez, y después funciona sin conexión.

import { tr } from '../compartido/i18n';
import type { DatosTrazos } from '../nucleo/trazos';
import { db } from './db';
import { motorLengua } from './lengua';

export async function trazosDe(caracter: string): Promise<DatosTrazos | null> {
  const fuente = motorLengua().trazos;
  if (!fuente) return null;
  const guardado = await db.trazos.get(caracter);
  if (guardado) return guardado.datos;
  const r = await fetch(fuente.url(caracter));
  // Lo que la fuente no tiene tampoco lo tendrá mañana: se recuerda, para no volver a preguntar.
  if (r.status === 404) {
    await db.trazos.put({ caracter, datos: null });
    return null;
  }
  // Un 403 o un 429 son del CDN, no del carácter: puede que más tarde sí responda.
  if (r.status >= 400 && r.status < 500) return null;
  if (!r.ok) throw new Error(tr('No se pudieron descargar los trazos ({0})', r.status));
  const datos = fuente.leer(await r.text());
  await db.trazos.put({ caracter, datos });
  return datos;
}
