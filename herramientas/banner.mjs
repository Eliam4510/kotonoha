// Genera los banners del README, uno por idioma, con la marca y la tipografía del proyecto.
// Uso: node herramientas/banner.mjs

import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SALIDA = join(RAIZ, 'docs', 'img');
mkdirSync(SALIDA, { recursive: true });

const fuente = (ruta) => readFileSync(join(RAIZ, 'node_modules', ruta)).toString('base64');
const hoja = readFileSync(join(RAIZ, 'herramientas', 'marca', 'hoja.svg'), 'utf8');

// Silueta de montañas, repetible: la misma semilla da siempre el mismo perfil.
const montana = (y, amp, color, semilla) => {
  let d = `M0 420 L0 ${y}`;
  for (let x = 0; x <= 1296; x += 48) {
    const h = y - amp * (0.5 + 0.5 * Math.sin(x / 130 + semilla)) - amp * 0.35 * Math.sin(x / 47 + semilla * 2);
    d += ` L${x} ${h.toFixed(1)}`;
  }
  return `<path d="${d} L1280 420 Z" fill="${color}"/>`;
};

const estrellas = Array.from({ length: 70 }, (_, i) => {
  const x = (i * 197.3) % 1280;
  const y = (i * 71.9) % 250;
  const r = 0.6 + ((i * 13) % 10) / 10;
  return `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(1)}" fill="#fff" opacity="${(0.25 + ((i * 7) % 10) / 16).toFixed(2)}"/>`;
}).join('');

// Cada palabra lleva el color de su acento tonal y un subrayado según se conozca o no, como sobre el video.
const PALABRAS = [
  { t: '言', r: 'こと', c: '#FF9393', s: '#93DF56' },
  { t: 'の', c: '#F2F5EE' },
  { t: '葉', r: 'は', c: '#7FE6B3', s: '#F7CB52' },
  { t: 'を', c: '#F2F5EE' },
  { t: '集', r: 'あつ', c: '#8FCBFF', s: '#FF9166' },
  { t: 'める', c: '#8FCBFF', s: '#FF9166', u: true },
];

const palabrasHtml = PALABRAS.map(({ t, r, c, s, u }) => `<span class="pal${s ? ' con' : ''}${u ? ' cola' : ''}" style="color:${c};${s ? `--sub:${s}` : ''}">${r ? `<ruby>${t}<rt>${r}</rt></ruby>` : t}</span>`).join('');

// Quien lee en japonés no estudia japonés: su banner habla del inglés y del alemán.
const TEXTOS = {
  'banner.png': { lema: 'Subtítulos interactivos, diccionario, ayuda de lectura para libros y manga, y tarjetas: japonés, inglés y alemán con video y texto real', traduccion: 'Recoger hojas de palabras' },
  'banner.en.png': { lema: 'Interactive subtitles, a dictionary, reading help for books and manga, and flashcards: Japanese, English and German from real video and text', traduccion: 'Gathering leaves of words' },
  'banner.de.png': { lema: 'Interaktive Untertitel, Wörterbuch, Lesehilfe für Bücher und Manga, und Karten: Japanisch, Englisch und Deutsch mit echten Videos und Texten', traduccion: 'Blätter aus Worten sammeln' },
  'banner.zh.png': { lema: '交互式字幕、词典、书籍和漫画阅读助手，以及记忆卡片：通过真实的视频和文章学日语、英语和德语', traduccion: '拾取言语之叶' },
  'banner.ko.png': { lema: '대화형 자막, 사전, 책과 만화 읽기 도우미, 카드로 실제 영상과 글에서 일본어, 영어, 독일어를 배웁니다', traduccion: '말의 잎을 모으다' },
  'banner.ja.png': { lema: 'インタラクティブな字幕、辞書、本や記事の読書アシスト、カードで、本物の動画や文章から英語とドイツ語を学ぶ', traduccion: '人の心を種として' },
};

const contexto = await chromium.launch({ channel: process.env.KK_CANAL ?? 'msedge', headless: true });
const p = await contexto.newPage({ viewport: { width: 1280, height: 420 }, deviceScaleFactor: 1.5 });
for (const [archivo, { lema, traduccion }] of Object.entries(TEXTOS)) {
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face { font-family: Nunito; font-weight: 200 1000; src: url(data:font/woff2;base64,${fuente('@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2')}) format('woff2'); }
    @font-face { font-family: Zen; font-weight: 700; src: url(data:font/woff2;base64,${fuente('@fontsource/zen-maru-gothic/files/zen-maru-gothic-japanese-700-normal.woff2')}) format('woff2'); }
    * { margin: 0; box-sizing: border-box; }
    body { width: 1280px; height: 420px; overflow: hidden; position: relative; font-family: Nunito, sans-serif; background: linear-gradient(180deg, #171433 0%, #2B2159 48%, #66355F 82%, #A5525F 100%); color: #F2F5EE; }
    svg.fondo { position: absolute; inset: 0; width: 100%; height: 100%; }
    .marca { position: absolute; left: 76px; top: 76px; display: flex; align-items: center; gap: 24px; }
    .marca svg { width: 108px; height: 108px; filter: drop-shadow(0 10px 26px rgba(147, 223, 86, 0.32)); }
    h1 { font-size: 74px; font-weight: 800; letter-spacing: -0.01em; line-height: 1; }
    .kanji { margin-top: 6px; font-family: Zen, sans-serif; font-size: 25px; font-weight: 700; letter-spacing: 0.32em; color: #CDF372; }
    .lema { position: absolute; left: 80px; top: 226px; width: 590px; font-size: 22px; line-height: 1.42; font-weight: 600; color: #E2E6EF; text-shadow: 0 1px 10px rgba(16, 12, 40, 0.6); }
    .lema:lang(ko) { word-break: keep-all; } .lema:lang(ja) { word-break: auto-phrase; }
    .subtitulo { position: absolute; right: 72px; top: 138px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .linea { display: flex; align-items: flex-end; padding: 26px 30px 16px; border-radius: 26px; background: rgba(14, 12, 32, 0.66); font-family: Zen, sans-serif; font-size: 58px; font-weight: 700; line-height: 1.1; box-shadow: 0 18px 50px rgba(8, 6, 24, 0.45); }
    .pal { position: relative; padding-bottom: 12px; }
    .pal.con::after { content: ''; position: absolute; left: 3px; right: 3px; bottom: 0; height: 4px; border-radius: 3px; background: var(--sub); }
    .pal.con:has(+ .pal.cola)::after { right: 0; border-radius: 3px 0 0 3px; }
    .pal.cola::after { left: 0 !important; border-radius: 0 3px 3px 0; }
    rt { font-size: 21px; font-weight: 700; letter-spacing: 0.04em; padding-bottom: 3px; color: inherit; }
    .trad { padding: 8px 22px; border-radius: 16px; background: rgba(14, 12, 32, 0.56); font-size: 26px; font-weight: 700; }
  </style></head><body>
    <svg class="fondo" viewBox="0 0 1280 420" preserveAspectRatio="none"><defs><radialGradient id="g"><stop offset="0" stop-color="#FFF3CF" stop-opacity=".5"/><stop offset="1" stop-color="#FFF3CF" stop-opacity="0"/></radialGradient></defs>${estrellas}<circle cx="1120" cy="70" r="140" fill="url(#g)"/><circle cx="1120" cy="70" r="40" fill="#FFF3CF"/>${montana(330, 80, '#46305F', 1.2)}${montana(372, 62, '#2F2449', 3.1)}${montana(404, 42, '#1C1833', 5.3)}</svg>
    <div class="marca">${hoja.replace(/id="kk-/g, 'id="b-').replace(/url\(#kk-/g, 'url(#b-')}<div><h1>Kotonoha</h1><div class="kanji">言の葉</div></div></div>
    <p class="lema" lang="${archivo.split('.').length > 2 ? archivo.split('.')[1] : 'es'}">${lema}</p>
    <div class="subtitulo"><div class="linea">${palabrasHtml}</div><div class="trad">${traduccion}</div></div>
  </body></html>`);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(150);
  await p.screenshot({ path: join(SALIDA, archivo) });
  console.log('Generado', archivo);
}
await contexto.close();
