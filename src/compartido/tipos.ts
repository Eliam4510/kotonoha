// Tipos compartidos entre el motor, el content script y la ventana de la app.

import type { PuntoGramatica, SegmentoLectura, Transcripcion } from '../lenguas/tipos';
import type { Caja } from '../nucleo/ocr';
import type { Linea } from '../nucleo/subtitulos';

export type EstadoPalabra = 'desconocida' | 'aprendiendo' | 'conocida' | 'ignorada';

export const ESTADOS: EstadoPalabra[] = ['desconocida', 'aprendiendo', 'conocida', 'ignorada'];

/** Palabra de una línea, ya enriquecida con datos del diccionario y tu estado. */
export interface PalabraToken {
  superficie: string;
  lema: string;
  lectura: string;
  lecturaLema: string;
  clave: string;
  esPalabra: boolean;
  esGramatica: boolean;
  flexion: string[];
  furigana: SegmentoLectura[];
  estado: EstadoPalabra;
  rastreada: boolean;
  patron?: string;
  acentos?: number[];
  rango?: number; // Posición en la lista de frecuencia
  glosa?: string; // Traducción corta para mostrar debajo de la palabra
  sentido?: string; // Sentido en esta frase cuando no es el primero del diccionario
  uso?: string; // literal, figurado, poético...
  lecturaCorregida?: boolean; // Claude corrigió la lectura del tokenizador
  pronunciacion?: string; // Cómo suena su forma de diccionario, donde se guarda aparte: lectura.visible sabe escribirla
}

export type LineaAnalizada = Linea & { palabras: PalabraToken[]; gramatica?: PuntoGramatica[] };

export interface SentidoEnContexto {
  significado: string;
  uso: string;
  nota: string;
  definicion: number;
}

export interface PistaInfo {
  id: string;
  idioma: string; // Código BCP-47 en minúsculas
  nombre: string;
  automatica?: boolean; // Generada por el sitio (ASR)
  cc?: boolean;
  origen: 'sitio' | 'importada' | 'claude' | 'whisper' | 'recordada' | 'letra';
}

export interface EntradaDiccionario {
  dic: string;
  dicTitulo: string;
  termino: string;
  lectura: string;
  glosas: string[];
  tags: string;
  /** Número de entrada en JMdict: permite enlazar a la entrada exacta en otros diccionarios. */
  seq?: number;
}

export interface EtiquetaFrecuencia {
  lista: string;
  rango: number;
  texto?: string;
}

export interface ResultadoBusqueda {
  lema: string;
  lectura: string;
  clave: string;
  estado: EstadoPalabra;
  rastreada: boolean;
  acentos: number[];
  pronunciaciones?: Transcripcion[];
  patron?: string;
  frecuencias: EtiquetaFrecuencia[];
  entradas: EntradaDiccionario[];
}

export interface InfoDiccionario {
  id: string;
  titulo: string;
  tipo: 'terminos' | 'frecuencia' | 'acento';
  idioma?: string;
  orden: number;
  filas: number;
  fuente?: string;
  instalado: number;
}

export interface FuenteBiblioteca {
  id: string;
  titulo: string;
  descripcion: string;
  tipo: InfoDiccionario['tipo'];
  idioma?: string;
  url: string;
  formato: 'yomitan' | 'kanjium' | 'lista';
  recomendado: boolean;
  licencia: string;
}

export interface ProgresoInstalacion {
  id: string;
  titulo: string;
  fase: 'descargando' | 'leyendo' | 'guardando' | 'listo' | 'error';
  avance: number; // 0 a 1
  error?: string;
}

export interface EstadisticasPalabras {
  conocidas: number;
  aprendiendo: number;
  rastreadas: number;
  ignoradas: number;
}

export interface FilaPalabra {
  clave: string;
  lema: string;
  lectura: string;
  estado: EstadoPalabra;
  rastreada: boolean;
  actualizada: number;
  rango?: number;
}

export interface FraseEjemplo {
  texto: string;
  traduccion?: string;
  fuente?: string;
  url?: string;
  inicio?: number;
}

/** Contenido de una tarjeta en el creador. */
export interface BorradorTarjeta {
  tipo: 'frase' | 'palabra';
  palabra: string;
  lectura: string;
  frase: string;
  fraseFurigana?: string;
  traduccion: string;
  definicion: string;
  audioFrase: MedioTarjeta[];
  audioPalabra: MedioTarjeta[];
  imagenes: MedioTarjeta[];
  ejemplos: string;
  notas: string;
  fuente?: string;
  url?: string;
  etiquetas?: string[];
}

export interface MedioTarjeta {
  id: string;
  nombre: string;
  tipo: string; // audio/mpeg, image/jpeg...
  datos?: string; // base64
  url?: string;
  etiqueta?: string;
}

export interface ResultadoAudio {
  etiqueta: string;
  url: string;
  origen: string;
}

export interface ResultadoImagen {
  url: string;
  miniatura: string;
  titulo?: string;
}

export interface ContextoIA {
  lema?: string;
  lectura?: string;
  superficie?: string;
  frase?: string;
  titulo?: string;
  antes?: string[]; // Líneas o párrafos anteriores a la frase
  despues?: string[]; // Líneas o párrafos posteriores
  traduccion?: string; // Traducción disponible de la frase
  guion?: string; // Texto completo del video o de la página
}

/** Una imagen para Claude, en base64. */
export interface ImagenIA {
  tipo: 'image/jpeg' | 'image/png' | 'image/webp';
  datos: string;
}

/** Lo que se manda a Claude para revisar el texto que leyó el OCR de una página: sus líneas y la imagen de la página. */
export interface PeticionRevisionOcr {
  libro: string;
  titulo?: string;
  pagina: number;
  /** Si cada línea es un globo de un manga y no un renglón. */
  globos: boolean;
  lineas: string[];
  imagen: ImagenIA;
}

/** Un libro que se lee en el visor: un EPUB de imágenes o de texto, un CBZ o un PDF. */
export interface DocumentoBiblioteca {
  formato: 'epub' | 'cbz' | 'pdf';
  /** Un EPUB de texto, como una novela: se pinta con su propio formato, por capítulos, y no por páginas. */
  texto?: boolean;
  /** 0 mientras no se sepa: un PDF no se cuenta hasta abrirlo en el visor. En un EPUB de texto, sus capítulos. */
  paginas: number;
  /** En un EPUB de texto, por dónde se va dentro del capítulo, de 0 a 1. */
  posicion?: number;
  /** En un EPUB de texto vertical, si se prefiere leerlo en horizontal. */
  horizontal?: boolean;
  direccion: 'rtl' | 'ltr';
  /** Lo que ocupa el archivo, que se guarda aparte, en el almacenamiento privado del navegador. */
  tamano: number;
  /** La primera página en pequeño, como imagen JPEG en una URL de datos. */
  portada?: string;
  vista?: 'una' | 'doble' | 'continua';
  /** En doble página, si la portada va sola para que las parejas queden como en el libro. */
  portadaSola?: boolean;
  /** Las páginas apaisadas (una doble página escaneada de una pieza), que en doble página van solas. Solo en los ZIP. */
  anchas?: number[];
  /** «ancho», «pagina» o un porcentaje. En un EPUB de texto, siempre un porcentaje. */
  zoom?: 'ancho' | 'pagina' | number;
  /** En un libro de páginas, si se lee como texto, en párrafos, en lugar de ver la imagen de cada página. */
  vistaTexto?: boolean;
  /**
   * Si se lee el texto de las páginas con el OCR, y con qué modelos: los de libro impreso o los de manga. En un PDF con su
   * propio texto, textoPdf false hace que el OCR lea también esas páginas (la capa de un OCR antiguo); sin él, se usa el
   * texto del PDF.
   */
  ocr?: { activo: boolean; modo: 'libro' | 'manga'; textoPdf?: boolean };
  /**
   * Si se leyó el libro entero con el OCR por adelantado, y cómo: con otro modo, sin «Texto del PDF» o con una lectura
   * anterior a la que pide su formato (paginasOcr.ts), no vale.
   */
  procesado?: { modo: 'libro' | 'manga'; textoPdf: boolean; lectura?: number };
}

export interface ElementoBiblioteca {
  id: string;
  titulo: string;
  autor?: string;
  texto: string;
  origen: 'pegado' | 'archivo' | 'historia';
  creado: number;
  abierto?: number;
  pagina?: number;
  comprension?: number;
  documento?: DocumentoBiblioteca;
  /** La colección en que está, si está en una. */
  coleccion?: string;
  /** Cuándo se terminó de leer: al llegar a la última página, o al marcarlo a mano. */
  terminado?: number;
}

/**
 * Un cambio de algunos campos de un elemento de la biblioteca, que se aplica sobre lo último guardado: así el visor, que
 * guarda por dónde se va, no deshace lo que se cambió en la estantería mientras tanto. null quita el campo.
 */
export interface CambioBiblioteca {
  titulo?: string;
  pagina?: number;
  abierto?: number;
  coleccion?: string | null;
  terminado?: number | null;
  documento?: Partial<DocumentoBiblioteca>;
}

export type ColorAnotacion = 'amarillo' | 'verde' | 'azul' | 'rosa';

/**
 * Lo que se anota en un libro de páginas, como en un lector de PDF: un marcador en una página, un resaltado o un subrayado
 * de un tramo de una línea, con un comentario si se quiere, o una nota suelta en un punto de la página. Un resaltado guarda
 * dónde está en la imagen de la página: así sigue en su sitio aunque el OCR vuelva a leerla.
 */
export interface AnotacionLibro {
  id: string;
  libro: string;
  tipo: 'marcador' | 'resaltado' | 'nota';
  pagina: number;
  /** Resaltado: lo que ocupa en la página, en fracciones, y la caja de su línea entera. */
  cajas?: Caja[];
  linea?: Caja;
  /** Resaltado: lo resaltado, tal cual se leía. */
  texto?: string;
  /** Resaltado: de fondo o subrayado, y si la línea va en vertical (el subrayado va entonces a su derecha). */
  estilo?: 'fondo' | 'subrayado';
  vertical?: boolean;
  color?: ColorAnotacion;
  /** Nota suelta: dónde está en la página, en fracciones. */
  punto?: { x: number; y: number };
  /** El texto de una nota, o el comentario de un resaltado. */
  nota?: string;
  creada: number;
}

/** Qué clase de colección es. En una de manga o de novelas, sus libros son tomos. */
export type TipoColeccion = 'manga' | 'novela' | 'estudio' | 'otro';

/** Una colección de la estantería: una serie con sus tomos, o los libros de un tema. */
export interface ColeccionBiblioteca {
  id: string;
  nombre: string;
  tipo?: TipoColeccion;
  descripcion?: string;
  /** La portada elegida, en pequeño (JPEG en una URL de datos). Sin ella, la del primer libro que tenga portada. */
  portada?: string;
  creada: number;
}

export interface TarjetaMemoria {
  id: string;
  mazo: string;
  frente: string;
  reverso: string;
  borrador: BorradorTarjeta;
  creada: number;
  fsrs: Record<string, unknown>;
  vence: number;
}

export interface EstadoAnki {
  conectado: boolean;
  version?: number;
  mazos: string[];
  modelos: string[];
  error?: string;
}
