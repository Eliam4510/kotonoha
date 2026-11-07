// Lector de páginas: colores, furigana y consulta de palabras en cualquier texto japonés.
//
// Nunca reescribe la página. Ver lector/pintor.ts: no añade nada a su contenido, y sitios hechos con React, como el chat
// de Claude, no notan nada. Haz clic en una palabra para consultarla; en enlaces y botones, el clic sigue siendo del sitio.

import { signal } from '@preact/signals';
import { render } from 'preact';
import { useState } from 'preact/hooks';
import { alCambiarAjustes, type Ajustes, guardarAjustes, leerAjustes } from '../compartido/ajustes';
import { bcp47Actual, fijarIdioma, tr } from '../compartido/i18n';
import { alRecibirEvento, motor } from '../compartido/rpc';
import { alinearSuperficies, fraseAlrededor, partirEnFrases } from '../nucleo/lectorTexto';
import base from '../ui/estilos';
import { colocarJunto, Ficha } from '../ui/Ficha';
import { cargarFuentes } from '../ui/fuentes';
import { Icono } from '../ui/iconos';
import { aplicarLengua, lengua } from '../ui/lengua';
import { variablesPaleta } from '../ui/paletas';
import { avisar, avisos } from './estado';
import { type Bloque, contenedorDe, esAparte, IndicePagina, rangoDe, type TokenPagina } from './lector/indice';
import { Pintor } from './lector/pintor';
import overlay from './overlay.css';
import { Avisos } from './Reproductor';
import { construirBorrador } from './tarjetas';

interface Consulta {
  bloque: Bloque;
  token: TokenPagina;
  rango: Range;
  ancla: { left: number; top: number; width: number; height: number };
  frase: string;
  antes: string[];
  despues: string[];
  /** Abierta con un clic: se queda hasta cerrarla. Al pasar el ratón, se va al apartarse. */
  fijada: boolean;
}

const consultaWeb = signal<Consulta | null>(null);
const ajustesWeb = signal<Ajustes | null>(null);
const panelAbierto = signal(false);
const hayTexto = signal(false);

let indice: IndicePagina;
let pintor: Pintor | null = null;
let anfitrion: HTMLElement;
let montado = false;

// ---------- Análisis ----------

const pendientes = new Set<Bloque>();
const cacheAnalisis = new Map<string, TokenPagina[]>();
let analizando = false;

function tokensDesde(texto: string, palabras: Awaited<ReturnType<typeof motor.analizarTexto>>[number]): TokenPagina[] {
  const sitios = alinearSuperficies(texto, palabras.map((p) => p.superficie));
  const tokens: TokenPagina[] = [];
  palabras.forEach((p, i) => {
    const s = sitios[i];
    if (s) tokens.push({ p, inicio: s.inicio, fin: s.fin });
  });
  return tokens;
}

/** Copia los tokens: dos bloques con el mismo texto no pueden compartir sus rangos. */
const copiar = (t: TokenPagina[]): TokenPagina[] => t.map((x) => ({ p: x.p, inicio: x.inicio, fin: x.fin }));

async function analizarLote(lote: Bloque[]) {
  const sinCache = lote.filter((b) => !cacheAnalisis.has(b.texto));
  if (sinCache.length) {
    const unicos = [...new Set(sinCache.map((b) => b.texto))];
    const lineas = await motor.analizarTexto(unicos.join('\n'));
    unicos.forEach((t, i) => {
      if (lineas[i]) cacheAnalisis.set(t, tokensDesde(t, lineas[i]));
    });
    if (cacheAnalisis.size > 8000) {
      for (const k of [...cacheAnalisis.keys()].slice(0, 2000)) cacheAnalisis.delete(k);
    }
  }
  const listos: Bloque[] = [];
  for (const b of lote) {
    // Otra petición pudo adelantarse, como la de pasar el ratón.
    if (b.tokens) continue;
    const t = cacheAnalisis.get(b.texto);
    if (!t) continue;
    b.tokens = copiar(t);
    if (b.cerca && indice.bloques.has(b)) listos.push(b);
  }
  pintor?.pintarLote(listos);
}

/** Cuánto le falta a un bloque para estar a la vista. */
function distanciaAPantalla(b: Bloque): number {
  // Un contenedor con varios bloques puede medir páginas enteras: entonces hay que medir el bloque.
  const varios = (indice.porContenedor.get(b.contenedor)?.length ?? 0) > 1;
  const c = varios ? rangoDe(b, 0, b.texto.length)?.getBoundingClientRect() : b.contenedor.getBoundingClientRect();
  if (!c) return Infinity;
  if (c.bottom < 0) return -c.bottom;
  return c.top > innerHeight ? c.top - innerHeight : 0;
}

/** Lo que se ve, primero. Por lotes pequeños: lo de la pantalla no tiene que esperar a todo lo de alrededor. */
function siguienteLote(): Bloque[] {
  const porAnalizar: { b: Bloque; d: number }[] = [];
  const yaAnalizados: Bloque[] = [];
  for (const b of pendientes) {
    if (!b.cerca || !indice.bloques.has(b)) {
      pendientes.delete(b);
    } else if (b.tokens) {
      pendientes.delete(b);
      yaAnalizados.push(b);
    } else {
      porAnalizar.push({ b, d: distanciaAPantalla(b) });
    }
  }
  pintor?.pintarLote(yaAnalizados);
  porAnalizar.sort((x, y) => x.d - y.d);
  const lote: Bloque[] = [];
  let caracteres = 0;
  for (const { b } of porAnalizar) {
    pendientes.delete(b);
    lote.push(b);
    caracteres += b.texto.length;
    if (caracteres > 3000) break;
  }
  return lote;
}

async function procesarCola() {
  if (analizando) return;
  analizando = true;
  let fallos = 0;
  try {
    while (pendientes.size) {
      const lote = siguienteLote();
      try {
        if (lote.length) await analizarLote(lote);
        fallos = 0;
      } catch (e) {
        // El motor puede estar arrancando. Lo que no se analizó vuelve a la cola: si no, ese texto se quedaría sin pintar.
        for (const b of lote) if (b.cerca && !b.tokens) pendientes.add(b);
        if (++fallos >= 4) {
          console.debug('Kotonoha: no se pudo analizar el texto', e);
          break;
        }
        await new Promise((r) => setTimeout(r, 500 * fallos));
      }
      actualizarMedidas();
    }
  } finally {
    analizando = false;
    actualizarMedidas();
  }
}

// ---------- Qué está cerca de la pantalla ----------

const MUCHOS_BLOQUES = 24;
let observador: IntersectionObserver | null = null;
const contenedoresCerca = new Set<Element>();
const contenedoresGrandes = new Set<Element>();
const cercanosGrandes = new Map<Element, Set<Bloque>>();
/** Hasta dónde se pinta fuera de la pantalla, en pantallas. Cuanto más se pinta, más le cuesta al navegador cada cambio. */
const MARGEN_CERCA = 0.6;

/**
 * Lo que se aleja se retira con calma y en grupo. Cada cambio en el DOM obliga al navegador a reconstruir todos los
 * resaltados, así que conviene agruparlos; y si el texto vuelve antes de retirarlo, no hace falta tocar nada.
 */
const porQuitar = new Set<Bloque>();
let temporizadorQuitar: ReturnType<typeof setTimeout> | null = null;
function vaciarQuitar() {
  temporizadorQuitar = null;
  for (const b of porQuitar) pintor?.quitar(b);
  porQuitar.clear();
}

function ponerCerca(b: Bloque, cerca: boolean) {
  if (b.cerca === cerca) return;
  b.cerca = cerca;
  if (cerca) {
    if (!porQuitar.delete(b)) pendientes.add(b);
    return;
  }
  pendientes.delete(b);
  porQuitar.add(b);
  temporizadorQuitar ??= setTimeout(vaciarQuitar, 400);
}

/**
 * Un solo elemento puede tener miles de líneas separadas por <br>, como una novela entera. Se pinta solo lo que
 * está cerca de la pantalla, buscando con una búsqueda binaria porque van en orden.
 */
function actualizarGrande(contenedor: Element) {
  const lista = indice.ordenados(contenedor);
  if (!lista.length) return;
  const margen = innerHeight * MARGEN_CERCA;
  const caja = (b: Bloque) => rangoDe(b, 0, b.texto.length)?.getBoundingClientRect();
  let bajo = 0;
  let alto = lista.length - 1;
  while (bajo < alto) {
    const m = (bajo + alto) >> 1;
    const c = caja(lista[m]);
    if (c && c.bottom >= -margen) alto = m;
    else bajo = m + 1;
  }
  // Solo se mide lo que queda cerca: en una novela entera, medir cada línea a cada paso del scroll se notaría.
  const ahora = new Set<Bloque>();
  for (let i = bajo; i < lista.length; i++) {
    const c = caja(lista[i]);
    if (c && c.top > innerHeight + margen) break;
    if (c && c.bottom >= -margen) ahora.add(lista[i]);
  }
  for (const b of cercanosGrandes.get(contenedor) ?? []) if (!ahora.has(b)) ponerCerca(b, false);
  for (const b of ahora) ponerCerca(b, true);
  cercanosGrandes.set(contenedor, ahora);
  procesarCola();
}

function alCruzarse(entradas: IntersectionObserverEntry[]) {
  for (const e of entradas) {
    const lista = indice.porContenedor.get(e.target);
    if (!lista) continue;
    if (e.isIntersecting) contenedoresCerca.add(e.target);
    else contenedoresCerca.delete(e.target);
    if (e.isIntersecting && lista.length > MUCHOS_BLOQUES) {
      contenedoresGrandes.add(e.target);
      actualizarGrande(e.target);
      continue;
    }
    contenedoresGrandes.delete(e.target);
    cercanosGrandes.delete(e.target);
    for (const b of lista) ponerCerca(b, e.isIntersecting);
  }
  procesarCola();
}

function vigilar(nuevos: Bloque[]) {
  if (!observador) return;
  for (const b of nuevos) observador.observe(b.contenedor);
}

function aplicarEscaneo(raiz: Node) {
  const enLenguaAntes = indice.paginaEnLengua;
  const { nuevos, quitados } = indice.escanear(raiz);
  for (const b of quitados) {
    pendientes.delete(b);
    porQuitar.delete(b);
    pintor?.quitar(b);
    cercanosGrandes.get(b.contenedor)?.delete(b);
    if (consultaWeb.value?.bloque === b) cerrarConsulta();
    if (!indice.porContenedor.has(b.contenedor)) {
      observador?.unobserve(b.contenedor);
      contenedoresCerca.delete(b.contenedor);
      contenedoresGrandes.delete(b.contenedor);
      cercanosGrandes.delete(b.contenedor);
    }
  }
  for (const r of indice.raicesSombra) {
    pintor?.adoptarEnSombra(r);
    seguirScrollDe(r);
  }
  vigilar(nuevos);
  // Un contenedor que ya estaba a la vista no vuelve a avisar: sus bloques nuevos se pintan ya.
  for (const b of nuevos) {
    if (contenedoresCerca.has(b.contenedor) && !contenedoresGrandes.has(b.contenedor)) ponerCerca(b, true);
  }
  for (const c of contenedoresGrandes) actualizarGrande(c);
  if (indice.bloques.size) {
    hayTexto.value = true;
    montarInterfaz();
  }
  // Al descubrir que la página está en la lengua, lo que se descartó antes por dudoso ya cuenta.
  if (!enLenguaAntes && indice.paginaEnLengua && raiz !== document.body) aplicarEscaneo(document.body);
  procesarCola();
}

// ---------- Scroll ----------

/** Cada cuánto, como mucho, se miran las novelas enteras y lo fijo mientras se baja: una vez por fotograma. */
let scrollPendiente = 0;
function alHacerScroll(e: Event) {
  pintor?.alDesplazar(e.target);
  pintor?.programarTapadas();
  scrollPendiente ||= requestAnimationFrame(() => {
    scrollPendiente = 0;
    for (const c of contenedoresGrandes) actualizarGrande(c);
    const c = consultaWeb.value;
    if (!c) return;
    const ancla = anclaDe(c.rango);
    if (ancla.top + ancla.height < 0 || ancla.top > innerHeight) {
      if (!c.fijada) cerrarConsulta();
    } else if (ancla.top !== c.ancla.top || ancla.left !== c.ancla.left) {
      consultaWeb.value = { ...c, ancla };
    }
  });
}

/** El scroll no sale de un árbol de sombra: hay que escucharlo dentro de cada uno. */
const sombrasConScroll = new WeakSet<ShadowRoot>();
function seguirScrollDe(raiz: ShadowRoot) {
  if (sombrasConScroll.has(raiz)) return;
  sombrasConScroll.add(raiz);
  raiz.addEventListener('scroll', alHacerScroll, { capture: true, passive: true });
}

// ---------- Palabra bajo el puntero ----------

interface Punto {
  nodo: Text;
  desplazamiento: number;
}

function textoEnPunto(x: number, y: number): Punto | null {
  let nodo: Node | null = null;
  let offset = 0;
  const doc = document as Document & { caretPositionFromPoint?: (x: number, y: number, o?: { shadowRoots?: ShadowRoot[] }) => { offsetNode: Node; offset: number } | null };
  if (doc.caretPositionFromPoint) {
    const c = doc.caretPositionFromPoint(x, y, { shadowRoots: [...indice.raicesSombra] });
    if (c) {
      nodo = c.offsetNode;
      offset = c.offset;
    }
  } else {
    const r = document.caretRangeFromPoint?.(x, y);
    if (r) {
      nodo = r.startContainer;
      offset = r.startOffset;
    }
  }
  if (!nodo || nodo.nodeType !== Node.TEXT_NODE) return null;
  const texto = nodo as Text;
  // El punto de inserción más cercano puede estar en otro carácter, o lejos si no hay texto: hay que estar encima.
  const r = document.createRange();
  for (const d of [offset, offset - 1]) {
    if (d < 0 || d >= texto.length) continue;
    r.setStart(texto, d);
    r.setEnd(texto, d + 1);
    for (const c of r.getClientRects()) {
      if (x >= c.left - 1 && x <= c.right + 1 && y >= c.top - 1 && y <= c.bottom + 1) return { nodo: texto, desplazamiento: d };
    }
  }
  return null;
}

function tokenEn(b: Bloque, posicion: number): TokenPagina | null {
  const lista = b.tokens;
  if (!lista) return null;
  let bajo = 0;
  let alto = lista.length - 1;
  while (bajo <= alto) {
    const m = (bajo + alto) >> 1;
    const t = lista[m];
    if (posicion < t.inicio) alto = m - 1;
    else if (posicion >= t.fin) bajo = m + 1;
    else return t.p.esPalabra ? t : null;
  }
  return null;
}

/** Lo que tiene su propio clic en la página: el clic sigue siendo suyo. */
function esInteractivo(el: Element | null): boolean {
  if (!el) return false;
  if (el.closest('a[href], button, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="option"], [role="switch"], [role="checkbox"], summary, label, select, input, textarea, [contenteditable], [onclick]')) return true;
  return getComputedStyle(el).cursor === 'pointer';
}

// ---------- Consulta ----------

function contextoAlrededor(b: Bloque, inicio: number, fin: number) {
  const signos = lengua.value.escritura.frase;
  const { frase, inicio: i, fin: f } = fraseAlrededor(b.texto, inicio, fin, signos);
  const antes = partirEnFrases(b.texto.slice(0, i), signos);
  const despues = partirEnFrases(b.texto.slice(f), signos);
  // También lo que dicen los párrafos de alrededor, hasta unas 20 frases a cada lado.
  const todos = [...indice.bloques];
  const k = todos.indexOf(b);
  for (let n = k - 1; n >= 0 && antes.length < 20; n--) antes.unshift(...partirEnFrases(todos[n].texto, signos));
  for (let n = k + 1; n < todos.length && despues.length < 20; n++) despues.push(...partirEnFrases(todos[n].texto, signos));
  return { frase, antes: antes.slice(-20), despues: despues.slice(0, 20) };
}

function anclaDe(rango: Range) {
  const c = rango.getClientRects()[0] ?? rango.getBoundingClientRect();
  return { left: c.left, top: c.top, width: c.width, height: c.height };
}

async function abrirEn(punto: Punto, fijada: boolean) {
  const u = indice.ubicar(punto.nodo, punto.desplazamiento);
  if (!u) return;
  // Un clic justo al cargar: el bloque aún no estaba analizado.
  if (!u.bloque.tokens) await analizarLote([u.bloque]);
  const token = tokenEn(u.bloque, u.posicion);
  if (!token) return;
  const actual = consultaWeb.value;
  if (actual && actual.token === token) {
    if (fijada && !actual.fijada) consultaWeb.value = { ...actual, fijada: true };
    return;
  }
  const rango = rangoDe(u.bloque, token.inicio, token.fin);
  if (!rango) return;
  montarInterfaz();
  pedirFuentes();
  subirAlFrente();
  pintor?.marcar('kk-activa', rango);
  consultaWeb.value = { bloque: u.bloque, token, rango, ancla: anclaDe(rango), ...contextoAlrededor(u.bloque, token.inicio, token.fin), fijada };
}

function cerrarConsulta() {
  if (temporizadorCierre) clearTimeout(temporizadorCierre);
  temporizadorCierre = null;
  consultaWeb.value = null;
  pintor?.marcar('kk-activa', null);
}

let temporizadorCierre: ReturnType<typeof setTimeout> | null = null;
function programarCierre() {
  if (temporizadorCierre) clearTimeout(temporizadorCierre);
  temporizadorCierre = setTimeout(() => {
    if (consultaWeb.value && !consultaWeb.value.fijada) cerrarConsulta();
  }, 320);
}
function cancelarCierre() {
  if (temporizadorCierre) clearTimeout(temporizadorCierre);
  temporizadorCierre = null;
}

async function crearTarjeta(c: Consulta) {
  const a = ajustesWeb.value;
  if (!a) return;
  const aviso = avisar(tr('Creando tarjeta…'), undefined, undefined, 0);
  try {
    const linea = { id: 0, inicio: 0, fin: 0, texto: c.frase, palabras: c.bloque.tokens?.filter((t) => t.inicio >= 0).map((t) => t.p) ?? [] };
    const b = await construirBorrador(c.token.p, linea, () => {}, false);
    b.fuente = document.title;
    b.url = location.href;
    await motor.crearTarjeta(b);
    avisar(tr('Tarjeta creada: {0}', c.token.p.lema), 'exito');
  } catch (e) {
    avisar(tr('No se pudo crear la tarjeta: {0}', e instanceof Error ? e.message : e), 'error', undefined, 9000);
  }
  // Quitar el aviso de «creando» va aquí porque crear no debe depender de él.
  const { quitarAviso } = await import('./estado');
  quitarAviso(aviso);
}

function PopupWeb() {
  const c = consultaWeb.value;
  const a = ajustesWeb.value;
  if (!c || !a) return null;
  const ancho = Math.min(468, innerWidth - 24);
  const { estilo, clase } = colocarJunto(c.ancla, ancho);
  const p = c.token.p;
  return (
    <div
      class={`popup-palabra ${clase}`}
      style={{ ...estilo, width: `${ancho}px`, pointerEvents: 'auto' }}
      onMouseEnter={cancelarCierre}
      onMouseLeave={() => {
        if (!consultaWeb.value?.fijada) programarCierre();
      }}
      onClick={() => {
        // Tocar la ficha la deja abierta, aunque se abriera solo por pasar el ratón.
        if (consultaWeb.value && !consultaWeb.value.fijada) consultaWeb.value = { ...consultaWeb.value, fijada: true };
      }}
    >
      <Ficha
        lema={p.lema}
        lectura={p.lecturaLema}
        superficie={p.superficie}
        flexion={p.flexion}
        ajustes={a}
        estado={p.estado}
        rastreada={p.rastreada}
        contexto={{ frase: c.frase, antes: c.antes, despues: c.despues, titulo: document.title }}
        alCerrar={cerrarConsulta}
        alCrear={() => crearTarjeta(c)}
        alEnviar={async (r) => {
          const { enviarAlCreador } = await import('../ui/borrador');
          await enviarAlCreador({
            palabra: r.lema,
            lectura: r.lectura,
            frase: c.frase,
            definicion: [...new Set(r.entradas.flatMap((e) => e.glosas))].slice(0, 5).join('<br>'),
            fuente: document.title,
            url: location.href,
          });
        }}
      />
    </div>
  );
}

// ---------- Control sobre la página ----------

function ControlLector() {
  const a = ajustesWeb.value;
  const [plegado, fijarPlegado] = useState(false);
  // Apagado solo en este sitio sigue a la vista: desde aquí mismo se vuelve a encender.
  if (!a || !a.activo || !a.lectorActivo || !hayTexto.value || !a.lectorBoton || plegado) return null;
  const cambiar = (c: Partial<Ajustes>) => guardarAjustes(c).catch(console.error);
  const abierto = panelAbierto.value;
  return (
    <div class={`lector-control ${abierto ? 'abierto' : ''}`} style={{ pointerEvents: 'auto' }}>
      {abierto && (
        <div class="lector-panel" role="dialog" aria-label={tr('Lector de páginas')}>
          <div class="lector-fila">
            <b>{tr('Lector en esta página')}</b>
            <button class={`interruptor ${!a.sitiosDesactivados.includes(location.hostname) ? 'on' : ''}`} role="switch" aria-checked={!a.sitiosDesactivados.includes(location.hostname)} aria-label={tr('Lector en esta página')} onClick={() => {
              const fuera = a.sitiosDesactivados.includes(location.hostname);
              cambiar({ sitiosDesactivados: fuera ? a.sitiosDesactivados.filter((s) => s !== location.hostname) : [...a.sitiosDesactivados, location.hostname] });
            }} />
          </div>
          <div class="lector-fila">
            <b>{tr('Colores')}</b>
            <button class={`interruptor ${a.lectorColor ? 'on' : ''}`} role="switch" aria-checked={a.lectorColor} aria-label={tr('Colores')} onClick={() => cambiar({ lectorColor: !a.lectorColor })} />
          </div>
          <div class="lector-fila" data-tip={tr(lengua.value.textos.separarLineasAyuda)}>
            <b>{tr('Separar líneas')}</b>
            <button class={`interruptor ${a.lectorInterlineado ? 'on' : ''}`} role="switch" aria-checked={a.lectorInterlineado} aria-label={tr('Separar líneas')} onClick={() => cambiar({ lectorInterlineado: !a.lectorInterlineado })} />
          </div>
          <div class="lector-grupo">
            <b>{tr(lengua.value.textos.lectura)}</b>
            <div class="segmentado" role="radiogroup" aria-label={tr(lengua.value.textos.lectura)}>
              {([['todas', tr('Todo')], ['desconocidas', tr('Nuevas')], ['alPasar', tr('Al pasar')], ['ninguna', tr('Nada')]] as const).map(([v, n]) => (
                <button key={v} role="radio" aria-checked={a.lectorFurigana === v} class={a.lectorFurigana === v ? 'activo' : ''} onClick={() => cambiar({ lectorFurigana: v })}>{n}</button>
              ))}
            </div>
          </div>
          <button class="btn chico fantasma bloque" onClick={() => fijarPlegado(true)}>{tr('Ocultar este botón por ahora')}</button>
        </div>
      )}
      <button class="lector-boton" aria-label={tr('Lector de páginas')} aria-expanded={abierto} title={tr('Lector de páginas')} onClick={() => {
        pedirFuentes();
        panelAbierto.value = !abierto;
      }}>
        <Icono n={abierto ? 'cerrar' : 'lector'} t={18} />
      </button>
    </div>
  );
}

// ---------- Interfaz sobre la página ----------

function montarInterfaz() {
  if (montado) return;
  montado = true;
  anfitrion.style.cssText = 'all: initial; position: fixed; left: 0; top: 0; width: 0; height: 0; margin: 0; padding: 0; border: 0; overflow: visible; background: transparent; z-index: 2147483000; pointer-events: none;';
  (document.documentElement ?? document.body).appendChild(anfitrion);
  subirAlFrente();
}

/**
 * Las tipografías pesan megas y, al añadirlas, el navegador vuelve a maquetar toda la página: en un texto muy largo con
 * kanji raros, eso puede cambiar su altura. Por eso se cargan al tocar una palabra, y no solo por visitar la página.
 */
function pedirFuentes() {
  cargarFuentes().catch(() => {});
}

/** Por encima de todo, también de los diálogos y de la pantalla completa, sin competir con z-index. */
function subirAlFrente() {
  try {
    if (!anfitrion.isConnected) return;
    if (anfitrion.matches(':popover-open')) anfitrion.hidePopover();
    anfitrion.showPopover();
  } catch {
    // Sin popover, se queda con su z-index.
  }
}

function Interfaz() {
  return (
    <>
      <PopupWeb />
      <ControlLector />
      <Avisos />
    </>
  );
}

// ---------- Eventos ----------

function activarSeguimiento() {
  let bajadaX = 0;
  let bajadaY = 0;
  let moviendo = 0;
  let ultimoX = 0;
  let ultimoY = 0;
  let temporizadorPasar: ReturnType<typeof setTimeout> | null = null;
  let tokenPasar: TokenPagina | null = null;
  let shift = false;

  const activo = () => {
    const x = ajustesWeb.value;
    return !!x && x.activo && x.lectorActivo && !x.sitiosDesactivados.includes(location.hostname);
  };

  document.addEventListener('pointerdown', (e) => {
    bajadaX = e.clientX;
    bajadaY = e.clientY;
  }, { capture: true, passive: true });

  document.addEventListener('click', (e) => {
    if (!activo() || e.button !== 0 || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    if (e.composedPath().includes(anfitrion)) return;
    // Arrastrar es seleccionar, no consultar.
    if (Math.hypot(e.clientX - bajadaX, e.clientY - bajadaY) > 5 || getSelection()?.toString().trim()) return;
    const objetivo = e.composedPath()[0] as Element;
    if (!(objetivo instanceof Element)) return;
    if (esInteractivo(objetivo) && !ajustesWeb.value?.lectorClicEnlaces) {
      // El enlace o botón hace lo suyo. La ficha se abre con el ratón encima.
      if (consultaWeb.value) cerrarConsulta();
      return;
    }
    const punto = textoEnPunto(e.clientX, e.clientY);
    if (!punto) {
      if (consultaWeb.value) cerrarConsulta();
      return;
    }
    const u = indice.ubicar(punto.nodo, punto.desplazamiento);
    if (!u) {
      if (consultaWeb.value) cerrarConsulta();
      return;
    }
    if (esInteractivo(objetivo)) {
      // Se pidió que el clic en enlaces también consulte: entonces el sitio no debe enterarse.
      e.preventDefault();
      e.stopImmediatePropagation();
    }
    abrirEn(punto, true).catch(console.error);
  }, true);

  const pedidosAlPasar = new WeakSet<Bloque>();

  const alMoverRaton = () => {
    moviendo = 0;
    if (!activo()) return;
    const x = ultimoX;
    const y = ultimoY;
    const punto = textoEnPunto(x, y);
    const u = punto ? indice.ubicar(punto.nodo, punto.desplazamiento) : null;
    // Aún sin analizar: se pide ahora, y con la respuesta se vuelve a mirar sin esperar a que se mueva el ratón.
    if (u && !u.bloque.tokens && !pedidosAlPasar.has(u.bloque)) {
      pedidosAlPasar.add(u.bloque);
      analizarLote([u.bloque]).then(() => {
        moviendo ||= requestAnimationFrame(alMoverRaton);
      }).catch(() => {});
    }
    const token = u ? tokenEn(u.bloque, u.posicion) : null;
    if (token !== tokenPasar) {
      tokenPasar = token;
      pintor?.marcar('kk-pasar', token && u ? rangoDe(u.bloque, token.inicio, token.fin) : null);
      pintor?.mostrarAlPasar(u?.bloque ?? null, token);
      if (temporizadorPasar) clearTimeout(temporizadorPasar);
      temporizadorPasar = null;
      if (!token) {
        if (consultaWeb.value && !consultaWeb.value.fijada) programarCierre();
        return;
      }
      cancelarCierre();
      pedirFuentes();
      const a = ajustesWeb.value;
      const objetivo = document.elementFromPoint(x, y);
      // Al pasar el ratón se consulta si se pidió así, con Shift, y siempre en enlaces y botones: su clic es del sitio.
      if (shift || a?.lectorAbrir === 'pasar' || esInteractivo(objetivo)) {
        temporizadorPasar = setTimeout(() => {
          if (punto) abrirEn(punto, false).catch(console.error);
        }, shift ? 60 : 320);
      }
    }
  };

  document.addEventListener('mousemove', (e) => {
    ultimoX = e.clientX;
    ultimoY = e.clientY;
    shift = e.shiftKey;
    moviendo ||= requestAnimationFrame(alMoverRaton);
  }, { capture: true, passive: true });

  document.addEventListener('keydown', (e) => {
    const c = consultaWeb.value;
    if (e.key === 'Escape') {
      if (c) cerrarConsulta();
      if (panelAbierto.value) panelAbierto.value = false;
      return;
    }
    if (!c) return;
    const objetivo = e.composedPath()[0] as HTMLElement | undefined;
    if (objetivo && (objetivo.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(objetivo.tagName))) return;
    const p = c.token.p;
    const estados: Record<string, 'desconocida' | 'conocida' | 'ignorada'> = { '1': 'desconocida', '3': 'conocida', '4': 'ignorada' };
    const clave = { lema: p.lema, lectura: p.lecturaLema, clave: p.clave };
    if (estados[e.key]) motor.cambiarPalabras([{ ...clave, estado: estados[e.key] }]).catch(console.error);
    else if (e.key === '2') motor.cambiarPalabras([{ ...clave, rastreada: !p.rastreada }]).catch(console.error);
    else if (e.key === 'q') crearTarjeta(c).catch(console.error);
    else return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);

  document.addEventListener('scroll', alHacerScroll, { capture: true, passive: true });

  window.addEventListener('resize', () => pintor?.recolocar(), { passive: true });
  // Una tipografía que acaba de cargar mueve las letras sin mover la caja de su párrafo.
  document.fonts?.addEventListener('loadingdone', () => pintor?.recolocar(true));

  // Una imagen que carga: el diseño cambia sin que haya scroll.
  new ResizeObserver(() => pintor?.recolocar()).observe(document.documentElement);

  // Un menú que se abre, un carrusel que pasa: el texto cambia de sitio sin que cambie el texto. Nunca se dedica a
  // esto más del 5 % del tiempo, aunque la página esté animando algo sin parar.
  let temporizadorDiseno: ReturnType<typeof setTimeout> | null = null;
  const revisarDiseno = () => {
    if (temporizadorDiseno || !pintor) return;
    temporizadorDiseno = setTimeout(() => {
      temporizadorDiseno = null;
      pintor?.revisarOcultas();
      // Un menú que se abre puede tapar el texto sin moverlo.
      pintor?.programarTapadas(true);
    }, Math.max(150, pintor.costeColocar * 20));
  };
  document.addEventListener('transitionend', revisarDiseno, { capture: true, passive: true });
  document.addEventListener('animationend', revisarDiseno, { capture: true, passive: true });

  // Una página dinámica va añadiendo texto: se revisa solo lo que cambió, y con calma.
  const raices = new Set<Node>();
  let hayQuitados = false;
  let temporizador: ReturnType<typeof setTimeout> | null = null;
  let esperandoDesde = 0;
  const vaciar = () => {
    temporizador = null;
    esperandoDesde = 0;
    const lista = [...raices].filter((r) => r.isConnected);
    raices.clear();
    // Lo que está dentro de otra raíz ya se revisa con ella.
    const minimas = lista.filter((r) => !lista.some((o) => o !== r && o.contains(r)));
    if (minimas.length > 40) aplicarEscaneo(document.body);
    else if (minimas.length) for (const r of minimas) aplicarEscaneo(r);
    // Sin nada que mirar, escanear un fragmento vacío solo retira los bloques que ya no están en la página.
    else if (hayQuitados) aplicarEscaneo(document.createDocumentFragment());
    hayQuitados = false;
    pintor?.recolocar();
    pintor?.programarTapadas(true);
  };
  const esPropio = (n: Node) => n.nodeName === 'KOTONOHA-LECTOR' || n.nodeName === 'KOTONOHA-OVERLAY';
  const mo = new MutationObserver((registros) => {
    // Con el lector apagado no se hace nada: ni se mira la página, ni se añade nada a ella.
    if (!pintor) return;
    pintor.pedirRangos();
    let cambioDiseno = false;
    for (const r of registros) {
      const n = r.target;
      const raiz = n.nodeType === Node.ELEMENT_NODE ? (n as Element) : n.parentElement;
      if (!raiz || esPropio(raiz)) continue;
      if (r.type === 'attributes') {
        cambioDiseno = true;
        continue;
      }
      if (r.type === 'childList') {
        const anadidos = [...r.addedNodes];
        const quitados = [...r.removedNodes];
        const todos = [...anadidos, ...quitados];
        if (todos.every(esPropio)) continue;
        // Algo que no es parte de una frase, como un anuncio añadido al final: basta con mirarlo a él. Sin esto,
        // cada añadido al <body> obligaría a revisar la página entera.
        if (todos.every(esAparte)) {
          for (const x of anadidos) raices.add(x);
          if (quitados.length) hayQuitados = true;
          continue;
        }
      }
      const c = contenedorDe(raiz);
      if (c) raices.add(c);
    }
    if (cambioDiseno) revisarDiseno();
    if (!raices.size && !hayQuitados) return;
    if (!esperandoDesde) esperandoDesde = Date.now();
    if (temporizador) clearTimeout(temporizador);
    // Con un texto que llega en directo, como una respuesta de chat, no se espera a que termine.
    temporizador = setTimeout(vaciar, Date.now() - esperandoDesde > 1200 ? 0 : 300);
  });
  mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'open', 'aria-hidden', 'aria-expanded'] });

  const reanalizar = () => {
    cacheAnalisis.clear();
    for (const b of indice.bloques) {
      if (b.tokens) pintor?.quitar(b);
      b.tokens = null;
      if (b.cerca) pendientes.add(b);
    }
    procesarCola();
  };

  alRecibirEvento((e) => {
    if (e.tipo === 'palabrasRecargar') reanalizar();
    if (e.tipo !== 'palabras') return;
    const cambios = new Map(e.cambios.map((c) => [c.clave, c]));
    for (const lista of cacheAnalisis.values()) {
      for (const tk of lista) {
        const c = cambios.get(tk.p.clave);
        if (c) tk.p = { ...tk.p, ...(c.estado ? { estado: c.estado } : {}), ...(c.rastreada !== undefined ? { rastreada: c.rastreada } : {}) };
      }
    }
    for (const b of indice.bloques) {
      let cambio = false;
      for (const tk of b.tokens ?? []) {
        const c = cambios.get(tk.p.clave);
        if (!c) continue;
        tk.p = { ...tk.p, ...(c.estado ? { estado: c.estado } : {}), ...(c.rastreada !== undefined ? { rastreada: c.rastreada } : {}) };
        cambio = true;
        if (b.cerca) pintor?.repintarToken(b, tk);
      }
      if (cambio && b.cerca) pintor?.repintarLecturas([b]);
    }
    const c = consultaWeb.value;
    if (c && cambios.has(c.token.p.clave)) consultaWeb.value = { ...c };
  });
}

function encender() {
  const a = ajustesWeb.value!;
  pintor = new Pintor(a);
  const margen = `${MARGEN_CERCA * 100}% 0px`;
  observador = new IntersectionObserver(alCruzarse, { rootMargin: margen, scrollMargin: margen } as IntersectionObserverInit);
  aplicarEscaneo(document.body);
}

function apagar() {
  observador?.disconnect();
  observador = null;
  pendientes.clear();
  porQuitar.clear();
  if (temporizadorQuitar) clearTimeout(temporizadorQuitar);
  temporizadorQuitar = null;
  contenedoresCerca.clear();
  contenedoresGrandes.clear();
  cercanosGrandes.clear();
  cerrarConsulta();
  pintor?.limpiar();
  pintor = null;
  // Al volver a encender se mira todo desde cero: el observador nuevo tiene que vigilar todos los bloques.
  indice = new IndicePagina();
}

/** Para las pruebas y para diagnosticar: lo que está haciendo el lector, en un atributo de su propio elemento. */
function actualizarMedidas() {
  if (!pintor || !montado) return;
  const m = pintor.medidas();
  anfitrion.dataset.kkBloques = String(indice.bloques.size);
  anfitrion.dataset.kkRangos = String(m.rangos);
  anfitrion.dataset.kkLecturas = String(m.lecturas);
  anfitrion.dataset.kkTapadas = String(m.tapadas);
  anfitrion.dataset.kkCapas = String(m.capas);
  anfitrion.dataset.kkAbiertos = String(m.abiertos);
  let cerca = 0;
  let analizados = 0;
  for (const b of indice.bloques) {
    if (b.cerca) cerca++;
    if (b.cerca && b.tokens) analizados++;
  }
  anfitrion.dataset.kkCerca = String(cerca);
  anfitrion.dataset.kkAnalizados = String(analizados);
  anfitrion.dataset.kkPendientes = String(pendientes.size);
}

export async function iniciarLectorWeb() {
  const a = await leerAjustes();
  await fijarIdioma(a.idiomaInterfaz);
  ajustesWeb.value = a;
  aplicarLengua(a);
  indice = new IndicePagina();

  anfitrion = document.createElement('kotonoha-overlay');
  anfitrion.setAttribute('popover', 'manual');
  const sombra = anfitrion.attachShadow({ mode: 'open' });
  const hoja = new CSSStyleSheet();
  hoja.replaceSync(base + overlay);
  sombra.adoptedStyleSheets = [hoja];
  const raiz = document.createElement('div');
  raiz.className = 'kk-raiz';
  raiz.setAttribute('data-tema', 'oscuro');
  raiz.lang = bcp47Actual();
  const aplicarPaleta = (x: Ajustes) => {
    for (const k of ['--est-desconocida', '--est-aprendiendo', '--est-rastreada', '--ac-heiban', '--ac-atamadaka', '--ac-nakadaka', '--ac-odaka']) raiz.style.removeProperty(k);
    Object.entries(variablesPaleta(x.paleta, true)).forEach(([k, v]) => raiz.style.setProperty(k, v));
  };
  aplicarPaleta(a);
  sombra.appendChild(raiz);
  render(<Interfaz />, raiz);

  // Un aviso también puede ser lo primero que se muestre en la página.
  avisos.subscribe((l) => {
    if (!l.length) return;
    montarInterfaz();
    pedirFuentes();
  });

  const debeEstar = (x: Ajustes) => x.activo && x.lectorActivo && !x.sitiosDesactivados.includes(location.hostname);

  alCambiarAjustes((n) => {
    const antes = ajustesWeb.value;
    ajustesWeb.value = n;
    aplicarLengua(n);
    aplicarPaleta(n);
    fijarIdioma(n.idiomaInterfaz).then(() => {
      raiz.lang = bcp47Actual();
    }).catch(() => {});
    const encendido = !!pintor;
    if (debeEstar(n) && !encendido) encender();
    else if (!debeEstar(n) && encendido) apagar();
    else if (pintor && antes) {
      const { cambiaColor, cambiaLectura } = pintor.fijarAjustes(n);
      if (cambiaColor || cambiaLectura) {
        const aLaVista = [...indice.bloques].filter((b) => b.cerca && b.tokens);
        for (const b of aLaVista) pintor.quitar(b);
        pintor.pintarLote(aLaVista);
      }
    }
  });

  activarSeguimiento();
  if (debeEstar(a)) {
    // Tras cargar, sin esperar de más: una página llena de anuncios puede tardar un minuto en terminar.
    const empezar = () => {
      const actuales = ajustesWeb.value;
      if (!pintor && actuales && debeEstar(actuales)) encender();
    };
    if (document.readyState === 'complete') {
      empezar();
    } else {
      window.addEventListener('load', empezar, { once: true });
      setTimeout(empezar, 1500);
    }
  }
}
