// Lo que se ve encima de la página: colores con la CSS Custom Highlight API y furigana en una capa propia.
//
// Ninguna de las dos cosas añade nada al DOM de la página, así que el texto no se reordena, el marco de React no ve nodos
// extraños, y seleccionar, copiar y buscar en la página siguen igual.
//
// Lo caro es medir, así que se mide lo menos posible:
// - La capa va con el documento: al desplazarlo, las lecturas se mueven solas sin calcular nada.
// - Una caja con scroll propio, como la de un chat, tiene su propia hoja, y a esa hoja la mueve el navegador con el mismo
//   scroll de la caja. Recolocarla a mano la dejaría siempre un fotograma por detrás del texto: se vería una estela.
// - Cada lectura lleva el z-index efectivo de su texto, y el navegador resuelve solo qué tapa a qué.
// - Lo recortado se decide comparando rectángulos, sin preguntar al navegador qué hay en cada punto.
// - Si la caja de un bloque no se ha movido, sus lecturas tampoco: se comprueba una caja en vez de cada palabra.
//
// Lo único que se toca en la página es el interlineado de un texto donde el furigana no cabe: ver abrirLineas().

import type { Ajustes } from '../../compartido/ajustes';
import { compresionLectura, esFondoOscuro, esFondoVisible, interlineadoAbierto, interlineadoNecesario, tamanoLectura, tramosConLectura } from '../../nucleo/lectorTexto';
import { lecturaVisible } from '../../nucleo/tokens';
import { paletaDe } from '../../ui/paletas';
import { type Bloque, rangoDe, tieneRubyPropio, type TokenPagina } from './indice';

declare class ScrollTimeline extends AnimationTimeline {
  constructor(opciones: { source: Element; axis: 'block' | 'inline' });
}

/** Dónde van las lecturas de un texto: el documento, lo fijo a la pantalla o una caja con scroll propio. */
interface Capa {
  /** La caja con scroll. Sin ella, es la capa del documento o la de lo fijo. */
  fuente: Element | null;
  padre: Capa | null;
  /** Recorta las lecturas donde la caja recorta su texto. */
  marco: HTMLElement | null;
  /** Se mueve con el scroll de la caja. */
  hoja: HTMLElement;
  animY: Animation | null;
  animX: Animation | null;
  rangoY: number;
  rangoX: number;
  /** Lo que tapan por arriba y por abajo elementos fijos sobre la caja, como la barra de escribir de un chat. */
  bandaArriba: number;
  bandaAbajo: number;
  marca: string;
  hijos: number;
}

interface Lectura {
  el: HTMLElement;
  rango: Range;
  padre: Element | null;
  capa: Capa;
  texto: string;
  /** Lo tapa algo de la página: entonces la lectura no se muestra. */
  tapada: boolean;
  /** Su texto no se ve: está recortado, oculto o fuera del documento, donde mostrarla añadiría una barra de scroll. */
  fuera: boolean;
  /** Dónde se puso la última vez, para no escribir si nada cambió. */
  marca: string;
  /** Centro de su texto respecto a su capa. */
  cx: number;
  cy: number;
}

/** Las lecturas de un bloque y la caja de su contenedor cuando se colocaron. */
interface Grupo {
  lista: Lectura[];
  capa: Capa;
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

interface InfoCaja {
  posicion: string;
  arriba: string;
  abajo: string;
  /** Tiene scroll propio, y de un modo que su animación pueda seguir: de arriba abajo y de izquierda a derecha. */
  conScroll: boolean;
}

type Origen = { x: number; y: number };

// Sin z-index ni contención en el anfitrión: así no forma un contexto de apilamiento propio, y cada lectura se ordena
// directamente con los elementos de la página.
const ESTILO_CAPA = `
:host { all: initial; position: absolute; left: 0; top: 0; width: 0; height: 0; pointer-events: none; }
.rt { position: absolute; display: block; white-space: nowrap; line-height: 1; font-weight: 500; pointer-events: none; user-select: none; contain: layout style; }
.rt::before { content: attr(data-r); }
.rt.tapada { display: none; }
.rt.vertical { writing-mode: vertical-rl; }
.marco { position: absolute; overflow: hidden; pointer-events: none; }
.hoja { position: absolute; left: 0; top: 0; width: 0; height: 0; will-change: translate, transform; }
.fija { position: fixed; left: 0; top: 0; width: 0; height: 0; }
@media print { :host { display: none; } }
`;

/** Aire mínimo entre líneas, en píxeles, para poner la lectura encima sin tapar la línea de arriba. */
const HUECO_MINIMO = 4;
/** Dónde abrir el interlineado movería el diseño de verdad: menús y botones miden lo que miden. */
const NO_ABRIR = 'button, [role="button"], summary, label, select, nav, footer, [role="navigation"], [role="menu"], [role="menubar"], [role="tablist"], [role="toolbar"], [role="banner"], [role="contentinfo"]';
/** Cuánto de la caja se mira, desde cada borde, buscando lo que la tapa. */
const PROPORCION_BANDA = 0.4;
const PASO_BANDA = 8;
/** La lectura va encima de su palabra. Recortándola un poco antes, no se queda flotando cuando la palabra ya entró debajo. */
const LEVANTE_ABAJO = 10;

const padreDe = (el: Element): Element | null => el.parentElement ?? ((el.getRootNode() as ShadowRoot).host as Element | undefined) ?? null;

/** Si un elemento crea un contexto de apilamiento, y con qué valor cuenta. Sin él, null. */
function nivelPropio(el: Element, cs: CSSStyleDeclaration): number | null {
  const z = parseInt(cs.zIndex, 10);
  const valor = Number.isNaN(z) ? 0 : z;
  if (cs.position === 'fixed' || cs.position === 'sticky') return valor;
  if (!Number.isNaN(z)) {
    if (cs.position !== 'static') return valor;
    const padre = el.parentElement;
    const d = padre ? getComputedStyle(padre).display : '';
    if (d.includes('flex') || d.includes('grid')) return valor;
  }
  const crea = cs.transform !== 'none' || cs.opacity !== '1' || cs.filter !== 'none' || cs.perspective !== 'none' || cs.clipPath !== 'none' || cs.isolation === 'isolate' || cs.mixBlendMode !== 'normal' || /transform|opacity|filter|perspective/.test(cs.willChange) || /paint|layout|strict|content/.test(cs.contain);
  return crea ? 0 : null;
}

export class Pintor {
  private resaltes = new Map<string, Highlight>();
  private hojaPagina = new CSSStyleSheet();
  private anfitrion: HTMLElement;
  private capaRaiz: HTMLElement;
  private raiz: Capa;
  private capas = new Map<Element, Capa>();
  private capasFijas = new Map<number, Capa>();
  /** Cajas con algo pegado dentro: lo pegado no se mueve con su hoja, y hay que mirarlo a mano al desplazarlas. */
  private conPegados = new WeakSet<Element>();
  private reasignar = false;
  private vigiaCapas: ResizeObserver;
  private pendienteRangos = 0;
  private lecturas = new Map<Bloque, Grupo>();
  private lecturaAlPasar: Lectura | null = null;
  private hojaEnSombras = new Set<ShadowRoot>();
  private sinLecturaFija = new WeakSet<Bloque>();
  /** Elementos con el interlineado abierto, y lo que tenían antes en su atributo. */
  private abiertos = new Map<HTMLElement, { valor: string; prioridad: string }>();
  private noAbrir = new WeakSet<Element>();
  private oscuro = false;
  private a: Ajustes;
  private pendienteRecolocar = 0;
  private pendienteForzar = false;
  private pendienteOcultas = false;
  private desplazados = new Set<Node>();
  /** Lo que tardó la última revisión de posiciones, en milisegundos. */
  costeColocar = 0;
  private niveles = new WeakMap<Element, number | null>();
  private recortes = new WeakMap<Element, Element[]>();
  private infoCajas = new WeakMap<Element, InfoCaja>();
  private temporizadorTapadas: ReturnType<typeof setTimeout> | null = null;
  private tapadasDesde = 0;
  private proximasTapadas = 0;
  private pasadaTapadas = 0;
  private haySoporte: boolean;
  private hayScrollEnlazado: boolean;

  constructor(a: Ajustes) {
    this.a = a;
    this.haySoporte = typeof Highlight !== 'undefined' && !!CSS.highlights;
    this.hayScrollEnlazado = typeof ScrollTimeline !== 'undefined';
    this.anfitrion = document.createElement('kotonoha-lector');
    this.anfitrion.setAttribute('aria-hidden', 'true');
    const sombra = this.anfitrion.attachShadow({ mode: 'open' });
    const hoja = new CSSStyleSheet();
    hoja.replaceSync(ESTILO_CAPA);
    sombra.adoptedStyleSheets = [hoja];
    this.capaRaiz = document.createElement('div');
    sombra.appendChild(this.capaRaiz);
    this.raiz = this.nuevaCapa(null, null, null, this.capaRaiz);
    document.adoptedStyleSheets.push(this.hojaPagina);
    this.oscuro = this.detectarFondoOscuro();
    this.aplicarEstilos();
    // Se avisa antes de pintar: al crecer el contenido de una caja, su hoja se corrige en el mismo fotograma.
    this.vigiaCapas = new ResizeObserver(() => this.actualizarRangos());
  }

  private nuevaCapa(fuente: Element | null, padre: Capa | null, marco: HTMLElement | null, hoja: HTMLElement): Capa {
    return { fuente, padre, marco, hoja, animY: null, animX: null, rangoY: 0, rangoX: 0, bandaArriba: 0, bandaAbajo: 0, marca: '', hijos: 0 };
  }

  /** Añade la capa cuando hay algo que pintar, no antes: en una página sin japonés no se añade nada. */
  private montarCapa() {
    if (!this.anfitrion.isConnected) document.documentElement.appendChild(this.anfitrion);
  }

  private detectarFondoOscuro(): boolean {
    for (const el of [document.body, document.documentElement]) {
      if (!el) continue;
      const r = esFondoOscuro(getComputedStyle(el).backgroundColor);
      if (r !== null) return r;
    }
    return false;
  }

  /** Los árboles de sombra tienen sus propios estilos: el resaltado también se ha de declarar en ellos. */
  adoptarEnSombra(raiz: ShadowRoot) {
    if (this.hojaEnSombras.has(raiz)) return;
    this.hojaEnSombras.add(raiz);
    raiz.adoptedStyleSheets.push(this.hojaPagina);
  }

  fijarAjustes(a: Ajustes) {
    const cambiaColor = a.lectorColor !== this.a.lectorColor || a.colorAcento !== this.a.colorAcento || a.paleta !== this.a.paleta;
    const cambiaLectura = a.lectorFurigana !== this.a.lectorFurigana || a.formatoLectura !== this.a.formatoLectura || a.lectorInterlineado !== this.a.lectorInterlineado;
    this.a = a;
    if (cambiaColor) this.aplicarEstilos();
    if (!a.lectorInterlineado || a.lectorFurigana === 'ninguna' || a.lectorFurigana === 'alPasar') this.cerrarLineas();
    return { cambiaColor, cambiaLectura };
  }

  private aplicarEstilos() {
    const p = paletaDe(this.a.paleta, this.oscuro);
    const reglas: string[] = [];
    const ESTADOS: [string, string][] = [['d', p.desconocida], ['a', p.aprendiendo], ['r', p.rastreada], ['c', '']];
    const ACENTOS: [string, string][] = [['', ''], ['h', p.heiban], ['t', p.atamadaka], ['n', p.nakadaka], ['o', p.odaka]];
    for (const [e, ce] of ESTADOS) {
      for (const [ac, ca] of ACENTOS) {
        const nombre = `kk-${e}${ac}`;
        const decl = [
          ce ? `text-decoration: underline ${ce} 2px; text-underline-offset: 0.18em;` : '',
          ca ? `color: ${ca};` : '',
        ].join(' ');
        if (decl.trim()) reglas.push(`::highlight(${nombre}) { ${decl} }`);
      }
    }
    reglas.push(`::highlight(kk-pasar) { background-color: ${this.oscuro ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.08)'}; }`);
    reglas.push(`::highlight(kk-activa) { background-color: ${this.oscuro ? 'rgba(188,169,255,.34)' : 'rgba(110,82,217,.2)'}; }`);
    this.hojaPagina.replaceSync(reglas.join('\n'));
  }

  private resalte(nombre: string, prioridad = 0): Highlight | null {
    if (!this.haySoporte) return null;
    let h = this.resaltes.get(nombre);
    if (!h) {
      h = new Highlight();
      h.priority = prioridad;
      this.resaltes.set(nombre, h);
      CSS.highlights.set(nombre, h);
    }
    return h;
  }

  /** En qué grupo de color va una palabra. Una conocida sin acento no lleva nada. */
  private nombreDe(tk: TokenPagina): string | null {
    const { p } = tk;
    if (!p.esPalabra || !this.a.lectorColor) return null;
    const e = p.rastreada ? 'r' : p.estado === 'desconocida' ? 'd' : p.estado === 'aprendiendo' ? 'a' : 'c';
    const conAcento = this.a.colorAcento === 'siempre' && p.patron;
    const ac = conAcento ? ({ heiban: 'h', atamadaka: 't', nakadaka: 'n', odaka: 'o' } as const)[p.patron!] : '';
    if (e === 'c' && !ac) return null;
    return `kk-${e}${ac}`;
  }

  private pintarColor(b: Bloque, tk: TokenPagina) {
    const nombre = this.nombreDe(tk);
    if (!nombre) return;
    tk.rango ??= rangoDe(b, tk.inicio, tk.fin) ?? undefined;
    if (!tk.rango) return;
    this.resalte(nombre)?.add(tk.rango);
    tk.resalte = nombre;
  }

  private quitarColor(tk: TokenPagina) {
    if (!tk.rango || !tk.resalte) return;
    this.resaltes.get(tk.resalte)?.delete(tk.rango);
    tk.resalte = undefined;
  }

  /** Pinta un bloque ya analizado. */
  pintar(b: Bloque) {
    this.pintarLote([b]);
  }

  /** Lo que llega junto se pinta junto: primero se mide todo y luego se escribe, para no recalcular el diseño a cada paso. */
  pintarLote(bloques: Bloque[]) {
    if (this.abrirLineas(bloques)) this.pedirRevision();
    const nuevas: Lectura[] = [];
    for (const b of bloques) {
      if (!b.tokens) continue;
      for (const tk of b.tokens) this.pintarColor(b, tk);
      nuevas.push(...this.prepararLecturas(b));
    }
    if (!nuevas.length) return;
    this.montarCapa();
    this.colocar(nuevas, true);
    this.programarTapadas(true);
  }

  /** Quita un bloque de la vista. Conserva el análisis, por si se vuelve a él. */
  quitar(b: Bloque) {
    for (const tk of b.tokens ?? []) {
      this.quitarColor(tk);
      tk.rango = undefined;
    }
    this.quitarLecturas(b);
  }

  /** Vuelve a pintar una palabra que cambió de estado. */
  repintarToken(b: Bloque, tk: TokenPagina) {
    this.quitarColor(tk);
    this.pintarColor(b, tk);
  }

  private debeLlevarLectura(tk: TokenPagina): boolean {
    const m = this.a.lectorFurigana;
    if (!tk.p.esPalabra || m === 'ninguna' || m === 'alPasar') return false;
    return m === 'todas' || tk.p.estado === 'desconocida';
  }

  // ---------- Interlineado ----------

  /**
   * El furigana necesita sitio entre dos líneas. Muchas páginas no lo dejan: con 15 px de letra y 21 de línea quedan 6 para
   * una lectura de 9 y el subrayado de la línea de arriba, y la lectura se pisa con ella. Ahí se abre el interlineado de ese
   * texto, solo lo necesario. Es lo único que el lector toca en la página, se puede desactivar, y se revierte si al crecer
   * ese texto se saldría de una caja de alto fijo.
   */
  private abrirLineas(bloques: Bloque[]): boolean {
    if (!this.a.lectorInterlineado) return false;
    interface Candidato {
      el: HTMLElement;
      valor: string;
      vigilar: { c: Element; antes: number }[];
    }
    const candidatos: Candidato[] = [];
    for (const b of bloques) {
      const el = b.contenedor;
      if (!(el instanceof HTMLElement) || this.noAbrir.has(el)) continue;
      if (!b.tokens?.some((tk) => this.debeLlevarLectura(tk))) continue;
      if (el.closest(NO_ABRIR)) {
        this.noAbrir.add(el);
        continue;
      }
      const cs = getComputedStyle(el);
      if (cs.webkitLineClamp !== 'none' && cs.webkitLineClamp !== '') continue;
      if (!cs.writingMode.startsWith('horizontal')) continue;
      const tam = parseFloat(cs.fontSize) || 16;
      const necesario = interlineadoNecesario(tam);
      const r = rangoDe(b, 0, b.texto.length);
      const primera = r?.getClientRects()[0];
      if (!r || !primera) continue;
      const declarado = parseFloat(cs.lineHeight);
      const paso = Number.isNaN(declarado) ? primera.height : declarado;
      if (paso >= necesario * tam - 0.5) continue;
      // Lo que hereda el interlineado es todo lo que hay dentro: en un contenedor de media página, moverlo sería romperla.
      const conBloques = this.contieneBloques(el);
      if (conBloques && el.getElementsByTagName('*').length > 60) continue;
      // Un párrafo partido con <br> son varios bloques de una línea: el que tiene varias líneas es su contenedor.
      const relleno = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
      const alto = conBloques ? r.getBoundingClientRect().height : Math.max(r.getBoundingClientRect().height, el.getBoundingClientRect().height - relleno);
      if (alto <= paso * 1.5 && !this.pegadoAOtro(el, primera, tam)) continue;
      // Si al crecer se saliera de algo de alto fijo, no se puede abrir.
      const vigilar: { c: Element; antes: number }[] = [];
      for (const c of [el.parentElement, ...this.recortesDe(el)]) {
        if (!c || c === document.body || c === document.documentElement) continue;
        if (this.info(c).conScroll) break;
        vigilar.push({ c, antes: c.scrollHeight - c.clientHeight });
      }
      candidatos.push({ el, valor: interlineadoAbierto(tam).toFixed(3), vigilar });
    }
    if (!candidatos.length) return false;
    for (const { el, valor } of candidatos) {
      if (!this.abiertos.has(el)) this.abiertos.set(el, { valor: el.style.getPropertyValue('line-height'), prioridad: el.style.getPropertyPriority('line-height') });
      el.style.setProperty('line-height', valor, 'important');
    }
    for (const { el, vigilar } of candidatos) {
      if (vigilar.some(({ c, antes }) => c.scrollHeight - c.clientHeight > antes + 1)) {
        this.cerrarUna(el);
        this.noAbrir.add(el);
      }
    }
    return true;
  }

  private contieneBloques(el: Element): boolean {
    for (const h of el.children) {
      if (h.tagName === 'BR') continue;
      const d = getComputedStyle(h).display;
      if (!d.startsWith('inline') && !d.startsWith('ruby') && d !== 'contents' && d !== 'none') return true;
    }
    return false;
  }

  /**
   * Una línea suelta también choca con la que tiene justo encima, como las filas de una lista. Se mira también la de debajo:
   * si no, la primera fila se quedaría más apretada que las demás y su subrayado chocaría con la lectura de la segunda.
   */
  private pegadoAOtro(el: HTMLElement, caja: DOMRect, tam: number): boolean {
    if (!/^(LI|P|DD|DT)$/.test(el.tagName)) return false;
    const margen = Math.max(0, (caja.height - tam) / 2);
    const cabe = tamanoLectura(tam, Infinity) + 1;
    // Solo cuenta lo que está en otra línea: los elementos de un menú en fila están al lado, no encima.
    const previo = el.previousElementSibling;
    const q = previo?.textContent?.trim() ? previo.getBoundingClientRect() : null;
    if (q?.height && q.bottom <= caja.top + margen && caja.top + margen - q.bottom < cabe) return true;
    const siguiente = el.nextElementSibling;
    const s = siguiente?.textContent?.trim() ? siguiente.getBoundingClientRect() : null;
    return !!s?.height && s.top >= caja.bottom - margen && s.top - (caja.bottom - margen) < cabe;
  }

  private cerrarUna(el: HTMLElement) {
    const antes = this.abiertos.get(el);
    if (!antes) return;
    this.abiertos.delete(el);
    if (antes.valor) el.style.setProperty('line-height', antes.valor, antes.prioridad);
    else el.style.removeProperty('line-height');
    if (!el.getAttribute('style')) el.removeAttribute('style');
  }

  private cerrarLineas() {
    if (!this.abiertos.size) return;
    for (const el of [...this.abiertos.keys()]) this.cerrarUna(el);
    this.noAbrir = new WeakSet();
    this.pedirRevision();
  }

  // ---------- Lecturas ----------

  private quitarLecturas(b: Bloque) {
    const g = this.lecturas.get(b);
    if (!g) return;
    for (const l of g.lista) l.el.remove();
    this.lecturas.delete(b);
  }

  private crearLecturasDe(b: Bloque, tk: TokenPagina, capa: Capa): Lectura[] {
    if (tieneRubyPropio(b, tk.inicio, tk.fin)) return [];
    const salida: Lectura[] = [];
    for (const t of tramosConLectura(tk.p.furigana)) {
      const rango = rangoDe(b, tk.inicio + t.inicio, tk.inicio + t.fin);
      if (!rango) continue;
      const el = document.createElement('span');
      el.className = 'rt';
      const texto = lecturaVisible(t.lectura, this.a.formatoLectura);
      el.setAttribute('data-r', texto);
      const c = rango.startContainer;
      salida.push({ el, rango, padre: c.nodeType === Node.ELEMENT_NODE ? (c as Element) : c.parentElement, capa, texto, tapada: false, fuera: false, marca: '', cx: 0, cy: 0 });
    }
    return salida;
  }

  /** Sin aire entre líneas, una lectura taparía la línea de arriba. Ahí se deja para cuando se pase el ratón. */
  private sinAire(b: Bloque): boolean {
    const cs = getComputedStyle(b.contenedor);
    const alto = parseFloat(cs.lineHeight);
    if (Number.isNaN(alto)) return false;
    const tam = parseFloat(cs.fontSize) || 16;
    if (alto - tam >= HUECO_MINIMO) return false;
    // Una sola línea no tiene a nadie encima.
    const r = rangoDe(b, 0, b.texto.length);
    return !!r && r.getClientRects().length > 1 && r.getBoundingClientRect().height > alto * 1.5;
  }

  /** Las lecturas que lleva un bloque, sin añadirlas todavía a la capa. */
  private prepararLecturas(b: Bloque): Lectura[] {
    this.quitarLecturas(b);
    if (!b.tokens) return [];
    if (this.sinAire(b)) {
      this.sinLecturaFija.add(b);
      return [];
    }
    this.sinLecturaFija.delete(b);
    const conLectura = b.tokens.filter((tk) => this.debeLlevarLectura(tk));
    if (!conLectura.length) return [];
    const capa = this.capaDe(b.contenedor);
    const lista = conLectura.flatMap((tk) => this.crearLecturasDe(b, tk, capa));
    if (lista.length) this.lecturas.set(b, { lista, capa, x: NaN, y: NaN, ancho: NaN, alto: NaN });
    return lista;
  }

  /** Repinta las lecturas de los bloques a la vista, al cambiar el modo o el formato. */
  repintarLecturas(bloques: Iterable<Bloque>) {
    const lista = [...bloques].filter((b) => b.cerca && b.tokens);
    if (this.abrirLineas(lista)) this.pedirRevision();
    const nuevas: Lectura[] = [];
    for (const b of lista) nuevas.push(...this.prepararLecturas(b));
    if (!nuevas.length) return;
    this.montarCapa();
    this.colocar(nuevas, true);
    this.programarTapadas(true);
  }

  /** La lectura de la palabra bajo el ratón, en el modo «al pasar». */
  mostrarAlPasar(b: Bloque | null, tk: TokenPagina | null) {
    if (this.lecturaAlPasar) {
      this.lecturaAlPasar.el.remove();
      this.lecturaAlPasar = null;
    }
    if (!b || !tk || !tk.p.esPalabra) return;
    const pedida = this.a.lectorFurigana === 'alPasar' || (this.sinLecturaFija.has(b) && this.a.lectorFurigana !== 'ninguna' && this.debeLlevarLectura(tk));
    if (!pedida) return;
    const lista = this.crearLecturasDe(b, tk, this.capaDe(b.contenedor));
    if (!lista.length) return;
    // Una palabra con varios kanji separados: se colocan todas, y al apartarse se van con la primera.
    this.montarCapa();
    this.colocar(lista, true);
    const primera = lista[0];
    const resto = lista.slice(1);
    const quitarPrimera = primera.el.remove.bind(primera.el);
    primera.el.remove = () => {
      quitarPrimera();
      for (const r of resto) r.el.remove();
    };
    this.lecturaAlPasar = primera;
  }

  /** El valor con el que un elemento compite con el resto de la página: el de su contexto de apilamiento más exterior. */
  private nivelDe(el: Element | null): number {
    return this.nivelExterior(el) ?? 0;
  }

  private nivelExterior(el: Element | null): number | null {
    if (!el || el === document.documentElement || el === document.body) return null;
    const guardado = this.niveles.get(el);
    if (guardado !== undefined) return guardado;
    const fuera = this.nivelExterior(padreDe(el));
    const valor = fuera ?? nivelPropio(el, getComputedStyle(el));
    this.niveles.set(el, valor);
    return valor;
  }

  /** Lo que puede recortar a un elemento: sus antepasados con overflow, hasta donde deja de afectarle. */
  private recortesDe(el: Element | null): Element[] {
    if (!el || el === document.documentElement || el === document.body) return [];
    const guardado = this.recortes.get(el);
    if (guardado) return guardado;
    const cs = getComputedStyle(el);
    // Lo fijo se escapa de todo lo que tiene alrededor.
    const fuera = cs.position === 'fixed' ? [] : this.recortesDe(padreDe(el));
    const lista = cs.overflowX !== 'visible' || cs.overflowY !== 'visible' ? [el, ...fuera] : fuera;
    this.recortes.set(el, lista);
    return lista;
  }

  // ---------- Capas ----------

  private info(el: Element): InfoCaja {
    let i = this.infoCajas.get(el);
    if (!i) {
      const cs = getComputedStyle(el);
      // El overflow del <body> pasa al documento si <html> no tiene el suyo: entonces su scroll es el del documento.
      const html = el === document.body ? getComputedStyle(document.documentElement) : null;
      const delDocumento = !!html && html.overflowX === 'visible' && html.overflowY === 'visible';
      i = {
        posicion: cs.position,
        arriba: cs.top,
        abajo: cs.bottom,
        conScroll: !delDocumento && /auto|scroll/.test(`${cs.overflowX} ${cs.overflowY}`) && cs.writingMode.startsWith('horizontal') && cs.direction !== 'rtl' && !cs.flexDirection.includes('reverse'),
      };
      this.infoCajas.set(el, i);
    }
    return i;
  }

  /** Lo pegado solo se queda quieto mientras está en su tope. Antes de llegar a él, se mueve como todo lo demás. */
  private estaPegado(el: Element, i: InfoCaja, caja: Element | null): boolean {
    const c = el.getBoundingClientRect();
    const m = caja ? caja.getBoundingClientRect() : { top: 0, bottom: innerHeight };
    const arriba = parseFloat(i.arriba);
    const abajo = parseFloat(i.abajo);
    return (!Number.isNaN(arriba) && Math.abs(c.top - m.top - arriba) < 1.5) || (!Number.isNaN(abajo) && Math.abs(m.bottom - c.bottom - abajo) < 1.5);
  }

  private tieneRango(el: Element): boolean {
    return el.scrollHeight - el.clientHeight > 1 || el.scrollWidth - el.clientWidth > 1;
  }

  /** En qué capa van las lecturas de lo que hay dentro de un elemento. */
  private capaDe(inicio: Element | null): Capa {
    if (!inicio) return this.raiz;
    let hayPegado = false;
    let saltar = false;
    // Con el documento en el <body>, el scroll del <body> es el del documento.
    const tope = document.scrollingElement === document.body ? document.body : document.documentElement;
    for (let el: Element | null = inicio; el && el !== tope && el !== document.documentElement; el = padreDe(el)) {
      const i = this.info(el);
      if (i.conScroll && this.hayScrollEnlazado && (this.capas.has(el) || this.tieneRango(el))) {
        if (hayPegado) this.conPegados.add(el);
        if (!saltar) return this.capaDeFuente(el);
        saltar = false;
      }
      if (i.posicion === 'fixed') return this.capaFija(this.nivelDe(el));
      if (i.posicion === 'sticky') {
        hayPegado = true;
        if (!saltar) {
          let caja: Element | null = padreDe(el);
          while (caja && caja !== tope && caja !== document.documentElement && !this.info(caja).conScroll) caja = padreDe(caja);
          saltar = this.estaPegado(el, i, caja && caja !== tope && caja !== document.documentElement ? caja : null);
        }
      }
    }
    // Pegado a la pantalla: mientras siga ahí, es como si fuera fijo.
    return saltar ? this.capaFija(this.nivelDe(inicio)) : this.raiz;
  }

  private capaFija(nivel: number): Capa {
    let c = this.capasFijas.get(nivel);
    if (!c) {
      const hoja = document.createElement('div');
      hoja.className = 'fija';
      hoja.style.zIndex = String(nivel);
      this.capaRaiz.appendChild(hoja);
      c = this.nuevaCapa(null, null, null, hoja);
      this.capasFijas.set(nivel, c);
    }
    return c;
  }

  /** Dónde va el marco de una caja. Un panel fijo o pegado con su propio scroll no se mueve con el documento. */
  private capaPadreDe(s: Element): Capa {
    const i = this.info(s);
    if (i.posicion === 'fixed' || (i.posicion === 'sticky' && this.estaPegado(s, i, null))) return this.capaFija(this.nivelDe(s));
    return this.capaDe(padreDe(s));
  }

  private capaDeFuente(s: Element): Capa {
    const existente = this.capas.get(s);
    if (existente) return existente;
    const padre = this.capaPadreDe(s);
    const marco = document.createElement('div');
    marco.className = 'marco';
    const hoja = document.createElement('div');
    hoja.className = 'hoja';
    marco.appendChild(hoja);
    padre.hoja.appendChild(marco);
    const c = this.nuevaCapa(s, padre, marco, hoja);
    c.hijos = -1;
    this.capas.set(s, c);
    this.ajustarCapas([c], new Map());
    // Lo que se pintó antes de que esta caja tuviera scroll todavía va en otra capa.
    this.reasignar = true;
    this.pedirRevision();
    return c;
  }

  private quitarCapa(s: Element, c: Capa) {
    c.animY?.cancel();
    c.animX?.cancel();
    this.vigiaCapas.unobserve(s);
    for (const h of s.children) this.vigiaCapas.unobserve(h);
    c.marco?.remove();
    this.capas.delete(s);
  }

  /** Dónde queda en la pantalla el punto (0, 0) de una capa. */
  private origenDe(c: Capa, cache: Map<Capa, Origen>): Origen {
    let o = cache.get(c);
    if (o) return o;
    if (c.fuente) {
      const r = c.fuente.getBoundingClientRect();
      o = { x: r.left + c.fuente.clientLeft - c.fuente.scrollLeft, y: r.top + c.fuente.clientTop - c.fuente.scrollTop };
    } else if (c === this.raiz) {
      const r = this.anfitrion.getBoundingClientRect();
      o = { x: r.left, y: r.top };
    } else {
      o = { x: 0, y: 0 };
    }
    cache.set(c, o);
    return o;
  }

  private ponerRango(c: Capa, eje: 'Y' | 'X', rango: number) {
    const fotogramas: PropertyIndexedKeyframes = eje === 'Y' ? { translate: ['0px 0px', `0px ${-rango}px`] } : { transform: ['translateX(0px)', `translateX(${-rango}px)`] };
    const actual = eje === 'Y' ? c.animY : c.animX;
    if (actual) {
      (actual.effect as KeyframeEffect).setKeyframes(fotogramas);
      return;
    }
    if (rango <= 0 || !c.fuente) return;
    const anim = c.hoja.animate(fotogramas, { timeline: new ScrollTimeline({ source: c.fuente, axis: eje === 'Y' ? 'block' : 'inline' }), fill: 'both', easing: 'linear' });
    if (eje === 'Y') c.animY = anim;
    else c.animX = anim;
  }

  /**
   * Lo que puede desplazar una caja cambia al crecer su contenido, y su hoja se mueve en proporción a eso. Hay que corregirlo
   * antes de que se pinte: si no, el furigana de una respuesta que llega en directo daría saltos.
   */
  private actualizarRangos() {
    for (const [s, c] of this.capas) {
      if (!s.isConnected) continue;
      const y = s.scrollHeight - s.clientHeight;
      const x = s.scrollWidth - s.clientWidth;
      if (y !== c.rangoY) {
        c.rangoY = y;
        this.ponerRango(c, 'Y', y);
      }
      if (x !== c.rangoX) {
        c.rangoX = x;
        this.ponerRango(c, 'X', x);
      }
      if (s.childElementCount !== c.hijos) {
        c.hijos = s.childElementCount;
        this.vigiaCapas.observe(s);
        for (const h of s.children) this.vigiaCapas.observe(h);
      }
    }
  }

  /** Algo cambió en la página: en el próximo fotograma se mira si cambió lo que pueden desplazarse las cajas. */
  pedirRangos() {
    if (!this.capas.size || this.pendienteRangos) return;
    this.pendienteRangos = requestAnimationFrame(() => {
      this.pendienteRangos = 0;
      this.actualizarRangos();
    });
  }

  /** Coloca los marcos sobre sus cajas: lo que se ve de la caja, sin lo que tapan los elementos fijos sobre ella. */
  private ajustarCapas(lista: Iterable<Capa>, origenes: Map<Capa, Origen>) {
    const escrituras: (() => void)[] = [];
    for (const c of lista) {
      const s = c.fuente;
      if (!s || !s.isConnected || !c.marco || !c.padre) continue;
      if (this.info(s).posicion === 'sticky') {
        const padre = this.capaPadreDe(s);
        if (padre !== c.padre) {
          c.padre = padre;
          padre.hoja.appendChild(c.marco);
          c.marca = '';
        }
      }
      const r = s.getBoundingClientRect();
      const izquierda = r.left + s.clientLeft;
      const arriba = r.top + s.clientTop;
      let x0 = izquierda;
      let x1 = izquierda + s.clientWidth;
      let y0 = arriba + c.bandaArriba;
      let y1 = arriba + s.clientHeight - c.bandaAbajo - LEVANTE_ABAJO;
      for (const o of this.recortesDe(padreDe(s))) {
        if (o === c.padre.fuente) break;
        const q = o.getBoundingClientRect();
        x0 = Math.max(x0, q.left);
        x1 = Math.min(x1, q.right);
        y0 = Math.max(y0, q.top);
        y1 = Math.min(y1, q.bottom);
      }
      const po = this.origenDe(c.padre, origenes);
      const nivel = this.nivelDe(s);
      const marca = `${x0 - po.x}|${y0 - po.y}|${x1 - x0}|${y1 - y0}|${x0 - izquierda}|${y0 - arriba}|${nivel}`;
      if (marca === c.marca) continue;
      c.marca = marca;
      const { marco, hoja } = c;
      escrituras.push(() => {
        marco.style.left = `${x0 - po.x}px`;
        marco.style.top = `${y0 - po.y}px`;
        marco.style.width = `${Math.max(0, x1 - x0)}px`;
        marco.style.height = `${Math.max(0, y1 - y0)}px`;
        marco.style.zIndex = String(nivel);
        hoja.style.left = `${izquierda - x0}px`;
        hoja.style.top = `${arriba - y0}px`;
      });
    }
    for (const f of escrituras) f();
    this.actualizarRangos();
  }

  /** Algo tapa esta caja si está fijo dentro de ella, o si no es parte de ella. */
  private esSobrepuesto(e: Element, s: Element): boolean {
    if (!s.contains(e)) return !e.contains(s);
    for (let a: Element | null = e; a && a !== s; a = a.parentElement) {
      const p = this.info(a).posicion;
      if (p === 'sticky' || p === 'fixed') return true;
    }
    return false;
  }

  /**
   * Una barra de escribir o una cabecera sobre una caja con scroll: el texto pasa por debajo, y las lecturas tienen que
   * desaparecer en el mismo sitio aunque no estén en la misma pila que la barra. Se mira qué hay en unas filas de cada borde,
   * en tres columnas: un botón suelto en medio no tapa el texto de toda la caja.
   */
  private medirBandas(origenes: Map<Capa, Origen>): boolean {
    let cambio = false;
    const extremos = new Map<Capa, { min: number; max: number }>();
    for (const g of this.lecturas.values()) {
      if (!g.capa.fuente) continue;
      const e = extremos.get(g.capa) ?? { min: Infinity, max: -Infinity };
      for (const l of g.lista) {
        e.min = Math.min(e.min, l.cx);
        e.max = Math.max(e.max, l.cx);
      }
      extremos.set(g.capa, e);
    }
    for (const [c, e] of extremos) {
      const s = c.fuente!;
      if (!s.isConnected) continue;
      const r = s.getBoundingClientRect();
      const arriba = r.top + s.clientTop;
      const abajo = arriba + s.clientHeight;
      const o = this.origenDe(c, origenes);
      const izquierda = Math.max(r.left, e.min + o.x);
      const derecha = Math.min(r.right, e.max + o.x);
      if (derecha - izquierda < 40) continue;
      const columnas = [0.2, 0.5, 0.8].map((k) => izquierda + (derecha - izquierda) * k);
      const fila = (y: number): DOMRect | 'dudosa' | null => {
        let aciertos = 0;
        let caja: DOMRect | null = null;
        for (const x of columnas) {
          const h = document.elementFromPoint(x, y);
          if (!h) continue;
          // La ficha de Kotonoha encima no deja ver lo que hay debajo.
          if (h.tagName === 'KOTONOHA-OVERLAY') return 'dudosa';
          if (this.esSobrepuesto(h, s)) {
            aciertos++;
            caja = h.getBoundingClientRect();
          }
        }
        return aciertos >= 2 ? caja : null;
      };
      const limite = s.clientHeight * PROPORCION_BANDA;
      const banda = (desdeAbajo: boolean): number | null => {
        let medida = 0;
        for (let d = 1; d < limite; d += PASO_BANDA) {
          const y = desdeAbajo ? abajo - d : arriba + d;
          if (y < 0 || y > innerHeight) continue;
          const h = fila(y);
          if (h === 'dudosa') return null;
          if (!h) {
            if (medida || d > 48) break;
            continue;
          }
          medida = Math.max(medida, desdeAbajo ? abajo - h.top : h.bottom - arriba);
        }
        return Math.min(medida, limite * 1.5);
      };
      const nuevaAbajo = banda(true);
      const nuevaArriba = banda(false);
      if (nuevaAbajo !== null && Math.abs(nuevaAbajo - c.bandaAbajo) > 0.5) {
        c.bandaAbajo = nuevaAbajo;
        cambio = true;
      }
      if (nuevaArriba !== null && Math.abs(nuevaArriba - c.bandaArriba) > 0.5) {
        c.bandaArriba = nuevaArriba;
        cambio = true;
      }
    }
    return cambio;
  }

  // ---------- Colocar ----------

  /**
   * Lee las posiciones y las escribe después, de una vez: alternar lecturas y escrituras obligaría a recalcular cada vez.
   * Con `nuevas`, además las añade a la capa, también de una vez.
   */
  private colocar(lista: Lectura[], nuevas = false) {
    const origenes = new Map<Capa, Origen>();
    // Una lectura que se salga de lo que ya mide el documento lo ensancharía: aparecería una barra de scroll.
    // Como ninguna pasa de ese límite, las lecturas nunca cuentan al medirlo. Dentro de una caja, recorta su marco.
    const limiteX = document.documentElement.scrollWidth - 1;
    const limiteY = document.documentElement.scrollHeight - 1;
    interface Estilo {
      tam: number;
      color: string;
      familia: string;
      vertical: boolean;
      hueco: number;
      nivel: number;
      visible: boolean;
      recortes: Element[];
    }
    const estilos = new Map<Element, Estilo>();
    const estiloDe = (el: Element | null) => {
      if (!el) return null;
      let e = estilos.get(el);
      if (!e) {
        const cs = getComputedStyle(el);
        const tam = parseFloat(cs.fontSize) || 16;
        const alto = parseFloat(cs.lineHeight);
        e = {
          tam,
          color: cs.color,
          familia: cs.fontFamily,
          vertical: cs.writingMode.startsWith('vertical'),
          hueco: Number.isNaN(alto) ? tam * 0.25 : alto - tam,
          nivel: this.nivelDe(el),
          visible: el.checkVisibility?.({ opacityProperty: true, visibilityProperty: true }) ?? true,
          recortes: this.recortesDe(el),
        };
        estilos.set(el, e);
      }
      return e;
    };
    const cajasRecorte = new Map<Element, DOMRect>();
    const recortado = (recortes: Element[], fuente: Element | null, x: number, y: number) => {
      for (const r of recortes) {
        // De aquí hacia afuera ya recorta el marco de su capa, sin depender de dónde esté ahora el scroll.
        if (r === fuente) return false;
        let c = cajasRecorte.get(r);
        if (!c) {
          c = r.getBoundingClientRect();
          cajasRecorte.set(r, c);
        }
        if (x < c.left - 1 || x > c.right + 1 || y < c.top - 1 || y > c.bottom + 1) return true;
      }
      return false;
    };
    const escrituras: (() => void)[] = [];
    const escribir = (l: Lectura, fuera: boolean, x: number, y: number, tam: number, transformar: string, e: Estilo) => {
      const marca = `${x}|${y}|${tam}|${transformar}|${e.color}|${e.familia}|${e.nivel}`;
      if (l.marca !== marca) {
        l.marca = marca;
        escrituras.push(() => {
          const s = l.el.style;
          s.left = `${x}px`;
          s.top = `${y}px`;
          s.fontSize = `${tam}px`;
          s.color = e.color;
          s.fontFamily = e.familia;
          s.transform = transformar;
          s.zIndex = String(e.nivel);
          l.el.classList.toggle('vertical', e.vertical);
        });
      }
      if (l.fuera !== fuera) escrituras.push(() => this.marcarFuera(l, fuera));
    };
    const anchoCaracter = this.a.formatoLectura === 'romaji' ? 0.55 : 1;
    for (const l of lista) {
      const caja = l.rango.getClientRects()[0];
      const e = estiloDe(l.padre);
      if (!caja || !e || !caja.width || !caja.height) {
        if (!l.fuera) escrituras.push(() => this.marcarFuera(l, true));
        continue;
      }
      const origen = this.origenDe(l.capa, origenes);
      const conLimite = l.capa === this.raiz;
      const centroX = caja.left + caja.width / 2;
      const centroY = caja.top + caja.height / 2;
      l.cx = centroX - origen.x;
      l.cy = centroY - origen.y;
      const oculta = !e.visible || recortado(e.recortes, l.capa.fuente, centroX, centroY);
      const tam = tamanoLectura(e.tam, e.hueco);
      const caracteres = l.texto.length;
      if (e.vertical) {
        const k = compresionLectura(caja.height, caracteres, tam, anchoCaracter);
        const x = caja.right - origen.x + 1;
        const y = caja.top - origen.y + caja.height / 2;
        const largo = caracteres * tam * anchoCaracter * k;
        escribir(l, oculta || (conLimite && (x + tam > limiteX || y + largo / 2 > limiteY)), x, y, tam, `translateY(-50%) scaleY(${k})`, e);
        continue;
      }
      const k = compresionLectura(caja.width, caracteres, tam, anchoCaracter);
      const ancho = caracteres * tam * anchoCaracter * k;
      // El rectángulo del texto es más alto que la letra: la lectura va justo encima de la letra, no de la caja.
      const arribaLetra = caja.top + Math.max(0, (caja.height - e.tam) / 2);
      const y = arribaLetra - origen.y - tam - 1;
      // Una palabra en el mismo borde del documento: la lectura se recoge hacia dentro en vez de sobresalir.
      const x = conLimite ? Math.min(l.cx, limiteX - ancho / 2) : l.cx;
      const fuera = oculta || (conLimite && (caja.right - origen.x > limiteX + 2 || y + tam > limiteY));
      escribir(l, fuera, x, y, tam, k === 1 ? 'translateX(-50%)' : `translateX(-50%) scaleX(${k})`, e);
    }
    for (const f of escrituras) f();
    if (nuevas) {
      const porCapa = new Map<Capa, DocumentFragment>();
      for (const l of lista) {
        let grupo = porCapa.get(l.capa);
        if (!grupo) {
          grupo = document.createDocumentFragment();
          porCapa.set(l.capa, grupo);
        }
        grupo.appendChild(l.el);
      }
      for (const [capa, grupo] of porCapa) capa.hoja.appendChild(grupo);
    }
  }

  /**
   * Algo pudo cambiar de sitio: mira qué bloques se han movido y recoloca solo esos. Con `forzar` los recoloca todos,
   * para lo que puede mover las letras sin mover la caja, como una tipografía que acaba de cargar.
   */
  recolocar(forzar = false) {
    if (forzar) {
      this.pendienteForzar = true;
      this.niveles = new WeakMap();
      this.recortes = new WeakMap();
      this.infoCajas = new WeakMap();
    }
    this.pedirRevision();
  }

  /** Un texto que aparece poco a poco, o que deja de estar oculto: su caja no se mueve, pero ya se ve. */
  revisarOcultas() {
    this.pendienteOcultas = true;
    this.pedirRevision();
  }

  /** Algo se desplazó. Una caja con scroll propio no se mueve al desplazar su texto: hay que acordarse de ella. */
  alDesplazar(objetivo: EventTarget | null) {
    // Las lecturas de una caja con hoja las mueve el navegador. No hay nada que hacer.
    if (objetivo instanceof Element && this.capas.has(objetivo) && !this.conPegados.has(objetivo)) return;
    if (objetivo instanceof Node && objetivo !== document && objetivo !== document.documentElement) this.desplazados.add(objetivo);
    this.pedirRevision();
  }

  private pedirRevision() {
    if (this.pendienteRecolocar) return;
    this.pendienteRecolocar = requestAnimationFrame(() => {
      this.pendienteRecolocar = 0;
      this.revisarPosiciones();
    });
  }

  private revisarPosiciones() {
    const forzar = this.pendienteForzar;
    const ocultas = this.pendienteOcultas;
    const reasignar = this.reasignar;
    this.pendienteForzar = false;
    this.pendienteOcultas = false;
    this.reasignar = false;
    const desplazados = this.desplazados;
    const t0 = performance.now();
    const origenes = new Map<Capa, Origen>();
    this.ajustarCapas(this.capas.values(), origenes);
    const cambiadas: Lectura[] = [];
    const porAbrir: Bloque[] = [];
    for (const [b, g] of this.lecturas) {
      const c = b.contenedor.getBoundingClientRect();
      let o = this.origenDe(g.capa, origenes);
      const igual = c.width > 0 && g.x === c.left - o.x && g.y === c.top - o.y && g.ancho === c.width && g.alto === c.height;
      if (igual && !forzar && !reasignar && !desplazados.has(b.contenedor)) {
        if (ocultas) for (const l of g.lista) if (l.fuera) cambiadas.push(l);
        continue;
      }
      // Al estrecharse, o al llegar más texto, lo que era una sola línea puede pasar a tener varias.
      if (g.alto !== c.height) porAbrir.push(b);
      const capa = this.capaDe(b.contenedor);
      if (capa !== g.capa) {
        g.capa = capa;
        const grupo = document.createDocumentFragment();
        for (const l of g.lista) {
          l.capa = capa;
          grupo.appendChild(l.el);
        }
        capa.hoja.appendChild(grupo);
        o = this.origenDe(capa, origenes);
      }
      g.x = c.left - o.x;
      g.y = c.top - o.y;
      g.ancho = c.width;
      g.alto = c.height;
      for (const l of g.lista) cambiadas.push(l);
    }
    desplazados.clear();
    if (porAbrir.length && this.abrirLineas(porAbrir)) this.pedirRevision();
    if (cambiadas.length) {
      this.colocar(cambiadas);
      this.programarTapadas(true);
    }
    this.costeColocar = performance.now() - t0;
  }

  // ---------- Lo que tapa ----------

  /**
   * Lo que no se resuelve solo: un elemento sin z-index encima del texto, como un aviso. Hay que preguntar al navegador
   * qué hay en cada punto, y eso es caro. Se hace cuando la página está quieta, por líneas, y en ratos libres. Con `sinFalta`,
   * lo pide un cambio en la página: se hace aunque siga cambiando, pero sin dedicarle más del 5 % del tiempo.
   */
  programarTapadas(sinFalta = false) {
    const ahora = performance.now();
    if (!this.tapadasDesde) this.tapadasDesde = ahora;
    if (this.temporizadorTapadas) clearTimeout(this.temporizadorTapadas);
    const limite = sinFalta ? 1000 - (ahora - this.tapadasDesde) : Infinity;
    const espera = Math.max(Math.min(160, limite), this.proximasTapadas - ahora, 0);
    this.temporizadorTapadas = setTimeout(() => {
      this.temporizadorTapadas = null;
      this.tapadasDesde = 0;
      this.comprobarTapadas();
    }, espera);
  }

  private comprobarTapadas() {
    const pasada = ++this.pasadaTapadas;
    let dedicado = 0;
    const inicio = performance.now();
    for (const [s, c] of this.capas) if (!c.hoja.firstChild || !s.isConnected) this.quitarCapa(s, c);
    const origenes = new Map<Capa, Origen>();
    if (this.medirBandas(origenes)) this.ajustarCapas(this.capas.values(), origenes);
    const alto = innerHeight;
    const ancho = innerWidth;
    // Lo que queda dentro de una banda o fuera de su caja lo recorta el marco, y aparecerá solo al desplazar la caja. Si se
    // marcara como tapado, al volver a estar a la vista no se vería hasta que la caja dejara de moverse.
    const cajas = new Map<Capa, { arriba: number; abajo: number }>();
    const visibleEnSuCaja = (c: Capa, y: number) => {
      if (!c.fuente) return true;
      let v = cajas.get(c);
      if (!v) {
        const r = c.fuente.getBoundingClientRect();
        const arriba = r.top + c.fuente.clientTop;
        v = { arriba: arriba + c.bandaArriba, abajo: arriba + c.fuente.clientHeight - c.bandaAbajo };
        cajas.set(c, v);
      }
      return y >= v.arriba && y <= v.abajo;
    };
    // Las palabras de una misma línea y del mismo elemento suelen compartir suerte: basta con mirar una de cada tramo.
    const porPadre = new Map<Element, Map<number, Lectura[]>>();
    for (const g of this.lecturas.values()) {
      for (const l of g.lista) {
        if (l.fuera || !l.padre) continue;
        const o = this.origenDe(l.capa, origenes);
        const x = l.cx + o.x;
        const y = l.cy + o.y;
        if (x < 0 || y < 0 || x > ancho || y > alto || !visibleEnSuCaja(l.capa, y)) {
          this.marcarTapada(l, false);
          continue;
        }
        let tramos = porPadre.get(l.padre);
        if (!tramos) {
          tramos = new Map();
          porPadre.set(l.padre, tramos);
        }
        const clave = Math.round(y / 8) * 1000 + Math.floor(x / 160);
        const lista = tramos.get(clave);
        if (lista) lista.push(l);
        else tramos.set(clave, [l]);
      }
    }
    const grupos: Lectura[][] = [];
    for (const tramos of porPadre.values()) for (const lista of tramos.values()) grupos.push(lista);
    dedicado += performance.now() - inicio;
    let i = 0;
    const resultados: [Lectura[], boolean][] = [];
    const paso = () => {
      // Empezó otra pasada: esta ya no sirve.
      if (pasada !== this.pasadaTapadas) return;
      const t0 = performance.now();
      const orig = new Map<Capa, Origen>();
      const limite = t0 + 6;
      while (i < grupos.length && performance.now() < limite) {
        const lista = grupos[i++];
        const o = this.origenDe(lista[0].capa, orig);
        resultados.push([lista, this.estaTapada(lista[0], lista[0].cx + o.x, lista[0].cy + o.y)]);
      }
      dedicado += performance.now() - t0;
      if (i < grupos.length) {
        requestIdleCallback(paso, { timeout: 400 });
        return;
      }
      // Al final y de una vez. Escribir entre medias haría que la siguiente pregunta recalculase la página entera.
      for (const [lista, tapada] of resultados) for (const l of lista) this.marcarTapada(l, tapada);
      this.proximasTapadas = performance.now() + dedicado * 20;
    };
    requestIdleCallback(paso, { timeout: 400 });
  }

  private estaTapada(l: Lectura, x: number, y: number): boolean {
    let encima = document.elementFromPoint(x, y);
    // La ficha o el panel de Kotonoha encima no cuentan: al cerrarlos, la lectura ha de seguir ahí.
    if (encima?.tagName === 'KOTONOHA-OVERLAY') return false;
    // Dentro de un árbol de sombra, el documento solo ve al anfitrión.
    while (encima?.shadowRoot) {
      const dentro: Element | null = encima.shadowRoot.elementFromPoint(x, y);
      if (!dentro || dentro === encima) break;
      encima = dentro;
    }
    if (!encima || !l.padre) return true;
    if (encima === l.padre || l.padre.contains(encima)) return false;
    // Bajo el punto está un antepasado: se ve a través de lo que deja pasar el ratón, como un adorno sin eventos.
    if (encima.contains(l.padre)) return getComputedStyle(l.padre).pointerEvents !== 'none';
    // Algo se interpone, pero puede ser invisible, como el enlace que cubre toda una tarjeta: entonces el texto se ve.
    for (const e of document.elementsFromPoint(x, y)) {
      if (e === l.padre || l.padre.contains(e) || e.contains(l.padre)) return false;
      if (this.seVe(e)) return true;
    }
    return true;
  }

  private seVe(e: Element): boolean {
    if (/^(img|video|canvas|svg|iframe|embed|object|picture)$/i.test(e.tagName)) return true;
    const cs = getComputedStyle(e);
    return cs.backgroundImage !== 'none' || esFondoVisible(cs.backgroundColor);
  }

  private marcarTapada(l: Lectura, tapada: boolean) {
    if (l.tapada === tapada) return;
    l.tapada = tapada;
    l.el.classList.toggle('tapada', l.tapada || l.fuera);
  }

  private marcarFuera(l: Lectura, fuera: boolean) {
    l.fuera = fuera;
    l.el.classList.toggle('tapada', l.tapada || l.fuera);
  }

  /** Resalta la palabra bajo el ratón, o la que se está consultando. */
  marcar(tipo: 'kk-pasar' | 'kk-activa', rango: Range | null) {
    const h = this.resalte(tipo, tipo === 'kk-activa' ? 6 : 5);
    if (!h) return;
    h.clear();
    if (rango) h.add(rango);
  }

  /** Cuántas cosas hay pintadas: para las pruebas, y para saber si el lector está haciendo algo. */
  medidas() {
    let rangos = 0;
    for (const [n, h] of this.resaltes) if (n !== 'kk-pasar' && n !== 'kk-activa') rangos += h.size;
    let lecturas = 0;
    let tapadas = 0;
    for (const g of this.lecturas.values()) {
      lecturas += g.lista.length;
      for (const l of g.lista) if (l.tapada || l.fuera) tapadas++;
    }
    return { rangos, lecturas, tapadas, capas: this.capas.size, abiertos: this.abiertos.size };
  }

  /** Lo deja todo como estaba: al apagar el lector no debe quedar rastro en la página. */
  limpiar() {
    this.pasadaTapadas++;
    if (this.temporizadorTapadas) clearTimeout(this.temporizadorTapadas);
    this.temporizadorTapadas = null;
    if (this.pendienteRecolocar) cancelAnimationFrame(this.pendienteRecolocar);
    this.pendienteRecolocar = 0;
    if (this.pendienteRangos) cancelAnimationFrame(this.pendienteRangos);
    this.pendienteRangos = 0;
    for (const n of this.resaltes.keys()) CSS.highlights?.delete(n);
    this.resaltes.clear();
    for (const g of this.lecturas.values()) for (const l of g.lista) l.el.remove();
    this.lecturas.clear();
    this.mostrarAlPasar(null, null);
    this.vigiaCapas.disconnect();
    for (const c of this.capas.values()) {
      c.animY?.cancel();
      c.animX?.cancel();
    }
    this.capas.clear();
    this.capasFijas.clear();
    this.cerrarLineas();
    this.anfitrion.remove();
    const quitarHoja = (raiz: Document | ShadowRoot) => {
      const i = raiz.adoptedStyleSheets.indexOf(this.hojaPagina);
      if (i >= 0) raiz.adoptedStyleSheets.splice(i, 1);
    };
    quitarHoja(document);
    for (const r of this.hojaEnSombras) quitarHoja(r);
    this.hojaEnSombras.clear();
  }
}
