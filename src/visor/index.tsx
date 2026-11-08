// El visor de la Ayuda de lectura: un libro de páginas (EPUB de imágenes, CBZ o PDF) en una pestaña propia, como un
// lector de PDF. Zoom, páginas, doble página como un libro abierto, desplazamiento continuo, sentido de lectura,
// miniaturas e índice. Recuerda por dónde se va en cada libro. Es una página de la extensión: el libro no sale del equipo.

import { render } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import appCss from '../app/app.css';
import { guardarPreferencia, leerPreferencia } from '../app/estadoApp';
import { Interruptor } from '../app/Piezas';
import { AJUSTES_INICIALES, type Ajustes, alCambiarAjustes, leerAjustes } from '../compartido/ajustes';
import { archivoDocumento } from '../compartido/documentos';
import { bcp47Actual, fijarIdioma, tr } from '../compartido/i18n';
import { fondo, motor } from '../compartido/rpc';
import type { ElementoBiblioteca } from '../compartido/tipos';
import type { Direccion } from '../nucleo/libro';
import { escalaDe, type Medida, pasoDeZoom, pliegoDe, pliegos } from '../nucleo/paginas';
import overlay from '../contenido/overlay.css';
import base from '../ui/estilos';
import { cargarFuentes } from '../ui/fuentes';
import { Icono, type NombreIcono } from '../ui/iconos';
import { aplicarLengua } from '../ui/lengua';
import { variablesPaleta } from '../ui/paletas';
import { useTema } from '../ui/tema';
import { miniaturaDe, type PaginaImagen, type Paginador, paginadorDeZip } from './paginador';
import { paginadorDePdf } from './pdf';
import visorCss from './visor.css';

type Vista = 'una' | 'doble' | 'continua';
type Zoom = 'ancho' | 'pagina' | number;

/** El tamaño que se supone a una página que aún no se ha leído: el de un tomo de manga. */
const PAGINA_SUPUESTA: Medida = { ancho: 844, alto: 1200 };
/** El margen del lienzo alrededor de las páginas. */
const MARGEN = 16;
/** Cuántas páginas antes y después de las visibles se pintan en el desplazamiento continuo. */
const ALREDEDOR = 2;

function Boton({ icono, etiqueta, activo, alPulsar, deshabilitado }: { icono: NombreIcono; etiqueta: string; activo?: boolean; alPulsar: () => void; deshabilitado?: boolean }) {
  return (
    <button class="btn-icono chico" aria-label={etiqueta} data-tip={etiqueta} aria-pressed={activo === undefined ? undefined : activo} disabled={deshabilitado} onClick={alPulsar}>
      <Icono n={icono} t={17} />
    </button>
  );
}

/** Una página pintada a su escala. Mientras llega la imagen, ocupa ya su sitio para que nada salte. */
function Pagina({ paginador, n, escala, alCargar }: { paginador: Paginador; n: number; escala: number; alCargar?: () => void }) {
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

function Visor({ id }: { id: string }) {
  const [a, fijarA] = useState<Ajustes>(() => ({ ...AJUSTES_INICIALES, tema: leerPreferencia('tema', AJUSTES_INICIALES.tema) }));
  const [cargados, fijarCargados] = useState(false);
  const tema = useTema(a.tema);
  aplicarLengua(a);

  const [doc, fijarDoc] = useState<ElementoBiblioteca | null>(null);
  const [paginador, fijarPaginador] = useState<Paginador | null>(null);
  const [error, fijarError] = useState('');
  const [pagina, fijarPagina] = useState(0);
  const [vista, fijarVista] = useState<Vista>('una');
  const [direccion, fijarDireccion] = useState<Direccion>('ltr');
  const [portadaSola, fijarPortadaSola] = useState(true);
  const [zoom, fijarZoom] = useState<Zoom>('pagina');
  const [panel, fijarPanel] = useState<'miniaturas' | 'indice' | null>(null);
  const [invertir, fijarInvertir] = useState(() => leerPreferencia('visorInvertir', false));
  const [lleno, fijarLleno] = useState(false);
  const [hueco, fijarHueco] = useState<Medida>({ ancho: 800, alto: 600 });
  const [escrito, fijarEscrito] = useState<string | null>(null);
  const [, refrescar] = useState(0);
  const lienzo = useRef<HTMLElement>(null);
  /** Si el último cambio de página vino del desplazamiento: entonces no hay que desplazar otra vez. */
  const desdeDesplazamiento = useRef(false);

  useEffect(() => {
    leerAjustes().then((x) => {
      fijarA(x);
      fijarCargados(true);
    });
    cargarFuentes().catch(() => {});
    return alCambiarAjustes(fijarA);
  }, []);

  useEffect(() => {
    if (!cargados) return;
    fijarIdioma(a.idiomaInterfaz).then(() => {
      document.documentElement.lang = bcp47Actual();
    });
  }, [cargados, a.idiomaInterfaz]);

  useEffect(() => guardarPreferencia('tema', a.tema), [a.tema]);

  // Abre el libro: su ficha en la biblioteca, su archivo guardado y el paginador de su formato.
  useEffect(() => {
    let vivo = true;
    let abierto: Paginador | null = null;
    (async () => {
      const e = await motor.bibliotecaObtener(id);
      if (!e?.documento) throw new Error(tr('Este libro ya no está en la Ayuda de lectura.'));
      const archivo = await archivoDocumento(id);
      if (!archivo) throw new Error(tr('El archivo de este libro no está en este equipo. Vuelve a importarlo desde la Ayuda de lectura.'));
      const d = e.documento;
      const p = d.formato === 'pdf' ? await paginadorDePdf(archivo) : await paginadorDeZip(archivo, `${e.titulo}.${d.formato}`, d.direccion);
      abierto = p;
      if (!vivo) return;
      document.title = tr('{0} · Kotonoha', e.titulo);
      fijarDoc(e);
      fijarPaginador(p);
      fijarPagina(Math.min(e.pagina ?? 0, Math.max(0, p.total - 1)));
      fijarDireccion(d.direccion ?? p.direccion);
      // Un manga se lee a doble página, como el tomo impreso; un libro de texto, de una en una.
      fijarVista(d.vista ?? ((d.direccion ?? p.direccion) === 'rtl' ? 'doble' : 'una'));
      fijarPortadaSola(d.portadaSola ?? true);
      fijarZoom(d.zoom ?? 'pagina');
      // Un PDF no tiene portada hasta que se abre: se hace ahora con su primera página, para la estantería.
      if (!d.portada) {
        p.imagen(0)
          .then(async (primera) => {
            const portada = await miniaturaDe(await (await fetch(primera.url)).blob());
            if (vivo) fijarDoc((x) => (x?.documento ? { ...x, documento: { ...x.documento, portada } } : x));
          })
          .catch(() => {});
      }
    })().catch((err) => vivo && fijarError(err instanceof Error ? err.message : String(err)));
    return () => {
      vivo = false;
      abierto?.cerrar();
    };
  }, [id]);

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

  useEffect(() => {
    const cambio = () => fijarLleno(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', cambio);
    return () => document.removeEventListener('fullscreenchange', cambio);
  }, []);

  const total = paginador?.total ?? 0;
  const rtl = direccion === 'rtl';
  const lista = useMemo(() => pliegos(total, vista === 'doble', portadaSola), [total, vista, portadaSola]);
  const actual = pliegoDe(lista, pagina);
  const medida = (n: number) => paginador?.tamano(n) ?? PAGINA_SUPUESTA;
  const escala = paginador ? escalaDe((lista[actual] ?? [pagina]).map(medida), hueco, zoom) : 1;
  const porcentaje = Math.round(escala * 100);

  // La página al instante: con la flecha pulsada llegan varias teclas antes de que se vuelva a pintar, y cada una tiene que
  // contar desde la anterior, no desde lo último pintado.
  const ahora = useRef(0);
  ahora.current = pagina;
  const irA = (n: number) => {
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
  const pantallaCompleta = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});

  // Recuerda por dónde se va y cómo se lee cada libro.
  useEffect(() => {
    if (!doc?.documento || !paginador) return;
    const t = setTimeout(() => {
      motor
        .bibliotecaGuardar({ ...doc, pagina, abierto: Date.now(), documento: { ...doc.documento!, paginas: paginador.total, vista, direccion, portadaSola, zoom } })
        .catch(console.error);
    }, 600);
    return () => clearTimeout(t);
  }, [doc, paginador, pagina, vista, direccion, portadaSola, zoom]);

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
    if (error)
      return (
        <div class="vs-aviso" role="alert">
          <Icono n="aviso" t={28} />
          <b>{tr('No se pudo abrir el libro')}</b>
          <p>{error}</p>
          <button class="btn" onClick={() => fondo.abrirApp('biblioteca')}><Icono n="flecha-izq" t={15} /> {tr('Volver a la Ayuda de lectura')}</button>
        </div>
      );
    if (!paginador)
      return (
        <div class="vs-aviso">
          <Icono n="espera" t={26} />
          <span>{tr('Abriendo el libro…')}</span>
        </div>
      );
    if (vista === 'continua')
      return (
        <div class="vs-continua">
          {Array.from({ length: total }, (_, n) => {
            const e = escalaDe([medida(n)], hueco, zoom);
            const t = medida(n);
            return n >= cerca[0] && n <= cerca[1] ? (
              <Pagina key={n} paginador={paginador} n={n} escala={e} alCargar={() => refrescar((x) => x + 1)} />
            ) : (
              <div key={n} class="vs-pagina vs-reservada" data-pagina={n + 1} style={{ width: `${Math.round(t.ancho * e)}px`, height: `${Math.round(t.alto * e)}px` }} />
            );
          })}
        </div>
      );
    return (
      <div class={`vs-pliego ${rtl ? 'rtl' : ''}`}>
        {(lista[actual] ?? []).map((n) => (
          <Pagina key={n} paginador={paginador} n={n} escala={escala} alCargar={() => refrescar((x) => x + 1)} />
        ))}
      </div>
    );
  };

  return (
    <div class="kk-raiz vs" data-tema={tema} lang={bcp47Actual()} style={{ ...variablesPaleta(a.paleta, tema === 'oscuro') }}>
      <style>{base + overlay + appCss + visorCss}</style>
      <header class="vs-barra">
        <div class="vs-grupo vs-cabeza">
          <button class="btn chico fantasma" onClick={() => fondo.abrirApp('biblioteca')}><Icono n="flecha-izq" t={15} /> {tr('Ayuda de lectura')}</button>
          {doc && <b class="vs-titulo" title={doc.titulo}>{doc.titulo}</b>}
        </div>
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
      </div>

      {paginador && total > 1 && (
        <footer class="vs-pie">
          <input type="range" min={1} max={total} step={1} value={pagina + 1} dir={rtl ? 'rtl' : 'ltr'} aria-label={tr('Página')} onInput={(e) => irA(Number(e.currentTarget.value) - 1)} />
          {capitulo && <span class="vs-capitulo" title={capitulo.titulo}>{capitulo.titulo}</span>}
          {vista === 'doble' && (
            <label class="vs-portada">
              <span>{tr('Portada sola')}</span>
              <Interruptor etiqueta={tr('Portada sola')} on={portadaSola} alCambiar={fijarPortadaSola} />
            </label>
          )}
        </footer>
      )}
    </div>
  );
}

const id = decodeURIComponent(location.hash.slice(1));
// Antes de pintar: si no, la pestaña se vería un instante en español.
leerAjustes()
  .then((a) => fijarIdioma(a.idiomaInterfaz))
  .catch(() => {})
  .finally(() => render(<Visor id={id} />, document.getElementById('raiz')!));
