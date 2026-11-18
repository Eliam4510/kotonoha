// Las órdenes del visor, en un solo registro: de él salen los menús de la barra, la paleta (Ctrl+K), la lista de atajos
// («?») y las teclas. Cada orden dice en qué menú y grupo va, si es una casilla o una opción entre varias y con qué tecla
// se ejecuta; así un menú no puede ofrecer algo que la paleta no encuentre, ni dos órdenes pelearse por la misma tecla.

import { tm, tr } from '../compartido/i18n';
import type { NombreIcono } from '../ui/iconos';

export type IdMenu = 'libro' | 'ver' | 'ir' | 'texto' | 'ayudas' | 'anotar' | 'ayuda';

/** Los menús de la barra, en su orden. */
export const MENUS: { id: IdMenu; nombre: string }[] = [
  { id: 'libro', nombre: tm('Libro') },
  { id: 'ver', nombre: tm('Ver') },
  { id: 'ir', nombre: tm('Ir') },
  { id: 'texto', nombre: tm('Texto') },
  { id: 'ayudas', nombre: tm('Ayudas') },
  { id: 'anotar', nombre: tm('Anotar') },
  { id: 'ayuda', nombre: tm('Ayuda') },
];

export interface Comando {
  /** Único en el visor: lo usan las pruebas (data-orden) y la paleta para no repetir. */
  id: string;
  /** Lo que dice el menú, ya traducido. */
  etiqueta: string;
  menu: IdMenu;
  /** Las órdenes de un mismo grupo van juntas; entre un grupo y otro, una raya. */
  grupo: string;
  /** El submenú en que va, ya traducido. Hay un solo nivel: un submenú no tiene submenús. */
  submenu?: string;
  icono?: NombreIcono;
  /** La tecla que la ejecuta, escrita como la devuelve teclaDe: «G», «Ctrl+K», «Alt+ArrowLeft». */
  atajo?: string;
  /** Si esa tecla la atiende otra parte del visor (las flechas, Inicio, Fin): aquí solo se enseña. */
  atajoAparte?: boolean;
  /** Una casilla que se marca, o una opción de las que solo vale una a la vez. */
  tipo?: 'casilla' | 'opcion';
  marcada?: boolean;
  deshabilitada?: boolean;
  /** Más detalle: al pasar por encima y en la paleta. Si está deshabilitada, por qué. */
  ayuda?: string;
  /** Otras palabras con que la encuentra la paleta. */
  palabras?: string;
  ejecutar: () => void;
}

export type EntradaMenu = { tipo: 'orden'; orden: Comando } | { tipo: 'submenu'; nombre: string; ordenes: Comando[] } | { tipo: 'raya' };

/** Lo que muestra un menú: sus órdenes por grupos, con una raya entre grupos y los submenús donde aparece su primera orden. */
export function entradasDe(lista: Comando[], menu: IdMenu): EntradaMenu[] {
  const grupos = new Map<string, EntradaMenu[]>();
  for (const c of lista) {
    if (c.menu !== menu) continue;
    let g = grupos.get(c.grupo);
    if (!g) grupos.set(c.grupo, (g = []));
    if (!c.submenu) {
      g.push({ tipo: 'orden', orden: c });
      continue;
    }
    const s = g.find((e): e is Extract<EntradaMenu, { tipo: 'submenu' }> => e.tipo === 'submenu' && e.nombre === c.submenu);
    if (s) s.ordenes.push(c);
    else g.push({ tipo: 'submenu', nombre: c.submenu, ordenes: [c] });
  }
  const salida: EntradaMenu[] = [];
  for (const g of grupos.values()) {
    if (salida.length) salida.push({ tipo: 'raya' });
    salida.push(...g);
  }
  return salida;
}

/** Para comparar sin mayúsculas ni tildes. Solo se quitan los diacríticos latinos: el dakuten de が no es una tilde. */
export const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const SEPARADORES = /[\s,.:;¿?¡!()«»"'/·…-]+/u;

/**
 * Las órdenes que encuentra la paleta para lo escrito, de la que más se parece a la que menos: primero la que se llama
 * así, luego las que empiezan así, las que tienen palabras que empiezan así y las que lo contienen; al final, las que solo
 * lo nombran en su menú, su submenú o su ayuda. Las deshabilitadas van detrás, para que se vea que existen y por qué no.
 * Sin nada escrito, todas, en el orden de los menús.
 */
export function buscarOrdenes(lista: Comando[], consulta: string, nombreMenu: (m: IdMenu) => string = (m) => m): Comando[] {
  const q = normalizar(consulta);
  const orden = (c: Comando) => MENUS.findIndex((m) => m.id === c.menu);
  if (!q) return lista.map((c, i) => ({ c, i })).sort((a, b) => orden(a.c) - orden(b.c) || a.i - b.i).map((x) => x.c);
  const partes = q.split(/\s+/).filter(Boolean);
  const puntos = (c: Comando) => {
    const e = normalizar(c.etiqueta);
    if (e === q) return 100;
    if (e.startsWith(q)) return 80;
    const palabras = e.split(SEPARADORES);
    if (partes.every((p) => palabras.some((w) => w.startsWith(p)))) return 60;
    // Con una sola letra, «contiene» lo encuentra casi todo: solo cuenta cómo empiezan.
    if ([...q].length < 2) return 0;
    if (e.includes(q)) return 40;
    const todo = `${e} ${normalizar([c.submenu, c.ayuda, c.palabras, nombreMenu(c.menu)].filter(Boolean).join(' '))}`;
    return partes.every((p) => todo.includes(p)) ? 20 : 0;
  };
  return lista
    .map((c, i) => ({ c, i, p: puntos(c) }))
    .filter((x) => x.p > 0)
    .sort((a, b) => Number(!!a.c.deshabilitada) - Number(!!b.c.deshabilitada) || b.p - a.p || orden(a.c) - orden(b.c) || a.i - b.i)
    .map((x) => x.c);
}

/**
 * Una tecla pulsada, escrita como los atajos: «Ctrl+K», «Alt+ArrowLeft», «G», «?». Las mayúsculas no cuentan en las
 * letras, y Mayús tampoco en los signos, que ya cambian con ella: «?» es Mayús y otra tecla según el teclado. Cmd vale
 * como Ctrl, y Ctrl+= como Ctrl++, que en un teclado estadounidense es la misma tecla sin Mayús.
 */
export function teclaDe(e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'>): string {
  const partes: string[] = [];
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl) partes.push('Ctrl');
  if (e.altKey) partes.push('Alt');
  const imprimible = e.key.length === 1 && e.key !== ' ';
  if (e.shiftKey && !imprimible) partes.push('Shift');
  const k = e.key === ' ' ? 'Space' : imprimible ? e.key.toUpperCase() : e.key;
  partes.push(ctrl && k === '=' ? '+' : k);
  return partes.join('+');
}

/** La orden que ejecuta una tecla, si la hay y se puede ejecutar ahora. */
export const ordenDeTecla = (lista: Comando[], tecla: string) => lista.find((c) => c.atajo === tecla && !c.atajoAparte && !c.deshabilitada);

/** Los atajos que llevan dos órdenes a la vez: debe estar vacío. */
export function atajosRepetidos(lista: Comando[]): string[] {
  const vistos = new Map<string, number>();
  for (const c of lista) if (c.atajo) vistos.set(c.atajo, (vistos.get(c.atajo) ?? 0) + 1);
  return [...vistos].filter(([, n]) => n > 1).map(([t]) => t);
}

const NOMBRES_TECLA: Record<string, string> = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Escape: 'Esc' };

/** Un atajo como se enseña: «Ctrl+K», o «⌘K» en un Mac; las flechas, con su flecha. */
export function mostrarAtajo(atajo: string, mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)): string {
  const i = atajo.lastIndexOf('+', atajo.length - 2);
  const modificadores = i >= 0 ? atajo.slice(0, i).split('+') : [];
  const k = atajo.slice(i + 1);
  const tecla = k === 'Space' ? tr('Espacio') : (NOMBRES_TECLA[k] ?? k);
  if (mac) return modificadores.map((m) => ({ Ctrl: '⌘', Alt: '⌥', Shift: '⇧' })[m] ?? m).join('') + tecla;
  return [...modificadores.map((m) => (m === 'Shift' ? tr('Mayús') : m)), tecla].join('+');
}
