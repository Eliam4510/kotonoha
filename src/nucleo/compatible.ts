// La API de OpenAI, que hablan OpenRouter, DeepSeek, OpenAI, LM Studio y Ollama: lo que se manda a /chat/completions y
// cómo se lee lo que vuelve en flujo (server-sent events). Sin red: el motor hace las peticiones y esto se prueba aparte.

import type { UsoTokens } from './precios';

export interface PeticionCompatible {
  modelo: string;
  sistema: string;
  usuario: string;
  /** Una imagen delante del texto: la página cuyo texto se revisa. */
  imagen?: { tipo: string; datos: string };
  maxTokens: number;
  /** La respuesta debe cumplir este esquema JSON. */
  esquema?: unknown;
  /**
   * Cómo pedir el JSON: con el esquema (los que lo admiten) o en modo JSON con el esquema en las instrucciones (DeepSeek, y
   * los que rechazan el esquema).
   */
  modoJson?: 'esquema' | 'instrucciones';
  /** OpenRouter dice lo que costó cada petición si se le pide. */
  pedirCoste?: boolean;
  /** Los modelos nuevos de OpenAI ya no aceptan max_tokens, sino max_completion_tokens. */
  campoMaximo?: 'max_tokens' | 'max_completion_tokens';
}

/** El cuerpo de la petición a /chat/completions, en flujo y con el uso al final. */
export function cuerpoCompatible(p: PeticionCompatible): Record<string, unknown> {
  const instrucciones = p.esquema && p.modoJson === 'instrucciones'
    ? `${p.sistema}\n\nResponde solo con un objeto JSON válido, sin nada antes ni después, que cumpla este esquema JSON:\n${JSON.stringify(p.esquema)}`
    : p.sistema;
  const cuerpo: Record<string, unknown> = {
    model: p.modelo,
    [p.campoMaximo ?? 'max_tokens']: p.maxTokens,
    stream: true,
    stream_options: { include_usage: true },
    messages: [
      { role: 'system', content: instrucciones },
      {
        role: 'user',
        content: p.imagen
          ? [
              { type: 'image_url', image_url: { url: `data:${p.imagen.tipo};base64,${p.imagen.datos}` } },
              { type: 'text', text: p.usuario },
            ]
          : p.usuario,
      },
    ],
  };
  if (p.esquema) {
    cuerpo.response_format =
      p.modoJson === 'instrucciones' ? { type: 'json_object' } : { type: 'json_schema', json_schema: { name: 'respuesta', schema: p.esquema, strict: true } };
  }
  if (p.pedirCoste) cuerpo.usage = { include: true };
  return cuerpo;
}

export interface UsoCompatible {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
  /** OpenRouter: lo que costó, en dólares. */
  cost?: number;
}

/** Un trozo del flujo: texto nuevo, el uso del final, o por qué terminó. */
export interface TrozoCompatible {
  texto?: string;
  uso?: UsoCompatible;
  fin?: string;
  modelo?: string;
  error?: string;
}

/**
 * Lee el flujo por partes: devuelve los trozos de las líneas «data:» completas y lo que queda a medias para la próxima
 * vez. Los comentarios («: OPENROUTER PROCESSING») y las líneas vacías se ignoran.
 */
export function leerFlujo(pendiente: string): { trozos: TrozoCompatible[]; resto: string } {
  const lineas = pendiente.split(/\r?\n/);
  const resto = lineas.pop() ?? '';
  const trozos: TrozoCompatible[] = [];
  for (const l of lineas) {
    if (!l.startsWith('data:')) continue;
    const dato = l.slice(5).trim();
    if (!dato || dato === '[DONE]') continue;
    try {
      const j = JSON.parse(dato) as {
        model?: string;
        choices?: { delta?: { content?: string | null }; finish_reason?: string | null }[];
        usage?: UsoCompatible | null;
        error?: { message?: string };
      };
      if (j.error) {
        trozos.push({ error: j.error.message ?? 'error' });
        continue;
      }
      const c = j.choices?.[0];
      trozos.push({ texto: c?.delta?.content ?? undefined, fin: c?.finish_reason ?? undefined, uso: j.usage ?? undefined, modelo: j.model });
    } catch {
      // Una línea que no es JSON no aporta nada.
    }
  }
  return { trozos, resto };
}

/** Los tokens usados, como los cuenta Kotonoha: lo leído de la caché del proveedor va aparte. */
export function usoDeCompatible(u: UsoCompatible | undefined): UsoTokens {
  const cache = u?.prompt_tokens_details?.cached_tokens ?? 0;
  return { entrada: Math.max(0, (u?.prompt_tokens ?? 0) - cache), salida: u?.completion_tokens ?? 0, cacheEscritura5m: 0, cacheEscritura1h: 0, cacheLectura: cache };
}

/** Si el servidor rechazó el esquema JSON: entonces se repite pidiendo JSON con el esquema en las instrucciones. */
export const rechazaEsquema = (estado: number, texto: string) => estado === 400 && /response_format|json_schema|structured/i.test(texto);

/**
 * Lo que hay que cambiar del límite de tokens si el servidor lo rechazó: el nombre del campo (los modelos nuevos de OpenAI
 * piden max_completion_tokens) o el número (DeepSeek no da más de 8192). null si el rechazo es por otra cosa.
 */
export function ajusteDelMaximo(estado: number, texto: string, actual: { campo: 'max_tokens' | 'max_completion_tokens'; tokens: number }): { campo: 'max_tokens' | 'max_completion_tokens'; tokens: number } | null {
  if (estado !== 400) return null;
  if (actual.campo === 'max_tokens' && /max_completion_tokens/i.test(texto)) return { campo: 'max_completion_tokens', tokens: actual.tokens };
  if (/max_tokens|max_completion_tokens|maximum.*tokens|tokens.*(range|limit)/i.test(texto) && actual.tokens > LIMITE_SEGURO) return { campo: actual.campo, tokens: LIMITE_SEGURO };
  return null;
}

/** Lo que admiten todos los proveedores conocidos como respuesta máxima. */
const LIMITE_SEGURO = 8192;

/** El JSON de una respuesta: a veces viene entre ``` o con texto alrededor. */
export function jsonDeRespuesta(texto: string): string {
  const t = texto.trim();
  const bloque = /```(?:json)?\s*([\s\S]*?)```/.exec(t);
  const dentro = bloque ? bloque[1].trim() : t;
  if (dentro.startsWith('{') || dentro.startsWith('[')) return dentro;
  const desde = dentro.search(/[[{]/);
  const hasta = Math.max(dentro.lastIndexOf('}'), dentro.lastIndexOf(']'));
  return desde >= 0 && hasta > desde ? dentro.slice(desde, hasta + 1) : dentro;
}
