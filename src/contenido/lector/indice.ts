// Índice del texto de la página: qué bloques están en la lengua que se estudia y dónde está cada carácter. Solo lee el DOM, nunca lo cambia.

import type { PalabraToken } from '../../compartido/tipos';
import { lengua } from '../../ui/lengua';

/** Trozo de un nodo de texto dentro del texto del bloque. */
export interface TramoNodo {
  nodo: Text;
  /** Desde dónde se usa ese nodo: al partir un texto muy largo, un mismo nodo se reparte entre bloques. */
  base: number;
  inicio: number;
  fin: number;
}

export interface TokenPagina {
  p: PalabraToken;
  inicio: number;
  fin: number;
  rango?: Range;
  /** En qué grupo de color está pintado. */
  resalte?: string;
}

export interface Bloque {
  id: number;
  contenedor: Element;
  tramos: TramoNodo[];
  texto: string;
  tokens: TokenPagina[] | null;
  /** Está cerca de la pantalla: se pinta. */
  cerca: boolean;
}

const OMITIR = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'RT', 'RP', 'RTC', 'TEMPLATE', 'IFRAME', 'OBJECT', 'EMBED', 'CANVAS', 'VIDEO', 'AUDIO', 'SVG', 'MATH', 'KBD', 'TITLE', 'HEAD', 'KOTONOHA-OVERLAY', 'KOTONOHA-LECTOR']);
const CORTAN = new Set(['BR', 'HR']);
const SIEMPRE_BLOQUE = new Set(['BUTTON', 'LI', 'TD', 'TH', 'P', 'DIV', 'SECTION', 'ARTICLE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
const LARGO_MAXIMO = 4000;

let inlinePorElemento = new WeakMap<Element, boolean | 'oculto'>();
let lenguaDeLaClasificacion = '';

/**
 * Si un elemento forma parte de la misma frase que lo que le rodea. `inline-block` también, porque en japonés se usa para
 * partir líneas. Donde las palabras llevan espacios, en cambio, son enlaces de un menú pegados entre sí.
 */
function clasificar(el: Element): boolean | 'oculto' {
  if (lenguaDeLaClasificacion !== lengua.value.id) {
    inlinePorElemento = new WeakMap();
    lenguaDeLaClasificacion = lengua.value.id;
  }
  const guardado = inlinePorElemento.get(el);
  if (guardado !== undefined) return guardado;
  // Fuera del documento no tiene estilos: no se puede saber, y no se debe recordar.
  if (!el.isConnected) return false;
  const d = getComputedStyle(el).display;
  let r: boolean | 'oculto';
  if (d === 'none') r = 'oculto';
  else if (SIEMPRE_BLOQUE.has(el.tagName)) r = d === 'contents' ? true : false;
  else r = d === 'inline' || (d === 'inline-block' && !lengua.value.escritura.palabrasSeparadas) || d === 'contents' || d.startsWith('ruby');
  inlinePorElemento.set(el, r);
  return r;
}

/** Un botón es una frase aparte aunque se vea en línea. */
const esBoton = (el: Element) => el.getAttribute('role') === 'button' || el.tagName === 'SUMMARY' || el.tagName === 'LABEL';

function contenedorDe(n: Node): Element | null {
  let el = n.nodeType === Node.ELEMENT_NODE ? (n as Element) : n.parentElement;
  while (el) {
    const c = clasificar(el);
    if (c === false || esBoton(el)) return el;
    const padre: Element | null = el.parentElement ?? ((el.getRootNode() as ShadowRoot).host as Element | undefined) ?? null;
    if (!padre) return el;
    el = padre;
  }
  return null;
}

let siguienteId = 1;

function idiomaDe(n: Node): string | undefined {
  const el = n.nodeType === Node.ELEMENT_NODE ? (n as Element) : n.parentElement;
  return el?.closest('[lang]')?.getAttribute('lang') ?? undefined;
}

export class IndicePagina {
  bloques = new Set<Bloque>();
  porContenedor = new Map<Element, Bloque[]>();
  private porNodo = new WeakMap<Text, Bloque[]>();
  private sinOrdenar = new Set<Element>();
  paginaEnLengua = false;
  private propios = 0;
  private compartidos = 0;
  /** Árboles de sombra abiertos con texto: hacen falta para saber qué palabra hay bajo el ratón. */
  raicesSombra = new Set<ShadowRoot>();

  /** Reparte en bloques lo que cuelga de `raiz`. Devuelve los que no estaban, y deja como están los que no cambiaron. */
  escanear(raiz: Node): { nuevos: Bloque[]; quitados: Bloque[] } {
    const encontrados: { nodos: Text[]; contenedor: Element }[] = [];
    let actual: Text[] = [];
    const cortar = () => {
      if (actual.length) {
        const contenedor = contenedorDe(actual[0]);
        if (contenedor) encontrados.push({ nodos: actual, contenedor });
      }
      actual = [];
    };
    const visitar = (n: Node) => {
      for (let h = n.firstChild; h; h = h.nextSibling) {
        if (h.nodeType === Node.TEXT_NODE) {
          actual.push(h as Text);
          continue;
        }
        if (h.nodeType !== Node.ELEMENT_NODE) continue;
        const el = h as HTMLElement;
        const tag = el.tagName.toUpperCase();
        if (CORTAN.has(tag)) {
          cortar();
          continue;
        }
        if (OMITIR.has(tag) || el.isContentEditable) {
          // Lo que se salta dentro de una frase no la parte, salvo que sea un campo de texto.
          if (tag === 'TEXTAREA' || tag === 'INPUT' || el.isContentEditable) cortar();
          continue;
        }
        // Lo oculto también se indexa: una pestaña o un acordeón pueden abrirse después, y entonces se pintarán.
        const c = clasificar(el);
        const aparte = c !== true || esBoton(el);
        if (aparte) cortar();
        visitar(el);
        if (el.shadowRoot) {
          cortar();
          this.raicesSombra.add(el.shadowRoot);
          visitar(el.shadowRoot);
          cortar();
        }
        if (aparte) cortar();
      }
    };
    if (raiz.nodeType === Node.ELEMENT_NODE) {
      const el = raiz as HTMLElement;
      if (!OMITIR.has(el.tagName.toUpperCase()) && !el.isContentEditable) visitar(el);
    } else if (raiz.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
      visitar(raiz);
    }
    cortar();

    const { escritura } = lengua.value;
    if (!this.paginaEnLengua) {
      for (const e of encontrados) {
        for (const n of e.nodos) {
          const c = escritura.contar(n.data);
          this.propios += c.propios;
          this.compartidos += c.compartidos;
        }
      }
      this.paginaEnLengua = escritura.paginaEnLengua({ propios: this.propios, compartidos: this.compartidos });
    }

    // Los que ya había bajo esta raíz: los que siguen igual se conservan con su análisis.
    const previos = [...this.bloques].filter((b) => !b.contenedor.isConnected || contieneProfundo(raiz, b.contenedor) || b.tramos.some((t) => contieneProfundo(raiz, t.nodo)));
    const porPrimerNodo = new Map<Text, Bloque[]>();
    for (const b of previos) {
      const lista = porPrimerNodo.get(b.tramos[0].nodo);
      if (lista) lista.push(b);
      else porPrimerNodo.set(b.tramos[0].nodo, [b]);
    }
    const conservados = new Set<Bloque>();
    const nuevos: Bloque[] = [];

    for (const { nodos, contenedor } of encontrados) {
      for (const { texto, tramos } of partir(nodos)) {
        if (!escritura.esDeLaLengua(texto, tramos.map((t) => idiomaDe(t.nodo)).find(Boolean) ?? document.documentElement.lang ?? undefined, this.paginaEnLengua)) continue;
        // Con los mismos nodos, el mismo texto y el mismo contenedor, sigue siendo el mismo bloque.
        const previo = porPrimerNodo.get(tramos[0].nodo)?.find((b) => b.contenedor === contenedor && b.texto === texto && b.tramos[0].base === tramos[0].base && b.tramos.length === tramos.length && b.tramos.every((t, i) => t.nodo === tramos[i].nodo));
        if (previo) {
          conservados.add(previo);
          continue;
        }
        const b: Bloque = { id: siguienteId++, contenedor, tramos, texto, tokens: null, cerca: false };
        this.anadir(b);
        nuevos.push(b);
      }
    }
    const quitados = previos.filter((b) => !conservados.has(b));
    for (const b of quitados) this.quitar(b);
    return { nuevos, quitados };
  }

  private anadir(b: Bloque) {
    this.bloques.add(b);
    const lista = this.porContenedor.get(b.contenedor);
    if (lista) {
      lista.push(b);
      this.sinOrdenar.add(b.contenedor);
    } else {
      this.porContenedor.set(b.contenedor, [b]);
    }
    for (const t of b.tramos) {
      const l = this.porNodo.get(t.nodo);
      if (l) l.push(b);
      else this.porNodo.set(t.nodo, [b]);
    }
  }

  private quitar(b: Bloque) {
    this.bloques.delete(b);
    const lista = this.porContenedor.get(b.contenedor);
    if (lista) {
      const resto = lista.filter((x) => x !== b);
      if (resto.length) this.porContenedor.set(b.contenedor, resto);
      else this.porContenedor.delete(b.contenedor);
    }
    for (const t of b.tramos) {
      const l = this.porNodo.get(t.nodo);
      if (l) this.porNodo.set(t.nodo, l.filter((x) => x !== b));
    }
  }

  /** Los bloques de un contenedor en el orden del documento: un texto que cambia entra al final de la lista. */
  ordenados(contenedor: Element): Bloque[] {
    const lista = this.porContenedor.get(contenedor) ?? [];
    if (this.sinOrdenar.delete(contenedor)) {
      lista.sort((a, b) => {
        const x = a.tramos[0];
        const y = b.tramos[0];
        if (x.nodo === y.nodo) return x.base - y.base;
        return x.nodo.compareDocumentPosition(y.nodo) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
      });
    }
    return lista;
  }

  /** El bloque y la posición en su texto de un punto de un nodo. */
  ubicar(nodo: Text, desplazamiento: number): { bloque: Bloque; posicion: number } | null {
    for (const b of this.porNodo.get(nodo) ?? []) {
      for (const t of b.tramos) {
        if (t.nodo === nodo && desplazamiento >= t.base && desplazamiento - t.base < t.fin - t.inicio) {
          return { bloque: b, posicion: t.inicio + desplazamiento - t.base };
        }
      }
    }
    return null;
  }
}

/** Como contains(), pero entrando en los árboles de sombra. */
function contieneProfundo(raiz: Node, n: Node): boolean {
  let actual: Node | null = n;
  while (actual) {
    if (raiz.contains(actual)) return true;
    const r: Node = actual.getRootNode();
    actual = r instanceof ShadowRoot ? r.host : null;
  }
  return false;
}

/** Texto de un grupo de nodos con su correspondencia. Un texto enorme se parte por frases: se analiza por trozos. */
function partir(nodos: Text[]): { texto: string; tramos: TramoNodo[] }[] {
  const salida: { texto: string; tramos: TramoNodo[] }[] = [];
  let texto = '';
  let tramos: TramoNodo[] = [];
  const cerrar = () => {
    if (texto.trim()) salida.push({ texto, tramos });
    texto = '';
    tramos = [];
  };
  for (const nodo of nodos) {
    let base = 0;
    const dato = nodo.data;
    while (base < dato.length) {
      const hueco = LARGO_MAXIMO - texto.length;
      let fin = dato.length;
      if (dato.length - base > hueco) {
        // Se corta tras un final de frase, y si no lo hay, donde toque.
        const trozo = dato.slice(base, base + hueco);
        const corte = Math.max(...lengua.value.escritura.frase.cortes.map((c) => trozo.lastIndexOf(c)));
        fin = base + (corte > 0 ? corte + 1 : hueco);
      }
      // Los saltos del código fuente se ven como un espacio, y un salto partiría la línea al analizar.
      const parte = dato.slice(base, fin).replace(/[\r\n\t]/g, ' ');
      tramos.push({ nodo, base, inicio: texto.length, fin: texto.length + parte.length });
      texto += parte;
      base = fin;
      if (texto.length >= LARGO_MAXIMO || (base < dato.length && hueco <= 0)) cerrar();
      else if (base < dato.length) cerrar();
    }
  }
  cerrar();
  return salida;
}

/** El punto de un nodo que corresponde a una posición del texto del bloque. */
function puntoEn(b: Bloque, posicion: number, alFinal: boolean): [Text, number] | null {
  let bajo = 0;
  let alto = b.tramos.length - 1;
  while (bajo <= alto) {
    const m = (bajo + alto) >> 1;
    const t = b.tramos[m];
    const dentro = alFinal ? posicion > t.inicio && posicion <= t.fin : posicion >= t.inicio && posicion < t.fin;
    if (dentro) return [t.nodo, t.base + posicion - t.inicio];
    if (posicion < t.inicio || (alFinal && posicion === t.inicio)) alto = m - 1;
    else bajo = m + 1;
  }
  return null;
}

/** Rango de una parte del texto del bloque. Puede abarcar varios nodos, como una palabra partida por un enlace. */
export function rangoDe(b: Bloque, inicio: number, fin: number): Range | null {
  const a = puntoEn(b, inicio, false);
  const z = puntoEn(b, fin, true);
  if (!a || !z || !a[0].isConnected || !z[0].isConnected) return null;
  try {
    const r = new Range();
    r.setStart(a[0], a[1]);
    r.setEnd(z[0], z[1]);
    return r;
  } catch {
    return null;
  }
}

/** Si una palabra ya trae su propia lectura en la página, con <ruby>. */
export function tieneRubyPropio(b: Bloque, inicio: number, fin: number): boolean {
  for (const t of b.tramos) {
    if (t.fin <= inicio) continue;
    if (t.inicio >= fin) break;
    if (t.nodo.parentElement?.closest('ruby')) return true;
  }
  return false;
}

/** Un nodo que no forma parte de la frase que lo rodea: basta con mirarlo a él, sin revisar a su padre. */
export const esAparte = (n: Node): boolean => n.nodeType === Node.ELEMENT_NODE && clasificar(n as Element) !== true;

export { contenedorDe };
