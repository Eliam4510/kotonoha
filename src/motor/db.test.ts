// Cada lengua en su base, y la del japonés exactamente donde estaba: de eso depende que nadie pierda sus palabras.

import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterAll, describe, expect, it } from 'vitest';
import { baseDe, baseGeneral, db, nombreBase, usarBaseDe } from './db';
import { fijarLengua, lengua } from './lengua';

const palabra = (lema: string) => ({ clave: `${lema}|`, lema, lectura: '', estado: 'conocida' as const, rastreada: 0 as const, creada: 1, actualizada: 1 });

describe('bases de datos por lengua', () => {
  afterAll(() => usarBaseDe('ja'));

  it('la base del japonés sigue llamándose como en la primera versión', () => {
    expect(nombreBase('ja')).toBe('kikitori');
    expect(baseDe('ja').name).toBe('kikitori');
    expect(baseGeneral).toBe(baseDe('ja'));
    expect(db).toBe(baseDe('ja'));
  });

  it('abre lo que dejó la versión anterior sin perder nada', async () => {
    // Una base como la de quien ya usaba la extensión, en la versión 5: se abre en la 7, que solo añade la tabla de las
    // formas flexionadas (6) y la de las colecciones de la estantería (7), con sus datos intactos.
    const anterior = new Dexie('kikitori-anterior');
    anterior.version(5).stores({ palabras: 'clave, estado, lema, actualizada, rastreada', biblioteca: 'id, creado' });
    await anterior.open();
    await anterior.table('palabras').put(palabra('猫'));
    await anterior.table('biblioteca').put({ id: 'l', titulo: 'Un libro', texto: '', origen: 'archivo', creado: 1, pagina: 4 });
    anterior.close();

    const base = baseDe('anterior');
    expect(base.name).toBe('kikitori-anterior');
    await base.open();
    expect(base.verno).toBe(7);
    expect(base.tables.map((t) => t.name)).toEqual(expect.arrayContaining(['formas', 'colecciones']));
    expect(await base.palabras.get('猫|')).toMatchObject({ lema: '猫', estado: 'conocida' });
    expect(await base.biblioteca.get('l')).toMatchObject({ titulo: 'Un libro', pagina: 4 });
    // La misma palabra de la versión anterior no aparece repetida ni con otra clave.
    expect(await base.palabras.count()).toBe(1);
    base.close();
  });

  it('lo que se guarda en una lengua no aparece en otra', async () => {
    await baseDe('ja').palabras.put(palabra('die'));
    expect(await baseDe('de').palabras.get('die|')).toBeUndefined();
    await baseDe('de').palabras.put({ ...palabra('die'), estado: 'aprendiendo' });
    expect((await baseDe('ja').palabras.get('die|'))?.estado).toBe('conocida');
    expect((await baseDe('de').palabras.get('die|'))?.estado).toBe('aprendiendo');
    expect(await baseDe('de').consumo.count()).toBe(0);
  });

  it('cada lengua tiene una sola base abierta', () => {
    expect(baseDe('de')).toBe(baseDe('de'));
    expect(baseDe('de')).not.toBe(baseDe('ja'));
    expect(nombreBase('de')).toBe('kikitori-de');
  });

  it('db sigue a la lengua que se estudia', () => {
    usarBaseDe('de');
    expect(db.name).toBe('kikitori-de');
    usarBaseDe('ja');
    expect(db.name).toBe('kikitori');
  });
});

describe('la lengua del motor', () => {
  it('una lengua desconocida no cambia nada', () => {
    expect(fijarLengua('ja')).toBe(false);
    expect(fijarLengua('xx')).toBe(false);
    expect(lengua().id).toBe('ja');
    expect(db.name).toBe('kikitori');
  });
});
