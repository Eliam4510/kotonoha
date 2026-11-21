import { afterEach, describe, expect, it, vi } from 'vitest';
import { anotarUso, guardarAjustes, leerAjustes } from './ajustes';

/** Un chrome.storage.local de mentira, lento como el de verdad: leer y escribir tardan un poco. */
function almacenLento() {
  const datos: Record<string, unknown> = {};
  const espera = () => new Promise((ok) => setTimeout(ok, 5));
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: async (clave: string) => {
          await espera();
          return { [clave]: structuredClone(datos[clave]) };
        },
        set: async (o: Record<string, unknown>) => {
          await espera();
          Object.assign(datos, structuredClone(o));
        },
      },
    },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('guardar los ajustes', () => {
  it('dos cambios seguidos de partes de un mismo ajuste no se pisan', async () => {
    almacenLento();
    // Como al activar la voz local y elegir su estilo enseguida, antes de que la pantalla se entere del primer cambio.
    await Promise.all([
      guardarAjustes((x) => ({ vozLocal: { ...x.vozLocal, activa: true } })),
      guardarAjustes((x) => ({ vozLocal: { ...x.vozLocal, estilo: 8 } })),
    ]);
    const { vozLocal } = await leerAjustes();
    expect(vozLocal.activa).toBe(true);
    expect(vozLocal.estilo).toBe(8);
  });

  it('lo medido desde dos sitios a la vez se suma, no se pierde', async () => {
    almacenLento();
    await Promise.all([
      anotarUso((u) => ({ ...u, voz: { ...u.voz, haas: { velocidad: 30, dispositivo: 'webgpu', fecha: 1 } } })),
      anotarUso((u) => ({ ...u, ocr: { ...u.ocr, libro: { ms: [1000], dispositivo: 'webgpu', fecha: 1 } } })),
    ]);
    const { equipoUso } = await leerAjustes();
    expect(equipoUso.voz?.haas?.velocidad).toBe(30);
    expect(equipoUso.ocr?.libro?.ms).toEqual([1000]);
  });

  it('un cambio que falla no deja atascados los siguientes', async () => {
    almacenLento();
    await expect(
      guardarAjustes(() => {
        throw new Error('fallo');
      })
    ).rejects.toThrow('fallo');
    await guardarAjustes({ nombre: 'Prueba' });
    expect((await leerAjustes()).nombre).toBe('Prueba');
  });
});
