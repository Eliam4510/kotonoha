// Las lenguas que se pueden estudiar. Para añadir una: su carpeta aquí al lado, y una línea en este archivo y en motor.ts.

import { JAPONES } from './japones';
import type { PaqueteLengua } from './tipos';

export type { PaqueteLengua } from './tipos';

const PAQUETES = new Map<string, PaqueteLengua>([[JAPONES.id, JAPONES]]);

/** Con la que empieza quien acaba de instalar. */
export const PAQUETE_INICIAL = JAPONES;

/** El paquete de una lengua. Un código desconocido no debe dejar el programa sin lengua: vale la inicial. */
export const paqueteDe = (id: string): PaqueteLengua => PAQUETES.get(id.split('-')[0]) ?? PAQUETE_INICIAL;
