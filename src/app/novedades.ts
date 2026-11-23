// Lo nuevo de esta versión, para la tarjeta que Inicio enseña una vez tras actualizar. Se cambia en cada versión que
// traiga algo que contar. Si la versión de aquí no es la instalada (no se cambió), la tarjeta no sale: mejor nada que lo
// de otra versión.

import { tm } from '../compartido/i18n';

export const NOVEDADES: { version: string; puntos: string[] } = {
  version: '0.51.0',
  puntos: [
    tm('Con «Que Claude lea la letra», bajo la letra pegada, Claude entiende sus marcas, las repeticiones que no escribe y los coros.'),
    tm('Claude solo dice qué se canta: los tiempos los sigue poniendo la voz, también cuando la letra apenas casa con lo que se oye.'),
  ],
};

/** Si Inicio cuenta lo nuevo: la versión instalada es la de las novedades y aún no se han visto. */
export const hayNovedades = (instalada: string, vistas: string) => NOVEDADES.version === instalada && vistas !== instalada;
