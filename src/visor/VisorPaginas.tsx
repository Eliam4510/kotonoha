// El visor de un libro de páginas (EPUB de imágenes, CBZ o PDF), como un lector de PDF: zoom, páginas, doble página como
// un libro abierto, desplazamiento continuo, sentido de lectura, miniaturas e índice. Recuerda por dónde se va en cada
// libro. El texto de cada página sale del propio PDF si lo trae, o del OCR si se pide; tocar una palabra abre su ficha.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Creador } from '../app/Creador';
import { guardarPreferencia, leerPreferencia } from '../app/estadoApp';
import { Interruptor } from '../app/Piezas';
import type { Ajustes } from '../compartido/ajustes';
import { tm, tr } from '../compartido/i18n';
import { fondo, motor } from '../compartido/rpc';
import type { AnotacionLibro, ColorAnotacion, ElementoBiblioteca, Nitidez } from '../compartido/tipos';
import { resaltadoDeTramo, resaltadosEn } from '../nucleo/anotaciones';
import type { Hallazgo } from '../nucleo/busqueda';
import { cajaDeTramo, type LineaTexto, leerConOcr, textoDePagina } from '../nucleo/capaTexto';
import { aplicarEdiciones, type EdicionLinea, type LineaEditada } from '../nucleo/ediciones';
import { edicionesDe, guardarEdicion, lecturaMinima, quitarEdicion } from '../compartido/paginasOcr';
import type { Direccion } from '../nucleo/libro';
import type { Caja } from '../nucleo/ocr';
import { escalaDe, type Medida, pasoDeZoom, pliegoDe, pliegos } from '../nucleo/paginas';
import { cambiosValidos } from '../nucleo/revision';
import { cajasDe, contextoDe, fraseEn, leerPagina, type PaginaLeida, parrafoEn, type Posicion, posicionEn, seleccionEn, type TramoPagina, tramoEntre, type Unidad } from '../nucleo/seleccion';
import { Icono } from '../ui/iconos';
import { lengua } from '../ui/lengua';
import { NotasDePagina, PanelNotas, Resaltados } from './Anotaciones';
import { Abriendo, AvisoError, Boton, Cabeza, usePantallaCompleta } from './comun';
import { imagenParaClaude } from './imagenClaude';
import { type Descarga, esCancelada, LectorOcr, type ModoOcr } from './ocr';
import { imagenParaOcr, miniaturaDe, type PaginaImagen, type Paginador, paginadorDeZip } from './paginador';
import { PanelBuscar } from './PanelBuscar';
import { PanelRevision, type PropuestaLinea } from './PanelRevision';
import { paginadorDePdf } from './pdf';
import { leerTextoLibro, type TextoDePagina } from './textoLibro';
import { type TipoUnidad, type UnidadAbierta, Ventana } from './Ventana';
import { VistaTexto } from './VistaTexto';

type Vista = 'una' | 'doble' | 'continua';
type Zoom = 'ancho' | 'pagina' | number;

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

// ---------- Nitidez ----------

const NIVELES_NITIDEZ: [Nitidez['nivel'], string][] = [
  [1, tm('Suave')],
  [2, tm('Media')],
  [3, tm('Fuerte')],
];
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
function Pagina({ paginador, n, escala, alCargar, lineas, porPalabra, unidad, seleccion, marcas, hallado, alTocar, alSeleccionar, anotaciones, notaAbierta, alAbrirNota, alGuardarAnotacion, alQuitarAnotacion }: {
  paginador: Paginador;
  n: number;
  escala: number;
  alCargar?: () => void;
  lineas?: LineaTexto[];
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
    if (!g || g.id !== e.pointerId || !g.desde || !g.raton || !porPalabra || !lineas) return;
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
    // Deslizar el dedo pasa de página: eso no es un toque.
    if (!g.desde || Math.hypot(e.clientX - g.x, e.clientY - g.y) > 10) return;
    // Los toques seguidos en el mismo sitio cuentan como el doble y el triple clic.
    const ahora = performance.now();
    const previo = toques.current;
    const seguido = ahora - previo.t < 450 && Math.hypot(e.clientX - previo.x, e.clientY - previo.y) < 8;
    const veces = seguido ? Math.min(3, previo.veces + 1) : 1;
    toques.current = { t: ahora, x: e.clientX, y: e.clientY, veces };
    atendido.current = true;
    alTocar?.(g.desde, veces);
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
  const [panel, fijarPanel] = useState<'miniaturas' | 'indice' | 'notas' | 'buscar' | 'revision' | null>(null);
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
  // Lo anotado en el libro: marcadores, resaltados y notas. Al añadir una nota, el siguiente toque en una página la pone ahí.
  const [anotaciones, fijarAnotaciones] = useState<AnotacionLibro[]>([]);
  const [colocando, fijarColocando] = useState(false);
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
  const irA = (n: number) => {
    if (!total) return;
    const m = Math.max(0, Math.min(total - 1, n));
    ahora.current = m;
    desdeDesplazamiento.current = false;
    fijarPagina(m);
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

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (!paginador) return;
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'f' || e.key === 'F')) {
        // Como en un lector de PDF: buscar en el libro, que el buscador del navegador no ve el texto de las páginas.
        e.preventDefault();
        if (panel === 'buscar') document.querySelector<HTMLInputElement>('.vs-panel-buscar input')?.select();
        else fijarPanel('buscar');
        return;
      }
      if ((e.target as HTMLElement | null)?.closest?.('input, textarea, select')) return;
      if (e.ctrlKey || e.metaKey) {
        // Copiar lo abierto en la ventana, si no hay otra cosa seleccionada.
        if ((e.key === 'c' || e.key === 'C') && unidad && window.getSelection()?.isCollapsed !== false) {
          navigator.clipboard.writeText(unidad.texto).catch(console.error);
          e.preventDefault();
          return;
        }
        // Como en un lector de PDF: el zoom del libro, no el de la pestaña.
        if (e.key === '+' || e.key === '=') zoomPaso(true);
        else if (e.key === '-') zoomPaso(false);
        else if (e.key === '0') fijarZoom('pagina');
        else return;
        e.preventDefault();
        return;
      }
      if (e.altKey) return;
      if (e.key === 'Escape' && colocando) {
        fijarColocando(false);
        e.preventDefault();
        return;
      }
      if (e.key === 'Escape' && (unidad || seleccion)) {
        cerrarVentana();
        e.preventDefault();
        return;
      }
      // En la vista de texto se pasa de página igual en todas las vistas: el texto no se desplaza de página en página.
      const continua = vista === 'continua' && !vistaTexto;
      if (e.key === 'ArrowLeft' && !continua) haciaIzquierda();
      else if (e.key === 'ArrowRight' && !continua) haciaDerecha();
      else if (e.key === 'PageDown' || (e.key === ' ' && !continua && !e.shiftKey)) siguiente();
      else if (e.key === 'PageUp' || (e.key === ' ' && !continua && e.shiftKey)) anterior();
      else if (e.key === 'Home') irA(0);
      else if (e.key === 'End') irA(total - 1);
      else if (e.key === 'f' || e.key === 'F') pantallaCompleta();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  });

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
    cerrarSiCambia(textoPdf);
  }, [modoOcr]);
  useEffect(() => {
    if (!ocr || !paginador) return;
    const l = (lector.current ??= new LectorOcr((d) => fijarDescarga(d.cargado >= d.total ? null : d)));
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

  /** Las líneas de una página: las del propio PDF si las trae y se usan; si no, las del OCR, si está activo. Con lo editado encima. */
  const textoDe = (n: number): { lineas: LineaEditada[]; propias: boolean } | undefined => {
    const t = textoDePagina(propias.get(n), lineas.get(n), { ocrActivo: ocr, textoPdf });
    const suyas = t ? ediciones.filter((e) => e.pagina === n) : [];
    return t && suyas.length ? { ...t, lineas: aplicarEdiciones(t.lineas, suyas) } : t;
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
  const leidaDe = (n: number): PaginaLeida | null => {
    const t = textoDe(n);
    return t ? leerPagina(t.lineas, { globos: !t.propias && modoOcr === 'manga', marca: lengua.value.escritura.marcaDeLista }) : null;
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
    };
  };

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
  /** Resalta o subraya lo abierto en la ventana, aunque ocupe varios renglones, o solo un trozo de su texto. */
  const resaltar = (estilo: 'fondo' | 'subrayado', color: ColorAnotacion, trozo: { inicio: number; fin: number } | null): AnotacionLibro | null => {
    if (!unidad || !lineasAbiertas) return null;
    const sitios = trozo ? unidad.sitios.slice(trozo.inicio, trozo.fin) : unidad.sitios;
    const desde = sitios[0];
    const ultimo = sitios[sitios.length - 1];
    if (!desde || !ultimo) return null;
    const a = resaltadoDeTramo({
      libro: doc.id,
      pagina: unidad.pagina,
      lineas: lineasAbiertas,
      tramo: trozo ? tramoEntre(lineasAbiertas, desde, ultimo) : unidad.tramo,
      texto: trozo ? unidad.texto.slice(trozo.inicio, trozo.fin) : unidad.texto,
      porLetra: unidad.porLetra,
      estilo,
      color,
    });
    // Lo mismo resaltado otra vez cambia de color o de estilo: no se amontonan resaltados iguales uno encima de otro.
    const igual = anotaciones.find((x) => x.tipo === 'resaltado' && x.pagina === a.pagina && x.texto === a.texto && mismasCajas(x.cajas, a.cajas));
    const guardado = igual ? { ...igual, estilo, color } : a;
    guardarAnotacion(guardado);
    return guardado;
  };

  /** Con «Añadir una nota», un toque en una página pone ahí la nota y la abre para escribirla. */
  const ponerNota = (e: MouseEvent) => {
    const hoja = (e.target as HTMLElement | null)?.closest<HTMLElement>('.vs-pagina');
    fijarColocando(false);
    if (!hoja?.dataset.pagina) return;
    const r = hoja.getBoundingClientRect();
    const dentro = (v: number) => Math.min(0.97, Math.max(0, v));
    const a: AnotacionLibro = { id: crypto.randomUUID(), libro: doc.id, tipo: 'nota', pagina: Number(hoja.dataset.pagina) - 1, punto: { x: dentro((e.clientX - r.left) / r.width), y: dentro((e.clientY - r.top) / r.height) }, creada: Date.now() };
    guardarAnotacion(a);
    fijarNotaAbierta(a.id);
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
    if (!(lista[actual] ?? []).includes(h.pagina) || vista === 'continua') irA(h.pagina);
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

  // Deslizar con el dedo, en una pantalla táctil.
  const inicioToque = useRef<{ x: number; y: number } | null>(null);
  const tocar = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') inicioToque.current = { x: e.clientX, y: e.clientY };
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
              <Pagina key={n} paginador={paginador} n={n} escala={e} alCargar={() => refrescar((x) => x + 1)} hallado={halladoEn(n)} {...propsTexto(n)} {...propsAnotaciones(n)} />
            ) : (
              <div key={n} class="vs-pagina vs-reservada" data-pagina={n + 1} style={{ width: `${Math.round(t.ancho * e)}px`, height: `${Math.round(t.alto * e)}px` }} />
            );
          })}
        </div>
      );
    return (
      <div class={`vs-pliego ${rtl ? 'rtl' : ''}`}>
        {(lista[actualVisible] ?? []).map((n) => (
          <Pagina key={n} paginador={paginador} n={n} escala={escala} alCargar={() => refrescar((x) => x + 1)} hallado={halladoEn(n)} {...propsTexto(n)} {...propsAnotaciones(n)} />
        ))}
      </div>
    );
  };

  return (
    <>
      <header class="vs-barra">
        <Cabeza titulo={doc.titulo} />
        {paginador && (
          <>
            <div class="vs-grupo" role="group" aria-label={tr('Páginas')}>
              {/* Los iconos apuntan a donde va la hoja en la pantalla; lo que cambia con el sentido es a qué página lleva. */}
              <Boton icono="primera" etiqueta={rtl ? tr('Última página') : tr('Primera página')} alPulsar={() => (rtl ? irA(total - 1) : irA(0))} />
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
                      if (n > 0) irA(n - 1);
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
              <Boton icono="ultima" etiqueta={rtl ? tr('Primera página') : tr('Última página')} alPulsar={() => (rtl ? irA(0) : irA(total - 1))} />
            </div>
            {!vistaTexto && (
              <div class="vs-grupo" role="group" aria-label={tr('Zoom')}>
                <Boton icono="alejar" etiqueta={tr('Alejar')} alPulsar={() => zoomPaso(false)} />
                <button class="btn chico fantasma vs-zoom num" data-tip={tr('Página completa')} onClick={() => fijarZoom('pagina')}>{porcentaje} %</button>
                <Boton icono="acercar" etiqueta={tr('Acercar')} alPulsar={() => zoomPaso(true)} />
                <Boton icono="ajustar-ancho" etiqueta={tr('Ajustar al ancho')} activo={zoom === 'ancho'} alPulsar={() => fijarZoom('ancho')} />
                <Boton icono="ajustar-pagina" etiqueta={tr('Página completa')} activo={zoom === 'pagina'} alPulsar={() => fijarZoom('pagina')} />
              </div>
            )}
            <div class="vs-grupo" role="group" aria-label={tr('Vista')}>
              <Boton icono="una-pagina" etiqueta={tr('Una página')} activo={vista === 'una'} alPulsar={() => fijarVista('una')} />
              <Boton icono="doble-pagina" etiqueta={tr('Doble página')} activo={vista === 'doble'} alPulsar={() => fijarVista('doble')} />
              <Boton icono="continua" etiqueta={tr('Desplazamiento continuo')} activo={vista === 'continua'} alPulsar={() => fijarVista('continua')} />
            </div>
            <div class="vs-grupo" role="group" aria-label={tr('Texto de la página')}>
              <Boton
                icono="texto"
                etiqueta={tr('Leer el texto de las páginas')}
                activo={ocr}
                alPulsar={() => {
                  fijarErrorOcr('');
                  cerrarSiCambia(textoPdf);
                  fijarOcr(!ocr);
                }}
              />
              {ocr && (
                <span class="vs-modos">
                  {hayTextoPropio && (
                    <button
                      class="btn chico fantasma"
                      aria-pressed={textoPdf}
                      data-tip={tr('El texto que trae el PDF; apagado, Kotonoha lee todas las páginas')}
                      onClick={() => {
                        // Cambia de dónde sale el texto de las páginas que traen el suyo: lo abierto en una de ellas se cierra.
                        fijarUnidad((x) => (x && !propias.get(x.pagina) ? x : null));
                        fijarTextoPdf(!textoPdf);
                      }}
                    >
                      {tr('Texto del PDF')}
                    </button>
                  )}
                  <button class="btn chico fantasma" aria-pressed={modoOcr === 'libro'} data-tip={tr('Para libros impresos')} onClick={() => fijarModoOcr('libro')}>{tr('Libro')}</button>
                  {lengua.value.escritura.globos === 'lector' ? (
                    <button class="btn chico fantasma" aria-pressed={modoOcr === 'manga'} data-tip={tr('Para cómics: lee los globos de izquierda a derecha')} onClick={() => fijarModoOcr('manga')}>{tr('Cómic')}</button>
                  ) : (
                    <button class="btn chico fantasma" aria-pressed={modoOcr === 'manga'} data-tip={tr('Para manga: globos y texto vertical')} onClick={() => fijarModoOcr('manga')}>{tr('Manga')}</button>
                  )}
                </span>
              )}
              <Boton
                icono="lector"
                etiqueta={vistaTexto ? tr('Ver las páginas') : tr('Ver como texto')}
                activo={vistaTexto}
                alPulsar={() => {
                  // Para leer como texto hace falta el texto: si la página no lo trae, lo lee el OCR.
                  if (!vistaTexto && !ocr) {
                    fijarErrorOcr('');
                    fijarOcr(true);
                  }
                  cerrarVentana();
                  fijarColocando(false);
                  fijarVistaTexto(!vistaTexto);
                }}
              />
              <Boton
                icono="ia"
                etiqueta={conTexto.length ? tr('Revisar el texto con Claude') : tr('Revisar el texto con Claude: la página aún no tiene texto')}
                activo={panel === 'revision'}
                deshabilitado={!conTexto.length}
                alPulsar={() => {
                  fijarRevisadas((r) => [...conTexto.filter((n) => !r.includes(n)), ...r]);
                  fijarPanel('revision');
                }}
              />
            </div>
            <div class="vs-grupo" role="group" aria-label={tr('Anotaciones')}>
              <Boton icono="marcador" etiqueta={marcador ? tr('Quitar el marcador de esta página') : tr('Marcar esta página')} activo={!!marcador} alPulsar={alternarMarcador} />
              {!vistaTexto && <Boton icono="nota-lapiz" etiqueta={colocando ? tr('Toca la página donde va la nota') : tr('Añadir una nota')} activo={colocando} alPulsar={() => fijarColocando(!colocando)} />}
              <Boton icono="nota" etiqueta={tr('Notas y marcadores')} activo={panel === 'notas'} alPulsar={() => fijarPanel(panel === 'notas' ? null : 'notas')} />
            </div>
            <div class="vs-grupo">
              <Boton
                icono="sentido"
                etiqueta={rtl ? tr('Se lee de derecha a izquierda') : tr('Se lee de izquierda a derecha')}
                activo={rtl}
                alPulsar={() => fijarDireccion(rtl ? 'ltr' : 'rtl')}
              />
              <Boton icono="buscar" etiqueta={tr('Buscar en el libro')} activo={panel === 'buscar'} alPulsar={() => fijarPanel(panel === 'buscar' ? null : 'buscar')} />
              <Boton icono="palabras" etiqueta={tr('Vocabulario del libro')} alPulsar={() => fondo.abrirApp(`vocabulario?libro=${encodeURIComponent(doc.id)}`).catch(console.error)} />
              <Boton icono="exportar" etiqueta={tr('Exportar PDF con texto')} alPulsar={() => fondo.abrirApp(`biblioteca?exportar=${encodeURIComponent(doc.id)}`).catch(console.error)} />
              <Boton icono="miniaturas" etiqueta={tr('Miniaturas')} activo={panel === 'miniaturas'} alPulsar={() => fijarPanel(panel === 'miniaturas' ? null : 'miniaturas')} />
              {paginador.indice.length > 0 && <Boton icono="indice" etiqueta={tr('Índice')} activo={panel === 'indice'} alPulsar={() => fijarPanel(panel === 'indice' ? null : 'indice')} />}
              <Boton
                icono={portadaHecha ? 'ok' : 'imagen'}
                etiqueta={portadaHecha ? tr('Es la portada en la estantería') : tr('Usar esta página como portada')}
                alPulsar={() => usarComoPortada().catch(console.error)}
              />
              {!vistaTexto && (
                <Boton
                  icono="nitidez"
                  etiqueta={tr('Nitidez: enfoca las páginas de un escaneo con poca resolución')}
                  activo={nitidez.activa}
                  alPulsar={() => fijarNitidez((x) => ({ ...x, activa: !x.activa }))}
                />
              )}
              {nitidez.activa && !vistaTexto && (
                <span class="vs-modos" role="group" aria-label={tr('Nitidez')}>
                  {NIVELES_NITIDEZ.map(([nivel, nombre]) => (
                    <button key={nivel} class="btn chico fantasma" aria-pressed={nitidez.nivel === nivel} onClick={() => fijarNitidez((x) => ({ ...x, nivel }))}>{tr(nombre)}</button>
                  ))}
                  <button class="btn chico fantasma" aria-pressed={nitidez.limpiar} data-tip={tr('El papel más blanco y el texto más negro, para escaneos en blanco y negro')} onClick={() => fijarNitidez((x) => ({ ...x, limpiar: !x.limpiar }))}>
                    {tr('Fondo blanco')}
                  </button>
                </span>
              )}
              <Boton
                icono="invertir"
                etiqueta={tr('Invertir colores')}
                activo={invertir}
                alPulsar={() => {
                  guardarPreferencia('visorInvertir', !invertir);
                  fijarInvertir(!invertir);
                }}
              />
              <Boton icono={lleno ? 'salir-pantalla' : 'pantalla-completa'} etiqueta={lleno ? tr('Salir de la pantalla completa') : tr('Pantalla completa')} alPulsar={pantallaCompleta} />
            </div>
          </>
        )}
      </header>

      <div class="vs-cuerpo">
        {paginador && panel === 'miniaturas' && (
          <aside class="vs-panel" aria-label={tr('Miniaturas')}>
            <div class="vs-miniaturas">
              {Array.from({ length: total }, (_, n) => (
                <Miniatura key={n} paginador={paginador} n={n} actual={(lista[actual] ?? [pagina]).includes(n)} marcada={anotaciones.some((a) => a.tipo === 'marcador' && a.pagina === n)} alElegir={() => irA(n)} />
              ))}
            </div>
          </aside>
        )}
        {paginador && panel === 'indice' && (
          <aside class="vs-panel" aria-label={tr('Índice')}>
            <ol class="vs-indice">
              {paginador.indice.map((e, i) => (
                <li key={i}>
                  <button class={e === capitulo ? 'actual' : ''} aria-current={e === capitulo ? 'true' : undefined} onClick={() => irA(e.pagina)}>
                    <span>{e.titulo}</span>
                    <span class="num">{e.pagina + 1}</span>
                  </button>
                </li>
              ))}
            </ol>
          </aside>
        )}
        {paginador && panel === 'notas' && (
          <PanelNotas titulo={doc.titulo} anotaciones={anotaciones} actual={lista[actual] ?? [pagina]} alIr={irA} alGuardar={guardarAnotacion} alQuitar={quitarAnotacion} />
        )}
        {paginador && panel === 'buscar' && (
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
        {paginador && panel === 'revision' && (
          <PanelRevision
            paginas={revisadas}
            revisar={revisarPagina}
            alAplicar={aplicarRevision}
            alVerLinea={(n, indice) => {
              if (!aLaVista.includes(n)) irA(n);
              if (vistaTexto) fijarVistaTexto(false);
              tocarTexto(n, { linea: indice, letra: 0 }, 2);
            }}
            alCerrar={() => fijarPanel(null)}
          />
        )}
        {nitidez.activa && !vistaTexto && <FiltroNitidez n={nitidez} escala={escala} />}
        <div class="vs-zona">
        <main
          ref={lienzo}
          class={`vs-lienzo ${invertir && !vistaTexto ? 'invertido' : ''} ${nitidez.activa && !vistaTexto ? 'con-nitidez' : ''} ${colocando ? 'colocando' : ''} ${vistaTexto ? 'vs-lienzo-texto' : ''}`}
          data-vista={vista}
          onClick={pulsarLienzo}
          onPointerDown={tocar}
          onPointerUp={soltar}
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
          />
        )}
        <Creador ajustes={a} />
      </div>

      {paginador && total > 1 && (
        <footer class="vs-pie">
          <input type="range" min={1} max={total} step={1} value={pagina + 1} dir={rtl ? 'rtl' : 'ltr'} aria-label={tr('Página')} onInput={(e) => irA(Number(e.currentTarget.value) - 1)} />
          {capitulo && <span class="vs-capitulo" title={capitulo.titulo}>{capitulo.titulo}</span>}
          {ocr && (descarga || leyendoVista || errorOcr) && (
            <span class={`vs-estado ${errorOcr ? 'error' : ''}`} role="status">
              {errorOcr
                ? errorOcr
                : descarga
                  ? tr('Descargando el reconocimiento de texto: {0} %', Math.round((100 * descarga.cargado) / Math.max(1, descarga.total)))
                  : tr('Leyendo el texto de la página…')}
            </span>
          )}
          {vista === 'doble' && (
            <label class="vs-portada">
              <span>{tr('Portada sola')}</span>
              <Interruptor etiqueta={tr('Portada sola')} on={portadaSola} alCambiar={fijarPortadaSola} />
            </label>
          )}
        </footer>
      )}
    </>
  );
}
