// El desplegable «Aa» de la barra del visor: las ayudas de lectura y cómo se ve el libro, a la mano y diciendo a qué
// alcanzan. Las ayudas (lectura sobre las palabras, colores, letra) son de Kotonoha entero: valen igual en los subtítulos
// y el Cuaderno. El sentido, la vista y la nitidez son de este libro: cada libro recuerda los suyos.

import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { Interruptor } from '../app/Piezas';
import { tr } from '../compartido/i18n';
import { Icono, type NombreIcono } from '../ui/iconos';
import { MODOS_LECTURA } from '../ui/palabras';
import { useClicFuera } from './Menus';
import type { AccionesVisor, EstadoVisor, Vista } from './ordenesVisor';

function Fila({ nombre, children }: { nombre: string; children: preact.ComponentChildren }) {
  return (
    <div class="vs-aa-fila">
      <span class="vs-aa-nombre">{nombre}</span>
      {children}
    </div>
  );
}

function Segmentado<T extends string | number>({ etiqueta, valor, opciones, alCambiar }: { etiqueta: string; valor: T; opciones: { v: T; texto?: string; icono?: NombreIcono; nombre?: string }[]; alCambiar: (v: T) => void }) {
  return (
    <div class="segmentado vs-aa-opciones" role="radiogroup" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button key={String(o.v)} type="button" role="radio" aria-checked={valor === o.v} aria-label={o.nombre} data-tip={o.nombre} class={valor === o.v ? 'activo' : ''} onClick={() => alCambiar(o.v)}>
          {o.icono ? <Icono n={o.icono} t={15} /> : o.texto}
        </button>
      ))}
    </div>
  );
}

export function PanelAa({ e, h, alCerrar, ancla }: { e: EstadoVisor; h: AccionesVisor; alCerrar: () => void; ancla: () => Element | null }) {
  const ref = useRef<HTMLDivElement>(null);
  useClicFuera(true, () => [ref.current, ancla()], alCerrar);
  useLayoutEffect(() => ref.current?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true }), []);
  useEffect(() => {
    const tecla = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      alCerrar();
      (ancla() as HTMLElement | null)?.focus();
    };
    window.addEventListener('keydown', tecla, true);
    return () => window.removeEventListener('keydown', tecla, true);
  }, []);
  const vistas: { v: Vista; icono: NombreIcono; nombre: string }[] = [
    { v: 'una', icono: 'una-pagina', nombre: tr('Una página') },
    { v: 'doble', icono: 'doble-pagina', nombre: tr('Doble página') },
    { v: 'continua', icono: 'continua', nombre: tr('Desplazamiento continuo') },
  ];
  return (
    <div ref={ref} class="vs-aa-panel" role="dialog" aria-label={tr('Ayudas de lectura')}>
      <section>
        <h3>
          {tr('Ayudas de lectura')} <small>{tr('En todo Kotonoha')}</small>
        </h3>
        <Fila nombre={e.lengua.lectura}>
          <Segmentado etiqueta={e.lengua.lectura} valor={e.furigana} opciones={MODOS_LECTURA.map(([v, n]) => ({ v, texto: tr(n) }))} alCambiar={(v) => h.ajuste({ furigana: v })} />
        </Fila>
        <Fila nombre={tr('Estado de aprendizaje')}>
          <Interruptor etiqueta={tr('Estado de aprendizaje')} on={e.mostrarEstado} alCambiar={(v) => h.ajuste({ mostrarEstado: v })} />
        </Fila>
        {e.lengua.acento && (
          <Fila nombre={tr('Color de acento')}>
            <Segmentado
              etiqueta={tr('Color de acento')}
              valor={e.colorAcento}
              opciones={[
                { v: 'siempre', texto: tr('Siempre') },
                { v: 'alPasar', texto: tr('Al pasar') },
                { v: 'ninguno', texto: tr('Nada') },
              ]}
              alCambiar={(v) => h.ajuste({ colorAcento: v })}
            />
          </Fila>
        )}
        {e.lengua.letras.length > 1 && (
          <Fila nombre={tr('Letra')}>
            <Segmentado etiqueta={tr('Letra')} valor={e.letra} opciones={e.lengua.letras.map((l) => ({ v: l.id, texto: tr(l.nombre) }))} alCambiar={(v) => h.ajuste({ diccionarioLetra: v })} />
          </Fila>
        )}
      </section>
      <section>
        <h3>
          {tr('Este libro')} <small>{tr('Solo en este libro')}</small>
        </h3>
        <Fila nombre={tr('Sentido de lectura')}>
          <Segmentado
            etiqueta={tr('Sentido de lectura')}
            valor={e.rtl ? 'rtl' : 'ltr'}
            opciones={[
              { v: 'ltr', icono: 'flecha', nombre: tr('De izquierda a derecha') },
              { v: 'rtl', icono: 'flecha-izq', nombre: tr('De derecha a izquierda') },
            ]}
            alCambiar={(v) => h.sentido(v === 'rtl')}
          />
        </Fila>
        <Fila nombre={tr('Vista')}>
          <Segmentado etiqueta={tr('Vista')} valor={e.vista} opciones={vistas} alCambiar={h.vista} />
        </Fila>
        {!e.vistaTexto && (
          <Fila nombre={tr('Nitidez')}>
            <span class="vs-aa-nitidez">
              <Interruptor etiqueta={tr('Enfocar las páginas')} on={e.nitidez.activa} alCambiar={(v) => h.nitidez({ activa: v })} />
              {e.nitidez.activa && (
                <Segmentado
                  etiqueta={tr('Nitidez')}
                  valor={e.nitidez.nivel}
                  opciones={[
                    { v: 1, texto: tr('Suave') },
                    { v: 2, texto: tr('Media') },
                    { v: 3, texto: tr('Fuerte') },
                  ]}
                  alCambiar={(nivel) => h.nitidez({ nivel })}
                />
              )}
            </span>
          </Fila>
        )}
      </section>
    </div>
  );
}
