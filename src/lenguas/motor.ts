// La parte pesada de cada lengua, aparte de index.ts para que el content script de las páginas no la cargue.

import { paqueteDe } from '.';
import { MOTOR_INGLES } from './ingles/motor';
import { MOTOR_JAPONES } from './japones/motor';
import type { MotorLengua } from './tipos';

const MOTORES = new Map<string, MotorLengua>([
  ['ja', MOTOR_JAPONES],
  ['en', MOTOR_INGLES],
]);

export const motorDe = (id: string): MotorLengua => MOTORES.get(paqueteDe(id).id)!;
