// La imagen que GitHub y las redes muestran al compartir el enlace del repositorio (1280 × 640), con el diseño del banner.
// Uso: node herramientas/social.mjs. Se sube a mano en Settings > General > Social preview.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fuente = (ruta) => readFileSync(join(RAIZ, 'node_modules', ruta)).toString('base64');
const hoja = readFileSync(join(RAIZ, 'herramientas', 'marca', 'hoja.svg'), 'utf8');

const montana = (y, amp, color, semilla) => {
  let d = `M0 640 L0 ${y}`;
  for (let x = 0; x <= 1296; x += 48) {
    const h = y - amp * (0.5 + 0.5 * Math.sin(x / 130 + semilla)) - amp * 0.35 * Math.sin(x / 47 + semilla * 2);
    d += ` L${x} ${h.toFixed(1)}`;
  }
  return `<path d="${d} L1280 640 Z" fill="${color}"/>`;
};
const estrellas = Array.from({ length: 90 }, (_, i) => `<circle cx="${((i * 197.3) % 1280).toFixed(0)}" cy="${((i * 71.9) % 380).toFixed(0)}" r="${(0.6 + ((i * 13) % 10) / 10).toFixed(1)}" fill="#fff" opacity="${(0.25 + ((i * 7) % 10) / 16).toFixed(2)}"/>`).join('');

const navegador = await chromium.launch({ channel: process.env.KK_CANAL ?? 'msedge', headless: true });
const p = await navegador.newPage({ viewport: { width: 1280, height: 640 } });
await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face { font-family: Nunito; font-weight: 200 1000; src: url(data:font/woff2;base64,${fuente('@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2')}) format('woff2'); }
  @font-face { font-family: Zen; font-weight: 700; src: url(data:font/woff2;base64,${fuente('@fontsource/zen-maru-gothic/files/zen-maru-gothic-japanese-700-normal.woff2')}) format('woff2'); }
  * { margin: 0; box-sizing: border-box; }
  body { width: 1280px; height: 640px; overflow: hidden; position: relative; font-family: Nunito, sans-serif; color: #F2F5EE; background: linear-gradient(180deg, #171433 0%, #2B2159 46%, #66355F 80%, #A5525F 100%); }
  svg.fondo { position: absolute; inset: 0; width: 100%; height: 100%; }
  .centro { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; padding-top: 92px; gap: 26px; }
  .marca { display: flex; align-items: center; gap: 26px; }
  .marca svg { width: 118px; height: 118px; filter: drop-shadow(0 10px 26px rgba(147, 223, 86, 0.32)); }
  h1 { font-size: 92px; font-weight: 800; letter-spacing: -0.01em; line-height: 1; }
  .kanji { margin-top: 8px; font-family: Zen, sans-serif; font-size: 28px; letter-spacing: 0.34em; color: #CDF372; }
  .lema { max-width: 980px; text-align: center; text-wrap: balance; font-size: 34px; font-weight: 700; line-height: 1.3; text-shadow: 0 2px 14px rgba(16, 12, 40, 0.6); }
  .linea { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; }
  .chip { padding: 9px 20px; border-radius: 999px; background: rgba(14, 12, 32, 0.6); font-size: 23px; font-weight: 700; color: #E2E6EF; }
  .chip b { color: #CDF372; }
</style></head><body>
  <svg class="fondo" viewBox="0 0 1280 640" preserveAspectRatio="none"><defs><radialGradient id="g"><stop offset="0" stop-color="#FFF3CF" stop-opacity=".5"/><stop offset="1" stop-color="#FFF3CF" stop-opacity="0"/></radialGradient></defs>${estrellas}<circle cx="1120" cy="96" r="150" fill="url(#g)"/><circle cx="1120" cy="96" r="44" fill="#FFF3CF"/>${montana(520, 90, '#46305F', 1.2)}${montana(574, 66, '#2F2449', 3.1)}${montana(618, 44, '#1C1833', 5.3)}</svg>
  <div class="centro">
    <div class="marca">${hoja.replace(/id="kk-/g, 'id="s-').replace(/url\(#kk-/g, 'url(#s-')}<div><h1>Kotonoha</h1><div class="kanji">言の葉</div></div></div>
    <p class="lema">Learn Japanese, English and German from real video, web pages, books and manga</p>
    <div class="linea"><span class="chip"><b>Interactive</b> subtitles</span><span class="chip">Word panel with <b>Claude</b></span><span class="chip">On-device <b>OCR</b></span><span class="chip"><b>Anki</b> cards</span></div>
  </div>
</body></html>`);
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(150);
await p.screenshot({ path: join(RAIZ, 'docs', 'img', 'social.png') });
console.log('Generado docs/img/social.png');
await navegador.close();
