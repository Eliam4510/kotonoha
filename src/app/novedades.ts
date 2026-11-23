// Lo nuevo de esta versión, para la tarjeta que Inicio enseña una vez tras actualizar. Se cambia en cada versión que
// traiga algo que contar. Si la versión de aquí no es la instalada (no se cambió), la tarjeta no sale: mejor nada que lo
// de otra versión.

import { tm } from '../compartido/i18n';

export const NOVEDADES: { version: string; puntos: string[] } = {
  version: '0.50.1',
  puntos: [
    tm('Una letra que escribe el estribillo una vez, o solo su título donde vuelve, se coloca entera, como se canta.'),
    tm('Las marcas de repetición, como «(Repeat Chorus)» o «×2», se despliegan solas, sin IA, y el aviso dice cuántos versos se repitieron.'),
  ],
};

/** Si Inicio cuenta lo nuevo: la versión instalada es la de las novedades y aún no se han visto. */
export const hayNovedades = (instalada: string, vistas: string) => NOVEDADES.version === instalada && vistas !== instalada;
