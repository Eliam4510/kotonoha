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
