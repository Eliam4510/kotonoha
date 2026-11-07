// Lo que pesa más del japonés. Solo lo cargan el motor y la ventana de la aplicación, nunca las páginas.

import { leerTrazos } from '../../nucleo/trazos';
import type { MotorLengua } from '../tipos';
import { ANALIZADOR } from './analizador';
import { audiosJapones } from './audio';
import { diccionariosPorReparar, FUENTES } from './diccionarios';
import { detectarGramatica } from './gramatica';
import { PROMPTS_JAPONES } from './prompts';
import { REGLAS_TRANSCRIPCION } from './transcripcion';
import { urlTrazos } from './trazos';

export const MOTOR_JAPONES: MotorLengua = {
  analizador: ANALIZADOR,
  detectarGramatica,
  prompts: PROMPTS_JAPONES,
  transcripcion: { idioma: 'japanese', reglas: REGLAS_TRANSCRIPCION },
  diccionarios: FUENTES,
  audios: audiosJapones,
  trazos: { url: urlTrazos, leer: leerTrazos },
  diccionariosPorReparar,
};
