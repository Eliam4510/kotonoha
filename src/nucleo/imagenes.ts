// El tamaño de una imagen sin descodificarla: basta con su cabecera. El visor lo necesita para colocar cada página antes
// de pintarla, y descodificar cientos de páginas solo para medirlas sería lento.

export interface Tamano {
  ancho: number;
  alto: number;
}

const TIPOS: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp' };

/** El tipo MIME por la extensión del archivo. */
export const tipoDeImagen = (nombre: string) => TIPOS[nombre.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';

function deJpeg(b: Uint8Array, d: DataView): Tamano | null {
  let p = 2;
  while (p + 9 < b.length) {
    if (b[p] !== 0xff) return null;
    const marca = b[p + 1];
    // Relleno entre marcadores.
    if (marca === 0xff) {
      p++;
      continue;
    }
    const largo = d.getUint16(p + 2);
    // SOF0 a SOF15, salvo DHT (C4), JPG (C8) y DAC (CC): ahí van el alto y el ancho.
    if (marca >= 0xc0 && marca <= 0xcf && marca !== 0xc4 && marca !== 0xc8 && marca !== 0xcc) return { alto: d.getUint16(p + 5), ancho: d.getUint16(p + 7) };
    p += 2 + largo;
  }
  return null;
}

function deWebp(b: Uint8Array, d: DataView): Tamano | null {
  const trozo = String.fromCharCode(...b.subarray(12, 16));
  if (trozo === 'VP8 ' && b.length >= 30) return { ancho: d.getUint16(26, true) & 0x3fff, alto: d.getUint16(28, true) & 0x3fff };
  if (trozo === 'VP8L' && b.length >= 25) {
    const v = d.getUint32(21, true);
    return { ancho: (v & 0x3fff) + 1, alto: ((v >> 14) & 0x3fff) + 1 };
  }
  if (trozo === 'VP8X' && b.length >= 30) return { ancho: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), alto: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
  return null;
}

/** Lo que hace falta saber de un JPEG para meterlo tal cual en un PDF, sin volver a comprimirlo. */
export interface CabeceraJpeg extends Tamano {
  /** 1 en gris, 3 en color y 4 en CMYK. */
  componentes: number;
  bits: number;
  /** Si lo guardó Adobe: entonces su CMYK va invertido. */
  adobe: boolean;
  /** Los puntos por pulgada que dice el archivo, si los dice. */
  ppp?: number;
  /** Si va por el método base o el progresivo, los que entiende cualquier lector de PDF. */
  comun: boolean;
}

/** La cabecera de un JPEG, o null si no lo es o está cortada. */
export function cabeceraJpeg(b: Uint8Array): CabeceraJpeg | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  const d = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let p = 2;
  let adobe = false;
  let ppp: number | undefined;
  while (p + 9 < b.length) {
    if (b[p] !== 0xff) return null;
    const marca = b[p + 1];
    if (marca === 0xff) {
      p++;
      continue;
    }
    const largo = d.getUint16(p + 2);
    const firma = (n: number) => String.fromCharCode(...b.subarray(p + 4, p + 4 + n));
    // APP0 de JFIF: unidades 1 son puntos por pulgada y 2 por centímetro.
    if (marca === 0xe0 && firma(5) === 'JFIF\0' && p + 13 < b.length) {
      const unidades = b[p + 11];
      const x = d.getUint16(p + 12);
      if (unidades === 1) ppp = x;
      else if (unidades === 2) ppp = x * 2.54;
    }
    if (marca === 0xee && firma(5) === 'Adobe') adobe = true;
    if (marca >= 0xc0 && marca <= 0xcf && marca !== 0xc4 && marca !== 0xc8 && marca !== 0xcc) {
      return { bits: b[p + 4], alto: d.getUint16(p + 5), ancho: d.getUint16(p + 7), componentes: b[p + 9], adobe, ppp, comun: (marca === 0xc0 || marca === 0xc1 || marca === 0xc2) && b[p + 4] === 8 };
    }
    p += 2 + largo;
  }
  return null;
}

/** El tamaño de una imagen JPEG, PNG, GIF o WebP por su cabecera; null si no se reconoce. */
export function tamanoDeImagen(b: Uint8Array): Tamano | null {
  const d = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ancho: d.getUint32(16), alto: d.getUint32(20) };
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) return deJpeg(b, d);
  if (b.length >= 10 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return { ancho: d.getUint16(6, true), alto: d.getUint16(8, true) };
  if (b.length >= 16 && String.fromCharCode(...b.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...b.subarray(8, 12)) === 'WEBP') return deWebp(b, d);
  return null;
}
