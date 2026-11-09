// El reloj de las horas de inmersión. Cada pocos segundos mira si se está escuchando o leyendo la lengua que se
// estudia, y lo sumado lo manda al motor cada minuto, al cambiar de video o de libro y al ocultar la página. Lo usan el
// controlador de los videos (también los archivos propios), el visor de la Ayuda de lectura y el Portapapeles.

import { pasoDeReloj, type TipoInmersion } from '../nucleo/inmersion';
import { motor } from './rpc';

const TIC_MS = 5000;
/** Un tic de más de esto es un equipo que se durmió o una pestaña congelada: no cuenta entero. */
const TOPE_S = 10;
const ENVIAR_CADA_S = 60;

export interface FuenteReloj {
  /** Un identificador estable: el del video, el del libro, «portapapeles». */
  id: string;
  titulo: string;
  /** La lengua que se estudia, para guardarlo en su base aunque el motor haya cambiado a otra. */
  estudio?: string;
}

/** Empieza a contar. Devuelve con qué pararlo, que manda lo que quede. */
export function relojInmersion(tipo: TipoInmersion, fuente: () => FuenteReloj | null, activo: () => boolean): () => void {
  let ultimo = performance.now();
  let pendiente = 0;
  let deFuente: FuenteReloj | null = null;
  const enviar = () => {
    const f = deFuente;
    const segundos = Math.round(pendiente);
    pendiente = 0;
    if (f && segundos >= 1) motor.sumarInmersion(tipo, f.id, f.titulo, segundos, f.estudio).catch(() => {});
  };
  const tic = () => {
    const ahora = performance.now();
    const paso = pasoDeReloj(ultimo, ahora, TOPE_S);
    ultimo = ahora;
    const f = fuente();
    // Con otra fuente (otro video, otro libro), lo de la anterior se manda antes.
    if (deFuente && (!f || f.id !== deFuente.id || f.estudio !== deFuente.estudio)) enviar();
    deFuente = f;
    const ahoraActivo = !!f && activo();
    if (ahoraActivo) pendiente += paso;
    // Se manda cada minuto, y en cuanto se para (una pausa, dejar de leer): así Inicio lo enseña enseguida.
    if (pendiente >= ENVIAR_CADA_S || (!ahoraActivo && pendiente > 0)) enviar();
  };
  const alOcultar = () => {
    if (document.visibilityState !== 'hidden') return;
    tic();
    enviar();
  };
  const intervalo = setInterval(tic, TIC_MS);
  document.addEventListener('visibilitychange', alOcultar);
  window.addEventListener('pagehide', alOcultar);
  return () => {
    clearInterval(intervalo);
    document.removeEventListener('visibilitychange', alOcultar);
    window.removeEventListener('pagehide', alOcultar);
    tic();
    enviar();
  };
}

let ultimaActividad = performance.now();
let siguiendo = false;
const marcar = () => {
  ultimaActividad = performance.now();
};
/** Para lo que pasa donde no llegan los eventos de esta página, como dentro del marco de un libro. */
export const marcarActividad = marcar;

/**
 * Si se está leyendo: la página a la vista y algo hecho en ella (pasar de página, desplazarse, mover el ratón, consultar)
 * en los últimos minutos. Leer una página larga lleva su tiempo, pero una pestaña olvidada no es inmersión.
 */
export function leyendo(margenMs = 3 * 60 * 1000): boolean {
  if (!siguiendo) {
    siguiendo = true;
    for (const tipo of ['pointerdown', 'pointermove', 'keydown', 'wheel', 'scroll', 'touchstart']) window.addEventListener(tipo, marcar, { capture: true, passive: true });
  }
  return document.visibilityState === 'visible' && performance.now() - ultimaActividad < margenMs;
}
