// Atajos que se pueden reasignar. `defecto` es la combinación con la que los conoce atajos.ts: lo reasignado se traduce a ella.

import { tm } from './i18n';

export interface AccionTeclado {
  id: string;
  grupo: string;
  nombre: string;
  defecto: string;
}

const accion = (id: string, grupo: string, nombre: string, defecto: string): AccionTeclado => ({ id, grupo, nombre, defecto });

const VIDEO = tm('Video');
const TARJETAS = tm('Tarjetas');
const PALABRA = tm('Estado de la palabra');
const SUBS = tm('Subtítulos');
const BARRA = tm('Barra');

export const ACCIONES_TECLADO: AccionTeclado[] = [
  accion('anterior', VIDEO, tm('Subtítulo anterior'), 'a'),
  accion('siguiente', VIDEO, tm('Subtítulo siguiente'), 'd'),
  accion('repetir', VIDEO, tm('Repetir el subtítulo'), 's'),
  accion('retroceder', VIDEO, tm('Retroceder 5 s'), 'alt+a'),
  accion('avanzar', VIDEO, tm('Avanzar 5 s'), 'alt+d'),
  accion('crear', TARJETAS, tm('Crear tarjeta'), 'q'),
  accion('enviar', TARJETAS, tm('Enviar al creador'), 'e'),
  accion('marcar', TARJETAS, tm('Marcar el subtítulo'), 'b'),
  accion('seleccionar', TARJETAS, tm('Seleccionar el subtítulo'), 'l'),
  accion('desconocida', PALABRA, tm('Marcar desconocida'), 'u'),
  accion('rastrear', PALABRA, tm('Rastrear'), 't'),
  accion('conocida', PALABRA, tm('Marcar conocida'), 'k'),
  accion('ignorar', PALABRA, tm('Ignorar'), 'i'),
  accion('siguientePalabra', PALABRA, tm('Siguiente palabra desconocida'), 'n'),
  accion('ocultarJapones', SUBS, tm('Mostrar u ocultar japonés'), 'w'),
  accion('ocultarTodo', SUBS, tm('Mostrar u ocultar todo'), 'r'),
  accion('navegador', SUBS, tm('Navegador de subtítulos'), 'g'),
  accion('copiar', SUBS, tm('Copiar el subtítulo'), 'c'),
  accion('fijarBarra', BARRA, tm('Fijar o soltar la barra'), 'alt+x'),
  accion('verBarra', BARRA, tm('Mostrarla mientras se mantiene'), 'alt+v'),
  accion('traductor', BARRA, tm('Abrir el traductor'), 'alt+t'),
];
