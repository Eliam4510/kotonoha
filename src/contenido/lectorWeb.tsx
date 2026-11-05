// Lector de páginas web: consulta de palabras y, en modo completo, subrayado por estado.
//
// Nunca reescribe el DOM de la página: el subrayado usa la CSS Custom
// Highlight API y la consulta se calcula al vuelo. Así no rompe aplicaciones React como Claude.ai.

import { effect, signal } from '@preact/signals';
import { render } from 'preact';
import { type Ajustes, leerAjustes, alCambiarAjustes } from '../compartido/ajustes';
import { alRecibirEvento, motor } from '../compartido/rpc';
import type { PalabraToken } from '../compartido/tipos';
import { tieneJapones } from '../nucleo/tokens';
import { colocarJunto, Ficha } from '../ui/Ficha';
import base from '../ui/estilos';
import { cargarFuentes } from '../ui/fuentes';
import { avisos } from './estado';
import overlay from './overlay.css';
import { Avisos } from './Reproductor';

const consultaWeb = signal<{ palabra: PalabraToken; frase: string; x: number; y: number } | null>(null);
const ajustesWeb = signal<Ajustes | null>(null);

function textoDesdePunto(x: number, y: number): { nodo: Text; desplazamiento: number } | null {
  const rango = document.caretRangeFromPoint?.(x, y);
  if (!rango || rango.startContainer.nodeType !== Node.TEXT_NODE) return null;
  const nodo = rango.startContainer as Text;
  // caretRangeFromPoint devuelve el carácter más cercano: comprueba que el puntero esté encima.
  const r = document.createRange();
  const d = Math.min(rango.startOffset, nodo.length - 1);
  if (d < 0) return null;
  r.setStart(nodo, d);
  r.setEnd(nodo, d + 1);
  const caja = r.getBoundingClientRect();
  if (x < caja.left - 4 || x > caja.right + 4 || y < caja.top - 4 || y > caja.bottom + 4) return null;
  return { nodo, desplazamiento: d };
}

/** Frase alrededor del punto: hasta un signo de final de oración o el principio del nodo. */
function fraseEn(texto: string, posicion: number): { frase: string; inicio: number } {
  const separadores = /[。！？!?\n]/;
  let i = posicion;
  while (i > 0 && !separadores.test(texto[i - 1])) i--;
  let f = posicion;
  while (f < texto.length && !separadores.test(texto[f])) f++;
  return { frase: texto.slice(i, Math.min(f + 1, texto.length)).trim(), inicio: i };
}

let ultimaClave = '';
let temporizador: ReturnType<typeof setTimeout> | null = null;

async function consultarEn(x: number, y: number) {
  const punto = textoDesdePunto(x, y);
  if (!punto) return;
  const texto = punto.nodo.data;
  if (!tieneJapones(texto[punto.desplazamiento] ?? '')) return;
  const { frase, inicio } = fraseEn(texto, punto.desplazamiento);
  const offset = punto.desplazamiento - inicio;
  const clave = `${frase}|${offset}`;
  if (clave === ultimaClave && consultaWeb.value) return;
  const [palabras] = await motor.analizarTexto(frase.replace(/\n/g, ' '));
  let pos = 0;
  for (const p of palabras) {
    const finToken = pos + p.superficie.length;
    if (offset >= pos && offset < finToken) {
      if (p.esPalabra) {
        ultimaClave = clave;
        consultaWeb.value = { palabra: p, frase, x, y };
      }
      return;
    }
    pos = finToken;
  }
}

function PopupWeb() {
  const c = consultaWeb.value;
  const a = ajustesWeb.value;
  if (!c || !a) return null;
  const ancho = Math.min(468, innerWidth - 24);
  const { estilo, clase } = colocarJunto({ left: c.x, top: c.y - 10, width: 0, height: 22 }, ancho);
  return (
    <div class={`popup-palabra ${clase}`} style={{ ...estilo, width: `${ancho}px`, pointerEvents: 'auto' }} onMouseDown={(e) => e.stopPropagation()}>
      <Ficha
        lema={c.palabra.lema}
        lectura={c.palabra.lecturaLema}
        superficie={c.palabra.superficie}
        flexion={c.palabra.flexion}
        ajustes={a}
        contexto={{ frase: c.frase, titulo: document.title }}
        alCerrar={() => {
          consultaWeb.value = null;
          ultimaClave = '';
        }}
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

// ---------- Modo completo: subrayado sin tocar el DOM ----------

const NOMBRES_RESALTE = ['kk-desconocida', 'kk-aprendiendo', 'kk-rastreada'] as const;
let analizando = false;
let pendiente = false;

async function anotarPagina() {
  if (analizando) {
    pendiente = true;
    return;
  }
  const highlights = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights;
  const HighlightCtor = (window as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight;
  if (!highlights || !HighlightCtor) return;
  analizando = true;
  try {
    const paseador = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const p = n.parentElement;
        if (!p || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|INPUT|CODE|PRE)$/.test(p.tagName) || p.isContentEditable) return NodeFilter.FILTER_REJECT;
        return tieneJapones(n.nodeValue ?? '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    const nodos: Text[] = [];
    while (paseador.nextNode() && nodos.length < 800) nodos.push(paseador.currentNode as Text);
    const textos = nodos.map((n) => n.data.replace(/\n/g, ' '));
    if (!textos.length) return;
    const analizados = await motor.analizarTexto(textos.join('\n'));
    const grupos: Record<string, Range[]> = { 'kk-desconocida': [], 'kk-aprendiendo': [], 'kk-rastreada': [] };
    analizados.forEach((palabras, i) => {
      const nodo = nodos[i];
      if (!nodo?.isConnected) return;
      let pos = 0;
      for (const p of palabras) {
        const fin = pos + p.superficie.length;
        if (p.esPalabra && fin <= nodo.length) {
          const nombre = p.rastreada ? 'kk-rastreada' : p.estado === 'desconocida' ? 'kk-desconocida' : p.estado === 'aprendiendo' ? 'kk-aprendiendo' : null;
          if (nombre) {
            const r = new Range();
            r.setStart(nodo, pos);
            r.setEnd(nodo, fin);
            grupos[nombre].push(r);
          }
        }
        pos = fin;
      }
    });
    for (const n of NOMBRES_RESALTE) highlights.set(n, new HighlightCtor(...grupos[n]));
  } finally {
    analizando = false;
    if (pendiente) {
      pendiente = false;
      setTimeout(anotarPagina, 1500);
    }
  }
}

function limpiarAnotaciones() {
  const highlights = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights;
  for (const n of NOMBRES_RESALTE) highlights?.delete(n);
}

const CSS_RESALTES = `
::highlight(kk-desconocida) { text-decoration: underline 2px #F0703A; text-underline-offset: 3px; }
::highlight(kk-aprendiendo) { text-decoration: underline 2px #E0A800; text-underline-offset: 3px; }
::highlight(kk-rastreada) { text-decoration: underline 2px #8F76F0; text-underline-offset: 3px; }
`;

export async function iniciarLectorWeb() {
  const a = await leerAjustes();
  ajustesWeb.value = a;

  const activo = () => {
    const x = ajustesWeb.value!;
    return x.activo && !x.sitiosDesactivados.includes(location.hostname);
  };

  const anfitrion = document.createElement('kotonoha-overlay');
  const sombra = anfitrion.attachShadow({ mode: 'open' });
  const estilo = document.createElement('style');
  estilo.textContent = base + overlay + ':host { position: fixed; z-index: 2147483000; inset: auto; }';
  sombra.appendChild(estilo);
  const raiz = document.createElement('div');
  raiz.className = 'kk-raiz';
  sombra.appendChild(raiz);
  let montado = false;
  const montar = () => {
    if (montado) return;
    montado = true;
    (document.documentElement ?? document.body).appendChild(anfitrion);
    cargarFuentes().catch(() => {});
    render(<><PopupWeb /><Avisos /></>, raiz);
  };

  // Un aviso también puede ser lo primero que se muestre en la página.
  effect(() => {
    if (avisos.value.length) montar();
  });

  const estiloPagina = document.createElement('style');
  estiloPagina.textContent = CSS_RESALTES;

  // Shift + pasar el ratón: la consulta solo se dispara cuando se pide, sin coste si no se usa.
  document.addEventListener('mousemove', (e) => {
    if (!activo() || !e.shiftKey) return;
    if (temporizador) clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      montar();
      consultarEn(e.clientX, e.clientY).catch(console.error);
    }, 90);
  }, { passive: true });

  document.addEventListener('mousedown', (e) => {
    if (consultaWeb.value && !e.composedPath().includes(anfitrion)) {
      consultaWeb.value = null;
      ultimaClave = '';
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && consultaWeb.value) {
      consultaWeb.value = null;
      ultimaClave = '';
    }
  });

  let observador: MutationObserver | null = null;
  let temporizadorAnotar: ReturnType<typeof setTimeout> | null = null;
  const aplicarModo = () => {
    const x = ajustesWeb.value!;
    if (activo() && x.modoRender === 'completo') {
      (document.head ?? document.documentElement).appendChild(estiloPagina);
      anotarPagina().catch(console.error);
      if (!observador) {
        observador = new MutationObserver(() => {
          if (temporizadorAnotar) clearTimeout(temporizadorAnotar);
          temporizadorAnotar = setTimeout(() => anotarPagina().catch(console.error), 1500);
        });
        observador.observe(document.body, { childList: true, subtree: true, characterData: true });
      }
    } else {
      observador?.disconnect();
      observador = null;
      limpiarAnotaciones();
      estiloPagina.remove();
    }
  };
  aplicarModo();
  alCambiarAjustes((n) => {
    ajustesWeb.value = n;
    aplicarModo();
  });
  alRecibirEvento((e) => {
    if ((e.tipo === 'palabras' || e.tipo === 'palabrasRecargar') && ajustesWeb.value?.modoRender === 'completo') anotarPagina().catch(console.error);
  });
}
