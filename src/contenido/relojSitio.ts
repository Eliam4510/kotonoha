// El reloj del episodio en Netflix. Tras un anuncio del medio, al pasar solo al siguiente episodio o tras algunos saltos,
// el <video> sigue su propia cuenta, y los subtítulos, que van por el tiempo del episodio, saldrían adelantados o
// atrasados hasta recargar la página. Su reproductor sí sabe en qué momento del episodio está: se comparan los dos una
// vez por segundo con el video en marcha, y en ráfaga tras un salto, al acabar un anuncio, en un episodio nuevo o al
// pedirlo a mano. Si tras un anuncio el reloj de Netflix no lo descuenta, se corrige por lo que corrió el video durante
// el anuncio. En los demás sitios, y si no hay nada que medir, todo sigue por el <video>.

import { signal } from '@preact/signals';
import { AjusteReloj, correccionTrasAnuncio, type MuestraReloj } from '../nucleo/reloj';

const ajuste = new AjusteReloj();

/** Para el panel: si ya se midió, cuánto se corrige el <video> y si es por los anuncios, sin el reloj de Netflix. */
export const estadoReloj = signal({ medido: false, correccionMs: 0, porAnuncios: false });

/** El momento del episodio, en ms: el del <video>, con la corrección. */
export const momentoDelVideo = (v: HTMLVideoElement) => v.currentTime * 1000 + ajuste.correccion;

/**
 * Lo que hay que restar al momento del episodio para saltar a él. Si el reloj de Netflix descuenta los anuncios, su seek
 * va por el episodio y no se resta nada; si no los descuenta, su seek va por el video, como su reloj.
 */
export const desfaseDeSaltos = () => (porAnuncios ? ajuste.correccion : 0);

export interface EntornoReloj {
  /** El momento del <video> y el del reproductor, tomados a la vez; null si ahora no se puede (pausa, salto, otro sitio). */
  tomar: () => Promise<MuestraReloj | null>;
  /** Si ahora tiene sentido medir: en Netflix, con un video en marcha y sin anuncio. */
  medible: () => boolean;
  /** La corrección cambió sola, sin pedirlo nadie. */
  alCambiar: (correccionMs: number) => void;
}

let entorno: EntornoReloj | null = null;
let rafaga = 0;
let vuelta = 0;
let ocupado = false;
/** Mientras se mide porque alguien lo pidió: el resultado lo da quien lo pidió, y no además el aviso automático. */
let aMano = false;
/** El reloj de Netflix no descuenta los anuncios: la corrección sale de lo que corre el video durante ellos. */
let porAnuncios = false;
/** El último momento del <video> con el episodio en marcha y sin anuncio. */
let ultimoSinAnuncio: { v: HTMLVideoElement; ms: number } | null = null;
/** Cómo estaba todo al empezar el anuncio en curso. */
let alEmpezarAnuncio: { v: HTMLVideoElement; ms: number; correccion: number } | null = null;
/** Un anuncio que acaba de terminar: falta saber si el reloj de Netflix lo descontó. */
let trasAnuncio: { v: HTMLVideoElement; avance: number; msFin: number; correccion: number; medidas: number } | null = null;

function publicar() {
  const e = estadoReloj.value;
  if (e.medido !== ajuste.medido || e.correccionMs !== ajuste.correccion || e.porAnuncios !== porAnuncios) {
    estadoReloj.value = { medido: ajuste.medido, correccionMs: ajuste.correccion, porAnuncios };
  }
}

/**
 * Tras un anuncio, en cuanto el reloj de Netflix dio su medida, o tras dos segundos y medio de video sin ella: si no
 * descontó el anuncio, se corrige por lo que corrió el video mientras duraba.
 */
function revisarTrasAnuncio() {
  const t = trasAnuncio;
  if (!t || !entorno) return;
  const midio = !porAnuncios && ajuste.medidas > t.medidas;
  if (!midio && t.v.currentTime * 1000 - t.msFin < 2500) return;
  trasAnuncio = null;
  const nueva = correccionTrasAnuncio({ avance: t.avance, correccionAntes: t.correccion }, { midio, correccion: ajuste.correccion });
  if (nueva === null || nueva === ajuste.correccion) return;
  porAnuncios = true;
  ajuste.fijar(nueva);
  if (!aMano) entorno.alCambiar(nueva);
  publicar();
}

/** Cada 250 ms: en ráfaga, una muestra cada vez; si no, una por segundo. */
async function muestrear() {
  if (!entorno || ocupado) return;
  vuelta++;
  revisarTrasAnuncio();
  // Sin el reloj de Netflix para los anuncios, su medida diría que no hay nada que corregir.
  if (porAnuncios) return;
  if (rafaga <= 0 && vuelta % 4) return;
  if (!entorno.medible()) return;
  ocupado = true;
  try {
    const m = await entorno.tomar().catch(() => null);
    if (!m) return;
    if (rafaga > 0) rafaga--;
    if (ajuste.anotar(m) && !aMano) entorno.alCambiar(ajuste.correccion);
    publicar();
  } finally {
    ocupado = false;
  }
}

export function iniciarRelojSitio(e: EntornoReloj) {
  entorno = e;
  setInterval(() => void muestrear(), 250);
}

/** Tras un salto, al acabar un anuncio o al volver a reproducir: se mide de nuevo enseguida. */
export function medirDeNuevo(muestras = 6) {
  ajuste.olvidarMuestras();
  rafaga = Math.max(rafaga, muestras);
}

/** Con el episodio en marcha y sin anuncio, en cada tick: por dónde iba el video si empieza uno. */
export function anotarSinAnuncio(v: HTMLVideoElement) {
  if (!v.paused && !v.seeking) ultimoSinAnuncio = { v, ms: v.currentTime * 1000 };
}

export function empezoAnuncio() {
  alEmpezarAnuncio = ultimoSinAnuncio ? { ...ultimoSinAnuncio, correccion: ajuste.correccion } : null;
  trasAnuncio = null;
}

export function acaboAnuncio(v: HTMLVideoElement | null) {
  const a = alEmpezarAnuncio;
  alEmpezarAnuncio = null;
  // Solo si es el mismo <video>: un anuncio en otro no mueve el reloj del episodio.
  if (a && v === a.v) {
    const ms = v.currentTime * 1000;
    trasAnuncio = { v, avance: ms - a.ms, msFin: ms, correccion: a.correccion, medidas: ajuste.medidas };
  }
  medirDeNuevo();
}

/** Otro episodio: lo medido en el anterior no vale. */
export function reiniciarReloj() {
  ajuste.reiniciar();
  porAnuncios = false;
  ultimoSinAnuncio = null;
  alEmpezarAnuncio = null;
  trasAnuncio = null;
  rafaga = 6;
  publicar();
}

export type ResultadoSincronia = { tipo: 'medido'; correccionMs: number; cambio: boolean } | { tipo: 'en-pausa' } | { tipo: 'sin-reloj' };

/**
 * Lo pide quien mira: se mide de nuevo y se dice cómo quedó. Hace falta algo más de un segundo de video en marcha; con
 * el video en pausa, la medida queda pendiente para cuando siga. Con la corrección por los anuncios no hay nada que
 * medir: el reloj de Netflix no los ve.
 */
export async function sincronizarAhora(enPausa: () => boolean): Promise<ResultadoSincronia> {
  if (porAnuncios) return { tipo: 'medido', correccionMs: ajuste.correccion, cambio: false };
  const antes = ajuste.correccion;
  const medidas = ajuste.medidas;
  medirDeNuevo(8);
  if (enPausa()) return { tipo: 'en-pausa' };
  aMano = true;
  try {
    for (let i = 0; i < 16 && ajuste.medidas === medidas && !porAnuncios; i++) await new Promise((r) => setTimeout(r, 250));
  } finally {
    aMano = false;
  }
  if (ajuste.medidas === medidas && !porAnuncios) return enPausa() ? { tipo: 'en-pausa' } : { tipo: 'sin-reloj' };
  return { tipo: 'medido', correccionMs: ajuste.correccion, cambio: ajuste.correccion !== antes };
}
