// El CSS de un EPUB de texto, preparado para pintarlo en una página de la extensión: sus imágenes y sus fuentes salen del
// propio libro, nada se pide a internet, y las propiedades con el prefijo -epub- de los libros japoneses pasan a las que
// entiende el navegador: escritura vertical, números en horizontal dentro de la columna, puntos de énfasis. Sin navegador,
// para poder probarlo.

import { resolverRuta } from './libro';

export interface RecursosCss {
  /** La URL con la que se carga un archivo del libro, o null si no está. */
  url(ruta: string): Promise<string | null>;
  /** El texto de otra hoja del libro, para un @import. */
  texto(ruta: string): Promise<string | null>;
}

const PREFIJADAS = /-epub-(writing-mode|text-orientation|text-emphasis(?:-style|-color|-position)?|line-break|word-break|hyphens|text-underline-position|text-align-last)\s*:/gi;
const COMBINAR = /-(?:epub|webkit)-text-combine(?:-horizontal)?\s*:\s*(?:horizontal|all)/gi;
const URL_CSS = /url\(\s*(['"]?)([^'")]*)\1\s*\)/gi;

/** Las propiedades de EPUB con el nombre que entiende el navegador. */
export function propiedadesEpub(css: string): string {
  return css
    .replace(COMBINAR, 'text-combine-upright: all')
    .replace(PREFIJADAS, '$1:')
    .replace(/(text-orientation\s*:\s*)sideways-right/gi, '$1sideways');
}

/** Una dirección que apunta dentro del libro: sin esquema (http:, data:…), sin «//» delante y sin ser solo un #fragmento. */
export const esInterna = (u: string) => !!u && !/^[a-z][a-z\d+.-]*:/i.test(u) && !u.startsWith('//') && !u.startsWith('#');

/**
 * Una hoja de estilo del libro lista para usar. Cada url() interna pasa a la del archivo del libro; las de fuera se
 * anulan; un @import interno se pega en su sitio, y uno de fuera se quita. Las reglas @namespace se dejan como están.
 */
export async function prepararCss(css: string, ruta: string, recursos: RecursosCss, profundidad = 0): Promise<string> {
  let salida = propiedadesEpub(css.replace(/\/\*[\s\S]*?\*\//g, ''));
  const espacios: string[] = [];
  salida = salida.replace(/@namespace\b[^;]*;/gi, (m) => {
    espacios.push(m);
    return '';
  });

  for (const m of [...salida.matchAll(/@import\s+(?:url\(\s*)?(['"]?)([^'")\s;]+)\1\s*\)?[^;]*;/gi)]) {
    let pegado = '';
    if (profundidad < 3 && esInterna(m[2])) {
      const otra = resolverRuta(ruta, m[2]);
      const texto = await recursos.texto(otra);
      if (texto) pegado = await prepararCss(texto, otra, recursos, profundidad + 1);
    }
    salida = salida.replace(m[0], pegado);
  }

  const cambios = new Map<string, string>();
  for (const m of salida.matchAll(URL_CSS)) {
    if (cambios.has(m[0])) continue;
    const destino = m[2].trim();
    if (/^data:/i.test(destino) || destino.startsWith('#')) cambios.set(m[0], m[0]);
    else if (esInterna(destino)) {
      const u = await recursos.url(resolverRuta(ruta, destino));
      cambios.set(m[0], u ? `url("${u}")` : 'none');
    } else cambios.set(m[0], 'none');
  }
  salida = salida.replace(URL_CSS, (m) => cambios.get(m) ?? 'none');
  // Los @namespace van primero: si no, el navegador los ignora.
  return [...espacios, salida].join('\n');
}

/** Un atributo style del libro: con las propiedades de EPUB traducidas y sin cargar nada, salvo lo que ya trae dentro. */
export function estiloEnLinea(estilo: string): string {
  return propiedadesEpub(estilo).replace(URL_CSS, (m, _q: string, u: string) => (/^data:/i.test(u.trim()) || u.trim().startsWith('#') ? m : 'none'));
}
