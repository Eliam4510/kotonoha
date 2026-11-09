// La lengua que se estudia y cómo se escriben sus lecturas. Son señales: la ficha se usa en sitios muy distintos y no
// todos le pasan los ajustes.

import { signal } from '@preact/signals';
import { type Ajustes, ajustesParaLengua, guardarAjustes } from '../compartido/ajustes';
import { motor } from '../compartido/rpc';
import type { ResultadoBusqueda } from '../compartido/tipos';
import { PAQUETE_INICIAL, paqueteDe } from '../lenguas';

export const lengua = signal(PAQUETE_INICIAL);
export const formatoLectura = signal(PAQUETE_INICIAL.lectura.formatoInicial);
/** La voz del navegador elegida para esta lengua; vacía, la mejor que haya (ui/vozNavegador.ts). */
export const vozNavegador = signal('');

export function aplicarLengua(a: Pick<Ajustes, 'idiomaObjetivo' | 'formatoLectura' | 'vozNavegador'>) {
  lengua.value = paqueteDe(a.idiomaObjetivo);
  formatoLectura.value = a.formatoLectura;
  vozNavegador.value = a.vozNavegador ?? '';
}

/** Pasa a estudiar otra lengua: guarda los ajustes de la actual, recupera los de la nueva y se lo dice al motor. */
export async function estudiarLengua(a: Ajustes, id: string) {
  const cambios = ajustesParaLengua(a, id);
  if (!Object.keys(cambios).length) return;
  await guardarAjustes(cambios);
  await motor.fijarLengua(id).catch(console.error);
}

/** Lo que va en el campo de la lectura de una tarjeta: donde no distingue palabras, cómo suena. */
export function lecturaDeTarjeta(r: ResultadoBusqueda): string {
  if (lengua.value.lectura.distingue) return r.lectura;
  return (r.pronunciaciones?.find((t) => t.zona === formatoLectura.value) ?? r.pronunciaciones?.[0])?.ipa ?? '';
}
