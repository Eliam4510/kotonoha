// Lo que pesa más del japonés. Solo lo cargan el motor y la ventana de la aplicación, nunca las páginas.

import { leerTrazos } from '../../nucleo/trazos';
import type { MotorLengua } from '../tipos';
import { ANALIZADOR, fonemasDeTexto } from './analizador';
import { audiosJapones } from './audio';
import { diccionariosPorReparar, FUENTES } from './diccionarios';
import { detectarGramatica, puntosGramatica } from './gramatica';
import { encajaCategoriaJapones, soloHiragana } from './categorias';
import { ARCHIVOS_KANJI, leerDiccionarioKanji } from './kanji';
import { PROMPTS_JAPONES } from './prompts';
import { REGLAS_TRANSCRIPCION } from './transcripcion';
import { urlTrazos, urlTrazosAlternativa } from './trazos';

export const MOTOR_JAPONES: MotorLengua = {
  analizador: ANALIZADOR,
  fonemasDeVerso: fonemasDeTexto,
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
  porLectura: {
    // De dos letras o más: las de una (ら, ん, ね) son partículas o trozos, y sus homófonos con kanji no tienen que ver.
    busca: (lema) => soloHiragana(lema) && [...lema].length >= 2,
    // Las reglas de flexión de JMdict no distinguen un sustantivo de una partícula: las etiquetas sí.
    deSuClase: encajaCategoriaJapones,
  },
};
