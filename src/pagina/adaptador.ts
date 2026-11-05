// Interfaz común de los adaptadores por sitio. Si un sitio cambia, solo se toca su adaptador.

import type { PistaInfo } from '../compartido/tipos';

export interface Adaptador {
  nombre: string;
  cssOcultarNativos?: string;
  /** La página actual tiene un video reproducible. */
  activo(): boolean;
  idVideo(): string | null;
  titulo(): string;
  anuncio(): boolean;
  listarPistas(): Promise<PistaInfo[]>;
  cargarPista(id: string): Promise<string>;
  saltar(ms: number): void | Promise<void>;
  reproducir(): void | Promise<void>;
  pausar(): void | Promise<void>;
  /** Reduce el reproductor para dejar sitio al navegador de subtítulos. 0 lo restaura. */
  prepararPanel?(ancho: number): void;
}

export const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function sondear<T>(fn: () => T | null | undefined | false, tiempoMs: number, cadaMs = 250): Promise<T | null> {
  const limite = Date.now() + tiempoMs;
  for (;;) {
    try {
      const v = fn();
      if (v) return v;
    } catch {
      // El reproductor aún no está listo.
    }
    if (Date.now() >= limite) return null;
    await esperar(cadaMs);
  }
}

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

export const normalizarIdioma = (c: string | undefined) => (c ?? '').toLowerCase().replace(/_/g, '-');
