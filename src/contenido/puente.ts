// Comunicación con el adaptador del mundo MAIN.

import type { PistaInfo } from '../compartido/tipos';

/** Control del video, igual para un sitio web que para el reproductor local. */
export interface Control {
  sitio: string;
  info(): Promise<{ sitio: string; activo: boolean; idVideo: string | null; titulo: string; anuncio: boolean }>;
  listarPistas(): Promise<PistaInfo[]>;
  cargarPista(id: string): Promise<string>;
  saltar(ms: number): Promise<void>;
  reproducir(): Promise<void>;
  pausar(): Promise<void>;
  ocultarNativos(v: boolean): Promise<void>;
  prepararPanel(ancho: number): Promise<void>;
  video(): HTMLVideoElement | null;
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
    else p.mal(new Error(d.error ?? 'Error del adaptador'));
  });
}

function orden<T>(nombre: string, args: unknown[] = [], tiempo = 120000): Promise<T> {
  escuchar();
  const id = ++contador;
  return new Promise<T>((ok, mal) => {
    pendientes.set(id, { ok: ok as (v: unknown) => void, mal });
    window.postMessage({ fuente: 'kotonoha-contenido', id, orden: nombre, args }, '*');
    setTimeout(() => {
      if (pendientes.delete(id)) mal(new Error(`El adaptador no respondió a «${nombre}»`));
    }, tiempo);
  });
}

export const alNavegar = (f: () => void) => {
  escuchar();
  oyentesNavegacion.add(f);
};

export function videoPrincipal(): HTMLVideoElement | null {
  let mejor: HTMLVideoElement | null = null;
  let area = 0;
  for (const v of document.querySelectorAll('video')) {
    const r = v.getBoundingClientRect();
    const a = r.width * r.height;
    if (a > area) {
      area = a;
      mejor = v;
    }
  }
  return mejor;
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
  prepararPanel: (a) => orden('prepararPanel', [a]),
  video: videoPrincipal,
};
