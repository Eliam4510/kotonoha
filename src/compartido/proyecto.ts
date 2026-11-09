// Dónde vive Kotonoha: su repositorio, sus versiones publicadas y la versión de esta copia, que sale del manifiesto.

export const REPOSITORIO = 'Eliam4510/kotonoha';
export const URL_REPOSITORIO = `https://github.com/${REPOSITORIO}`;
/** La página de la última versión, con sus paquetes: la extensión y el ayudante. */
export const URL_ULTIMA_VERSION = `${URL_REPOSITORIO}/releases/latest`;
/** La API de GitHub para la última versión. Responde sin clave y deja leerla desde cualquier origen. */
export const API_ULTIMA_VERSION = `https://api.github.com/repos/${REPOSITORIO}/releases/latest`;

export const versionInstalada = (): string => chrome.runtime.getManifest().version;

/**
 * La orden que registra el ayudante para una copia de Kotonoha. Se ejecuta dentro de la carpeta que sale al descomprimir
 * su zip, y lleva el identificador de la copia: el de una extensión cargada desde una carpeta cambia con la carpeta.
 */
export const ordenInstalarAyudante = (idExtension: string): string => `powershell -ExecutionPolicy Bypass -File instalar.ps1 -Extension ${idExtension}`;
