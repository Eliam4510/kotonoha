// La lengua que se estudia, vista desde el motor. Se fija con los ajustes, y con ella cambia la base de datos.

import { PAQUETE_INICIAL, type PaqueteLengua, paqueteDe } from '../lenguas';
import { motorDe } from '../lenguas/motor';
import { usarBaseDe } from './db';

let actual: PaqueteLengua = PAQUETE_INICIAL;

export const lengua = () => actual;
export const motorLengua = () => motorDe(actual.id);

/** Devuelve si ha cambiado de verdad: lo que se tenga en memoria de la anterior ya no sirve. */
export function fijarLengua(id: string): boolean {
  const nueva = paqueteDe(id);
  if (nueva === actual) return false;
  actual = nueva;
  usarBaseDe(nueva.id);
  return true;
}
