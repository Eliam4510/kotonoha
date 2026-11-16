// Dónde se canta, en el motor: mientras Whisper transcribe una canción, el trabajador de YAMNet puntúa los mismos bloques
// de audio, ya a 16 kHz. Al terminar queda la puntuación de «canto» de cada tramo de 2 s, que se guarda con la
// transcripción y sirve para colocar la letra sin poner versos en un pasaje instrumental (ver nucleo/letra.ts).
// Si algo falla, no hay puntuación y la letra se coloca como siempre.

import type { CantoPorTramos } from '../nucleo/letra';
import { FRECUENCIA } from '../nucleo/transcripcion';
import type { PedidoCanto, RespuestaCanto } from './cantoTrabajador';

const LIBERAR_TRAS_MS = 2 * 60 * 1000;
/** Cada marco de YAMNet oye 0,96 s y avanza 0,48 s: su centro, desde el principio del bloque. */
const PASO_MARCO_MS = 480;
const PASO_TRAMO_MS = 2000;

let trabajador: Worker | null = null;
let temporizador: ReturnType<typeof setTimeout> | null = null;
let siguienteId = 1;
const pendientes = new Map<number, { ok: (m: Float32Array) => void; mal: (e: Error) => void }>();

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
  const t = new Worker(chrome.runtime.getURL('canto.js'), { type: 'module' });
  t.onmessage = (e: MessageEvent<RespuestaCanto>) => {
    const r = e.data;
    const p = pendientes.get(r.id);
    pendientes.delete(r.id);
    if (r.tipo === 'canto') p?.ok(r.marcos);
    else p?.mal(new Error(r.mensaje));
    if (!pendientes.size) temporizador = setTimeout(cerrar, LIBERAR_TRAS_MS);
  };
  t.onerror = (e) => {
    for (const p of pendientes.values()) p.mal(new Error(e.message || 'YAMNet'));
    pendientes.clear();
    cerrar();
  };
  trabajador = t;
  return t;
}

/** La puntuación de «canto» de cada marco de un bloque de audio a 16 kHz. El bloque se transfiere: que sea una copia. */
function puntuar(muestras: Float32Array): Promise<Float32Array> {
  return new Promise((ok, mal) => {
    const id = siguienteId++;
    pendientes.set(id, { ok, mal });
    trabajadorListo().postMessage({ tipo: 'puntuar', id, muestras } satisfies PedidoCanto, [muestras.buffer]);
  });
}

/** Junta lo que oye YAMNet en cada bloque que lee Whisper, y al final lo reparte en tramos de 2 s. */
export class AcumuladorCanto {
  private marcos: { t: number; p: number }[] = [];
  private enCurso: Promise<void>[] = [];
  private fallo = false;

  /** Un bloque de audio que empieza en `desde` (muestras desde el principio). */
  agregar(muestras: Float32Array, desde: number) {
    const inicioMs = (desde / FRECUENCIA) * 1000;
    // Una copia: Whisper sigue usando el bloque, y lo que se manda a un trabajador se transfiere.
    this.enCurso.push(
      puntuar(new Float32Array(muestras))
        .then((m) => m.forEach((p, f) => this.marcos.push({ t: inicioMs + f * PASO_MARCO_MS + PASO_MARCO_MS, p })))
        .catch((e) => {
          if (!this.fallo) console.warn('Kotonoha: no se pudo oír dónde se canta', e);
          this.fallo = true;
        })
    );
  }

  /** La puntuación por tramos de todo el audio, o null si algún bloque falló: entonces la letra se coloca como siempre. */
  async terminar(muestras: number): Promise<CantoPorTramos | null> {
    await Promise.all(this.enCurso);
    if (this.fallo || !this.marcos.length) return null;
    const puntos = new Array<number>(Math.ceil(((muestras / FRECUENCIA) * 1000) / PASO_TRAMO_MS)).fill(0);
    for (const m of this.marcos) {
      const w = Math.floor(m.t / PASO_TRAMO_MS);
      if (w < puntos.length) puntos[w] = Math.max(puntos[w], m.p);
    }
    return { pasoMs: PASO_TRAMO_MS, puntos: puntos.map((x) => Math.round(x * 1000) / 1000) };
  }
}
