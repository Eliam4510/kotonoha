// Las frases de la interfaz que nombran el japonés o su escritura. El texto en español es la clave de la traducción.

import { tm } from '../../compartido/i18n';
import type { TextosLengua } from '../tipos';

export const TEXTOS: TextosLengua = {
  nombre: tm('Japonés'),
  lectura: tm('Furigana'),

  // Subtítulos
  subtitulos: tm('Subtítulos en japonés'),
  sinSubtitulos: tm('Sin subtítulos en japonés'),
  soltarSubtitulos: tm('SRT, VTT, ASS o TTML · se añadirán como subtítulos en japonés'),
  mostrar: tm('Mostrar japonés'),
  mostrarUOcultar: tm('Mostrar u ocultar japonés'),
  tamano: tm('tamaño del japonés'),
  velo: tm('Velo sobre el japonés'),
  atajos: tm('Atajos para el japonés:'),
  desfase: tm('Desfase del japonés'),
  antes: tm('Japonés 0,1 s antes'),
  despues: tm('Japonés 0,1 s después'),
  primeroElige: tm('Primero elige los subtítulos en japonés.'),
  primeroNecesitas: tm('Primero necesitas subtítulos en japonés.'),

  // Crear subtítulos
  crearDesdeOtro: tm('Crear japonés desde otro idioma'),
  crearDesdeOtroAyuda: tm('Para cuando solo hay subtítulos en otro idioma y no encuentras un SRT en japonés. Es una traducción de una traducción, así que no coincidirá del todo con lo que se oye.'),
  traducirPista: tm('Traducir «{0}» al japonés'),
  traducirA: tm('Traducir al japonés'),
  traduccionLista: tm('Subtítulos en japonés listos. Al ser una traducción, pueden diferir de lo que se oye.'),
  whisperAyuda: tm('Genera subtítulos en japonés cuando un video no los trae. Corre en tu tarjeta gráfica: el audio no sale de tu equipo.'),
  whisperCorregirAyuda: tm('Arregla kanji, homófonos y puntuación a medida que llega el texto.'),
  corregirResultado: tm('Kanji y homófonos del resultado'),
  revisionAyuda: tm('Corrige el furigana, detecta los usos figurados y marca la gramática de cada línea. Lo revisado se guarda, así que solo se hace una vez.'),

  // Lector
  lectorAyuda: tm('Colores, furigana y consulta en cualquier texto japonés, sin añadir nada al contenido de las páginas.'),
  lectorResumen: tm('Colores, furigana y consulta en cualquier texto japonés.'),
  lectorActivar: tm('Activar en las páginas con japonés'),
  lectorPegar: tm('Pega cualquier texto japonés para leerlo con furigana, diccionario y Claude al alcance de un clic.'),
  cuadernoVacio: tm('Escribe o pega aquí un texto en japonés. Empieza una línea con # para un título, con - o ・ para una lista y con > para una cita.'),
  lectorBotonAyuda: tm('Para ajustar los colores y el furigana sin venir aquí.'),
  separarLineas: tm('Separar las líneas para el furigana'),
  separarLineasAyuda: tm('Si el furigana no cabe entre dos líneas, abre un poco ese texto. Apagado, el diseño de la página no se mueve nada, pero el furigana puede chocar con la línea de arriba.'),

  // Lecturas y palabras
  formatoTitulo: tm('Lecturas'),
  formatoAyuda: tm('Cómo se escribe el furigana, en todas partes.'),
  lecturaCampo: tm('en hiragana'),
  fraseConLectura: tm('Frase con furigana'),
  gramaticaConocida: tm('Partículas como conocidas'),
  compuestos: tm('Compuestos'),
  compuestosActivar: tm('Buscar compuestos'),
  compuestosAyuda: tm('Palabras formadas con la siguiente'),
  flexionDe: tm('Conjugación de'),
  flexiones: tm('Conjugación'),
  frecuenciaYAcento: tm('Frecuencia y acento'),

  // Nivel y primeros pasos
  nivelPregunta: tm('¿Qué nivel de japonés tienes?'),
  nivelAyuda: tm('Las explicaciones se adaptan a tu nivel, y de él depende cuánto furigana ves al principio.'),
  vocabularioSuperado: tm('Ya superas el vocabulario habitual de N1.'),
  bienvenidaPagina: tm('En cualquier texto japonés, haz clic en una palabra. El botón del borde derecho ajusta los colores y el furigana.'),
  primerVideo: tm('Abre uno con subtítulos en japonés y aparecerá la barra de Kotonoha. Si no tiene, arrastra tu archivo SRT sobre él.'),
  primeraPagina: tm('En cualquier página, haz clic en una palabra japonesa para ver su ficha.'),
  diccionariosResumen: tm('JMdict, acento tonal y frecuencia'),
  buscarAyuda: tm('Escríbela en japonés. También entiende formas conjugadas y frases enteras.'),
  pegarLista: tm('Pega una lista o cualquier texto japonés.'),
  localArrastrar: tm('Arrastra aquí un video y sus subtítulos. Tendrás furigana, diccionario, tarjetas y Claude, y el video no sale de tu ordenador.'),
  seguirPortapapeles: tm('Añade aquí el japonés que copies en cualquier sitio, mientras esta pestaña esté a la vista.'),
  dictar: tm('Habla en japonés y Kotonoha lo escribe aquí, con tu grabación para volver a oírla.'),
  temaRelato: tm('Un gato que pasea por Kioto…'),
};
