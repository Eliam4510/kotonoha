// Las marcas de repetición de una letra pegada, desplegadas. Muchas letras escriben el estribillo una vez y luego solo
// dicen dónde vuelve: el título de la sección otra vez sin nada debajo («[Chorus]»), «(Repeat Chorus)», «サビ繰り返し»,
// «※くり返し» o «×2» bajo una estrofa. Aquí se despliegan tal como lo dice la letra, antes de colocarla: sin IA y sin
// inventar nada, solo copiando los versos que la propia letra señala.

import { noSeCanta, versosDelRenglon } from './noSeCanta';

/** Un renglón entero entre corchetes o paréntesis: lo que va dentro. */
const ENVUELTO = /^[[【〔［(（<＜]\s*(.*?)\s*[\]】〕］)）>＞]$/u;
/** «repetir» en las lenguas de estudio, como palabra suelta o pegada detrás del nombre de la sección («サビ繰り返し»). */
const REPETIR = new RegExp(String.raw`(?:repeat|repite|wiederholung|リピート|繰り返し|くり返し|くりかえし|重复|반복)`, 'iu');
/** Los nombres del estribillo, que se tratan como uno solo: «(Repeat Chorus)» vale para «[サビ]». */
const ESTRIBILLO = new RegExp(String.raw`^(?:chorus|hook|refrain|coro|estribillo|refrän|サビ|副歌|후렴)$`, 'iu');
/** Las veces al final: «×2», «x3». */
const VECES = /[x×]\s*([0-9])$/iu;
/** Lo que separa palabras: espacios (también el ideográfico), comas y el punto medio del japonés. */
const SEPARADOR = new RegExp(`[\\s,${String.fromCharCode(0x3000, 0x3001, 0x30fb)}]+`, 'u');
/** El ※ (o ＊, ☆) que marca un bloque que luego se repite. */
const SIMBOLO = /^[※＊*☆★]/u;

/** El nombre de una sección, para compararla con otra: sin signos ni mayúsculas, y el estribillo con un solo nombre. */
function nombreDe(texto: string): string {
  const limpio = texto.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  return ESTRIBILLO.test(limpio) ? 'estribillo' : limpio;
}

type Renglon =
  | { tipo: 'vacio'; texto: string }
  | { tipo: 'verso'; texto: string; simbolo: boolean }
  /** Un título de sección; `veces`, si dice cuántas se canta («[Chorus x2]»). */
  | { tipo: 'titulo'; texto: string; nombre: string; veces: number }
  /** Una orden de repetir: una sección, el bloque del ※ o la estrofa de antes, tantas veces. */
  | { tipo: 'repetir'; texto: string; seccion?: string; simbolo?: boolean; veces: number };

/** Qué es cada renglón: un verso, un título, una orden de repetir o una línea vacía. */
function clasificar(texto: string): Renglon {
  const r = texto.trim();
  if (!r) return { tipo: 'vacio', texto };
  const envuelto = ENVUELTO.exec(r);
  const dentro = (envuelto?.[1] ?? r.replace(/[:：]$/, '')).normalize('NFKC').trim();
  // ※くり返し, (※くり返し), ※ solo: repetir el bloque del ※. Un ※ delante de un verso lo marca.
  if (SIMBOLO.test(dentro)) {
    const resto = dentro.replace(SIMBOLO, '').trim();
    if (!resto || (REPETIR.test(resto) && resto.replace(REPETIR, '').trim() === '')) return { tipo: 'repetir', texto, simbolo: true, veces: 1 };
    return { tipo: 'verso', texto: r.replace(SIMBOLO, '').trim(), simbolo: true };
  }
  const palabras = dentro.split(SEPARADOR).filter(Boolean);
  const marca = envuelto || /[:：]$/.test(r) || palabras.length <= 3;
  if (!marca || palabras.length > 4) return { tipo: 'verso', texto, simbolo: false };
  const veces = VECES.exec(dentro);
  const sinVeces = dentro.replace(VECES, '').trim();
  // «x2» solo: repetir la estrofa de antes.
  if (veces && !sinVeces) return { tipo: 'repetir', texto, veces: Number(veces[1]) - 1 };
  if (REPETIR.test(sinVeces)) {
    const seccion = sinVeces.replace(REPETIR, '').trim();
    return { tipo: 'repetir', texto, seccion: seccion ? nombreDe(seccion) : undefined, veces: veces ? Number(veces[1]) : 1 };
  }
  // Un título: entre corchetes, o entre paréntesis o con dos puntos si nombra una sección. Lo demás entre paréntesis es
  // una segunda voz que se canta («(Shine, your future shine)»), y tres palabras sueltas, un verso corto.
  const corchetes = !!envuelto && /^[[【〔［]/u.test(r);
  const nombraSeccion = noSeCanta(`(${sinVeces})`);
  if (corchetes || ((envuelto || /[:：]$/.test(r)) && nombraSeccion)) return { tipo: 'titulo', texto, nombre: nombreDe(sinVeces), veces: veces ? Number(veces[1]) : 1 };
  return { tipo: 'verso', texto, simbolo: false };
}

/**
 * La letra con sus repeticiones desplegadas: cada marca que pide repetir algo se cambia por esos versos, y los títulos se
 * quitan, que no se cantan. Una orden que no se puede cumplir («Repeat after me», que quizá se canta) se deja como está.
 */
export function desplegarMarcas(texto: string): string {
  const renglones = texto.split(/\r?\n/).map(clasificar);
  // Lo que lleva debajo cada título la primera vez que tiene versos.
  const secciones = new Map<string, string[]>();
  for (let k = 0; k < renglones.length; k++) {
    const r = renglones[k];
    if (r.tipo !== 'titulo' || secciones.has(r.nombre)) continue;
    const versos: string[] = [];
    for (let n = k + 1; n < renglones.length; n++) {
      const s = renglones[n];
      if (s.tipo !== 'verso') break;
      versos.push(s.texto);
    }
    if (versos.length) secciones.set(r.nombre, versos);
  }
  const salida: string[] = [];
  let estrofa: string[] = [];
  let simbolo: string[] = [];
  let enSimbolo = false;
  /** Lo que se canta de una sección abierta con «[Chorus x2]»: se repite al cerrarla. */
  let abierta: { versos: string[]; veces: number } | null = null;
  const cerrar = () => {
    if (abierta) for (let n = 1; n < abierta.veces; n++) salida.push(...abierta.versos);
    abierta = null;
  };
  for (let k = 0; k < renglones.length; k++) {
    const r = renglones[k];
    if (r.tipo === 'vacio') {
      cerrar();
      estrofa = [];
      enSimbolo = false;
      salida.push(r.texto);
    } else if (r.tipo === 'verso') {
      if (r.simbolo && !enSimbolo) {
        simbolo = [];
        enSimbolo = true;
      }
      if (enSimbolo) simbolo.push(r.texto);
      estrofa.push(r.texto);
      abierta?.versos.push(r.texto);
      salida.push(r.texto);
    } else if (r.tipo === 'titulo') {
      cerrar();
      estrofa = [];
      enSimbolo = false;
      // Con versos justo debajo, el título abre su sección; seguido de una línea vacía o de otra marca, vuelve solo.
      if (renglones[k + 1]?.tipo === 'verso') abierta = { versos: [], veces: r.veces };
      else for (let n = 0; n < r.veces; n++) salida.push(...(secciones.get(r.nombre) ?? []));
    } else {
      cerrar();
      const bloque = r.simbolo ? simbolo : r.seccion !== undefined ? secciones.get(r.seccion) : [...estrofa];
      if (!bloque?.length) {
        // No se sabe qué repetir: se deja el renglón, que quizá se canta.
        estrofa.push(r.texto);
        salida.push(r.texto);
        continue;
      }
      for (let n = 0; n < r.veces; n++) salida.push(...bloque);
      enSimbolo = false;
    }
  }
  cerrar();
  return salida.join('\n');
}

/**
 * Lo que se canta de un renglón leído suelto, para colocar una letra que ordenó Claude: nada si es un título, una orden de
 * repetir o algo que no se canta; sin el ※ que lo marca, la marca de sección de delante ni su «×2».
 */
export function cantadoDelRenglon(renglon: string): string {
  const r = clasificar(renglon);
  if (r.tipo !== 'verso' || noSeCanta(r.texto)) return '';
  const cantado = versosDelRenglon(r.texto)[0] ?? '';
  return /[\p{L}\p{N}]/u.test(cantado) ? cantado : '';
}
