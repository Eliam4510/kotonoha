// Comparar versiones como las de Kotonoha: tres números, con o sin la «v» de las etiquetas de GitHub.

/** Los números de una versión, como «v0.13.1» o «0.13.1»; null si no lo es. */
export function numerosDeVersion(v: string): number[] | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(v.trim());
  return m ? m.slice(1).map(Number) : null;
}

/** La versión sin la «v» de la etiqueta. */
export const versionLimpia = (v: string): string => v.trim().replace(/^v/, '');

/** Si `publicada` es posterior a `instalada`. Si alguna no es una versión, no lo es. */
export function esMasNueva(publicada: string, instalada: string): boolean {
  const a = numerosDeVersion(publicada);
  const b = numerosDeVersion(instalada);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

/** Lo que trae una versión, sin el nombre del producto delante: «Kotonoha 0.13.0 · Dictar al Portapapeles» → «Dictar al Portapapeles». */
export function novedadesDeTitulo(titulo: string): string {
  const partes = titulo.split(' · ');
  return partes.length > 1 ? partes.slice(1).join(' · ').trim() : '';
}
