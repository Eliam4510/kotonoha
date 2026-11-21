// Las frases de la interfaz que nombran el chino o su pinyin. El texto en español es la clave de la traducción.

import { tm } from '../../compartido/i18n';
import type { TextosLengua } from '../tipos';

export const TEXTOS: TextosLengua = {
  nombre: tm('Chino'),
  lectura: tm('Pinyin'),

  // Subtítulos
  subtitulos: tm('Subtítulos en chino'),
  sinSubtitulos: tm('Sin subtítulos en chino'),
  soltarSubtitulos: tm('SRT, VTT, ASS o TTML · se añadirán como subtítulos en chino'),
  mostrar: tm('Mostrar chino'),
  mostrarUOcultar: tm('Mostrar u ocultar chino'),
  tamano: tm('tamaño del chino'),
  velo: tm('Velo sobre el chino'),
  atajos: tm('Atajos para el chino:'),
  desfase: tm('Desfase del chino'),
  antes: tm('Chino 0,1 s antes'),
  despues: tm('Chino 0,1 s después'),
  primeroElige: tm('Primero elige los subtítulos en chino.'),
  primeroNecesitas: tm('Primero necesitas subtítulos en chino.'),

  // Crear subtítulos
  crearDesdeOtro: tm('Crear chino desde otro idioma'),
  crearDesdeOtroAyuda: tm('Para cuando solo hay subtítulos en otro idioma y no encuentras un SRT en chino. Es una traducción de una traducción, así que no coincidirá del todo con lo que se oye.'),
  traducirPista: tm('Traducir «{0}» al chino'),
  traducirA: tm('Traducir al chino'),
  traduccionLista: tm('Subtítulos en chino listos. Al ser una traducción, pueden diferir de lo que se oye.'),
  whisperAyuda: tm('Genera subtítulos en chino cuando un video no los trae, o los lleva grabados en la imagen. Corre en tu tarjeta gráfica: el audio no sale de tu equipo.'),
  whisperCorregirAyuda: tm('Arregla caracteres, homófonos y puntuación a medida que llega el texto.'),
  corregirResultado: tm('Caracteres y homófonos del resultado'),
  revisionAyuda: tm('Corrige el pinyin, detecta los usos figurados y marca la gramática de cada línea. Lo revisado se guarda, así que solo se hace una vez.'),

  // Lector
  lectorAyuda: tm('Colores, pinyin y consulta en cualquier texto en chino, sin añadir nada al contenido de las páginas.'),
  lectorResumen: tm('Colores, pinyin y consulta en cualquier texto en chino.'),
  lectorActivar: tm('Activar en las páginas en chino'),
  lectorPegar: tm('Pega cualquier texto en chino para leerlo con pinyin, diccionario y Claude al alcance de un clic.'),
  cuadernoVacio: tm('Escribe o pega aquí un texto en chino. Empieza una línea con # para un título, con - para una lista y con > para una cita.'),
  lectorBotonAyuda: tm('Para ajustar los colores y el pinyin sin venir aquí.'),
  separarLineas: tm('Separar las líneas para el pinyin'),
  separarLineasAyuda: tm('Si el pinyin no cabe entre dos líneas, abre un poco ese texto. Apagado, el diseño de la página no se mueve nada, pero el pinyin puede chocar con la línea de arriba.'),

  // Lecturas y palabras
  formatoTitulo: tm('Pinyin'),
  formatoAyuda: tm('Cómo se escriben los tonos del pinyin, en todas partes.'),
  lecturaCampo: tm('en pinyin'),
  fraseConLectura: tm('Frase con pinyin'),
  gramaticaConocida: tm('Partículas como conocidas'),
  compuestos: tm('Palabras compuestas'),
  compuestosActivar: tm('Buscar palabras compuestas'),
  compuestosAyuda: tm('Palabras formadas con la siguiente'),
  flexionDe: tm('Forma de'),
  flexiones: tm('Forma de la palabra'),
  frecuenciaYAcento: tm('Frecuencia y pinyin'),

  // Nivel y primeros pasos
  nivelPregunta: tm('¿Qué nivel de chino tienes?'),
  nivelAyuda: tm('Las explicaciones se adaptan a tu nivel, y de él depende cuánto pinyin ves al principio.'),
  vocabularioSuperado: tm('Ya superas el vocabulario habitual del HSK 6.'),
  bienvenidaPagina: tm('En cualquier texto en chino, haz clic en una palabra. El botón del borde derecho ajusta los colores y el pinyin.'),
  primerVideo: tm('Abre uno con subtítulos en chino y aparecerá la barra de Kotonoha. Si no tiene, arrastra tu archivo SRT sobre él.'),
  primeraPagina: tm('En cualquier página, haz clic en una palabra en chino para ver su ficha.'),
  diccionariosResumen: tm('CC-CEDICT, pinyin y frecuencia'),
  buscarAyuda: tm('Escríbela en caracteres o en pinyin, con tonos o sin ellos (nihao, ni3hao3). También entiende frases enteras.'),
  pegarLista: tm('Pega una lista o cualquier texto en chino.'),
  localArrastrar: tm('Arrastra aquí un video y sus subtítulos. Tendrás pinyin, diccionario, tarjetas y Claude, y el video no sale de tu ordenador.'),
  seguirPortapapeles: tm('Añade aquí el chino que copies en cualquier sitio, mientras esta pestaña esté a la vista.'),
  dictar: tm('Habla en chino y Kotonoha lo escribe aquí, con tu grabación para volver a oírla.'),
  temaRelato: tm('Un gato que pasea por Pekín…'),
};
