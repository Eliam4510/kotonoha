// El dictado del Portapapeles: lo que se graba con el micrófono se transcribe y entra en el texto como un párrafo más, con
// una marca delante que lo une a su grabación. La marca es un comentario de HTML en su propia línea: el texto sigue siendo
// Markdown, los visores de Markdown no la enseñan y, si se borra, el párrafo se queda y la grabación deja de usarse. Las
// grabaciones viven aparte (compartido/dictados.ts); aquí solo está lo que no necesita navegador.

/** Lo más que dura una grabación: después se termina sola. */
export const MAXIMO_DICTADO_MS = 10 * 60 * 1000;

/** Una grabación que ningún texto usa se guarda aún esto, por si se recupera el texto que la tenía. */
export const MARGEN_SIN_USO_MS = 7 * 24 * 60 * 60 * 1000;

const ID = '[a-z0-9][a-z0-9-]{3,39}';
const MARCA = new RegExp(`^[ \\t]*<!--[ \\t]*dictado:(${ID})[ \\t]*-->[ \\t]*$`, 'i');
const MARCAS = new RegExp(MARCA.source, 'gim');

/** La línea que une un párrafo dictado con su grabación. */
export function marcaDictado(id: string): string {
  return `<!-- dictado:${id} -->`;
}

/** El id de la grabación, si la línea es la marca de un dictado. */
export function idDeMarca(linea: string): string | null {
  return MARCA.exec(linea)?.[1] ?? null;
}

/** Las grabaciones a las que apunta un texto, en orden y sin repetir. */
export function idsDeDictado(texto: string): string[] {
  return [...new Set(Array.from(texto.matchAll(MARCAS), (m) => m[1]))];
}

/** Un id corto que no se repite: la hora en base 36 y un poco de azar, por si hay dos en el mismo milisegundo. */
export function nuevoIdDictado(ahora = Date.now(), azar = Math.random()): string {
  return `${ahora.toString(36)}-${Math.floor(azar * 36 ** 4).toString(36).padStart(4, '0')}`;
}

/**
 * El texto de un dictado a partir de las líneas de la transcripción, que llegan partidas como subtítulos. En inglés y en
 * alemán van separadas por un espacio; en japonés, seguidas, porque cada una ya trae su puntuación.
 */
export function textoDeLineas(lineas: string[], conEspacios: boolean): string {
  return lineas
    .map((l) => l.trim())
    .filter(Boolean)
    .join(conEspacios ? ' ' : '');
}

/** Añade un dictado al final del texto, en su propio párrafo y con su marca delante. */
export function anadirDictado(texto: string, id: string, dictado: string): string {
  const bloque = `${marcaDictado(id)}\n${dictado.trim()}`;
  const base = texto.replace(/\s+$/, '');
  return base ? `${base}\n\n${bloque}` : bloque;
}

/** Las grabaciones que se pueden borrar: las que ningún texto usa y llevan guardadas más del margen. */
export function grabacionesSinUso(grabaciones: { id: string; creado: number }[], textos: string[], ahora: number, margenMs = MARGEN_SIN_USO_MS): string[] {
  const usadas = new Set(textos.flatMap(idsDeDictado));
  return grabaciones.filter((g) => !usadas.has(g.id) && ahora - g.creado > margenMs).map((g) => g.id);
}

/** «0:07», «1:05», «12:30»: lo que dura una grabación, o lo que lleva. */
export function minutosYSegundos(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Por debajo de esto no hay voz; por encima, la voz está muy cerca o muy fuerte. En decibelios bajo el máximo. */
const NIVEL_MINIMO_DB = -60;
const NIVEL_MAXIMO_DB = -12;

/** Cuánto suena el micrófono, de 0 a 1, en una escala que sigue al oído: la voz normal queda hacia la mitad. */
export function nivelDeVoz(muestras: Float32Array): number {
  if (!muestras.length) return 0;
  let suma = 0;
  for (const m of muestras) suma += m * m;
  const rms = Math.sqrt(suma / muestras.length);
  if (rms <= 0) return 0;
  const db = 20 * Math.log10(rms);
  return Math.min(1, Math.max(0, (db - NIVEL_MINIMO_DB) / (NIVEL_MAXIMO_DB - NIVEL_MINIMO_DB)));
}
