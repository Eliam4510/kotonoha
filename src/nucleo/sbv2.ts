// Style-Bert-VITS2 JP-Extra, la arquitectura de las voces de AivisHub: lo que sus modelos ONNX esperan recibir, sin
// navegador ni ONNX. La parte de texto de la lengua da, para cada oración, sus fonemas, sus tonos (0 grave, 1 agudo) y
// cuántos fonemas le tocan a cada carácter del texto que lee el BERT. Aquí se pasa eso a los números de los tensores,
// como hacen su infer.py y su g2p.py: un 0 entre cada dos fonemas (add_blank) y los rasgos del BERT repetidos por fonema.

/** Los símbolos de Style-Bert-VITS2 (symbols.py), en su orden: los fonemas de sus tres lenguas y los signos. */
export const SIMBOLOS_SBV2 = [
  '_', 'AA', 'E', 'EE', 'En', 'N', 'OO', 'V', 'a', 'a:', 'aa', 'ae', 'ah', 'ai', 'an', 'ang', 'ao', 'aw', 'ay', 'b', 'by',
  'c', 'ch', 'd', 'dh', 'dy', 'e', 'e:', 'eh', 'ei', 'en', 'eng', 'er', 'ey', 'f', 'g', 'gy', 'h', 'hh', 'hy', 'i', 'i0',
  'i:', 'ia', 'ian', 'iang', 'iao', 'ie', 'ih', 'in', 'ing', 'iong', 'ir', 'iu', 'iy', 'j', 'jh', 'k', 'ky', 'l', 'm', 'my',
  'n', 'ng', 'ny', 'o', 'o:', 'ong', 'ou', 'ow', 'oy', 'p', 'py', 'q', 'r', 'ry', 's', 'sh', 't', 'th', 'ts', 'ty', 'u',
  'u:', 'ua', 'uai', 'uan', 'uang', 'uh', 'ui', 'un', 'uo', 'uw', 'v', 'van', 've', 'vn', 'w', 'x', 'y', 'z', 'zh', 'zy',
  '!', '?', '…', ',', '.', "'", '-', 'SP', 'UNK',
] as const;

/** Los signos que la voz lee como fonemas (las pausas y la entonación de pregunta). */
export const SIGNOS_SBV2 = ['!', '?', '…', ',', '.', "'", '-'] as const;

const ID_SIMBOLO = new Map<string, number>(SIMBOLOS_SBV2.map((s, i) => [s, i]));

/** JP-Extra solo habla una de las tres lenguas de la tabla: la de los tonos desde el 6 y el identificador 1. */
const TONO_DESDE = 6;
const ID_LENGUA = 1;

/** Lo que admite el BERT de una vez: 512 tokens, contando [CLS] y [SEP]. */
export const MAXIMO_CARACTERES_BERT = 510;

/** Los valores de Style-Bert-VITS2 (constants.py) y la pausa entre oraciones con que AivisSpeech une las líneas. */
export const PARAMETROS_SBV2 = { sdp: 0.2, ruido: 0.6, ruidoDuracion: 0.8, duracion: 1, pesoEstilo: 1, pausaEntreOracionesS: 0.5 } as const;

/** Lo que la parte de texto da para una oración. */
export interface EntradaSbv2 {
  /** Los fonemas, con «_» al principio y al final, y los signos como fonemas. */
  fonemas: string[];
  /** Uno por fonema: 0 grave, 1 agudo. */
  tonos: number[];
  /** El texto que lee el BERT: un token por carácter. */
  textoBert: string;
  /** Cuántos fonemas le tocan a cada carácter de `textoBert`, con un 1 delante y otro detrás por los «_». */
  word2ph: number[];
}

/** Los tensores de la voz para una oración, salvo los rasgos del BERT. */
export interface TensoresSbv2 {
  x: number[];
  tonos: number[];
  lenguas: number[];
  /** `word2ph` para los fonemas con los 0 intercalados: cada uno el doble, y uno más el primero. */
  word2ph: number[];
}

const intercalar = (xs: number[]): number[] => [...xs.flatMap((x) => [0, x]), 0];

/** Los números de los fonemas, los tonos y las lenguas, con un 0 entre cada dos, como espera el modelo. */
export function tensoresSbv2(e: EntradaSbv2): TensoresSbv2 {
  if (e.fonemas.length !== e.tonos.length) throw new Error(`${e.fonemas.length} fonemas y ${e.tonos.length} tonos`);
  const suma = e.word2ph.reduce((a, b) => a + b, 0);
  if (suma !== e.fonemas.length) throw new Error(`word2ph suma ${suma} y hay ${e.fonemas.length} fonemas`);
  const caracteres = [...e.textoBert].length;
  if (e.word2ph.length !== caracteres + 2) throw new Error(`word2ph tiene ${e.word2ph.length} entradas para ${caracteres} caracteres`);
  const ids = e.fonemas.map((f) => {
    const id = ID_SIMBOLO.get(f);
    if (id === undefined) throw new Error(`Fonema desconocido para la voz: «${f}»`);
    return id;
  });
  const word2ph = e.word2ph.map((n) => n * 2);
  word2ph[0] += 1;
  return {
    x: intercalar(ids),
    tonos: intercalar(e.tonos.map((t) => t + TONO_DESDE)),
    lenguas: intercalar(ids.map(() => ID_LENGUA)),
    word2ph,
  };
}

/** El vocabulario del BERT, de su vocab.txt: un token por línea, y su número es el de la línea. */
export function leerVocabulario(texto: string): Map<string, number> {
  return new Map(texto.split('\n').map((l, i) => [l.replace(/\r$/, ''), i]));
}

/** Los tokens del BERT de caracteres: [CLS], uno por carácter ([UNK] si no lo conoce) y [SEP]. */
export function tokensBert(texto: string, vocabulario: ReadonlyMap<string, number>): number[] {
  const id = (t: string) => {
    const n = vocabulario.get(t);
    if (n === undefined) throw new Error(`El vocabulario del BERT no tiene ${t}`);
    return n;
  };
  const desconocido = id('[UNK]');
  return [id('[CLS]'), ...[...texto].map((c) => vocabulario.get(c) ?? desconocido), id('[SEP]')];
}

/**
 * Los rasgos del BERT, uno por token, repetidos para cada fonema que le toca: de [tokens, dimensión] a [dimensión,
 * fonemas], que es como los recibe la voz. `word2ph` es el de los tensores, con los 0 intercalados.
 */
export function expandirRasgos(rasgos: Float32Array, word2ph: number[], dimension = 1024): Float32Array {
  if (rasgos.length !== word2ph.length * dimension) throw new Error(`El BERT dio ${rasgos.length / dimension} filas para ${word2ph.length} tokens`);
  const fonemas = word2ph.reduce((a, b) => a + b, 0);
  const salida = new Float32Array(dimension * fonemas);
  let columna = 0;
  word2ph.forEach((veces, token) => {
    for (let k = 0; k < veces; k++, columna++) for (let d = 0; d < dimension; d++) salida[d * fonemas + columna] = rasgos[token * dimension + d];
  });
  return salida;
}

/** El vector de un estilo, como get_style_vector: la media (el estilo 0) más su diferencia con ella, por el peso. */
export function vectorDeEstilo(vectores: Float32Array, estilo: number, peso: number = PARAMETROS_SBV2.pesoEstilo, dimension = 256): Float32Array {
  const filas = vectores.length / dimension;
  if (!Number.isInteger(estilo) || estilo < 0 || estilo >= filas) throw new Error(`La voz no tiene el estilo ${estilo}`);
  const salida = new Float32Array(dimension);
  for (let d = 0; d < dimension; d++) {
    const media = vectores[d];
    salida[d] = media + (vectores[estilo * dimension + d] - media) * peso;
  }
  return salida;
}
