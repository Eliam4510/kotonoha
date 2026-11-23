// La plantilla del tipo de nota «Kotonoha» vista como en Anki, sin Anki: pinta anverso y reverso de tres tarjetas reales
// (japonés, chino e inglés), en claro y en modo noche, a lo ancho de un escritorio y de un móvil, y hace dos láminas.
// Imita lo que hace Anki con la plantilla: secciones {{#Campo}} y {{^Campo}}, el filtro furigana:, {{Tags}} y los
// botones de [sound:…]. Uso: node pruebas/capturas/plantilla-anki.mjs [carpeta de salida]

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const RAIZ = resolve(import.meta.dirname, '..', '..');
const SALIDA = resolve(process.argv[2] ?? join(RAIZ, 'capturas-e2e', 'plantilla-anki'));
mkdirSync(SALIDA, { recursive: true });

// La plantilla, tal cual la crea el motor.
const modulo = join(SALIDA, 'plantilla.mjs');
await build({ entryPoints: [join(RAIZ, 'src/motor/plantillaAnki.ts')], bundle: true, format: 'esm', platform: 'node', outfile: modulo, logLevel: 'error' });
const { ANVERSO, CSS_TARJETA, reverso } = await import(pathToFileURL(modulo).href);

// Un fotograma del discurso (contenido-libre, fuera de git), como la captura de una tarjeta de verdad.
const fotograma = join(SALIDA, 'dieta.jpg');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '59.2', '-i', join(RAIZ, 'contenido-libre', 'dieta.webm'), '-frames:v', '1', '-vf', 'scale=960:-2', fotograma]);
const imagen = `<img src="data:image/jpeg;base64,${readFileSync(fotograma).toString('base64')}">`;

const TARJETAS = [
  {
    nombre: 'japones',
    Tags: 'kotonoha kotonoha::ja',
    Palabra: '担い手',
    Lectura: 'にないて',
    Frase: 'スタートアップは、技術を実用化していく主要な<b>担い手</b>です。',
    FraseFurigana: 'スタートアップは、 技術[ぎじゅつ]を 実用化[じつようか]していく 主要[しゅよう]な<b> 担[にな]い 手[て]</b>です。',
    Traduccion: 'Las startups son las principales encargadas de llevar la tecnología a la práctica.',
    Definicion: '<b>quien asume y lleva adelante una tarea</b><br>portador (de una carga)<br>responsable; protagonista<br>quien sostiene una tradición',
    AudioFrase: '[sound:frase.mp3]',
    AudioPalabra: '[sound:palabra.mp3]',
    Imagen: imagen,
    Ejemplos: '伝統の担い手 — quienes mantienen viva la tradición<br>担い手不足 — falta de quien haga el trabajo',
    Notas: 'Se dice de personas y también de empresas o grupos.',
    Fuente: '<a href="https://www.youtube.com/watch?v=alk-cIHwTIU">第221回国会 施政方針演説 · 首相官邸</a>',
  },
  {
    nombre: 'chino',
    Tags: 'kotonoha kotonoha::zh',
    Palabra: '河边',
    Lectura: 'hébiān',
    Frase: '我们沿着<b>河边</b>慢慢地散步。',
    FraseFurigana: ' 我[wǒ] 们[men] 沿[yán] 着[zhe]<b> 河[hé] 边[biān]</b> 慢[màn] 慢[màn] 地[de] 散[sàn] 步[bù]。',
    Traduccion: 'Paseamos despacio por la orilla del río.',
    Definicion: '<b>la orilla del río</b><br>riverside; bank of a river',
    AudioFrase: '[sound:frase.mp3]',
    AudioPalabra: '',
    Imagen: '',
    Ejemplos: '',
    Notas: '',
    Fuente: '',
  },
  {
    nombre: 'ingles',
    Tags: 'kotonoha kotonoha::en',
    Palabra: 'refer',
    Lectura: '/rɪˈfɜː/',
    Frase: 'Those names <b>refer</b> to the two areas in the constellation.',
    FraseFurigana: 'Those names <b>refer</b> to the two areas in the constellation.',
    Traduccion: 'Esos nombres se refieren a las dos zonas de la constelación.',
    Definicion: '<b>aludir a, referirse a</b><br>to mention or speak about<br>to be about or concerned with',
    AudioFrase: '[sound:frase.mp3]',
    AudioPalabra: '[sound:palabra.mp3]',
    Imagen: '',
    Ejemplos: '',
    Notas: '',
    Fuente: '<a href="https://www.youtube.com/watch?v=PN-iD6VTmyc">What’s Up: November 2026 · NASA</a>',
  },
];

/** Lo que hace Anki con una plantilla: secciones, filtros y campos. */
function pintar(plantilla, campos) {
  let s = plantilla;
  // Las secciones de dentro primero: {{^Palabra}}{{#Definicion}}…{{/Definicion}}{{/Palabra}}.
  const seccion = /\{\{([#^])([^}]+)\}\}((?:(?!\{\{[#^])[\s\S])*?)\{\{\/\2\}\}/;
  for (let m = seccion.exec(s); m; m = seccion.exec(s)) {
    const lleno = !!(campos[m[2]] ?? '').trim();
    s = s.replace(m[0], (m[1] === '#') === lleno ? m[3] : '');
  }
  s = s.replace(/\{\{furigana:([^}]+)\}\}/g, (_, c) => (campos[c] ?? '').replace(/ ?([^ >]+?)\[(.+?)\]/g, '<ruby><rb>$1</rb><rt>$2</rt></ruby>'));
  s = s.replace(/\{\{([^#^/}][^}]*)\}\}/g, (_, c) => campos[c] ?? '');
  // Como el botón de Anki para cada sonido.
  return s.replace(/\[sound:[^\]]+\]/g, '<a class="replay-button soundLink" href="#"><svg class="playImage" viewBox="0 0 64 64" version="1.1"><circle cx="32" cy="32" r="29"></circle><path d="M56.502,32.301l-37.502,20.101l0.329,-40.804l37.173,20.703Z"></path></svg></a>');
}

/** Una tarjeta como la pinta el revisor de Anki: el CSS del tipo de nota y el cuerpo con sus clases. */
const pagina = (html, noche) =>
  `<!doctype html><html><head><meta charset="utf-8"><style>${CSS_TARJETA}</style></head><body class="card card1${noche ? ' nightMode night_mode' : ''}"><div id="qa">${html}</div></body></html>`;

function lamina(ancho, alto, vistas) {
  const celdas = vistas
    .map((v) => `<figure><figcaption>${v.titulo}</figcaption><iframe width="${ancho}" height="${alto}" srcdoc="${pagina(v.html, v.noche).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"></iframe></figure>`)
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;padding:20px;background:#2a2f2c;font:13px system-ui;color:#ddd;display:flex;flex-wrap:wrap;gap:18px}figure{margin:0}figcaption{margin:0 0 6px}iframe{border:0;border-radius:10px;display:block}</style></head><body>${celdas}</body></html>`;
}

const navegador = await chromium.launch({ channel: process.env.KK_CANAL ?? 'msedge', headless: true, args: ['--mute-audio'] });
const p = await navegador.newPage({ viewport: { width: 1400, height: 1000 } });
const vistas = (t) => [
  { titulo: `${t.nombre}: anverso`, html: pintar(ANVERSO, t), noche: false },
  { titulo: `${t.nombre}: reverso`, html: pintar(reverso(), t), noche: false },
  { titulo: `${t.nombre}: reverso, noche`, html: pintar(reverso(), t), noche: true },
];
const escritorio = TARJETAS.flatMap(vistas);
await p.setContent(lamina(440, 1080, escritorio.slice(0, 3)));
await p.waitForTimeout(500);
await p.screenshot({ path: join(SALIDA, 'escritorio-japones.png'), fullPage: true });
await p.setContent(lamina(440, 620, escritorio.slice(3)));
await p.waitForTimeout(500);
await p.screenshot({ path: join(SALIDA, 'escritorio-chino-ingles.png'), fullPage: true });
await p.setContent(lamina(375, 760, [{ titulo: 'móvil: anverso', html: pintar(ANVERSO, TARJETAS[0]), noche: true }, { titulo: 'móvil: reverso', html: pintar(reverso(), TARJETAS[0]), noche: false }]));
await p.waitForTimeout(500);
await p.screenshot({ path: join(SALIDA, 'movil.png'), fullPage: true });
await navegador.close();
console.log(`Láminas en ${SALIDA}`);
