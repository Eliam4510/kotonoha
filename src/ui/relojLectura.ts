// Las horas de inmersión al leer: los libros y textos de la Biblioteca y el Cuaderno cuentan
// el tiempo con la página a la vista y algo hecho en ella en los últimos minutos.

import { useEffect } from 'preact/hooks';
import { leyendo, relojInmersion } from '../compartido/relojInmersion';

/** `id` null: no hay nada que leer, y no se cuenta. El título vacío lo pone quien lo enseña (el Portapapeles). */
export function useRelojLectura(id: string | null, titulo: string, estudio: string) {
  useEffect(() => {
    if (!id) return;
    return relojInmersion('lectura', () => ({ id, titulo, estudio }), () => leyendo());
  }, [id, titulo, estudio]);
}
