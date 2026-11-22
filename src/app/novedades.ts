// Lo nuevo de esta versión, para la tarjeta que Inicio enseña una vez tras actualizar. Se cambia en cada versión que
// traiga algo que contar. Si la versión de aquí no es la instalada (no se cambió), la tarjeta no sale: mejor nada que lo
// de otra versión.

import { tm } from '../compartido/i18n';

export const NOVEDADES: { version: string; puntos: string[] } = {
  version: '0.45.0',
  puntos: [
    tm('Bilibili tiene su propio soporte: Kotonoha usa los subtítulos de cada video, los de su autor o los de la IA de Bilibili, con tu sesión iniciada en Bilibili.'),
    tm('Cada video de Bilibili se reconoce por su BV y su parte, con su título original aunque Bilibili esté traducido: lo ya analizado se encuentra aunque la dirección cambie.'),
    tm('Los subtítulos de Bilibili quedan ocultos tras los de Kotonoha, y el anime de bangumi funciona igual, donde Bilibili deja verlo.'),
  ],
};

/** Si Inicio cuenta lo nuevo: la versión instalada es la de las novedades y aún no se han visto. */
export const hayNovedades = (instalada: string, vistas: string) => NOVEDADES.version === instalada && vistas !== instalada;
