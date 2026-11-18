// Las órdenes del visor de páginas, a partir de cómo está y de lo que sabe hacer. Es una función pura: el visor la llama
// en cada pintado con su estado, y las pruebas, con uno inventado. Así se comprueba sin abrir un libro que cada menú
// tiene lo suyo, que ninguna tecla está repetida y que lo que no tiene sentido (el zoom en la vista de texto) no se ofrece.

import type { LetraDiccionario, ModoColor, ModoLectura } from '../compartido/ajustes';
import { tr } from '../compartido/i18n';
import type { Nitidez } from '../compartido/tipos';
import type { Comando } from './comandos';
import type { ModoOcr } from './ocr';

export type Vista = 'una' | 'doble' | 'continua';
export type Zoom = 'ancho' | 'pagina' | number;
export type PanelVisor = 'miniaturas' | 'indice' | 'notas' | 'buscar' | 'revision' | 'consultadas';
/** Lo que hace el ratón en la página: seleccionar texto, mover la página, resaltar arrastrando o poner una nota. */
export type Herramienta = 'seleccionar' | 'mano' | 'area' | 'resaltador' | 'nota';
/** La tecla que, con el ratón sobre una palabra, abre su ficha sin hacer clic; o ninguna. */
export type TeclaFicha = 'Shift' | 'Control' | 'Alt' | 'ninguna';
/** Lo que se pinta sobre la página, para todos los libros. */
export interface AjustePagina {
  aumento?: boolean;
  furigana?: ModoLectura;
  gramatica?: boolean;
  traduccion?: boolean;
  tecla?: TeclaFicha;
}

/** Lo que cambia con la lengua: cómo se llama la lectura, si va sobre la página, si hay acento, si son cómics y sus letras. */
export interface LenguaVisor {
  lectura: string;
  lecturaEnPagina: boolean;
  acento: boolean;
  comic: boolean;
  letras: { id: LetraDiccionario; nombre: string }[];
}

/** Las ayudas de lectura de Kotonoha entero (lectura sobre las palabras, colores, letra): igual en los dos visores. */
export interface AyudasLectura {
  furigana: ModoLectura;
  mostrarEstado: boolean;
  colorAcento: ModoColor;
  letra: LetraDiccionario;
  lengua: LenguaVisor;
}

/** Un cambio en las ayudas de lectura, que se guarda en los ajustes. */
export type AjusteLectura = { furigana?: ModoLectura; mostrarEstado?: boolean; colorAcento?: ModoColor; diccionarioLetra?: LetraDiccionario };

export interface EstadoVisor extends AyudasLectura {
  vista: Vista;
  rtl: boolean;
  portadaSola: boolean;
  zoom: Zoom;
  vistaTexto: boolean;
  invertir: boolean;
  nitidez: Nitidez;
  lleno: boolean;
  /** El modo lectura: sin barras, solo la página. */
  lectura: boolean;
  ocr: boolean;
  modoOcr: ModoOcr;
  textoPdf: boolean;
  /** Si alguna página del PDF trae su propio texto: entonces se elige entre ese texto y el OCR. */
  hayTextoPropio: boolean;
  /** Si la página a la vista tiene texto: para revisarlo o copiarlo. */
  conTexto: boolean;
  hayIndice: boolean;
  panel: PanelVisor | null;
  marcada: boolean;
  herramienta: Herramienta;
  /** La página a la que vuelve «Atrás», si se ha saltado de una a otra. */
  atras: number | null;
  fijada: boolean;
  /** La página aumentada: si se pinta, con qué furigana y con o sin gramática. */
  aumento: boolean;
  furiganaPagina: ModoLectura;
  gramaticaPagina: boolean;
  /** La traducción de la frase abierta, como un subtítulo bajo ella. */
  traduccionBajo: boolean;
  teclaFicha: TeclaFicha;
  /** Si se está leyendo en voz alta. */
  voz: boolean;
}

export interface AccionesVisor {
  biblioteca(): void;
  vocabulario(): void;
  exportar(): void;
  portada(): void;
  vista(v: Vista): void;
  portadaSola(): void;
  sentido(rtl: boolean): void;
  zoom(z: Zoom | 'mas' | 'menos'): void;
  nitidez(n: Partial<Nitidez>): void;
  invertir(): void;
  vistaTexto(): void;
  lectura(): void;
  pantallaCompleta(): void;
  ir(a: 'primera' | 'anterior' | 'siguiente' | 'ultima'): void;
  irAPagina(): void;
  atras(): void;
  panel(p: PanelVisor): void;
  ocr(): void;
  modoOcr(m: ModoOcr): void;
  textoPdf(): void;
  revisar(): void;
  copiarPagina(): void;
  ajuste(c: AjusteLectura): void;
  fijar(): void;
  marcador(): void;
  herramienta(h: Herramienta): void;
  atajos(): void;
  paleta(): void;
  pagina(c: AjustePagina): void;
  vozAlta(): void;
}

export function ordenesDelVisor(e: EstadoVisor, h: AccionesVisor): Comando[] {
  const o: Comando[] = [];
  const sinImagen = e.vistaTexto ? tr('En la vista de texto no hay imagen de la página') : undefined;

  // ---------- Libro ----------
  o.push(
    { id: 'vocabulario', etiqueta: tr('Vocabulario del libro'), menu: 'libro', grupo: 'libro', icono: 'palabras', ejecutar: h.vocabulario },
    { id: 'exportar', etiqueta: tr('Exportar PDF con texto'), menu: 'libro', grupo: 'libro', icono: 'exportar', ejecutar: h.exportar },
    { id: 'portada', etiqueta: tr('Usar esta página como portada'), menu: 'libro', grupo: 'libro', icono: 'imagen', ejecutar: h.portada },
    { id: 'biblioteca', etiqueta: tr('Volver a la Biblioteca'), menu: 'libro', grupo: 'salir', icono: 'flecha-izq', ejecutar: h.biblioteca }
  );

  // ---------- Ver ----------
  const sentido = tr('Sentido de lectura');
  o.push(
    { id: 'vista-una', etiqueta: tr('Una página'), menu: 'ver', grupo: 'vista', icono: 'una-pagina', tipo: 'opcion', marcada: e.vista === 'una', ejecutar: () => h.vista('una') },
    { id: 'vista-doble', etiqueta: tr('Doble página'), menu: 'ver', grupo: 'vista', icono: 'doble-pagina', tipo: 'opcion', marcada: e.vista === 'doble', ejecutar: () => h.vista('doble') },
    { id: 'vista-continua', etiqueta: tr('Desplazamiento continuo'), menu: 'ver', grupo: 'vista', icono: 'continua', tipo: 'opcion', marcada: e.vista === 'continua', ejecutar: () => h.vista('continua') },
    {
      id: 'portada-sola',
      etiqueta: tr('Portada sola'),
      menu: 'ver',
      grupo: 'vista',
      tipo: 'casilla',
      marcada: e.portadaSola,
      deshabilitada: e.vista !== 'doble',
      ayuda: tr('En doble página, la primera va sola, como la tapa de un tomo'),
      ejecutar: h.portadaSola,
    },
    { id: 'sentido-ltr', etiqueta: tr('De izquierda a derecha'), menu: 'ver', grupo: 'vista', submenu: sentido, tipo: 'opcion', marcada: !e.rtl, ejecutar: () => h.sentido(false) },
    { id: 'sentido-rtl', etiqueta: tr('De derecha a izquierda'), menu: 'ver', grupo: 'vista', submenu: sentido, tipo: 'opcion', marcada: e.rtl, palabras: 'manga', ejecutar: () => h.sentido(true) }
  );
  if (!e.vistaTexto) {
    const nitidez = tr('Nitidez');
    const apagada = e.nitidez.activa ? undefined : tr('Primero, enfocar las páginas');
    o.push(
      { id: 'acercar', etiqueta: tr('Acercar'), menu: 'ver', grupo: 'zoom', icono: 'acercar', atajo: 'Ctrl++', palabras: 'zoom', ejecutar: () => h.zoom('mas') },
      { id: 'alejar', etiqueta: tr('Alejar'), menu: 'ver', grupo: 'zoom', icono: 'alejar', atajo: 'Ctrl+-', palabras: 'zoom', ejecutar: () => h.zoom('menos') },
      { id: 'zoom-pagina', etiqueta: tr('Página completa'), menu: 'ver', grupo: 'zoom', icono: 'ajustar-pagina', atajo: 'Ctrl+0', tipo: 'opcion', marcada: e.zoom === 'pagina', palabras: 'zoom', ejecutar: () => h.zoom('pagina') },
      { id: 'zoom-ancho', etiqueta: tr('Ajustar al ancho'), menu: 'ver', grupo: 'zoom', icono: 'ajustar-ancho', tipo: 'opcion', marcada: e.zoom === 'ancho', palabras: 'zoom', ejecutar: () => h.zoom('ancho') },
      {
        id: 'nitidez',
        etiqueta: tr('Enfocar las páginas'),
        menu: 'ver',
        grupo: 'imagen',
        submenu: nitidez,
        tipo: 'casilla',
        marcada: e.nitidez.activa,
        ayuda: tr('Nitidez: enfoca las páginas de un escaneo con poca resolución'),
        palabras: nitidez,
        ejecutar: () => h.nitidez({ activa: !e.nitidez.activa }),
      },
      ...([
        [1, tr('Suave')],
        [2, tr('Media')],
        [3, tr('Fuerte')],
      ] as const).map(([nivel, nombre]): Comando => ({
        id: `nitidez-${nivel}`,
        etiqueta: nombre,
        menu: 'ver',
        grupo: 'imagen',
        submenu: nitidez,
        tipo: 'opcion',
        marcada: e.nitidez.nivel === nivel,
        deshabilitada: !e.nitidez.activa,
        ayuda: apagada,
        palabras: nitidez,
        ejecutar: () => h.nitidez({ nivel }),
      })),
      {
        id: 'fondo-blanco',
        etiqueta: tr('Fondo blanco'),
        menu: 'ver',
        grupo: 'imagen',
        submenu: nitidez,
        tipo: 'casilla',
        marcada: e.nitidez.limpiar,
        deshabilitada: !e.nitidez.activa,
        ayuda: apagada ?? tr('El papel más blanco y el texto más negro, para escaneos en blanco y negro'),
        palabras: nitidez,
        ejecutar: () => h.nitidez({ limpiar: !e.nitidez.limpiar }),
      },
      { id: 'invertir', etiqueta: tr('Invertir colores'), menu: 'ver', grupo: 'imagen', icono: 'invertir', tipo: 'casilla', marcada: e.invertir, ejecutar: h.invertir }
    );
  }
  o.push(
    { id: 'vista-texto', etiqueta: tr('Ver como texto'), menu: 'ver', grupo: 'texto', icono: 'lector', tipo: 'casilla', marcada: e.vistaTexto, atajo: 'T', ayuda: tr('El texto de las páginas en párrafos, con la ayuda de lectura'), ejecutar: h.vistaTexto },
    { id: 'seleccionar', etiqueta: tr('Seleccionar'), menu: 'ver', grupo: 'herramienta', icono: 'cursor-texto', tipo: 'opcion', marcada: e.herramienta === 'seleccionar', atajo: 'V', deshabilitada: e.vistaTexto, ayuda: sinImagen ?? tr('Tocar una palabra abre su frase; arrastrando se selecciona'), ejecutar: () => h.herramienta('seleccionar') },
    { id: 'mano', etiqueta: tr('Mano'), menu: 'ver', grupo: 'herramienta', icono: 'mano', tipo: 'opcion', marcada: e.herramienta === 'mano', atajo: 'H', deshabilitada: e.vistaTexto, ayuda: sinImagen ?? tr('Arrastrando se mueve la página; tocar una palabra sigue abriendo su frase'), ejecutar: () => h.herramienta('mano') },
    { id: 'modo-lectura', etiqueta: tr('Modo lectura'), menu: 'ver', grupo: 'pantalla', icono: 'modo-lectura', tipo: 'casilla', marcada: e.lectura, atajo: 'M', ayuda: tr('Solo la página, sin barras: se asoman al llevar el ratón arriba'), ejecutar: h.lectura },
    { id: 'pantalla-completa', etiqueta: tr('Pantalla completa'), menu: 'ver', grupo: 'pantalla', icono: 'pantalla-completa', tipo: 'casilla', marcada: e.lleno, atajo: 'F', ejecutar: h.pantallaCompleta }
  );

  // ---------- Ir ----------
  o.push(
    { id: 'primera', etiqueta: tr('Primera página'), menu: 'ir', grupo: 'paginas', icono: 'primera', atajo: 'Home', atajoAparte: true, ejecutar: () => h.ir('primera') },
    { id: 'anterior', etiqueta: tr('Página anterior'), menu: 'ir', grupo: 'paginas', icono: 'anterior', atajo: e.rtl ? 'ArrowRight' : 'ArrowLeft', atajoAparte: true, ejecutar: () => h.ir('anterior') },
    { id: 'siguiente', etiqueta: tr('Página siguiente'), menu: 'ir', grupo: 'paginas', icono: 'siguiente', atajo: e.rtl ? 'ArrowLeft' : 'ArrowRight', atajoAparte: true, ejecutar: () => h.ir('siguiente') },
    { id: 'ultima', etiqueta: tr('Última página'), menu: 'ir', grupo: 'paginas', icono: 'ultima', atajo: 'End', atajoAparte: true, ejecutar: () => h.ir('ultima') },
    { id: 'ir-pagina', etiqueta: tr('Ir a la página'), menu: 'ir', grupo: 'saltar', atajo: 'G', palabras: tr('número'), ejecutar: h.irAPagina },
    {
      id: 'atras',
      etiqueta: e.atras === null ? tr('Atrás') : tr('Volver a la página {0}', e.atras + 1),
      menu: 'ir',
      grupo: 'saltar',
      icono: 'volver',
      atajo: 'Alt+ArrowLeft',
      deshabilitada: e.atras === null,
      ayuda: tr('A la página de antes del último salto: desde el índice, las miniaturas, una nota o lo encontrado'),
      ejecutar: h.atras,
    }
  );
  if (e.hayIndice) o.push({ id: 'indice', etiqueta: tr('Índice'), menu: 'ir', grupo: 'paneles', icono: 'indice', tipo: 'casilla', marcada: e.panel === 'indice', ejecutar: () => h.panel('indice') });
  o.push({ id: 'miniaturas', etiqueta: tr('Miniaturas'), menu: 'ir', grupo: 'paneles', icono: 'miniaturas', tipo: 'casilla', marcada: e.panel === 'miniaturas', ejecutar: () => h.panel('miniaturas') });

  // ---------- Texto ----------
  const sinOcr = e.ocr ? undefined : tr('Primero, leer el texto de las páginas');
  o.push(
    {
      id: 'ocr',
      etiqueta: tr('Leer el texto de las páginas'),
      menu: 'texto',
      grupo: 'origen',
      icono: 'texto',
      tipo: 'casilla',
      marcada: e.ocr,
      ayuda: tr('Reconoce el texto de las páginas que son una imagen, como un escaneo o un manga'),
      palabras: 'OCR',
      ejecutar: h.ocr,
    },
    { id: 'ocr-libro', etiqueta: tr('Libro'), menu: 'texto', grupo: 'origen', tipo: 'opcion', marcada: e.modoOcr === 'libro', deshabilitada: !e.ocr, ayuda: sinOcr ?? tr('Para libros impresos'), palabras: 'OCR', ejecutar: () => h.modoOcr('libro') },
    {
      id: 'ocr-manga',
      etiqueta: e.lengua.comic ? tr('Cómic') : tr('Manga'),
      menu: 'texto',
      grupo: 'origen',
      tipo: 'opcion',
      marcada: e.modoOcr === 'manga',
      deshabilitada: !e.ocr,
      ayuda: sinOcr ?? (e.lengua.comic ? tr('Para cómics: lee los globos de izquierda a derecha') : tr('Para manga: globos y texto vertical')),
      palabras: 'OCR',
      ejecutar: () => h.modoOcr('manga'),
    }
  );
  if (e.hayTextoPropio)
    o.push({ id: 'texto-pdf', etiqueta: tr('Texto del PDF'), menu: 'texto', grupo: 'origen', tipo: 'casilla', marcada: e.textoPdf, deshabilitada: !e.ocr, ayuda: sinOcr ?? tr('El texto que trae el PDF; apagado, Kotonoha lee todas las páginas'), palabras: 'OCR', ejecutar: h.textoPdf });
  // Leer una zona es una herramienta, como las de Ver y Anotar: con el texto, porque lo que hace es leerlo.
  o.push({
    id: 'area',
    etiqueta: tr('Leer una zona'),
    menu: 'texto',
    grupo: 'herramienta',
    icono: 'area',
    tipo: 'opcion',
    marcada: e.herramienta === 'area',
    atajo: 'O',
    deshabilitada: e.vistaTexto,
    ayuda: sinImagen ?? tr('Dibuja un rectángulo y el OCR lee lo que hay dentro, como un diagrama o un cartel'),
    palabras: 'OCR',
    ejecutar: () => h.herramienta('area'),
  });
  const sinTexto = e.conTexto ? undefined : tr('La página aún no tiene texto');
  o.push(
    { id: 'buscar', etiqueta: tr('Buscar en el libro'), menu: 'texto', grupo: 'usar', icono: 'buscar', tipo: 'casilla', marcada: e.panel === 'buscar', atajo: 'Ctrl+F', atajoAparte: true, ejecutar: () => h.panel('buscar') },
    { id: 'copiar-pagina', etiqueta: tr('Copiar el texto de la página'), menu: 'texto', grupo: 'usar', icono: 'copiar', deshabilitada: !e.conTexto, ayuda: sinTexto, ejecutar: h.copiarPagina },
    { id: 'revisar', etiqueta: tr('Revisar el texto con Claude'), menu: 'texto', grupo: 'usar', icono: 'ia', deshabilitada: !e.conTexto, ayuda: sinTexto ?? tr('Claude compara el texto leído con la imagen de la página y propone qué editar'), ejecutar: h.revisar },
    {
      id: 'voz-alta',
      etiqueta: tr('Leer en voz alta'),
      menu: 'texto',
      grupo: 'voz',
      icono: 'altavoz',
      tipo: 'casilla',
      marcada: e.voz,
      atajo: 'L',
      deshabilitada: !e.conTexto && !e.voz,
      ayuda: sinTexto ?? tr('Lee las frases una a una, marca en la página la que suena y sigue en la página siguiente'),
      ejecutar: h.vozAlta,
    }
  );

  // ---------- Ayudas de lectura: valen en todo Kotonoha, no solo en este libro ----------
  o.push(...ordenesAyudasLectura(e, h.ajuste));
  // Sobre la página: valen para todos los libros, y el subrayado sigue al «Estado de aprendizaje».
  const sinAumento = e.aumento ? undefined : tr('Primero, las ayudas sobre la página');
  const furiganaPagina = tr('{0} sobre la página', e.lengua.lectura);
  o.push(
    {
      id: 'aumento',
      etiqueta: tr('Ayudas sobre la página'),
      menu: 'ayudas',
      grupo: 'pagina',
      tipo: 'casilla',
      marcada: e.aumento,
      atajo: 'A',
      ayuda: tr('El subrayado por estado, la lectura y la gramática, pintados sobre la página'),
      ejecutar: () => h.pagina({ aumento: !e.aumento }),
    },
    ...(e.lengua.lecturaEnPagina ? ([
      ['todas', tr('Todas las palabras')],
      ['desconocidas', tr('Desconocidas')],
      ['alPasar', tr('Al pasar el ratón')],
      ['ninguna', tr('Ninguna')],
    ] as const) : []).map(([valor, nombre]): Comando => ({
      id: `pfurigana-${valor}`,
      etiqueta: nombre,
      menu: 'ayudas',
      grupo: 'pagina',
      submenu: furiganaPagina,
      tipo: 'opcion',
      marcada: e.furiganaPagina === valor,
      deshabilitada: !e.aumento,
      ayuda: sinAumento,
      palabras: furiganaPagina,
      ejecutar: () => h.pagina({ furigana: valor }),
    })),
    { id: 'gramatica-pagina', etiqueta: tr('Gramática sobre la página'), menu: 'ayudas', grupo: 'pagina', tipo: 'casilla', marcada: e.gramaticaPagina, deshabilitada: !e.aumento, ayuda: sinAumento ?? tr('Una línea de puntos bajo cada punto de gramática que se reconoce'), ejecutar: () => h.pagina({ gramatica: !e.gramaticaPagina }) },
    {
      id: 'traduccion-bajo',
      etiqueta: tr('Traducción bajo la frase'),
      menu: 'ayudas',
      grupo: 'pagina',
      tipo: 'casilla',
      marcada: e.traduccionBajo,
      ayuda: tr('La traducción de la frase abierta, como un subtítulo debajo de ella; la ya hecha se ve sin gastar'),
      ejecutar: () => h.pagina({ traduccion: !e.traduccionBajo }),
    }
  );
  const ficha = tr('Ficha al pasar el ratón');
  o.push(
    ...([
      ['Shift', tr('Con Mayús')],
      ['Control', tr('Con Ctrl')],
      ['Alt', tr('Con Alt')],
      ['ninguna', tr('Nunca')],
    ] as const).map(([valor, nombre]): Comando => ({
      id: `tecla-${valor}`,
      etiqueta: nombre,
      menu: 'ayudas',
      grupo: 'ventana',
      submenu: ficha,
      tipo: 'opcion',
      marcada: e.teclaFicha === valor,
      palabras: ficha,
      ejecutar: () => h.pagina({ tecla: valor }),
    })),
    { id: 'fijar', etiqueta: tr('Fijar a un lado'), menu: 'ayudas', grupo: 'ventana', icono: 'fijar', tipo: 'casilla', marcada: e.fijada, ayuda: tr('La ventana de lo que se toca, como un panel a la derecha en lugar de flotar junto al texto'), ejecutar: h.fijar }
  );

  // ---------- Anotar ----------
  o.push(
    { id: 'marcador', etiqueta: tr('Marcar esta página'), menu: 'anotar', grupo: 'pagina', icono: 'marcador', tipo: 'casilla', marcada: e.marcada, atajo: 'B', ejecutar: h.marcador },
    { id: 'resaltador', etiqueta: tr('Resaltador'), menu: 'anotar', grupo: 'herramienta', icono: 'resaltar', tipo: 'opcion', marcada: e.herramienta === 'resaltador', atajo: 'R', deshabilitada: e.vistaTexto, ayuda: sinImagen ?? tr('Lo que se arrastra queda resaltado, sin abrir la ventana'), ejecutar: () => h.herramienta('resaltador') },
    { id: 'nota', etiqueta: tr('Añadir una nota'), menu: 'anotar', grupo: 'herramienta', icono: 'nota-lapiz', tipo: 'opcion', marcada: e.herramienta === 'nota', atajo: 'N', deshabilitada: e.vistaTexto, ayuda: sinImagen ?? tr('Toca la página donde va la nota'), ejecutar: () => h.herramienta('nota') },
    { id: 'notas', etiqueta: tr('Notas y marcadores'), menu: 'anotar', grupo: 'panel', icono: 'nota', tipo: 'casilla', marcada: e.panel === 'notas', ejecutar: () => h.panel('notas') },
    { id: 'consultadas', etiqueta: tr('Consultadas'), menu: 'anotar', grupo: 'panel', icono: 'tarjetas', tipo: 'casilla', marcada: e.panel === 'consultadas', ayuda: tr('Las palabras consultadas en este libro, para pasarlas a tarjetas con su frase y un recorte de la página'), ejecutar: () => h.panel('consultadas') }
  );

  // ---------- Ayuda ----------
  o.push(...ordenesAyuda(h));
  return o;
}

/**
 * Las ayudas de lectura del menú Ayudas: la lectura sobre las palabras, el estado de aprendizaje, el color del acento y la
 * letra. Son de Kotonoha entero (valen igual en los subtítulos y el Cuaderno) y las dos clases de visor las ofrecen igual.
 */
export function ordenesAyudasLectura(e: AyudasLectura, ajuste: (c: AjusteLectura) => void): Comando[] {
  const o: Comando[] = [];
  const lectura = e.lengua.lectura;
  o.push(
    ...([
      ['todas', tr('Todas las palabras')],
      ['desconocidas', tr('Desconocidas')],
      ['alPasar', tr('Al pasar el ratón')],
      ['ninguna', tr('Ninguna')],
    ] as const).map(([valor, nombre]): Comando => ({
      id: `furigana-${valor}`,
      etiqueta: nombre,
      menu: 'ayudas',
      grupo: 'palabras',
      submenu: lectura,
      tipo: 'opcion',
      marcada: e.furigana === valor,
      palabras: lectura,
      ejecutar: () => ajuste({ furigana: valor }),
    })),
    { id: 'estado', etiqueta: tr('Estado de aprendizaje'), menu: 'ayudas', grupo: 'palabras', tipo: 'casilla', marcada: e.mostrarEstado, ayuda: tr('El color de cada palabra según la conozcas, la estés aprendiendo o sea nueva'), ejecutar: () => ajuste({ mostrarEstado: !e.mostrarEstado }) }
  );
  if (e.lengua.acento) {
    const acento = tr('Color de acento');
    o.push(
      ...([
        ['siempre', tr('Siempre')],
        ['alPasar', tr('Al pasar el ratón')],
        ['ninguno', tr('Ninguno')],
      ] as const).map(([valor, nombre]): Comando => ({
        id: `acento-${valor}`,
        etiqueta: nombre,
        menu: 'ayudas',
        grupo: 'palabras',
        submenu: acento,
        tipo: 'opcion',
        marcada: e.colorAcento === valor,
        palabras: acento,
        ejecutar: () => ajuste({ colorAcento: valor }),
      }))
    );
  }
  if (e.lengua.letras.length > 1) {
    const letra = tr('Letra');
    o.push(
      ...e.lengua.letras.map((l): Comando => ({
        id: `letra-${l.id}`,
        etiqueta: tr(l.nombre),
        menu: 'ayudas',
        grupo: 'palabras',
        submenu: letra,
        tipo: 'opcion',
        marcada: e.letra === l.id,
        palabras: letra,
        ejecutar: () => ajuste({ diccionarioLetra: l.id }),
      }))
    );
  }
  return o;
}

/** El menú Ayuda: los atajos de teclado y la paleta. */
export function ordenesAyuda(h: { atajos(): void; paleta(): void }): Comando[] {
  return [
    { id: 'atajos', etiqueta: tr('Atajos de teclado'), menu: 'ayuda', grupo: 'ayuda', icono: 'teclado', atajo: '?', ejecutar: h.atajos },
    { id: 'paleta', etiqueta: tr('Buscar una acción'), menu: 'ayuda', grupo: 'ayuda', icono: 'comando', atajo: 'Ctrl+K', atajoAparte: true, ejecutar: h.paleta },
  ];
}
