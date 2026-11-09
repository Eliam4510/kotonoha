// Las moras especiales de la práctica del acento, en el motor: se lee la grabación a 16 kHz y el trabajador de narabas
// dice qué fonemas oye. El trabajador se cierra tras unos minutos sin uso, porque el modelo ocupa más de un gigabyte de
// memoria, y al cancelar, que corta también una descarga a medias.

import { tr } from '../compartido/i18n';
import { MODELO_MORAS } from '../compartido/modelosGuardados';
import { esGrabacionMuda, FRECUENCIA } from '../nucleo/transcripcion';
import type { Dispositivo, PedidoNarabas, RespuestaNarabas } from './narabasTrabajador';
import { abrirAudio } from './whisper';

export type EventoMoras = { tipo: 'descarga'; porcentaje: number } | { tipo: 'comprobando' } | { tipo: 'preparando' } | { tipo: 'procesando' };

/** Una frase se graba en menos de veinte segundos; más se recorta. */
const MAXIMO_S = 30;
const LIBERAR_TRAS_MS = 3 * 60 * 1000;

let trabajador: Worker | null = null;
let temporizador: ReturnType<typeof setTimeout> | null = null;
let siguienteId = 1;
/** Tras un fallo en la GPU, el procesador hasta que se recargue la extensión. */
let soloCpu = false;
const pendientes = new Map<number, { ok: (f: string[]) => void; mal: (e: Error, dispositivo?: Dispositivo) => void; emitir: (e: EventoMoras) => void }>();

function cerrar() {
  trabajador?.terminate();
  trabajador = null;
  if (temporizador) clearTimeout(temporizador);
  temporizador = null;
}

function trabajadorListo(): Worker {
  if (temporizador) clearTimeout(temporizador);
  temporizador = null;
  if (trabajador) return trabajador;
  const t = new Worker(chrome.runtime.getURL('narabas.js'), { type: 'module' });
  t.onmessage = (e: MessageEvent<RespuestaNarabas>) => {
    const r = e.data;
    if (r.tipo === 'descarga' || r.tipo === 'comprobando' || r.tipo === 'preparando' || r.tipo === 'procesando') {
      const evento: EventoMoras = r.tipo === 'descarga' ? { tipo: 'descarga', porcentaje: Math.min(100, Math.floor((r.cargado / r.total) * 100)) } : { tipo: r.tipo };
      for (const p of pendientes.values()) p.emitir(evento);
      return;
    }
    const p = pendientes.get(r.id);
    pendientes.delete(r.id);
    if (r.tipo === 'fonemas') {
      console.info(`narabas: ${r.fonemas.length} fonemas en ${r.ms} ms (${r.dispositivo})`);
      p?.ok(r.fonemas);
    } else {
      p?.mal(new Error(r.codigo === 'modelo-distinto' ? tr('El modelo descargado no coincide con el publicado, así que se ha borrado. Vuelve a probar más tarde.') : r.mensaje), r.dispositivo);
    }
    if (!pendientes.size) programarCierre();
  };
  t.onerror = (e) => {
    for (const p of pendientes.values()) p.mal(new Error(e.message || tr('No se pudieron comprobar las moras.')));
    pendientes.clear();
    cerrar();
  };
  trabajador = t;
  return t;
}

function programarCierre() {
  if (temporizador) clearTimeout(temporizador);
  temporizador = setTimeout(cerrar, LIBERAR_TRAS_MS);
}

function pedir(muestras: Float32Array, emitir: (e: EventoMoras) => void, senal: AbortSignal): Promise<string[]> {
  return new Promise((ok, mal) => {
    const id = siguienteId++;
    const alCancelar = () => {
      pendientes.delete(id);
      // Cerrar el trabajador corta la descarga o el cálculo; la próxima vez se carga de nuevo, de la caché.
      cerrar();
      mal(new DOMException('Cancelado', 'AbortError'));
    };
    senal.addEventListener('abort', alCancelar, { once: true });
    pendientes.set(id, {
      ok: (f) => {
        senal.removeEventListener('abort', alCancelar);
        ok(f);
      },
      mal: (e, dispositivo) => {
        senal.removeEventListener('abort', alCancelar);
        // Un fallo en la GPU (memoria, dispositivo perdido) se reintenta una vez en el procesador.
        if (dispositivo === 'webgpu' && !soloCpu && !senal.aborted) {
          soloCpu = true;
          cerrar();
          pedir(muestras, emitir, senal).then(ok, mal);
          return;
        }
        mal(e);
      },
      emitir,
    });
    trabajadorListo().postMessage({ tipo: 'oir', id, muestras: muestras.slice(), cpu: soloCpu } satisfies PedidoNarabas);
  });
}

/** Carga ya el modelo en el trabajador, si está en la caché (nunca lo descarga): la práctica lo pide al abrirse y al grabar. */
export async function preparar(): Promise<void> {
  // Sin abrir una caché que no existe, que la crearía vacía.
  const guardado = (await caches.has(MODELO_MORAS.cache)) ? await (await caches.open(MODELO_MORAS.cache)).match(MODELO_MORAS.url) : undefined;
  if (!guardado) return;
  trabajadorListo().postMessage({ tipo: 'preparar', cpu: soloCpu } satisfies PedidoNarabas);
  if (!pendientes.size) programarCierre();
}

/** Los fonemas que oye narabas en una grabación, en orden: sin pausas, blancos ni repeticiones. */
export async function fonemasDeGrabacion(url: string, emitir: (e: EventoMoras) => void, senal: AbortSignal): Promise<string[]> {
  const audio = await abrirAudio(url, false);
  if (!audio) throw new Error(tr('El navegador no pudo leer la grabación.'));
  const pcm = await audio.leer(0, Math.min(audio.muestras, MAXIMO_S * FRECUENCIA));
  if (esGrabacionMuda(pcm) || senal.aborted) return [];
  return pedir(pcm, emitir, senal);
}
