// El panel de una línea de la página, del propio PDF o leída por el OCR: su texto con furigana y palabras que se pueden
// consultar, como un subtítulo, y debajo la ficha de la palabra elegida, que se marca también en la página. Las líneas de
// alrededor van como contexto para Claude.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Ajustes } from '../compartido/ajustes';
import { tr } from '../compartido/i18n';
import { alRecibirEvento, motor } from '../compartido/rpc';
import type { AnotacionLibro, ColorAnotacion, PalabraToken } from '../compartido/tipos';
import { motorDe } from '../lenguas/motor';
import { fraseConNegrita } from '../nucleo/frases';
import { alinearSuperficies } from '../nucleo/lectorTexto';
import type { LineaEditada } from '../nucleo/ediciones';
import type { LineaOcr } from '../nucleo/ocr';
import { enviarAlCreador } from '../ui/borrador';
import { Ficha } from '../ui/Ficha';
import { Icono } from '../ui/iconos';
import { lecturaDeTarjeta, lengua } from '../ui/lengua';
import { COLORES, EditorNota, resaltarEn } from './Anotaciones';

/** El tramo del texto de la línea que se ha seleccionado en el panel, de palabra en palabra. */
function tramoSeleccionado(raiz: HTMLElement, sitios: ({ inicio: number; fin: number } | null)[]): { inicio: number; fin: number } | null {
  const s = window.getSelection();
  if (!s || s.isCollapsed || !s.anchorNode || !s.focusNode || !raiz.contains(s.anchorNode) || !raiz.contains(s.focusNode)) return null;
  const k = (n: Node) => Number((n instanceof Element ? n : n.parentElement)?.closest<HTMLElement>('[data-k]')?.dataset.k ?? NaN);
  const a = k(s.anchorNode);
  const b = k(s.focusNode);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  const desde = sitios[Math.min(a, b)];
  const hasta = sitios[Math.max(a, b)];
  return desde && hasta && hasta.fin > desde.inicio ? { inicio: desde.inicio, fin: hasta.fin } : null;
}

/**
 * Resaltar o subrayar la línea entera o solo un tramo: la palabra elegida o lo seleccionado arrastrando. Lo normal es la
 * línea: tocar la página ya elige una palabra, y eso no debe cambiar lo que se resalta. Seleccionar arrastrando sí.
 */
function Resaltar({ linea, tramo, seleccionado, alResaltar }: { linea: string; tramo: { inicio: number; fin: number } | null; seleccionado: boolean; alResaltar: (estilo: 'fondo' | 'subrayado', color: ColorAnotacion, tramo: { inicio: number; fin: number } | null) => void }) {
  const [soloTramo, fijarSoloTramo] = useState(false);
  useEffect(() => fijarSoloTramo(seleccionado), [seleccionado, tramo?.inicio, tramo?.fin]);
  const que = tramo ? linea.slice(tramo.inicio, tramo.fin) : '';
  const elegido = soloTramo && tramo ? tramo : null;
  return (
    <div class="vs-resaltar">
      <span class="ayuda vs-resaltar-que">
        <Icono n="resaltar" t={13} /> {tr('Resaltar')}
      </span>
      {tramo && que !== linea ? (
        <span class="segmentado vs-resaltar-objetivo" role="radiogroup" aria-label={tr('Qué resaltar')}>
          <button role="radio" aria-checked={!elegido} class={elegido ? '' : 'activo'} onClick={() => fijarSoloTramo(false)}>{tr('La línea')}</button>
          <button role="radio" aria-checked={!!elegido} class={elegido ? 'activo' : ''} lang={lengua.value.id} onClick={() => fijarSoloTramo(true)}>{tr('Solo «{0}»', que)}</button>
        </span>
      ) : (
        <span class="ayuda vs-resaltar-linea">{tr('La línea entera; para resaltar solo una parte, elige una palabra o selecciónala arrastrando.')}</span>
      )}
      <span class="vs-resaltar-botones">
        {COLORES.map((c) => (
          <button key={c} class={`vs-color ${c}`} aria-label={resaltarEn(c)} data-tip={resaltarEn(c)} onClick={() => alResaltar('fondo', c, elegido)} />
        ))}
        <button class="btn chico fantasma" data-tip={tr('Una línea debajo, en lugar del fondo de color')} onClick={() => alResaltar('subrayado', 'rosa', elegido)}>
          <Icono n="subrayar" t={13} /> {tr('Subrayar')}
        </button>
      </span>
    </div>
  );
}

export function PanelLinea({ lineas, indice, caracter, ajustes, titulo, alMover, alCerrar, alMarcar, alEditar, alRestaurar, resaltados = [], alResaltar, alGuardarAnotacion, alQuitarAnotacion }: {
  lineas: LineaEditada<LineaOcr>[];
  indice: number;
  /** La letra que se tocó en la página: su palabra se elige en cuanto la línea esté analizada. */
  caracter?: number;
  ajustes: Ajustes;
  titulo: string;
  alMover: (paso: number) => void;
  alCerrar: () => void;
  /** Dónde está, en el texto de la línea, la palabra elegida: para marcarla en la página. */
  alMarcar?: (tramo: { inicio: number; fin: number } | null) => void;
  /** Guarda el texto escrito a mano para la línea. */
  alEditar?: (texto: string) => Promise<void>;
  /** Vuelve al texto leído, sin lo editado. */
  alRestaurar?: () => Promise<void>;
  /** Los resaltados de esta línea. */
  resaltados?: AnotacionLibro[];
  /** Resalta o subraya el tramo elegido, o la línea entera si no hay tramo. */
  alResaltar?: (estilo: 'fondo' | 'subrayado', color: ColorAnotacion, tramo: { inicio: number; fin: number } | null) => void;
  alGuardarAnotacion?: (a: AnotacionLibro) => void;
  alQuitarAnotacion?: (id: string) => void;
}) {
  const linea = lineas[indice];
  // Lo seleccionado en el texto del panel, para resaltar solo eso; y el resaltado cuyo comentario se está escribiendo.
  const [seleccion, fijarSeleccion] = useState<{ inicio: number; fin: number } | null>(null);
  const [comentando, fijarComentando] = useState<string | null>(null);
  const texto = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    fijarSeleccion(null);
    fijarComentando(null);
  }, [indice, linea.texto]);
  // Editar la línea: el texto que se está escribiendo, o null si no se está editando.
  const [borrador, fijarBorrador] = useState<string | null>(null);
  useEffect(() => fijarBorrador(null), [indice, linea.texto]);
  const guardar = async () => {
    const texto = (borrador ?? '').replace(/\s*\n\s*/g, '').trim();
    if (texto && alEditar) await alEditar(texto);
    fijarBorrador(null);
  };
  // Lo analizado va con su texto: al cambiar de línea, el de la anterior no vale ni un momento.
  const [analizado, fijarAnalizado] = useState<{ texto: string; tokens: PalabraToken[] } | null>(null);
  const tokens = analizado?.texto === linea.texto ? analizado.tokens : [];
  const sitios = useMemo(() => alinearSuperficies(linea.texto, tokens.map((t) => t.superficie)), [linea.texto, tokens]);
  const [elegida, fijarElegida] = useState<number | null>(null);

  const analizar = () => {
    const texto = linea.texto;
    motor
      .analizarTexto(texto)
      .then((t) => fijarAnalizado({ texto, tokens: t[0] ?? [] }))
      .catch(console.error);
  };

  useEffect(() => {
    fijarElegida(null);
    analizar();
    return alRecibirEvento((e) => {
      if (e.tipo === 'palabras' || e.tipo === 'palabrasRecargar') analizar();
    });
  }, [linea.texto]);

  // La palabra tocada en la página se elige una sola vez: si después se elige otra aquí, volver a analizar no la cambia.
  const aplicado = useRef('');
  useEffect(() => {
    const clave = `${linea.texto}|${caracter}`;
    if (caracter === undefined || !tokens.length || aplicado.current === clave) return;
    aplicado.current = clave;
    const k = sitios.findIndex((s, i) => !!s && s.inicio <= caracter && caracter < s.fin && tokens[i].esPalabra);
    if (k >= 0) fijarElegida(k);
  }, [caracter, tokens, sitios]);

  useEffect(() => {
    const s = elegida !== null ? sitios[elegida] : null;
    alMarcar?.(s ? { inicio: s.inicio, fin: s.fin } : null);
  }, [elegida, sitios]);

  const palabra = elegida !== null ? tokens[elegida] : null;
  const antes = lineas.slice(Math.max(0, indice - 6), indice).map((l) => l.texto);
  const despues = lineas.slice(indice + 1, indice + 7).map((l) => l.texto);

  return (
    <aside class="vs-panel vs-panel-linea" aria-label={tr('Texto de la página')}>
      <div class="vs-panel-cab">
        <button class="btn-icono chico" aria-label={tr('Línea anterior')} data-tip={tr('Línea anterior')} disabled={indice === 0} onClick={() => alMover(-1)}><Icono n="flecha-arriba" t={15} /></button>
        <span class="num">{indice + 1} / {lineas.length}</span>
        <button class="btn-icono chico" aria-label={tr('Línea siguiente')} data-tip={tr('Línea siguiente')} disabled={indice >= lineas.length - 1} onClick={() => alMover(1)}><Icono n="flecha-abajo" t={15} /></button>
        <button class="btn-icono chico vs-cerrar" aria-label={tr('Cerrar')} onClick={alCerrar}><Icono n="cerrar" t={15} /></button>
      </div>
      {borrador !== null ? (
        <div class="vs-editar">
          <textarea
            class="campo vs-editar-campo"
            lang={lengua.value.id}
            aria-label={tr('Texto de la línea')}
            value={borrador}
            rows={Math.min(5, Math.max(2, Math.ceil(borrador.length / 18)))}
            ref={(el) => {
              // Al abrirse, el cursor ya está dentro y el texto elegido, para escribir encima sin más.
              if (el && !el.dataset.listo) {
                el.dataset.listo = '1';
                el.focus();
                el.select();
              }
            }}
            onInput={(e) => fijarBorrador(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
                e.preventDefault();
                void guardar();
              } else if (e.key === 'Escape') {
                e.stopPropagation();
                fijarBorrador(null);
              }
            }}
          />
          <div class="vs-editar-botones">
            <button class="btn chico fantasma" onClick={() => fijarBorrador(null)}>{tr('Cancelar')}</button>
            <button class="btn chico primario" onClick={() => void guardar()} disabled={!borrador.trim()}>{tr('Guardar')}</button>
          </div>
        </div>
      ) : (
      <p
        ref={texto}
        class="vs-linea-texto"
        lang={lengua.value.id}
        // Seleccionar con el ratón unas palabras deja elegido ese tramo para resaltarlo.
        onMouseUp={() => texto.current && fijarSeleccion(tramoSeleccionado(texto.current, sitios))}
        onKeyUp={() => texto.current && fijarSeleccion(tramoSeleccionado(texto.current, sitios))}
      >
        {tokens.length
          ? tokens.map((p, k) =>
              p.esPalabra ? (
                <span
                  key={k}
                  data-k={k}
                  class={['pal', `est-${p.estado}`, p.rastreada ? 'rastreada' : '', p.patron && ajustes.colorAcento !== 'ninguno' ? `ac-${p.patron}` : '', elegida === k ? 'ap-elegida' : ''].join(' ')}
                  onClick={() => {
                    // Un clic suelto elige la palabra; al terminar de seleccionar varias, se queda la selección.
                    if (window.getSelection()?.isCollapsed !== false) fijarElegida(k);
                  }}
                >
                  {p.furigana.map((s, j) =>
                    s.lectura && ajustes.furigana !== 'ninguna' ? (
                      <ruby key={j}>{s.texto}<rt>{lengua.value.lectura.visible(s.lectura, ajustes.formatoLectura)}</rt></ruby>
                    ) : (
                      <span key={j}>{s.texto}</span>
                    )
                  )}
                </span>
              ) : (
                <span key={k} data-k={k}>{lengua.value.escritura.pegarSignos(p.superficie)}</span>
              )
            )
          : linea.texto}
      </p>
      )}
      {borrador === null && alEditar && (
        <div class="vs-linea-acciones">
          <button class="btn chico fantasma" data-tip={tr('Cambia el texto de esta línea a mano')} onClick={() => fijarBorrador(linea.texto)}>
            <Icono n="lapiz" t={13} /> {tr('Editar')}
          </button>
          {linea.edicion && (
            <>
              <span class="ayuda" title={linea.original ? tr('Antes: {0}', linea.original) : undefined}>{tr('Editado')}</span>
              <button class="btn chico fantasma" data-tip={linea.original ? tr('Antes: {0}', linea.original) : undefined} onClick={() => void alRestaurar?.()}>
                <Icono n="reiniciar" t={13} /> {tr('Restaurar')}
              </button>
            </>
          )}
        </div>
      )}
      {borrador === null && alResaltar && <Resaltar linea={linea.texto} tramo={seleccion ?? (elegida !== null ? sitios[elegida] : null)} seleccionado={!!seleccion} alResaltar={alResaltar} />}
      {borrador === null && resaltados.length > 0 && (
        <ul class="vs-resaltados-linea">
          {resaltados.map((r) => (
            <li key={r.id} class={`vs-resaltado-linea ${r.color ?? 'amarillo'} ${r.estilo ?? 'fondo'}`}>
              <q lang={lengua.value.id}>{r.texto}</q>
              {comentando === r.id ? (
                <EditorNota
                  inicial={r.nota ?? ''}
                  etiqueta={tr('Escribe un comentario')}
                  alGuardar={(nota) => {
                    const { nota: _n, ...resto } = r;
                    alGuardarAnotacion?.(nota ? { ...resto, nota } : resto);
                    fijarComentando(null);
                  }}
                  alCancelar={() => fijarComentando(null)}
                />
              ) : (
                <>
                  {r.nota && <p class="vs-resaltado-comentario">{r.nota}</p>}
                  <span class="vs-resaltado-acciones">
                    <button class="btn chico fantasma" onClick={() => fijarComentando(r.id)}>
                      <Icono n="lapiz" t={13} /> {r.nota ? tr('Editar el comentario') : tr('Comentar')}
                    </button>
                    <button class="btn chico fantasma" onClick={() => alQuitarAnotacion?.(r.id)}>
                      <Icono n="basura" t={13} /> {r.estilo === 'subrayado' ? tr('Quitar el subrayado') : tr('Quitar el resaltado')}
                    </button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {palabra ? (
        <div class="vs-ficha">
          <Ficha
            key={`${indice}-${elegida}`}
            lema={palabra.lema}
            lectura={palabra.lecturaLema}
            superficie={palabra.superficie}
            flexion={palabra.flexion}
            ajustes={ajustes}
            gramatica={motorDe(lengua.value.id).detectarGramatica(linea.texto)}
            contexto={{ frase: linea.texto, antes, despues, titulo }}
            alCorregirLectura={analizar}
            alEnviar={(r) =>
              enviarAlCreador(
                {
                  palabra: r.lema,
                  lectura: lecturaDeTarjeta(r),
                  frase: fraseConNegrita(tokens, palabra.clave) || linea.texto,
                  definicion: [...new Set(r.entradas.flatMap((e) => e.glosas))].slice(0, 5).join('<br>'),
                  fuente: titulo,
                },
                false
              )
            }
          />
        </div>
      ) : (
        <p class="ayuda vs-pista">{tr('Toca una palabra para ver su ficha.')}</p>
      )}
    </aside>
  );
}
