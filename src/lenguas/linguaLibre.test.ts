import { afterEach, describe, expect, it, vi } from 'vitest';
import { audioLinguaLibre } from './linguaLibre';

const conResultados = (...titulos: string[]) => {
  const pedido = vi.fn(async (_url: string) => new Response(JSON.stringify({ query: { search: titulos.map((title) => ({ title })) } })));
  vi.stubGlobal('fetch', pedido);
  return pedido;
};

describe('audio de Lingua Libre', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('busca los archivos de la lengua que se le pide', async () => {
    const pedido = conResultados();
    await audioLinguaLibre('猫', 'Q5287', 'jpn');
    const consulta = new URL(pedido.mock.calls[0][0]).searchParams.get('srsearch');
    expect(consulta).toBe('intitle:"LL-Q5287 (jpn)" intitle:"猫"');
  });

  it('saca quién lo grabó, y solo vale la palabra exacta', async () => {
    conResultados('File:LL-Q5287 (jpn)-Akari-猫.wav', 'File:LL-Q5287 (jpn)-Akari-猫舌.wav');
    const r = await audioLinguaLibre('猫', 'Q5287', 'jpn');
    expect(r).toHaveLength(1);
    expect(r[0].etiqueta).toBe('Akari (Lingua Libre)');
    expect(r[0].origen).toBe('linguaLibre');
    expect(r[0].url).toBe('https://commons.wikimedia.org/wiki/Special:FilePath/LL-Q5287%20(jpn)-Akari-%E7%8C%AB.wav');
  });

  it('descarta las grabaciones de otra lengua, aunque la palabra coincida', async () => {
    conResultados('File:LL-Q7850 (zho)-Wei-猫.wav');
    expect(await audioLinguaLibre('猫', 'Q5287', 'jpn')).toEqual([]);
  });

  it('si falla la red, simplemente no hay audio', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('sin red'); }));
    expect(await audioLinguaLibre('猫', 'Q5287', 'jpn')).toEqual([]);
  });
});
