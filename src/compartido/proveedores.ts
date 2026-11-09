// Otros proveedores de IA, además de Claude: los que hablan la API de OpenAI (OpenRouter, DeepSeek, OpenAI, y LM Studio y
// Ollama en el propio equipo). El modelo de cada tarea se guarda como un texto: el de Claude tal cual, y el de otro
// proveedor como «proveedor::modelo». Así la forma de los ajustes y la caché de respuestas no cambian.

/** Dónde se guardan sus claves: aparte de los ajustes, como la de Claude, para que nunca lleguen a las páginas. */
export const CLAVES_PROVEEDORES = 'clavesProveedores';

/** Un proveedor que el usuario ha añadido. */
export interface ProveedorIA {
  id: string;
  nombre: string;
  /** La dirección de su API, terminada en /v1 (la que acaba en /chat/completions sin esa parte). */
  url: string;
  /** Los modelos que se ofrecen en cada tarea. */
  modelos: string[];
  /**
   * Si admite respuestas con esquema JSON. 'auto' lo intenta y, si el servidor lo rechaza, pide JSON con el esquema en las
   * instrucciones.
   */
  esquemas: 'si' | 'no' | 'auto';
  /** Si pide clave: los del propio equipo no. */
  conClave: boolean;
}

export interface ProveedorConocido extends Omit<ProveedorIA, 'modelos'> {
  /** Dónde se consigue una clave. */
  dondeClave?: string;
  /** Unos modelos con los que empezar; el resto se buscan en su lista. */
  sugeridos: string[];
  /** Algo que conviene saber antes de usarlo. */
  nota?: string;
}

export const PROVEEDORES_CONOCIDOS: ProveedorConocido[] = [
  { id: 'openrouter', nombre: 'OpenRouter', url: 'https://openrouter.ai/api/v1', esquemas: 'auto', conClave: true, dondeClave: 'https://openrouter.ai/keys', sugeridos: ['deepseek/deepseek-chat', 'google/gemini-2.5-flash', 'openai/gpt-5-mini'] },
  { id: 'deepseek', nombre: 'DeepSeek', url: 'https://api.deepseek.com/v1', esquemas: 'no', conClave: true, dondeClave: 'https://platform.deepseek.com/api_keys', sugeridos: ['deepseek-chat'] },
  { id: 'openai', nombre: 'OpenAI', url: 'https://api.openai.com/v1', esquemas: 'si', conClave: true, dondeClave: 'https://platform.openai.com/api-keys', sugeridos: ['gpt-5-mini'] },
  { id: 'lmstudio', nombre: 'LM Studio', url: 'http://127.0.0.1:1234/v1', esquemas: 'auto', conClave: false, sugeridos: [] },
  { id: 'ollama', nombre: 'Ollama', url: 'http://127.0.0.1:11434/v1', esquemas: 'auto', conClave: false, sugeridos: [], nota: 'OLLAMA_ORIGINS' },
];

const SEPARADOR = '::';

/** El valor de un modelo de otro proveedor en los ajustes. */
export const valorDeModelo = (proveedor: string, modelo: string) => `${proveedor}${SEPARADOR}${modelo}`;

/** De qué proveedor es un modelo de los ajustes: null si es de Claude. */
export function separarModelo(valor: string): { proveedor: string | null; modelo: string } {
  const i = valor.indexOf(SEPARADOR);
  return i < 0 ? { proveedor: null, modelo: valor } : { proveedor: valor.slice(0, i), modelo: valor.slice(i + SEPARADOR.length) };
}

/** Un identificador libre para un proveedor nuevo, a partir de su nombre. */
export function idParaProveedor(nombre: string, usados: string[]): string {
  const base = nombre.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'proveedor';
  let id = base;
  for (let n = 2; usados.includes(id); n++) id = `${base}-${n}`;
  return id;
}
