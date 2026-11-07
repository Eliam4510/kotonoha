// Lo que una lengua le da al programa. Todo lo que depende de la lengua que se estudia vive en un paquete de
// src/lenguas/<lengua>, y el resto del programa solo conoce estas interfaces. No confundir con idiomas/, que son
// los idiomas de la interfaz: se puede estudiar japonés con la interfaz en alemán.
//
// PaqueteLengua es ligero y lo usan todas las pantallas, también el content script que corre en cada página.
// MotorLengua trae lo que pesa más (analizador, reglas, prompts) y solo se carga donde hace falta.

import type { ModoLectura, PromptPersonalizado } from '../compartido/ajustes';
import type { EntradaDiccionario, FuenteBiblioteca, ResultadoAudio } from '../compartido/tipos';
import type { ReglasTranscripcion } from '../nucleo/transcripcion';
import type { DatosTrazos } from '../nucleo/trazos';

// ---------- Palabras ----------

/** Un trozo de palabra y lo que se escribe encima para leerlo: furigana, en japonés. */
export interface SegmentoLectura {
  texto: string;
  lectura?: string;
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
  /** Si los títulos de las portadas de la biblioteca se escriben en vertical. */
  portadaVertical: boolean;
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
}

/** El acento de las palabras, si la lengua lo marca. */
export interface AcentoLengua {
  /** El nombre del patrón: colorea la palabra con la clase `ac-<patrón>`. */
  patron(posicion: number, lectura: string): string;
  moras(lectura: string): string[];
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
  formatoAyuda: string;
  lecturaCampo: string;
  fraseConLectura: string;
  gramaticaConocida: string;
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
  temaRelato: string;
}

export interface PaqueteLengua {
  /** Código de la lengua: el atributo lang, las pistas de subtítulos y el orden alfabético. */
  id: string;
  /** Código con región: las voces. */
  bcp47: string;
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
}

// ---------- Lo pesado: el motor ----------

export interface Analizador {
  listo(): boolean;
  /** Se llama antes de analizar nada, y las veces que haga falta: puede tardar la primera. */
  cargar(): Promise<void>;
  /**
   * Parte un texto en palabras. Sus superficies juntas deben dar el texto, también con los espacios.
   * `existe` dice si un término está en los diccionarios, para unir compuestos.
   */
  analizar(texto: string, existe?: (termino: string) => boolean): TokenUnido[];
  /** La lectura de una forma de diccionario: una palabra flexionada no trae la de su lema. */
  lecturaDeLema(lema: string): string;
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
  /** De otro idioma a esta lengua. */
  aLengua: string;
  imagen: string;
  glosa(idioma: string): string;
  revisarLectura(idioma: string): string;
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
}
