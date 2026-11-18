// Dónde va la ventana de lo que se toca en una página, sin navegador. La regla es no tapar lo que queda por leer. Si junto
// a la hoja hay sitio, va ahí, a la altura de lo elegido, y no tapa nada. Si no, encima de lo ya leído: sobre el renglón
// en horizontal, que se lee hacia abajo, y a la derecha de la columna en vertical, que se lee hacia la izquierda.

/** Un rectángulo de la pantalla, en píxeles. */
export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Colocacion {
  left: number;
  /** El ancho con que queda: al margen de la hoja puede estrecharse para caber. */
  ancho: number;
  /** La distancia desde arriba; o desde abajo, cuando la ventana va encima de lo elegido y crece hacia arriba. */
  top?: number;
  bottom?: number;
  /** Lo más alta que puede ser sin salirse de su sitio. */
  maxAlto: number;
  lado: 'margen-derecho' | 'margen-izquierdo' | 'encima' | 'debajo' | 'derecha' | 'izquierda';
}

/** Lo que se deja libre hasta el borde de la zona. */
const MARGEN = 12;
/** Lo que se separa la ventana de la hoja o de lo elegido. */
const SEPARACION = 10;
/** Por debajo de esto, encima no cabe una ventana útil: va debajo si allí hay más sitio. */
const ALTO_UTIL = 260;
/** Lo mínimo que se le deja de alto: menos, y no se leería nada. */
const ALTO_MINIMO = 140;
/**
 * Lo más estrecha que puede quedar al margen de la hoja: la ficha cabe en su forma compacta. Junto a un libro A5 en una
 * pantalla de 1280 píxeles quedan unos 310.
 */
const ANCHO_MINIMO = 300;

/**
 * La colocación de una ventana de `ancho` píxeles y `alto` deseado. `ancla` es lo elegido; `hoja`, la página donde está;
 * `zona`, el hueco de las páginas en la pantalla, y `vista`, el tamaño de la ventana del navegador.
 */
export function colocarVentana(o: { ancla: Rect; hoja: Rect | null; zona: Rect; vista: { ancho: number; alto: number }; ancho: number; alto: number; vertical: boolean }): Colocacion {
  const { ancla, hoja, zona, vista, ancho, alto } = o;
  const derechaZona = zona.left + zona.width;
  const abajoZona = zona.top + zona.height;
  const altoDisponible = Math.max(ALTO_MINIMO, zona.height - 2 * MARGEN);
  /** Arriba a la altura pedida, sin que la ventana se salga por abajo. */
  const arribaEn = (y: number) => Math.max(zona.top + MARGEN, Math.min(y, abajoZona - MARGEN - Math.min(alto, altoDisponible)));
  /**
   * Lo que puede crecer desde arriba sin pasar del borde de abajo de la zona: con una ficha larga, la ventana crece más que
   * el alto supuesto y tapaba la barra de estado.
   */
  const hastaAbajo = (top: number) => Math.max(ALTO_MINIMO, abajoZona - MARGEN - top);
  const dentroX = (x: number) => Math.max(zona.left + MARGEN, Math.min(x, derechaZona - MARGEN - ancho));

  // Al margen, la ventana se estrecha lo que haga falta para caber, hasta un mínimo: no tapar nada vale más que el ancho.
  const minimo = Math.min(ancho, ANCHO_MINIMO);
  if (hoja) {
    const libreDerecha = derechaZona - (hoja.left + hoja.width) - SEPARACION - MARGEN;
    const libreIzquierda = hoja.left - zona.left - SEPARACION - MARGEN;
    if (libreDerecha >= minimo || libreIzquierda >= minimo) {
      // Siempre en el mismo lado, la derecha, salvo que allí no quepa y a la izquierda sí, o que solo a la izquierda quepa
      // entera: que no salte de un margen al otro por unos píxeles.
      const derecha = libreDerecha >= ancho || (libreDerecha >= minimo && libreIzquierda < ancho);
      const cabe = Math.min(ancho, derecha ? libreDerecha : libreIzquierda);
      const top = arribaEn(ancla.top - 8);
      return {
        left: derecha ? hoja.left + hoja.width + SEPARACION : hoja.left - SEPARACION - cabe,
        ancho: cabe,
        top,
        maxAlto: hastaAbajo(top),
        lado: derecha ? 'margen-derecho' : 'margen-izquierdo',
      };
    }
  }

  if (o.vertical) {
    const libreDerecha = derechaZona - (ancla.left + ancla.width) - SEPARACION - MARGEN;
    const libreIzquierda = ancla.left - zona.left - SEPARACION - MARGEN;
    // A la derecha, sobre lo ya leído, si allí cabe aunque sea estrecha; si no, donde haya más sitio. Y estrecha lo justo
    // para no tapar la columna misma, que es lo que se está leyendo.
    const derecha = libreDerecha >= minimo || libreDerecha >= libreIzquierda;
    const libre = derecha ? libreDerecha : libreIzquierda;
    const cabe = libre >= minimo ? Math.min(ancho, libre) : ancho;
    const dentro = (x: number) => Math.max(zona.left + MARGEN, Math.min(x, derechaZona - MARGEN - cabe));
    const top = arribaEn(ancla.top);
    return {
      left: dentro(derecha ? ancla.left + ancla.width + SEPARACION : ancla.left - SEPARACION - cabe),
      ancho: cabe,
      top,
      maxAlto: hastaAbajo(top),
      lado: derecha ? 'derecha' : 'izquierda',
    };
  }

  const espacioArriba = ancla.top - zona.top - SEPARACION - MARGEN;
  const espacioAbajo = abajoZona - (ancla.top + ancla.height) - SEPARACION - MARGEN;
  const encima = espacioArriba >= Math.min(alto, ALTO_UTIL) || espacioArriba >= espacioAbajo;
  const left = dentroX(ancla.left + ancla.width / 2 - ancho / 2);
  return encima
    ? { left, ancho, bottom: vista.alto - (ancla.top - SEPARACION), maxAlto: Math.max(ALTO_MINIMO, espacioArriba), lado: 'encima' }
    : { left, ancho, top: ancla.top + ancla.height + SEPARACION, maxAlto: Math.max(ALTO_MINIMO, espacioAbajo), lado: 'debajo' };
}
