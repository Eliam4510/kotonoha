// Lo nuevo de esta versión, para la tarjeta que Inicio enseña una vez tras actualizar. Se cambia en cada versión que
// traiga algo que contar. Si la versión de aquí no es la instalada (no se cambió), la tarjeta no sale: mejor nada que lo
// de otra versión.

import { tm } from '../compartido/i18n';

export const NOVEDADES: { version: string; puntos: string[] } = {
  version: '0.41.0',
  puntos: [
    tm('«Descubre Kotonoha», en Inicio: todo lo que puede hacer, por familias, con un botón para probar cada cosa.'),
    tm('Un texto de ejemplo en cada lengua, para probar la ficha y crear tu primera tarjeta sin buscar nada.'),
    tm('Desde ahora, tras cada actualización, esta tarjeta cuenta lo nuevo, una vez.'),
  ],
};

/** Si Inicio cuenta lo nuevo: la versión instalada es la de las novedades y aún no se han visto. */
export const hayNovedades = (instalada: string, vistas: string) => NOVEDADES.version === instalada && vistas !== instalada;
