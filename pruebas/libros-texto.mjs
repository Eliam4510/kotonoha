// Prueba los libros que traen su texto: un PDF japonés hecho aquí mismo por el navegador, con texto horizontal y vertical,
// y un EPUB de texto vertical con ruby, su CSS, una ilustración y trampas (un script, un atributo on*, un marco y
// direcciones de fuera). Sin OCR: el texto del PDF se toca palabra a palabra, y el EPUB se pinta con su propio formato y
// el lector de páginas encima. Comprueba también capítulos, enlaces, índice, zoom, texto horizontal y memoria.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/libros-texto.mjs

import { mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-libros-texto'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'libros-texto');
mkdirSync(CAPTURAS, { recursive: true });
rmSync(PERFIL, { recursive: true, force: true });
const sharp = createRequire(join(RAIZ, 'package.json'))('sharp');

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};
const esperar = async (fn, ms = 10000) => {
  const limite = Date.now() + ms;
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() > limite) return null;
    await new Promise((r) => setTimeout(r, 100));
  }
};

const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1280, height: 800 },
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
for (const pg of contexto.pages()) if (pg.url().includes('app.html')) await pg.close();
await sw.evaluate(async () => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), bienvenidaVista: true, idiomaInterfaz: 'es', idiomaObjetivo: 'ja', destino: 'memoria', ankiPuerto: 1 } });
});
const errores = [];
const externas = [];
contexto.on('request', (r) => {
  if (r.url().includes('example.invalid')) externas.push(r.url());
});

// ---------- Los libros ----------

const LETRA = "'Yu Gothic','Meiryo',sans-serif";
const hoja = await contexto.newPage();
await hoja.setContent(`<!doctype html><html lang="ja"><meta charset="utf-8"><style>
  body { font-family: ${LETRA}; margin: 48px; color: #111; }
  p { font-size: 20px; line-height: 1.9; margin: 0 0 14px; }
  .tate { writing-mode: vertical-rl; height: 360px; font-size: 22px; margin: 36px 0 0 auto; }
</style>
<p>今日は図書館で本を読みます。</p>
<p>天気がいいので公園を散歩しました。</p>
<div class="tate">縦書きの文章を電車で読みます。</div></html>`);
const PDF = await hoja.pdf({ format: 'A5', printBackground: true });
await hoja.close();

const png = (color, texto, ancho = 400, alto = 560) =>
  sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}"><rect width="100%" height="100%" fill="${color}"/><text x="50%" y="50%" font-size="60" text-anchor="middle" fill="#333">${texto}</text></svg>`)).png().toBuffer();
const TAPA = await png('#d9c7a5', 'TAPA');
const ILUSTRACION = await png('#a5c7d9', 'ILUST', 300, 200);

const PARRAFO = 'どこで生れたかとんと見当がつかぬ。何でも薄暗いじめじめした所でニャーニャー泣いていた事だけは記憶している。';
const capitulo1 = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" class="vrtl" xml:lang="ja">
<head><title>第一章</title><link rel="stylesheet" type="text/css" href="../style/libro.css"/><script>window.__malo = 1;</script></head>
<body>
<h1 id="c1">第一章</h1>
<p id="primero">吾輩は<ruby>猫<rt>ねこ</rt></ruby>である。名前はまだ無い。</p>
<p><img src="../image/ilustracion.png" alt="挿絵"/><img src="https://example.invalid/rastreo.png" alt=""/><img src="no-esta.png" onerror="window.__malo2 = 1" alt=""/></p>
<iframe src="https://example.invalid/marco"></iframe>
<p class="rastreo" onclick="window.__malo3 = 1">${PARRAFO}</p>
${Array.from({ length: 40 }, () => `<p>${PARRAFO}</p>`).join('\n')}
<p><a href="c2.xhtml#s2">第二章へ</a></p>
</body></html>`;
const capitulo2 = `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" class="hltr" xml:lang="ja">
<head><title>第二章</title><link rel="stylesheet" type="text/css" href="../style/libro.css"/></head>
<body><h1>第二章</h1>${Array.from({ length: 30 }, () => `<p>${PARRAFO}</p>`).join('\n')}<p id="s2">ここが第二章の真ん中です。</p>${Array.from({ length: 30 }, () => `<p>${PARRAFO}</p>`).join('\n')}</body></html>`;
const EPUB = zipSync({
  mimetype: [strToU8('application/epub+zip'), { level: 0 }],
  'META-INF/container.xml': strToU8('<?xml version="1.0"?><container><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'),
  'OEBPS/content.opf': strToU8(`<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>猫の小説</dc:title><dc:language>ja</dc:language></metadata>
    <manifest>
      <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
      <item id="css" href="style/libro.css" media-type="text/css"/>
      <item id="tapa" href="image/tapa.png" media-type="image/png" properties="cover-image"/>
      <item id="ilu" href="image/ilustracion.png" media-type="image/png"/>
      <item id="c1" href="text/c1.xhtml" media-type="application/xhtml+xml"/>
      <item id="c2" href="text/c2.xhtml" media-type="application/xhtml+xml"/>
    </manifest>
    <spine page-progression-direction="rtl"><itemref idref="c1"/><itemref idref="c2"/></spine></package>`),
  'OEBPS/nav.xhtml': strToU8('<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><ol><li><a href="text/c1.xhtml">第一章</a></li><li><a href="text/c2.xhtml#s2">第二章の真ん中</a></li></ol></nav></body></html>'),
  'OEBPS/style/libro.css': strToU8('html.vrtl { -epub-writing-mode: vertical-rl; } p { margin: 0; text-indent: 1em; } .rastreo { background: url(https://example.invalid/fondo.gif); } @import url("https://example.invalid/otra.css");'),
  'OEBPS/image/tapa.png': new Uint8Array(TAPA),
  'OEBPS/image/ilustracion.png': new Uint8Array(ILUSTRACION),
  'OEBPS/text/c1.xhtml': strToU8(capitulo1),
  'OEBPS/text/c2.xhtml': strToU8(capitulo2),
});

// ---------- Importar ----------

console.log('\n== Importar ==');
const app = await contexto.newPage();
app.on('pageerror', (e) => errores.push(e.message));
await app.goto(`chrome-extension://${id}/app.html#/biblioteca`);
const ARCHIVO = 'input[type=file][aria-label="Importar archivos"]';
await app.waitForSelector(ARCHIVO, { state: 'attached' });
await app.setInputFiles(ARCHIVO, [
  { name: 'japones.pdf', mimeType: 'application/pdf', buffer: PDF },
  { name: 'novela.epub', mimeType: 'application/epub+zip', buffer: Buffer.from(EPUB) },
]);
const estante = await esperar(() =>
  app.evaluate(() => {
    const l = [...document.querySelectorAll('.ap-libro')];
    return l.length === 2 ? l.map((x) => ({ titulo: x.querySelector('h3')?.textContent, faja: x.querySelector('.ap-obi .num')?.textContent, portada: !!x.querySelector('.ap-tapa-imagen') })) : null;
  }), 20000);
const novela = estante?.find((x) => x.titulo === '猫の小説');
comprobar(!!novela && novela.faja === '2 capítulos' && novela.portada, 'El EPUB de texto entra como libro, con sus capítulos y su portada', JSON.stringify(estante));

const abrir = async (titulo) => {
  const nueva = contexto.waitForEvent('page', { timeout: 15000 });
  await app.locator(`button.ap-tapa[aria-label*="${titulo}"]`).first().click();
  const v = await nueva;
  v.on('pageerror', (e) => errores.push(e.message));
  return v;
};

// ---------- PDF con texto ----------

console.log('\n== PDF con texto ==');
let v = await abrir('japones');
const lineas = await esperar(() => v.evaluate(() => {
  const l = [...document.querySelectorAll('.vs-linea')].map((b) => b.getAttribute('aria-label'));
  return l.length >= 3 ? l : null;
}), 20000);
console.log('  líneas:', JSON.stringify(lineas));
comprobar(!!lineas, 'Sin pedir el OCR, las líneas del PDF ya se pueden tocar');
comprobar(!!lineas?.includes('今日は図書館で本を読みます。') && !!lineas?.includes('天気がいいので公園を散歩しました。'), 'Con el texto del archivo, renglón a renglón');
comprobar(!!lineas?.includes('縦書きの文章を電車で読みます。'), 'También la columna vertical, entera');
comprobar(await v.evaluate(() => document.querySelector('[aria-label="Leer el texto de las páginas"]')?.getAttribute('aria-pressed') === 'false'), 'Y sin encender el OCR ni descargar nada');

/** Toca la letra n de una línea, como se haría con el ratón. */
const tocarLetra = async (texto, n) => {
  const caja = await v.locator(`.vs-linea[aria-label="${texto}"]`).boundingBox();
  const vertical = caja.height > caja.width;
  const t = (n + 0.5) / [...texto].length;
  await v.mouse.click(vertical ? caja.x + caja.width / 2 : caja.x + caja.width * t, vertical ? caja.y + caja.height * t : caja.y + caja.height / 2);
};
/** La palabra elegida en el panel, sin su furigana. */
const elegida = (esperada) =>
  esperar(() =>
    v.evaluate((e) => {
      const el = document.querySelector('.vs-panel-linea .pal.ap-elegida');
      if (!el) return null;
      const copia = el.cloneNode(true);
      for (const rt of copia.querySelectorAll('rt')) rt.remove();
      return !e || copia.textContent === e ? copia.textContent : null;
    }, esperada)
  );
await tocarLetra('今日は図書館で本を読みます。', 4);
comprobar((await elegida('図書館')) === '図書館', 'Tocar una palabra en la página la elige en el panel', await elegida());
comprobar(!!(await esperar(() => v.evaluate(() => !!document.querySelector('.vs-panel-linea .vs-ficha .ficha')))), 'Con su ficha abierta');
const marca = await v.evaluate(() => {
  const m = document.querySelector('.vs-marca')?.getBoundingClientRect();
  const l = document.querySelector('.vs-linea[aria-label="今日は図書館で本を読みます。"]')?.getBoundingClientRect();
  return m && l ? { ancho: m.width / l.width, dentro: m.left >= l.left - 1 && m.right <= l.right + 1 } : null;
});
comprobar(!!marca && marca.dentro && marca.ancho > 0.12 && marca.ancho < 0.4, 'Y marcada en la página, sobre sus letras', JSON.stringify(marca));
await tocarLetra('縦書きの文章を電車で読みます。', 7);
comprobar((await elegida('電車')) === '電車', 'También en la columna vertical', await elegida());
await v.screenshot({ path: join(CAPTURAS, 'pdf.png') });
await v.close();

// ---------- EPUB de texto ----------

console.log('\n== EPUB de texto ==');
v = await abrir('猫の小説');
const libro = async () => {
  const f = await esperar(async () => v.frames().find((x) => x.url().includes('/libro.html') && !x.isDetached()) ?? null, 15000);
  if (!f) return null;
  await esperar(() => f.evaluate(() => document.documentElement.classList.contains('kk-vertical') || document.documentElement.classList.contains('kk-horizontal')), 15000);
  return f;
};
let f = await libro();
comprobar(!!f, 'Se abre en el visor, con el capítulo en su marco');
const pintado = await f?.evaluate(() => ({
  modo: getComputedStyle(document.documentElement).writingMode,
  ruby: document.querySelector('ruby rt')?.textContent,
  ilustracion: document.querySelector('img[alt="挿絵"]')?.naturalWidth ?? 0,
  sangria: getComputedStyle(document.querySelector('#primero')).textIndent,
}));
comprobar(pintado?.modo === 'vertical-rl', 'Con su escritura vertical, que el libro pone con -epub-writing-mode', pintado?.modo);
comprobar(pintado?.ruby === 'ねこ' && pintado?.ilustracion > 0, 'Con su ruby y su ilustración', JSON.stringify(pintado));
comprobar(pintado?.sangria !== '0px', 'Y con su propio CSS', pintado?.sangria);

const seguro = await f?.evaluate(() => ({
  ejecutado: [window.__malo, window.__malo2, window.__malo3].some((x) => x !== undefined),
  peligrosos: document.querySelectorAll('script:not([src="libro.js"]), iframe, object, embed').length,
  atributos: [...document.querySelectorAll('*')].filter((el) => [...el.attributes].some((a) => a.name.toLowerCase().startsWith('on'))).length,
  imagenes: [...document.images].every((i) => !i.getAttribute('src') || i.src.startsWith('blob:')),
  fuera: [...document.querySelectorAll('style')].some((s) => s.textContent.includes('example.invalid')),
}));
comprobar(!!seguro && !seguro.ejecutado && !seguro.peligrosos && !seguro.atributos && seguro.imagenes && !seguro.fuera, 'Nada del libro se ejecuta ni carga nada de fuera', JSON.stringify(seguro));

const analizado = await esperar(() => f.evaluate(() => Number(document.querySelector('kotonoha-overlay')?.dataset.kkAnalizados ?? 0) > 0 || Number(document.querySelector('kotonoha-overlay')?.dataset.kkBloques ?? 0) > 0), 20000);
comprobar(!!analizado, 'El lector de páginas analiza el capítulo');

/** El centro de un trozo del texto de un elemento, en coordenadas de la pestaña. */
const puntoDe = async (selector, palabra) => {
  const marcoCaja = await v.locator('iframe.vs-libro').boundingBox();
  const r = await f.evaluate(([s, p]) => {
    const el = document.querySelector(s);
    const recorrer = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = recorrer.nextNode(); n; n = recorrer.nextNode()) {
      const i = n.data.indexOf(p);
      if (i < 0) continue;
      const rango = document.createRange();
      rango.setStart(n, i);
      rango.setEnd(n, i + p.length);
      const c = rango.getBoundingClientRect();
      return { x: c.left + c.width / 2, y: c.top + c.height / 2 };
    }
    return null;
  }, [selector, palabra]);
  return r && marcoCaja ? { x: marcoCaja.x + r.x, y: marcoCaja.y + r.y } : null;
};
await esperar(() => f.evaluate(() => Number(document.querySelector('kotonoha-overlay')?.dataset.kkAnalizados ?? 0) > 0), 20000);
const p = await puntoDe('#primero', '名前');
if (p) await v.mouse.click(p.x, p.y);
const ficha = await esperar(() => f.evaluate(() => document.querySelector('kotonoha-overlay')?.shadowRoot?.querySelector('.popup-palabra')?.textContent ?? null));
comprobar(!!ficha && ficha.includes('名前'), 'Tocar una palabra abre su ficha, como en una web', ficha?.slice(0, 40));
await v.screenshot({ path: join(CAPTURAS, 'epub-vertical.png') });
await v.keyboard.press('Escape');

const izquierda = () => f.evaluate(() => document.scrollingElement.scrollLeft);
await f.evaluate(() => {
  window.__teclas = [];
  window.addEventListener('keydown', (e) => window.__teclas.push(e.key), true);
});
const antes = await izquierda();
await v.keyboard.press('PageDown');
await v.waitForTimeout(300);
const despues = await izquierda();
const medidas = await f.evaluate(() => ({ ancho: document.scrollingElement.scrollWidth, vista: document.scrollingElement.clientWidth, teclas: window.__teclas, foco: document.hasFocus() }));
comprobar(despues < antes - 100, 'Pasar de página en vertical avanza hacia la izquierda', `${antes} → ${despues} ${JSON.stringify(medidas)}`);

await f.evaluate(() => {
  const r = document.scrollingElement;
  r.scrollLeft = -(r.scrollWidth - r.clientWidth);
});
await v.waitForTimeout(200);
await v.keyboard.press('PageDown');
f = await esperar(async () => {
  const x = v.frames().find((y) => y.url().includes('c=1') && !y.isDetached());
  return x && (await x.evaluate(() => document.documentElement.classList.contains('kk-horizontal')).catch(() => false)) ? x : null;
}, 15000);
comprobar(!!f, 'Al final del capítulo, la página siguiente es el capítulo siguiente');
comprobar((await v.evaluate(() => document.querySelector('.vs-numero')?.value)) === '2', 'Y la barra dice en qué capítulo se está');
comprobar((await f?.evaluate(() => getComputedStyle(document.documentElement).writingMode)) === 'horizontal-tb', 'Un capítulo horizontal se ve en horizontal');

await v.click('[aria-label="Índice"]');
const entradas = await v.evaluate(() => [...document.querySelectorAll('.vs-indice button span:first-child')].map((s) => s.textContent));
comprobar(JSON.stringify(entradas) === JSON.stringify(['第一章', '第二章の真ん中']), 'El índice del libro', JSON.stringify(entradas));
await v.locator('.vs-indice button').first().click();
f = await esperar(async () => {
  const x = v.frames().find((y) => y.url().includes('c=0') && !y.isDetached());
  return x && (await x.evaluate(() => document.documentElement.classList.contains('kk-vertical')).catch(() => false)) ? x : null;
}, 15000);
comprobar(!!f, 'Una entrada del índice lleva a su capítulo');

await f?.evaluate(() => document.querySelector('a[data-kk-capitulo]').scrollIntoView());
const enlace = await (async () => {
  const marcoCaja = await v.locator('iframe.vs-libro').boundingBox();
  const r = await f.evaluate(() => {
    const c = document.querySelector('a[data-kk-capitulo]').getBoundingClientRect();
    return { x: c.left + c.width / 2, y: c.top + c.height / 2 };
  });
  return { x: marcoCaja.x + r.x, y: marcoCaja.y + r.y };
})();
await v.mouse.click(enlace.x, enlace.y);
f = await esperar(async () => {
  const x = v.frames().find((y) => y.url().includes('c=1') && y.url().includes('#s2') && !y.isDetached());
  return x && (await x.evaluate(() => document.documentElement.classList.contains('kk-horizontal')).catch(() => false)) ? x : null;
}, 15000);
const visible = await f?.evaluate(() => {
  const c = document.getElementById('s2').getBoundingClientRect();
  return c.top >= -2 && c.top < innerHeight;
});
comprobar(!!visible, 'Un enlace a otro capítulo lleva a su sitio dentro de él');

await v.click('[aria-label="Acercar"]');
await v.waitForTimeout(300);
comprobar((await v.evaluate(() => document.querySelector('iframe.vs-libro')?.style.transform)) === 'scale(1.1)', 'El zoom agranda el libro', await v.evaluate(() => document.querySelector('iframe.vs-libro')?.style.transform));
await v.waitForTimeout(900);
await v.close();

v = await abrir('猫の小説');
f = await libro();
comprobar((await v.evaluate(() => document.querySelector('.vs-numero')?.value)) === '2' && f?.url().includes('c=1'), 'Al volver a abrirlo, sigue en el mismo capítulo');
await v.locator('.vs-indice button').first().click().catch(() => {});
await v.click('[aria-label="Índice"]').catch(() => {});
await v.locator('.vs-indice button').first().click();
f = await esperar(async () => {
  const x = v.frames().find((y) => y.url().includes('c=0') && !y.isDetached());
  return x && (await x.evaluate(() => document.documentElement.classList.contains('kk-vertical')).catch(() => false)) ? x : null;
}, 15000);
await v.click('[aria-label="Texto vertical"]');
f = await esperar(async () => {
  const x = v.frames().find((y) => y.url().includes('h=1') && !y.isDetached());
  return x && (await x.evaluate(() => document.documentElement.classList.contains('kk-horizontal')).catch(() => false)) ? x : null;
}, 15000);
comprobar((await f?.evaluate(() => getComputedStyle(document.querySelector('#primero')).writingMode)) === 'horizontal-tb', 'Un libro vertical se puede leer en horizontal');
comprobar((await v.evaluate(() => document.querySelector('[aria-label="Texto vertical"]')?.getAttribute('aria-pressed'))) === 'false', 'Y el botón lo dice');
await v.screenshot({ path: join(CAPTURAS, 'epub-horizontal.png') });
await v.close();

comprobar(externas.length === 0, 'Ninguna petición a direcciones de fuera del libro', JSON.stringify(externas.slice(0, 3)));
if (errores.length) console.log('\nErrores en la página:', [...new Set(errores)].slice(0, 6));
comprobar(errores.length === 0, 'Sin errores en las páginas');
console.log(`\n${fallos ? `${fallos} comprobaciones fallaron` : 'Todas las comprobaciones pasaron'}`);
await contexto.close();
process.exit(fallos ? 1 : 0);
