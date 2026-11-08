// Lo que se dicen el visor y la página del libro que lleva dentro. Las dos son de la extensión, pero se hablan con mensajes:
// así la página del libro no depende de cómo está hecho el visor.

export type MensajeLibro =
  | { tipo: 'listo'; vertical: boolean; verticalPropio: boolean }
  | { tipo: 'posicion'; fraccion: number }
  /** Se pidió pasar de página más allá del principio o del final del capítulo. */
  | { tipo: 'limite'; paso: 1 | -1 }
  | { tipo: 'enlace'; capitulo: number; fragmento?: string }
  | { tipo: 'zoom'; paso: 1 | -1 | 0 }
  | { tipo: 'pantallaCompleta' }
  | { tipo: 'error'; mensaje: string };

export type MensajeVisor = { tipo: 'pagina'; paso: 1 | -1 } | { tipo: 'ir'; fraccion?: number; fragmento?: string };

export const DEL_LIBRO = 'kotonoha-libro';
export const DEL_VISOR = 'kotonoha-visor';
