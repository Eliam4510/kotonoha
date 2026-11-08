import { describe, expect, it } from 'vitest';
import type { ColeccionBiblioteca, ElementoBiblioteca } from '../compartido/tipos';
import { aplicarCambio, avanceDe, coleccionesDeImportados, enCurso, filtrar, librosDe, resumenDe } from './estanteria';

let n = 0;
const libro = (titulo: string, extra: Partial<ElementoBiblioteca> = {}, paginas = 100): ElementoBiblioteca => ({
  id: `l${n++}`,
  titulo,
  texto: '',
  origen: 'archivo',
  creado: n,
  documento: { formato: 'cbz', paginas, direccion: 'rtl', tamano: 1 },
  ...extra,
});
const avance = (e: ElementoBiblioteca) => avanceDe(e, e.documento?.paginas ?? 1);
const serie: ColeccionBiblioteca = { id: 'serie', nombre: 'Mi serie', tipo: 'manga', creada: 1 };

describe('el avance de un libro', () => {
  it('por páginas: sin empezar, a medias y terminado', () => {
    expect(avance(libro('a'))).toMatchObject({ actual: 1, total: 100, empezado: false, terminado: false });
    expect(avance(libro('a', { pagina: 49 }))).toMatchObject({ actual: 50, fraccion: 0.5, empezado: true, terminado: false });
    expect(avance(libro('a', { pagina: 10, terminado: 5 }))).toMatchObject({ fraccion: 1, empezado: true, terminado: true });
  });

  it('en un libro de texto cuenta también lo que se lleva del capítulo', () => {
    const e = libro('a', { pagina: 2, documento: { formato: 'epub', texto: true, paginas: 10, direccion: 'ltr', tamano: 1, posicion: 0.5 } });
    expect(avance(e)).toMatchObject({ actual: 3, total: 10, empezado: true });
    expect(avance(e).fraccion).toBeCloseTo(0.25);
    // Al principio del primer capítulo, pero ya desplazado: empezado.
    expect(avance(libro('b', { documento: { formato: 'epub', texto: true, paginas: 10, direccion: 'ltr', tamano: 1, posicion: 0.1 } })).empezado).toBe(true);
  });

  it('los filtros y lo que se está leyendo, lo último abierto primero', () => {
    const nuevo = libro('nuevo');
    const viejo = libro('viejo', { pagina: 5, abierto: 10 });
    const reciente = libro('reciente', { pagina: 3, abierto: 20 });
    const acabado = libro('acabado', { pagina: 99, abierto: 30, terminado: 30 });
    const todos = [nuevo, viejo, reciente, acabado];
    expect(filtrar(todos, 'leyendo', avance)).toEqual([viejo, reciente]);
    expect(filtrar(todos, 'sin-empezar', avance)).toEqual([nuevo]);
    expect(filtrar(todos, 'terminados', avance)).toEqual([acabado]);
    expect(filtrar(todos, 'todo', avance)).toEqual(todos);
    expect(enCurso(todos, avance)).toEqual([reciente, viejo]);
    expect(enCurso(todos, avance, 1)).toEqual([reciente]);
  });
});

describe('una colección', () => {
  it('sus libros van en orden natural, con el 2 antes que el 10', () => {
    const lista = [libro('Mi serie 10', { coleccion: 'serie' }), libro('Otra cosa'), libro('Mi_serie_2', { coleccion: 'serie' }), libro('Mi serie 1', { coleccion: 'serie' })];
    expect(librosDe(serie, lista).map((e) => e.titulo)).toEqual(['Mi serie 1', 'Mi_serie_2', 'Mi serie 10']);
  });

  it('por dónde se va: el último tomo abierto sin terminar, y cuánto se lleva', () => {
    const lista = [
      libro('Tomo 1', { coleccion: 'serie', terminado: 1, abierto: 1, documento: { formato: 'cbz', paginas: 100, direccion: 'rtl', tamano: 1, portada: 'tapa-1' } }),
      libro('Tomo 2', { coleccion: 'serie', pagina: 49, abierto: 3 }),
      libro('Tomo 3', { coleccion: 'serie' }),
      libro('Tomo 4', { coleccion: 'serie', pagina: 9, abierto: 2 }),
    ];
    const r = resumenDe(serie, lista, avance);
    expect(r.terminados).toBe(1);
    expect(r.actual?.titulo).toBe('Tomo 2');
    expect(r.posicion).toBe(2);
    // Uno terminado, medio tomo y una décima de otro, entre cuatro.
    expect(r.fraccion).toBeCloseTo((1 + 0.5 + 0.1) / 4);
    expect(r.portada).toBe('tapa-1');
    expect(resumenDe({ ...serie, portada: 'propia' }, lista, avance).portada).toBe('propia');
  });

  it('sin abrir ninguno no hay tomo actual; vacía no tiene avance', () => {
    expect(resumenDe(serie, [libro('Tomo 1', { coleccion: 'serie' })], avance)).toMatchObject({ terminados: 0, fraccion: 0 });
    expect(resumenDe(serie, [libro('Tomo 1', { coleccion: 'serie' })], avance).actual).toBeUndefined();
    expect(resumenDe(serie, [], avance)).toMatchObject({ libros: [], fraccion: 0 });
  });
});

describe('las colecciones de lo importado', () => {
  const importado = (id: string, carpeta?: string, rtl = true) => ({ id, rtl, ...(carpeta ? { carpeta } : {}) });

  it('los tomos de una misma carpeta hacen una colección con su nombre, de manga si se leen de derecha a izquierda', () => {
    const plan = coleccionesDeImportados([importado('a', 'Mangas/Mi serie'), importado('b', 'Mangas/Mi serie'), importado('c')], []);
    expect(plan).toEqual({ nuevas: [{ nombre: 'Mi serie', tipo: 'manga', libros: ['a', 'b'] }], anadir: [] });
    // Libros de izquierda a derecha: sin tipo.
    expect(coleccionesDeImportados([importado('a', 'Química', false), importado('b', 'Química', false)], []).nuevas).toEqual([{ nombre: 'Química', libros: ['a', 'b'] }]);
  });

  it('un libro suelto no es una colección, salvo que ya exista una que se llame como su carpeta', () => {
    expect(coleccionesDeImportados([importado('a', 'Mi serie')], [])).toEqual({ nuevas: [], anadir: [] });
    const existentes: ColeccionBiblioteca[] = [{ id: 'x', nombre: 'mi serie ', creada: 1 }];
    expect(coleccionesDeImportados([importado('a', 'Descargas/Mi Serie')], existentes)).toEqual({ nuevas: [], anadir: [{ coleccion: 'x', libros: ['a'] }] });
  });

  it('sin la web de donde se bajó', () => {
    expect(coleccionesDeImportados([importado('a', 'Descargas.APP-Mi serie'), importado('b', 'Descargas.APP-Mi serie')], []).nuevas[0].nombre).toBe('Mi serie');
  });
});

describe('un cambio sobre lo guardado', () => {
  it('cambia lo que trae, quita lo que llega como null y junta el documento', () => {
    const e = libro('a', { coleccion: 'serie', terminado: 5, pagina: 3 });
    const c = aplicarCambio(e, { pagina: 7, coleccion: null, documento: { portada: 'nueva' } });
    expect(c.pagina).toBe(7);
    expect('coleccion' in c).toBe(false);
    expect(c.terminado).toBe(5);
    expect(c.documento).toEqual({ ...e.documento, portada: 'nueva' });
    // Lo que no trae, o trae sin valor, se queda.
    expect(aplicarCambio(e, { terminado: undefined }).terminado).toBe(5);
    // Un texto sin documento no gana uno.
    expect(aplicarCambio({ ...e, documento: undefined }, { documento: { portada: 'x' } }).documento).toBeUndefined();
  });
});
