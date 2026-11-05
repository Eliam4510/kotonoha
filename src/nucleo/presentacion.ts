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

const ALTO_ACTIVACION = 14;
const MARGEN_ACTIVACION = 80;
const MARGEN_LADOS = 72;
const MARGEN_ABAJO = 72;

/** Lo que tarda en aparecer: pasar de largo por arriba, camino de otra cosa, no la despierta. */
export const ESPERA_MOSTRAR_MS = 110;
/** Lo que aguanta tras salir de su zona: da tiempo a volver sin que se esconda. */
export const ESPERA_OCULTAR_MS = 650;

export const enZonaActivacion = (x: number, y: number, c: CajaBarra) => y <= ALTO_ACTIVACION && x >= c.izq - MARGEN_ACTIVACION && x <= c.der + MARGEN_ACTIVACION;

export const enZonaSegura = (x: number, y: number, c: CajaBarra) => y <= c.abajo + MARGEN_ABAJO && x >= c.izq - MARGEN_LADOS && x <= c.der + MARGEN_LADOS;

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
