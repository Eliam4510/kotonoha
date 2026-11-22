// El reloj del episodio en Netflix. Tras un anuncio del medio, al pasar solo al siguiente episodio o tras algunos saltos,
// el <video> sigue su propia cuenta, y los subtítulos, que van por el tiempo del episodio, saldrían adelantados o
// atrasados hasta recargar la página. Su reproductor sí sabe en qué momento del episodio está: se comparan los dos una
// vez por segundo con el video en marcha, siempre, y en ráfaga tras un salto, al acabar un anuncio, en un episodio nuevo
// o al pedirlo a mano.
//
// Si tras un anuncio el reloj de Netflix no lo descuenta, o no da su momento, se descuenta lo que corrió el video
// mientras duraba. Ese descuento se suma a lo que mida su reloj, que se sigue comparando: en cuanto mida otra cosa que
// antes del anuncio, ya cuenta lo que corrió el video, y el descuento sobra. (Antes, con el descuento puesto se dejaba
// de comparar y «Volver a sincronizar» repetía la misma cifra hasta recargar la página.) Quien mira puede quitarlo.
//
// Cada <video> lleva su cuenta: si Netflix cambia de elemento, lo medido con el otro no vale para él. En los demás
// sitios, y si no hay nada que medir, todo sigue por el <video>.

import { signal } from '@preact/signals';
import type { TiemposSitio } from '../compartido/tipos';
import { AjusteReloj, descuentoTrasAnuncio, sobraDescuento, type MuestraReloj } from '../nucleo/reloj';

/** Lo medido con un <video>. */
interface Cuenta {
  /** Lo que dice el reloj de Netflix frente al del video. */
  ajuste: AjusteReloj;
  /** Lo que su reloj no descuenta: lo que corrió el video durante anuncios, en ms (negativo). */
  descuento: number;
  /** Lo que medía su reloj cuando se puso el descuento. */
  base: number;
}

const nuevaCuenta = (): Cuenta => ({ ajuste: new AjusteReloj(), descuento: 0, base: 0 });
const SIN_CUENTA = nuevaCuenta();
let cuentas = new WeakMap<HTMLVideoElement, Cuenta>();
/** La cuenta del <video> que se sigue ahora. */
let cuenta = nuevaCuenta();
let videoReloj: HTMLVideoElement | null = null;

const total = (c: Cuenta) => c.ajuste.correccion + c.descuento;

export interface EstadoReloj {
  /** Si ya se midió algo, o hay un descuento por anuncios. */
  medido: boolean;
  /** Cuánto se corrige el <video>, en ms: lo que mide el reloj de Netflix más el descuento por anuncios. */
  correccionMs: number;
  porAnuncios: boolean;
  descuentoMs: number;
  /** La última lectura de los dos relojes, para que se vea qué se compara. */
  muestra: (MuestraReloj & { hora: number }) | null;
}

/** Para el panel: cómo va el reloj. */
export const estadoReloj = signal<EstadoReloj>({ medido: false, correccionMs: 0, porAnuncios: false, descuentoMs: 0, muestra: null });

/** El momento del episodio, en ms: el del <video>, con la corrección. */
export const momentoDelVideo = (v: HTMLVideoElement) => v.currentTime * 1000 + total(v === videoReloj ? cuenta : (cuentas.get(v) ?? SIN_CUENTA));

/**
 * Lo que hay que restar al momento del episodio para saltar a él con el seek de Netflix, que va por su reloj. Lo que su
 * reloj ya descuenta no se resta; el descuento por anuncios, sí, si su reloj cuenta los anuncios. Sin su reloj no se
 * sabe, y su seek va por el episodio.
 */
export const desfaseDeSaltos = () => (cuenta.ajuste.medido ? cuenta.descuento : 0);

export interface EntornoReloj {
  /** Si el sitio tiene un reloj propio que seguir (Netflix). En los demás, sus anuncios no tocan nada. */
  activo: () => boolean;
  /** El momento del <video> y el del reproductor, tomados a la vez; null si ahora no se puede (pausa, salto, otro sitio). */
  tomar: () => Promise<TiemposSitio | null>;
  /** Si ahora tiene sentido medir: en Netflix, con un video en marcha y sin anuncio. */
  medible: () => boolean;
  /** La corrección cambió sola, sin pedirlo nadie; `porAnuncios`, si fue por un descuento nuevo. */
  alCambiar: (correccionMs: number, porAnuncios: boolean) => void;
}

let entorno: EntornoReloj | null = null;
let rafaga = 0;
let vuelta = 0;
let ocupado = false;
/** Mientras se mide porque alguien lo pidió: el resultado lo da quien lo pidió, y no además el aviso automático. */
let aMano = false;
/** Quien mira quitó el descuento por anuncios: en este episodio no se vuelve a poner. */
let sinDescuentos = false;
let ultimaMuestra: EstadoReloj['muestra'] = null;
let ultimaSesion: string | undefined;
/** El último momento del <video> con el episodio en marcha y sin anuncio. */
let ultimoSinAnuncio: { v: HTMLVideoElement; ms: number } | null = null;
/** Cómo estaba todo al empezar el anuncio en curso; `antes`, lo que corrió en otro justo anterior aún sin resolver. */
let alEmpezarAnuncio: { v: HTMLVideoElement; ms: number; base: number; antes: number } | null = null;
/** Un anuncio que acaba de terminar: falta saber si el reloj de Netflix lo descontó. */
let trasAnuncio: { v: HTMLVideoElement; avance: number; msFin: number; base: number; medidas: number } | null = null;

/** Lo que pasa con el reloj queda en la consola: si algún día no cuadra, se puede ver por qué. */
const registrar = (que: string, datos?: object) => {
  if (entorno?.activo()) console.info(`Kotonoha: reloj de Netflix, ${que}${datos ? ` ${JSON.stringify(datos)}` : ''}`);
};

function publicar() {
  const e = estadoReloj.value;
  const medido = cuenta.ajuste.medido || cuenta.descuento !== 0;
  const correccionMs = total(cuenta);
  if (e.medido !== medido || e.correccionMs !== correccionMs || e.descuentoMs !== cuenta.descuento || e.muestra !== ultimaMuestra) {
    estadoReloj.value = { medido, correccionMs, porAnuncios: cuenta.descuento !== 0, descuentoMs: cuenta.descuento, muestra: ultimaMuestra };
  }
}

/**
 * Tras un anuncio, en cuanto el reloj de Netflix dio su medida, si el video volvió atrás, o tras dos segundos y medio de
 * video sin ninguna de las dos cosas: si su reloj no descontó el anuncio, se descuenta lo que corrió el video.
 */
function revisarTrasAnuncio() {
  const t = trasAnuncio;
  if (!t || !entorno) return;
  if (t.v !== videoReloj) {
    trasAnuncio = null;
    return;
  }
  const ms = t.v.currentTime * 1000;
  const volvioAtras = ms < t.msFin - 1000;
  const midio = cuenta.ajuste.medidas > t.medidas;
  if (!volvioAtras && !midio && ms - t.msFin < 2500) return;
  trasAnuncio = null;
  const d = sinDescuentos ? null : descuentoTrasAnuncio({ avance: t.avance, base: t.base }, { midio, correccion: cuenta.ajuste.correccion, volvioAtras });
  registrar('tras el anuncio', { avance: Math.round(t.avance), midio, medida: cuenta.ajuste.correccion, volvioAtras, descuento: d });
  if (d === null) return;
  cuenta.descuento += d;
  cuenta.base = cuenta.ajuste.correccion;
  if (!aMano) entorno.alCambiar(total(cuenta), true);
  publicar();
}

/** Cada 250 ms: en ráfaga, una muestra cada vez; si no, una por segundo. */
async function muestrear() {
  if (!entorno || ocupado) return;
  vuelta++;
  revisarTrasAnuncio();
  if (rafaga <= 0 && vuelta % 4) return;
  const v = videoReloj;
  if (!v || !entorno.medible()) return;
  ocupado = true;
  try {
    const m = await entorno.tomar().catch(() => null);
    // Si entre tanto se cambió de <video>, la lectura era del otro.
    if (!m || v !== videoReloj) return;
    if (rafaga > 0) rafaga--;
    ultimaMuestra = { video: m.video, jugador: m.jugador, hora: Date.now() };
    if (m.sesion !== ultimaSesion) {
      ultimaSesion = m.sesion;
      if ((m.sesiones ?? 1) > 1) registrar('sesión de su reproductor', { sesion: m.sesion, de: m.sesiones });
    }
    const c = cuenta;
    const antes = total(c);
    const medidas = c.ajuste.medidas;
    c.ajuste.anotar(m);
    if (c.ajuste.medidas > medidas && c.descuento && sobraDescuento(c.ajuste.correccion, c.base)) {
      registrar('su reloj ya cuenta los anuncios', { medida: c.ajuste.correccion, descuentoQuitado: c.descuento });
      c.descuento = 0;
    }
    const despues = total(c);
    if (despues !== antes) {
      registrar('corrección', { ms: despues, medida: c.ajuste.correccion, descuento: c.descuento });
      if (!aMano) entorno.alCambiar(despues, false);
    }
    publicar();
  } finally {
    ocupado = false;
  }
}

export function iniciarRelojSitio(e: EntornoReloj) {
  entorno = e;
  setInterval(() => void muestrear(), 250);
}

/** El <video> de los subtítulos, en cada tick: si es otro, cada uno lleva su cuenta, y se mide enseguida. */
export function usarVideo(v: HTMLVideoElement) {
  if (v === videoReloj) return;
  if (videoReloj) {
    cuentas.set(videoReloj, cuenta);
    registrar('otro <video>', { videos: document.querySelectorAll('video').length, conElOtro: total(cuenta) });
  }
  cuenta = cuentas.get(v) ?? nuevaCuenta();
  videoReloj = v;
  ultimaMuestra = null;
  medirDeNuevo();
  publicar();
}

/** Tras un salto, al acabar un anuncio o al volver a reproducir: se mide de nuevo enseguida. */
export function medirDeNuevo(muestras = 6) {
  cuenta.ajuste.olvidarMuestras();
  rafaga = Math.max(rafaga, muestras);
}

/** Con el episodio en marcha y sin anuncio, en cada tick: por dónde iba el video si empieza uno. */
export function anotarSinAnuncio(v: HTMLVideoElement) {
  if (!v.paused && !v.seeking) ultimoSinAnuncio = { v, ms: v.currentTime * 1000 };
}

export function empezoAnuncio() {
  if (!entorno?.activo()) return;
  const u = ultimoSinAnuncio;
  // Otro anuncio justo detrás del anterior, sin saber aún qué hacer con aquel: cuentan los dos juntos.
  const t = trasAnuncio && u && trasAnuncio.v === u.v ? trasAnuncio : null;
  alEmpezarAnuncio = u ? { v: u.v, ms: t ? Math.max(u.ms, t.msFin) : u.ms, base: t ? t.base : cuenta.ajuste.correccion, antes: t ? t.avance : 0 } : null;
  trasAnuncio = null;
  registrar('empieza un anuncio', { video: u ? Math.round(u.ms) : null });
}

export function acaboAnuncio(v: HTMLVideoElement | null) {
  if (!entorno?.activo()) return;
  const a = alEmpezarAnuncio;
  alEmpezarAnuncio = null;
  // Solo si es el mismo <video>: un anuncio en otro no mueve el reloj del episodio.
  if (a && v && v === a.v && v === videoReloj) {
    const ms = v.currentTime * 1000;
    trasAnuncio = { v, avance: ms - a.ms + a.antes, msFin: ms, base: a.base, medidas: cuenta.ajuste.medidas };
    registrar('acaba el anuncio', { avance: Math.round(trasAnuncio.avance) });
  } else if (a) {
    registrar('acaba el anuncio, en otro <video>');
  }
  medirDeNuevo();
}

/** Otro episodio: lo medido en el anterior no vale. */
export function reiniciarReloj() {
  cuentas = new WeakMap();
  cuenta = nuevaCuenta();
  sinDescuentos = false;
  ultimaMuestra = null;
  ultimaSesion = undefined;
  ultimoSinAnuncio = null;
  alEmpezarAnuncio = null;
  trasAnuncio = null;
  rafaga = 6;
  publicar();
}

/** Quien mira dice que el ajuste por los anuncios no cuadra: se quita, y en este episodio no se vuelve a poner. */
export function quitarDescuento(): boolean {
  sinDescuentos = true;
  trasAnuncio = null;
  if (!cuenta.descuento) return false;
  registrar('descuento quitado a mano', { descuento: cuenta.descuento });
  cuenta.descuento = 0;
  publicar();
  return true;
}

export type ResultadoSincronia =
  | { tipo: 'medido'; correccionMs: number; cambio: boolean; descuentoMs: number }
  | { tipo: 'en-pausa' }
  | { tipo: 'sin-reloj'; descuentoMs: number };

/**
 * Lo pide quien mira: se mide de nuevo y se dice cómo quedó. Hace falta algo más de un segundo de video en marcha; con
 * el video en pausa, la medida queda pendiente para cuando siga. Siempre se mide: con un descuento por anuncios puesto
 * también, y si su reloj ya cuenta lo que corrió el video, el descuento se va.
 */
export async function sincronizarAhora(enPausa: () => boolean): Promise<ResultadoSincronia> {
  const c = cuenta;
  const antes = total(c);
  const medidas = c.ajuste.medidas;
  medirDeNuevo(8);
  if (enPausa()) return { tipo: 'en-pausa' };
  aMano = true;
  try {
    for (let i = 0; i < 16 && c === cuenta && c.ajuste.medidas === medidas; i++) await new Promise((r) => setTimeout(r, 250));
  } finally {
    aMano = false;
  }
  const midio = c === cuenta && c.ajuste.medidas > medidas;
  registrar('a mano', { midio, ms: total(cuenta), descuento: cuenta.descuento });
  if (!midio) return enPausa() ? { tipo: 'en-pausa' } : { tipo: 'sin-reloj', descuentoMs: cuenta.descuento };
  return { tipo: 'medido', correccionMs: total(c), cambio: total(c) !== antes, descuentoMs: c.descuento };
}
