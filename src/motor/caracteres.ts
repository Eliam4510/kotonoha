// El diccionario de caracteres: la ficha de uno y los que lo rodean, su familia por el sonido y los que lo llevan dentro.

import type { CaracterBreve, FichaCaracter } from '../compartido/tipos';
import { db } from './db';

export async function fichaCaracter(caracter: string): Promise<FichaCaracter | null> {
  return (await db.caracteres.get(caracter)) ?? null;
}

/** Lo justo para reconocerlo en una lista: su primera lectura oficial (o la primera que tenga) y lo que significa. */
function breve(f: FichaCaracter): CaracterBreve {
  const lectura = f.on.oficiales[0]?.texto ?? f.kun.oficiales[0]?.texto ?? f.on.otras[0]?.texto ?? f.kun.otras[0]?.texto;
  return {
    caracter: f.caracter,
    ...(lectura ? { lectura } : {}),
    significados: f.significados,
    ...(f.frecuencia ? { frecuencia: f.frecuencia } : {}),
    ...(f.lista ? { lista: f.lista } : {}),
  };
}

/** Los más usados primero. Los que no tienen puesto van detrás, de los más sencillos a los que llevan más trazos. */
function porUso(a: FichaCaracter, b: FichaCaracter): number {
  if (a.frecuencia !== b.frecuencia) return (a.frecuencia ?? Number.MAX_SAFE_INTEGER) - (b.frecuencia ?? Number.MAX_SAFE_INTEGER);
  return (a.trazos ?? 99) - (b.trazos ?? 99);
}

/** Los caracteres pedidos, en ese orden, en breve. Los que el diccionario no tiene no salen. */
export async function caracteresBreves(caracteres: string[]): Promise<CaracterBreve[]> {
  if (!caracteres.length) return [];
  const filas = await db.caracteres.bulkGet(caracteres);
  return filas.filter((f): f is FichaCaracter => !!f).map(breve);
}

/** Los que llevan dentro una pieza, en cualquiera de sus formas (水, 氵, 氺), de los más usados a los menos. */
export async function caracteresConPieza(piezas: string[], excluir: string[], limite = 24): Promise<{ filas: CaracterBreve[]; total: number }> {
  if (!piezas.length) return { filas: [], total: 0 };
  const fuera = new Set(excluir);
  const todas = await db.caracteres.where('piezas').anyOf(piezas).toArray();
  // Quien lleva dos de las formas sale dos veces.
  const unicas = [...new Map(todas.filter((f) => !fuera.has(f.caracter)).map((f) => [f.caracter, f])).values()].sort(porUso);
  return { filas: unicas.slice(0, limite).map(breve), total: unicas.length };
}

/**
 * La familia de una pieza que da el sonido: ella la primera, si es un carácter del diccionario, y después los que la
 * llevan para sonar como ella, de los más usados a los menos.
 */
export async function familiaFonetica(fonetico: string, limite = 24): Promise<{ filas: CaracterBreve[]; total: number }> {
  const [cabeza, resto] = await Promise.all([db.caracteres.get(fonetico), db.caracteres.where('fonetico').equals(fonetico).toArray()]);
  const filas = [...(cabeza ? [cabeza] : []), ...resto.filter((f) => f.caracter !== fonetico).sort(porUso)];
  return { filas: filas.slice(0, limite).map(breve), total: filas.length };
}
