// Los términos de los diccionarios se leen de la base de cada lengua. Quien estudia dos alterna entre ellas: los de la
// anterior se conservan para no tener que leerlos otra vez, que con diccionarios grandes tarda unos segundos.

import 'fake-indexeddb/auto';
import { afterAll, describe, expect, it } from 'vitest';
import { completarAjustes } from '../compartido/ajustes';
import { analizarTexto, listaTerminos, olvidarLengua, recargarTerminos, totalTerminos } from './analisis';
import { baseDe, type FilaTermino } from './db';
import { fijarLengua } from './lengua';

const termino = (t: string) => ({ termino: t, lectura: '', dic: 'prueba' }) as unknown as FilaTermino;

describe('los términos de cada lengua', () => {
  afterAll(() => {
    fijarLengua('ja');
    olvidarLengua();
  });

  it('al volver a la lengua anterior están al instante, y no se mezclan', async () => {
    await baseDe('ja').terminos.bulkAdd([termino('猫'), termino('犬')]);
    await baseDe('en').terminos.bulkAdd([termino('cat')]);
    fijarLengua('ja');
    olvidarLengua();
    await recargarTerminos();
    expect(totalTerminos()).toBe(2);

    fijarLengua('en');
    olvidarLengua();
    // Los del inglés aún no se han leído: no valen los del japonés.
    expect(totalTerminos()).toBe(0);
    const ingles = await listaTerminos();
    expect([...ingles]).toEqual(['cat']);

    fijarLengua('ja');
    olvidarLengua();
    // Sin esperar a leerlos.
    expect(totalTerminos()).toBe(2);
    expect((await listaTerminos()).has('猫')).toBe(true);
    expect((await listaTerminos()).has('cat')).toBe(false);
  });

  it('en alemán, las formas que traen los diccionarios dan la forma de diccionario', async () => {
    const base = baseDe('de');
    await base.terminos.bulkAdd([termino('gehen'), termino('ich'), termino('schön'), termino('schönen')]);
    await base.formas.bulkPut([
      { dic: 'prueba', forma: 'ging', lemas: [{ lema: 'gehen', flexion: 'first/third-person singular preterite', pos: 'v' }] },
      { dic: 'prueba', forma: 'schönen', lemas: [{ lema: 'schön', flexion: 'dative plural', pos: 'adj' }] },
    ]);
    await base.frecuencias.bulkPut([
      { dic: 'lista', termino: 'schön', lectura: 'schön', rango: 300 },
      { dic: 'lista', termino: 'schönen', lectura: 'schönen', rango: 2500 },
    ]);
    fijarLengua('de');
    olvidarLengua();
    await recargarTerminos();
    const [linea] = await analizarTexto('Ich ging zu den schönen Orten.', completarAjustes(undefined));
    const palabras = linea.filter((p) => p.esPalabra);
    expect(palabras.find((p) => p.superficie === 'ging')?.lema).toBe('gehen');
    expect(palabras.find((p) => p.superficie === 'ging')?.flexion).toEqual(['Präteritum']);
    // El verbo schönen existe, pero el adjetivo schön es mucho más frecuente.
    expect(palabras.find((p) => p.superficie === 'schönen')?.lema).toBe('schön');
  });
});
