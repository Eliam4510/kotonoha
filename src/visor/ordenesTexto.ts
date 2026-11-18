// Las órdenes del visor de un EPUB de texto, como las del visor de páginas (ordenesVisor.ts): los mismos menús, las mismas
// teclas y las mismas ayudas de lectura, con lo que tiene sentido en un libro que es texto y se lee por capítulos. Es una
// función pura, como aquella: el visor la llama en cada pintado con su estado, y las pruebas, con uno inventado.

import { tr } from '../compartido/i18n';
import type { Comando } from './comandos';
import { type AjusteLectura, type AyudasLectura, ordenesAyuda, ordenesAyudasLectura } from './ordenesVisor';

export interface EstadoTexto extends AyudasLectura {
  /** El texto va en vertical: avanzar es ir hacia la izquierda, y las flechas van al revés. */
  rtl: boolean;
  /** El zoom, en tanto por ciento. */
  zoom: number;
  invertir: boolean;
  lleno: boolean;
  /** El modo lectura: sin barras, solo el libro. */
  lectura: boolean;
  /** Si el libro trae escritura vertical: entonces se elige entre leerlo así o en renglones. */
  verticalPropio: boolean;
  horizontal: boolean;
  hayIndice: boolean;
  /** Si el índice está abierto. */
  indice: boolean;
  capitulo: number;
  total: number;
  /** El capítulo al que vuelve «Atrás», si se ha saltado de un sitio a otro. */
  atras: number | null;
}

export interface AccionesTexto {
  biblioteca(): void;
  vocabulario(): void;
  zoom(z: 'mas' | 'menos' | 'normal'): void;
  invertir(): void;
  horizontal(): void;
  lectura(): void;
  pantallaCompleta(): void;
  pagina(paso: 1 | -1): void;
  capitulo(n: number): void;
  irACapitulo(): void;
  atras(): void;
  indice(): void;
  ajuste(c: AjusteLectura): void;
  atajos(): void;
  paleta(): void;
}

export function ordenesDelTexto(e: EstadoTexto, h: AccionesTexto): Comando[] {
  const o: Comando[] = [];
  const ultimo = Math.max(0, e.total - 1);

  // ---------- Libro ----------
  o.push(
    { id: 'vocabulario', etiqueta: tr('Vocabulario del libro'), menu: 'libro', grupo: 'libro', icono: 'palabras', ejecutar: h.vocabulario },
    { id: 'biblioteca', etiqueta: tr('Volver a la Biblioteca'), menu: 'libro', grupo: 'salir', icono: 'flecha-izq', ejecutar: h.biblioteca }
  );

  // ---------- Ver ----------
  o.push(
    { id: 'acercar', etiqueta: tr('Acercar'), menu: 'ver', grupo: 'zoom', icono: 'acercar', atajo: 'Ctrl++', palabras: 'zoom', ejecutar: () => h.zoom('mas') },
    { id: 'alejar', etiqueta: tr('Alejar'), menu: 'ver', grupo: 'zoom', icono: 'alejar', atajo: 'Ctrl+-', palabras: 'zoom', ejecutar: () => h.zoom('menos') },
    { id: 'zoom-normal', etiqueta: tr('Tamaño normal'), menu: 'ver', grupo: 'zoom', atajo: 'Ctrl+0', palabras: 'zoom', ejecutar: () => h.zoom('normal') }
  );
  if (e.verticalPropio || e.horizontal)
    o.push({
      id: 'texto-vertical',
      etiqueta: tr('Texto vertical'),
      menu: 'ver',
      grupo: 'texto',
      icono: 'texto-vertical',
      tipo: 'casilla',
      marcada: !e.horizontal,
      ayuda: tr('En columnas, como viene el libro; quitado, en renglones'),
      ejecutar: h.horizontal,
    });
  o.push(
    { id: 'invertir', etiqueta: tr('Invertir colores'), menu: 'ver', grupo: 'texto', icono: 'invertir', tipo: 'casilla', marcada: e.invertir, ejecutar: h.invertir },
    { id: 'modo-lectura', etiqueta: tr('Modo lectura'), menu: 'ver', grupo: 'pantalla', icono: 'modo-lectura', tipo: 'casilla', marcada: e.lectura, atajo: 'M', ayuda: tr('Solo la página, sin barras: se asoman al llevar el ratón arriba'), ejecutar: h.lectura },
    { id: 'pantalla-completa', etiqueta: tr('Pantalla completa'), menu: 'ver', grupo: 'pantalla', icono: 'pantalla-completa', tipo: 'casilla', marcada: e.lleno, atajo: 'F', ejecutar: h.pantallaCompleta }
  );

  // ---------- Ir ----------
  // Las flechas, la barra espaciadora, Inicio y Fin los atiende el capítulo, en su marco: aquí solo se enseñan.
  o.push(
    { id: 'anterior', etiqueta: tr('Página anterior'), menu: 'ir', grupo: 'paginas', icono: 'anterior', atajo: e.rtl ? 'ArrowRight' : 'ArrowLeft', atajoAparte: true, ejecutar: () => h.pagina(-1) },
    { id: 'siguiente', etiqueta: tr('Página siguiente'), menu: 'ir', grupo: 'paginas', icono: 'siguiente', atajo: e.rtl ? 'ArrowLeft' : 'ArrowRight', atajoAparte: true, ejecutar: () => h.pagina(1) },
    { id: 'capitulo-anterior', etiqueta: tr('Capítulo anterior'), menu: 'ir', grupo: 'capitulos', deshabilitada: e.capitulo <= 0, ejecutar: () => h.capitulo(e.capitulo - 1) },
    { id: 'capitulo-siguiente', etiqueta: tr('Capítulo siguiente'), menu: 'ir', grupo: 'capitulos', deshabilitada: e.capitulo >= ultimo, ejecutar: () => h.capitulo(e.capitulo + 1) },
    { id: 'primero', etiqueta: tr('Primer capítulo'), menu: 'ir', grupo: 'capitulos', icono: 'primera', ejecutar: () => h.capitulo(0) },
    { id: 'ultimo', etiqueta: tr('Último capítulo'), menu: 'ir', grupo: 'capitulos', icono: 'ultima', ejecutar: () => h.capitulo(ultimo) },
    { id: 'ir-capitulo', etiqueta: tr('Ir al capítulo'), menu: 'ir', grupo: 'saltar', atajo: 'G', palabras: tr('número'), ejecutar: h.irACapitulo },
    {
      id: 'atras',
      etiqueta: e.atras === null ? tr('Atrás') : tr('Volver al capítulo {0}', e.atras + 1),
      menu: 'ir',
      grupo: 'saltar',
      icono: 'volver',
      atajo: 'Alt+ArrowLeft',
      deshabilitada: e.atras === null,
      ayuda: tr('A donde se estaba antes del último salto: desde el índice, un enlace o el número del capítulo'),
      ejecutar: h.atras,
    }
  );
  if (e.hayIndice) o.push({ id: 'indice', etiqueta: tr('Índice'), menu: 'ir', grupo: 'paneles', icono: 'indice', tipo: 'casilla', marcada: e.indice, ejecutar: h.indice });

  // ---------- Ayudas de lectura, las de Kotonoha entero ----------
  o.push(...ordenesAyudasLectura(e, h.ajuste));

  // ---------- Ayuda ----------
  o.push(...ordenesAyuda(h));
  return o;
}

/** Lo que sabe el visor de un texto de la Biblioteca (pegado, una historia, un artículo): por qué página va y cómo se ve. */
export interface EstadoLectura extends AyudasLectura {
  pagina: number;
  total: number;
  lleno: boolean;
  lectura: boolean;
}

export interface AccionesLectura {
  biblioteca(): void;
  vocabulario(): void;
  cuaderno(): void;
  lectura(): void;
  pantallaCompleta(): void;
  ir(n: number): void;
  irAPagina(): void;
  ajuste(c: AjusteLectura): void;
  atajos(): void;
  paleta(): void;
}

/**
 * Las órdenes del visor de un texto de la Biblioteca: las de un libro, con lo que tiene un texto, que se lee en páginas
 * largas y se puede seguir escribiendo en el Cuaderno. Un texto corto cabe en una página: entonces no hay menú Ir.
 */
export function ordenesDeLectura(e: EstadoLectura, h: AccionesLectura): Comando[] {
  const o: Comando[] = [];
  const ultima = Math.max(0, e.total - 1);
  o.push(
    { id: 'cuaderno', etiqueta: tr('Editar en el Cuaderno'), menu: 'libro', grupo: 'libro', icono: 'lapiz', ejecutar: h.cuaderno },
    { id: 'vocabulario', etiqueta: tr('Vocabulario del libro'), menu: 'libro', grupo: 'libro', icono: 'palabras', ejecutar: h.vocabulario },
    { id: 'biblioteca', etiqueta: tr('Volver a la Biblioteca'), menu: 'libro', grupo: 'salir', icono: 'flecha-izq', ejecutar: h.biblioteca },
    { id: 'modo-lectura', etiqueta: tr('Modo lectura'), menu: 'ver', grupo: 'pantalla', icono: 'modo-lectura', tipo: 'casilla', marcada: e.lectura, atajo: 'M', ayuda: tr('Solo la página, sin barras: se asoman al llevar el ratón arriba'), ejecutar: h.lectura },
    { id: 'pantalla-completa', etiqueta: tr('Pantalla completa'), menu: 'ver', grupo: 'pantalla', icono: 'pantalla-completa', tipo: 'casilla', marcada: e.lleno, atajo: 'F', ejecutar: h.pantallaCompleta }
  );
  if (e.total > 1)
    o.push(
      { id: 'anterior', etiqueta: tr('Página anterior'), menu: 'ir', grupo: 'paginas', icono: 'anterior', atajo: 'ArrowLeft', atajoAparte: true, deshabilitada: e.pagina <= 0, ejecutar: () => h.ir(e.pagina - 1) },
      { id: 'siguiente', etiqueta: tr('Página siguiente'), menu: 'ir', grupo: 'paginas', icono: 'siguiente', atajo: 'ArrowRight', atajoAparte: true, deshabilitada: e.pagina >= ultima, ejecutar: () => h.ir(e.pagina + 1) },
      { id: 'primera', etiqueta: tr('Primera página'), menu: 'ir', grupo: 'paginas', icono: 'primera', ejecutar: () => h.ir(0) },
      { id: 'ultima', etiqueta: tr('Última página'), menu: 'ir', grupo: 'paginas', icono: 'ultima', ejecutar: () => h.ir(ultima) },
      { id: 'ir-pagina', etiqueta: tr('Ir a la página'), menu: 'ir', grupo: 'saltar', atajo: 'G', palabras: tr('número'), ejecutar: h.irAPagina }
    );
  o.push(...ordenesAyudasLectura(e, h.ajuste));
  o.push(...ordenesAyuda(h));
  return o;
}
