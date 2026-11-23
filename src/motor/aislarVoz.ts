// Aislar la voz de una canción, en el motor: el trabajador de Demucs separa la voz de la música en el audio a 16 kHz que
// guardó Whisper, para que narabas coloque la letra oyendo solo lo que se canta. Con la voz sola, el error que deja
// narabas en uno de cada diez versos baja de 1,3 s a medio segundo. El trabajador se cierra en cuanto termina: narabas
// viene detrás y necesita la memoria de la GPU.

import { tr } from '../compartido/i18n';
import { bytesModeloVoz } from '../compartido/modelosGuardados';
import type { PedidoVoz, RespuestaVoz } from './aislarVozTrabajador';

export type EventoVoz = { tipo: 'descarga-voz'; porcentaje: number } | { tipo: 'preparando-voz' } | { tipo: 'separando'; porcentaje: number };

/** Sin una GPU que calcule bien no se vuelve a intentar hasta recargar la extensión. */
let sinGpu = false;
let siguienteId = 1;

/** Si Demucs ya está en el disco: sin pedirlo, no se bajan 181 MB. */
export async function enDisco(): Promise<boolean> {
  return (await bytesModeloVoz()) > 0;
}

/** Si se puede intentar: con WebGPU y sin un fallo de la GPU antes. */
export async function posible(): Promise<boolean> {
  if (sinGpu || !('gpu' in navigator)) return false;
  try {
    return !!(await navigator.gpu.requestAdapter());
  } catch {
    return false;
  }
}

/** La voz sola de un audio a 16 kHz. El audio no se toca: se manda una copia. */
export function vozDe(pcm: Float32Array, emitir: (e: EventoVoz) => void, senal: AbortSignal): Promise<Float32Array> {
  return new Promise((ok, mal) => {
    const t = new Worker(chrome.runtime.getURL('aislarVoz.js'), { type: 'module' });
    const id = siguienteId++;
    const terminar = () => {
      t.terminate();
      senal.removeEventListener('abort', alCancelar);
    };
    const alCancelar = () => {
      terminar();
      mal(new DOMException('Cancelado', 'AbortError'));
    };
    senal.addEventListener('abort', alCancelar, { once: true });
    t.onmessage = (e: MessageEvent<RespuestaVoz>) => {
      const r = e.data;
      if (r.tipo === 'descarga') emitir({ tipo: 'descarga-voz', porcentaje: Math.min(100, Math.floor((r.cargado / r.total) * 100)) });
      else if (r.tipo === 'comprobando' || r.tipo === 'preparando') emitir({ tipo: 'preparando-voz' });
      else if (r.tipo === 'separando') emitir({ tipo: 'separando', porcentaje: Math.floor((r.hechos / r.total) * 100) });
      else if (r.tipo === 'voz') {
        console.info(`Demucs: ${(r.muestras.length / 16000).toFixed(0)} s de audio en ${r.ms} ms`);
        terminar();
        ok(r.muestras);
      } else if (r.tipo === 'error') {
        terminar();
        if (r.codigo === 'sin-gpu') sinGpu = true;
        mal(new Error(r.codigo === 'modelo-distinto' ? tr('El modelo descargado no coincide con el publicado, así que se ha borrado. Vuelve a probar más tarde.') : r.mensaje));
      }
    };
    t.onerror = (e) => {
      terminar();
      mal(new Error(e.message || 'Demucs'));
    };
    if (senal.aborted) return alCancelar();
    t.postMessage({ tipo: 'aislar', id, muestras: pcm.slice() } satisfies PedidoVoz);
  });
}
