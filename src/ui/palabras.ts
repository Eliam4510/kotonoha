// Cómo se ven las palabras de un texto según los ajustes: las clases que leen las reglas de ficha.css. Son las mismas
// sobre el video y al leer en el Cuaderno, la Biblioteca o el visor: lo que se elige en un sitio vale en todos.

import type { Ajustes, ModoLectura } from '../compartido/ajustes';
import { tm } from '../compartido/i18n';

export function clasesPalabras(a: Pick<Ajustes, 'mostrarEstado' | 'furigana' | 'colorAcento'>): string {
  return [
    a.mostrarEstado ? '' : 'sin-estado',
    a.furigana === 'alPasar' ? 'fur-alpasar' : a.furigana === 'ninguna' ? 'fur-ninguna' : a.furigana === 'desconocidas' ? 'fur-desconocidas' : '',
    a.colorAcento === 'alPasar' ? 'color-alpasar' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/** Cuándo llevan lectura encima las palabras, con el nombre corto de cada modo. */
export const MODOS_LECTURA: [ModoLectura, string][] = [
  ['todas', tm('Todo')],
  ['desconocidas', tm('Nuevas')],
  ['alPasar', tm('Al pasar')],
  ['ninguna', tm('Nada')],
];
