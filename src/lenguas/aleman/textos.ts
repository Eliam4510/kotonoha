// Las frases de la interfaz que nombran el alemán o su pronunciación. El texto en español es la clave de la traducción.

import { tm } from '../../compartido/i18n';
import type { TextosLengua } from '../tipos';

export const TEXTOS: TextosLengua = {
  nombre: tm('Alemán'),
  lectura: tm('Pronunciación'),

  // Subtítulos
  subtitulos: tm('Subtítulos en alemán'),
  sinSubtitulos: tm('Sin subtítulos en alemán'),
  soltarSubtitulos: tm('SRT, VTT, ASS o TTML · se añadirán como subtítulos en alemán'),
  mostrar: tm('Mostrar alemán'),
  mostrarUOcultar: tm('Mostrar u ocultar alemán'),
  tamano: tm('tamaño del alemán'),
  velo: tm('Velo sobre el alemán'),
  atajos: tm('Atajos para el alemán:'),
  desfase: tm('Desfase del alemán'),
  antes: tm('Alemán 0,1 s antes'),
  despues: tm('Alemán 0,1 s después'),
  primeroElige: tm('Primero elige los subtítulos en alemán.'),
  primeroNecesitas: tm('Primero necesitas subtítulos en alemán.'),

  // Crear subtítulos
  crearDesdeOtro: tm('Crear alemán desde otro idioma'),
  crearDesdeOtroAyuda: tm('Para cuando solo hay subtítulos en otro idioma y no encuentras un SRT en alemán. Es una traducción de una traducción, así que no coincidirá del todo con lo que se oye.'),
  traducirPista: tm('Traducir «{0}» al alemán'),
  traducirA: tm('Traducir al alemán'),
  traduccionLista: tm('Subtítulos en alemán listos. Al ser una traducción, pueden diferir de lo que se oye.'),
  whisperAyuda: tm('Genera subtítulos en alemán cuando un video no los trae. Corre en tu tarjeta gráfica: el audio no sale de tu equipo.'),
  whisperCorregirAyuda: tm('Arregla nombres, palabras mal oídas y puntuación a medida que llega el texto.'),
  corregirResultado: tm('Palabras mal oídas del resultado'),
  revisionAyuda: tm('Detecta los usos figurados y los verbos separables, y marca la gramática de cada línea. Lo revisado se guarda, así que solo se hace una vez.'),

  // Lector
  lectorAyuda: tm('Colores y consulta en cualquier texto en alemán, sin añadir nada al contenido de las páginas. Empieza apagado: se enciende cuando se pide.'),
  lectorResumen: tm('Colores y consulta en cualquier texto en alemán.'),
  lectorActivar: tm('Activar en las páginas en alemán'),
  lectorPegar: tm('Pega cualquier texto en alemán para leerlo con pronunciación, diccionario y Claude al alcance de un clic.'),
  lectorBotonAyuda: tm('Para ajustar los colores y la pronunciación sin venir aquí.'),
  separarLineas: tm('Separar las líneas para la pronunciación'),
  separarLineasAyuda: tm('Si la pronunciación no cabe entre dos líneas, abre un poco ese texto. Apagado, el diseño de la página no se mueve nada, pero la pronunciación puede chocar con la línea de arriba.'),

  // Lecturas y palabras
  formatoTitulo: tm('Pronunciación'),
  formatoAyuda: tm('Qué pronunciación se escribe, en todas partes.'),
  lecturaCampo: tm('en IPA'),
  fraseConLectura: tm('Frase con pronunciación'),
  gramaticaConocida: tm('Palabras gramaticales y nombres como conocidos'),
  compuestos: tm('Verbos separables y frases hechas'),
  compuestosActivar: tm('Buscar verbos separables'),
  compuestosAyuda: tm('Y frases hechas que empiecen por la palabra'),
  flexionDe: tm('Forma de'),
  flexiones: tm('Forma de la palabra'),
  frecuenciaYAcento: tm('Frecuencia y pronunciación'),

  // Nivel y primeros pasos
  nivelPregunta: tm('¿Qué nivel de alemán tienes?'),
  nivelAyuda: tm('Las explicaciones se adaptan a tu nivel.'),
  vocabularioSuperado: tm('Ya superas el vocabulario habitual de C2.'),
  bienvenidaPagina: tm('Activa el lector en Ajustes: en cualquier texto en alemán, haz clic en una palabra. El botón del borde derecho ajusta los colores.'),
  primerVideo: tm('Abre uno con subtítulos en alemán y aparecerá la barra de Kotonoha. Si no tiene, arrastra tu archivo SRT sobre él.'),
  primeraPagina: tm('Activa el lector en Ajustes y, en cualquier página, haz clic en una palabra en alemán para ver su ficha.'),
  diccionariosResumen: tm('Wiktionary, pronunciación y frecuencia'),
  buscarAyuda: tm('Escríbela en alemán. También entiende formas conjugadas y declinadas, y frases enteras.'),
  pegarLista: tm('Pega una lista o cualquier texto en alemán.'),
  localArrastrar: tm('Arrastra aquí un video y sus subtítulos. Tendrás pronunciación, diccionario, tarjetas y Claude, y el video no sale de tu ordenador.'),
  seguirPortapapeles: tm('Añade aquí el alemán que copies en cualquier sitio, mientras esta pestaña esté a la vista.'),
  dictar: tm('Habla en alemán y Kotonoha lo escribe aquí, con tu grabación para volver a oírla.'),
  temaRelato: tm('Un gato que pasea por Berlín…'),
};
