// El momento del episodio cuando el <video> y el reproductor del sitio no cuentan igual. En Netflix, tras un anuncio,
// al pasar solo al siguiente episodio o tras algunos saltos, video.currentTime sigue su propia cuenta y los subtítulos,
// que van por el tiempo del episodio, llegarían adelantados o atrasados hasta recargar la página. El reproductor de
// Netflix sí sabe en qué momento del episodio está: se compara con el <video> en muestras tomadas a la vez y, si la
// diferencia es clara y se mantiene mientras el video avanza, se corrige.

export interface MuestraReloj {
  /** video.currentTime, en ms. */
  video: number;
  /** El momento del episodio según el reproductor del sitio, en ms. */
  jugador: number;
}

/**
 * Por debajo de esto no se corrige: el reproductor puede ir unas décimas por detrás del video sin que se note, y
 * entonces todo sigue como siempre.
 */
export const UMBRAL_MS = 1000;
/** Con una corrección puesta, se quita solo por debajo de esto: una diferencia en torno al umbral no la hace parpadear. */
const UMBRAL_QUITAR_MS = 600;
/** Cuánto pueden separarse de la mediana las muestras que se dan por buenas. */
const TOLERANCIA_MS = 250;
/**
 * Las muestras que coinciden deben cubrir al menos esto del video. Con el video parado cualquier cuenta parece cuadrar,
 * y un reproductor que contara en otra unidad (segundos) no coincide a lo largo de casi un segundo de video.
 */
const TRAMO_MS = 900;
/** Una corrección nueva que se parece a la que hay no la cambia: unas décimas de vaivén no mueven los subtítulos. */
const HISTERESIS_MS = 300;
const GUARDADAS = 6;
const MINIMO = 3;

/** Un anuncio más corto que esto no se tiene en cuenta: con el video casi quieto no hay nada que corregir. */
export const ANUNCIO_MINIMO_MS = 3000;

/**
 * Tras un anuncio del medio: lo normal es que el reloj del sitio lo descuente, y entonces manda su medida. Si no lo
 * descontó (su corrección no se movió aunque el video corrió varios segundos durante el anuncio) o no dio ninguna, el
 * video va por delante justo lo que corrió durante el anuncio. Devuelve la corrección nueva, o null si manda el reloj.
 */
export function correccionTrasAnuncio(
  anuncio: { avance: number; correccionAntes: number },
  despues: { midio: boolean; correccion: number }
): number | null {
  if (anuncio.avance < ANUNCIO_MINIMO_MS) return null;
  if (despues.midio && Math.abs(despues.correccion - anuncio.correccionAntes) >= UMBRAL_MS) return null;
  return Math.round(anuncio.correccionAntes - anuncio.avance);
}

function mediana(xs: number[]): number {
  const o = [...xs].sort((a, b) => a - b);
  const m = o.length >> 1;
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

export class AjusteReloj {
  private muestras: MuestraReloj[] = [];
  /** Lo que se suma a video.currentTime (en ms) para tener el momento del episodio. */
  correccion = 0;
  /** Si alguna vez se pudo comparar: un reproductor que no da su momento deja todo como estaba. */
  medido = false;
  /** Cuántas veces se llegó a una medida: así se sabe si una medida pedida a mano salió, aunque no cambie nada. */
  medidas = 0;

  /** Una muestra nueva, tomada con el video en marcha. Devuelve true si la corrección cambió. */
  anotar(m: MuestraReloj): boolean {
    if (!Number.isFinite(m.video) || !Number.isFinite(m.jugador) || m.video < 0 || m.jugador < 0) return false;
    const ultima = this.muestras.at(-1);
    // El video volvió atrás (un salto o un episodio nuevo): lo anterior ya no sirve.
    if (ultima && m.video < ultima.video - 50) this.muestras = [];
    // El video no avanzó desde la anterior: no dice nada nuevo.
    else if (ultima && m.video - ultima.video < 1) return false;
    this.muestras.push(m);
    if (this.muestras.length > GUARDADAS) this.muestras.shift();
    return this.recalcular();
  }

  private recalcular(): boolean {
    if (this.muestras.length < MINIMO) return false;
    const med = mediana(this.muestras.map((m) => m.jugador - m.video));
    const deAcuerdo = this.muestras.filter((m) => Math.abs(m.jugador - m.video - med) <= TOLERANCIA_MS);
    if (deAcuerdo.length < MINIMO || deAcuerdo[deAcuerdo.length - 1].video - deAcuerdo[0].video < TRAMO_MS) return false;
    this.medido = true;
    this.medidas++;
    const umbral = this.correccion ? UMBRAL_QUITAR_MS : UMBRAL_MS;
    const nueva = Math.abs(med) >= umbral ? Math.round(med) : 0;
    if (nueva === this.correccion) return false;
    if (nueva && this.correccion && Math.abs(nueva - this.correccion) < HISTERESIS_MS) return false;
    this.correccion = nueva;
    return true;
  }

  /** Tras un salto, un anuncio o al pedirlo a mano: lo medido antes ya no vale, y la corrección sigue hasta tener otra. */
  olvidarMuestras() {
    this.muestras = [];
  }

  /** Una corrección que no sale del reloj del sitio, sino de lo que duró un anuncio (ver correccionTrasAnuncio). */
  fijar(correccion: number) {
    this.muestras = [];
    this.correccion = Math.round(correccion);
    this.medido = true;
  }

  /** Otro episodio: se empieza de cero. */
  reiniciar() {
    this.muestras = [];
    this.correccion = 0;
    this.medido = false;
  }
}
