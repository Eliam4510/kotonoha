// Reproductor de archivos propios: videos y audios con sus subtítulos y las mismas herramientas que en cualquier sitio, con
// sus propios controles, una lista, carpetas enteras y la memoria de dónde se dejó cada uno.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { cargarVideoActual, cortarWhisper, fijarFuenteArchivo, iniciarControlador, importarArchivo, nombreIdioma } from '../contenido/controlador';
import { ajustes, avisar, infoVideo, lineasObjetivo, panel } from '../contenido/estado';
import type { Control } from '../contenido/puente';
import { cambiarAjuste, Reproductor } from '../contenido/Reproductor';
import { iniciarTarjetas } from '../contenido/tarjetas';
import { instalarAtajos } from '../contenido/atajos';
import { Icono } from '../ui/iconos';
import type { Ajustes } from '../compartido/ajustes';
import { extraerAudioParaWhisper, extraerPistaAudio, extraerSubtitulos, type InformeMedio, inspeccionarArchivo, sincronizarAudio } from './medios';
import { Mensaje } from './Piezas';
import { tr } from '../compartido/i18n';
import { lengua } from '../ui/lengua';
import { letraElegida } from '../ui/letra';
import { porNombre } from '../nucleo/carpetas';
import { ACEPTADOS, claveArchivo, emparejar, enOrden, esCancionPorArchivo, haTerminado, partesDeSubtitulo, puntoDeReanudar, reloj, sinExtension, tipoDeArchivo, velocidadVecina } from '../nucleo/reproductor';
import { alternarSonido, CLAVES_RECORDADAS, ControlesReproductor, fijarVelocidadVideo, recordado, textoVelocidad } from './ControlesReproductor';
import { type Elemento, type Fuente, PanelLista, Recientes } from './ListaReproductor';
import {
  archivosDeCarpeta,
  elegirArchivos,
  elegirCarpeta,
  guardarLista,
  guardarVisto,
  haySelectorArchivos,
  haySelectorCarpetas,
  leerLista,
  leerVisto,
  miniaturaDe,
  olvidarVisto,
  permitido,
  podarVistos,
  recientes,
  type Visto,
} from './reproductorDatos';

let elVideo: HTMLVideoElement | null = null;
let elContenedor: HTMLElement | null = null;
let nombreVideo = '';
let iniciado = false;
let archivoActual: File | null = null;
let informe: InformeMedio | null = null;
let alInforme: (i: InformeMedio | null) => void = () => {};
/** Pista de audio elegida: es también la que se transcribe. */
let indiceAudio: number | undefined;
let contadorElementos = 0;
/** Cada archivo que se abre tiene su turno: si se abre otro antes de que empiece, el primero ya no lo mueve. */
let turnoApertura = 0;

const control: Control = {
  sitio: 'local',
  async info() {
    // Un audio suelto es una canción: así se transcribe con el modelo que mejor oye el canto, y se sabe dónde se canta.
    return { sitio: 'local', activo: !!elVideo?.src, idVideo: nombreVideo || null, titulo: sinExtension(nombreVideo), anuncio: false, ...(esCancionPorArchivo(nombreVideo) ? { categoria: 'Music' } : {}) };
  },
  // Los subtítulos incrustados en el archivo aparecen como cualquier otra pista.
  async listarPistas() {
    const f = archivoActual;
    if (!f) return [];
    informe = await inspeccionarArchivo(f).catch((e) => {
      console.warn('Kotonoha: no se pudo inspeccionar el archivo', e);
      return null;
    });
    alInforme(informe);
    return (informe?.subtitulos ?? [])
      .filter((s) => !s.imagen)
      .map((s) => ({ id: `incrustada:${s.indice}`, idioma: s.idioma, nombre: s.titulo || tr('{0} (incrustados)', nombreIdioma(s.idioma)), origen: 'sitio' as const }));
  },
  async cargarPista(id) {
    const pista = informe?.subtitulos.find((s) => `incrustada:${s.indice}` === id);
    if (!pista || !archivoActual) throw new Error(tr('Esta pista ya no está disponible'));
    return extraerSubtitulos(archivoActual, pista);
  },
  async saltar(ms) {
    if (elVideo) elVideo.currentTime = ms / 1000;
  },
  async reproducir() {
    await elVideo?.play();
  },
  async pausar() {
    elVideo?.pause();
  },
  ocultarNativos: async () => {},
  imagenOficial: async () => null,
  prepararPanel: async () => {},
  video: () => elVideo,
  // En pantalla completa los controles van encima del video: los subtítulos se quedan por encima de ellos.
  recorteInferior: () => (elContenedor && document.fullscreenElement === elContenedor ? (elContenedor.querySelector<HTMLElement>('.ap-rep-controles')?.offsetHeight ?? 0) : 0),
};

/** El archivo de una fuente: el que llegó, o el que da su acceso (pidiendo permiso si hace falta, que necesita un clic). */
async function leerFuente(f: Fuente): Promise<File> {
  if (f.archivo) return f.archivo;
  if (f.asa) {
    if (!(await permitido(f.asa))) throw new Error(tr('Kotonoha no tiene permiso para abrir {0}.', f.nombre));
    return f.asa.getFile();
  }
  throw new Error(tr('Esta pista ya no está disponible'));
}

/** Unos subtítulos en la lengua que se estudia, o sin idioma en el nombre, son los principales; los demás, la traducción. */
function destinoDe(nombre: string): 'objetivo' | 'secundaria' {
  const { idioma } = partesDeSubtitulo(nombre);
  return !idioma || idioma === ajustes.value.idiomaObjetivo ? 'objetivo' : 'secundaria';
}

const esMedio = (f: Fuente) => tipoDeArchivo(f.nombre) === 'video' || tipoDeArchivo(f.nombre) === 'audio';
const carpetaDe = (ruta: string) => (ruta.includes('/') ? ruta.slice(0, ruta.lastIndexOf('/')) : '');

/**
 * Los elementos nuevos de la lista a partir de lo que llega: los videos y audios en el orden de sus nombres, cada uno con
 * los subtítulos de su misma carpeta que le corresponden. Lo que no casa con ninguno se devuelve aparte.
 */
function elementosDe(fuentes: Fuente[]): { nuevos: Elemento[]; sueltos: Fuente[] } {
  const grupos = new Map<string, Fuente[]>();
  for (const f of fuentes) grupos.set(carpetaDe(f.ruta), [...(grupos.get(carpetaDe(f.ruta)) ?? []), f]);
  const nuevos: Elemento[] = [];
  const sueltos: Fuente[] = [];
  for (const g of grupos.values()) {
    const medios = enOrden(g.filter(esMedio));
    const r = emparejar(medios, g.filter((f) => tipoDeArchivo(f.nombre) === 'subtitulos'));
    for (const m of medios) nuevos.push({ ...m, id: ++contadorElementos, tipo: tipoDeArchivo(m.nombre) === 'audio' ? 'audio' : 'video', subtitulos: r.porMedio.get(m) ?? [] });
    sueltos.push(...r.sueltos);
  }
  nuevos.sort((a, b) => porNombre(a.ruta, b.ruta));
  return { nuevos, sueltos };
}

const fuenteDeArchivo = (f: File): Fuente => ({ nombre: f.name, ruta: f.webkitRelativePath || f.name, archivo: f });
const fuenteDeAsa = (asa: FileSystemFileHandle, ruta = asa.name): Fuente => ({ nombre: asa.name, ruta, asa });

export function ReproductorLocal({ a }: { a: Ajustes }) {
  const video = useRef<HTMLVideoElement>(null);
  const contenedor = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const entradaCarpeta = useRef<HTMLInputElement>(null);
  const [lista, fijarLista] = useState<Elemento[]>([]);
  const [actual, fijarActual] = useState(-1);
  const [error, fijarError] = useState('');
  const [arrastrando, fijarArrastrando] = useState(false);
  const [datosMedio, fijarDatosMedio] = useState<InformeMedio | null>(null);
  const [audioElegido, fijarAudioElegido] = useState(0);
  const [extrayendoAudio, fijarExtrayendoAudio] = useState<number | null>(null);
  const [listaAbierta, fijarListaAbierta] = useState(false);
  const [pantallaCompleta, fijarPantallaCompleta] = useState(false);
  const [activo, fijarActivo] = useState(true);
  const [menuAbierto, fijarMenuAbierto] = useState(false);
  const [vistos, fijarVistos] = useState<Visto[]>([]);
  const quitarAudio = useRef<(() => void) | null>(null);
  const listaRef = useRef<Elemento[]>([]);
  const actualRef = useRef(-1);
  /** Lo que suena ahora, para guardar dónde se deja. */
  const enCurso = useRef<{ clave: string; nombre: string; tamano: number; tipo: 'video' | 'audio'; asa?: FileSystemFileHandle; conMiniatura: boolean } | null>(null);
  listaRef.current = lista;
  actualRef.current = actual;

  useEffect(() => {
    ajustes.value = a;
  }, [a]);

  const refrescarVistos = () =>
    recientes(300)
      .then(fijarVistos)
      .catch(() => {});
  const vistosPorNombre = useMemo(() => {
    const m = new Map<string, Visto>();
    // Del más reciente al más antiguo: con dos archivos del mismo nombre, cuenta el último que se vio.
    for (const v of vistos) if (!m.has(v.nombre)) m.set(v.nombre, v);
    return m;
  }, [vistos]);

  // Con otra lengua el video sigue abierto y donde estaba: se vuelven a elegir las pistas, como en cualquier sitio de video.
  const lenguaVista = useRef(a.idiomaObjetivo);
  useEffect(() => {
    if (lenguaVista.current === a.idiomaObjetivo) return;
    lenguaVista.current = a.idiomaObjetivo;
    if (archivoActual && elVideo?.src) cargarVideoActual().catch(console.error);
  }, [a.idiomaObjetivo]);

  /** El navegador no deja elegir la pista de audio: la elegida suena aparte, sincronizada con el video. */
  const cambiarAudio = async (indice: number, medio = datosMedio) => {
    const v = video.current;
    const f = archivoActual;
    const pista = medio?.audio.find((p) => p.indice === indice);
    if (!v || !f || !pista || !medio) return;
    quitarAudio.current?.();
    quitarAudio.current = null;
    fijarAudioElegido(indice);
    indiceAudio = indice;
    const nativa = medio.audio.find((p) => p.predeterminada) ?? medio.audio[0];
    if (pista.indice === nativa.indice) return;
    fijarExtrayendoAudio(0);
    try {
      const url = await extraerPistaAudio(f, pista, fijarExtrayendoAudio);
      // Pudo cambiarse de archivo mientras se extraía.
      if (archivoActual === f) quitarAudio.current = sincronizarAudio(v, url);
      else URL.revokeObjectURL(url);
    } catch (e) {
      fijarError(e instanceof Error ? e.message : String(e));
    } finally {
      fijarExtrayendoAudio(null);
    }
  };

  /** Dónde se deja lo que suena: cada pocos segundos, al pausar, al cambiar de archivo y al salir. */
  const guardarAhora = async (terminado = false) => {
    const c = enCurso.current;
    // Al salir de la pantalla, la referencia puede haberse soltado ya: queda la del módulo.
    const v = video.current ?? elVideo;
    if (!c || !v || !Number.isFinite(v.duration) || v.duration <= 0) return;
    const fin = terminado || haTerminado(v.currentTime, v.duration);
    let miniatura: string | null = null;
    if (!c.conMiniatura && c.tipo === 'video' && v.currentTime > 2) {
      miniatura = miniaturaDe(v);
      if (miniatura) c.conMiniatura = true;
    }
    await guardarVisto({
      clave: c.clave,
      nombre: c.nombre,
      tamano: c.tamano,
      tipo: c.tipo,
      duracion: v.duration,
      posicion: fin ? v.duration : v.currentTime,
      terminado: fin,
      ...(miniatura ? { miniatura } : {}),
      ...(c.asa ? { asa: c.asa } : {}),
    }).catch(() => {});
    refrescarVistos();
  };

  /** La lista, para seguir con ella otro día: solo si se puede volver a abrir cada archivo sin buscarlo. */
  const recordarLista = (l: Elemento[], i: number) => {
    if (!l.length || l.some((e) => !e.asa || e.subtitulos.some((s) => !s.asa))) return;
    guardarLista({
      elementos: l.map((e) => ({ nombre: e.nombre, asa: e.asa!, subtitulos: e.subtitulos.map((s) => s.asa!) })),
      actual: i,
      actualizado: Date.now(),
    }).catch(() => {});
  };

  useEffect(() => {
    alInforme = (i) => {
      fijarDatosMedio(i);
      const nativa = i?.audio.find((p) => p.predeterminada) ?? i?.audio[0];
      indiceAudio = nativa?.indice;
      fijarAudioElegido(nativa?.indice ?? 0);
      // Si el archivo trae doblaje por defecto y también la lengua que se estudia, se empieza por ella.
      const original = i?.audio.find((p) => p.idioma === ajustes.value.idiomaObjetivo);
      if (i && original && nativa && original.indice !== nativa.indice) cambiarAudio(original.indice, i);
    };
    fijarFuenteArchivo(async (alProgreso) => {
      if (!archivoActual) throw new Error(tr('No hay ningún archivo abierto'));
      const pista = informe?.audio.find((p) => p.indice === indiceAudio);
      return { url: await extraerAudioParaWhisper(archivoActual, pista, alProgreso), pcmCrudo: true };
    });
    podarVistos().catch(() => {});
    refrescarVistos();
    const alOcultar = () => {
      if (document.visibilityState === 'hidden') guardarAhora();
    };
    document.addEventListener('visibilitychange', alOcultar);
    window.addEventListener('pagehide', alOcultar);
    return () => {
      guardarAhora();
      alInforme = () => {};
      document.removeEventListener('visibilitychange', alOcultar);
      window.removeEventListener('pagehide', alOcultar);
      // Al salir del reproductor, el video deja de estar abierto: lo que siguiera transcribiéndose no tendría dónde ir.
      cortarWhisper();
      fijarFuenteArchivo(null);
      quitarAudio.current?.();
      quitarAudio.current = null;
      if (document.fullscreenElement === contenedor.current) document.exitFullscreen().catch(() => {});
    };
  }, []);

  useEffect(() => {
    elVideo = video.current;
    elContenedor = contenedor.current;
    const v = video.current;
    if (v) {
      v.volume = Math.min(1, Math.max(0, recordado(CLAVES_RECORDADAS.VOLUMEN, 1)));
      const velocidad = recordado(CLAVES_RECORDADAS.VELOCIDAD, 1);
      v.defaultPlaybackRate = velocidad;
      v.playbackRate = velocidad;
    }
    if (!iniciado) {
      iniciado = true;
      iniciarControlador(control);
      iniciarTarjetas(control);
      instalarAtajos();
    }
    return () => {
      elVideo = null;
      elContenedor = null;
    };
  }, []);

  // Cada pocos segundos, mientras suena, se guarda dónde va.
  useEffect(() => {
    const t = setInterval(() => {
      if (video.current && !video.current.paused) guardarAhora();
    }, 5000);
    return () => clearInterval(t);
  }, []);

  const abrir = async (i: number, l = listaRef.current, desdeElPrincipio = false) => {
    const e = l[i];
    const v = video.current;
    if (!e || !v) return;
    let archivo: File;
    const subs: File[] = [];
    try {
      archivo = await leerFuente(e);
      for (const s of e.subtitulos) subs.push(await leerFuente(s));
    } catch (err) {
      fijarError(err instanceof Error ? err.message : String(err));
      return;
    }
    await guardarAhora();
    fijarError('');
    quitarAudio.current?.();
    quitarAudio.current = null;
    fijarDatosMedio(null);
    if (v.src) URL.revokeObjectURL(v.src);
    // La velocidad elegida se mantiene: cambiar la fuente vuelve a defaultPlaybackRate, que la guarda.
    v.src = URL.createObjectURL(archivo);
    const turno = ++turnoApertura;
    // Mientras se importan sus subtítulos, el video ya se puede mover: si alguien lo lleva a otro momento o lo pone en
    // marcha, eso manda, y al empezar no se salta a donde se dejó ni se toca la pausa.
    let movido = false;
    const alMover = () => (movido = true);
    v.addEventListener('seeking', alMover);
    v.addEventListener('play', alMover);
    archivoActual = archivo;
    nombreVideo = archivo.name;
    const clave = claveArchivo(archivo.name, archivo.size);
    enCurso.current = { clave, nombre: archivo.name, tamano: archivo.size, tipo: e.tipo, asa: e.asa, conMiniatura: false };
    fijarActual(i);
    actualRef.current = i;
    await cargarVideoActual();
    infoVideo.value = { sitio: 'local', idVideo: archivo.name, titulo: sinExtension(archivo.name), ...(esCancionPorArchivo(archivo.name) ? { categoria: 'Music' } : {}) };
    // Primero los de la lengua que se estudia, luego la traducción.
    for (const s of [...subs].sort((x, y) => (destinoDe(x.name) === 'objetivo' ? 0 : 1) - (destinoDe(y.name) === 'objetivo' ? 0 : 1))) await importarArchivo(s, destinoDe(s.name));
    const previo = await leerVisto(clave).catch(() => undefined);
    const empezar = () => {
      v.removeEventListener('seeking', alMover);
      v.removeEventListener('play', alMover);
      if (turno !== turnoApertura || movido) return;
      const punto = !desdeElPrincipio && previo && !previo.terminado ? puntoDeReanudar(previo.posicion, v.duration || previo.duracion) : null;
      if (punto !== null) {
        v.currentTime = punto;
        avisar(tr('Sigues donde lo dejaste: {0}', reloj(punto)), undefined, { texto: tr('Desde el principio'), fn: () => (v.currentTime = 0) }, 7000);
      }
      v.play().catch(() => {});
    };
    if (v.readyState >= 1) empezar();
    else v.addEventListener('loadedmetadata', empezar, { once: true });
    await guardarVisto({ clave, nombre: archivo.name, tamano: archivo.size, tipo: e.tipo, ...(e.asa ? { asa: e.asa } : {}) }).catch(() => {});
    refrescarVistos();
    recordarLista(l, i);
  };

  /** Añade a la lista lo que llega. Si no sonaba nada, empieza por el primero sin terminar. */
  const anadir = async (fuentes: Fuente[], reemplazar = false) => {
    const { nuevos, sueltos } = elementosDe(fuentes);
    const previa = reemplazar ? [] : listaRef.current;
    const i = reemplazar ? -1 : actualRef.current;
    // Lo que no casó con nada nuevo, con lo que ya estaba en la lista; y sin videos nuevos, con lo que suena.
    const casados = emparejar(previa, sueltos);
    const extra = new Map([...casados.porMedio].map(([el, s]) => [el.id, s]));
    if (!nuevos.length && casados.sueltos.length) {
      if (i >= 0) extra.set(previa[i].id, [...(extra.get(previa[i].id) ?? []), ...casados.sueltos]);
      else fijarError(tr('Elige primero el video: los subtítulos se añadirán a él.'));
    }
    const enriquecida = previa.map((el) => (extra.has(el.id) ? { ...el, subtitulos: [...el.subtitulos, ...extra.get(el.id)!] } : el));
    // Los de lo que suena se cargan ya, sin esperar a volver a abrirlo.
    if (i >= 0) {
      for (const s of extra.get(previa[i].id) ?? []) {
        try {
          const f = await leerFuente(s);
          await importarArchivo(f, destinoDe(f.name));
        } catch (err) {
          fijarError(err instanceof Error ? err.message : String(err));
        }
      }
    }
    const nueva = [...enriquecida, ...nuevos];
    if (!nueva.length) return;
    fijarLista(nueva);
    listaRef.current = nueva;
    if (nuevos.length > 1) fijarListaAbierta(true);
    if (nuevos.length && i < 0) {
      // Una temporada a medias sigue por el primero sin terminar.
      const primero = nueva.findIndex((el) => !vistosPorNombre.get(el.nombre)?.terminado);
      await abrir(primero >= 0 ? primero : 0, nueva);
    } else recordarLista(nueva, actualRef.current);
  };

  const elegir = async () => {
    if (!haySelectorArchivos()) return entrada.current?.click();
    try {
      const asas = await elegirArchivos(tr('Videos, audios y subtítulos'));
      if (asas.length) await anadir(asas.map((h) => fuenteDeAsa(h)));
    } catch {
      entrada.current?.click();
    }
  };

  const elegirUnaCarpeta = async () => {
    if (!haySelectorCarpetas()) return entradaCarpeta.current?.click();
    try {
      const dir = await elegirCarpeta();
      if (!dir) return;
      const archivos = await archivosDeCarpeta(dir);
      if (!archivos.some(esMedio)) {
        fijarError(tr('En {0} no hay videos ni audios.', dir.name));
        return;
      }
      await anadir(archivos.map((x) => fuenteDeAsa(x.asa, x.ruta)), true);
    } catch (err) {
      fijarError(err instanceof Error ? err.message : String(err));
    }
  };

  /** Lo último que se vio: con su lista si era parte de ella, para seguir con los siguientes. */
  const abrirVisto = async (v: Visto) => {
    if (!v.asa) {
      avisar(tr('Elige otra vez {0}: seguirá donde lo dejaste.', v.nombre), undefined, undefined, 6000);
      return elegir();
    }
    const guardada = await leerLista().catch(() => undefined);
    const i = guardada?.elementos.findIndex((e) => e.nombre === v.nombre) ?? -1;
    if (guardada && i >= 0) {
      const nueva: Elemento[] = guardada.elementos.map((e) => ({
        ...fuenteDeAsa(e.asa),
        id: ++contadorElementos,
        tipo: tipoDeArchivo(e.nombre) === 'audio' ? 'audio' : 'video',
        subtitulos: e.subtitulos.map((s) => fuenteDeAsa(s)),
      }));
      fijarLista(nueva);
      listaRef.current = nueva;
      fijarListaAbierta(nueva.length > 1);
      return abrir(i, nueva);
    }
    const uno: Elemento[] = [{ ...fuenteDeAsa(v.asa), id: ++contadorElementos, tipo: v.tipo, subtitulos: [] }];
    fijarLista(uno);
    listaRef.current = uno;
    return abrir(0, uno);
  };

  const quitar = async (i: number) => {
    const nueva = lista.filter((_, j) => j !== i);
    if (!nueva.length) return vaciar();
    fijarLista(nueva);
    listaRef.current = nueva;
    if (i === actual) await abrir(Math.min(i, nueva.length - 1), nueva);
    else {
      const nuevoActual = i < actual ? actual - 1 : actual;
      fijarActual(nuevoActual);
      actualRef.current = nuevoActual;
      recordarLista(nueva, nuevoActual);
    }
  };

  const vaciar = async () => {
    await guardarAhora();
    const v = video.current;
    quitarAudio.current?.();
    quitarAudio.current = null;
    if (v) {
      v.pause();
      if (v.src) URL.revokeObjectURL(v.src);
      v.removeAttribute('src');
      v.load();
    }
    cortarWhisper();
    archivoActual = null;
    nombreVideo = '';
    enCurso.current = null;
    infoVideo.value = null;
    fijarLista([]);
    listaRef.current = [];
    fijarActual(-1);
    actualRef.current = -1;
    fijarListaAbierta(false);
    fijarDatosMedio(null);
    if (document.fullscreenElement === contenedor.current) document.exitFullscreen().catch(() => {});
  };

  const alternarPantalla = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else contenedor.current?.requestFullscreen().catch(() => {});
  };

  useEffect(() => {
    const cambio = () => fijarPantallaCompleta(!!contenedor.current && document.fullscreenElement === contenedor.current);
    document.addEventListener('fullscreenchange', cambio);
    return () => document.removeEventListener('fullscreenchange', cambio);
  }, []);

  // En pantalla completa, los controles y el puntero se van si no se mueve el ratón.
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moverse = () => {
    fijarActivo(true);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => fijarActivo(false), 2600);
  };
  useEffect(() => () => {
    if (temporizador.current) clearTimeout(temporizador.current);
  }, []);

  // El navegador de subtítulos y la lista van a la derecha: uno u otro.
  useEffect(() => {
    if (a.navegadorAbierto) fijarListaAbierta(false);
  }, [a.navegadorAbierto]);
  const alternarLista = () => {
    if (!listaAbierta && ajustes.value.navegadorAbierto) cambiarAjuste({ navegadorAbierto: false });
    fijarListaAbierta(!listaAbierta);
  };

  // Teclas del reproductor. La capa de Kotonoha atiende antes las suyas (A, D, las flechas con subtítulos…), y las que
  // deja pasar llegan aquí: Espacio, F, M, < y >, y las flechas si no hay subtítulos.
  useEffect(() => {
    const alTeclado = (e: KeyboardEvent) => {
      const v = video.current;
      if (!v?.src || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const o = e.composedPath()[0] as HTMLElement | undefined;
      const rango = o?.tagName === 'INPUT' && (o as HTMLInputElement).type === 'range';
      if (o && (o.isContentEditable || o.tagName === 'TEXTAREA' || o.tagName === 'SELECT' || (o.tagName === 'INPUT' && !rango))) return;
      if (o?.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;
      switch (e.key) {
        case ' ':
          if (v.paused) v.play().catch(() => {});
          else v.pause();
          break;
        case 'f':
        case 'F':
          alternarPantalla();
          break;
        case 'm':
        case 'M':
          alternarSonido(v);
          break;
        case '<':
        case '>':
          fijarVelocidadVideo(v, velocidadVecina(v.playbackRate, e.key === '>' ? 1 : -1));
          avisar(tr('Velocidad: {0}', textoVelocidad(v.playbackRate)), undefined, undefined, 1200);
          break;
        case 'ArrowLeft':
        case 'ArrowRight':
          // Con subtítulos, las flechas van de línea en línea (la capa ya las atendió); sin ellos, saltan 5 s.
          if (rango || lineasObjetivo.value.length) return;
          v.currentTime = Math.max(0, v.currentTime + (e.key === 'ArrowRight' ? 5 : -5));
          break;
        default:
          return;
      }
      e.preventDefault();
      moverse();
    };
    window.addEventListener('keydown', alTeclado);
    return () => window.removeEventListener('keydown', alTeclado);
  }, []);

  const alSoltar = (e: DragEvent) => {
    e.preventDefault();
    fijarArrastrando(false);
    const dt = e.dataTransfer;
    if (!dt) return;
    const archivos = [...dt.files];
    // Con el acceso a cada archivo (y a las carpetas soltadas) se pueden volver a abrir otro día. Hay que pedirlo ya:
    // al terminar el evento, el navegador deja de darlo.
    const items = [...dt.items].filter((it) => it.kind === 'file');
    const conAsa = items.length > 0 && 'getAsFileSystemHandle' in DataTransferItem.prototype;
    if (!conAsa) return void anadir(archivos.map(fuenteDeArchivo));
    const promesas = items.map((it) => (it as DataTransferItem & { getAsFileSystemHandle(): Promise<FileSystemHandle | null> }).getAsFileSystemHandle());
    Promise.all(promesas)
      .then(async (asas) => {
        const validas = asas.filter((h): h is FileSystemHandle => !!h);
        if (!validas.length) return anadir(archivos.map(fuenteDeArchivo));
        const fuentes: Fuente[] = [];
        let carpeta = false;
        for (const h of validas) {
          if (h.kind === 'file') fuentes.push(fuenteDeAsa(h as FileSystemFileHandle));
          else {
            carpeta = true;
            fuentes.push(...(await archivosDeCarpeta(h as FileSystemDirectoryHandle, `${h.name}/`)).map((x) => fuenteDeAsa(x.asa, x.ruta)));
          }
        }
        return anadir(fuentes, carpeta && listaRef.current.length === 0);
      })
      .catch(() => anadir(archivos.map(fuenteDeArchivo)));
  };

  const hayVideo = actual >= 0;
  const elemento = hayVideo ? lista[actual] : null;
  const esAudio = elemento?.tipo === 'audio';
  const controlesVisibles = !pantallaCompleta || activo || menuAbierto;

  // Los subtítulos y las fichas, con la letra elegida para la lengua, como sobre el video en cualquier sitio.
  const { letra, aire } = letraElegida(lengua.value, a.diccionarioLetra);
  return (
    <div
      ref={contenedor}
      class={`ap-local ${hayVideo ? 'con-video' : ''} ${listaAbierta && hayVideo ? 'con-lista' : ''} ${a.navegadorAbierto && hayVideo ? 'con-nav' : ''} ${pantallaCompleta ? 'pantalla' : ''} ${controlesVisibles ? '' : 'inactivo'}`}
      style={{ '--letra-lengua': letra, '--aire-lectura': aire }}
      onMouseMove={moverse}
      onDragOver={(e) => {
        e.preventDefault();
        fijarArrastrando(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) fijarArrastrando(false);
      }}
      onDrop={alSoltar}
    >
      <div class="ap-rep-escena" style={{ display: hayVideo ? undefined : 'none' }}>
        <video
          ref={video}
          onClick={() => {
            const v = video.current;
            if (v) v.paused ? v.play().catch(() => {}) : v.pause();
          }}
          onDblClick={alternarPantalla}
          onError={() => fijarError(tr('El navegador no puede reproducir este archivo. Prueba con MP4 o WebM.'))}
          onPause={() => guardarAhora()}
          onEnded={() => {
            guardarAhora(true);
            if (actualRef.current + 1 < listaRef.current.length) abrir(actualRef.current + 1);
          }}
        />
        {esAudio && elemento && (
          <div class="ap-rep-portada">
            <span class="hoja-icono ap-rep-portada-icono" aria-hidden="true"><Icono n="ondas" t={44} /></span>
            <b>{sinExtension(elemento.nombre)}</b>
            {carpetaDe(elemento.ruta) && <small>{carpetaDe(elemento.ruta)}</small>}
            {/* Un podcast o un audiolibro rara vez traen subtítulos: Whisper los escribe en el equipo. */}
            {!lineasObjetivo.value.length && (
              <button class="btn chico" onClick={() => (panel.value = 'generar')}><Icono n="varita" t={15} /> {tr('Generar los subtítulos')}</button>
            )}
          </div>
        )}
      </div>
      {hayVideo && video.current && (
        <ControlesReproductor
          video={video.current}
          titulo={elemento ? sinExtension(elemento.nombre) : ''}
          visible={controlesVisibles}
          pantallaCompleta={pantallaCompleta}
          alPantallaCompleta={alternarPantalla}
          anterior={lista.length > 1 && actual > 0 ? () => abrir(actual - 1) : undefined}
          siguiente={lista.length > 1 && actual + 1 < lista.length ? () => abrir(actual + 1) : undefined}
          listaAbierta={listaAbierta}
          alLista={alternarLista}
          alMenu={fijarMenuAbierto}
          audio={
            datosMedio && datosMedio.audio.length > 1 ? (
              <div class="ap-local-audio" data-tip-lado="arriba" data-tip={tr('Pista de audio')}>
                <Icono n="altavoz" t={15} />
                <select class="selector" aria-label={tr('Pista de audio')} value={audioElegido} disabled={extrayendoAudio !== null} onChange={(e) => cambiarAudio(Number(e.currentTarget.value))}>
                  {datosMedio.audio.map((p) => (
                    <option key={p.indice} value={p.indice}>{p.titulo || nombreIdioma(p.idioma)}{p.titulo && p.idioma !== 'und' ? ` (${nombreIdioma(p.idioma)})` : ''}</option>
                  ))}
                </select>
                {extrayendoAudio !== null && <span class="ayuda num">{extrayendoAudio} %</span>}
              </div>
            ) : undefined
          }
        />
      )}
      {hayVideo && listaAbierta && (
        <PanelLista
          lista={lista}
          actual={actual}
          vistosPorNombre={vistosPorNombre}
          alAbrir={(i) => abrir(i)}
          alQuitar={quitar}
          alVaciar={vaciar}
          alAnadir={elegir}
          alCarpeta={elegirUnaCarpeta}
          alCerrar={() => fijarListaAbierta(false)}
        />
      )}
      {!hayVideo && (
        <div class="ap-local-inicio">
          <div class={`ap-local-vacio ${arrastrando ? 'activo' : ''}`}>
            <span class="hoja-icono ap-local-icono"><Icono n="pelicula" t={32} /></span>
            <h1>{tr('Tus videos, con todo Kotonoha')}</h1>
            <p>{tr(lengua.value.textos.localArrastrar)}</p>
            <div class="ap-local-botones">
              <button class="btn primario grande" onClick={elegir}><Icono n="subir" t={18} /> {tr('Elegir archivos')}</button>
              <button class="btn grande" onClick={elegirUnaCarpeta}><Icono n="carpeta" t={18} /> {tr('Abrir una carpeta')}</button>
            </div>
            <div class="ap-local-formatos">
              <span class="ap-formatos"><b>{tr('Video')}</b>{['MP4', 'WebM', 'MKV', 'MOV'].map((f) => <i key={f}>{f}</i>)}</span>
              <span class="ap-formatos"><b>{tr('Audio')}</b>{['MP3', 'M4A', 'OGG', 'WAV', 'FLAC'].map((f) => <i key={f}>{f}</i>)}</span>
              <span class="ap-formatos"><b>{tr('Subtítulos')}</b>{['SRT', 'VTT', 'ASS', 'TTML'].map((f) => <i key={f}>{f}</i>)}</span>
            </div>
          </div>
          <Recientes
            vistos={vistos.slice(0, 8)}
            alAbrir={abrirVisto}
            alOlvidar={(v) => {
              olvidarVisto(v.clave)
                .then(refrescarVistos)
                .catch(() => {});
            }}
          />
        </div>
      )}
      {hayVideo && arrastrando && <div class="ap-local-soltar"><Icono n="subir" t={28} /> {tr('Suelta para añadir')}</div>}
      <input ref={entrada} type="file" multiple hidden aria-label={tr('Elegir archivos')} accept={ACEPTADOS.join(',')} onChange={(e) => {
        anadir([...(e.currentTarget.files ?? [])].map(fuenteDeArchivo));
        e.currentTarget.value = '';
      }} />
      {/* Sin el selector de carpetas del sistema: con webkitdirectory, cada archivo trae su ruta dentro de la elegida. */}
      <input ref={entradaCarpeta} type="file" multiple hidden aria-label={tr('Abrir una carpeta')} {...({ webkitdirectory: true } as Record<string, unknown>)} onChange={(e) => {
        anadir([...(e.currentTarget.files ?? [])].filter((f) => tipoDeArchivo(f.name)).map(fuenteDeArchivo), true);
        e.currentTarget.value = '';
      }} />
      {error && (
        <div class="ap-local-error">
          <Mensaje error>{error}</Mensaje>
        </div>
      )}
      {hayVideo && <Reproductor />}
    </div>
  );
}
