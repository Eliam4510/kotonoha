// Tema de las páginas de la extensión. Sobre el video el overlay siempre es oscuro.

import { useEffect, useState } from 'preact/hooks';
import type { Tema } from '../compartido/ajustes';

const consultaClaro = () => matchMedia('(prefers-color-scheme: light)');

export function resolverTema(t: Tema): 'oscuro' | 'claro' {
  if (t === 'auto') return consultaClaro().matches ? 'claro' : 'oscuro';
  return t;
}

/** Devuelve el valor para el atributo data-tema de .kk-raiz y sigue los cambios del sistema. */
export function useTema(t: Tema): 'oscuro' | 'claro' {
  const [resuelto, fijar] = useState(resolverTema(t));
  useEffect(() => {
    fijar(resolverTema(t));
    const c = consultaClaro();
    const alCambiar = () => fijar(resolverTema(t));
    c.addEventListener('change', alCambiar);
    return () => c.removeEventListener('change', alCambiar);
  }, [t]);
  useEffect(() => {
    // El fondo del documento acompaña al tema para que no haya destellos al hacer scroll.
    document.documentElement.style.background = resuelto === 'claro' ? '#F5F2E9' : '#0D1210';
  }, [resuelto]);
  return resuelto;
}
