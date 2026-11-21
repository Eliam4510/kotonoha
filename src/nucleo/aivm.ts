// Las voces de AivisHub vienen en AIVMX: un modelo ONNX que lleva en sus metadatos (metadata_props) la ficha de la voz
// (nombre, hablantes y estilos, licencia), los hiperparámetros con que se entrenó y los vectores de cada estilo, en un
// .npy en base64. Aquí se leen esos metadatos recorriendo solo el primer nivel del protobuf: el grafo, que pesa cientos de
// MB, se salta entero. Sin navegador ni ONNX.

/** La única arquitectura que Kotonoha sabe leer: la de casi todo AivisHub. */
export const ARQUITECTURA_COMPATIBLE = 'Style-Bert-VITS2 (JP-Extra)';

export interface EstiloAivm {
  nombre: string;
  /** Su número en el modelo: la fila de su vector. */
  id: number;
}

export interface HablanteAivm {
  nombre: string;
  /** Su número en el modelo (el `sid`). */
  id: number;
  estilos: EstiloAivm[];
  /** Su imagen, como URL de datos, si la trae. */
  icono?: string;
}

export interface FichaAivm {
  uuid: string;
  nombre: string;
  version: string;
  arquitectura: string;
  /** El texto de la licencia, en Markdown. */
  licencia: string;
  creadores: string[];
  hablantes: HablanteAivm[];
  frecuencia: number;
}

export interface VozAivm {
  ficha: FichaAivm;
  /** Los vectores de estilo, una fila de `dimension` por estilo. */
  estilos: Float32Array;
  dimension: number;
}

/** Un número varint de protobuf: hasta 2^53 cabe en un número de JavaScript. */
function varint(datos: Uint8Array, desde: number): [number, number] {
  let valor = 0;
  let escala = 1;
  let i = desde;
  for (;;) {
    if (i >= datos.length) throw new Error('Protobuf cortado');
    const b = datos[i++];
    valor += (b & 0x7f) * escala;
    if (!(b & 0x80)) return [valor, i];
    escala *= 128;
  }
}

/** Los campos de primer nivel de un mensaje protobuf: número, tipo y, en los de longitud, dónde está su contenido. */
function* campos(datos: Uint8Array, inicio = 0, fin = datos.length): Generator<{ numero: number; desde: number; hasta: number }> {
  let i = inicio;
  while (i < fin) {
    const [clave, j] = varint(datos, i);
    const numero = Math.floor(clave / 8);
    const tipo = clave % 8;
    i = j;
    if (tipo === 0) [, i] = varint(datos, i);
    else if (tipo === 1) i += 8;
    else if (tipo === 5) i += 4;
    else if (tipo === 2) {
      const [largo, k] = varint(datos, i);
      if (k + largo > fin) throw new Error('Protobuf cortado');
      yield { numero, desde: k, hasta: k + largo };
      i = k + largo;
    } else throw new Error(`Tipo de campo ${tipo} inesperado en un modelo ONNX`);
  }
}

/** Los metadata_props de un modelo ONNX (campo 14 de ModelProto, pares de clave 1 y valor 2). */
export function metadatosOnnx(datos: Uint8Array): Map<string, string> {
  const texto = new TextDecoder();
  const salida = new Map<string, string>();
  for (const c of campos(datos)) {
    if (c.numero !== 14) continue;
    let clave = '';
    let valor = '';
    for (const p of campos(datos, c.desde, c.hasta)) {
      const s = texto.decode(datos.subarray(p.desde, p.hasta));
      if (p.numero === 1) clave = s;
      else if (p.numero === 2) valor = s;
    }
    salida.set(clave, valor);
  }
  return salida;
}

/** Una matriz de un .npy de NumPy en float32 little-endian, la forma en que AIVM guarda los vectores de estilo. */
export function leerNpy(datos: Uint8Array): { forma: number[]; valores: Float32Array } {
  const firma = String.fromCharCode(...datos.subarray(1, 6));
  if (datos[0] !== 0x93 || firma !== 'NUMPY') throw new Error('No es un archivo .npy');
  const vista = new DataView(datos.buffer, datos.byteOffset, datos.byteLength);
  const version = datos[6];
  const largoCabecera = version === 1 ? vista.getUint16(8, true) : vista.getUint32(8, true);
  const inicio = version === 1 ? 10 : 12;
  const cabecera = new TextDecoder().decode(datos.subarray(inicio, inicio + largoCabecera));
  if (!/'descr':\s*'<f4'/.test(cabecera)) throw new Error('Los vectores de estilo no son float32');
  if (/'fortran_order':\s*True/.test(cabecera)) throw new Error('Los vectores de estilo están en orden de Fortran');
  const forma = (/'shape':\s*\(([^)]*)\)/.exec(cabecera)?.[1] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number);
  const n = forma.reduce((a, b) => a * b, 1);
  const desde = inicio + largoCabecera;
  if (desde + n * 4 > datos.length) throw new Error('El .npy está cortado');
  // Se copia: el desplazamiento no tiene por qué ser múltiplo de 4.
  return { forma, valores: new Float32Array(datos.slice(desde, desde + n * 4).buffer) };
}

function base64ABytes(b64: string): Uint8Array {
  const binario = atob(b64.trim());
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

interface ManifiestoAivm {
  uuid: string;
  name: string;
  version: string;
  model_architecture: string;
  license?: string;
  creators?: string[];
  speakers: { name: string; local_id: number; icon?: string; styles: { name: string; local_id: number }[] }[];
}

/** La ficha, los hiperparámetros y los vectores de estilo de una voz AIVMX. Si no lo es o no es compatible, un error. */
export function leerAivmx(datos: Uint8Array): VozAivm {
  const meta = metadatosOnnx(datos);
  const textoManifiesto = meta.get('aivm_manifest');
  const textoHiper = meta.get('aivm_hyper_parameters');
  const textoEstilos = meta.get('aivm_style_vectors');
  if (!textoManifiesto || !textoHiper || !textoEstilos) throw new Error('No es una voz AIVMX');
  const m = JSON.parse(textoManifiesto) as ManifiestoAivm;
  if (m.model_architecture !== ARQUITECTURA_COMPATIBLE) throw new Error(`La voz es de otra arquitectura: ${m.model_architecture}`);
  const hiper = JSON.parse(textoHiper) as { data?: { sampling_rate?: number } };
  const { forma, valores } = leerNpy(base64ABytes(textoEstilos));
  if (forma.length !== 2) throw new Error('Los vectores de estilo no son una matriz');
  const hablantes = m.speakers.map((h) => ({
    nombre: h.name,
    id: h.local_id,
    estilos: h.styles.map((e) => ({ nombre: e.name, id: e.local_id })),
    ...(h.icon ? { icono: h.icon } : {}),
  }));
  for (const e of hablantes.flatMap((h) => h.estilos)) if (e.id >= forma[0]) throw new Error(`El estilo ${e.nombre} no tiene vector`);
  return {
    ficha: {
      uuid: m.uuid,
      nombre: m.name,
      version: m.version,
      arquitectura: m.model_architecture,
      licencia: m.license ?? '',
      creadores: m.creators ?? [],
      hablantes,
      frecuencia: hiper.data?.sampling_rate ?? 44100,
    },
    estilos: valores,
    dimension: forma[1],
  };
}
