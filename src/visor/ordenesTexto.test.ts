import { describe, expect, it } from 'vitest';
import { atajosRepetidos, entradasDe, MENUS, ordenDeTecla } from './comandos';
import { type AccionesLectura, type AccionesTexto, type EstadoLectura, type EstadoTexto, ordenesDeLectura, ordenesDelTexto } from './ordenesTexto';
import { type AccionesVisor, type EstadoVisor, ordenesDelVisor } from './ordenesVisor';

/** Unas acciones que solo apuntan qué se pidió. */
function acciones<T extends object>(hechas: string[] = []): T {
  return new Proxy({} as T, { get: (_, nombre) => (...args: unknown[]) => hechas.push([String(nombre), ...args.map((a) => JSON.stringify(a))].join(' ')) });
}

const LENGUA = {
  lectura: 'Furigana',
  lecturaEnPagina: true,
  acento: true,
  comic: false,
  letras: [
    { id: 'redondeada' as const, nombre: 'Redondeada' },
    { id: 'gotica' as const, nombre: 'Gótica' },
  ],
};

const ESTADO: EstadoTexto = {
  rtl: true,
  zoom: 100,
  invertir: false,
  lleno: false,
  lectura: false,
  verticalPropio: true,
  horizontal: false,
  hayIndice: true,
  indice: false,
  capitulo: 0,
  total: 5,
  atras: null,
  furigana: 'todas',
  mostrarEstado: true,
  colorAcento: 'siempre',
  letra: 'gotica',
  lengua: LENGUA,
};

describe('las órdenes del visor de texto', () => {
  const lista = ordenesDelTexto(ESTADO, acciones<AccionesTexto>());

  it('ninguna tecla lleva dos órdenes, y cada orden tiene su nombre', () => {
    expect(atajosRepetidos(lista)).toEqual([]);
    expect(new Set(lista.map((c) => c.id)).size).toBe(lista.length);
  });

  it('los menús del visor de páginas, salvo Texto y Anotar, que en un libro de texto no tienen nada', () => {
    const conAlgo = MENUS.filter((m) => entradasDe(lista, m.id).length).map((m) => m.id);
    expect(conAlgo).toEqual(['libro', 'ver', 'ir', 'ayudas', 'ayuda']);
  });

  it('las ayudas de lectura son las mismas que en el visor de páginas', () => {
    const paginas = ordenesDelVisor({ ...ESTADO, vista: 'una', portadaSola: true, zoom: 'pagina', vistaTexto: false, nitidez: { activa: false, nivel: 2, limpiar: false }, ocr: false, modoOcr: 'libro', textoPdf: true, hayTextoPropio: false, conTexto: false, panel: null, marcada: false, herramienta: 'seleccionar', fijada: false, aumento: true, furiganaPagina: 'desconocidas', gramaticaPagina: false, traduccionBajo: true, teclaFicha: 'Shift', voz: false } as EstadoVisor, acciones<AccionesVisor>());
    const ayudas = (l: typeof lista) => l.filter((c) => c.menu === 'ayudas' && c.grupo === 'palabras').map((c) => `${c.id}:${c.marcada}`);
    expect(ayudas(lista)).toEqual(ayudas(paginas));
    expect(ayudas(lista).length).toBeGreaterThan(4);
  });

  it('cambiar la lectura sobre las palabras se guarda en los ajustes', () => {
    const hechas: string[] = [];
    ordenesDelTexto(ESTADO, acciones<AccionesTexto>(hechas))
      .find((c) => c.id === 'furigana-desconocidas')
      ?.ejecutar();
    expect(hechas).toEqual(['ajuste {"furigana":"desconocidas"}']);
  });

  it('en vertical, las flechas van al revés, y las atiende el capítulo', () => {
    expect(lista.find((c) => c.id === 'siguiente')?.atajo).toBe('ArrowLeft');
    expect(ordenesDelTexto({ ...ESTADO, rtl: false }, acciones<AccionesTexto>()).find((c) => c.id === 'siguiente')?.atajo).toBe('ArrowRight');
    expect(ordenDeTecla(lista, 'ArrowLeft')).toBeUndefined();
  });

  it('el texto vertical se ofrece solo en un libro que lo trae, y dice cómo se está leyendo', () => {
    expect(lista.find((c) => c.id === 'texto-vertical')?.marcada).toBe(true);
    expect(ordenesDelTexto({ ...ESTADO, horizontal: true }, acciones<AccionesTexto>()).find((c) => c.id === 'texto-vertical')?.marcada).toBe(false);
    expect(ordenesDelTexto({ ...ESTADO, verticalPropio: false }, acciones<AccionesTexto>()).some((c) => c.id === 'texto-vertical')).toBe(false);
  });

  it('Atrás dice a qué capítulo vuelve, y sin un salto antes no se puede', () => {
    expect(lista.find((c) => c.id === 'atras')?.deshabilitada).toBe(true);
    const a = ordenesDelTexto({ ...ESTADO, atras: 2 }, acciones<AccionesTexto>()).find((c) => c.id === 'atras');
    expect(a?.etiqueta).toBe('Volver al capítulo 3');
    expect(a?.deshabilitada).toBe(false);
    expect(ordenDeTecla(ordenesDelTexto({ ...ESTADO, atras: 2 }, acciones<AccionesTexto>()), 'Alt+ArrowLeft')?.id).toBe('atras');
  });

  it('en el primer capítulo no hay anterior, y en el último no hay siguiente', () => {
    expect(lista.find((c) => c.id === 'capitulo-anterior')?.deshabilitada).toBe(true);
    expect(lista.find((c) => c.id === 'capitulo-siguiente')?.deshabilitada).toBe(false);
    const final = ordenesDelTexto({ ...ESTADO, capitulo: 4 }, acciones<AccionesTexto>());
    expect(final.find((c) => c.id === 'capitulo-siguiente')?.deshabilitada).toBe(true);
    const hechas: string[] = [];
    ordenesDelTexto({ ...ESTADO, capitulo: 4 }, acciones<AccionesTexto>(hechas))
      .find((c) => c.id === 'ultimo')
      ?.ejecutar();
    expect(hechas).toEqual(['capitulo 4']);
  });

  it('las teclas de una letra: el modo lectura, la pantalla completa, ir al capítulo y los atajos', () => {
    expect(['M', 'F', 'G', '?'].map((t) => ordenDeTecla(lista, t)?.id)).toEqual(['modo-lectura', 'pantalla-completa', 'ir-capitulo', 'atajos']);
  });

  it('sin índice en el libro, no se ofrece', () => {
    expect(ordenesDelTexto({ ...ESTADO, hayIndice: false }, acciones<AccionesTexto>()).some((c) => c.id === 'indice')).toBe(false);
  });
});

describe('las órdenes del visor de un texto de la Biblioteca', () => {
  const LECTURA: EstadoLectura = { pagina: 0, total: 3, lleno: false, lectura: false, furigana: 'todas', mostrarEstado: true, colorAcento: 'siempre', letra: 'gotica', lengua: LENGUA };
  const lista = ordenesDeLectura(LECTURA, acciones<AccionesLectura>());

  it('ninguna tecla lleva dos órdenes, y las ayudas de lectura son las de siempre', () => {
    expect(atajosRepetidos(lista)).toEqual([]);
    expect(lista.filter((c) => c.menu === 'ayudas').map((c) => c.id)).toEqual(ordenesDelTexto(ESTADO, acciones<AccionesTexto>()).filter((c) => c.menu === 'ayudas').map((c) => c.id));
  });

  it('se puede seguir escribiendo en el Cuaderno', () => {
    const hechas: string[] = [];
    ordenesDeLectura(LECTURA, acciones<AccionesLectura>(hechas))
      .find((c) => c.id === 'cuaderno')
      ?.ejecutar();
    expect(hechas).toEqual(['cuaderno']);
  });

  it('un texto de una página no tiene menú Ir; uno de varias va de página en página', () => {
    expect(ordenesDeLectura({ ...LECTURA, total: 1 }, acciones<AccionesLectura>()).some((c) => c.menu === 'ir')).toBe(false);
    expect(lista.find((c) => c.id === 'anterior')?.deshabilitada).toBe(true);
    const hechas: string[] = [];
    ordenesDeLectura({ ...LECTURA, pagina: 1 }, acciones<AccionesLectura>(hechas))
      .find((c) => c.id === 'ultima')
      ?.ejecutar();
    expect(hechas).toEqual(['ir 2']);
    expect(ordenDeTecla(lista, 'G')?.id).toBe('ir-pagina');
  });
});
