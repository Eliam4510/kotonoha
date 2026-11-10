// El diccionario más allá de buscar una palabra: buscar por significado, las categorías para explorar (onomatopeyas,
// refranes…) y los homófonos. Las dos primeras necesitan recorrer todas las entradas una vez; el índice queda en memoria
// mientras el motor está abierto y se rehace si cambian la lengua o los diccionarios.

import { buscarPorSignificado as buscarEnIndice, clasesDe, type ConSignificado, type EntradaBreve, indiceDeSignificados, ordenarEntradas, sinonimosDe } from '../nucleo/explorar';
import { db } from './db';
import { listaDiccionarios } from './diccionarios';
import { lengua } from './lengua';

/** La etiqueta de JMdict (en el formato de Yomitan) de las palabras de uso común. */
const COMUN = String.fromCodePoint(0x2b50);

interface Indice {
  firma: string;
  categorias: Map<string, EntradaBreve[]>;
  comunes: EntradaBreve[];
  /** Para los sinónimos: cada significado con sus palabras, y cada palabra por su clave. Se hacen la primera vez. */
  significados?: Map<string, ConSignificado[]>;
  porClave?: Map<string, EntradaBreve>;
}

let indice: Promise<Indice> | null = null;

/** Cuántas filas del diccionario se leen de una vez al hacer el índice. */
const TANDA_INDICE = 40000;

async function diccionariosDeTerminos() {
  return (await listaDiccionarios()).filter((d) => d.tipo === 'terminos');
}

/** Cambia cuando cambia lo que se guarda en el índice: lo guardado por una versión anterior se rehace. */
const VERSION_INDICE = 1;

/** Con los mismos diccionarios, en el mismo orden, y las mismas categorías, el índice es el mismo. */
async function firmaActual(): Promise<string> {
  const categorias = (lengua().categoriasDiccionario ?? []).map((c) => `${c.id}=${c.etiquetas.join('+')}`).join(',');
  return `${VERSION_INDICE}|${lengua().id}|${(await diccionariosDeTerminos()).map((d) => `${d.id}:${d.filas}:${d.instalado}`).join(',')}|${categorias}`;
}

type EntradaConOrden = EntradaBreve & { orden: number };

/** La fila con las grafías de una palabra (ネコ, 猫（★）) que añade Yomitan a JMdict: no son significados. */
const esDeFormas = (tags: string | undefined) => !!tags && tags.split(' ').includes('forms');

/**
 * Junta una fila del diccionario con lo que ya había de esa palabra en una lista. Cada fila es un sentido: se guardan en
 * orden y con su diccionario, para los sinónimos.
 */
function anadir(mapa: Map<string, EntradaConOrden>, f: { termino: string; lectura: string; glosas: string[]; puntuacion: number; tags?: string }, orden: number, comun: boolean) {
  const clave = `${f.termino}|${f.lectura}`;
  const glosas = esDeFormas(f.tags) ? [] : f.glosas;
  const clases = clasesDe(f.tags ?? '');
  const previa = mapa.get(clave);
  if (!previa) {
    mapa.set(clave, { termino: f.termino, lectura: f.lectura, glosa: glosas[0] ?? '', glosas: [...glosas], comun, puntuacion: f.puntuacion, orden, sentidos: glosas.length ? [{ dic: orden, glosas }] : [], clases });
    return;
  }
  previa.glosas.push(...glosas);
  if (glosas.length) previa.sentidos?.push({ dic: orden, glosas });
  for (const c of clases) if (!previa.clases?.includes(c)) previa.clases?.push(c);
  previa.comun ||= comun;
  previa.puntuacion = Math.max(previa.puntuacion, f.puntuacion);
  // La glosa que se enseña es la del primer diccionario de los ajustes: el del idioma de quien estudia.
  if ((orden < previa.orden || !previa.glosa) && glosas[0]) {
    previa.glosa = glosas[0];
    previa.orden = orden;
  }
}

const sinOrden = ({ orden: _, ...e }: EntradaConOrden): EntradaBreve => e;

async function construir(firma: string): Promise<Indice> {
  const dics = await diccionariosDeTerminos();
  const orden = new Map(dics.map((d, i) => [d.id, i]));
  const categorias = lengua().categoriasDiccionario ?? [];
  const porEtiqueta = new Map<string, string[]>();
  for (const c of categorias) for (const e of c.etiquetas) porEtiqueta.set(e, [...(porEtiqueta.get(e) ?? []), c.id]);
  const comunes = new Map<string, EntradaConOrden>();
  // Cada categoría junta solo las filas con su etiqueta: キー la onomatopeya (un chirrido) no es キー la llave.
  const enCategoria = new Map<string, Map<string, EntradaConOrden>>(categorias.map((c) => [c.id, new Map()]));
  const vale = new Map(categorias.map((c) => [c.id, c.vale]));
  // Por tandas y no fila a fila: leer casi un millón de filas con un cursor tarda varias veces más. Entre tanda y tanda
  // se cede el paso, para que el motor siga atendiendo lo que se le pida mientras tanto.
  let ultima = 0;
  for (;;) {
    const filas = await db.terminos.where(':id').above(ultima).limit(TANDA_INDICE).toArray();
    if (!filas.length) break;
    for (const f of filas) {
      const o = orden.get(f.dic);
      if (o === undefined || !f.tags) continue;
      const etiquetas = f.tags.split(' ');
      const comun = etiquetas.includes(COMUN);
      if (comun) anadir(comunes, f, o, true);
      for (const c of new Set(etiquetas.flatMap((t) => porEtiqueta.get(t) ?? []))) {
        if (vale.get(c)?.(f.termino) ?? true) anadir(enCategoria.get(c)!, f, o, comun);
      }
    }
    ultima = filas[filas.length - 1].id ?? Infinity;
    await new Promise((r) => setTimeout(r, 0));
  }
  return {
    firma,
    categorias: new Map([...enCategoria].map(([id, m]) => [id, ordenarEntradas([...m.values()].map(sinOrden))])),
    comunes: [...comunes.values()].map(sinOrden),
  };
}

const CLAVE_INDICE = 'explorar';

/** El índice ya hecho con estos mismos diccionarios, si se guardó: leerlo es cosa de un instante. */
async function guardado(firma: string): Promise<Indice | null> {
  const fila = await db.indices.get(CLAVE_INDICE).catch(() => null);
  if (!fila || fila.firma !== firma) return null;
  const d = fila.datos as { categorias: [string, EntradaBreve[]][]; comunes: EntradaBreve[] };
  return { firma, categorias: new Map(d.categorias), comunes: d.comunes };
}

async function construirYGuardar(firma: string): Promise<Indice> {
  // La base de ahora: si se cambia de lengua mientras se hace, se guarda en la suya.
  const base = db;
  const nuevo = await construir(firma);
  // Si no cabe o falla al guardar, se usa igual: solo habrá que rehacerlo la próxima vez.
  await base.indices.put({ clave: CLAVE_INDICE, firma, datos: { categorias: [...nuevo.categorias], comunes: nuevo.comunes }, creado: Date.now() }).catch(() => {});
  return nuevo;
}

async function indiceActual(): Promise<Indice> {
  const firma = await firmaActual();
  const previo = indice ? await indice.catch(() => null) : null;
  if (previo?.firma === firma) return previo;
  indice = guardado(firma).then((g) => g ?? construirYGuardar(firma));
  indice.catch(() => (indice = null));
  return indice;
}

/**
 * Deja el índice listo antes de que haga falta: al arrancar el motor, sin que nadie espere por él. Solo donde se usa, en
 * las lenguas con categorías para explorar o con página para sus caracteres.
 */
export function precalentar(): void {
  if (!lengua().categoriasDiccionario?.length && !lengua().paginaCaracter) return;
  indiceActual().catch(() => {});
}

/** Sin las glosas completas, los sentidos ni las categorías, que solo hacen falta para buscar: viaja más ligera. */
const ligera = ({ sentidos: _, clases: __, ...e }: EntradaBreve): EntradaBreve => ({ ...e, glosas: e.glosas.slice(0, 3) });

const esComun = (tags: string | undefined) => !!tags && tags.split(' ').includes(COMUN);

/** Lo que ya se sabe de cada palabra de una lista: en las tarjetas se ve de un vistazo cuáles conoces. */
async function conEstados(xs: EntradaBreve[]): Promise<EntradaBreve[]> {
  if (!xs.length) return xs;
  const filas = await db.palabras.bulkGet(xs.map((e) => `${e.termino}|${e.lectura}`));
  return xs.map((e, i) => {
    const estado = filas[i]?.estado;
    return estado && estado !== 'desconocida' ? { ...e, estado } : e;
  });
}

/**
 * Ordena por la lista de frecuencia instalada, si hay: lo que más se oye y se lee de verdad va antes. Las de uso común
 * siguen delante de las demás; sin lista, se queda como venía.
 */
async function porFrecuencia(xs: EntradaBreve[]): Promise<EntradaBreve[]> {
  const dic = (await listaDiccionarios()).find((d) => d.tipo === 'frecuencia');
  if (!dic || xs.length < 2) return xs;
  const filas = await db.frecuencias.bulkGet(xs.map((e) => [dic.id, e.termino, e.lectura]));
  const sinLectura = await db.frecuencias.bulkGet(xs.map((e) => [dic.id, e.termino, '']));
  const rango = (i: number) => filas[i]?.rango ?? sinLectura[i]?.rango ?? Infinity;
  return xs
    .map((e, i) => ({ e, r: rango(i), i }))
    .sort((a, b) => Number(b.e.comun) - Number(a.e.comun) || a.r - b.r || a.i - b.i)
    .map((x) => x.e);
}

export async function buscarPorSignificado(texto: string, limite = 30): Promise<EntradaBreve[]> {
  return conEstados(buscarEnIndice((await indiceActual()).comunes, texto, limite).map(ligera));
}

export async function categoriaDiccionario(id: string, desde = 0, limite = 100): Promise<{ filas: EntradaBreve[]; total: number }> {
  const todas = (await indiceActual()).categorias.get(id) ?? [];
  return { filas: await conEstados(todas.slice(desde, desde + limite).map(ligera)), total: todas.length };
}

/**
 * Las palabras de uso común de una categoría que llevan un carácter, sin él solo: las de lectura especial con 今, por
 * ejemplo. Solo las comunes: las demás suelen ser grafías raras de palabras que se escriben de otra forma.
 */
export async function categoriaConCaracter(id: string, caracter: string, limite = 24): Promise<EntradaBreve[]> {
  const todas = (await indiceActual()).categorias.get(id) ?? [];
  const con = todas.filter((e) => e.comun && e.termino !== caracter && e.termino.includes(caracter) && e.glosas.length);
  return conEstados((await porFrecuencia(con.slice(0, limite * 4))).slice(0, limite).map(ligera));
}

/** Cuántas filas del diccionario se miran como mucho al buscar por el principio: de sobra para las comunes. */
const FILAS_PREFIJO = 4000;

/**
 * La lista de resultados del diccionario: primero las palabras que son justo lo buscado (por su escritura o, si se
 * escribió solo la lectura, por ella: のむ da 飲む y 呑む), y después las que empiezan por ello (日本 da 日本語 y 日本人).
 */
export async function resultadosDeBusqueda(texto: string, limite = 40): Promise<EntradaBreve[]> {
  const q = texto.trim();
  if (!q) return [];
  const { lectura } = lengua();
  const porLectura = lectura.distingue && lectura.esSoloLectura(q);
  const buscado = porLectura ? lectura.normalizar(q) : q;
  const orden = new Map((await diccionariosDeTerminos()).map((d, i) => [d.id, i]));
  const exactas = new Map<string, EntradaConOrden>();
  const empiezan = new Map<string, EntradaConOrden>();
  const indice = db.terminos.where(porLectura ? 'lectura' : 'termino');
  // Donde la lectura no distingue palabras, tampoco las mayúsculas: «haus» encuentra Haus.
  const filas = await (lectura.distingue ? indice.startsWith(buscado) : indice.startsWithIgnoreCase(buscado)).limit(FILAS_PREFIJO).toArray();
  const igual = (x: string) => (lectura.distingue ? x === buscado : x.toLocaleLowerCase() === buscado.toLocaleLowerCase());
  for (const f of filas) {
    const o = orden.get(f.dic);
    if (o === undefined) continue;
    const exacta = igual(porLectura ? f.lectura : f.termino);
    // Por la lectura, lo que solo empieza igual suele ser ruido (のむ no busca 野村): de eso, solo lo de uso común.
    if (!exacta && porLectura && !esComun(f.tags)) continue;
    anadir(exacta ? exactas : empiezan, f, o, esComun(f.tags));
  }
  const ordenar = async (m: Map<string, EntradaConOrden>) => porFrecuencia(ordenarEntradas([...m.values()].filter((e) => e.glosas.length).map(sinOrden)));
  const lista = [...(await ordenar(exactas)), ...(await ordenar(empiezan))];
  return conEstados(lista.slice(0, limite).map(ligera));
}

/**
 * Las palabras de uso común que llevan un carácter, sin él solo: 愛情, 恋愛 y 愛する para 愛. Las que más se usan
 * primero, con cuántas hay en total.
 */
export async function palabrasConCaracter(caracter: string, limite = 48): Promise<{ filas: EntradaBreve[]; total: number }> {
  const ind = await indiceActual();
  const todas = ordenarEntradas(ind.comunes.filter((e) => e.termino !== caracter && e.termino.includes(caracter) && e.glosas.length));
  // La lista de frecuencia ordena bien lo que ya es de uso común: se le da una muestra holgada, no todo.
  const ordenadas = await porFrecuencia(todas.slice(0, limite * 4));
  return { filas: await conEstados(ordenadas.slice(0, limite).map(ligera)), total: todas.length };
}

/**
 * Unas palabras concretas en breve, con la glosa del primer diccionario de los ajustes: los opuestos de una palabra o
 * aquellas a las que remite. Con lectura, solo esa; sin ella, la más común.
 */
export async function entradasDe(pares: { termino: string; lectura?: string }[]): Promise<EntradaBreve[]> {
  const orden = new Map((await diccionariosDeTerminos()).map((d, i) => [d.id, i]));
  const salida: EntradaBreve[] = [];
  for (const p of pares.slice(0, 24)) {
    const m = new Map<string, EntradaConOrden>();
    for (const f of await db.terminos.where('termino').equals(p.termino).toArray()) {
      const o = orden.get(f.dic);
      if (o === undefined || (p.lectura && f.lectura !== p.lectura)) continue;
      anadir(m, f, o, esComun(f.tags));
    }
    const mejor = ordenarEntradas([...m.values()].filter((e) => e.glosas.length).map(sinOrden))[0];
    if (mejor && !salida.some((x) => x.termino === mejor.termino && x.lectura === mejor.lectura)) salida.push(ligera(mejor));
  }
  return conEstados(salida);
}

/** Cuántas entradas tiene cada categoría. */
export async function cuentaCategorias(): Promise<Record<string, number>> {
  return Object.fromEntries([...(await indiceActual()).categorias].map(([id, xs]) => [id, xs.length]));
}

/**
 * Las palabras de uso común que significan lo mismo que una: 食う y 召し上がる para 食べる. Solo con los diccionarios que
 * marcan las palabras de uso común (los de la lengua con categorías para explorar): en los demás, la lista sería ruido.
 */
export async function sinonimos(lema: string, lectura: string, limite = 12): Promise<EntradaBreve[]> {
  if (!lengua().categoriasDiccionario?.length) return [];
  const ind = await indiceActual();
  if (!ind.comunes.length) return [];
  ind.significados ??= indiceDeSignificados(ind.comunes);
  ind.porClave ??= new Map(ind.comunes.map((e) => [`${e.termino}|${e.lectura}`, e]));
  let propia = ind.porClave.get(`${lema}|${lectura}`) ?? ind.comunes.find((e) => e.termino === lema);
  if (!propia) {
    // Una palabra que no es de uso común: sus sentidos, del diccionario, como en el índice.
    const orden = new Map((await diccionariosDeTerminos()).map((d, i) => [d.id, i]));
    const filas = (await db.terminos.where('termino').equals(lema).toArray()).filter((f) => orden.has(f.dic) && (!lectura || f.lectura === lectura || !f.lectura) && !esDeFormas(f.tags));
    if (!filas.length) return [];
    const sentidos = filas.map((f) => ({ dic: orden.get(f.dic)!, glosas: f.glosas }));
    const clases = [...new Set(filas.flatMap((f) => clasesDe(f.tags ?? '')))];
    propia = { termino: lema, lectura, glosa: filas[0].glosas[0] ?? '', glosas: filas.flatMap((f) => f.glosas), comun: false, puntuacion: 0, sentidos, clases };
  }
  return conEstados(sinonimosDe(ind.significados, propia, limite).map(ligera));
}

/** Las palabras que se leen igual que una, sin ella: 橋, 箸 y 端 para はし. Las de uso común primero. */
export async function homofonos(lectura: string, excluir: string, limite = 12): Promise<EntradaBreve[]> {
  if (!lectura) return [];
  const dics = await diccionariosDeTerminos();
  const orden = new Map(dics.map((d, i) => [d.id, i]));
  const filas = await db.terminos.where('lectura').equals(lectura).limit(600).toArray();
  const porTermino = new Map<string, EntradaBreve & { orden: number }>();
  for (const f of filas) {
    const o = orden.get(f.dic);
    // La fila de las grafías de una palabra no trae significados: su glosa sería la tabla de formas.
    if (o === undefined || f.termino === excluir || f.termino === lectura || esDeFormas(f.tags)) continue;
    const comun = esComun(f.tags);
    const previa = porTermino.get(f.termino);
    if (!previa) porTermino.set(f.termino, { termino: f.termino, lectura: f.lectura, glosa: f.glosas[0] ?? '', glosas: f.glosas.slice(0, 3), comun, puntuacion: f.puntuacion, orden: o });
    else {
      previa.comun ||= comun;
      previa.puntuacion = Math.max(previa.puntuacion, f.puntuacion);
      if (o < previa.orden && f.glosas[0]) {
        previa.glosa = f.glosas[0];
        previa.orden = o;
      }
    }
  }
  return conEstados(ordenarEntradas([...porTermino.values()].map(({ orden: _, ...e }) => e)).slice(0, limite));
}
