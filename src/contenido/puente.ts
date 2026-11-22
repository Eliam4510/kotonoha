// Comunicación con el adaptador del mundo MAIN.

import type { PistaInfo, TiemposSitio } from '../compartido/tipos';
import { tm, tr } from '../compartido/i18n';
import { elegirVideo, MARCA_VIDEO } from '../compartido/videoPrincipal';

// Los adaptadores corren en la página, sin acceso a las traducciones: sus mensajes se traducen al llegar aquí.
void [
  tm('Pista no encontrada'),
  tm('Pista de Netflix no encontrada'),
  tm('No se pudieron obtener los subtítulos de Netflix'),
  tm('El reproductor de YouTube no está listo'),
  tm('YouTube devolvió subtítulos vacíos. Reproduce el video unos segundos y vuelve a intentarlo.'),
];

/** Control del video, igual para un sitio web que para el reproductor local. */
export interface Control {
  sitio: string;
  info(): Promise<{ sitio: string; activo: boolean; idVideo: string | null; titulo: string; categoria?: string; anuncio: boolean }>;
  listarPistas(): Promise<PistaInfo[]>;
  cargarPista(id: string): Promise<string>;
  saltar(ms: number): Promise<void>;
  reproducir(): Promise<void>;
  pausar(): Promise<void>;
  ocultarNativos(v: boolean): Promise<void>;
  imagenOficial(): Promise<string | null>;
  prepararPanel(ancho: number): Promise<void>;
  video(): HTMLVideoElement | null;
  /** El momento del <video> y el del reproductor del sitio, tomados a la vez (ver relojSitio.ts). */
  tiempos?(): Promise<TiemposSitio | null>;
  /** Lo que tapan abajo los controles propios, en px: los subtítulos se colocan por encima (el reproductor de archivos). */
  recorteInferior?(): number;
}

let contador = 0;
const pendientes = new Map<number, { ok: (v: unknown) => void; mal: (e: Error) => void }>();
const oyentesNavegacion = new Set<() => void>();
let escuchando = false;

function escuchar() {
  if (escuchando) return;
  escuchando = true;
  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    const d = e.data as { fuente?: string; id?: number; ok?: boolean; valor?: unknown; error?: string; evento?: string };
    if (d?.fuente !== 'kotonoha-pagina') return;
    if (d.evento === 'navegacion') {
      oyentesNavegacion.forEach((f) => f());
      return;
    }
    if (d.id === undefined) return;
    const p = pendientes.get(d.id);
    if (!p) return;
    pendientes.delete(d.id);
    if (d.ok) p.ok(d.valor);
    else p.mal(new Error(d.error ? tr(d.error) : tr('Error del adaptador')));
  });
}

function orden<T>(nombre: string, args: unknown[] = [], tiempo = 120000): Promise<T> {
  escuchar();
  const id = ++contador;
  return new Promise<T>((ok, mal) => {
    pendientes.set(id, { ok: ok as (v: unknown) => void, mal });
    window.postMessage({ fuente: 'kotonoha-contenido', id, orden: nombre, args }, '*');
    setTimeout(() => {
      if (pendientes.delete(id)) mal(new Error(tr('El adaptador no respondió a «{0}»', nombre)));
    }, tiempo);
  });
}

export const alNavegar = (f: () => void) => {
  escuchar();
  oyentesNavegacion.add(f);
};

let principal: HTMLVideoElement | null = null;

/**
 * El <video> de los subtítulos (ver compartido/videoPrincipal.ts). Queda marcado para que la parte que corre en la página
 * use el mismo: si no, con dos del mismo tamaño, como el de un anuncio que acabó, cada una podía tomar uno distinto.
 */
export function videoPrincipal(): HTMLVideoElement | null {
  const v = elegirVideo(principal?.isConnected ? principal : null);
  if (v !== principal) {
    principal?.removeAttribute(MARCA_VIDEO);
    principal = v;
  }
  if (v && !v.hasAttribute(MARCA_VIDEO)) v.setAttribute(MARCA_VIDEO, '');
  return v;
}

export const controlSitio: Control = {
  sitio: location.hostname,
  info: () => orden('info', [], 8000),
  listarPistas: () => orden('listarPistas'),
  cargarPista: (id) => orden('cargarPista', [id]),
  saltar: (ms) => orden('saltar', [ms]),
  reproducir: () => orden('reproducir'),
  pausar: () => orden('pausar'),
  ocultarNativos: (v) => orden('ocultarNativos', [v]),
  imagenOficial: () => orden('imagenOficial'),
  prepararPanel: (a) => orden('prepararPanel', [a]),
  video: videoPrincipal,
  tiempos: () => orden('tiempos', [], 2000),
};
