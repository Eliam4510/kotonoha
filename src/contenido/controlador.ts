// Coordina el video con los subtítulos: elige pistas, aplica modos, salto y pausas de interacción.

import { effect } from '@preact/signals';
import { alRecibirEvento, flujoMotor, fondo, motor } from '../compartido/rpc';
import type { LineaAnalizada, PalabraToken, PistaInfo } from '../compartido/tipos';
import { desconocidas } from '../nucleo/frases';
import { decidirSalto, duracionPausaDinamica, type LineaModo, MotorModos } from '../nucleo/modos';
import { aplicarSincronia, type PuntoAncla, type Sincronia, SINCRONIA_NEUTRA, sincroniaDesdePuntos } from '../nucleo/sincronia';
import { aplicarAjuste, type EntradaAjuste, versosDeLetra } from '../nucleo/letra';
import { analizarSubtitulos, aSrt, esSoloAcotacion, type Linea, siguienteLinea } from '../nucleo/subtitulos';
import { fusionarLineas } from '../nucleo/transcripcion';
import { guardarAjustes } from '../compartido/ajustes';
import {
  ajustes,
  analisisEnCurso,
  ayudante,
  anclas,
  anuncio,
  aplicarCambioPalabra,
  atajosChrome,
  avisar,
  capturaActiva,
  cargandoPista,
  clasesLineas,
  comoActivarCaptura,
  configModo,
  consulta,
  correccion,
  errorPista,
  generacion,
  idObjetivo,
  idSecundaria,
  indiceActivo,
  indiceVisual,
  infoVideo,
  lineaPreparada,
  lineasObjetivo,
  lineasSecundarias,
  marcadas,
  originales,
  pausado,
  pistas,
  origenSubs,
  rectVideo,
  seleccionadas,
  sincronias,
  tiempoMs,
  tipoPausa,
  transcribeArchivo,
  whisper,
  ajustandoLetra,
  letraPegada,
} from './estado';
import type { Control } from './puente';
import { tm, tr } from '../compartido/i18n';
import { lengua } from '../ui/lengua';

let control: Control;

const motorModos = new MotorModos({ objetivosPausa: [], disparador: 'ninguno', velarObjetivo: { modo: 'no', revelarEnPausa: [], revelarPorEstado: [], revelarAlPasar: true }, velarSecundario: { modo: 'no', revelarEnPausa: [], revelarPorEstado: [], revelarAlPasar: true } }, []);

export const pausasEnLinea = (i: number) => motorModos.pausasAutomaticas(i);

let pausaPropia = false;
let reproduccionPropia = false;
let acelerando = false;
let velocidadPrevia = 1;
let temporizadorReanudar: ReturnType<typeof setTimeout> | null = null;
let pausadaPorConsulta = false;
let pausaDiferidaEn = -1;
let videoActual: HTMLVideoElement | null = null;

const MARCADORES = 'kotonohaMarcadores';

/** Mientras se graba una frase para una tarjeta: el video se mueve solo, y nada de eso es cosa de quien mira. */
export const grabandoLinea = () => grabacionEnCurso !== null;

export function iniciarControlador(c: Control) {
  control = c;
  effect(() => {
    const lineas = lineasObjetivo.value;
    const clases = clasesLineas.value;
    const a = ajustes.value;
    const datos: LineaModo[] = lineas.map((l, i) => ({ inicio: l.inicio, fin: l.fin, clases: clases[i] }));
    motorModos.actualizar(configModo.value, datos, a.desfasePausaMs);
  });

  setInterval(tick, 50);
  setInterval(actualizarRect, 250);
  // Además de la comprobación periódica, responde al instante a lo que puede mover el video.
  window.addEventListener('resize', actualizarRect, { passive: true });
  document.addEventListener('scroll', actualizarRect, { capture: true, passive: true });
  document.addEventListener('fullscreenchange', () => requestAnimationFrame(actualizarRect));
  alRecibirEvento((e) => {
    if (e.tipo === 'palabras') for (const ca of e.cambios) aplicarCambioPalabra(ca.clave, { estado: ca.estado ?? undefined, rastreada: ca.rastreada });
    if (e.tipo === 'palabrasRecargar' || e.tipo === 'diccionarios') reanalizar();
    // Se pregunta en lugar de usar el dato del aviso: la captura de otra pestaña no sirve para esta.
    if (e.tipo === 'captura') {
      const antes = capturaActiva.value;
      actualizarCaptura().then((ahora) => {
        if (ahora !== antes) avisar(ahora ? tr('Captura de audio activada en esta pestaña') : tr('Captura de audio desactivada'), undefined, undefined, 2500);
      }).catch(() => {});
    }
    if (e.tipo === 'capturaFallida') avisar(tr('No se pudo activar la captura: {0}', e.motivo), 'error', undefined, 9000);
  });
  actualizarCaptura().catch(() => {});
  actualizarAtajos();
  // Se pueden cambiar en otra pestaña: al volver, hay que decir los nuevos.
  window.addEventListener('focus', actualizarAtajos);
}

function actualizarAtajos() {
  fondo.atajos().then((a) => (atajosChrome.value = a)).catch(() => {});
}

export async function actualizarCaptura(): Promise<boolean> {
  capturaActiva.value = await fondo.capturaActiva();
  return capturaActiva.value;
}

/**
 * Mientras se graba una línea, el video es de la grabación: nada debe pausarlo, acelerarlo ni moverlo.
 * Graba a velocidad normal, sea cual sea la que se esté usando, y al terminar todo queda como estaba.
 */
let grabacionEnCurso: { velocidad: number; pausa: typeof tipoPausa.value } | null = null;

export function empezarGrabacionLinea(v: HTMLVideoElement) {
  grabacionEnCurso = { velocidad: acelerando ? velocidadPrevia : v.playbackRate, pausa: tipoPausa.value };
  acelerando = false;
  pausaDiferidaEn = -1;
  cancelarReanudar();
  v.playbackRate = 1;
}

export function terminarGrabacionLinea(v: HTMLVideoElement) {
  if (!grabacionEnCurso) return;
  v.playbackRate = grabacionEnCurso.velocidad;
  if (v.paused) tipoPausa.value = grabacionEnCurso.pausa;
  grabacionEnCurso = null;
}

function actualizarRect() {
  const v = control.video();
  if (!v) {
    if (rectVideo.value) rectVideo.value = null;
    return;
  }
  // Se mide desde el origen de los subtítulos, y en el mismo instante: si la página se desplaza, los dos
  // se mueven igual, la diferencia no cambia y nada se repinta. El navegador los lleva con el scroll.
  const r = v.getBoundingClientRect();
  const o = origenSubs.el?.getBoundingClientRect();
  const left = r.left - (o?.left ?? 0);
  const top = r.top - (o?.top ?? 0);
  const p = rectVideo.value;
  if (!p || p.left !== left || p.top !== top || p.width !== r.width || p.height !== r.height) {
    rectVideo.value = { left, top, width: r.width, height: r.height };
  }
}

/** Si el video se ha ido de la pantalla, por ejemplo al leer los comentarios, la barra no estorba. */
export function videoEnPantalla(): boolean {
  const r = control?.video()?.getBoundingClientRect();
  return !!r && r.bottom > 80 && r.top < innerHeight;
}

function enlazarVideo(v: HTMLVideoElement) {
  if (v === videoActual) return;
  videoActual = v;
  new ResizeObserver(actualizarRect).observe(v);
  actualizarRect();
  v.addEventListener('pause', () => {
    if (!pausaPropia) tipoPausa.value = 'manual';
    pausaPropia = false;
    alPausar();
  });
  v.addEventListener('play', () => {
    if (!reproduccionPropia) {
      tipoPausa.value = null;
      cancelarReanudar();
    }
    reproduccionPropia = false;
    lineaPreparada.value = -1;
    tipoPausa.value = null;
  });
}

function alPausar() {
  const a = ajustes.value;
  if (!a.autoConsultaAlPausar || consulta.value || grabacionEnCurso) return;
  const i = indiceVisual.value;
  if (i < 0) return;
  const primera = desconocidas(lineasObjetivo.value[i].palabras)[0];
  if (primera) abrirConsultaDe(primera, lineasObjetivo.value[i]);
}

// Se resuelve desde la interfaz: necesita el rectángulo de la palabra en pantalla.
export let abrirConsultaDe: (p: PalabraToken, l: LineaAnalizada) => void = () => {};
export const fijarAbrirConsulta = (f: typeof abrirConsultaDe) => {
  abrirConsultaDe = f;
};

function cancelarReanudar() {
  if (temporizadorReanudar) clearTimeout(temporizadorReanudar);
  temporizadorReanudar = null;
}

function programarReanudar(indice: number) {
  const a = ajustes.value;
  cancelarReanudar();
  let espera = 0;
  if (a.reanudarDinamico) {
    const palabras = lineasObjetivo.value[indice]?.palabras.filter((p) => p.esPalabra).length ?? 0;
    espera = duracionPausaDinamica(palabras, a.velocidadLectura, a.duracionMinimaPausa);
  } else if (a.reanudarTras) {
    espera = a.reanudarSegundos * 1000;
  }
  if (espera > 0) temporizadorReanudar = setTimeout(() => reproducir(), espera);
}

export function pausar(tipo: 'manual' | 'auto' = 'auto') {
  pausaPropia = true;
  tipoPausa.value = tipo;
  return control.pausar();
}

export function reproducir() {
  reproduccionPropia = true;
  cancelarReanudar();
  lineaPreparada.value = -1;
  return control.reproducir();
}

export function saltar(ms: number) {
  lineaPreparada.value = -1;
  return control.saltar(Math.max(0, ms));
}

let avisoActualizacion = false;

/** Tras recargarse la extensión, esta página sigue con la versión anterior y sin conexión con el motor. */
function comprobarConexion() {
  if (avisoActualizacion || chrome.runtime?.id) return;
  avisoActualizacion = true;
  avisar('Kotonoha se actualizó. Recarga la página para usar la versión nueva.', undefined, { texto: tr('Recargar'), fn: () => location.reload() }, 0);
}

function tick() {
  comprobarConexion();
  const v = control.video();
  if (!v) return;
  enlazarVideo(v);
  const ms = v.currentTime * 1000;
  tiempoMs.value = Math.round(ms);
  pausado.value = v.paused;
  vigilarRevision();
  if (v.paused || anuncio.value || grabacionEnCurso) return;

  const a = ajustes.value;

  if (pausaDiferidaEn >= 0) {
    const l = lineasObjetivo.value[pausaDiferidaEn];
    if (!l || ms >= l.fin - 60) {
      pausaDiferidaEn = -1;
      pausar('manual');
      pausadaPorConsulta = true;
    }
  }

  const accion = motorModos.alAvanzar(ms);
  if (accion) {
    if (accion.tipo === 'pausar') {
      pausar('auto');
      if (accion.momento === 'antes') lineaPreparada.value = accion.indice;
      programarReanudar(accion.indice);
    } else {
      pausar('auto');
      saltar(accion.ms);
      lineaPreparada.value = accion.indice;
      programarReanudar(accion.indice);
    }
    return;
  }

  const lineasSalto = lineasParaSalto();
  const dec = decidirSalto(a.salto, ms, lineasSalto, acelerando);
  if (dec?.tipo === 'velocidad') {
    velocidadPrevia = v.playbackRate;
    v.playbackRate = dec.valor;
    acelerando = true;
  } else if (dec?.tipo === 'restaurar') {
    v.playbackRate = velocidadPrevia;
    acelerando = false;
  } else if (dec?.tipo === 'saltar') {
    saltar(dec.ms);
  }
}

let cacheSalto: { fuente: Linea[]; quitar: boolean; lista: Linea[] } | null = null;

function lineasParaSalto(): Linea[] {
  const fuente = lineasObjetivo.value;
  const quitar = ajustes.value.quitarAcotaciones;
  if (cacheSalto && cacheSalto.fuente === fuente && cacheSalto.quitar === quitar) return cacheSalto.lista;
  const lista = quitar ? fuente.filter((l) => !esSoloAcotacion(l.texto)) : fuente;
  cacheSalto = { fuente, quitar, lista };
  return lista;
}

// ---------- Interacción con la consulta de palabras ----------

export function alAbrirConsulta() {
  const a = ajustes.value;
  if (a.pausaInteraccion !== 'consultaPalabra' || pausado.value) return;
  if (a.pausaDiferida) {
    pausaDiferidaEn = indiceActivo.value;
    return;
  }
  pausar('manual');
  pausadaPorConsulta = true;
}

export function alCerrarConsulta() {
  pausaDiferidaEn = -1;
  if (pausadaPorConsulta && ajustes.value.reanudarAlTerminar) reproducir();
  pausadaPorConsulta = false;
}

export function alEntrarSubtitulo() {
  if (ajustes.value.pausaInteraccion === 'alPasarSubtitulo' && !pausado.value) {
    pausar('manual');
    pausadaPorConsulta = true;
  }
}

export function alSalirSubtitulo() {
  if (ajustes.value.pausaInteraccion === 'alPasarSubtitulo' && pausadaPorConsulta && !consulta.value) {
    alCerrarConsulta();
  }
}

// ---------- Pistas ----------

function elegirPista(lista: PistaInfo[], idioma: string): PistaInfo | undefined {
  const base = idioma.split('-')[0];
  const coincide = (p: PistaInfo) => p.idioma === idioma || p.idioma.split('-')[0] === base;
  const candidatas = lista.filter(coincide);
  // Mejor los subtítulos hechos a mano que los automáticos, y sin CC para no leer acotaciones.
  return candidatas.find((p) => p.origen === 'letra') ?? candidatas.find((p) => p.origen === 'importada') ?? candidatas.find((p) => !p.automatica && !p.cc) ?? candidatas.find((p) => !p.automatica) ?? candidatas[0];
}

const importadas = new Map<string, Linea[]>();

// Tiempos originales de cada pista. Lo que se muestra es esto con la sincronización aplicada.
let baseObjetivo: LineaAnalizada[] = [];
let baseSecundaria: Linea[] = [];

const claveSincronia = (pista: string | null) => `kotonohaSincronia:${infoVideo.value?.idVideo ?? ''}:${pista ?? ''}`;

async function leerSincronia(pista: string | null): Promise<Sincronia> {
  const k = claveSincronia(pista);
  const d = await chrome.storage.local.get(k).catch(() => ({} as Record<string, unknown>));
  return (d[k] as Sincronia | undefined) ?? SINCRONIA_NEUTRA;
}

function publicarObjetivo(lineas: LineaAnalizada[]) {
  baseObjetivo = lineas;
  lineasObjetivo.value = aplicarSincronia(lineas, sincronias.value.objetivo);
}

function publicarSecundaria(lineas: Linea[]) {
  baseSecundaria = lineas;
  lineasSecundarias.value = aplicarSincronia(lineas, sincronias.value.secundaria);
}

export function fijarSincronia(pista: 'objetivo' | 'secundaria', s: Sincronia) {
  sincronias.value = { ...sincronias.value, [pista]: s };
  const id = pista === 'objetivo' ? idObjetivo.value : idSecundaria.value;
  chrome.storage.local.set({ [claveSincronia(id)]: s }).catch(() => {});
  if (pista === 'objetivo') lineasObjetivo.value = aplicarSincronia(baseObjetivo, s);
  else lineasSecundarias.value = aplicarSincronia(baseSecundaria, s);
  motorModos.reiniciar();
}

export function ajustarDesfase(pista: 'objetivo' | 'secundaria', deltaMs: number) {
  const actual = sincronias.value[pista];
  fijarSincronia(pista, { ...actual, desfaseMs: actual.desfaseMs + deltaMs });
}

/** Sincroniza diciendo «esta línea suena ahora». Con dos marcas corrige también la velocidad. */
export function anclarLinea(l: LineaAnalizada) {
  const original = baseObjetivo.find((b) => b.id === l.id);
  if (!original) return;
  const punto: PuntoAncla = { linea: original.inicio, video: tiempoMs.value };
  const nuevas = [...anclas.value.filter((a) => a.linea !== punto.linea), punto].sort((a, b) => a.linea - b.linea).slice(-2);
  anclas.value = nuevas;
  fijarSincronia('objetivo', sincroniaDesdePuntos(nuevas));
  avisar(nuevas.length === 1 ? tr('Línea alineada. Marca otra lejos de esta para ajustar también la velocidad.') : tr('Sincronía ajustada con dos marcas.'), 'exito');
}

export function reiniciarSincronia(pista: 'objetivo' | 'secundaria') {
  if (pista === 'objetivo') anclas.value = [];
  fijarSincronia(pista, SINCRONIA_NEUTRA);
}

/** Descarga la pista como SRT, ya sincronizada. */
export function exportarSrt(pista: 'objetivo' | 'secundaria') {
  const lineas: Linea[] = pista === 'objetivo' ? lineasObjetivo.value : lineasSecundarias.value;
  if (!lineas.length) {
    avisar(tr('No hay subtítulos que exportar.'), 'error');
    return;
  }
  const idioma = pista === 'objetivo' ? ajustes.value.idiomaObjetivo : ajustes.value.idiomaSecundario;
  const titulo = (infoVideo.value?.titulo ?? 'subtitulos').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 90);
  const url = URL.createObjectURL(new Blob(['\ufeff' + aSrt(lineas)], { type: 'application/x-subrip;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${titulo}.${idioma}.srt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  avisar(`Exportado: ${a.download}`, 'exito');
}

const crudas = (lineas: LineaAnalizada[]): Linea[] => lineas.map(({ palabras: _p, gramatica: _g, ...l }) => l);

let flujoAnalisis: { cancelar(): void } | null = null;
let temporizadorRefresco: ReturnType<typeof setTimeout> | null = null;

/**
 * Revisar con Claude es lo que más gasta por video, y no siempre se ve un video entero: se revisa lo que
 * está por verse, con unos minutos de adelanto, y se sigue a medida que avanza. Lo revisado queda guardado,
 * así que volver atrás o verlo otra vez no cuesta nada.
 */
const VENTANA_REVISION = 120;
const ADELANTO_REVISION = 40;
let ventanaRevision: { desde: number; hasta: number } | null = null;

function vigilarRevision() {
  const w = ventanaRevision;
  if (!w || flujoAnalisis || correccion.value || !ajustes.value.analisisAutomatico) return;
  const i = indiceActivo.value;
  if (i >= 0 && (i < w.desde || i > w.hasta - ADELANTO_REVISION)) iniciarAnalisisProfundo().catch(() => {});
}

/**
 * Pide a Claude que revise lecturas, sentidos y gramática de las líneas que aún no conoce.
 * El botón de revisar (`todoElVideo`) cubre el video entero; lo automático, solo el tramo que viene.
 */
export async function iniciarAnalisisProfundo(todoElVideo = false) {
  // Lo que Whisper está oyendo se va a sustituir por la letra: revisarlo sería pagar por nada.
  if (!todoElVideo && whisper.value && hayLetraPendiente()) return;
  flujoAnalisis?.cancelar();
  const a = ajustes.value;
  const lineas = baseObjetivo;
  if (!lineas.length) return;
  const lineasCrudas = crudas(lineas);
  const indice = indiceActualEn(lineasCrudas);
  const tope = todoElVideo ? 0 : VENTANA_REVISION;
  const desde = Math.max(0, indice - 3);
  ventanaRevision = todoElVideo ? { desde: 0, hasta: lineas.length } : { desde, hasta: desde + VENTANA_REVISION };
  const estado = await motor.estado();
  if (!estado.claveIA) {
    if (todoElVideo) avisar(tr('Añade tu clave de la API de Claude en Ajustes para revisar lecturas, sentidos y gramática.'), 'error', { texto: tr('Ajustes'), fn: () => fondo.abrirApp('ajustes') }, 8000);
    return;
  }
  if (!a.analisisAutomatico && !todoElVideo) return;
  const turno = turnoCarga;
  const f = flujoMotor('analisisProfundo', [lineasCrudas, infoVideo.value?.titulo, indice, tope], (acum) => {
    const ultima = acum.trim().split('\n').pop() ?? '';
    const [h, t] = ultima.split('/').map(Number);
    if (!t) return;
    analisisEnCurso.value = { hechas: h, total: t };
    // Va mostrando las correcciones a medida que llegan, sin repintar en cada trozo.
    if (temporizadorRefresco) clearTimeout(temporizadorRefresco);
    temporizadorRefresco = setTimeout(() => {
      if (turno === turnoCarga) refrescarAnalisis().catch(() => {});
    }, 1200);
  });
  flujoAnalisis = f;
  try {
    const n = await f;
    if (turno === turnoCarga && n !== '0' && n !== '') await refrescarAnalisis();
    if (todoElVideo && n === '0') avisar(tr('Estas líneas ya estaban revisadas.'));
  } catch (e) {
    avisar(tr('No se pudo revisar con Claude: {0}', e instanceof Error ? e.message : e), 'error', undefined, 8000);
  } finally {
    if (turno === turnoCarga) analisisEnCurso.value = null;
    flujoAnalisis = null;
  }
}

/** Vuelve a pedir las líneas al motor, que aplica lo que Claude ya ha revisado. */
export async function refrescarAnalisis() {
  if (!baseObjetivo.length) return;
  publicarObjetivo(await motor.analizarLineas(crudas(baseObjetivo)));
}

async function textoAPista(p: PistaInfo): Promise<Linea[]> {
  const guardada = importadas.get(p.id);
  if (guardada) return guardada;
  return analizarSubtitulos(await control.cargarPista(p.id));
}

let turnoCarga = 0;

const clavePista = (id: string | null) => `${infoVideo.value?.idVideo ?? ''}|${id ?? ''}`;

function aplicarCorreccionesGuardadas(lineas: Linea[], cambios: Record<number, string>): Linea[] {
  const antes = new Map<number, string>();
  const salida = lineas.flatMap((l) => {
    const c = cambios[l.id];
    if (c === undefined || c === l.texto) return [l];
    antes.set(l.id, l.texto);
    return c.trim() ? [{ ...l, texto: c }] : [];
  });
  originales.value = antes;
  return salida;
}

/**
 * Los subtítulos en japonés de Netflix se guardan al verlos. El identificador de una película es el
 * mismo en todos los países, así que siguen ahí al abrirla en otra región, con los secundarios de esa región.
 */
function recordarPista(p: PistaInfo, lineas: Linea[]) {
  const info = infoVideo.value;
  if (info?.sitio !== 'netflix' || !info.idVideo || p.origen !== 'sitio' || p.automatica) return;
  if (p.idioma.split('-')[0] !== ajustes.value.idiomaObjetivo.split('-')[0]) return;
  // Un SRT que importaste a mano vale más que lo recordado.
  if (pistas.value.some((x) => x.origen === 'importada' && x.idioma.split('-')[0] === p.idioma.split('-')[0])) return;
  motor.guardarSubtitulosGenerados(info.idVideo, ajustes.value.idiomaObjetivo, lineas, 'recordada').catch(() => {});
}

export async function seleccionarObjetivo(id: string | null) {
  idObjetivo.value = id;
  errorPista.value = null;
  marcadas.value = new Set();
  seleccionadas.value = new Set();
  const turno = ++turnoCarga;
  anclas.value = [];
  flujoAnalisis?.cancelar();
  ventanaRevision = null;
  analisisEnCurso.value = null;
  flujoCorreccion?.cancelar();
  correccion.value = null;
  originales.value = new Map();
  if (!id) {
    baseObjetivo = [];
    lineasObjetivo.value = [];
    return;
  }
  const p = pistas.value.find((x) => x.id === id);
  if (!p) return;
  cargandoPista.value = true;
  try {
    const sinCorregir = await textoAPista(p);
    if (turno !== turnoCarga) return;
    // Lo que Claude ya corrigió de esta pista se aplica sin volver a pagarlo.
    const previa = await motor.correccionesPista(clavePista(id)).catch(() => undefined);
    const lineas = previa ? aplicarCorreccionesGuardadas(sinCorregir, previa.cambios) : sinCorregir;
    const info = infoVideo.value;
    const analizadas = await motor.analizarLineas(lineas, { titulo: info?.titulo, url: location.href, idVideo: info?.idVideo ?? undefined });
    if (turno !== turnoCarga) return;
    sincronias.value = { ...sincronias.value, objetivo: await leerSincronia(id) };
    publicarObjetivo(analizadas);
    motorModos.reiniciar();
    cargarMarcadores();
    recordarPista(p, lineas);
    // En una pista automática se corrige primero: analizar un texto con errores sería gastar en balde.
    if (p.automatica && ajustes.value.corregirAutomaticos && !previa?.completa) {
      corregirSubtitulos().finally(() => {
        if (turno === turnoCarga) iniciarAnalisisProfundo().catch(() => {});
      });
    } else {
      iniciarAnalisisProfundo().catch(() => {});
    }
  } catch (e) {
    if (turno === turnoCarga) errorPista.value = e instanceof Error ? e.message : String(e);
  } finally {
    if (turno === turnoCarga) cargandoPista.value = false;
  }
}

export async function seleccionarSecundaria(id: string | null) {
  idSecundaria.value = id;
  if (!id) {
    baseSecundaria = [];
    lineasSecundarias.value = [];
    return;
  }
  const p = pistas.value.find((x) => x.id === id);
  if (!p) return;
  try {
    const lineas = await textoAPista(p);
    sincronias.value = { ...sincronias.value, secundaria: await leerSincronia(id) };
    publicarSecundaria(lineas);
  } catch (e) {
    avisar(tr('No se pudo cargar la pista secundaria: {0}', e instanceof Error ? e.message : e), 'error');
  }
}

const reanalizar = () => refrescarAnalisis();

export async function cargarVideoActual() {
  const info = await control.info();
  infoVideo.value = { sitio: info.sitio, idVideo: info.idVideo, titulo: info.titulo };
  pistas.value = [];
  baseObjetivo = [];
  baseSecundaria = [];
  lineasObjetivo.value = [];
  lineasSecundarias.value = [];
  errorPista.value = null;
  idObjetivo.value = null;
  idSecundaria.value = null;
  importadas.clear();
  letraPegada.value = '';
  if (!info.activo) return;

  cargandoPista.value = true;
  await control.ocultarNativos(ajustes.value.activo).catch(() => {});
  const lista = await control.listarPistas().catch((e) => {
    errorPista.value = e instanceof Error ? e.message : String(e);
    return [] as PistaInfo[];
  });
  const propias = [...lista];

  // Pistas que ya generaste para este video con Claude o Whisper.
  if (info.idVideo) {
    const generadas = await motor.subtitulosGenerados(info.idVideo).catch(() => []);
    for (const g of generadas) {
      // Si esta región ya trae esa pista, lo recordado de otra no aporta nada.
      if (g.origen === 'recordada' && lista.some((p) => p.idioma.split('-')[0] === g.idioma.split('-')[0] && !p.automatica)) continue;
      const id = g.origen === 'letra' ? `letra:${g.idioma}` : `generada:${g.idioma}`;
      importadas.set(id, g.lineas);
      const origen = (g.origen ?? (g.idioma === ajustes.value.idiomaObjetivo ? 'whisper' : 'claude')) as PistaInfo['origen'];
      propias.push({ id, idioma: g.idioma, nombre: `${nombreIdioma(g.idioma)} (${tr(NOMBRE_ORIGEN[origen] ?? 'Claude')})`, origen });
    }
  }
  pistas.value = propias;
  cargandoPista.value = false;

  const a = ajustes.value;
  const objetivo = elegirPista(propias, a.idiomaObjetivo);
  const secundaria = elegirPista(propias, a.idiomaSecundario) ?? elegirPista(propias, 'en');
  await seleccionarObjetivo(objetivo?.id ?? null);
  if (secundaria) await seleccionarSecundaria(secundaria.id);
  else if (objetivo && a.generarSecundariosAuto) generarSecundarios().catch(() => {});

  // YouTube puede tardar en firmar sus peticiones: si falló, se reintenta cuando el video ya corre.
  if (objetivo && errorPista.value) {
    const id = objetivo.id;
    for (let i = 0; i < 3 && errorPista.value && idObjetivo.value === id; i++) {
      await new Promise((r) => setTimeout(r, 8000));
      if (idObjetivo.value === id) await seleccionarObjetivo(id);
    }
  }

  // El título puede tardar más que la página en estar disponible.
  control.info().then((i) => (infoVideo.value = { sitio: i.sitio, idVideo: i.idVideo, titulo: i.titulo })).catch(() => {});
}

const NOMBRE_ORIGEN: Partial<Record<PistaInfo['origen'], string>> = { whisper: tm('Whisper'), claude: tm('Claude'), importada: tm('importados'), recordada: tm('guardados'), letra: tm('letra') };

export const nombreIdioma = (c: string) =>
  ({ ja: tr('Japonés'), es: tr('Español'), en: tr('Inglés'), ko: tr('Coreano'), zh: tr('Chino'), pt: tr('Portugués'), fr: tr('Francés'), de: tr('Alemán') } as Record<string, string>)[c.split('-')[0]] ?? c;

export function vigilarAnuncios() {
  setInterval(async () => {
    try {
      const i = await control.info();
      anuncio.value = i.anuncio;
    } catch {
      // El adaptador aún no está listo.
    }
  }, 1000);
}

/** Pista importada por el usuario: queda guardada para este título, y deja de perderse al recargar. */
export async function importarArchivo(archivo: File, destino: 'objetivo' | 'secundaria') {
  try {
    const lineas = analizarSubtitulos(await archivo.text());
    const idioma = destino === 'objetivo' ? ajustes.value.idiomaObjetivo : ajustes.value.idiomaSecundario;
    const id = `generada:${idioma}`;
    importadas.set(id, lineas);
    pistas.value = [...pistas.value.filter((p) => p.id !== id), { id, idioma, nombre: tr('{0} (importados)', nombreIdioma(idioma)), origen: 'importada' }];
    const video = infoVideo.value?.idVideo;
    if (video) await motor.guardarSubtitulosGenerados(video, idioma, lineas, 'importada').catch(() => {});
    // Un archivo nuevo empieza sin el ajuste de sincronía del anterior, y sin sus correcciones.
    await chrome.storage.local.remove(claveSincronia(id)).catch(() => {});
    await motor.guardarCorreccionesPista(clavePista(id), {}, false).catch(() => {});
    if (destino === 'objetivo') await seleccionarObjetivo(id);
    else await seleccionarSecundaria(id);
    avisar(tr('Importado: {0} ({1} líneas)', archivo.name, lineas.length), 'exito');
  } catch (e) {
    avisar(tr('No se pudo importar: {0}', e instanceof Error ? e.message : e), 'error');
  }
}

// ---------- Generación con Claude ----------

let flujoGeneracion: { cancelar(): void } | null = null;

export function cancelarGeneracion() {
  flujoGeneracion?.cancelar();
  flujoGeneracion = null;
  generacion.value = null;
}

/** Lee por partes un flujo cuyo avance llega como líneas de JSON. */
function lectorJson<T>(alEvento: (e: T) => void) {
  let vistos = 0;
  return (acumulado: string) => {
    const texto = acumulado.slice(vistos);
    const fin = texto.lastIndexOf('\n');
    if (fin < 0) return;
    vistos += fin + 1;
    for (const fila of texto.slice(0, fin).split('\n')) if (fila) alEvento(JSON.parse(fila) as T);
  };
}

/** Por dónde va el video dentro de una lista de líneas: Claude empieza por ahí. */
function indiceActualEn(lineas: Linea[]): number {
  const ms = tiempoMs.value;
  const i = lineas.findIndex((l) => l.fin >= ms);
  return i < 0 ? 0 : i;
}

interface EventoTraduccion {
  hechas: number;
  total: number;
  parte: { i: number; t: string }[];
}

/** Traduce las líneas japonesas al idioma de apoyo. Empiezan a aparecer enseguida, por donde vas. */
export async function generarSecundarios() {
  const fuente = crudas(baseObjetivo);
  if (!fuente.length) {
    avisar(tr(lengua.value.textos.primeroElige), 'error');
    return;
  }
  const idioma = ajustes.value.idiomaSecundario;
  const id = `generada:${idioma}`;
  const video = infoVideo.value?.idVideo;
  // Si una traducción anterior quedó a medias se sigue por lo que falta, sin pagarlo dos veces.
  const delaFuente = new Set(fuente.map((l) => l.id));
  const hechas = new Map((importadas.get(id) ?? []).filter((l) => delaFuente.has(l.id)).map((l) => [l.id, l]));
  const faltan = fuente.filter((l) => !hechas.has(l.id));
  if (!faltan.length) hechas.clear();
  const porTraducir = faltan.length ? faltan : fuente;
  pistas.value = [...pistas.value.filter((p) => p.id !== id), { id, idioma, nombre: tr('{0} (Claude)', nombreIdioma(idioma)), origen: 'claude' }];
  idSecundaria.value = id;
  const yaHechas = fuente.length - porTraducir.length;
  generacion.value = { tipo: 'secundarios', hechas: yaHechas, total: fuente.length };
  const publicar = () => {
    const lista = [...hechas.values()].sort((a, b) => a.inicio - b.inicio);
    importadas.set(id, lista);
    publicarSecundaria(lista);
    return lista;
  };
  if (hechas.size) publicar();
  const f = flujoMotor(
    'traducirSubtitulos',
    [porTraducir, infoVideo.value?.titulo, indiceActualEn(porTraducir)],
    lectorJson<EventoTraduccion>((e) => {
      for (const { i, t } of e.parte) if (porTraducir[i]) hechas.set(porTraducir[i].id, { ...porTraducir[i], texto: t });
      generacion.value = { tipo: 'secundarios', hechas: yaHechas + e.hechas, total: fuente.length };
      const lista = publicar();
      if (video) motor.guardarSubtitulosGenerados(video, idioma, lista, 'claude').catch(() => {});
    })
  );
  flujoGeneracion = f;
  try {
    await f;
    if (generacion.value) avisar(tr('Traducción lista.'), 'exito');
  } catch (e) {
    avisar(tr('No se pudo traducir: {0}', e instanceof Error ? e.message : e), 'error', undefined, 8000);
  } finally {
    generacion.value = null;
    flujoGeneracion = null;
  }
}

/**
 * Crea los subtítulos en japonés a partir de los del otro idioma, para cuando no hay otra opción.
 * Es la traducción de una traducción: un SRT japonés de verdad siempre será mejor.
 */
export async function traducirALengua() {
  const fuente = baseSecundaria;
  if (!fuente.length) {
    avisar(tr('Elige primero unos subtítulos secundarios: de ellos sale la traducción.'), 'error');
    return;
  }
  const idioma = ajustes.value.idiomaObjetivo;
  const id = `generada:${idioma}`;
  const video = infoVideo.value?.idVideo;
  const turno = ++turnoCarga;
  flujoAnalisis?.cancelar();
  ventanaRevision = null;
  flujoCorreccion?.cancelar();
  pistas.value = [...pistas.value.filter((p) => p.id !== id), { id, idioma, nombre: tr('{0} (traducidos por Claude)', nombreIdioma(idioma)), origen: 'claude' }];
  idObjetivo.value = id;
  errorPista.value = null;
  baseObjetivo = [];
  lineasObjetivo.value = [];
  originales.value = new Map();
  const info = infoVideo.value;
  const fuenteInfo = { titulo: info?.titulo, url: location.href, idVideo: info?.idVideo ?? undefined };
  generacion.value = { tipo: 'objetivo', hechas: 0, total: fuente.length };
  let cola: Promise<void> = Promise.resolve();
  const f = flujoMotor(
    'traducirSubtitulos',
    [fuente, info?.titulo, indiceActualEn(fuente), 'lengua'],
    lectorJson<EventoTraduccion>((e) => {
      generacion.value = { tipo: 'objetivo', hechas: e.hechas, total: fuente.length };
      const nuevas = e.parte.filter(({ i, t }) => fuente[i] && t.trim()).map(({ i, t }) => ({ ...fuente[i], texto: t }));
      cola = cola
        .then(async () => {
          const analizadas = await motor.analizarLineas(nuevas, fuenteInfo);
          if (turno !== turnoCarga) return;
          publicarObjetivo([...baseObjetivo, ...analizadas].sort((a, b) => a.inicio - b.inicio));
          const crudasActuales = crudas(baseObjetivo);
          importadas.set(id, crudasActuales);
          if (video) await motor.guardarSubtitulosGenerados(video, idioma, crudasActuales, 'claude');
        })
        .catch(console.error);
    })
  );
  flujoGeneracion = f;
  try {
    await f;
    await cola;
    if (turno === turnoCarga && generacion.value) {
      avisar(tr(lengua.value.textos.traduccionLista), 'exito', undefined, 7000);
      iniciarAnalisisProfundo().catch(() => {});
    }
  } catch (e) {
    avisar(tr('No se pudo traducir: {0}', e instanceof Error ? e.message : e), 'error', undefined, 8000);
  } finally {
    generacion.value = null;
    flujoGeneracion = null;
  }
}

// ---------- Corrección con Claude ----------

let flujoCorreccion: { cancelar(): void } | null = null;

interface EventoCorreccion {
  hechas: number;
  total: number;
  cambios: { i: number; t: string }[];
}

/** Aplica un lote de correcciones a lo que se ve: vuelve a analizar solo las líneas que cambian. */
async function aplicarCorrecciones(parte: { i: number; t: string }[], lineas: Linea[], turno: number, acumulado: Record<number, string>) {
  const validas = parte.filter((c) => lineas[c.i] && c.t.trim() !== lineas[c.i].texto.trim());
  if (!validas.length) return 0;
  const antes = new Map(originales.value);
  for (const c of validas) {
    const l = lineas[c.i];
    acumulado[l.id] = c.t;
    if (!antes.has(l.id)) antes.set(l.id, l.texto);
  }
  const vacias = new Set(validas.filter((c) => !c.t.trim()).map((c) => lineas[c.i].id));
  const nuevas = validas.filter((c) => c.t.trim()).map((c) => ({ ...lineas[c.i], texto: c.t }));
  const info = infoVideo.value;
  const analizadas = nuevas.length ? await motor.analizarLineas(nuevas, { titulo: info?.titulo, url: location.href, idVideo: info?.idVideo ?? undefined }) : [];
  if (turno !== turnoCarga) return 0;
  const porId = new Map(analizadas.map((l) => [l.id, l]));
  publicarObjetivo(baseObjetivo.filter((l) => !vacias.has(l.id)).map((l) => porId.get(l.id) ?? l));
  originales.value = antes;
  return validas.length;
}

/**
 * Corrige homófonos y palabras mal oídas usando el título y todo el texto como contexto. No genera
 * subtítulos nuevos ni pregunta nada: Claude decide y solo devuelve lo que cambia, empezando por
 * donde vas, así que lo que estás viendo queda corregido en segundos.
 */
export async function corregirSubtitulos(manual = false) {
  flujoCorreccion?.cancelar();
  const lineas = crudas(baseObjetivo);
  if (!lineas.length) return;
  const turno = turnoCarga;
  const estado = await motor.estado().catch(() => null);
  if (!estado?.claveIA) {
    if (manual) avisar(tr('Añade tu clave de la API de Claude en Ajustes para corregir los subtítulos.'), 'error', { texto: tr('Ajustes'), fn: () => fondo.abrirApp('ajustes') }, 8000);
    return;
  }
  if (turno !== turnoCarga) return;
  const id = idObjetivo.value;
  const clave = clavePista(id);
  const acumulado: Record<number, string> = { ...((await motor.correccionesPista(clave).catch(() => undefined))?.cambios ?? {}) };
  let cambiadas = 0;
  let cola: Promise<void> = Promise.resolve();
  correccion.value = { hechas: 0, total: lineas.length, cambiadas: 0 };
  const f = flujoMotor(
    'corregirSubtitulos',
    [lineas, infoVideo.value?.titulo, indiceActualEn(lineas)],
    lectorJson<EventoCorreccion>((e) => {
      cola = cola
        .then(async () => {
          cambiadas += await aplicarCorrecciones(e.cambios, lineas, turno, acumulado);
          if (turno !== turnoCarga) return;
          correccion.value = { hechas: e.hechas, total: e.total, cambiadas };
          await motor.guardarCorreccionesPista(clave, acumulado, false);
        })
        .catch(console.error);
    })
  );
  flujoCorreccion = f;
  try {
    await f;
    await cola;
    if (turno !== turnoCarga || !correccion.value) return;
    await motor.guardarCorreccionesPista(clave, acumulado, true);
    if (id?.startsWith('generada:') || id?.startsWith('letra:')) {
      importadas.set(id, crudas(baseObjetivo));
      await guardarGenerada();
    }
    if (manual || cambiadas) avisar(cambiadas ? (cambiadas === 1 ? tr('Claude corrigió 1 línea.') : tr('Claude corrigió {0} líneas.', cambiadas)) : tr('Claude no encontró nada que corregir.'), cambiadas ? 'exito' : undefined);
  } catch (e) {
    if (manual) avisar(tr('No se pudo corregir: {0}', e instanceof Error ? e.message : e), 'error', undefined, 8000);
    else console.warn('Kotonoha: no se pudieron corregir los subtítulos', e);
  } finally {
    if (turno === turnoCarga) correccion.value = null;
    flujoCorreccion = null;
  }
}

export function cancelarCorreccion() {
  flujoCorreccion?.cancelar();
  correccion.value = null;
}

// ---------- Transcripción con Whisper ----------

let flujoWhisper: { cancelar(): void } | null = null;
let intervaloMarcas: ReturnType<typeof setInterval> | null = null;
let colaWhisper: Promise<void> = Promise.resolve();
let sinCorregir: Linea[] = [];
let colaCorreccion: Promise<void> = Promise.resolve();
const LOTE_CORRECCION = 10;

/** El motor oye el audio pero no sabe en qué punto va el video: se le informa continuamente. */
function enviarMarcaVideo() {
  let previo = -1;
  let instante = 0;
  return () => {
    const v = control.video();
    if (!v) return;
    const ms = v.currentTime * 1000;
    const ahora = performance.now();
    const esperado = previo + (ahora - instante) * v.playbackRate;
    const salto = previo >= 0 && !v.paused && Math.abs(ms - esperado) > 1500;
    previo = ms;
    instante = ahora;
    motor.whisperMarca(ms, !v.paused && !anuncio.value, v.playbackRate, salto).catch(() => {});
    // Con una letra esperando, al acabar la canción no hay nada más que oír.
    if (v.ended && hayLetraPendiente() && whisper.value?.fase !== 'terminando') detenerWhisper();
  };
}

async function guardarGenerada() {
  const video = infoVideo.value?.idVideo;
  const origen = pistas.value.find((p) => p.id === idObjetivo.value)?.origen;
  if (video) await motor.guardarSubtitulosGenerados(video, ajustes.value.idiomaObjetivo, crudas(baseObjetivo), origen).catch(() => {});
}

/** Corrección en tiempo real: un lote pequeño con todo lo transcrito hasta ahora como contexto. */
async function corregirLote(lote: Linea[]) {
  if (!lote.length || !ajustes.value.whisperCorregir || hayLetraPendiente()) return;
  const estado = await motor.estado().catch(() => null);
  if (!estado?.claveIA) return;
  const turno = turnoCarga;
  const guion = baseObjetivo.map((l) => l.texto).join('\n');
  const parciales: { i: number; t: string }[] = [];
  try {
    await flujoMotor('corregirSubtitulos', [lote, infoVideo.value?.titulo, -1, guion], lectorJson<EventoCorreccion>((e) => parciales.push(...e.cambios)));
    if (await aplicarCorrecciones(parciales, lote, turno, {})) await guardarGenerada();
  } catch (e) {
    console.warn('Kotonoha: no se pudo corregir la transcripción', e);
  }
}

async function recibirLineasWhisper(nuevas: Linea[], fuente: { titulo?: string; url?: string; idVideo?: string }) {
  const analizadas = await motor.analizarLineas(nuevas, fuente);
  publicarObjetivo(fusionarLineas(baseObjetivo, analizadas));
  await guardarGenerada();
  // Un archivo se corrige entero al final; en tiempo real se va corrigiendo sin frenar las líneas nuevas.
  if (whisper.value?.desdeArchivo) return;
  sinCorregir.push(...nuevas);
  if (sinCorregir.length >= LOTE_CORRECCION) {
    const lote = sinCorregir;
    sinCorregir = [];
    colaCorreccion = colaCorreccion.then(() => corregirLote(lote));
  }
}

/** Convierte la pista actual en la pista generada, conservando lo ya transcrito de este video. */
async function activarPistaWhisper() {
  const idioma = ajustes.value.idiomaObjetivo;
  const id = `generada:${idioma}`;
  if (idObjetivo.value === id) return;
  const previa = importadas.get(id) ?? [];
  importadas.set(id, previa);
  pistas.value = [...pistas.value.filter((p) => p.id !== id), { id, idioma, nombre: tr('{0} (Whisper)', nombreIdioma(idioma)), origen: 'whisper' }];
  await seleccionarObjetivo(id);
}

/** El nombre que da el trabajador de Whisper cuando no hay GPU. Viene en español: se traduce al mostrarlo. */
const DISPOSITIVO_SIN_GPU = tm('procesador (sin GPU)');

/** Sin WebGPU Whisper corre en el procesador, muy por debajo del tiempo real: mejor saberlo. */
function avisarSiNoHayGpu(anterior: string | undefined, actual: string | undefined) {
  if (actual && actual !== anterior && actual === DISPOSITIVO_SIN_GPU) {
    avisar(tr('El navegador no ofrece acceso a la GPU: la transcripción irá muy lenta. Revisa la aceleración por hardware en los ajustes del navegador.'), 'error', undefined, 10000);
  }
}

export type FuenteArchivo = (alProgreso: (porcentaje: number) => void) => Promise<{ url: string; pcmCrudo: boolean }>;
let fuenteArchivo: FuenteArchivo | null = null;

/** En el reproductor local el audio se saca del archivo, sin esperar a que se reproduzca entero. */
export const fijarFuenteArchivo = (f: FuenteArchivo | null) => {
  fuenteArchivo = f;
  transcribeArchivo.value = !!f;
};

/** Comprueba si el ayudante local está instalado. Es rápido, pero no gratis: arranca Python. */
export async function actualizarAyudante() {
  const info = await motor.ayudante().catch(() => null);
  ayudante.value = info;
  return info;
}

/** La dirección limpia del video: sin la lista de reproducción ni la marca de tiempo. */
function urlDelVideo(): string {
  const info = infoVideo.value;
  return info?.sitio === 'youtube' && info.idVideo ? `https://www.youtube.com/watch?v=${info.idVideo}` : location.href;
}

/**
 * Genera los subtítulos en japonés. Con un archivo propio, o con el ayudante local en un video de
 * internet, lo procesa entero a toda velocidad. Si no, transcribe mientras se reproduce, con la
 * captura de audio activa.
 */
export async function iniciarWhisper(enVivo = false) {
  if (whisper.value) return;
  const desdeArchivo = fuenteArchivo;
  // Netflix siempre tiene subtítulos y su audio no se puede bajar: ahí nunca se usa el ayudante.
  const conAyudante = !enVivo && !desdeArchivo && infoVideo.value?.sitio !== 'netflix' && !!(await actualizarAyudante());
  if (!desdeArchivo && !conAyudante && !capturaActiva.value) {
    avisar(tr('Para oír el video hay que activar la captura de audio: {0} y vuelve a intentarlo.', comoActivarCaptura()), 'error', undefined, 8000);
    return;
  }
  whisper.value = { fase: conAyudante ? 'bajando' : desdeArchivo ? 'extrayendo' : 'preparando', lineas: 0, desdeArchivo: !!desdeArchivo || conAyudante };
  let audio: { url: string; pcmCrudo: boolean } | null = null;
  try {
    audio = desdeArchivo ? await desdeArchivo((porcentaje) => (whisper.value = whisper.value && { ...whisper.value, fase: 'extrayendo', porcentaje })) : null;
  } catch (e) {
    avisar(tr('No se pudo leer el audio: {0}', e instanceof Error ? e.message : e), 'error', undefined, 8000);
    whisper.value = null;
    return;
  }
  await activarPistaWhisper();
  // Si una transcripción anterior de este archivo quedó a medias, se sigue desde ahí.
  let desdeMs = 0;
  if (audio || conAyudante) {
    const ultimo = baseObjetivo[baseObjetivo.length - 1]?.fin ?? 0;
    const duracionMs = (control.video()?.duration ?? 0) * 1000;
    if (ultimo > 0 && duracionMs && ultimo < duracionMs - 20000) {
      desdeMs = Math.max(0, ultimo - 1000);
      const s = Math.floor(desdeMs / 1000);
      avisar(tr('Sigo desde donde iba: {0}:{1}.', Math.floor(s / 60), String(s % 60).padStart(2, '0')));
    }
  }
  sinCorregir = [];
  colaWhisper = Promise.resolve();
  colaCorreccion = Promise.resolve();
  let avisoRetraso = false;
  const info = infoVideo.value;
  const fuente = { titulo: info?.titulo, url: location.href, idVideo: info?.idVideo ?? undefined };
  if (!audio && !conAyudante) {
    const marcar = enviarMarcaVideo();
    marcar();
    intervaloMarcas = setInterval(marcar, 250);
  }
  let vistos = 0;
  const metodo = conAyudante ? 'transcribirDescarga' : audio ? 'transcribirArchivo' : 'transcribirEnVivo';
  const f = flujoMotor(metodo, conAyudante ? [urlDelVideo(), desdeMs] : audio ? [audio.url, audio.pcmCrudo, desdeMs] : [], (acumulado) => {
    const texto = acumulado.slice(vistos);
    const fin = texto.lastIndexOf('\n');
    if (fin < 0) return;
    vistos += fin + 1;
    for (const fila of texto.slice(0, fin).split('\n')) {
      const e = JSON.parse(fila);
      const actual = whisper.value ?? { fase: 'preparando' as const, lineas: 0 };
      if (e.tipo === 'lineas') {
        whisper.value = { ...actual, lineas: actual.lineas + e.lineas.length };
        colaWhisper = colaWhisper.then(() => recibirLineasWhisper(e.lineas, fuente)).catch(console.error);
      } else if (e.tipo === 'bajandoAudio') {
        whisper.value = { ...actual, fase: 'bajando', porcentaje: e.porcentaje };
      } else if (e.tipo === 'descarga') {
        whisper.value = { ...actual, fase: 'descargando', porcentaje: e.porcentaje, cargadoMb: e.cargadoMb, totalMb: e.totalMb };
      } else if (e.tipo === 'escuchando') {
        avisarSiNoHayGpu(actual.dispositivo, e.dispositivo);
        whisper.value = { ...actual, fase: actual.fase === 'terminando' ? 'terminando' : 'escuchando', dispositivo: e.dispositivo };
      } else if (e.tipo === 'procesando') {
        avisarSiNoHayGpu(actual.dispositivo, e.dispositivo);
        whisper.value = {
          ...actual,
          fase: actual.fase === 'terminando' ? 'terminando' : 'procesando',
          porcentaje: e.porcentaje ?? actual.porcentaje,
          dispositivo: e.dispositivo ?? actual.dispositivo,
          restanteS: e.restanteS ?? actual.restanteS,
        };
      } else if (e.tipo === 'pausado') {
        whisper.value = { ...actual, pausado: e.pausado };
      } else if (e.tipo === 'recuperando') {
        whisper.value = { ...actual, fase: 'recuperando' };
        avisar(tr('La tarjeta gráfica se reinició. Espero {0} s y sigo a la mínima intensidad. Lo transcrito está guardado.', e.segundos), 'error', undefined, 10000);
      } else if (e.tipo === 'retraso') {
        if (!avisoRetraso) avisar(tr('La tarjeta gráfica va justa y la transcripción lleva retraso. Cierra otras aplicaciones exigentes si quieres que se ponga al día.'), undefined, undefined, 8000);
        avisoRetraso = true;
      } else if (e.tipo === 'preparando') {
        whisper.value = { ...actual, fase: 'preparando' };
      }
    }
  });
  flujoWhisper = f;
  try {
    await f;
    await colaWhisper;
    const lote = sinCorregir;
    sinCorregir = [];
    await colaCorreccion;
    await corregirLote(lote);
    const n = whisper.value?.lineas ?? 0;
    avisar(n ? tr('Transcripción lista: {0} líneas.', n) : tr('No se oyó voz que transcribir.'), n ? 'exito' : undefined);
    importadas.set(`generada:${ajustes.value.idiomaObjetivo}`, crudas(baseObjetivo));
    if (n && hayLetraPendiente()) {
      await ajustarLetra();
    } else {
      if (n && (audio || conAyudante) && ajustes.value.whisperCorregir) await corregirSubtitulos();
      if (n) iniciarAnalisisProfundo().catch(() => {});
    }
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    // Si el video no se puede bajar, aún queda oírlo mientras se reproduce.
    if (conAyudante) avisar(tr('No se pudo bajar el audio: {0}', mensaje), 'error', { texto: tr('Transcribir al reproducir'), fn: () => iniciarWhisper(true) }, 12000);
    else avisar(tr('No se pudo transcribir: {0}', mensaje), 'error', undefined, 8000);
  } finally {
    if (intervaloMarcas) clearInterval(intervaloMarcas);
    intervaloMarcas = null;
    flujoWhisper = null;
    whisper.value = null;
    if (audio) URL.revokeObjectURL(audio.url);
  }
}

// ---------- La letra de una canción ----------

const hayLetraPendiente = () => versosDeLetra(letraPegada.value).length > 0;

/** Los tiempos sobre los que se coloca la letra: los de la pista elegida, salvo que sea una letra ya colocada. */
function lineasConTiempos(): Linea[] {
  const idioma = ajustes.value.idiomaObjetivo;
  const transcripcion = idObjetivo.value === `letra:${idioma}` ? importadas.get(`generada:${idioma}`) : undefined;
  return transcripcion ?? crudas(baseObjetivo);
}

/**
 * Coloca la letra pegada sobre los tiempos de la pista actual y deja el resultado como una pista más. Claude solo dice
 * qué verso suena dónde: las palabras salen tal cual de la letra, y los tiempos, de la pista.
 */
export async function ajustarLetra() {
  const versos = versosDeLetra(letraPegada.value);
  const lineas = lineasConTiempos();
  if (!versos.length || !lineas.length || ajustandoLetra.value) return;
  const estado = await motor.estado().catch(() => null);
  if (!estado?.claveIA) {
    avisar(tr('Añade tu clave de la API de Claude en Ajustes para ajustar la letra.'), 'error', { texto: tr('Ajustes'), fn: () => fondo.abrirApp('ajustes') }, 8000);
    return;
  }
  ajustandoLetra.value = true;
  try {
    const respuesta = await flujoMotor('ajustarLetra', [lineas, versos, infoVideo.value?.titulo], () => {});
    const ajuste = JSON.parse(respuesta) as EntradaAjuste[];
    const { lineas: finales, conTiempo, estimadas } = aplicarAjuste(versos, lineas, ajuste);
    if (!conTiempo) {
      avisar(tr('Claude no encontró esta letra en lo que se oye. ¿Es la de esta canción?'), 'error', undefined, 8000);
      return;
    }
    const idioma = ajustes.value.idiomaObjetivo;
    const id = `letra:${idioma}`;
    importadas.set(id, finales);
    pistas.value = [...pistas.value.filter((p) => p.id !== id), { id, idioma, nombre: `${nombreIdioma(idioma)} (${tr('letra')})`, origen: 'letra' }];
    const video = infoVideo.value?.idVideo;
    if (video) await motor.guardarSubtitulosGenerados(video, idioma, finales, 'letra').catch(() => {});
    // Una letra nueva empieza sin la sincronía ni las correcciones de la anterior.
    await chrome.storage.local.remove(claveSincronia(id)).catch(() => {});
    await motor.guardarCorreccionesPista(clavePista(id), {}, false).catch(() => {});
    letraPegada.value = '';
    await seleccionarObjetivo(id);
    avisar(estimadas ? tr('Letra ajustada: {0} versos con sus tiempos y {1} estimados.', conTiempo, estimadas) : tr('Letra ajustada: {0} versos con sus tiempos.', conTiempo), 'exito');
  } catch (e) {
    avisar(tr('No se pudo ajustar la letra: {0}', e instanceof Error ? e.message : e), 'error', undefined, 8000);
  } finally {
    ajustandoLetra.value = false;
  }
}

/** Deja libre la tarjeta gráfica cuando la necesites, sin perder el punto en el que iba. */
export function pausarWhisper(pausado: boolean) {
  if (!whisper.value) return;
  whisper.value = { ...whisper.value, pausado };
  motor.whisperPausar(pausado).catch(() => {});
}

/** Para de escuchar, pero termina de transcribir lo que ya se oyó. */
export function detenerWhisper() {
  if (!whisper.value) return;
  whisper.value = { ...whisper.value, fase: 'terminando' };
  // Un archivo se puede cortar sin más; en tiempo real se termina de transcribir lo ya oído.
  if (whisper.value.desdeArchivo) flujoWhisper?.cancelar();
  else motor.whisperDetener().catch(() => flujoWhisper?.cancelar());
}

// ---------- Navegación entre líneas ----------

export function lineaAnteriorOSiguiente(direccion: -1 | 1): LineaAnalizada | null {
  const lineas = lineasObjetivo.value;
  if (!lineas.length) return null;
  const ms = tiempoMs.value;
  const activa = indiceActivo.value;
  if (direccion === 1) {
    const i = activa >= 0 ? activa + 1 : siguienteLinea(lineas, ms);
    return lineas[i] ?? null;
  }
  if (activa >= 0) return lineas[activa - 1] ?? lineas[0];
  const sig = siguienteLinea(lineas, ms);
  return sig < 0 ? lineas[lineas.length - 1] : (lineas[sig - 1] ?? null);
}

export function irALinea(l: LineaAnalizada) {
  return saltar(l.inicio);
}

function claveMarcadores() {
  return `${MARCADORES}:${infoVideo.value?.idVideo ?? ''}`;
}

function cargarMarcadores() {
  chrome.storage.local.get(claveMarcadores()).then((d) => {
    const v = d[claveMarcadores()] as number[] | undefined;
    marcadas.value = new Set(v ?? []);
  }).catch(() => {});
}

export function alternarMarcador(id: number) {
  const s = new Set(marcadas.value);
  if (s.has(id)) s.delete(id);
  else s.add(id);
  marcadas.value = s;
  chrome.storage.local.set({ [claveMarcadores()]: [...s] }).catch(() => {});
}

export function alternarSeleccion(id: number) {
  const s = new Set(seleccionadas.value);
  if (s.has(id)) s.delete(id);
  else s.add(id);
  seleccionadas.value = s;
}

/** Une las líneas seleccionadas en una sola, útil cuando una frase ocupa varios subtítulos. */
export async function combinarSeleccionadas() {
  const ids = [...seleccionadas.value].sort((a, b) => a - b);
  if (ids.length < 2) return;
  const grupo = baseObjetivo.filter((l) => ids.includes(l.id));
  const unida: Linea = { id: grupo[0].id, inicio: grupo[0].inicio, fin: grupo[grupo.length - 1].fin, texto: grupo.map((l) => l.texto).join('') };
  const [analizada] = await motor.analizarLineas([unida]);
  publicarObjetivo(baseObjetivo.filter((l) => !ids.slice(1).includes(l.id)).map((l) => (l.id === unida.id ? analizada : l)));
  seleccionadas.value = new Set([unida.id]);
}

export const guardarA = guardarAjustes;
