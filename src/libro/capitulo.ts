// Un capítulo de un EPUB de texto, pasado a la página del libro elemento a elemento. Se lee en un documento aparte, que
// no ejecuta nada, y solo se copia lo que no puede ejecutarse ni cargar nada de fuera: ni scripts, ni marcos, ni
// formularios, ni atributos on*, ni direcciones que no sean del propio libro. La página es de la extensión y guarda la
// clave de Claude: un libro no debe poder hacer nada en ella.

import { estiloEnLinea, esInterna, prepararCss, type RecursosCss } from '../nucleo/cssLibro';
import { resolverRuta } from '../nucleo/libro';

const XHTML = 'http://www.w3.org/1999/xhtml';
const SVG = 'http://www.w3.org/2000/svg';
const MATHML = 'http://www.w3.org/1998/Math/MathML';
const XLINK = 'http://www.w3.org/1999/xlink';
const OPS = 'http://www.idpf.org/2007/ops';
const XML = 'http://www.w3.org/XML/1998/namespace';

/** Lo que no se copia, con todo su contenido. Los estilos se recogen aparte. */
const FUERA = new Set([
  'script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'noscript', 'template', 'link', 'meta', 'base', 'title', 'head', 'style',
  'input', 'button', 'select', 'textarea', 'option', 'optgroup', 'datalist', 'output', 'audio', 'video', 'source', 'track', 'canvas', 'portal',
  'dialog', 'slot', 'animate', 'animatemotion', 'animatetransform', 'set', 'handler', 'listener', 'discard',
]);
/** Atributos que cargan algo, cambian la página o no pintan nada que haga falta para leer. */
const ATRIBUTOS_FUERA = new Set([
  'srcdoc', 'formaction', 'action', 'ping', 'background', 'poster', 'srcset', 'sizes', 'integrity', 'nonce', 'http-equiv', 'autofocus',
  'contenteditable', 'target', 'download', 'is', 'popover', 'popovertarget', 'popovertargetaction', 'manifest', 'codebase', 'archive', 'lowsrc',
  'dynsrc', 'attributename', 'from', 'to', 'values', 'by',
]);

export interface RecursosLibro extends RecursosCss {
  /** El número de capítulo de un archivo del libro, si es uno. */
  capituloDe(ruta: string): number | undefined;
}

export interface CapituloPintado {
  /** El CSS del capítulo, en orden, ya preparado. */
  estilos: string[];
  html: Record<string, string>;
  body: Record<string, string>;
  contenido: DocumentFragment;
}

/** El documento del capítulo: como XHTML, que es lo que manda la norma, y si no se puede, como HTML. */
function leer(xhtml: string): Document {
  const xml = new DOMParser().parseFromString(xhtml, 'application/xhtml+xml');
  if (!xml.getElementsByTagName('parsererror').length && xml.documentElement) return xml;
  return new DOMParser().parseFromString(xhtml, 'text/html');
}

/** Los atributos de <html> o <body> que importan para leer: el idioma, el sentido, las clases y el estilo. */
function atributosRaiz(el: Element | null): Record<string, string> {
  const salida: Record<string, string> = {};
  if (!el) return salida;
  const lang = el.getAttributeNS(XML, 'lang') ?? el.getAttribute('xml:lang') ?? el.getAttribute('lang');
  if (lang) salida.lang = lang;
  for (const a of ['dir', 'class', 'id']) {
    const v = el.getAttribute(a);
    if (v) salida[a] = v;
  }
  const estilo = el.getAttribute('style');
  if (estilo) salida.style = estiloEnLinea(estilo);
  return salida;
}

export async function prepararCapitulo(destino: Document, xhtml: string, ruta: string, recursos: RecursosLibro): Promise<CapituloPintado> {
  const origen = leer(xhtml);
  const tareas: Promise<unknown>[] = [];

  // Las hojas del libro, en el orden en que aparecen: las enlazadas y los <style>, también los de dentro de un SVG.
  const estilos: Promise<string>[] = [];
  for (const el of origen.querySelectorAll('link, style')) {
    if (el.localName === 'style') estilos.push(prepararCss(el.textContent ?? '', ruta, recursos));
    else {
      const rel = (el.getAttribute('rel') ?? '').toLowerCase().split(/\s+/);
      const href = el.getAttribute('href') ?? '';
      if (!rel.includes('stylesheet') || rel.includes('alternate') || !esInterna(href)) continue;
      const hoja = resolverRuta(ruta, href);
      estilos.push(recursos.texto(hoja).then((t) => (t ? prepararCss(t, hoja, recursos) : '')));
    }
  }

  /** Una dirección del libro hecha URL de un archivo suyo, o nada si no es del libro. */
  const cargar = (el: Element, atributo: string, valor: string) => {
    const v = valor.trim();
    if (/^data:image\//i.test(v)) {
      el.setAttribute(atributo, v);
      return;
    }
    if (!esInterna(v)) return;
    tareas.push(recursos.url(resolverRuta(ruta, v)).then((u) => u && el.setAttribute(atributo, u)));
  };

  /** Un enlace: dentro del capítulo, a otro capítulo o fuera del libro, en una pestaña nueva. Lo demás se queda sin destino. */
  const enlazar = (el: Element, valor: string) => {
    const v = valor.trim();
    if (v.startsWith('#')) {
      el.setAttribute('href', v);
      return;
    }
    if (/^(https?:|mailto:)/i.test(v)) {
      el.setAttribute('href', v);
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
      return;
    }
    if (!esInterna(v)) return;
    const capitulo = recursos.capituloDe(resolverRuta(ruta, v));
    if (capitulo === undefined) return;
    const fragmento = v.includes('#') ? v.slice(v.indexOf('#') + 1) : '';
    el.setAttribute('href', `#${fragmento}`);
    el.setAttribute('data-kk-capitulo', String(capitulo));
    if (fragmento) el.setAttribute('data-kk-fragmento', fragmento);
  };

  const copiarAtributos = (el: Element, nuevo: Element) => {
    const nombre = el.localName.toLowerCase();
    for (const a of [...el.attributes]) {
      const local = a.localName.toLowerCase();
      if (local.startsWith('on') || ATRIBUTOS_FUERA.has(local)) continue;
      if (local === 'href' && (a.namespaceURI === XLINK || !a.namespaceURI)) {
        if (nombre === 'a' || nombre === 'area') enlazar(nuevo, a.value);
        else if (nombre === 'image' || nombre === 'feimage') cargar(nuevo, 'href', a.value);
        // En un SVG, <use> y los degradados solo pueden apuntar a algo del mismo documento.
        else if (a.value.trim().startsWith('#')) nuevo.setAttribute('href', a.value.trim());
        continue;
      }
      if (local === 'src' && !a.namespaceURI) {
        if (nombre === 'img') cargar(nuevo, 'src', a.value);
        continue;
      }
      if (local === 'data' && !a.namespaceURI) continue;
      if (local === 'style' && !a.namespaceURI) {
        nuevo.setAttribute('style', estiloEnLinea(a.value));
        continue;
      }
      if (a.namespaceURI === XML && local === 'lang') {
        nuevo.setAttribute('lang', a.value);
        continue;
      }
      if (a.namespaceURI === OPS) {
        nuevo.setAttributeNS(OPS, `epub:${a.localName}`, a.value);
        continue;
      }
      if (a.namespaceURI && a.namespaceURI !== XHTML) continue;
      try {
        nuevo.setAttribute(a.localName, a.value);
      } catch {
        // Un nombre de atributo que el navegador no admite se queda fuera.
      }
    }
  };

  const copiar = (n: Node): Node | null => {
    if (n.nodeType === Node.TEXT_NODE || n.nodeType === Node.CDATA_SECTION_NODE) return destino.createTextNode(n.nodeValue ?? '');
    if (n.nodeType !== Node.ELEMENT_NODE) return null;
    const el = n as Element;
    const nombre = el.localName.toLowerCase();
    if (FUERA.has(nombre)) return null;
    const ns = el.namespaceURI;
    let nuevo: Element | DocumentFragment;
    if (ns === SVG || ns === MATHML) nuevo = destino.createElementNS(ns, el.localName);
    // Un formulario o un elemento de otro espacio de nombres (como epub:switch) se quita, y se deja lo de dentro.
    else if ((ns === XHTML || ns === null) && nombre !== 'form') nuevo = destino.createElement(nombre);
    else nuevo = destino.createDocumentFragment();
    if (nuevo instanceof Element) copiarAtributos(el, nuevo);
    for (const h of el.childNodes) {
      const c = copiar(h);
      if (c) nuevo.appendChild(c);
    }
    return nuevo;
  };

  const raiz = origen.documentElement;
  const cuerpo = (origen as Document).body ?? raiz?.querySelector('body') ?? raiz;
  const contenido = destino.createDocumentFragment();
  for (const h of cuerpo?.childNodes ?? []) {
    const c = copiar(h);
    if (c) contenido.appendChild(c);
  }
  await Promise.all(tareas);
  return {
    estilos: (await Promise.all(estilos)).filter(Boolean),
    html: atributosRaiz(raiz),
    body: cuerpo && cuerpo !== raiz ? atributosRaiz(cuerpo) : {},
    contenido,
  };
}
