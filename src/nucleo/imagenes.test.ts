import { describe, expect, it } from 'vitest';
import { tamanoDeImagen, tipoDeImagen } from './imagenes';

const bytes = (...partes: (number[] | string)[]) =>
  new Uint8Array(partes.flatMap((p) => (typeof p === 'string' ? [...p].map((c) => c.charCodeAt(0)) : p)));
const be16 = (n: number) => [n >> 8, n & 0xff];
const be32 = (n: number) => [(n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
const le16 = (n: number) => [n & 0xff, n >> 8];

describe('el tamaño de una imagen por su cabecera', () => {
  it('PNG', () => {
    expect(tamanoDeImagen(bytes([0x89], 'PNG', [13, 10, 26, 10], be32(13), 'IHDR', be32(844), be32(1200)))).toEqual({ ancho: 844, alto: 1200 });
  });

  it('JPEG, saltando los segmentos que van antes del de tamaño', () => {
    const app0 = [0xff, 0xe0, ...be16(16), ...new Array(14).fill(0)];
    const dqt = [0xff, 0xdb, ...be16(4), 0, 0];
    const sof = [0xff, 0xc0, ...be16(17), 8, ...be16(1920), ...be16(1358), 3];
    expect(tamanoDeImagen(bytes([0xff, 0xd8], app0, dqt, sof, new Array(20).fill(0)))).toEqual({ ancho: 1358, alto: 1920 });
  });

  it('JPEG progresivo', () => {
    const sof2 = [0xff, 0xc2, ...be16(17), 8, ...be16(600), ...be16(400), 3];
    expect(tamanoDeImagen(bytes([0xff, 0xd8], sof2, new Array(20).fill(0)))).toEqual({ ancho: 400, alto: 600 });
  });

  it('GIF y WebP sin pérdida', () => {
    expect(tamanoDeImagen(bytes('GIF89a', le16(320), le16(240), [0, 0]))).toEqual({ ancho: 320, alto: 240 });
    const ancho = 1000 - 1;
    const alto = 1500 - 1;
    const v = ancho | (alto << 14);
    expect(tamanoDeImagen(bytes('RIFF', [0, 0, 0, 0], 'WEBP', 'VP8L', [0, 0, 0, 0], [0x2f], [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff]))).toEqual({ ancho: 1000, alto: 1500 });
  });

  it('lo que no reconoce devuelve null', () => {
    expect(tamanoDeImagen(bytes('no es una imagen'))).toBeNull();
  });

  it('el tipo por la extensión', () => {
    expect(tipoDeImagen('item/image/i-001.JPEG')).toBe('image/jpeg');
    expect(tipoDeImagen('p.webp')).toBe('image/webp');
  });
});
