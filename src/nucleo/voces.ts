// Las voces que trae el navegador, de mejor a peor para una lengua. Sin clave de Azure, Kotonoha lee con ellas, y el
// navegador no siempre elige la mejor si no se le dice: en Windows suele quedarse con una voz local antigua, cuando Edge
// ofrece voces neuronales en línea («Natural») y Chrome las de Google, que suenan mucho mejor.

export interface VozDisponible {
  name: string;
  lang: string;
  localService: boolean;
}

const normal = (lang: string) => lang.toLowerCase().replace('_', '-');

function puntos(v: VozDisponible, region?: string): number {
  let p = 0;
  // Edge: «Microsoft Nanami Online (Natural) - Japanese (Japan)».
  if (/\bnatural\b/i.test(v.name)) p += 100;
  // Chrome: «Google 日本語», «Google US English».
  else if (/^google\b/i.test(v.name)) p += 80;
  if (!v.localService) p += 20;
  if (region && normal(v.lang) === normal(region)) p += 10;
  return p;
}

/**
 * Las voces de una lengua (su código: «ja», «en», «de»), de mejor a peor. Con `region` («en-GB»), entre dos iguales va
 * antes la de esa variante. Entre voces del mismo valor se respeta el orden del navegador.
 */
export function vocesDeLengua<T extends VozDisponible>(voces: T[], lengua: string, region?: string): T[] {
  return voces
    .filter((v) => normal(v.lang).split('-')[0] === lengua.toLowerCase())
    .map((v, i) => ({ v, i, p: puntos(v, region) }))
    .sort((a, b) => b.p - a.p || a.i - b.i)
    .map((x) => x.v);
}

/** El nombre de una voz sin lo que ya se sabe: «Microsoft Nanami Online (Natural) - Japanese (Japan)» → «Nanami (Natural)». */
export function nombreCorto(nombre: string): string {
  return nombre
    .replace(/^Microsoft\s+/i, '')
    .replace(/\s+-\s+.*$/, '')
    .replace(/\s+Online\s+/i, ' ')
    .trim();
}

/** La voz con que leer: la elegida en Ajustes si el navegador la sigue ofreciendo; si no, la mejor de la lengua. */
export function vozParaLeer<T extends VozDisponible>(voces: T[], lengua: string, elegida: string, region?: string): T | null {
  const lista = vocesDeLengua(voces, lengua, region);
  return (elegida && lista.find((v) => v.name === elegida)) || lista[0] || null;
}
