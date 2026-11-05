// Estado de la ventana compartido entre pantallas: navegación, panel del creador de tarjetas
// y preferencias de comodidad de este navegador.

import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { motor } from '../compartido/rpc';
import type { EstadoAnki } from '../compartido/tipos';

export function navegar(ruta: string) {
  location.hash = `#/${ruta}`;
}

/** Si el almacenamiento del navegador falla, la ventana sigue funcionando con el valor inicial. */
export function leerPreferencia<T>(clave: string, inicial: T): T {
  try {
    const v = localStorage.getItem(`kk-${clave}`);
    return v === null ? inicial : (JSON.parse(v) as T);
  } catch {
    return inicial;
  }
}

export function guardarPreferencia(clave: string, valor: unknown): void {
  try {
    localStorage.setItem(`kk-${clave}`, JSON.stringify(valor));
  } catch {
    // Solo es una comodidad: sin almacenamiento se pierde al cerrar la ventana.
  }
}

export const creadorAbierto = signal(false);
export const creadorFijado = signal(leerPreferencia('creadorFijado', true));

export const estadoAnki = signal<EstadoAnki | null>(null);
let consultaAnki: Promise<void> | null = null;

/**
 * AnkiConnect atiende las peticiones de una en una: si varias pantallas preguntan a la vez, alguna falla
 * y da un «sin conectar» falso. Por eso hay una sola consulta en curso y un solo estado para toda la ventana.
 */
export function refrescarAnki(): Promise<void> {
  consultaAnki ??= motor
    .anki()
    .then((e) => {
      estadoAnki.value = e;
    })
    .catch(() => {
      estadoAnki.value = { conectado: false, mazos: [], modelos: [] };
    })
    .finally(() => {
      consultaAnki = null;
    });
  return consultaAnki;
}

export function useMedia(consulta: string): boolean {
  const [coincide, fijar] = useState(() => matchMedia(consulta).matches);
  useEffect(() => {
    const m = matchMedia(consulta);
    const alCambiar = () => fijar(m.matches);
    alCambiar();
    m.addEventListener('change', alCambiar);
    return () => m.removeEventListener('change', alCambiar);
  }, [consulta]);
  return coincide;
}
