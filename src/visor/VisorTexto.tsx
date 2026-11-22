// El visor de un EPUB de texto, como una novela. Cada capítulo va en una página propia, dentro de un marco: allí se pinta
// con su formato y su escritura vertical, y lleva encima el lector de páginas, el que pone colores, furigana y fichas en
// cualquier web. Aquí está todo lo de alrededor, como en el visor de páginas: la barra de menús, la paleta (Ctrl+K), los
// atajos, «Aa», el índice en el carril, la barra de estado con «Atrás», el modo lectura y la memoria de por dónde se va.
// Las teclas que se pulsan dentro del marco llegan aquí por mensajes (libro/mensajes.ts).

import { useEffect, useRef, useState } from 'preact/hooks';
import { Creador } from '../app/Creador';
import { guardarPreferencia, leerPreferencia } from '../app/estadoApp';
import { Interruptor } from '../app/Piezas';
import { type Ajustes, guardarAjustes } from '../compartido/ajustes';
import { tr } from '../compartido/i18n';
import { nombreColorAcento } from '../ui/palabras';
import { marcarActividad } from '../compartido/relojInmersion';
import { fondo, motor } from '../compartido/rpc';
import type { ElementoBiblioteca } from '../compartido/tipos';
import { DEL_LIBRO, DEL_VISOR, type MensajeLibro, type MensajeVisor } from '../libro/mensajes';
import { type EpubDeTexto, leerEpubDeTexto } from '../nucleo/libro';
import { pasoDeZoom } from '../nucleo/paginas';
import { fuenteDeArchivo, leerIndiceZip } from '../nucleo/zip';
import { Icono } from '../ui/iconos';
import { lengua } from '../ui/lengua';
import { letrasDe } from '../ui/letra';
import { type IdMenu, mostrarAtajo, ordenDeTecla, teclaDe } from './comandos';
import { Abriendo, AvisoError, Boton, Cabeza, usePantallaCompleta } from './comun';
import { Atajos, BarraMenus, Paleta } from './Menus';
import { type AccionesTexto, type EstadoTexto, ordenesDelTexto } from './ordenesTexto';
import { DesplegableAa, Fila, SeccionAyudas } from './Preferencias';

/** Lo que hay que haber pasado del último capítulo para dar el libro por terminado: el final suele ser una página corta. */
const FINAL_DEL_CAPITULO = 0.95;

/** Cuántos saltos recuerda «Atrás». */
const SALTOS = 50;

/** Qué capítulo se carga en el marco y dónde se abre. Cambiar `vez` lo vuelve a cargar aunque sea el mismo. */
interface Carga {
  capitulo: number;
  fraccion: number;
  fragmento: string;
  vez: number;
}

/** Un sitio del libro, para volver a él: el capítulo y por dónde se iba. */
interface Sitio {
  capitulo: number;
  fraccion: number;
}

/** «Aa» en un libro de texto: las ayudas de lectura de Kotonoha entero y, si el libro es vertical, cómo se lee este. */
function PanelAaTexto({ e, h, alCerrar, ancla }: { e: EstadoTexto; h: AccionesTexto; alCerrar: () => void; ancla: () => Element | null }) {
  return (
    <DesplegableAa alCerrar={alCerrar} ancla={ancla}>
      <SeccionAyudas e={e} ajuste={h.ajuste} />
      {(e.verticalPropio || e.horizontal) && (
        <section>
          <h3>
            {tr('Este libro')} <small>{tr('Solo en este libro')}</small>
          </h3>
          <Fila nombre={tr('Texto vertical')}>
            <Interruptor etiqueta={tr('Texto vertical')} on={!e.horizontal} alCambiar={() => h.horizontal()} />
          </Fila>
        </section>
      )}
    </DesplegableAa>
  );
}

export function VisorTexto({ doc, archivo, ajustes: a }: { doc: ElementoBiblioteca; archivo: File; ajustes: Ajustes }) {
  const d = doc.documento!;
  const [libro, fijarLibro] = useState<EpubDeTexto | null>(null);
  const [error, fijarError] = useState('');
  const [capitulo, fijarCapitulo] = useState(doc.pagina ?? 0);
  const [carga, fijarCarga] = useState<Carga>({ capitulo: doc.pagina ?? 0, fraccion: d.posicion ?? 0, fragmento: '', vez: 0 });
  // Por dónde se va dentro del capítulo: lo dice la página del libro al desplazarse.
  const [posicion, fijarPosicion] = useState(d.posicion ?? 0);
  const [zoom, fijarZoom] = useState(typeof d.zoom === 'number' ? d.zoom : 100);
  const [horizontal, fijarHorizontal] = useState(!!d.horizontal);
  const [escritura, fijarEscritura] = useState<{ vertical: boolean; verticalPropio: boolean } | null>(null);
  const [indiceAbierto, fijarIndiceAbierto] = useState(false);
  const [anchoPanel] = useState(() => leerPreferencia('visorPanelAncho', 280));
  const [invertir, fijarInvertir] = useState(() => leerPreferencia('visorInvertir', false));
  const [escrito, fijarEscrito] = useState<string | null>(null);
  // Los menús de la barra, «Aa», la paleta y los atajos: solo uno a la vez.
  const [menu, fijarMenu] = useState<{ menu: IdMenu; teclado: boolean } | null>(null);
  const [desplegable, fijarDesplegable] = useState<'aa' | null>(null);
  const [dialogo, fijarDialogo] = useState<'paleta' | 'atajos' | null>(null);
  // El modo lectura: solo el libro. La barra se asoma al llevar el ratón arriba.
  const [lectura, fijarLectura] = useState(false);
  const [asomada, fijarAsomada] = useState(false);
  // De dónde se saltó (el índice, un enlace, el número del capítulo): «Atrás» vuelve allí.
  const [saltos, fijarSaltos] = useState<Sitio[]>([]);
  const { lleno, alternar: pantallaCompleta } = usePantallaCompleta();
  const marco = useRef<HTMLIFrameElement>(null);
  const barra = useRef<HTMLElement>(null);
  const botonAa = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const f = fuenteDeArchivo(archivo);
      const l = await leerEpubDeTexto(f, await leerIndiceZip(f), doc.titulo);
      if (!vivo) return;
      const c = Math.max(0, Math.min(doc.pagina ?? 0, l.capitulos.length - 1));
      fijarLibro(l);
      fijarCapitulo(c);
      fijarCarga((x) => ({ ...x, capitulo: c }));
    })().catch((e) => vivo && fijarError(e instanceof Error ? e.message : String(e)));
    return () => {
      vivo = false;
    };
  }, [doc.id]);

  const total = libro?.capitulos.length ?? 0;
  // En vertical se avanza hacia la izquierda, como al pasar las hojas de un libro japonés.
  const rtl = !!escritura?.vertical;
  const enviar = (m: MensajeVisor) => marco.current?.contentWindow?.postMessage({ kk: DEL_VISOR, ...m }, location.origin);
  const pasar = (paso: 1 | -1) => enviar({ tipo: 'pagina', paso });
  /** El foco, de vuelta al libro: así las flechas pasan de página sin tener que hacer clic en él. */
  const enfocarLibro = () => marco.current?.contentWindow?.focus();

  const irCapitulo = (c: number, fraccion = 0, fragmento = '') => {
    if (!total) return;
    const n = Math.max(0, Math.min(total - 1, c));
    if (n === capitulo && escritura) {
      enviar({ tipo: 'ir', fraccion, fragmento });
      return;
    }
    fijarCapitulo(n);
    fijarPosicion(fraccion);
    fijarEscritura(null);
    fijarCarga((x) => ({ capitulo: n, fraccion, fragmento, vez: x.vez + 1 }));
  };
  /** Un salto a otro sitio del libro: se apunta de dónde se sale, para volver con «Atrás». */
  const saltar = (c: number, fraccion = 0, fragmento = '') => {
    if (!total) return;
    fijarSaltos((s) => [...s.slice(1 - SALTOS), { capitulo, fraccion: posicion }]);
    irCapitulo(c, fraccion, fragmento);
  };
  const atras = () => {
    const s = saltos[saltos.length - 1];
    if (!s) return;
    fijarSaltos(saltos.slice(0, -1));
    irCapitulo(s.capitulo, s.fraccion);
  };

  const cambiarHorizontal = () => {
    fijarHorizontal(!horizontal);
    fijarEscritura(null);
    fijarCarga((x) => ({ capitulo, fraccion: posicion, fragmento: '', vez: x.vez + 1 }));
  };
  const irACapitulo = () => {
    const campo = document.querySelector<HTMLInputElement>('.vs-barra .vs-numero');
    if (campo && !lectura) {
      campo.focus();
      campo.select();
    } else fijarDialogo('paleta');
  };
  const cerrarDialogo = () => {
    fijarDialogo(null);
    // Si lo elegido no se llevó el foco a otro sitio, vuelve al libro.
    requestAnimationFrame(() => {
      if (document.activeElement === document.body) enfocarLibro();
    });
  };

  // ---------- Las órdenes: menús, paleta y atajos (ordenesTexto.ts) ----------
  const estado: EstadoTexto = {
    rtl,
    zoom,
    invertir,
    lleno,
    lectura,
    verticalPropio: !!escritura?.verticalPropio,
    horizontal,
    hayIndice: (libro?.indice.length ?? 0) > 0,
    indice: indiceAbierto,
    capitulo,
    total,
    atras: saltos.length ? saltos[saltos.length - 1].capitulo : null,
    furigana: a.furigana,
    mostrarEstado: a.mostrarEstado,
    colorAcento: a.colorAcento,
    letra: a.diccionarioLetra,
    lengua: { lectura: tr(lengua.value.textos.lectura), lecturaEnPagina: lengua.value.lectura.distingue, acento: !!lengua.value.acento, nombreAcento: tr(nombreColorAcento()), comic: lengua.value.escritura.globos === 'lector', letras: letrasDe(lengua.value) },
  };
  const acciones: AccionesTexto = {
    biblioteca: () => fondo.abrirApp('biblioteca').catch(console.error),
    vocabulario: () => fondo.abrirApp(`vocabulario?libro=${encodeURIComponent(doc.id)}`).catch(console.error),
    zoom: (z) => fijarZoom((x) => (z === 'normal' ? 100 : pasoDeZoom(x, z === 'mas'))),
    invertir: () => {
      guardarPreferencia('visorInvertir', !invertir);
      fijarInvertir(!invertir);
    },
    horizontal: cambiarHorizontal,
    lectura: () => {
      fijarAsomada(false);
      fijarLectura(!lectura);
    },
    pantallaCompleta,
    pagina: pasar,
    capitulo: (n) => saltar(n),
    irACapitulo,
    atras,
    indice: () => fijarIndiceAbierto(!indiceAbierto),
    ajuste: (c) => {
      guardarAjustes(c).catch(console.error);
    },
    atajos: () => fijarDialogo('atajos'),
    paleta: () => fijarDialogo('paleta'),
  };
  const ordenes = ordenesDelTexto(estado, acciones);

  // Las teclas, las de aquí y las que llegan del marco. El oyente es uno solo y llama a la versión de este pintado, como
  // en el visor de páginas: así una tecla justo al cerrarse la paleta no llega a uno que aún la cree abierta.
  const alTeclear = useRef<(tecla: string, e?: KeyboardEvent) => boolean>(() => false);
  alTeclear.current = (t, e) => {
    if (!libro) return false;
    if (t === 'Ctrl+K') {
      fijarMenu(null);
      fijarDesplegable(null);
      fijarDialogo((x) => (x === 'paleta' ? null : 'paleta'));
      return true;
    }
    if (dialogo) return false;
    const destino = e?.target as HTMLElement | null;
    if (destino?.closest?.('input, textarea, select, [contenteditable="true"]')) return false;
    // Un menú abierto, o la barra de menús con el foco, atienden sus propias teclas.
    if (menu || destino?.closest?.('[role="menu"], [role="menubar"]')) return false;
    if (t === 'F10') {
      if (lectura) fijarAsomada(true);
      document.querySelector<HTMLElement>('.vs-menus [data-menu]')?.focus();
      return true;
    }
    if (t === 'Escape') {
      if (desplegable) fijarDesplegable(null);
      else if (lectura) fijarLectura(false);
      else return false;
      return true;
    }
    // Con el foco aquí, en la barra, las flechas también pasan de página; dentro del marco las atiende el capítulo.
    if (e && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const boton = !!destino?.closest?.('button');
      if (e.key === 'ArrowLeft') pasar(rtl ? 1 : -1);
      else if (e.key === 'ArrowRight') pasar(rtl ? -1 : 1);
      else if (e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey && !boton)) pasar(1);
      else if (e.key === 'PageUp' || (e.key === ' ' && e.shiftKey && !boton)) pasar(-1);
      else {
        const o = ordenDeTecla(ordenes, t);
        if (!o) return false;
        o.ejecutar();
      }
      return true;
    }
    const o = ordenDeTecla(ordenes, t);
    if (!o) return false;
    o.ejecutar();
    return true;
  };
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (!e.isComposing && alTeclear.current(teclaDe(e), e)) e.preventDefault();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);

  // Un clic en el libro no llega a esta página, que solo ve que el foco se va al marco: con eso se cierra lo abierto.
  useEffect(() => {
    if (!menu && !desplegable) return;
    const alSalir = () =>
      setTimeout(() => {
        if (document.activeElement !== marco.current) return;
        fijarMenu(null);
        fijarDesplegable(null);
      });
    window.addEventListener('blur', alSalir);
    return () => window.removeEventListener('blur', alSalir);
  }, [menu, desplegable]);

  // Lo que dice la página del libro.
  useEffect(() => {
    const oir = (e: MessageEvent) => {
      if (e.source !== marco.current?.contentWindow || e.origin !== location.origin) return;
      const m = e.data as MensajeLibro & { kk?: string };
      if (m?.kk !== DEL_LIBRO) return;
      // Leer dentro del marco también es leer, para las horas de inmersión.
      marcarActividad();
      if (m.tipo === 'listo') {
        fijarEscritura({ vertical: m.vertical, verticalPropio: m.verticalPropio });
        // Para pasar de página con el teclado sin tener que hacer clic antes en el libro.
        if (!dialogo && !menu && !desplegable) enfocarLibro();
      } else if (m.tipo === 'posicion') fijarPosicion(m.fraccion);
      else if (m.tipo === 'limite') {
        const destino = capitulo + m.paso;
        if (destino >= 0 && destino < total) irCapitulo(destino, m.paso > 0 ? 0 : 1);
      } else if (m.tipo === 'enlace') saltar(m.capitulo, 0, m.fragmento ?? '');
      else if (m.tipo === 'zoom') fijarZoom((z) => (m.paso === 0 ? 100 : pasoDeZoom(z, m.paso > 0)));
      else if (m.tipo === 'tecla') alTeclear.current(m.tecla);
      else if (m.tipo === 'error') fijarError(m.mensaje);
    };
    window.addEventListener('message', oir);
    return () => window.removeEventListener('message', oir);
  });

  // Recuerda el capítulo, el punto dentro de él y cómo se lee, encima de lo último guardado. Al llegar al final del
  // último capítulo, el libro queda terminado.
  const terminado = useRef(!!doc.terminado);
  useEffect(() => {
    if (!libro) return;
    const t = setTimeout(() => {
      const terminar = !terminado.current && capitulo === libro.capitulos.length - 1 && posicion >= FINAL_DEL_CAPITULO;
      if (terminar) terminado.current = true;
      motor
        .bibliotecaCambiar(doc.id, { pagina: capitulo, abierto: Date.now(), ...(terminar ? { terminado: Date.now() } : {}), documento: { paginas: libro.capitulos.length, posicion, zoom, horizontal } })
        .catch(console.error);
    }, 600);
    return () => clearTimeout(t);
  }, [libro, capitulo, posicion, zoom, horizontal]);

  const escala = zoom / 100;
  const src = libro
    ? `libro.html?${new URLSearchParams({ id: doc.id, c: String(carga.capitulo), p: String(carga.fraccion), h: horizontal ? '1' : '0', v: String(carga.vez) })}${carga.fragmento ? `#${encodeURIComponent(carga.fragmento)}` : ''}`
    : '';
  const entrada = libro ? [...libro.indice].reverse().find((e) => e.capitulo <= capitulo) : undefined;
  const avance = total ? Math.min(100, Math.round((100 * (capitulo + posicion)) / total)) : 0;
  // Lo que atiende el capítulo por su cuenta, para la lista de atajos.
  const fijos: [string[], string][] = [
    [rtl ? ['←'] : ['→'], tr('Página siguiente')],
    [rtl ? ['→'] : ['←'], tr('Página anterior')],
    [[tr('Re Pág y Av Pág'), tr('Espacio')], tr('Pasar de página')],
    [[tr('Inicio y Fin')], tr('El principio y el final del capítulo')],
    [['Esc'], tr('Cerrar lo abierto')],
    [['1', '2', '3', '4'], tr('El estado de la palabra elegida: desconocida, rastrear, conocida, ignorada')],
    [[mostrarAtajo('Ctrl+0').replace(/\+?0$/, ''), tr('Rueda del ratón')], tr('Acercar y alejar')],
  ];

  return (
    <div class={`vs-marco ${lectura ? 'modo-lectura' : ''}`}>
      <header
        ref={barra}
        class={`vs-barra ${asomada ? 'asomada' : ''}`}
        onMouseLeave={() => {
          // En el modo lectura, la barra asomada se va al bajar al libro, salvo con algo suyo abierto o con el foco.
          if (lectura && !menu && !desplegable && !barra.current?.contains(document.activeElement)) fijarAsomada(false);
        }}
      >
        <Cabeza titulo={doc.titulo} />
        {libro && (
          <>
            <BarraMenus
              ordenes={ordenes}
              abierto={menu}
              alAbrir={(m) => {
                if (m) fijarDesplegable(null);
                fijarMenu(m);
              }}
            />
            <span class="vs-barra-hueco" />
            <div class="vs-grupo" role="group" aria-label={tr('Capítulos')}>
              <Boton icono="primera" clase="vs-extremo" etiqueta={rtl ? tr('Último capítulo') : tr('Primer capítulo')} alPulsar={() => saltar(rtl ? total - 1 : 0)} />
              <Boton icono="anterior" etiqueta={rtl ? tr('Página siguiente') : tr('Página anterior')} alPulsar={() => pasar(rtl ? 1 : -1)} />
              <span class="vs-pagina-actual">
                <input
                  class="campo vs-numero num"
                  inputMode="numeric"
                  aria-label={tr('Ir al capítulo')}
                  value={escrito ?? String(capitulo + 1)}
                  onFocus={(e) => e.currentTarget.select()}
                  onInput={(e) => fijarEscrito(e.currentTarget.value)}
                  onBlur={() => fijarEscrito(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const n = parseInt(escrito ?? '', 10);
                      if (n > 0 && n - 1 !== capitulo) saltar(n - 1);
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
              <Boton icono="siguiente" etiqueta={rtl ? tr('Página anterior') : tr('Página siguiente')} alPulsar={() => pasar(rtl ? -1 : 1)} />
              <Boton icono="ultima" clase="vs-extremo" etiqueta={rtl ? tr('Primer capítulo') : tr('Último capítulo')} alPulsar={() => saltar(rtl ? 0 : total - 1)} />
            </div>
            <div class="vs-grupo" role="group" aria-label={tr('Zoom')}>
              <Boton icono="alejar" etiqueta={tr('Alejar')} alPulsar={() => acciones.zoom('menos')} />
              <button type="button" class="btn chico fantasma vs-zoom num" data-tip={tr('Tamaño normal')} onClick={() => fijarZoom(100)}>
                {zoom} %
              </button>
              <Boton icono="acercar" etiqueta={tr('Acercar')} alPulsar={() => acciones.zoom('mas')} />
            </div>
            <div class="vs-grupo">
              <span class="vs-aa-ancla">
                <button
                  ref={botonAa}
                  type="button"
                  class={`btn chico fantasma vs-aa ${desplegable === 'aa' ? 'abierto' : ''}`}
                  aria-haspopup="dialog"
                  aria-expanded={desplegable === 'aa'}
                  aria-label={tr('Ayudas de lectura')}
                  data-tip={tr('Ayudas de lectura')}
                  onClick={() => {
                    fijarMenu(null);
                    fijarDesplegable(desplegable === 'aa' ? null : 'aa');
                  }}
                >
                  Aa
                </button>
                {desplegable === 'aa' && <PanelAaTexto e={estado} h={acciones} ancla={() => botonAa.current} alCerrar={() => fijarDesplegable(null)} />}
              </span>
            </div>
          </>
        )}
      </header>

      <div class="vs-cuerpo">
        {libro && libro.indice.length > 0 && (
          <nav class="vs-carril" aria-label={tr('Paneles y herramientas')}>
            <div class="vs-carril-grupo" role="group" aria-label={tr('Navegar')}>
              <button type="button" class={`vs-carril-boton ${indiceAbierto ? 'activo' : ''}`} aria-label={tr('Índice')} aria-pressed={indiceAbierto} data-tip={tr('Índice')} data-tip-lado="der" onClick={() => fijarIndiceAbierto(!indiceAbierto)}>
                <Icono n="indice" t={19} />
              </button>
            </div>
          </nav>
        )}
        {libro && indiceAbierto && (
          <div class="vs-lateral" style={{ width: `${anchoPanel}px` }}>
            <aside class="vs-panel vs-panel-indice" aria-label={tr('Índice')}>
              <div class="vs-panel-titulo">
                <Icono n="indice" t={16} />
                <b>{tr('Índice')}</b>
                <button class="btn-icono chico vs-cerrar" aria-label={tr('Cerrar')} onClick={() => fijarIndiceAbierto(false)}>
                  <Icono n="cerrar" t={15} />
                </button>
              </div>
              <ol class="vs-indice">
                {libro.indice.map((e, i) => (
                  <li key={i}>
                    <button class={e === entrada ? 'actual' : ''} aria-current={e === entrada ? 'true' : undefined} onClick={() => saltar(e.capitulo, 0, e.fragmento ?? '')}>
                      <span>{e.titulo}</span>
                      <span class="num">{e.capitulo + 1}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </aside>
          </div>
        )}
        <div class="vs-zona">
          <main class={`vs-lienzo vs-lienzo-libro ${invertir ? 'invertido' : ''}`}>
            {error ? (
              <AvisoError mensaje={error} />
            ) : !libro ? (
              <Abriendo />
            ) : (
              // El zoom agranda el marco entero: dentro, el libro se maqueta para un hueco más pequeño y nada se descuadra.
              <iframe
                ref={marco}
                key={src}
                class="vs-libro"
                src={src}
                title={doc.titulo}
                style={{ width: `${100 / escala}%`, height: `${100 / escala}%`, transform: `scale(${escala})` }}
              />
            )}
          </main>
          {/* En el modo lectura el ratón está casi siempre sobre el libro, que es otra página: esta franja ve que llega arriba. */}
          {lectura && !asomada && <div class="vs-asomar" aria-hidden="true" onMouseEnter={() => fijarAsomada(true)} />}
          {lectura && (
            <div class="vs-aviso-herramienta vs-aviso-lectura" role="status">
              {tr('Modo lectura: M o Esc para salir')}
            </div>
          )}
        </div>
        <Creador ajustes={a} />
      </div>

      {libro && (
        <footer class="vs-pie">
          {saltos.length > 0 && (
            <button type="button" class="btn chico fantasma vs-atras" data-tip={mostrarAtajo('Alt+ArrowLeft')} data-tip-lado="arriba" onClick={atras}>
              <Icono n="volver" t={14} /> {tr('Volver al capítulo {0}', saltos[saltos.length - 1].capitulo + 1)}
            </button>
          )}
          <span class="vs-donde num">{tr('Capítulo {0} de {1}', capitulo + 1, total)}</span>
          {entrada && (
            <span class="vs-capitulo" title={entrada.titulo}>
              {entrada.titulo}
            </span>
          )}
          {total > 1 ? (
            <input type="range" min={1} max={total} step={1} value={capitulo + 1} dir={rtl ? 'rtl' : 'ltr'} aria-label={tr('Capítulo')} onChange={(e) => saltar(Number(e.currentTarget.value) - 1)} />
          ) : (
            <span class="vs-pie-hueco" />
          )}
          <span class="vs-avance num" data-tip={tr('Lo que va del libro')} data-tip-lado="arriba">
            {avance} %
          </span>
        </footer>
      )}
      {dialogo === 'paleta' && (
        <Paleta
          ordenes={ordenes}
          total={total}
          alIrA={(n) => saltar(n)}
          alCerrar={cerrarDialogo}
          etiquetaIr={(n) => tr('Ir al capítulo {0}', n)}
          pista={tr('Busca una acción o escribe un número de capítulo')}
        />
      )}
      {dialogo === 'atajos' && <Atajos ordenes={ordenes} rtl={rtl} fijos={fijos} alCerrar={cerrarDialogo} />}
    </div>
  );
}
