// Los términos de los diccionarios se leen de la base de cada lengua. Quien estudia dos alterna entre ellas: los de la
// anterior se conservan para no tener que leerlos otra vez, que con diccionarios grandes tarda unos segundos.

import 'fake-indexeddb/auto';
import { afterAll, describe, expect, it } from 'vitest';
import { listaTerminos, olvidarLengua, recargarTerminos, totalTerminos } from './analisis';
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
});
