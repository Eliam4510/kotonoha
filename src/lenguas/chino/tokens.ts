// Cómo se parte un texto chino en palabras y qué pinyin lleva cada una. Lógica pura: se puede probar sin navegador.
//
// El chino no separa las palabras con espacios. Se parte por máxima probabilidad, como jieba: de todas las maneras de
// cortar un trozo en palabras de los diccionarios, la que suma menos coste, y el coste de una palabra sale de su puesto
// en la lista de frecuencia (ley de Zipf). Así 银行 gana a 银 + 行, y 我们 a 我 + 们.
//
// El pinyin de una palabra de varias sílabas es el del diccionario: 意思 es yìsi, con el neutro. Si el diccionario da
// varias lecturas (长: cháng y zhǎng; 得: dé, de y děi), elige la lectura en contexto, la que da pinyin-pro para toda la
// frase, con unas reglas medidas para los casos en que se equivoca.

import type { ConsultasAnalisis, TokenUnido } from '../tipos';
import { normalizarPinyin, repartirPinyin, sinTonos } from './pinyin';

/** Lo más largo que se prueba como una sola palabra: los nombres propios y los chengyu caben de sobra. */
const MAS_LARGA = 12;
/** El coste fijo de cada palabra (el logaritmo de la constante de Zipf con unas 50.000 palabras): premia cortar menos. */
const COSTE_FIJO = 2.4;
/** Una palabra del diccionario que no está en la lista de frecuencia: como si fuera de las menos usadas. */
const COSTE_SIN_PUESTO = Math.log(80000);
/** Un carácter que no está en ningún diccionario: va solo, y solo si no queda otra. */
const COSTE_DESCONOCIDO = Math.log(1e7);

export type Existe = (termino: string) => boolean;

function coste(palabra: string, unCaracter: boolean, existe: Existe | undefined, rango: ConsultasAnalisis['rango']): number | null {
  const enDiccionario = !!existe?.(palabra);
  if (!unCaracter && !enDiccionario) return null;
  const puesto = rango?.(palabra);
  if (enDiccionario) return (puesto !== undefined ? Math.log(puesto) : COSTE_SIN_PUESTO) + COSTE_FIJO;
  return (puesto !== undefined ? Math.log(puesto) + COSTE_FIJO : COSTE_DESCONOCIDO);
}

/** Corta un trozo de ideogramas en las palabras más probables. */
export function partirIdeogramas(texto: string, existe?: Existe, rango?: ConsultasAnalisis['rango']): string[] {
  const c = [...texto];
  const n = c.length;
  const mejor = new Array<number>(n + 1).fill(Infinity);
  const desde = new Array<number>(n + 1).fill(0);
  mejor[0] = 0;
  for (let i = 0; i < n; i++) {
    if (mejor[i] === Infinity) continue;
    let palabra = '';
    for (let j = i; j < Math.min(n, i + MAS_LARGA); j++) {
      palabra += c[j];
      const k = coste(palabra, j === i, existe, rango);
      if (k === null) continue;
      if (mejor[i] + k < mejor[j + 1]) {
        mejor[j + 1] = mejor[i] + k;
        desde[j + 1] = i;
      }
    }
  }
  const salida: string[] = [];
  for (let j = n; j > 0; j = desde[j]) salida.unshift(c.slice(desde[j], j).join(''));
  return salida;
}

/** Las partículas y los auxiliares que se pueden marcar como conocidos, con la lectura en que lo son. */
const PARTICULAS: Record<string, string | null> = {
  的: 'de',
  了: 'le',
  吗: null,
  呢: null,
  吧: null,
  啊: null,
  呀: null,
  嘛: null,
  啦: null,
  么: null,
  哦: null,
  呗: null,
  着: 'zhe',
  地: 'de',
  得: 'de',
};

/** Lo que va tras un 得 que une un verbo con cómo se hace: 跑得很快, 说得不错. */
const TRAS_DE_GRADO = /^(很|非常|太|真|不|更|越|特别|挺|好|比较|还|够|多|这么|那么|有点)/;

/** Lo que va delante del 只 que cuenta animales y cosas (一只猫, 这只): si no, 只 es «solo» (zhǐ). */
const ANTES_DEL_CLASIFICADOR = /[一二两三四五六七八九十百千几这那每哪半各某]$/;
/** Lo que sigue al 倒 que es «en cambio, sin embargo» (dào), y no «caer» (dǎo). */
const TRAS_DAO = /^(是|也|不|很|还|向|真|好|挺|没|要|会|能)/;

/**
 * Corrige la lectura en contexto donde pinyin-pro se equivoca, medido con 200 frases contra pypinyin y repasado a mano:
 * 长得 (cháng → zhǎng), 得 entre un verbo y lo que dice cómo se hace (dé → de), 只 como «solo» (zhī → zhǐ) y 倒 como «en
 * cambio» (dǎo → dào).
 */
export function corregirContexto(palabras: string[], lecturas: string[][]): string[][] {
  return lecturas.map((silabas, i) => {
    const p = palabras[i];
    const despues = palabras.slice(i + 1).join('');
    if (p === '长' && palabras[i + 1] === '得') return ['zhǎng'];
    if (p === '得' && i > 0 && TRAS_DE_GRADO.test(despues)) return ['de'];
    if (p === '得' && palabras[i - 1] === '长') return ['de'];
    if (p === '只') return [ANTES_DEL_CLASIFICADOR.test(palabras[i - 1] ?? '') ? 'zhī' : 'zhǐ'];
    if (p === '倒' && TRAS_DAO.test(despues)) return ['dào'];
    return silabas;
  });
}

/**
 * Una palabra del diccionario que en esta frase son dos: 穿着 es «atuendo» (chuānzhuó), pero en 她穿着大衣 es 穿 y el 着
 * de lo que dura (zhe), como lo lee el contexto. Se parte cuando el diccionario solo la lee con zhuó y el contexto, zhe.
 */
export function separarAspecto(palabras: string[], silabas: string[][], lecturas: ConsultasAnalisis['lecturas']): { palabras: string[]; silabas: string[][] } {
  const p2: string[] = [];
  const s2: string[][] = [];
  palabras.forEach((p, i) => {
    const s = silabas[i];
    const delDiccionario = lecturas?.(p);
    if ([...p].length === 2 && p.endsWith('着') && s[1] === 'zhe' && delDiccionario?.length && delDiccionario.every((l) => sinTonos(l).endsWith('zhuo'))) {
      p2.push([...p][0], '着');
      s2.push([s[0]], ['zhe']);
    } else {
      p2.push(p);
      s2.push(s);
    }
  });
  return { palabras: p2, silabas: s2 };
}

/** De las lecturas del diccionario, la que casa con la que se oye en contexto: igual, igual sin mayúsculas, o sin tonos. */
export function elegirLectura(delDiccionario: readonly string[] | undefined, enContexto: string): string {
  if (!delDiccionario?.length) return enContexto;
  if (delDiccionario.length === 1) return delDiccionario[0];
  const contexto = normalizarPinyin(enContexto);
  const igual = (l: string) => normalizarPinyin(l) === contexto;
  const igualSinMayusculas = (l: string) => normalizarPinyin(l).toLowerCase() === contexto.toLowerCase();
  const sinTono = sinTonos(contexto);
  return (
    delDiccionario.find(igual) ??
    delDiccionario.find(igualSinMayusculas) ??
    delDiccionario.find((l) => sinTonos(l) === sinTono && l === l.toLowerCase()) ??
    delDiccionario.find((l) => sinTonos(l) === sinTono) ??
    delDiccionario.find((l) => l === l.toLowerCase()) ??
    delDiccionario[0]
  );
}

const IDEOGRAMAS = /[㐀-鿿豈-﫿〇]|[\u{20000}-\u{3134f}]/u;
const TROZOS = /((?:[㐀-鿿豈-﫿〇]|[\u{20000}-\u{3134f}])+)|([\p{Script=Latin}\p{N}][\p{Script=Latin}\p{N}'’.-]*)|(\s+)|([\s\S])/gu;

/** Un trozo que no es una palabra china: signos, espacios, letras latinas, cifras. */
function aparte(superficie: string, categoria: string): TokenUnido {
  return { superficie, lema: superficie, lectura: '', categoria, esPalabra: false, esGramatica: false, flexion: [], furigana: [{ texto: superficie }], inflexionado: false };
}

function palabra(superficie: string, lectura: string): TokenUnido {
  const particula = superficie in PARTICULAS && (PARTICULAS[superficie] === null || normalizarPinyin(lectura) === PARTICULAS[superficie]);
  // Los nombres propios llevan mayúscula en el pinyin de CC-CEDICT: Běijīng, Lǔ Xùn.
  const nombre = /^\p{Lu}/u.test(lectura);
  return {
    superficie,
    lema: superficie,
    lectura,
    categoria: particula ? 'particula' : nombre ? 'nombre' : 'palabra',
    esPalabra: true,
    esGramatica: particula,
    flexion: [],
    furigana: lectura ? repartirPinyin(superficie, lectura) : [{ texto: superficie }],
    inflexionado: false,
    ...(nombre ? { nombre: true } : {}),
  };
}

/**
 * Parte un texto en palabras. `enContexto` da, para un trozo de ideogramas, la sílaba de cada uno leída en su frase (la
 * de pinyin-pro); `partirSinDiccionario`, cómo cortarlo si aún no hay diccionarios.
 */
export function analizarChino(
  texto: string,
  enContexto: (ideogramas: string) => string[],
  existe?: Existe,
  consultas?: ConsultasAnalisis,
  partirSinDiccionario?: (ideogramas: string) => string[]
): TokenUnido[] {
  const salida: TokenUnido[] = [];
  for (const m of texto.matchAll(TROZOS)) {
    if (m[1]) {
      const partidas = existe || !partirSinDiccionario ? partirIdeogramas(m[1], existe, consultas?.rango) : partirSinDiccionario(m[1]);
      const silabas = enContexto(m[1]);
      let pos = 0;
      const porPartida = partidas.map((p) => {
        const largo = [...p].length;
        const s = silabas.slice(pos, pos + largo);
        pos += largo;
        return s;
      });
      const { palabras, silabas: porPalabra } = separarAspecto(partidas, porPartida, consultas?.lecturas);
      const corregidas = corregirContexto(palabras, porPalabra);
      // Las sílabas, juntas como en los diccionarios: con apóstrofo ante a, o, e (fāng'àn), para que se puedan volver a partir.
      palabras.forEach((p, i) => salida.push(palabra(p, elegirLectura(consultas?.lecturas?.(p), normalizarPinyin(corregidas[i].join(' '))))));
    } else if (m[2]) {
      salida.push(aparte(m[2], /^\p{N}+$/u.test(m[2]) ? 'numero' : 'extranjera'));
    } else {
      salida.push(aparte(m[0], m[3] ? 'espacio' : 'signo'));
    }
  }
  return salida;
}

export const esIdeograma = (c: string) => IDEOGRAMAS.test(c);
