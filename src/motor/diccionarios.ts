// Instalación de diccionarios: biblioteca abierta o archivo en formato Yomitan.

import { strFromU8, unzipSync } from 'fflate';
import type { FuenteBiblioteca, InfoDiccionario, ProgresoInstalacion } from '../compartido/tipos';
import { fondo } from '../compartido/rpc';
import { type FrecuenciaImportada, leerBancoMeta, leerBancoTerminos, leerKanjium } from '../nucleo/yomitan';
import { db } from './db';
import { tr } from '../compartido/i18n';
import { motorLengua } from './lengua';

const LOTE = 4000;

function emitir(p: ProgresoInstalacion) {
  fondo.difundir({ tipo: 'instalacion', progreso: p }).catch(() => {});
}

async function descargar(url: string, alAvance: (f: number) => void): Promise<Uint8Array> {
  const r = await fetch(url);
  if (!r.ok || !r.body) throw new Error(tr('Error {0} al descargar', r.status));
  const total = Number(r.headers.get('content-length')) || 0;
  const lector = r.body.getReader();
  const trozos: Uint8Array[] = [];
  let recibido = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    trozos.push(value);
    recibido += value.length;
    if (total) alAvance(recibido / total);
  }
  const salida = new Uint8Array(recibido);
  let pos = 0;
  for (const t of trozos) {
    salida.set(t, pos);
    pos += t.length;
  }
  return salida;
}

async function siguienteOrden(): Promise<number> {
  const todos = await db.diccionarios.toArray();
  return todos.reduce((m, d) => Math.max(m, d.orden), -1) + 1;
}

async function borrarFilas(id: string, tipo?: InfoDiccionario['tipo']) {
  if (tipo === 'terminos' || !tipo) await db.terminos.where('dic').equals(id).delete();
  if (tipo === 'frecuencia' || !tipo) await db.frecuencias.where('dic').equals(id).delete();
  if (tipo === 'acento' || !tipo) await db.acentos.clear();
}

/** Importa un .zip de Yomitan ya descargado. Devuelve el tipo detectado por su contenido. */
async function importarZip(
  id: string,
  titulo: string,
  zip: Uint8Array,
  datos: Partial<FuenteBiblioteca>,
  alAvance: (f: number) => void
): Promise<void> {
  const archivos = unzipSync(zip);
  const nombres = Object.keys(archivos);
  const indice = archivos['index.json'] ? (JSON.parse(strFromU8(archivos['index.json'])) as { title?: string; attribution?: string }) : {};
  const bancos = nombres.filter((n) => /^term(_meta)?_bank_\d+\.json$/.test(n));
  if (!bancos.length) throw new Error(tr('El archivo no contiene un diccionario de términos reconocible'));

  let filasTerminos = 0;
  let filasFrecuencia = 0;
  let filasAcento = 0;
  const orden = await siguienteOrden();
  await borrarFilas(id, 'terminos');
  await borrarFilas(id, 'frecuencia');

  // Una misma palabra puede traer varios rangos (escrita en kanji o en kana): vale el mejor.
  const mejoresRangos = new Map<string, FrecuenciaImportada>();

  for (let i = 0; i < bancos.length; i++) {
    const n = bancos[i];
    const crudo = JSON.parse(strFromU8(archivos[n])) as unknown[][];
    if (n.startsWith('term_bank')) {
      const filas = leerBancoTerminos(crudo).map((f) => ({ ...f, dic: id }));
      for (let j = 0; j < filas.length; j += LOTE) await db.terminos.bulkAdd(filas.slice(j, j + LOTE));
      filasTerminos += filas.length;
    } else {
      const { frecuencias, acentos } = leerBancoMeta(crudo);
      for (const f of frecuencias) {
        const clave = `${f.termino}\u0001${f.lectura}`;
        const previa = mejoresRangos.get(clave);
        if (!previa || f.rango < previa.rango) mejoresRangos.set(clave, f);
      }
      for (let j = 0; j < acentos.length; j += LOTE) await db.acentos.bulkPut(acentos.slice(j, j + LOTE));
      filasAcento += acentos.length;
    }
    alAvance((i + 1) / bancos.length);
  }

  if (mejoresRangos.size) {
    const conDic = [...mejoresRangos.values()].map((f) => ({ ...f, dic: id }));
    for (let j = 0; j < conDic.length; j += LOTE) await db.frecuencias.bulkPut(conDic.slice(j, j + LOTE));
    filasFrecuencia = conDic.length;
  }

  const tipo: InfoDiccionario['tipo'] = filasTerminos ? 'terminos' : filasFrecuencia ? 'frecuencia' : 'acento';
  await db.diccionarios.put({
    id,
    titulo: titulo || indice.title || id,
    tipo,
    idioma: datos.idioma,
    orden,
    filas: filasTerminos + filasFrecuencia + filasAcento,
    fuente: datos.url,
    instalado: Date.now(),
  });
}

export async function instalarDesdeBiblioteca(idFuente: string): Promise<void> {
  const f = motorLengua().diccionarios.find((x) => x.id === idFuente);
  if (!f) throw new Error(tr('Fuente de diccionario desconocida'));
  const progreso = (fase: ProgresoInstalacion['fase'], avance: number, error?: string) =>
    emitir({ id: f.id, titulo: f.titulo, fase, avance, error });
  try {
    progreso('descargando', 0);
    const datos = await descargar(f.url, (a) => progreso('descargando', a));
    progreso('guardando', 0);
    if (f.formato === 'kanjium') {
      const filas = leerKanjium(new TextDecoder().decode(datos));
      await db.acentos.clear();
      for (let j = 0; j < filas.length; j += LOTE) {
        await db.acentos.bulkPut(filas.slice(j, j + LOTE));
        progreso('guardando', j / filas.length);
      }
      await db.diccionarios.put({
        id: f.id,
        titulo: f.titulo,
        tipo: 'acento',
        orden: await siguienteOrden(),
        filas: filas.length,
        fuente: f.url,
        instalado: Date.now(),
      });
    } else {
      await importarZip(f.id, f.titulo, datos, f, (a) => progreso('guardando', a));
    }
    progreso('listo', 1);
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    progreso('error', 0, mensaje);
    throw e;
  }
}

export async function instalarDesdeArchivo(urlBlob: string, nombre: string): Promise<void> {
  const id = `archivo-${nombre.replace(/\.zip$/i, '').replace(/[^\w.-]+/g, '-').toLowerCase()}`;
  const progreso = (fase: ProgresoInstalacion['fase'], avance: number, error?: string) =>
    emitir({ id, titulo: nombre, fase, avance, error });
  try {
    progreso('leyendo', 0);
    const datos = new Uint8Array(await (await fetch(urlBlob)).arrayBuffer());
    await importarZip(id, '', datos, {}, (a) => progreso('guardando', a));
    progreso('listo', 1);
  } catch (e) {
    progreso('error', 0, e instanceof Error ? e.message : String(e));
    throw e;
  }
}

export async function eliminarDiccionario(id: string): Promise<void> {
  const d = await db.diccionarios.get(id);
  if (!d) return;
  await borrarFilas(id, d.tipo);
  await db.diccionarios.delete(id);
}

export async function ordenarDiccionarios(ids: string[]): Promise<void> {
  await db.transaction('rw', db.diccionarios, async () => {
    for (let i = 0; i < ids.length; i++) await db.diccionarios.update(ids[i], { orden: i });
  });
}

export async function listaDiccionarios(): Promise<InfoDiccionario[]> {
  return db.diccionarios.orderBy('orden').toArray();
}
