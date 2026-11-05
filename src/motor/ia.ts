// Cliente de Claude. Toda la IA de la extensión pasa por aquí.

import Anthropic from '@anthropic-ai/sdk';
import type { Ajustes, Esfuerzo, TareaIA } from '../compartido/ajustes';
import type { ContextoIA, SentidoEnContexto } from '../compartido/tipos';
import type { AnalisisLinea } from '../nucleo/analisisProfundo';
import { type Lote, ordenarPorCercania, partirEnLotes } from '../nucleo/lotes';
import type { Linea } from '../nucleo/subtitulos';
import { db } from './db';
import {
  ESQUEMA_ANALISIS,
  ESQUEMA_CORRECCIONES,
  ESQUEMA_SENTIDO,
  PROMPT_ANALISIS,
  PROMPT_CORRECCION,
  PROMPT_SENTIDO,
  PROMPTS_BASE,
  rellenar,
  type VariablesPrompt,
} from './prompts';

let claveApi = '';
let urlBase: string | undefined;
let cliente: Anthropic | null = null;

export function fijarClave(clave: string, baseURL?: string) {
  claveApi = clave;
  urlBase = baseURL;
  cliente = null;
}

export const hayClave = () => claveApi.length > 0;

function obtenerCliente(): Anthropic {
  if (!claveApi) throw new Error('Falta la clave de la API de Claude. Añádela en Ajustes.');
  // Corre en el documento offscreen: los scripts de las páginas nunca ven la clave.
  cliente ??= new Anthropic({ apiKey: claveApi, dangerouslyAllowBrowser: true, ...(urlBase ? { baseURL: urlBase } : {}) });
  return cliente;
}

/** Haiku 5.5 no admite respaldo en el servidor; el resto de modelos actuales sí. */
const admiteRespaldo = (modelo: string) => !modelo.startsWith('claude-haiku');

interface OpcionesPeticion {
  a: Ajustes;
  tarea: TareaIA;
  sistema: string;
  usuario: string;
  guion?: string;
  titulo?: string;
  maxTokens?: number;
  formato?: { type: 'json_schema'; schema: unknown };
  /** Usa el modelo y el esfuerzo de «profundizar» en lugar de los de la tarea. */
  profundo?: boolean;
}

function construirParams(o: OpcionesPeticion) {
  // El guion va en un bloque en caché para que varias consultas del mismo video lo reutilicen.
  const system: { type: 'text'; text: string; cache_control?: { type: 'ephemeral'; ttl?: '1h' } }[] = [{ type: 'text', text: o.sistema }];
  if (o.a.usarGuion && o.guion) {
    system.push({
      type: 'text',
      text: `${o.titulo ? `Título: ${o.titulo}\n` : ''}Texto completo, como contexto:\n${o.guion}`,
      cache_control: { type: 'ephemeral', ttl: '1h' },
    });
  }
  const tarea = o.profundo ? 'profundo' : o.tarea;
  return {
    model: o.a.modelos[tarea],
    max_tokens: o.maxTokens ?? 16000,
    system,
    messages: [{ role: 'user' as const, content: o.usuario }],
    output_config: {
      effort: o.a.esfuerzos[tarea] as Esfuerzo,
      ...(o.formato ? { format: o.formato } : {}),
    },
  };
}

function abrirFlujo(o: OpcionesPeticion, senal?: AbortSignal) {
  const params = construirParams(o);
  const c = obtenerCliente();
  if (o.a.respaldoSeguridad && admiteRespaldo(params.model)) {
    return c.beta.messages.stream({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } as never, { signal: senal });
  }
  return c.messages.stream(params as never, { signal: senal });
}

function textoDe(m: { content: { type: string; text?: string }[] }): string {
  return m.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('');
}

function mensajeError(e: unknown): Error {
  if (e instanceof Anthropic.AuthenticationError) return new Error('La clave de la API no es válida. Revísala en Ajustes.');
  if (e instanceof Anthropic.RateLimitError) return new Error('Se superó el límite de la API. Espera un momento y vuelve a intentarlo.');
  if (e instanceof Anthropic.BadRequestError && /credit balance/i.test(e.message)) return new Error('No queda saldo en la API de Claude.');
  if (e instanceof Anthropic.APIError) return new Error(`Error de la API de Claude (${e.status ?? 'sin conexión'}): ${e.message}`);
  return e instanceof Error ? e : new Error(String(e));
}

async function ejecutar(o: OpcionesPeticion, emitir?: (t: string) => void, senal?: AbortSignal): Promise<string> {
  try {
    const flujo = abrirFlujo(o, senal);
    if (emitir) (flujo as unknown as { on(e: 'text', fn: (d: string) => void): void }).on('text', (d) => emitir(d));
    const final = (await flujo.finalMessage()) as unknown as { stop_reason?: string; content: { type: string; text?: string }[] };
    if (final.stop_reason === 'refusal') throw new Error('Claude rechazó esta petición por sus reglas de seguridad.');
    return textoDe(final);
  } catch (e) {
    if (senal?.aborted) return '';
    throw mensajeError(e);
  }
}

async function hash(texto: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(d).slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Ejecuta con caché local: la misma pregunta no se vuelve a enviar salvo que pidas reintentar. */
async function conCache(o: OpcionesPeticion, recargar: boolean, emitir?: (t: string) => void, senal?: AbortSignal): Promise<string> {
  const tarea = o.profundo ? 'profundo' : o.tarea;
  const clave = await hash(JSON.stringify([o.a.modelos[tarea], o.sistema, o.usuario, o.a.usarGuion && o.guion ? await hash(o.guion) : '']));
  if (!recargar) {
    const guardado = await db.cacheIA.get(clave);
    if (guardado) {
      emitir?.(guardado.texto);
      return guardado.texto;
    }
  }
  const texto = await ejecutar(o, emitir, senal);
  if (texto) await db.cacheIA.put({ clave, texto, creada: Date.now() });
  return texto;
}

/** Las líneas que rodean a la frase: lo que hace falta para entenderla de verdad. */
function bloqueEntorno(c: ContextoIA): string {
  const partes: string[] = [];
  if (c.titulo) partes.push(`Título: ${c.titulo}`);
  if (c.antes?.length) partes.push(`Texto anterior:\n${c.antes.join('\n')}`);
  if (c.despues?.length) partes.push(`Texto siguiente:\n${c.despues.join('\n')}`);
  return partes.join('\n\n') + (partes.length ? '\n' : '');
}

type TareaTexto = keyof typeof PROMPTS_BASE;

function plantilla(a: Ajustes, tarea: TareaTexto) {
  const p = a.prompts[tarea];
  return p?.sistema && p.usuario ? p : PROMPTS_BASE[tarea];
}

function preparar(a: Ajustes, tarea: TareaTexto, c: ContextoIA, extra: Partial<VariablesPrompt> = {}, profundo = false): OpcionesPeticion {
  const p = plantilla(a, tarea);
  const v: VariablesPrompt = {
    palabra: c.lema,
    superficie: c.superficie,
    lectura: c.lectura,
    frase: c.frase,
    entorno: bloqueEntorno(c),
    traduccion: c.traduccion,
    titulo: c.titulo,
    ...extra,
  };
  return {
    a,
    tarea: tarea === 'gramatica' ? 'explicar' : tarea,
    sistema: rellenar(p.sistema, a, v),
    usuario: rellenar(p.usuario, a, v),
    guion: c.guion,
    titulo: c.titulo,
    profundo,
  };
}

export const flujos = {
  explicar: (a: Ajustes, c: ContextoIA, recargar: boolean, profundo: boolean, emitir: (t: string) => void, senal: AbortSignal) =>
    conCache(preparar(a, 'explicar', c, {}, profundo), recargar, emitir, senal),
  desglosar: (a: Ajustes, c: ContextoIA, recargar: boolean, emitir: (t: string) => void, senal: AbortSignal) =>
    conCache(preparar(a, 'desglosar', c), recargar, emitir, senal),
  traducir: (a: Ajustes, c: ContextoIA, recargar: boolean, emitir: (t: string) => void, senal: AbortSignal) =>
    conCache(preparar(a, 'traducir', c, { idioma: a.idiomaTraduccion }), recargar, emitir, senal),
  gramatica: (a: Ajustes, c: ContextoIA, recargar: boolean, emitir: (t: string) => void, senal: AbortSignal) =>
    conCache(preparar(a, 'gramatica', c), recargar, emitir, senal),
  preguntar: (a: Ajustes, c: ContextoIA, pregunta: string, emitir: (t: string) => void, senal: AbortSignal) =>
    ejecutar(preparar(a, 'preguntar', c, { pregunta }), emitir, senal),
  historia: (a: Ajustes, tema: string, palabras: string, emitir: (t: string) => void, senal: AbortSignal) =>
    ejecutar(preparar(a, 'historia', { frase: tema, lema: palabras }), emitir, senal),
};

/** Qué significa la palabra en esta frase: resuelve el problema del «siempre el sentido básico». */
export async function sentidoEnContexto(a: Ajustes, c: ContextoIA, definiciones: string[], recargar = false): Promise<SentidoEnContexto> {
  const lista = definiciones.slice(0, 12).map((d, i) => `${i}. ${d}`).join('\n');
  const texto = await conCache(
    {
      a,
      tarea: 'sentido',
      sistema: rellenar(PROMPT_SENTIDO, a, {}),
      usuario: `${bloqueEntorno(c)}Frase: 「${c.frase}」
Palabra: ${c.lema} (en la frase aparece como 「${c.superficie ?? c.lema}」, lectura ${c.lectura ?? ''})
Definiciones del diccionario:
${lista || '(ninguna)'}`,
      guion: c.guion,
      titulo: c.titulo,
      maxTokens: 8000,
      formato: { type: 'json_schema', schema: ESQUEMA_SENTIDO },
    },
    recargar
  );
  return JSON.parse(texto) as SentidoEnContexto;
}

export async function generarFrase(a: Ajustes, lema: string): Promise<string> {
  return (await conCache(preparar(a, 'generar', { lema }), false)).trim();
}

export async function traducirBreve(a: Ajustes, texto: string): Promise<string> {
  return (await conCache(preparar(a, 'traducir', { frase: texto }, { idioma: a.idiomaTraduccion }), false)).trim();
}

export async function consultaImagen(a: Ajustes, lema: string, frase?: string): Promise<string> {
  const texto = await conCache(
    {
      a,
      tarea: 'generar',
      sistema: 'Devuelve solo dos o tres palabras en inglés útiles para buscar una imagen que ilustre el término japonés dado, según su sentido en la frase. Sin comillas.',
      usuario: frase ? `Término: ${lema}\nFrase: ${frase}` : `Término: ${lema}`,
    },
    false
  );
  return texto.trim();
}

export async function glosaBreve(a: Ajustes, lema: string, frase?: string): Promise<string> {
  const texto = await conCache(
    {
      a,
      tarea: 'sentido',
      sistema: `Traduce el término japonés a ${a.idiomaTraduccion} con una o dos palabras, en forma de diccionario. Responde solo con la traducción.`,
      usuario: frase ? `Término: ${lema}\nContexto: ${frase}` : `Término: ${lema}`,
    },
    false
  );
  return texto.trim();
}

/** Revisa una lectura concreta que el usuario señaló como dudosa. */
export async function revisarLectura(a: Ajustes, c: ContextoIA): Promise<{ lectura: string; lema: string; lectura_lema: string; motivo: string }> {
  const texto = await ejecutar({
    a,
    tarea: 'sentido',
    sistema: `Eres un experto en lecturas de kanji. Decide cómo se lee esta palabra en esta frase, teniendo en cuenta el contexto y, en canciones o poesía, las lecturas poéticas. Responde en ${a.idiomaExplicaciones}.`,
    usuario: `${bloqueEntorno(c)}Frase: 「${c.frase}」
Palabra: 「${c.superficie ?? c.lema}」
Lectura actual: ${c.lectura ?? ''}`,
    guion: c.guion,
    titulo: c.titulo,
    maxTokens: 8000,
    formato: {
      type: 'json_schema',
      schema: {
        type: 'object',
        properties: { lectura: { type: 'string' }, lema: { type: 'string' }, lectura_lema: { type: 'string' }, motivo: { type: 'string' } },
        required: ['lectura', 'lema', 'lectura_lema', 'motivo'],
        additionalProperties: false,
      },
    },
  });
  return JSON.parse(texto);
}

const ESQUEMA_LINEAS = {
  type: 'object',
  properties: {
    lineas: {
      type: 'array',
      items: {
        type: 'object',
        properties: { i: { type: 'integer' }, t: { type: 'string' } },
        required: ['i', 't'],
        additionalProperties: false,
      },
    },
  },
  required: ['lineas'],
  additionalProperties: false,
} as const;

const TAM_LOTE_TRADUCCION = 80;
/** Corregir apenas devuelve texto, porque solo vienen las líneas que cambian: caben lotes mayores. */
const TAM_LOTE_CORRECCION = 120;
const MARGEN = 6;
const SIMULTANEOS = 3;

/**
 * Lanza los lotes en paralelo, empezando por el que estás viendo. Con `primeroSolo` el primero va
 * por delante: deja en la caché de la API el texto completo, y los demás lo reutilizan.
 */
async function porLotes(total: number, tam: number, indice: number, primeroSolo: boolean, fn: (l: Lote) => Promise<void>) {
  const cola = ordenarPorCercania(partirEnLotes(total, tam), indice);
  if (primeroSolo && cola.length) await fn(cola.shift()!);
  const trabajar = async () => {
    for (let l = cola.shift(); l; l = cola.shift()) await fn(l);
  };
  await Promise.all(Array.from({ length: Math.min(SIMULTANEOS, cola.length) }, trabajar));
}

const unaLinea = (l: Linea) => l.texto.replace(/\n/g, ' ');

function mensajeLote(lineas: Linea[], { desde, hasta }: Lote, titulo: string | undefined, etiqueta: string): string {
  const antes = lineas.slice(Math.max(0, desde - MARGEN), desde).map(unaLinea).join('\n');
  const despues = lineas.slice(hasta, hasta + MARGEN).map(unaLinea).join('\n');
  const cuerpo = lineas.slice(desde, hasta).map((l, k) => `${desde + k}: ${unaLinea(l)}`).join('\n');
  return [
    titulo ? `Título: ${titulo}` : '',
    antes ? `Líneas anteriores, solo como contexto:\n${antes}` : '',
    `${etiqueta}:\n${cuerpo}`,
    despues ? `Líneas siguientes, solo como contexto:\n${despues}` : '',
  ].filter(Boolean).join('\n\n');
}

export interface ParteTexto {
  i: number;
  t: string;
}

/** Traduce un subtítulo en cualquier dirección. Entrega cada lote al terminarlo, para verlo cuanto antes. */
export async function traducirSubtitulos(
  a: Ajustes,
  lineas: Linea[],
  titulo: string | undefined,
  sistema: string,
  indice: number,
  alLote: (parte: ParteTexto[], hechas: number, total: number) => void,
  senal?: AbortSignal
): Promise<void> {
  let hechas = 0;
  await porLotes(lineas.length, TAM_LOTE_TRADUCCION, indice, false, async (l) => {
    if (senal?.aborted) return;
    const usuario = mensajeLote(lineas, l, titulo, 'Líneas a traducir');
    const texto = await ejecutar({ a, tarea: 'subtitulos', sistema, usuario, maxTokens: 32000, formato: { type: 'json_schema', schema: ESQUEMA_LINEAS } }, undefined, senal);
    if (!texto) return;
    const datos = JSON.parse(texto) as { lineas: ParteTexto[] };
    hechas += l.hasta - l.desde;
    alLote(datos.lineas, hechas, lineas.length);
  });
}

/**
 * Corrige homófonos y palabras mal oídas de unos subtítulos automáticos, sin preguntar nada.
 * Es rápido y barato porque Claude solo devuelve lo que cambia, y el texto completo que le da el
 * contexto va en la caché de la API: cada lote lo reutiliza en lugar de pagarlo otra vez.
 */
export async function corregirSubtitulos(
  a: Ajustes,
  lineas: Linea[],
  titulo: string | undefined,
  indice: number,
  guion: string | undefined,
  alLote: (cambios: ParteTexto[], hechas: number, total: number) => void,
  senal?: AbortSignal
): Promise<void> {
  const contexto = guion ?? lineas.map(unaLinea).join('\n');
  let hechas = 0;
  await porLotes(lineas.length, TAM_LOTE_CORRECCION, indice, true, async (l) => {
    if (senal?.aborted) return;
    const usuario = mensajeLote(lineas, l, titulo, 'Líneas a revisar');
    const texto = await ejecutar({ a, tarea: 'corregir', sistema: PROMPT_CORRECCION, usuario, guion: contexto, titulo, maxTokens: 16000, formato: { type: 'json_schema', schema: ESQUEMA_CORRECCIONES } }, undefined, senal);
    if (!texto) return;
    const datos = JSON.parse(texto) as { correcciones: ParteTexto[] };
    hechas += l.hasta - l.desde;
    alLote(datos.correcciones, hechas, lineas.length);
  });
}

export interface EntradaAnalisis {
  texto: string;
  /** Palabras con la lectura que calculó el tokenizador: 咲いた(さいた) 花(はな) */
  palabras: string;
}

/**
 * Análisis profundo: corrige lecturas, detecta sentidos no literales y gramática, línea a línea.
 * Devuelve por el callback cada trozo terminado para guardarlo y mostrarlo cuanto antes.
 */
export async function analisisProfundo(
  a: Ajustes,
  entradas: EntradaAnalisis[],
  titulo: string | undefined,
  alTrozo: (resultado: Map<number, AnalisisLinea>, desde: number, hasta: number, hechas: number, total: number) => Promise<void>,
  senal?: AbortSignal,
  indice = -1
): Promise<void> {
  const sistema = rellenar(PROMPT_ANALISIS, a, {});
  let hechas = 0;
  await porLotes(entradas.length, 60, indice, false, async ({ desde, hasta }) => {
    if (senal?.aborted) return;
    const antes = entradas.slice(Math.max(0, desde - MARGEN), desde).map((e) => e.texto).join('\n');
    const despues = entradas.slice(hasta, hasta + MARGEN).map((e) => e.texto).join('\n');
    const cuerpo = entradas.slice(desde, hasta).map((e, k) => `${desde + k}: ${e.texto}\n   Palabras: ${e.palabras}`).join('\n');
    const usuario = [
      titulo ? `Título: ${titulo}` : '',
      antes ? `Líneas anteriores, solo como contexto:\n${antes}` : '',
      `Líneas a revisar:\n${cuerpo}`,
      despues ? `Líneas siguientes, solo como contexto:\n${despues}` : '',
    ].filter(Boolean).join('\n\n');
    const texto = await ejecutar({ a, tarea: 'analisis', sistema, usuario, maxTokens: 32000, formato: { type: 'json_schema', schema: ESQUEMA_ANALISIS } }, undefined, senal);
    if (!texto) return;
    const datos = JSON.parse(texto) as { lineas: (AnalisisLinea & { i: number })[] };
    const r = new Map<number, AnalisisLinea>();
    for (const { i, lecturas, sentidos, gramatica } of datos.lineas) r.set(i, { lecturas, sentidos, gramatica });
    hechas += hasta - desde;
    await alTrozo(r, desde, hasta, hechas, entradas.length);
  });
}

export async function probarConexion(a: Ajustes): Promise<string> {
  const c = obtenerCliente();
  try {
    const r = await c.messages.create({
      model: a.modelos.traducir,
      max_tokens: 2000,
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: 'Responde únicamente con la palabra 接続.' }],
    } as never);
    return `${textoDe(r as never).trim()} (${(r as unknown as { model: string }).model})`;
  } catch (e) {
    throw mensajeError(e);
  }
}
