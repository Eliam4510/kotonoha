// Lo anotado en un libro de páginas, como en un lector de PDF: sobre cada página, los resaltados y subrayados, la cinta
// del marcador y las notas sueltas, que se abren para leerlas o escribirlas; y al lado, el panel «Notas», con todo el libro
// en orden, para ir a cada cosa, editarla, quitarla o copiarla entera como texto.

import { useEffect, useRef, useState } from 'preact/hooks';
import { tr } from '../compartido/i18n';
import type { AnotacionLibro, ColorAnotacion } from '../compartido/tipos';
import { notasComoTexto, porPagina } from '../nucleo/anotaciones';
import type { Caja } from '../nucleo/ocr';
import { Icono } from '../ui/iconos';
import { lengua } from '../ui/lengua';

const porciento = (c: Caja) => ({ left: `${c.x0 * 100}%`, top: `${c.y0 * 100}%`, width: `${(c.x1 - c.x0) * 100}%`, height: `${(c.y1 - c.y0) * 100}%` });

export const COLORES: ColorAnotacion[] = ['amarillo', 'verde', 'azul', 'rosa'];
/** Cómo se dice cada color al resaltar, para los lectores de pantalla y las pistas. */
export const resaltarEn = (c: ColorAnotacion) =>
  c === 'amarillo' ? tr('Resaltar en amarillo') : c === 'verde' ? tr('Resaltar en verde') : c === 'azul' ? tr('Resaltar en azul') : tr('Resaltar en rosa');

/** Lo que se escribe en una nota o en el comentario de un resaltado: Intro guarda, Mayúsculas+Intro hace otra línea. */
export function EditorNota({ inicial, etiqueta, alGuardar, alCancelar, alQuitar }: { inicial: string; etiqueta: string; alGuardar: (texto: string) => void; alCancelar: () => void; alQuitar?: () => void }) {
  const [texto, fijarTexto] = useState(inicial);
  const campo = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    campo.current?.focus();
  }, []);
  return (
    <div class="vs-editor-nota" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      <textarea
        ref={campo}
        class="campo"
        rows={3}
        aria-label={etiqueta}
        placeholder={etiqueta}
        value={texto}
        onInput={(e) => fijarTexto(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
            e.preventDefault();
            alGuardar(texto.trim());
          } else if (e.key === 'Escape') {
            e.stopPropagation();
            alCancelar();
          }
        }}
      />
      <div class="vs-editor-nota-botones">
        {alQuitar && (
          <button class="btn chico fantasma" onClick={alQuitar}>
            <Icono n="basura" t={13} /> {tr('Quitar')}
          </button>
        )}
        <button class="btn chico fantasma" onClick={alCancelar}>{tr('Cancelar')}</button>
        <button class="btn chico primario" onClick={() => alGuardar(texto.trim())}>{tr('Guardar')}</button>
      </div>
    </div>
  );
}

/** Una nota suelta sobre la página: un papelito que se abre al tocarlo. */
function NotaPagina({ a, abierta, alAbrir, alCerrar, alGuardar, alQuitar }: { a: AnotacionLibro; abierta: boolean; alAbrir: () => void; alCerrar: () => void; alGuardar: (a: AnotacionLibro) => void; alQuitar: () => void }) {
  const p = a.punto ?? { x: 0, y: 0 };
  // Cerca del borde derecho o de abajo, el editor se abre hacia dentro de la página.
  const lado = `${p.x > 0.6 ? 'izquierda' : 'derecha'} ${p.y > 0.7 ? 'arriba' : 'abajo'}`;
  return (
    <div class={`vs-nota-pagina ${abierta ? 'abierta' : ''} ${lado}`} style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }} onClick={(e) => e.stopPropagation()}>
      <button class="vs-nota-icono" aria-label={a.nota ? tr('Nota: {0}', a.nota) : tr('Nota sin texto')} aria-expanded={abierta} data-tip={abierta ? undefined : a.nota || undefined} onClick={() => (abierta ? alCerrar() : alAbrir())}>
        <Icono n="nota" t={15} />
      </button>
      {abierta && (
        <EditorNota
          inicial={a.nota ?? ''}
          etiqueta={tr('Escribe la nota')}
          alGuardar={(nota) => {
            // Una nota que se deja en blanco no sirve de nada: se quita.
            if (nota) alGuardar({ ...a, nota });
            else alQuitar();
            alCerrar();
          }}
          alCancelar={() => {
            if (!a.nota) alQuitar();
            alCerrar();
          }}
          alQuitar={alQuitar}
        />
      )}
    </div>
  );
}

/** Los resaltados y subrayados de una página, debajo de sus líneas para no estorbar al tocarlas. */
export function Resaltados({ anotaciones }: { anotaciones: AnotacionLibro[] }) {
  return (
    <div class="vs-resaltados" aria-hidden="true">
      {anotaciones.flatMap((a) =>
        a.tipo === 'resaltado' ? (a.cajas ?? []).map((c, i) => <span key={`${a.id}-${i}`} class={`vs-resaltado ${a.color ?? 'amarillo'} ${a.estilo ?? 'fondo'} ${a.vertical ? 'vertical' : ''}`} style={porciento(c)} />) : []
      )}
    </div>
  );
}

/** Encima de las líneas: la cinta del marcador y las notas sueltas de la página. */
export function NotasDePagina({ anotaciones, abierta, alAbrir, alGuardar, alQuitar }: { anotaciones: AnotacionLibro[]; abierta: string | null; alAbrir: (id: string | null) => void; alGuardar: (a: AnotacionLibro) => void; alQuitar: (id: string) => void }) {
  const marcada = anotaciones.some((a) => a.tipo === 'marcador');
  return (
    <div class="vs-notas-pagina">
      {marcada && <span class="vs-cinta" title={tr('Página marcada')} />}
      {anotaciones
        .filter((a) => a.tipo === 'nota' && a.punto)
        .map((a) => (
          <NotaPagina key={a.id} a={a} abierta={abierta === a.id} alAbrir={() => alAbrir(a.id)} alCerrar={() => alAbrir(null)} alGuardar={alGuardar} alQuitar={() => alQuitar(a.id)} />
        ))}
    </div>
  );
}

/** El panel con todo lo anotado en el libro, por páginas. */
export function PanelNotas({ titulo, anotaciones, actual, alIr, alGuardar, alQuitar }: { titulo: string; anotaciones: AnotacionLibro[]; actual: number[]; alIr: (pagina: number) => void; alGuardar: (a: AnotacionLibro) => void; alQuitar: (id: string) => void }) {
  const [editando, fijarEditando] = useState<string | null>(null);
  const [copiadas, fijarCopiadas] = useState(false);
  const grupos = porPagina(anotaciones);
  const copiar = async () => {
    const texto = notasComoTexto(titulo, anotaciones, { pagina: (n) => tr('Página {0}', n), marcador: tr('Marcador'), nota: tr('Nota') });
    await navigator.clipboard.writeText(texto);
    fijarCopiadas(true);
    setTimeout(() => fijarCopiadas(false), 2000);
  };
  return (
    <aside class="vs-panel vs-panel-notas" aria-label={tr('Notas y marcadores')}>
      <div class="vs-notas-cab">
        <b>{tr('Notas y marcadores')}</b>
        <span class="num">{anotaciones.length}</span>
        {anotaciones.length > 0 && (
          <button class="btn chico fantasma" data-tip={tr('Copia todas las notas como texto, para pegarlas en otra parte')} onClick={() => copiar().catch(console.error)}>
            <Icono n={copiadas ? 'ok' : 'copiar'} t={13} /> {copiadas ? tr('Copiadas') : tr('Copiar')}
          </button>
        )}
      </div>
      {grupos.length === 0 && <p class="ayuda vs-notas-vacio">{tr('Aún no hay nada anotado. Marca una página, resalta una línea desde su panel o añade una nota sobre la página.')}</p>}
      {grupos.map((g) => (
        <section key={g.pagina} class={`vs-notas-grupo ${actual.includes(g.pagina) ? 'actual' : ''}`}>
          <button class="vs-notas-pagina-ir" onClick={() => alIr(g.pagina)}>
            {tr('Página {0}', g.pagina + 1)}
          </button>
          <ul>
            {g.anotaciones.map((a) => (
              <li key={a.id} class={`vs-nota-item ${a.tipo} ${a.color ?? ''}`}>
                {editando === a.id ? (
                  <EditorNota
                    inicial={a.nota ?? ''}
                    etiqueta={a.tipo === 'nota' ? tr('Escribe la nota') : tr('Escribe un comentario')}
                    alGuardar={(nota) => {
                      const { nota: _n, ...resto } = a;
                      if (a.tipo === 'nota' && !nota) alQuitar(a.id);
                      else alGuardar(nota ? { ...resto, nota } : resto);
                      fijarEditando(null);
                    }}
                    alCancelar={() => fijarEditando(null)}
                  />
                ) : (
                  <>
                    <button class="vs-nota-item-ir" onClick={() => alIr(a.pagina)}>
                      <Icono n={a.tipo === 'marcador' ? 'marcador' : a.tipo === 'nota' ? 'nota' : 'frases'} t={13} />
                      {a.tipo === 'marcador' ? (
                        <span>{tr('Marcador')}</span>
                      ) : a.tipo === 'resaltado' ? (
                        <span class="vs-nota-item-texto">
                          <q lang={lengua.value.id}>{a.texto}</q>
                          {a.nota && <span class="vs-nota-comentario">{a.nota}</span>}
                        </span>
                      ) : (
                        <span class="vs-nota-item-texto">{a.nota || tr('Nota sin texto')}</span>
                      )}
                    </button>
                    <span class="vs-nota-item-acciones">
                      {a.tipo !== 'marcador' && (
                        <button class="btn-icono chico" aria-label={a.tipo === 'nota' ? tr('Editar la nota') : a.nota ? tr('Editar el comentario') : tr('Comentar')} data-tip={a.tipo === 'nota' ? tr('Editar la nota') : a.nota ? tr('Editar el comentario') : tr('Comentar')} onClick={() => fijarEditando(a.id)}>
                          <Icono n="lapiz" t={13} />
                        </button>
                      )}
                      <button class="btn-icono chico" aria-label={tr('Quitar')} data-tip={tr('Quitar')} onClick={() => alQuitar(a.id)}>
                        <Icono n="basura" t={13} />
                      </button>
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </aside>
  );
}
