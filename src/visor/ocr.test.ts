import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { baseOcr, claveOcr } from '../compartido/paginasOcr';
import { esCancelada, LectorOcr } from './ocr';

// Un trabajador de mentira: anota el orden en que le llegan las páginas y contesta a cada una con su número, cuando se le
// dice. Así se ve qué lee primero el lector y qué deja de leer.
const recibidas: number[] = [];
let contestar: () => void = () => {};
class TrabajadorFalso {
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  postMessage(p: { id: number; imagen: { n: number } }) {
    recibidas.push(p.imagen.n);
    contestar = () => this.onmessage?.({ data: { tipo: 'lineas', id: p.id, lineas: [{ texto: String(p.imagen.n) }], ms: 1, dispositivo: 'prueba', fases: {} } });
  }
  terminate() {}
}
Object.assign(globalThis, {
  Worker: TrabajadorFalso,
  chrome: { runtime: { getURL: (x: string) => x } },
  createImageBitmap: async (b: Blob) => ({ n: Number(await b.text()) }),
});

const espera = () => new Promise((ok) => setTimeout(ok, 20));
const pagina = (n: number) => async () => new Blob([String(n)]);
/** Contesta a la página en curso y espera a que el lector pase a la siguiente. */
const terminar = async () => {
  contestar();
  await espera();
};

describe('el lector del OCR', () => {
  beforeEach(async () => {
    recibidas.length = 0;
    await baseOcr().paginas.clear();
  });

  it('lee primero lo más urgente, aunque se pidiera después', async () => {
    const l = new LectorOcr(() => {});
    const primera = l.leer('libro', 0, 'manga', pagina(0), 5);
    await espera();
    // La 0 ya se está leyendo; de las que esperan, va antes la de prioridad 0.
    const resto = [l.leer('libro', 3, 'manga', pagina(3), 2), l.leer('libro', 1, 'manga', pagina(1), 0), l.leer('libro', 2, 'manga', pagina(2), 1)];
    await espera();
    for (let i = 0; i < 4; i++) await terminar();
    expect(recibidas).toEqual([0, 1, 2, 3]);
    expect((await primera)[0].texto).toBe('0');
    expect((await Promise.all(resto)).map((x) => x[0].texto)).toEqual(['3', '1', '2']);
  });

  it('cancela lo que se deja atrás antes de su turno, y no lo lee', async () => {
    const l = new LectorOcr(() => {});
    void l.leer('libro', 0, 'manga', pagina(0), 0);
    await espera();
    const atras = l.leer('libro', 1, 'manga', pagina(1), 1);
    const delante = l.leer('libro', 9, 'manga', pagina(9), 0);
    await espera();
    // Se salta a la página 9: la 1 ya no hace falta. La 0, que se estaba leyendo, termina igual.
    l.soloEstas('libro', 'manga', [9]);
    await expect(atras).rejects.toSatisfy(esCancelada);
    await terminar();
    await terminar();
    expect(recibidas).toEqual([0, 9]);
    expect((await delante)[0].texto).toBe('9');
  });

  it('lo ya leído sale de la base, sin pasar por el trabajador', async () => {
    await baseOcr().paginas.put({ clave: claveOcr('libro', 'libro', 4), libro: 'libro', lineas: [], creada: 1 });
    const l = new LectorOcr(() => {});
    expect(await l.leer('libro', 4, 'libro', pagina(4))).toEqual([]);
    expect(recibidas).toEqual([]);
  });

  it('una página pedida dos veces se lee una sola, con la prioridad más urgente', async () => {
    const l = new LectorOcr(() => {});
    void l.leer('libro', 0, 'manga', pagina(0), 0);
    await espera();
    const a = l.leer('libro', 5, 'manga', pagina(5), 9);
    void l.leer('libro', 6, 'manga', pagina(6), 3);
    const b = l.leer('libro', 5, 'manga', pagina(5), 1);
    expect(b).toBe(a);
    await espera();
    for (let i = 0; i < 3; i++) await terminar();
    expect(recibidas).toEqual([0, 5, 6]);
  });
});
