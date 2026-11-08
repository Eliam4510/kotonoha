// El OCR desde el visor: manda cada página al trabajador, de una en una, guarda lo leído para no volver a leerlo y avisa
// del avance de la primera descarga de los modelos.

import { baseOcr, claveOcr } from '../compartido/paginasOcr';
import type { LineaOcr } from '../nucleo/ocr';
import type { ModoOcr, PedidoOcr, RespuestaOcr } from './ocrTrabajador';

export type { ModoOcr };

export interface Descarga {
  archivo: string;
  cargado: number;
  total: number;
}

export class LectorOcr {
  private trabajador: Worker | null = null;
  private pendientes = new Map<number, { ok: (l: LineaOcr[]) => void; mal: (e: Error) => void }>();
  private siguiente = 1;
  private cola: Promise<unknown> = Promise.resolve();
  private enCurso = new Map<string, Promise<LineaOcr[]>>();

  constructor(private alDescargar: (d: Descarga) => void) {}

  private trabajadorListo(): Worker {
    if (this.trabajador) return this.trabajador;
    const t = new Worker(chrome.runtime.getURL('ocr.js'), { type: 'module' });
    t.onmessage = (e: MessageEvent<RespuestaOcr>) => {
      const r = e.data;
      if (r.tipo === 'descarga') this.alDescargar(r);
      else {
        const p = this.pendientes.get(r.id);
        this.pendientes.delete(r.id);
        if (r.tipo === 'lineas') {
          console.debug('Kotonoha OCR', r.ms, 'ms', r.dispositivo, JSON.stringify(r.fases));
          p?.ok(r.lineas);
        }
        else p?.mal(new Error(r.mensaje));
      }
    };
    t.onerror = (e) => {
      for (const p of this.pendientes.values()) p.mal(new Error(e.message || 'OCR'));
      this.pendientes.clear();
      this.trabajador = null;
    };
    this.trabajador = t;
    return t;
  }

  /** Lo leído de una página: de la base si ya se leyó; si no, del trabajador, después de las que ya esperan. */
  leer(libro: string, pagina: number, modo: ModoOcr, imagen: () => Promise<Blob>): Promise<LineaOcr[]> {
    const clave = claveOcr(libro, modo, pagina);
    const repetida = this.enCurso.get(clave);
    if (repetida) return repetida;
    const tarea = (async () => {
      const guardada = await baseOcr().paginas.get(clave);
      if (guardada) return guardada.lineas;
      const turno = this.cola.then(async () => {
        const bitmap = await createImageBitmap(await imagen());
        const id = this.siguiente++;
        const lineas = await new Promise<LineaOcr[]>((ok, mal) => {
          this.pendientes.set(id, { ok, mal });
          const pedido: PedidoOcr = { tipo: 'leer', id, modo, imagen: bitmap };
          this.trabajadorListo().postMessage(pedido, [bitmap]);
        });
        await baseOcr().paginas.put({ clave, libro, lineas, creada: Date.now() });
        return lineas;
      });
      this.cola = turno.catch(() => {});
      return turno;
    })().finally(() => this.enCurso.delete(clave));
    this.enCurso.set(clave, tarea);
    return tarea;
  }

  cerrar() {
    this.trabajador?.terminate();
    this.trabajador = null;
  }
}
