// Prepara las imágenes de las tiendas a partir de las capturas de la documentación: las capturas en 1280×800, que es
// lo que piden Chrome Web Store y Edge Add-ons, y el mosaico promocional de 440×280.
// Uso: node herramientas/tienda.mjs   (necesita FFmpeg en el PATH y Playwright con Edge)

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const RAIZ = resolve(import.meta.dirname, '..');
const ORIGEN = join(RAIZ, 'docs', 'img');
const DESTINO = join(RAIZ, 'docs', 'tienda', 'img');
const FONDO = '0x0D1210';
mkdirSync(DESTINO, { recursive: true });

// En este orden salen en la ficha: lo primero que se ve es lo que más importa.
const CAPTURAS = ['ficha', 'lector-web', 'ocr', 'practica', 'trazos'];
const IDIOMAS = { en: '.en', es: '' };

for (const [idioma, sufijo] of Object.entries(IDIOMAS)) {
  CAPTURAS.forEach((nombre, i) => {
    const origen = join(ORIGEN, `${nombre}${sufijo}.png`);
    if (!existsSync(origen)) throw new Error(`Falta ${origen}`);
    const destino = join(DESTINO, `${idioma}-${i + 1}-${nombre}.png`);
    // Se encaja en 1280×800 sin deformar, sobre el fondo oscuro de la app.
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', origen, '-vf', `scale=1280:800:force_original_aspect_ratio=decrease,pad=1280:800:(ow-iw)/2:(oh-ih)/2:color=${FONDO}`, '-frames:v', '1', destino]);
    console.log(destino);
  });
}

// El mosaico: el icono, el nombre y una frase, con la tipografía de la extensión.
const icono = readFileSync(join(RAIZ, 'publico', 'icono128.png')).toString('base64');
const nunito = readFileSync(join(RAIZ, 'node_modules', '@fontsource-variable', 'nunito', 'files', 'nunito-latin-wght-normal.woff2')).toString('base64');
const zen = readFileSync(join(RAIZ, 'node_modules', '@fontsource', 'zen-maru-gothic', 'files', 'zen-maru-gothic-japanese-700-normal.woff2')).toString('base64');
const mosaico = (idioma) => `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: Nunito; src: url(data:font/woff2;base64,${nunito}) format('woff2'); font-weight: 200 1000; }
@font-face { font-family: Zen; src: url(data:font/woff2;base64,${zen}) format('woff2'); font-weight: 700; }
html, body { margin: 0; width: 440px; height: 280px; }
body { background: radial-gradient(120% 120% at 85% 0%, #1F3A24 0%, #0D1210 60%); color: #F2F5EE; font-family: Nunito, sans-serif; display: grid; place-items: center; }
.c { display: grid; justify-items: center; gap: 10px; text-align: center; padding: 0 28px; }
img { width: 72px; height: 72px; }
.jp { font-family: Zen, sans-serif; font-size: 18px; color: #A9E45B; letter-spacing: 0.08em; }
h1 { margin: 0; font-size: 34px; font-weight: 800; letter-spacing: -0.01em; }
p { margin: 0; font-size: 15px; color: #C9D2CB; line-height: 1.35; }
</style><div class="c"><img src="data:image/png;base64,${icono}"><div class="jp">言の葉</div><h1>Kotonoha</h1><p>${idioma === 'es' ? 'Aprende idiomas con lo que ya ves y lees' : 'Learn languages from what you already watch and read'}</p></div>`;

const navegador = await chromium.launch({ channel: process.env.KK_CANAL ?? 'msedge', headless: true });
const pagina = await navegador.newPage({ viewport: { width: 440, height: 280 } });
for (const idioma of Object.keys(IDIOMAS)) {
  await pagina.setContent(mosaico(idioma));
  await pagina.waitForTimeout(300);
  const destino = join(DESTINO, `${idioma}-mosaico-440x280.png`);
  await pagina.screenshot({ path: destino });
  console.log(destino);
}
await navegador.close();
