// Lector de ZIP por partes, para los EPUB y los CBZ de la Biblioteca. Lee el índice central del final del archivo y
// luego solo la entrada que se pide: un libro de cientos de MB no tiene que estar entero en memoria para enseñar una
// página. Admite ZIP64, los nombres en UTF-8 y los antiguos en Shift_JIS, y las entradas guardadas o comprimidas.

import { Inflate, inflateSync } from 'fflate';

/** De dónde salen los bytes: un File, un ArrayBuffer o lo que sea que se pueda leer a trozos. */
export interface FuenteBytes {
  tamano: number;
  leer(inicio: number, fin: number): Promise<Uint8Array>;
}

export interface EntradaZip {
  nombre: string;
  /** 0, guardada tal cual; 8, comprimida con deflate. */
  metodo: number;
  comprimido: number;
  tamano: number;
  /** Dónde empieza su cabecera local. */
  desplazamiento: number;
}

const FIN_INDICE = 0x06054b50;
const LOCALIZADOR_ZIP64 = 0x07064b50;
const FIN_INDICE_ZIP64 = 0x06064b50;
const ENTRADA_INDICE = 0x02014b50;
const CABECERA_LOCAL = 0x04034b50;
const MAXIMO_COMENTARIO = 0xffff;

export const fuenteDeBytes = (datos: Uint8Array): FuenteBytes => ({
  tamano: datos.length,
  leer: async (inicio, fin) => datos.subarray(inicio, fin),
});

export const fuenteDeArchivo = (archivo: Blob): FuenteBytes => ({
  tamano: archivo.size,
  leer: async (inicio, fin) => new Uint8Array(await archivo.slice(inicio, fin).arrayBuffer()),
});

const vista = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength);
const u64 = (d: DataView, p: number) => Number(d.getBigUint64(p, true));

function nombreDe(bytes: Uint8Array, utf8: boolean): string {
  if (utf8) return new TextDecoder('utf-8').decode(bytes);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    // Los ZIP hechos en Japón sin la marca de UTF-8 suelen llevar los nombres en Shift_JIS.
    return new TextDecoder('shift_jis').decode(bytes);
  }
}

/** Todas las entradas del ZIP, por nombre. */
export async function leerIndiceZip(f: FuenteBytes): Promise<Map<string, EntradaZip>> {
  const cola = Math.min(f.tamano, 22 + MAXIMO_COMENTARIO);
  const fin = await f.leer(f.tamano - cola, f.tamano);
  const df = vista(fin);
  let p = fin.length - 22;
  while (p >= 0 && df.getUint32(p, true) !== FIN_INDICE) p--;
  if (p < 0) throw new Error('No es un archivo ZIP');
  let entradas = df.getUint16(p + 10, true);
  let tamanoIndice = df.getUint32(p + 12, true);
  let inicioIndice = df.getUint32(p + 16, true);

  // ZIP64: el localizador va justo antes del final normal y dice dónde está el final de 64 bits.
  if (p >= 20 && df.getUint32(p - 20, true) === LOCALIZADOR_ZIP64) {
    const donde = u64(df, p - 20 + 8);
    const registro = vista(await f.leer(donde, donde + 56));
    if (registro.getUint32(0, true) === FIN_INDICE_ZIP64) {
      entradas = u64(registro, 32);
      tamanoIndice = u64(registro, 40);
      inicioIndice = u64(registro, 48);
    }
  }

  const indice = await f.leer(inicioIndice, inicioIndice + tamanoIndice);
  const d = vista(indice);
  const salida = new Map<string, EntradaZip>();
  let q = 0;
  for (let n = 0; n < entradas && q + 46 <= indice.length; n++) {
    if (d.getUint32(q, true) !== ENTRADA_INDICE) throw new Error('Índice del ZIP dañado');
    const banderas = d.getUint16(q + 8, true);
    const metodo = d.getUint16(q + 10, true);
    let comprimido = d.getUint32(q + 20, true);
    let tamano = d.getUint32(q + 24, true);
    const largoNombre = d.getUint16(q + 28, true);
    const largoExtra = d.getUint16(q + 30, true);
    const largoComentario = d.getUint16(q + 32, true);
    let desplazamiento = d.getUint32(q + 42, true);
    const nombre = nombreDe(indice.subarray(q + 46, q + 46 + largoNombre), (banderas & 0x800) !== 0);
    // El campo extra de ZIP64 trae, en este orden, los valores que no cupieron en 32 bits.
    let e = q + 46 + largoNombre;
    const finExtra = e + largoExtra;
    while (e + 4 <= finExtra) {
      const id = d.getUint16(e, true);
      const largo = d.getUint16(e + 2, true);
      if (id === 0x0001) {
        let c = e + 4;
        if (tamano === 0xffffffff) (tamano = u64(d, c)), (c += 8);
        if (comprimido === 0xffffffff) (comprimido = u64(d, c)), (c += 8);
        if (desplazamiento === 0xffffffff) desplazamiento = u64(d, c);
      }
      e += 4 + largo;
    }
    if (!nombre.endsWith('/')) salida.set(nombre, { nombre, metodo, comprimido, tamano, desplazamiento });
    q = finExtra + largoComentario;
  }
  return salida;
}

/** Dónde empiezan los datos de una entrada: tras su cabecera local, que tiene su propio largo de nombre y de extra. */
async function inicioDeDatos(f: FuenteBytes, e: EntradaZip): Promise<number> {
  const cabecera = vista(await f.leer(e.desplazamiento, e.desplazamiento + 30));
  if (cabecera.getUint32(0, true) !== CABECERA_LOCAL) throw new Error(`Entrada dañada: ${e.nombre}`);
  if (e.metodo !== 0 && e.metodo !== 8) throw new Error(`Compresión no admitida (${e.metodo}): ${e.nombre}`);
  return e.desplazamiento + 30 + cabecera.getUint16(26, true) + cabecera.getUint16(28, true);
}

/** El contenido de una entrada, ya descomprimido. */
export async function leerEntrada(f: FuenteBytes, e: EntradaZip): Promise<Uint8Array> {
  const inicio = await inicioDeDatos(f, e);
  const datos = await f.leer(inicio, inicio + e.comprimido);
  return e.metodo === 0 ? datos : inflateSync(datos, { out: new Uint8Array(e.tamano) });
}

/**
 * Los primeros bytes de una entrada (como mucho `n`), sin leerla entera: para la cabecera de una imagen basta. Una
 * entrada comprimida se descomprime solo hasta donde llega lo leído.
 */
export async function leerPrincipio(f: FuenteBytes, e: EntradaZip, n: number): Promise<Uint8Array> {
  const inicio = await inicioDeDatos(f, e);
  const datos = await f.leer(inicio, inicio + Math.min(n, e.comprimido));
  if (e.metodo === 0) return datos;
  const trozos: Uint8Array[] = [];
  const inflador = new Inflate((trozo) => trozos.push(trozo));
  inflador.push(datos, datos.length === e.comprimido);
  const salida = new Uint8Array(Math.min(n, trozos.reduce((s, t) => s + t.length, 0)));
  let p = 0;
  for (const t of trozos) {
    if (p >= salida.length) break;
    salida.set(t.subarray(0, salida.length - p), p);
    p += t.length;
  }
  return salida;
}

/** Orden natural: «p2» antes que «p10», como se numeran las páginas de un CBZ. */
export const ordenNatural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

// ---------- Escribir un ZIP ----------

const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** El CRC-32 de ZIP. Se puede calcular a trozos: cada trozo recibe el valor del anterior. */
export function crc32(datos: Uint8Array, anterior = 0): number {
  let c = (anterior ^ 0xffffffff) >>> 0;
  for (let i = 0; i < datos.length; i++) c = TABLA_CRC[(c ^ datos[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function crcDeBlob(b: Blob): Promise<number> {
  let crc = 0;
  const lector = b.stream().getReader();
  for (;;) {
    const { done, value } = await lector.read();
    if (done) return crc;
    crc = crc32(value, crc);
  }
}

/** La hora y el día en el formato de MS-DOS, que es el que guarda ZIP. */
function fechaDos(ms: number): [number, number] {
  const d = new Date(ms);
  const anio = Math.min(2107, Math.max(1980, d.getFullYear()));
  if (anio !== d.getFullYear()) return [0, ((anio - 1980) << 9) | (1 << 5) | 1];
  return [(d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), ((anio - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()];
}

export interface ArchivoParaZip {
  nombre: string;
  datos: Blob;
  /** Cuándo se modificó, en milisegundos. */
  fecha?: number;
}

/** Lo más que cabe en un ZIP sin ZIP64. */
export const LIMITE_ZIP = 0xffffffff;

/**
 * Un ZIP sin comprimir (las imágenes ya vienen comprimidas) hecho con los propios archivos: el Blob que devuelve los
 * referencia sin copiarlos en memoria, y cada uno se lee una sola vez, para su CRC. Los nombres van en UTF-8. Más de
 * 4 GB o de 65 535 entradas pedirían ZIP64: entonces da error.
 */
export async function crearZip(archivos: ArchivoParaZip[], alAvanzar?: (hechos: number, total: number) => void): Promise<Blob> {
  if (archivos.length > 0xffff) throw new Error('Demasiados archivos para un ZIP');
  const codificador = new TextEncoder();
  const partes: BlobPart[] = [];
  const indice: Uint8Array<ArrayBuffer>[] = [];
  let desplazamiento = 0;
  for (const [i, a] of archivos.entries()) {
    const nombre = codificador.encode(a.nombre);
    const crc = await crcDeBlob(a.datos);
    const [hora, dia] = fechaDos(a.fecha ?? Date.now());
    const local = new Uint8Array(30 + nombre.length);
    const l = vista(local);
    l.setUint32(0, CABECERA_LOCAL, true);
    l.setUint16(4, 20, true);
    l.setUint16(6, 0x800, true);
    l.setUint16(10, hora, true);
    l.setUint16(12, dia, true);
    l.setUint32(14, crc, true);
    l.setUint32(18, a.datos.size, true);
    l.setUint32(22, a.datos.size, true);
    l.setUint16(26, nombre.length, true);
    local.set(nombre, 30);
    const central = new Uint8Array(46 + nombre.length);
    const c = vista(central);
    c.setUint32(0, ENTRADA_INDICE, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x800, true);
    c.setUint16(12, hora, true);
    c.setUint16(14, dia, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, a.datos.size, true);
    c.setUint32(24, a.datos.size, true);
    c.setUint16(28, nombre.length, true);
    c.setUint32(42, desplazamiento, true);
    central.set(nombre, 46);
    partes.push(local, a.datos);
    indice.push(central);
    desplazamiento += local.length + a.datos.size;
    if (desplazamiento >= LIMITE_ZIP) throw new Error('Más de 4 GB para un ZIP');
    alAvanzar?.(i + 1, archivos.length);
  }
  const tamanoIndice = indice.reduce((s, e) => s + e.length, 0);
  if (desplazamiento + tamanoIndice >= LIMITE_ZIP) throw new Error('Más de 4 GB para un ZIP');
  const fin = new Uint8Array(22);
  const f = vista(fin);
  f.setUint32(0, FIN_INDICE, true);
  f.setUint16(8, archivos.length, true);
  f.setUint16(10, archivos.length, true);
  f.setUint32(12, tamanoIndice, true);
  f.setUint32(16, desplazamiento, true);
  return new Blob([...partes, ...indice, fin], { type: 'application/zip' });
}
