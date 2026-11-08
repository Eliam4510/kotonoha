import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { baseOcr, claveOcr, edicionesDe, guardarEdicion, olvidarOcr, quitarEdicion } from './paginasOcr';

describe('lo leído por el OCR', () => {
  it('al subir la versión del OCR se olvida lo leído antes, para volver a leerlo con lo nuevo', async () => {
    // Como la dejó la 0.9.1: la base en su versión 1, con una página leída.
    const anterior = new Dexie('kotonoha-ocr');
    anterior.version(1).stores({ paginas: 'clave, libro' });
    await anterior.table('paginas').put({ clave: claveOcr('libro', 'manga', 3), libro: 'libro', lineas: [], creada: 1 });
    anterior.close();

    expect(await baseOcr().paginas.count()).toBe(0);
    // Lo que se lee después sí se guarda.
    await baseOcr().paginas.put({ clave: claveOcr('libro', 'manga', 3), libro: 'libro', lineas: [], creada: 2 });
    expect(await baseOcr().paginas.get(claveOcr('libro', 'manga', 3))).toMatchObject({ creada: 2 });
    await olvidarOcr('libro');
    expect(await baseOcr().paginas.count()).toBe(0);
  });

  it('con el reconocedor nuevo del modo Libro se olvida lo leído en ese modo; el manga y lo editado siguen', async () => {
    baseOcr().close();
    await Dexie.delete('kotonoha-ocr');
    // Como la dejó la 0.9.4: versión 3, con una página de cada modo y una línea editada.
    const anterior = new Dexie('kotonoha-ocr');
    anterior.version(3).stores({ paginas: 'clave, libro', ediciones: 'clave, libro' });
    await anterior.table('paginas').bulkPut([
      { clave: claveOcr('a', 'libro', 1), libro: 'a', lineas: [], creada: 1 },
      { clave: claveOcr('a', 'manga', 1), libro: 'a', lineas: [], creada: 1 },
    ]);
    await anterior.table('ediciones').put({ clave: 'a:1:x', libro: 'a', pagina: 1, caja: { x0: 0, y0: 0, x1: 1, y1: 1 }, original: 'あ', texto: 'い', creada: 1 });
    anterior.close();
    await baseOcr().open();
    expect((await baseOcr().paginas.toArray()).map((f) => f.clave)).toEqual([claveOcr('a', 'manga', 1)]);
    expect(await edicionesDe('a')).toHaveLength(1);
  });

  it('lo editado a mano se guarda aparte: sobrevive a lo leído y se va con el libro', async () => {
    const caja = { x0: 0, y0: 0, x1: 1, y1: 0.1 };
    await guardarEdicion({ clave: 'libro:0:a', libro: 'libro', pagina: 0, caja, original: 'まちがい', texto: 'まちがえ', creada: 1 });
    await guardarEdicion({ clave: 'otro:0:a', libro: 'otro', pagina: 0, caja, original: 'あ', texto: 'い', creada: 1 });
    // El OCR vuelve a leer la página (lo leído se borra): lo editado sigue.
    await baseOcr().paginas.clear();
    expect((await edicionesDe('libro')).map((e) => e.texto)).toEqual(['まちがえ']);
    await quitarEdicion('libro:0:a');
    expect(await edicionesDe('libro')).toEqual([]);
    await olvidarOcr('otro');
    expect(await edicionesDe('otro')).toEqual([]);
  });
});
