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

/** El tamaño de una imagen JPEG, PNG, GIF o WebP por su cabecera; null si no se reconoce. */
export function tamanoDeImagen(b: Uint8Array): Tamano | null {
  const d = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ancho: d.getUint32(16), alto: d.getUint32(20) };
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) return deJpeg(b, d);
  if (b.length >= 10 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return { ancho: d.getUint16(6, true), alto: d.getUint16(8, true) };
  if (b.length >= 16 && String.fromCharCode(...b.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...b.subarray(8, 12)) === 'WEBP') return deWebp(b, d);
  return null;
}
