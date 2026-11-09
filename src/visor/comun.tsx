// Las piezas que comparten el visor de páginas y el de los libros de texto: los botones de la barra, la cabecera con el
// título, los avisos de error y de espera, y la pantalla completa.

import { useEffect, useState } from 'preact/hooks';
import { tr } from '../compartido/i18n';
import { fondo } from '../compartido/rpc';
import { Icono, type NombreIcono } from '../ui/iconos';

export function Boton({ icono, etiqueta, activo, alPulsar, deshabilitado }: { icono: NombreIcono; etiqueta: string; activo?: boolean; alPulsar: () => void; deshabilitado?: boolean }) {
  return (
    <button class="btn-icono chico" aria-label={etiqueta} data-tip={etiqueta} aria-pressed={activo === undefined ? undefined : activo} disabled={deshabilitado} onClick={alPulsar}>
      <Icono n={icono} t={17} />
    </button>
  );
}

/** La vuelta a la Biblioteca y el título del libro. */
export function Cabeza({ titulo }: { titulo?: string }) {
  return (
    <div class="vs-grupo vs-cabeza">
      <button class="btn chico fantasma" onClick={() => fondo.abrirApp('biblioteca')}><Icono n="flecha-izq" t={15} /> {tr('Biblioteca')}</button>
      {titulo && <b class="vs-titulo" title={titulo}>{titulo}</b>}
    </div>
  );
}

export function AvisoError({ mensaje }: { mensaje: string }) {
  return (
    <div class="vs-aviso" role="alert">
      <Icono n="aviso" t={28} />
      <b>{tr('No se pudo abrir el libro')}</b>
      <p>{mensaje}</p>
      <button class="btn" onClick={() => fondo.abrirApp('biblioteca')}><Icono n="flecha-izq" t={15} /> {tr('Volver a la Biblioteca')}</button>
    </div>
  );
}

export function Abriendo() {
  return (
    <div class="vs-aviso">
      <Icono n="espera" t={26} />
      <span>{tr('Abriendo el libro…')}</span>
    </div>
  );
}

/** Si la pestaña está a pantalla completa, y cómo entrar o salir. */
export function usePantallaCompleta() {
  const [lleno, fijarLleno] = useState(false);
  useEffect(() => {
    const cambio = () => fijarLleno(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', cambio);
    return () => document.removeEventListener('fullscreenchange', cambio);
  }, []);
  const alternar = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});
  return { lleno, alternar };
}
