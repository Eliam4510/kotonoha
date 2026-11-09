// Saber si hay una versión nueva de Kotonoha: la última publicada en GitHub, consultada como mucho una vez al día y
// guardada para no volver a preguntar. Se consulta desde las páginas de la extensión (Inicio, el menú y Ajustes), nunca
// desde las páginas que se leen, y solo se pide el número y el título de la última versión.

import { esMasNueva, numerosDeVersion, versionLimpia } from '../nucleo/versiones';
import { API_ULTIMA_VERSION, URL_ULTIMA_VERSION, versionInstalada } from './proyecto';

export interface VersionPublicada {
  version: string;
  /** El título de la versión en GitHub: «Kotonoha 0.13.0 · Dictar al Portapapeles». */
  titulo: string;
  /** Su página, con las novedades y los paquetes. */
  url: string;
}

interface Consulta {
  publicada: VersionPublicada | null;
  cuando: number;
}

const CLAVE = 'versionPublicada';
const CLAVE_CERRADO = 'avisoVersionCerrado';
const CADA_CUANTO_MS = 24 * 60 * 60 * 1000;

async function consultarGitHub(): Promise<VersionPublicada | null> {
  const r = await fetch(API_ULTIMA_VERSION, { headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store' });
  if (!r.ok) throw new Error(`GitHub: ${r.status}`);
  const d = (await r.json()) as { tag_name?: string; name?: string; html_url?: string };
  if (!d.tag_name || !numerosDeVersion(d.tag_name)) return null;
  return { version: versionLimpia(d.tag_name), titulo: d.name || d.tag_name, url: d.html_url || URL_ULTIMA_VERSION };
}

/**
 * La última versión publicada, si es más nueva que esta copia. Pregunta a GitHub como mucho una vez al día; con `ya`
 * (el botón de Ajustes) pregunta ahora y, si falla, lanza el error. Sin conexión vale lo último que se supo.
 */
export async function buscarVersionNueva(ya = false): Promise<VersionPublicada | null> {
  const guardada = (await chrome.storage.local.get(CLAVE))[CLAVE] as Consulta | undefined;
  let publicada = guardada?.publicada ?? null;
  if (ya || !guardada || Date.now() - guardada.cuando > CADA_CUANTO_MS) {
    try {
      publicada = await consultarGitHub();
    } finally {
      // También si falla: sin conexión no tiene sentido volver a preguntar en cada página que se abre.
      await chrome.storage.local.set({ [CLAVE]: { publicada, cuando: Date.now() } satisfies Consulta });
    }
  }
  return publicada && esMasNueva(publicada.version, versionInstalada()) ? publicada : null;
}

/** Si el aviso de esta versión ya se cerró: no vuelve a salir hasta que haya otra. */
export async function avisoCerrado(version: string): Promise<boolean> {
  return (await chrome.storage.local.get(CLAVE_CERRADO))[CLAVE_CERRADO] === version;
}

export function cerrarAviso(version: string): Promise<void> {
  return chrome.storage.local.set({ [CLAVE_CERRADO]: version });
}
