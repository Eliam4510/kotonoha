// El visor de un EPUB de texto, como una novela. Cada capítulo va en una página propia, dentro de un marco: allí se pinta
// con su formato y su escritura vertical, y lleva encima el lector de páginas, el que pone colores, furigana y fichas en
// cualquier web. Aquí están la barra, el zoom, el índice y la memoria de por dónde se va.

import { marcarActividad } from '../compartido/relojInmersion';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Creador } from '../app/Creador';
import { guardarPreferencia, leerPreferencia } from '../app/estadoApp';
import type { Ajustes } from '../compartido/ajustes';
import { tr } from '../compartido/i18n';
import { motor } from '../compartido/rpc';
import type { ElementoBiblioteca } from '../compartido/tipos';
import { DEL_LIBRO, DEL_VISOR, type MensajeLibro, type MensajeVisor } from '../libro/mensajes';
import { type EpubDeTexto, leerEpubDeTexto } from '../nucleo/libro';
import { pasoDeZoom } from '../nucleo/paginas';
import { fuenteDeArchivo, leerIndiceZip } from '../nucleo/zip';
import { Abriendo, AvisoError, Boton, Cabeza, usePantallaCompleta } from './comun';

/** Lo que hay que haber pasado del último capítulo para dar el libro por terminado: el final suele ser una página corta. */
const FINAL_DEL_CAPITULO = 0.95;

/** Qué capítulo se carga en el marco y dónde se abre. Cambiar `vez` lo vuelve a cargar aunque sea el mismo. */
interface Carga {
  capitulo: number;
  fraccion: number;
  fragmento: string;
  vez: number;
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
  const [invertir, fijarInvertir] = useState(() => leerPreferencia('visorInvertir', false));
  const [escrito, fijarEscrito] = useState<string | null>(null);
  const { lleno, alternar: pantallaCompleta } = usePantallaCompleta();
  const marco = useRef<HTMLIFrameElement>(null);

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

  const cambiarHorizontal = () => {
    fijarHorizontal(!horizontal);
    fijarEscritura(null);
    fijarCarga((x) => ({ capitulo, fraccion: posicion, fragmento: '', vez: x.vez + 1 }));
  };

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
        marco.current?.contentWindow?.focus();
      } else if (m.tipo === 'posicion') fijarPosicion(m.fraccion);
      else if (m.tipo === 'limite') {
        const destino = capitulo + m.paso;
        if (destino >= 0 && destino < total) irCapitulo(destino, m.paso > 0 ? 0 : 1);
      } else if (m.tipo === 'enlace') irCapitulo(m.capitulo, 0, m.fragmento ?? '');
      else if (m.tipo === 'zoom') fijarZoom((z) => (m.paso === 0 ? 100 : pasoDeZoom(z, m.paso > 0)));
      else if (m.tipo === 'pantallaCompleta') pantallaCompleta();
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

  // Con el foco en la barra, las teclas también pasan de página.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (!libro || (e.target as HTMLElement | null)?.closest?.('input, textarea, select')) return;
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '+' || e.key === '=') fijarZoom((z) => pasoDeZoom(z, true));
        else if (e.key === '-') fijarZoom((z) => pasoDeZoom(z, false));
        else if (e.key === '0') fijarZoom(100);
        else return;
        e.preventDefault();
        return;
      }
      if (e.altKey) return;
      if (e.key === 'ArrowLeft') pasar(rtl ? 1 : -1);
      else if (e.key === 'ArrowRight') pasar(rtl ? -1 : 1);
      else if (e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) pasar(1);
      else if (e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) pasar(-1);
      else if (e.key === 'f' || e.key === 'F') pantallaCompleta();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  });

  const escala = zoom / 100;
  const src = libro
    ? `libro.html?${new URLSearchParams({ id: doc.id, c: String(carga.capitulo), p: String(carga.fraccion), h: horizontal ? '1' : '0', v: String(carga.vez) })}${carga.fragmento ? `#${encodeURIComponent(carga.fragmento)}` : ''}`
    : '';
  const entrada = libro ? [...libro.indice].reverse().find((e) => e.capitulo <= capitulo) : undefined;

  return (
    <>
      <header class="vs-barra">
        <Cabeza titulo={doc.titulo} />
        {libro && (
          <>
            <div class="vs-grupo" role="group" aria-label={tr('Capítulos')}>
              <Boton icono="primera" etiqueta={rtl ? tr('Último capítulo') : tr('Primer capítulo')} alPulsar={() => irCapitulo(rtl ? total - 1 : 0)} />
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
                      if (n > 0) irCapitulo(n - 1);
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
              <Boton icono="ultima" etiqueta={rtl ? tr('Primer capítulo') : tr('Último capítulo')} alPulsar={() => irCapitulo(rtl ? 0 : total - 1)} />
            </div>
            <div class="vs-grupo" role="group" aria-label={tr('Zoom')}>
              <Boton icono="alejar" etiqueta={tr('Alejar')} alPulsar={() => fijarZoom((z) => pasoDeZoom(z, false))} />
              <button class="btn chico fantasma vs-zoom num" data-tip={tr('Tamaño normal')} onClick={() => fijarZoom(100)}>{zoom} %</button>
              <Boton icono="acercar" etiqueta={tr('Acercar')} alPulsar={() => fijarZoom((z) => pasoDeZoom(z, true))} />
            </div>
            <div class="vs-grupo">
              {(escritura?.verticalPropio || horizontal) && <Boton icono="texto-vertical" etiqueta={tr('Texto vertical')} activo={!horizontal} alPulsar={cambiarHorizontal} />}
              {libro.indice.length > 0 && <Boton icono="indice" etiqueta={tr('Índice')} activo={indiceAbierto} alPulsar={() => fijarIndiceAbierto(!indiceAbierto)} />}
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
        {libro && indiceAbierto && (
          <aside class="vs-panel" aria-label={tr('Índice')}>
            <ol class="vs-indice">
              {libro.indice.map((e, i) => (
                <li key={i}>
                  <button class={e === entrada ? 'actual' : ''} aria-current={e === entrada ? 'true' : undefined} onClick={() => irCapitulo(e.capitulo, 0, e.fragmento ?? '')}>
                    <span>{e.titulo}</span>
                    <span class="num">{e.capitulo + 1}</span>
                  </button>
                </li>
              ))}
            </ol>
          </aside>
        )}
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
        <Creador ajustes={a} />
      </div>

      {libro && total > 1 && (
        <footer class="vs-pie">
          <input type="range" min={1} max={total} step={1} value={capitulo + 1} dir={rtl ? 'rtl' : 'ltr'} aria-label={tr('Capítulo')} onChange={(e) => irCapitulo(Number(e.currentTarget.value) - 1)} />
          {entrada && <span class="vs-capitulo" title={entrada.titulo}>{entrada.titulo}</span>}
          <span class="vs-estado num">{tr('Capítulo {0} de {1}', capitulo + 1, total)}</span>
        </footer>
      )}
    </>
  );
}
