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

export interface PronunciacionImportada {
  termino: string;
  lectura: string;
  transcripciones: { ipa: string; tags: string[] }[];
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

const NINGUNA: ReadonlySet<string> = new Set();

type NodoEstructurado = string | NodoEstructurado[] | {
  tag?: string;
  type?: string;
  content?: NodoEstructurado;
  data?: Record<string, string>;
  text?: string;
};

const seOmite = (n: Exclude<NodoEstructurado, string | NodoEstructurado[]>, omitir: ReadonlySet<string>) =>
  !!n.data?.content && (SECCIONES_OMITIDAS.has(n.data.content) || omitir.has(n.data.content));

/** Si dentro hay más definiciones: las listas de lo que no es la definición, como los sinónimos, no cuentan. */
function contieneLista(n: NodoEstructurado | undefined, omitir: ReadonlySet<string>): boolean {
  if (n === undefined || n === null || typeof n === 'string') return false;
  if (Array.isArray(n)) return n.some((h) => contieneLista(h, omitir));
  if (seOmite(n, omitir)) return false;
  return n.tag === 'li' || contieneLista(n.content, omitir);
}

/** Las traducciones de un sentido que se enseñan: después de las primeras suelen venir las de cada región. */
const MAXIMO_TRADUCCIONES = 4;

function textoSinOmitir(n: NodoEstructurado | undefined): string {
  if (n === undefined || n === null) return '';
  if (typeof n === 'string') return n;
  if (Array.isArray(n)) return n.map(textoSinOmitir).join('');
  return textoSinOmitir(n.content);
}

function textoDe(n: NodoEstructurado | undefined, omitir: ReadonlySet<string>): string {
  if (n === undefined || n === null) return '';
  if (typeof n === 'string') return n;
  if (Array.isArray(n)) return n.map((h) => textoDe(h, omitir)).join('');
  if (n.tag === 'rt' || n.tag === 'rp') return '';
  if (seOmite(n, omitir)) return '';
  return textoDe(n.content, omitir);
}

/** En mandarín, cada traducción viene en sus dos escrituras, «撿 /捡»: la segunda es la simplificada. */
const soloSimplificada = (t: string) => t.replace(/^\p{Script=Han}+ \/(\p{Script=Han}+)$/u, '$1');

/**
 * Las tablas de traducción de Wiktionary dan una etiqueta de sentido y varias traducciones. Juntas son una sola
 * definición, «pico, zapapico (pickaxe)»: sueltas, no se sabría a qué sentido corresponde cada una.
 */
function traduccionesDeUnSentido(n: Exclude<NodoEstructurado, string | NodoEstructurado[]>, omitir: ReadonlySet<string>): string | null {
  if (!Array.isArray(n.content)) return null;
  const hijos = n.content.filter((h) => h && typeof h === 'object' && !Array.isArray(h)) as Exclude<NodoEstructurado, string | NodoEstructurado[]>[];
  const etiqueta = hijos.find((h) => h.data?.content === 'sense-label');
  const lista = hijos.find((h) => h.data?.content === 'glossary');
  if (!etiqueta || !lista || !Array.isArray(lista.content)) return null;
  const palabras = [...new Set(lista.content.map((h) => soloSimplificada(textoDe(h, omitir).trim())).filter(Boolean))].slice(0, MAXIMO_TRADUCCIONES);
  if (!palabras.length) return null;
  const sentido = (typeof etiqueta.content === 'string' ? etiqueta.content : textoSinOmitir(etiqueta.content)).trim();
  return sentido ? `${palabras.join(', ')} (${sentido})` : palabras.join(', ');
}

/** Saca las glosas de una lista estructurada: cada <li> de glosario es una definición. */
function glosasEstructuradas(n: NodoEstructurado, salida: string[], omitir: ReadonlySet<string>): void {
  if (n === undefined || n === null || typeof n === 'string') return;
  if (Array.isArray(n)) {
    for (const h of n) glosasEstructuradas(h, salida, omitir);
    return;
  }
  if (seOmite(n, omitir)) return;
  const traducciones = traduccionesDeUnSentido(n, omitir);
  if (traducciones) {
    salida.push(traducciones);
    return;
  }
  if (n.tag === 'li' || n.data?.content === 'glossary') {
    const interior = Array.isArray(n.content) ? n.content : [n.content as NodoEstructurado];
    const tieneListas = contieneLista(n.content, omitir);
    if (n.tag === 'li' && !tieneListas) {
      const t = textoDe(n, omitir).trim();
      if (t) salida.push(t);
      return;
    }
    for (const h of interior) glosasEstructuradas(h, salida, omitir);
    return;
  }
  glosasEstructuradas(n.content as NodoEstructurado, salida, omitir);
}

/** `omitir` son las secciones que, además de las de siempre, no son la definición en los diccionarios de esa lengua. */
export function extraerGlosas(glosario: unknown[], omitir: ReadonlySet<string> = NINGUNA): string[] {
  const salida: string[] = [];
  for (const g of glosario) {
    if (typeof g === 'string') {
      if (g.trim()) salida.push(g.trim());
    } else if (g && typeof g === 'object') {
      const o = g as { type?: string; text?: string; content?: NodoEstructurado };
      if (o.type === 'text' && o.text) salida.push(o.text);
      else if (o.type === 'structured-content') {
        const antes = salida.length;
        glosasEstructuradas(o.content as NodoEstructurado, salida, omitir);
        if (salida.length === antes) {
          const t = textoDe(o.content as NodoEstructurado, omitir).trim();
          if (t) salida.push(t);
        }
      }
    }
  }
  return salida;
}

export function leerBancoTerminos(filas: unknown[][], omitir: ReadonlySet<string> = NINGUNA): TerminoImportado[] {
  const salida: TerminoImportado[] = [];
  for (const f of filas) {
    const glosas = extraerGlosas((f[5] as unknown[]) ?? [], omitir);
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

/** Un carácter de un diccionario de caracteres en formato Yomitan (KANJIDIC): lecturas, etiquetas, significados y datos. */
export interface CaracterImportado {
  caracter: string;
  on: string[];
  kun: string[];
  etiquetas: string[];
  significados: string[];
  /** Trazos, curso, frecuencia, índices de libros: lo que el formato llama estadísticas. */
  datos: Record<string, string>;
}

/** Un banco de caracteres: ["日", "ニチ ジツ", "ひ -び -か", "jouyou", ["día", "sol"], {"strokes": "4"}]. */
export function leerBancoCaracteres(filas: unknown[][]): CaracterImportado[] {
  const palabras = (x: unknown) => String(x ?? '').split(/\s+/).filter(Boolean);
  const salida: CaracterImportado[] = [];
  for (const f of filas) {
    const caracter = String(f[0] ?? '');
    if (!caracter) continue;
    const datos: Record<string, string> = {};
    if (f[5] && typeof f[5] === 'object' && !Array.isArray(f[5])) {
      for (const [k, v] of Object.entries(f[5] as Record<string, unknown>)) if (v !== null && v !== undefined) datos[k] = String(v);
    }
    const significados = Array.isArray(f[4]) ? f[4].filter((s): s is string => typeof s === 'string' && s.trim() !== '').map((s) => s.trim()) : [];
    salida.push({ caracter, on: palabras(f[1]), kun: palabras(f[2]), etiquetas: palabras(f[3]), significados, datos });
  }
  return salida;
}

/** Una forma flexionada y las palabras de las que sale, según un diccionario. */
export interface FormaImportada {
  forma: string;
  lemas: { lema: string; flexion: string; pos: string }[];
}

/**
 * Las filas que no definen nada, sino que dicen de qué palabra es forma otra:
 * ["ging", "", "non-lemma", "v", 0, [["gehen", ["first/third-person singular preterite"]]], 0, ""].
 * En las lenguas sin un analizador que lo sepa, con ellas se encuentra la forma de diccionario.
 */
export function leerBancoFormas(filas: unknown[][], acumuladas = new Map<string, FormaImportada>()): Map<string, FormaImportada> {
  for (const f of filas) {
    const definiciones = f[5];
    if (!Array.isArray(definiciones)) continue;
    const forma = String(f[0] ?? '');
    for (const d of definiciones) {
      if (!Array.isArray(d) || typeof d[0] !== 'string' || !Array.isArray(d[1])) continue;
      const lema = d[0];
      if (!lema || lema === forma) continue;
      const fila = acumuladas.get(forma) ?? { forma, lemas: [] };
      if (!fila.lemas.some((x) => x.lema === lema)) {
        fila.lemas.push({ lema, flexion: d[1].filter((x): x is string => typeof x === 'string').join('; '), pos: String(f[3] ?? '') });
      }
      acumuladas.set(forma, fila);
    }
  }
  return acumuladas;
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

export function leerBancoMeta(filas: unknown[][]): { frecuencias: FrecuenciaImportada[]; acentos: AcentoImportado[]; pronunciaciones: PronunciacionImportada[] } {
  const frecuencias: FrecuenciaImportada[] = [];
  const acentos: AcentoImportado[] = [];
  const pronunciaciones: PronunciacionImportada[] = [];
  for (const f of filas) {
    const termino = String(f[0] ?? '');
    const tipo = f[1];
    const d = f[2] as { reading?: string; pitches?: { position?: number }[]; transcriptions?: { ipa?: string; tags?: string[] }[] };
    if (tipo === 'freq') {
      const v = valorFrecuencia(d);
      if (v) frecuencias.push({ termino, lectura: (d && typeof d === 'object' && d.reading) || '', rango: v.rango, texto: v.texto });
    } else if (tipo === 'pitch' && d?.reading) {
      acentos.push({
        termino,
        lectura: d.reading,
        posiciones: (d.pitches ?? []).map((p) => p.position).filter((p): p is number => typeof p === 'number'),
      });
    } else if (tipo === 'ipa' && d?.transcriptions?.length) {
      pronunciaciones.push({
        termino,
        lectura: d.reading || termino,
        transcripciones: d.transcriptions.flatMap((t) => (t.ipa ? [{ ipa: t.ipa, tags: t.tags ?? [] }] : [])),
      });
    }
  }
  return { frecuencias, acentos, pronunciaciones };
}

/** Una lista de frecuencia en texto, con una palabra y sus apariciones por línea, de la más frecuente a la menos. */
export function leerListaFrecuencia(texto: string): FrecuenciaImportada[] {
  const salida: FrecuenciaImportada[] = [];
  for (const fila of texto.split(/\r?\n/)) {
    const palabra = fila.split(/\s/)[0];
    if (palabra) salida.push({ termino: palabra, lectura: palabra, rango: salida.length + 1 });
  }
  return salida;
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
