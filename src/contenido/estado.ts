// Estado reactivo del reproductor. Lo comparten el overlay de los sitios y el reproductor local.

import type { InfoAyudante } from '../compartido/api';
import { computed, signal } from '@preact/signals';
import { AJUSTES_INICIALES, type Ajustes, configDeModo } from '../compartido/ajustes';
import type { LineaAnalizada, PalabraToken, PistaInfo } from '../compartido/tipos';
import { calcularEstadisticas, clasificarFrase, type FiltroNavegador } from '../nucleo/frases';
import type { TipoPausa } from '../nucleo/modos';
import type { PuntoGramatica } from '../lenguas/tipos';
import { type PuntoAncla, type Sincronia, SINCRONIA_NEUTRA } from '../nucleo/sincronia';
import { type Linea, lineaConPuente, lineaEn } from '../nucleo/subtitulos';
import { tr } from '../compartido/i18n';

export const ajustes = signal<Ajustes>(AJUSTES_INICIALES);

export const infoVideo = signal<{ sitio: string; idVideo: string | null; titulo: string } | null>(null);
export const pistas = signal<PistaInfo[]>([]);
export const idObjetivo = signal<string | null>(null);
export const idSecundaria = signal<string | null>(null);
export const lineasObjetivo = signal<LineaAnalizada[]>([]);
export const lineasSecundarias = signal<Linea[]>([]);
export const cargandoPista = signal(false);
export const errorPista = signal<string | null>(null);

export const tiempoMs = signal(0);
export const pausado = signal(true);
export const tipoPausa = signal<TipoPausa>(null);
export const lineaPreparada = signal(-1);
export const anuncio = signal(false);
/** Rectángulo del video, medido desde el origen de los subtítulos: no cambia al hacer scroll en la página. */
export const rectVideo = signal<{ left: number; top: number; width: number; height: number } | null>(null);
/** Punto de referencia de los subtítulos, que viajan con la página para no ir a saltos al hacer scroll. */
export const origenSubs: { el: HTMLElement | null } = { el: null };
export const encimaSubtitulo = signal(false);

export interface Consulta {
  palabra: PalabraToken;
  linea: LineaAnalizada | null;
  ancla: { left: number; top: number; width: number; height: number };
  fijada: boolean;
}

export const consulta = signal<Consulta | null>(null);
export type NombrePanel = 'visual' | 'video' | 'atajos' | 'generar' | 'traductor' | 'comprension';
export const panel = signal<NombrePanel | null>(null);
export const barraVisible = signal(false);
export const verTemporal = signal(false);

export const marcadas = signal<ReadonlySet<number>>(new Set());
export const seleccionadas = signal<ReadonlySet<number>>(new Set());
export const filtro = signal<FiltroNavegador>('todas');

export interface Aviso {
  id: number;
  texto: string;
  tipo?: 'error' | 'exito';
  accion?: { texto: string; fn: () => void };
}
export const avisos = signal<Aviso[]>([]);
let contadorAvisos = 0;

export function avisar(texto: string, tipo?: Aviso['tipo'], accion?: Aviso['accion'], duracion = 4500): number {
  const id = ++contadorAvisos;
  avisos.value = [...avisos.value, { id, texto, tipo, accion }];
  if (duracion > 0) setTimeout(() => quitarAviso(id), duracion);
  return id;
}

export function quitarAviso(id: number) {
  avisos.value = avisos.value.filter((a) => a.id !== id);
}

export const capturaActiva = signal(false);
export const sinAceleracion = signal(false);
/** Los atajos que Chrome le ha dado a la extensión, que no siempre son los que pide. */
export const atajosChrome = signal<Record<string, string>>({});
/** Cómo se activa la captura en este navegador, para decirlo en los avisos. */
export const comoActivarCaptura = () => {
  const tecla = atajosChrome.value['alternar-captura'];
  return tecla ? `pulsa ${tecla}` : tr('usa el interruptor del menú de la extensión');
};
export const generacion = signal<{ tipo: 'secundarios' | 'objetivo'; hechas: number; total: number } | null>(null);
export const analisisEnCurso = signal<{ hechas: number; total: number } | null>(null);
/** Corrección con Claude de unos subtítulos automáticos. */
export const correccion = signal<{ hechas: number; total: number; cambiadas: number } | null>(null);
/** Texto original de las líneas que Claude corrigió, por id de línea. */
export const originales = signal<ReadonlyMap<number, string>>(new Map());
export interface EstadoWhisper {
  fase: 'bajando' | 'extrayendo' | 'preparando' | 'descargando' | 'escuchando' | 'procesando' | 'terminando' | 'recuperando';
  pausado?: boolean;
  /** Segundos que faltan, medidos con el ritmo real y ya con los descansos incluidos. */
  restanteS?: number | null;
  /** Archivo propio, procesado a toda velocidad, frente a la captura de la pestaña en tiempo real. */
  desdeArchivo?: boolean;
  lineas: number;
  porcentaje?: number;
  cargadoMb?: number;
  totalMb?: number;
  dispositivo?: string;
}
export const whisper = signal<EstadoWhisper | null>(null);
/** En el reproductor local se transcribe el archivo entero, sin captura de audio. */
export const transcribeArchivo = signal(false);
/** Con el ayudante local instalado, un video de internet se transcribe como si fuera un archivo. */
export const ayudante = signal<InfoAyudante | null>(null);

export const sincronias = signal<{ objetivo: Sincronia; secundaria: Sincronia }>({ objetivo: SINCRONIA_NEUTRA, secundaria: SINCRONIA_NEUTRA });
export const anclas = signal<PuntoAncla[]>([]);

export interface ConsultaGramatica {
  punto: PuntoGramatica;
  linea: LineaAnalizada;
  ancla: { left: number; top: number; width: number; height: number };
}
export const consultaGramatica = signal<ConsultaGramatica | null>(null);

export const opcionesFrase = computed(() => ({ frecuenciaMaxima: ajustes.value.frecuenciaMaxRecomendada }));

export const estadisticas = computed(() => calcularEstadisticas(lineasObjetivo.value, opcionesFrase.value));

export const clasesLineas = computed(() => lineasObjetivo.value.map((l) => clasificarFrase(l.palabras, opcionesFrase.value)));

export const configModo = computed(() => configDeModo(ajustes.value));

/** Las líneas ya llevan aplicada la sincronización, así que están en tiempo de video. */
export const indiceActivo = computed(() => lineaEn(lineasObjetivo.value, tiempoMs.value));

export const indiceSecundario = computed(() => lineaEn(lineasSecundarias.value, tiempoMs.value));

/** La que se muestra: si el modo pausó antes de una frase, se enseña la que va a sonar. */
export const indiceMostrado = computed(() => {
  if (pausado.value && lineaPreparada.value >= 0) return lineaPreparada.value;
  return indiceActivo.value;
});

export const secundariaMostrada = computed<Linea | null>(() => {
  const i = indiceMostrado.value;
  if (i >= 0 && pausado.value && lineaPreparada.value === i) {
    // Busca la traducción que coincide con la frase preparada.
    const l = lineasObjetivo.value[i];
    return lineasSecundarias.value.find((s) => s.inicio < l.fin && s.fin > l.inicio) ?? null;
  }
  const j = indiceSecundario.value;
  return j >= 0 ? lineasSecundarias.value[j] : null;
});

/** La línea en pantalla: como la mostrada, pero sin parpadear en los huecos cortos entre líneas. */
export const indiceVisual = computed(() => {
  if (pausado.value && lineaPreparada.value >= 0) return lineaPreparada.value;
  return lineaConPuente(lineasObjetivo.value, tiempoMs.value);
});

export const secundariaVisual = computed<Linea | null>(() => {
  const preparada = secundariaPreparada();
  if (preparada !== undefined) return preparada;
  const j = lineaConPuente(lineasSecundarias.value, tiempoMs.value);
  return j >= 0 ? lineasSecundarias.value[j] : null;
});

function secundariaPreparada(): Linea | null | undefined {
  const i = lineaPreparada.value;
  if (!pausado.value || i < 0) return undefined;
  const l = lineasObjetivo.value[i];
  return l ? (lineasSecundarias.value.find((s) => s.inicio < l.fin && s.fin > l.inicio) ?? null) : undefined;
}

/** Actualiza palabras sin rehacer las líneas que no cambian, para no repintar de más. */
export function aplicarCambioPalabra(clave: string, cambio: { estado?: PalabraToken['estado']; rastreada?: boolean }) {
  lineasObjetivo.value = lineasObjetivo.value.map((l) => {
    if (!l.palabras.some((p) => p.clave === clave)) return l;
    return { ...l, palabras: l.palabras.map((p) => (p.clave === clave ? { ...p, ...cambio } : p)) };
  });
  const c = consulta.value;
  if (c?.palabra.clave === clave) consulta.value = { ...c, palabra: { ...c.palabra, ...cambio } };
}
