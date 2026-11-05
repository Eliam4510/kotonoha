// Sincronización de subtítulos: desfase simple o corrección con dos puntos, que también arregla
// las versiones con otra velocidad de fotogramas (subtítulos a 25 fps sobre video a 23,976).

export interface Sincronia {
  desfaseMs: number;
  escala: number;
}

export const SINCRONIA_NEUTRA: Sincronia = { desfaseMs: 0, escala: 1 };

export function aplicarSincronia<T extends { inicio: number; fin: number }>(lineas: T[], s: Sincronia): T[] {
  if (s.desfaseMs === 0 && s.escala === 1) return lineas;
  return lineas.map((l) => ({
    ...l,
    inicio: Math.max(0, Math.round(l.inicio * s.escala + s.desfaseMs)),
    fin: Math.max(0, Math.round(l.fin * s.escala + s.desfaseMs)),
  }));
}

export interface PuntoAncla {
  /** Tiempo original de la línea en el archivo de subtítulos. */
  linea: number;
  /** Momento del video en que realmente se dice. */
  video: number;
}

/** Con un punto se calcula un desfase; con dos, también el ajuste de velocidad. */
export function sincroniaDesdePuntos(puntos: PuntoAncla[]): Sincronia {
  if (!puntos.length) return SINCRONIA_NEUTRA;
  if (puntos.length === 1) return { desfaseMs: Math.round(puntos[0].video - puntos[0].linea), escala: 1 };
  const [a, b] = [puntos[0], puntos[puntos.length - 1]];
  const delta = b.linea - a.linea;
  // Con puntos casi iguales la escala se dispararía: se usa solo el desfase del último.
  if (Math.abs(delta) < 5000) return { desfaseMs: Math.round(b.video - b.linea), escala: 1 };
  const escala = (b.video - a.video) / delta;
  // Una escala fuera de este rango casi seguro es un error al marcar las líneas.
  if (escala < 0.8 || escala > 1.25) return { desfaseMs: Math.round(b.video - b.linea), escala: 1 };
  return { desfaseMs: Math.round(a.video - a.linea * escala), escala };
}

export function describirSincronia(s: Sincronia): string {
  const partes = [`${s.desfaseMs >= 0 ? '+' : ''}${(s.desfaseMs / 1000).toFixed(2)} s`];
  if (s.escala !== 1) partes.push(`velocidad ×${s.escala.toFixed(4)}`);
  return partes.join(', ');
}
