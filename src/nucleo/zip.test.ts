import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { fuenteDeBytes, leerEntrada, leerIndiceZip, ordenNatural } from './zip';

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
