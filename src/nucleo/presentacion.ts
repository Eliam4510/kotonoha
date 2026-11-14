// Geometría de lo que flota sobre el video: cuándo aparece la barra y dónde van los subtítulos.
// Se calcula aparte de la interfaz porque lo que importa es cómo se siente, y eso se puede probar.

// ---------- Barra superior ----------
//
// La barra se mueve al aparecer. Si se decidiera con los eventos de entrada y salida de la propia barra,
// su zona sensible se movería con ella y escaparía del puntero: de ahí el «sube y baja». Por eso la
// decisión usa rectángulos fijos, con margen, y esperas que distinguen la intención de un roce.

export interface CajaBarra {
  izq: number;
  der: number;
  abajo: number;
}

/** El video en la ventana: sus lados y su borde de arriba. */
export interface BordeVideo {
  izq: number;
  der: number;
  arriba: number;
}

const ALTO_ACTIVACION = 14;
const MARGEN_ACTIVACION = 80;
/** Más ancho que el de activación: si no, la barra podía despertar a un lado y esconderse sin que el ratón se moviera. */
const MARGEN_LADOS = 88;
const MARGEN_ABAJO = 72;

/**
 * En una ventana, lo alto suele ser la cabecera del sitio (la de YouTube mide 56 px) y el ratón, al subir, se salta la
 * franja de arriba y acaba en las pestañas del navegador. Por eso también vale detenerse en el borde de arriba del
 * video, si empieza cerca de lo alto: un poco por encima y un poco por dentro.
 */
const VIDEO_CERCA_DE_ARRIBA = 160;
const BANDA_ENCIMA = 12;
const BANDA_DENTRO = 30;

/** Lo que tarda en aparecer: pasar de largo por arriba, camino de otra cosa, no la despierta. */
export const ESPERA_MOSTRAR_MS = 110;
/** Lo que aguanta tras salir de su zona: da tiempo a volver sin que se esconda. */
export const ESPERA_OCULTAR_MS = 650;

/** La franja del borde de arriba del video, si cuenta: no cuando el video ya empieza arriba del todo, ni lejos de lo alto. */
function bandaDelVideo(v?: BordeVideo | null): { arriba: number; abajo: number } | null {
  if (!v || v.arriba <= ALTO_ACTIVACION || v.arriba > VIDEO_CERCA_DE_ARRIBA) return null;
  return { arriba: v.arriba - BANDA_ENCIMA, abajo: v.arriba + BANDA_DENTRO };
}

export function enZonaActivacion(x: number, y: number, c: CajaBarra, v?: BordeVideo | null): boolean {
  if (x < c.izq - MARGEN_ACTIVACION || x > c.der + MARGEN_ACTIVACION) return false;
  if (y <= ALTO_ACTIVACION) return true;
  const b = bandaDelVideo(v);
  return !!b && y >= b.arriba && y <= b.abajo && x >= v!.izq && x <= v!.der;
}

/** Contiene siempre a la de activación: nunca se muestra para esconderse al instante. */
export const enZonaSegura = (x: number, y: number, c: CajaBarra, v?: BordeVideo | null) =>
  y <= Math.max(c.abajo + MARGEN_ABAJO, bandaDelVideo(v)?.abajo ?? 0) && x >= c.izq - MARGEN_LADOS && x <= c.der + MARGEN_LADOS;

// ---------- Subtítulos ----------

/** Centro horizontal y borde inferior, medido desde abajo, como fracciones del video. */
export interface PosicionSubs {
  x: number;
  y: number;
}

export interface CajaSubs {
  /** Zona disponible: el video. */
  W: number;
  H: number;
  /** El bloque de subtítulos. */
  w: number;
  h: number;
}

const IMAN_PX = 16;
const limitar = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export const posicionInicial = (H: number): PosicionSubs => ({ x: 0.5, y: Math.max(36, H * 0.08) / Math.max(H, 1) });

/** Dónde pintar el bloque. Nunca se sale del video, aunque cambie de tamaño o llegue una línea larga. */
export function pixelesDe(p: PosicionSubs, c: CajaSubs): { left: number; top: number } {
  const left = limitar(p.x * c.W - c.w / 2, 0, Math.max(0, c.W - c.w));
  const abajo = limitar(p.y * c.H, 0, Math.max(0, c.H - c.h));
  return { left, top: c.H - abajo - c.h };
}

export function posicionDesde(left: number, top: number, c: CajaSubs): PosicionSubs {
  return { x: (left + c.w / 2) / Math.max(c.W, 1), y: (c.H - top - c.h) / Math.max(c.H, 1) };
}

/** Durante el arrastre, el centro y la altura de siempre atraen un poco: volver al sitio es fácil. */
export function conImanes(left: number, top: number, c: CajaSubs): { left: number; top: number; centrado: boolean; enBase: boolean } {
  const izq = limitar(left, 0, Math.max(0, c.W - c.w));
  const arriba = limitar(top, 0, Math.max(0, c.H - c.h));
  const centrado = Math.abs(izq + c.w / 2 - c.W / 2) <= IMAN_PX;
  const base = posicionInicial(c.H).y * c.H;
  const enBase = Math.abs(c.H - arriba - c.h - base) <= IMAN_PX;
  return { left: centrado ? (c.W - c.w) / 2 : izq, top: enBase ? c.H - base - c.h : arriba, centrado, enBase };
}

/** Un párrafo enorme no debe tapar el video: cuanto más largo, algo más pequeña la letra. */
export function factorLargo(caracteres: number, comodos = 42, minimo = 0.6): number {
  if (caracteres <= comodos) return 1;
  return Math.max(minimo, Math.sqrt(comodos / caracteres));
}
