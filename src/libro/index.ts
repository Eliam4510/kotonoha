// La página de un EPUB de texto, dentro del visor: un capítulo con su propio formato (su CSS, su ruby, su escritura
// vertical) y, encima, el lector de páginas de Kotonoha, el mismo que en cualquier web. El visor pone la barra, el zoom y
// el índice; aquí se pinta el capítulo, se pasa de página y se avisa de por dónde se va.

import { leerAjustes } from '../compartido/ajustes';
import { archivoDocumento } from '../compartido/documentos';
import { fijarIdioma, tr } from '../compartido/i18n';
import { iniciarLectorWeb } from '../contenido/lectorWeb';
import { leerEpubDeTexto } from '../nucleo/libro';
import { fuenteDeArchivo, leerEntrada, leerIndiceZip } from '../nucleo/zip';
import { prepararCapitulo, type RecursosLibro } from './capitulo';
import { DEL_LIBRO, DEL_VISOR, type MensajeLibro, type MensajeVisor } from './mensajes';

const parametros = new URLSearchParams(location.search);
const id = parametros.get('id') ?? '';
const numero = Number(parametros.get('c') ?? 0);
const fraccionInicial = Math.max(0, Math.min(1, Number(parametros.get('p') ?? 0) || 0));
const horizontalForzado = parametros.get('h') === '1';

const TIPOS: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml',
  woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf',
};
const tipoDe = (ruta: string) => TIPOS[ruta.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';

const enviar = (m: MensajeLibro) => parent.postMessage({ kk: DEL_LIBRO, ...m }, location.origin);

const raiz = () => (document.scrollingElement ?? document.documentElement) as HTMLElement;
let vertical = false;
/** En vertical de derecha a izquierda, la página empieza a la derecha y avanzar es ir hacia la izquierda. */
const haciaIzquierda = () => getComputedStyle(document.documentElement).writingMode !== 'vertical-lr';

/** Por dónde se va en el capítulo, de 0 a 1. */
function fraccion(): number {
  const r = raiz();
  const max = vertical ? r.scrollWidth - r.clientWidth : r.scrollHeight - r.clientHeight;
  if (max <= 1) return 0;
  return Math.max(0, Math.min(1, (vertical ? Math.abs(r.scrollLeft) : r.scrollTop) / max));
}

function irAFraccion(f: number) {
  const r = raiz();
  if (vertical) r.scrollLeft = (haciaIzquierda() ? -1 : 1) * f * (r.scrollWidth - r.clientWidth);
  else r.scrollTop = f * (r.scrollHeight - r.clientHeight);
}

function irAFragmento(fragmento: string): boolean {
  const el = document.getElementById(fragmento) ?? document.getElementsByName(fragmento)[0];
  el?.scrollIntoView({ block: 'start', inline: 'nearest' });
  return !!el;
}

/** Una página adelante o atrás; al pasar del final o del principio del capítulo, se avisa al visor para que cambie. */
function pasar(paso: 1 | -1) {
  const r = raiz();
  const f = fraccion();
  const sinSitio = (vertical ? r.scrollWidth - r.clientWidth : r.scrollHeight - r.clientHeight) <= 1;
  if (sinSitio || (paso > 0 && f >= 0.999) || (paso < 0 && f <= 0.001)) {
    enviar({ tipo: 'limite', paso });
    return;
  }
  // Un poco menos de una pantalla: la última línea de la anterior sigue a la vista y no se pierde el hilo.
  if (vertical) r.scrollBy({ left: (haciaIzquierda() ? -1 : 1) * paso * r.clientWidth * 0.92, behavior: 'instant' });
  else r.scrollBy({ top: paso * r.clientHeight * 0.92, behavior: 'instant' });
}

function mostrarError(mensaje: string) {
  const p = document.createElement('p');
  p.className = 'kk-aviso';
  p.setAttribute('role', 'alert');
  p.textContent = mensaje;
  document.body.replaceChildren(p);
  enviar({ tipo: 'error', mensaje });
}

/** Espera a lo que mueve el texto al llegar, las fuentes y las imágenes, sin esperar más de lo razonable. */
async function esperarDiseno() {
  const imagenes = [...document.images].map((i) => i.decode().catch(() => {}));
  await Promise.race([Promise.all([document.fonts.ready, ...imagenes]), new Promise((ok) => setTimeout(ok, 1500))]);
}

async function abrir() {
  const archivo = await archivoDocumento(id);
  if (!archivo) throw new Error(tr('El archivo de este libro no está en este equipo. Vuelve a importarlo desde la Biblioteca.'));
  const f = fuenteDeArchivo(archivo);
  const indice = await leerIndiceZip(f);
  const libro = await leerEpubDeTexto(f, indice, '');
  const ruta = libro.capitulos[numero];
  const entrada = ruta ? indice.get(ruta) : undefined;
  if (!entrada) throw new Error(tr('Falta el capítulo {0} del libro.', numero + 1));

  const urls = new Map<string, Promise<string | null>>();
  const recursos: RecursosLibro = {
    url: (r) => {
      let u = urls.get(r);
      if (!u) {
        u = (async () => {
          const e = indice.get(r);
          return e ? URL.createObjectURL(new Blob([(await leerEntrada(f, e)) as BlobPart], { type: tipoDe(r) })) : null;
        })();
        urls.set(r, u);
      }
      return u;
    },
    texto: async (r) => {
      const e = indice.get(r);
      return e ? new TextDecoder().decode(await leerEntrada(f, e)) : null;
    },
    capituloDe: (r) => {
      const i = libro.capitulos.indexOf(r);
      return i < 0 ? undefined : i;
    },
  };

  const c = await prepararCapitulo(document, new TextDecoder().decode(await leerEntrada(f, entrada)), ruta, recursos);
  for (const css of c.estilos) {
    const s = document.createElement('style');
    s.textContent = css;
    document.head.appendChild(s);
  }
  const html = document.documentElement;
  for (const [k, v] of Object.entries(c.html)) html.setAttribute(k, v);
  document.body.replaceChildren(c.contenido);
  for (const [k, v] of Object.entries(c.body)) document.body.setAttribute(k, v);
  if (!html.lang && libro.idioma) html.lang = libro.idioma;
  document.title = libro.titulo;

  // Un libro que pone la escritura vertical en <body> y no en <html>: la página entera tiene que ir como el texto, o se
  // abriría por el final del capítulo.
  const delCuerpo = getComputedStyle(document.body).writingMode;
  if (!getComputedStyle(html).writingMode.startsWith('vertical') && delCuerpo.startsWith('vertical')) html.style.writingMode = delCuerpo;
  const verticalPropio = getComputedStyle(html).writingMode.startsWith('vertical');
  if (horizontalForzado) html.classList.add('kk-forzar-horizontal');
  vertical = verticalPropio && !horizontalForzado;
  html.classList.add(vertical ? 'kk-vertical' : 'kk-horizontal');

  await esperarDiseno();
  const fragmento = decodeURIComponent(location.hash.slice(1));
  if (!fragmento || !irAFragmento(fragmento)) irAFraccion(fraccionInicial);
  enviar({ tipo: 'listo', vertical, verticalPropio });
  instalarControles();
  await iniciarLectorWeb({ libro: true });
}

function instalarControles() {
  let pendiente = 0;
  let ultimo = 0;
  window.addEventListener(
    'scroll',
    () => {
      pendiente ||= requestAnimationFrame(() => {
        pendiente = 0;
        const f = fraccion();
        if (Math.abs(f - ultimo) < 0.002) return;
        ultimo = f;
        enviar({ tipo: 'posicion', fraccion: f });
      });
    },
    { passive: true }
  );

  // En vertical la rueda va de lado, que es por donde avanza el texto. Con Ctrl, el zoom es el del visor.
  window.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        enviar({ tipo: 'zoom', paso: e.deltaY < 0 ? 1 : -1 });
        return;
      }
      if (!vertical || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return;
      // La ficha de una palabra tiene su propio desplazamiento.
      if (e.composedPath().some((n) => n instanceof Element && n.localName === 'kotonoha-overlay')) return;
      e.preventDefault();
      const linea = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? raiz().clientWidth : 1;
      raiz().scrollBy({ left: (haciaIzquierda() ? -1 : 1) * e.deltaY * linea, behavior: 'instant' });
    },
    { passive: false }
  );

  window.addEventListener('keydown', (e) => {
    if (e.defaultPrevented) return;
    const objetivo = e.composedPath()[0] as HTMLElement | undefined;
    if (objetivo && (objetivo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(objetivo.tagName))) return;
    if (e.ctrlKey || e.metaKey) {
      const paso = e.key === '+' || e.key === '=' ? 1 : e.key === '-' ? -1 : e.key === '0' ? 0 : null;
      if (paso === null) return;
      e.preventDefault();
      enviar({ tipo: 'zoom', paso });
      return;
    }
    if (e.altKey) return;
    const izquierda = vertical && haciaIzquierda();
    let paso: 1 | -1 | null = null;
    if (e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) paso = 1;
    else if (e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) paso = -1;
    else if (e.key === 'ArrowLeft') paso = izquierda ? 1 : -1;
    else if (e.key === 'ArrowRight') paso = izquierda ? -1 : 1;
    else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      irAFraccion(e.key === 'Home' ? 0 : 1);
      return;
    } else if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      enviar({ tipo: 'pantallaCompleta' });
      return;
    }
    if (paso === null) return;
    e.preventDefault();
    pasar(paso);
  });

  // Un enlace a otro capítulo lo abre el visor; uno dentro del capítulo funciona solo.
  document.addEventListener('click', (e) => {
    const a = (e.target as Element | null)?.closest?.('a[data-kk-capitulo]');
    if (!(a instanceof HTMLElement || a instanceof SVGElement)) return;
    e.preventDefault();
    enviar({ tipo: 'enlace', capitulo: Number(a.dataset.kkCapitulo), fragmento: a.dataset.kkFragmento });
  });

  window.addEventListener('message', (e: MessageEvent) => {
    if (e.source !== parent || e.origin !== location.origin) return;
    const m = e.data as MensajeVisor & { kk?: string };
    if (m?.kk !== DEL_VISOR) return;
    if (m.tipo === 'pagina') pasar(m.paso);
    else if (m.tipo === 'ir' && !(m.fragmento && irAFragmento(m.fragmento))) irAFraccion(m.fraccion ?? 0);
  });
}

leerAjustes()
  .then((a) => fijarIdioma(a.idiomaInterfaz))
  .catch(() => {})
  .then(abrir)
  .catch((e) => mostrarError(e instanceof Error ? e.message : String(e)));
