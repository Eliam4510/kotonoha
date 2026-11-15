// La letra de lo escrito en la lengua que se estudia: la que se elige en Ajustes o en el panel de los subtítulos, para
// las páginas del diccionario y para lo que se ve sobre el video (subtítulos y fichas). Cada letra dice cuánto aire le
// falta a su lectura (aireLectura del paquete), y la regla de rt lo suma (ui/ficha.css).

import type { LetraDiccionario } from '../compartido/ajustes';
import { tm } from '../compartido/i18n';
import type { PaqueteLengua } from '../lenguas/tipos';

export const LETRAS: { id: LetraDiccionario; nombre: string }[] = [
  { id: 'gotica', nombre: tm('Gótica') },
  { id: 'redondeada', nombre: tm('Redondeada') },
  { id: 'libro', nombre: tm('De libro') },
  { id: 'escuela', nombre: tm('A mano') },
];

/** Las letras que tiene una lengua: la redondeada siempre; las demás, si las trae, y la de escribir a mano, si la hay. */
export const letrasDe = (p: PaqueteLengua) => LETRAS.filter((l) => l.id === 'redondeada' || (!!p.letras && (l.id !== 'escuela' || !!p.letras.escuela)));

/** La familia de una de sus letras, para enseñarla en su botón. */
export const familiaDe = (p: PaqueteLengua, id: LetraDiccionario) => (id === 'redondeada' ? p.letra : p.letras?.[id] ?? p.letra);

/** La letra elegida y el aire que le falta a su lectura, en em de la palabra. Una que la lengua no tiene pasa a la gótica. */
export function letraElegida(p: PaqueteLengua, eleccion: LetraDiccionario): { letra: string; aire: number } {
  if (eleccion === 'redondeada' || !p.letras) return { letra: p.letra, aire: 0 };
  const id = p.letras[eleccion] ? eleccion : 'gotica';
  return { letra: p.letras[id] ?? p.letra, aire: p.aireLectura?.[id] ?? 0 };
}
