// Interfaz común de los adaptadores por sitio. Si un sitio cambia, solo se toca su adaptador.

import type { PistaInfo, TiemposSitio } from '../compartido/tipos';
import { elegirVideo, MARCA_VIDEO } from '../compartido/videoPrincipal';

export interface Adaptador {
  nombre: string;
  cssOcultarNativos?: string;
  /** La página actual tiene un video reproducible. */
  activo(): boolean;
  idVideo(): string | null;
  titulo(): string;
  /** La categoría que le da el propio sitio. Sirve para saber si es música. */
  categoria?(): string;
  anuncio(): boolean;
  listarPistas(): Promise<PistaInfo[]>;
  cargarPista(id: string): Promise<string>;
  saltar(ms: number): void | Promise<void>;
  reproducir(): void | Promise<void>;
  pausar(): void | Promise<void>;
  /** La imagen que el propio sitio ofrece de este video, para cuando su fotograma está protegido. */
  imagenOficial?(): string | null;
  /** Reduce el reproductor para dejar sitio al navegador de subtítulos. 0 lo restaura. */
  prepararPanel?(ancho: number): void;
  /**
   * El momento del <video> y el del episodio según el reproductor del sitio, en ms y tomados a la vez, para un sitio
   * cuyo reproductor lleva su propia cuenta (Netflix); null si ahora no se pueden comparar.
   */
  tiempos?(): TiemposSitio | null;
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

/**
 * El <video> de los subtítulos: el que marca la otra parte de la extensión (ver compartido/videoPrincipal.ts), y si aún
 * no hay marca, el que elegiría ella.
 */
export function videoPrincipal(): HTMLVideoElement | null {
  const marcado = document.querySelector<HTMLVideoElement>(`video[${MARCA_VIDEO}]`);
  return marcado ?? elegirVideo(null);
}

export const normalizarIdioma = (c: string | undefined) => (c ?? '').toLowerCase().replace(/_/g, '-');
