import { describe, expect, it } from 'vitest';
import { atajosRepetidos, buscarOrdenes, type Comando, entradasDe, MENUS, mostrarAtajo, ordenDeTecla, teclaDe } from './comandos';
import { type AccionesVisor, type EstadoVisor, ordenesDelVisor } from './ordenesVisor';

const nada = () => {};
/** Unas acciones que solo apuntan qué se pidió. */
function acciones(hechas: string[] = []): AccionesVisor {
  return new Proxy({} as AccionesVisor, { get: (_, nombre) => (...args: unknown[]) => hechas.push([String(nombre), ...args.map((a) => JSON.stringify(a))].join(' ')) });
}

const ESTADO: EstadoVisor = {
  vista: 'una',
  rtl: false,
  portadaSola: true,
  zoom: 'pagina',
  vistaTexto: false,
  invertir: false,
  nitidez: { activa: false, nivel: 2, limpiar: false },
  lleno: false,
  lectura: false,
  ocr: false,
  modoOcr: 'libro',
  textoPdf: true,
  hayTextoPropio: true,
  conTexto: true,
  hayIndice: true,
  panel: null,
  marcada: false,
  herramienta: 'seleccionar',
  atras: null,
  fijada: false,
  furigana: 'todas',
  mostrarEstado: true,
  colorAcento: 'siempre',
  letra: 'gotica',
  lengua: {
    lectura: 'Furigana',
    acento: true,
    comic: false,
    letras: [
      { id: 'redondeada', nombre: 'Redondeada' },
      { id: 'gotica', nombre: 'Gótica' },
    ],
  },
};

const orden = (o: Partial<Comando> & { id: string; etiqueta: string }): Comando => ({ menu: 'ver', grupo: 'g', ejecutar: nada, ...o });
const tecla = (key: string, m: Partial<Record<'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey', boolean>> = {}) => teclaDe({ key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...m });

describe('las teclas, como se escriben los atajos', () => {
  it('las letras, sin importar Mayús; los signos, como salen', () => {
    expect(tecla('g')).toBe('G');
    expect(tecla('G', { shiftKey: true })).toBe('G');
    expect(tecla('?', { shiftKey: true })).toBe('?');
  });
  it('Ctrl y Cmd valen igual, y Ctrl+= es Ctrl++', () => {
    expect(tecla('k', { ctrlKey: true })).toBe('Ctrl+K');
    expect(tecla('k', { metaKey: true })).toBe('Ctrl+K');
    expect(tecla('=', { ctrlKey: true })).toBe('Ctrl++');
    expect(tecla('+', { ctrlKey: true, shiftKey: true })).toBe('Ctrl++');
    expect(tecla('-', { ctrlKey: true })).toBe('Ctrl+-');
  });
  it('las teclas con nombre llevan Mayús si se pulsa', () => {
    expect(tecla('ArrowLeft', { altKey: true })).toBe('Alt+ArrowLeft');
    expect(tecla('Tab', { shiftKey: true })).toBe('Shift+Tab');
    expect(tecla(' ')).toBe('Space');
  });
  it('se enseñan con su flecha, y en un Mac con sus símbolos', () => {
    expect(mostrarAtajo('Alt+ArrowLeft', false)).toBe('Alt+←');
    expect(mostrarAtajo('Ctrl++', false)).toBe('Ctrl++');
    expect(mostrarAtajo('Ctrl+K', true)).toBe('⌘K');
    expect(mostrarAtajo('?', false)).toBe('?');
  });
});

describe('los menús', () => {
  it('agrupan por grupos con una raya entre ellos, y juntan cada submenú donde aparece', () => {
    const lista = [
      orden({ id: 'a', etiqueta: 'A', grupo: 'uno' }),
      orden({ id: 'b', etiqueta: 'B', grupo: 'dos', submenu: 'Sub' }),
      orden({ id: 'c', etiqueta: 'C', grupo: 'uno' }),
      orden({ id: 'd', etiqueta: 'D', grupo: 'dos', submenu: 'Sub' }),
      orden({ id: 'e', etiqueta: 'E', menu: 'ir', grupo: 'uno' }),
    ];
    const e = entradasDe(lista, 'ver');
    expect(e.map((x) => (x.tipo === 'orden' ? x.orden.id : x.tipo === 'submenu' ? `${x.nombre}:${x.ordenes.map((o) => o.id).join('')}` : '|'))).toEqual(['a', 'c', '|', 'Sub:bd']);
  });
});

describe('la paleta', () => {
  const lista = [
    orden({ id: 'acercar', etiqueta: 'Acercar', palabras: 'zoom' }),
    orden({ id: 'ancho', etiqueta: 'Ajustar al ancho', palabras: 'zoom' }),
    orden({ id: 'indice', etiqueta: 'Índice', menu: 'ir' }),
    orden({ id: 'revisar', etiqueta: 'Revisar el texto con Claude', menu: 'texto', deshabilitada: true }),
    orden({ id: 'buscar', etiqueta: 'Buscar en el libro', menu: 'texto' }),
    orden({ id: 'texto', etiqueta: 'Ver como texto' }),
  ];
  const ids = (q: string) => buscarOrdenes(lista, q).map((c) => c.id);
  it('sin tildes ni mayúsculas: «indice» encuentra «Índice»', () => {
    expect(ids('indice')[0]).toBe('indice');
  });
  it('primero lo que empieza así, después lo que tiene una palabra así', () => {
    expect(ids('a')).toEqual(['acercar', 'ancho']);
    // «Buscar en el libro» está en el menú Texto; «Revisar…», deshabilitada, va al final aunque se parezca más.
    expect(ids('texto')).toEqual(['texto', 'buscar', 'revisar']);
  });
  it('encuentra por otras palabras, y lo deshabilitado va al final', () => {
    expect(ids('zoom')).toEqual(['acercar', 'ancho']);
    expect(ids('el')).toEqual(['buscar', 'revisar']);
  });
  it('sin nada escrito, todas en el orden de los menús', () => {
    expect(ids('')).toEqual(['acercar', 'ancho', 'texto', 'indice', 'revisar', 'buscar']);
  });
});

describe('las órdenes del visor', () => {
  const lista = ordenesDelVisor(ESTADO, acciones());
  it('cada una con su nombre único y su texto', () => {
    const ids = lista.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(lista.every((c) => c.etiqueta.trim().length > 0)).toBe(true);
  });
  it('ninguna tecla lleva dos órdenes, tampoco en la vista de texto ni de derecha a izquierda', () => {
    expect(atajosRepetidos(lista)).toEqual([]);
    expect(atajosRepetidos(ordenesDelVisor({ ...ESTADO, vistaTexto: true, rtl: true }, acciones()))).toEqual([]);
  });
  it('cada menú tiene algo, y cada submenú, al menos dos opciones', () => {
    for (const m of MENUS) {
      const e = entradasDe(lista, m.id);
      expect(e.length, m.id).toBeGreaterThan(0);
      for (const x of e) if (x.tipo === 'submenu') expect(x.ordenes.length, x.nombre).toBeGreaterThan(1);
    }
  });
  it('en cada grupo de opciones hay una sola marcada', () => {
    const grupos = new Map<string, Comando[]>();
    for (const c of lista.filter((c) => c.tipo === 'opcion' && c.menu !== 'ver' && c.menu !== 'anotar')) grupos.set(`${c.menu}/${c.grupo}/${c.submenu}`, [...(grupos.get(`${c.menu}/${c.grupo}/${c.submenu}`) ?? []), c]);
    for (const [g, l] of grupos) expect(l.filter((c) => c.marcada).length, g).toBe(1);
    // Las herramientas van repartidas entre Ver y Anotar, pero también es una sola a la vez.
    expect(lista.filter((c) => ['seleccionar', 'mano', 'resaltador', 'nota'].includes(c.id) && c.marcada).map((c) => c.id)).toEqual(['seleccionar']);
  });
  it('en la vista de texto no se ofrece lo que es de la imagen', () => {
    const t = ordenesDelVisor({ ...ESTADO, vistaTexto: true }, acciones());
    expect(t.some((c) => ['acercar', 'zoom-ancho', 'nitidez', 'invertir'].includes(c.id))).toBe(false);
    expect(t.find((c) => c.id === 'resaltador')?.deshabilitada).toBe(true);
  });
  it('sin el OCR, sus modos se ven pero no se pueden elegir, y dicen por qué', () => {
    const libro = lista.find((c) => c.id === 'ocr-libro');
    expect(libro?.deshabilitada).toBe(true);
    expect(libro?.ayuda).toBeTruthy();
    expect(ordenesDelVisor({ ...ESTADO, ocr: true }, acciones()).find((c) => c.id === 'ocr-libro')?.deshabilitada).toBe(false);
  });
  it('Atrás dice a qué página vuelve, y sin un salto antes no se puede', () => {
    expect(lista.find((c) => c.id === 'atras')?.deshabilitada).toBe(true);
    const a = ordenesDelVisor({ ...ESTADO, atras: 11 }, acciones()).find((c) => c.id === 'atras');
    expect(a?.etiqueta).toBe('Volver a la página 12');
    expect(a?.deshabilitada).toBe(false);
  });
  it('sin acento en la lengua no hay su submenú, y con una sola letra tampoco el de la letra', () => {
    const l = ordenesDelVisor({ ...ESTADO, lengua: { ...ESTADO.lengua, acento: false, letras: [ESTADO.lengua.letras[0]] } }, acciones());
    expect(l.some((c) => c.id.startsWith('acento-') || c.id.startsWith('letra-'))).toBe(false);
  });
  it('las teclas ejecutan lo suyo, salvo las que atiende otra parte del visor', () => {
    const hechas: string[] = [];
    const l = ordenesDelVisor(ESTADO, acciones(hechas));
    ordenDeTecla(l, 'M')?.ejecutar();
    ordenDeTecla(l, 'R')?.ejecutar();
    ordenDeTecla(l, '?')?.ejecutar();
    expect(hechas).toEqual(['lectura', 'herramienta "resaltador"', 'atajos']);
    expect(ordenDeTecla(l, 'Home')).toBeUndefined();
    expect(ordenDeTecla(l, 'Ctrl+K')).toBeUndefined();
    // Atrás, sin un salto antes, no hace nada: la tecla queda para el navegador.
    expect(ordenDeTecla(l, 'Alt+ArrowLeft')).toBeUndefined();
  });
});
