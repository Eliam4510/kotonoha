// La lengua que se estudia y cómo se escriben sus lecturas. Son señales: la ficha se usa en sitios muy distintos y no
// todos le pasan los ajustes.

import { signal } from '@preact/signals';
import type { Ajustes } from '../compartido/ajustes';
import { PAQUETE_INICIAL, paqueteDe } from '../lenguas';

export const lengua = signal(PAQUETE_INICIAL);
export const formatoLectura = signal(PAQUETE_INICIAL.lectura.formatoInicial);

export function aplicarLengua(a: Pick<Ajustes, 'idiomaObjetivo' | 'formatoLectura'>) {
  lengua.value = paqueteDe(a.idiomaObjetivo);
  formatoLectura.value = a.formatoLectura;
}
