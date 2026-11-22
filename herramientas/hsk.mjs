// Genera publico/datos/hsk/, las listas de cada nivel del HSK 3.0 que usa la pantalla «Niveles», con el temario publicado
// en noviembre de 2025 (中文水平考试HSK考试大纲), en que se basa el examen desde diciembre de 2026:
// - vocabulario.json y kanji.json (los hanzi de cada nivel), de las listas de krmanik/HSK-3.0 (Mani, CC BY-SA 4.0), con
//   la lectura y la glosa de CC-CEDICT (CC BY-SA 4.0). La lectura tiene que ser la del diccionario, que es la que llevan
//   las palabras guardadas: la del temario aplica los cambios de tono de 一 y 不 (bú kèqi).
// - gramatica.json, de la gramática del temario (en chino), con lo que significa cada categoría y cada estructura fija en
//   español y en inglés: herramientas/hsk/categorias.tsv y herramientas/hsk/estructuras.tsv, escritos para Kotonoha.
// Todo de direcciones fijadas y comprobado con SHA-256; se baja una vez a node_modules/.cache/kotonoha/.
// Uso: node herramientas/hsk.mjs

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import { bajar, CC_CEDICT } from './chino-datos.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const SALIDA = join(RAIZ, 'publico', 'datos', 'hsk');
const FUENTE = 'krmanik/HSK-3.0 (Mani, CC BY-SA 4.0), temario del HSK de 2025; lecturas y glosas de CC-CEDICT (MDBG, CC BY-SA 4.0)';
const NIVELES = ['1', '2', '3', '4', '5', '6', '7-9'];
const COMMIT = '6d52713bac89a74917a26363e1963be1c79d2265';
const BASE = `https://raw.githubusercontent.com/krmanik/HSK-3.0/${COMMIT}/New%20HSK%20(2025)`;

const HUELLAS = {
  'gramatica-1.json': '5b4809b3ed2b8a3fc34751b436b2345f28c5a4907a6e960879f518d96dd6cf7a',
  'gramatica-2.json': 'f7444e74b09e6d1c1be3ead9322460f4a6402711ef3b4a6b1208a9d26d35769c',
  'gramatica-3.json': '932f18386da53d3bfae6686708babd1180d8fdb83769a7eadc02a8b8c5ae9cda',
  'gramatica-4.json': '44f92d6b3acbb30a30ccaf4c6509f457d2f99c06ac11075b7274229376e0110c',
  'gramatica-5.json': '5ee2411aeb4a398210ad8c98e6ede9c1d23c7a279f56d817aff6c2f00a4cfde7',
  'gramatica-6.json': '877b4b509a32198f5c9c560fa376999df42cbb3715eab225327b571736f39268',
  'gramatica-7-9.json': '71a74ba053bb9a0e4edd0e10d53ae9dac8b4e7809ed169c0f286203e3fb66c81',
  'hanzi-1.txt': '9ecaf501698a5d0c78302ad5b36160a289922bd78a83434b54077323cbebd738',
  'hanzi-2.txt': '55582ad65ecbda6467eab9e867325d1d78973ec44be4260f20b52788ca379412',
  'hanzi-3.txt': 'b2cc6dd3fcddf9e420a78439819e838d24c342541c32976ed3ed742ce4441645',
  'hanzi-4.txt': '5f78de560e204350583b10f19cf7594ca4cd0e209354b7d3c02285a1ffcdfba5',
  'hanzi-5.txt': 'fd31b9a801fdef849e98893c29aaa58dc190a7b7ee3c71382ecbacf43ff109c2',
  'hanzi-6.txt': 'a07d1705b0b351fbbb705b791a524161239fc86469c7ee0e3afba2c3b2cdaa0b',
  'hanzi-7-9.txt': 'c1ddb71962e686086d7a8e76b1428b13a00c6af5103d84e65d6fa8eaafa51d9d',
  'words-1.txt': '02d551ce2024607d6bae3695581d74bd449574bb1759402a58e7de47817ff307',
  'words-2.txt': '07ca5598cd394aedd2ba6819a67f0fe05ec25cc08e04d132a37ee0048fd3a5c0',
  'words-3.txt': 'b7d5d816d874e9bc73fce58c6d6b943c881df42cf305eff004e673bcf81177a1',
  'words-4.txt': 'b0352dd56a0a8f0cd18cca243e491be3a1ad4cc2d571ac78fa162a335fb236f4',
  'words-5.txt': '7b4df8e13696e985fde3843c0597eff061084d4e8f9bfd9601d8e244b017a9ca',
  'words-6.txt': 'b6c8045e236d6e50b4412386b95db18cedf53a5d416c26c72d0df5ddf9cfbb8f',
  'words-7-9.txt': '2ce5a9dd45f02ef9840d82c4be5fb22f4ad0770afffd75fabd9e182e95626886',
};

const rutas = (n) => ({
  [`words-${n}.txt`]: `${BASE}/HSK%20Words/temp/HSK_Level_${n}_words.txt`,
  [`hanzi-${n}.txt`]: `${BASE}/HSK%20Hanzi/HSK_Level_${n}_hanzi.txt`,
  [`gramatica-${n}.json`]: `${BASE}/HSK%20Grammar/json/HSK%20${n}.json`,
});

async function archivo(nombre, url) {
  return (await bajar({ url, sha256: HUELLAS[nombre] }, `hsk-${HUELLAS[nombre].slice(0, 16)}-${nombre}`)).toString('utf8').replace(/^﻿/, '');
}

// ---------- El pinyin, lo justo para comparar lecturas ----------

const CON_TONO = { ā: 'a', á: 'a', ǎ: 'a', à: 'a', ē: 'e', é: 'e', ě: 'e', è: 'e', ī: 'i', í: 'i', ǐ: 'i', ì: 'i', ō: 'o', ó: 'o', ǒ: 'o', ò: 'o', ū: 'u', ú: 'u', ǔ: 'u', ù: 'u', ǖ: 'ü', ǘ: 'ü', ǚ: 'ü', ǜ: 'ü', ḿ: 'm', ń: 'n', ň: 'n', ǹ: 'n' };
const pegada = (s) => s.normalize('NFC').replace(/[\s'’·-]/g, '');
const junta = (s) => pegada(s).toLowerCase();
const sinTonos = (s) => [...junta(s)].map((c) => CON_TONO[c] ?? c).join('');
const parecido = (a, b) => [...a].filter((c, i) => c === [...b][i]).length;
/** Los tonos marcados de una lectura, en orden: «zhōngguó» → «12». */
const tonos = (s) =>
  [...junta(s)]
    .map((c) => 'āēīōūǖ'.includes(c) ? 1 : 'áéíóúǘḿń'.includes(c) ? 2 : 'ǎěǐǒǔǚň'.includes(c) ? 3 : 'àèìòùǜǹ'.includes(c) ? 4 : '')
    .join('');
/** Las lecturas en minúscula primero: con mayúscula son las de nombres propios (百 Bǎi, apellido). */
const mayuscula = (e) => Number(e.lectura !== e.lectura.toLowerCase());

// ---------- CC-CEDICT ----------

/** El texto de un nodo de contenido estructurado de Yomitan, sin las lecturas de las remisiones (<rt>). */
function textoDe(n) {
  if (typeof n === 'string') return n;
  if (Array.isArray(n)) return n.map(textoDe).join('');
  if (!n || typeof n !== 'object') return '';
  if (n.tag === 'rt') return '';
  if (n.data?.cccedict === 'reference') return palabraReferida(n);
  return textoDe(n.content ?? '');
}

/** La palabra a la que remite una referencia, en simplificado: trae las dos formas, 一點｜一点. */
function palabraReferida(span) {
  const enlaces = [];
  const buscar = (n) => {
    if (Array.isArray(n)) n.forEach(buscar);
    else if (n && typeof n === 'object') {
      if (n.tag === 'a') enlaces.push(n);
      else buscar(n.content);
    }
  };
  buscar(span.content);
  const a = enlaces.find((e) => e.lang === 'zh-Hans') ?? enlaces.at(-1);
  return textoDe(a ? a.content : span.content);
}

/** La primera referencia de una acepción, que es adonde remite. */
function primeraReferencia(n) {
  if (Array.isArray(n)) {
    for (const h of n) {
      const r = primeraReferencia(h);
      if (r) return r;
    }
    return null;
  }
  if (!n || typeof n !== 'object') return null;
  if (n.data?.cccedict === 'reference') return palabraReferida(n);
  return primeraReferencia(n.content);
}

/** Lo que remite a otra palabra en vez de traducir (variant of 嗎, erhua variant of 一点, used in 傢伙). */
const REMISION = /^(erhua variant of|old variant of|variant of|see also|see|used in|also written)\b/i;
/** Lo que no es una traducción: el clasificador, el apellido (no «surname and given name») y otras pronunciaciones. */
const NO_ES_GLOSA = /^(CL:|Taiwan pr\.|also pr\.|colloquial pr\.)/i;
const APELLIDO = /^surname\s+\p{Lu}/u;

/** La forma simplificada de la cabecera de una entrada: 么 es la tradicional de 幺 (yāo), y esa fila no es de 么. */
function simplificadaDe(n) {
  if (Array.isArray(n)) {
    for (const h of n) {
      const s = simplificadaDe(h);
      if (s) return s;
    }
    return null;
  }
  if (!n || typeof n !== 'object') return null;
  if (n.data?.cccedict === 'headword-simp') return textoDe(n.content);
  return simplificadaDe(n.content);
}

/** Las acepciones de una entrada: cada <li> de su lista; las remisiones, aparte. */
function acepciones(glosario) {
  const items = [];
  const recorrer = (n) => {
    if (Array.isArray(n)) n.forEach(recorrer);
    else if (n && typeof n === 'object') {
      if (n.tag === 'li') items.push(n);
      else recorrer(n.content);
    }
  };
  for (const g of Array.isArray(glosario) ? glosario : [glosario]) {
    if (typeof g === 'string') items.push(g);
    else recorrer(g?.type === 'structured-content' ? g.content : g);
  }
  const glosas = [];
  let remite = null;
  for (const li of items) {
    const texto = textoDe(li).replace(/\s*\(CL:[^()]*\)/g, '').replace(/\s+/g, ' ').trim();
    if (!texto || NO_ES_GLOSA.test(texto) || APELLIDO.test(texto)) continue;
    if (REMISION.test(texto)) remite ??= typeof li === 'string' ? null : primeraReferencia(li);
    else glosas.push(texto);
  }
  return { glosas, remite };
}

async function diccionario() {
  const zip = await bajar(CC_CEDICT, `cc-cedict-${CC_CEDICT.sha256.slice(0, 16)}.zip`);
  const entradas = new Map();
  const archivos = unzipSync(new Uint8Array(zip), { filter: (f) => /^term_bank_\d+\.json$/.test(f.name) });
  for (const datos of Object.values(archivos)) {
    for (const [termino, lectura, , , , glosario] of JSON.parse(strFromU8(datos))) {
      // Las listas son de simplificado: la fila de una forma tradicional que se simplifica en otra no cuenta.
      const simplificada = simplificadaDe(glosario);
      if (simplificada && simplificada !== termino) continue;
      const { glosas, remite } = acepciones(glosario);
      const lista = entradas.get(termino) ?? [];
      const previa = lista.find((e) => e.lectura === lectura);
      if (previa) {
        previa.glosas.push(...glosas);
        previa.remite ??= remite;
      } else lista.push({ lectura, glosas, remite });
      entradas.set(termino, lista);
    }
  }
  return entradas;
}

const entradas = await diccionario();

/**
 * Las glosas de una entrada; si solo remite a otra palabra, las de esa, con la misma lectura si la hay, y así hasta
 * tres veces (差一点儿 → 差一点 → 差点). Con `donde`, la palabra de la que salen si no son de la entrada.
 */
function glosasDe(e, saltos = 3) {
  if (e.glosas.length || !e.remite || !saltos) return { glosas: e.glosas, donde: null };
  const destino = entradas.get(e.remite) ?? [];
  const base = sinTonos(e.lectura).replace(/r$/, '');
  for (const d of [...destino.filter((x) => sinTonos(x.lectura) === base), ...destino]) {
    const g = glosasDe(d, saltos - 1);
    if (g.glosas.length) return { glosas: g.glosas, donde: g.donde ?? e.remite };
  }
  return { glosas: [], donde: null };
}

/** Lo que no traducen las listas de CC-CEDICT, escrito para Kotonoha. */
const GLOSAS_PROPIAS = { 精彩纷呈: 'full of brilliant moments, one after another' };

/** Una acepción en no más de `maximo` letras: sin las aclaraciones del final; si no basta, cortada entre palabras. */
function acortar(g, maximo) {
  let a = /^\([^()]*\)$/.test(g) ? g.slice(1, -1) : g;
  // Fuera la aclaración más larga mientras sobre y quede algo: «(third-person singular) (since the early 20th…) she».
  while (a.length > maximo) {
    const aclaraciones = [...a.matchAll(/\s*\([^()]*\)/g)].sort((x, y) => y[0].length - x[0].length);
    const sin = aclaraciones.length ? (a.slice(0, aclaraciones[0].index) + a.slice(aclaraciones[0].index + aclaraciones[0][0].length)).trim() : '';
    if (!sin) break;
    a = sin;
  }
  if (a.length <= maximo) return a;
  const corte = a.slice(0, maximo - 1);
  const pausa = Math.max(corte.lastIndexOf('; '), corte.lastIndexOf(', '), corte.lastIndexOf(' ('));
  const hasta = pausa > maximo / 2 ? pausa : corte.lastIndexOf(' ') > maximo / 2 ? corte.lastIndexOf(' ') : maximo - 1;
  return `${a.slice(0, hasta).trimEnd()}…`;
}

/** La glosa que cabe en una lista, como las del JLPT: las primeras acepciones, sin pasar de 60 letras. */
function glosaCorta(glosas, maximo = 60) {
  let salida = '';
  for (const g of glosas.slice(0, 3)) {
    const a = acortar(g, maximo);
    const junto = salida ? `${salida}; ${a}` : a;
    if (salida && junto.length > maximo) break;
    salida = junto;
    if (a.endsWith('…')) break;
  }
  return salida;
}

/**
 * La entrada de CC-CEDICT que corresponde a la lectura del temario: la misma, con la mayúscula de los nombres propios
 * como la escribe el temario; si no, la de las mismas sílabas con más tonos iguales (el temario cambia el de 一 y 不).
 * El temario da a veces dos lecturas (谁 shéi/shuí): vale la primera que esté. Si ninguna está pero la palabra sí (血
 * xiě, que CC-CEDICT da como xuè), la del diccionario, que es la que llevan las palabras guardadas, con la del temario
 * como otra lectura. Sin la palabra en CC-CEDICT, la lectura del temario, junta; una palabra con 儿 que falta toma la
 * glosa de la que no lo lleva (口哨儿 → 口哨).
 */
function lecturaDe(palabra, delTemario) {
  const candidatas = (entradas.get(palabra) ?? []).filter((e) => e.glosas.length || e.remite).sort((a, b) => mayuscula(a) - mayuscula(b));
  const alternativas = delTemario.split('/').map(pegada).filter(Boolean);
  for (const t of alternativas) {
    const igual = candidatas.find((e) => e.lectura === t) ?? candidatas.find((e) => junta(e.lectura) === junta(t));
    if (igual) return { lectura: igual.lectura, glosas: glosasDe(igual).glosas, conocida: true, otras: [] };
  }
  for (const t of alternativas) {
    const mismas = candidatas
      .filter((e) => sinTonos(e.lectura) === sinTonos(t))
      .sort((a, b) => parecido(junta(b.lectura), junta(t)) - parecido(junta(a.lectura), junta(t)) || mayuscula(a) - mayuscula(b));
    if (mismas.length) return { lectura: mismas[0].lectura, glosas: glosasDe(mismas[0]).glosas, conocida: true, otras: [] };
  }
  const t = alternativas[0];
  // Antes la del mismo tono: 嗯 ǹg es èn («OK, yeah»), no ēn («a groaning sound»).
  const propia = [...candidatas].sort((a, b) => Number(tonos(b.lectura) === tonos(t)) - Number(tonos(a.lectura) === tonos(t))).find((e) => glosasDe(e).glosas.length);
  if (propia) return { lectura: propia.lectura, glosas: glosasDe(propia).glosas, conocida: true, otras: alternativas.filter((a) => a !== propia.lectura) };
  if (palabra.length > 1 && palabra.endsWith('儿')) {
    const sinEr = lecturaDe(palabra.slice(0, -1), t.replace(/r$/, ''));
    return { lectura: t, glosas: sinEr.glosas, conocida: sinEr.conocida, otras: [] };
  }
  return { lectura: t, glosas: GLOSAS_PROPIAS[palabra] ? [GLOSAS_PROPIAS[palabra]] : [], conocida: false, otras: [] };
}

/**
 * La lectura de cada carácter de una palabra, repartida sobre la de la palabra: cada sílaba ha de ser una de las del
 * carácter en CC-CEDICT, igual o, si la palabra la lleva en tono neutro (东西 dōngxi), sin tono; 儿 puede ser «r».
 * Devuelve la lectura de cada carácter como la da el diccionario, o null si no se puede repartir.
 */
function repartir(palabra, lectura) {
  const cs = [...palabra];
  const R = junta(lectura);
  const opciones = cs.map((c) => {
    const ls = new Set((entradas.get(c) ?? []).map((e) => junta(e.lectura)));
    if (c === '儿') ls.add('r');
    return [...ls].sort((a, b) => b.length - a.length);
  });
  const memo = new Map();
  const ir = (j, p) => {
    if (j === cs.length) return p === R.length ? [] : null;
    const k = `${j}|${p}`;
    if (memo.has(k)) return memo.get(k);
    let res = null;
    for (const exacta of [true, false]) {
      for (const o of opciones[j]) {
        const trozo = R.slice(p, p + o.length);
        if (exacta ? trozo !== o : sinTonos(trozo) !== sinTonos(o)) continue;
        const resto = ir(j + 1, p + o.length);
        if (resto) {
          res = [o, ...resto];
          break;
        }
      }
      if (res) break;
    }
    memo.set(k, res);
    return res;
  };
  return ir(0, 0);
}

// ---------- Las listas ----------

/** 本1 → 本; 没（有） → 没有, y 没 como otra forma; la lectura igual: méi(yǒu) → méiyǒu y méi. */
function formas(palabra, lectura) {
  const sinNumero = palabra.replace(/\d+$/, '').trim();
  const opcional = /[（(]([^）)]+)[）)]/;
  if (!opcional.test(sinNumero)) return { palabra: sinNumero, lectura: lectura.trim(), corta: null };
  const larga = sinNumero.replace(/[（()）]/g, '');
  const corta = sinNumero.replace(/[（(][^）)]+[）)]/g, '');
  return { palabra: larga, lectura: lectura.replace(/[()（）]/g, ''), corta: { palabra: corta, lectura: lectura.replace(/[(（][^)）]*[)）]/g, '') } };
}

function tabla(ruta) {
  return readFileSync(ruta, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((l) => l.split('\t'));
}

const limpiar = (s) => (s ?? '').replace(/\s+/g, '').replace(/\d+$/, '');

const categorias = new Map(tabla(join(RAIZ, 'herramientas', 'hsk', 'categorias.tsv')).map(([a, b, es, en]) => [`${a}|${b}`, { es, en }]));
const estructuras = new Map(tabla(join(RAIZ, 'herramientas', 'hsk', 'estructuras.tsv')).map(([p, es, en]) => [p, { es, en }]));

const textos = {};
for (const n of NIVELES) {
  textos[n] = Object.fromEntries(await Promise.all(Object.entries(rutas(n)).map(async ([nombre, url]) => [nombre.split('-')[0], await archivo(nombre, url)])));
}

// Las palabras. El temario repite en un nivel algunas de los anteriores, con un uso nuevo (点, de nivel 1, vuelve en
// el 3 como «1（3）»): cada una se queda en el suyo, que es el primero.
const vocabulario = {};
// Cuánto se usa cada lectura de cada hanzi en las palabras de las listas, con más peso cuanto más bajo es el nivel.
const usos = new Map();
const primeraPalabra = new Map(); // la primera palabra de las listas que lleva cada hanzi, con su glosa
let sinDiccionario = 0;
const sinRepartir = [];
NIVELES.forEach((n, i) => {
  const nivel = `HSK ${n}`;
  const peso = 2 ** (NIVELES.length - 1 - i);
  const vistas = new Set();
  vocabulario[nivel] = [];
  for (const linea of textos[n].words.split(/\r?\n/)) {
    const [, delTemario, escrita, pinyin] = linea.split('\t');
    if (!escrita || !pinyin) continue;
    if (delTemario.match(/^\s*([\d-]+)/)?.[1] !== n) continue;
    const f = formas(escrita, pinyin);
    const e = lecturaDe(f.palabra, f.lectura);
    if (!e.conocida) sinDiccionario++;
    const clave = `${f.palabra}|${e.lectura}`;
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    const glosa = glosaCorta(e.glosas);
    const fila = [f.palabra, e.lectura, glosa];
    const otrasFormas = [];
    const otrasLecturas = [...e.otras];
    if (f.corta) {
      const c = lecturaDe(f.corta.palabra, f.corta.lectura);
      otrasFormas.push(f.corta.palabra);
      for (const l of [c.lectura, ...c.otras]) if (l !== e.lectura && !otrasLecturas.includes(l)) otrasLecturas.push(l);
    }
    if (otrasFormas.length || otrasLecturas.length) fila.push(otrasFormas, otrasLecturas);
    vocabulario[nivel].push(fila);

    const reparto = repartir(f.palabra, e.lectura);
    if (!reparto) sinRepartir.push(`${f.palabra} ${e.lectura}`);
    [...f.palabra].forEach((c, j) => {
      if (!primeraPalabra.has(c) && glosa) primeraPalabra.set(c, `${f.palabra}: ${glosa}`);
      const l = reparto?.[j];
      if (!l || l === 'r') return;
      const delCaracter = usos.get(c) ?? new Map();
      delCaracter.set(l, (delCaracter.get(l) ?? 0) + peso);
      usos.set(c, delCaracter);
    });
  }
});

// Los hanzi, con sus lecturas por lo que se usan en las palabras de las listas (么 me, por 什么 y 怎么, aunque CC-CEDICT
// empiece por yāo; 觉 jué antes que jiào); si no está en ninguna, las de CC-CEDICT que traducen algo, sin apellidos. La
// glosa es la de su lectura más usada; la de un hanzi que solo se usa en una palabra (圾, de 垃圾) es la de esa palabra.
const hanzi = {};
for (const n of NIVELES) {
  const nivel = `HSK ${n}`;
  hanzi[nivel] = [];
  for (const c of textos[n].hanzi.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    const propias = (entradas.get(c) ?? []).filter((e) => e.glosas.length && !mayuscula(e));
    const usadas = [...(usos.get(c) ?? new Map())].sort((a, b) => b[1] - a[1]).map(([l]) => l);
    const lecturas = (usadas.length ? usadas : propias.slice(0, 2).map((e) => e.lectura)).slice(0, 4);
    const entrada = (entradas.get(c) ?? []).filter((e) => junta(e.lectura) === lecturas[0]).sort((a, b) => mayuscula(a) - mayuscula(b))[0];
    const { glosas, donde } = entrada ? glosasDe(entrada) : { glosas: [], donde: null };
    const glosa = glosas.length ? (donde ? `${donde}: ${glosaCorta(glosas)}` : glosaCorta(glosas)) : (primeraPalabra.get(c) ?? '');
    hanzi[nivel].push([c, lecturas.join('、'), '', glosa]);
  }
}

// La gramática: lo que significa cada punto, por su categoría o, en las estructuras fijas, por la estructura.
const gramatica = {};
for (const n of NIVELES) {
  const nivel = `HSK ${n}`;
  gramatica[nivel] = [];
  for (const g of JSON.parse(textos[n].gramatica)) {
    const contenido = (g['语法内容'] ?? '').trim();
    const categoria = limpiar(g['细目']) || limpiar(g['类别名称']) || limpiar(g['类别']);
    const significado = (g['类别'] === '固定格式' && estructuras.get(contenido)) || categorias.get(`${limpiar(g['类别'])}|${categoria}`);
    if (!significado) throw new Error(`Sin traducción: ${g['类别']} | ${categoria} | ${contenido}`);
    // Los números de acepción del temario (都1, 还1) no dicen nada en la lista, ni los de los apartados de un punto
    // («（2）A跟B一样», «（1）是非问句»): en la lista, cada uno va por su cuenta.
    const patron = (contenido || categoria)
      .replace(/(\p{Script=Han})\d+/gu, '$1')
      .replace(/^（\d+）/, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!gramatica[nivel].some(([p]) => p === patron)) gramatica[nivel].push([patron, significado]);
  }
}

for (const n of NIVELES) {
  const nivel = `HSK ${n}`;
  console.log(`${nivel}: ${vocabulario[nivel].length} palabras, ${hanzi[nivel].length} hanzi, ${gramatica[nivel].length} puntos de gramática`);
}
console.log(`Palabras que no están en CC-CEDICT, con la lectura del temario: ${sinDiccionario}`);
console.log(`Palabras cuya lectura no se reparte entre sus hanzi: ${sinRepartir.length} (${sinRepartir.join(', ')})`);

mkdirSync(SALIDA, { recursive: true });
writeFileSync(join(SALIDA, 'vocabulario.json'), JSON.stringify({ fuente: FUENTE, niveles: vocabulario }));
writeFileSync(join(SALIDA, 'kanji.json'), JSON.stringify({ fuente: FUENTE, niveles: hanzi }));
writeFileSync(join(SALIDA, 'gramatica.json'), JSON.stringify({ fuente: 'Temario del HSK (2025); explicaciones de Kotonoha', niveles: gramatica }));
console.log('Listas escritas en', SALIDA.slice(RAIZ.length + 1));
