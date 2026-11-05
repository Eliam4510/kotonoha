// Creación de tarjetas desde el video: captura de audio e imagen, y relleno automático.

import { flujoMotor, fondo, motor } from '../compartido/rpc';
import type { BorradorTarjeta, ContextoIA, LineaAnalizada, MedioTarjeta, PalabraToken } from '../compartido/tipos';
import { aFuriganaAnki, desconocidas, fraseConNegrita } from '../nucleo/frases';
import { borradorVacio, enviarAlCreador } from '../ui/borrador';
import { actualizarCaptura, empezarGrabacionLinea, pausar, reproducir, saltar, terminarGrabacionLinea } from './controlador';
import { ajustes, avisar, infoVideo, lineasObjetivo, lineasSecundarias, quitarAviso } from './estado';
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

/** El fotograma leído directamente del video, sin tocar la pantalla. No se puede si tiene DRM o viene de otro origen. */
function fotogramaDeLienzo(v: HTMLVideoElement): string | null {
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
    if (suma > 0) return lienzo.toDataURL('image/jpeg', 0.88).split(',')[1];
  } catch {
    // Lienzo contaminado por el origen del video: habrá que capturar la pestaña.
  }
  return null;
}

/** Lo que se ve no cambia en la captura hasta que el navegador lo ha pintado. */
const pintado = () =>
  new Promise<void>((ok) => {
    const limite = setTimeout(ok, 250);
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        setTimeout(() => {
          clearTimeout(limite);
          ok();
        }, 40)
      )
    );
  });

// Un sitio con DRM entrega siempre el fotograma en negro. Tras comprobarlo dos veces no se insiste en ese
// video: la interfaz no parpadea por nada. Una sola vez podría ser una escena a oscuras.
const NEGRAS_PARA_RENDIRSE = 2;
let negrasSeguidas = { video: '', veces: 0 };
const claveVideo = () => infoVideo.value?.idVideo ?? location.href;
const videoProtegido = () => negrasSeguidas.video === claveVideo() && negrasSeguidas.veces >= NEGRAS_PARA_RENDIRSE;

/** Fotograma actual: del video si se puede, y si no de la pantalla, con el video como única cosa a la vista. */
async function capturarImagen(v: HTMLVideoElement, ocultarOverlay: (v: boolean) => void): Promise<MedioTarjeta | null> {
  const nombre = `kotonoha_${Date.now()}.jpg`;
  const propio = fotogramaDeLienzo(v);
  if (propio) return { id: nombre, nombre, tipo: 'image/jpeg', datos: propio };
  if (videoProtegido()) return null;
  ocultarOverlay(true);
  try {
    // Sin los controles del reproductor ni nada más del sitio. Si no se pudiera, la captura sigue valiendo.
    await fondo.soloVideo(true).catch(() => {});
    await pintado();
    const url = await fondo.capturaVisible();
    const r = v.getBoundingClientRect();
    const recorte = await motor.recortarImagen(url, { x: r.left, y: r.top, w: r.width, h: r.height, anchoVentana: innerWidth });
    const clave = claveVideo();
    if (recorte.negra) {
      negrasSeguidas = { video: clave, veces: negrasSeguidas.video === clave ? negrasSeguidas.veces + 1 : 1 };
      avisar('El fotograma salió negro: este sitio lo protege, así que la tarjeta va sin captura del video.', undefined, undefined, 7000);
      return null;
    }
    negrasSeguidas = { video: clave, veces: 0 };
    return { id: nombre, nombre, tipo: 'image/jpeg', datos: recorte.url.split(',')[1] };
  } catch {
    return null;
  } finally {
    await fondo.soloVideo(false).catch(() => {});
    ocultarOverlay(false);
  }
}

async function esperarSalto(v: HTMLVideoElement, ms: number) {
  const limite = Date.now() + 4000;
  while (Date.now() < limite) {
    if (Math.abs(v.currentTime * 1000 - ms) < 500 && !v.seeking && v.readyState >= 3) return;
    await dormir(40);
  }
}

/** Un reproductor tarda lo suyo en arrancar tras un salto, sobre todo con DRM. Hay que esperar a que avance de verdad. */
async function esperarAvance(v: HTMLVideoElement, tiempoMs: number): Promise<boolean> {
  const desde = v.currentTime;
  const limite = Date.now() + tiempoMs;
  let reintentado = false;
  while (Date.now() < limite) {
    if (!v.paused && v.currentTime > desde + 0.02) return true;
    if (!reintentado && v.paused && Date.now() > limite - tiempoMs / 2) {
      reintentado = true;
      await reproducir();
    }
    await dormir(25);
  }
  return false;
}

/** Vuelve a reproducir la línea mientras graba el audio de la pestaña, y deja el video como estaba. */
async function grabarLinea(l: LineaAnalizada, ocultarOverlay: (v: boolean) => void, conImagen: boolean): Promise<{ audio: MedioTarjeta | null; imagen: MedioTarjeta | null }> {
  const a = ajustes.value;
  const v = control.video();
  if (!v) return { audio: null, imagen: null };
  const inicio = Math.max(0, l.inicio - a.rellenoInicioMs);
  const fin = l.fin + a.rellenoFinMs;
  const estabaPausado = v.paused;
  const posicion = v.currentTime * 1000;
  let audio: MedioTarjeta | null = null;
  let imagen: MedioTarjeta | null = null;

  // Si hará falta capturar la pantalla, la interfaz se va desde el primer momento, no a mitad de la frase.
  if (conImagen && !fotogramaDeLienzo(v) && !videoProtegido()) ocultarOverlay(true);
  empezarGrabacionLinea(v);
  try {
    await pausar('auto');
    await saltar(inicio);
    await esperarSalto(v, inicio);
    // Lo último que sonó antes de pausar aún viene de camino por la captura: no debe colarse al principio del clip.
    if (!estabaPausado) await dormir(300);
    await motor.empezarClip();
    await reproducir();
    const arranco = await esperarAvance(v, 6000);
    let capturando: Promise<MedioTarjeta | null> | null = null;
    if (arranco) {
      // Por el reloj del video y no por el de la pared: un arranque lento o una pausa de carga no recortan la frase.
      const mitad = (inicio + fin) / 2;
      const limite = Date.now() + (fin - inicio) * 3 + 5000;
      while (v.currentTime * 1000 < fin && !v.ended && Date.now() < limite) {
        if (conImagen && !capturando && v.currentTime * 1000 >= mitad) capturando = capturarImagen(v, ocultarOverlay);
        await dormir(20);
      }
    }
    const clip = await motor.terminarClip();
    console.info('Kotonoha: grabación', { arranco, mudo: !!clip && 'mudo' in clip, clip: clip ? 'datos' in clip : false, videoMudo: v.muted, volumen: v.volume, desde: inicio, hasta: fin, llego: Math.round(v.currentTime * 1000) });
    if (!arranco) {
      avisar('El video no arrancó para grabar la frase: la tarjeta va sin audio.', 'error', undefined, 7000);
    } else if (clip && 'mudo' in clip) {
      avisar('La grabación salió muda: comprueba que el video tenga sonido y pulsa Alt+R en esta pestaña.', 'error', undefined, 9000);
    } else if (clip) {
      audio = { id: 'clip', nombre: `kotonoha_${Date.now()}.mp3`, tipo: clip.tipo, datos: clip.datos, etiqueta: 'Video' };
    }
    if (capturando) imagen = await capturando;
  } finally {
    ocultarOverlay(false);
    await pausar('auto');
    await saltar(posicion);
    await esperarSalto(v, posicion);
    if (!estabaPausado) await reproducir();
    terminarGrabacionLinea(v);
  }
  return { audio, imagen };
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
  const v = control.video();
  if (l && grabar && v) {
    // Se pregunta en este momento: la captura pudo cortarse o estar en otra pestaña.
    const conCaptura = pre.audioFraseVideo && (await actualizarCaptura().catch(() => false));
    if (conCaptura) {
      const { audio, imagen } = await grabarLinea(l, ocultarOverlay, pre.imagenCaptura);
      if (audio) b.audioFrase = [audio];
      if (imagen) b.imagenes = [imagen];
    } else {
      if (pre.imagenCaptura) {
        const imagen = await capturarImagen(v, ocultarOverlay);
        if (imagen) b.imagenes = [imagen];
      }
      if (pre.audioFraseVideo) avisar('Sin audio del video: pulsa Alt+R en esta pestaña para activar la captura.', undefined, undefined, 6000);
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
