// Lo nuevo de esta versión, para la tarjeta que Inicio enseña una vez tras actualizar. Se cambia en cada versión que
// traiga algo que contar. Si la versión de aquí no es la instalada (no se cambió), la tarjeta no sale: mejor nada que lo
// de otra versión.

import { tm } from '../compartido/i18n';

export const NOVEDADES: { version: string; puntos: string[] } = {
  version: '0.48.0',
  puntos: [
    tm('La Memoria tiene tres vistas: Repasar, Tarjetas y Progreso.'),
    tm('Al repasar, Z deshace la última respuesta, E edita la tarjeta y R repite su audio; una tarjeta se puede suspender hasta que la reactives.'),
    tm('Cada día salen las tarjetas que ya estás aprendiendo y, como mucho, las nuevas que elijas en Ajustes (20 de serie).'),
    tm('Tarjetas las reúne todas, con su estado y cuándo vuelven, para buscarlas, editarlas, suspenderlas o empezar de cero. Progreso enseña la racha, los aciertos y los repasos de cada día.'),
  ],
};

/** Si Inicio cuenta lo nuevo: la versión instalada es la de las novedades y aún no se han visto. */
export const hayNovedades = (instalada: string, vistas: string) => NOVEDADES.version === instalada && vistas !== instalada;
