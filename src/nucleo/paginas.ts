// Las cuentas del visor que no dependen de la pantalla: qué páginas se ven juntas y a qué zoom se pasa.

/** Las páginas que se ven juntas. En doble página, con la portada sola, las parejas quedan como en el libro impreso. */
export function pliegos(total: number, doble: boolean, portadaSola: boolean): number[][] {
  if (!doble) return Array.from({ length: total }, (_, i) => [i]);
  const salida: number[][] = [];
  let i = 0;
  if (portadaSola && total > 0) {
    salida.push([0]);
    i = 1;
  }
  for (; i < total; i += 2) salida.push(i + 1 < total ? [i, i + 1] : [i]);
  return salida;
}

/** El pliego donde está una página. */
export const pliegoDe = (lista: number[][], pagina: number) => Math.max(0, lista.findIndex((p) => p.includes(pagina)));

export const PASOS_ZOOM = [25, 33, 50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200, 250, 300, 400];

/** El siguiente paso de zoom desde el porcentaje real, que en «ajustar» no es un número redondo. */
export function pasoDeZoom(actual: number, haciaArriba: boolean): number {
  if (haciaArriba) return PASOS_ZOOM.find((p) => p > actual + 0.5) ?? PASOS_ZOOM[PASOS_ZOOM.length - 1];
  return [...PASOS_ZOOM].reverse().find((p) => p < actual - 0.5) ?? PASOS_ZOOM[0];
}

export interface Medida {
  ancho: number;
  alto: number;
}

/**
 * La escala de un pliego: cuántos píxeles de pantalla por píxel de la página. «pagina» la hace caber entera; «ancho»
 * llena el ancho y deja bajar; un número es un porcentaje del tamaño natural.
 */
export function escalaDe(paginas: Medida[], hueco: Medida, zoom: 'ancho' | 'pagina' | number, separacion = 0): number {
  if (typeof zoom === 'number') return zoom / 100;
  const ancho = paginas.reduce((s, p) => s + p.ancho, 0);
  const alto = Math.max(...paginas.map((p) => p.alto));
  if (!ancho || !alto) return 1;
  const porAncho = (hueco.ancho - separacion * (paginas.length - 1)) / ancho;
  return zoom === 'ancho' ? porAncho : Math.min(porAncho, hueco.alto / alto);
}
