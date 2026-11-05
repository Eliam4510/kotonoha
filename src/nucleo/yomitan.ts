// Lectura de diccionarios en formato Yomitan y de los datos de acento de Kanjium.

export interface TerminoImportado {
  termino: string;
  lectura: string;
  tags: string;
  reglas: string;
  puntuacion: number;
  glosas: string[];
  seq: number;
}

export interface FrecuenciaImportada {
  termino: string;
  lectura: string;
  rango: number;
  texto?: string;
}

export interface AcentoImportado {
  termino: string;
  lectura: string;
  posiciones: number[];
}

/** Secciones del contenido estructurado que no son la definición en sí. */
const SECCIONES_OMITIDAS = new Set([
  'attribution',
  'part-of-speech-info',
  'misc-info',
  'field-info',
  'dialect-info',
  'sense-note',
  'xref',
  'xref-content',
  'xref-glossary',
  'antonym',
  'antonym-content',
  'forms',
  'forms-label',
  'source-language',
  'lang-source',
  'example-sentence',
  'example-sentence-a',
  'example-sentence-b',
  'info-gloss',
  'sense-number',
  'infoGlossary',
]);

type NodoEstructurado = string | NodoEstructurado[] | {
  tag?: string;
  type?: string;
  content?: NodoEstructurado;
  data?: Record<string, string>;
  text?: string;
};

function textoDe(n: NodoEstructurado | undefined): string {
  if (n === undefined || n === null) return '';
  if (typeof n === 'string') return n;
  if (Array.isArray(n)) return n.map(textoDe).join('');
  if (n.tag === 'rt' || n.tag === 'rp') return '';
  if (n.data?.content && SECCIONES_OMITIDAS.has(n.data.content)) return '';
  return textoDe(n.content);
}

/** Saca las glosas de una lista estructurada: cada <li> de glosario es una definición. */
function glosasEstructuradas(n: NodoEstructurado, salida: string[]): void {
  if (n === undefined || n === null || typeof n === 'string') return;
  if (Array.isArray(n)) {
    for (const h of n) glosasEstructuradas(h, salida);
    return;
  }
  if (n.data?.content && SECCIONES_OMITIDAS.has(n.data.content)) return;
  if (n.tag === 'li' || n.data?.content === 'glossary') {
    const interior = Array.isArray(n.content) ? n.content : [n.content as NodoEstructurado];
    const tieneListas = JSON.stringify(n.content ?? '').includes('"tag":"li"');
    if (n.tag === 'li' && !tieneListas) {
      const t = textoDe(n).trim();
      if (t) salida.push(t);
      return;
    }
    for (const h of interior) glosasEstructuradas(h, salida);
    return;
  }
  glosasEstructuradas(n.content as NodoEstructurado, salida);
}

export function extraerGlosas(glosario: unknown[]): string[] {
  const salida: string[] = [];
  for (const g of glosario) {
    if (typeof g === 'string') {
      if (g.trim()) salida.push(g.trim());
    } else if (g && typeof g === 'object') {
      const o = g as { type?: string; text?: string; content?: NodoEstructurado };
      if (o.type === 'text' && o.text) salida.push(o.text);
      else if (o.type === 'structured-content') {
        const antes = salida.length;
        glosasEstructuradas(o.content as NodoEstructurado, salida);
        if (salida.length === antes) {
          const t = textoDe(o.content as NodoEstructurado).trim();
          if (t) salida.push(t);
        }
      }
    }
  }
  return salida;
}

export function leerBancoTerminos(filas: unknown[][]): TerminoImportado[] {
  const salida: TerminoImportado[] = [];
  for (const f of filas) {
    const glosas = extraerGlosas((f[5] as unknown[]) ?? []);
    if (!glosas.length) continue;
    salida.push({
      termino: String(f[0] ?? ''),
      lectura: String(f[1] ?? '') || String(f[0] ?? ''),
      tags: [f[2], f[7]].filter(Boolean).join(' '),
      reglas: String(f[3] ?? ''),
      puntuacion: Number(f[4] ?? 0),
      glosas,
      seq: Number(f[6] ?? 0),
    });
  }
  return salida;
}

function valorFrecuencia(d: unknown): { rango: number; texto?: string } | null {
  if (typeof d === 'number') return { rango: d };
  if (typeof d === 'string') {
    const n = parseInt(d, 10);
    return Number.isFinite(n) ? { rango: n, texto: d } : null;
  }
  if (d && typeof d === 'object') {
    const o = d as { value?: unknown; displayValue?: string; frequency?: unknown };
    if (o.frequency !== undefined) return valorFrecuencia(o.frequency);
    if (typeof o.value === 'number') return { rango: o.value, texto: o.displayValue };
  }
  return null;
}

export function leerBancoMeta(filas: unknown[][]): { frecuencias: FrecuenciaImportada[]; acentos: AcentoImportado[] } {
  const frecuencias: FrecuenciaImportada[] = [];
  const acentos: AcentoImportado[] = [];
  for (const f of filas) {
    const termino = String(f[0] ?? '');
    const tipo = f[1];
    const d = f[2] as { reading?: string; pitches?: { position?: number }[] };
    if (tipo === 'freq') {
      const v = valorFrecuencia(d);
      if (v) frecuencias.push({ termino, lectura: (d && typeof d === 'object' && d.reading) || '', rango: v.rango, texto: v.texto });
    } else if (tipo === 'pitch' && d?.reading) {
      acentos.push({
        termino,
        lectura: d.reading,
        posiciones: (d.pitches ?? []).map((p) => p.position).filter((p): p is number => typeof p === 'number'),
      });
    }
  }
  return { frecuencias, acentos };
}

/** Kanjium accents.txt: palabra, lectura y posiciones separadas por comas, con posibles notas: (名)0 */
export function leerKanjium(texto: string): AcentoImportado[] {
  const salida: AcentoImportado[] = [];
  for (const fila of texto.split(/\r?\n/)) {
    if (!fila) continue;
    const c = fila.split('\t');
    if (c.length < 3) continue;
    const termino = c[0];
    const lectura = c[1] || c[0];
    const posiciones = c[2]
      .split(',')
      .map((p) => parseInt(p.replace(/\([^)]*\)/g, ''), 10))
      .filter((n) => Number.isFinite(n));
    if (posiciones.length) salida.push({ termino, lectura, posiciones });
  }
  return salida;
}
