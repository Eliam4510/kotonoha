// Textos de la interfaz: los saca del código y comprueba las traducciones.
//   node herramientas/idiomas.mjs            informa de lo que falta o sobra en cada idioma
//   node herramientas/idiomas.mjs --lista    escribe idiomas/fuente.tsv, con un número por texto
//   node herramientas/idiomas.mjs --mezclar  incorpora idiomas/trabajo/<idioma>.tsv a idiomas/<idioma>.json
//
// El texto en español es la clave. Los archivos de trabajo tienen «número<TAB>traducción» por línea.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
export const CARPETA = join(RAIZ, 'idiomas');
export const IDIOMAS = ['en', 'de', 'zh', 'ko', 'ja'];

/** Lo que no se traduce: marcas, nombres propios y siglas. Se ve igual en todos los idiomas. */
const SIN_TRADUCIR = new Set(['Netflix', 'Disney+', 'Crunchyroll', 'Viki', 'Bilibili', 'Prime Video', 'YouTube', 'Matcha', 'NHK Easy', 'Wikipedia', 'Whisper', 'Claude', 'Alt', 'Ctrl', 'Shift', 'Jisho', 'Weblio', 'Goo 辞書', 'Wiktionary', 'Forvo', 'Massif', 'Anki', 'Whisper Turbo', 'Whisper Base', 'Claude Sonnet 5.5', 'Claude Opus 5.5', 'Claude Haiku 5.5', 'JapanDict', 'Kotonoha', 'tokens', 'Ctrl+X', 'USD', 'SRT', 'VTT', 'N1', 'N2', 'N3', 'N4', 'N5', 'Aoi', 'Daichi', 'Keita', 'Masaru', 'Mayu', 'Nanami', 'Shiori']);

function archivos(d) {
  return readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const r = join(d, e.name);
    if (e.isDirectory()) return archivos(r);
    return /\.tsx?$/.test(e.name) && !/\.test\.|\.d\.ts$/.test(e.name) ? [r] : [];
  });
}

/** Lee el literal que empieza en `i` (comillas simples, dobles o acento grave sin sustituciones). */
function literal(s, i) {
  const q = s[i];
  if (q !== "'" && q !== '"' && q !== '`') return null;
  let t = '';
  for (let k = i + 1; k < s.length; k++) {
    const c = s[k];
    if (c === '\\') {
      const n = s[++k];
      t += n === 'n' ? '\n' : n === 't' ? '\t' : n;
    } else if (c === q) {
      return t;
    } else if (q === '`' && c === '$' && s[k + 1] === '{') {
      return null;
    } else {
      t += c;
    }
  }
  return null;
}

/** Todos los textos marcados con tr() o tm() en el código, en orden estable. */
export function textosDelCodigo() {
  const textos = new Set();
  for (const f of archivos(join(RAIZ, 'src'))) {
    const s = readFileSync(f, 'utf8');
    for (const m of s.matchAll(/(?<![\w.$])t[rm]\(\s*/g)) {
      const t = literal(s, m.index + m[0].length);
      if (t) textos.add(t);
    }
  }
  return [...textos].filter((t) => !SIN_TRADUCIR.has(t.trim()) && /\p{L}/u.test(t)).sort((a, b) => a.localeCompare(b, 'es'));
}

const marcadores = (t) => [...t.matchAll(/\{\d+\}/g)].map((m) => m[0]).sort().join('');

/** Problemas de una tabla frente a los textos del código. */
export function revisar(textos, tabla) {
  const faltan = textos.filter((t) => !(t in tabla));
  const marcasMal = textos.filter((t) => t in tabla && marcadores(t) !== marcadores(tabla[t]));
  const sobran = Object.keys(tabla).filter((t) => !textos.includes(t));
  return { faltan, marcasMal, sobran };
}

const rutaTabla = (id) => join(CARPETA, `${id}.json`);
export const leerTabla = (id) => (existsSync(rutaTabla(id)) ? JSON.parse(readFileSync(rutaTabla(id), 'utf8')) : {});

function mezclar() {
  const fuente = readFileSync(join(CARPETA, 'fuente.tsv'), 'utf8').split('\n').filter(Boolean).map((l) => {
    const [n, ...r] = l.split('\t');
    return [n, r.join('\t').replaceAll('\\n', '\n')];
  });
  const porNumero = new Map(fuente);
  const vigentes = new Set(textosDelCodigo());
  for (const id of IDIOMAS) {
    const trabajo = join(CARPETA, 'trabajo', `${id}.tsv`);
    if (!existsSync(trabajo)) continue;
    const tabla = leerTabla(id);
    for (const t of Object.keys(tabla)) if (!vigentes.has(t)) delete tabla[t];
    let n = 0;
    for (const l of readFileSync(trabajo, 'utf8').split('\n')) {
      if (!l.trim()) continue;
      const [num, ...r] = l.split('\t');
      const origen = porNumero.get(num.trim());
      if (!origen) throw new Error(`${id}: el número ${num} no existe en fuente.tsv`);
      tabla[origen] = r.join('\t').replaceAll('\\n', '\n');
      n++;
    }
    const ordenada = Object.fromEntries(Object.entries(tabla).sort(([a], [b]) => a.localeCompare(b, 'es')));
    writeFileSync(rutaTabla(id), `${JSON.stringify(ordenada, null, 1)}\n`);
    console.log(`${id}: ${n} incorporadas`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(CARPETA, { recursive: true });
  const textos = textosDelCodigo();
  if (process.argv.includes('--lista')) {
    const pendientes = textos.filter((t) => IDIOMAS.some((id) => !(t in leerTabla(id))));
    writeFileSync(join(CARPETA, 'fuente.tsv'), `${pendientes.map((t, i) => `${i + 1}\t${t.replaceAll('\n', '\\n')}`).join('\n')}\n`);
    console.log(`${pendientes.length} textos pendientes de ${textos.length} en idiomas/fuente.tsv`);
  } else if (process.argv.includes('--mezclar')) {
    mezclar();
  } else {
    let mal = 0;
    console.log(`${textos.length} textos en el código`);
    for (const id of IDIOMAS) {
      const r = revisar(textos, leerTabla(id));
      console.log(`${id}: faltan ${r.faltan.length}, marcadores mal ${r.marcasMal.length}, sobran ${r.sobran.length}`);
      mal += r.faltan.length + r.marcasMal.length;
    }
    process.exit(mal ? 1 : 0);
  }
}
