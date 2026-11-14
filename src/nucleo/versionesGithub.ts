// Los diccionarios de yomidevs salen cada día como una versión nueva en GitHub, y algún día sale rota: el ZIP de JMdict
// trae el índice y nada más, unos 2 KB en vez de varios MB. Kotonoha los baja de «la última versión»: si la última viene
// vacía, se busca la versión anterior más reciente que traiga ese archivo entero. Sin navegador, para poder probarlo.

/** Una descarga de «la última versión» de GitHub: de qué repositorio y qué archivo. */
export interface DescargaUltima {
  repositorio: string;
  archivo: string;
}

const ULTIMA = /^https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/releases\/latest\/download\/([^/?#]+)$/;

export function descargaUltima(url: string): DescargaUltima | null {
  const m = ULTIMA.exec(url);
  return m ? { repositorio: m[1], archivo: decodeURIComponent(m[2]) } : null;
}

/** Las últimas versiones de un repositorio, de la más nueva a la más vieja. */
export const apiVersiones = (repositorio: string, cuantas = 10) => `https://api.github.com/repos/${repositorio}/releases?per_page=${cuantas}`;

interface Version {
  draft?: boolean;
  prerelease?: boolean;
  assets?: { name: string; size: number; browser_download_url: string }[];
}

/** Lo menos que pesa un diccionario de verdad: los rotos traen solo el índice, unos 2 KB. */
export const TAMANO_MINIMO = 64 * 1024;

/** De dónde bajar el archivo en la versión más reciente que lo traiga entero; null si ninguna lo trae. */
export function versionBuena(versiones: Version[], archivo: string, minimo = TAMANO_MINIMO): string | null {
  for (const v of versiones) {
    if (v.draft || v.prerelease) continue;
    const a = v.assets?.find((x) => x.name === archivo);
    if (a && a.size >= minimo) return a.browser_download_url;
  }
  return null;
}
