// Lo nuevo de esta versión, para la tarjeta que Inicio enseña una vez tras actualizar. Se cambia en cada versión que
// traiga algo que contar. Si la versión de aquí no es la instalada (no se cambió), la tarjeta no sale: mejor nada que lo
// de otra versión.

import { tm } from '../compartido/i18n';

export const NOVEDADES: { version: string; puntos: string[] } = {
  version: '0.47.0',
  puntos: [
    tm('El reproductor de archivos tiene sus propios controles: velocidad, volumen, saltar de línea y, al pasar por la barra de tiempo, la frase que se dice en ese momento. En pantalla completa, los subtítulos siguen ahí.'),
    tm('Abre una carpeta entera como lista de reproducción, en el orden de sus capítulos y con los subtítulos de cada uno; los que dicen otro idioma en su nombre se ponen como traducción.'),
    tm('Recuerda dónde dejaste cada video o audio y sigue desde ahí. «Seguir viendo» los reúne, y lo que se eligió con el selector se vuelve a abrir con un clic.'),
    tm('También lee audio, como podcasts y audiolibros: en MP3, M4A, OGG, WAV o FLAC, con sus subtítulos o con los que escribe Whisper.'),
    tm('En Netflix, tras los anuncios, los subtítulos ya no se quedan desfasados: «Volver a sincronizar» mide de nuevo, y el ajuste por los anuncios se puede quitar.'),
  ],
};

/** Si Inicio cuenta lo nuevo: la versión instalada es la de las novedades y aún no se han visto. */
export const hayNovedades = (instalada: string, vistas: string) => NOVEDADES.version === instalada && vistas !== instalada;
