// Tipos compartidos entre el motor, el content script y la ventana de la app.

import type { PuntoGramatica, SegmentoLectura, Transcripcion } from '../lenguas/tipos';
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
