// Ajustes del usuario, guardados en chrome.storage.local.

export type ModoLectura = 'ninguna' | 'todas' | 'desconocidas' | 'alPasar';
export type ModoGlosa = 'ninguna' | 'desconocidas' | 'alPasar';
export type ModoColor = 'ninguno' | 'alPasar' | 'siempre';
export type PausaInteraccion = 'nunca' | 'alPasarSubtitulo' | 'consultaPalabra';
export type ModoRender = 'ligero' | 'completo';
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
  | 'personalizado';

export type TareaIA = 'explicar' | 'desglosar' | 'traducir' | 'generar' | 'subtitulos' | 'historia' | 'preguntar' | 'sentido' | 'analisis' | 'corregir' | 'profundo';

export const MODELOS = [
  { id: 'claude-sonnet-5-5', nombre: 'Claude Sonnet 5.5' },
  { id: 'claude-opus-5-5', nombre: 'Claude Opus 5.5' },
  { id: 'claude-haiku-5-5', nombre: 'Claude Haiku 5.5' },
] as const;

export type Esfuerzo = 'low' | 'medium' | 'high';

export interface PromptPersonalizado {
  sistema: string;
  usuario: string;
}

export type Tema = 'auto' | 'oscuro' | 'claro';

export type ModeloWhisper = 'turbo' | 'turbo-ligero' | 'base';

/**
 * Modelos de transcripción. Se descargan la primera vez y quedan guardados en el navegador.
 * Elegidos midiendo con voz humana (pruebas/whisper-comparar.mjs) y con videos reales: Turbo superó
 * a Kotoba Whisper en todas las pruebas, y sin comprimir el codificador comete un 10 % menos de errores.
 */
export const MODELOS_WHISPER: Record<ModeloWhisper, { id: string; nombre: string; descripcion: string; dtype: Record<string, string>; mb: number; externos?: Record<string, number> }> = {
  turbo: {
    id: 'onnx-community/whisper-large-v3-turbo',
    nombre: 'Whisper Turbo',
    descripcion: 'La mejor precisión. Usa unos 4 GB de memoria de video.',
    dtype: { encoder_model: 'fp16', decoder_model_merged: 'q4f16' },
    mb: 1468,
  },
  'turbo-ligero': {
    id: 'onnx-community/whisper-large-v3-turbo',
    nombre: 'Whisper Turbo ligero',
    descripcion: 'Algo menos preciso y un poco más rápido. Usa menos de 2 GB de memoria de video.',
    dtype: { encoder_model: 'q4f16', decoder_model_merged: 'q4f16' },
    mb: 564,
  },
  base: {
    id: 'onnx-community/whisper-base',
    nombre: 'Whisper Base',
    descripcion: 'Muy ligero y mucho menos preciso. Para equipos sin una GPU potente.',
    dtype: { encoder_model: 'fp16', decoder_model_merged: 'q4' },
    mb: 165,
  },
};

export interface Ajustes {
  /** Cómo saludar en la pantalla de inicio. Si está vacío, el saludo va sin nombre. */
  nombre: string;
  /** Tema de la ventana de la app y del menú. Sobre el video el overlay siempre es oscuro. */
  tema: Tema;
  whisperModelo: ModeloWhisper;
  /** Cuánto se le exige a la GPU. En automático va suave mientras usas el equipo. */
  whisperIntensidad: 'auto' | 'suave' | 'rapida';
  /** Corrige con Claude los subtítulos automáticos de YouTube al abrirlos. */
  corregirAutomaticos: boolean;
  /** Corrige kanji y homófonos de la transcripción con Claude a medida que llega. */
  whisperCorregir: boolean;
  activo: boolean;
  sitiosDesactivados: string[];
  modoRender: ModoRender;

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

  // Apariencia
  idiomaInterfaz: 'es' | 'en';
  estiloFrecuencia: 'numero' | 'estrellas';
  frecuenciaMaxRecomendada: number;
  guardarHistorial: boolean;
}

export type PestanaDiccionario = 'audio' | 'imagenes' | 'explicar' | 'desglose' | 'traduccion' | 'enlaces' | 'ejemplos';

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
  nombre: '',
  tema: 'auto',
  whisperModelo: 'turbo',
  whisperIntensidad: 'auto',
  corregirAutomaticos: true,
  whisperCorregir: true,
  activo: true,
  sitiosDesactivados: [],
  modoRender: 'ligero',

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

  idiomaObjetivo: 'ja',
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

  destino: 'anki',
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
  diccionarioPestana: 'explicar',
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
    profundo: 'claude-opus-5-5',
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
    profundo: 'high',
  },
  respaldoSeguridad: true,
  usarGuion: true,
  nivel: 'JLPT N3',
  idiomaExplicaciones: 'español',
  idiomaTraduccion: 'español',
  prompts: {},
  analisisAutomatico: true,
  sentidoAutomatico: true,
  mostrarGramatica: true,

  azureClave: '',
  azureRegion: '',
  vocesFrase: ['ja-JP-MasaruMultilingualNeural', 'ja-JP-NanamiNeural'],

  idiomaInterfaz: 'es',
  estiloFrecuencia: 'numero',
  frecuenciaMaxRecomendada: 20000,
  guardarHistorial: true,
};

const CLAVE = 'ajustes';
export const CLAVE_API = 'claveAnthropic';

/** Mezcla profunda de un nivel para que los ajustes nuevos reciban su valor inicial. */
export function completarAjustes(guardados: Partial<Ajustes> | undefined): Ajustes {
  const salida = { ...AJUSTES_INICIALES, ...(guardados ?? {}) } as Ajustes;
  salida.prellenado = { ...AJUSTES_INICIALES.prellenado, ...(guardados?.prellenado ?? {}) };
  salida.modelos = { ...AJUSTES_INICIALES.modelos, ...(guardados?.modelos ?? {}) };
  salida.esfuerzos = { ...AJUSTES_INICIALES.esfuerzos, ...(guardados?.esfuerzos ?? {}) };
  // Un modelo que ya no existe (Kotoba se retiró al comparar con videos reales) pasa al de siempre.
  if (!MODELOS_WHISPER[salida.whisperModelo]) salida.whisperModelo = AJUSTES_INICIALES.whisperModelo;
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
};

export function configDeModo(a: Ajustes): ConfigModo {
  return a.modo === 'personalizado' ? a.modoPersonalizado : MODOS[a.modo];
}

export const NOMBRES_MODO: Record<IdModo, { titulo: string; descripcion: string }> = {
  normal: { titulo: 'Normal', descripcion: 'Reproduce sin detenerse ni ocultar subtítulos.' },
  escuchaPreparada: {
    titulo: 'Escucha preparada',
    descripcion: 'Pausa antes de cada frase y muestra la traducción para que escuches sabiendo qué esperar.',
  },
  lecturaIntensiva: {
    titulo: 'Lectura intensiva',
    descripcion: 'Pausa antes de cada frase para que leas el subtítulo y luego lo escuches.',
  },
  escuchaIntensiva: {
    titulo: 'Escucha intensiva',
    descripcion: 'Oculta los subtítulos hasta que se dice la frase; después pausa y los revela.',
  },
  hibridoIntensivo: {
    titulo: 'Híbrido intensivo',
    descripcion: 'Pausa después de cada frase, con los subtítulos siempre visibles.',
  },
  alPausar: { titulo: 'Mostrar al pausar', descripcion: 'Solo muestra subtítulos cuando el video está en pausa.' },
  enfoque1d: {
    titulo: 'Enfoque 1D',
    descripcion: 'Muestra las frases con una sola palabra desconocida; retrocede y pausa tras ellas.',
  },
  personalizado: { titulo: 'Personalizado', descripcion: 'Ajusta las pausas y lo que se oculta con controles avanzados.' },
};
