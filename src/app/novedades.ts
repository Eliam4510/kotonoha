// Lo nuevo de esta versión, para la tarjeta que Inicio enseña una vez tras actualizar. Se cambia en cada versión que
// traiga algo que contar. Si la versión de aquí no es la instalada (no se cambió), la tarjeta no sale: mejor nada que lo
// de otra versión.

import { tm } from '../compartido/i18n';

export const NOVEDADES: { version: string; puntos: string[] } = {
  version: '0.50.0',
  puntos: [
    tm('La letra de una canción se coloca con la voz: cada verso empieza donde suenan sus fonemas, y ya no donde Whisper cortó sus líneas.'),
    tm('Con la voz aislada de la música, nueve de cada diez versos quedan a menos de un segundo de donde se cantan.'),
    tm('Lo que no se canta, como las marcas de sección o los créditos, se quita de la letra, y un verso con «×2» se coloca dos veces.'),
    tm('Para un cantante al que nadie entiende, en Sincronizar: mantén la barra espaciadora mientras suena cada línea, y queda guardado.'),
  ],
};

/** Si Inicio cuenta lo nuevo: la versión instalada es la de las novedades y aún no se han visto. */
export const hayNovedades = (instalada: string, vistas: string) => NOVEDADES.version === instalada && vistas !== instalada;
