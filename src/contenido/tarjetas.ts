// Creación de tarjetas desde el video: captura de audio e imagen, y relleno automático.

import { flujoMotor, fondo, motor } from '../compartido/rpc';
import type { BorradorTarjeta, ContextoIA, LineaAnalizada, MedioTarjeta, PalabraToken } from '../compartido/tipos';
import { aFuriganaAnki, desconocidas, fraseConNegrita } from '../nucleo/frases';
import { borradorVacio, enviarAlCreador } from '../ui/borrador';
import { pausar, reproducir, saltar } from './controlador';
import { ajustes, avisar, capturaActiva, infoVideo, lineasObjetivo, lineasSecundarias, quitarAviso } from './estado';
import type { Control } from './puente';

let control: Control;
export const iniciarTarjetas = (c: Control) => {
  control = c;
};

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function guionActual(): string | undefined {
  const lineas = lineasObjetivo.value;
  if (!lineas.length || !ajustes.value.usarGuion) return undefined;
  return lineas.map((l) => l.texto.replace(/\n/g, ' ')).join('\n');
}

const LINEAS_ALREDEDOR = 20;

/** Contexto amplio para Claude: guion completo en caché, líneas vecinas y traducción disponible. */
export function contextoDe(frase?: string, l?: LineaAnalizada | null): ContextoIA {
  const c: ContextoIA = { frase, titulo: infoVideo.value?.titulo, guion: guionActual() };
  if (l) {
    const todas = lineasObjetivo.value;
    const i = todas.findIndex((x) => x.id === l.id);
    if (i >= 0) {
      c.antes = todas.slice(Math.max(0, i - LINEAS_ALREDEDOR), i).map((x) => x.texto.replace(/\n/g, ' '));
      c.despues = todas.slice(i + 1, i + 1 + LINEAS_ALREDEDOR).map((x) => x.texto.replace(/\n/g, ' '));
    }
    const traduccion = secundariaDe(l);
    if (traduccion) c.traduccion = traduccion;
  }
  return c;
}

/** Fotograma actual. Con DRM el lienzo sale negro: entonces se captura la pestaña. */
async function capturarImagen(ocultarOverlay: (v: boolean) => void): Promise<MedioTarjeta | null> {
  const v = control.video();
  if (!v) return null;
  const nombre = `kotonoha_${Date.now()}.jpg`;
  try {
    const lienzo = document.createElement('canvas');
    const escala = Math.min(1, 1280 / (v.videoWidth || 1280));
    lienzo.width = Math.round((v.videoWidth || 1280) * escala);
    lienzo.height = Math.round((v.videoHeight || 720) * escala);
    const ctx = lienzo.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(v, 0, 0, lienzo.width, lienzo.height);
    const muestra = ctx.getImageData(0, 0, lienzo.width, lienzo.height).data;
    let suma = 0;
    for (let i = 0; i < muestra.length; i += 4 * 97) suma += muestra[i] + muestra[i + 1] + muestra[i + 2];
    if (suma > 0) {
      return { id: nombre, nombre, tipo: 'image/jpeg', datos: lienzo.toDataURL('image/jpeg', 0.88).split(',')[1] };
    }
  } catch {
    // Lienzo contaminado por el origen del video: se usa la captura de pestaña.
  }
  try {
    ocultarOverlay(true);
    await dormir(80);
    const url = await fondo.capturaVisible();
    const r = v.getBoundingClientRect();
    const recorte = await motor.recortarImagen(url, { x: r.left, y: r.top, w: r.width, h: r.height, escala: devicePixelRatio });
    return { id: nombre, nombre, tipo: 'image/jpeg', datos: recorte.split(',')[1] };
  } catch {
    return null;
  } finally {
    ocultarOverlay(false);
  }
}

/** Reproduce la línea en tiempo real mientras graba el audio de la pestaña. */
async function grabarLinea(l: LineaAnalizada, ocultarOverlay: (v: boolean) => void): Promise<{ audio: MedioTarjeta | null; imagen: MedioTarjeta | null }> {
  const a = ajustes.value;
  const v = control.video();
  if (!v) return { audio: null, imagen: null };
  const inicio = Math.max(0, l.inicio - a.rellenoInicioMs);
  const fin = l.fin + a.rellenoFinMs;
  const estabaPausado = v.paused;
  const posicion = v.currentTime * 1000;

  await pausar('auto');
  await saltar(inicio);
  await esperarSalto(v, inicio);
  await motor.empezarClip();
  await reproducir();
  const duracion = (fin - inicio) / (v.playbackRate || 1);
  await dormir(duracion / 2);
  const imagen = await capturarImagen(ocultarOverlay);
  await dormir(duracion / 2);
  const clip = await motor.terminarClip();
  await pausar('auto');
  if (!estabaPausado) {
    await saltar(posicion);
    await reproducir();
  }
  const audio = clip ? { id: 'clip', nombre: `kotonoha_${Date.now()}.mp3`, tipo: clip.tipo, datos: clip.datos, etiqueta: 'Video' } : null;
  return { audio, imagen };
}

async function esperarSalto(v: HTMLVideoElement, ms: number) {
  const limite = Date.now() + 4000;
  while (Date.now() < limite) {
    if (Math.abs(v.currentTime * 1000 - ms) < 500 && !v.seeking && v.readyState >= 3) return;
    await dormir(40);
  }
}

function secundariaDe(l: LineaAnalizada): string {
  return lineasSecundarias.value
    .filter((s) => s.inicio < l.fin && s.fin > l.inicio)
    .map((s) => s.texto.replace(/\n/g, ' '))
    .join(' ');
}

function textoFlujo(metodo: string, args: unknown[]): Promise<string> {
  return flujoMotor(metodo, args, () => {});
}

/** Relleno automático de una tarjeta según Ajustes > Prellenado. */
export async function construirBorrador(p: PalabraToken | null, l: LineaAnalizada | null, ocultarOverlay: (v: boolean) => void, grabar: boolean): Promise<BorradorTarjeta> {
  const a = ajustes.value;
  const pre = a.prellenado;
  const b = borradorVacio();
  const palabra = p ?? (l ? desconocidas(l.palabras)[0] ?? null : null);

  if (palabra) {
    b.palabra = palabra.lema;
    b.lectura = palabra.lecturaLema;
  }
  if (l) {
    b.frase = a.negritaPalabra && palabra ? fraseConNegrita(l.palabras, palabra.clave) : l.texto;
    b.fraseFurigana = aFuriganaAnki(l.palabras, a.negritaPalabra ? palabra?.clave : undefined);
    b.fuente = infoVideo.value?.titulo;
    b.url = location.href;
  }

  const ctx = contextoDe(l?.texto, l);
  const tareas: Promise<unknown>[] = [];

  if (!l && pre.fraseIA && palabra) {
    tareas.push(motor.generarFraseEjemplo(palabra.lema).then((f) => (b.frase = f)).catch(() => {}));
  }
  if (l) {
    const sec = pre.traduccionSecundaria ? secundariaDe(l) : '';
    if (sec) b.traduccion = sec;
    else if (pre.traduccionIA) tareas.push(textoFlujo('traducir', [ctx, false]).then((t) => (b.traduccion = t.trim())).catch(() => {}));
  }
  if (palabra && pre.definiciones) {
    tareas.push(
      motor.buscar(palabra.lema, palabra.lecturaLema).then((r) => {
        const defs = [...new Set(r.entradas.flatMap((e) => e.glosas))].slice(0, 5).join('<br>');
        // El sentido en esta frase va primero: es lo que hay que recordar de la tarjeta.
        b.definicion = palabra.sentido ? `<b>${palabra.sentido}</b><br>${defs}` : defs;
      }).catch(() => {})
    );
  }
  if (palabra && pre.audioPalabraDiccionario) {
    tareas.push(
      motor.audiosPalabra(palabra.lema, palabra.lecturaLema).then(async (r) => {
        if (r[0]) {
          const m = await motor.descargarMedio(r[0].url);
          b.audioPalabra = [{ id: r[0].url, nombre: `kotonoha_${palabra.lema}.mp3`, tipo: m.tipo, datos: m.datos, etiqueta: r[0].etiqueta }];
        }
      }).catch(() => {})
    );
  }
  if (palabra && pre.explicacionIA && l) {
    tareas.push(textoFlujo('explicar', [{ ...ctx, lema: palabra.lema, lectura: palabra.lecturaLema, superficie: palabra.superficie }, false, false]).then((t) => (b.notas = t.trim())).catch(() => {}));
  }
  if (palabra && pre.ejemplos) {
    tareas.push(
      motor.ejemplos(palabra.lema).then((e) => {
        b.ejemplos = e.filter((x) => x.texto !== l?.texto).slice(0, 2).map((x) => x.texto).join('<br>');
      }).catch(() => {})
    );
  }

  // La grabación va aparte: mueve el video y dura lo que dure la frase.
  if (l && grabar) {
    if (pre.audioFraseVideo && capturaActiva.value) {
      const { audio, imagen } = await grabarLinea(l, ocultarOverlay);
      if (audio) b.audioFrase = [audio];
      if (imagen && pre.imagenCaptura) b.imagenes = [imagen];
    } else if (pre.imagenCaptura) {
      const imagen = await capturarImagen(ocultarOverlay);
      if (imagen) b.imagenes = [imagen];
    }
  }
  if (!b.audioFrase.length && pre.audioFraseVoz && a.azureClave && b.frase) {
    tareas.push(
      motor.vozFrase(l?.texto ?? b.frase, a.vocesFrase[0]).then((d) => {
        b.audioFrase = [{ id: 'voz', nombre: `kotonoha_voz_${Date.now()}.mp3`, tipo: 'audio/mpeg', datos: d, etiqueta: 'Voz' }];
      }).catch(() => {})
    );
  }
  await Promise.all(tareas);
  return b;
}

let cancelada = false;
export const cancelarUnClic = () => {
  cancelada = true;
};

export async function crearUnClic(p: PalabraToken | null, l: LineaAnalizada | null, ocultarOverlay: (v: boolean) => void) {
  cancelada = false;
  const aviso = avisar('Creando tarjeta…', undefined, undefined, 0);
  try {
    const b = await construirBorrador(p, l, ocultarOverlay, true);
    if (cancelada) return;
    if (!capturaActiva.value && ajustes.value.prellenado.audioFraseVideo && l) {
      avisar('Sin audio del video: activa la captura con Alt+R.', undefined, undefined, 6000);
    }
    await motor.crearTarjeta(b);
    const palabra = p ?? (l ? desconocidas(l.palabras)[0] ?? null : null);
    if (palabra && palabra.estado === 'desconocida') {
      await motor.cambiarPalabras([{ clave: palabra.clave, lema: palabra.lema, lectura: palabra.lecturaLema, estado: 'aprendiendo' }]);
    }
    avisar(`Tarjeta creada${palabra ? `: ${palabra.lema}` : ''}`, 'exito');
  } catch (e) {
    avisar(`No se pudo crear la tarjeta: ${e instanceof Error ? e.message : e}`, 'error', undefined, 9000);
  } finally {
    quitarAviso(aviso);
  }
}

export async function enviarACreador(p: PalabraToken | null, l: LineaAnalizada | null, ocultarOverlay: (v: boolean) => void) {
  const aviso = avisar('Preparando la tarjeta…', undefined, undefined, 0);
  try {
    const b = await construirBorrador(p, l, ocultarOverlay, true);
    await enviarAlCreador(b);
  } catch (e) {
    avisar(`No se pudo enviar: ${e instanceof Error ? e.message : e}`, 'error');
  } finally {
    quitarAviso(aviso);
  }
}

/** Crea una tarjeta por cada línea seleccionada en el navegador de subtítulos. */
export async function crearVarias(lineas: LineaAnalizada[], ocultarOverlay: (v: boolean) => void) {
  for (const l of lineas) {
    if (cancelada) break;
    await crearUnClic(null, l, ocultarOverlay);
  }
}
