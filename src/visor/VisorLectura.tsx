// El visor de un texto de la Biblioteca: lo pegado, una historia de Claude, un artículo guardado. El texto se lee con la
// ayuda de lectura de siempre (TextoInteractivo, la misma que la vista de texto de un libro: furigana, fichas, comprensión,
// voz alta y práctica) y alrededor va lo del visor, como en cualquier libro: la barra de menús, la paleta (Ctrl+K), los
// atajos, «Aa», la barra de estado y el modo lectura. Un texto largo va en páginas, como en la estantería.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { TextoInteractivo } from '../app/Lectura';
import { Creador } from '../app/Creador';
import { type Ajustes, guardarAjustes } from '../compartido/ajustes';
import { tr } from '../compartido/i18n';
import { fondo, motor } from '../compartido/rpc';
import { pasarAlCuaderno } from '../compartido/textoLector';
import type { ElementoBiblioteca } from '../compartido/tipos';
import { paginasDeTexto } from '../nucleo/estanteria';
import { lengua } from '../ui/lengua';
import { letrasDe } from '../ui/letra';
import { type IdMenu, ordenDeTecla, teclaDe } from './comandos';
import { Boton, Cabeza, usePantallaCompleta } from './comun';
import { Atajos, BarraMenus, Paleta } from './Menus';
import { type AccionesLectura, type EstadoLectura, ordenesDeLectura } from './ordenesTexto';
import { DesplegableAa, SeccionAyudas } from './Preferencias';

export function VisorLectura({ doc, ajustes: a }: { doc: ElementoBiblioteca; ajustes: Ajustes }) {
  const pags = useMemo(() => paginasDeTexto(doc.texto), [doc.texto]);
  const total = Math.max(1, pags.length);
  const [pagina, fijarPagina] = useState(() => Math.max(0, Math.min(total - 1, doc.pagina ?? 0)));
  const [escrito, fijarEscrito] = useState<string | null>(null);
  // Los menús de la barra, «Aa», la paleta y los atajos: solo uno a la vez.
  const [menu, fijarMenu] = useState<{ menu: IdMenu; teclado: boolean } | null>(null);
  const [desplegable, fijarDesplegable] = useState<'aa' | null>(null);
  const [dialogo, fijarDialogo] = useState<'paleta' | 'atajos' | null>(null);
  // El modo lectura: solo el texto. La barra se asoma al llevar el ratón arriba.
  const [lectura, fijarLectura] = useState(false);
  const [asomada, fijarAsomada] = useState(false);
  const { lleno, alternar: pantallaCompleta } = usePantallaCompleta();
  const lienzo = useRef<HTMLElement>(null);
  const botonAa = useRef<HTMLButtonElement>(null);

  // Por dónde se va, como lo guardaba la estantería; y ver la última página deja el texto terminado.
  const terminado = useRef(!!doc.terminado);
  useEffect(() => {
    const terminar = !terminado.current && pagina >= total - 1;
    if (terminar) terminado.current = true;
    motor.bibliotecaCambiar(doc.id, { pagina, abierto: Date.now(), ...(terminar ? { terminado: Date.now() } : {}) }).catch(console.error);
  }, [pagina]);

  const irA = (n: number) => {
    const m = Math.max(0, Math.min(total - 1, n));
    if (m === pagina) return;
    fijarPagina(m);
    lienzo.current?.scrollTo(0, 0);
  };
  const irAPagina = () => {
    const campo = document.querySelector<HTMLInputElement>('.vs-barra .vs-numero');
    if (campo && !lectura) {
      campo.focus();
      campo.select();
    } else fijarDialogo('paleta');
  };

  // ---------- Las órdenes: menús, paleta y atajos (ordenesTexto.ts) ----------
  const estado: EstadoLectura = {
    pagina,
    total,
    lleno,
    lectura,
    furigana: a.furigana,
    mostrarEstado: a.mostrarEstado,
    colorAcento: a.colorAcento,
    letra: a.diccionarioLetra,
    lengua: { lectura: tr(lengua.value.textos.lectura), lecturaEnPagina: lengua.value.lectura.distingue, acento: !!lengua.value.acento, comic: lengua.value.escritura.globos === 'lector', letras: letrasDe(lengua.value) },
  };
  const acciones: AccionesLectura = {
    biblioteca: () => fondo.abrirApp('biblioteca').catch(console.error),
    vocabulario: () => fondo.abrirApp(`vocabulario?libro=${encodeURIComponent(doc.id)}`).catch(console.error),
    cuaderno: () => void pasarAlCuaderno(doc, (ruta) => fondo.abrirApp(ruta)).catch(console.error),
    lectura: () => {
      fijarAsomada(false);
      fijarLectura(!lectura);
    },
    pantallaCompleta,
    ir: irA,
    irAPagina,
    ajuste: (c) => {
      guardarAjustes(c).catch(console.error);
    },
    atajos: () => fijarDialogo('atajos'),
    paleta: () => fijarDialogo('paleta'),
  };
  const ordenes = ordenesDeLectura(estado, acciones);

  // Las teclas: un solo oyente, que llama a la versión de este pintado (como en los otros visores).
  const alTeclear = useRef<(e: KeyboardEvent) => void>(() => {});
  alTeclear.current = (e) => {
    if (e.isComposing) return;
    const t = teclaDe(e);
    if (t === 'Ctrl+K') {
      e.preventDefault();
      fijarMenu(null);
      fijarDesplegable(null);
      fijarDialogo((x) => (x === 'paleta' ? null : 'paleta'));
      return;
    }
    if (dialogo) return;
    const destino = e.target as HTMLElement | null;
    if (destino?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    if (menu || destino?.closest?.('[role="menu"], [role="menubar"]')) return;
    if (t === 'F10') {
      e.preventDefault();
      if (lectura) fijarAsomada(true);
      document.querySelector<HTMLElement>('.vs-menus [data-menu]')?.focus();
      return;
    }
    if (e.key === 'Escape') {
      // La ficha de una palabra la cierra el texto: Esc es para ella antes que para el modo lectura.
      if (document.querySelector('.ap-lectura-ficha')) return;
      if (desplegable) fijarDesplegable(null);
      else if (lectura) fijarLectura(false);
      else return;
      e.preventDefault();
      return;
    }
    if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      if (total < 2) return;
      e.preventDefault();
      irA(pagina + (e.key === 'ArrowRight' ? 1 : -1));
      return;
    }
    const o = ordenDeTecla(ordenes, t);
    if (!o) return;
    e.preventDefault();
    o.ejecutar();
  };
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => alTeclear.current(e);
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);

  // En el modo lectura, la barra se asoma al llevar el ratón arriba y se va al bajar, salvo con algo suyo abierto.
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

  const avance = Math.round((100 * (pagina + 1)) / total);
  const fijos: [string[], string][] = [
    [['→'], tr('Página siguiente')],
    [['←'], tr('Página anterior')],
    [['Esc'], tr('Cerrar lo abierto')],
    [['1', '2', '3', '4'], tr('El estado de la palabra elegida: desconocida, rastrear, conocida, ignorada')],
  ];

  return (
    <div class={`vs-marco ${lectura ? 'modo-lectura' : ''}`}>
      <header class={`vs-barra ${asomada ? 'asomada' : ''}`}>
        <Cabeza titulo={doc.titulo} />
        <BarraMenus
          ordenes={ordenes}
          abierto={menu}
          alAbrir={(m) => {
            if (m) fijarDesplegable(null);
            fijarMenu(m);
          }}
        />
        <span class="vs-barra-hueco" />
        {total > 1 && (
          <div class="vs-grupo" role="group" aria-label={tr('Páginas')}>
            <Boton icono="primera" clase="vs-extremo" etiqueta={tr('Primera página')} alPulsar={() => irA(0)} />
            <Boton icono="anterior" etiqueta={tr('Página anterior')} alPulsar={() => irA(pagina - 1)} />
            <span class="vs-pagina-actual">
              <input
                class="campo vs-numero num"
                inputMode="numeric"
                aria-label={tr('Ir a la página')}
                value={escrito ?? String(pagina + 1)}
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
            <Boton icono="siguiente" etiqueta={tr('Página siguiente')} alPulsar={() => irA(pagina + 1)} />
            <Boton icono="ultima" clase="vs-extremo" etiqueta={tr('Última página')} alPulsar={() => irA(total - 1)} />
          </div>
        )}
        <div class="vs-grupo">
          <Boton icono="lapiz" etiqueta={tr('Editar en el Cuaderno')} alPulsar={acciones.cuaderno} />
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
            {desplegable === 'aa' && (
              <DesplegableAa alCerrar={() => fijarDesplegable(null)} ancla={() => botonAa.current}>
                <SeccionAyudas e={estado} ajuste={acciones.ajuste} />
              </DesplegableAa>
            )}
          </span>
        </div>
      </header>

      <div class="vs-cuerpo">
        <div class="vs-zona">
          <main ref={lienzo} class="vs-lienzo vs-lienzo-texto">
            <div class="vs-vista-texto">
              <TextoInteractivo key={pagina} texto={pags[pagina] ?? ''} ajustes={a} titulo={doc.titulo} inicioBarra={<b class="ap-lectura-titulo" lang={lengua.value.id}>{doc.titulo}</b>} />
            </div>
          </main>
          {lectura && (
            <div class="vs-aviso-herramienta vs-aviso-lectura" role="status">
              {tr('Modo lectura: M o Esc para salir')}
            </div>
          )}
        </div>
        <Creador ajustes={a} />
      </div>

      <footer class="vs-pie">
        <span class="vs-donde num">{tr('Página {0} de {1}', pagina + 1, total)}</span>
        {total > 1 ? (
          <input type="range" min={1} max={total} step={1} value={pagina + 1} aria-label={tr('Página')} onChange={(e) => irA(Number(e.currentTarget.value) - 1)} />
        ) : (
          <span class="vs-pie-hueco" />
        )}
        <span class="vs-avance num" data-tip={tr('Lo que va del libro')} data-tip-lado="arriba">
          {avance} %
        </span>
      </footer>
      {dialogo === 'paleta' && <Paleta ordenes={ordenes} total={total} alIrA={irA} alCerrar={() => fijarDialogo(null)} />}
      {dialogo === 'atajos' && <Atajos ordenes={ordenes} rtl={false} fijos={fijos} alCerrar={() => fijarDialogo(null)} />}
    </div>
  );
}
