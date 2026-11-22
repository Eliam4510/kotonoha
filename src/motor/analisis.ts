// Tokeniza texto y lo enriquece con lecturas, acento, frecuencia, glosas y tu estado de aprendizaje.

import type { Ajustes } from '../compartido/ajustes';
import type {
  CuentaTexto,
  DatoPalabra,
  EntradaDiccionario,
  EstadoPalabra,
  EtiquetaFrecuencia,
  FraseEjemplo,
  LineaAnalizada,
  PalabraContada,
  PalabraToken,
  ResultadoBusqueda,
  TrozoTexto,
} from '../compartido/tipos';
import type { Linea } from '../nucleo/subtitulos';
import { type AnalisisLinea, aplicarLecturas } from '../nucleo/analisisProfundo';
import { partirEnFrases } from '../nucleo/lectorTexto';
import { type PalabraDeFrase, Recuento } from '../nucleo/vocabulario';
import type { ConsultasAnalisis, FormaFlexionada, OpcionesAnalisis, PuntoGramatica, TokenUnido, Transcripcion } from '../lenguas/tipos';
import { db, type FilaPalabraDb, type FilaTermino } from './db';
import { listaDiccionarios } from './diccionarios';
import { lengua, motorLengua } from './lengua';
import { nivelesDeVocabulario } from './niveles';

let terminos: Set<string> | null = null;
/** En las lenguas que lo usan, de qué palabras sale cada forma flexionada (ging, de gehen) y cuánto se usa cada una. */
let formas: Map<string, FormaFlexionada[]> | null = null;
let rangos: Map<string, number> | null = null;
/** En las lenguas que lo usan, cómo lee cada término el diccionario: en chino, 长 es cháng o zhǎng. */
let lecturas: Map<string, string[]> | null = null;
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
  lecturas: Map<string, string[]> | null;
} | null = null;

/** Lo que el analizador puede preguntar de los diccionarios sin esperar a la base. */
const consultas: ConsultasAnalisis = {
  formas: (palabra) => formas?.get(palabra),
  // Las listas de frecuencia vienen en minúsculas: Essen cuenta como «essen».
  rango: (termino) => rangos?.get(termino) ?? rangos?.get(termino.toLocaleLowerCase()),
  lecturas: (termino) => lecturas?.get(termino),
};

/** Las lecturas de todos los diccionarios, juntas y sin repetir: la misma puede venir en varios. */
async function leerLecturas(): Promise<Map<string, string[]>> {
  const salida = new Map<string, string[]>();
  for (const f of await db.lecturas.toArray()) {
    const previas = salida.get(f.termino);
    if (!previas) salida.set(f.termino, f.lecturas);
    else for (const l of f.lecturas) if (!previas.includes(l)) previas.push(l);
  }
  return salida;
}

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
  const conLecturas = !!motorLengua().lecturasDeDiccionario;
  cargaTerminos = (async () => {
    const claves = (await db.terminos.orderBy('termino').uniqueKeys()) as string[];
    const nuevasFormas = conFormas ? await leerFormas() : null;
    const nuevasLecturas = conLecturas ? await leerLecturas() : null;
    // La frecuencia decide entre dos lemas (alemán) o cómo partir un texto sin espacios (chino).
    const nuevosRangos = conFormas || conLecturas ? await leerRangos() : null;
    // Una carga larga puede acabar después de cambiar de lengua: lo que traiga ya no sirve.
    if (esta !== ultimaCarga) return;
    terminos = new Set(claves);
    formas = nuevasFormas;
    rangos = nuevosRangos;
    lecturas = nuevasLecturas;
    lenguaTerminos = id;
    cacheTokens.clear();
    cacheGlosas.clear();
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
  const salientes = terminos && lenguaTerminos && lenguaTerminos !== id ? { lengua: lenguaTerminos, terminos, formas, rangos, lecturas } : null;
  if (terminosAnteriores?.lengua === id) {
    ({ terminos, formas, rangos, lecturas } = terminosAnteriores);
    lenguaTerminos = id;
  } else {
    terminos = null;
    formas = null;
    rangos = null;
    lecturas = null;
    lenguaTerminos = '';
  }
  terminosAnteriores = salientes ?? terminosAnteriores;
  cargaTerminos = null;
  cacheTokens.clear();
  cacheLecturaLema.clear();
  cacheGlosas.clear();
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

type DatosDeClave = { fila?: FilaPalabraDb; acentos?: number[]; rango?: number; glosa?: string; transcripciones?: Transcripcion[] };

type ClaveConDatos = [string, { lema: string; lectura: string; categoria: string }];

/**
 * Lo que dicen la base y los diccionarios de unas palabras: tu progreso, su acento, su puesto en la primera lista de
 * frecuencia y su glosa corta. Sin `acentos` o sin `glosas`, eso no se busca: la glosa es lo que más tarda, porque hay
 * que leer todas las entradas de cada palabra.
 */
async function datosDe(unicas: ClaveConDatos[], o = { acentos: true, glosas: true }): Promise<Map<string, DatosDeClave>> {
  const [filasPalabra, filasAcento, dicFrec, orden] = await Promise.all([
    db.palabras.bulkGet(unicas.map(([k]) => k)),
    o.acentos ? db.acentos.bulkGet(unicas.map(([, v]) => [v.lema, v.lectura] as [string, string])) : Promise.resolve([]),
    primerDicFrecuencia(),
    ordenDics(),
  ]);
  const filasFrec = dicFrec
    ? await db.frecuencias.bulkGet(unicas.map(([, v]) => [dicFrec, v.lema, v.lectura] as [string, string, string]))
    : [];
  // Sin su lectura: las que no la traen, y las listas sencillas, que guardan la palabra como su lectura (FrequencyWords).
  // En chino la lectura es el pinyin, así que solo así se encuentran.
  const faltanFrec = dicFrec
    ? unicas.filter((_, i) => !filasFrec[i]).flatMap(([, v]) => [[dicFrec, v.lema, ''], [dicFrec, v.lema, v.lema]] as [string, string, string][])
    : [];
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

  const glosas = o.glosas ? await glosasDe(unicas, orden) : [];

  const datos = new Map<string, DatosDeClave>();
  unicas.forEach(([k, v], i) => {
    datos.set(k, {
      fila: filasPalabra[i],
      acentos: filasAcento[i]?.posiciones,
      transcripciones: filasAcento[i]?.transcripciones,
      rango: filasFrec[i]?.rango ?? frecPorLema.get(v.lema),
      glosa: glosas[i],
    });
  });
  return datos;
}

/**
 * Hasta qué puesto de la lista de frecuencia se cambia una palabra en hiragana que tiene entradas con su forma, pero de
 * otra clase, por la que se lee igual y sí es de su clase. Medido con JPDB: 事 (15), 成る (16) o 物 (43) entran; 大 (379),
 * 生む (403) o 門 (1653), que salían por だい, うむ o もん cuando el analizador se equivoca de clase, no.
 */
const RANGO_PARA_CAMBIAR = 300;
/**
 * Lo mismo con una palabra sin ninguna entrada con su forma, como ある o だけ (丈, 37), que así deja de quedarse sin glosa:
 * más allá de este puesto, lo que se lee igual suele ser otra cosa (いつか no es 五日, 6361).
 */
const RANGO_SIN_ENTRADA = 5000;

/**
 * La glosa corta de unas palabras: la que dio Claude para esa palabra si la hay, y si no, la del primer diccionario. Una
 * palabra que puede estar en el diccionario con otra forma (en japonés, la escrita en hiragana) y no tiene por la suya
 * ninguna entrada de su clase se busca también por su lectura: なる es 成る, もの es 物, y ある o いう, que JMdict solo
 * guarda con kanji, dejan de quedarse sin glosa.
 */
async function glosasDe(unicas: ClaveConDatos[], orden: string[]): Promise<(string | undefined)[]> {
  const glosasIA = await db.glosas.bulkGet(unicas.map(([k]) => k));
  const lemas = [...new Set(unicas.map(([, v]) => v.lema))];
  const filasTerminos = lemas.length ? await db.terminos.where('termino').anyOf(lemas).toArray() : [];
  const porTermino = new Map<string, FilaTermino[]>();
  const anadir = (clave: string, f: FilaTermino) => {
    const l = porTermino.get(clave);
    if (l) l.push(f);
    else porTermino.set(clave, [f]);
  };
  for (const f of filasTerminos) anadir(f.termino, f);
  const porSuLectura = motorLengua().porLectura;
  if (porSuLectura) {
    const deSuClase = (f: FilaTermino, v: ClaveConDatos[1]) => f.lectura === v.lectura && porSuLectura.deSuClase(v.categoria, f.tags);
    // Solo las que no tienen, con su forma, ninguna entrada de su clase: かたがた (旁) se queda como está, なる no.
    const sinLaSuya = new Map<string, ClaveConDatos[1]>();
    for (const [, v] of unicas) if (porSuLectura.busca(v.lema) && !(porTermino.get(v.lema) ?? []).some((f) => deSuClase(f, v))) sinLaSuya.set(v.lema, v);
    if (sinLaSuya.size) {
      const porLectura = new Map<string, FilaTermino[]>();
      for (const f of await db.terminos.where('lectura').anyOf([...sinLaSuya.keys()]).toArray()) {
        const v = sinLaSuya.get(f.lectura);
        if (!v || f.termino === f.lectura || !deSuClase(f, v)) continue;
        porLectura.set(f.lectura, [...(porLectura.get(f.lectura) ?? []), f]);
      }
      // Varias se leen igual y son de la misma clase (成る, 生る, 鳴る): se queda la más usada según la lista de frecuencia.
      const dicFrec = await primerDicFrecuencia();
      const pares = [...porLectura].flatMap(([lema, fs]) => [...new Set(fs.map((f) => f.termino))].map((t) => [lema, t] as [string, string]));
      const rangos = dicFrec && pares.length ? await db.frecuencias.bulkGet(pares.map(([lema, t]) => [dicFrec, t, lema] as [string, string, string])) : [];
      const rango = new Map(pares.map(([lema, t], i) => [`${lema}|${t}`, rangos[i]?.rango ?? Number.MAX_SAFE_INTEGER]));
      for (const [lema, fs] of porLectura) {
        const mejor = [...fs].sort((a, b) => rango.get(`${lema}|${a.termino}`)! - rango.get(`${lema}|${b.termino}`)! || b.puntuacion - a.puntuacion)[0];
        // Si con su forma hay entradas, aunque de otra clase, solo se cambia por una muy usada: el analizador también se
        // equivoca de clase, y だい en 誰だい es la partícula, no 大.
        const tope = porTermino.get(lema)?.length ? RANGO_PARA_CAMBIAR : RANGO_SIN_ENTRADA;
        if (rango.get(`${lema}|${mejor.termino}`)! > tope) continue;
        porTermino.set(lema, fs.filter((f) => f.termino === mejor.termino));
      }
    }
  }
  return unicas.map(([, v], i) => glosasIA[i]?.glosa ?? glosaCorta(porTermino.get(v.lema) ?? [], orden, v.lectura, v.categoria));
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
  const datos = await datosDe([...claves.entries()]);

  // Donde la pronunciación va aparte, se escribe la de cada forma: went no suena como go.
  const { lectura: lecturaDeLengua } = lengua();
  const dePronunciacion = lecturaDeLengua.dePronunciacion;
  const formas = dePronunciacion ? [...new Set(tokensPorLinea.flat().filter((tk) => tk.esPalabra).map((tk) => tk.superficie.toLowerCase()))] : [];
  const filasForma = formas.length ? await db.acentos.bulkGet(formas.map((s) => [s, s] as [string, string])) : [];
  const porForma = new Map(formas.map((s, i) => [s, filasForma[i]?.transcripciones]));

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
        patron: acentos && !tk.esGramatica ? lengua().acento?.patron?.(acentos[0], l) : undefined,
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
  // Una pista en otra forma de la lengua (en chino, en tradicionales) se analiza y se ve ya cambiada; también lo que
  // transcribe Whisper, que pasa por aquí como cualquier pista.
  const normalizar = motorLengua().normalizarTexto;
  if (normalizar) lineas = lineas.map((l) => ({ ...l, texto: normalizar(l.texto) }));
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

/** Cada cuántas frases se deja respirar al motor al contar un libro: mientras tanto, el video que se ve sigue analizándose. */
const FRASES_POR_RESPIRO = 300;

/** Entre dos citas seguidas, 「…」「…」, habla otro: son dos frases aunque la primera no acabe en 。. */
const ENTRE_CITAS = /(?<=[」』])(?=[「『])/;

/**
 * Las palabras y la gramática de unos trozos de un libro, contadas: cuántas veces sale cada palabra, dónde sale por
 * primera vez y sus mejores frases. Sin la caché de líneas, que es para los subtítulos: un libro la vaciaría.
 */
export async function contarPalabras(trozos: TrozoTexto[]): Promise<CuentaTexto> {
  await preparar();
  const { escritura } = lengua();
  const m = motorLengua();
  const existe = terminos ? (x: string) => terminos!.has(x) : undefined;
  const recuento = new Recuento(!escritura.palabrasSeparadas);
  let desdeRespiro = 0;
  for (const t of trozos) {
    // Las frases como al leer en voz alta: un signo de cierre (」, ”) se queda con su frase y no empieza la siguiente.
    const frases = t.texto.split(/\r?\n/).flatMap((r) => r.split(ENTRE_CITAS)).flatMap((r) => partirEnFrases(r, escritura.frase));
    for (const frase of frases) {
      if (!escritura.tieneTexto(frase)) continue;
      const palabras: PalabraDeFrase[] = [];
      for (const tk of m.analizador.analizar(frase, existe, consultas)) {
        if (!tk.esPalabra) continue;
        const l = lecturaLema(tk);
        palabras.push({ clave: claveDe(tk.lema, l), lema: tk.lema, lectura: l, categoria: tk.categoria, superficie: tk.superficie, gramatica: tk.esGramatica, nombre: !!tk.nombre });
      }
      recuento.frase(frase, t.lugar, palabras, m.detectarGramatica(frase));
      if (++desdeRespiro >= FRASES_POR_RESPIRO) {
        desdeRespiro = 0;
        await new Promise((ok) => setTimeout(ok, 0));
      }
    }
  }
  return recuento.resultado();
}

/**
 * Lo que se sabe de unas palabras contadas, en el mismo orden: tu progreso y, salvo con `soloEstado`, su puesto en la
 * lista de frecuencia y su nivel en las listas del examen de la lengua. Sin la glosa, que tarda: va aparte.
 */
export async function datosPalabras(
  palabras: Pick<PalabraContada, 'clave' | 'lema' | 'lectura' | 'categoria' | 'gramatica'>[],
  a: Ajustes,
  soloEstado = false
): Promise<DatoPalabra[]> {
  const porDefecto = (p: (typeof palabras)[number]): EstadoPalabra => (p.gramatica && a.particulasConocidas ? 'conocida' : 'desconocida');
  if (soloEstado) {
    const filas = await db.palabras.bulkGet(palabras.map((p) => p.clave));
    return palabras.map((p, i) => ({ estado: filas[i]?.estado ?? porDefecto(p), rastreada: filas[i]?.rastreada === 1 }));
  }
  const datos = await datosDe(
    palabras.map((p) => [p.clave, { lema: p.lema, lectura: p.lectura, categoria: p.categoria }]),
    { acentos: false, glosas: false }
  );
  const carpeta = lengua().listasNivel?.carpeta;
  const niveles = carpeta ? await nivelesDeVocabulario(carpeta).catch(() => null) : null;
  return palabras.map((p) => {
    const d = datos.get(p.clave);
    const nivel = niveles?.get(p.clave);
    return {
      estado: d?.fila?.estado ?? porDefecto(p),
      rastreada: d?.fila?.rastreada === 1,
      ...(d?.rango !== undefined ? { rango: d.rango } : {}),
      ...(nivel ? { nivel } : {}),
    };
  });
}

/** Las glosas ya buscadas, por palabra: el vocabulario de una colección repite muchas de un tomo a otro. */
const cacheGlosas = new Map<string, string | null>();

/** La glosa corta de unas palabras contadas, en el mismo orden; null si no hay. */
export async function glosasPalabras(palabras: Pick<PalabraContada, 'clave' | 'lema' | 'lectura' | 'categoria'>[]): Promise<(string | null)[]> {
  const faltan = palabras.filter((p) => !cacheGlosas.has(p.clave));
  if (faltan.length) {
    // Salen de la base, no de la lista de términos en memoria: no hay que esperar a que se cargue al arrancar el motor.
    const glosas = await glosasDe(faltan.map((p) => [p.clave, { lema: p.lema, lectura: p.lectura, categoria: p.categoria }]), await ordenDics());
    if (cacheGlosas.size > 60000) cacheGlosas.clear();
    faltan.forEach((p, i) => cacheGlosas.set(p.clave, glosas[i] ?? null));
  }
  return palabras.map((p) => cacheGlosas.get(p.clave) ?? null);
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

/** Frases ya vistas que llevan un carácter, las más recientes primero: el kanji en lo que has visto tú. */
export async function frasesConCaracter(caracter: string, limite = 12): Promise<FraseEjemplo[]> {
  const filas = await db.frases
    .orderBy('creada')
    .reverse()
    .filter((f) => f.texto.includes(caracter))
    .limit(limite * 3)
    .toArray();
  // Las cortas se leen mejor; entre las recientes, se prefieren ellas.
  return filas
    .sort((a, b) => Math.min(a.texto.length, 60) - Math.min(b.texto.length, 60))
    .slice(0, limite)
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
    // La fila con las grafías de la palabra (日本, にほん★, にっぽん★) que añade Yomitan a JMdict no es una definición.
    .filter((f) => ordenDic.has(f.dic) && !f.tags?.split(' ').includes('forms'))
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
    patron: acentos.length ? acentoLengua?.patron?.(acentos[0], lecturaFinal) : undefined,
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
