// Lo nuevo de esta versión, para la tarjeta que Inicio enseña una vez tras actualizar. Se cambia en cada versión que
// traiga algo que contar. Si la versión de aquí no es la instalada (no se cambió), la tarjeta no sale: mejor nada que lo
// de otra versión.

import { tm } from '../compartido/i18n';

export const NOVEDADES: { version: string; puntos: string[] } = {
  version: '0.44.0',
  puntos: [
    tm('En chino, cada sílaba y su pinyin llevan el color de su tono, con la paleta que elijas; el tono neutro va sin color.'),
    tm('«Cómo suena», en la ficha, dice cómo se dice de verdad una frase en chino: los tonos que cambian según el siguiente, el tono neutro y la r que se pega a la sílaba de antes.'),
    tm('Practicar los tonos: lee una frase en voz alta y compara la curva de cada sílaba con la forma de su tono, sin modelos de voz ni descargas.'),
  ],
};

/** Si Inicio cuenta lo nuevo: la versión instalada es la de las novedades y aún no se han visto. */
export const hayNovedades = (instalada: string, vistas: string) => NOVEDADES.version === instalada && vistas !== instalada;
