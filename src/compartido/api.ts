// Contratos de las llamadas entre contextos.

import type { Linea } from '../nucleo/subtitulos';
import type {
  BorradorTarjeta,
  ContextoIA,
  ElementoBiblioteca,
  EstadisticasPalabras,
  EstadoAnki,
  EstadoPalabra,
  FilaPalabra,
  FraseEjemplo,
  FuenteBiblioteca,
  InfoDiccionario,
  LineaAnalizada,
  PalabraToken,
  ProgresoInstalacion,
  ResultadoAudio,
  ResultadoBusqueda,
  ResultadoImagen,
  SentidoEnContexto,
  TarjetaMemoria,
} from './tipos';

/** Puerto con el que el motor habla con el ayudante local, a través del service worker. */
export const PUERTO_AYUDANTE = 'kotonoha-ayudante';
export const HOST_AYUDANTE = 'com.kotonoha.ayudante';

export interface InfoAyudante {
  version: number;
  ytdlp: string | null;
  ffmpeg: boolean;
}

export interface EstadoMotor {
  tokenizadorListo: boolean;
  diccionarios: InfoDiccionario[];
  terminosCargados: number;
  claveIA: boolean;
  capturaActiva: boolean;
}

export interface FiltroPalabras {
  estado?: EstadoPalabra | 'todas';
  rastreada?: boolean;
  busqueda?: string;
  orden?: 'reciente' | 'alfabetico' | 'frecuencia';
  limite?: number;
  desde?: number;
}

export interface CambioPalabra {
  clave: string;
  lema: string;
  lectura: string;
  estado?: EstadoPalabra;
  rastreada?: boolean;
}

export interface ApiMotor {
  estado(): Promise<EstadoMotor>;
  fijarClaveIA(clave: string, urlBase?: string): Promise<void>;
  probarIA(): Promise<string>;

  analizarLineas(lineas: Linea[], fuente?: { titulo?: string; url?: string; idVideo?: string }): Promise<LineaAnalizada[]>;
  analizarTexto(texto: string): Promise<PalabraToken[][]>;

  buscar(lema: string, lectura?: string): Promise<ResultadoBusqueda>;
  buscarLibre(texto: string): Promise<ResultadoBusqueda[]>;
  compuestos(palabras: string[]): Promise<ResultadoBusqueda[]>;
  ejemplos(lema: string): Promise<FraseEjemplo[]>;

  cambiarPalabras(cambios: CambioPalabra[]): Promise<void>;
  anadirConocidas(texto: string): Promise<number>;
  estadisticasPalabras(): Promise<EstadisticasPalabras>;
  listarPalabras(filtro: FiltroPalabras): Promise<{ filas: FilaPalabra[]; total: number }>;
  muestraEvaluacion(): Promise<{ lema: string; lectura: string; rango: number }[]>;
  aplicarEvaluacion(rangoEstimado: number): Promise<number>;
  importarConocidasAnki(consulta: string, campo: string): Promise<number>;

  fuentesDiccionario(): Promise<FuenteBiblioteca[]>;
  instalarDiccionario(idFuente: string): Promise<void>;
  instalarArchivo(urlBlob: string, nombre: string): Promise<void>;
  eliminarDiccionario(id: string): Promise<void>;
  ordenarDiccionarios(ids: string[]): Promise<void>;

  anki(): Promise<EstadoAnki>;
  ankiPermiso(): Promise<EstadoAnki>;
  ankiCamposModelo(modelo: string): Promise<string[]>;
  ankiCrearModeloPropio(): Promise<void>;
  ankiTieneTarjeta(palabra: string): Promise<number[]>;
  ankiVerTarjeta(palabra: string): Promise<void>;

  crearTarjeta(b: BorradorTarjeta, destino?: 'anki' | 'memoria'): Promise<string>;

  iniciarCaptura(streamId: string): Promise<void>;
  detenerCaptura(): Promise<void>;
  empezarClip(): Promise<void>;
  terminarClip(): Promise<{ datos: string; tipo: string } | null>;
  whisperMarca(ms: number, reproduciendo: boolean, velocidad: number, salto: boolean): Promise<void>;
  /** Null si el ayudante local no está instalado. */
  ayudante(): Promise<InfoAyudante | null>;
  whisperDetener(): Promise<void>;
  whisperPausar(pausado: boolean): Promise<void>;
  whisperCapturaPrueba(): Promise<void>;
  whisperOcupacionPrueba(ocupacion: number | null): Promise<void>;
  whisperPerderGpuPrueba(): Promise<void>;
  recortarImagen(dataUrl: string, rect: { x: number; y: number; w: number; h: number; escala: number }): Promise<string>;

  audiosPalabra(lema: string, lectura: string): Promise<ResultadoAudio[]>;
  vozFrase(texto: string, voz: string): Promise<string>;
  descargarMedio(url: string): Promise<{ datos: string; tipo: string }>;
  imagenes(consulta: string): Promise<ResultadoImagen[]>;
  consultaImagen(lema: string, frase?: string): Promise<string>;
  generarFraseEjemplo(lema: string): Promise<string>;
  traducirBreve(texto: string): Promise<string>;
  glosaBreve(lema: string, frase?: string): Promise<string>;
  sentidoEnContexto(c: ContextoIA, definiciones: string[], recargar?: boolean): Promise<SentidoEnContexto>;
  revisarLectura(c: ContextoIA, texto: string): Promise<{ lectura: string; lema: string; lectura_lema: string; motivo: string }>;
  corregirLectura(texto: string, c: { superficie: string; lectura: string; lema?: string; lectura_lema?: string }): Promise<void>;

  bibliotecaListar(): Promise<ElementoBiblioteca[]>;
  bibliotecaGuardar(e: ElementoBiblioteca): Promise<void>;
  bibliotecaEliminar(id: string): Promise<void>;
  bibliotecaObtener(id: string): Promise<ElementoBiblioteca | undefined>;

  memoriaPendientes(limite: number): Promise<TarjetaMemoria[]>;
  memoriaResumen(): Promise<{ total: number; pendientes: number; nuevas: number }>;
  memoriaResponder(id: string, nota: 1 | 2 | 3 | 4): Promise<void>;
  memoriaEliminar(id: string): Promise<void>;

  exportarDatos(): Promise<string>;
  importarDatos(json: string): Promise<void>;
  guardarSubtitulosGenerados(idVideo: string, idioma: string, lineas: Linea[], origen?: string): Promise<void>;
  subtitulosGenerados(idVideo: string): Promise<{ idioma: string; lineas: Linea[]; origen?: string; creado: number }[]>;
  correccionesPista(clave: string): Promise<{ cambios: Record<number, string>; completa: boolean } | undefined>;
  guardarCorreccionesPista(clave: string, cambios: Record<number, string>, completa: boolean): Promise<void>;
}

export interface ApiFondo {
  asegurarMotor(): Promise<void>;
  claveIA(): Promise<string | null>;
  urlBaseIA(): Promise<string | null>;
  ajustesCompletos(): Promise<unknown>;
  capturaVisible(): Promise<string>;
  alternarCaptura(): Promise<boolean>;
  capturaActiva(): Promise<boolean>;
  abrirApp(ruta?: string): Promise<void>;
  difundir(evento: EventoDifundido): Promise<void>;
  inyectarPagina(): Promise<void>;
  miPestana(): Promise<number | undefined>;
  estadoUso(): Promise<'active' | 'idle' | 'locked'>;
}

export type EventoDifundido =
  | { tipo: 'palabras'; cambios: CambioPalabra[] }
  | { tipo: 'palabrasRecargar' }
  | { tipo: 'instalacion'; progreso: ProgresoInstalacion }
  | { tipo: 'diccionarios' }
  | { tipo: 'captura'; activa: boolean }
  | { tipo: 'comando'; comando: string }
  | { tipo: 'borrador'; borrador: Partial<BorradorTarjeta> };
