// Qué diccionarios conviene instalar según el idioma de cada persona.

interface Fuente {
  id: string;
  tipo: string;
  idioma?: string;
  recomendado: boolean;
}

/**
 * Los de términos en su idioma y en inglés, que es el más completo: si un término falta en el propio, siempre está ahí.
 * Los de acento y frecuencia sirven a todos.
 */
export function fuentesRecomendadas<T extends Fuente>(fuentes: T[], idioma: string): T[] {
  const propias = fuentes.filter((f) => f.tipo === 'terminos' && f.idioma === idioma);
  const ingles = fuentes.filter((f) => f.tipo === 'terminos' && f.idioma === 'en' && f.recomendado && idioma !== 'en');
  const otras = fuentes.filter((f) => f.tipo !== 'terminos' && f.recomendado);
  return [...propias, ...ingles, ...otras];
}
