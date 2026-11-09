// Actualizar una copia de Kotonoha cargada desde una carpeta con el ayudante local: él baja el paquete de la versión
// nueva de GitHub, comprueba su SHA-256 con el SHA256SUMS.txt publicado y lo copia sobre la carpeta de la extensión
// que lo llama, conservando su clave para que el identificador, y con él sus datos, no cambie. Al terminar escribe
// compilacion.txt, y la extensión se recarga sola en cuanto nada esté en marcha.

import { PUERTO_AYUDANTE } from './api';
import type { InfoAyudante } from './api';
import { tr } from './i18n';
import { versionInstalada } from './proyecto';

/** Las copias de las tiendas se actualizan solas; solo se actualizan así las cargadas desde una carpeta. */
export const esCopiaDeCarpeta = (): boolean => !('update_url' in chrome.runtime.getManifest());

/** Si con este ayudante, y en esta copia, se puede actualizar desde la app. */
export const puedeActualizar = (info: InfoAyudante | null | undefined): boolean => !!info?.actualizar && esCopiaDeCarpeta();

type Mensaje = { tipo: 'descarga'; porcentaje: number } | { tipo: 'convirtiendo' } | { tipo: 'actualizado'; version: string } | { tipo: 'error'; mensaje: string } | { tipo: 'desconectado'; mensaje: string };

/** Pone la versión indicada en la carpeta de esta copia. `alAvance` recibe el porcentaje de la descarga. */
export function actualizarConAyudante(version: string, alAvance: (porcentaje: number) => void): Promise<void> {
  return new Promise((ok, mal) => {
    const puerto = chrome.runtime.connect({ name: PUERTO_AYUDANTE });
    let terminado = false;
    const acabar = (error?: Error) => {
      if (terminado) return;
      terminado = true;
      try {
        puerto.disconnect();
      } catch {
        // Ya estaba cerrado.
      }
      if (error) mal(error);
      else ok();
    };
    puerto.onMessage.addListener((m: Mensaje) => {
      if (m.tipo === 'descarga') alAvance(m.porcentaje);
      else if (m.tipo === 'actualizado') acabar();
      else if (m.tipo === 'error') acabar(new Error(m.mensaje));
      else if (m.tipo === 'desconectado') acabar(new Error(tr('Se perdió la conexión con el ayudante')));
    });
    puerto.onDisconnect.addListener(() => {
      void chrome.runtime.lastError;
      acabar(new Error(tr('Se perdió la conexión con el ayudante')));
    });
    puerto.postMessage({ accion: 'actualizar', version, actual: versionInstalada() });
  });
}
