// Cómo se dice una frase en chino, sílaba a sílaba: los tonos que cambian según el que les sigue (el sandhi de 一, de 不 y
// de dos terceros tonos seguidos), las sílabas sin tono propio y el 儿 que se pega a la de antes. Son reglas, sin IA:
// parten del pinyin de cada carácter, que el diccionario da con su tono de cita. Lo usan «Cómo suena» y la práctica de
// los tonos con el micrófono.

import { tm } from '../../compartido/i18n';
import type { SilabaTonal } from '../../nucleo/practicaTonos';
import type { SegmentoLectura, TrozoHablado } from '../tipos';
import { conTono, SILABAS, sinTonos, tonoDe } from './pinyin';

export type FenomenoChino = 'tercero' | 'yi' | 'bu' | 'neutro' | 'erhua';

export const FENOMENOS: Record<FenomenoChino, { nombre: string; explicacion: string }> = {
  tercero: {
    nombre: tm('Dos terceros tonos'),
    explicacion: tm('Un tercer tono delante de otro se dice con el segundo: 你好 suena níhǎo. En una racha de terceros, al hablar deprisa cambian todos menos el último.'),
  },
  yi: {
    nombre: tm('El tono de 一'),
    explicacion: tm('一 es yī sola, al final y al contar; delante de un cuarto tono se dice yí (一样, yíyàng), y delante de los demás, yì (一起, yìqǐ).'),
  },
  bu: { nombre: tm('El tono de 不'), explicacion: tm('不 es bù, pero delante de un cuarto tono se dice bú: 不是 suena búshì.') },
  neutro: {
    nombre: tm('Tono neutro'),
    explicacion: tm('Sin tono propio: corta y ligera, más alta o más baja según la sílaba de antes, como la segunda de 我们 o de 东西.'),
  },
  erhua: {
    nombre: tm('儿化 (erhua)'),
    explicacion: tm('El 儿 no es otra sílaba: su r se pega a la de antes, que pierde una n o una i del final. 一点儿 suena yìdiǎr.'),
  },
};

/** Lo que hace falta de cada palabra de la frase analizada. */
export interface PalabraHablada {
  superficie: string;
  esPalabra: boolean;
  furigana: SegmentoLectura[];
}

/** Una sílaba de la frase: un carácter, o dos con el 儿 que se le pega (点儿). */
export interface SilabaChina {
  texto: string;
  /** La palabra de la frase a la que pertenece. */
  palabra: number;
  /** Como la da el diccionario, con su tono de cita: yī, diǎnr. */
  escrita: string;
  /** Su tono de cita: del 1 al 4, o 5 el neutro. */
  tono: number;
  /** Como se dice en la frase, y con qué tono. */
  suena: string;
  tonoOido: number;
  fenomeno?: FenomenoChino;
  /** Otro tono que también vale: el tercero que, al hablar deprisa, pasa al segundo en una racha de terceros. */
  tambien?: number;
}

/** Un trozo de la frase: una sílaba, o lo que no lo es (signos, cifras, letras latinas), que corta la frase al hablar. */
export type TrozoChino = SilabaChina | { texto: string; palabra: number };

export const esSilaba = (t: TrozoChino | undefined): t is SilabaChina => !!t && 'escrita' in t;

/** Las cifras que se dicen una a una: un 一 al lado de ellas se cuenta, y no cambia (一九四九, 十一). */
const CIFRAS = new Set([...'〇零一二三四五六七八九']);
/** Tras estas, el 一 sigue en yī (十一, 一百一十); delante, cambia como ante cualquier otra (一百, yìbǎi). */
const UNIDADES = new Set([...'十百千万亿两']);
/** Lo que, tras 一, dice una fecha y no una cantidad: 一月 es enero (yīyuè), 一号, el día uno. */
const FECHAS = new Set([...'月号']);
/** El tono de verdad de las sílabas que el diccionario da en neutro detrás de 一: 一个 es yí ge, porque 个 es gè. */
const TONO_DEBAJO: Record<string, number> = { 个: 4 };

/** Las sílabas del 儿化 que pierden su final: a -n o a -i (wánr suena wár; kuàir, kuàr). */
function conR(silaba: string, tono: number): string {
  const base = sinTonos(silaba);
  let nueva: string;
  if (/ng$/.test(base)) nueva = `${base}r`;
  // La i que no suena como i, la de zhi o si: shìr suena shèr.
  else if (/^(zh|ch|sh|r|z|c|s)i$/.test(base)) nueva = `${base.slice(0, -1)}er`;
  // -ui y -un son uei y uen: huìr suena huèr. Tras j, q, x, y, la u es ü y va con las de -in.
  else if (/ui$/.test(base) || (/un$/.test(base) && !/^[jqxy]/.test(base))) nueva = `${base.slice(0, -1)}er`;
  else if (/in$/.test(base) || /^[jqxy]un$/.test(base)) nueva = `${base.slice(0, -1)}er`;
  else if (/[ae][in]$/.test(base)) nueva = `${base.slice(0, -1)}r`;
  else nueva = `${base}r`;
  return conTono(nueva, tono);
}

/** Si un trozo de lectura es una sola sílaba del pinyin. */
const esUnaSilaba = (lectura: string) => SILABAS.has(sinTonos(lectura));

/** Las sílabas y lo demás de una frase, con el tono que da el diccionario a cada carácter, antes de ningún cambio. */
function trozosDe(palabras: PalabraHablada[]): (TrozoChino & { conR?: boolean })[] {
  const trozos: (TrozoChino & { conR?: boolean })[] = [];
  palabras.forEach((p, w) => {
    const segmentos = p.esPalabra ? p.furigana : [{ texto: p.superficie }];
    for (const s of segmentos) {
      const lectura = s.lectura?.trim();
      const anterior = trozos[trozos.length - 1];
      // La «r» del 儿 se pega a la sílaba de antes.
      if (lectura === 'r' && esSilaba(anterior) && !(anterior as { conR?: boolean }).conR) {
        anterior.texto += s.texto;
        (anterior as { conR?: boolean }).conR = true;
        continue;
      }
      if (lectura && lectura !== 'r' && esUnaSilaba(lectura)) {
        const tono = tonoDe(lectura);
        trozos.push({ texto: s.texto, palabra: w, escrita: lectura, tono, suena: lectura, tonoOido: tono });
      } else trozos.push({ texto: s.texto, palabra: w });
    }
  });
  return trozos;
}

/** El tono de cita de una sílaba, para decidir el de 一 y 不 delante de ella: el de debajo si el diccionario la da en neutro. */
const tonoDebajo = (s: SilabaChina) => (s.tono === 5 ? TONO_DEBAJO[s.texto] ?? 5 : s.tono);

/** Lo que pasa con 一: se cuenta y no cambia, va entre dos verbos iguales (看一看) o cambia según el tono siguiente. */
function cambiarYi(trozos: TrozoChino[], i: number) {
  const s = trozos[i] as SilabaChina;
  const antes = trozos[i - 1];
  const despues = trozos[i + 1];
  if (!esSilaba(despues)) return;
  if (esSilaba(antes) && antes.texto === despues.texto) {
    s.tonoOido = 5;
    s.fenomeno = 'neutro';
    return;
  }
  if (esSilaba(antes) && (antes.texto === '第' || CIFRAS.has(antes.texto) || UNIDADES.has(antes.texto))) return;
  if (CIFRAS.has(despues.texto) || FECHAS.has(despues.texto)) return;
  // Al final de una palabra de varias sílabas (统一, 唯一, 万一) no cambia.
  if (despues.palabra !== s.palabra && esSilaba(antes) && antes.palabra === s.palabra) return;
  const siguiente = tonoDebajo(despues);
  if (siguiente === 5) return;
  s.tonoOido = siguiente === 4 ? 2 : 4;
  s.fenomeno = 'yi';
}

/** Lo que pasa con 不: entre dos verbos iguales (是不是) va sin tono, y delante de un cuarto tono pasa al segundo. */
function cambiarBu(trozos: TrozoChino[], i: number) {
  const s = trozos[i] as SilabaChina;
  const antes = trozos[i - 1];
  const despues = trozos[i + 1];
  if (!esSilaba(despues)) return;
  if (esSilaba(antes) && antes.texto === despues.texto) {
    s.tonoOido = 5;
    s.fenomeno = 'neutro';
  } else if (tonoDebajo(despues) === 4) {
    s.tonoOido = 2;
    s.fenomeno = 'bu';
  }
}

/**
 * Los terceros tonos seguidos de un tramo sin pausas. Dentro de cada palabra, en una racha de terceros pasan al segundo
 * todos menos el último (展览馆, zhánlánguǎn). Entre palabras se va de la última a la primera: una palabra que acaba en
 * tercero cambia si la siguiente empieza por uno, tal como esta suena ya (我很好: wǒ hén hǎo). Al hablar deprisa se
 * cambian todos los de la racha menos el último (wó hén hǎo): lo que cambiaría solo así queda como «también vale».
 */
function cambiarTerceros(tramo: SilabaChina[]) {
  const deCita = tramo.map((s) => s.tonoOido === 3);
  const cuidado = tramo.map((s) => s.tonoOido);
  // Dentro de cada palabra.
  for (let i = 0; i + 1 < tramo.length; i++) {
    if (tramo[i].palabra === tramo[i + 1].palabra && deCita[i] && deCita[i + 1]) cuidado[i] = 2;
  }
  // Entre palabras, de la última a la primera.
  for (let i = tramo.length - 2; i >= 0; i--) {
    if (tramo[i].palabra !== tramo[i + 1].palabra && cuidado[i] === 3 && cuidado[i + 1] === 3) cuidado[i] = 2;
  }
  tramo.forEach((s, i) => {
    const deprisa = deCita[i] && deCita[i + 1] ? 2 : s.tonoOido;
    if (cuidado[i] !== s.tonoOido) {
      s.tonoOido = cuidado[i];
      s.fenomeno = 'tercero';
    } else if (deprisa !== s.tonoOido) s.tambien = deprisa;
  });
}

/** Cómo se dice cada sílaba de una frase analizada, con lo que cambia al hablar; lo que no es sílaba, tal cual. */
export function frasesHabladas(palabras: PalabraHablada[]): TrozoChino[] {
  const trozos = trozosDe(palabras);
  trozos.forEach((t, i) => {
    if (!esSilaba(t)) return;
    if (t.texto === '一' && t.tono === 1) cambiarYi(trozos, i);
    else if (t.texto === '不' && t.tono === 4) cambiarBu(trozos, i);
  });
  // Los tramos sin pausas: un signo, una cifra o una palabra en letras latinas cortan la racha de terceros.
  let tramo: SilabaChina[] = [];
  for (const t of [...trozos, null]) {
    if (t && esSilaba(t)) {
      tramo.push(t);
      continue;
    }
    if (tramo.length > 1) cambiarTerceros(tramo);
    tramo = [];
  }
  for (const t of trozos) {
    if (!esSilaba(t)) continue;
    const conRr = (t as { conR?: boolean }).conR;
    delete (t as { conR?: boolean }).conR;
    if (conRr) {
      t.escrita += 'r';
      t.suena = conR(t.escrita.slice(0, -1), t.tonoOido);
      t.fenomeno = 'erhua';
    } else {
      if (t.tonoOido !== t.tono) t.suena = conTono(t.escrita, t.tonoOido);
      if (!t.fenomeno && t.tono === 5) t.fenomeno = 'neutro';
    }
  }
  return trozos;
}

/** Para «Cómo suena»: cada sílaba con su pinyin hablado encima; lo que cambia, con su fenómeno. */
export function comoSuenaChino(frase: string, palabras?: PalabraHablada[]): TrozoHablado[] {
  if (!palabras) return [{ texto: frase }];
  return frasesHabladas(palabras).map((t) => (esSilaba(t) ? { texto: t.texto, suena: t.suena, fenomeno: t.fenomeno } : { texto: t.texto }));
}

/** Los signos tras los que una pausa es natural. */
const PAUSA = /[，。！？；：、,.!?;:…—「」『』“”（）()]/;

/** Las sílabas de una frase para practicar sus tonos, con el tono con que se dicen. */
export function silabasParaPracticar(palabras: PalabraHablada[]): SilabaTonal[] {
  const trozos = frasesHabladas(palabras);
  const salida: SilabaTonal[] = [];
  trozos.forEach((t, i) => {
    if (!esSilaba(t)) {
      if (salida.length && PAUSA.test(t.texto)) salida[salida.length - 1].pausa = true;
      return;
    }
    salida.push({ texto: t.texto, lectura: t.suena, tono: t.tonoOido, ...(t.tambien ? { tambien: t.tambien } : {}), pausa: !trozos[i + 1] });
  });
  return salida;
}
