// Orden de los trazos. Se pide carácter a carácter y se guarda: cada uno solo se descarga una vez, y después funciona sin conexión.

import { tr } from '../compartido/i18n';
import type { DatosTrazos } from '../nucleo/trazos';
import { db } from './db';
import { motorLengua } from './lengua';

export async function trazosDe(caracter: string): Promise<DatosTrazos | null> {
  const fuente = motorLengua().trazos;
  if (!fuente) return null;
  const guardado = await db.trazos.get(caracter);
  // Lo guardado antes de que se leyeran las piezas se vuelve a pedir una vez; sin conexión, sirve como está.
  if (guardado && (!guardado.datos || guardado.datos.componentes)) return guardado.datos;
  if (guardado) return (await descargar(caracter, fuente).catch(() => null)) ?? guardado.datos;
  return descargar(caracter, fuente);
}

async function descargar(caracter: string, fuente: NonNullable<ReturnType<typeof motorLengua>['trazos']>): Promise<DatosTrazos | null> {
  let r = await fetch(fuente.url(caracter)).catch(() => null);
  // Si la primera fuente falla o lo niega (no es que no exista), se prueba la otra.
  if ((!r || (!r.ok && r.status !== 404)) && fuente.urlAlternativa) r = await fetch(fuente.urlAlternativa(caracter)).catch(() => r);
  if (!r) throw new Error(tr('No se pudieron descargar los trazos ({0})', 0));
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
