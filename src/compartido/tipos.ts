// Tipos compartidos entre el motor, el content script y la ventana de la app.

import type { PuntoGramatica, SegmentoLectura, Transcripcion } from '../lenguas/tipos';
import type { Caja } from '../nucleo/ocr';
import type { Linea } from '../nucleo/subtitulos';

export type EstadoPalabra = 'desconocida' | 'aprendiendo' | 'conocida' | 'ignorada';

export const ESTADOS: EstadoPalabra[] = ['desconocida', 'aprendiendo', 'conocida', 'ignorada'];

/** Cómo va un punto de gramática: sin fila en la base, nuevo. Los sabidos no se señalan en los subtítulos. */
export type EstadoGramatica = 'nuevo' | 'aprendiendo' | 'sabido';

export const ESTADOS_GRAMATICA: EstadoGramatica[] = ['nuevo', 'aprendiendo', 'sabido'];

/** Dónde se vio un punto de gramática: un video, con la última frase y cuántas líneas distintas lo llevaban. */
export interface GramaticaVista {
  patron: string;
  fuente: string;
  titulo: string;
  url?: string;
  frase: string;
  veces: number;
  ultima: number;
}

/** Una opción falsa de una tarjeta de opción múltiple: otro punto que se confunde con el bueno, y por qué no va. */
export interface OpcionFalsa {
  patron: string;
  motivo: string;
}

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
  /** Los de caracteres son los de kanji: una ficha por carácter, no por palabra. */
  tipo: 'terminos' | 'frecuencia' | 'acento' | 'caracteres';
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
  /** `caracteres`: varios archivos que la lengua sabe juntar en fichas de carácter. */
  formato: 'yomitan' | 'kanjium' | 'lista' | 'caracteres';
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

/** Una palabra de la lista de un nivel, con lo que se sabe de ella. */
export interface PalabraNivel {
  clave: string;
  lema: string;
  lectura: string;
  /** La glosa de la lista, en inglés. */
  glosa: string;
  estado: EstadoPalabra;
  rastreada: boolean;
}

/** Un carácter de la lista de un nivel: sus lecturas y cuánto se conoce por las palabras que lo llevan. */
export interface CaracterNivel {
  caracter: string;
  on: string;
  kun: string;
  glosa: string;
  /** Conocido si alguna palabra conocida lo lleva; en aprendizaje si solo lo llevan palabras en aprendizaje. */
  estado: EstadoPalabra;
  /** Cuántas palabras conocidas o en aprendizaje lo llevan. */
  palabras: number;
}

/** Un punto de gramática de la lista de un nivel, con su significado en cada idioma de la interfaz que lo tenga. */
export interface GramaticaNivel {
  patron: string;
  significado: Record<string, string>;
}

/** Un carácter de una palabra, con el nivel del examen en que aparece si está en sus listas. */
export interface CaracterConNivel {
  caracter: string;
  nivel?: string;
  on: string;
  kun: string;
  glosa: string;
}

/** Una lectura de un carácter, con un punto donde empieza lo que va tras él: あ.げる. */
export interface LecturaCaracter {
  texto: string;
  /** De dónde viene, como lo nombra la lengua: en japonés, la época en que llegó de China (呉, 漢, 唐) o 慣. */
  origen?: string;
  /** Oficial, pero solo para unas pocas palabras. */
  poco?: boolean;
}

/** Las lecturas de una clase: las de la lista oficial de la lengua y las demás. */
export interface LecturasCaracter {
  oficiales: LecturaCaracter[];
  otras: LecturaCaracter[];
}

/** Lo que el diccionario de caracteres sabe de uno: el de kanji, en japonés. */
export interface FichaCaracter {
  caracter: string;
  /** Por idioma de la interfaz. El inglés casi siempre está; los demás, según el diccionario. */
  significados: Record<string, string[]>;
  on: LecturasCaracter;
  kun: LecturasCaracter;
  /** Las lecturas que solo se usan en nombres de persona. */
  nombres: string[];
  trazos?: number;
  /** En qué lista oficial está: kyoiku-1 a kyoiku-6, joyo, jinmeiyo, jinmeiyo-antigua, hyogai o hyogai-antigua. */
  lista?: string;
  nivel?: string;
  /** El nivel del examen de kanji: de 10 (el más fácil) a 1, con pre-2 y pre-1 entre medias. */
  kanken?: string;
  /** Su puesto entre los más usados. */
  frecuencia?: number;
  /** Cómo se formó: pictograma, indicativo, compuesto o fonosemantico. */
  formacion?: string;
  radical?: {
    caracter: string;
    /** La forma que toma en este carácter, si no es la de siempre: 氵 en 漢. */
    forma?: string;
    numero: number;
    nombres: string[];
    significado: string;
  };
  /** La pieza que le da el sonido. Si es él mismo, es que da su sonido a otros. */
  fonetico?: string;
  /** Si da su sonido a otros: qué sonido y si se cumple siempre, casi siempre o con varias lecturas. */
  daSonido?: { lecturas: string[]; tipo: 'siempre' | 'casi' | 'varias' };
  variantes: {
    /** Las formas de antes de la reforma de 1946 (旧字体). */
    antiguas: string[];
    /** Si él es una forma antigua: la de hoy. */
    nuevas: string[];
    otras: string[];
    /** En chino, si se escribe distinto: la tradicional (Taiwán) y la simplificada (China continental). */
    tradicional?: string;
    simplificada?: string;
  };
  /** Las piezas que lleva dentro, a cualquier profundidad: así se encuentran los caracteres que llevan una. */
  piezas: string[];
  /** Si es un radical, las formas que toma como pieza: 氵 y 氺 de 水. */
  formasComoPieza: string[];
  opuestos: string[];
  sinonimos: string[];
  parecidos: string[];
  /** Los que se leen igual con una de sus lecturas propias de la lengua: あがる, con 挙 y 揚. */
  homonimos: { lectura: string; caracteres: string[]; mismoAcento: boolean }[];
  /** Cómo se lee en otras lenguas que lo usan, por idioma: el pinyin en chino, el hangul en coreano. */
  enOtrasLenguas: Record<string, string>;
}

/** Un carácter emparentado con otro, con lo justo para reconocerlo: su lectura principal y lo que significa. */
export interface CaracterBreve {
  caracter: string;
  lectura?: string;
  significados: Record<string, string[]>;
  frecuencia?: number;
  lista?: string;
}

/** Un punto de gramática encontrado al buscar, con su nivel. */
export interface PuntoEncontrado {
  nivel: string;
  g: GramaticaNivel;
}

export interface ListaNivel {
  nivel: string;
  palabras: PalabraNivel[];
  caracteres: CaracterNivel[];
  gramatica: GramaticaNivel[];
}

/** Cuánto se conoce de un nivel. */
export interface ResumenNivel {
  nivel: string;
  palabras: { total: number; conocidas: number; aprendiendo: number };
  caracteres: { total: number; conocidas: number; aprendiendo: number };
  gramatica: { total: number };
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
  /** El texto de una nota del Cuaderno, que se va guardando mientras se escribe. */
  texto?: string;
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
