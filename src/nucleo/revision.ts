// La revisión con Claude del texto de una página: lo que se le manda, qué de su respuesta vale y en qué se diferencia
// cada línea de lo que propone, para enseñarlo letra a letra antes de aplicarlo. Sin navegador, para poder probarlo.

export interface CambioPropuesto {
  /** La línea de la página, en el orden en que se le mandaron. */
  indice: number;
  antes: string;
  despues: string;
}

/** El mensaje con el texto de la página: título, número de página y las líneas numeradas desde 0. */
export function mensajeRevision(o: { titulo?: string; pagina: number; globos: boolean; lineas: string[] }): string {
  const cuerpo = o.lineas.map((t, i) => `${i}: ${t.replace(/\s*\n\s*/g, ' ')}`).join('\n');
  return [
    o.titulo ? `Título: ${o.titulo}` : '',
    `Página ${o.pagina + 1}`,
    `${o.globos ? 'Globos de texto leídos por el OCR, uno por número' : 'Renglones leídos por el OCR, en el orden de lectura'}:\n${cuerpo}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Lo que de verdad cambia de lo que propone Claude: números que existen, texto de una sola línea, no vacío y distinto del
 * que había. Si una línea viene dos veces, vale la última.
 */
export function cambiosValidos(lineas: string[], cambios: { i: number; t: string }[] | null | undefined): CambioPropuesto[] {
  const porLinea = new Map<number, string>();
  for (const c of cambios ?? []) {
    if (!Number.isInteger(c?.i) || c.i < 0 || c.i >= lineas.length || typeof c.t !== 'string') continue;
    const t = c.t.replace(/\s*\n\s*/g, '').trim();
    if (!t || t === lineas[c.i].trim()) porLinea.delete(c.i);
    else porLinea.set(c.i, t);
  }
  return [...porLinea].sort((a, b) => a[0] - b[0]).map(([indice, despues]) => ({ indice, antes: lineas[indice], despues }));
}

export interface TrozoDiferencia {
  tipo: 'igual' | 'quitado' | 'puesto';
  texto: string;
}

/** Más que esto (letras de una por letras de la otra) ya no es una línea: se enseña entera, quitada y puesta. */
const LIMITE_DIFERENCIAS = 200_000;

/** En qué se diferencian dos textos, letra a letra: lo que se queda, lo que se quita y lo que se pone. */
export function diferencias(a: string, b: string): TrozoDiferencia[] {
  const x = [...a];
  const y = [...b];
  const n = x.length;
  const m = y.length;
  if (n * m > LIMITE_DIFERENCIAS) {
    return [...(a ? [{ tipo: 'quitado' as const, texto: a }] : []), ...(b ? [{ tipo: 'puesto' as const, texto: b }] : [])];
  }
  // La subsecuencia común más larga, desde el final: t[i][j] es la de x desde i y y desde j.
  const t = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) t[i][j] = x[i] === y[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
  }
  const salida: TrozoDiferencia[] = [];
  const poner = (tipo: TrozoDiferencia['tipo'], c: string) => {
    const u = salida[salida.length - 1];
    if (u?.tipo === tipo) u.texto += c;
    else salida.push({ tipo, texto: c });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) {
      poner('igual', x[i]);
      i++;
      j++;
    } else if (t[i + 1][j] >= t[i][j + 1]) poner('quitado', x[i++]);
    else poner('puesto', y[j++]);
  }
  while (i < n) poner('quitado', x[i++]);
  while (j < m) poner('puesto', y[j++]);
  return salida;
}
