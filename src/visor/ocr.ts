// El OCR desde el visor: manda cada página al trabajador, de una en una, guarda lo leído para no volver a leerlo y avisa
// del avance de la primera descarga de los modelos. Las páginas esperan turno por prioridad (primero las que están a la
// vista, luego las siguientes en el orden de lectura), y las que se dejan atrás antes de su turno se cancelan: así el
// trabajador nunca se queda leyendo páginas que ya no hacen falta mientras la de delante espera.

import { baseOcr, claveOcr, LECTURA } from '../compartido/paginasOcr';
import { lineasEnMarco } from '../nucleo/escaneo';
import type { LineaOcr } from '../nucleo/ocr';
import { lengua } from '../ui/lengua';
import type { ModoLectura, ModoOcr, PedidoOcr, RespuestaOcr } from './ocrTrabajador';
import type { ImagenOcr } from './paginador';

export type { ModoOcr };

/**
 * Lo que se lee en un modo: el modo Manga de una lengua con espacios lee como cómic, con el reconocedor de libros. Va con
 * su propia clave en la base, así que lo que manga-ocr leyó antes en un cómic no se aprovecha.
 */
export const modoDeLectura = (modo: ModoOcr): ModoLectura => (modo === 'manga' && lengua.value.escritura.globos === 'lector' ? 'comic' : modo);

export interface Descarga {
  archivo: string;
  cargado: number;
  total: number;
}

/** El error de una página que se canceló antes de su turno: no es un fallo y no se enseña. */
export const esCancelada = (e: unknown) => e instanceof Error && e.name === 'Cancelada';
const cancelada = () => Object.assign(new Error('Cancelada'), { name: 'Cancelada' });

interface Tarea {
  clave: string;
  libro: string;
  modo: ModoLectura;
  /** Menos es antes. */
  prioridad: number;
  /** Para desempatar: la que llegó antes. */
  orden: number;
  enMarcha: boolean;
  imagen: () => Promise<ImagenOcr>;
  ok: (l: LineaOcr[]) => void;
  mal: (e: Error) => void;
  promesa: Promise<LineaOcr[]>;
}

/**
 * Sin páginas que leer durante este rato, el trabajador se cierra y suelta sus modelos: unos 470 MB de memoria y otros
 * tantos de la tarjeta gráfica, que antes seguían ocupados mientras el libro estuviera abierto. Si hace falta otra vez,
 * se cargan de la caché en unos segundos.
 */
const LIBERAR_TRAS_MS = 2 * 60 * 1000;

export class LectorOcr {
  private trabajador: Worker | null = null;
  private temporizadorLiberar: ReturnType<typeof setTimeout> | null = null;
  private pendientes = new Map<number, { ok: (l: LineaOcr[]) => void; mal: (e: Error) => void }>();
  private siguienteId = 1;
  /** Las páginas pedidas que aún no han terminado, esperen turno o se estén leyendo. */
  private tareas = new Map<string, Tarea>();
  private esperando: Tarea[] = [];
  private ocupado = false;
  private cerrado = false;
  private llegadas = 0;

  constructor(private alDescargar: (d: Descarga) => void) {}

  private trabajadorListo(): Worker {
    if (this.temporizadorLiberar) clearTimeout(this.temporizadorLiberar);
    this.temporizadorLiberar = null;
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
        } else p?.mal(new Error(r.mensaje));
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

  /**
   * Lo leído de una página: de la base si ya se leyó, con la lectura `minima` o una posterior; si no, del trabajador,
   * cuando le llegue su turno. Si ya estaba pedida, se queda con la prioridad más urgente de las dos.
   */
  leer(libro: string, pagina: number, modoPedido: ModoOcr, imagen: () => Promise<ImagenOcr>, prioridad = 0, minima = 0): Promise<LineaOcr[]> {
    const modo = modoDeLectura(modoPedido);
    const clave = claveOcr(libro, modo, pagina);
    const ya = this.tareas.get(clave);
    if (ya) {
      ya.prioridad = Math.min(ya.prioridad, prioridad);
      return ya.promesa;
    }
    let ok!: (l: LineaOcr[]) => void;
    let mal!: (e: Error) => void;
    const promesa = new Promise<LineaOcr[]>((a, b) => {
      ok = a;
      mal = b;
    });
    const tarea: Tarea = { clave, libro, modo, prioridad, orden: this.llegadas++, enMarcha: false, imagen, ok, mal, promesa };
    this.tareas.set(clave, tarea);
    // Lo ya leído sale de la base sin esperar turno.
    baseOcr()
      .paginas.get(clave)
      .then(
        (guardada) => {
          if (this.tareas.get(clave) !== tarea) return;
          if (guardada && (guardada.lectura ?? 0) >= minima) {
            this.tareas.delete(clave);
            ok(guardada.lineas);
            return;
          }
          this.esperando.push(tarea);
          void this.seguir();
        },
        (e) => {
          this.tareas.delete(clave);
          mal(e instanceof Error ? e : new Error(String(e)));
        }
      );
    return promesa;
  }

  /** De un libro, solo siguen esperando estas páginas (en este modo): las demás que aún no han empezado se cancelan. */
  soloEstas(libro: string, modo: ModoOcr, paginas: Iterable<number>): void {
    const quedan = new Set([...paginas].map((p) => claveOcr(libro, modoDeLectura(modo), p)));
    for (const t of [...this.tareas.values()]) {
      if (t.libro !== libro || t.enMarcha || quedan.has(t.clave)) continue;
      this.tareas.delete(t.clave);
      this.esperando = this.esperando.filter((x) => x !== t);
      t.mal(cancelada());
    }
  }

  /** Con todo leído, el trabajador se cierra pasado un rato si no llega nada más. */
  private programarLiberacion() {
    if (this.temporizadorLiberar) clearTimeout(this.temporizadorLiberar);
    this.temporizadorLiberar = null;
    if (!this.trabajador || this.cerrado) return;
    this.temporizadorLiberar = setTimeout(() => {
      this.temporizadorLiberar = null;
      if (this.ocupado || this.esperando.length || this.pendientes.size) return;
      console.debug('Kotonoha OCR: se sueltan los modelos tras un rato sin leer');
      this.trabajador?.terminate();
      this.trabajador = null;
    }, LIBERAR_TRAS_MS);
  }

  /** Lee la página más urgente de las que esperan, y después la siguiente. */
  private async seguir(): Promise<void> {
    if (this.ocupado) return;
    if (!this.esperando.length) {
      this.programarLiberacion();
      return;
    }
    this.ocupado = true;
    this.esperando.sort((a, b) => a.prioridad - b.prioridad || a.orden - b.orden);
    const t = this.esperando.shift()!;
    t.enMarcha = true;
    try {
      const { imagen, marco } = await t.imagen();
      const bitmap = imagen instanceof Blob ? await createImageBitmap(imagen) : imagen;
      // Si se cerró mientras se preparaba la imagen, no se arranca otro trabajador para nada.
      if (this.cerrado) {
        bitmap.close?.();
        throw cancelada();
      }
      console.debug('Kotonoha OCR: lee', marco ? 'el escaneo' : 'la página', `${bitmap.width}×${bitmap.height}`);
      const id = this.siguienteId++;
      const leidas = await new Promise<LineaOcr[]>((ok, mal) => {
        this.pendientes.set(id, { ok, mal });
        const pedido: PedidoOcr = { tipo: 'leer', id, modo: t.modo, imagen: bitmap };
        this.trabajadorListo().postMessage(pedido, [bitmap]);
      });
      // Si se leyó solo la imagen escaneada, sus líneas se ponen donde está ella en la página.
      const lineas = marco ? lineasEnMarco(leidas, marco) : leidas;
      await baseOcr().paginas.put({ clave: t.clave, libro: t.libro, lineas, creada: Date.now(), lectura: LECTURA });
      t.ok(lineas);
    } catch (e) {
      t.mal(e instanceof Error ? e : new Error(String(e)));
    } finally {
      this.tareas.delete(t.clave);
      this.ocupado = false;
      void this.seguir();
    }
  }

  cerrar() {
    this.cerrado = true;
    if (this.temporizadorLiberar) clearTimeout(this.temporizadorLiberar);
    this.temporizadorLiberar = null;
    for (const t of this.tareas.values()) if (!t.enMarcha) t.mal(cancelada());
    this.tareas.clear();
    this.esperando = [];
    // La que se estaba leyendo también acaba: el trabajador ya no va a contestar.
    for (const p of this.pendientes.values()) p.mal(cancelada());
    this.pendientes.clear();
    this.trabajador?.terminate();
    this.trabajador = null;
  }
}
