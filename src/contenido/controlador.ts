// Coordina el video con los subtítulos: elige pistas, aplica modos, salto y pausas de interacción.

import { effect } from '@preact/signals';
import { alRecibirEvento, flujoMotor, fondo, motor } from '../compartido/rpc';
import type { LineaAnalizada, PalabraToken, PistaInfo } from '../compartido/tipos';
import { urlDeVideo as urlDeVideoBilibili } from '../nucleo/bilibili';
import { desconocidas } from '../nucleo/frases';
import { decidirSalto, duracionPausaDinamica, type LineaModo, MotorModos } from '../nucleo/modos';
import { aplicarSincronia, type PuntoAncla, type Sincronia, SINCRONIA_NEUTRA, sincroniaDesdePuntos } from '../nucleo/sincronia';
import { alinearPorLetras, aplicarAjuste, type CantoPorTramos, type EntradaAjuste, ID_LETRA, type ResultadoAjuste, versosDeLetra, vozDeCanto } from '../nucleo/letra';
import { versosCantados } from '../nucleo/estructuraLetra';
import { analizarSubtitulos, aSrt, esSoloAcotacion, type Linea, siguienteLinea } from '../nucleo/subtitulos';
import { desdeDondeSeguir, fusionarLineas, MedidorTirones, noLlega, type ProgresoTranscripcion, VENTAJA_PARA_SEGUIR_S } from '../nucleo/transcripcion';
import { anotarUso, guardarAjustes, modeloParaTranscribir, MODELOS_WHISPER } from '../compartido/ajustes';
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
  encimaSubtitulo,
  correccion,
  errorPista,
  generacion,
  idObjetivo,
  marcado,
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
  quitarAviso,
  cambiarAviso,
  type EstadoWhisper,
} from './estado';
import type { Control } from './puente';
import { acaboAnuncio, anotarSinAnuncio, desfaseDeSaltos, empezoAnuncio, iniciarRelojSitio, medirDeNuevo, momentoDelVideo, quitarDescuento, reiniciarReloj, sincronizarAhora, usarVideo } from './relojSitio';
import { numero, tm, tr } from '../compartido/i18n';
import { relojInmersion } from '../compartido/relojInmersion';
import { lengua } from '../ui/lengua';
import { paqueteDe } from '../lenguas';

let control: Control;

const motorModos = new MotorModos({ objetivosPausa: [], disparador: 'ninguno', velarObjetivo: { modo: 'no', revelarEnPausa: [], revelarPorEstado: [], revelarAlPasar: true }, velarSecundario: { modo: 'no', revelarEnPausa: [], revelarPorEstado: [], revelarAlPasar: true } }, []);

export const pausasEnLinea = (i: number) => motorModos.pausasAutomaticas(i);

let pausaPropia = false;
let reproduccionPropia = false;
let acelerando = false;
let velocidadPrevia = 1;
let temporizadorReanudar: ReturnType<typeof setTimeout> | null = null;
/** La línea de la pausa automática que está contando para reanudar, y la de la cuenta detenida al consultar. */
let lineaDeLaCuenta = -1;
let cuentaDetenida = -1;
/** La consulta que abre «Consultar al pausar» no es de quien mira: no detiene la cuenta atrás. */
let aperturaAutomatica = false;
let consultaAutomatica = false;
let pausadaPorConsulta = false;
let pausaDiferidaEn = -1;
let videoActual: HTMLVideoElement | null = null;

const MARCADORES = 'kotonohaMarcadores';

/** Mientras se graba una frase para una tarjeta: el video se mueve solo, y nada de eso es cosa de quien mira. */
export const grabandoLinea = () => grabacionEnCurso !== null;

export function iniciarControlador(c: Control) {
  control = c;
  // En Netflix, los subtítulos van por el momento del episodio que da su reproductor (ver relojSitio.ts).
  const tiempos = c.tiempos;
  if (tiempos) {
    iniciarRelojSitio({
      activo: () => infoVideo.value?.sitio === 'netflix',
      tomar: () => tiempos(),
      medible: () => {
        const v = control.video();
        return infoVideo.value?.sitio === 'netflix' && !anuncio.value && !!v && !v.paused && !v.seeking;
      },
      alCambiar: (ms, porAnuncios) => {
        alCambiarReloj();
        if (porAnuncios) avisar(tr('Subtítulos ajustados por los anuncios ({0} s).', segundosReloj(ms)), 'exito', { texto: tr('Quitar el ajuste'), fn: quitarAjusteDeAnuncios }, 7000);
        else if (ms) avisar(tr('Subtítulos sincronizados con Netflix ({0} s).', segundosReloj(ms)), 'exito', undefined, 3500);
      },
    });
    // Durante un anuncio del medio el reloj del video sigue corriendo: al acabar se mide enseguida, y se sabe cuánto corrió.
    let enAnuncio = false;
    effect(() => {
      const a = anuncio.value;
      if (a && !enAnuncio) empezoAnuncio();
      if (enAnuncio && !a) acaboAnuncio(control.video());
      enAnuncio = a;
    });
  }
  effect(() => {
    const lineas = lineasObjetivo.value;
    const clases = clasesLineas.value;
    const a = ajustes.value;
    const datos: LineaModo[] = lineas.map((l, i) => ({ inicio: l.inicio, fin: l.fin, clases: clases[i] }));
    motorModos.actualizar(configModo.value, datos, a.desfasePausaMs);
  });

  setInterval(tick, 50);
  setInterval(actualizarRect, 250);
  // Las horas de inmersión: cuenta el tiempo con el video en marcha y subtítulos en la lengua que se estudia.
  relojInmersion(
    'video',
    () => {
      const info = infoVideo.value;
      if (!info) return null;
      return { id: info.idVideo ?? `${info.sitio}:${location.pathname}`, titulo: info.titulo || document.title, estudio: ajustes.value.idiomaObjetivo };
    },
    () => {
      const v = videoActual;
      return !!v && !v.paused && !v.ended && v.readyState >= 2 && lineasObjetivo.value.length > 0;
    }
  );
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
  const height = Math.max(0, r.height - (control.recorteInferior?.() ?? 0));
  const p = rectVideo.value;
  if (!p || p.left !== left || p.top !== top || p.width !== r.width || p.height !== height) {
    rectVideo.value = { left, top, width: r.width, height };
  }
}

/**
 * Si hay un video abierto. En la app, el reproductor de archivos suelta el suyo al salir de su pantalla, pero sus
 * subtítulos siguen cargados: sin esto, sus atajos (A, D, G, Q…) seguirían vivos en Memoria o en el Cuaderno.
 */
export const hayVideoAbierto = (): boolean => !!control?.video();

/** Si el video se ha ido de la pantalla, por ejemplo al leer los comentarios, la barra no estorba. */
export function videoEnPantalla(): boolean {
  const r = control?.video()?.getBoundingClientRect();
  return !!r && r.bottom > 80 && r.top < innerHeight;
}

/** Los lados y el borde de arriba del video en la ventana, para saber si el ratón se detiene sobre él (presentacion.ts). */
export function bordeVideo(): { izq: number; der: number; arriba: number } | null {
  const r = control?.video()?.getBoundingClientRect();
  return r && r.width > 0 ? { izq: r.left, der: r.right, arriba: r.top } : null;
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
    cuentaDetenida = -1;
    if (!reproduccionPropia) {
      tipoPausa.value = null;
      cancelarReanudar();
    }
    reproduccionPropia = false;
    lineaPreparada.value = -1;
    tipoPausa.value = null;
  });
  // Tras un salto o al volver a reproducir, el reloj de Netflix puede haber cambiado: se mide enseguida.
  v.addEventListener('seeked', () => medirDeNuevo());
  v.addEventListener('playing', () => medirDeNuevo());
}

const segundosReloj = (ms: number) => numero(Math.abs(ms) / 1000, { maximumFractionDigits: 1 });

/**
 * El reloj cambió: la línea en pantalla pasa enseguida a la del momento nuevo, sin esperar al siguiente tick, y lo que
 * el motor de modos llevaba contado iba por el de antes.
 */
function alCambiarReloj() {
  const v = control.video();
  if (v) tiempoMs.value = Math.round(momentoDelVideo(v));
  lineaPreparada.value = -1;
  motorModos.reiniciar();
}

/** «Volver a sincronizar», con el botón del panel o con Alt+Shift+S: se mide de nuevo y se dice cómo quedó. */
export async function sincronizarConSitio() {
  const r = await sincronizarAhora(() => control.video()?.paused ?? true);
  const quitar = { texto: tr('Quitar el ajuste'), fn: quitarAjusteDeAnuncios };
  if (r.tipo === 'en-pausa') avisar(tr('Se medirá en cuanto siga el video.'), undefined, undefined, 3000);
  else if (r.tipo === 'sin-reloj' && r.descuentoMs) avisar(tr('Netflix no dio su posición: siguen ajustados por los anuncios ({0} s).', segundosReloj(r.descuentoMs)), 'error', quitar, 9000);
  else if (r.tipo === 'sin-reloj') avisar(tr('Netflix no dio su posición: los subtítulos siguen el reloj del video. Puedes moverlos a mano en Sincronizar.'), 'error', undefined, 7000);
  else {
    if (r.cambio) alCambiarReloj();
    if (r.descuentoMs) avisar(tr('Subtítulos ajustados por los anuncios ({0} s).', segundosReloj(r.correccionMs)), 'exito', quitar, 7000);
    else avisar(r.correccionMs ? tr('Subtítulos sincronizados con Netflix ({0} s).', segundosReloj(r.correccionMs)) : tr('Ya iban a la par con Netflix.'), 'exito', undefined, 3500);
  }
}

/** «Quitar el ajuste»: el descuento por anuncios no cuadraba. Los subtítulos vuelven a ir por lo que mida Netflix. */
export function quitarAjusteDeAnuncios() {
  if (!quitarDescuento()) return;
  alCambiarReloj();
  avisar(tr('Ajuste por los anuncios quitado.'), undefined, undefined, 3500);
}

function alPausar() {
  const a = ajustes.value;
  if (!a.autoConsultaAlPausar || consulta.value || grabacionEnCurso) return;
  const i = indiceVisual.value;
  if (i < 0) return;
  const primera = desconocidas(lineasObjetivo.value[i].palabras)[0];
  if (!primera) return;
  aperturaAutomatica = true;
  try {
    abrirConsultaDe(primera, lineasObjetivo.value[i]);
  } finally {
    aperturaAutomatica = false;
  }
}

// Se resuelve desde la interfaz: necesita el rectángulo de la palabra en pantalla.
export let abrirConsultaDe: (p: PalabraToken, l: LineaAnalizada) => void = () => {};
export const fijarAbrirConsulta = (f: typeof abrirConsultaDe) => {
  abrirConsultaDe = f;
};

function cancelarReanudar() {
  if (temporizadorReanudar) clearTimeout(temporizadorReanudar);
  temporizadorReanudar = null;
  lineaDeLaCuenta = -1;
}

/**
 * Si se está leyendo: con una ficha abierta a mano, o con el ratón sobre el subtítulo si así se pidió («Pausar al
 * interactuar: al pasar por el subtítulo»). Solo el ratón encima, sin más, no cuenta: suele quedarse ahí al cerrar una
 * ficha, y entonces la pausa no acabaría nunca.
 */
const leyendo = () => (!!consulta.value && !consultaAutomatica) || (encimaSubtitulo.value && ajustes.value.pausaInteraccion === 'alPasarSubtitulo');

/**
 * Mientras se lee, la cuenta atrás de la pausa automática se detiene: antes seguía corriendo y el video arrancaba con
 * la ficha abierta, en medio de la lectura.
 */
function detenerCuentaAtras() {
  if (!temporizadorReanudar || aperturaAutomatica) return;
  const i = lineaDeLaCuenta;
  cancelarReanudar();
  cuentaDetenida = i;
}

/** Al terminar, si el video sigue en esa pausa, la cuenta vuelve a empezar entera. */
function retomarCuentaAtras() {
  const i = cuentaDetenida;
  if (i < 0 || !pausado.value) {
    cuentaDetenida = -1;
    return;
  }
  if (leyendo()) return;
  cuentaDetenida = -1;
  programarReanudar(i);
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
  if (espera > 0) {
    // Si ya se está leyendo cuando llega la pausa, la cuenta empieza al terminar de leer.
    if (leyendo()) {
      cuentaDetenida = indice;
      return;
    }
    lineaDeLaCuenta = indice;
    temporizadorReanudar = setTimeout(() => reproducir(), espera);
  }
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
  return control.saltar(Math.max(0, ms - desfaseDeSaltos()));
}

/**
 * Salta a un momento pedido desde fuera, como «Volver al momento» de un ejemplo del diccionario. Espera a que el video
 * tenga su duración y a que acabe el anuncio: un reproductor que aún carga ignora el salto.
 */
export async function irAlMomento(ms: number) {
  for (let i = 0; i < 160; i++) {
    const v = control.video();
    if (v && v.readyState >= 1 && Number.isFinite(v.duration) && v.duration > 0 && !anuncio.value) {
      await saltar(Math.min(ms, Math.max(0, v.duration * 1000 - 1000)));
      return;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
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
  usarVideo(v);
  const ms = momentoDelVideo(v);
  tiempoMs.value = Math.round(ms);
  pausado.value = v.paused;
  if (!anuncio.value) anotarSinAnuncio(v);
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
  consultaAutomatica = aperturaAutomatica;
  detenerCuentaAtras();
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
  consultaAutomatica = false;
  pausaDiferidaEn = -1;
  if (pausadaPorConsulta && ajustes.value.reanudarAlTerminar) reproducir();
  pausadaPorConsulta = false;
  retomarCuentaAtras();
}

export function alEntrarSubtitulo() {
  if (ajustes.value.pausaInteraccion === 'alPasarSubtitulo') detenerCuentaAtras();
  if (ajustes.value.pausaInteraccion === 'alPasarSubtitulo' && !pausado.value) {
    pausar('manual');
    pausadaPorConsulta = true;
  }
}

export function alSalirSubtitulo() {
  if (ajustes.value.pausaInteraccion === 'alPasarSubtitulo' && pausadaPorConsulta && !consulta.value) {
    alCerrarConsulta();
    return;
  }
  retomarCuentaAtras();
}

// ---------- Pistas ----------

function elegirPista(lista: PistaInfo[], idioma: string): PistaInfo | undefined {
  const base = idioma.split('-')[0];
  const coincide = (p: PistaInfo) => p.idioma === idioma || p.idioma.split('-')[0] === base;
  // Entre las variantes de la lengua, las que prefiere su paquete: en chino, las de caracteres simplificados.
  const preferidas = (paqueteDe(base).id === base ? paqueteDe(base).pistasPreferidas : undefined)?.map((x) => x.toLowerCase()) ?? [];
  const puesto = (p: PistaInfo) => {
    const i = preferidas.indexOf(p.idioma.toLowerCase());
    return i < 0 ? preferidas.length : i;
  };
  const candidatas = lista.filter(coincide).sort((a, b) => puesto(a) - puesto(b));
  // Mejor los subtítulos hechos a mano que los automáticos, y sin CC para no leer acotaciones.
  return candidatas.find((p) => p.origen === 'letra') ?? candidatas.find((p) => p.origen === 'importada') ?? candidatas.find((p) => !p.automatica && !p.cc) ?? candidatas.find((p) => !p.automatica) ?? candidatas[0];
}

const importadas = new Map<string, Linea[]>();
/** Dónde se canta en cada canción transcrita con Whisper, por video: para colocar su letra. */
const cantos = new Map<string, CantoPorTramos>();
/** Hasta dónde llegó la transcripción del audio entero de cada video, y si terminó: solo una cortada sigue desde ahí. */
const transcritos = new Map<string, ProgresoTranscripcion>();

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

/** Una transcripción nueva de la pista que se ve empieza sin la sincronía ni las correcciones de la anterior: eran de otras líneas. */
async function olvidarArreglosDe(id: string | null) {
  if (!id || id !== idObjetivo.value) return;
  originales.value = new Map();
  anclas.value = [];
  sincronias.value = { ...sincronias.value, objetivo: SINCRONIA_NEUTRA };
  await chrome.storage.local.remove(claveSincronia(id)).catch(() => {});
  await motor.guardarCorreccionesPista(clavePista(id), {}, false, ajustes.value.idiomaObjetivo).catch(() => {});
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
  const turno = turnoCarga;
  const analizadas = await motor.analizarLineas(crudas(baseObjetivo));
  // Entretanto pudo cambiar la pista, o llegar líneas nuevas de Whisper: esas se conservan tal cual.
  if (turno !== turnoCarga) return;
  const porId = new Map(analizadas.map((l) => [l.id, l]));
  publicarObjetivo(baseObjetivo.map((l) => {
    const nueva = porId.get(l.id);
    return nueva && nueva.texto === l.texto ? nueva : l;
  }));
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
  motor.guardarSubtitulosGenerados(info.idVideo, ajustes.value.idiomaObjetivo, lineas, 'recordada', ajustes.value.idiomaObjetivo).catch(() => {});
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
    const previa = await motor.correccionesPista(clavePista(id), ajustes.value.idiomaObjetivo).catch(() => undefined);
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

/** El episodio para el que se midió el reloj de Netflix. */
let videoDelReloj: string | null | undefined;

export async function cargarVideoActual() {
  // Lo que siguiera llegando de una transcripción en marcha sería del video o de la lengua de antes.
  if (cortarWhisper()) avisar(tr('La transcripción se detuvo al cambiar de video o de idioma. Lo ya transcrito queda guardado.'), undefined, undefined, 8000);
  // Y lo mismo con lo que Claude estuviera traduciendo, corrigiendo o revisando: lo hecho ya está guardado, y lo que
  // falte se pide la próxima vez sin pagar dos veces lo anterior.
  turnoCarga++;
  cancelarGeneracion();
  cancelarCorreccion();
  flujoAnalisis?.cancelar();
  const info = await control.info();
  infoVideo.value = { sitio: info.sitio, idVideo: info.idVideo, titulo: info.titulo, categoria: info.categoria };
  // Otro episodio: la corrección del reloj del anterior no vale para este. Cambiar de lengua no lo toca.
  if (info.idVideo !== videoDelReloj) {
    videoDelReloj = info.idVideo;
    reiniciarReloj();
  }
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
  let errorLista: string | null = null;
  const lista = await control.listarPistas().catch((e) => {
    errorLista = e instanceof Error ? e.message : String(e);
    errorPista.value = errorLista;
    return [] as PistaInfo[];
  });
  const propias = [...lista];

  // Pistas que ya generaste para este video con Claude o Whisper.
  if (info.idVideo) {
    const generadas = await motor.subtitulosGenerados(info.idVideo, ajustes.value.idiomaObjetivo).catch(() => []);
    for (const g of generadas) {
      if (g.canto) cantos.set(info.idVideo, g.canto);
      if (g.origen === 'whisper' && g.idioma === ajustes.value.idiomaObjetivo) {
        if (g.transcrito) transcritos.set(info.idVideo, g.transcrito);
        else transcritos.delete(info.idVideo);
      }
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
  // El inglés como apoyo sirve para otra lengua, no para el propio inglés: serían dos veces los mismos subtítulos.
  const conIngles = a.idiomaObjetivo.split('-')[0] !== 'en' ? elegirPista(propias, 'en') : undefined;
  const secundaria = elegirPista(propias, a.idiomaSecundario) ?? conIngles;
  await seleccionarObjetivo(objetivo?.id ?? null);
  // Sin pista que poner, lo que impidió listarlas es lo que hay que decir (Bilibili, sin la sesión iniciada): al
  // seleccionar se había borrado.
  if (!objetivo && errorLista) errorPista.value = errorLista;
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
  control.info().then((i) => (infoVideo.value = { sitio: i.sitio, idVideo: i.idVideo, titulo: i.titulo, categoria: i.categoria })).catch(() => {});
}

const NOMBRE_ORIGEN: Partial<Record<PistaInfo['origen'], string>> = { whisper: tm('Whisper'), claude: tm('Claude'), importada: tm('importados'), recordada: tm('guardados'), letra: tm('letra') };

export const nombreIdioma = (c: string) =>
  ({ ja: tr('Japonés'), es: tr('Español'), en: tr('Inglés'), ko: tr('Coreano'), zh: tr('Chino'), pt: tr('Portugués'), fr: tr('Francés'), de: tr('Alemán') } as Record<string, string>)[c.split('-')[0]] ?? c;

export function vigilarAnuncios() {
  let vuelta = 0;
  setInterval(async () => {
    // En Netflix, cuatro veces por segundo: lo que corre el video durante un anuncio se mide de borde a borde.
    if (vuelta++ % 4 && infoVideo.value?.sitio !== 'netflix') return;
    try {
      const i = await control.info();
      anuncio.value = i.anuncio;
    } catch {
      // El adaptador aún no está listo.
    }
  }, 250);
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
    const estudio = ajustes.value.idiomaObjetivo;
    // En la lengua que se estudia sustituye a la transcripción: ya no hay nada que seguir.
    if (video && destino === 'objetivo') transcritos.delete(video);
    if (video) await motor.guardarSubtitulosGenerados(video, idioma, lineas, 'importada', estudio).catch(() => {});
    // Un archivo nuevo empieza sin el ajuste de sincronía del anterior, y sin sus correcciones.
    await chrome.storage.local.remove(claveSincronia(id)).catch(() => {});
    await motor.guardarCorreccionesPista(clavePista(id), {}, false, estudio).catch(() => {});
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
  /** Líneas del lote que Claude no tradujo. */
  omitidas?: number;
}

/**
 * Traduce las líneas japonesas al idioma de apoyo. Empiezan a aparecer enseguida, por donde vas. Siempre desde cero y con
 * los subtítulos como están ahora: seguir por lo que faltaba conservaba lo de antes, que pudo salir de otro texto o ser
 * una disculpa de Claude guardada como traducción.
 */
export async function generarSecundarios() {
  const fuente = crudas(baseObjetivo);
  if (!fuente.length) {
    avisar(tr(lengua.value.textos.primeroElige), 'error');
    return;
  }
  const idioma = ajustes.value.idiomaSecundario;
  const id = `generada:${idioma}`;
  const video = infoVideo.value?.idVideo;
  const estudio = ajustes.value.idiomaObjetivo;
  // Lo de antes se ve hasta que llega lo nuevo: si esta vez Claude no traduce nada, no se pierde.
  const anterior = idSecundaria.value;
  const habia = (importadas.get(id) ?? []).length > 0;
  const hechas = new Map<number, Linea>();
  let omitidas = 0;
  pistas.value = [...pistas.value.filter((p) => p.id !== id), { id, idioma, nombre: tr('{0} (Claude)', nombreIdioma(idioma)), origen: 'claude' }];
  idSecundaria.value = id;
  generacion.value = { tipo: 'secundarios', hechas: 0, total: fuente.length };
  const f = flujoMotor(
    'traducirSubtitulos',
    [fuente, infoVideo.value?.titulo, indiceActualEn(fuente)],
    lectorJson<EventoTraduccion>((e) => {
      omitidas += e.omitidas ?? 0;
      generacion.value = { tipo: 'secundarios', hechas: e.hechas, total: fuente.length };
      if (!e.parte.length) return;
      for (const { i, t } of e.parte) if (fuente[i]) hechas.set(fuente[i].id, { ...fuente[i], texto: t });
      const lista = [...hechas.values()].sort((a, b) => a.inicio - b.inicio);
      importadas.set(id, lista);
      publicarSecundaria(lista);
      if (video) motor.guardarSubtitulosGenerados(video, idioma, lista, 'claude', estudio).catch(() => {});
    })
  );
  flujoGeneracion = f;
  try {
    await f;
    if (generacion.value) {
      if (!hechas.size) avisar(habia ? tr('Claude no tradujo ninguna línea. Se queda la traducción que había.') : tr('Claude no tradujo ninguna línea.'), 'error', undefined, 8000);
      else if (omitidas) avisar(omitidas === 1 ? tr('Traducción lista, salvo 1 línea que Claude no tradujo.') : tr('Traducción lista, salvo {0} líneas que Claude no tradujo.', omitidas), undefined, undefined, 8000);
      else avisar(tr('Traducción lista.'), 'exito');
    }
  } catch (e) {
    avisar(tr('No se pudo traducir: {0}', e instanceof Error ? e.message : e), 'error', undefined, 8000);
  } finally {
    generacion.value = null;
    flujoGeneracion = null;
    // Sin nada nuevo, todo sigue como estaba.
    if (!hechas.size) {
      if (!habia) pistas.value = pistas.value.filter((p) => p.id !== id);
      idSecundaria.value = pistas.value.some((p) => p.id === anterior) ? anterior : null;
    }
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
          if (video) await motor.guardarSubtitulosGenerados(video, idioma, crudasActuales, 'claude', idioma);
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
  // Una letra ya es el texto verdadero: corregirla sería pagar por estropearla.
  if (pistaObjetivoEsLetra()) return;
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
  const estudio = ajustes.value.idiomaObjetivo;
  const acumulado: Record<number, string> = { ...((await motor.correccionesPista(clave, estudio).catch(() => undefined))?.cambios ?? {}) };
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
          await motor.guardarCorreccionesPista(clave, acumulado, false, estudio);
        })
        .catch(console.error);
    })
  );
  flujoCorreccion = f;
  try {
    await f;
    await cola;
    if (turno !== turnoCarga || !correccion.value) return;
    await motor.guardarCorreccionesPista(clave, acumulado, true, estudio);
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

/** Si lo que se está viendo es la letra verdadera de una canción. */
export const pistaObjetivoEsLetra = () => pistas.value.find((p) => p.id === idObjetivo.value)?.origen === 'letra';

export function cancelarCorreccion() {
  flujoCorreccion?.cancelar();
  correccion.value = null;
}

// ---------- Transcripción con Whisper ----------

let flujoWhisper: { cancelar(): void } | null = null;
let intervaloMarcas: ReturnType<typeof setInterval> | null = null;
/** Cada transcripción tiene su número: lo que llegue de una que ya se cortó no se mezcla con lo que se ve ahora. */
let sesionWhisper = 0;

/**
 * Corta la transcripción en marcha sin esperar a lo que falte. Al cambiar de video o de lengua, lo que siguiera llegando
 * se guardaría en el video o la lengua equivocados. Lo recibido hasta ahora ya está guardado: el archivo y la descarga
 * siguen desde ahí la próxima vez.
 */
export function cortarWhisper(): boolean {
  if (!whisper.value) return false;
  sesionWhisper++;
  flujoWhisper?.cancelar();
  flujoWhisper = null;
  if (intervaloMarcas) clearInterval(intervaloMarcas);
  intervaloMarcas = null;
  terminarEspera(false);
  sinCorregir = [];
  whisper.value = null;
  return true;
}
let colaWhisper: Promise<void> = Promise.resolve();
let sinCorregir: Linea[] = [];
let colaCorreccion: Promise<void> = Promise.resolve();
const LOTE_CORRECCION = 10;

/**
 * El motor oye el audio pero no sabe en qué punto va el video: se le informa continuamente. Al transcribir el audio
 * entero, con eso sabe cuánto va por delante de lo que se ve; y si el video pierde fotogramas, que da tirones.
 */
function enviarMarcaVideo() {
  let previo = -1;
  let instante = 0;
  const tirones = new MedidorTirones();
  return () => {
    const v = control.video();
    if (!v) return;
    const ms = momentoDelVideo(v);
    const ahora = performance.now();
    const esperado = previo + (ahora - instante) * v.playbackRate;
    const salto = previo >= 0 && !v.paused && Math.abs(ms - esperado) > 1500;
    previo = ms;
    instante = ahora;
    const calidad = v.getVideoPlaybackQuality?.();
    const conTirones = !!calidad && tirones.medir({ totales: calidad.totalVideoFrames, perdidos: calidad.droppedVideoFrames }, ahora);
    motor.whisperMarca(ms, !v.paused && !anuncio.value, v.playbackRate, salto, conTirones).catch(() => {});
    vigilarRitmo(v, ms);
    // En tiempo real, con una letra esperando, al acabar la canción no hay nada más que oír. Con el audio entero no: que el
    // video acabe no quiere decir que la transcripción haya llegado al final.
    if (!whisper.value?.desdeArchivo && v.ended && hayLetraPendiente() && whisper.value?.fase !== 'terminando') detenerWhisper();
  };
}

/**
 * El ritmo de una transcripción del audio entero: desde dónde y cuándo empezó a avanzar, si ya se avisó de que no llega
 * y, si se está esperando a que vaya por delante, el aviso que lo dice.
 */
let ritmo: { inicio: { t: number; frenteMs: number } | null; avisado: boolean; esperando: number | null } = { inicio: null, avisado: false, esperando: null };

/**
 * Si lo que se ve alcanza a lo transcrito y, a su ritmo, la transcripción no lo va a dejar atrás, se dice una vez, con la
 * opción de esperarla. Mientras se espera, el video sigue solo en cuanto haya subtítulos para un buen rato.
 */
function vigilarRitmo(v: HTMLVideoElement, vistoMs: number) {
  const w = whisper.value;
  if (!w?.desdeArchivo || w.frenteMs === undefined) return;
  if (ritmo.esperando !== null) {
    // Si lo pone en marcha quien lo ve, ya no se espera.
    if (!v.paused) terminarEspera(false);
    else if ((w.frenteMs - vistoMs) / 1000 > VENTAJA_PARA_SEGUIR_S || (w.porcentaje ?? 0) >= 100) terminarEspera(true);
    return;
  }
  if (ritmo.avisado || !ritmo.inicio || v.paused || v.ended || anuncio.value) return;
  const datos = { frenteMs: w.frenteMs, vistoMs, avanceMs: w.frenteMs - ritmo.inicio.frenteMs, transcurridoMs: performance.now() - ritmo.inicio.t, velocidadVideo: v.playbackRate };
  if (!noLlega(datos)) return;
  ritmo.avisado = true;
  const aviso = avisar(
    w.idModelo === 'base'
      ? tr('La transcripción va más despacio que el video en este equipo.')
      : tr('La transcripción va más despacio que el video en este equipo. Con Whisper Base, en Ajustes, Transcripción, iría más rápido.'),
    undefined,
    {
      texto: tr('Esperar a la transcripción'),
      fn: () => {
        quitarAviso(aviso);
        esperarTranscripcion();
      },
    },
    15000
  );
}

/** Pausa el video hasta que la transcripción vaya por delante: entonces sigue solo. */
function esperarTranscripcion() {
  const v = control.video();
  if (!v || !whisper.value || ritmo.esperando !== null) return;
  v.pause();
  ritmo.esperando = avisar(tr('Esperando a la transcripción: el video sigue solo en cuanto vaya por delante.'), undefined, undefined, 0);
}

function terminarEspera(seguir: boolean) {
  if (ritmo.esperando === null) return;
  quitarAviso(ritmo.esperando);
  ritmo.esperando = null;
  if (seguir) control.video()?.play().catch(() => {});
}

/** Con menos audio, lo medido diría más de lo que tarda el modelo en cargarse que de lo que calcula. */
const MINIMO_AUDIO_MEDIDA_S = 60;

/** Lo que calculó este equipo con ese modelo, para «Tu equipo»: con bastante audio para que valga. */
function guardarMedidaVoz(w: EstadoWhisper | null) {
  const id = w?.idModelo;
  if (!id || !w.velocidad || !w.dispositivo || (w.audioS ?? 0) < MINIMO_AUDIO_MEDIDA_S) return;
  // El motor de voz da el nombre de la gráfica, para enseñarlo; lo medido dice solo dónde se calculó, como en el OCR.
  const medida = { velocidad: Math.round(w.velocidad * 100) / 100, dispositivo: w.dispositivo === DISPOSITIVO_SIN_GPU ? 'wasm' : 'webgpu', fecha: Date.now() };
  anotarUso((u) => ({ ...u, voz: { ...u.voz, [id]: medida } })).catch(console.error);
}

async function guardarGenerada() {
  const video = infoVideo.value?.idVideo;
  const origen = pistas.value.find((p) => p.id === idObjetivo.value)?.origen;
  const estudio = ajustes.value.idiomaObjetivo;
  const canto = origen === 'whisper' && video ? cantos.get(video) : undefined;
  const transcrito = origen === 'whisper' && video ? transcritos.get(video) : undefined;
  if (video) await motor.guardarSubtitulosGenerados(video, estudio, crudas(baseObjetivo), origen, estudio, canto, transcrito).catch(() => {});
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

/** Con `sustituir`, la primera tanda de una transcripción desde cero: lo de antes se va, con sus arreglos, y queda lo nuevo. */
async function recibirLineasWhisper(nuevas: Linea[], fuente: { titulo?: string; url?: string; idVideo?: string }, vigente: () => boolean, sustituir = false) {
  const analizadas = await motor.analizarLineas(nuevas, fuente);
  if (!vigente()) return;
  if (sustituir) await olvidarArreglosDe(idObjetivo.value);
  publicarObjetivo(sustituir ? analizadas : fusionarLineas(baseObjetivo, analizadas));
  await guardarGenerada();
  // Un archivo se corrige entero al final; en tiempo real se va corrigiendo sin frenar las líneas nuevas.
  if (!vigente() || whisper.value?.desdeArchivo) return;
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

/** Si lo que suena es una canción: con una letra pegada seguro, y si no, por lo que dicen el sitio y el título. */
function esCancion(): boolean {
  if (hayLetraPendiente()) return true;
  const info = infoVideo.value;
  const titulo = info?.titulo ?? '';
  return info?.categoria === 'Music' || TITULO_DE_CANCION.test(titulo) || !!lengua.value.tituloDeCancion?.test(titulo);
}

/** El modelo que se usaría ahora mismo para transcribir este video. */
export const modeloQueTranscribiria = () => modeloParaTranscribir(ajustes.value.whisperModelo, ajustes.value.idiomaObjetivo, esCancion());

const TITULO_DE_CANCION = /\b(mv|m\/v|music video|lyric video|lyrics?|official video|official audio|karaoke)\b/i;

/** La dirección limpia del video: sin la lista de reproducción, la marca de tiempo ni lo que añade el sitio para seguirla. */
function urlDelVideo(): string {
  const info = infoVideo.value;
  if (info?.sitio === 'youtube' && info.idVideo) return `https://www.youtube.com/watch?v=${info.idVideo}`;
  if (info?.sitio === 'bilibili' && info.idVideo) return urlDeVideoBilibili(info.idVideo);
  return location.href;
}

/**
 * Genera los subtítulos en japonés. Con un archivo propio, o con el ayudante local en un video de
 * internet, lo procesa entero a toda velocidad. Si no, transcribe mientras se reproduce, con la
 * captura de audio activa.
 */
export async function iniciarWhisper(enVivo = false, desdeCero = false) {
  if (whisper.value) return;
  const desdeArchivo = fuenteArchivo;
  // Netflix siempre tiene subtítulos y su audio no se puede bajar: ahí nunca se usa el ayudante.
  const conAyudante = !enVivo && !desdeArchivo && infoVideo.value?.sitio !== 'netflix' && !!(await actualizarAyudante());
  if (!desdeArchivo && !conAyudante && !capturaActiva.value) {
    avisar(tr('Para oír el video hay que activar la captura de audio: {0} y vuelve a intentarlo.', comoActivarCaptura()), 'error', undefined, 8000);
    return;
  }
  if (whisper.value) return;
  const modelo = modeloParaTranscribir(ajustes.value.whisperModelo, ajustes.value.idiomaObjetivo, esCancion());
  const sesion = ++sesionWhisper;
  const vigente = () => sesion === sesionWhisper;
  whisper.value = { fase: conAyudante ? 'bajando' : desdeArchivo ? 'extrayendo' : 'preparando', lineas: 0, desdeArchivo: !!desdeArchivo || conAyudante, modelo: MODELOS_WHISPER[modelo].nombre, idModelo: modelo };
  let audio: { url: string; pcmCrudo: boolean } | null = null;
  try {
    audio = desdeArchivo ? await desdeArchivo((porcentaje) => vigente() && (whisper.value = whisper.value && { ...whisper.value, fase: 'extrayendo', porcentaje })) : null;
  } catch (e) {
    if (!vigente()) return;
    avisar(tr('No se pudo leer el audio: {0}', e instanceof Error ? e.message : e), 'error', undefined, 8000);
    whisper.value = null;
    return;
  }
  if (!vigente()) {
    if (audio) URL.revokeObjectURL(audio.url);
    return;
  }
  await activarPistaWhisper();
  // Mientras la pista se analiza aún no está en pantalla lo ya transcrito: tras cambiar de lengua, el analizador tarda
  // unos segundos en cargarse. Sin esperar, se empezaría desde el principio, y al terminar de cargarse la pista
  // sustituiría a las líneas nuevas.
  for (const limite = Date.now() + 30000; cargandoPista.value && Date.now() < limite; ) await new Promise((r) => setTimeout(r, 100));
  if (!vigente()) {
    if (audio) URL.revokeObjectURL(audio.url);
    return;
  }
  // Con el audio entero, una transcripción que se cortó sigue desde donde iba; si no, se empieza de cero y lo nuevo
  // sustituye a lo de antes en cuanto llega. En tiempo real, lo que se oye se suma a lo que ya hubiera.
  const idVideo = infoVideo.value?.idVideo ?? null;
  const duracionMs = (control.video()?.duration ?? 0) * 1000;
  const entero = !!audio || conAyudante;
  let desdeMs = 0;
  let sustituir = false;
  if (entero) {
    desdeMs = desdeCero ? 0 : desdeDondeSeguir(idVideo ? transcritos.get(idVideo) : undefined, duracionMs);
    sustituir = desdeMs === 0 && baseObjetivo.length > 0;
    if (desdeMs > 0) {
      const s = Math.floor(desdeMs / 1000);
      avisar(tr('Sigo desde donde iba: {0}:{1}.', Math.floor(s / 60), String(s % 60).padStart(2, '0')), undefined, { texto: tr('Empezar de cero'), fn: () => empezarDeCero(enVivo) }, 10000);
    }
    if (idVideo) transcritos.set(idVideo, { hastaMs: desdeMs, completa: false });
  }
  /** La transcripción llegó al final del audio: la próxima vez se empieza de cero. */
  let llegoAlFinal = false;
  sinCorregir = [];
  colaWhisper = Promise.resolve();
  colaCorreccion = Promise.resolve();
  let avisoRetraso = false;
  const info = infoVideo.value;
  const fuente = { titulo: info?.titulo, url: location.href, idVideo: info?.idVideo ?? undefined };
  // Dónde va el video se marca siempre: en tiempo real, para saber qué se oye; con el audio entero, para que la intensidad
  // automática no corra más de la cuenta ni se quede atrás, y para avisar si lo que se ve alcanza a lo transcrito.
  terminarEspera(false);
  ritmo = { inicio: null, avisado: false, esperando: null };
  const marcar = enviarMarcaVideo();
  marcar();
  const marcas: ReturnType<typeof setInterval> = setInterval(marcar, 250);
  intervaloMarcas = marcas;
  /** Lo último que se supo de esta transcripción, para guardar lo medido aunque se corte. */
  let medidaSesion: EstadoWhisper | null = null;
  let vistos = 0;
  const metodo = conAyudante ? 'transcribirDescarga' : audio ? 'transcribirArchivo' : 'transcribirEnVivo';
  // En una canción, además, dónde se canta: para colocar luego su letra sin poner versos en un pasaje instrumental.
  const conCanto = esCancion();
  const videoCanto = info?.idVideo;
  // Con la clave del video, el motor guarda el audio de una canción entera para colocar luego su letra con la voz.
  const f = flujoMotor(metodo, conAyudante ? [urlDelVideo(), desdeMs, modelo, conCanto, videoCanto] : audio ? [audio.url, audio.pcmCrudo, desdeMs, modelo, conCanto, videoCanto] : [modelo], (acumulado) => {
    if (!vigente()) return;
    const texto = acumulado.slice(vistos);
    const fin = texto.lastIndexOf('\n');
    if (fin < 0) return;
    vistos += fin + 1;
    for (const fila of texto.slice(0, fin).split('\n')) {
      const e = JSON.parse(fila);
      const actual = whisper.value ?? { fase: 'preparando' as const, lineas: 0 };
      if (e.tipo === 'lineas') {
        whisper.value = { ...actual, lineas: actual.lineas + e.lineas.length };
        const primeraDeCero = sustituir;
        sustituir = false;
        colaWhisper = colaWhisper.then(() => recibirLineasWhisper(e.lineas, fuente, vigente, primeraDeCero)).catch(console.error);
      } else if (e.tipo === 'canto') {
        if (videoCanto) {
          cantos.set(videoCanto, { pasoMs: e.pasoMs, puntos: e.puntos });
          colaWhisper = colaWhisper.then(() => (vigente() ? guardarGenerada() : undefined)).catch(console.error);
        }
      } else if (e.tipo === 'bajandoAudio') {
        whisper.value = { ...actual, fase: 'bajando', porcentaje: e.porcentaje };
      } else if (e.tipo === 'extrayendoAudio') {
        // Sin FFmpeg en el equipo, el ayudante entrega el archivo y la extensión saca de él el audio.
        whisper.value = { ...actual, fase: 'extrayendo', porcentaje: e.porcentaje };
      } else if (e.tipo === 'descarga') {
        whisper.value = { ...actual, fase: 'descargando', porcentaje: e.porcentaje, cargadoMb: e.cargadoMb, totalMb: e.totalMb };
      } else if (e.tipo === 'escuchando') {
        avisarSiNoHayGpu(actual.dispositivo, e.dispositivo);
        whisper.value = { ...actual, fase: actual.fase === 'terminando' ? 'terminando' : 'escuchando', dispositivo: e.dispositivo, porcentaje: undefined };
      } else if (e.tipo === 'procesando') {
        avisarSiNoHayGpu(actual.dispositivo, e.dispositivo);
        // Desde aquí se mide el ritmo: lo de antes era cargar el modelo y, con el ayudante, bajar el audio.
        if (e.frenteMs !== undefined && !ritmo.inicio) ritmo.inicio = { t: performance.now(), frenteMs: e.frenteMs };
        if (e.porcentaje === 100) llegoAlFinal = true;
        if (entero && idVideo && e.frenteMs !== undefined) transcritos.set(idVideo, { hastaMs: e.frenteMs, completa: false });
        // El porcentaje de la fase anterior (el 100 % de la descarga del modelo) no es el de la transcripción.
        const sigue = actual.fase === 'procesando' || actual.fase === 'terminando';
        whisper.value = {
          ...actual,
          fase: actual.fase === 'terminando' ? 'terminando' : 'procesando',
          porcentaje: e.porcentaje ?? (sigue ? actual.porcentaje : undefined),
          dispositivo: e.dispositivo ?? actual.dispositivo,
          restanteS: e.restanteS ?? (sigue ? actual.restanteS : undefined),
          frenteMs: e.frenteMs ?? actual.frenteMs,
          audioS: e.audioS ?? actual.audioS,
          velocidad: e.velocidad ?? actual.velocidad,
        };
        medidaSesion = whisper.value;
      } else if (e.tipo === 'tirones') {
        avisar(tr('El video daba tirones: mientras la transcripción vaya por delante, la tarjeta gráfica descansa más.'), undefined, undefined, 7000);
      } else if (e.tipo === 'pausado') {
        whisper.value = { ...actual, pausado: e.pausado };
      } else if (e.tipo === 'recuperando') {
        whisper.value = { ...actual, fase: 'recuperando' };
        avisar(tr('La tarjeta gráfica se reinició. Espero {0} s y sigo a la mínima intensidad. Lo transcrito está guardado.', e.segundos), 'error', undefined, 10000);
      } else if (e.tipo === 'retraso') {
        if (!avisoRetraso)
          avisar(
            actual.idModelo === 'base'
              ? tr('La tarjeta gráfica va justa y la transcripción lleva retraso. Cierra otras aplicaciones exigentes si quieres que se ponga al día.')
              : tr('La tarjeta gráfica va justa y la transcripción lleva retraso. Con Whisper Base, en Ajustes, Transcripción, iría más rápido; también ayuda cerrar otras aplicaciones exigentes.'),
            undefined,
            undefined,
            10000
          );
        avisoRetraso = true;
      } else if (e.tipo === 'preparando') {
        whisper.value = { ...actual, fase: 'preparando', porcentaje: undefined };
      }
    }
  });
  flujoWhisper = f;
  try {
    await f;
    await colaWhisper;
    if (!vigente()) return;
    // Terminada, y no detenida: la próxima vez se empieza de cero.
    if (entero && idVideo && llegoAlFinal) {
      transcritos.set(idVideo, { hastaMs: Math.max(duracionMs, transcritos.get(idVideo)?.hastaMs ?? 0), completa: true });
      if (whisper.value?.lineas) await guardarGenerada();
    }
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
    if (!vigente()) return;
    const mensaje = e instanceof Error ? e.message : String(e);
    // Si el video no se puede bajar, aún queda oírlo mientras se reproduce. Un fallo después de bajarlo es de la transcripción.
    if (conAyudante && whisper.value?.fase === 'bajando') avisar(tr('No se pudo bajar el audio: {0}', mensaje), 'error', { texto: tr('Transcribir al reproducir'), fn: () => iniciarWhisper(true) }, 12000);
    else avisar(tr('No se pudo transcribir: {0}', mensaje), 'error', undefined, 8000);
  } finally {
    clearInterval(marcas);
    // Lo medido vale aunque se cortara: era este equipo calculando.
    guardarMedidaVoz(medidaSesion);
    // Si se cortó, lo que hay ahora es de otra transcripción, o de ninguna: no se toca.
    if (vigente()) {
      // Si el video esperaba a la transcripción, ya no queda nada que esperar.
      terminarEspera(true);
      intervaloMarcas = null;
      flujoWhisper = null;
      whisper.value = null;
    }
    if (audio) URL.revokeObjectURL(audio.url);
  }
}

// ---------- La letra de una canción ----------

const hayLetraPendiente = () => versosDeLetra(letraPegada.value).length > 0;

/**
 * Los tiempos sobre los que se coloca la letra: los de la pista elegida. Si es una letra ya colocada, los de lo que se
 * oyó: la transcripción de Whisper o, si no la hay, la pista automática del sitio en esa lengua.
 */
async function lineasConTiempos(): Promise<Linea[]> {
  const idioma = ajustes.value.idiomaObjetivo;
  if (idObjetivo.value !== `letra:${idioma}`) return crudas(baseObjetivo);
  const transcripcion = importadas.get(`generada:${idioma}`);
  if (transcripcion) return transcripcion;
  const base = idioma.split('-')[0];
  const oida = pistas.value.find((p) => p.origen !== 'letra' && p.automatica && p.idioma.split('-')[0] === base);
  if (oida) {
    try {
      return await textoAPista(oida);
    } catch {
      // Sin la pista del sitio, la letra de antes da al menos sus tiempos.
    }
  }
  return crudas(baseObjetivo);
}

/** Una letra que casa con lo oído en menos de esta parte de sus versos no se coloca sola: se le pregunta a Claude. */
const PARTE_CASADA = 0.25;

/**
 * Lo que contesta el motor al colocar la letra con la voz: la letra colocada, o por qué no pudo. `aislada`, si Demucs le
 * quitó antes la música; `sinDemucs`, si no lo hizo porque no está en el disco; `bajarDemucs`, si afinar lo bajaría.
 */
type AjusteConVoz = { resultado?: ResultadoAjuste & { conVoz: number }; motivo?: 'sin-audio' | 'sin-fonemas' | 'sin-narabas'; aislada?: boolean; sinDemucs?: boolean; bajarDemucs?: boolean; repetidos?: number };
/** El avance de narabas (1,26 GB) y de Demucs (181 MB), que la primera vez se bajan. */
type EventoVozLetra =
  | { tipo: 'descarga' | 'descarga-voz' | 'separando'; porcentaje: number }
  | { tipo: 'comprobando' | 'preparando' | 'procesando' | 'preparando-voz' };

function textoAvanceVoz(e: EventoVozLetra): string {
  if (e.tipo === 'descarga') return tr('Bajando narabas para oír los fonemas: {0} %', e.porcentaje);
  if (e.tipo === 'descarga-voz') return tr('Bajando Demucs para aislar la voz: {0} %', e.porcentaje);
  if (e.tipo === 'separando') return tr('Aislando la voz de la canción: {0} %', e.porcentaje);
  if (e.tipo === 'preparando-voz') return tr('Preparando Demucs para aislar la voz…');
  return tr('Oyendo los fonemas de la canción…');
}

/**
 * Coloca la letra pegada sobre lo que se oye y deja el resultado como una pista más; las palabras salen tal cual de la
 * letra. Primero con la voz: en una canción transcrita entera, narabas pone cada verso donde suenan sus fonemas, buscándolo
 * en la zona que da lo que oyó Whisper. Si no se puede, casándola letra a letra con lo que oyó Whisper, sin preguntar a
 * nadie. Y si apenas casa (una letra en rōmaji, por ejemplo), Claude dice qué verso suena sobre qué líneas.
 * `bajarVoz` baja narabas si hace falta; `versosDados`, para volver a colocar la misma letra.
 */
export async function ajustarLetra(bajarVoz = false, versosDados?: string[]) {
  const versos = versosDados ?? versosDeLetra(letraPegada.value);
  if (!versos.length || ajustandoLetra.value) return;
  ajustandoLetra.value = true;
  const lineas = await lineasConTiempos().catch(() => [] as Linea[]);
  if (!lineas.length) {
    ajustandoLetra.value = false;
    return;
  }
  // Colocarla tarda unos segundos: si entretanto se cambia de video o de lengua, la letra es del video y la lengua de ahora.
  const idioma = ajustes.value.idiomaObjetivo;
  const id = `letra:${idioma}`;
  const video = infoVideo.value?.idVideo;
  const claveSinc = claveSincronia(id);
  const claveCorrecciones = clavePista(id);
  const sigueAqui = () => infoVideo.value?.idVideo === video && ajustes.value.idiomaObjetivo === idioma;
  // Si Whisper oyó la canción, también se sabe dónde se canta: los versos que no recogió no caen en un pasaje instrumental.
  const canto = video ? (cantos.get(video) ?? null) : null;
  const voz = canto ? vozDeCanto(canto) : undefined;
  let avance: number | null = null;
  const decir = (texto: string) => {
    if (avance === null) avance = avisar(texto, undefined, undefined, 0);
    else cambiarAviso(avance, texto);
  };
  try {
    let colocada: ResultadoAjuste | null = null;
    let conLaVoz = false;
    let respuestaVoz: AjusteConVoz = {};
    if (video) {
      try {
        const respuesta = await flujoMotor('alinearLetraConVoz', [lineas, versos, video, canto, bajarVoz], lectorJson<EventoVozLetra>((e) => decir(textoAvanceVoz(e))));
        respuestaVoz = JSON.parse(respuesta) as AjusteConVoz;
        if (respuestaVoz.resultado?.conVoz) {
          colocada = respuestaVoz.resultado;
          conLaVoz = true;
        }
      } catch (e) {
        console.warn('Kotonoha: no se pudo colocar la letra con la voz', e);
      }
    }
    let repetidos = respuestaVoz.repetidos ?? 0;
    if (!colocada) {
      // La letra tal como se canta, también sin la voz: un estribillo escrito una vez se repite donde lo oyó Whisper.
      const cantados = versosCantados(versos, lineas).versos;
      repetidos = cantados.length - versos.length;
      const r = alinearPorLetras(cantados, lineas, ID_LETRA, voz);
      if (r.conTiempo >= Math.max(2, cantados.length * PARTE_CASADA)) colocada = r;
    }
    if (!colocada) {
      const estado = await motor.estado().catch(() => null);
      if (!estado?.claveIA) {
        if (sigueAqui()) avisar(tr('Esta letra apenas casa con lo que se oye. ¿Es la de esta canción? Con tu clave de la API, Claude puede intentarlo.'), 'error', { texto: tr('Ajustes'), fn: () => fondo.abrirApp('ajustes') }, 10000);
        return;
      }
      decir(tr('Claude está colocando la letra…'));
      const ajuste = JSON.parse(await flujoMotor('ajustarLetra', [lineas, versos, infoVideo.value?.titulo], () => {})) as EntradaAjuste[];
      colocada = aplicarAjuste(versos, lineas, ajuste, ID_LETRA, voz);
      repetidos = 0;
    }
    const { lineas: finales, conTiempo, estimadas } = colocada;
    if (!conTiempo && !conLaVoz) {
      if (sigueAqui()) avisar(tr('Claude no encontró esta letra en lo que se oye. ¿Es la de esta canción?'), 'error', undefined, 8000);
      return;
    }
    if (video) await motor.guardarSubtitulosGenerados(video, idioma, finales, 'letra', idioma).catch(() => {});
    // Una letra nueva empieza sin la sincronía ni las correcciones de la anterior.
    await chrome.storage.local.remove(claveSinc).catch(() => {});
    await motor.guardarCorreccionesPista(claveCorrecciones, {}, false, idioma).catch(() => {});
    // Si ya se está en otro video, la letra queda guardada para cuando se vuelva al suyo.
    if (!sigueAqui()) return;
    importadas.set(id, finales);
    pistas.value = [...pistas.value.filter((p) => p.id !== id), { id, idioma, nombre: `${nombreIdioma(idioma)} (${tr('letra')})`, origen: 'letra' }];
    letraPegada.value = '';
    await seleccionarObjetivo(id);
    retraducirTrasLetra();
    // Si la letra traía el estribillo una vez y se canta más, se dice: son versos que no estaban escritos ahí.
    const conRepetidos = (texto: string) => (repetidos > 0 ? `${texto} ${repetidos === 1 ? tr('Uno se repite donde la letra no lo volvía a escribir.') : tr('{0} se repiten donde la letra no los volvía a escribir.', repetidos)}` : texto);
    if (conLaVoz) {
      // Demucs la afina más, pero son 181 MB: se ofrece, no se baja sin pedirlo.
      const aislar = respuestaVoz.sinDemucs ? { texto: tr('Afinar aislando la voz (181 MB)'), fn: () => ajustarLetra(true, versos) } : undefined;
      const colocados = finales.length;
      const texto = respuestaVoz.aislada ? tr('Letra colocada con la voz aislada: {0} versos.', colocados) : tr('Letra colocada con la voz: {0} versos.', colocados);
      avisar(conRepetidos(texto), 'exito', aislar, aislar ? 15000 : 4500);
    } else {
      // narabas la afina, pero son 1,26 GB (con Demucs, 1,4 GB): se ofrece, no se baja sin pedirlo.
      const tamano = respuestaVoz.bajarDemucs ? tr('Afinar con la voz (1,4 GB)') : tr('Afinar con la voz (1,26 GB)');
      const afinar = respuestaVoz.motivo === 'sin-narabas' ? { texto: tamano, fn: () => ajustarLetra(true, versos) } : undefined;
      avisar(conRepetidos(estimadas ? tr('Letra ajustada: {0} versos con sus tiempos y {1} estimados.', conTiempo, estimadas) : tr('Letra ajustada: {0} versos con sus tiempos.', conTiempo)), 'exito', afinar, afinar ? 15000 : 4500);
    }
  } catch (e) {
    avisar(tr('No se pudo ajustar la letra: {0}', e instanceof Error ? e.message : e), 'error', undefined, 8000);
  } finally {
    ajustandoLetra.value = false;
    if (avance !== null) quitarAviso(avance);
  }
}

/**
 * La traducción que hubiera era de lo que el reconocedor creyó oír, o de otra letra: al cambiar el texto deja de valer.
 * Una pista del propio sitio se respeta, porque no depende de lo oído.
 */
function retraducirTrasLetra() {
  const a = ajustes.value;
  const actual = pistas.value.find((p) => p.id === idSecundaria.value);
  if (actual ? actual.origen !== 'claude' : !a.generarSecundariosAuto) return;
  importadas.delete(`generada:${a.idiomaSecundario}`);
  publicarSecundaria([]);
  generarSecundarios().catch(() => {});
}

/** Deja libre la tarjeta gráfica cuando la necesites, sin perder el punto en el que iba. */
export function pausarWhisper(pausado: boolean) {
  if (!whisper.value) return;
  whisper.value = { ...whisper.value, pausado };
  motor.whisperPausar(pausado).catch(() => {});
}

// ---------- Marcar los tiempos a mano ----------

/** Lo que se lleva marcado: la línea que toca, cuándo se pulsó la tecla y lo que tenía cada línea marcada, para deshacer. */
/** Las líneas y la sincronía de antes de pasarla a las líneas, para dejarlas como estaban si no se marca nada. */
type AntesDeMarcar = { base: LineaAnalizada[]; sinc: Sincronia; anclas: typeof anclas.value };
let marcas: { indice: number; pulsadaEn: number | null; antes: { indice: number; inicio: number; fin: number; delta: number }[]; previa: AntesDeMarcar | null } | null = null;
/** Una línea dura como poco esto, aunque la tecla se suelte enseguida. */
const MARCA_MINIMA_MS = 300;
/** Al deshacer, se vuelve a un poco antes de la línea, para marcarla otra vez. */
const VOLVER_ANTES_MS = 2000;

const ahoraEnVideo = () => {
  const v = control.video();
  return v ? Math.round(momentoDelVideo(v)) : tiempoMs.value;
};

/**
 * Marcar los tiempos a mano, en la pista que se ve: se mantiene la barra espaciadora (o el botón) mientras suena cada
 * línea y se suelta al acabar. Para un cantante al que ningún modelo entiende. Se marca sobre lo que se ve: si la pista
 * tenía una sincronía, se queda en sus líneas.
 */
export function empezarMarcado() {
  if (!baseObjetivo.length || marcas) return;
  // La sincronía se pasa a las líneas, que es donde se marca; si al final no se marca nada, vuelve a como estaba.
  const sinc = sincronias.value.objetivo;
  let previa: AntesDeMarcar | null = null;
  if (sinc.desfaseMs || sinc.escala !== 1) {
    previa = { base: baseObjetivo, sinc, anclas: anclas.value };
    baseObjetivo = aplicarSincronia(baseObjetivo, sinc);
    anclas.value = [];
    fijarSincronia('objetivo', SINCRONIA_NEUTRA);
  }
  const ahora = ahoraEnVideo();
  const i = baseObjetivo.findIndex((l) => l.fin > ahora);
  marcas = { indice: i < 0 ? 0 : i, pulsadaEn: null, antes: [], previa };
  marcado.value = { indice: marcas.indice, total: baseObjetivo.length, pulsado: false };
}

/** La tecla baja: empieza la línea que toca. */
export function pulsarMarca() {
  if (!marcas || marcas.pulsadaEn !== null || marcas.indice >= baseObjetivo.length) return;
  marcas.pulsadaEn = ahoraEnVideo();
  marcado.value = { indice: marcas.indice, total: baseObjetivo.length, pulsado: true };
}

/** La tecla sube: la línea acaba, y las que faltan se mueven con ella para no quedarse atrás mientras se marca. */
export function soltarMarca() {
  if (!marcas || marcas.pulsadaEn === null) return;
  const i = marcas.indice;
  const l = baseObjetivo[i];
  const inicio = marcas.pulsadaEn;
  const fin = Math.max(ahoraEnVideo(), inicio + MARCA_MINIMA_MS);
  const delta = inicio - l.inicio;
  marcas.antes.push({ indice: i, inicio: l.inicio, fin: l.fin, delta });
  publicarObjetivo(baseObjetivo.map((x, k) => (k === i ? { ...x, inicio, fin } : k > i ? { ...x, inicio: x.inicio + delta, fin: x.fin + delta } : x)));
  marcas.indice = i + 1;
  marcas.pulsadaEn = null;
  marcado.value = { indice: marcas.indice, total: baseObjetivo.length, pulsado: false };
  if (marcas.indice >= baseObjetivo.length) void terminarMarcado();
}

/** Deshace la última línea marcada y vuelve a un poco antes de ella. */
export function deshacerMarca() {
  const ultima = marcas?.antes.pop();
  if (!marcas || !ultima) return;
  const { indice: i, inicio, fin, delta } = ultima;
  publicarObjetivo(baseObjetivo.map((x, k) => (k === i ? { ...x, inicio, fin } : k > i ? { ...x, inicio: x.inicio - delta, fin: x.fin - delta } : x)));
  marcas.indice = i;
  marcas.pulsadaEn = null;
  marcado.value = { indice: i, total: baseObjetivo.length, pulsado: false };
  void saltar(Math.max(0, inicio - VOLVER_ANTES_MS));
}

/** Termina de marcar y guarda la pista para este video. */
export async function terminarMarcado() {
  if (!marcas) return;
  const hechas = marcas.antes.length;
  const previa = marcas.previa;
  marcas = null;
  marcado.value = null;
  if (!hechas) {
    if (previa) {
      baseObjetivo = previa.base;
      anclas.value = previa.anclas;
      fijarSincronia('objetivo', previa.sinc);
    }
    return;
  }
  await guardarPistaMarcada();
  avisar(hechas === 1 ? tr('Tiempo marcado en 1 línea. Queda guardado para este video.') : tr('Tiempos marcados en {0} líneas. Quedan guardados para este video.', hechas), 'exito');
}

/**
 * Guarda la pista con los tiempos marcados. Una transcripción, una letra o unos importados se guardan como lo que eran;
 * los del propio sitio no se pueden cambiar, así que pasan a ser unos importados de este video.
 */
async function guardarPistaMarcada() {
  const video = infoVideo.value?.idVideo;
  const idioma = ajustes.value.idiomaObjetivo;
  const actual = pistas.value.find((p) => p.id === idObjetivo.value);
  const lineas = crudas(baseObjetivo);
  if (actual?.id.startsWith('letra:')) {
    importadas.set(actual.id, lineas);
    if (video) await motor.guardarSubtitulosGenerados(video, idioma, lineas, 'letra', idioma).catch(() => {});
    return;
  }
  const id = `generada:${idioma}`;
  importadas.set(id, lineas);
  if (actual?.id !== id) {
    pistas.value = [...pistas.value.filter((p) => p.id !== id), { id, idioma, nombre: tr('{0} (importados)', nombreIdioma(idioma)), origen: 'importada' }];
    idObjetivo.value = id;
    if (video) transcritos.delete(video);
  }
  await guardarGenerada();
}

/** Corta la transcripción que siguió desde donde iba y la empieza otra vez desde el principio. */
function empezarDeCero(enVivo: boolean) {
  cortarWhisper();
  iniciarWhisper(enVivo, true).catch(console.error);
}

/**
 * Borra todo lo guardado de los subtítulos de este video, en todas las lenguas: transcripciones, traducciones, letras,
 * importados, correcciones y sincronía. Quedan las pistas del propio sitio.
 */
export async function borrarSubtitulosDelVideo() {
  const video = infoVideo.value?.idVideo;
  if (!video) return;
  cortarWhisper();
  cancelarGeneracion();
  cancelarCorreccion();
  const n = await motor.borrarSubtitulosVideo(video).catch(() => -1);
  // La sincronía de cada pista va aparte, en el almacenamiento de la extensión.
  const guardado = await chrome.storage.local.get(null).catch(() => ({}) as Record<string, unknown>);
  const claves = Object.keys(guardado).filter((k) => k.startsWith(`kotonohaSincronia:${video}:`));
  if (claves.length) await chrome.storage.local.remove(claves).catch(() => {});
  cantos.delete(video);
  transcritos.delete(video);
  await cargarVideoActual();
  if (n < 0) avisar(tr('No se pudieron borrar los subtítulos guardados de este video.'), 'error');
  else avisar(n ? tr('Se borraron los subtítulos guardados de este video.') : tr('Este video no tenía subtítulos guardados.'), n ? 'exito' : undefined);
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
  // En una lengua que separa las palabras con espacios, dos líneas pegadas sin más juntarían la última palabra de una con la primera de la otra.
  const union = lengua.value.escritura.palabrasSeparadas ? ' ' : '';
  const texto = grupo.map((l) => l.texto.trim()).filter(Boolean).join(union);
  const unida: Linea = { id: grupo[0].id, inicio: grupo[0].inicio, fin: grupo[grupo.length - 1].fin, texto };
  const [analizada] = await motor.analizarLineas([unida]);
  publicarObjetivo(baseObjetivo.filter((l) => !ids.slice(1).includes(l.id)).map((l) => (l.id === unida.id ? analizada : l)));
  seleccionadas.value = new Set([unida.id]);
}

export const guardarA = guardarAjustes;
