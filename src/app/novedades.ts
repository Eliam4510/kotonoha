// Lo nuevo de esta versión, para la tarjeta que Inicio enseña una vez tras actualizar. Se cambia en cada versión que
// traiga algo que contar. Si la versión de aquí no es la instalada (no se cambió), la tarjeta no sale: mejor nada que lo
// de otra versión.

import { tm } from '../compartido/i18n';

export const NOVEDADES: { version: string; puntos: string[] } = {
  version: '0.42.0',
  puntos: [
    tm('Las voces de AivisSpeech, dentro de Kotonoha: se instalan en Ajustes, Voces, y se oyen sin tener AivisSpeech abierto.'),
    tm('Un catálogo de AivisHub para elegir más voces, oírlas antes de instalarlas y ver la licencia de cada una.'),
    tm('Corren en tu gráfica: la primera frase tarda unos segundos, y las siguientes, casi nada.'),
  ],
};

/** Si Inicio cuenta lo nuevo: la versión instalada es la de las novedades y aún no se han visto. */
export const hayNovedades = (instalada: string, vistas: string) => NOVEDADES.version === instalada && vistas !== instalada;
