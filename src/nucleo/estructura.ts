// Texto con estructura para el Portapapeles y la Ayuda de lectura: párrafos con sus saltos de línea, títulos, listas,
// citas, código, tablas y negritas. Se guarda como un Markdown sencillo, que sigue siendo texto: cabe donde ya cabía el
// texto plano (el Portapapeles, la biblioteca, la copia de seguridad), se puede editar a mano, y lo que se copia del chat
// de Claude ya llega así. Lo que se copia de una página web llega como HTML y se convierte a lo mismo.

import { idDeMarca } from './dictado';

export interface Linea {
  /** El texto tal como se lee, sin marcas. */
  texto: string;
  /** Tramos en negrita, como [inicio, fin) en posiciones de `texto`. */
  negritas: [number, number][];
}

export interface ElementoLista {
  /** 0 para el primer nivel; las listas dentro de otras suben uno. */
  nivel: number;
  ordenada: boolean;
  numero: number;
  lineas: Linea[];
}

export type Bloque =
  | { tipo: 'parrafo'; lineas: Linea[] }
  | { tipo: 'titulo'; nivel: 1 | 2 | 3; linea: Linea }
  | { tipo: 'lista'; elementos: ElementoLista[] }
  | { tipo: 'cita'; lineas: Linea[] }
  | { tipo: 'codigo'; lineas: Linea[] }
  | { tipo: 'tabla'; cabecera: Linea[] | null; filas: Linea[][] }
  | { tipo: 'separador' }
  /** La grabación de un dictado, que va encima del párrafo que salió de ella (nucleo/dictado.ts). */
  | { tipo: 'dictado'; id: string };

// ---------- Del Markdown a los bloques ----------

const VALLA = /^\s*(`{3,}|~{3,})/;
const TITULO = /^\s{0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/;
const SEPARADOR = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const CITA = /^\s{0,3}>\s?(.*)$/;
/**
 * Viñetas: guion, asterisco o más, seguidos de un espacio. Los signos que son viñetas por sí mismos no lo necesitan:
 * el punto de lista, el punto medio latino, el punto medio de ancho completo de Asia oriental y los círculos y cuadrados.
 */
const SIGNOS_DE_VINETA = '\\u2022\\u00B7\\u30FB\\u25CF\\u25E6\\u25AA';
const VINETA = new RegExp(`^([ \\t]*)(?:[-*+][ \\t]+|[${SIGNOS_DE_VINETA}][ \\t]*)(.*)$`);
/** Números: «1. », «1) », y los de ancho completo, que en la escritura de Asia oriental suelen ir sin espacio. */
const DIGITOS_ANCHOS = '\\uFF10-\\uFF19';
const NUMERO = new RegExp(`^([ \\t]*)(\\d{1,4}|[${DIGITOS_ANCHOS}]{1,4})(?:[.)][ \\t]+|[\\uFF0E\\uFF09][ \\t]*)(.*)$`);
const FILA_GUIONES = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;
const ESCAPADA = new RegExp(`^\\s*\\\\[#>\\-*+|\`~\\d_${SIGNOS_DE_VINETA}${DIGITOS_ANCHOS}]`);

const ENLACE = /\[([^\]\n]+)\]\((?:[^()\s]+|<[^>\n]+>)(?:\s+"[^"\n]*")?\)/g;
const CODIGO_EN_LINEA = /`([^`\n]+)`/g;
const CURSIVA = /(?<![*\\])\*(?![\s*])([^*\n]+?)(?<![\s\\*])\*(?!\*)/g;
const ESCAPABLES = '\\`*_{}[]()#+-.!|>~\u2022\u00B7\u30FB';

const anchoSangria = (s: string) => [...s].reduce((n, c) => n + (c === '\t' ? 4 : 1), 0);
const numeroDe = (s: string) => Number(s.replace(/[\uFF10-\uFF19]/g, (d) => String(d.charCodeAt(0) - 0xff10)));

/** Una línea con sus marcas en línea: negritas con **, enlaces, código y cursivas, que se quedan en su texto. */
export function leerLinea(crudo: string): Linea {
  const s = crudo.replace(/\s+$/, '').replace(ENLACE, '$1').replace(CODIGO_EN_LINEA, '$1').replace(CURSIVA, '$1');
  let texto = '';
  const negritas: [number, number][] = [];
  let abierta = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\' && i + 1 < s.length && ESCAPABLES.includes(s[i + 1])) {
      texto += s[++i];
      continue;
    }
    if (c === '*' && s[i + 1] === '*') {
      i++;
      if (abierta < 0) abierta = texto.length;
      else {
        if (texto.length > abierta) negritas.push([abierta, texto.length]);
        abierta = -1;
      }
      continue;
    }
    texto += c;
  }
  // Unas ** sin pareja son texto.
  if (abierta >= 0) texto = `${texto.slice(0, abierta)}**${texto.slice(abierta)}`;
  return { texto, negritas };
}

function celdas(fila: string): Linea[] {
  let s = fila.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const salida: string[] = [];
  let actual = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && s[i + 1] === '|') {
      actual += '\\|';
      i++;
    } else if (s[i] === '|') {
      salida.push(actual);
      actual = '';
    } else actual += s[i];
  }
  salida.push(actual);
  return salida.map((c) => leerLinea(c.trim()));
}

const esFila = (l: string | undefined) => !!l && l.includes('|') && !!l.trim();

/**
 * Si una línea de párrafo se leería como otra cosa (un título, una viñeta, un número, una cita, una valla de código o un
 * separador). Quien escribe Markdown desde otro sitio, como el editor del Cuaderno, la escapa con una barra invertida.
 */
export function empiezaComoEstructura(linea: string): boolean {
  return [VALLA, TITULO, SEPARADOR, CITA, VINETA, NUMERO].some((re) => re.test(linea)) && !ESCAPADA.test(linea);
}

/** Lee el texto por bloques. Un texto sin marcas queda en párrafos separados por líneas en blanco, con cada salto de línea en su sitio. */
export function leerEstructura(md: string): Bloque[] {
  const lineas = md.replace(/\r\n?/g, '\n').split('\n');
  const bloques: Bloque[] = [];
  let parrafo: Linea[] | null = null;
  let lista: { tipo: 'lista'; elementos: ElementoLista[] } | null = null;
  let sangrias: number[] = [];
  let cita: Linea[] | null = null;
  const cerrar = () => {
    parrafo = null;
    lista = null;
    sangrias = [];
    cita = null;
  };

  for (let i = 0; i < lineas.length; i++) {
    const crudo = lineas[i];

    // El código va tal cual hasta su valla de cierre.
    const valla = VALLA.exec(crudo);
    if (valla) {
      cerrar();
      const marca = valla[1][0].repeat(3);
      const codigo: Linea[] = [];
      for (i++; i < lineas.length && !lineas[i].trimStart().startsWith(marca); i++) codigo.push({ texto: lineas[i].replace(/\s+$/, ''), negritas: [] });
      bloques.push({ tipo: 'codigo', lineas: codigo });
      continue;
    }

    if (!crudo.trim()) {
      cerrar();
      continue;
    }

    // La marca de un dictado va en su propia línea y no se lee como texto.
    const dictado = idDeMarca(crudo);
    if (dictado) {
      cerrar();
      bloques.push({ tipo: 'dictado', id: dictado });
      continue;
    }

    if (!ESCAPADA.test(crudo)) {
      const titulo = TITULO.exec(crudo);
      if (titulo) {
        cerrar();
        bloques.push({ tipo: 'titulo', nivel: Math.min(3, titulo[1].length) as 1 | 2 | 3, linea: leerLinea(titulo[2]) });
        continue;
      }
      if (SEPARADOR.test(crudo)) {
        cerrar();
        bloques.push({ tipo: 'separador' });
        continue;
      }
      // Tabla: una fila con barras y debajo la de guiones. Sin cabecera, la de guiones va primero.
      // La fila de guiones lleva al menos una barra: «---» solo es un separador.
      const conCabecera = esFila(crudo) && !FILA_GUIONES.test(crudo) && esFila(lineas[i + 1]) && FILA_GUIONES.test(lineas[i + 1]);
      const sinCabecera = esFila(crudo) && FILA_GUIONES.test(crudo) && esFila(lineas[i + 1]);
      if (conCabecera || sinCabecera) {
        cerrar();
        const cabecera = conCabecera ? celdas(crudo) : null;
        const filas: Linea[][] = [];
        for (i += conCabecera ? 2 : 1; i < lineas.length && esFila(lineas[i]) && !FILA_GUIONES.test(lineas[i]); i++) filas.push(celdas(lineas[i]));
        i--;
        bloques.push({ tipo: 'tabla', cabecera, filas });
        continue;
      }
      const enCita = CITA.exec(crudo);
      if (enCita) {
        if (!cita) {
          cerrar();
          cita = [];
          bloques.push({ tipo: 'cita', lineas: cita });
        }
        if (enCita[1].trim()) cita.push(leerLinea(enCita[1]));
        continue;
      }
      const vineta = VINETA.exec(crudo);
      const numero = vineta ? null : NUMERO.exec(crudo);
      if (vineta || numero) {
        const sangria = anchoSangria((vineta ?? numero)![1]);
        const ordenada = !!numero;
        if (lista) {
          while (sangrias.length > 1 && sangria < sangrias[sangrias.length - 1]) sangrias.pop();
          if (sangria > sangrias[sangrias.length - 1]) sangrias.push(sangria);
        }
        // Una lista de otro tipo en el primer nivel es otra lista.
        const actual: { elementos: ElementoLista[] } | null = lista;
        const primera = actual?.elementos.find((e) => e.nivel === 0);
        if (!actual || (sangrias.length <= 1 && primera && primera.ordenada !== ordenada)) {
          cerrar();
          lista = { tipo: 'lista', elementos: [] };
          bloques.push(lista);
          sangrias = [sangria];
        }
        const nivel = Math.min(3, sangrias.length - 1);
        (lista as unknown as { elementos: ElementoLista[] }).elementos.push({
          nivel,
          ordenada,
          numero: numero ? numeroDe(numero[2]) : 0,
          lineas: [leerLinea(vineta ? vineta[2] : numero![3])],
        });
        continue;
      }
      // Una línea con sangría justo debajo de un elemento de la lista lo continúa.
      const abierta = lista as { elementos: ElementoLista[] } | null;
      if (abierta && /^[ \t]+\S/.test(crudo)) {
        abierta.elementos[abierta.elementos.length - 1].lineas.push(leerLinea(crudo.trim()));
        continue;
      }
    }

    // Párrafo: las líneas seguidas, cada una en su renglón. Se conserva la sangría japonesa de espacio ancho.
    if (lista || cita) cerrar();
    if (!parrafo) {
      parrafo = [];
      bloques.push({ tipo: 'parrafo', lineas: parrafo });
    }
    (parrafo as Linea[]).push(leerLinea(ESCAPADA.test(crudo) ? crudo.replace(/^(\s*)\\/, '$1') : crudo.replace(/^[ \t]+/, '')));
  }
  return bloques;
}

/** El texto sin marcas, para dárselo a Claude como contexto. */
export function textoPlano(bloques: Bloque[]): string {
  const partes: string[] = [];
  for (const b of bloques) {
    if (b.tipo === 'parrafo' || b.tipo === 'cita' || b.tipo === 'codigo') partes.push(b.lineas.map((l) => l.texto).join('\n'));
    else if (b.tipo === 'titulo') partes.push(b.linea.texto);
    else if (b.tipo === 'lista')
      partes.push(b.elementos.map((e) => `${'  '.repeat(e.nivel)}${e.ordenada ? `${e.numero}.` : '•'} ${e.lineas.map((l) => l.texto).join(' ')}`).join('\n'));
    else if (b.tipo === 'tabla') partes.push([...(b.cabecera ? [b.cabecera] : []), ...b.filas].map((f) => f.map((c) => c.texto).join(' | ')).join('\n'));
  }
  return partes.filter((p) => p.trim()).join('\n\n');
}

export interface FraseDeLinea {
  /** Su posición en la lista de frases del texto entero. */
  indice: number;
  /** Dónde empieza dentro del texto de su línea. */
  inicio: number;
}

/**
 * Las frases de cada línea, en orden de lectura: son la unidad del análisis y de la lectura en voz alta. Una línea de
 * código es una sola frase.
 */
export function frasesDeBloques(bloques: Bloque[], partir: RegExp): { frases: string[]; deLinea: Map<Linea, FraseDeLinea[]> } {
  const frases: string[] = [];
  const deLinea = new Map<Linea, FraseDeLinea[]>();
  const agregar = (l: Linea, partirla = true) => {
    const propias: FraseDeLinea[] = [];
    let inicio = 0;
    for (const f of partirla ? l.texto.split(partir) : [l.texto]) {
      if (f.trim()) {
        propias.push({ indice: frases.length, inicio });
        frases.push(f);
      }
      inicio += f.length;
    }
    deLinea.set(l, propias);
  };
  for (const b of bloques) {
    if (b.tipo === 'parrafo' || b.tipo === 'cita') b.lineas.forEach((l) => agregar(l));
    else if (b.tipo === 'codigo') b.lineas.forEach((l) => agregar(l, false));
    else if (b.tipo === 'titulo') agregar(b.linea);
    else if (b.tipo === 'lista') b.elementos.forEach((e) => e.lineas.forEach((l) => agregar(l)));
    else if (b.tipo === 'tabla') [...(b.cabecera ? [b.cabecera] : []), ...b.filas].forEach((f) => f.forEach((c) => agregar(c)));
  }
  return { frases, deLinea };
}

// ---------- Del HTML al Markdown ----------

/** Lo justo de un nodo del DOM para leer su estructura; así se puede probar sin navegador. */
export interface NodoHtml {
  nodeType: number;
  nodeName: string;
  nodeValue: string | null;
  childNodes: ArrayLike<NodoHtml>;
  getAttribute?(nombre: string): string | null;
}

const OMITIR = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'IFRAME', 'OBJECT', 'EMBED', 'CANVAS', 'VIDEO', 'AUDIO', 'BUTTON', 'SELECT', 'TEXTAREA', 'INPUT', 'RT', 'RP', 'HEAD', 'TITLE', 'META', 'LINK', 'MATH']);
const BLOQUES = new Set(['P', 'DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'MAIN', 'ASIDE', 'NAV', 'FIGURE', 'FIGCAPTION', 'ADDRESS', 'DETAILS', 'SUMMARY', 'FORM', 'FIELDSET', 'CENTER', 'DL', 'DT', 'DD', 'LI', 'BODY', 'HTML', 'CAPTION', 'HGROUP']);
/**
 * Caracteres anchos de Asia oriental: los ideogramas, los dos silabarios, la puntuación y los signos de ancho completo,
 * y los puntos suspensivos. Son las escrituras que no separan las palabras con espacios.
 */
const ANCHOS = '\\p{sc=Han}\\p{sc=Hiragana}\\p{sc=Katakana}\\u3000-\\u303F\\u30FB\\u30FC\\uFF01-\\uFF60\\u2026';
/** Un salto de línea del código fuente entre dos de esos caracteres no es un espacio, como dicen las reglas de CSS. */
const SALTO_CJK = new RegExp(`(?<=[${ANCHOS}])[ \\t\\r\\f]*\\n[ \\t\\n\\r\\f]*(?=[${ANCHOS}])`, 'gu');
/** Solo los espacios del HTML se juntan; el espacio ancho japonés y el espacio duro se quedan. */
const ESPACIOS_HTML = /[ \t\n\r\f]+/g;
const recortar = (s: string) => s.replace(/^[ \t\n\r\f]+|[ \t\n\r\f]+$/g, '');
/** Lo que al principio de una línea se leería como una marca de Markdown. La viñeta ・ sí se deja: es una lista. */
const INICIO_CON_MARCA = /^(?:#|>|\+|\||`|~|[-*_](?:\s|[-*_]{2,})|\d{1,4}[.)]\s)/;

const atributo = (n: NodoHtml, a: string) => n.getAttribute?.(a) ?? null;
const oculto = (n: NodoHtml) =>
  atributo(n, 'hidden') !== null || atributo(n, 'aria-hidden') === 'true' || /display\s*:\s*none|visibility\s*:\s*hidden/i.test(atributo(n, 'style') ?? '');
const pesoDe = (n: NodoHtml) => /font-weight\s*:\s*(\w+)/i.exec(atributo(n, 'style') ?? '')?.[1]?.toLowerCase();
const esNegrita = (n: NodoHtml, nombre: string) => {
  const peso = pesoDe(n);
  // Google Docs envuelve todo lo copiado en un <b style="font-weight:normal">.
  if (nombre === 'B' || nombre === 'STRONG') return !(peso && /^(normal|lighter|[1-4]00)$/.test(peso));
  return !!peso && /^(bold|bolder|[6-9]00)$/.test(peso);
};

class Escritor {
  private bloques: string[] = [];
  linea = '';
  negrita = 0;
  cierres = 0;

  texto(t: string) {
    this.linea += t;
  }

  salto() {
    this.linea += '\n';
  }

  cerrarParrafo() {
    if (!this.linea) return;
    this.cierres++;
    const lineas = this.linea.split('\n').map((l) => recortar(l.replace(/ {2,}/g, ' ')));
    this.linea = '';
    let grupo: string[] = [];
    const vaciar = () => {
      if (grupo.length) this.bloques.push(grupo.map((l) => (INICIO_CON_MARCA.test(l) ? `\\${l}` : l)).join('\n'));
      grupo = [];
    };
    // Dos saltos seguidos son un párrafo nuevo, como se ve en la página.
    for (const l of lineas) {
      if (l) grupo.push(l);
      else vaciar();
    }
    vaciar();
  }

  bloque(md: string) {
    this.cerrarParrafo();
    if (md.trim()) this.bloques.push(md);
  }

  resultado(): string {
    this.cerrarParrafo();
    return this.bloques.join('\n\n');
  }
}

const hijos = (n: NodoHtml) => Array.from(n.childNodes);
const nombreDe = (n: NodoHtml) => n.nodeName.toUpperCase();

function escribir(n: NodoHtml, e: Escritor) {
  if (n.nodeType === 3) {
    e.texto((n.nodeValue ?? '').replace(SALTO_CJK, '').replace(ESPACIOS_HTML, ' ').replace(/\*\*/g, '\\*\\*').replace(/`/g, '\\`'));
    return;
  }
  // Elementos, documentos y fragmentos; los comentarios no.
  if (n.nodeType !== 1 && n.nodeType !== 9 && n.nodeType !== 11) return;
  const nombre = nombreDe(n);
  if (OMITIR.has(nombre) || oculto(n)) return;
  if (nombre === 'BR') return e.salto();
  if (nombre === 'HR') return e.bloque('---');
  if (nombre === 'IMG') {
    // Solo el texto de las imágenes que hacen de letra, como un emoji.
    const alt = atributo(n, 'alt') ?? '';
    if (alt && [...alt].length <= 2) e.texto(alt);
    return;
  }
  if (/^H[1-6]$/.test(nombre)) {
    const t = enLinea(n);
    if (t) e.bloque(`${'#'.repeat(Math.min(3, Number(nombre[1])))} ${t}`);
    return;
  }
  if (nombre === 'UL' || nombre === 'OL') return e.bloque(lista(n, 0));
  if (nombre === 'PRE') return e.bloque(codigo(n));
  if (nombre === 'TABLE') return e.bloque(tabla(n));
  if (nombre === 'BLOCKQUOTE') return e.bloque(cita(n));
  if (!e.negrita && esNegrita(n, nombre)) return conNegrita(n, e);

  const esBloque = BLOQUES.has(nombre);
  if (esBloque) e.cerrarParrafo();
  for (const h of hijos(n)) escribir(h, e);
  if (esBloque) e.cerrarParrafo();
}

function conNegrita(n: NodoHtml, e: Escritor) {
  const antes = e.linea.length;
  const cierres = e.cierres;
  e.negrita++;
  for (const h of hijos(n)) escribir(h, e);
  e.negrita--;
  // Si dentro había bloques, la negrita no se puede marcar en una sola línea: se queda sin marcar.
  if (e.cierres !== cierres) return;
  const dentro = e.linea.slice(antes);
  const marcada = dentro
    .split('\n')
    .map((l) => {
      const m = /^(\s*)(.*?)(\s*)$/s.exec(l)!;
      return m[2] ? `${m[1]}**${m[2]}**${m[3]}` : l;
    })
    .join('\n');
  e.linea = e.linea.slice(0, antes) + marcada;
}

function enLinea(n: NodoHtml): string {
  const sub = new Escritor();
  for (const h of hijos(n)) escribir(h, sub);
  return recortar(sub.resultado().replace(/\s*\n+\s*/g, ' ').replace(/^\\/, ''));
}

function lista(n: NodoHtml, nivel: number): string {
  const ordenada = nombreDe(n) === 'OL';
  let numero = Number(atributo(n, 'start')) || 1;
  const salida: string[] = [];
  const sangria = '  '.repeat(nivel);
  for (const h of hijos(n)) {
    if (h.nodeType !== 1) continue;
    const nombre = nombreDe(h);
    if (OMITIR.has(nombre) || oculto(h)) continue;
    if (nombre === 'UL' || nombre === 'OL') {
      salida.push(lista(h, nivel + 1));
      continue;
    }
    const sub = new Escritor();
    const anidadas: NodoHtml[] = [];
    for (const x of hijos(h)) {
      const nx = nombreDe(x);
      if (nx === 'UL' || nx === 'OL') anidadas.push(x);
      else escribir(x, sub);
    }
    const lineas = sub.resultado().split(/\n+/).map(recortar).filter(Boolean);
    const marca = ordenada ? `${numero++}. ` : '- ';
    if (lineas.length) {
      salida.push(`${sangria}${marca}${lineas[0]}`);
      for (const extra of lineas.slice(1)) salida.push(`${sangria}  ${extra}`);
    } else if (anidadas.length) salida.push(`${sangria}${marca.trimEnd()}`);
    for (const a of anidadas) salida.push(lista(a, nivel + 1));
  }
  return salida.filter(Boolean).join('\n');
}

function textoCrudo(n: NodoHtml): string {
  if (n.nodeType === 3) return n.nodeValue ?? '';
  if (n.nodeType !== 1) return '';
  const nombre = nombreDe(n);
  if (OMITIR.has(nombre)) return '';
  if (nombre === 'BR') return '\n';
  const t = hijos(n).map(textoCrudo).join('');
  return BLOQUES.has(nombre) && t && !t.endsWith('\n') ? `${t}\n` : t;
}

function codigo(n: NodoHtml): string {
  const texto = textoCrudo(n).replace(/\r\n?/g, '\n').replace(/\n+$/, '');
  if (!texto.trim()) return '';
  const valla = texto.includes('```') ? '~~~' : '```';
  return `${valla}\n${texto}\n${valla}`;
}

function tabla(n: NodoHtml): string {
  const filas: { celdas: string[]; cabecera: boolean }[] = [];
  const buscar = (x: NodoHtml) => {
    for (const h of hijos(x)) {
      const nombre = nombreDe(h);
      if (nombre === 'TR') {
        const celdas: string[] = [];
        let cabecera = true;
        for (const c of hijos(h)) {
          const nc = nombreDe(c);
          if (nc !== 'TD' && nc !== 'TH') continue;
          if (nc === 'TD') cabecera = false;
          celdas.push(enLinea(c).replace(/\|/g, '\\|'));
          const extra = Math.min(20, Number(atributo(c, 'colspan')) || 1) - 1;
          for (let k = 0; k < extra; k++) celdas.push('');
        }
        if (celdas.length) filas.push({ celdas, cabecera });
      } else if (nombre === 'THEAD' || nombre === 'TBODY' || nombre === 'TFOOT') buscar(h);
    }
  };
  buscar(n);
  if (!filas.length) return '';
  const columnas = Math.max(...filas.map((f) => f.celdas.length));
  const fila = (c: string[]) => `| ${[...c, ...Array<string>(columnas - c.length).fill('')].join(' | ')} |`;
  const guiones = `| ${Array<string>(columnas).fill('---').join(' | ')} |`;
  if (filas[0].cabecera && filas.length > 1) return [fila(filas[0].celdas), guiones, ...filas.slice(1).map((f) => fila(f.celdas))].join('\n');
  return [guiones, ...filas.map((f) => fila(f.celdas))].join('\n');
}

function cita(n: NodoHtml): string {
  const sub = new Escritor();
  for (const h of hijos(n)) escribir(h, sub);
  const md = sub.resultado();
  return md.trim() ? md.split('\n').map((l) => (l ? `> ${l}` : '>')).join('\n') : '';
}

/** La estructura de un trozo de HTML ya leído, como Markdown sencillo. */
export function estructuraDeNodo(raiz: NodoHtml): string {
  const e = new Escritor();
  escribir(raiz, e);
  return e.resultado();
}

/** La estructura de un HTML, como Markdown sencillo. Necesita el DOMParser del navegador. */
export function estructuraDeHtml(html: string): string {
  return estructuraDeNodo(new DOMParser().parseFromString(html, 'text/html').body as unknown as NodoHtml);
}

/** El texto plano tal cual llega, con los saltos de línea normalizados y sin espacios al final de cada línea. */
export function normalizarTextoPlano(texto: string): string {
  return texto
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Lo copiado, con su estructura: del HTML si lo hay y dice algo, y si no, del texto plano. */
export function textoConEstructura(html: string | null | undefined, texto: string | null | undefined): string {
  if (html?.trim()) {
    const md = estructuraDeHtml(html);
    if (md.trim()) return md;
  }
  return normalizarTextoPlano(texto ?? '');
}
