// La voz japonesa local en el motor: un programa con la API de VOICEVOX en este equipo (AivisSpeech, VOICEVOX). Kotonoha
// lo busca en sus puertos de siempre, le pide la frase, le corrige el acento con el del diccionario y guarda el audio en
// una caché, porque la misma frase se oye muchas veces. El audio sale en MP3, como el de Azure: sirve igual para leer en
// voz alta, para la práctica y para las tarjetas.

import type { Ajustes } from '../compartido/ajustes';
import type { MotorVozLocal } from '../compartido/api';
import { tr } from '../compartido/i18n';
import { claveDeAudio, type ConsultaVoz, corregirAcentos, MOTORES_CONOCIDOS } from '../nucleo/vozLocal';
import * as analisis from './analisis';
import { aMp3, bytesABase64 } from './grabacion';
import { lengua } from './lengua';

/** Un motor que no contesta en este tiempo no está. */
const ESPERA_MS = 1500;
/** Leer una frase larga puede tardar; más que esto, algo va mal. */
const ESPERA_SINTESIS_MS = 60000;
const CACHE = 'kotonoha-voz-local';
/** Los audios que se guardan; los más viejos se van. */
const MAXIMO_EN_CACHE = 600;

async function pedir(url: string, ruta: string, espera: number, opciones: RequestInit = {}): Promise<Response> {
  const r = await fetch(`${url}${ruta}`, { ...opciones, signal: AbortSignal.timeout(espera) });
  if (!r.ok) throw new Error(tr('La voz local respondió {0}', r.status));
  return r;
}

/** Lo que hay escuchando en una dirección: su nombre, su versión y sus voces; null si nada. */
async function motorEn(url: string, nombre: string): Promise<MotorVozLocal | null> {
  try {
    const version = String(await (await pedir(url, '/version', ESPERA_MS)).json());
    const manifiesto = (await (await pedir(url, '/engine_manifest', ESPERA_MS)).json().catch(() => ({}))) as { name?: string };
    const hablantes = (await (await pedir(url, '/speakers', ESPERA_MS)).json()) as { name: string; styles: { name: string; id: number }[] }[];
    return {
      url,
      nombre: manifiesto.name ?? nombre,
      version,
      voces: hablantes.map((h) => ({ nombre: h.name, estilos: h.styles.map((e) => ({ nombre: e.name, id: e.id })) })),
    };
  } catch {
    return null;
  }
}

/** Los motores que contestan: el de la dirección dada o, sin ella, los de los puertos de AivisSpeech y VOICEVOX. */
export async function buscarMotores(url = ''): Promise<MotorVozLocal[]> {
  const candidatos = url.trim() ? [{ nombre: '', url: url.trim().replace(/\/+$/, '') }] : MOTORES_CONOCIDOS;
  const hallados = await Promise.all(candidatos.map((c) => motorEn(c.url, c.nombre)));
  return hallados.filter((m): m is MotorVozLocal => m !== null);
}

/** Lo que dura sabido qué motor y qué voz se usan: leer un texto entero no pregunta por ellos en cada frase. */
const RECUERDO_MS = 30000;
let recuerdo: { clave: string; hasta: number; valor: { url: string; estilo: number } } | null = null;

/** El motor y el estilo con que leer, según los ajustes. */
async function elegido(a: Ajustes): Promise<{ url: string; estilo: number }> {
  const clave = `${a.vozLocal.url}\u0000${a.vozLocal.estilo}`;
  if (recuerdo && recuerdo.clave === clave && recuerdo.hasta > Date.now()) return recuerdo.valor;
  const valor = await buscarElegido(a);
  recuerdo = { clave, hasta: Date.now() + RECUERDO_MS, valor };
  return valor;
}

async function buscarElegido(a: Ajustes): Promise<{ url: string; estilo: number }> {
  const [motor] = await buscarMotores(a.vozLocal.url);
  if (!motor) throw new Error(tr('No se encuentra la voz local. Abre AivisSpeech o VOICEVOX en este equipo.'));
  const estilos = motor.voces.flatMap((v) => v.estilos.map((e) => e.id));
  const estilo = a.vozLocal.estilo !== null && estilos.includes(a.vozLocal.estilo) ? a.vozLocal.estilo : estilos[0];
  if (estilo === undefined) throw new Error(tr('La voz local no tiene ninguna voz instalada.'));
  return { url: motor.url, estilo };
}

const urlDeCache = (clave: string) => `https://kotonoha.invalid/voz-local/${clave}`;

async function deCache(clave: string): Promise<string | null> {
  try {
    const r = await (await caches.open(CACHE)).match(urlDeCache(clave));
    return r ? await r.text() : null;
  } catch {
    return null;
  }
}

async function aCache(clave: string, datos: string): Promise<void> {
  try {
    const cache = await caches.open(CACHE);
    await cache.put(urlDeCache(clave), new Response(datos));
    const claves = await cache.keys();
    // Las claves salen en el orden en que se guardaron: se van las primeras.
    for (const viejo of claves.slice(0, Math.max(0, claves.length - MAXIMO_EN_CACHE))) await cache.delete(viejo);
  } catch {
    // Sin caché, se vuelve a pedir la próxima vez.
  }
}

/** La frase leída por la voz local, en MP3 y en base64, con el acento del diccionario si así está en los ajustes. */
export async function leer(a: Ajustes, texto: string): Promise<string> {
  const { url, estilo } = await elegido(a);
  const clave = claveDeAudio(url, estilo, a.vozLocal.acentoDiccionario, texto);
  const guardado = await deCache(clave);
  if (guardado) return guardado;

  let consulta: ConsultaVoz;
  try {
    consulta = (await (await pedir(url, `/audio_query?speaker=${estilo}&text=${encodeURIComponent(texto)}`, ESPERA_SINTESIS_MS, { method: 'POST' })).json()) as ConsultaVoz;
  } catch (e) {
    // El programa se cerró desde la última vez: se vuelve a buscar en la próxima.
    recuerdo = null;
    throw e;
  }
  const practica = lengua().acento?.practica;
  if (a.vozLocal.acentoDiccionario && practica) {
    const palabras = (await analisis.analizarTexto(texto, a, { expresiones: false })).flat();
    consulta = corregirAcentos(consulta, practica.frases(palabras)).consulta;
  }
  const wav = await (
    await pedir(url, `/synthesis?speaker=${estilo}`, ESPERA_SINTESIS_MS, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(consulta),
    })
  ).arrayBuffer();
  const audio = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(wav);
  const datos = bytesABase64(aMp3([audio.getChannelData(0)], audio.sampleRate));
  await aCache(clave, datos);
  return datos;
}

/** Si las frases se leen con la voz local: solo en japonés, que es lo que hablan AivisSpeech y VOICEVOX. */
export const usarVozLocal = (a: Ajustes): boolean => a.vozLocal.activa && lengua().id === 'ja';
