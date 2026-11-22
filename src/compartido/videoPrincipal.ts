// Qué <video> de la página es el que se ve. Lo usan las dos partes de la extensión que trabajan en la página: la que
// pinta los subtítulos lo elige y lo marca, y la que corre junto al reproductor del sitio sigue la marca. Así un salto,
// una pausa o el reloj de Netflix van siempre al mismo elemento que los subtítulos.

/** El atributo con el que se marca el elegido. */
export const MARCA_VIDEO = 'data-kotonoha-video';

export interface Candidato<T> {
  x: T;
  /** Lo que ocupa en pantalla, en px². */
  area: number;
  /** En marcha y con imagen: ni en pausa, ni acabado, ni vacío. */
  enMarcha: boolean;
}

/**
 * El principal entre los visibles. Solo cuentan los grandes, de al menos la mitad del mayor: una miniatura que se
 * reproduce sola no le quita el sitio. Entre ellos, mejor uno en marcha: un anuncio que acabó puede dejar su <video> en
 * pausa, del mismo tamaño y antes en la página. Entre los que quedan, el de antes, para que una pausa no lo cambie; y si
 * no, el mayor, y entre iguales el primero.
 */
export function elegirPrincipal<T>(candidatos: Candidato<T>[], previo: T | null): T | null {
  const max = Math.max(0, ...candidatos.map((c) => c.area));
  if (max <= 0) return null;
  const grandes = candidatos.filter((c) => c.area >= max / 2);
  const enMarcha = grandes.filter((c) => c.enMarcha);
  const grupo = enMarcha.length ? enMarcha : grandes;
  if (previo !== null && grupo.some((c) => c.x === previo)) return previo;
  return grupo.reduce((a, b) => (b.area > a.area ? b : a)).x;
}

/** El principal de los <video> de la página; `previo`, el que se eligió la última vez. */
export function elegirVideo(previo: HTMLVideoElement | null): HTMLVideoElement | null {
  const candidatos: Candidato<HTMLVideoElement>[] = [];
  for (const v of document.querySelectorAll('video')) {
    const r = v.getBoundingClientRect();
    const area = r.width * r.height;
    if (area > 0) candidatos.push({ x: v, area, enMarcha: !v.paused && !v.ended && v.readyState >= 2 });
  }
  return elegirPrincipal(candidatos, previo);
}
