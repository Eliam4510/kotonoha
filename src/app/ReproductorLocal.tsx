// Reproductor de archivos locales: video propio con subtítulos propios y las mismas herramientas.

import { useEffect, useRef, useState } from 'preact/hooks';
import { cargarVideoActual, fijarFuenteArchivo, iniciarControlador, importarArchivo, nombreIdioma } from '../contenido/controlador';
import { ajustes, infoVideo } from '../contenido/estado';
import type { Control } from '../contenido/puente';
import { Reproductor } from '../contenido/Reproductor';
import { iniciarTarjetas } from '../contenido/tarjetas';
import { instalarAtajos } from '../contenido/atajos';
import { Icono } from '../ui/iconos';
import type { Ajustes } from '../compartido/ajustes';
import { extraerAudioParaWhisper, extraerPistaAudio, extraerSubtitulos, type InformeMedio, inspeccionarArchivo, sincronizarAudio } from './medios';
import { Mensaje } from './Piezas';

const RE_VIDEO = /\.(mp4|webm|mkv|mov|m4v|ogv)$/i;
const RE_SUB = /\.(srt|vtt|ass|ssa|ttml|dfxp|xml)$/i;

let elVideo: HTMLVideoElement | null = null;
let nombreVideo = '';
let iniciado = false;
let archivoActual: File | null = null;
let informe: InformeMedio | null = null;
let alInforme: (i: InformeMedio | null) => void = () => {};
/** Pista de audio elegida: es también la que se transcribe. */
let indiceAudio: number | undefined;

const control: Control = {
  sitio: 'local',
  async info() {
    return { sitio: 'local', activo: !!elVideo?.src, idVideo: nombreVideo || null, titulo: nombreVideo.replace(/\.[^.]+$/, ''), anuncio: false };
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
      .map((s) => ({ id: `incrustada:${s.indice}`, idioma: s.idioma, nombre: s.titulo || `${nombreIdioma(s.idioma)} (incrustados)`, origen: 'sitio' as const }));
  },
  async cargarPista(id) {
    const pista = informe?.subtitulos.find((s) => `incrustada:${s.indice}` === id);
    if (!pista || !archivoActual) throw new Error('Esta pista ya no está disponible');
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
  prepararPanel: async () => {},
  video: () => elVideo,
};

export function ReproductorLocal({ a }: { a: Ajustes }) {
  const video = useRef<HTMLVideoElement>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const [lista, fijarLista] = useState<File[]>([]);
  const [actual, fijarActual] = useState(-1);
  const [error, fijarError] = useState('');
  const [arrastrando, fijarArrastrando] = useState(false);
  const subsPorVideo = useRef(new Map<string, File[]>());
  const [datosMedio, fijarDatosMedio] = useState<InformeMedio | null>(null);
  const [audioElegido, fijarAudioElegido] = useState(0);
  const [extrayendoAudio, fijarExtrayendoAudio] = useState<number | null>(null);
  const quitarAudio = useRef<(() => void) | null>(null);

  useEffect(() => {
    ajustes.value = a;
  }, [a]);

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

  useEffect(() => {
    alInforme = (i) => {
      fijarDatosMedio(i);
      const nativa = i?.audio.find((p) => p.predeterminada) ?? i?.audio[0];
      indiceAudio = nativa?.indice;
      fijarAudioElegido(nativa?.indice ?? 0);
      // Si el archivo trae doblaje por defecto y también japonés, se empieza por el japonés.
      const japones = i?.audio.find((p) => p.idioma === ajustes.value.idiomaObjetivo);
      if (i && japones && nativa && japones.indice !== nativa.indice) cambiarAudio(japones.indice, i);
    };
    fijarFuenteArchivo(async (alProgreso) => {
      if (!archivoActual) throw new Error('No hay ningún archivo abierto');
      const pista = informe?.audio.find((p) => p.indice === indiceAudio);
      return { url: await extraerAudioParaWhisper(archivoActual, pista, alProgreso), pcmCrudo: true };
    });
    return () => {
      alInforme = () => {};
      fijarFuenteArchivo(null);
      quitarAudio.current?.();
      quitarAudio.current = null;
    };
  }, []);

  useEffect(() => {
    elVideo = video.current;
    if (!iniciado) {
      iniciado = true;
      iniciarControlador(control);
      iniciarTarjetas(control);
      instalarAtajos();
    }
    return () => {
      elVideo = null;
    };
  }, []);

  const abrir = async (i: number, archivos = lista) => {
    const f = archivos[i];
    const v = video.current;
    if (!f || !v) return;
    fijarError('');
    quitarAudio.current?.();
    quitarAudio.current = null;
    fijarDatosMedio(null);
    if (v.src) URL.revokeObjectURL(v.src);
    v.src = URL.createObjectURL(f);
    archivoActual = f;
    nombreVideo = f.name;
    fijarActual(i);
    await cargarVideoActual();
    infoVideo.value = { sitio: 'local', idVideo: f.name, titulo: f.name.replace(/\.[^.]+$/, '') };
    for (const s of subsPorVideo.current.get(f.name) ?? []) await importarArchivo(s, 'objetivo');
    v.play().catch(() => {});
  };

  const anadir = async (archivos: File[]) => {
    const videos = archivos.filter((f) => RE_VIDEO.test(f.name));
    const subs = archivos.filter((f) => RE_SUB.test(f.name));
    // Empareja cada subtítulo con el video de nombre más parecido.
    for (const s of subs) {
      const base = s.name.replace(/\.[^.]+$/, '').replace(/\.[a-zA-Z-]{2,5}$/, '');
      const v = [...lista, ...videos].find((x) => x.name.replace(/\.[^.]+$/, '') === base) ?? [...lista, ...videos][actual >= 0 ? actual : 0];
      if (v) subsPorVideo.current.set(v.name, [...(subsPorVideo.current.get(v.name) ?? []), s]);
    }
    if (videos.length) {
      const nueva = [...lista, ...videos];
      fijarLista(nueva);
      if (actual < 0) await abrir(lista.length, nueva);
    } else if (actual >= 0) {
      for (const s of subs) await importarArchivo(s, 'objetivo');
    } else if (subs.length) {
      fijarError('Elige primero el video: los subtítulos se añadirán a él.');
    }
  };

  const hayVideo = actual >= 0;

  return (
    <div
      class={`ap-local ${hayVideo ? 'con-video' : ''}`}
      onDragOver={(e) => { e.preventDefault(); fijarArrastrando(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) fijarArrastrando(false); }}
      onDrop={(e) => {
        e.preventDefault();
        fijarArrastrando(false);
        anadir([...(e.dataTransfer?.files ?? [])]);
      }}
    >
      <video ref={video} controls style={{ display: hayVideo ? 'block' : 'none' }} onError={() => fijarError('El navegador no puede reproducir este archivo. Prueba con MP4 o WebM.')} onEnded={() => {
        if (actual + 1 < lista.length) abrir(actual + 1);
      }} />
      {!hayVideo && (
        <div class={`ap-local-vacio ${arrastrando ? 'activo' : ''}`}>
          <span class="hoja-icono ap-local-icono"><Icono n="pelicula" t={32} /></span>
          <h1>Tus videos, con todo Kotonoha</h1>
          <p>Arrastra aquí un video y sus subtítulos. Tendrás furigana, diccionario, tarjetas y Claude, y el video no sale de tu ordenador.</p>
          <button class="btn primario grande" onClick={() => entrada.current?.click()}><Icono n="subir" t={18} /> Elegir archivos</button>
          <div class="ap-local-formatos">
            <span class="ap-formatos"><b>Video</b>{['MP4', 'WebM', 'MKV', 'MOV'].map((f) => <i key={f}>{f}</i>)}</span>
            <span class="ap-formatos"><b>Subtítulos</b>{['SRT', 'VTT', 'ASS', 'TTML'].map((f) => <i key={f}>{f}</i>)}</span>
          </div>
        </div>
      )}
      {hayVideo && arrastrando && <div class="ap-local-soltar"><Icono n="subir" t={28} /> Suelta para añadir</div>}
      <input ref={entrada} type="file" multiple hidden aria-label="Elegir archivos" accept=".mp4,.webm,.mkv,.mov,.m4v,.ogv,.srt,.vtt,.ass,.ssa,.ttml,.dfxp,.xml" onChange={(e) => {
        anadir([...(e.currentTarget.files ?? [])]);
        e.currentTarget.value = '';
      }} />
      {error && <div class="ap-local-error"><Mensaje error>{error}</Mensaje></div>}
      {lista.length > 1 && (
        <div class="ap-local-lista" role="tablist" aria-label="Lista de reproducción">
          {lista.map((f, i) => (
            <button key={f.name} role="tab" aria-selected={i === actual} class={i === actual ? 'activo' : ''} onClick={() => abrir(i)}>{f.name.replace(/\.[^.]+$/, '').slice(0, 26)}</button>
          ))}
        </div>
      )}
      {hayVideo && datosMedio && datosMedio.audio.length > 1 && (
        <div class="ap-local-audio">
          <Icono n="altavoz" t={15} />
          <select class="selector" aria-label="Pista de audio" value={audioElegido} disabled={extrayendoAudio !== null} onChange={(e) => cambiarAudio(Number(e.currentTarget.value))}>
            {datosMedio.audio.map((p) => (
              <option key={p.indice} value={p.indice}>{p.titulo || nombreIdioma(p.idioma)}{p.titulo && p.idioma !== 'und' ? ` (${nombreIdioma(p.idioma)})` : ''}</option>
            ))}
          </select>
          {extrayendoAudio !== null && <span class="ayuda num">{extrayendoAudio} %</span>}
        </div>
      )}
      {hayVideo && <Reproductor />}
    </div>
  );
}
