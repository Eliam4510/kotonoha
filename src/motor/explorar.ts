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

async function diccionariosDeTerminos() {
  return (await listaDiccionarios()).filter((d) => d.tipo === 'terminos');
}

async function firmaActual(): Promise<string> {
  return `${lengua().id}|${(await diccionariosDeTerminos()).map((d) => `${d.id}:${d.filas}:${d.instalado}`).join(',')}`;
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
  await db.terminos.each((f) => {
    const o = orden.get(f.dic);
    if (o === undefined) return;
    const etiquetas = f.tags ? f.tags.split(' ') : [];
    const comun = etiquetas.includes(COMUN);
    if (comun) anadir(comunes, f, o, true);
    for (const c of new Set(etiquetas.flatMap((t) => porEtiqueta.get(t) ?? []))) anadir(enCategoria.get(c)!, f, o, comun);
  });
  return {
    firma,
    categorias: new Map([...enCategoria].map(([id, m]) => [id, ordenarEntradas([...m.values()].map(sinOrden))])),
    comunes: [...comunes.values()].map(sinOrden),
  };
}

async function indiceActual(): Promise<Indice> {
  const firma = await firmaActual();
  const previo = indice ? await indice.catch(() => null) : null;
  if (previo?.firma === firma) return previo;
  indice = construir(firma);
  indice.catch(() => (indice = null));
  return indice;
}

/** Sin las glosas completas, los sentidos ni las categorías, que solo hacen falta para buscar: viaja más ligera. */
const ligera = ({ sentidos: _, clases: __, ...e }: EntradaBreve): EntradaBreve => ({ ...e, glosas: e.glosas.slice(0, 3) });

export async function buscarPorSignificado(texto: string, limite = 30): Promise<EntradaBreve[]> {
  return buscarEnIndice((await indiceActual()).comunes, texto, limite).map(ligera);
}

export async function categoriaDiccionario(id: string, desde = 0, limite = 100): Promise<{ filas: EntradaBreve[]; total: number }> {
  const todas = (await indiceActual()).categorias.get(id) ?? [];
  return { filas: todas.slice(desde, desde + limite).map(ligera), total: todas.length };
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
  return sinonimosDe(ind.significados, propia, limite).map(ligera);
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
    if (o === undefined || f.termino === excluir || f.termino === lectura) continue;
    const comun = (f.tags ?? '').split(' ').includes(COMUN);
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
  return ordenarEntradas([...porTermino.values()].map(({ orden: _, ...e }) => e)).slice(0, limite);
}
