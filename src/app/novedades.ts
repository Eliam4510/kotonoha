// Lo nuevo de esta versión, para la tarjeta que Inicio enseña una vez tras actualizar. Se cambia en cada versión que
// traiga algo que contar. Si la versión de aquí no es la instalada (no se cambió), la tarjeta no sale: mejor nada que lo
// de otra versión.

import { tm } from '../compartido/i18n';

export const NOVEDADES: { version: string; puntos: string[] } = {
  version: '0.43.0',
  puntos: [
    tm('Ya se puede estudiar chino, en caracteres simplificados: elígelo en Inicio o en Ajustes, Idioma y nivel.'),
    tm('El pinyin va sobre cada carácter, con la lectura que toca en la frase, y el diccionario es CC-CEDICT, en el que también se busca por pinyin.'),
    tm('Las palabras se separan solas aunque el texto no lleve espacios, y los subtítulos en tradicionales se ven en simplificados.'),
  ],
};

/** Si Inicio cuenta lo nuevo: la versión instalada es la de las novedades y aún no se han visto. */
export const hayNovedades = (instalada: string, vistas: string) => NOVEDADES.version === instalada && vistas !== instalada;
