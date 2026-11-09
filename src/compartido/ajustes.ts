import type { IdPaleta } from '../ui/paletas';
import { PAQUETE_INICIAL, paqueteDe } from '../lenguas';
import { lenguaDe, lenguasExplicacion, lenguasTraduccion, type PreferenciaIdioma, resolverIdioma, tm } from './i18n';
import type { ProveedorIA } from './proveedores';
// Ajustes del usuario, guardados en chrome.storage.local.

export type ModoLectura = 'ninguna' | 'todas' | 'desconocidas' | 'alPasar';
export type ModoGlosa = 'ninguna' | 'desconocidas' | 'alPasar';
export type ModoColor = 'ninguno' | 'alPasar' | 'siempre';
export type PausaInteraccion = 'nunca' | 'alPasarSubtitulo' | 'consultaPalabra';
export type ModoSalto = 'no' | '2' | '4' | '6' | '8' | 'saltar';

export type ObjetivoFrase =
  | 'todas'
  | '1d' // Una sola palabra desconocida
  | 'recomendadas'
  | 'desconocidas'
  | 'rastreadas'
  | 'aprendiendo'
  | '2mas'
  | 'conocidas';

export type DisparadorPausa = 'ninguno' | 'antes' | 'despues' | 'antesYDespues' | 'rebobinar';
export type ModoVelo = 'no' | 'difuminar' | 'ocultar';
export type RevelarEnPausa = 'manual' | 'auto' | 'primeraAuto' | 'primeraAutoYDurante' | 'segundaAuto' | 'cualquiera';

export interface Velo {
  modo: ModoVelo;
  revelarEnPausa: RevelarEnPausa[];
  revelarPorEstado: ObjetivoFrase[];
  revelarAlPasar: boolean;
}

export interface ConfigModo {
  objetivosPausa: ObjetivoFrase[];
  disparador: DisparadorPausa;
  velarObjetivo: Velo;
  velarSecundario: Velo;
}

export type IdModo =
  | 'normal'
  | 'escuchaPreparada'
  | 'lecturaIntensiva'
  | 'escuchaIntensiva'
  | 'hibridoIntensivo'
  | 'alPausar'
  | 'enfoque1d'
  | 'dictado'
  | 'personalizado';

export type TareaIA = 'explicar' | 'desglosar' | 'traducir' | 'generar' | 'subtitulos' | 'historia' | 'preguntar' | 'sentido' | 'analisis' | 'corregir' | 'profundo' | 'letra' | 'ocr';

export const MODELOS = [
  { id: 'claude-sonnet-5-5', nombre: tm('Claude Sonnet 5.5') },
  { id: 'claude-opus-5-5', nombre: tm('Claude Opus 5.5') },
  { id: 'claude-haiku-5-5', nombre: tm('Claude Haiku 5.5') },
] as const;

export type Esfuerzo = 'low' | 'medium' | 'high';

export interface PromptPersonalizado {
  sistema: string;
  usuario: string;
}

export type Tema = 'auto' | 'oscuro' | 'claro';

export type ModeloWhisper = 'turbo' | 'turbo-ligero' | 'base' | 'haas' | 'parakeet';
/** Lo que se elige en los ajustes: un modelo concreto, o que se decida según el video. */
export type OpcionModelo = ModeloWhisper | 'auto';

/** Un modelo transductor: Transformers.js no los conoce, así que aquí va lo necesario para ejecutarlo. */
export interface ConfigTdt {
  /** La versión exacta del repositorio: si cambiara, no se descargaría otra cosa de lo que se ha medido. */
  revision: string;
  codificador: string;
  /** Los pesos van aparte cuando el grafo pasa de 2 GB. */
  datosCodificador?: string;
  decodificador: string;
  datosDecodificador?: string;
  vocabulario: string;
  /** Un modelo de SentencePiece, o una lista de «pieza número» por línea. */
  formatoVocabulario?: 'sentencepiece' | 'lista';
  nMels: number;
  bf16: boolean;
  /** La forma del estado del decodificador, si el grafo no la dice. */
  capasEstado: number;
  anchoEstado: number;
}

export interface DefinicionModeloVoz {
  id: string;
  nombre: string;
  descripcion: string;
  dtype: Record<string, string>;
  mb: number;
  externos?: Record<string, number>;
  /** Solo sirve para estas lenguas. Sin esto, para todas. */
  lenguas?: string[];
  /** Es el mejor para voz hablada en sus lenguas, pero no para canciones. */
  voz?: boolean;
  tdt?: ConfigTdt;
}

/**
 * Modelos de transcripción. Se descargan la primera vez y quedan guardados en el navegador.
 * Elegidos midiendo con voz humana (pruebas/whisper-comparar.mjs) y con videos reales: Turbo superó
 * a Kotoba Whisper en todas las pruebas, y sin comprimir el codificador comete un 10 % menos de errores.
 * Con voz hablada en japonés gana Haas-ja, también con música de fondo: 3,1 % de error frente a 8,8 %, y siete veces más
 * rápido. Con canto se queda corto, porque escribe solo una parte de lo que se canta, y ahí sigue ganando Whisper.
 * En inglés pasa lo mismo con Parakeet: 6,8 % frente a 9,6 %, con tiempos tres veces más exactos, pero peor en canciones.
 */
export const MODELOS_WHISPER: Record<ModeloWhisper, DefinicionModeloVoz> = {
  haas: {
    id: 'Sanami/haas-ja-onnx',
    nombre: tm('Haas-ja'),
    descripcion: tm('El más preciso y rápido con voz hablada, también con música de fondo, y con puntuación. Usa unos 2,5 GB de memoria de video. Para canciones, mejor Whisper Turbo.'),
    dtype: {},
    mb: 1280,
    lenguas: ['ja'],
    voz: true,
    tdt: {
      revision: '354baedfd9612b00e74cc1ae87dff7f2c558db6f',
      codificador: 'fp16/encoder.onnx',
      datosCodificador: 'fp16/encoder.onnx.data',
      decodificador: 'fp16/decoder_joint.onnx',
      datosDecodificador: 'fp16/decoder_joint.onnx.data',
      vocabulario: 'tokenizer.model',
      nMels: 128,
      bf16: true,
      capasEstado: 2,
      anchoEstado: 20480,
    },
  },
  parakeet: {
    id: 'ysdede/parakeet-tdt-0.6b-v3-onnx',
    nombre: tm('Parakeet'),
    descripcion: tm('El más preciso con voz hablada en inglés y en alemán, también con música de fondo, con puntuación y los tiempos más exactos. Usa unos 2,5 GB de memoria de video. Para canciones, mejor Whisper Turbo.'),
    dtype: {},
    mb: 1280,
    lenguas: ['en', 'de'],
    voz: true,
    tdt: {
      revision: 'e5356bf6e24bdb7a269536b0e9e7869bc034b893',
      codificador: 'encoder-model.fp16.onnx',
      decodificador: 'decoder_joint-model.fp16.onnx',
      vocabulario: 'vocab.txt',
      formatoVocabulario: 'lista',
      nMels: 128,
      bf16: false,
      capasEstado: 2,
      anchoEstado: 640,
    },
  },
  turbo: {
    id: 'onnx-community/whisper-large-v3-turbo',
    nombre: tm('Whisper Turbo'),
    descripcion: tm('El mejor con canciones. Usa unos 4 GB de memoria de video.'),
    dtype: { encoder_model: 'fp16', decoder_model_merged: 'q4f16' },
    mb: 1468,
  },
  'turbo-ligero': {
    id: 'onnx-community/whisper-large-v3-turbo',
    nombre: tm('Whisper Turbo ligero'),
    descripcion: tm('Algo menos preciso y un poco más rápido. Usa menos de 2 GB de memoria de video.'),
    dtype: { encoder_model: 'q4f16', decoder_model_merged: 'q4f16' },
    mb: 564,
  },
  base: {
    id: 'onnx-community/whisper-base',
    nombre: tm('Whisper Base'),
    descripcion: tm('Muy ligero y mucho menos preciso. Para equipos sin una GPU potente.'),
    dtype: { encoder_model: 'fp16', decoder_model_merged: 'q4' },
    mb: 165,
  },
};

/** Lo que hace la opción automática. */
export const MODELO_AUTOMATICO = tm('Elige solo según el video: el más preciso para la voz hablada en este idioma y Whisper Turbo para las canciones.');

export const modeloSirveParaLengua = (m: ModeloWhisper, lengua: string) => {
  const lenguas = MODELOS_WHISPER[m]?.lenguas;
  return !lenguas || lenguas.includes(lengua);
};

/** El modelo que se usa de verdad: en automático, el mejor para voz de esa lengua, y Whisper Turbo para las canciones. */
export function modeloParaTranscribir(opcion: OpcionModelo, lengua: string, esCancion: boolean): ModeloWhisper {
  if (opcion !== 'auto') return modeloSirveParaLengua(opcion, lengua) ? opcion : 'turbo';
  if (esCancion) return 'turbo';
  return (Object.keys(MODELOS_WHISPER) as ModeloWhisper[]).find((m) => MODELOS_WHISPER[m].voz && modeloSirveParaLengua(m, lengua)) ?? 'turbo';
}

export interface Ajustes {
  /** Versión de los valores por omisión con la que se guardaron estos ajustes. */
  migracion: number;
  /** Crédito mensual de la API, para ver el gasto en contexto. */
  creditoMensual: number;
  /** Tope de gasto al mes, en dólares. Al llegar, Claude deja de usarse hasta el mes siguiente. Con 0 no hay tope. */
  limiteGasto: number;
  /** Ya vio o saltó el asistente de la primera vez. */
  bienvenidaVista: boolean;
  /** Cómo se escriben las lecturas: kana, o rōmaji para quien aún no lo lee. */
  formatoLectura: string;
  /** Colores de los estados de una palabra. */
  paleta: IdPaleta;
  // Lector de páginas
  lectorActivo: boolean;
  lectorColor: boolean;
  lectorFurigana: ModoLectura;
  /** Cómo se abre la ficha: con un clic, o al pasar el ratón. En enlaces y botones siempre es al pasar. */
  lectorAbrir: 'clic' | 'pasar';
  /** El clic en un enlace o un botón consulta la palabra, en lugar de hacer lo suyo. */
  lectorClicEnlaces: boolean;
  /** El botoncito del lector en las páginas con japonés. */
  lectorBoton: boolean;
  /** Abre un poco las líneas de un texto donde el furigana no cabe. Es lo único que el lector mueve en una página. */
  lectorInterlineado: boolean;
  /** Atajos reasignados: acción y combinación nueva. */
  atajosPersonales: Record<string, string>;
  /** Cómo saludar en la pantalla de inicio. Si está vacío, el saludo va sin nombre. */
  nombre: string;
  /** Dónde se colocan los subtítulos sobre el video, si los has movido. */
  subsPosicion: { x: number; y: number } | null;
  /** Tema de la ventana de la app y del menú. Sobre el video el overlay siempre es oscuro. */
  tema: Tema;
  whisperModelo: OpcionModelo;
  /** Cuánto se le exige a la GPU. En automático va suave mientras usas el equipo. */
  whisperIntensidad: 'auto' | 'suave' | 'rapida';
  /** Corrige con Claude los subtítulos automáticos de YouTube al abrirlos. */
  corregirAutomaticos: boolean;
  /** Corrige kanji y homófonos de la transcripción con Claude a medida que llega. */
  whisperCorregir: boolean;
  activo: boolean;
  sitiosDesactivados: string[];

  // Visualización
  mostrarEstado: boolean;
  furigana: ModoLectura;
  glosas: ModoGlosa;
  colorAcento: ModoColor;
  resaltarFrase: boolean;
  busquedaCompuesta: boolean;
  particulasConocidas: boolean;

  // Reproducción
  modo: IdModo;
  modoPersonalizado: ConfigModo;
  salto: ModoSalto;
  quitarAcotaciones: boolean;
  desfasePausaMs: number;

  // Subtítulos
  idiomaObjetivo: string;
  /** Los ajustes de las lenguas que no se están estudiando ahora. Los de la actual están en su sitio de siempre. */
  porLengua: Partial<Record<string, Partial<AjustesLengua>>>;
  idiomaSecundario: string;
  ocultarObjetivo: boolean;
  ocultarSecundario: boolean;
  escalaObjetivo: number;
  escalaSecundario: number;
  sombra: boolean;
  opacidadSombra: number;
  generarSecundariosAuto: boolean;

  // Interacción
  pausaInteraccion: PausaInteraccion;
  reanudarAlTerminar: boolean;
  pausaDiferida: boolean;
  autoConsultaAlPausar: boolean;
  popupAlPasar: boolean;
  popupSoloDesconocidas: boolean;
  desanclarBarra: boolean;
  navegadorAbierto: boolean;

  // Pausa automática
  reanudarTras: boolean;
  reanudarSegundos: number;
  reanudarDinamico: boolean;
  velocidadLectura: number;
  duracionMinimaPausa: number;

  // Grabación
  rellenoInicioMs: number;
  rellenoFinMs: number;

  // Tarjetas
  destino: 'anki' | 'memoria';
  ankiMazo: string;
  ankiModelo: string;
  ankiCampos: Record<string, string>;
  ankiEtiquetas: string;
  ankiPuerto: number;
  prellenado: Prellenado;
  negritaPalabra: boolean;
  diccionarioPestana: PestanaDiccionario;
  ordenContenido: ('definiciones' | 'flexiones' | 'pestanas')[];

  // IA
  modelos: Record<TareaIA, string>;
  esfuerzos: Record<TareaIA, Esfuerzo>;
  respaldoSeguridad: boolean;
  usarGuion: boolean;
  nivel: string;
  idiomaExplicaciones: string;
  idiomaTraduccion: string;
  prompts: Partial<Record<string, PromptPersonalizado>>;
  analisisAutomatico: boolean;
  sentidoAutomatico: boolean;
  mostrarGramatica: boolean;

  // Voces
  azureClave: string;
  azureRegion: string;
  vocesFrase: string[];
  /** La voz del navegador con que se lee sin clave de Azure. Vacía, la mejor que haya para la lengua. */
  vozNavegador: string;
  /** La voz japonesa local: un motor con la API de VOICEVOX (AivisSpeech, VOICEVOX) en este equipo. */
  vozLocal: AjustesVozLocal;
  /** Las voces neuronales en el propio navegador: Kokoro para el inglés y Piper para el alemán. */
  vozNeuronal: AjustesVozNeuronal;
  /** Otros proveedores de IA, con la API de OpenAI; sus claves se guardan aparte. */
  proveedores: ProveedorIA[];

  // Apariencia
  /** Idioma de la interfaz. En automático sigue al del navegador. */
  idiomaInterfaz: PreferenciaIdioma;
  estiloFrecuencia: 'numero' | 'estrellas';
  frecuenciaMaxRecomendada: number;
  guardarHistorial: boolean;
  /** Mirar una vez al día en GitHub si hay una versión nueva, y avisar. */
  avisarVersiones: boolean;
  /** En la práctica del acento, comprobar también las っ, las ん y las vocales largas con narabas (1,26 GB la primera vez). */
  practicaMoras: boolean;
}

export interface AjustesVozLocal {
  /** Leer las frases con ella en lugar de Azure o del navegador. */
  activa: boolean;
  /** Dónde escucha el motor; vacío, se busca en los puertos de AivisSpeech y de VOICEVOX. */
  url: string;
  /** El estilo de voz (su identificador en el motor); null, el primero que tenga. */
  estilo: number | null;
  /** Corregir el acento de cada palabra con el del diccionario antes de leer. */
  acentoDiccionario: boolean;
}

export interface AjustesVozNeuronal {
  /** Leer las frases del inglés y del alemán con ellas, en lugar de Azure o del navegador. */
  activa: boolean;
  /** La voz de Kokoro para el inglés, como «af_heart»: la letra dice el acento (a, americano; b, británico) y la segunda, si es de mujer o de hombre. */
  vozIngles: string;
}

/**
 * Si hay una voz sintética para las frases: la local, que es japonesa, las neuronales del inglés y del alemán, o la de
 * Azure. Sin ninguna, se lee con la del navegador.
 */
export const hayVozSintetica = (a: Ajustes): boolean => !!a.azureClave || vozLocalActiva(a) || vozNeuronalActiva(a);

/** Si las frases se leen con una voz neuronal del navegador: al estudiar inglés (Kokoro) o alemán (Piper). */
export const vozNeuronalActiva = (a: Ajustes): boolean => a.vozNeuronal.activa && (a.idiomaObjetivo === 'en' || a.idiomaObjetivo === 'de');

/** Si las frases se leen con la voz local: solo al estudiar japonés, que es lo que hablan AivisSpeech y VOICEVOX. */
export const vozLocalActiva = (a: Ajustes): boolean => a.vozLocal.activa && a.idiomaObjetivo === 'ja';

/** Lo que cada lengua recuerda por su cuenta: el nivel en japonés no es el nivel en inglés. */
export const CLAVES_POR_LENGUA = ['nivel', 'diccionarioPestana', 'formatoLectura', 'furigana', 'lectorFurigana', 'lectorActivo', 'colorAcento', 'particulasConocidas', 'vocesFrase', 'vozNavegador', 'prompts', 'ankiMazo', 'whisperModelo'] as const;

export type AjustesLengua = Pick<Ajustes, (typeof CLAVES_POR_LENGUA)[number]>;

export type PestanaDiccionario = 'ninguna' | 'audio' | 'imagenes' | 'explicar' | 'desglose' | 'traduccion' | 'trazos' | 'enlaces' | 'ejemplos' | 'suena';

export interface Prellenado {
  fraseVideo: boolean;
  fraseIA: boolean;
  traduccionIA: boolean;
  traduccionSecundaria: boolean;
  definiciones: boolean;
  audioFraseVideo: boolean;
  audioFraseVoz: boolean;
  audioPalabraDiccionario: boolean;
  audioPalabraVoz: boolean;
  imagenCaptura: boolean;
  imagenBusqueda: boolean;
  ejemplos: boolean;
  explicacionIA: boolean;
}

const VELO_NO: Velo = { modo: 'no', revelarEnPausa: [], revelarPorEstado: [], revelarAlPasar: true };

export const AJUSTES_INICIALES: Ajustes = {
  migracion: 2,
  creditoMensual: 0,
  limiteGasto: 0,
  bienvenidaVista: false,
  formatoLectura: PAQUETE_INICIAL.lectura.formatoInicial,
  paleta: 'predeterminada',
  lectorActivo: true,
  lectorColor: true,
  lectorFurigana: 'desconocidas',
  lectorAbrir: 'clic',
  lectorClicEnlaces: false,
  lectorBoton: true,
  lectorInterlineado: true,
  atajosPersonales: {},
  nombre: '',
  subsPosicion: null,
  tema: 'auto',
  whisperModelo: 'auto',
  whisperIntensidad: 'auto',
  corregirAutomaticos: true,
  whisperCorregir: true,
  activo: true,
  sitiosDesactivados: [],

  mostrarEstado: true,
  furigana: 'todas',
  glosas: 'alPasar',
  colorAcento: 'siempre',
  resaltarFrase: true,
  busquedaCompuesta: true,
  particulasConocidas: true,

  modo: 'normal',
  modoPersonalizado: {
    objetivosPausa: ['1d'],
    disparador: 'despues',
    velarObjetivo: VELO_NO,
    velarSecundario: VELO_NO,
  },
  salto: 'no',
  quitarAcotaciones: false,
  desfasePausaMs: 0,

  idiomaObjetivo: PAQUETE_INICIAL.id,
  porLengua: {},
  idiomaSecundario: 'es',
  ocultarObjetivo: false,
  ocultarSecundario: false,
  escalaObjetivo: 100,
  escalaSecundario: 100,
  sombra: true,
  opacidadSombra: 0.65,
  generarSecundariosAuto: false,

  pausaInteraccion: 'consultaPalabra',
  reanudarAlTerminar: true,
  pausaDiferida: false,
  autoConsultaAlPausar: false,
  popupAlPasar: true,
  popupSoloDesconocidas: false,
  desanclarBarra: false,
  navegadorAbierto: false,

  reanudarTras: false,
  reanudarSegundos: 6,
  reanudarDinamico: false,
  velocidadLectura: 4,
  duracionMinimaPausa: 2,

  rellenoInicioMs: 500,
  rellenoFinMs: 500,

  destino: 'memoria',
  ankiMazo: 'Kotonoha',
  ankiModelo: 'Kotonoha',
  ankiCampos: {},
  ankiEtiquetas: 'kotonoha',
  ankiPuerto: 8765,
  prellenado: {
    fraseVideo: true,
    fraseIA: true,
    traduccionIA: true,
    traduccionSecundaria: false,
    definiciones: true,
    audioFraseVideo: true,
    audioFraseVoz: true,
    audioPalabraDiccionario: true,
    audioPalabraVoz: true,
    imagenCaptura: true,
    imagenBusqueda: true,
    ejemplos: true,
    explicacionIA: true,
  },
  negritaPalabra: true,
  diccionarioPestana: 'ninguna',
  ordenContenido: ['definiciones', 'flexiones', 'pestanas'],

  // Sonnet 5.5 para el día a día; «Profundizar» recurre a Opus 5.5 cuando un verso se resiste.
  modelos: {
    explicar: 'claude-sonnet-5-5',
    desglosar: 'claude-sonnet-5-5',
    traducir: 'claude-sonnet-5-5',
    generar: 'claude-sonnet-5-5',
    subtitulos: 'claude-sonnet-5-5',
    historia: 'claude-sonnet-5-5',
    preguntar: 'claude-sonnet-5-5',
    sentido: 'claude-sonnet-5-5',
    analisis: 'claude-sonnet-5-5',
    corregir: 'claude-sonnet-5-5',
    letra: 'claude-sonnet-5-5',
    profundo: 'claude-opus-5-5',
    // Revisar una página con su imagen cuesta con Haiku 5.5 una décima de céntimo, y con Sonnet 5.5 unas veinte veces más.
    ocr: 'claude-haiku-5-5',
  },
  esfuerzos: {
    explicar: 'medium',
    desglosar: 'medium',
    traducir: 'low',
    generar: 'low',
    subtitulos: 'low',
    historia: 'medium',
    preguntar: 'medium',
    sentido: 'low',
    analisis: 'medium',
    corregir: 'medium',
    letra: 'high',
    profundo: 'high',
    ocr: 'medium',
  },
  respaldoSeguridad: true,
  usarGuion: false,
  nivel: PAQUETE_INICIAL.nivelInicial,
  idiomaExplicaciones: tm('español'),
  idiomaTraduccion: tm('español'),
  prompts: {},
  analisisAutomatico: true,
  sentidoAutomatico: false,
  mostrarGramatica: true,

  azureClave: '',
  azureRegion: '',
  vocesFrase: PAQUETE_INICIAL.vocesIniciales,
  vozNavegador: '',
  vozLocal: { activa: false, url: '', estilo: null, acentoDiccionario: true },
  vozNeuronal: { activa: false, vozIngles: 'af_heart' },
  proveedores: [],

  idiomaInterfaz: 'auto',
  estiloFrecuencia: 'numero',
  frecuenciaMaxRecomendada: 20000,
  guardarHistorial: true,
  avisarVersiones: true,
  practicaMoras: false,
};

const CLAVE = 'ajustes';
export const CLAVE_API = 'claveAnthropic';

function clavesDeLengua(a: Partial<Ajustes>): Partial<AjustesLengua> {
  const salida: Record<string, unknown> = {};
  for (const k of CLAVES_POR_LENGUA) if (a[k] !== undefined) salida[k] = a[k];
  return salida as Partial<AjustesLengua>;
}

/**
 * Lo que cambia al pasar a estudiar otra lengua. Lo de la actual se guarda para cuando se vuelva a ella, y la nueva
 * recupera lo que tenía, o empieza con sus valores iniciales. Quien lee los ajustes sigue viendo la lengua actual en
 * su sitio de siempre: no tiene que saber que hay más.
 */
export function ajustesParaLengua(a: Ajustes, id: string): Partial<Ajustes> {
  const nueva = paqueteDe(id);
  if (nueva.id === a.idiomaObjetivo) return {};
  const salida: Partial<Ajustes> = {
    idiomaObjetivo: nueva.id,
    porLengua: { ...a.porLengua, [a.idiomaObjetivo]: clavesDeLengua(a) },
    ...clavesDeLengua(AJUSTES_INICIALES),
    ...nueva.ajustes,
    ...a.porLengua[nueva.id],
  };
  // Nadie estudia una lengua con traducciones a esa misma lengua.
  const propia = lenguaDe(resolverIdioma(a.idiomaInterfaz), nueva.id);
  if (!lenguasExplicacion(nueva.id).some((l) => l.valor === a.idiomaExplicaciones)) salida.idiomaExplicaciones = propia.explicaciones;
  if (!lenguasTraduccion(nueva.id).some((l) => l.valor === a.idiomaTraduccion)) salida.idiomaTraduccion = propia.traducciones;
  if (a.idiomaSecundario.split('-')[0] === nueva.id) salida.idiomaSecundario = propia.secundaria;
  return salida;
}

/** Mezcla profunda de un nivel para que los ajustes nuevos reciban su valor inicial. */
export function completarAjustes(guardados: Partial<Ajustes> | undefined): Ajustes {
  const salida = { ...AJUSTES_INICIALES, ...(guardados ?? {}) } as Ajustes;
  salida.prellenado = { ...AJUSTES_INICIALES.prellenado, ...(guardados?.prellenado ?? {}) };
  salida.modelos = { ...AJUSTES_INICIALES.modelos, ...(guardados?.modelos ?? {}) };
  salida.esfuerzos = { ...AJUSTES_INICIALES.esfuerzos, ...(guardados?.esfuerzos ?? {}) };
  salida.vozLocal = { ...AJUSTES_INICIALES.vozLocal, ...(guardados?.vozLocal ?? {}) };
  salida.vozNeuronal = { ...AJUSTES_INICIALES.vozNeuronal, ...(guardados?.vozNeuronal ?? {}) };
  // Un modelo que ya no existe (Kotoba se retiró al comparar con videos reales) pasa al de siempre.
  if (salida.whisperModelo !== 'auto' && !MODELOS_WHISPER[salida.whisperModelo]) salida.whisperModelo = AJUSTES_INICIALES.whisperModelo;
  // Quien ya usaba la extensión no tiene por qué pasar por el asistente de bienvenida.
  if (guardados && guardados.bienvenidaVista === undefined) salida.bienvenidaVista = true;
  // Y hasta ahora la interfaz solo estaba en español: no debe cambiarle de idioma por seguir al navegador.
  if (guardados && guardados.idiomaInterfaz === undefined) salida.idiomaInterfaz = 'es';
  // La ficha pasó a abrirse solo con el diccionario: Claude se usa cuando se pide, no al pasar el ratón.
  if (guardados && (guardados.migracion ?? 0) < 1) {
    salida.migracion = 1;
    salida.sentidoAutomatico = false;
    salida.usarGuion = false;
    if (salida.diccionarioPestana === 'explicar') salida.diccionarioPestana = 'ninguna';
  }
  // Con esfuerzo medio, Claude se saltaba versos enteros al colocar una letra.
  if (guardados && (guardados.migracion ?? 0) < 2) {
    salida.migracion = 2;
    if (salida.esfuerzos.letra === 'medium') salida.esfuerzos = { ...salida.esfuerzos, letra: 'high' };
    // Turbo era el valor inicial: ahora lo es elegir según el video. Quien eligió otro modelo lo conserva.
    if (salida.whisperModelo === 'turbo') salida.whisperModelo = 'auto';
  }
  return salida;
}

export async function leerAjustes(): Promise<Ajustes> {
  const d = await chrome.storage.local.get(CLAVE);
  return completarAjustes(d[CLAVE] as Partial<Ajustes> | undefined);
}

export async function guardarAjustes(cambios: Partial<Ajustes>): Promise<Ajustes> {
  const actuales = await leerAjustes();
  const nuevos = { ...actuales, ...cambios };
  await chrome.storage.local.set({ [CLAVE]: nuevos });
  return nuevos;
}

export function alCambiarAjustes(fn: (a: Ajustes) => void): () => void {
  const oyente = (cambios: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && cambios[CLAVE]) fn(completarAjustes(cambios[CLAVE].newValue as Partial<Ajustes>));
  };
  chrome.storage.onChanged.addListener(oyente);
  return () => chrome.storage.onChanged.removeListener(oyente);
}

// ---------- Modos de reproducción predefinidos ----------

const velo = (modo: ModoVelo, cambios: Partial<Velo> = {}): Velo => ({
  modo,
  revelarEnPausa: [],
  revelarPorEstado: [],
  revelarAlPasar: true,
  ...cambios,
});

export const MODOS: Record<Exclude<IdModo, 'personalizado'>, ConfigModo> = {
  normal: { objetivosPausa: [], disparador: 'ninguno', velarObjetivo: velo('no'), velarSecundario: velo('no') },
  escuchaPreparada: {
    objetivosPausa: ['todas'],
    disparador: 'antes',
    velarObjetivo: velo('ocultar'),
    velarSecundario: velo('no'),
  },
  lecturaIntensiva: {
    objetivosPausa: ['todas'],
    disparador: 'antes',
    velarObjetivo: velo('no'),
    velarSecundario: velo('ocultar', { revelarEnPausa: ['manual'] }),
  },
  escuchaIntensiva: {
    objetivosPausa: ['todas'],
    disparador: 'despues',
    velarObjetivo: velo('ocultar', { revelarEnPausa: ['auto', 'manual'] }),
    velarSecundario: velo('ocultar', { revelarEnPausa: ['auto', 'manual'] }),
  },
  hibridoIntensivo: {
    objetivosPausa: ['todas'],
    disparador: 'despues',
    velarObjetivo: velo('no'),
    velarSecundario: velo('no'),
  },
  alPausar: {
    objetivosPausa: [],
    disparador: 'ninguno',
    velarObjetivo: velo('ocultar', { revelarEnPausa: ['cualquiera'] }),
    velarSecundario: velo('ocultar', { revelarEnPausa: ['cualquiera'] }),
  },
  enfoque1d: {
    objetivosPausa: ['1d'],
    disparador: 'rebobinar',
    velarObjetivo: velo('ocultar', { revelarPorEstado: ['1d'] }),
    velarSecundario: velo('ocultar', { revelarEnPausa: ['auto'] }),
  },
  // Sin revelar al pasar el ratón: la frase se descubre al comprobar lo escrito.
  dictado: {
    objetivosPausa: ['todas'],
    disparador: 'despues',
    velarObjetivo: velo('ocultar', { revelarAlPasar: false }),
    velarSecundario: velo('ocultar', { revelarAlPasar: false }),
  },
};

export function configDeModo(a: Ajustes): ConfigModo {
  return a.modo === 'personalizado' ? a.modoPersonalizado : MODOS[a.modo];
}

export const NOMBRES_MODO: Record<IdModo, { titulo: string; descripcion: string }> = {
  normal: { titulo: tm('Normal'), descripcion: tm('Reproduce sin detenerse ni ocultar subtítulos.') },
  escuchaPreparada: {
    titulo: tm('Escucha preparada'),
    descripcion: tm('Pausa antes de cada frase y muestra la traducción para que escuches sabiendo qué esperar.'),
  },
  lecturaIntensiva: {
    titulo: tm('Lectura intensiva'),
    descripcion: tm('Pausa antes de cada frase para que leas el subtítulo y luego lo escuches.'),
  },
  escuchaIntensiva: {
    titulo: tm('Escucha intensiva'),
    descripcion: tm('Oculta los subtítulos hasta que se dice la frase; después pausa y los revela.'),
  },
  hibridoIntensivo: {
    titulo: tm('Híbrido intensivo'),
    descripcion: tm('Pausa después de cada frase, con los subtítulos siempre visibles.'),
  },
  alPausar: { titulo: tm('Mostrar al pausar'), descripcion: tm('Solo muestra subtítulos cuando el video está en pausa.') },
  enfoque1d: {
    titulo: tm('Enfoque 1D'),
    descripcion: tm('Muestra las frases con una sola palabra desconocida; retrocede y pausa tras ellas.'),
  },
  dictado: { titulo: tm('Dictado'), descripcion: tm('Oculta los subtítulos y pausa al final de cada frase para que escribas lo que has oído; después te dice qué acertaste.') },
  personalizado: { titulo: tm('Personalizado'), descripcion: tm('Ajusta las pausas y lo que se oculta con controles avanzados.') },
};
