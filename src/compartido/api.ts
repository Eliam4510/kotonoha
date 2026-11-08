// Contratos de las llamadas entre contextos.

import type { Ajustes } from './ajustes';
import type { FilaConsumo } from '../nucleo/precios';
import type { Linea } from '../nucleo/subtitulos';
import type { DatosTrazos } from '../nucleo/trazos';
import type {
  AnotacionLibro,
  BorradorTarjeta,
  CambioBiblioteca,
  ColeccionBiblioteca,
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
  PeticionRevisionOcr,
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
  /** Pasa a estudiar otra lengua sin esperar a la siguiente petición. */
  fijarLengua(id: string): Promise<void>;
  estado(): Promise<EstadoMotor>;
  /** Si el navegador lo pinta todo con el procesador, porque tiene apagada la aceleración por hardware. */
  sinAceleracion(): Promise<boolean>;
  fijarClaveIA(clave: string, urlBase?: string): Promise<void>;
  probarIA(): Promise<string>;

  analizarLineas(lineas: Linea[], fuente?: { titulo?: string; url?: string; idVideo?: string }): Promise<LineaAnalizada[]>;
  analizarTexto(texto: string): Promise<PalabraToken[][]>;

  buscar(lema: string, lectura?: string): Promise<ResultadoBusqueda>;
  /** Cómo se escribe un carácter, trazo a trazo. Sin datos, null. */
  trazos(caracter: string): Promise<DatosTrazos | null>;
  /** Lo que hay en el portapapeles. El motor puede leerlo sin tener el foco. */
  leerPortapapeles(): Promise<string>;
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
  /** `mudo` si la grabación no tiene ningún sonido: lo que pasa si se captura otra pestaña o el video está silenciado. */
  terminarClip(): Promise<{ datos: string; tipo: string; segundos: number; pico: number } | { mudo: true } | null>;
  whisperMarca(ms: number, reproduciendo: boolean, velocidad: number, salto: boolean): Promise<void>;
  /** Trabajos largos en marcha: mientras haya alguno, la extensión no se recarga sola. */
  flujosActivos(): Promise<number>;
  /** Null si el ayudante local no está instalado. */
  ayudante(): Promise<InfoAyudante | null>;
  whisperDetener(): Promise<void>;
  whisperPausar(pausado: boolean): Promise<void>;
  whisperCapturaPrueba(): Promise<void>;
  whisperOcupacionPrueba(ocupacion: number | null): Promise<void>;
  whisperPerderGpuPrueba(): Promise<void>;
  recortarImagen(dataUrl: string, rect: { x: number; y: number; w: number; h: number; anchoVentana: number }): Promise<{ url: string; negra: boolean }>;

  audiosPalabra(lema: string, lectura: string): Promise<ResultadoAudio[]>;
  vozFrase(texto: string, voz: string): Promise<string>;
  descargarMedio(url: string): Promise<{ datos: string; tipo: string }>;
  imagenes(consulta: string): Promise<ResultadoImagen[]>;
  consultaImagen(lema: string, frase?: string): Promise<string>;
  generarFraseEjemplo(lema: string): Promise<string>;
  traducirBreve(texto: string): Promise<string>;
  glosaBreve(lema: string, frase?: string): Promise<string>;
  sentidoEnContexto(c: ContextoIA, definiciones: string[], recargar?: boolean): Promise<SentidoEnContexto>;
  /** Lo ya preguntado sobre esta palabra en esta frase, sin gastar nada. */
  sentidoGuardado(c: ContextoIA, definiciones: string[]): Promise<SentidoEnContexto | null>;
  /** Lo gastado en Claude desde un instante, petición a petición. */
  consumo(desde: number): Promise<FilaConsumo[]>;
  revisarLectura(c: ContextoIA, texto: string): Promise<{ lectura: string; lema: string; lectura_lema: string; motivo: string }>;
  corregirLectura(texto: string, c: { superficie: string; lectura: string; lema?: string; lectura_lema?: string }): Promise<void>;
  /** Lo que Claude cambiaría del texto que leyó el OCR de una página, mirando su imagen: solo las líneas que no coinciden. */
  revisarPaginaOcr(p: PeticionRevisionOcr): Promise<{ i: number; t: string }[]>;

  bibliotecaListar(): Promise<ElementoBiblioteca[]>;
  bibliotecaGuardar(e: ElementoBiblioteca): Promise<void>;
  /** Cambia unos campos sobre lo último guardado (ver CambioBiblioteca) y devuelve cómo queda. */
  bibliotecaCambiar(id: string, cambio: CambioBiblioteca): Promise<ElementoBiblioteca | undefined>;
  bibliotecaEliminar(id: string): Promise<void>;
  bibliotecaObtener(id: string): Promise<ElementoBiblioteca | undefined>;
  coleccionesListar(): Promise<ColeccionBiblioteca[]>;
  coleccionGuardar(c: ColeccionBiblioteca): Promise<void>;
  /** Quita la colección; sus libros se quedan en la estantería, sueltos. */
  coleccionEliminar(id: string): Promise<void>;
  /** Los marcadores, resaltados y notas de un libro. */
  anotacionesDe(libro: string): Promise<AnotacionLibro[]>;
  anotacionGuardar(a: AnotacionLibro): Promise<void>;
  anotacionEliminar(id: string): Promise<void>;

  memoriaPendientes(limite: number): Promise<TarjetaMemoria[]>;
  memoriaResumen(): Promise<{ total: number; pendientes: number; nuevas: number }>;
  memoriaResponder(id: string, nota: 1 | 2 | 3 | 4): Promise<void>;
  memoriaEliminar(id: string): Promise<void>;

  /** La copia lleva lo de todas las lenguas que se han usado, y los ajustes que se le pasan. */
  exportarDatos(ajustes: Ajustes): Promise<string>;
  /** Devuelve los ajustes que traía la copia, para que los guarde quien la restaura. */
  importarDatos(json: string): Promise<Partial<Ajustes> | null>;
  // Lo generado para un video se guarda en la base de la lengua que se estudia, `estudio`, que dice quien lo pide: al
  // cambiar de lengua, el motor puede no haberse enterado aún, y leería o escribiría en la base de la anterior.
  guardarSubtitulosGenerados(idVideo: string, idioma: string, lineas: Linea[], origen: string | undefined, estudio: string): Promise<void>;
  subtitulosGenerados(idVideo: string, estudio: string): Promise<{ idioma: string; lineas: Linea[]; origen?: string; creado: number }[]>;
  correccionesPista(clave: string, estudio: string): Promise<{ cambios: Record<number, string>; completa: boolean } | undefined>;
  guardarCorreccionesPista(clave: string, cambios: Record<number, string>, completa: boolean, estudio: string): Promise<void>;
}

export interface ApiFondo {
  asegurarMotor(): Promise<void>;
  /** Abre el lector en una pestaña normal. Con `junto`, en vista dividida con la pestaña que se esté viendo. */
  abrirLectorWeb(junto?: boolean): Promise<void>;
  /** Abre un libro de la Ayuda de lectura en el visor, en una pestaña normal. */
  abrirVisor(id: string): Promise<void>;
  claveIA(): Promise<string | null>;
  urlBaseIA(): Promise<string | null>;
  ajustesCompletos(): Promise<unknown>;
  capturaVisible(): Promise<string>;
  /** Deja a la vista solo el video de la pestaña que lo pide, para capturarla. */
  soloVideo(si: boolean): Promise<void>;
  alternarCaptura(): Promise<boolean>;
  /** Si se está capturando el audio de la pestaña que pregunta, o de la que está a la vista si no pregunta ninguna. */
  capturaActiva(): Promise<boolean>;
  /** Los atajos que Chrome ha asignado de verdad, por comando. Sin asignar, la cadena está vacía. */
  atajos(): Promise<Record<string, string>>;
  /** Abre la página de Chrome donde se asignan los atajos. */
  abrirAtajos(): Promise<void>;
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
  | { tipo: 'capturaFallida'; motivo: string }
  | { tipo: 'comando'; comando: string }
  | { tipo: 'borrador'; borrador: Partial<BorradorTarjeta> };
