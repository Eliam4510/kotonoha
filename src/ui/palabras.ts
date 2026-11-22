// Cómo se ven las palabras de un texto según los ajustes: las clases que leen las reglas de ficha.css. Son las mismas
// sobre el video y al leer en el Cuaderno, la Biblioteca o el visor: lo que se elige en un sitio vale en todos.

import type { Ajustes, ModoColor, ModoLectura } from '../compartido/ajustes';
import { tm } from '../compartido/i18n';
import { lengua } from './lengua';

/**
 * La clase del color de un trozo de la palabra, si la lengua colorea sílaba a sílaba (los tonos del chino) y el color no
 * está apagado. Va en el ruby del trozo: colorea el carácter y su lectura.
 */
export function claseSilaba(lectura: string | undefined, colorAcento: ModoColor): string | undefined {
  if (!lectura || colorAcento === 'ninguno') return undefined;
  const patron = lengua.value.acento?.silaba?.(lectura);
  return patron ? `ac-${patron}` : undefined;
}

/** El nombre del ajuste del color: «Color de acento», o el de la lengua («Color de los tonos»), sin traducir. */
export const nombreColorAcento = (): string => lengua.value.acento?.nombreColor ?? tm('Color de acento');

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
