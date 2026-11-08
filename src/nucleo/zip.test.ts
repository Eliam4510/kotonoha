import { crc32 as crcDeNode } from 'node:zlib';
import { strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { crc32, crearZip, fuenteDeArchivo, fuenteDeBytes, leerEntrada, leerIndiceZip, leerPrincipio, ordenNatural } from './zip';

const texto = (b: Uint8Array) => new TextDecoder().decode(b);

describe('el lector de ZIP por partes', () => {
  const datos = zipSync({
    mimetype: [strToU8('application/epub+zip'), { level: 0 }],
    'OEBPS/capítulo 1.xhtml': strToU8('<p>本文です。</p>'.repeat(200)),
    'OEBPS/imagenes/p001.jpg': [new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]), { level: 0 }],
  });

  it('lee el índice con los nombres en UTF-8', async () => {
    const indice = await leerIndiceZip(fuenteDeBytes(datos));
    expect([...indice.keys()].sort()).toEqual(['OEBPS/capítulo 1.xhtml', 'OEBPS/imagenes/p001.jpg', 'mimetype']);
  });

  it('lee una entrada guardada y otra comprimida', async () => {
    const f = fuenteDeBytes(datos);
    const indice = await leerIndiceZip(f);
    expect(texto(await leerEntrada(f, indice.get('mimetype')!))).toBe('application/epub+zip');
    const capitulo = indice.get('OEBPS/capítulo 1.xhtml')!;
    expect(capitulo.metodo).toBe(8);
    expect(texto(await leerEntrada(f, capitulo))).toBe('<p>本文です。</p>'.repeat(200));
    expect([...(await leerEntrada(f, indice.get('OEBPS/imagenes/p001.jpg')!))]).toEqual([0xff, 0xd8, 0xff, 1, 2, 3]);
  });

  it('solo pide los trozos que necesita', async () => {
    const pedidos: [number, number][] = [];
    const f = { tamano: datos.length, leer: async (a: number, b: number) => (pedidos.push([a, b]), datos.subarray(a, b)) };
    const indice = await leerIndiceZip(f);
    pedidos.length = 0;
    await leerEntrada(f, indice.get('mimetype')!);
    expect(pedidos.every(([a, b]) => b - a < 100)).toBe(true);
  });

  it('dice claramente que un archivo no es un ZIP', async () => {
    await expect(leerIndiceZip(fuenteDeBytes(strToU8('no es un zip')))).rejects.toThrow('No es un archivo ZIP');
  });

  it('ordena las páginas como se numeran', () => {
    expect(['p10.jpg', 'p2.jpg', 'p1.jpg'].sort(ordenNatural)).toEqual(['p1.jpg', 'p2.jpg', 'p10.jpg']);
  });
});

describe('el ZIP que se escribe con las imágenes de una carpeta', () => {
  const imagen = (n: number) => new Uint8Array(3000 + n * 7).map((_, i) => (i * 31 + n) & 0xff);
  const archivos = [
    { nombre: '00001.jpg', datos: new Blob([imagen(1)]), fecha: Date.UTC(2026, 10, 7, 12, 30, 10) },
    { nombre: '第1話/002.jpg', datos: new Blob([imagen(2)]) },
    { nombre: 'ComicInfo.xml', datos: new Blob([strToU8('<ComicInfo><Title>テスト漫画</Title></ComicInfo>')]) },
  ];

  it('calcula el CRC-32 de ZIP, también a trozos', () => {
    const datos = strToU8('123456789');
    expect(crc32(datos)).toBe(0xcbf43926);
    expect(crc32(datos.subarray(4), crc32(datos.subarray(0, 4)))).toBe(0xcbf43926);
    expect(crc32(imagen(9))).toBe(crcDeNode(imagen(9)));
  });

  it('lo lee el lector por partes, con los nombres en UTF-8 y las imágenes tal cual', async () => {
    const zip = await crearZip(archivos);
    const f = fuenteDeArchivo(zip);
    const indice = await leerIndiceZip(f);
    expect([...indice.keys()]).toEqual(['00001.jpg', '第1話/002.jpg', 'ComicInfo.xml']);
    expect(indice.get('第1話/002.jpg')).toMatchObject({ metodo: 0, tamano: imagen(2).length, comprimido: imagen(2).length });
    expect(await leerEntrada(f, indice.get('00001.jpg')!)).toEqual(imagen(1));
    expect(await leerEntrada(f, indice.get('第1話/002.jpg')!)).toEqual(imagen(2));
  });

  it('es un ZIP correcto para cualquier otro programa', async () => {
    const zip = new Uint8Array(await (await crearZip(archivos)).arrayBuffer());
    const leido = unzipSync(zip);
    expect(leido['第1話/002.jpg']).toEqual(imagen(2));
    expect(new TextDecoder().decode(leido['ComicInfo.xml'])).toContain('テスト漫画');
    // El CRC de cada cabecera local es el de su contenido: los programas que lo comprueban no lo rechazan.
    const d = new DataView(zip.buffer);
    expect(d.getUint32(14, true)).toBe(crcDeNode(imagen(1)));
  });

  it('lee solo el principio de una entrada, guardada o comprimida', async () => {
    const grande = new Uint8Array(200_000).map((_, i) => (i * 7) & 0xff);
    const datos = zipSync({ guardada: [grande, { level: 0 }], comprimida: [grande, { level: 6 }] });
    const pedidos: [number, number][] = [];
    const f = { tamano: datos.length, leer: async (a: number, b: number) => (pedidos.push([a, b]), datos.subarray(a, b)) };
    const indice = await leerIndiceZip(f);
    pedidos.length = 0;
    expect(await leerPrincipio(f, indice.get('guardada')!, 1000)).toEqual(grande.subarray(0, 1000));
    expect(await leerPrincipio(f, indice.get('comprimida')!, 1000)).toEqual(grande.subarray(0, 1000));
    expect(pedidos.every(([a, b]) => b - a <= 1000)).toBe(true);
  });

  it('avisa de cada archivo hecho', async () => {
    const avances: string[] = [];
    await crearZip(archivos, (n, total) => avances.push(`${n}/${total}`));
    expect(avances).toEqual(['1/3', '2/3', '3/3']);
  });
});
