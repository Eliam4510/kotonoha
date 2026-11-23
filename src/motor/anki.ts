// Conexión con Anki a través del complemento AnkiConnect.

import type { Ajustes } from '../compartido/ajustes';
import type { BorradorTarjeta, EstadoAnki, MedioTarjeta } from '../compartido/tipos';
import { tr } from '../compartido/i18n';
import { ANVERSO, ANVERSO_PLANTILLA_1, CSS_PLANTILLA_1, CSS_TARJETA, MARCA_PLANTILLA, mismoCss, NOMBRE_PLANTILLA, REVERSO_PLANTILLA_1, reverso } from './plantillaAnki';

let puerto = 8765;

export const fijarPuerto = (p: number) => {
  puerto = p;
};

async function invocar<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`http://127.0.0.1:${puerto}`, {
      method: 'POST',
      body: JSON.stringify({ action, version: 6, params }),
    });
  } catch {
    throw new Error(tr('Anki no responde. Ábrelo y comprueba que AnkiConnect está instalado.'));
  }
  if (r.status === 403) throw new Error(tr('Anki rechazó la conexión: pulsa «Conectar con Anki» en Ajustes y acepta el aviso en Anki.'));
  const d = (await r.json()) as { result: T; error: string | null };
  if (d.error) throw new Error(d.error);
  return d.result;
}

/** Pide permiso para este origen; Anki muestra un cuadro de diálogo la primera vez. */
export async function pedirPermiso(): Promise<EstadoAnki> {
  const r = await invocar<{ permission: string }>('requestPermission');
  if (r.permission !== 'granted') throw new Error(tr('Anki no concedió el permiso'));
  return estado();
}

export async function estado(): Promise<EstadoAnki> {
  try {
    const [version, mazos, modelos] = await Promise.all([
      invocar<number>('version'),
      invocar<string[]>('deckNames'),
      invocar<string[]>('modelNames'),
    ]);
    return { conectado: true, version, mazos, modelos };
  } catch (e) {
    return { conectado: false, mazos: [], modelos: [], error: e instanceof Error ? e.message : String(e) };
  }
}

export const camposModelo = (modelo: string) => invocar<string[]>('modelFieldNames', { modelName: modelo });

export const MODELO_PROPIO = 'Kotonoha';

const CAMPOS_PROPIOS = [
  'Palabra',
  'Lectura',
  'Frase',
  'FraseFurigana',
  'Traduccion',
  'Definicion',
  'AudioFrase',
  'AudioPalabra',
  'Imagen',
  'Ejemplos',
  'Notas',
  'Fuente',
];

export async function crearModeloPropio(): Promise<void> {
  const modelos = await invocar<string[]>('modelNames');
  if (modelos.includes(MODELO_PROPIO)) {
    // Ponerlo al día no debe impedir crear la tarjeta: con un AnkiConnect antiguo, sigue el diseño que haya.
    await disenoModeloPropio(false).catch(() => {});
    return;
  }
  await invocar('createModel', {
    modelName: MODELO_PROPIO,
    inOrderFields: CAMPOS_PROPIOS,
    css: CSS_TARJETA,
    isCloze: false,
    cardTemplates: [{ Name: NOMBRE_PLANTILLA, Front: ANVERSO, Back: reverso() }],
  });
}

export type DisenoTarjetas = 'sin-modelo' | 'al-dia' | 'actualizado' | 'personalizado';

/**
 * Pone el tipo de nota «Kotonoha» que ya está en Anki con el diseño de ahora. Solo si nadie lo tocó, porque es el de
 * antes tal cual (su estilo y su plantilla), o si se pide a mano: lo cambiado a mano se perdería. Al cambiarlo, todas
 * las tarjetas que ya tiene se ven con el diseño nuevo.
 */
export async function disenoModeloPropio(forzar: boolean): Promise<DisenoTarjetas> {
  const modelos = await invocar<string[]>('modelNames');
  if (!modelos.includes(MODELO_PROPIO)) return 'sin-modelo';
  const { css } = await invocar<{ css: string }>('modelStyling', { modelName: MODELO_PROPIO });
  if (css.includes(MARCA_PLANTILLA) && !forzar) return 'al-dia';
  if (!forzar) {
    const plantillas = await invocar<Record<string, { Front: string; Back: string }>>('modelTemplates', { modelName: MODELO_PROPIO });
    const p = plantillas[NOMBRE_PLANTILLA];
    const sinTocar = mismoCss(css, CSS_PLANTILLA_1) && !!p && mismoCss(p.Front, ANVERSO_PLANTILLA_1) && mismoCss(p.Back, REVERSO_PLANTILLA_1) && Object.keys(plantillas).length === 1;
    if (!sinTocar) return 'personalizado';
  }
  await invocar('updateModelTemplates', { model: { name: MODELO_PROPIO, templates: { [NOMBRE_PLANTILLA]: { Front: ANVERSO, Back: reverso() } } } });
  await invocar('updateModelStyling', { model: { name: MODELO_PROPIO, css: CSS_TARJETA } });
  return 'actualizado';
}

async function asegurarMazo(mazo: string) {
  await invocar('createDeck', { deck: mazo });
}

function adjuntos(medios: MedioTarjeta[], campo: string | undefined) {
  if (!campo) return [];
  return medios
    .filter((m) => m.datos || m.url)
    .map((m) => ({
      filename: m.nombre,
      ...(m.datos ? { data: m.datos } : { url: m.url }),
      fields: [campo],
    }));
}

const CORRESPONDENCIA_INICIAL: Record<string, keyof BorradorTarjeta | 'furigana'> = {
  Palabra: 'palabra',
  Lectura: 'lectura',
  Frase: 'frase',
  FraseFurigana: 'furigana',
  Traduccion: 'traduccion',
  Definicion: 'definicion',
  AudioFrase: 'audioFrase',
  AudioPalabra: 'audioPalabra',
  Imagen: 'imagenes',
  Ejemplos: 'ejemplos',
  Notas: 'notas',
  Fuente: 'fuente',
};

/** Para cada dato de la tarjeta, el campo de tu tipo de nota donde se guarda. */
function resolverCampos(a: Ajustes): Record<string, string> {
  if (a.ankiModelo === MODELO_PROPIO || !Object.keys(a.ankiCampos).length) {
    const salida: Record<string, string> = {};
    for (const [campo, dato] of Object.entries(CORRESPONDENCIA_INICIAL)) salida[dato] = campo;
    return salida;
  }
  return a.ankiCampos;
}

export async function crearNota(a: Ajustes, b: BorradorTarjeta): Promise<string> {
  if (a.ankiModelo === MODELO_PROPIO) await crearModeloPropio();
  await asegurarMazo(a.ankiMazo);
  const c = resolverCampos(a);
  const fields: Record<string, string> = {};
  const poner = (dato: string, valor: string | undefined) => {
    if (c[dato] && valor) fields[c[dato]] = valor;
  };
  poner('palabra', b.palabra);
  poner('lectura', b.lectura);
  poner('frase', b.frase);
  poner('furigana', b.fraseFurigana ?? b.frase);
  poner('traduccion', b.traduccion);
  poner('definicion', b.definicion);
  poner('ejemplos', b.ejemplos);
  poner('notas', b.notas);
  poner('fuente', b.url ? `<a href="${b.url}">${b.fuente ?? b.url}</a>` : b.fuente);

  const id = await invocar<number>('addNote', {
    note: {
      deckName: a.ankiMazo,
      modelName: a.ankiModelo,
      fields,
      options: { allowDuplicate: false, duplicateScope: 'deck' },
      // La lengua va también como etiqueta: la plantilla de Kotonoha elige con ella la letra (el chino no se escribe con la
      // del japonés), y en Anki se pueden buscar las de cada lengua.
      tags: [...new Set([...a.ankiEtiquetas.split(/\s+/).filter(Boolean), ...(b.etiquetas ?? []), `kotonoha::${a.idiomaObjetivo}`])],
      audio: [...adjuntos(b.audioFrase, c['audioFrase']), ...adjuntos(b.audioPalabra, c['audioPalabra'])],
      picture: adjuntos(b.imagenes, c['imagenes']),
    },
  });
  return String(id);
}

export async function tieneTarjeta(palabra: string): Promise<number[]> {
  return invocar<number[]>('findNotes', { query: `"${palabra.replace(/"/g, '')}"` });
}

export async function verTarjeta(palabra: string): Promise<void> {
  await invocar('guiBrowse', { query: `"${palabra.replace(/"/g, '')}"` });
}

/** Lee palabras de tus mazos para marcarlas como conocidas, según el intervalo de sus tarjetas. */
export async function palabrasDeAnki(consulta: string, campo: string, intervaloMinimo = 21): Promise<{ texto: string; conocida: boolean }[]> {
  const tarjetas = await invocar<number[]>('findCards', { query: consulta });
  const salida: { texto: string; conocida: boolean }[] = [];
  for (let i = 0; i < tarjetas.length; i += 500) {
    const lote = await invocar<{ interval: number; fields: Record<string, { value: string }> }[]>('cardsInfo', { cards: tarjetas.slice(i, i + 500) });
    for (const c of lote) {
      const valor = c.fields[campo]?.value;
      if (valor) salida.push({ texto: valor.replace(/<[^>]+>/g, '').replace(/\[[^\]]*\]/g, '').trim(), conocida: c.interval >= intervaloMinimo });
    }
  }
  return salida;
}
