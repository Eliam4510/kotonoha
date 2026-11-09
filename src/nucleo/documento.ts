// El texto del Cuaderno como documento del editor (el JSON de ProseMirror) y de vuelta a Markdown. El Markdown sigue siendo
// lo que se guarda, el que lee nucleo/estructura.ts: así lo escrito en el editor se lee igual en el Cuaderno, en la
// biblioteca y en la copia de seguridad, y lo de antes se abre en el editor sin perder nada que se viera.

import { marcaDictado } from './dictado';
import { type Bloque, type ElementoLista, empiezaComoEstructura, type Linea, leerEstructura } from './estructura';

/** Un nodo del documento, con la forma del JSON de ProseMirror. */
export interface NodoDoc {
  type: string;
  attrs?: Record<string, unknown>;
  content?: NodoDoc[];
  text?: string;
  marks?: { type: string }[];
}

// ---------- Del Markdown al documento ----------

/** Una línea en trozos de texto, con negrita donde la hay. */
function enLinea(l: Linea): NodoDoc[] {
  const cortes = [...new Set([0, l.texto.length, ...l.negritas.flat()])].sort((a, b) => a - b);
  const salida: NodoDoc[] = [];
  for (let i = 0; i + 1 < cortes.length; i++) {
    const [a, b] = [cortes[i], cortes[i + 1]];
    if (b <= a) continue;
    const negrita = l.negritas.some(([x, y]) => a >= x && b <= y);
    salida.push({ type: 'text', text: l.texto.slice(a, b), ...(negrita ? { marks: [{ type: 'strong' }] } : {}) });
  }
  return salida;
}

/** Las líneas de un párrafo, cada una en su renglón: un salto de línea entre ellas. */
const enLineas = (lineas: Linea[]): NodoDoc[] => lineas.flatMap((l, i) => [...(i ? [{ type: 'hard_break' }] : []), ...enLinea(l)]);

function parrafo(lineas: Linea[]): NodoDoc {
  const content = enLineas(lineas);
  return content.length ? { type: 'paragraph', content } : { type: 'paragraph' };
}

interface ListaArbol {
  ordenada: boolean;
  numero: number;
  items: { el: ElementoLista; sub: ListaArbol | null }[];
}

/** Los elementos de una lista, con su nivel, como listas dentro de otras: cada uno cuelga del último del nivel de arriba. */
function arbolDeLista(elementos: ElementoLista[]): ListaArbol {
  const raiz: ListaArbol = { ordenada: elementos[0].ordenada, numero: elementos[0].numero || 1, items: [] };
  const pila: ListaArbol[] = [raiz];
  for (const el of elementos) {
    // Como mucho, un nivel más que el anterior: no hay sublistas sin elemento del que colgar.
    const nivel = Math.max(0, Math.min(el.nivel, pila.length));
    while (pila.length > nivel + 1) pila.pop();
    if (nivel === pila.length) {
      const padre = pila[pila.length - 1].items.at(-1);
      if (padre) {
        padre.sub ??= { ordenada: el.ordenada, numero: el.numero || 1, items: [] };
        pila.push(padre.sub);
      }
    }
    pila[pila.length - 1].items.push({ el, sub: null });
  }
  return raiz;
}

function nodoLista(l: ListaArbol): NodoDoc {
  return {
    type: l.ordenada ? 'ordered_list' : 'bullet_list',
    ...(l.ordenada ? { attrs: { order: l.numero } } : {}),
    content: l.items.map(({ el, sub }) => ({ type: 'list_item', content: [parrafo(el.lineas), ...(sub ? [nodoLista(sub)] : [])] })),
  };
}

function tablaMd(b: Extract<Bloque, { tipo: 'tabla' }>): string {
  const ancho = Math.max(b.cabecera?.length ?? 0, ...b.filas.map((f) => f.length), 1);
  const fila = (celdas: Linea[]) => `| ${Array.from({ length: ancho }, (_, i) => (celdas[i] ? lineaMd(enLinea(celdas[i])) : '')).join(' | ')} |`;
  const guiones = `| ${Array.from({ length: ancho }, () => '---').join(' | ')} |`;
  return [...(b.cabecera ? [fila(b.cabecera)] : []), guiones, ...b.filas.map(fila)].join('\n');
}

export function aDocumento(md: string): NodoDoc {
  const content: NodoDoc[] = [];
  for (const b of leerEstructura(md)) {
    if (b.tipo === 'parrafo') content.push(parrafo(b.lineas));
    else if (b.tipo === 'titulo') content.push({ type: 'heading', attrs: { level: b.nivel }, ...(b.linea.texto ? { content: enLinea(b.linea) } : {}) });
    else if (b.tipo === 'lista' && b.elementos.length) content.push(nodoLista(arbolDeLista(b.elementos)));
    else if (b.tipo === 'cita') content.push({ type: 'blockquote', content: [parrafo(b.lineas)] });
    else if (b.tipo === 'codigo') {
      const texto = b.lineas.map((l) => l.texto).join('\n');
      content.push({ type: 'code_block', ...(texto ? { content: [{ type: 'text', text: texto }] } : {}) });
    } else if (b.tipo === 'tabla') content.push({ type: 'tabla', attrs: { md: tablaMd(b) } });
    else if (b.tipo === 'separador') content.push({ type: 'horizontal_rule' });
    else if (b.tipo === 'dictado') content.push({ type: 'dictado', attrs: { id: b.id } });
  }
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
}

// ---------- Del documento al Markdown ----------

/** El texto con lo que el Markdown leería como marca escapado: la barra, los asteriscos y la barra vertical. */
const escapar = (s: string) => s.replace(/[\\*|]/g, (c) => `\\${c}`);

/** Unos trozos de una línea, con sus negritas. Las negritas seguidas se juntan en una. */
function lineaMd(trozos: NodoDoc[]): string {
  let salida = '';
  let enNegrita = false;
  for (const t of trozos) {
    if (t.type !== 'text' || !t.text) continue;
    const negrita = !!t.marks?.some((m) => m.type === 'strong');
    if (negrita !== enNegrita) {
      salida += '**';
      enNegrita = negrita;
    }
    salida += escapar(t.text);
  }
  return enNegrita ? `${salida}**` : salida;
}

/** Las líneas de un contenido en línea, partido por sus saltos de línea. */
function lineasDe(contenido: NodoDoc[] = []): string[] {
  const lineas: NodoDoc[][] = [[]];
  for (const n of contenido) {
    if (n.type === 'hard_break') lineas.push([]);
    else lineas[lineas.length - 1].push(n);
  }
  return lineas.map(lineaMd);
}

/** Una línea de párrafo que se leería como un título, una viñeta o un número va escapada: sigue siendo texto. */
const comoTexto = (linea: string) => (empiezaComoEstructura(linea) ? `\\${linea.replace(/^\s+/, '')}` : linea);

const esLista = (n: NodoDoc) => n.type === 'bullet_list' || n.type === 'ordered_list';

function listaMd(n: NodoDoc, nivel: number): string {
  const sangria = '  '.repeat(nivel);
  let numero = Number(n.attrs?.order ?? 1) || 1;
  const partes: string[] = [];
  for (const item of n.content ?? []) {
    const marca = n.type === 'ordered_list' ? `${numero++}. ` : '- ';
    const hijos = item.content ?? [];
    // El primer párrafo es el elemento; los demás párrafos lo continúan, y las listas de dentro van un nivel más.
    const lineas = hijos.filter((h) => h.type === 'paragraph').flatMap((p, i) => lineasDe(p.content).filter((l, k) => (i === 0 && k === 0) || l.trim()));
    // Un elemento vacío conserva el espacio tras la marca: sin él, «-» solo no sería una viñeta.
    partes.push(`${sangria}${marca}${lineas[0] ?? ''}`);
    for (const l of lineas.slice(1)) partes.push(`${sangria}  ${comoTexto(l)}`);
    for (const sub of hijos.filter(esLista)) partes.push(listaMd(sub, nivel + 1));
  }
  return partes.join('\n');
}

function bloqueMd(n: NodoDoc): string | null {
  switch (n.type) {
    case 'paragraph': {
      const lineas = lineasDe(n.content);
      return lineas.some((l) => l.trim()) ? lineas.map(comoTexto).join('\n') : null;
    }
    case 'heading': {
      const texto = lineasDe(n.content).join(' ').trim();
      return texto ? `${'#'.repeat(Number(n.attrs?.level ?? 1))} ${texto}` : null;
    }
    case 'bullet_list':
    case 'ordered_list':
      return n.content?.length ? listaMd(n, 0) : null;
    case 'blockquote': {
      const lineas = (n.content ?? []).flatMap((p) => (p.type === 'paragraph' ? lineasDe(p.content) : [])).filter((l) => l.trim());
      return lineas.length ? lineas.map((l) => `> ${l}`).join('\n') : null;
    }
    case 'code_block': {
      const texto = (n.content ?? []).map((t) => t.text ?? '').join('');
      return `\`\`\`\n${texto}\n\`\`\``;
    }
    case 'horizontal_rule':
      return '---';
    case 'tabla':
      return String(n.attrs?.md ?? '') || null;
    case 'dictado':
      return n.attrs?.id ? marcaDictado(String(n.attrs.id)) : null;
    default:
      return null;
  }
}

/** El documento como Markdown: un bloque detrás de otro, separados por una línea en blanco. */
export function aMarkdown(doc: NodoDoc): string {
  return (doc.content ?? [])
    .map(bloqueMd)
    .filter((b): b is string => b !== null)
    .join('\n\n');
}
