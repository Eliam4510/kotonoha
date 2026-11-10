// Contratos de las llamadas entre contextos.

import type { OpcionesAnalisis, PuntoGramatica } from '../lenguas/tipos';
import type { Ajustes } from './ajustes';
import type { ResumenInmersion, TipoInmersion } from '../nucleo/inmersion';
import type { EntradaBreve } from '../nucleo/explorar';
import type { FilaConsumo } from '../nucleo/precios';
import type { Linea } from '../nucleo/subtitulos';
import type { DatosTrazos } from '../nucleo/trazos';
import type {
  AnotacionLibro,
  BorradorTarjeta,
  CaracterBreve,
  FichaCaracter,
  CambioBiblioteca,
  ColeccionBiblioteca,
  ContextoIA,
  ElementoBiblioteca,
  EstadisticasPalabras,
  EstadoAnki,
  EstadoGramatica,
  EstadoPalabra,
  FilaPalabra,
  FraseEjemplo,
  FuenteBiblioteca,
  GramaticaVista,
  InfoDiccionario,
  CaracterConNivel,
  LineaAnalizada,
  ListaNivel,
  PuntoEncontrado,
  OpcionFalsa,
  PalabraToken,
  ResumenNivel,
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
  /** 1 es el ayudante de Python; 2, el de PowerShell, que no necesita nada más. */
  version: number;
  ytdlp: string | null;
  /** Con FFmpeg el ayudante convierte el audio; sin él lo convierte la extensión, algo más despacio. */
  ffmpeg: boolean;
  /** Con qué resuelve yt-dlp el desafío de YouTube: «quickjs», «deno» o «node». */
  js?: string | null;
  /** Si sabe actualizar la extensión. */
  actualizar?: boolean;
}

/** Un motor de voz local con la API de VOICEVOX que contesta en este equipo. */
export interface MotorVozLocal {
  url: string;
  nombre: string;
  version: string;
  voces: { nombre: string; estilos: { nombre: string; id: number }[] }[];
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

export interface PalabraConocida {
  lema: string;
  lectura: string;
  estado: EstadoPalabra;
}

export interface ApiMotor {
  /** Pasa a estudiar otra lengua sin esperar a la siguiente petición. */
  fijarLengua(id: string): Promise<void>;
  estado(): Promise<EstadoMotor>;
  /** Si el navegador lo pinta todo con el procesador, porque tiene apagada la aceleración por hardware. */
  sinAceleracion(): Promise<boolean>;
  fijarClaveIA(clave: string, urlBase?: string): Promise<void>;
  probarIA(): Promise<string>;
  /** Los modelos que ofrece un proveedor de los ajustes. */
  modelosProveedor(id: string): Promise<string[]>;
  /** Una petición mínima a un modelo de un proveedor, para ver que la clave y el modelo funcionan. */
  probarProveedor(id: string, modelo: string): Promise<string>;

  analizarLineas(lineas: Linea[], fuente?: { titulo?: string; url?: string; idVideo?: string }): Promise<LineaAnalizada[]>;
  /** Con `expresiones: false`, las expresiones con partícula quedan en sus palabras: para practicar el acento. */
  analizarTexto(texto: string, opciones?: OpcionesAnalisis): Promise<PalabraToken[][]>;

  buscar(lema: string, lectura?: string): Promise<ResultadoBusqueda>;
  /** Cómo se escribe un carácter, trazo a trazo. Sin datos, null. */
  trazos(caracter: string): Promise<DatosTrazos | null>;
  /** Lo que hay en el portapapeles. El motor puede leerlo sin tener el foco. */
  leerPortapapeles(): Promise<string>;
  buscarLibre(texto: string): Promise<ResultadoBusqueda[]>;
  compuestos(palabras: string[]): Promise<ResultadoBusqueda[]>;
  ejemplos(lema: string): Promise<FraseEjemplo[]>;
  /** Frases ya vistas que llevan un carácter, las más recientes primero. */
  frasesConCaracter(caracter: string, limite?: number): Promise<FraseEjemplo[]>;

  cambiarPalabras(cambios: CambioPalabra[]): Promise<void>;
  anadirConocidas(texto: string): Promise<number>;
  estadisticasPalabras(): Promise<EstadisticasPalabras>;
  /** Las palabras conocidas o en aprendizaje que llevan cada carácter, sin la propia palabra: «Kanji que ya conoces». */
  palabrasConCaracteres(caracteres: string[], excluir: string, limite?: number): Promise<Record<string, PalabraConocida[]>>;
  /** Suma tiempo de inmersión: un video que se escucha o un texto que se lee en la lengua que se estudia. */
  sumarInmersion(tipo: TipoInmersion, fuente: string, titulo: string, segundos: number, estudio?: string): Promise<void>;
  resumenInmersion(): Promise<ResumenInmersion>;
  /** El texto del Cuaderno con su estructura (títulos, párrafos, listas), puesta por Claude sin cambiar las palabras. */
  organizarTexto(md: string): Promise<string>;
  /** Carga ya el modelo de voz de la práctica o del dictado, si está en el disco: así al terminar de grabar está listo. */
  prepararVoz(uso: 'practica' | 'dictado'): Promise<void>;
  /** Lo mismo con narabas, el modelo de las moras de la práctica. */
  prepararMoras(): Promise<void>;
  /** Los puntos de gramática que no son nuevos, con su estado. */
  estadosGramatica(estudio?: string): Promise<Record<string, EstadoGramatica>>;
  fijarEstadoGramatica(patron: string, estado: EstadoGramatica, estudio?: string): Promise<void>;
  /** Anota que una línea de un video llevaba estos puntos de gramática. */
  verGramatica(patrones: string[], fuente: string, titulo: string, url: string, frase: string, estudio?: string): Promise<void>;
  /** Dónde se vio un punto, lo más reciente primero. */
  gramaticaVista(patron: string, estudio?: string): Promise<GramaticaVista[]>;
  /** Marca como sabidos, o en aprendizaje, los puntos de gramática que aparecen en unas tarjetas de Anki. */
  importarGramaticaAnki(consulta: string, campo: string): Promise<number>;
  /** Tres puntos de gramática que se confunden con este en esta frase, para una tarjeta de opción múltiple. */
  distractoresGramatica(punto: PuntoGramatica, frase: string): Promise<OpcionFalsa[]>;
  listarPalabras(filtro: FiltroPalabras): Promise<{ filas: FilaPalabra[]; total: number }>;
  /** Las listas de un nivel del examen de la lengua (el JLPT), cruzadas con lo que se sabe de cada palabra. */
  listaNivel(carpeta: string, nivel: string): Promise<ListaNivel>;
  /** Cuánto se conoce de cada nivel. */
  resumenNiveles(carpeta: string, niveles: string[]): Promise<ResumenNivel[]>;
  /** Frases ya vistas que llevan un punto de gramática: ejemplos reales. */
  frasesConPatron(patron: string, limite?: number): Promise<FraseEjemplo[]>;
  /** Los caracteres de una palabra con su nivel del examen, sus lecturas y su glosa. */
  caracteresConNivel(carpeta: string, caracteres: string[]): Promise<CaracterConNivel[]>;
  /** Los puntos de gramática de las listas que encajan con lo buscado. */
  buscarGramatica(carpeta: string, texto: string, idioma: string): Promise<PuntoEncontrado[]>;
  /** Palabras de uso común que significan lo buscado: del idioma de quien estudia a la lengua que estudia. */
  buscarPorSignificado(texto: string): Promise<EntradaBreve[]>;
  /** Las entradas de una categoría del diccionario (onomatopeyas, refranes…), de las más comunes a las menos. */
  categoriaDiccionario(id: string, desde: number, limite: number): Promise<{ filas: EntradaBreve[]; total: number }>;
  cuentaCategorias(): Promise<Record<string, number>>;
  /** Las palabras que se leen igual que una. */
  homofonos(lectura: string, excluir: string): Promise<EntradaBreve[]>;
  /** Las palabras de uso común que significan lo mismo que una. */
  sinonimos(lema: string, lectura: string): Promise<EntradaBreve[]>;
  /** La lista de resultados del diccionario: lo que es justo lo buscado y lo que empieza por ello. */
  resultadosDeBusqueda(texto: string, limite?: number): Promise<EntradaBreve[]>;
  /** Las palabras de uso común que llevan un carácter, las más usadas primero, y cuántas hay. */
  palabrasConCaracter(caracter: string, limite?: number): Promise<{ filas: EntradaBreve[]; total: number }>;
  /** Las palabras de uso común de una categoría del diccionario que llevan un carácter, las más usadas primero. */
  categoriaConCaracter(id: string, caracter: string, limite?: number): Promise<EntradaBreve[]>;
  /** Unas palabras concretas en breve, con la glosa del primer diccionario: los opuestos de una, por ejemplo. */
  entradasDe(pares: { termino: string; lectura?: string }[]): Promise<EntradaBreve[]>;
  /** Lo que el diccionario de caracteres sabe de uno. Sin ese diccionario, o si no lo tiene, null. */
  fichaCaracter(caracter: string): Promise<FichaCaracter | null>;
  /** Unos caracteres concretos en breve, en ese orden: sus opuestos o sus parecidos, por ejemplo. */
  caracteresBreves(caracteres: string[]): Promise<CaracterBreve[]>;
  /** Los caracteres que llevan dentro una pieza, en cualquiera de sus formas, los más usados primero, y cuántos hay. */
  caracteresConPieza(piezas: string[], excluir: string[], limite?: number): Promise<{ filas: CaracterBreve[]; total: number }>;
  /** Los caracteres que llevan una pieza para sonar como ella, los más usados primero, y cuántos hay. */
  familiaFonetica(fonetico: string, limite?: number): Promise<{ filas: CaracterBreve[]; total: number }>;
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
  /**
   * La frase leída en MP3 (base64): con la voz local si está activa y se encuentra, y si no, con la de Azure. `voz` es la
   * de Azure.
   */
  vozFrase(texto: string, voz: string): Promise<string>;
  /** Los motores de voz local que contestan: el de `url` o, sin ella, los de los puertos de AivisSpeech y VOICEVOX. */
  motoresVoz(url?: string): Promise<MotorVozLocal[]>;
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
  /**
   * Borra las grabaciones de dictados de la lengua actual que ya no usa ningún texto: ni los de la biblioteca ni los que
   * se le pasan, que son los que hay abiertos en el Portapapeles. Devuelve cuántas borró.
   */
  limpiarDictados(abiertos: string[]): Promise<number>;
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
  /** Abre un libro de la Biblioteca en el visor, en una pestaña normal. */
  abrirVisor(id: string): Promise<void>;
  claveIA(): Promise<string | null>;
  urlBaseIA(): Promise<string | null>;
  /** Las claves de los otros proveedores de IA, por su identificador. Solo para el motor. */
  clavesProveedores(): Promise<Record<string, string>>;
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
  /** Vuelve al momento de un video: a su pestaña si está abierta, o lo abre. */
  abrirMomento(url: string, ms: number): Promise<void>;
  /** El momento al que debe saltar esta pestaña, si se abrió para volver a él. */
  momentoPendiente(): Promise<number | null>;
  estadoUso(): Promise<'active' | 'idle' | 'locked'>;
  /** Mira ya si cambiaron los archivos de la copia y, si nada está en marcha, recarga la extensión. */
  comprobarActualizacion(): Promise<void>;
}

export type EventoDifundido =
  | { tipo: 'palabras'; cambios: CambioPalabra[] }
  | { tipo: 'palabrasRecargar' }
  | { tipo: 'gramatica' }
  | { tipo: 'instalacion'; progreso: ProgresoInstalacion }
  | { tipo: 'diccionarios' }
  | { tipo: 'captura'; activa: boolean }
  | { tipo: 'capturaFallida'; motivo: string }
  | { tipo: 'comando'; comando: string }
  | { tipo: 'saltar'; ms: number }
  | { tipo: 'borrador'; borrador: Partial<BorradorTarjeta> };
