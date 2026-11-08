import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { baseOcr, claveOcr, LECTURA } from '../compartido/paginasOcr';
import { esCancelada, LectorOcr } from './ocr';

// Un trabajador de mentira: anota el orden en que le llegan las páginas y contesta a cada una con su número, cuando se le
// dice, en una línea que ocupa la mitad de arriba a la izquierda de la imagen. Así se ve qué lee primero el lector, qué
// deja de leer y dónde pone las líneas.
const recibidas: number[] = [];
let contestar: () => void = () => {};
const MITAD = { x0: 0, y0: 0, x1: 0.5, y1: 0.5 };
class TrabajadorFalso {
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  postMessage(p: { id: number; imagen: { n: number } }) {
    recibidas.push(p.imagen.n);
    const lineas = [{ texto: String(p.imagen.n), caja: MITAD, vertical: false }];
    contestar = () => this.onmessage?.({ data: { tipo: 'lineas', id: p.id, lineas, ms: 1, dispositivo: 'prueba', fases: {} } });
  }
  terminate() {}
}
Object.assign(globalThis, {
  Worker: TrabajadorFalso,
  chrome: { runtime: { getURL: (x: string) => x } },
  createImageBitmap: async (b: Blob) => ({ n: Number(await b.text()) }),
});

const espera = () => new Promise((ok) => setTimeout(ok, 20));
const pagina = (n: number) => async () => ({ imagen: new Blob([String(n)]) });
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

  it('lo leído de una imagen que no es la página entera se pone en su sitio de la página', async () => {
    const l = new LectorOcr(() => {});
    // Un escaneo que ocupa la página menos un margen de una décima por cada lado.
    const marco = { x0: 0.1, y0: 0.1, x1: 0.9, y1: 0.9 };
    const leidas = l.leer('libro', 0, 'libro', async () => ({ imagen: new Blob(['0']), marco }));
    await espera();
    await terminar();
    const [linea] = await leidas;
    expect(linea.caja.x0).toBeCloseTo(0.1);
    expect(linea.caja.y0).toBeCloseTo(0.1);
    expect(linea.caja.x1).toBeCloseTo(0.5);
    expect(linea.caja.y1).toBeCloseTo(0.5);
    // Y así se guarda, con la lectura de hoy.
    const fila = await baseOcr().paginas.get(claveOcr('libro', 'libro', 0));
    expect(fila?.lineas[0].caja.x1).toBeCloseTo(0.5);
    expect(fila?.lectura).toBe(LECTURA);
  });

  it('lo leído con una lectura anterior a la que pide el libro se vuelve a leer', async () => {
    await baseOcr().paginas.bulkPut([
      { clave: claveOcr('pdf', 'libro', 1), libro: 'pdf', lineas: [], creada: 1 },
      { clave: claveOcr('pdf', 'libro', 2), libro: 'pdf', lineas: [], creada: 1, lectura: LECTURA },
    ]);
    const l = new LectorOcr(() => {});
    // La 2 ya se leyó con la lectura de hoy: sale de la base. La 1 es de antes: se lee otra vez y se guarda encima.
    expect(await l.leer('pdf', 2, 'libro', pagina(2), 0, 1)).toEqual([]);
    const nueva = l.leer('pdf', 1, 'libro', pagina(1), 0, 1);
    await espera();
    await terminar();
    expect((await nueva)[0].texto).toBe('1');
    expect(recibidas).toEqual([1]);
    expect((await baseOcr().paginas.get(claveOcr('pdf', 'libro', 1)))?.lectura).toBe(LECTURA);
    // Sin pedir una lectura mínima (un CBZ, un EPUB), lo de antes vale.
    await baseOcr().paginas.put({ clave: claveOcr('cbz', 'libro', 1), libro: 'cbz', lineas: [], creada: 1 });
    expect(await l.leer('cbz', 1, 'libro', pagina(1))).toEqual([]);
    expect(recibidas).toEqual([1]);
  });

  it('cerrado mientras prepara una imagen, no arranca el trabajador para leerla', async () => {
    const l = new LectorOcr(() => {});
    let soltar: () => void = () => {};
    const lenta = l.leer('libro', 7, 'libro', () => new Promise((ok) => (soltar = () => ok({ imagen: new Blob(['7']) }))));
    await espera();
    l.cerrar();
    soltar();
    await expect(lenta).rejects.toSatisfy(esCancelada);
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
