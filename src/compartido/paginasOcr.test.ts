import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { baseOcr, claveOcr, olvidarOcr } from './paginasOcr';

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
});
