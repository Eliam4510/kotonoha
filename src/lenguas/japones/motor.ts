// Lo que pesa más del japonés. Solo lo cargan el motor y la ventana de la aplicación, nunca las páginas.

import { leerTrazos } from '../../nucleo/trazos';
import type { MotorLengua } from '../tipos';
import { ANALIZADOR } from './analizador';
import { audiosJapones } from './audio';
import { diccionariosPorReparar, FUENTES } from './diccionarios';
import { detectarGramatica, puntosGramatica } from './gramatica';
import { ARCHIVOS_KANJI, leerDiccionarioKanji } from './kanji';
import { PROMPTS_JAPONES } from './prompts';
import { REGLAS_TRANSCRIPCION } from './transcripcion';
import { urlTrazos, urlTrazosAlternativa } from './trazos';

export const MOTOR_JAPONES: MotorLengua = {
  analizador: ANALIZADOR,
  detectarGramatica,
  // En una tarjeta, べき también se escribe べきだ, y las alternativas van con punto medio.
  gramaticaAnki: { puntos: puntosGramatica, formas: { colas: ['', 'だ', 'です', 'な', 'に', 'の'], separadores: '・' } },
  prompts: PROMPTS_JAPONES,
  transcripcion: { idioma: 'japanese', reglas: REGLAS_TRANSCRIPCION },
  diccionarios: FUENTES,
  audios: audiosJapones,
  trazos: { url: urlTrazos, urlAlternativa: urlTrazosAlternativa, leer: leerTrazos },
  diccionariosPorReparar,
  diccionarioCaracteres: { archivos: ARCHIVOS_KANJI, leer: leerDiccionarioKanji },
};
