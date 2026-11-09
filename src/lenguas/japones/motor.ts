// Lo que pesa más del japonés. Solo lo cargan el motor y la ventana de la aplicación, nunca las páginas.

import { leerTrazos } from '../../nucleo/trazos';
import type { MotorLengua } from '../tipos';
import { ANALIZADOR } from './analizador';
import { audiosJapones } from './audio';
import { diccionariosPorReparar, FUENTES } from './diccionarios';
import { detectarGramatica, puntosGramatica } from './gramatica';
import { PROMPTS_JAPONES } from './prompts';
import { REGLAS_TRANSCRIPCION } from './transcripcion';
import { urlTrazos } from './trazos';

export const MOTOR_JAPONES: MotorLengua = {
  analizador: ANALIZADOR,
  detectarGramatica,
  // En una tarjeta, べき también se escribe べきだ, y las alternativas van con punto medio.
  gramaticaAnki: { puntos: puntosGramatica, formas: { colas: ['', 'だ', 'です', 'な', 'に', 'の'], separadores: '・' } },
  prompts: PROMPTS_JAPONES,
  transcripcion: { idioma: 'japanese', reglas: REGLAS_TRANSCRIPCION },
  diccionarios: FUENTES,
  audios: audiosJapones,
  trazos: { url: urlTrazos, leer: leerTrazos },
  diccionariosPorReparar,
};
