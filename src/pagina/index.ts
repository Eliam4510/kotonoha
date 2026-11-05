// Corre en el mundo MAIN de la página, antes que el reproductor del sitio.
// Atiende las órdenes del content script por postMessage.

import type { Adaptador } from './adaptador';
import { adaptadorGenerico, instalarEscucha } from './generico';
import { adaptadorNetflix } from './netflix';
import { adaptadorYouTube, instalarEscuchaYouTube } from './youtube';

declare global {
  interface Window {
    __kotonohaPagina?: boolean;
  }
}

if (!window.__kotonohaPagina) {
  window.__kotonohaPagina = true;

  const host = location.hostname;
  let adaptador: Adaptador = adaptadorGenerico;
  if (/(^|\.)youtube\.com$/.test(host)) {
    adaptador = adaptadorYouTube;
    instalarEscuchaYouTube();
  } else if (/(^|\.)netflix\.com$/.test(host)) {
    adaptador = adaptadorNetflix;
    instalarEscucha();
  } else {
    instalarEscucha();
  }

  let estilo: HTMLStyleElement | null = null;
  const ocultarNativos = (ocultar: boolean) => {
    if (!adaptador.cssOcultarNativos) return;
    if (ocultar && !estilo) {
      estilo = document.createElement('style');
      estilo.textContent = adaptador.cssOcultarNativos;
      (document.head ?? document.documentElement).appendChild(estilo);
    } else if (!ocultar && estilo) {
      estilo.remove();
      estilo = null;
    }
  };

  const ordenes: Record<string, (...a: never[]) => unknown> = {
    info: () => ({
      sitio: adaptador.nombre,
      activo: adaptador.activo(),
      idVideo: adaptador.idVideo(),
      titulo: adaptador.titulo(),
      anuncio: adaptador.anuncio(),
    }),
    listarPistas: () => adaptador.listarPistas(),
    cargarPista: (id: string) => adaptador.cargarPista(id),
    saltar: (ms: number) => adaptador.saltar(ms),
    reproducir: () => adaptador.reproducir(),
    pausar: () => adaptador.pausar(),
    ocultarNativos: (v: boolean) => ocultarNativos(v),
    prepararPanel: (ancho: number) => adaptador.prepararPanel?.(ancho),
  };

  window.addEventListener('message', (e) => {
    if (e.source !== window) return;
    const d = e.data as { fuente?: string; id?: number; orden?: string; args?: unknown[] };
    if (d?.fuente !== 'kotonoha-contenido' || !d.orden) return;
    const responder = (cuerpo: object) => window.postMessage({ fuente: 'kotonoha-pagina', id: d.id, ...cuerpo }, '*');
    const fn = ordenes[d.orden];
    if (!fn) return responder({ ok: false, error: `Orden desconocida: ${d.orden}` });
    Promise.resolve()
      .then(() => (fn as (...a: unknown[]) => unknown)(...(d.args ?? [])))
      .then(
        (valor) => responder({ ok: true, valor }),
        (err) => responder({ ok: false, error: err instanceof Error ? err.message : String(err) })
      );
  });

  // Avisa de cambios de URL: en estos sitios la navegación no recarga la página.
  let ultimaUrl = location.href;
  const avisar = () => {
    if (location.href === ultimaUrl) return;
    ultimaUrl = location.href;
    window.postMessage({ fuente: 'kotonoha-pagina', evento: 'navegacion' }, '*');
  };
  for (const m of ['pushState', 'replaceState'] as const) {
    const original = history[m];
    history[m] = function (this: History, ...a: Parameters<History['pushState']>) {
      const r = original.apply(this, a);
      queueMicrotask(avisar);
      return r;
    };
  }
  window.addEventListener('popstate', avisar);
  window.addEventListener('yt-navigate-finish', () => {
    avisar();
    window.postMessage({ fuente: 'kotonoha-pagina', evento: 'navegacion' }, '*');
  });

  window.postMessage({ fuente: 'kotonoha-pagina', evento: 'listo' }, '*');
}
