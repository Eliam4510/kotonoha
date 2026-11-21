// Las voces de AivisHub dentro de Kotonoha: su catálogo, su instalación (lo que todas comparten y cada voz) y leer una
// frase con ellas. La parte de texto es de la lengua (lenguas/voces.ts) y corre aquí, en el motor; el trabajador
// de voz recibe las oraciones ya en fonemas. Cada frase leída se guarda en MP3, como con las demás voces.
//
// Del catálogo se enseñan solo las voces que Kotonoha sabe leer (Style-Bert-VITS2 JP-Extra en ONNX), y no las de
// personajes que ya existen ni las de personas reales: para estudiar no hacen falta, y su uso tiene más problemas de
// derechos y de consentimiento.

import { type Ajustes, vozIntegradaElegida } from '../compartido/ajustes';
import type { EstadoVocesIntegradas, FiltrosCatalogo, PaginaCatalogo, VozCatalogo } from '../compartido/api';
import { tr } from '../compartido/i18n';
import { fondo } from '../compartido/rpc';
import type { ProgresoInstalacion } from '../compartido/tipos';
import type { OracionVoz, VozIntegradaLengua } from '../lenguas/tipos';
import { ARQUITECTURA_COMPATIBLE } from '../nucleo/aivm';
import { acentoVoicevox, corregirAcentos } from '../nucleo/vozLocal';
import * as analisis from './analisis';
import { aMp3, bytesABase64 } from './grabacion';
import { vozIntegradaDe } from '../lenguas/voces';
import { lengua } from './lengua';
import { CACHE_MODELOS_VOZ, enCache, urlDeModelo } from './modelos';
import { aCache, deCache, instalarArchivos, leerSbv2 } from './vozNeuronal';
import type { ArchivoVoz } from './vozSbv2';

const API = 'https://api.aivis-project.com/v1';
const POR_PAGINA = 24;
/** Las categorías de AivisHub que se enseñan: personajes originales, ficticios y lo demás. */
const CATEGORIAS = ['OriginalCharacter', 'FictionalPerson', 'Other'];

const BERT = { repositorio: 'tsukumijima/deberta-v2-large-japanese-char-wwm-onnx', revision: 'd701ec67708287b20d2063270f6b535e6eed09ab' };
/** El BERT de AivisSpeech, el mismo archivo y la misma fuente: con él suenan como allí. */
export const ARCHIVOS_BERT: { modelo: ArchivoVoz; vocabulario: ArchivoVoz } = {
  modelo: { url: urlDeModelo(BERT.repositorio, BERT.revision, 'model_fp16.onnx'), nombre: 'BERT', sha256: '23f633ae7c5900ff82b35a428b67a54e7e7911d5d6a6dcfc77967be8f1c94dc6', bytes: 653075699 },
  vocabulario: { url: urlDeModelo(BERT.repositorio, BERT.revision, 'vocab.txt'), nombre: 'vocab.txt', sha256: '902cbd7e218aaf23a72955533293ceac12fcc4e010ad98c0c14757b94ce7abb6', bytes: 88151 },
};

const urlVoz = (uuid: string) => `${API}/aivm-models/${uuid}/download?model_type=AIVMX`;
const archivoDeVoz = (v: { uuid: string; nombre: string; sha256: string; bytes: number }): ArchivoVoz => ({ url: urlVoz(v.uuid), nombre: v.nombre, sha256: v.sha256, bytes: v.bytes });
const archivosBase = (v: VozIntegradaLengua): ArchivoVoz[] => [ARCHIVOS_BERT.modelo, ARCHIVOS_BERT.vocabulario, { url: v.diccionario.url, nombre: 'naist-jdic', sha256: v.diccionario.sha256, bytes: v.diccionario.bytes }];
const presente = (a: ArchivoVoz) => enCache(a.url, CACHE_MODELOS_VOZ);

function vozDeLaLengua(): VozIntegradaLengua {
  const v = vozIntegradaDe(lengua().id);
  if (!v) throw new Error(tr('Esta lengua no tiene voces integradas.'));
  return v;
}

// ---------- El catálogo ----------

interface ModeloApi {
  aivm_model_uuid: string;
  name: string;
  description?: string;
  category: string;
  voice_timbre: string;
  total_download_count?: number;
  user?: { name?: string; handle?: string };
  model_files: { model_format: string; model_architecture: string; license_type: string; license_text?: string | null; version: string; file_size: number; checksum: string }[];
  speakers: { name: string; local_id: number; icon_url?: string; styles: { name: string; local_id: number; voice_samples?: { audio_url: string; transcript: string }[] }[] }[];
}

const archivoCompatible = (m: ModeloApi) => m.model_files.find((f) => f.model_format === 'ONNX' && f.model_architecture === ARQUITECTURA_COMPATIBLE);

/** Una voz de AivisHub tal como se enseña; null si Kotonoha no sabe leerla o no se ofrece. */
export function aCatalogo(m: ModeloApi): VozCatalogo | null {
  const archivo = archivoCompatible(m);
  if (!archivo || !CATEGORIAS.includes(m.category)) return null;
  return {
    uuid: m.aivm_model_uuid,
    nombre: m.name,
    autor: m.user?.name ?? m.user?.handle ?? '',
    descripcion: m.description ?? '',
    timbre: m.voice_timbre,
    licencia: archivo.license_type,
    version: archivo.version,
    bytes: archivo.file_size,
    sha256: archivo.checksum,
    descargas: m.total_download_count ?? 0,
    hablantes: m.speakers.map((h) => ({
      nombre: h.name,
      id: h.local_id,
      ...(h.icon_url ? { icono: h.icon_url } : {}),
      estilos: h.styles.map((e) => ({ nombre: e.name, id: e.local_id, muestras: (e.voice_samples ?? []).map((s) => ({ url: s.audio_url, texto: s.transcript })) })),
    })),
  };
}

async function pedirApi<T>(ruta: string): Promise<T> {
  const r = await fetch(`${API}${ruta}`, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(tr('AivisHub respondió {0}', r.status));
  return (await r.json()) as T;
}

export async function catalogo(f: FiltrosCatalogo): Promise<PaginaCatalogo> {
  const pagina = Math.max(1, f.pagina ?? 1);
  const q = new URLSearchParams({ sort: f.orden ?? 'download', page: String(pagina), limit: String(POR_PAGINA) });
  if (f.texto?.trim()) q.set('keyword', f.texto.trim().slice(0, 100));
  for (const c of CATEGORIAS) q.append('categories', c);
  if (f.timbre) q.append('voice_timbres', f.timbre);
  if (f.licencia) q.append('license_types', f.licencia);
  const d = await pedirApi<{ total: number; aivm_models: ModeloApi[] }>(`/aivm-models/search?${q}`);
  return {
    voces: d.aivm_models.map(aCatalogo).filter((v): v is VozCatalogo => v !== null),
    total: d.total,
    pagina,
    paginas: Math.max(1, Math.ceil(d.total / POR_PAGINA)),
  };
}

/** El texto de la licencia: el propio de la voz si lo tiene; si no, el nombre de la licencia común. */
export async function licencia(uuid: string): Promise<string> {
  const archivo = archivoCompatible(await pedirApi<ModeloApi>(`/aivm-models/${encodeURIComponent(uuid)}`));
  if (!archivo) throw new Error(tr('Kotonoha no sabe leer esta voz.'));
  return archivo.license_text?.trim() || archivo.license_type;
}

// ---------- Instalar y borrar ----------

/** Avisa de cómo va, como al instalar un diccionario; no más de unas veces por segundo. */
function avisos(id: string, titulo: string) {
  let ultimo = 0;
  return (p: Pick<ProgresoInstalacion, 'fase' | 'avance' | 'error'>, siempre = false) => {
    const ahora = Date.now();
    if (!siempre && ahora - ultimo < 250) return;
    ultimo = ahora;
    fondo.difundir({ tipo: 'instalacion', progreso: { id, titulo, ...p } }).catch(() => {});
  };
}

export async function instalar(uuid: string): Promise<void> {
  const v = vozDeLaLengua();
  const ficha = aCatalogo(await pedirApi<ModeloApi>(`/aivm-models/${encodeURIComponent(uuid)}`));
  if (!ficha) throw new Error(tr('Kotonoha no sabe leer esta voz.'));
  const archivos = [...archivosBase(v), archivoDeVoz(ficha)];
  const faltan: ArchivoVoz[] = [];
  for (const a of archivos) if (!(await presente(a))) faltan.push(a);
  const total = faltan.reduce((n, a) => n + a.bytes, 0) || 1;
  const cargados = new Map<string, number>();
  const avisar = avisos(`voz-${uuid}`, ficha.nombre);
  avisar({ fase: 'descargando', avance: 0 }, true);
  try {
    await instalarArchivos(faltan, (x) => {
      cargados.set(x.archivo, x.cargado);
      avisar({ fase: 'descargando', avance: Math.min(1, [...cargados.values()].reduce((n, c) => n + c, 0) / total) });
    });
    // Los ajustes los escribe el fondo: en el documento offscreen del motor no hay chrome.storage.
    await fondo.vozIntegradaInstalada({
      uuid,
      nombre: ficha.nombre,
      autor: ficha.autor,
      version: ficha.version,
      licencia: ficha.licencia,
      bytes: ficha.bytes,
      sha256: ficha.sha256,
      hablantes: ficha.hablantes.map((h) => ({ nombre: h.nombre, id: h.id, estilos: h.estilos.map((e) => ({ nombre: e.nombre, id: e.id })) })),
    });
  } catch (e) {
    avisar({ fase: 'error', avance: 0, error: e instanceof Error ? e.message : String(e) }, true);
    throw e;
  }
  avisar({ fase: 'listo', avance: 1 }, true);
}

export async function borrar(uuid: string): Promise<void> {
  await (await caches.open(CACHE_MODELOS_VOZ)).delete(urlVoz(uuid));
  await fondo.vozIntegradaBorrada(uuid);
}

export async function borrarBase(): Promise<void> {
  const cache = await caches.open(CACHE_MODELOS_VOZ);
  for (const a of archivosBase(vozDeLaLengua())) await cache.delete(a.url);
}

/** Lo que ocupa un archivo de la caché: lo dice su cabecera, que se guardó al bajarlo. */
async function bytesEnCache(cache: Cache, url: string): Promise<number | null> {
  const r = await cache.match(url);
  if (!r) return null;
  return Number(r.headers.get('content-length')) || (await r.blob()).size;
}

export async function estado(a: Ajustes): Promise<EstadoVocesIntegradas> {
  const cache = await caches.open(CACHE_MODELOS_VOZ);
  const v = vozIntegradaDe(lengua().id);
  const base = v ? await Promise.all(archivosBase(v).map((x) => bytesEnCache(cache, x.url))) : [null];
  const voces = await Promise.all(
    a.vozIntegrada.instaladas.map(async (x) => {
      const bytes = await bytesEnCache(cache, urlVoz(x.uuid));
      return { uuid: x.uuid, presente: bytes !== null, bytes: bytes ?? 0 };
    })
  );
  return { base: { instalada: base.every((b) => b !== null), bytes: base.reduce<number>((n, b) => n + (b ?? 0), 0) }, voces };
}

// ---------- Leer ----------

const claveDeAudio = (s: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return `sbv2-${(h >>> 0).toString(36)}-${s.length}`;
};

/** El diccionario de la parte de texto, de la caché de las voces, la primera vez que hace falta. */
async function prepararDiccionario(v: VozIntegradaLengua): Promise<void> {
  if (v.listo()) return;
  const r = await (await caches.open(CACHE_MODELOS_VOZ)).match(v.diccionario.url);
  if (!r?.body) throw new Error(tr('Las voces integradas no están instaladas del todo: instálalas otra vez en Ajustes, Voces.'));
  v.cargar(new Uint8Array(await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()));
}

/** Los núcleos de cada oración corregidos con el diccionario de acento, como con la voz local; null si no se corrigen. */
async function nucleosDelDiccionario(a: Ajustes, texto: string, oraciones: OracionVoz[]): Promise<number[][] | null> {
  const practica = lengua().acento?.practica;
  if (!a.vozLocal.acentoDiccionario || !practica) return null;
  const palabras = (await analisis.analizarTexto(texto, a, { expresiones: false })).flat();
  const consulta = {
    accent_phrases: oraciones.flatMap((o) => o.frases.map((f) => ({ moras: f.moras.map((text) => ({ text })), accent: acentoVoicevox(f.nucleo, f.moras.length) }))),
  };
  const { consulta: corregida } = corregirAcentos(consulta, practica.frases(palabras));
  let k = 0;
  // En VOICEVOX, sin núcleo es el número de moras: para los tonos es lo mismo, no baja dentro de la frase.
  return oraciones.map((o) => o.frases.map(() => corregida.accent_phrases[k++].accent));
}

/** La frase leída con la voz integrada elegida, en MP3 y en base64. */
export async function leer(a: Ajustes, texto: string): Promise<{ datos: string; dispositivo?: string; ms?: number; audioS?: number }> {
  const v = vozDeLaLengua();
  const elegida = vozIntegradaElegida(a);
  if (!elegida) throw new Error(tr('No hay ninguna voz integrada instalada.'));
  const { hablante, estilo } = a.vozIntegrada;
  const clave = claveDeAudio(`${elegida.uuid}\u0000${hablante}\u0000${estilo}\u0000${a.vozLocal.acentoDiccionario ? 1 : 0}\u0000${v.version}\u0000${texto}`);
  const guardado = await deCache(clave);
  if (guardado) return { datos: guardado };
  // Sin sus archivos no se lee: bajarlos en silencio serían cientos de MB sin avisar.
  for (const archivo of [...archivosBase(v), archivoDeVoz(elegida)]) {
    if (!(await presente(archivo))) throw new Error(tr('Las voces integradas no están instaladas del todo: instálalas otra vez en Ajustes, Voces.'));
  }
  await prepararDiccionario(v);
  const oraciones = v.analizar(texto);
  if (!oraciones.length) throw new Error(tr('No hay nada que leer en la frase.'));
  const nucleos = await nucleosDelDiccionario(a, texto, oraciones);
  const r = await leerSbv2({
    bert: ARCHIVOS_BERT,
    voz: archivoDeVoz(elegida),
    hablante,
    estilo,
    velocidad: 1,
    oraciones: oraciones.map((o, i) => ({ entrada: v.entrada(o, nucleos?.[i]), pausaAntesS: o.pausaAntesS })),
  });
  if (!r.muestras.length) throw new Error(tr('No se pudo leer la frase con la voz neuronal.'));
  const audioS = r.muestras.length / r.frecuencia;
  // Lo medido para «Tu equipo»: sin la primera vez, que carga los modelos y compila la gráfica.
  if (!r.recienCargada && r.msCalculo) fondo.medidaHabla(audioS, r.msCalculo, r.dispositivo ?? '').catch(() => {});
  const datos = bytesABase64(aMp3([r.muestras], r.frecuencia));
  await aCache(clave, datos);
  return { datos, dispositivo: r.dispositivo, ms: r.ms, audioS };
}
