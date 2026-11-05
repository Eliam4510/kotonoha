// Tokeniza texto y lo enriquece con lecturas, acento, frecuencia, glosas y tu estado de aprendizaje.

import type { Ajustes } from '../compartido/ajustes';
import type {
  EntradaDiccionario,
  EstadoPalabra,
  EtiquetaFrecuencia,
  FraseEjemplo,
  LineaAnalizada,
  PalabraToken,
  ResultadoBusqueda,
} from '../compartido/tipos';
import type { Linea } from '../nucleo/subtitulos';
import { type AnalisisLinea, aplicarLecturas } from '../nucleo/analisisProfundo';
import { detectarGramatica, type PuntoGramatica } from '../nucleo/gramatica';
import { kataAHira, patronAcento, tieneJapones, type TokenCrudo, type TokenUnido, unirTokens } from '../nucleo/tokens';
import { db, type FilaPalabraDb, type FilaTermino } from './db';
import { listaDiccionarios } from './diccionarios';

interface Tokenizador {
  tokenize(texto: string): TokenCrudo[];
}

declare const kuromoji: {
  builder(o: { dicPath: string }): { build(cb: (e: Error | null, t: Tokenizador) => void): void };
};

let tokenizador: Tokenizador | null = null;
let cargando: Promise<Tokenizador> | null = null;
let terminos: Set<string> | null = null;

export const tokenizadorListo = () => tokenizador !== null;
export const totalTerminos = () => terminos?.size ?? 0;

export function cargarTokenizador(): Promise<Tokenizador> {
  if (tokenizador) return Promise.resolve(tokenizador);
  cargando ??= new Promise((ok, mal) => {
    // Ruta relativa al documento: Kuromoji rompe las URL absolutas al unirlas con path.join.
    kuromoji.builder({ dicPath: 'dict/' }).build((e, t) => {
      if (e) mal(e);
      else {
        tokenizador = t;
        ok(t);
      }
    });
  });
  return cargando;
}

let cargaTerminos: Promise<void> | null = null;

/** Conjunto de todos los términos, para unir compuestos sin consultar la base por cada token. */
export function recargarTerminos(): Promise<void> {
  cargaTerminos = (async () => {
    const claves = (await db.terminos.orderBy('termino').uniqueKeys()) as string[];
    terminos = new Set(claves);
    cacheTokens.clear();
  })();
  return cargaTerminos;
}

/** Espera a tener tokenizador y términos: sin ellos los compuestos saldrían partidos. */
async function preparar(): Promise<Tokenizador> {
  const t = await cargarTokenizador();
  await (cargaTerminos ?? recargarTerminos()).catch(() => {});
  return t;
}

const cacheTokens = new Map<string, TokenUnido[]>();
const cacheLecturaLema = new Map<string, string>();

function tokensDe(t: Tokenizador, texto: string): TokenUnido[] {
  let r = cacheTokens.get(texto);
  if (!r) {
    r = unirTokens(t.tokenize(texto), terminos ? (x) => terminos!.has(x) : undefined);
    if (cacheTokens.size > 20000) cacheTokens.clear();
    cacheTokens.set(texto, r);
  }
  return r;
}

/** Lectura de la forma de diccionario. Un verbo conjugado no trae la del lema: se tokeniza aparte. */
function lecturaLema(t: Tokenizador, token: TokenUnido & { lecturaLemaCorregida?: string }): string {
  if (token.lecturaLemaCorregida) return token.lecturaLemaCorregida;
  if (!token.inflexionado) return token.lectura;
  let r = cacheLecturaLema.get(token.lema);
  if (r === undefined) {
    r = t
      .tokenize(token.lema)
      .map((x) => (x.reading && x.reading !== '*' ? kataAHira(x.reading) : kataAHira(x.surface_form)))
      .join('');
    cacheLecturaLema.set(token.lema, r);
  }
  return r;
}

export const claveDe = (lema: string, lectura: string) => `${lema}|${lectura}`;

async function primerDicFrecuencia(): Promise<string | undefined> {
  const lista = await listaDiccionarios();
  return lista.find((d) => d.tipo === 'frecuencia')?.id;
}

async function ordenDics(): Promise<string[]> {
  return (await listaDiccionarios()).filter((d) => d.tipo === 'terminos').map((d) => d.id);
}

/** Primer sentido en el idioma preferido: el diccionario en la cima de la lista manda. */
function glosaCorta(filas: FilaTermino[], orden: string[], lectura: string): string | undefined {
  if (!filas.length) return undefined;
  const conLectura = filas.filter((f) => f.lectura === lectura);
  const candidatas = conLectura.length ? conLectura : filas;
  for (const dic of orden) {
    const f = candidatas.filter((x) => x.dic === dic).sort((a, b) => b.puntuacion - a.puntuacion)[0];
    if (f) return f.glosas[0]?.split(/[;；]/)[0].trim();
  }
  return undefined;
}

export async function enriquecer(tokensPorLinea: TokenUnido[][], t: Tokenizador, a: Ajustes): Promise<PalabraToken[][]> {
  const claves = new Map<string, { lema: string; lectura: string }>();
  const lecturas = tokensPorLinea.map((linea) =>
    linea.map((tk) => {
      if (!tk.esPalabra) return '';
      const l = lecturaLema(t, tk);
      claves.set(claveDe(tk.lema, l), { lema: tk.lema, lectura: l });
      return l;
    })
  );

  const unicas = [...claves.entries()];
  const [filasPalabra, filasAcento, dicFrec, orden] = await Promise.all([
    db.palabras.bulkGet(unicas.map(([k]) => k)),
    db.acentos.bulkGet(unicas.map(([, v]) => [v.lema, v.lectura] as [string, string])),
    primerDicFrecuencia(),
    ordenDics(),
  ]);
  const filasFrec = dicFrec
    ? await db.frecuencias.bulkGet(unicas.map(([, v]) => [dicFrec, v.lema, v.lectura] as [string, string, string]))
    : [];
  const faltanFrec = dicFrec ? unicas.filter((_, i) => !filasFrec[i]).map(([, v]) => [dicFrec, v.lema, ''] as [string, string, string]) : [];
  const respaldoFrec = faltanFrec.length ? await db.frecuencias.bulkGet(faltanFrec) : [];
  const frecPorLema = new Map(respaldoFrec.filter(Boolean).map((f) => [f!.termino, f!.rango]));

  const glosasIA = await db.glosas.bulkGet(unicas.map(([k]) => k));
  const lemas = [...new Set(unicas.map(([, v]) => v.lema))];
  const filasTerminos = lemas.length ? await db.terminos.where('termino').anyOf(lemas).toArray() : [];
  const porTermino = new Map<string, FilaTermino[]>();
  for (const f of filasTerminos) {
    const l = porTermino.get(f.termino);
    if (l) l.push(f);
    else porTermino.set(f.termino, [f]);
  }

  const datos = new Map<string, { fila?: FilaPalabraDb; acentos?: number[]; rango?: number; glosa?: string }>();
  unicas.forEach(([k, v], i) => {
    datos.set(k, {
      fila: filasPalabra[i],
      acentos: filasAcento[i]?.posiciones,
      rango: filasFrec[i]?.rango ?? frecPorLema.get(v.lema),
      glosa: glosasIA[i]?.glosa ?? glosaCorta(porTermino.get(v.lema) ?? [], orden, v.lectura),
    });
  });

  return tokensPorLinea.map((linea, i) =>
    linea.map((tk, j): PalabraToken => {
      if (!tk.esPalabra) {
        return {
          superficie: tk.superficie,
          lema: tk.lema,
          lectura: tk.lectura,
          lecturaLema: '',
          clave: '',
          esPalabra: false,
          esGramatica: false,
          flexion: [],
          furigana: tk.furigana,
          estado: 'conocida',
          rastreada: false,
        };
      }
      const l = lecturas[i][j];
      const clave = claveDe(tk.lema, l);
      const d = datos.get(clave)!;
      const corregida = (tk as TokenUnido & { lecturaCorregida?: boolean }).lecturaCorregida;
      const porDefecto: EstadoPalabra = tk.esGramatica && a.particulasConocidas ? 'conocida' : 'desconocida';
      const acentos = d.acentos?.length ? d.acentos : undefined;
      return {
        superficie: tk.superficie,
        lema: tk.lema,
        lectura: tk.lectura,
        lecturaLema: l,
        clave,
        esPalabra: true,
        esGramatica: tk.esGramatica,
        flexion: tk.flexion,
        furigana: tk.furigana,
        estado: d.fila?.estado ?? porDefecto,
        rastreada: d.fila?.rastreada === 1,
        acentos,
        patron: acentos && !tk.esGramatica ? patronAcento(acentos[0], l) : undefined,
        rango: d.rango,
        glosa: d.glosa,
        ...(corregida ? { lecturaCorregida: true } : {}),
      };
    })
  );
}

export function claveLinea(texto: string): string {
  return hashTexto(texto.replace(/\s+/g, ''));
}

function gramaticaDe(texto: string, f: AnalisisLinea | undefined): PuntoGramatica[] {
  // Lo que dijo Claude manda; las reglas solo cubren lo que aún no se ha analizado.
  if (f) return f.gramatica.map((g) => ({ ...g, fuente: 'ia' as const }));
  return detectarGramatica(texto);
}

export async function analizarLineas(
  lineas: Linea[],
  a: Ajustes,
  fuente?: { titulo?: string; url?: string; idVideo?: string }
): Promise<LineaAnalizada[]> {
  const t = await preparar();
  const filas = await db.analisis.bulkGet(lineas.map((l) => claveLinea(l.texto)));
  const tokens = lineas.map((l, i) => {
    const base = tokensDe(t, l.texto);
    return filas[i]?.lecturas.length ? aplicarLecturas(base, filas[i]!.lecturas) : base;
  });
  const palabras = await enriquecer(tokens, t, a);
  const salida: LineaAnalizada[] = lineas.map((l, i) => {
    const f = filas[i];
    const conSentido = f?.sentidos.length
      ? palabras[i].map((p) => {
          const s = f.sentidos.find((x) => x.superficie === p.superficie || x.superficie === p.lema);
          return s ? { ...p, sentido: s.significado, uso: s.uso, glosa: s.significado } : p;
        })
      : palabras[i];
    return { ...l, palabras: conSentido, gramatica: gramaticaDe(l.texto, f) };
  });
  if (a.guardarHistorial && fuente) guardarFrases(salida, fuente).catch(() => {});
  return salida;
}

export async function analizarTexto(texto: string, a: Ajustes): Promise<PalabraToken[][]> {
  const t = await preparar();
  return enriquecer(texto.split(/\r?\n/).map((l) => tokensDe(t, l)), t, a);
}

/** Texto para el análisis profundo: cada línea con las palabras y lecturas que calculó el tokenizador. */
export async function entradasAnalisis(lineas: Linea[]): Promise<{ texto: string; palabras: string; clave: string; pendiente: boolean }[]> {
  const t = await preparar();
  const hechas = await db.analisis.bulkGet(lineas.map((l) => claveLinea(l.texto)));
  return lineas.map((l, i) => ({
    texto: l.texto.replace(/\n/g, ' '),
    palabras: tokensDe(t, l.texto)
      .filter((x) => x.esPalabra)
      .map((x) => (x.lectura && x.lectura !== x.superficie ? `${x.superficie}(${x.lectura})` : x.superficie))
      .join(' '),
    clave: claveLinea(l.texto),
    pendiente: !hechas[i] && tieneJapones(l.texto),
  }));
}

function hashTexto(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36) + s.length.toString(36);
}

async function guardarFrases(lineas: LineaAnalizada[], fuente: { titulo?: string; url?: string }) {
  const filas = lineas
    .filter((l) => l.palabras.filter((p) => p.esPalabra).length >= 3 && l.texto.length <= 80)
    .map((l) => ({
      id: hashTexto(l.texto),
      texto: l.texto,
      lemas: [...new Set(l.palabras.filter((p) => p.esPalabra && !p.esGramatica).map((p) => p.lema))],
      fuente: fuente.titulo,
      url: fuente.url,
      inicio: l.inicio,
      creada: Date.now(),
    }));
  await db.frases.bulkPut(filas);
}

export async function ejemplos(lema: string): Promise<FraseEjemplo[]> {
  const filas = await db.frases.where('lemas').equals(lema).limit(30).toArray();
  return filas
    .sort((a, b) => a.texto.length - b.texto.length)
    .slice(0, 12)
    .map((f) => ({ texto: f.texto, fuente: f.fuente, url: f.url, inicio: f.inicio }));
}

// ---------- Búsqueda en diccionarios ----------

export async function buscar(lema: string, lectura?: string): Promise<ResultadoBusqueda> {
  const lista = await listaDiccionarios();
  const dics = lista.filter((d) => d.tipo === 'terminos');
  const titulos = new Map(dics.map((d) => [d.id, d.titulo]));
  const ordenDic = new Map(dics.map((d, i) => [d.id, i]));

  let filas = await db.terminos.where('termino').equals(lema).toArray();
  if (!filas.length && !/[^぀-ヿー]/.test(lema)) {
    filas = await db.terminos.where('lectura').equals(kataAHira(lema)).limit(60).toArray();
  }
  const lecturaFinal = lectura || filas.sort((a, b) => b.puntuacion - a.puntuacion)[0]?.lectura || (tieneJapones(lema) ? kataAHira(lema) : '');
  const conLectura = filas.filter((f) => f.lectura === lecturaFinal);
  const elegidas = (conLectura.length ? conLectura : filas)
    .filter((f) => ordenDic.has(f.dic))
    .sort((a, b) => ordenDic.get(a.dic)! - ordenDic.get(b.dic)! || b.puntuacion - a.puntuacion);

  const entradas: EntradaDiccionario[] = elegidas.map((f) => ({
    dic: f.dic,
    dicTitulo: titulos.get(f.dic) ?? f.dic,
    termino: f.termino,
    lectura: f.lectura,
    glosas: f.glosas,
    tags: f.tags,
    seq: f.seq,
  }));

  const dicsFrec = lista.filter((d) => d.tipo === 'frecuencia');
  const frecuencias: EtiquetaFrecuencia[] = [];
  for (const d of dicsFrec) {
    const f = (await db.frecuencias.get([d.id, lema, lecturaFinal])) ?? (await db.frecuencias.get([d.id, lema, '']));
    if (f) frecuencias.push({ lista: d.titulo, rango: f.rango, texto: f.texto });
  }

  const acento = await db.acentos.get([lema, lecturaFinal]);
  const clave = claveDe(lema, lecturaFinal);
  const fila = await db.palabras.get(clave);
  const acentos = acento?.posiciones ?? [];
  return {
    lema,
    lectura: lecturaFinal,
    clave,
    estado: fila?.estado ?? 'desconocida',
    rastreada: fila?.rastreada === 1,
    acentos,
    patron: acentos.length ? patronAcento(acentos[0], lecturaFinal) : undefined,
    frecuencias,
    entradas,
  };
}

/** Búsqueda escrita a mano: admite una palabra exacta, una forma conjugada o una frase. */
export async function buscarLibre(texto: string, a: Ajustes): Promise<ResultadoBusqueda[]> {
  const limpio = texto.trim();
  if (!limpio) return [];
  const directo = await buscar(limpio);
  if (directo.entradas.length) return [directo];
  const t = await preparar();
  const [palabras] = await enriquecer([tokensDe(t, limpio)], t, a);
  const vistas = new Set<string>();
  const salida: ResultadoBusqueda[] = [];
  for (const p of palabras) {
    if (!p.esPalabra || vistas.has(p.clave)) continue;
    vistas.add(p.clave);
    salida.push(await buscar(p.lema, p.lecturaLema));
  }
  return salida;
}

/** Busca frases hechas que empiecen en la palabra consultada: 食べ + 物, 気 + に + なる. */
export async function compuestos(superficies: string[]): Promise<ResultadoBusqueda[]> {
  const salida: ResultadoBusqueda[] = [];
  for (let n = Math.min(superficies.length, 6); n >= 2; n--) {
    const candidato = superficies.slice(0, n).join('');
    if (terminos?.has(candidato)) {
      const r = await buscar(candidato);
      if (r.entradas.length) salida.push(r);
    }
  }
  return salida;
}
