// Lo nuevo de esta versión, para la tarjeta que Inicio enseña una vez tras actualizar. Se cambia en cada versión que
// traiga algo que contar. Si la versión de aquí no es la instalada (no se cambió), la tarjeta no sale: mejor nada que lo
// de otra versión.

import { tm } from '../compartido/i18n';

export const NOVEDADES: { version: string; puntos: string[] } = {
  version: '0.48.1',
  puntos: [
    tm('En la Memoria, con las nuevas del día hechas, «Estudiar 10 nuevas más hoy» pide unas cuantas más, solo por ese día.'),
    tm('El gasto con Claude, en Inicio, y los nombres de las instrucciones, en Ajustes, ya salen en el idioma de la interfaz.'),
  ],
};

/** Si Inicio cuenta lo nuevo: la versión instalada es la de las novedades y aún no se han visto. */
export const hayNovedades = (instalada: string, vistas: string) => NOVEDADES.version === instalada && vistas !== instalada;
