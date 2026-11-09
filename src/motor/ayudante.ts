// Conversación con el ayudante local, que descarga el audio de un video con yt-dlp. Así Whisper puede
// procesar un video de YouTube entero sin esperar a que se reproduzca. Todo queda en tu equipo.
//
// El documento offscreen no puede hablar con programas nativos: el service worker hace de puente.
// Si el equipo tiene FFmpeg, el ayudante entrega ya las muestras de Whisper y se leen por partes según hacen
// falta. Si no, entrega el archivo descargado tal cual, y aquí se convierte con el FFmpeg de la extensión.

import { PUERTO_AYUDANTE } from '../compartido/api';
import type { InfoAyudante } from '../compartido/api';
import { audioParaWhisper, liberarFfmpeg } from '../compartido/ffmpeg';
import type { FuenteMuestras } from './whisper';
import { tr } from '../compartido/i18n';

type MensajeAyudante =
  | ({ tipo: 'hola' } & InfoAyudante)
  | { tipo: 'descarga'; porcentaje: number }
  | { tipo: 'convirtiendo' }
  | { tipo: 'listo'; muestras: number }
  | { tipo: 'listo'; bytes: number; formato: string }
  | { tipo: 'pcm'; id: number; datos: string; fin: boolean }
  | { tipo: 'error'; mensaje: string }
  | { tipo: 'desconectado'; mensaje: string };

/** PowerShell, o Python en el ayudante de antes, tarda un momento en arrancar, sobre todo la primera vez. */
const LIMITE_SALUDO_MS = 8000;
/** Sin FFmpeg, el archivo descargado se pide en trozos de este tamaño: cada uno llega en mensajes de 192 KB. */
const BYTES_POR_LECTURA = 8 * 1024 * 1024;
/** Los formatos que deja yt-dlp con «-f ba/b»: lo demás no se manda a ffmpeg.wasm por su nombre. */
const FORMATO_VALIDO = /^[a-z0-9]{1,8}$/;

/** Devuelve la versión instalada, o null si el ayudante no está instalado. */
export function consultarAyudante(): Promise<InfoAyudante | null> {
  return new Promise((ok) => {
    const puerto = chrome.runtime.connect({ name: PUERTO_AYUDANTE });
    const terminar = (r: InfoAyudante | null) => {
      clearTimeout(limite);
      puerto.disconnect();
      ok(r);
    };
    const limite = setTimeout(() => terminar(null), LIMITE_SALUDO_MS);
    puerto.onMessage.addListener((m: MensajeAyudante) => {
      if (m.tipo === 'hola') terminar({ version: m.version, ytdlp: m.ytdlp, ffmpeg: m.ffmpeg, js: m.js ?? null, actualizar: !!m.actualizar });
      else if (m.tipo === 'desconectado' || m.tipo === 'error') terminar(null);
    });
    puerto.onDisconnect.addListener(() => {
      void chrome.runtime.lastError;
      clearTimeout(limite);
      ok(null);
    });
    puerto.postMessage({ accion: 'hola' });
  });
}

export interface AudioDescargado extends FuenteMuestras {
  cerrar(): void;
}

function base64ABytes(texto: string): Uint8Array<ArrayBuffer> {
  const binario = atob(texto);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

function unir(partes: Uint8Array<ArrayBuffer>[]): Uint8Array<ArrayBuffer> {
  const total = partes.reduce((n, p) => n + p.length, 0);
  const unido = new Uint8Array(total);
  let p = 0;
  for (const parte of partes) {
    unido.set(parte, p);
    p += parte.length;
  }
  return unido;
}

/**
 * Pide la descarga y, cuando el audio está listo, permite leerlo por partes como un archivo. Sin FFmpeg en el
 * equipo, primero se trae el archivo entero y se convierte aquí, con el avance en `alExtraer`.
 */
export function abrirDescarga(url: string, alAvance: (porcentaje: number) => void, senal: AbortSignal, alExtraer: (porcentaje: number) => void = () => {}): Promise<AudioDescargado> {
  return new Promise((ok, mal) => {
    const puerto = chrome.runtime.connect({ name: PUERTO_AYUDANTE });
    let contador = 0;
    let abierto = true;
    let convirtiendo = false;
    const lecturas = new Map<number, { partes: Uint8Array<ArrayBuffer>[]; ok: (d: Uint8Array<ArrayBuffer>) => void; mal: (e: Error) => void }>();

    const fallar = (e: Error) => {
      abierto = false;
      for (const l of lecturas.values()) l.mal(e);
      lecturas.clear();
      mal(e);
    };
    const cerrar = () => {
      if (!abierto) return;
      abierto = false;
      senal.removeEventListener('abort', alAbortar);
      puerto.disconnect();
    };
    const alAbortar = () => {
      cerrar();
      // Una película a medio convertir sigue ocupando cientos de MB: se corta ya.
      if (convirtiendo) liberarFfmpeg();
      fallar(new Error(tr('Cancelado')));
    };
    senal.addEventListener('abort', alAbortar);

    /** `desde` y `cuantas` van en muestras si el ayudante convirtió el audio, y en bytes si mandó el archivo. */
    const pedir = (desde: number, cuantas: number) =>
      new Promise<Uint8Array<ArrayBuffer>>((okLectura, malLectura) => {
        if (!abierto) return malLectura(new Error(tr('Se perdió la conexión con el ayudante')));
        const id = ++contador;
        lecturas.set(id, { partes: [], ok: okLectura, mal: malLectura });
        puerto.postMessage({ accion: 'leer', id, desde, cuantas });
      });

    const convertirArchivo = async (bytes: number, formato: string) => {
      const partes: Blob[] = [];
      for (let desde = 0; desde < bytes; desde += BYTES_POR_LECTURA) partes.push(new Blob([await pedir(desde, Math.min(BYTES_POR_LECTURA, bytes - desde))]));
      // El ayudante ya no hace falta: así borra su carpeta temporal mientras se convierte.
      cerrar();
      const extension = FORMATO_VALIDO.test(formato) ? formato : 'audio';
      convirtiendo = true;
      try {
        return await audioParaWhisper(new File(partes, `descarga.${extension}`), 0, alExtraer);
      } finally {
        convirtiendo = false;
      }
    };

    puerto.onMessage.addListener((m: MensajeAyudante) => {
      if (m.tipo === 'descarga') alAvance(m.porcentaje);
      else if (m.tipo === 'listo' && 'bytes' in m) {
        alAvance(100);
        alExtraer(0);
        convertirArchivo(m.bytes, m.formato).then(
          (pcm) =>
            ok({
              muestras: Math.floor(pcm.size / 4),
              cerrar,
              leer: async (desde, cuantas) => new Float32Array(await pcm.slice(desde * 4, (desde + cuantas) * 4).arrayBuffer()),
            }),
          (e: unknown) => {
            cerrar();
            mal(e instanceof Error ? e : new Error(String(e)));
          }
        );
      } else if (m.tipo === 'listo') {
        ok({ muestras: m.muestras, cerrar, leer: async (desde, cuantas) => new Float32Array((await pedir(desde, cuantas)).buffer) });
      } else if (m.tipo === 'pcm') {
        const l = lecturas.get(m.id);
        if (!l) return;
        l.partes.push(base64ABytes(m.datos));
        if (!m.fin) return;
        lecturas.delete(m.id);
        l.ok(unir(l.partes));
      } else if (m.tipo === 'error') {
        cerrar();
        fallar(new Error(m.mensaje));
      } else if (m.tipo === 'desconectado') {
        fallar(new Error(tr('Se perdió la conexión con el ayudante')));
      }
    });
    puerto.onDisconnect.addListener(() => {
      void chrome.runtime.lastError;
      if (abierto) fallar(new Error(tr('Se perdió la conexión con el ayudante')));
    });
    puerto.postMessage({ accion: 'abrir', url });
  });
}
