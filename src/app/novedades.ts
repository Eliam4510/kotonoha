// Lo nuevo de esta versión, para la tarjeta que Inicio enseña una vez tras actualizar. Se cambia en cada versión que
// traiga algo que contar. Si la versión de aquí no es la instalada (no se cambió), la tarjeta no sale: mejor nada que lo
// de otra versión.

import { tm } from '../compartido/i18n';

export const NOVEDADES: { version: string; puntos: string[] } = {
  version: '0.46.0',
  puntos: [
    tm('En chino, buscar un solo hanzi abre su página: su pinyin, su radical con su nombre de clase, sus piezas, cómo se formó, la pieza que le da el sonido y los hanzi que se leen igual.'),
    tm('Cada hanzi enseña el orden de sus trazos, con las formas de China continental, y su escritura se practica en su página, con cada trazo corregido al soltarlo.'),
    tm('La pantalla del HSK reúne el vocabulario, los hanzi y la gramática de cada nivel, con el temario de 2025, y cuánto conoces de cada uno.'),
    tm('La gramática del chino que se detecta sin IA pasa de 35 a 105 puntos, cada uno en el nivel del HSK en que se enseña.'),
  ],
};

/** Si Inicio cuenta lo nuevo: la versión instalada es la de las novedades y aún no se han visto. */
export const hayNovedades = (instalada: string, vistas: string) => NOVEDADES.version === instalada && vistas !== instalada;
