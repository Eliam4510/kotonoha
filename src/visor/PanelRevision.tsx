// La revisión con Claude del texto de unas páginas: Claude mira la imagen de cada una y propone solo lo que no coincide
// con lo leído. Cada cambio se enseña letra a letra y se eligen los que se aplican. Lo aplicado queda como una línea
// editada, que en su panel se puede devolver a como estaba con «Restaurar». Nada se revisa sin pedirlo: solo las páginas
// para las que se pulsó el botón.

import { useEffect, useRef, useState } from 'preact/hooks';
import { numero, tr } from '../compartido/i18n';
import type { LineaEditada } from '../nucleo/ediciones';
import { type CambioPropuesto, diferencias } from '../nucleo/revision';
import { Icono } from '../ui/iconos';
import { lengua } from '../ui/lengua';

/** Un cambio que propone Claude, con la línea tal como estaba al revisarla: es la que se edita al aplicarlo. */
export interface PropuestaLinea extends CambioPropuesto {
  linea: LineaEditada;
}

interface Revision {
  estado: 'revisando' | 'lista' | 'error' | 'aplicada';
  propuestas: PropuestaLinea[];
  elegidas: Set<number>;
  error?: string;
  aplicadas?: number;
}

/** Una línea de antes o de después, con lo que cambia marcado. */
function Cambio({ p }: { p: PropuestaLinea }) {
  const trozos = diferencias(p.antes, p.despues);
  return (
    <>
      <span class="vs-propuesta-antes" lang={lengua.value.id}>
        {trozos.map((t, i) => (t.tipo === 'igual' ? <span key={i}>{t.texto}</span> : t.tipo === 'quitado' ? <del key={i}>{t.texto}</del> : null))}
      </span>
      <span class="vs-propuesta-despues" lang={lengua.value.id}>
        {trozos.map((t, i) => (t.tipo === 'igual' ? <span key={i}>{t.texto}</span> : t.tipo === 'puesto' ? <ins key={i}>{t.texto}</ins> : null))}
      </span>
    </>
  );
}

export function PanelRevision({ paginas, revisar, alAplicar, alVerLinea, alCerrar }: {
  /** Las páginas que se pidió revisar, la última primero. */
  paginas: number[];
  revisar: (n: number) => Promise<PropuestaLinea[]>;
  alAplicar: (n: number, cambios: PropuestaLinea[]) => Promise<void>;
  /** Lleva a la línea de un cambio, en su página, y la abre. */
  alVerLinea: (n: number, indice: number) => void;
  alCerrar: () => void;
}) {
  const [revisiones, fijarRevisiones] = useState<Map<number, Revision>>(() => new Map());
  const cambiar = (n: number, r: Revision) => fijarRevisiones((m) => new Map(m).set(n, r));
  const lanzadas = useRef(new Set<number>());
  const lanzar = (n: number) => {
    lanzadas.current.add(n);
    cambiar(n, { estado: 'revisando', propuestas: [], elegidas: new Set() });
    revisar(n).then(
      (propuestas) => cambiar(n, { estado: 'lista', propuestas, elegidas: new Set(propuestas.map((p) => p.indice)) }),
      (e) => cambiar(n, { estado: 'error', propuestas: [], elegidas: new Set(), error: e instanceof Error ? e.message : String(e) })
    );
  };
  useEffect(() => {
    for (const n of paginas) if (!lanzadas.current.has(n)) lanzar(n);
  }, [paginas.join(',')]);

  const elegir = (n: number, r: Revision, indice: number, si: boolean) => {
    const elegidas = new Set(r.elegidas);
    if (si) elegidas.add(indice);
    else elegidas.delete(indice);
    cambiar(n, { ...r, elegidas });
  };
  const aplicar = async (n: number, r: Revision) => {
    const cambios = r.propuestas.filter((p) => r.elegidas.has(p.indice));
    await alAplicar(n, cambios);
    cambiar(n, { ...r, estado: 'aplicada', aplicadas: cambios.length });
  };

  return (
    <aside class="vs-panel vs-panel-revision" aria-label={tr('Revisión con Claude')}>
      <div class="vs-panel-titulo">
        <Icono n="ia" t={15} />
        <b>{tr('Revisión con Claude')}</b>
        <button class="btn-icono chico vs-cerrar" aria-label={tr('Cerrar')} onClick={alCerrar}><Icono n="cerrar" t={15} /></button>
      </div>
      <p class="ayuda">{tr('Claude compara el texto leído con la imagen de la página y propone solo lo que no coincide. Nada cambia hasta que lo apliques.')}</p>
      {paginas.map((n) => {
        const r = revisiones.get(n);
        return (
          <section key={n} class="vs-revision-pagina" aria-label={tr('Página {0}', n + 1)}>
            <h3>{tr('Página {0}', n + 1)}</h3>
            {(!r || r.estado === 'revisando') && (
              <p class="ayuda vs-revisando" role="status">
                <span class="vs-girando" aria-hidden="true" /> {tr('Claude está mirando la página…')}
              </p>
            )}
            {r?.estado === 'error' && (
              <div class="vs-revision-error" role="alert">
                <p>{r.error}</p>
                <button class="btn chico" onClick={() => lanzar(n)}><Icono n="recargar" t={13} /> {tr('Reintentar')}</button>
              </div>
            )}
            {r?.estado === 'lista' && r.propuestas.length === 0 && <p class="ayuda vs-revision-nada">{tr('Claude no propone cambios: el texto coincide con la página.')}</p>}
            {r?.estado === 'lista' && r.propuestas.length > 0 && (
              <>
                <p class="ayuda">{r.propuestas.length === 1 ? tr('Claude propone 1 cambio.') : tr('Claude propone {0} cambios. Elige cuáles aplicar.', numero(r.propuestas.length))}</p>
                <ul class="vs-propuestas">
                  {r.propuestas.map((p) => (
                    <li key={p.indice} class="vs-propuesta">
                      <input type="checkbox" checked={r.elegidas.has(p.indice)} aria-label={tr('Aplicar el cambio de la línea {0}', p.indice + 1)} onChange={(e) => elegir(n, r, p.indice, e.currentTarget.checked)} />
                      <button class="vs-propuesta-texto" data-tip={tr('Ver la línea en la página')} onClick={() => alVerLinea(n, p.indice)}>
                        <Cambio p={p} />
                      </button>
                    </li>
                  ))}
                </ul>
                <div class="vs-revision-acciones">
                  <button class="btn chico primario" disabled={!r.elegidas.size} onClick={() => void aplicar(n, r)}>
                    <Icono n="ok" t={13} /> {r.propuestas.length === 1 ? tr('Aplicar') : r.elegidas.size === r.propuestas.length ? tr('Aplicar todos') : tr('Aplicar los elegidos')}
                  </button>
                </div>
              </>
            )}
            {r?.estado === 'aplicada' && (
              <p class="ayuda vs-revision-hecha" role="status">
                <Icono n="check" t={14} /> {r.aplicadas === 1 ? tr('1 línea cambiada.') : tr('{0} líneas cambiadas.', numero(r.aplicadas ?? 0))} {tr('En el panel de cada una, «Restaurar» la devuelve a como estaba.')}
              </p>
            )}
          </section>
        );
      })}
    </aside>
  );
}
