// Lo nuevo de esta versión, para la tarjeta que Inicio enseña una vez tras actualizar. Se cambia en cada versión que
// traiga algo que contar. Si la versión de aquí no es la instalada (no se cambió), la tarjeta no sale: mejor nada que lo
// de otra versión.

import { tm } from '../compartido/i18n';

export const NOVEDADES: { version: string; puntos: string[] } = {
  version: '0.49.1',
  puntos: [
    tm('Volver a traducir los subtítulos empieza desde cero, con los subtítulos como están ahora.'),
    tm('Si Claude no traduce una línea, como un verso de una canción, queda vacía y se avisa de cuántas son: su disculpa ya no se guarda como si fuera la traducción.'),
    tm('Si esa vez no traduce nada, se queda la traducción que había.'),
  ],
};

/** Si Inicio cuenta lo nuevo: la versión instalada es la de las novedades y aún no se han visto. */
export const hayNovedades = (instalada: string, vistas: string) => NOVEDADES.version === instalada && vistas !== instalada;
