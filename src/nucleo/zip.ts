// Lector de ZIP por partes, para los EPUB y los CBZ de la Ayuda de lectura. Lee el índice central del final del archivo y
// luego solo la entrada que se pide: un libro de cientos de MB no tiene que estar entero en memoria para enseñar una
// página. Admite ZIP64, los nombres en UTF-8 y los antiguos en Shift_JIS, y las entradas guardadas o comprimidas.

import { inflateSync } from 'fflate';

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

/** El contenido de una entrada, ya descomprimido. */
export async function leerEntrada(f: FuenteBytes, e: EntradaZip): Promise<Uint8Array> {
  const cabecera = vista(await f.leer(e.desplazamiento, e.desplazamiento + 30));
  if (cabecera.getUint32(0, true) !== CABECERA_LOCAL) throw new Error(`Entrada dañada: ${e.nombre}`);
  const inicio = e.desplazamiento + 30 + cabecera.getUint16(26, true) + cabecera.getUint16(28, true);
  const datos = await f.leer(inicio, inicio + e.comprimido);
  if (e.metodo === 0) return datos;
  if (e.metodo === 8) return inflateSync(datos, { out: new Uint8Array(e.tamano) });
  throw new Error(`Compresión no admitida (${e.metodo}): ${e.nombre}`);
}

/** Orden natural: «p2» antes que «p10», como se numeran las páginas de un CBZ. */
export const ordenNatural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
