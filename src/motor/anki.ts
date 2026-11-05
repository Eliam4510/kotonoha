// Conexión con Anki a través del complemento AnkiConnect.

import type { Ajustes } from '../compartido/ajustes';
import type { BorradorTarjeta, EstadoAnki, MedioTarjeta } from '../compartido/tipos';

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
    throw new Error('Anki no responde. Ábrelo y comprueba que AnkiConnect está instalado.');
  }
  if (r.status === 403) throw new Error('Anki rechazó la conexión: pulsa «Conectar con Anki» en Ajustes y acepta el aviso en Anki.');
  const d = (await r.json()) as { result: T; error: string | null };
  if (d.error) throw new Error(d.error);
  return d.result;
}

/** Pide permiso para este origen; Anki muestra un cuadro de diálogo la primera vez. */
export async function pedirPermiso(): Promise<EstadoAnki> {
  const r = await invocar<{ permission: string }>('requestPermission');
  if (r.permission !== 'granted') throw new Error('Anki no concedió el permiso');
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

const CSS_TARJETA = `.card { font-family: "Zen Maru Gothic", "Hiragino Maru Gothic ProN", "Yu Gothic UI", "Noto Sans JP", sans-serif; font-size: 22px; text-align: center; color: #1B2217; background: #F5F2E9; line-height: 1.65; padding: 12px; }
.frase { font-size: 30px; font-weight: 700; margin: 18px 0; }
.frase b { color: #E8622E; font-weight: 700; }
.palabra { font-size: 26px; font-weight: 700; color: #4C9A1F; }
.lectura { color: #848D7C; font-size: 17px; }
.traduccion { color: #525C4C; margin-top: 12px; }
.definicion { text-align: left; margin: 16px auto; max-width: 640px; font-size: 18px; padding: 12px 18px; background: #FFFEFA; border-radius: 16px; }
.notas { text-align: left; margin: 14px auto; max-width: 640px; font-size: 16px; color: #525C4C; }
.fuente, .fuente a { color: #848D7C; font-size: 13px; margin-top: 14px; }
hr#answer { border: 0; border-top: 1px solid rgba(46, 56, 34, 0.14); margin: 18px 0; }
img { max-width: 100%; max-height: 320px; border-radius: 16px; }
.card.nightMode { background: #0D1210; color: #F2F5EE; }
.nightMode .frase b { color: #FF9166; }
.nightMode .palabra { color: #A9E45B; }
.nightMode .traduccion, .nightMode .notas { color: #B5BFB5; }
.nightMode .definicion { background: #151B18; }
.nightMode hr#answer { border-top-color: rgba(226, 240, 226, 0.14); }`;

export async function crearModeloPropio(): Promise<void> {
  const modelos = await invocar<string[]>('modelNames');
  if (modelos.includes(MODELO_PROPIO)) return;
  await invocar('createModel', {
    modelName: MODELO_PROPIO,
    inOrderFields: CAMPOS_PROPIOS,
    css: CSS_TARJETA,
    isCloze: false,
    cardTemplates: [
      {
        Name: 'Frase',
        Front: '<div class="frase">{{Frase}}</div>{{AudioFrase}}',
        Back: `<div class="frase">{{furigana:FraseFurigana}}</div>{{AudioFrase}}
<hr id="answer">
<div class="palabra">{{Palabra}}</div><div class="lectura">{{Lectura}}</div>{{AudioPalabra}}
<div class="traduccion">{{Traduccion}}</div>
<div class="definicion">{{Definicion}}</div>
<div>{{Imagen}}</div>
<div class="notas">{{Notas}}</div>
<div class="notas">{{Ejemplos}}</div>
<div class="fuente">{{Fuente}}</div>`,
      },
    ],
  });
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
      tags: [...a.ankiEtiquetas.split(/\s+/).filter(Boolean), ...(b.etiquetas ?? [])],
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
