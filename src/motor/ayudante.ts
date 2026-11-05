// Conversación con el ayudante local, que descarga el audio de un video con yt-dlp. Así Whisper puede
// procesar un video de YouTube entero sin esperar a que se reproduzca. Todo queda en tu equipo.
//
// El documento offscreen no puede hablar con programas nativos: el service worker hace de puente.

import { PUERTO_AYUDANTE } from '../compartido/api';
import type { InfoAyudante } from '../compartido/api';
import type { FuenteMuestras } from './whisper';

type MensajeAyudante =
  | ({ tipo: 'hola' } & InfoAyudante)
  | { tipo: 'descarga'; porcentaje: number }
  | { tipo: 'convirtiendo' }
  | { tipo: 'listo'; muestras: number }
  | { tipo: 'pcm'; id: number; datos: string; fin: boolean }
  | { tipo: 'error'; mensaje: string }
  | { tipo: 'desconectado'; mensaje: string };

/** Python tarda un momento en arrancar, sobre todo la primera vez. */
const LIMITE_SALUDO_MS = 8000;

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
      if (m.tipo === 'hola') terminar({ version: m.version, ytdlp: m.ytdlp, ffmpeg: m.ffmpeg });
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

function base64ABytes(texto: string): Uint8Array {
  const binario = atob(texto);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

/** Pide la descarga y, cuando el audio está listo, permite leerlo por partes como un archivo. */
export function abrirDescarga(url: string, alAvance: (porcentaje: number) => void, senal: AbortSignal): Promise<AudioDescargado> {
  return new Promise((ok, mal) => {
    const puerto = chrome.runtime.connect({ name: PUERTO_AYUDANTE });
    let contador = 0;
    let abierto = true;
    const lecturas = new Map<number, { partes: Uint8Array[]; ok: (d: Float32Array) => void; mal: (e: Error) => void }>();

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
      fallar(new Error('Cancelado'));
    };
    senal.addEventListener('abort', alAbortar);

    puerto.onMessage.addListener((m: MensajeAyudante) => {
      if (m.tipo === 'descarga') alAvance(m.porcentaje);
      else if (m.tipo === 'listo') {
        ok({
          muestras: m.muestras,
          cerrar,
          leer: (desde, cuantas) =>
            new Promise((okLectura, malLectura) => {
              if (!abierto) return malLectura(new Error('Se perdió la conexión con el ayudante'));
              const id = ++contador;
              lecturas.set(id, { partes: [], ok: okLectura, mal: malLectura });
              puerto.postMessage({ accion: 'leer', id, desde, cuantas });
            }),
        });
      } else if (m.tipo === 'pcm') {
        const l = lecturas.get(m.id);
        if (!l) return;
        l.partes.push(base64ABytes(m.datos));
        if (!m.fin) return;
        lecturas.delete(m.id);
        const total = l.partes.reduce((n, p) => n + p.length, 0);
        const unido = new Uint8Array(total);
        let p = 0;
        for (const parte of l.partes) {
          unido.set(parte, p);
          p += parte.length;
        }
        l.ok(new Float32Array(unido.buffer));
      } else if (m.tipo === 'error') {
        cerrar();
        fallar(new Error(m.mensaje));
      } else if (m.tipo === 'desconectado') {
        fallar(new Error('Se perdió la conexión con el ayudante'));
      }
    });
    puerto.onDisconnect.addListener(() => {
      void chrome.runtime.lastError;
      if (abierto) fallar(new Error('Se perdió la conexión con el ayudante'));
    });
    puerto.postMessage({ accion: 'abrir', url });
  });
}
