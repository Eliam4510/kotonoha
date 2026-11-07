// De lo que entrega el analizador a las palabras que ve el programa. Lógica pura.
//
// El analizador separa las contracciones (ca + n't) y deja fuera los espacios. Aquí vuelven a ser una sola palabra,
// y las superficies juntas reproducen el texto tal cual, porque de eso depende que el lector encuentre cada palabra.

import { tm, tr } from '../../compartido/i18n';
import type { TokenUnido } from '../tipos';

/** Un token tal como lo entrega wink-nlp. */
export interface TokenCrudo {
  valor: string;
  /** Categoría gramatical: VERB, NOUN, PROPN... */
  pos: string;
  lema: string;
  /** word, number, punctuation, url... */
  tipo: string;
}

/** Categorías de las palabras que hacen de engranaje: se dan por conocidas para que no ahoguen a las demás. */
const POS_GRAMATICA = new Set(['DET', 'ADP', 'PRON', 'CCONJ', 'SCONJ', 'AUX', 'PART']);

const CLITICOS = new Set(["n't", "'s", "'re", "'ve", "'ll", "'d", "'m"]);

const CON_LETRAS = /\p{Script=Latin}/u;

/**
 * El texto que se le da al analizador, siempre con la misma longitud que el original. Los apóstrofos tipográficos no los
 * entiende, y unos subtítulos enteros en mayúsculas le parecen una lista de nombres propios.
 */
export function normalizarParaAnalisis(texto: string): string {
  const conRecto = texto.replace(/[’ʼ]/g, "'");
  if (/\p{Ll}/u.test(conRecto) || !/\p{Lu}.*\p{Lu}/su.test(conRecto)) return conRecto;
  const minusculas = conRecto.toLowerCase();
  return minusculas.length === conRecto.length ? minusculas : conRecto;
}

function noEsPalabra(superficie: string, pos = 'PUNCT'): TokenUnido {
  return { superficie, lema: superficie, lectura: '', categoria: pos, esPalabra: false, esGramatica: false, flexion: [], furigana: [{ texto: superficie }], inflexionado: false };
}

/** Qué le pasó a una palabra para llegar a su forma de diccionario. Lo irregular se nombra entero: went, children. */
function colaDe(superficie: string, lema: string, pos: string): string[] {
  const s = superficie.toLowerCase();
  const l = lema.toLowerCase();
  if (s === l) return [];
  if (pos === 'VERB' || pos === 'AUX') {
    if (s.endsWith('ing') && s.startsWith(l.slice(0, 2))) return ['-ing'];
    if (s.endsWith('ed') && s.startsWith(l.slice(0, 2))) return ['-ed'];
    if (s.endsWith('s') && s.startsWith(l.slice(0, 2))) return ['-s'];
    return [superficie];
  }
  if (pos === 'NOUN') return s.endsWith('s') && s.startsWith(l.slice(0, 2)) ? ['-s'] : [superficie];
  if (pos === 'ADJ' || pos === 'ADV') {
    if (s.endsWith('est') && s.startsWith(l.slice(0, 2))) return ['-est'];
    if (s.endsWith('er') && s.startsWith(l.slice(0, 2))) return ['-er'];
    return [superficie];
  }
  return [];
}

function palabra(superficie: string, c: TokenCrudo, existe?: (termino: string) => boolean): TokenUnido {
  const minuscula = c.valor.toLowerCase();
  let lema = c.lema.toLowerCase() || minuscula;
  let esNombre = c.pos === 'PROPN';
  // Una palabra corriente al principio de la frase puede parecer un nombre: el diccionario lo aclara.
  if (esNombre && existe?.(minuscula) && !existe(superficie)) esNombre = false;
  if (esNombre) lema = superficie;
  else if (existe && !existe(lema) && existe(minuscula)) lema = minuscula;
  // El pronombre siempre va en mayúscula, también si se escribió «i» o el subtítulo venía todo en mayúsculas.
  if (minuscula === 'i') lema = 'I';
  return {
    superficie,
    lema,
    // Aquí la lectura no distingue nada: la palabra es su propia lectura, como la de una palabra en kana.
    lectura: lema,
    categoria: c.pos,
    esPalabra: true,
    esGramatica: POS_GRAMATICA.has(c.pos) || esNombre,
    flexion: esNombre ? [] : colaDe(superficie, lema, c.pos),
    furigana: [{ texto: superficie }],
    inflexionado: false,
  };
}

/**
 * Une los tokens en palabras. `texto` es el original y `normal` el que vio el analizador, de la misma longitud: lo que se
 * enseña sale siempre del original.
 */
export function unirTokens(texto: string, normal: string, crudos: TokenCrudo[], existe?: (termino: string) => boolean): TokenUnido[] {
  const salida: TokenUnido[] = [];
  let pos = 0;
  for (const c of crudos) {
    const i = normal.indexOf(c.valor, pos);
    if (i < 0) continue;
    if (i > pos) salida.push(noEsPalabra(texto.slice(pos, i), 'SPACE'));
    const superficie = texto.slice(i, i + c.valor.length);
    const clitico = c.valor.toLowerCase();
    const previa = salida[salida.length - 1];
    // Sin espacio delante, n't y compañía son parte de la palabra anterior: don't, she's, John's.
    if (i === pos && CLITICOS.has(clitico) && previa?.esPalabra) {
      // De la flexión se va la parte irregular (ca, wo, did): con la contracción, lo que se ve es can't, won't, didn't.
      previa.flexion = [...previa.flexion.filter((f) => f !== previa.superficie), clitico];
      previa.superficie += superficie;
      previa.furigana = [{ texto: previa.superficie }];
    } else if (/^i'(m|d|ll|ve)$/i.test(c.valor)) {
      // El analizador a veces deja «I'm» entero, y lo toma por un nombre.
      salida.push({ ...palabra(superficie.slice(0, 1), { ...c, valor: 'I', pos: 'PRON', lema: 'I' }), superficie, furigana: [{ texto: superficie }], flexion: [clitico.slice(1)] });
    } else if (c.tipo === 'word' && CON_LETRAS.test(c.valor) && c.pos !== 'PUNCT' && c.pos !== 'SYM') {
      salida.push(palabra(superficie, c, existe));
    } else {
      salida.push(noEsPalabra(superficie, c.pos));
    }
    pos = i + c.valor.length;
  }
  if (pos < texto.length) salida.push(noEsPalabra(texto.slice(pos), 'SPACE'));
  return existe ? unirGuiones(salida, existe) : salida;
}

/** Las palabras con guion son una sola si el diccionario las recoge: well-known, mother-in-law. */
function unirGuiones(tokens: TokenUnido[], existe: (termino: string) => boolean): TokenUnido[] {
  const salida: TokenUnido[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    let unida = false;
    if (t.esPalabra && tokens[i + 1]?.superficie === '-' && tokens[i + 2]?.esPalabra) {
      let fin = i + 2;
      while (tokens[fin + 1]?.superficie === '-' && tokens[fin + 2]?.esPalabra) fin += 2;
      // Del más largo al más corto: mother-in-law antes que mother-in.
      for (let f = fin; f > i && !unida; f -= 2) {
        const junto = tokens.slice(i, f + 1).map((x) => x.superficie).join('');
        if (existe(junto.toLowerCase())) {
          const lema = junto.toLowerCase();
          salida.push({ ...t, superficie: junto, lema, lectura: lema, categoria: 'NOUN', esGramatica: false, flexion: [], furigana: [{ texto: junto }] });
          i = f;
          unida = true;
        }
      }
    }
    if (!unida) salida.push(t);
  }
  return salida;
}

const NOMBRES_FLEXION: Record<string, string> = {
  '-s': tm('plural o tercera persona'),
  '-ed': tm('pasado o participio'),
  '-ing': tm('gerundio o participio'),
  '-er': tm('comparativo'),
  '-est': tm('superlativo'),
  "n't": tm('negación'),
  "'s": tm('is, has o posesivo'),
  "'re": tm('contracción de are'),
  "'ve": tm('contracción de have'),
  "'ll": tm('contracción de will'),
  "'d": tm('contracción de would o had'),
  "'m": tm('contracción de am'),
};

export function nombreFlexion(cola: string): string | undefined {
  return tr(NOMBRES_FLEXION[cola] ?? tm('forma irregular'));
}

const SIGNOS_DE_CIERRE = /^[,.!?;:)\]"”’…]/u;
const SIGNOS_DE_APERTURA = /[(["“‘]$/u;
const UNIR = '⁠';

/** Cada palabra se pinta como un bloque, y entre bloques el navegador puede cortar la línea: una coma no debe quedar sola. */
export function pegarSignos(signos: string): string {
  const conCierre = SIGNOS_DE_CIERRE.test(signos) ? `${UNIR}${signos}` : signos;
  return SIGNOS_DE_APERTURA.test(conCierre) ? `${conCierre}${UNIR}` : conCierre;
}
