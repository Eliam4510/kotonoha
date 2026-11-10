// El índice del diccionario: se hace recorriendo todas las entradas, se guarda, y mientras los diccionarios sean los
// mismos se lee guardado en vez de rehacerlo. De él salen las palabras con un carácter y las categorías.

import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { baseDe, type FilaTermino } from './db';

const COMUN = String.fromCodePoint(0x2b50);
const fila = (termino: string, lectura: string, glosa: string, tags: string): FilaTermino => ({ dic: 'd', termino, lectura, tags, reglas: '', puntuacion: 1, glosas: [glosa], seq: 1 });

describe('índice del diccionario', () => {
  beforeAll(async () => {
    const base = baseDe('ja');
    await base.diccionarios.put({ id: 'd', titulo: 'D', tipo: 'terminos', orden: 0, filas: 7, instalado: 1 });
    await base.terminos.bulkAdd([
      fila('今日', 'きょう', 'hoy', `${COMUN} gikun`),
      // La misma palabra escrita en kana lleva la etiqueta, pero no es una lectura especial de nada.
      fila('きょう', 'きょう', 'hoy', `${COMUN} gikun`),
      fila('今度', 'こんど', 'esta vez', COMUN),
      fila('今', 'いま', 'ahora', COMUN),
      fila('今更', 'いまさら', 'a estas alturas', 'adv'),
      fila('寿司', 'すし', 'sushi', `ateji ${COMUN}`),
      // Una grafía rara, sin la marca de uso común: está en la categoría, pero no se enseña con el carácter.
      fila('今行', 'いまぎょう', 'rareza', 'ateji'),
    ]);
  });

  it('las palabras de uso común con un carácter, sin él solo', async () => {
    const { palabrasConCaracter } = await import('./explorar');
    const r = await palabrasConCaracter('今');
    expect(r.total).toBe(2);
    expect(r.filas.map((x) => x.termino).sort()).toEqual(['今度', '今日']);
  });

  it('las de lectura especial: solo las que se escriben con sus caracteres', async () => {
    const { categoriaConCaracter, categoriaDiccionario } = await import('./explorar');
    expect((await categoriaConCaracter('lecturas-especiales', '今')).map((x) => x.termino)).toEqual(['今日']);
    const todas = await categoriaDiccionario('lecturas-especiales');
    expect(todas.total).toBe(3);
    expect(todas.filas.map((x) => x.termino).sort()).toEqual(['今日', '今行', '寿司']);
  });

  it('se guarda, y con los mismos diccionarios se lee guardado sin recorrerlos otra vez', async () => {
    const base = baseDe('ja');
    const guardado = await base.indices.get('explorar');
    expect(guardado?.firma.startsWith('1|ja|d:7:1|')).toBe(true);
    // Se cambia lo guardado: si el motor arranca de nuevo y da esto, es que lo ha leído y no lo ha rehecho.
    const marca = { termino: '今時', lectura: 'いまどき', glosa: 'hoy en día', glosas: ['hoy en día'], comun: true, puntuacion: 1 };
    await base.indices.put({ ...guardado!, datos: { categorias: [], comunes: [marca] } });
    vi.resetModules();
    const nuevo = await import('./explorar');
    expect((await nuevo.palabrasConCaracter('今')).filas.map((x) => x.termino)).toEqual(['今時']);

    // Al cambiar los diccionarios, lo guardado ya no vale: se rehace y se guarda el nuevo.
    const { baseDe: baseNueva } = await import('./db');
    await baseNueva('ja').diccionarios.update('d', { filas: 8 });
    expect((await nuevo.palabrasConCaracter('今')).filas.map((x) => x.termino).sort()).toEqual(['今度', '今日']);
    expect((await baseNueva('ja').indices.get('explorar'))?.firma.startsWith('1|ja|d:8:1|')).toBe(true);
  });
});
