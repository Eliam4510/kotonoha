// El editor del Cuaderno, con ProseMirror (MIT): se escribe con formato, como en un procesador de notas, y lo que se guarda
// es el Markdown de siempre (nucleo/documento.ts). Títulos, listas con subpuntos, citas, código y negritas, con botones y
// con los atajos de costumbre (# , - , 1. , > ). Lo pegado entra con su estructura y sin el furigana de la página.

import { baseKeymap, chainCommands, lift, setBlockType, toggleMark, wrapIn } from 'prosemirror-commands';
import { history, redo, undo } from 'prosemirror-history';
import { InputRule, inputRules, textblockTypeInputRule, wrappingInputRule } from 'prosemirror-inputrules';
import { keymap } from 'prosemirror-keymap';
import { type Node as NodoPM, type NodeType, Schema, Slice } from 'prosemirror-model';
import { liftListItem, sinkListItem, splitListItem, wrapInList } from 'prosemirror-schema-list';
import { type Command, EditorState, Plugin } from 'prosemirror-state';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';
import { useEffect, useRef, useState } from 'preact/hooks';
import { tm, tr } from '../compartido/i18n';
import { aDocumento, aMarkdown, type NodoDoc } from '../nucleo/documento';
import { textoConEstructura } from '../nucleo/estructura';
import { Icono } from '../ui/iconos';
import { lengua } from '../ui/lengua';

export const esquema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*', parseDOM: [{ tag: 'p' }], toDOM: () => ['p', 0] },
    heading: {
      group: 'block',
      content: 'inline*',
      attrs: { level: { default: 1 } },
      defining: true,
      parseDOM: [1, 2, 3].map((level) => ({ tag: `h${level}`, attrs: { level } })),
      toDOM: (n) => [`h${n.attrs.level}`, 0],
    },
    blockquote: { group: 'block', content: 'paragraph+', defining: true, parseDOM: [{ tag: 'blockquote' }], toDOM: () => ['blockquote', 0] },
    code_block: { group: 'block', content: 'text*', marks: '', code: true, defining: true, parseDOM: [{ tag: 'pre', preserveWhitespace: 'full' }], toDOM: () => ['pre', ['code', 0]] },
    horizontal_rule: { group: 'block', parseDOM: [{ tag: 'hr' }], toDOM: () => ['hr'] },
    bullet_list: { group: 'block', content: 'list_item+', parseDOM: [{ tag: 'ul' }], toDOM: () => ['ul', 0] },
    ordered_list: {
      group: 'block',
      content: 'list_item+',
      attrs: { order: { default: 1 } },
      parseDOM: [{ tag: 'ol', getAttrs: (d) => ({ order: Number((d as HTMLElement).getAttribute('start') ?? 1) || 1 }) }],
      toDOM: (n) => (n.attrs.order === 1 ? ['ol', 0] : ['ol', { start: n.attrs.order }, 0]),
    },
    list_item: { content: 'paragraph (bullet_list | ordered_list)*', defining: true, parseDOM: [{ tag: 'li' }], toDOM: () => ['li', 0] },
    // Lo que el editor no edita pero conserva: una tabla, tal como está en el Markdown, y la marca de una grabación dictada.
    tabla: { group: 'block', atom: true, attrs: { md: { default: '' } }, toDOM: (n) => ['pre', { class: 'cu-tabla', contenteditable: 'false' }, String(n.attrs.md)] },
    dictado: { group: 'block', atom: true, attrs: { id: { default: '' } }, toDOM: () => ['div', { class: 'cu-dictado', contenteditable: 'false' }, tr('Grabación del dictado')] },
    text: { group: 'inline' },
    hard_break: { inline: true, group: 'inline', selectable: false, parseDOM: [{ tag: 'br' }], toDOM: () => ['br'] },
  },
  marks: { strong: { parseDOM: [{ tag: 'strong' }, { tag: 'b' }], toDOM: () => ['strong', 0] } },
});

const N = esquema.nodes;

/** El punto medio de ancho completo, que en japonés hace de viñeta. */
const PUNTO_MEDIO = String.fromCharCode(0x30fb);

/** Los atajos al escribir: # título, - o el punto medio para una lista, 1. para una numerada, > para una cita. */
function atajos(): Plugin {
  const reglas: InputRule[] = [
    textblockTypeInputRule(/^(#{1,3})\s$/, N.heading, (m) => ({ level: m[1].length })),
    wrappingInputRule(new RegExp(`^\\s*([-+*]|${PUNTO_MEDIO})\\s$`), N.bullet_list),
    wrappingInputRule(/^(\d+)\.\s$/, N.ordered_list, (m) => ({ order: Number(m[1]) }), (m, n) => n.childCount + Number(n.attrs.order) === Number(m[1])),
    wrappingInputRule(/^\s*>\s$/, N.blockquote),
    textblockTypeInputRule(/^```$/, N.code_block),
  ];
  return inputRules({ rules: reglas });
}

/** Un texto de ejemplo en el documento vacío, como en los editores de notas. */
function textoDeEjemplo(texto: () => string): Plugin {
  return new Plugin({
    props: {
      decorations(state) {
        const d = state.doc;
        const primero = d.firstChild;
        if (d.childCount !== 1 || !primero?.isTextblock || primero.content.size) return null;
        return DecorationSet.create(d, [Decoration.node(0, primero.nodeSize, { class: 'cu-vacio', 'data-ejemplo': texto() })]);
      },
    },
  });
}

/** Lo pegado, con su estructura: lo copiado de una página trae HTML; del chat de Claude, Markdown. */
function pegar(view: EditorView, e: ClipboardEvent): boolean {
  const html = e.clipboardData?.getData('text/html');
  const texto = e.clipboardData?.getData('text/plain');
  // Dentro del código, el texto tal cual.
  if (view.state.selection.$from.parent.type.spec.code) return false;
  const md = textoConEstructura(html, texto);
  if (!md) return false;
  const doc = esquema.nodeFromJSON(aDocumento(md));
  view.dispatch(view.state.tr.replaceSelection(Slice.maxOpen(doc.content)).scrollIntoView());
  return true;
}

const enLista = (state: EditorState, tipo: NodeType) => {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) if ($from.node(d).type === tipo) return true;
  return false;
};

/** Pone o quita una lista: si ya se está en una de ese tipo, se sale; si es de otro, cambia. */
const alternarLista = (tipo: NodeType): Command => (state, dispatch, view) => {
  if (enLista(state, tipo)) return liftListItem(N.list_item)(state, dispatch, view);
  const otra = tipo === N.bullet_list ? N.ordered_list : N.bullet_list;
  if (enLista(state, otra)) {
    // Fuera de la otra, y dentro de esta: dos pasos que se deshacen juntos.
    if (!dispatch) return true;
    liftListItem(N.list_item)(state, dispatch, view);
    const despues = view!.state;
    return wrapInList(tipo)(despues, dispatch, view);
  }
  return wrapInList(tipo)(state, dispatch, view);
};

const alternarCita: Command = (state, dispatch, view) => {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) if ($from.node(d).type === N.blockquote) return lift(state, dispatch, view);
  return wrapIn(N.blockquote)(state, dispatch, view);
};

export function crearEstado(md: string, ejemplo: () => string): EditorState {
  return EditorState.create({
    doc: esquema.nodeFromJSON(aDocumento(md)),
    plugins: [
      atajos(),
      keymap({
        'Mod-z': undo,
        'Mod-y': redo,
        'Mod-Shift-z': redo,
        'Mod-b': toggleMark(esquema.marks.strong),
        Enter: splitListItem(N.list_item),
        Tab: sinkListItem(N.list_item),
        'Shift-Tab': liftListItem(N.list_item),
        'Mod-Alt-0': setBlockType(N.paragraph),
        'Mod-Alt-1': setBlockType(N.heading, { level: 1 }),
        'Mod-Alt-2': setBlockType(N.heading, { level: 2 }),
        'Mod-Alt-3': setBlockType(N.heading, { level: 3 }),
        // Un salto de línea dentro del párrafo, como en el Markdown: cada línea en su renglón.
        'Shift-Enter': chainCommands((s, d) => {
          if (d) d(s.tr.replaceSelectionWith(N.hard_break.create()).scrollIntoView());
          return true;
        }),
      }),
      keymap(baseKeymap),
      history(),
      textoDeEjemplo(ejemplo),
    ],
  });
}

type TipoBloque = 'parrafo' | 'titulo1' | 'titulo2' | 'titulo3' | 'codigo';

interface Activos {
  bloque: TipoBloque;
  vinetas: boolean;
  numerada: boolean;
  cita: boolean;
  negrita: boolean;
}

function activosDe(state: EditorState): Activos {
  const { $from, from, to, empty } = state.selection;
  const padre = $from.parent;
  const bloque: TipoBloque = padre.type === N.heading ? (`titulo${padre.attrs.level}` as TipoBloque) : padre.type === N.code_block ? 'codigo' : 'parrafo';
  const strong = esquema.marks.strong;
  const negrita = empty ? !!strong.isInSet(state.storedMarks ?? $from.marks()) : state.doc.rangeHasMark(from, to, strong);
  let cita = false;
  for (let d = $from.depth; d > 0; d--) if ($from.node(d).type === N.blockquote) cita = true;
  return { bloque, vinetas: enLista(state, N.bullet_list), numerada: enLista(state, N.ordered_list), cita, negrita };
}

export interface ApiEditor {
  /** Todo el texto por otro, en un paso que se deshace con Ctrl+Z (lo que hace «Organizar»). */
  reemplazar(md: string): void;
  /** Al final, en bloques nuevos (lo que llega del portapapeles o de un dictado). */
  anadir(md: string): void;
  /** Donde está el cursor, como si se pegara. */
  insertar(md: string): void;
  enfocar(): void;
}

const BLOQUES: { id: TipoBloque; nombre: string }[] = [
  { id: 'parrafo', nombre: tm('Texto') },
  { id: 'titulo1', nombre: tm('Título') },
  { id: 'titulo2', nombre: tm('Subtítulo') },
  { id: 'titulo3', nombre: tm('Apartado') },
  { id: 'codigo', nombre: tm('Código') },
];

const comandoDeBloque = (id: TipoBloque): Command =>
  id === 'parrafo' ? setBlockType(N.paragraph) : id === 'codigo' ? setBlockType(N.code_block) : setBlockType(N.heading, { level: Number(id.slice(-1)) });

export function EditorCuaderno({ inicial, alCambiar, api, ejemplo, extra }: { inicial: string; alCambiar: (md: string) => void; api?: { current: ApiEditor | null }; ejemplo: string; extra?: preact.ComponentChildren }) {
  const host = useRef<HTMLDivElement>(null);
  const vista = useRef<EditorView | null>(null);
  const alCambiarRef = useRef(alCambiar);
  alCambiarRef.current = alCambiar;
  const ejemploRef = useRef(ejemplo);
  ejemploRef.current = ejemplo;
  const [activos, fijarActivos] = useState<Activos | null>(null);

  useEffect(() => {
    const view: EditorView = new EditorView(host.current!, {
      state: crearEstado(inicial, () => ejemploRef.current),
      attributes: { class: 'cu-editor', lang: lengua.value.id, spellcheck: 'false' },
      dispatchTransaction(t) {
        const nuevo = view.state.apply(t);
        view.updateState(nuevo);
        fijarActivos(activosDe(nuevo));
        if (t.docChanged) alCambiarRef.current(aMarkdown(nuevo.doc.toJSON() as NodoDoc));
      },
      handlePaste: (v, e) => pegar(v, e),
    });
    vista.current = view;
    fijarActivos(activosDe(view.state));
    if (api) {
      api.current = {
        reemplazar(md) {
          const doc: NodoPM = esquema.nodeFromJSON(aDocumento(md));
          view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, doc.content).scrollIntoView());
        },
        anadir(md) {
          const doc: NodoPM = esquema.nodeFromJSON(aDocumento(md));
          const actual = view.state.doc;
          const vacio = actual.childCount === 1 && actual.firstChild!.isTextblock && !actual.firstChild!.content.size;
          view.dispatch(vacio ? view.state.tr.replaceWith(0, actual.content.size, doc.content) : view.state.tr.insert(actual.content.size, doc.content));
        },
        insertar(md) {
          const doc: NodoPM = esquema.nodeFromJSON(aDocumento(md));
          view.dispatch(view.state.tr.replaceSelection(Slice.maxOpen(doc.content)).scrollIntoView());
          view.focus();
        },
        enfocar: () => view.focus(),
      };
    }
    return () => {
      if (api) api.current = null;
      view.destroy();
      vista.current = null;
    };
  }, []);

  const ejecutar = (c: Command) => {
    const v = vista.current;
    if (!v) return;
    c(v.state, v.dispatch, v);
    v.focus();
  };

  return (
    <div class="cu-marco">
      <div class="cu-herramientas" role="toolbar" aria-label={tr('Formato')}>
        <select
          class="selector cu-bloque"
          aria-label={tr('Tipo de bloque')}
          value={activos?.bloque ?? 'parrafo'}
          onChange={(e) => ejecutar(comandoDeBloque(e.currentTarget.value as TipoBloque))}
        >
          {BLOQUES.map((b) => <option key={b.id} value={b.id}>{tr(b.nombre)}</option>)}
        </select>
        <button class={`btn-icono chico ${activos?.vinetas ? 'activo' : ''}`} aria-pressed={!!activos?.vinetas} aria-label={tr('Lista')} data-tip={tr('Lista · escribe «- » al empezar una línea')} onMouseDown={(e) => e.preventDefault()} onClick={() => ejecutar(alternarLista(N.bullet_list))}><Icono n="vinetas" t={16} /></button>
        <button class={`btn-icono chico ${activos?.numerada ? 'activo' : ''}`} aria-pressed={!!activos?.numerada} aria-label={tr('Lista numerada')} data-tip={tr('Lista numerada · escribe «1. » al empezar una línea')} onMouseDown={(e) => e.preventDefault()} onClick={() => ejecutar(alternarLista(N.ordered_list))}><Icono n="lista-numerada" t={16} /></button>
        <button class={`btn-icono chico ${activos?.cita ? 'activo' : ''}`} aria-pressed={!!activos?.cita} aria-label={tr('Cita')} data-tip={tr('Cita · escribe «> » al empezar una línea')} onMouseDown={(e) => e.preventDefault()} onClick={() => ejecutar(alternarCita)}><Icono n="frases" t={16} /></button>
        <button class={`btn-icono chico ${activos?.negrita ? 'activo' : ''}`} aria-pressed={!!activos?.negrita} aria-label={tr('Negrita')} data-tip={tr('Negrita · Ctrl+B')} onMouseDown={(e) => e.preventDefault()} onClick={() => ejecutar(toggleMark(esquema.marks.strong))}><Icono n="negrita" t={16} /></button>
        <span class="cu-separacion" aria-hidden="true" />
        <button class="btn-icono chico" aria-label={tr('Subpunto')} data-tip={tr('Subpunto · Tab; un nivel menos, Mayús+Tab')} onMouseDown={(e) => e.preventDefault()} onClick={() => ejecutar(sinkListItem(N.list_item))}><Icono n="sangria" t={16} /></button>
        <button class="btn-icono chico" aria-label={tr('Deshacer')} data-tip={tr('Deshacer · Ctrl+Z')} onMouseDown={(e) => e.preventDefault()} onClick={() => ejecutar(undo)}><Icono n="deshacer" t={16} /></button>
        <button class="btn-icono chico" aria-label={tr('Rehacer')} data-tip={tr('Rehacer · Ctrl+Y')} onMouseDown={(e) => e.preventDefault()} onClick={() => ejecutar(redo)}><Icono n="rehacer" t={16} /></button>
        {extra && <span class="cu-herramientas-extra">{extra}</span>}
      </div>
      <div ref={host} class="cu-hoja" />
    </div>
  );
}
