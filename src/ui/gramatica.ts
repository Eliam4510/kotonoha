// El estado de cada punto de gramática (nuevo, aprendiendo, sabido), compartido por los subtítulos, el navegador y la
// ventana de la app. Se lee del motor al empezar y cada vez que cambia en cualquier pestaña. Los sabidos no se señalan.

import { signal } from '@preact/signals';
import { tm } from '../compartido/i18n';
import { alRecibirEvento, motor } from '../compartido/rpc';
import type { EstadoGramatica } from '../compartido/tipos';
import type { PuntoGramatica } from '../lenguas/tipos';

export const estadosGramatica = signal<Record<string, EstadoGramatica>>({});

export const NOMBRE_ESTADO_GRAMATICA: Record<EstadoGramatica, string> = {
  nuevo: tm('Nuevo'),
  aprendiendo: tm('Aprendiendo'),
  sabido: tm('Sabido'),
};

let estudioActual: () => string = () => '';
let escuchando = false;

function cargar() {
  const estudio = estudioActual();
  motor
    .estadosGramatica(estudio)
    .then((e) => {
      if (estudio === estudioActual()) estadosGramatica.value = e;
    })
    .catch(() => {});
}

/** Empieza a seguir los estados de la lengua que se estudia; con otra lengua, se vuelve a llamar. */
export function seguirEstadosGramatica(estudio: () => string) {
  estudioActual = estudio;
  cargar();
  if (escuchando) return;
  escuchando = true;
  alRecibirEvento((e) => {
    if (e.tipo === 'gramatica') cargar();
  });
}

export const estadoGramatica = (patron: string): EstadoGramatica => estadosGramatica.value[patron] ?? 'nuevo';

/** Lo que se señala bajo una línea: lo que aún no se sabe. */
export const gramaticaPorSaber = (puntos: PuntoGramatica[] | undefined): PuntoGramatica[] => (puntos ?? []).filter((g) => estadoGramatica(g.patron) !== 'sabido');

export async function fijarEstadoGramatica(patron: string, estado: EstadoGramatica) {
  // Al momento en esta pestaña; el aviso del motor lo lleva a las demás.
  const siguiente = { ...estadosGramatica.value };
  if (estado === 'nuevo') delete siguiente[patron];
  else siguiente[patron] = estado;
  estadosGramatica.value = siguiente;
  await motor.fijarEstadoGramatica(patron, estado, estudioActual() || undefined);
}
