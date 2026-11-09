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
import type { ConsultasAnalisis, FormaFlexionada, OpcionesAnalisis, PuntoGramatica, TokenUnido, Transcripcion } from '../lenguas/tipos';
import { db, type FilaPalabraDb, type FilaTermino } from './db';
import { listaDiccionarios } from './diccionarios';
import { lengua, motorLengua } from './lengua';

let terminos: Set<string> | null = null;
/** En las lenguas que lo usan, de qué palabras sale cada forma flexionada (ging, de gehen) y cuánto se usa cada una. */
let formas: Map<string, FormaFlexionada[]> | null = null;
let rangos: Map<string, number> | null = null;
/** De qué lengua son los términos en memoria. */
let lenguaTerminos = '';
/**
 * Los de la lengua anterior. Quien estudia dos alterna entre ellas, y leer de nuevo los términos tarda unos segundos
 * con diccionarios grandes: sin ellos, al volver los subtítulos tardaban en aparecer.
 */
let terminosAnteriores: {
  lengua: string;
  terminos: Set<string>;
  formas: Map<string, FormaFlexionada[]> | null;
  rangos: Map<string, number> | null;
} | null = null;

/** Lo que el analizador puede preguntar de los diccionarios sin esperar a la base. */
const consultas: ConsultasAnalisis = {
  formas: (palabra) => formas?.get(palabra),
  // Las listas de frecuencia vienen en minúsculas: Essen cuenta como «essen».
  rango: (termino) => rangos?.get(termino) ?? rangos?.get(termino.toLocaleLowerCase()),
};

/** Las formas de todos los diccionarios, juntas: la misma puede venir en varios. */
async function leerFormas(): Promise<Map<string, FormaFlexionada[]>> {
  const salida = new Map<string, FormaFlexionada[]>();
  // Medio millón de formas repiten unas pocas descripciones («past participle») y lemas: cada texto se guarda una vez.
  const unicos = new Map<string, string>();
  const unico = (s: string) => {
    const previo = unicos.get(s);
    if (previo !== undefined) return previo;
    unicos.set(s, s);
    return s;
  };
  for (const f of await db.formas.toArray()) {
    const lemas = f.lemas.map((l) => ({ lema: unico(l.lema), flexion: unico(l.flexion), pos: unico(l.pos) }));
    const previas = salida.get(f.forma);
    if (!previas) salida.set(f.forma, lemas);
    else for (const l of lemas) if (!previas.some((x) => x.lema === l.lema)) previas.push(l);
  }
  return salida;
}

/** El mejor puesto de cada palabra entre las listas de frecuencia instaladas. */
async function leerRangos(): Promise<Map<string, number>> {
  const salida = new Map<string, number>();
  for (const f of await db.frecuencias.toArray()) {
    const previo = salida.get(f.termino);
    if (previo === undefined || f.rango < previo) salida.set(f.termino, f.rango);
  }
  return salida;
}

export const analizadorListo = () => motorLengua().analizador.listo();
export const totalTerminos = () => terminos?.size ?? 0;

export const cargarAnalizador = () => motorLengua().analizador.cargar();

let cargaTerminos: Promise<void> | null = null;
let ultimaCarga = 0;

/** Conjunto de todos los términos, para unir compuestos sin consultar la base por cada token. */
export function recargarTerminos(): Promise<void> {
  const esta = ++ultimaCarga;
  const id = lengua().id;
  const conFormas = !!motorLengua().formasDeDiccionario;
  cargaTerminos = (async () => {
    const claves = (await db.terminos.orderBy('termino').uniqueKeys()) as string[];
    const nuevasFormas = conFormas ? await leerFormas() : null;
    const nuevosRangos = conFormas ? await leerRangos() : null;
    // Una carga larga puede acabar después de cambiar de lengua: lo que traiga ya no sirve.
    if (esta !== ultimaCarga) return;
    terminos = new Set(claves);
    formas = nuevasFormas;
    rangos = nuevosRangos;
    lenguaTerminos = id;
    cacheTokens.clear();
  })();
  return cargaTerminos;
}

/** La lista de términos de los diccionarios, esperando a que esté cargada. */
export async function listaTerminos(): Promise<Set<string>> {
  await (cargaTerminos ?? recargarTerminos()).catch(() => {});
  return terminos ?? new Set();
}

/** Espera a tener analizador y términos, salvo que la lengua pueda seguir sin ellos. */
async function preparar(): Promise<void> {
  await cargarAnalizador();
  // Con los de esta lengua ya en memoria no se espera: si se están releyendo, se usarán los nuevos al terminar.
  if (terminos && lenguaTerminos === lengua().id) return;
  const carga = (cargaTerminos ?? recargarTerminos()).catch(() => {});
  if (!motorLengua().analizador.terminosOpcionales) await carga;
}

/** Al cambiar de lengua, lo que había en memoria era de la anterior. */
export function olvidarLengua() {
  ultimaCarga++;
  const id = lengua().id;
  const salientes = terminos && lenguaTerminos && lenguaTerminos !== id ? { lengua: lenguaTerminos, terminos, formas, rangos } : null;
  if (terminosAnteriores?.lengua === id) {
    ({ terminos, formas, rangos } = terminosAnteriores);
    lenguaTerminos = id;
  } else {
    terminos = null;
    formas = null;
    rangos = null;
    lenguaTerminos = '';
  }
  terminosAnteriores = salientes ?? terminosAnteriores;
  cargaTerminos = null;
  cacheTokens.clear();
  cacheLecturaLema.clear();
}

const cacheTokens = new Map<string, TokenUnido[]>();
const cacheLecturaLema = new Map<string, string>();

function tokensDe(texto: string, opciones?: OpcionesAnalisis): TokenUnido[] {
  // Partido de otra manera, va aparte en la caché.
  const clave = opciones?.expresiones === false ? `\u0000${texto}` : texto;
  let r = cacheTokens.get(clave);
  if (!r) {
    r = motorLengua().analizador.analizar(texto, terminos ? (x) => terminos!.has(x) : undefined, consultas, opciones);
    if (cacheTokens.size > 20000) cacheTokens.clear();
    cacheTokens.set(clave, r);
  }
  return r;
}

/** Lectura de la forma de diccionario. Una palabra flexionada no trae la del lema: se pide aparte. */
function lecturaLema(token: TokenUnido & { lecturaLemaCorregida?: string }): string {
  if (token.lecturaLemaCorregida) return token.lecturaLemaCorregida;
  if (!token.inflexionado) return token.lectura;
  let r = cacheLecturaLema.get(token.lema);
  if (r === undefined) {
    r = motorLengua().analizador.lecturaDeLema(token.lema);
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
function glosaCorta(filas: FilaTermino[], orden: string[], lectura: string, categoria: string): string | undefined {
  if (!filas.length) return undefined;
  const conLectura = filas.filter((f) => f.lectura === lectura);
  const delaLectura = conLectura.length ? conLectura : filas;
  const encaja = motorLengua().encajaCategoria;
  const deLaCategoria = encaja ? delaLectura.filter((f) => encaja(f.reglas, categoria)) : [];
  const candidatas = deLaCategoria.length ? deLaCategoria : delaLectura;
  for (const dic of orden) {
    const f = candidatas.filter((x) => x.dic === dic).sort((a, b) => b.puntuacion - a.puntuacion)[0];
    if (f) {
      const glosa = f.glosas[0];
      if (!glosa) return undefined;
      return motorLengua().recortarGlosa?.(glosa) ?? glosa.split(/[;；]/)[0].trim();
    }
  }
  return undefined;
}

export async function enriquecer(tokensPorLinea: TokenUnido[][], a: Ajustes): Promise<PalabraToken[][]> {
  const claves = new Map<string, { lema: string; lectura: string; categoria: string }>();
  const lecturas = tokensPorLinea.map((linea) =>
    linea.map((tk) => {
      if (!tk.esPalabra) return '';
      const l = lecturaLema(tk);
      claves.set(claveDe(tk.lema, l), { lema: tk.lema, lectura: l, categoria: tk.categoria });
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
  // Las listas de frecuencia vienen en minúsculas: un sustantivo alemán, Kind, está como «kind».
  const conMayuscula = dicFrec
    ? [...new Set(unicas.filter(([, v], i) => !filasFrec[i] && !frecPorLema.has(v.lema) && v.lema !== v.lema.toLocaleLowerCase()).map(([, v]) => v.lema))]
    : [];
  if (conMayuscula.length) {
    const filas = await db.frecuencias.bulkGet(conMayuscula.map((l) => [dicFrec!, l.toLocaleLowerCase(), l.toLocaleLowerCase()] as [string, string, string]));
    conMayuscula.forEach((l, i) => {
      if (filas[i]) frecPorLema.set(l, filas[i]!.rango);
    });
  }

  // Donde la pronunciación va aparte, se escribe la de cada forma: went no suena como go.
  const { lectura: lecturaDeLengua } = lengua();
  const dePronunciacion = lecturaDeLengua.dePronunciacion;
  const formas = dePronunciacion ? [...new Set(tokensPorLinea.flat().filter((tk) => tk.esPalabra).map((tk) => tk.superficie.toLowerCase()))] : [];
  const filasForma = formas.length ? await db.acentos.bulkGet(formas.map((s) => [s, s] as [string, string])) : [];
  const porForma = new Map(formas.map((s, i) => [s, filasForma[i]?.transcripciones]));

  const glosasIA = await db.glosas.bulkGet(unicas.map(([k]) => k));
  const lemas = [...new Set(unicas.map(([, v]) => v.lema))];
  const filasTerminos = lemas.length ? await db.terminos.where('termino').anyOf(lemas).toArray() : [];
  const porTermino = new Map<string, FilaTermino[]>();
  for (const f of filasTerminos) {
    const l = porTermino.get(f.termino);
    if (l) l.push(f);
    else porTermino.set(f.termino, [f]);
  }

  const datos = new Map<string, { fila?: FilaPalabraDb; acentos?: number[]; rango?: number; glosa?: string; transcripciones?: Transcripcion[] }>();
  unicas.forEach(([k, v], i) => {
    datos.set(k, {
      fila: filasPalabra[i],
      acentos: filasAcento[i]?.posiciones,
      transcripciones: filasAcento[i]?.transcripciones,
      rango: filasFrec[i]?.rango ?? frecPorLema.get(v.lema),
      glosa: glosasIA[i]?.glosa ?? glosaCorta(porTermino.get(v.lema) ?? [], orden, v.lectura, v.categoria),
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
      const deLaForma = dePronunciacion && (porForma.get(tk.superficie.toLowerCase()) ?? d.transcripciones);
      return {
        superficie: tk.superficie,
        lema: tk.lema,
        lectura: tk.lectura,
        lecturaLema: l,
        clave,
        esPalabra: true,
        esGramatica: tk.esGramatica,
        flexion: tk.flexion,
        furigana: deLaForma ? [{ texto: tk.superficie, lectura: dePronunciacion(deLaForma) }] : tk.furigana,
        ...(dePronunciacion && d.transcripciones ? { pronunciacion: dePronunciacion(d.transcripciones) } : {}),
        estado: d.fila?.estado ?? porDefecto,
        rastreada: d.fila?.rastreada === 1,
        acentos,
        patron: acentos && !tk.esGramatica ? lengua().acento?.patron(acentos[0], l) : undefined,
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
  return motorLengua().detectarGramatica(texto);
}

export async function analizarLineas(
  lineas: Linea[],
  a: Ajustes,
  fuente?: { titulo?: string; url?: string; idVideo?: string }
): Promise<LineaAnalizada[]> {
  await preparar();
  const filas = await db.analisis.bulkGet(lineas.map((l) => claveLinea(l.texto)));
  const tokens = lineas.map((l, i) => {
    const base = tokensDe(l.texto);
    return filas[i]?.lecturas.length ? aplicarLecturas(base, filas[i]!.lecturas, lengua().lectura) : base;
  });
  const palabras = await enriquecer(tokens, a);
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

export async function analizarTexto(texto: string, a: Ajustes, opciones?: OpcionesAnalisis): Promise<PalabraToken[][]> {
  await preparar();
  return enriquecer(texto.split(/\r?\n/).map((l) => tokensDe(l, opciones)), a);
}

/** Texto para el análisis profundo: cada línea con las palabras y lecturas que calculó el analizador. */
export async function entradasAnalisis(lineas: Linea[]): Promise<{ texto: string; palabras: string; clave: string; pendiente: boolean }[]> {
  await preparar();
  const hechas = await db.analisis.bulkGet(lineas.map((l) => claveLinea(l.texto)));
  return lineas.map((l, i) => ({
    texto: l.texto.replace(/\n/g, ' '),
    palabras: tokensDe(l.texto)
      .filter((x) => x.esPalabra)
      .map((x) => motorLengua().describirPalabra?.(x) ?? (x.lectura && x.lectura !== x.superficie ? `${x.superficie}(${x.lectura})` : x.superficie))
      .join(' '),
    clave: claveLinea(l.texto),
    pendiente: !hechas[i] && lengua().escritura.tieneTexto(l.texto),
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

export async function buscar(lema: string, lecturaPedida?: string): Promise<ResultadoBusqueda> {
  const { escritura, lectura: lecturas, acento: acentoLengua } = lengua();
  // Donde la lectura no distingue palabras, lo que venga es la pronunciación de una tarjeta: aquí no significa nada.
  const lectura = lecturas.distingue ? lecturaPedida : undefined;
  const lista = await listaDiccionarios();
  const dics = lista.filter((d) => d.tipo === 'terminos');
  const titulos = new Map(dics.map((d) => [d.id, d.titulo]));
  const ordenDic = new Map(dics.map((d, i) => [d.id, i]));

  let filas = await db.terminos.where('termino').equals(lema).toArray();
  if (!filas.length && lecturas.esSoloLectura(lema)) {
    filas = await db.terminos.where('lectura').equals(lecturas.normalizar(lema)).limit(60).toArray();
  }
  const lecturaFinal = (lecturas.distingue ? lectura || filas.sort((a, b) => b.puntuacion - a.puntuacion)[0]?.lectura : lema) || (escritura.tieneTexto(lema) ? lecturas.normalizar(lema) : '');
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
    const minuscula = lema.toLocaleLowerCase();
    const f =
      (await db.frecuencias.get([d.id, lema, lecturaFinal])) ??
      (await db.frecuencias.get([d.id, lema, ''])) ??
      // Las listas vienen en minúsculas: un sustantivo alemán, Kind, está como «kind».
      (minuscula !== lema ? await db.frecuencias.get([d.id, minuscula, minuscula]) : undefined);
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
    patron: acentos.length ? acentoLengua?.patron(acentos[0], lecturaFinal) : undefined,
    pronunciaciones: acento?.transcripciones,
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
  await preparar();
  const [palabras] = await enriquecer([tokensDe(limpio)], a);
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
  const unirSinEspacios = (lista: string[]) => Array.from({ length: Math.max(0, Math.min(lista.length, 6) - 1) }, (_, i) => lista.slice(0, Math.min(lista.length, 6) - i).join(''));
  const existe = terminos ? (x: string) => terminos!.has(x) : undefined;
  for (const candidato of motorLengua().candidatosCompuestos?.(superficies, existe, consultas) ?? unirSinEspacios(superficies)) {
    if (terminos?.has(candidato)) {
      const r = await buscar(candidato);
      if (r.entradas.length) salida.push(r);
    }
  }
  return salida;
}
