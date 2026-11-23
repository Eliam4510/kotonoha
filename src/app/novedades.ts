// Lo nuevo de esta versión, para la tarjeta que Inicio enseña una vez tras actualizar. Se cambia en cada versión que
// traiga algo que contar. Si la versión de aquí no es la instalada (no se cambió), la tarjeta no sale: mejor nada que lo
// de otra versión.

import { tm } from '../compartido/i18n';

export const NOVEDADES: { version: string; puntos: string[] } = {
  version: '0.49.2',
  puntos: [
    tm('Transcribir otra vez una canción ya no transcribe solo el final: una transcripción terminada se rehace entera, y una cortada sigue donde iba.'),
    tm('Un archivo de audio se transcribe como canción, y una canción se abre con su letra en LRC, con cada verso en su momento.'),
    tm('El progreso dice qué hace en cada fase, y con el video en pausa la transcripción va a toda marcha.'),
    tm('Los subtítulos guardados se borran: los de un video, en su panel de subtítulos, y los de todos, en Ajustes.'),
  ],
};

/** Si Inicio cuenta lo nuevo: la versión instalada es la de las novedades y aún no se han visto. */
export const hayNovedades = (instalada: string, vistas: string) => NOVEDADES.version === instalada && vistas !== instalada;
