// El visor de un libro de páginas (EPUB de imágenes, CBZ o PDF), como un lector de PDF: zoom, páginas, doble página como
// un libro abierto, desplazamiento continuo, sentido de lectura, miniaturas e índice. Recuerda por dónde se va en cada
// libro. El texto de cada página sale del propio PDF si lo trae, o del OCR si se pide; tocar una palabra abre su ficha.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Creador } from '../app/Creador';
import { guardarPreferencia, leerPreferencia } from '../app/estadoApp';
import { Anillo } from '../app/Piezas';
import { type Ajustes, guardarAjustes, type ModoLectura } from '../compartido/ajustes';
import { tr } from '../compartido/i18n';
import { alRecibirEvento, fondo, motor } from '../compartido/rpc';
import type { AnotacionLibro, ColorAnotacion, ElementoBiblioteca, Nitidez, PalabraToken } from '../compartido/tipos';
import { resaltadoDeTramo, resaltadosEn } from '../nucleo/anotaciones';
import { comprensionDe, type FraseEnPagina, frasesEnPagina, type GramaticaEnPagina, gramaticaEnPagina, palabraEn, type PalabraEnPagina, palabrasEnPagina } from '../nucleo/aumento';
import type { Hallazgo } from '../nucleo/busqueda';
import { cajaDeTramo, type LineaTexto, leerConOcr, textoDePagina } from '../nucleo/capaTexto';
import { aplicarEdiciones, type EdicionLinea, type LineaEditada } from '../nucleo/ediciones';
import { edicionesDe, guardarEdicion, lecturaMinima, quitarEdicion } from '../compartido/paginasOcr';
import type { Direccion } from '../nucleo/libro';
import type { Caja, LineaOcr } from '../nucleo/ocr';
import { escalaDe, type Medida, pasoDeZoom, pliegoDe, pliegos } from '../nucleo/paginas';
import { cambiosValidos } from '../nucleo/revision';
import { cajasDe, contextoDe, envolvente, fraseEn, leerPagina, type PaginaLeida, parrafoEn, type Posicion, posicionEn, seleccionEn, type TramoPagina, tramoEntre, type Unidad } from '../nucleo/seleccion';
import { comoGlobo, conZonas, lineasDeZona, type ZonaLeida } from '../nucleo/zonas';
import { motorDe } from '../lenguas/motor';
import { Icono, type NombreIcono } from '../ui/iconos';
import { lengua } from '../ui/lengua';
import { letrasDe } from '../ui/letra';
import { COLORES, NotasDePagina, PanelNotas, Resaltados, resaltarEn } from './Anotaciones';
import { CapaAumento, FraseLeida, SubtituloFrase } from './Aumento';
import { type Comando, entradasDe, type IdMenu, mostrarAtajo, ordenDeTecla, teclaDe } from './comandos';
import { Abriendo, AvisoError, Boton, Cabeza, usePantallaCompleta } from './comun';
import { apuntarConsultada, type Consultada, leerConsultadas, PanelConsultadas } from './Consultadas';
import { imagenParaClaude } from './imagenClaude';
import { Atajos, BarraMenus, ListaMenu, MenuFlotante, Paleta, useClicFuera } from './Menus';
import { type Descarga, esCancelada, LectorOcr, type ModoOcr } from './ocr';
import { type AccionesVisor, type AjustePagina, type EstadoVisor, type Herramienta, ordenesDelVisor, type PanelVisor, type TeclaFicha, type Vista, type Zoom } from './ordenesVisor';
import { imagenParaOcr, miniaturaDe, type PaginaImagen, type Paginador, paginadorDeZip, zonaParaOcr } from './paginador';
import { PanelBuscar } from './PanelBuscar';
import { PanelRevision, type PropuestaLinea } from './PanelRevision';
import { paginadorDePdf } from './pdf';
import { PanelAa } from './Preferencias';
import { leerTextoLibro, type TextoDePagina } from './textoLibro';
import { type TipoUnidad, type UnidadAbierta, Ventana } from './Ventana';
import { VistaTexto } from './VistaTexto';
import { useVozAlta } from './vozAlta';

/** El tamaño que se supone a una página que aún no se ha leído: el de un tomo de manga. */
const PAGINA_SUPUESTA: Medida = { ancho: 844, alto: 1200 };
/** El margen del lienzo alrededor de las páginas. */
const MARGEN = 16;
/** Cuántas páginas antes y después de las visibles se pintan en el desplazamiento continuo. */
const ALREDEDOR = 2;
/**
 * Cuántas páginas lee el OCR por delante de las que se ven. Una página de manga se lee en segundo y medio y se mira en
 * bastante más, así que ocho bastan para no esperar nunca al pasar de página; un libro se lee más despacio.
 */
const ADELANTE: Record<ModoOcr, number> = { manga: 8, libro: 4 };

/** Si dos listas de cajas son las mismas, salvo redondeos. */
const mismasCajas = (a: Caja[] = [], b: Caja[] = []) =>
  a.length === b.length && a.every((c, i) => Math.abs(c.x0 - b[i].x0) + Math.abs(c.y0 - b[i].y0) + Math.abs(c.x1 - b[i].x1) + Math.abs(c.y1 - b[i].y1) < 1e-4);

const porciento = (c: Caja) => ({ left: `${c.x0 * 100}%`, top: `${c.y0 * 100}%`, width: `${(c.x1 - c.x0) * 100}%`, height: `${(c.y1 - c.y0) * 100}%` });

/** Lo anotado en una página y lo que se puede hacer con sus notas. */
interface PropsAnotaciones {
  anotaciones?: AnotacionLibro[];
  notaAbierta?: string | null;
  alAbrirNota?: (id: string | null) => void;
  alGuardarAnotacion?: (a: AnotacionLibro) => void;
  alQuitarAnotacion?: (id: string) => void;
}

/** El ancho de los paneles de la izquierda (miniaturas, índice, notas, buscar): se ensanchan arrastrando su borde. */
const ANCHO_PANEL = { inicial: 280, minimo: 200, maximo: 560 };
/** Los tamaños que ofrece el zoom de la barra, además de ajustar a la página o al ancho. */
const TAMANOS_ZOOM = [50, 75, 100, 125, 150, 200, 300];
/** Cuántas páginas de antes de un salto recuerda «Atrás». */
const SALTOS = 50;

// ---------- Nitidez ----------

/** Lo que la máscara de enfoque suma de la diferencia entre la página y su versión desenfocada. */
const CANTIDAD: Record<Nitidez['nivel'], number> = { 1: 0.6, 2: 1.2, 3: 2 };
/** El fondo blanco: de este gris para abajo, negro; de este para arriba, blanco. El papel de un escaneo suele ser gris. */
const NEGRO = 0.18;
const BLANCO = 0.82;

/**
 * El filtro de la nitidez, en SVG para que lo pinte la tarjeta gráfica sin rehacer la imagen: una máscara de enfoque (a la
 * página se le suma su diferencia con una versión desenfocada, que realza los bordes de las letras) y, si se pide, un
 * estiramiento de niveles que deja el papel blanco y el texto negro. Va sobre la imagen ya escalada a lo que se ve, así
 * que el radio está en píxeles de pantalla y crece con la escala: lo justo para el borde de una letra.
 */
function FiltroNitidez({ n, escala }: { n: Nitidez; escala: number }) {
  const k = CANTIDAD[n.nivel];
  // Ampliada, cada borde de letra se reparte en más píxeles de pantalla: el radio crece con la escala a que se ve.
  const radio = Math.min(2.5, Math.max(0.6, 0.7 * escala));
  const pendiente = 1 / (BLANCO - NEGRO);
  const corte = -NEGRO * pendiente;
  return (
    <svg class="vs-filtros" aria-hidden="true" width="0" height="0">
      <filter id="vs-nitidez" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%">
        <feGaussianBlur in="SourceGraphic" stdDeviation={radio.toFixed(2)} result="borrosa" />
        <feComposite in="SourceGraphic" in2="borrosa" operator="arithmetic" k1="0" k2={1 + k} k3={-k} k4="0" result="nitida" />
        {n.limpiar && (
          <feComponentTransfer in="nitida">
            <feFuncR type="linear" slope={pendiente} intercept={corte} />
            <feFuncG type="linear" slope={pendiente} intercept={corte} />
            <feFuncB type="linear" slope={pendiente} intercept={corte} />
          </feComponentTransfer>
        )}
      </filter>
    </svg>
  );
}

/**
 * Una página pintada a su escala. Mientras llega la imagen, ocupa ya su sitio para que nada salte. Con su texto, encima
 * van sus líneas: zonas que se pueden tocar, con el texto para los lectores de pantalla, y la palabra elegida marcada.
 * Lo anotado va en dos capas: los resaltados debajo de las líneas y las notas encima.
 */
function Pagina({ paginador, n, escala, alCargar, lineas, porPalabra, herramienta = 'seleccionar', unidad, seleccion, marcas, hallado, alTocar, alSeleccionar, alPasar, capas, alArea, zonaLeyendo, anotaciones, notaAbierta, alAbrirNota, alGuardarAnotacion, alQuitarAnotacion }: {
  paginador: Paginador;
  n: number;
  escala: number;
  alCargar?: () => void;
  lineas?: LineaTexto[];
  /** Con la mano, arrastrar mueve la página (lo hace el lienzo) en lugar de seleccionar; tocar sigue abriendo la frase. */
  herramienta?: Herramienta;
  /** Si se sabe dónde va cada letra de la línea: entonces se toca y se selecciona letra a letra. En un globo de manga, no. */
  porPalabra?: boolean;
  /** Lo abierto en la ventana, lo que se está seleccionando y la palabra elegida, si son de esta página. */
  unidad?: Caja[];
  seleccion?: Caja[];
  marcas?: Caja[];
  /** Lo encontrado al buscar en el libro, si está en esta página: se marca y se lleva a la vista. */
  hallado?: Caja[];
  /** Un toque cerca del texto, con cuántos van seguidos: uno, la palabra; dos, la frase; tres, el párrafo. */
  alTocar?: (pos: Posicion, veces: number) => void;
  /** Lo seleccionado arrastrando, mientras se arrastra y al soltar. */
  alSeleccionar?: (tramo: TramoPagina, terminada: boolean) => void;
  /** El ratón pasa por el texto, sin pulsar: la letra que tiene debajo (o nada al salir), con las teclas pulsadas. */
  alPasar?: (pos: Posicion | null, e: MouseEvent | null) => void;
  /** Lo que se pinta encima de la página (la página aumentada), con el tamaño de la página en la pantalla. */
  capas?: (ancho: number, alto: number) => preact.ComponentChildren;
  /** Con la herramienta Área, la zona dibujada, en fracciones de la página, para leerla con el OCR. */
  alArea?: (caja: Caja) => void;
  /** La zona de esta página que se está leyendo: se ve mientras tanto. */
  zonaLeyendo?: Caja;
} & PropsAnotaciones) {
  // La página que ya está lista se monta con su imagen: sin un fotograma vacío antes.
  const [imagen, fijarImagen] = useState<PaginaImagen | null>(() => paginador.imagenYa?.(n) ?? null);
  const [fallo, fijarFallo] = useState('');
  const primerHallado = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    primerHallado.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [hallado, !!imagen]);
  useEffect(() => {
    let vivo = true;
    const ya = paginador.imagenYa?.(n);
    fijarImagen(ya ?? null);
    (paginador.imagenParaVer?.(n) ?? paginador.imagen(n))
      .then((p) => {
        if (!vivo) return;
        fijarImagen(p);
        alCargar?.();
      })
      .catch((e) => vivo && fijarFallo(e instanceof Error ? e.message : String(e)));
    return () => {
      vivo = false;
    };
  }, [paginador, n]);
  const t = imagen ?? paginador.tamano(n) ?? PAGINA_SUPUESTA;

  // Tocar y seleccionar. Un imán perdona los huecos entre renglones (nucleo/seleccion.ts); lejos del texto, el toque no
  // es para él y sigue hasta el lienzo, que cierra lo abierto. Nunca pasa de página: para eso están las flechas.
  const capa = useRef<HTMLDivElement>(null);
  const gesto = useRef<{ x: number; y: number; desde: Posicion | null; arrastrando: boolean; id: number; raton: boolean } | null>(null);
  const toques = useRef({ t: 0, x: 0, y: 0, veces: 0 });
  const atendido = useRef(false);
  const enPunto = (e: PointerEvent, siempre = false) => {
    const r = capa.current?.getBoundingClientRect();
    if (!r?.width || !lineas) return null;
    return posicionEn(lineas, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, { proporcion: t.alto / t.ancho, siempre });
  };
  const bajar = (e: PointerEvent) => {
    atendido.current = false;
    if (e.button !== 0 || !lineas?.length) return;
    const desde = enPunto(e);
    gesto.current = { x: e.clientX, y: e.clientY, desde, arrastrando: false, id: e.pointerId, raton: e.pointerType === 'mouse' };
    // Con el ratón, sin el foco del botón de la línea ni la selección del navegador.
    if (desde && e.pointerType === 'mouse') e.preventDefault();
  };
  const mover = (e: PointerEvent) => {
    const g = gesto.current;
    if (!g) {
      if (e.pointerType === 'mouse') alPasar?.(enPunto(e), e);
      return;
    }
    if (g.id !== e.pointerId || !g.desde || !g.raton || !porPalabra || !lineas || herramienta === 'mano') return;
    if (!g.arrastrando) {
      if (Math.hypot(e.clientX - g.x, e.clientY - g.y) < 5) return;
      g.arrastrando = true;
      capa.current?.setPointerCapture(e.pointerId);
    }
    const hasta = enPunto(e, true);
    if (hasta) alSeleccionar?.(tramoEntre(lineas, g.desde, hasta), false);
  };
  const subir = (e: PointerEvent) => {
    const g = gesto.current;
    gesto.current = null;
    if (!g || g.id !== e.pointerId || !lineas) return;
    if (g.arrastrando && g.desde) {
      const hasta = enPunto(e, true);
      if (hasta) alSeleccionar?.(tramoEntre(lineas, g.desde, hasta), true);
      atendido.current = true;
      return;
    }
    // Deslizar el dedo pasa de página, y con la mano se arrastra la página: eso no es un toque.
    if (!g.desde || Math.hypot(e.clientX - g.x, e.clientY - g.y) > (herramienta === 'mano' ? 4 : 10)) return;
    // Los toques seguidos en el mismo sitio cuentan como el doble y el triple clic.
    const ahora = performance.now();
    const previo = toques.current;
    const seguido = ahora - previo.t < 450 && Math.hypot(e.clientX - previo.x, e.clientY - previo.y) < 8;
    const veces = seguido ? Math.min(3, previo.veces + 1) : 1;
    toques.current = { t: ahora, x: e.clientX, y: e.clientY, veces };
    atendido.current = true;
    alTocar?.(g.desde, veces);
  };

  // Área: arrastrando se dibuja un rectángulo, y al soltar se lee lo que tiene dentro. La capa va encima de todo lo de la
  // página, y lo que pasa en ella es suyo: ni se pasa de página deslizando ni se abre la frase de debajo.
  const area = useRef<HTMLDivElement>(null);
  const trazo = useRef<{ id: number; x: number; y: number } | null>(null);
  const [dibujo, fijarDibujo] = useState<Caja | null>(null);
  const enFraccion = (e: PointerEvent) => {
    const r = area.current?.getBoundingClientRect();
    if (!r?.width || !r.height) return null;
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  const rectangulo = (a: { x: number; y: number }, b: { x: number; y: number }): Caja => ({ x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) });
  const empezarZona = (e: PointerEvent) => {
    const p = e.button === 0 ? enFraccion(e) : null;
    if (!p) return;
    e.preventDefault();
    e.stopPropagation();
    trazo.current = { id: e.pointerId, ...p };
    area.current?.setPointerCapture(e.pointerId);
    fijarDibujo(rectangulo(p, p));
  };
  const moverZona = (e: PointerEvent) => {
    const t = trazo.current;
    const p = t?.id === e.pointerId ? enFraccion(e) : null;
    if (t && p) fijarDibujo(rectangulo(t, p));
  };
  const soltarZona = (e: PointerEvent) => {
    const t = trazo.current;
    if (t?.id !== e.pointerId) return;
    trazo.current = null;
    e.stopPropagation();
    fijarDibujo(null);
    const p = enFraccion(e);
    const r = area.current?.getBoundingClientRect();
    if (!t || !p || !r) return;
    const c = rectangulo(t, p);
    // Un toque o una raya no son una zona: la herramienta sigue esperando un rectángulo.
    if ((c.x1 - c.x0) * r.width >= 8 && (c.y1 - c.y0) * r.height >= 8) alArea?.(c);
  };

  return (
    <div class="vs-pagina" data-pagina={n + 1} style={{ width: `${Math.round(t.ancho * escala)}px`, height: `${Math.round(t.alto * escala)}px` }}>
      {imagen ? <img src={imagen.url} alt={tr('Página {0}', n + 1)} draggable={false} decoding="sync" /> : fallo ? <span class="vs-fallo">{fallo}</span> : <span class="vs-cargando" />}
      {imagen && anotaciones && anotaciones.length > 0 && <Resaltados anotaciones={anotaciones} />}
      {imagen && lineas && (
        <div
          ref={capa}
          class={`vs-texto ${porPalabra ? 'por-letra' : ''}`}
          onPointerDown={bajar}
          onPointerMove={mover}
          onPointerUp={subir}
          onPointerCancel={() => (gesto.current = null)}
          onPointerLeave={() => alPasar?.(null, null)}
          onClick={(e) => {
            // Lo tocado ya se atendió al soltar: que no llegue al lienzo, que lo tomaría por un toque fuera del texto.
            if (atendido.current) e.stopPropagation();
            atendido.current = false;
          }}
        >
          {lineas.map((l, i) => (
            <button
              key={i}
              class="vs-linea"
              style={porciento(l.caja)}
              aria-label={l.texto}
              data-cortes={l.cortes ? '' : undefined}
              onClick={(e) => {
                // Con el teclado se abre la frase con que empieza la línea; el ratón y el dedo van por la capa.
                if (e.detail !== 0) return;
                e.stopPropagation();
                alTocar?.({ linea: i, letra: 0 }, 2);
              }}
            />
          ))}
          {unidad?.map((c, i) => <span key={`u${i}`} class="vs-unidad" style={porciento(c)} />)}
          {seleccion?.map((c, i) => <span key={`s${i}`} class="vs-seleccion" style={porciento(c)} />)}
          {marcas?.map((c, i) => <span key={`m${i}`} class="vs-marca" style={porciento(c)} />)}
        </div>
      )}
      {imagen && capas?.(Math.round(t.ancho * escala), Math.round(t.alto * escala))}
      {imagen && hallado && hallado.length > 0 && (
        <div class="vs-hallados" aria-hidden="true">
          {hallado.map((c, i) => (
            <span key={i} ref={i === 0 ? primerHallado : undefined} class="vs-hallado" style={porciento(c)} />
          ))}
        </div>
      )}
      {imagen && anotaciones && anotaciones.length > 0 && (
        <NotasDePagina anotaciones={anotaciones} abierta={notaAbierta ?? null} alAbrir={(id) => alAbrirNota?.(id)} alGuardar={(a) => alGuardarAnotacion?.(a)} alQuitar={(id) => alQuitarAnotacion?.(id)} />
      )}
      {imagen && zonaLeyendo && <span class="vs-area-marco leyendo" style={porciento(zonaLeyendo)} aria-hidden="true" />}
      {imagen && herramienta === 'area' && (
        <div
          ref={area}
          class="vs-area"
          onPointerDown={empezarZona}
          onPointerMove={moverZona}
          onPointerUp={soltarZona}
          onPointerCancel={() => {
            trazo.current = null;
            fijarDibujo(null);
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {dibujo && <span class="vs-area-marco" style={porciento(dibujo)} />}
        </div>
      )}
    </div>
  );
}

function Miniatura({ paginador, n, actual, marcada, alElegir }: { paginador: Paginador; n: number; actual: boolean; marcada?: boolean; alElegir: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [url, fijarUrl] = useState('');
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Solo se piden las que se acercan a la vista: un libro tiene cientos.
    const o = new IntersectionObserver(
      (entradas) => {
        if (!entradas.some((x) => x.isIntersecting)) return;
        o.disconnect();
        paginador.imagen(n).then((p) => fijarUrl(p.url)).catch(() => {});
      },
      { rootMargin: '300px' }
    );
    o.observe(el);
    return () => o.disconnect();
  }, [paginador, n]);
  useEffect(() => {
    if (actual) ref.current?.scrollIntoView({ block: 'nearest' });
  }, [actual]);
  const t = paginador.tamano(n) ?? PAGINA_SUPUESTA;
  return (
    <button ref={ref} class={`vs-miniatura ${actual ? 'actual' : ''}`} aria-label={tr('Página {0}', n + 1)} aria-current={actual ? 'page' : undefined} onClick={alElegir}>
      <span class="vs-miniatura-hoja" style={{ aspectRatio: `${t.ancho} / ${t.alto}` }}>
        {url && <img src={url} alt="" draggable={false} />}
        {marcada && <span class="vs-cinta" title={tr('Página marcada')} />}
      </span>
      <span class="num">{n + 1}</span>
    </button>
  );
}

export function VisorPaginas({ doc: inicial, archivo, ajustes: a }: { doc: ElementoBiblioteca; archivo: File; ajustes: Ajustes }) {
  const [doc, fijarDoc] = useState(inicial);
  const [paginador, fijarPaginador] = useState<Paginador | null>(null);
  const [error, fijarError] = useState('');
  const [pagina, fijarPagina] = useState(0);
  const [vista, fijarVista] = useState<Vista>('una');
  const [direccion, fijarDireccion] = useState<Direccion>('ltr');
  const [portadaSola, fijarPortadaSola] = useState(true);
  // Las páginas apaisadas, que en doble página van solas: null mientras no se sepan.
  const [anchas, fijarAnchas] = useState<number[] | null>(null);
  const [zoom, fijarZoom] = useState<Zoom>('pagina');
  const [panel, fijarPanel] = useState<PanelVisor | null>(null);
  const [anchoPanel, fijarAnchoPanel] = useState(() => leerPreferencia('visorPanelAncho', ANCHO_PANEL.inicial));
  // Los menús de la barra, el contextual, el del zoom, «Aa», la paleta y los atajos: solo uno a la vez.
  const [menu, fijarMenu] = useState<{ menu: IdMenu; teclado: boolean } | null>(null);
  const [contextual, fijarContextual] = useState<{ x: number; y: number; pagina: number | null; punto: { x: number; y: number } | null } | null>(null);
  const [desplegable, fijarDesplegable] = useState<'zoom' | 'aa' | null>(null);
  const [dialogo, fijarDialogo] = useState<'paleta' | 'atajos' | null>(null);
  // Lo que hace el ratón en la página, y el color con que resalta el resaltador: el último elegido.
  const [herramienta, fijarHerramienta] = useState<Herramienta>('seleccionar');
  const [colorResaltador, fijarColorResaltador] = useState<ColorAnotacion>(() => leerPreferencia('visorColorResaltador', 'amarillo'));
  // El modo lectura: solo la página. La barra se asoma al llevar el ratón arriba.
  const [lectura, fijarLectura] = useState(false);
  const [asomada, fijarAsomada] = useState(false);
  // Las páginas de antes de cada salto (índice, miniaturas, notas, lo encontrado, ir a una página): «Atrás» vuelve.
  const [saltos, fijarSaltos] = useState<number[]>([]);
  // La vista de texto: el texto de las páginas en párrafos, con la ayuda de lectura, en lugar de su imagen.
  const [vistaTexto, fijarVistaTexto] = useState(false);
  const [invertir, fijarInvertir] = useState(() => leerPreferencia('visorInvertir', false));
  const [nitidez, fijarNitidez] = useState<Nitidez>(() => inicial.documento?.nitidez ?? { activa: false, nivel: 2, limpiar: false });
  const { lleno, alternar: pantallaCompleta } = usePantallaCompleta();
  const [hueco, fijarHueco] = useState<Medida>({ ancho: 800, alto: 600 });
  const [escrito, fijarEscrito] = useState<string | null>(null);
  const [, refrescar] = useState(0);
  // El texto que trae el propio PDF, por página: null si la página es una imagen.
  const [propias, fijarPropias] = useState<Map<number, LineaTexto[] | null>>(() => new Map());
  // El texto de las páginas con el OCR: activo o no, con qué modelos, lo leído por página y por dónde va.
  const [ocr, fijarOcr] = useState(false);
  const [modoOcr, fijarModoOcr] = useState<ModoOcr>('libro');
  // En un PDF con su propio texto, si se usa ese texto (lo normal) o el OCR lee también esas páginas.
  const [textoPdf, fijarTextoPdf] = useState(true);
  const [lineas, fijarLineas] = useState<Map<number, LineaTexto[]>>(() => new Map());
  // Lo editado a mano en el libro: va encima de lo leído, en la línea que ocupe el mismo sitio.
  const [ediciones, fijarEdiciones] = useState<EdicionLinea[]>([]);
  const [descarga, fijarDescarga] = useState<Descarga | null>(null);
  const [errorOcr, fijarErrorOcr] = useState('');
  // Lo abierto en la ventana flotante, lo que se está seleccionando y la palabra elegida en la ventana, marcada en la página.
  const [unidad, fijarUnidad] = useState<UnidadAbierta | null>(null);
  const [seleccion, fijarSeleccion] = useState<{ pagina: number; cajas: Caja[] } | null>(null);
  const [marcaPalabra, fijarMarcaPalabra] = useState<Caja[] | null>(null);
  const [fijada, fijarFijada] = useState(() => leerPreferencia('visorVentanaFijada', false));
  // Lo anotado en el libro: marcadores, resaltados y notas. Con la herramienta de nota, el siguiente toque en una página
  // la pone ahí.
  const [anotaciones, fijarAnotaciones] = useState<AnotacionLibro[]>([]);
  const colocando = herramienta === 'nota';
  const [notaAbierta, fijarNotaAbierta] = useState<string | null>(null);
  // Buscar en el libro: lo que se busca, el texto de todo el libro según se prepara y lo encontrado que se está viendo.
  const [consulta, fijarConsulta] = useState('');
  const [corpus, fijarCorpus] = useState<{ paginas: Map<number, TextoDePagina>; hechas: number } | null>(null);
  const [hallado, fijarHallado] = useState<{ pagina: number; cajas: Caja[] } | null>(null);
  // Las páginas cuyo texto se pidió revisar con Claude mientras está abierto su panel, la última primero.
  const [revisadas, fijarRevisadas] = useState<number[]>([]);
  const lector = useRef<LectorOcr | null>(null);
  const lienzo = useRef<HTMLElement>(null);
  /** Si el último cambio de página vino del desplazamiento: entonces no hay que desplazar otra vez. */
  const desdeDesplazamiento = useRef(false);

  // Abre el libro con el paginador de su formato y como se dejó la última vez.
  useEffect(() => {
    let vivo = true;
    let abierto: Paginador | null = null;
    (async () => {
      const d = inicial.documento!;
      const p = d.formato === 'pdf' ? await paginadorDePdf(archivo) : await paginadorDeZip(archivo, `${inicial.titulo}.${d.formato}`, d.direccion);
      abierto = p;
      if (!vivo) return;
      fijarPaginador(p);
      fijarPagina(Math.min(inicial.pagina ?? 0, Math.max(0, p.total - 1)));
      fijarDireccion(d.direccion ?? p.direccion);
      // Un manga se lee a doble página, como el tomo impreso; un libro de texto, de una en una.
      fijarVista(d.vista ?? ((d.direccion ?? p.direccion) === 'rtl' ? 'doble' : 'una'));
      fijarPortadaSola(d.portadaSola ?? true);
      // Un libro importado antes de saberse sus páginas apaisadas las mide ahora, una vez, por la cabecera de cada imagen.
      fijarAnchas(d.anchas ?? null);
      if (!d.anchas && p.anchas) p.anchas().then((l) => vivo && fijarAnchas(l)).catch(() => {});
      fijarZoom(d.zoom ?? 'pagina');
      fijarVistaTexto(d.vistaTexto ?? false);
      // Un manga se lee con los modelos de manga; lo demás, con los de libro impreso.
      fijarOcr(d.ocr?.activo ?? false);
      fijarModoOcr(d.ocr?.modo ?? ((d.direccion ?? p.direccion) === 'rtl' ? 'manga' : 'libro'));
      fijarTextoPdf(d.ocr?.textoPdf ?? true);
      edicionesDe(inicial.id).then((l) => vivo && fijarEdiciones(l), () => {});
      motor.anotacionesDe(inicial.id).then((l) => vivo && fijarAnotaciones(l), console.error);
      // Un libro sin portada (un PDF importado antes de que se hicieran al importarlo) la saca de su primera página.
      if (!d.portada) {
        p.imagen(0)
          .then(async (primera) => {
            const portada = await miniaturaDe(await (await fetch(primera.url)).blob());
            if (!vivo) return;
            fijarDoc((x) => (x.documento ? { ...x, documento: { ...x.documento, portada } } : x));
            await motor.bibliotecaCambiar(inicial.id, { documento: { portada } });
          })
          .catch(() => {});
      }
    })().catch((err) => vivo && fijarError(err instanceof Error ? err.message : String(err)));
    return () => {
      vivo = false;
      abierto?.cerrar();
      lector.current?.cerrar();
      lector.current = null;
    };
  }, [inicial.id]);

  // El hueco para las páginas cambia con la ventana, con el panel lateral y al pasar a pantalla completa.
  useEffect(() => {
    const el = lienzo.current;
    if (!el) return;
    const medir = () => fijarHueco({ ancho: Math.max(100, el.clientWidth - 2 * MARGEN), alto: Math.max(100, el.clientHeight - 2 * MARGEN) });
    medir();
    const o = new ResizeObserver(medir);
    o.observe(el);
    return () => o.disconnect();
  }, [paginador, panel]);

  const total = paginador?.total ?? 0;
  const rtl = direccion === 'rtl';
  const lista = useMemo(() => pliegos(total, vista === 'doble', portadaSola, new Set(anchas ?? [])), [total, vista, portadaSola, anchas]);
  const actual = pliegoDe(lista, pagina);
  // El pliego que se ve: el pedido en cuanto sus páginas están pintadas y decodificadas; mientras, el de antes, en vez de
  // un fondo vacío que enseguida se llena. Al abrir el libro, o si lo de antes tampoco estaba listo, el pedido.
  const [mostrada, fijarMostrada] = useState(0);
  const listo = (p: number) => !!paginador && (lista[pliegoDe(lista, p)] ?? [p]).every((n) => !!paginador.imagenYa?.(n));
  const pedidoListo = vista === 'continua' || listo(pagina);
  const enPantalla = pedidoListo || !listo(mostrada) ? pagina : mostrada;
  const actualVisible = pliegoDe(lista, enPantalla);
  useEffect(() => {
    if (!paginador || pedidoListo) {
      fijarMostrada(pagina);
      return;
    }
    let vivo = true;
    Promise.all((lista[actual] ?? [pagina]).map((n) => (paginador.imagenParaVer?.(n) ?? paginador.imagen(n)).catch(() => null))).then(() => vivo && fijarMostrada(pagina));
    return () => {
      vivo = false;
    };
  }, [pagina, pedidoListo, paginador, lista]);
  const medida = (n: number) => paginador?.tamano(n) ?? PAGINA_SUPUESTA;
  const escala = paginador ? escalaDe((lista[actualVisible] ?? [enPantalla]).map(medida), hueco, zoom) : 1;
  const porcentaje = Math.round(escala * 100);

  // La página al instante: con la flecha pulsada llegan varias teclas antes de que se vuelva a pintar, y cada una tiene que
  // contar desde la anterior, no desde lo último pintado.
  const ahora = useRef(0);
  ahora.current = pagina;
  /** Lleva a una página. Si es un salto (no la de al lado), «Atrás» recuerda de dónde se vino. */
  const irA = (n: number, salto = false) => {
    if (!total) return;
    const m = Math.max(0, Math.min(total - 1, n));
    const desde = ahora.current;
    if (salto && m !== desde) fijarSaltos((s) => (s[s.length - 1] === desde ? s : [...s.slice(1 - SALTOS), desde]));
    ahora.current = m;
    desdeDesplazamiento.current = false;
    fijarPagina(m);
  };
  const atras = () => {
    const ultimo = saltos[saltos.length - 1];
    if (ultimo === undefined) return;
    fijarSaltos(saltos.slice(0, -1));
    irA(ultimo);
  };
  const pliegoAhora = () => pliegoDe(lista, ahora.current);
  const siguiente = () => (vista === 'continua' ? irA(ahora.current + 1) : irA(lista[Math.min(pliegoAhora() + 1, lista.length - 1)]?.[0] ?? ahora.current));
  const anterior = () => (vista === 'continua' ? irA(ahora.current - 1) : irA(lista[Math.max(pliegoAhora() - 1, 0)]?.[0] ?? ahora.current));
  // La izquierda de la pantalla es avanzar en un libro que se lee de derecha a izquierda, como al pasar la hoja de un manga.
  const haciaIzquierda = () => (rtl ? siguiente() : anterior());
  const haciaDerecha = () => (rtl ? anterior() : siguiente());
  const zoomPaso = (arriba: boolean) => fijarZoom(pasoDeZoom(escala * 100, arriba));

  // Recuerda por dónde se va y cómo se lee cada libro: solo eso, encima de lo último guardado, para no deshacer lo que se
  // cambie en la estantería mientras el libro está abierto. Al ver la última página, el libro queda terminado.
  const alFinal = !!paginador && (lista[actual] ?? [pagina]).includes(paginador.total - 1);
  useEffect(() => {
    if (!doc.documento || !paginador) return;
    const t = setTimeout(() => {
      const terminar = alFinal && !doc.terminado;
      if (terminar) fijarDoc((x) => ({ ...x, terminado: Date.now() }));
      motor
        .bibliotecaCambiar(doc.id, {
          pagina,
          abierto: Date.now(),
          ...(terminar ? { terminado: Date.now() } : {}),
          documento: { paginas: paginador.total, vista, direccion, portadaSola, ...(anchas ? { anchas } : {}), zoom, vistaTexto, nitidez, ocr: { activo: ocr, modo: modoOcr, ...(textoPdf ? {} : { textoPdf }) } },
        })
        .catch(console.error);
    }, 600);
    return () => clearTimeout(t);
  }, [doc.id, paginador, pagina, alFinal, vista, direccion, portadaSola, anchas, zoom, vistaTexto, nitidez, ocr, modoOcr, textoPdf]);

  // La portada de la estantería, de la página que se está viendo.
  const [portadaHecha, fijarPortadaHecha] = useState(false);
  const usarComoPortada = async () => {
    if (!paginador) return;
    const portada = await miniaturaDe(await (await fetch((await paginador.imagen(pagina)).url)).blob());
    fijarDoc((x) => (x.documento ? { ...x, documento: { ...x.documento, portada } } : x));
    await motor.bibliotecaCambiar(doc.id, { documento: { portada } });
    fijarPortadaHecha(true);
    setTimeout(() => fijarPortadaHecha(false), 2500);
  };

  // Al pasar de página se vuelve arriba; en el desplazamiento continuo, se lleva la página a la vista.
  useEffect(() => {
    const el = lienzo.current;
    if (!el || !paginador) return;
    if (vista !== 'continua') el.scrollTo({ top: 0, left: rtl ? el.scrollWidth : 0 });
    else if (!desdeDesplazamiento.current) el.querySelector(`[data-pagina="${pagina + 1}"]`)?.scrollIntoView({ block: 'start' });
    desdeDesplazamiento.current = false;
  }, [enPantalla, vista, paginador]);
  // Las siguientes ya se van pintando y decodificando, para pasar de página sin esperas. Las de atrás ya se vieron.
  useEffect(() => {
    if (!paginador || vista === 'continua') return;
    for (const n of lista[actual + 1] ?? []) (paginador.imagenParaVer?.(n) ?? paginador.imagen(n)).catch(() => {});
  }, [pagina, vista, paginador, lista]);

  // En el desplazamiento continuo, la página actual es la que ocupa la parte de arriba de la vista.
  const [cerca, fijarCerca] = useState<[number, number]>([0, 4]);
  useEffect(() => {
    const el = lienzo.current;
    if (!el || vista !== 'continua' || !paginador) return;
    const medir = () => {
      const caja = el.getBoundingClientRect();
      const hojas = [...el.querySelectorAll<HTMLElement>('.vs-pagina')];
      const vistas = hojas.filter((h) => {
        const r = h.getBoundingClientRect();
        return r.bottom > caja.top && r.top < caja.bottom;
      });
      if (!vistas.length) return;
      const numeros = vistas.map((h) => Number(h.dataset.pagina) - 1);
      fijarCerca([Math.max(0, Math.min(...numeros) - ALREDEDOR), Math.min(total - 1, Math.max(...numeros) + ALREDEDOR)]);
      const arriba = vistas.find((h) => h.getBoundingClientRect().bottom > caja.top + caja.height * 0.35) ?? vistas[0];
      const n = Number(arriba.dataset.pagina) - 1;
      if (n !== pagina) {
        desdeDesplazamiento.current = true;
        fijarPagina(n);
      }
    };
    medir();
    el.addEventListener('scroll', medir, { passive: true });
    return () => el.removeEventListener('scroll', medir);
  }, [vista, paginador, pagina, hueco, zoom]);

  // En la vista de texto con desplazamiento continuo se lee la página actual: el texto no se desplaza de página en página.
  const continuaTexto = vista === 'continua' && vistaTexto;
  const aLaVista = continuaTexto ? [pagina] : vista === 'continua' ? Array.from({ length: Math.max(0, cerca[1] - cerca[0] + 1) }, (_, i) => cerca[0] + i) : (lista[actual] ?? []);
  // Las páginas que vienen después, en el orden de lectura: el OCR las lee antes de llegar, para que nunca haya que esperar.
  const adelante = ADELANTE[modoOcr];
  const despues = continuaTexto
    ? Array.from({ length: Math.max(0, Math.min(adelante, total - 1 - pagina)) }, (_, i) => pagina + 1 + i)
    : vista === 'continua'
      ? Array.from({ length: Math.max(0, Math.min(adelante, total - 1 - cerca[1])) }, (_, i) => cerca[1] + 1 + i)
      : lista.slice(actual + 1, actual + 1 + adelante).flat();
  const cercanas = [...aLaVista, ...despues.slice(0, adelante)];

  // El texto del propio PDF: de las páginas a la vista y las que vienen. No cuesta nada y no hace falta pedirlo.
  const sinMirar = paginador?.textoPropio ? cercanas.filter((n) => !propias.has(n)) : [];
  useEffect(() => {
    if (!paginador?.textoPropio || !sinMirar.length) return;
    let vivo = true;
    for (const n of sinMirar) {
      paginador
        .textoPropio(n)
        .then((l) => l, () => [])
        .then((l) => vivo && fijarPropias((m) => new Map(m).set(n, l.length ? l : null)));
    }
    return () => {
      vivo = false;
    };
  }, [paginador, sinMirar.join(',')]);

  // Con el OCR activo se leen las páginas a la vista y, detrás, las siguientes, para pasar de página con el texto listo. En
  // un PDF, solo las que no traen su texto, y después de mirarlo; o todas, si se ha quitado «Texto del PDF».
  const porLeer = cercanas.filter((n) => !lineas.has(n) && (!paginador?.textoPropio || leerConOcr(propias.get(n), textoPdf)));
  // Lo que se avisa abajo: que falta el texto de una página a la vista. Lo que se adelanta no hace esperar a nadie.
  const leyendoVista = aLaVista.some((n) => porLeer.includes(n));
  // Si alguna página del PDF trae su propio texto: entonces se puede elegir entre ese texto y el OCR.
  const hayTextoPropio = [...propias.values()].some((l) => !!l?.length);
  // Al cambiar de dónde sale el texto, lo abierto solo sigue si es del texto del PDF y ese texto se sigue usando.
  const cerrarSiCambia = (usaPdf: boolean) => fijarUnidad((x) => (x && usaPdf && propias.get(x.pagina) ? x : null));
  useEffect(() => {
    fijarLineas(new Map());
    // Lo leído en una zona va como en su modo (en un manga, un globo): con otro modo, se vuelve a pedir.
    fijarZonas(new Map());
    cerrarSiCambia(textoPdf);
  }, [modoOcr]);
  /** El lector del OCR: uno por libro abierto, para las páginas y para las zonas de Área. */
  const lectorOcr = () => (lector.current ??= new LectorOcr((d) => fijarDescarga(d.cargado >= d.total ? null : d)));
  useEffect(() => {
    if (!ocr || !paginador) return;
    const l = lectorOcr();
    // Lo que se ha dejado atrás antes de su turno ya no se lee: primero va lo que se ve, y luego lo que viene, por orden.
    l.soloEstas(doc.id, modoOcr, porLeer);
    let vivo = true;
    const minima = lecturaMinima(doc.documento?.formato ?? '');
    porLeer.forEach((n, prioridad) => {
      l.leer(doc.id, n, modoOcr, () => imagenParaOcr(paginador, n), prioridad, minima)
        .then((lineasLeidas) => {
          if (vivo) fijarLineas((m) => new Map(m).set(n, lineasLeidas));
        })
        .catch((e) => vivo && !esCancelada(e) && fijarErrorOcr(e instanceof Error ? e.message : String(e)));
    });
    return () => {
      vivo = false;
    };
  }, [ocr, modoOcr, paginador, doc.id, porLeer.join(',')]);

  // Lo leído con Área («Leer una zona», más abajo), por página: entra en el texto de su página mientras el libro está
  // abierto, sin guardarse.
  const [zonas, fijarZonas] = useState<Map<number, ZonaLeida[]>>(() => new Map());
  const conSusZonas = useRef(new Map<number, { base: LineaTexto[] | undefined; zonas: ZonaLeida[]; t: { lineas: LineaTexto[]; propias: boolean } }>());
  /**
   * Las líneas de una página: las del propio PDF si las trae y se usan; si no, las del OCR, si está activo. Con lo leído
   * en sus zonas y lo editado encima.
   */
  // Cada paso se hace una vez por cambio: la página aumentada reconoce las líneas de una página por su identidad.
  const editadas = useRef(new Map<number, { base: LineaTexto[]; ediciones: EdicionLinea[]; lineas: LineaEditada[] }>());
  const textoDe = (n: number): { lineas: LineaEditada[]; propias: boolean } | undefined => {
    const leido = textoDePagina(propias.get(n), lineas.get(n), { ocrActivo: ocr, textoPdf });
    let t: { lineas: LineaTexto[]; propias: boolean } | undefined = leido;
    const z = zonas.get(n);
    if (z?.length) {
      const hecho = conSusZonas.current.get(n);
      if (hecho && hecho.base === leido?.lineas && hecho.zonas === z) t = hecho.t;
      else {
        t = { lineas: conZonas(leido?.lineas ?? [], z), propias: !!leido?.propias };
        conSusZonas.current.set(n, { base: leido?.lineas, zonas: z, t });
      }
    }
    const suyas = t ? ediciones.filter((e) => e.pagina === n) : [];
    if (!t || !suyas.length) return t;
    const c = editadas.current.get(n);
    if (c && c.base === t.lineas && c.ediciones === ediciones) return { ...t, lineas: c.lineas };
    const l = aplicarEdiciones(t.lineas, suyas);
    editadas.current.set(n, { base: t.lineas, ediciones, lineas: l });
    return { ...t, lineas: l };
  };
  /** Guarda el texto editado de una línea; si vuelve a ser el leído, la edición sobra y se quita. */
  const editar = async (pagina: number, linea: LineaEditada, texto: string, origen?: 'claude') => {
    const original = linea.original ?? linea.texto;
    if (texto === original) return restaurar(linea);
    const nueva: EdicionLinea = {
      clave: linea.edicion ?? `${doc.id}:${pagina}:${crypto.randomUUID()}`,
      libro: doc.id,
      pagina,
      caja: linea.caja,
      original,
      texto,
      creada: Date.now(),
      ...(origen ? { origen } : {}),
    };
    await guardarEdicion(nueva);
    fijarEdiciones((l) => [...l.filter((e) => e.clave !== nueva.clave), nueva]);
  };
  const restaurar = async (linea: LineaEditada) => {
    const clave = linea.edicion;
    if (!clave) return;
    await quitarEdicion(clave);
    fijarEdiciones((l) => l.filter((e) => e.clave !== clave));
  };
  // ---------- Lo que se toca: la ventana flotante ----------
  const lineasAbiertas = unidad ? textoDe(unidad.pagina)?.lineas : undefined;
  /** Si el texto de una página se toca letra a letra; en un manga leído con el OCR, globo a globo. */
  const porLetraEn = (n: number) => !!textoDe(n)?.propias || modoOcr === 'libro';
  // El texto seguido de cada página, también una vez por cambio de sus líneas.
  const leidas = useRef(new Map<number, { lineas: LineaEditada[]; globos: boolean; p: PaginaLeida }>());
  const leidaDe = (n: number): PaginaLeida | null => {
    const t = textoDe(n);
    if (!t) return null;
    const globos = !t.propias && modoOcr === 'manga';
    const c = leidas.current.get(n);
    if (c && c.lineas === t.lineas && c.globos === globos) return c.p;
    const p = leerPagina(t.lineas, { globos, marca: lengua.value.escritura.marcaDeLista });
    leidas.current.set(n, { lineas: t.lineas, globos, p });
    return p;
  };
  const abrir = (n: number, tipo: TipoUnidad, u: Unidad, p: PaginaLeida, tocada?: Posicion) => {
    const porLetra = porLetraEn(n);
    fijarSeleccion(null);
    fijarMarcaPalabra(null);
    fijarUnidad({
      clave: Date.now(),
      pagina: n,
      tipo,
      texto: u.texto,
      sitios: u.sitios,
      tramo: u.tramo,
      tocada,
      contexto: contextoDe(p, u, lengua.value.escritura.frase),
      cajas: cajasDe(p.lineas, u.tramo, porLetra),
      porLetra,
      vertical: !!p.lineas[u.tramo.desde.linea]?.vertical,
    });
  };
  /** Un toque en el texto: la palabra, dentro de su frase; dos seguidos, la frase; tres, el párrafo. En un manga, el globo. */
  const tocarTexto = (n: number, pos: Posicion, veces: number) => {
    const p = leidaDe(n);
    if (!p) return;
    if (!porLetraEn(n)) {
      const u = parrafoEn(p, pos);
      if (u) abrir(n, 'globo', u, p);
      return;
    }
    const u = veces >= 3 ? parrafoEn(p, pos) : (fraseEn(p, pos, lengua.value.escritura.frase) ?? parrafoEn(p, pos));
    if (u) abrir(n, veces >= 3 ? 'parrafo' : veces === 2 ? 'frase' : 'palabra', u, p, veces === 1 ? pos : undefined);
  };
  /** Lo seleccionado arrastrando: se marca mientras se arrastra y se abre al soltar. */
  const seleccionar = (n: number, tramo: TramoPagina, terminada: boolean) => {
    const t = textoDe(n);
    if (!t) return;
    if (!terminada) {
      fijarSeleccion({ pagina: n, cajas: cajasDe(t.lineas, tramo, true) });
      return;
    }
    const p = leidaDe(n);
    const u = p ? seleccionEn(p, tramo) : null;
    if (!p || !u?.texto.trim()) {
      fijarSeleccion(null);
      return;
    }
    // Con el resaltador, lo arrastrado queda resaltado sin abrir la ventana: para marcar mucho seguido.
    if (herramienta === 'resaltador') {
      fijarSeleccion(null);
      resaltarTramo(n, t.lineas, u.tramo, u.texto, true, 'fondo', colorResaltador);
      return;
    }
    abrir(n, 'seleccion', u, p);
  };
  const cerrarVentana = () => {
    fijarUnidad(null);
    fijarSeleccion(null);
    fijarMarcaPalabra(null);
  };
  const fijarVentana = (f: boolean) => {
    guardarPreferencia('visorVentanaFijada', f);
    fijarFijada(f);
  };
  // Si lo abierto deja de verse (otra página), la ventana flotante se cierra: lo que señalaba ya no está. Fijada, sigue.
  useEffect(() => {
    fijarSeleccion((s) => (s && aLaVista.includes(s.pagina) ? s : null));
    if (!fijada && unidad && !aLaVista.includes(unidad.pagina)) cerrarVentana();
  }, [aLaVista.join(',')]);
  // Al editar una línea cambia su texto: lo abierto se vuelve a leer desde donde empezaba.
  const reabrir = useRef<{ pagina: number; pos: Posicion; veces: number } | null>(null);
  useEffect(() => {
    const r = reabrir.current;
    if (!r) return;
    reabrir.current = null;
    tocarTexto(r.pagina, r.pos, r.veces);
  }, [ediciones]);
  // ---------- Área: leer con el OCR una zona de la página (nucleo/zonas.ts) ----------
  // Para lo que la lectura de la página no ve (un diagrama, un cartel de un manga) o para leer algo suelto sin leer el
  // libro: se dibuja un rectángulo y se lee solo eso, aunque el OCR del libro esté apagado. Lo leído se abre en la ventana.
  const [leyendoZona, fijarLeyendoZona] = useState<{ pagina: number; caja: Caja } | null>(null);
  const [zonaVacia, fijarZonaVacia] = useState(false);
  const abrirZona = useRef<{ pagina: number; lineas: LineaOcr[] } | null>(null);
  const leerZona = async (n: number, caja: Caja) => {
    if (!paginador || leyendoZona) return;
    // Es de un solo uso: después se vuelve a seleccionar, que es lo que se hace con lo leído.
    fijarHerramienta('seleccionar');
    cerrarVentana();
    fijarErrorOcr('');
    fijarZonaVacia(false);
    fijarLeyendoZona({ pagina: n, caja });
    // En un manga cada globo es una línea: lo leído en la zona, también.
    const globos = !textoDe(n)?.propias && modoOcr === 'manga';
    try {
      const imagen = await zonaParaOcr(paginador, n, caja);
      const leidas = imagen ? await lectorOcr().leerZona(globos ? modoOcr : 'libro', async () => imagen) : [];
      const suyas = globos ? [comoGlobo(leidas)].filter((l): l is LineaOcr => !!l) : leidas.filter((l) => l.texto.trim());
      if (!suyas.length) {
        fijarZonaVacia(true);
        setTimeout(() => fijarZonaVacia(false), 2500);
        return;
      }
      abrirZona.current = { pagina: n, lineas: suyas };
      fijarZonas((m) => new Map(m).set(n, [...(m.get(n) ?? []), { caja, lineas: suyas }]));
    } catch (e) {
      if (!esCancelada(e)) fijarErrorOcr(e instanceof Error ? e.message : String(e));
    } finally {
      fijarLeyendoZona(null);
    }
  };
  // Cuando lo leído ya es texto de la página, se abre: como lo seleccionado o, en un manga, como un globo.
  useEffect(() => {
    const z = abrirZona.current;
    if (!z) return;
    abrirZona.current = null;
    const t = textoDe(z.pagina);
    const p = leidaDe(z.pagina);
    const suyas = t ? lineasDeZona(t.lineas, z.lineas) : [];
    if (!t || !p || !suyas.length) return;
    const desde = suyas[0];
    const hasta = suyas[suyas.length - 1];
    if (!porLetraEn(z.pagina)) {
      const u = parrafoEn(p, { linea: desde, letra: 0 });
      if (u) abrir(z.pagina, 'globo', u, p);
      return;
    }
    const u = seleccionEn(p, { desde: { linea: desde, letra: 0 }, hasta: { linea: hasta, letra: t.lineas[hasta].texto.length } });
    if (u.texto.trim()) abrir(z.pagina, 'seleccion', u, p);
  }, [zonas]);

  // ---------- La página aumentada (nucleo/aumento.ts, Aumento.tsx) ----------
  // Lo que se pinta sobre la página vale para todos los libros, y se recuerda en este equipo.
  const [aumento, fijarAumento] = useState(() => leerPreferencia('visorAumento', true));
  const [furiganaPagina, fijarFuriganaPagina] = useState<ModoLectura>(() => leerPreferencia('visorFurigana', 'desconocidas'));
  const [gramaticaPagina, fijarGramaticaPagina] = useState(() => leerPreferencia('visorGramatica', false));
  const [traduccionBajo, fijarTraduccionBajo] = useState(() => leerPreferencia('visorTraduccionBajo', true));
  const [teclaFicha, fijarTeclaFicha] = useState<TeclaFicha>(() => leerPreferencia('visorTeclaFicha', 'Shift'));
  const ajustarPagina = (c: AjustePagina) => {
    if (c.aumento !== undefined) {
      guardarPreferencia('visorAumento', c.aumento);
      fijarAumento(c.aumento);
    }
    if (c.furigana !== undefined) {
      guardarPreferencia('visorFurigana', c.furigana);
      fijarFuriganaPagina(c.furigana);
    }
    if (c.gramatica !== undefined) {
      guardarPreferencia('visorGramatica', c.gramatica);
      fijarGramaticaPagina(c.gramatica);
    }
    if (c.traduccion !== undefined) {
      guardarPreferencia('visorTraduccionBajo', c.traduccion);
      fijarTraduccionBajo(c.traduccion);
    }
    if (c.tecla !== undefined) {
      guardarPreferencia('visorTeclaFicha', c.tecla);
      fijarTeclaFicha(c.tecla);
    }
  };
  // Lo analizado de cada página a la vista, con su texto. Al cambiar el estado de una palabra, otra vuelta: los colores y
  // el furigana de «las nuevas» siguen a lo que se sabe.
  const [analisis, fijarAnalisis] = useState<Map<number, { texto: string; tokens: PalabraToken[]; vuelta: number }>>(() => new Map());
  const [vuelta, fijarVuelta] = useState(0);
  useEffect(
    () =>
      alRecibirEvento((e) => {
        if (e.tipo === 'palabras' || e.tipo === 'palabrasRecargar') fijarVuelta((v) => v + 1);
      }),
    []
  );
  const porAnalizar = vistaTexto
    ? []
    : aLaVista.filter((n) => {
        const pl = leidaDe(n);
        const x = analisis.get(n);
        return !!pl?.corrido.texto.trim() && (x?.texto !== pl.corrido.texto || x.vuelta !== vuelta);
      });
  useEffect(() => {
    if (!porAnalizar.length) return;
    let vivo = true;
    for (const n of porAnalizar) {
      const pl = leidaDe(n);
      if (!pl) continue;
      const texto = pl.corrido.texto;
      const v = vuelta;
      motor
        .analizarTexto(texto)
        .then((r) => {
          if (!vivo) return;
          // Solo lo de cerca: un libro entero analizado ocuparía memoria sin servir de nada.
          fijarAnalisis((m) => new Map([...m].filter(([k]) => Math.abs(k - n) <= 6)).set(n, { texto, tokens: r.flat(), vuelta: v }));
        })
        .catch(console.error);
    }
    return () => {
      vivo = false;
    };
  }, [porAnalizar.join(','), vuelta]);
  /** Lo analizado de una página, si está al día con su texto. */
  const tokensDe = (n: number): PalabraToken[] | null => {
    const pl = leidaDe(n);
    const x = analisis.get(n);
    return pl && x && x.texto === pl.corrido.texto ? x.tokens : null;
  };
  const aumentos = useRef(new Map<number, { tokens: PalabraToken[]; p: PaginaLeida; gram: boolean; palabras: PalabraEnPagina[]; gramatica: GramaticaEnPagina[] }>());
  /** Las palabras de una página en su sitio, con su gramática. Sin la posición de cada letra (un globo), nada. */
  const aumentoDe = (n: number) => {
    const pl = leidaDe(n);
    const tokens = tokensDe(n);
    if (!pl || !tokens || !porLetraEn(n)) return null;
    const c = aumentos.current.get(n);
    if (c && c.tokens === tokens && c.p === pl && c.gram === gramaticaPagina) return c;
    const nuevo = {
      tokens,
      p: pl,
      gram: gramaticaPagina,
      palabras: palabrasEnPagina(pl, tokens),
      gramatica: gramaticaPagina ? gramaticaEnPagina(pl, frasesEnPagina(pl, lengua.value.escritura.frase), (f) => motorDe(lengua.value.id).detectarGramatica(f)) : [],
    };
    aumentos.current.set(n, nuevo);
    return nuevo;
  };
  // Cuánto se entiende de lo que se ve.
  const comprension = comprensionDe(aLaVista.flatMap((n) => tokensDe(n) ?? []));

  // El ratón por el texto: la palabra de debajo lleva su furigana «al pasar», y con la tecla elegida se abre su ficha sin
  // hacer clic. También al pulsar la tecla con el ratón ya encima.
  const [encima, fijarEncima] = useState<{ n: number; k: number } | null>(null);
  const ultimoPaso = useRef<{ n: number; pos: Posicion } | null>(null);
  const porTecla = useRef('');
  const conTecla = (e: { shiftKey: boolean; ctrlKey: boolean; altKey: boolean; metaKey: boolean } | null) =>
    !!e && (teclaFicha === 'Shift' ? e.shiftKey : teclaFicha === 'Control' ? e.ctrlKey || e.metaKey : teclaFicha === 'Alt' ? e.altKey : false);
  const pasarPor = (n: number, pos: Posicion | null, tecla: boolean) => {
    ultimoPaso.current = pos ? { n, pos } : null;
    const aum = pos ? aumentoDe(n) : null;
    const k = aum && pos ? palabraEn(aum.p, aum.palabras, pos) : -1;
    if (aumento && furiganaPagina === 'alPasar' && (k >= 0 ? `${n}:${k}` : '') !== (encima ? `${encima.n}:${encima.k}` : '')) fijarEncima(k >= 0 ? { n, k } : null);
    if (!tecla || !pos || (herramienta !== 'seleccionar' && herramienta !== 'mano')) {
      if (!tecla) porTecla.current = '';
      return;
    }
    // La palabra que hay debajo; en un globo de manga, el globo.
    const cual = k >= 0 ? `${n}:${k}` : !porLetraEn(n) ? `${n}:l${pos.linea}` : '';
    if (!cual || cual === porTecla.current) return;
    porTecla.current = cual;
    tocarTexto(n, pos, 1);
  };

  // La traducción de la frase abierta, como un subtítulo: lo pedido vale para esa frase.
  const [pedida, fijarPedida] = useState({ clave: 0, n: 0 });
  const pedirTraduccion = () => {
    const u = unidad;
    if (u) fijarPedida((x) => ({ clave: u.clave, n: x.clave === u.clave ? x.n + 1 : 1 }));
  };

  // Las palabras consultadas en el libro (Consultadas.tsx).
  const [consultadas, fijarConsultadas] = useState<Consultada[]>(() => leerConsultadas(inicial.id));
  const consultar = (w: { clave: string; lema: string; lectura: string; superficie: string; frase: string }) => {
    const u = unidad;
    if (u) fijarConsultadas(apuntarConsultada(doc.id, { ...w, pagina: u.pagina, caja: envolvente(u.cajas) }));
  };

  // Leer en voz alta, siguiendo la frase (vozAlta.ts).
  const frasesDe = (n: number): FraseEnPagina[] => {
    const pl = leidaDe(n);
    return pl ? frasesEnPagina(pl, lengua.value.escritura.frase, porLetraEn(n)) : [];
  };
  const vozAlta = useVozAlta({ frasesDe, total, irA: (n) => irA(n), ajustes: a });
  const leerEnVozAlta = () => {
    if (vozAlta.voz) {
      vozAlta.parar();
      return;
    }
    // Desde lo abierto, si está a la vista; si no, desde el principio de la página.
    const desde = unidad && aLaVista.includes(unidad.pagina) ? unidad.pagina : (aLaVista[0] ?? pagina);
    let i = 0;
    const pl = leidaDe(desde);
    if (unidad && unidad.pagina === desde && pl) {
      const k = pl.inicios[unidad.tramo.desde.linea] + unidad.tramo.desde.letra;
      const j = frasesDe(desde).findIndex((f) => k >= f.inicio && k < f.fin);
      if (j >= 0) i = j;
    }
    cerrarVentana();
    vozAlta.empezar(desde, i);
  };
  const fraseSonando = vozAlta.voz ? frasesDe(vozAlta.voz.pagina)[vozAlta.voz.frase] : undefined;
  // La frase que suena, a la vista.
  useEffect(() => {
    if (fraseSonando) document.querySelector('.vs-leyendo')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [vozAlta.voz?.pagina, vozAlta.voz?.frase]);

  /** Lo que se pinta sobre una página: lo aumentado, la frase que suena y el subtítulo de la frase abierta. */
  const capasDe = (n: number, ancho: number, alto: number) => {
    const aum = aumento ? aumentoDe(n) : null;
    return (
      <>
        {aum && (
          <CapaAumento
            palabras={aum.palabras}
            tokens={aum.tokens}
            a={{ furigana: lengua.value.lectura.distingue ? furiganaPagina : 'ninguna', estado: a.mostrarEstado, gramatica: gramaticaPagina }}
            ancho={ancho}
            alto={alto}
            encima={encima?.n === n ? encima.k : -1}
            gramatica={aum.gramatica}
          />
        )}
        {fraseSonando && vozAlta.voz?.pagina === n && <FraseLeida cajas={fraseSonando.cajas} />}
        {traduccionBajo && unidad?.pagina === n && (
          <SubtituloFrase
            key={unidad.clave}
            cajas={unidad.cajas}
            contexto={{ frase: unidad.texto, antes: unidad.contexto.antes, despues: unidad.contexto.despues, titulo: doc.titulo }}
            pedida={pedida.clave === unidad.clave ? pedida.n : 0}
            alPedir={pedirTraduccion}
            alto={alto}
          />
        )}
      </>
    );
  };

  const propsTexto = (n: number) => {
    const t = textoDe(n);
    if (!t) return {};
    return {
      lineas: t.lineas,
      porPalabra: t.propias || modoOcr === 'libro',
      unidad: unidad?.pagina === n ? unidad.cajas : undefined,
      seleccion: seleccion?.pagina === n ? seleccion.cajas : undefined,
      marcas: unidad?.pagina === n && marcaPalabra ? marcaPalabra : undefined,
      alTocar: (pos: Posicion, veces: number) => tocarTexto(n, pos, veces),
      alSeleccionar: (tramo: TramoPagina, terminada: boolean) => seleccionar(n, tramo, terminada),
      alPasar: (pos: Posicion | null, e: MouseEvent | null) => pasarPor(n, pos, conTecla(e)),
      capas: (ancho: number, alto: number) => capasDe(n, ancho, alto),
    };
  };

  /** Área en una página: lo dibujado se lee, y la zona que se está leyendo se ve. Sin texto en la página, también. */
  const propsZona = (n: number) => ({ alArea: (caja: Caja) => leerZona(n, caja), zonaLeyendo: leyendoZona?.pagina === n ? leyendoZona.caja : undefined });

  // ---------- Lo anotado ----------
  // Se cambia a la vista al momento y se guarda detrás, en la base de la lengua, con los libros.
  const guardarAnotacion = (a: AnotacionLibro) => {
    fijarAnotaciones((l) => [...l.filter((x) => x.id !== a.id), a]);
    motor.anotacionGuardar(a).catch(console.error);
  };
  const quitarAnotacion = (id: string) => {
    fijarAnotaciones((l) => l.filter((x) => x.id !== id));
    if (notaAbierta === id) fijarNotaAbierta(null);
    motor.anotacionEliminar(id).catch(console.error);
  };
  const marcador = anotaciones.find((a) => a.tipo === 'marcador' && a.pagina === pagina);
  const alternarMarcador = () => (marcador ? quitarAnotacion(marcador.id) : guardarAnotacion({ id: crypto.randomUUID(), libro: doc.id, tipo: 'marcador', pagina, creada: Date.now() }));
  const propsAnotaciones = (n: number): PropsAnotaciones => ({
    anotaciones: anotaciones.filter((a) => a.pagina === n),
    notaAbierta,
    alAbrirNota: fijarNotaAbierta,
    alGuardarAnotacion: guardarAnotacion,
    alQuitarAnotacion: quitarAnotacion,
  });
  /** Resalta o subraya un tramo de una página. Lo mismo resaltado otra vez cambia de color o de estilo, sin amontonarse. */
  const resaltarTramo = (n: number, lineasPagina: LineaTexto[], tramo: TramoPagina, texto: string, porLetra: boolean, estilo: 'fondo' | 'subrayado', color: ColorAnotacion) => {
    const a = resaltadoDeTramo({ libro: doc.id, pagina: n, lineas: lineasPagina, tramo, texto, porLetra, estilo, color });
    const igual = anotaciones.find((x) => x.tipo === 'resaltado' && x.pagina === a.pagina && x.texto === a.texto && mismasCajas(x.cajas, a.cajas));
    const guardado = igual ? { ...igual, estilo, color } : a;
    guardarAnotacion(guardado);
    return guardado;
  };
  const elegirColor = (c: ColorAnotacion) => {
    guardarPreferencia('visorColorResaltador', c);
    fijarColorResaltador(c);
  };
  /** Resalta o subraya lo abierto en la ventana, aunque ocupe varios renglones, o solo un trozo de su texto. */
  const resaltar = (estilo: 'fondo' | 'subrayado', color: ColorAnotacion, trozo: { inicio: number; fin: number } | null): AnotacionLibro | null => {
    if (!unidad || !lineasAbiertas) return null;
    const sitios = trozo ? unidad.sitios.slice(trozo.inicio, trozo.fin) : unidad.sitios;
    const desde = sitios[0];
    const ultimo = sitios[sitios.length - 1];
    if (!desde || !ultimo) return null;
    // El color elegido en la ventana es también el del resaltador.
    if (estilo === 'fondo') elegirColor(color);
    return resaltarTramo(
      unidad.pagina,
      lineasAbiertas,
      trozo ? tramoEntre(lineasAbiertas, desde, ultimo) : unidad.tramo,
      trozo ? unidad.texto.slice(trozo.inicio, trozo.fin) : unidad.texto,
      unidad.porLetra,
      estilo,
      color
    );
  };

  /** Pone una nota en un punto de una página (en fracciones de la hoja) y la abre para escribirla. */
  const ponerNotaEn = (n: number, punto: { x: number; y: number }) => {
    const dentro = (v: number) => Math.min(0.97, Math.max(0, v));
    const a: AnotacionLibro = { id: crypto.randomUUID(), libro: doc.id, tipo: 'nota', pagina: n, punto: { x: dentro(punto.x), y: dentro(punto.y) }, creada: Date.now() };
    guardarAnotacion(a);
    fijarNotaAbierta(a.id);
  };
  /** La hoja bajo el puntero y el punto tocado en ella, en fracciones. */
  const hojaEn = (e: MouseEvent) => {
    const hoja = (e.target as HTMLElement | null)?.closest<HTMLElement>('.vs-pagina');
    if (!hoja?.dataset.pagina || hoja.classList.contains('vs-reservada')) return null;
    const r = hoja.getBoundingClientRect();
    return { pagina: Number(hoja.dataset.pagina) - 1, punto: { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height } };
  };
  /** Con «Añadir una nota», un toque en una página pone ahí la nota; después se vuelve a seleccionar. */
  const ponerNota = (e: MouseEvent) => {
    fijarHerramienta('seleccionar');
    const h = hojaEn(e);
    if (h) ponerNotaEn(h.pagina, h.punto);
  };

  // ---------- Buscar en el libro ----------
  // Con el panel abierto se prepara el texto de todas las páginas: lo leído con el OCR y el que trae el PDF.
  useEffect(() => {
    if (panel !== 'buscar' || !paginador) return;
    const control = new AbortController();
    leerTextoLibro({
      paginador,
      libro: doc.id,
      modo: modoOcr,
      minima: lecturaMinima(doc.documento?.formato ?? ''),
      textoPdf,
      ocrActivo: ocr,
      propias,
      senal: control.signal,
      alAvanzar: (paginas, hechas, nuevas) => {
        fijarCorpus({ paginas, hechas });
        if (nuevas.size) {
          fijarPropias((m) => {
            const x = new Map(m);
            for (const [n, l] of nuevas) if (!x.has(n)) x.set(n, l);
            return x;
          });
        }
      },
    }).catch(console.error);
    return () => control.abort();
  }, [panel === 'buscar', paginador, doc.id, modoOcr, textoPdf, ocr]);
  useEffect(() => {
    if (panel !== 'buscar') fijarHallado(null);
    if (panel !== 'revision') fijarRevisadas([]);
  }, [panel]);
  // Lo marcado era de lo que se buscaba antes.
  useEffect(() => fijarHallado(null), [consulta]);

  /** El texto en que se busca: el preparado y, encima, lo que el visor tiene más nuevo, con lo editado, como se ve. */
  const buscable = useMemo(() => {
    const salida = new Map<number, TextoDePagina>();
    if (panel !== 'buscar' || !corpus) return salida;
    for (const [n, t] of corpus.paginas) salida.set(n, t);
    for (const n of new Set([...lineas.keys(), ...propias.keys()])) {
      const t = textoDePagina<LineaTexto>(propias.get(n), lineas.get(n), { ocrActivo: ocr || !propias.get(n), textoPdf });
      if (t) salida.set(n, t);
    }
    for (const [n, t] of salida) {
      const suyas = ediciones.filter((e) => e.pagina === n);
      if (suyas.length) salida.set(n, { ...t, lineas: aplicarEdiciones(t.lineas, suyas) });
    }
    return salida;
  }, [panel, corpus, lineas, propias, ediciones, ocr, textoPdf]);

  /** Lleva a lo encontrado y lo marca en su página. Si es texto del OCR y estaba apagado, se enciende para verlo. */
  const elegirHallazgo = (h: Hallazgo) => {
    const t = buscable.get(h.pagina);
    if (!t) return;
    const porLetra = t.propias || modoOcr === 'libro';
    const cajas = h.tramos.map((x) => (porLetra ? cajaDeTramo(t.lineas[x.linea], x.inicio, x.fin) : t.lineas[x.linea].caja));
    if (!ocr && !t.propias) fijarOcr(true);
    fijarHallado({ pagina: h.pagina, cajas });
    if (!(lista[actual] ?? []).includes(h.pagina) || vista === 'continua') irA(h.pagina, true);
  };

  // ---------- Revisar con Claude ----------
  /** Las páginas a la vista que tienen texto: las que se pueden revisar. */
  const conTexto = aLaVista.filter((n) => (textoDe(n)?.lineas.length ?? 0) > 0);
  const revisarPagina = async (n: number): Promise<PropuestaLinea[]> => {
    const t = textoDe(n);
    if (!t?.lineas.length || !paginador) return [];
    const suyas = t.lineas;
    const imagen = await imagenParaClaude(await imagenParaOcr(paginador, n), suyas.map((l) => l.caja));
    const cambios = await motor.revisarPaginaOcr({ libro: doc.id, titulo: doc.titulo, pagina: n, globos: !t.propias && modoOcr === 'manga', lineas: suyas.map((l) => l.texto), imagen });
    return cambiosValidos(
      suyas.map((l) => l.texto),
      cambios
    ).map((c) => ({ ...c, linea: suyas[c.indice] }));
  };
  const aplicarRevision = async (n: number, cambios: PropuestaLinea[]) => {
    for (const c of cambios) await editar(n, c.linea, c.despues, 'claude');
  };

  const pulsarLienzo = (e: MouseEvent) => {
    // El clic que termina un arrastre con la mano no es un toque.
    if (trasArrastre.current) {
      trasArrastre.current = false;
      return;
    }
    if (colocando) {
      ponerNota(e);
      return;
    }
    // Un toque fuera del texto cierra lo abierto y nada más: pasar de página es cosa de las flechas, del teclado y de
    // deslizar. Antes los lados del lienzo pasaban de página, y fallar por poco al tocar una palabra se la llevaba.
    fijarSeleccion(null);
    if (!fijada) {
      fijarUnidad(null);
      fijarMarcaPalabra(null);
    }
  };

  // La mano: arrastrar con el ratón mueve la página, como en un lector de PDF. En una pantalla táctil ya se mueve sola.
  const trasArrastre = useRef(false);
  const [arrastrando, fijarArrastrando] = useState(false);
  const empezarArrastre = (e: PointerEvent) => {
    const el = lienzo.current;
    if (herramienta !== 'mano' || e.button !== 0 || e.pointerType === 'touch' || !el) return;
    if ((e.target as HTMLElement).closest('.vs-nota-pagina, button:not(.vs-linea), a, input, textarea')) return;
    const inicio = { x: e.clientX, y: e.clientY, izq: el.scrollLeft, arriba: el.scrollTop, movido: false };
    trasArrastre.current = false;
    const mover = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      const dx = ev.clientX - inicio.x;
      const dy = ev.clientY - inicio.y;
      if (!inicio.movido && Math.hypot(dx, dy) < 4) return;
      if (!inicio.movido) {
        inicio.movido = true;
        fijarArrastrando(true);
      }
      el.scrollLeft = inicio.izq - dx;
      el.scrollTop = inicio.arriba - dy;
    };
    const soltarArrastre = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltarArrastre);
      window.removeEventListener('pointercancel', soltarArrastre);
      if (!inicio.movido) return;
      fijarArrastrando(false);
      trasArrastre.current = true;
      // Si el clic no llega (se soltó fuera del lienzo), que no se quede esperando.
      setTimeout(() => (trasArrastre.current = false), 0);
    };
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltarArrastre);
    window.addEventListener('pointercancel', soltarArrastre);
  };

  // Deslizar con el dedo, en una pantalla táctil.
  const inicioToque = useRef<{ x: number; y: number } | null>(null);
  const tocar = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') inicioToque.current = { x: e.clientX, y: e.clientY };
    empezarArrastre(e);
  };
  const soltar = (e: PointerEvent) => {
    const i = inicioToque.current;
    inicioToque.current = null;
    if (!i || vista === 'continua') return;
    const dx = e.clientX - i.x;
    if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(e.clientY - i.y)) (dx > 0 ? haciaIzquierda : haciaDerecha)();
  };

  const indicador = vista === 'doble' && (lista[actual]?.length ?? 0) > 1 ? `${lista[actual][0] + 1}–${lista[actual][1] + 1}` : String(pagina + 1);
  const capitulo = paginador ? [...paginador.indice].reverse().find((e) => e.pagina <= pagina) : undefined;

  // ---------- Las órdenes: menús, paleta, atajos y menú contextual (ordenesVisor.ts) ----------
  const abrirPanel = (p: PanelVisor) => fijarPanel((x) => (x === p ? null : p));
  const abrirBuscar = () => {
    if (panel === 'buscar') document.querySelector<HTMLInputElement>('.vs-panel-buscar input')?.select();
    else fijarPanel('buscar');
  };
  const alternarOcr = () => {
    fijarErrorOcr('');
    cerrarSiCambia(textoPdf);
    fijarOcr(!ocr);
  };
  const alternarVistaTexto = () => {
    // Para leer como texto hace falta el texto: si la página no lo trae, lo lee el OCR.
    if (!vistaTexto && !ocr) {
      fijarErrorOcr('');
      fijarOcr(true);
    }
    cerrarVentana();
    fijarHerramienta('seleccionar');
    fijarVistaTexto(!vistaTexto);
  };
  const revisar = () => {
    fijarRevisadas((r) => [...conTexto.filter((n) => !r.includes(n)), ...r]);
    fijarPanel('revision');
  };
  /** El texto de unas páginas, por párrafos, como se ve en la ventana: los renglones de un párrafo, unidos. */
  const textoParaCopiar = (paginas: number[]) =>
    paginas
      .map((n) => leidaDe(n)?.corrido.texto.trim() ?? '')
      .filter(Boolean)
      .join('\n\n');
  const copiar = (texto: string) => {
    if (texto) navigator.clipboard.writeText(texto).catch(console.error);
  };
  const irAPagina = () => {
    const campo = document.querySelector<HTMLInputElement>('.vs-barra .vs-numero');
    if (campo && !lectura) {
      campo.focus();
      campo.select();
    } else fijarDialogo('paleta');
  };
  const herramientaA = (h: Herramienta) => {
    if (h !== 'seleccionar') fijarSeleccion(null);
    fijarHerramienta(h);
  };
  const estado: EstadoVisor = {
    vista,
    rtl,
    portadaSola,
    zoom,
    vistaTexto,
    invertir,
    nitidez,
    lleno,
    lectura,
    ocr,
    modoOcr,
    textoPdf,
    hayTextoPropio,
    conTexto: conTexto.length > 0,
    hayIndice: (paginador?.indice.length ?? 0) > 0,
    panel,
    marcada: !!marcador,
    herramienta,
    atras: saltos.length ? saltos[saltos.length - 1] : null,
    fijada,
    furigana: a.furigana,
    mostrarEstado: a.mostrarEstado,
    colorAcento: a.colorAcento,
    letra: a.diccionarioLetra,
    aumento,
    furiganaPagina,
    gramaticaPagina,
    traduccionBajo,
    teclaFicha,
    voz: !!vozAlta.voz,
    lengua: { lectura: tr(lengua.value.textos.lectura), lecturaEnPagina: lengua.value.lectura.distingue, acento: !!lengua.value.acento, comic: lengua.value.escritura.globos === 'lector', letras: letrasDe(lengua.value) },
  };
  const acciones: AccionesVisor = {
    biblioteca: () => fondo.abrirApp('biblioteca').catch(console.error),
    vocabulario: () => fondo.abrirApp(`vocabulario?libro=${encodeURIComponent(doc.id)}`).catch(console.error),
    exportar: () => fondo.abrirApp(`biblioteca?exportar=${encodeURIComponent(doc.id)}`).catch(console.error),
    portada: () => usarComoPortada().catch(console.error),
    vista: fijarVista,
    portadaSola: () => fijarPortadaSola((x) => !x),
    sentido: (r) => fijarDireccion(r ? 'rtl' : 'ltr'),
    zoom: (z) => (z === 'mas' ? zoomPaso(true) : z === 'menos' ? zoomPaso(false) : fijarZoom(z)),
    nitidez: (n) => fijarNitidez((x) => ({ ...x, ...n })),
    invertir: () => {
      guardarPreferencia('visorInvertir', !invertir);
      fijarInvertir(!invertir);
    },
    vistaTexto: alternarVistaTexto,
    lectura: () => {
      fijarMenu(null);
      fijarDesplegable(null);
      // Con el foco en la barra, la barra no se escondería: se queda asomada mientras lo tiene.
      if (!lectura && document.activeElement?.closest('.vs-barra')) (document.activeElement as HTMLElement).blur();
      fijarAsomada(false);
      fijarLectura(!lectura);
    },
    pantallaCompleta,
    ir: (d) => (d === 'primera' ? irA(0, true) : d === 'ultima' ? irA(total - 1, true) : d === 'anterior' ? anterior() : siguiente()),
    irAPagina,
    atras,
    panel: abrirPanel,
    ocr: alternarOcr,
    modoOcr: fijarModoOcr,
    textoPdf: () => {
      // Cambia de dónde sale el texto de las páginas que traen el suyo: lo abierto en una de ellas se cierra.
      fijarUnidad((x) => (x && !propias.get(x.pagina) ? x : null));
      fijarTextoPdf(!textoPdf);
    },
    revisar,
    copiarPagina: () => copiar(textoParaCopiar(aLaVista)),
    ajuste: (c) => {
      guardarAjustes(c).catch(console.error);
    },
    fijar: () => fijarVentana(!fijada),
    marcador: alternarMarcador,
    herramienta: herramientaA,
    atajos: () => fijarDialogo('atajos'),
    paleta: () => fijarDialogo('paleta'),
    pagina: ajustarPagina,
    vozAlta: leerEnVozAlta,
  };
  const ordenes = ordenesDelVisor(estado, acciones);
  const orden = (id: string) => ordenes.find((o) => o.id === id);

  // Las teclas: las de pasar de página, aquí; las demás, las del registro de órdenes, como dicen los menús. El oyente es
  // uno solo y llama siempre a la versión de este pintado: si se pusiera de nuevo en cada efecto, una tecla pulsada justo
  // al cerrarse la paleta llegaría al de antes, que aún la cree abierta.
  const alTeclear = useRef<(e: KeyboardEvent) => void>(() => {});
  {
    const tecla = (e: KeyboardEvent) => {
      if (!paginador || e.isComposing) return;
      // La tecla de la ficha con el ratón ya sobre una palabra: la abre sin moverlo.
      if (teclaFicha !== 'ninguna' && e.key === teclaFicha && !e.repeat && ultimoPaso.current && !dialogo && !menu && !contextual) {
        const u = ultimoPaso.current;
        pasarPor(u.n, u.pos, true);
      }
      const t = teclaDe(e);
      // La paleta y buscar valen también escribiendo en un campo.
      if (t === 'Ctrl+K') {
        e.preventDefault();
        fijarMenu(null);
        fijarDesplegable(null);
        fijarContextual(null);
        fijarDialogo((d) => (d === 'paleta' ? null : 'paleta'));
        return;
      }
      if (dialogo) return;
      if (t === 'Ctrl+F') {
        // Como en un lector de PDF: buscar en el libro, que el buscador del navegador no ve el texto de las páginas.
        e.preventDefault();
        fijarMenu(null);
        abrirBuscar();
        return;
      }
      const destino = e.target as HTMLElement | null;
      if (destino?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      // Un menú abierto, o la barra de menús con el foco, atienden sus propias teclas.
      if (menu || contextual || destino?.closest?.('[role="menu"], [role="menubar"]')) return;
      if (e.key === 'F10' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
        // Como en el escritorio: F10 lleva a la barra de menús.
        e.preventDefault();
        if (lectura) fijarAsomada(true);
        document.querySelector<HTMLElement>('.vs-menus [data-menu]')?.focus();
        return;
      }
      if (t === 'Ctrl+C') {
        // Copiar lo abierto en la ventana, si no hay otra cosa seleccionada.
        if (!unidad || window.getSelection()?.isCollapsed === false) return;
        navigator.clipboard.writeText(unidad.texto).catch(console.error);
        e.preventDefault();
        return;
      }
      if (e.key === 'Escape') {
        if (desplegable) fijarDesplegable(null);
        else if (unidad || seleccion) cerrarVentana();
        else if (herramienta === 'nota' || herramienta === 'area') fijarHerramienta('seleccionar');
        else if (vozAlta.voz) vozAlta.parar();
        else if (lectura) fijarLectura(false);
        else return;
        e.preventDefault();
        return;
      }
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        // En la vista de texto se pasa de página igual en todas las vistas: el texto no se desplaza de página en página.
        const continua = vista === 'continua' && !vistaTexto;
        let hecho = true;
        if (e.key === 'ArrowLeft' && !continua) haciaIzquierda();
        else if (e.key === 'ArrowRight' && !continua) haciaDerecha();
        else if (e.key === 'PageDown' || (e.key === ' ' && !continua && !e.shiftKey)) siguiente();
        else if (e.key === 'PageUp' || (e.key === ' ' && !continua && e.shiftKey)) anterior();
        else if (e.key === 'Home') irA(0, true);
        else if (e.key === 'End') irA(total - 1, true);
        else hecho = false;
        if (hecho) {
          e.preventDefault();
          return;
        }
      }
      const o = ordenDeTecla(ordenes, t);
      if (!o) return;
      e.preventDefault();
      o.ejecutar();
    };
    alTeclear.current = tecla;
  }
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => alTeclear.current(e);
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);

  // En el modo lectura, la barra se asoma al llevar el ratón arriba y se va al bajar, salvo con un menú abierto. La franja
  // es ancha: una de pocos píxeles no se acierta.
  useEffect(() => {
    if (!lectura) {
      fijarAsomada(false);
      return;
    }
    const mover = (e: MouseEvent) => {
      const barra = document.querySelector('.vs-barra');
      const alto = barra?.getBoundingClientRect().height ?? 48;
      if (e.clientY <= 32) fijarAsomada(true);
      else if (e.clientY > alto + 56 && !menu && !desplegable && !barra?.contains(document.activeElement)) fijarAsomada(false);
    };
    window.addEventListener('mousemove', mover);
    return () => window.removeEventListener('mousemove', mover);
  }, [lectura, menu, desplegable]);

  // El menú de un clic derecho en la página: lo de la ventana abierta, una nota justo ahí, el texto de esa página, las
  // herramientas y la portada.
  const abrirContextual = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('.vs-nota-pagina, .vs-flecha')) return;
    e.preventDefault();
    fijarMenu(null);
    fijarDesplegable(null);
    const h = hojaEn(e);
    fijarContextual({ x: e.clientX, y: e.clientY, pagina: h?.pagina ?? null, punto: h?.punto ?? null });
  };
  const ordenesContexto = (): Comando[] => {
    if (!contextual) return [];
    const l: Comando[] = [];
    const de = (id: string, grupo: string) => {
      const o = orden(id);
      if (o) l.push({ ...o, grupo });
    };
    if (unidad) {
      const abierta = unidad;
      l.push(
        { id: 'ctx-copiar', etiqueta: tr('Copiar'), menu: 'ver', grupo: 'unidad', icono: 'copiar', atajo: 'Ctrl+C', atajoAparte: true, ejecutar: () => copiar(abierta.texto) },
        {
          id: 'ctx-buscar',
          etiqueta: tr('Buscar en el libro'),
          menu: 'ver',
          grupo: 'unidad',
          icono: 'buscar',
          ejecutar: () => {
            fijarConsulta(abierta.texto);
            fijarPanel('buscar');
          },
        }
      );
    }
    const { pagina: n, punto } = contextual;
    if (n !== null && punto) l.push({ id: 'ctx-nota', etiqueta: tr('Añadir una nota aquí'), menu: 'ver', grupo: 'anotar', icono: 'nota-lapiz', ejecutar: () => ponerNotaEn(n, punto) });
    de('marcador', 'anotar');
    if (n !== null && textoDe(n)?.lineas.length) l.push({ id: 'ctx-copiar-pagina', etiqueta: tr('Copiar el texto de la página'), menu: 'ver', grupo: 'pagina', icono: 'copiar', ejecutar: () => copiar(textoParaCopiar([n])) });
    for (const id of ['seleccionar', 'mano', 'area', 'resaltador']) de(id, 'herramienta');
    de('portada', 'libro');
    return l;
  };

  // El zoom de la barra: ajustar a la página o al ancho, y unos tamaños.
  const grupoZoom = useRef<HTMLDivElement>(null);
  const botonAa = useRef<HTMLButtonElement>(null);
  useClicFuera(desplegable === 'zoom', () => [grupoZoom.current], () => fijarDesplegable(null));
  const ordenesZoom: Comando[] = [
    ...ordenes.filter((o) => o.id === 'zoom-pagina' || o.id === 'zoom-ancho'),
    ...TAMANOS_ZOOM.map((t): Comando => ({ id: `zoom-${t}`, etiqueta: `${t} %`, menu: 'ver', grupo: 'tamano', tipo: 'opcion', marcada: zoom === t, ejecutar: () => fijarZoom(t) })),
  ];

  /** Ensancha el panel de la izquierda arrastrando su borde, o con las flechas si tiene el foco. */
  const ensanchar = (e: PointerEvent) => {
    e.preventDefault();
    const borde = e.currentTarget as HTMLElement;
    const x0 = e.clientX;
    const w0 = anchoPanel;
    let w = w0;
    borde.setPointerCapture(e.pointerId);
    const mover = (ev: PointerEvent) => {
      w = Math.round(Math.min(ANCHO_PANEL.maximo, Math.max(ANCHO_PANEL.minimo, w0 + ev.clientX - x0)));
      fijarAnchoPanel(w);
    };
    const soltarBorde = () => {
      borde.removeEventListener('pointermove', mover);
      borde.removeEventListener('pointerup', soltarBorde);
      borde.removeEventListener('pointercancel', soltarBorde);
      guardarPreferencia('visorPanelAncho', w);
    };
    borde.addEventListener('pointermove', mover);
    borde.addEventListener('pointerup', soltarBorde);
    borde.addEventListener('pointercancel', soltarBorde);
  };
  const ensancharConTeclas = (e: KeyboardEvent) => {
    const paso = e.key === 'ArrowRight' ? 24 : e.key === 'ArrowLeft' ? -24 : 0;
    if (!paso) return;
    e.preventDefault();
    e.stopPropagation();
    const w = Math.min(ANCHO_PANEL.maximo, Math.max(ANCHO_PANEL.minimo, anchoPanel + paso));
    fijarAnchoPanel(w);
    guardarPreferencia('visorPanelAncho', w);
  };

  const contenido = () => {
    if (error) return <AvisoError mensaje={error} />;
    if (!paginador) return <Abriendo />;
    if (vistaTexto) {
      return (
        <VistaTexto
          paginas={aLaVista}
          textos={aLaVista.map(textoDe)}
          globos={modoOcr === 'manga'}
          leyendo={ocr && leyendoVista}
          ocrActivo={ocr}
          alLeer={() => {
            fijarErrorOcr('');
            fijarOcr(true);
          }}
          ajustes={a}
          titulo={doc.titulo}
        />
      );
    }
    const halladoEn = (n: number) => (hallado?.pagina === n ? hallado.cajas : undefined);
    if (vista === 'continua')
      return (
        <div class="vs-continua">
          {Array.from({ length: total }, (_, n) => {
            const e = escalaDe([medida(n)], hueco, zoom);
            const t = medida(n);
            return n >= cerca[0] && n <= cerca[1] ? (
              <Pagina key={n} paginador={paginador} n={n} escala={e} alCargar={() => refrescar((x) => x + 1)} herramienta={herramienta} hallado={halladoEn(n)} {...propsTexto(n)} {...propsZona(n)} {...propsAnotaciones(n)} />
            ) : (
              <div key={n} class="vs-pagina vs-reservada" data-pagina={n + 1} style={{ width: `${Math.round(t.ancho * e)}px`, height: `${Math.round(t.alto * e)}px` }} />
            );
          })}
        </div>
      );
    return (
      <div class={`vs-pliego ${rtl ? 'rtl' : ''}`}>
        {(lista[actualVisible] ?? []).map((n) => (
          <Pagina key={n} paginador={paginador} n={n} escala={escala} alCargar={() => refrescar((x) => x + 1)} herramienta={herramienta} hallado={halladoEn(n)} {...propsTexto(n)} {...propsZona(n)} {...propsAnotaciones(n)} />
        ))}
      </div>
    );
  };

  const botonCarril = (icono: NombreIcono, etiqueta: string, activo: boolean, alPulsar: () => void, atajo?: string) => (
    <button type="button" class={`vs-carril-boton ${activo ? 'activo' : ''}`} aria-label={etiqueta} aria-pressed={activo} data-tip={atajo ? `${etiqueta} · ${atajo}` : etiqueta} data-tip-lado="der" onClick={alPulsar}>
      <Icono n={icono} t={19} />
    </button>
  );
  const tituloPanel = (icono: NombreIcono, nombre: string) => (
    <div class="vs-panel-titulo">
      <Icono n={icono} t={16} />
      <b>{nombre}</b>
      <button class="btn-icono chico vs-cerrar" aria-label={tr('Cerrar')} onClick={() => fijarPanel(null)}>
        <Icono n="cerrar" t={15} />
      </button>
    </div>
  );

  // La barra de abajo: dónde se está, cuánto va leído, de dónde sale el texto y qué hace el OCR.
  const ultimaVista = Math.max(...(lista[actual] ?? [pagina]));
  const avance = total ? Math.round((100 * (ultimaVista + 1)) / total) : 0;
  const textoActual = paginador ? textoDe(pagina) : undefined;
  const nombreModo = modoOcr === 'manga' ? (lengua.value.escritura.globos === 'lector' ? tr('Cómic') : tr('Manga')) : tr('Libro');
  const desdeDeslizador = useRef<number | null>(null);

  return (
    <div class={`vs-marco ${lectura ? 'modo-lectura' : ''}`}>
      <header class={`vs-barra ${asomada ? 'asomada' : ''}`}>
        <Cabeza titulo={doc.titulo} />
        {paginador && (
          <>
            <BarraMenus
              ordenes={ordenes}
              abierto={menu}
              alAbrir={(m) => {
                if (m) {
                  fijarDesplegable(null);
                  fijarContextual(null);
                }
                fijarMenu(m);
              }}
            />
            <span class="vs-barra-hueco" />
            <div class="vs-grupo" role="group" aria-label={tr('Páginas')}>
              {/* Los iconos apuntan a donde va la hoja en la pantalla; lo que cambia con el sentido es a qué página lleva. */}
              <Boton icono="primera" clase="vs-extremo" etiqueta={rtl ? tr('Última página') : tr('Primera página')} alPulsar={() => (rtl ? irA(total - 1, true) : irA(0, true))} />
              <Boton icono="anterior" etiqueta={rtl ? tr('Página siguiente') : tr('Página anterior')} alPulsar={haciaIzquierda} />
              <span class="vs-pagina-actual">
                <input
                  class="campo vs-numero num"
                  inputMode="numeric"
                  aria-label={tr('Ir a la página')}
                  value={escrito ?? indicador}
                  onFocus={(e) => e.currentTarget.select()}
                  onInput={(e) => fijarEscrito(e.currentTarget.value)}
                  onBlur={() => fijarEscrito(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const n = parseInt(escrito ?? '', 10);
                      if (n > 0) irA(n - 1, true);
                      fijarEscrito(null);
                      e.currentTarget.blur();
                    } else if (e.key === 'Escape') {
                      fijarEscrito(null);
                      e.currentTarget.blur();
                    }
                  }}
                />
                <span class="num">/ {total}</span>
              </span>
              <Boton icono="siguiente" etiqueta={rtl ? tr('Página anterior') : tr('Página siguiente')} alPulsar={haciaDerecha} />
              <Boton icono="ultima" clase="vs-extremo" etiqueta={rtl ? tr('Primera página') : tr('Última página')} alPulsar={() => (rtl ? irA(0, true) : irA(total - 1, true))} />
            </div>
            {!vistaTexto && (
              <div ref={grupoZoom} class="vs-grupo vs-grupo-zoom" role="group" aria-label={tr('Zoom')}>
                <Boton icono="alejar" etiqueta={tr('Alejar')} alPulsar={() => zoomPaso(false)} />
                <button type="button" class={`btn chico fantasma vs-zoom num ${desplegable === 'zoom' ? 'abierto' : ''}`} aria-haspopup="menu" aria-expanded={desplegable === 'zoom'} onClick={() => fijarDesplegable(desplegable === 'zoom' ? null : 'zoom')}>
                  {porcentaje} %<Icono n="abajo" t={11} />
                </button>
                <Boton icono="acercar" etiqueta={tr('Acercar')} alPulsar={() => zoomPaso(true)} />
                {desplegable === 'zoom' && (
                  <ListaMenu
                    entradas={entradasDe(ordenesZoom, 'ver')}
                    etiqueta={tr('Zoom')}
                    clase="vs-menu-zoom"
                    alCerrar={(devolver) => {
                      fijarDesplegable(null);
                      if (devolver) grupoZoom.current?.querySelector<HTMLElement>('.vs-zoom')?.focus();
                    }}
                  />
                )}
              </div>
            )}
            <div class="vs-grupo">
              <Boton icono="marcador" etiqueta={marcador ? tr('Quitar el marcador de esta página') : tr('Marcar esta página')} activo={!!marcador} alPulsar={alternarMarcador} />
              <span class="vs-aa-ancla">
                <button
                  ref={botonAa}
                  type="button"
                  class={`btn chico fantasma vs-aa ${desplegable === 'aa' ? 'abierto' : ''}`}
                  aria-haspopup="dialog"
                  aria-expanded={desplegable === 'aa'}
                  aria-label={tr('Ayudas de lectura')}
                  data-tip={tr('Ayudas de lectura')}
                  onClick={() => fijarDesplegable(desplegable === 'aa' ? null : 'aa')}
                >
                  Aa
                </button>
                {desplegable === 'aa' && <PanelAa e={estado} h={acciones} ancla={() => botonAa.current} alCerrar={() => fijarDesplegable(null)} />}
              </span>
            </div>
          </>
        )}
      </header>

      <div class="vs-cuerpo">
        {paginador && (
          <nav class="vs-carril" aria-label={tr('Paneles y herramientas')}>
            <div class="vs-carril-grupo" role="group" aria-label={tr('Navegar')}>
              {botonCarril('miniaturas', tr('Miniaturas'), panel === 'miniaturas', () => abrirPanel('miniaturas'))}
              {paginador.indice.length > 0 && botonCarril('indice', tr('Índice'), panel === 'indice', () => abrirPanel('indice'))}
              {botonCarril('nota', tr('Notas y marcadores'), panel === 'notas', () => abrirPanel('notas'))}
              {botonCarril('buscar', tr('Buscar en el libro'), panel === 'buscar', () => abrirPanel('buscar'), 'Ctrl+F')}
            </div>
            {!vistaTexto && (
              <div class="vs-carril-grupo" role="group" aria-label={tr('Herramientas')}>
                {botonCarril('cursor-texto', tr('Seleccionar'), herramienta === 'seleccionar', () => herramientaA('seleccionar'), 'V')}
                {botonCarril('mano', tr('Mano'), herramienta === 'mano', () => herramientaA(herramienta === 'mano' ? 'seleccionar' : 'mano'), 'H')}
                {botonCarril('area', tr('Leer una zona'), herramienta === 'area', () => herramientaA(herramienta === 'area' ? 'seleccionar' : 'area'), 'O')}
                {botonCarril('resaltar', tr('Resaltador'), herramienta === 'resaltador', () => herramientaA(herramienta === 'resaltador' ? 'seleccionar' : 'resaltador'), 'R')}
                {herramienta === 'resaltador' && (
                  <div class="vs-carril-colores" role="radiogroup" aria-label={tr('Color del resaltador')}>
                    {COLORES.map((c) => (
                      <button key={c} type="button" role="radio" aria-checked={colorResaltador === c} class={`vs-color ${c}`} aria-label={resaltarEn(c)} onClick={() => elegirColor(c)} />
                    ))}
                  </div>
                )}
                {botonCarril('nota-lapiz', tr('Añadir una nota'), herramienta === 'nota', () => herramientaA(herramienta === 'nota' ? 'seleccionar' : 'nota'), 'N')}
              </div>
            )}
          </nav>
        )}
        {paginador && panel && panel !== 'revision' && panel !== 'consultadas' && (
          <div class="vs-lateral" style={{ width: `${anchoPanel}px` }}>
            {panel === 'miniaturas' && (
              <aside class="vs-panel vs-panel-miniaturas" aria-label={tr('Miniaturas')}>
                {tituloPanel('miniaturas', tr('Miniaturas'))}
                <div class="vs-miniaturas">
                  {Array.from({ length: total }, (_, n) => (
                    <Miniatura key={n} paginador={paginador} n={n} actual={(lista[actual] ?? [pagina]).includes(n)} marcada={anotaciones.some((x) => x.tipo === 'marcador' && x.pagina === n)} alElegir={() => irA(n, true)} />
                  ))}
                </div>
              </aside>
            )}
            {panel === 'indice' && (
              <aside class="vs-panel vs-panel-indice" aria-label={tr('Índice')}>
                {tituloPanel('indice', tr('Índice'))}
                <ol class="vs-indice">
                  {paginador.indice.map((e, i) => (
                    <li key={i}>
                      <button class={e === capitulo ? 'actual' : ''} aria-current={e === capitulo ? 'true' : undefined} onClick={() => irA(e.pagina, true)}>
                        <span>{e.titulo}</span>
                        <span class="num">{e.pagina + 1}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </aside>
            )}
            {panel === 'notas' && (
              <PanelNotas titulo={doc.titulo} anotaciones={anotaciones} actual={lista[actual] ?? [pagina]} alIr={(n) => irA(n, true)} alGuardar={guardarAnotacion} alQuitar={quitarAnotacion} alCerrar={() => fijarPanel(null)} />
            )}
            {panel === 'buscar' && (
              <PanelBuscar
                paginas={buscable}
                total={total}
                hechas={corpus?.hechas ?? 0}
                consulta={consulta}
                alCambiarConsulta={fijarConsulta}
                sinEspacios={!lengua.value.escritura.palabrasSeparadas}
                ocrActivo={ocr}
                alElegir={elegirHallazgo}
                alCerrar={() => fijarPanel(null)}
              />
            )}
            <div class="vs-lateral-borde" role="separator" aria-orientation="vertical" aria-label={tr('Ancho del panel')} tabIndex={0} onPointerDown={ensanchar} onKeyDown={ensancharConTeclas} />
          </div>
        )}
        {nitidez.activa && !vistaTexto && <FiltroNitidez n={nitidez} escala={escala} />}
        <div class="vs-zona">
          <main
            ref={lienzo}
            class={`vs-lienzo ${invertir && !vistaTexto ? 'invertido' : ''} ${nitidez.activa && !vistaTexto ? 'con-nitidez' : ''} ${colocando ? 'colocando' : ''} ${herramienta === 'mano' ? 'mano' : ''} ${arrastrando ? 'arrastrando' : ''} ${vistaTexto ? 'vs-lienzo-texto' : ''}`}
            data-vista={vista}
            data-herramienta={herramienta}
            onClick={pulsarLienzo}
            onPointerDown={tocar}
            onPointerUp={soltar}
            onContextMenu={vistaTexto ? undefined : abrirContextual}
            onWheel={(e) => {
              if (!e.ctrlKey) return;
              e.preventDefault();
              zoomPaso(e.deltaY < 0);
            }}
          >
            {/* Si la página pedida tarda, una barra fina lo dice mientras se ve la de antes. */}
            {paginador && !vistaTexto && enPantalla !== pagina && <div class="vs-progreso" role="progressbar" aria-label={tr('Cargando…')} />}
            {contenido()}
          </main>
          {colocando && (
            <div class="vs-aviso-herramienta" role="status">
              <Icono n="nota-lapiz" t={14} /> {tr('Toca la página donde va la nota')}
            </div>
          )}
          {herramienta === 'area' && (
            <div class="vs-aviso-herramienta" role="status">
              <Icono n="area" t={14} /> {tr('Dibuja un rectángulo sobre lo que quieras leer')}
            </div>
          )}
          {zonaVacia && (
            <div class="vs-aviso-herramienta vs-aviso-zona" role="status">
              {tr('No hay texto en esa zona')}
            </div>
          )}
          {portadaHecha && (
            <div class="vs-aviso-herramienta vs-aviso-hecho" role="status">
              <Icono n="ok" t={14} /> {tr('Es la portada en la estantería')}
            </div>
          )}
          {vozAlta.voz && (
            <div class="vs-voz" role="group" aria-label={tr('Leer en voz alta')}>
              <Icono n="altavoz" t={15} />
              <span class="num">{tr('Frase {0} de {1}', vozAlta.voz.frase + 1, vozAlta.voz.total)}</span>
              {vozAlta.voz.pausada ? (
                <button type="button" class="btn-icono chico" aria-label={tr('Seguir')} data-tip={tr('Seguir')} onClick={vozAlta.seguir}>
                  <Icono n="reproducir" t={15} />
                </button>
              ) : (
                <button type="button" class="btn-icono chico" aria-label={tr('Pausa')} data-tip={tr('Pausa')} onClick={vozAlta.pausar}>
                  <Icono n="pausa" t={15} />
                </button>
              )}
              <button type="button" class="btn-icono chico" aria-label={tr('Parar')} data-tip={tr('Parar')} onClick={vozAlta.parar}>
                <Icono n="detener" t={15} />
              </button>
            </div>
          )}
          {lectura && (
            <div class="vs-aviso-herramienta vs-aviso-lectura" role="status">
              {tr('Modo lectura: M o Esc para salir')}
            </div>
          )}
          {/* Las flechas para pasar de página, a la vista y siempre en el mismo sitio. */}
          {paginador && !vistaTexto && vista !== 'continua' && total > 1 && (
            <>
              <button class="vs-flecha izquierda" aria-label={rtl ? tr('Página siguiente') : tr('Página anterior')} data-tip={rtl ? tr('Página siguiente') : tr('Página anterior')} onClick={haciaIzquierda}>
                <Icono n="izquierda" t={18} />
              </button>
              <button class="vs-flecha derecha" aria-label={rtl ? tr('Página anterior') : tr('Página siguiente')} data-tip={rtl ? tr('Página anterior') : tr('Página siguiente')} onClick={haciaDerecha}>
                <Icono n="derecha" t={18} />
              </button>
            </>
          )}
        </div>
        {paginador && panel === 'consultadas' && (
          <PanelConsultadas libro={doc.id} titulo={doc.titulo} paginador={paginador} ajustes={a} lista={consultadas} alCambiar={fijarConsultadas} alIr={(n) => irA(n, true)} alCerrar={() => fijarPanel(null)} />
        )}
        {paginador && panel === 'revision' && (
          <PanelRevision
            paginas={revisadas}
            revisar={revisarPagina}
            alAplicar={aplicarRevision}
            alVerLinea={(n, indice) => {
              if (!aLaVista.includes(n)) irA(n, true);
              if (vistaTexto) fijarVistaTexto(false);
              tocarTexto(n, { linea: indice, letra: 0 }, 2);
            }}
            alCerrar={() => fijarPanel(null)}
          />
        )}
        {!vistaTexto && unidad && lineasAbiertas && (
          <Ventana
            unidad={unidad}
            lineas={lineasAbiertas}
            ajustes={a}
            titulo={doc.titulo}
            fijada={fijada}
            alFijar={fijarVentana}
            alCerrar={cerrarVentana}
            alMarcar={fijarMarcaPalabra}
            resaltados={resaltadosEn(anotaciones, unidad.pagina, unidad.cajas)}
            alResaltar={resaltar}
            alGuardarAnotacion={guardarAnotacion}
            alQuitarAnotacion={quitarAnotacion}
            alEditar={async (i, texto) => {
              reabrir.current = { pagina: unidad.pagina, pos: { linea: i, letra: 0 }, veces: unidad.tipo === 'parrafo' ? 3 : 2 };
              await editar(unidad.pagina, lineasAbiertas[i], texto);
            }}
            alRestaurar={async (i) => {
              reabrir.current = { pagina: unidad.pagina, pos: { linea: i, letra: 0 }, veces: unidad.tipo === 'parrafo' ? 3 : 2 };
              await restaurar(lineasAbiertas[i]);
            }}
            alBuscar={(texto) => {
              fijarConsulta(texto);
              fijarPanel('buscar');
            }}
            alTraducir={pedirTraduccion}
            alConsultar={consultar}
          />
        )}
        <Creador ajustes={a} />
      </div>

      {paginador && (
        <footer class="vs-pie">
          {saltos.length > 0 && (
            <button type="button" class="btn chico fantasma vs-atras" data-tip={mostrarAtajo('Alt+ArrowLeft')} data-tip-lado="arriba" onClick={atras}>
              <Icono n="volver" t={14} /> {tr('Volver a la página {0}', saltos[saltos.length - 1] + 1)}
            </button>
          )}
          <span class="vs-donde num">{tr('Página {0} de {1}', indicador, total)}</span>
          {capitulo && (
            <span class="vs-capitulo" title={capitulo.titulo}>
              {capitulo.titulo}
            </span>
          )}
          {total > 1 ? (
            <input
              type="range"
              min={1}
              max={total}
              step={1}
              value={pagina + 1}
              dir={rtl ? 'rtl' : 'ltr'}
              aria-label={tr('Página')}
              onPointerDown={() => (desdeDeslizador.current = ahora.current)}
              onInput={(e) => irA(Number(e.currentTarget.value) - 1)}
              onChange={() => {
                // Arrastrar el deslizador es un salto: «Atrás» vuelve a donde se estaba antes de tomarlo.
                const desde = desdeDeslizador.current;
                desdeDeslizador.current = null;
                if (desde !== null && desde !== ahora.current) fijarSaltos((s) => [...s.slice(1 - SALTOS), desde]);
              }}
            />
          ) : (
            <span class="vs-pie-hueco" />
          )}
          <span class="vs-avance num" data-tip={tr('Lo que va del libro')} data-tip-lado="arriba">
            {avance} %
          </span>
          {comprension.total > 0 && (
            <span class="vs-comprension" data-tip={tr('{0} palabras a la vista; {1} nuevas', comprension.total, comprension.nuevas)} data-tip-lado="arriba">
              <Anillo valor={comprension.porcentaje} t={18} grosor={2.5} />
              <b class="num">{comprension.porcentaje} %</b> {tr('de comprensión')}
            </span>
          )}
          {consultadas.length > 0 && (
            <button type="button" class="btn chico fantasma vs-consultadas-boton" aria-pressed={panel === 'consultadas'} onClick={() => abrirPanel('consultadas')}>
              <Icono n="tarjetas" t={13} /> {tr('Consultadas')} <span class="vs-cuenta num">{consultadas.length}</span>
            </button>
          )}
          {textoActual ? (
            <span class="vs-origen" data-tip={textoActual.propias ? tr('El texto de esta página es el que trae el PDF') : tr('El texto de esta página lo leyó Kotonoha con el OCR')} data-tip-lado="arriba">
              {textoActual.propias ? tr('Texto del PDF') : `OCR · ${nombreModo}`}
            </span>
          ) : (
            !ocr &&
            !vistaTexto && (
              <button type="button" class="btn chico fantasma vs-origen vs-origen-leer" onClick={alternarOcr}>
                <Icono n="texto" t={13} /> {tr('Leer el texto de las páginas')}
              </button>
            )
          )}
          {((ocr && (descarga || leyendoVista || errorOcr)) || leyendoZona) && (
            <span class={`vs-estado ${errorOcr ? 'error' : ''}`} role="status">
              {errorOcr
                ? errorOcr
                : descarga
                  ? tr('Descargando el reconocimiento de texto: {0} %', Math.round((100 * descarga.cargado) / Math.max(1, descarga.total)))
                  : leyendoZona
                    ? tr('Leyendo la zona…')
                    : tr('Leyendo el texto de la página…')}
            </span>
          )}
        </footer>
      )}
      {dialogo === 'paleta' && <Paleta ordenes={ordenes} total={total} alIrA={(n) => irA(n, true)} alCerrar={() => fijarDialogo(null)} />}
      {dialogo === 'atajos' && <Atajos ordenes={ordenes} rtl={rtl} alCerrar={() => fijarDialogo(null)} />}
      {contextual && <MenuFlotante x={contextual.x} y={contextual.y} ordenes={ordenesContexto()} etiqueta={tr('Menú de la página')} alCerrar={() => fijarContextual(null)} />}
    </div>
  );
}
