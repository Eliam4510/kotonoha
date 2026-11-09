// Qué puntos de gramática hay en unas tarjetas de Anki, para marcarlos como sabidos de una vez. El campo de cada nota trae
// el punto como lo escribió quien hizo la tarjeta: «〜べき», «べきだ», «used to». Se compara sin la tilde de los patrones, sin
// HTML ni espacios.

/** El patrón o el campo, comparable: sin HTML, sin tildes de patrón (〜, ～, ~), sin espacios ni puntos, en minúsculas. */
export function normalizarPatron(texto: string): string {
  return texto
    .replace(/<[^>]+>/g, '')
    .replace(/[〜～~…]/g, '')
    .replace(/[\s.。、,，!?！？「」『』()（）]/g, '')
    .toLowerCase();
}

/**
 * Las formas de un texto: «there is / there are» son dos, y lo que va entre paréntesis puede estar o no. En un patrón de
 * la lista es una aclaración, como en 〜そうだ（伝聞）; en una tarjeta, algo opcional, como en 〜際（に）.
 */
const conYSinParentesis = (t: string) => [t.replace(/[（(][^）)]*[）)]/g, ''), t];
const variantes = (patron: string) => [...new Set(patron.split('/').flatMap(conYSinParentesis).map(normalizarPatron).filter(Boolean))];

/** Lo que la lengua sabe de cómo se escriben sus puntos en una tarjeta. */
export interface FormasAnki {
  /** Lo que se le puede añadir a un patrón sin que deje de ser él: べき y べきだ. Siempre con la cadena vacía. */
  colas: string[];
  /** Separadores propios de la lengua entre alternativas de un campo, además de la barra y las comas. */
  separadores?: string;
}

const escapar = (s: string) => s.replace(/[\\^$.*+?()[\]{}|/-]/g, '\\$&');

/** Las alternativas de un campo: «〜に過ぎない / 〜にすぎない». */
function alternativas(campo: string, separadores: string): string[] {
  const corte = new RegExp(`[/／,，、;；${escapar(separadores)}]`);
  return campo
    .replace(/<br\s*\/?>/gi, '/')
    .replace(/<[^>]+>/g, '')
    .split(corte)
    .flatMap(conYSinParentesis)
    .map(normalizarPatron)
    .filter(Boolean);
}

/**
 * Los patrones que son el contenido de algún campo, o de una de sus alternativas. Un patrón dentro de una frase de ejemplo
 * no cuenta: «be used to» no es «used to», y un patrón corto no puede saltar en cualquier palabra.
 */
export function puntosEnNotas(patrones: string[], textos: string[], formas: FormasAnki = { colas: [''] }): Set<string> {
  const campos = new Set(textos.flatMap((t) => alternativas(t, formas.separadores ?? '')));
  const salida = new Set<string>();
  for (const patron of patrones) {
    if (variantes(patron).some((f) => formas.colas.some((cola) => campos.has(f + cola)))) salida.add(patron);
  }
  return salida;
}
