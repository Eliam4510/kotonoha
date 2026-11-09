// Lo que una lengua le da al programa. Todo lo que depende de la lengua que se estudia vive en un paquete de
// src/lenguas/<lengua>, y el resto del programa solo conoce estas interfaces. No confundir con idiomas/, que son
// los idiomas de la interfaz: se puede estudiar japonés con la interfaz en alemán.
//
// PaqueteLengua es ligero y lo usan todas las pantallas, también el content script que corre en cada página.
// MotorLengua trae lo que pesa más (analizador, reglas, prompts) y solo se carga donde hace falta.

import type { AjustesLengua, ModoLectura, PromptPersonalizado } from '../compartido/ajustes';
import type { EntradaDiccionario, FuenteBiblioteca, PalabraToken, ResultadoAudio } from '../compartido/tipos';
import type { FraseAcentual } from '../nucleo/practicaAcento';
import type { ReglasTranscripcion } from '../nucleo/transcripcion';
import type { FrecuenciaImportada, PronunciacionImportada } from '../nucleo/yomitan';
import type { DatosTrazos } from '../nucleo/trazos';

// ---------- Palabras ----------

/** Un trozo de palabra y lo que se escribe encima para leerlo: furigana, en japonés. */
export interface SegmentoLectura {
  texto: string;
  lectura?: string;
}

/** De qué palabra del diccionario sale una forma, según el diccionario: ging, de gehen en pretérito. */
export interface FormaFlexionada {
  lema: string;
  /** Qué forma es, tal como la describe el diccionario: «first/third-person singular preterite». */
  flexion: string;
  /** La categoría de la palabra en el diccionario: v, n, adj. */
  pos: string;
}

/** Lo que el motor sabe de los diccionarios instalados y puede servir para analizar, en las lenguas que lo usan. */
export interface ConsultasAnalisis {
  /** De qué palabras puede salir una forma flexionada. */
  formas?(palabra: string): readonly FormaFlexionada[] | undefined;
  /** El puesto de una palabra en la lista de frecuencia: cuanto menor, más común. */
  rango?(termino: string): number | undefined;
}

/** Una palabra tal como la entrega el analizador, antes de mirar diccionarios y progreso. */
export interface TokenUnido {
  superficie: string;
  lema: string;
  lectura: string; // Lectura de la superficie
  categoria: string; // Categoría gramatical según el analizador
  esPalabra: boolean;
  esGramatica: boolean; // Partículas y auxiliares sueltos
  flexion: string[]; // Colas unidas: た, ない, ている...
  furigana: SegmentoLectura[];
  inflexionado: boolean; // La superficie no coincide con el lema
}

/** Cómo se pronuncia una palabra en una zona, en alfabeto fonético: /ɡoʊ/ en «us». */
export interface Transcripcion {
  zona: string;
  ipa: string;
}

export interface PuntoGramatica {
  patron: string;
  nivel?: string;
  fragmento: string;
  significado: string;
  fuente: 'regla' | 'ia';
}

// ---------- Lo ligero: pantallas y páginas ----------

/** Cuánto hay en un texto de lo que delata a la lengua. */
export interface RecuentoEscritura {
  /** Caracteres que solo se usan en esta lengua. */
  propios: number;
  /** Caracteres que comparte con otras. */
  compartidos: number;
}

/** Cómo se sabe que un texto está en esta lengua, y cómo se corta y se pinta. */
export interface EscrituraLengua {
  /** Si hay algo escrito en esta lengua. Es rápido: se usa con cada selección de texto. */
  tieneTexto(texto: string): boolean;
  /** Si merece la pena analizar un texto, según lo que declara la página y lo visto en ella. */
  esDeLaLengua(texto: string, idiomaDeclarado: string | undefined, paginaEnLengua: boolean): boolean;
  contar(texto: string): RecuentoEscritura;
  /** Si lo contado en una página basta para decir que está en esta lengua. */
  paginaEnLengua(recuento: RecuentoEscritura): boolean;
  /** Dónde termina una frase. */
  frase: SignosFrase;
  /** Si una selección parece una frase, y no una palabra suelta. */
  pareceFrase(texto: string): boolean;
  /** Lo que separa las palabras de una lista. */
  separadorLista: string;
  /** Un trozo de texto citado, con las comillas de la lengua. */
  comillar(texto: string): string;
  /** Evita que un signo quede solo al principio de una línea. */
  pegarSignos(signos: string): string;
  /** Si las palabras se separan con espacios: entonces dos elementos pegados nunca forman una palabra. */
  palabrasSeparadas?: boolean;
  /** Si los títulos de las portadas de la biblioteca se escriben en vertical. */
  portadaVertical: boolean;
  /**
   * Cómo se leen los globos en el modo Manga del visor: con manga-ocr, el modelo del manga japonés, de derecha a
   * izquierda; o, en un cómic, con el reconocedor de libros dentro de cada globo, de izquierda a derecha.
   */
  globos: 'manga-ocr' | 'lector';
  /**
   * Lo que abre un elemento de una lista o de un ejercicio al principio de un renglón y es propio de la lengua, además de
   * lo que vale para todas ((1), 1., ①, una viñeta): en japonés, «・» o «問5».
   */
  marcaDeLista?: RegExp;
}

export interface SignosFrase {
  /** Un signo que termina una frase. */
  fin: RegExp;
  /** Lo que puede ir pegado detrás de él, como unas comillas. */
  cierres: RegExp;
  /** Para partir un párrafo en frases, dejando cada signo con la suya. */
  partir: RegExp;
  /** Por dónde conviene cortar un texto demasiado largo, si no hay otro remedio. */
  cortes: string[];
}

/** Lo que se escribe encima de las palabras para leerlas. */
export interface LecturaLengua {
  /**
   * Si la lectura forma parte de la palabra: 生 se lee なま o せい, y son dos palabras. Si no, es solo cómo suena: no se
   * corrige a mano, no va en la frase de las tarjetas y no cuenta al buscar.
   */
  distingue: boolean;
  /** Las formas de escribirla que se pueden elegir, con una muestra de cada una. */
  formatos: { id: string; muestra: string }[];
  formatoInicial: string;
  /** La forma para quien aún no lee la escritura de la lengua, si la hay. */
  formatoSencillo?: { id: string; pregunta: string; etiqueta: string };
  /** La lectura como la quiere ver cada cual. */
  visible(lectura: string, formato: string | undefined): string;
  /** Reparte la lectura sobre las partes de la palabra que la necesitan. */
  segmentar(superficie: string, lectura: string): SegmentoLectura[];
  /** La forma en que se guardan las lecturas, para poder compararlas. */
  normalizar(lectura: string): string;
  /** Si un texto está escrito solo con lo que se usa para las lecturas, y por tanto se puede buscar por ellas. */
  esSoloLectura(texto: string): boolean;
  /** Ancho de un carácter de la lectura respecto a su tamaño, para saber si cabe. */
  anchoCaracter(formato: string): number;
  /** Si la lectura es la pronunciación guardada, cómo se escribe sobre la palabra. `visible` sabrá leerlo. */
  dePronunciacion?(transcripciones: Transcripcion[]): string;
}

/** El acento de las palabras, si la lengua lo marca. */
export interface AcentoLengua {
  /** El nombre del patrón: colorea la palabra con la clase `ac-<patrón>`. Sin patrón, no se colorea. */
  patron(posicion: number, lectura: string): string | undefined;
  /** Las moras de una palabra, si el acento se dibuja como una curva sobre ellas. */
  moras?(lectura: string): string[];
  /** Qué significa cada color. */
  leyenda: { clase: string; nombre: string }[];
  /** La práctica del acento con el micrófono: las frases acentuales de una frase analizada. Sin esto, no se ofrece. */
  practica?: {
    frases(palabras: PalabraToken[]): FraseAcentual[];
    /** Lo que se puede juzgar sin el diccionario de acento instalado; `{0}` es el nombre del diccionario. */
    sinDiccionario: string;
  };
}

export interface NivelLengua {
  /** Lo que se guarda en los ajustes y se le dice a Claude. */
  valor: string;
  /** Cómo se llama en la interfaz. */
  nombre: string;
  /** Qué sabe hacer quien está en este nivel. */
  ayuda: string;
  /** Qué palabras llevan lectura al empezar con este nivel. */
  lectura: ModoLectura;
  /** Vocabulario que suele asociarse a este nivel. Cifra orientativa: sin ella, no sale en el sendero. */
  palabras?: number;
}

/** Ejemplos que la interfaz enseña en la lengua que se estudia. */
export interface EjemplosLengua {
  palabra: string;
  lectura: string;
  busqueda: string;
  /** Palabras para probar el diccionario. */
  sugerencias: string[];
  pegarTexto: string;
  escribir: string;
  lista: string;
  /** Un texto para probar el lector. */
  texto: string;
  /** La letra que representa el tamaño del texto. */
  letra: string;
}

/** Una página donde consultar una palabra. Con sus entradas de diccionario puede abrir justo la acepción. */
export interface EnlaceLengua {
  nombre: string;
  url(palabra: string, entradas: EntradaDiccionario[]): string;
}

/** Sitios para practicar la lectura. Los niveles son los de la pantalla de inicio. */
export interface SitioLectura {
  nivel: string;
  nombre: string;
  url: string;
}

export interface VozLengua {
  id: string;
  nombre: string;
}

/** Las frases de la interfaz que nombran la lengua o su escritura. Son frases enteras: ninguna se compone con trozos. */
export interface TextosLengua {
  nombre: string;
  lectura: string;
  subtitulos: string;
  sinSubtitulos: string;
  soltarSubtitulos: string;
  mostrar: string;
  mostrarUOcultar: string;
  tamano: string;
  velo: string;
  atajos: string;
  desfase: string;
  antes: string;
  despues: string;
  primeroElige: string;
  primeroNecesitas: string;
  crearDesdeOtro: string;
  crearDesdeOtroAyuda: string;
  traducirPista: string;
  traducirA: string;
  traduccionLista: string;
  whisperAyuda: string;
  whisperCorregirAyuda: string;
  corregirResultado: string;
  revisionAyuda: string;
  lectorAyuda: string;
  lectorResumen: string;
  lectorActivar: string;
  lectorPegar: string;
  lectorBotonAyuda: string;
  separarLineas: string;
  separarLineasAyuda: string;
  formatoTitulo: string;
  formatoAyuda: string;
  lecturaCampo: string;
  fraseConLectura: string;
  gramaticaConocida: string;
  compuestos: string;
  compuestosActivar: string;
  compuestosAyuda: string;
  flexionDe: string;
  flexiones: string;
  frecuenciaYAcento: string;
  nivelPregunta: string;
  nivelAyuda: string;
  vocabularioSuperado: string;
  bienvenidaPagina: string;
  primerVideo: string;
  primeraPagina: string;
  diccionariosResumen: string;
  buscarAyuda: string;
  pegarLista: string;
  localArrastrar: string;
  seguirPortapapeles: string;
  /** La ayuda del botón «Dictar» del Portapapeles. */
  dictar: string;
  temaRelato: string;
}

export interface PaqueteLengua {
  /** Código de la lengua: el atributo lang, las pistas de subtítulos y el orden alfabético. */
  id: string;
  /** Código con región: las voces. */
  bcp47: string;
  /** Su nombre, escrito en ella misma. */
  nombrePropio: string;
  /** Una palabra para probar el diccionario al elegirla, y lo que se aprende con ella. */
  presentacion: string;
  /** La tipografía de lo escrito en esta lengua, como valor de CSS. */
  letra: string;
  /** Con qué ajustes empieza quien la elige por primera vez. */
  ajustes: Partial<AjustesLengua>;
  /** Palabras que en un título delatan una canción en esta lengua, además de las de siempre como «MV». */
  tituloDeCancion?: RegExp;
  /** Si las fichas del lector buscan también frases hechas que empiecen en la palabra. */
  frasesEnLector: boolean;
  /** Qué buscar para ilustrar una palabra, si no hace falta preguntárselo a Claude. */
  consultaImagen(lema: string, entradas: EntradaDiccionario[], definiciones: string[]): string | undefined;
  escritura: EscrituraLengua;
  lectura: LecturaLengua;
  acento?: AcentoLengua;
  /** Nombre legible de una cola de flexión: «pasado», «negativo». */
  nombreFlexion(cola: string): string | undefined;
  /** El orden de los trazos, si la lengua lo enseña. */
  trazos?: {
    /** Qué caracteres de una palabra se enseñan. */
    caracteres(palabra: string): string[];
    credito: { nombre: string; url: string; licencia: string };
  };
  /** Para quien empieza desde cero: va antes de los niveles. */
  principiante: NivelLengua;
  niveles: NivelLengua[];
  nivelInicial: string;
  /** El nivel guardado, tal como se enseña en pequeño. */
  nombreNivel(valor: string): string;
  /** Voces de Azure Speech. */
  voces: VozLengua[];
  vocesIniciales: string[];
  enlaces: EnlaceLengua[];
  sitiosLectura: SitioLectura[];
  ejemplos: EjemplosLengua;
  /** El saludo de la pantalla de inicio, en la lengua que se estudia. */
  saludo(hora: number, nombre: string): string;
  textos: TextosLengua;
  /** Temas que se proponen para generar un relato. */
  ideasRelato: string[];
}

// ---------- Lo pesado: el motor ----------

/** Cómo partir un texto, cuando no se quiere lo de siempre. */
export interface OpcionesAnalisis {
  /**
   * Con `false`, las expresiones del diccionario con una partícula dentro (雨が降る) quedan en sus palabras: para practicar
   * el acento, cada palabra lleva el suyo. Los compuestos sin partícula (お茶) se unen igual.
   */
  expresiones?: boolean;
}

export interface Analizador {
  listo(): boolean;
  /** Se llama antes de analizar nada, y las veces que haga falta: puede tardar la primera. */
  cargar(): Promise<void>;
  /**
   * Parte un texto en palabras. Sus superficies juntas deben dar el texto, también con los espacios.
   * `existe` dice si un término está en los diccionarios, para unir compuestos, y `consultas`, lo demás que se sabe de
   * ellos: de qué palabra sale cada forma y cuánto se usa.
   */
  analizar(texto: string, existe?: (termino: string) => boolean, consultas?: ConsultasAnalisis, opciones?: OpcionesAnalisis): TokenUnido[];
  /** La lectura de una forma de diccionario: una palabra flexionada no trae la de su lema. */
  lecturaDeLema(lema: string): string;
  /** Si sin la lista de términos solo se pierde algo menor: entonces se analiza sin esperar a que se cargue. */
  terminosOpcionales?: boolean;
}

export type TareaPrompt = 'explicar' | 'desglosar' | 'traducir' | 'generar' | 'historia' | 'preguntar' | 'gramatica';

/**
 * Lo que se le pide a Claude. Cambiar uno de estos textos deja sin valor las respuestas guardadas, que se pagarían otra
 * vez: por eso sus huellas están fijadas en las pruebas de cada paquete.
 */
export interface PromptsLengua {
  base: Record<TareaPrompt, PromptPersonalizado>;
  sentido: string;
  esquemaSentido: unknown;
  analisis: string;
  esquemaAnalisis: unknown;
  /** De esta lengua al idioma de la traducción. */
  subtitulos: string;
  correccion: string;
  esquemaCorrecciones: unknown;
  /** Coloca la letra verdadera de una canción sobre los tiempos de una transcripción. */
  letra: string;
  esquemaLetra: unknown;
  /** De otro idioma a esta lengua. */
  aLengua: string;
  imagen: string;
  glosa(idioma: string): string;
  revisarLectura(idioma: string): string;
  /** Revisa, con la imagen de la página delante, el texto que leyó el OCR de una página. */
  revisionOcr: string;
  esquemaRevisionOcr: unknown;
}

export interface TranscripcionLengua {
  /** Cómo llama Whisper a esta lengua. */
  idioma: string;
  reglas: ReglasTranscripcion;
}

/** Lo guardado que hace falta para saber si un diccionario quedó mal instalado. */
export interface DatosDiccionarios {
  diccionarios: { get(id: string): PromiseLike<unknown> };
  frecuencias: { get(clave: [string, string, string]): PromiseLike<{ rango: number } | undefined> };
}

export interface MotorLengua {
  analizador: Analizador;
  /** Gramática sin IA, para que funcione al instante y sin conexión. */
  detectarGramatica(texto: string): PuntoGramatica[];
  prompts: PromptsLengua;
  transcripcion: TranscripcionLengua;
  /** La biblioteca de diccionarios abiertos. */
  diccionarios: FuenteBiblioteca[];
  audios(lema: string, lectura: string): Promise<ResultadoAudio[]>;
  trazos?: {
    url(caracter: string): string;
    leer(archivo: string): DatosTrazos | null;
  };
  /** Los diccionarios que una versión anterior dejó mal: se reinstalan solos, en segundo plano. */
  diccionariosPorReparar?(datos: DatosDiccionarios): Promise<string[]>;
  /** Qué términos buscar a partir de la palabra consultada y las que la siguen. Sin esto, se unen sin espacios. */
  candidatosCompuestos?(superficies: string[], existe?: (termino: string) => boolean, consultas?: ConsultasAnalisis): string[];
  /**
   * Si las formas flexionadas que traen los diccionarios se guardan para analizar: así se sabe que ging es de gehen sin
   * un analizador propio. Con ellas se carga también la lista de frecuencia, que decide entre dos lemas posibles.
   */
  formasDeDiccionario?: boolean;
  /** Cómo se le enseña a Claude una palabra analizada. Sin esto, con su lectura entre paréntesis. */
  describirPalabra?(token: TokenUnido): string;
  /** La parte de una definición que cabe bajo una palabra. Sin esto, hasta el primer punto y coma. */
  recortarGlosa?(glosa: string): string;
  /** Si una entrada de diccionario es de la misma categoría que la palabra analizada, para elegir su traducción. */
  encajaCategoria?(reglas: string, categoria: string): boolean;
  /** Prepara una lista de frecuencia antes de guardarla: por ejemplo, para quedarse con las formas de diccionario. */
  prepararFrecuencias?(filas: FrecuenciaImportada[]): Promise<FrecuenciaImportada[]>;
  /** Lo que en los diccionarios de esta lengua no es la definición, además de lo que nunca lo es. */
  seccionesOmitidas?: ReadonlySet<string>;
  /** Convierte lo que trae un diccionario de pronunciación en lo que se guarda de cada palabra. */
  filaPronunciacion?(p: PronunciacionImportada): { termino: string; lectura: string; posiciones: number[]; transcripciones: Transcripcion[] } | null;
}
