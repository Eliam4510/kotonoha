// Las lenguas que se pueden estudiar. Para añadir una: su carpeta aquí al lado, y una línea en este archivo y en motor.ts.

import { ALEMAN } from './aleman';
import { INGLES } from './ingles';
import { JAPONES } from './japones';
import type { PaqueteLengua } from './tipos';

export type { PaqueteLengua } from './tipos';

/** En el orden en que se ofrecen. */
export const PAQUETES: PaqueteLengua[] = [JAPONES, INGLES, ALEMAN];

const POR_ID = new Map(PAQUETES.map((p) => [p.id, p]));

/** Con la que empieza quien acaba de instalar. */
export const PAQUETE_INICIAL = JAPONES;

/** El paquete de una lengua. Un código desconocido no debe dejar el programa sin lengua: vale la inicial. */
export const paqueteDe = (id: string): PaqueteLengua => POR_ID.get(id.split('-')[0]) ?? PAQUETE_INICIAL;
