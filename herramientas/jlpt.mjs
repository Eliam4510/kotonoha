// Genera publico/datos/jlpt/, las listas de cada nivel del JLPT que usa la pantalla «Niveles»:
// - vocabulario.json y kanji.json, de las listas de Jonathan Waller (JLPT Resources, tanos.co.uk), con licencia Creative
//   Commons BY. La web ya no existe: se leen sus copias del Internet Archive, siempre las mismas fechas.
// - gramatica.json, de herramientas/jlpt/gramatica.tsv, escrita para Kotonoha.
// No hay listas oficiales del JLPT: estas son las que usa casi todo el mundo.
// Uso: node herramientas/jlpt.mjs [carpeta de caché de las páginas descargadas]

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const RAIZ = resolve(import.meta.dirname, '..');
const SALIDA = join(RAIZ, 'publico', 'datos', 'jlpt');
const CACHE = process.argv[2] ? resolve(process.argv[2]) : null;
export const FUENTE = 'Jonathan Waller, JLPT Resources (tanos.co.uk), Creative Commons BY';

/** Las copias del Internet Archive de cada lista, por nivel. */
const PAGINAS = {
  N5: { vocab: '20200728231522', kanji: '20200806005029' },
  N4: { vocab: '20200629172633', kanji: '20200716184232' },
  N3: { vocab: '20200629172607', kanji: '20200724122309' },
  N2: { vocab: '20200629172602', kanji: '20200726143733' },
  N1: { vocab: '20200218172500', kanji: '20200731061258' },
};

async function pagina(nivel, tipo) {
  const archivo = CACHE && join(CACHE, `n${nivel.slice(1)}-${tipo}.html`);
  if (archivo && existsSync(archivo)) return readFileSync(archivo, 'utf8');
  const url = `https://web.archive.org/web/${PAGINAS[nivel][tipo]}id_/http://www.tanos.co.uk/jlpt/jlpt${nivel.slice(1)}/${tipo}/`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  const html = await r.text();
  if (archivo) {
    mkdirSync(CACHE, { recursive: true });
    writeFileSync(archivo, html);
  }
  return html;
}

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const texto = (html) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENTIDADES[e] ?? m)))
    .replace(/\s+/g, ' ')
    .trim();

function filas(html) {
  return [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((f) => [...f[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => texto(c[1])));
}

const KANA = /^[ぁ-ゖァ-ヺー]+$/u;
const formas = (s) => s.split(/\s*[/、,;・]\s*/).map((x) => x.trim()).filter(Boolean);

/** Una fila de vocabulario, limpia: [palabra, lectura, glosa, otras formas, otras lecturas]. */
function palabra([kanji, hiragana, ingles]) {
  // Unas pocas filas traen la palabra en la primera columna y una nota entre paréntesis en la segunda.
  if (/^[（(][^）)]*[）)]$/.test(hiragana) && kanji) hiragana = kanji.replace(/\s*[（(][^）)]*[）)]/g, '');
  hiragana = hiragana.replace(/\s*[（(]=[^）)]*[）)]/g, '');
  let lecturas = [];
  for (const f of formas(hiragana)) {
    const m = /^([^（(]+)[（(]([^）)]+)[）)]$/.exec(f);
    // あたたか(い): la terminación va dentro; としつき(ねんげつ): otra lectura.
    if (m && m[2].length <= 2) lecturas.push(m[1] + m[2]);
    else if (m) lecturas.push(m[1], m[2]);
    else lecturas.push(f);
  }
  lecturas = lecturas.map((l) => l.trim()).filter(Boolean);
  let escrituras = [];
  for (const f of formas(kanji)) {
    const m = /^([^（(]+)[（(]([^）)]+)[）)]$/.exec(f);
    // 他（外）: otra escritura; 二十（歳）: parte de la palabra.
    if (m && [...m[1]].length === 1 && [...m[2]].length === 1) escrituras.push(m[1], m[2]);
    else escrituras.push(f.replace(/[（()）]/g, ''));
  }
  escrituras = escrituras.filter(Boolean);
  // Una errata de la lista de N5: «おじいさん» aparece escrito como 伯父 (おじ).
  if (lecturas[0] === 'おじいさん' && escrituras[0] === '伯父') escrituras = ['お祖父さん'];
  const lectura = lecturas[0] ?? escrituras[0] ?? '';
  const lema = escrituras[0] ?? lectura;
  const fila = [lema, lectura, ingles.replace(/\s*,\s*/g, ', ').replace(/,\s*$/, '')];
  const otrasFormas = escrituras.slice(1);
  const otrasLecturas = lecturas.slice(1).filter((l) => l !== lectura);
  if (otrasFormas.length || otrasLecturas.length) fila.push(otrasFormas, otrasLecturas);
  return fila;
}

/** Una fila de kanji, limpia: [kanji, on, kun, glosa], con las lecturas separadas por «、». */
function kanji([caracter, on, kun, ingles]) {
  const lecturasOn = on.split(/\s+/).filter((x) => /^[ァ-ヺー]+$/u.test(x));
  const lecturasKun = kun.split(/\s+/).filter((x) => /^-?[ぁ-ゖ.ー]+-?$/u.test(x) && x !== '-');
  return [caracter, lecturasOn.join('、'), lecturasKun.join('、'), ingles];
}

const vocabulario = {};
const kanjiPorNivel = {};
for (const nivel of Object.keys(PAGINAS)) {
  const v = filas(await pagina(nivel, 'vocab')).filter((c) => c.length === 3 && c[0] !== 'Kanji' && !/VocabList/.test(c[0]) && (c[0] || c[1]));
  const vistas = new Set();
  vocabulario[nivel] = v.map(palabra).filter((f) => {
    const clave = `${f[0]}|${f[1]}`;
    if (!f[0] || vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
  const k = filas(await pagina(nivel, 'kanji')).filter((c) => c.length === 4 && [...c[0]].length === 1);
  kanjiPorNivel[nivel] = k.map(kanji);
  console.log(`${nivel}: ${vocabulario[nivel].length} palabras, ${kanjiPorNivel[nivel].length} kanji`);
}

const gramatica = {};
for (const linea of readFileSync(join(RAIZ, 'herramientas', 'jlpt', 'gramatica.tsv'), 'utf8').split(/\r?\n/)) {
  if (!linea.trim() || linea.startsWith('#')) continue;
  const [nivel, patron, es, en] = linea.split('\t');
  if (!PAGINAS[nivel] || !patron || !es || !en) throw new Error(`Línea de gramática mal formada: ${linea}`);
  (gramatica[nivel] ??= []).push([patron, { es, en }]);
}
for (const nivel of Object.keys(PAGINAS)) console.log(`${nivel}: ${gramatica[nivel]?.length ?? 0} puntos de gramática`);

mkdirSync(SALIDA, { recursive: true });
writeFileSync(join(SALIDA, 'vocabulario.json'), JSON.stringify({ fuente: FUENTE, niveles: vocabulario }));
writeFileSync(join(SALIDA, 'kanji.json'), JSON.stringify({ fuente: FUENTE, niveles: kanjiPorNivel }));
writeFileSync(join(SALIDA, 'gramatica.json'), JSON.stringify({ fuente: 'Kotonoha', niveles: gramatica }));
console.log('Listas escritas en', SALIDA.slice(RAIZ.length + 1));
