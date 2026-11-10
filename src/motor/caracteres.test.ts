// El diccionario de caracteres visto desde el motor: la ficha de uno, los que llevan una pieza y su familia por el sonido.

import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';
import type { FichaCaracter } from '../compartido/tipos';
import { caracteresBreves, caracteresConPieza, familiaFonetica, fichaCaracter } from './caracteres';
import { baseDe } from './db';

const ficha = (caracter: string, c: Partial<FichaCaracter> = {}): FichaCaracter => ({
  caracter,
  significados: { en: [`${caracter}-en`] },
  on: { oficiales: [], otras: [] },
  kun: { oficiales: [], otras: [] },
  nombres: [],
  variantes: { antiguas: [], nuevas: [], otras: [] },
  piezas: [],
  formasComoPieza: [],
  opuestos: [],
  sinonimos: [],
  parecidos: [],
  homonimos: [],
  enOtrasLenguas: {},
  ...c,
});

describe('diccionario de caracteres', () => {
  beforeAll(async () => {
    await baseDe('ja').caracteres.bulkPut([
      ficha('青', { on: { oficiales: [{ texto: 'セイ' }], otras: [] }, kun: { oficiales: [{ texto: 'あお.い' }], otras: [] }, fonetico: '青', frecuencia: 402, trazos: 8, lista: 'kyoiku-1' }),
      ficha('晴', { on: { oficiales: [{ texto: 'セイ' }], otras: [] }, fonetico: '青', piezas: ['日', '青'], frecuencia: 900, trazos: 12 }),
      ficha('清', { kun: { oficiales: [{ texto: 'きよ.い' }], otras: [] }, fonetico: '青', piezas: ['氵', '青'], frecuencia: 600, trazos: 11 }),
      ficha('瀞', { on: { oficiales: [], otras: [{ texto: 'ジョウ' }] }, piezas: ['氵', '青', '争'], trazos: 16 }),
      ficha('汁', { piezas: ['氵', '十'], trazos: 5 }),
      // Lleva dos formas de la misma pieza.
      ficha('沓', { piezas: ['水', '氵'], frecuencia: 3000, trazos: 8 }),
    ]);
  });

  it('da la ficha de un carácter, o nada si no lo tiene', async () => {
    expect((await fichaCaracter('青'))?.lista).toBe('kyoiku-1');
    expect(await fichaCaracter('鬱')).toBeNull();
  });

  it('los pedidos, en su orden, con su lectura principal; los que no tiene, fuera', async () => {
    const xs = await caracteresBreves(['清', '鬱', '青', '瀞', '汁']);
    expect(xs.map((x) => x.caracter)).toEqual(['清', '青', '瀞', '汁']);
    // La primera on'yomi oficial; sin ella, la kun'yomi; sin oficiales, la primera que haya.
    expect(xs.map((x) => x.lectura)).toEqual(['きよ.い', 'セイ', 'ジョウ', undefined]);
    expect(xs[1]).toEqual({ caracter: '青', lectura: 'セイ', significados: { en: ['青-en'] }, frecuencia: 402, lista: 'kyoiku-1' });
    expect(await caracteresBreves([])).toEqual([]);
  });

  it('los que llevan una pieza: los más usados primero, y los sin puesto por sus trazos', async () => {
    const r = await caracteresConPieza(['水', '氵', '氺'], ['水'], 3);
    expect(r.total).toBe(4);
    // 清 (600) y 沓 (3000) tienen puesto; 汁 (5 trazos) va antes que 瀞 (16). 沓 lleva dos formas y sale una vez.
    expect(r.filas.map((x) => x.caracter)).toEqual(['清', '沓', '汁']);
  });

  it('sin los que se piden fuera, y contando solo los que quedan', async () => {
    const r = await caracteresConPieza(['青'], ['青', '晴', '清']);
    expect(r).toMatchObject({ total: 1 });
    expect(r.filas.map((x) => x.caracter)).toEqual(['瀞']);
    expect(await caracteresConPieza([], [])).toEqual({ filas: [], total: 0 });
  });

  it('la familia de una pieza que da el sonido, con ella la primera', async () => {
    const r = await familiaFonetica('青');
    expect(r.total).toBe(3);
    expect(r.filas.map((x) => x.caracter)).toEqual(['青', '清', '晴']);
    expect((await familiaFonetica('令')).total).toBe(0);
    // Va la primera aunque sea menos usada que los suyos y no se señale a sí misma como su parte fonética.
    await baseDe('ja').caracteres.bulkPut([ficha('夆', { trazos: 7 }), ficha('峰', { fonetico: '夆', frecuencia: 1200 }), ficha('縫', { fonetico: '夆', frecuencia: 1500 })]);
    expect((await familiaFonetica('夆')).filas.map((x) => x.caracter)).toEqual(['夆', '峰', '縫']);
  });
});
