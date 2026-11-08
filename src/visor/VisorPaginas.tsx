// El visor de un libro de páginas (EPUB de imágenes, CBZ o PDF), como un lector de PDF: zoom, páginas, doble página como
// un libro abierto, desplazamiento continuo, sentido de lectura, miniaturas e índice. Recuerda por dónde se va en cada
// libro. El texto de cada página sale del propio PDF si lo trae, o del OCR si se pide; tocar una palabra abre su ficha.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Creador } from '../app/Creador';
import { guardarPreferencia, leerPreferencia } from '../app/estadoApp';
import { Interruptor } from '../app/Piezas';
import type { Ajustes } from '../compartido/ajustes';
import { tr } from '../compartido/i18n';
import { motor } from '../compartido/rpc';
import type { ElementoBiblioteca } from '../compartido/tipos';
import { cajaDeTramo, caracterEn, type LineaTexto, leerConOcr, textoDePagina } from '../nucleo/capaTexto';
import type { Direccion } from '../nucleo/libro';
import type { Caja } from '../nucleo/ocr';
import { escalaDe, type Medida, pasoDeZoom, pliegoDe, pliegos } from '../nucleo/paginas';
import { Abriendo, AvisoError, Boton, Cabeza, usePantallaCompleta } from './comun';
import { type Descarga, LectorOcr, type ModoOcr } from './ocr';
import { miniaturaDe, type PaginaImagen, type Paginador, paginadorDeZip } from './paginador';
import { PanelLinea } from './PanelLinea';
import { paginadorDePdf } from './pdf';

type Vista = 'una' | 'doble' | 'continua';
type Zoom = 'ancho' | 'pagina' | number;

/** El tamaño que se supone a una página que aún no se ha leído: el de un tomo de manga. */
const PAGINA_SUPUESTA: Medida = { ancho: 844, alto: 1200 };
/** El margen del lienzo alrededor de las páginas. */
const MARGEN = 16;
/** Cuántas páginas antes y después de las visibles se pintan en el desplazamiento continuo. */
const ALREDEDOR = 2;

const porciento = (c: Caja) => ({ left: `${c.x0 * 100}%`, top: `${c.y0 * 100}%`, width: `${(c.x1 - c.x0) * 100}%`, height: `${(c.y1 - c.y0) * 100}%` });

/**
 * Una página pintada a su escala. Mientras llega la imagen, ocupa ya su sitio para que nada salte. Con su texto, encima
 * van sus líneas: zonas que se pueden tocar, con el texto para los lectores de pantalla, y la palabra elegida marcada.
 */
function Pagina({ paginador, n, escala, alCargar, lineas, porPalabra, elegida, marca, alTocar }: {
  paginador: Paginador;
  n: number;
  escala: number;
  alCargar?: () => void;
  lineas?: LineaTexto[];
  /** Si se sabe dónde va cada letra de la línea: entonces tocar una palabra la elige. En un globo de manga, no. */
  porPalabra?: boolean;
  elegida?: number;
  marca?: Caja;
  alTocar?: (indice: number, caracter?: number) => void;
}) {
  const [imagen, fijarImagen] = useState<PaginaImagen | null>(null);
  const [fallo, fijarFallo] = useState('');
  useEffect(() => {
    let vivo = true;
    fijarImagen(null);
    paginador
      .imagen(n)
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
  return (
    <div class="vs-pagina" data-pagina={n + 1} style={{ width: `${Math.round(t.ancho * escala)}px`, height: `${Math.round(t.alto * escala)}px` }}>
      {imagen ? <img src={imagen.url} alt={tr('Página {0}', n + 1)} draggable={false} /> : fallo ? <span class="vs-fallo">{fallo}</span> : <span class="vs-cargando" />}
      {imagen && lineas && (
        <div class="vs-texto">
          {lineas.map((l, i) => (
            <button
              key={i}
              class={`vs-linea ${elegida === i ? 'elegida' : ''}`}
              style={porciento(l.caja)}
              aria-label={l.texto}
              onClick={(e) => {
                e.stopPropagation();
                // Con el ratón o el dedo se sabe dónde se tocó; con el teclado, se abre la línea entera.
                let caracter: number | undefined;
                const capa = e.currentTarget.parentElement?.getBoundingClientRect();
                if (porPalabra && e.detail > 0 && capa?.width) caracter = caracterEn(l, (e.clientX - capa.left) / capa.width, (e.clientY - capa.top) / capa.height);
                alTocar?.(i, caracter);
              }}
            />
          ))}
          {marca && <span class="vs-marca" style={porciento(marca)} />}
        </div>
      )}
    </div>
  );
}

function Miniatura({ paginador, n, actual, alElegir }: { paginador: Paginador; n: number; actual: boolean; alElegir: () => void }) {
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
      <span class="vs-miniatura-hoja" style={{ aspectRatio: `${t.ancho} / ${t.alto}` }}>{url && <img src={url} alt="" draggable={false} />}</span>
      <span class="num">{n + 1}</span>
    </button>
  );
}

/** La palabra elegida en el panel de una línea, para marcarla en la página. */
interface Marca {
  pagina: number;
  indice: number;
  inicio: number;
  fin: number;
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
  const [panel, fijarPanel] = useState<'miniaturas' | 'indice' | null>(null);
  const [invertir, fijarInvertir] = useState(() => leerPreferencia('visorInvertir', false));
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
  const [leyendo, fijarLeyendo] = useState(0);
  const [descarga, fijarDescarga] = useState<Descarga | null>(null);
  const [errorOcr, fijarErrorOcr] = useState('');
  const [abierta, fijarAbierta] = useState<{ pagina: number; indice: number; caracter?: number } | null>(null);
  const [marca, fijarMarca] = useState<Marca | null>(null);
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
      // Un manga se lee con los modelos de manga; lo demás, con los de libro impreso.
      fijarOcr(d.ocr?.activo ?? false);
      fijarModoOcr(d.ocr?.modo ?? ((d.direccion ?? p.direccion) === 'rtl' ? 'manga' : 'libro'));
      fijarTextoPdf(d.ocr?.textoPdf ?? true);
      // Un PDF no tiene portada hasta que se abre: se hace ahora con su primera página, para la estantería.
      if (!d.portada) {
        p.imagen(0)
          .then(async (primera) => {
            const portada = await miniaturaDe(await (await fetch(primera.url)).blob());
            if (vivo) fijarDoc((x) => (x.documento ? { ...x, documento: { ...x.documento, portada } } : x));
          })
          .catch(() => {});
      }
    })().catch((err) => vivo && fijarError(err instanceof Error ? err.message : String(err)));
    return () => {
      vivo = false;
      abierto?.cerrar();
      lector.current?.cerrar();
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
  const medida = (n: number) => paginador?.tamano(n) ?? PAGINA_SUPUESTA;
  const escala = paginador ? escalaDe((lista[actual] ?? [pagina]).map(medida), hueco, zoom) : 1;
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

  // Recuerda por dónde se va y cómo se lee cada libro.
  useEffect(() => {
    if (!doc.documento || !paginador) return;
    const t = setTimeout(() => {
      motor
        .bibliotecaGuardar({ ...doc, pagina, abierto: Date.now(), documento: { ...doc.documento!, paginas: paginador.total, vista, direccion, portadaSola, ...(anchas ? { anchas } : {}), zoom, ocr: { activo: ocr, modo: modoOcr, ...(textoPdf ? {} : { textoPdf }) } } })
        .catch(console.error);
    }, 600);
    return () => clearTimeout(t);
  }, [doc, paginador, pagina, vista, direccion, portadaSola, anchas, zoom, ocr, modoOcr, textoPdf]);

  // Al pasar de página se vuelve arriba; en el desplazamiento continuo, se lleva la página a la vista.
  useEffect(() => {
    const el = lienzo.current;
    if (!el || !paginador) return;
    if (vista !== 'continua') {
      el.scrollTo({ top: 0, left: rtl ? el.scrollWidth : 0 });
      // Las siguientes ya se van leyendo, para pasar de página sin esperas.
      for (const n of lista[actual + 1] ?? []) paginador.imagen(n).catch(() => {});
    } else if (!desdeDesplazamiento.current) el.querySelector(`[data-pagina="${pagina + 1}"]`)?.scrollIntoView({ block: 'start' });
    desdeDesplazamiento.current = false;
  }, [pagina, vista, paginador]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (!paginador) return;
      if ((e.target as HTMLElement | null)?.closest?.('input, textarea, select')) return;
      if (e.ctrlKey || e.metaKey) {
        // Como en un lector de PDF: el zoom del libro, no el de la pestaña.
        if (e.key === '+' || e.key === '=') zoomPaso(true);
        else if (e.key === '-') zoomPaso(false);
        else if (e.key === '0') fijarZoom('pagina');
        else return;
        e.preventDefault();
        return;
      }
      if (e.altKey) return;
      const continua = vista === 'continua';
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

  const aLaVista = vista === 'continua' ? Array.from({ length: Math.max(0, cerca[1] - cerca[0] + 1) }, (_, i) => cerca[0] + i) : (lista[actual] ?? []);
  const cercanas = [...aLaVista, ...(vista === 'continua' ? [] : (lista[actual + 1] ?? []))];

  // El texto del propio PDF: de las páginas a la vista y las del pliego siguiente. No cuesta nada y no hace falta pedirlo.
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

  // Con el OCR activo se leen las páginas a la vista y las del pliego siguiente, para pasar de página con el texto listo. En
  // un PDF, solo las que no traen su texto, y después de mirarlo; o todas, si se ha quitado «Texto del PDF».
  const porLeer = cercanas.filter((n) => !lineas.has(n) && (!paginador?.textoPropio || leerConOcr(propias.get(n), textoPdf)));
  // Si alguna página del PDF trae su propio texto: entonces se puede elegir entre ese texto y el OCR.
  const hayTextoPropio = [...propias.values()].some((l) => !!l?.length);
  // Al cambiar de dónde sale el texto, la línea abierta solo sigue si es del texto del PDF y ese texto se sigue usando.
  const cerrarSiCambia = (usaPdf: boolean) => fijarAbierta((x) => (x && usaPdf && propias.get(x.pagina) ? x : null));
  useEffect(() => {
    fijarLineas(new Map());
    cerrarSiCambia(textoPdf);
  }, [modoOcr]);
  useEffect(() => {
    if (!ocr || !paginador || !porLeer.length) return;
    lector.current ??= new LectorOcr((d) => fijarDescarga(d.cargado >= d.total ? null : d));
    let vivo = true;
    for (const n of porLeer) {
      fijarLeyendo((x) => x + 1);
      lector.current
        .leer(doc.id, n, modoOcr, async () => (await fetch((await paginador.imagen(n)).url)).blob())
        .then((l) => {
          if (vivo) fijarLineas((m) => new Map(m).set(n, l));
        })
        .catch((e) => vivo && fijarErrorOcr(e instanceof Error ? e.message : String(e)))
        .finally(() => fijarLeyendo((x) => Math.max(0, x - 1)));
    }
    return () => {
      vivo = false;
    };
  }, [ocr, modoOcr, paginador, doc.id, porLeer.join(',')]);

  /** Las líneas de una página: las del propio PDF si las trae y se usan; si no, las del OCR, si está activo. */
  const textoDe = (n: number): { lineas: LineaTexto[]; propias: boolean } | undefined => textoDePagina(propias.get(n), lineas.get(n), { ocrActivo: ocr, textoPdf });
  const lineasAbiertas = abierta ? textoDe(abierta.pagina)?.lineas : undefined;
  const moverLinea = (paso: number) => {
    if (!abierta || !lineasAbiertas) return;
    fijarAbierta({ pagina: abierta.pagina, indice: Math.max(0, Math.min(lineasAbiertas.length - 1, abierta.indice + paso)) });
  };
  const propsTexto = (n: number) => {
    const t = textoDe(n);
    if (!t) return {};
    const m = marca && marca.pagina === n ? t.lineas[marca.indice] : undefined;
    return {
      lineas: t.lineas,
      porPalabra: t.propias || modoOcr === 'libro',
      elegida: abierta?.pagina === n ? abierta.indice : undefined,
      marca: m && marca ? cajaDeTramo(m, marca.inicio, marca.fin) : undefined,
      alTocar: (i: number, caracter?: number) => fijarAbierta({ pagina: n, indice: i, caracter }),
    };
  };
  useEffect(() => {
    if (!abierta) fijarMarca(null);
  }, [abierta]);

  const pulsarLienzo = (e: MouseEvent) => {
    if (vista === 'continua' || !lienzo.current) return;
    const r = lienzo.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    if (x < 0.3) haciaIzquierda();
    else if (x > 0.7) haciaDerecha();
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
    if (vista === 'continua')
      return (
        <div class="vs-continua">
          {Array.from({ length: total }, (_, n) => {
            const e = escalaDe([medida(n)], hueco, zoom);
            const t = medida(n);
            return n >= cerca[0] && n <= cerca[1] ? (
              <Pagina key={n} paginador={paginador} n={n} escala={e} alCargar={() => refrescar((x) => x + 1)} {...propsTexto(n)} />
            ) : (
              <div key={n} class="vs-pagina vs-reservada" data-pagina={n + 1} style={{ width: `${Math.round(t.ancho * e)}px`, height: `${Math.round(t.alto * e)}px` }} />
            );
          })}
        </div>
      );
    return (
      <div class={`vs-pliego ${rtl ? 'rtl' : ''}`}>
        {(lista[actual] ?? []).map((n) => (
          <Pagina key={n} paginador={paginador} n={n} escala={escala} alCargar={() => refrescar((x) => x + 1)} {...propsTexto(n)} />
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
            <div class="vs-grupo" role="group" aria-label={tr('Zoom')}>
              <Boton icono="alejar" etiqueta={tr('Alejar')} alPulsar={() => zoomPaso(false)} />
              <button class="btn chico fantasma vs-zoom num" data-tip={tr('Página completa')} onClick={() => fijarZoom('pagina')}>{porcentaje} %</button>
              <Boton icono="acercar" etiqueta={tr('Acercar')} alPulsar={() => zoomPaso(true)} />
              <Boton icono="ajustar-ancho" etiqueta={tr('Ajustar al ancho')} activo={zoom === 'ancho'} alPulsar={() => fijarZoom('ancho')} />
              <Boton icono="ajustar-pagina" etiqueta={tr('Página completa')} activo={zoom === 'pagina'} alPulsar={() => fijarZoom('pagina')} />
            </div>
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
                        // Cambia de dónde sale el texto de las páginas que traen el suyo: la línea abierta en una de ellas se cierra.
                        fijarAbierta((x) => (x && !propias.get(x.pagina) ? x : null));
                        fijarTextoPdf(!textoPdf);
                      }}
                    >
                      {tr('Texto del PDF')}
                    </button>
                  )}
                  <button class="btn chico fantasma" aria-pressed={modoOcr === 'libro'} data-tip={tr('Para libros impresos')} onClick={() => fijarModoOcr('libro')}>{tr('Libro')}</button>
                  <button class="btn chico fantasma" aria-pressed={modoOcr === 'manga'} data-tip={tr('Para manga: globos y texto vertical')} onClick={() => fijarModoOcr('manga')}>{tr('Manga')}</button>
                </span>
              )}
            </div>
            <div class="vs-grupo">
              <Boton
                icono="sentido"
                etiqueta={rtl ? tr('Se lee de derecha a izquierda') : tr('Se lee de izquierda a derecha')}
                activo={rtl}
                alPulsar={() => fijarDireccion(rtl ? 'ltr' : 'rtl')}
              />
              <Boton icono="miniaturas" etiqueta={tr('Miniaturas')} activo={panel === 'miniaturas'} alPulsar={() => fijarPanel(panel === 'miniaturas' ? null : 'miniaturas')} />
              {paginador.indice.length > 0 && <Boton icono="indice" etiqueta={tr('Índice')} activo={panel === 'indice'} alPulsar={() => fijarPanel(panel === 'indice' ? null : 'indice')} />}
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
                <Miniatura key={n} paginador={paginador} n={n} actual={(lista[actual] ?? [pagina]).includes(n)} alElegir={() => irA(n)} />
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
        <main
          ref={lienzo}
          class={`vs-lienzo ${invertir ? 'invertido' : ''}`}
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
          {contenido()}
        </main>
        {abierta && lineasAbiertas?.[abierta.indice] && (
          <PanelLinea
            lineas={lineasAbiertas}
            indice={abierta.indice}
            caracter={abierta.caracter}
            ajustes={a}
            titulo={doc.titulo}
            alMover={moverLinea}
            alCerrar={() => fijarAbierta(null)}
            alMarcar={(t) => fijarMarca(t ? { pagina: abierta.pagina, indice: abierta.indice, ...t } : null)}
          />
        )}
        <Creador ajustes={a} />
      </div>

      {paginador && total > 1 && (
        <footer class="vs-pie">
          <input type="range" min={1} max={total} step={1} value={pagina + 1} dir={rtl ? 'rtl' : 'ltr'} aria-label={tr('Página')} onInput={(e) => irA(Number(e.currentTarget.value) - 1)} />
          {capitulo && <span class="vs-capitulo" title={capitulo.titulo}>{capitulo.titulo}</span>}
          {ocr && (descarga || leyendo > 0 || errorOcr) && (
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
