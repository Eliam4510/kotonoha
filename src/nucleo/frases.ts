// Clasificación de frases y estadísticas de comprensión. Lógica pura.

import type { ObjetivoFrase } from '../compartido/ajustes';
import type { LineaAnalizada, PalabraToken } from '../compartido/tipos';

export type NivelComprension = 'excepcional' | 'excelente' | 'genial' | 'buena' | 'asequible' | 'dificil' | 'ambiciosa';

export const NOMBRES_NIVEL: Record<NivelComprension, string> = {
  excepcional: 'Excepcional',
  excelente: 'Excelente',
  genial: 'Muy buena',
  buena: 'Buena',
  asequible: 'Asequible',
  dificil: 'Difícil',
  ambiciosa: 'Ambiciosa',
};

export interface OpcionesFrase {
  frecuenciaMaxima: number;
}

const palabrasReales = (p: PalabraToken[]) => p.filter((x) => x.esPalabra);

export function desconocidas(p: PalabraToken[]): PalabraToken[] {
  return palabrasReales(p).filter((x) => x.estado === 'desconocida');
}

/** Frase ideal para minar: longitud razonable y una sola palabra nueva, y de las frecuentes. */
export function esRecomendada(p: PalabraToken[], o: OpcionesFrase): boolean {
  const reales = palabrasReales(p);
  if (reales.length < 3 || reales.length > 22) return false;
  const d = desconocidas(p);
  if (d.length !== 1) return false;
  return d[0].rango === undefined || d[0].rango <= o.frecuenciaMaxima;
}

export function clasificarFrase(p: PalabraToken[], o: OpcionesFrase): Set<ObjetivoFrase> {
  const c = new Set<ObjetivoFrase>(['todas']);
  const reales = palabrasReales(p);
  if (!reales.length) return c;
  const n = desconocidas(p).length;
  if (n === 0) c.add('conocidas');
  if (n >= 1) c.add('desconocidas');
  if (n === 1) c.add('1d');
  if (n >= 2) c.add('2mas');
  if (reales.some((x) => x.rastreada)) c.add('rastreadas');
  if (reales.some((x) => x.estado === 'aprendiendo')) c.add('aprendiendo');
  if (esRecomendada(p, o)) c.add('recomendadas');
  return c;
}

export interface Estadisticas {
  comprension: number; // 0 a 100
  nivel: NivelComprension;
  recomendadas: number;
  unicas: { conocidas: number; desconocidas: number; ignoradas: number };
  frases: { conocidas: number; unaDesconocida: number; variasDesconocidas: number };
  frecuenciaMedia?: number;
}

export function nivelDe(c: number): NivelComprension {
  if (c >= 98) return 'excepcional';
  if (c >= 95) return 'excelente';
  if (c >= 90) return 'genial';
  if (c >= 80) return 'buena';
  if (c >= 70) return 'asequible';
  if (c >= 50) return 'dificil';
  return 'ambiciosa';
}

export function calcularEstadisticas(lineas: LineaAnalizada[], o: OpcionesFrase): Estadisticas {
  const conocidas = new Set<string>();
  const nuevas = new Set<string>();
  const ignoradas = new Set<string>();
  let totalTokens = 0;
  let tokensConocidos = 0;
  let frasesConocidas = 0;
  let unaDesconocida = 0;
  let varias = 0;
  let recomendadas = 0;
  let sumaRango = 0;
  let conRango = 0;

  for (const l of lineas) {
    const reales = palabrasReales(l.palabras);
    if (!reales.length) continue;
    let n = 0;
    for (const p of reales) {
      if (p.estado === 'ignorada') {
        ignoradas.add(p.clave);
        continue;
      }
      totalTokens++;
      if (p.estado === 'desconocida') {
        n++;
        nuevas.add(p.clave);
      } else {
        tokensConocidos++;
        conocidas.add(p.clave);
      }
    }
    if (n === 0) frasesConocidas++;
    else if (n === 1) unaDesconocida++;
    else varias++;
    if (esRecomendada(l.palabras, o)) {
      recomendadas++;
      const r = desconocidas(l.palabras)[0]?.rango;
      if (r !== undefined) {
        sumaRango += r;
        conRango++;
      }
    }
  }

  const comprension = totalTokens ? Math.round((tokensConocidos / totalTokens) * 100) : 0;
  return {
    comprension,
    nivel: nivelDe(comprension),
    recomendadas,
    unicas: { conocidas: conocidas.size, desconocidas: nuevas.size, ignoradas: ignoradas.size },
    frases: { conocidas: frasesConocidas, unaDesconocida, variasDesconocidas: varias },
    frecuenciaMedia: conRango ? Math.round(sumaRango / conRango) : undefined,
  };
}

/** Las palabras que más subirían tu comprensión en este video, de más a menos apariciones. */
export function palabrasPrioritarias(lineas: LineaAnalizada[], limite = 30): { palabra: PalabraToken; veces: number }[] {
  const cuenta = new Map<string, { palabra: PalabraToken; veces: number }>();
  for (const l of lineas) {
    for (const p of desconocidas(l.palabras)) {
      const c = cuenta.get(p.clave);
      if (c) c.veces++;
      else cuenta.set(p.clave, { palabra: p, veces: 1 });
    }
  }
  return [...cuenta.values()].sort((a, b) => b.veces - a.veces || (a.palabra.rango ?? 1e9) - (b.palabra.rango ?? 1e9)).slice(0, limite);
}

export type FiltroNavegador =
  | 'todas'
  | 'recomendadas'
  | '1d'
  | '1dUnicas'
  | '1mas'
  | '2mas'
  | 'rastreadas'
  | 'aprendiendo'
  | 'conocidas'
  | 'marcadas'
  | 'seleccionadas';

export function filtrarLineas(
  lineas: LineaAnalizada[],
  filtro: FiltroNavegador,
  o: OpcionesFrase,
  marcadas: ReadonlySet<number>,
  seleccionadas: ReadonlySet<number>
): LineaAnalizada[] {
  if (filtro === 'todas') return lineas;
  if (filtro === 'marcadas') return lineas.filter((l) => marcadas.has(l.id));
  if (filtro === 'seleccionadas') return lineas.filter((l) => seleccionadas.has(l.id));
  if (filtro === '1dUnicas') {
    const vistas = new Set<string>();
    return lineas.filter((l) => {
      const d = desconocidas(l.palabras);
      if (d.length !== 1 || vistas.has(d[0].clave)) return false;
      vistas.add(d[0].clave);
      return true;
    });
  }
  const clave: Record<string, ObjetivoFrase> = {
    recomendadas: 'recomendadas',
    '1d': '1d',
    '1mas': 'desconocidas',
    '2mas': '2mas',
    rastreadas: 'rastreadas',
    aprendiendo: 'aprendiendo',
    conocidas: 'conocidas',
  };
  return lineas.filter((l) => clasificarFrase(l.palabras, o).has(clave[filtro]));
}

/** Formato de furigana de Anki: 食[た]べる, con espacio entre palabras contiguas con lectura. */
export function aFuriganaAnki(p: PalabraToken[], palabraObjetivo?: string): string {
  let salida = '';
  for (const t of p) {
    let parte = '';
    for (const s of t.furigana) {
      if (s.lectura) parte += `${parte || salida ? ' ' : ''}${s.texto}[${s.lectura}]`;
      else parte += s.texto;
    }
    salida += palabraObjetivo && t.clave === palabraObjetivo ? `<b>${parte}</b>` : parte;
  }
  return salida;
}

export function fraseConNegrita(p: PalabraToken[], clave: string): string {
  return p.map((t) => (t.clave === clave ? `<b>${t.superficie}</b>` : t.superficie)).join('');
}
