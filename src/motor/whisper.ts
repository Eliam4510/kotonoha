// Transcripción local con Whisper: tu audio no sale de tu equipo y corre en tu GPU con WebGPU.
// Dos fuentes: la captura de la pestaña en tiempo real y los archivos propios.
//
// Whisper exige mucho a la GPU, y hacerlo sin control traba el escritorio y puede reiniciar el
// controlador. Por eso aquí: solo se procesa un trozo a la vez, se descansa tras cada uno, un trozo
// colgado se aborta, y si la GPU se pierde se reintenta con calma y al segundo fallo se para.

import { MODELOS_WHISPER, modeloParaTranscribir, type ModeloWhisper } from '../compartido/ajustes';
import { modeloGuardado } from '../compartido/modelosGuardados';
import { tr } from '../compartido/i18n';
import { fondo } from '../compartido/rpc';
import type { Linea } from '../nucleo/subtitulos';
import { textoDeLineas } from '../nucleo/dictado';
import { segmentosDeTokens, type TokenConTiempo } from '../nucleo/tdt';
import {
  AcumuladorAudio,
  esAlucinacion,
  esBucle,
  esGrabacionMuda,
  esSilencio,
  esTextoRecuperable,
  FRECUENCIA,
  type Hueco,
  huecosSinTexto,
  type IntensidadWhisper,
  ocupacionObjetivo,
  pausaTrasTrozo,
  type SegmentoWhisper,
  segmentosALineas,
  segundosRestantes,
  type TrozoAudio,
  ventanasDeHueco,
} from '../nucleo/transcripcion';
import { abrirDescarga } from './ayudante';
import { escucharPcm } from './grabacion';
import { lengua, motorLengua } from './lengua';

export type EventoWhisper =
  | { tipo: 'descarga'; porcentaje: number; cargadoMb: number; totalMb: number }
  | { tipo: 'preparando' }
  | { tipo: 'bajandoAudio'; porcentaje: number }
  | { tipo: 'extrayendoAudio'; porcentaje: number }
  | { tipo: 'escuchando'; dispositivo: string }
  | { tipo: 'procesando'; porcentaje?: number; dispositivo?: string; restanteS?: number | null }
  | { tipo: 'recuperando'; segundos: number }
  | { tipo: 'pausado'; pausado: boolean }
  | { tipo: 'retraso'; segundos: number }
  | { tipo: 'lineas'; lineas: Linea[] };

type Emitir = (e: EventoWhisper) => void;

const reglas = () => motorLengua().transcripcion.reglas;

// ---------- Trabajador ----------

let trabajador: Worker | null = null;
let contadorId = 0;
const pendientes = new Map<number, { ok: (r: { trozos?: { text: string; timestamp: [number, number | null] }[]; tokens?: TokenConTiempo[] }) => void; mal: (e: Error) => void }>();
let alMensajeCarga: ((m: Record<string, unknown>) => void) | null = null;
let temporizadorLiberar: ReturnType<typeof setTimeout> | null = null;

function fallarPendientes(error: Error) {
  for (const p of pendientes.values()) p.mal(error);
  pendientes.clear();
  alMensajeCarga?.({ tipo: 'error', mensaje: error.message });
}

function terminarTrabajador() {
  trabajador?.terminate();
  trabajador = null;
}

function obtenerTrabajador(): Worker {
  if (temporizadorLiberar) clearTimeout(temporizadorLiberar);
  temporizadorLiberar = null;
  if (trabajador) return trabajador;
  const t = new Worker(chrome.runtime.getURL('whisper.js'), { type: 'module' });
  t.onmessage = (e: MessageEvent) => {
    const m = e.data as Record<string, unknown>;
    if (m.tipo === 'gpuPerdida') {
      terminarTrabajador();
      fallarPendientes(new Error(tr('Se perdió la GPU: {0}', m.motivo ?? tr('el controlador se reinició'))));
      return;
    }
    if (m.tipo === 'resultado' || (m.tipo === 'error' && m.id !== undefined)) {
      const p = pendientes.get(m.id as number);
      if (!p) return;
      pendientes.delete(m.id as number);
      if (m.tipo === 'error') p.mal(new Error(m.mensaje as string));
      else p.ok(m as never);
      return;
    }
    alMensajeCarga?.(m);
  };
  t.onerror = (e) => {
    trabajador = null;
    fallarPendientes(new Error(e.message || tr('El trabajador de Whisper falló')));
  };
  trabajador = t;
  return t;
}

/** Libera la memoria de la GPU un rato después de terminar. */
function programarLiberacion() {
  if (temporizadorLiberar) clearTimeout(temporizadorLiberar);
  temporizadorLiberar = setTimeout(terminarTrabajador, 3 * 60 * 1000);
}

async function cargarModelo(idModelo: ModeloWhisper, emitir: Emitir): Promise<string> {
  const modelo = MODELOS_WHISPER[idModelo] ?? MODELOS_WHISPER.turbo;
  const t = obtenerTrabajador();
  const archivos = new Map<string, { cargado: number; total: number }>();
  let ultimo = 0;
  // Transformers.js avisa del avance igual si baja el modelo que si lo lee del disco. Con 1,4 GB, leerlo tarda lo bastante
  // como para que pareciera que se descarga otra vez cada vez que se usa.
  const yaGuardado = await modeloGuardado(modelo).catch(() => false);
  return new Promise<string>((ok, mal) => {
    alMensajeCarga = (m) => {
      if (m.tipo === 'descarga') {
        const archivo = String(m.archivo ?? '');
        if (m.total) archivos.set(archivo, { cargado: m.cargado as number, total: m.total as number });
        const cargado = [...archivos.values()].reduce((n, a) => n + a.cargado, 0);
        const total = [...archivos.values()].reduce((n, a) => n + a.total, 0);
        const ahora = Date.now();
        if (!yaGuardado && total > 20e6 && ahora - ultimo > 400) {
          ultimo = ahora;
          emitir({ tipo: 'descarga', porcentaje: Math.round((cargado / total) * 100), cargadoMb: Math.round(cargado / 1e6), totalMb: Math.round(total / 1e6) });
        }
      } else if (m.tipo === 'listo') {
        alMensajeCarga = null;
        ok(m.dispositivo as string);
      } else if (m.tipo === 'error') {
        alMensajeCarga = null;
        mal(new Error(m.mensaje as string));
      }
    };
    emitir({ tipo: 'preparando' });
    t.postMessage(modelo.tdt ? { tipo: 'cargarTdt', modelo: modelo.id, tdt: modelo.tdt } : { tipo: 'cargar', modelo: modelo.id, dtype: modelo.dtype, externos: modelo.externos });
  });
}

/** Un trozo normal tarda unos segundos. Si tarda esto, la GPU está colgada y no va a responder. */
const LIMITE_TROZO_MS = 90000;

/** Lo que devuelve el trabajador por un trozo: los tokens con su instante (un transductor) o los trozos de Whisper. */
type RespuestaTrozo = { trozos?: { text: string; timestamp: [number, number | null] }[]; tokens?: TokenConTiempo[] };

function pedirTrozo(pcm: Float32Array): Promise<RespuestaTrozo> {
  const t = obtenerTrabajador();
  const id = ++contadorId;
  return new Promise((ok, mal) => {
    const vigilante = setTimeout(() => {
      pendientes.delete(id);
      terminarTrabajador();
      mal(new Error(tr('La GPU dejó de responder')));
    }, LIMITE_TROZO_MS);
    pendientes.set(id, {
      ok: (r) => {
        clearTimeout(vigilante);
        ok(r);
      },
      mal: (e) => {
        clearTimeout(vigilante);
        mal(e);
      },
    });
    t.postMessage({ tipo: 'transcribir', id, pcm, idioma: motorLengua().transcripcion.idioma }, [pcm.buffer]);
  });
}

async function transcribirTrozo(pcm: Float32Array): Promise<SegmentoWhisper[]> {
  const r = await pedirTrozo(pcm);
  return r.tokens ? segmentosDeTokens(r.tokens, reglas()) : (r.trozos ?? []).map((c) => ({ texto: c.text, inicio: c.timestamp[0] ?? 0, fin: c.timestamp[1] ?? null }));
}

// ---------- Recuperación ----------

/** Tras reiniciarse el controlador conviene dejarlo asentar antes de volver a pedirle nada. */
const ESPERA_RECUPERACION_S = 20;
/** Si vuelve a pasar, se para: insistir podría tumbar el equipo. Lo transcrito ya está guardado. */
const MAXIMO_FALLOS_GPU = 2;

let fallosGpu = 0;
let trasFallo = false;

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function esperaCancelable(ms: number, senal: AbortSignal) {
  const fin = performance.now() + ms;
  while (performance.now() < fin && !senal.aborted && !pedidoDetener) await espera(Math.min(200, fin - performance.now()));
}

async function transcribirConRecuperacion(pcm: Float32Array, idModelo: ModeloWhisper, emitir: Emitir, senal: AbortSignal): Promise<SegmentoWhisper[]> {
  for (;;) {
    try {
      // Se envía una copia: el búfer se transfiere al trabajador y hay que conservarlo para reintentar.
      return await transcribirTrozo(pcm.slice());
    } catch (e) {
      if (senal.aborted) throw e;
      fallosGpu++;
      trasFallo = true;
      console.warn('Kotonoha: fallo de Whisper en la GPU', fallosGpu, e);
      terminarTrabajador();
      if (fallosGpu >= MAXIMO_FALLOS_GPU) {
        throw new Error(tr('La tarjeta gráfica falló dos veces, así que paré para no forzar tu equipo. Lo transcrito hasta ahora está guardado.'));
      }
      emitir({ tipo: 'recuperando', segundos: ESPERA_RECUPERACION_S });
      await esperaCancelable(ESPERA_RECUPERACION_S * 1000, senal);
      if (senal.aborted) throw e;
      await cargarModelo(idModelo, emitir);
    }
  }
}

// Basado en la hora para no chocar con las líneas guardadas de una transcripción anterior del mismo video.
let siguienteId = Math.floor(Date.now() / 1000) % 1000000000;
const RELLENO_S = 0.4;

async function procesarTrozo(trozo: TrozoAudio, idModelo: ModeloWhisper, emitir: Emitir, senal: AbortSignal): Promise<Linea[]> {
  // Un tramo sin voz solo produciría alucinaciones, y no merece gastar GPU.
  if (esSilencio(trozo.pcm)) return [];
  const duracion = trozo.pcm.length / FRECUENCIA;
  const relleno = Math.floor(FRECUENCIA * RELLENO_S);

  /** Transcribe un tramo del trozo por separado y devuelve sus tiempos respecto al trozo. */
  const pasada = async ({ desde, hasta }: Hueco): Promise<SegmentoWhisper[]> => {
    const parte = trozo.pcm.subarray(Math.floor(desde * FRECUENCIA), Math.floor(hasta * FRECUENCIA));
    if (esSilencio(parte) || senal.aborted) return [];
    // Whisper tiende a perder lo que suena justo al empezar: se le da un instante de silencio delante.
    const conRelleno = new Float32Array(relleno + parte.length);
    conRelleno.set(parte, relleno);
    return (await transcribirConRecuperacion(conRelleno, idModelo, emitir, senal)).map((s) => ({
      ...s,
      inicio: desde + Math.max(0, s.inicio - RELLENO_S),
      fin: s.fin === null ? null : desde + Math.max(0, s.fin - RELLENO_S),
    }));
  };

  /** El decodificador se atasca con este audio: con ventanas más cortas suele salir adelante. */
  const porVentanas = async (h: Hueco) => {
    const salida: SegmentoWhisper[] = [];
    for (const v of ventanasDeHueco(h)) salida.push(...(await pasada(v)).filter((s) => esTextoRecuperable(s.texto, reglas())));
    return salida;
  };

  const recuperar = async (h: Hueco, intento = 0): Promise<SegmentoWhisper[]> => {
    const crudos = await pasada(h);
    if (crudos.some((s) => esBucle(s.texto))) return porVentanas(h);
    const validos = crudos.filter((s) => esTextoRecuperable(s.texto, reglas()));
    // Si no sale nada, es música: insistir solo traería invenciones.
    if (!validos.length || intento > 0) return validos;
    for (const resto of huecosSinTexto(validos, h.desde, h.hasta, reglas())) validos.push(...(await recuperar(resto, intento + 1)));
    return validos;
  };

  const segmentos = (await pasada({ desde: 0, hasta: duracion })).filter((s) => !esBucle(s.texto) && !esAlucinacion(s.texto, reglas()));
  // Un transductor no se salta la voz por haber dado por terminado un trozo: volver a pasarlo no recupera nada.
  const huecos = MODELOS_WHISPER[idModelo]?.tdt ? [] : huecosSinTexto(segmentos, 0, duracion, reglas());
  for (const h of huecos) {
    if (senal.aborted) break;
    // Si faltó todo el trozo, repetir la misma ventana daría lo mismo: se prueba con otras más cortas.
    const todo = h.hasta - h.desde >= duracion - 1;
    segmentos.push(...(await (todo ? porVentanas(h) : recuperar(h))));
  }
  segmentos.sort((a, b) => a.inicio - b.inicio);
  const lineas = segmentosALineas(segmentos, trozo.mapa, duracion, siguienteId, reglas());
  siguienteId += lineas.length;
  return lineas;
}

// ---------- Control de carga ----------

let pausadoPorUsuario = false;
let ocupacionDePrueba: number | null = null;

export function pausar(v: boolean) {
  pausadoPorUsuario = v;
}

export const fijarOcupacionPrueba = (o: number | null) => {
  ocupacionDePrueba = o;
};

export function perderGpuPrueba() {
  trabajador?.postMessage({ tipo: 'perderGpuPrueba' });
}

let ultimaConsultaUso = 0;
let enUsoCache = true;

async function usandoElEquipo(): Promise<boolean> {
  if (performance.now() - ultimaConsultaUso > 15000) {
    ultimaConsultaUso = performance.now();
    enUsoCache = (await fondo.estadoUso().catch(() => 'active')) === 'active';
  }
  return enUsoCache;
}

/** Descansa en proporción a lo que tardó el trozo. También atiende la pausa pedida por ti. */
async function descansar(msTrozo: number, intensidad: () => Promise<IntensidadWhisper>, emitir: Emitir, senal: AbortSignal) {
  // Tras un fallo de la GPU se sigue en lo más suave, sea cual sea la intensidad elegida.
  const nivel = trasFallo ? 'suave' : await intensidad().catch(() => 'auto' as const);
  const ocupacion = ocupacionDePrueba ?? ocupacionObjetivo(nivel, await usandoElEquipo());
  await esperaCancelable(pausaTrasTrozo(msTrozo, ocupacion), senal);
  if (pausadoPorUsuario && !senal.aborted) {
    emitir({ tipo: 'pausado', pausado: true });
    while (pausadoPorUsuario && !senal.aborted) await espera(250);
    emitir({ tipo: 'pausado', pausado: false });
  }
}

// ---------- Tiempo real ----------

interface Marca {
  videoMs: number;
  reproduciendo: boolean;
  velocidad: number;
  instante: number;
}

let marca: Marca = { videoMs: 0, reproduciendo: false, velocidad: 1, instante: 0 };
let acumuladorVivo: AcumuladorAudio | null = null;
let hayCorte = false;

/** El reproductor informa del tiempo del video: la captura solo oye el audio, no sabe dónde va. */
export function marcarVideo(videoMs: number, reproduciendo: boolean, velocidad: number, salto: boolean) {
  marca = { videoMs, reproduciendo, velocidad, instante: performance.now() };
  if (salto) hayCorte = true;
}

let pedidoDetener = false;

/** Termina de transcribir lo ya oído antes de parar, para no perder la última frase. */
export function detenerEnVivo() {
  pedidoDetener = true;
}

/**
 * En tiempo real una película de dos horas no se envía de golpe: se procesa solo lo que va sonando,
 * así que la carga está acotada por la propia reproducción, sea cual sea la duración del video.
 */
export async function transcribirEnVivo(idModelo: ModeloWhisper, emitir: Emitir, senal: AbortSignal): Promise<number> {
  pedidoDetener = false;
  fallosGpu = 0;
  trasFallo = false;
  const dispositivo = await cargarModelo(idModelo, emitir);
  if (senal.aborted) return 0;
  emitir({ tipo: 'escuchando', dispositivo });

  const acumulador = new AcumuladorAudio();
  acumuladorVivo = acumulador;
  // Trozo pendiente tras un salto: se transcribe antes de seguir con el audio nuevo.
  const colaSaltos: TrozoAudio[] = [];
  const parar = escucharPcm((pcm) => {
    if (!marca.reproduciendo) return;
    // Con el salto de escenas el video va muy rápido: ese audio no se entiende.
    if (marca.velocidad > 2 || marca.velocidad < 0.5) return;
    if (hayCorte) {
      hayCorte = false;
      const t = acumulador.extraer(true);
      if (t) colaSaltos.push(t);
    }
    const videoMs = marca.videoMs + (performance.now() - marca.instante) * marca.velocidad - (pcm.length / FRECUENCIA) * 1000 * marca.velocidad;
    acumulador.agregar(pcm, Math.max(0, videoMs));
  });

  let total = 0;
  const enviar = async (t: TrozoAudio | null) => {
    if (!t) return;
    emitir({ tipo: 'procesando' });
    const lineas = await procesarTrozo(t, idModelo, emitir, senal);
    if (lineas.length) {
      total += lineas.length;
      emitir({ tipo: 'lineas', lineas });
    }
    // Si la GPU no da abasto, el audio se acumula: mejor saberlo que descubrirlo al final.
    const pendienteS = acumulador.muestras / FRECUENCIA;
    if (pendienteS > 60) emitir({ tipo: 'retraso', segundos: Math.round(pendienteS) });
    emitir({ tipo: 'escuchando', dispositivo });
  };

  try {
    while (!senal.aborted && !pedidoDetener) {
      if (pausadoPorUsuario) {
        await espera(250);
        continue;
      }
      await enviar(colaSaltos.shift() ?? acumulador.extraer());
      await espera(250);
    }
    // Lo último que se oyó también cuenta.
    await enviar(colaSaltos.shift() ?? null);
    await enviar(acumulador.extraer(true));
  } finally {
    parar();
    acumuladorVivo = null;
    pausadoPorUsuario = false;
    programarLiberacion();
  }
  return total;
}

// ---------- Archivos propios ----------

export interface FuenteMuestras {
  muestras: number;
  leer(desde: number, cuantas: number): Promise<Float32Array>;
}

/**
 * Lee el audio por partes para no tener una película entera en memoria.
 * Con `pcmCrudo` la URL ya trae las muestras, extraídas con ffmpeg: es la vía para archivos grandes.
 */
export async function abrirAudio(url: string, pcmCrudo: boolean): Promise<FuenteMuestras | null> {
  const respuesta = await fetch(url);
  if (pcmCrudo) {
    const blob = await respuesta.blob();
    return {
      muestras: Math.floor(blob.size / 4),
      leer: async (desde, cuantas) => new Float32Array(await blob.slice(desde * 4, (desde + cuantas) * 4).arrayBuffer()),
    };
  }
  const datos = await respuesta.arrayBuffer();
  // Decodificar remuestrea a la frecuencia del contexto, así que se aprovecha para pedir ya 16 kHz.
  const contexto = new OfflineAudioContext(1, FRECUENCIA, FRECUENCIA);
  const audio = await contexto.decodeAudioData(datos).catch(() => null);
  if (!audio) return null;
  const mezcla = new Float32Array(audio.length);
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const canal = audio.getChannelData(c);
    for (let i = 0; i < mezcla.length; i++) mezcla[i] += canal[i] / audio.numberOfChannels;
  }
  return { muestras: mezcla.length, leer: async (desde, cuantas) => mezcla.subarray(desde, desde + cuantas) };
}

export async function transcribirArchivo(
  url: string,
  idModelo: ModeloWhisper,
  intensidad: () => Promise<IntensidadWhisper>,
  emitir: Emitir,
  senal: AbortSignal,
  pcmCrudo = false,
  desdeMs = 0
): Promise<number> {
  emitir({ tipo: 'preparando' });
  const audio = await abrirAudio(url, pcmCrudo);
  if (!audio) throw new Error(tr('El navegador no puede leer el audio de este archivo. Reprodúcelo y usa la transcripción en tiempo real.'));
  return transcribirMuestras(audio, idModelo, intensidad, emitir, senal, desdeMs);
}

/** El ayudante local baja el audio del video: se transcribe entero, sin esperar a reproducirlo. */
export async function transcribirDescarga(
  url: string,
  idModelo: ModeloWhisper,
  intensidad: () => Promise<IntensidadWhisper>,
  emitir: Emitir,
  senal: AbortSignal,
  desdeMs = 0
): Promise<number> {
  emitir({ tipo: 'bajandoAudio', porcentaje: 0 });
  const audio = await abrirDescarga(
    url,
    (porcentaje) => emitir({ tipo: 'bajandoAudio', porcentaje }),
    senal,
    (porcentaje) => emitir({ tipo: 'extrayendoAudio', porcentaje })
  );
  try {
    return await transcribirMuestras(audio, idModelo, intensidad, emitir, senal, desdeMs);
  } finally {
    audio.cerrar();
  }
}

async function transcribirMuestras(
  audio: FuenteMuestras,
  idModelo: ModeloWhisper,
  intensidad: () => Promise<IntensidadWhisper>,
  emitir: Emitir,
  senal: AbortSignal,
  desdeMs: number
): Promise<number> {
  pedidoDetener = false;
  fallosGpu = 0;
  trasFallo = false;
  const dispositivo = await cargarModelo(idModelo, emitir);
  const inicioMuestra = Math.min(audio.muestras, Math.floor((desdeMs / 1000) * FRECUENCIA));
  emitir({ tipo: 'procesando', porcentaje: Math.round((inicioMuestra / Math.max(audio.muestras, 1)) * 100), dispositivo });

  const acumulador = new AcumuladorAudio();
  const relojInicio = performance.now();
  let total = 0;

  const procesar = async (t: TrozoAudio, posicion: number) => {
    const hechas = posicion - acumulador.muestras - inicioMuestra;
    const porHacer = audio.muestras - inicioMuestra;
    emitir({
      tipo: 'procesando',
      porcentaje: Math.round(((posicion - acumulador.muestras) / audio.muestras) * 100),
      restanteS: segundosRestantes(hechas, porHacer, (performance.now() - relojInicio) / 1000),
    });
    const antes = performance.now();
    const lineas = await procesarTrozo(t, idModelo, emitir, senal);
    if (lineas.length) {
      total += lineas.length;
      emitir({ tipo: 'lineas', lineas });
    }
    await descansar(performance.now() - antes, intensidad, emitir, senal);
  };

  try {
    const bloque = FRECUENCIA * 60;
    for (let p = inicioMuestra; p < audio.muestras && !senal.aborted; ) {
      // El acumulador corta por los silencios: se le va dando audio a medida que lo necesita.
      while (acumulador.muestras < 30 * FRECUENCIA && p < audio.muestras) {
        const parte = await audio.leer(p, bloque);
        acumulador.agregar(parte, (p / FRECUENCIA) * 1000);
        p += parte.length;
      }
      for (let t = acumulador.extraer(); t && !senal.aborted; t = acumulador.extraer()) await procesar(t, p);
    }
    const final = senal.aborted ? null : acumulador.extraer(true);
    if (final) await procesar(final, audio.muestras);
    if (!senal.aborted) emitir({ tipo: 'procesando', porcentaje: 100, restanteS: 0 });
  } finally {
    pausadoPorUsuario = false;
    programarLiberacion();
  }
  return total;
}

export const transcribiendoEnVivo = () => acumuladorVivo !== null;

// ---------- Práctica de pronunciación ----------

/** Una frase para practicar dura poco: lo que pase de esto no se transcribe. */
const MAXIMO_PRACTICA_S = 30;

/**
 * La transcripción de una frase leída en voz alta, token a token y con el instante en que empieza cada uno: con eso se
 * sabe dónde suena cada palabra para medir su tono. Necesita un transductor, que da esos instantes: el modelo de voz de la
 * lengua (Haas-ja en japonés), sea cual sea el elegido para transcribir videos. Sin voz, ningún token.
 */
export async function tokensDeGrabacion(url: string, emitir: Emitir, senal: AbortSignal): Promise<TokenConTiempo[]> {
  emitir({ tipo: 'preparando' });
  const audio = await abrirAudio(url, false);
  if (!audio) throw new Error(tr('El navegador no pudo leer la grabación.'));
  const pcm = await audio.leer(0, Math.min(audio.muestras, MAXIMO_PRACTICA_S * FRECUENCIA));
  if (esGrabacionMuda(pcm)) return [];
  const modelo = modeloParaTranscribir('auto', lengua().id, false);
  if (!MODELOS_WHISPER[modelo]?.tdt) throw new Error(tr('Esta lengua no tiene un modelo de voz que diga dónde suena cada palabra.'));
  const dispositivo = await cargarModelo(modelo, emitir);
  if (senal.aborted) return [];
  emitir({ tipo: 'procesando', dispositivo });
  try {
    const r = await pedirTrozo(pcm.slice());
    return (r.tokens ?? []).filter((t) => t.texto);
  } finally {
    programarLiberacion();
  }
}

// ---------- Dictado ----------

/**
 * Una grabación del micrófono, entera: el dictado del Portapapeles. Se corta por los silencios como un archivo, pero sin
 * descansos entre trozos, porque dura poco, y sin tocar el estado de otra transcripción que pueda estar en marcha (su
 * pausa o su parada). Devuelve el texto, con las líneas seguidas como en un párrafo.
 */
export async function transcribirGrabacion(url: string, idModelo: ModeloWhisper, emitir: Emitir, senal: AbortSignal): Promise<string> {
  emitir({ tipo: 'preparando' });
  const audio = await abrirAudio(url, false);
  if (!audio) throw new Error(tr('El navegador no pudo leer la grabación.'));
  const muestras = await audio.leer(0, audio.muestras);
  // Para saber que no hay voz no hace falta cargar el modelo.
  if (esGrabacionMuda(muestras)) return '';
  const dispositivo = await cargarModelo(idModelo, emitir);
  const acumulador = new AcumuladorAudio();
  acumulador.agregar(muestras, 0);
  const textos: string[] = [];
  try {
    for (let t = acumulador.extraer(true); t && !senal.aborted; t = acumulador.extraer(true)) {
      const hechas = audio.muestras - acumulador.muestras - t.pcm.length;
      emitir({ tipo: 'procesando', porcentaje: Math.round((hechas / Math.max(audio.muestras, 1)) * 100), dispositivo });
      for (const l of await procesarTrozo(t, idModelo, emitir, senal)) textos.push(l.texto);
    }
  } finally {
    programarLiberacion();
  }
  return textoDeLineas(textos, !!reglas().espacios);
}
