// Lo nuevo de esta versión, para la tarjeta que Inicio enseña una vez tras actualizar. Se cambia en cada versión que
// traiga algo que contar. Si la versión de aquí no es la instalada (no se cambió), la tarjeta no sale: mejor nada que lo
// de otra versión.

import { tm } from '../compartido/i18n';

export const NOVEDADES: { version: string; puntos: string[] } = {
  version: '0.49.0',
  puntos: [
    tm('Las tarjetas de Anki tienen un diseño nuevo: la frase con la palabra marcada, la escena, la palabra con su lectura y su definición, y modo noche.'),
    tm('Las que ya tienes cambian solas si no tocaste su plantilla; si la cambiaste, «Usar el diseño nuevo», en Ajustes.'),
    tm('Cada tarjeta lleva la etiqueta de su lengua y, con ella, la letra que le corresponde; el pinyin del chino, más grande, se lee bien.'),
    tm('El repaso de la Memoria sigue el mismo estilo.'),
  ],
};

/** Si Inicio cuenta lo nuevo: la versión instalada es la de las novedades y aún no se han visto. */
export const hayNovedades = (instalada: string, vistas: string) => NOVEDADES.version === instalada && vistas !== instalada;
