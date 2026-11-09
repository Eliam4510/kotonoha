// Prueba el orden de los trazos en la ficha, el Portapapeles en su pestaña propia (también en vista dividida) y que el
// texto conserve su estructura: lo copiado de una página, el Markdown, lo pegado y un EPUB importado.
// Los trazos se piden de verdad a KanjiVG: necesita conexión la primera vez.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/trazos-web.mjs

import { mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-trazos'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'trazos-web');
mkdirSync(CAPTURAS, { recursive: true });
rmSync(PERFIL, { recursive: true, force: true });

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};

const PAGINA = `<!doctype html><html lang="ja"><meta charset="utf-8"><title>読み物</title>
<style>body { margin: 0; font: 18px/2 sans-serif; padding: 40px; background: #fff; color: #222; }</style>
<p id="p">今日は東京の天気について書きます。ねこが好きです。</p></html>`;

const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1280, height: 800 },
  permissions: ['clipboard-read', 'clipboard-write'],
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});
await contexto.route('https://paginas.test/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: PAGINA }));
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
for (const pg of contexto.pages()) if (pg.url().includes('app.html')) await pg.close();
await sw.evaluate(async () => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), lectorActivo: true, lectorFurigana: 'todas', destino: 'memoria', ankiPuerto: 1, bienvenidaVista: true, idiomaInterfaz: 'es' } });
});

const errores = [];
const p = await contexto.newPage();
p.on('pageerror', (e) => errores.push(e.message));

const esperar = async (pagina, fn, arg, ms = 15000) => {
  const limite = Date.now() + ms;
  for (;;) {
    const v = await pagina.evaluate(fn, arg).catch(() => null);
    if (v) return v;
    if (Date.now() > limite) return null;
    await pagina.waitForTimeout(80);
  }
};

// ---------- Trazos en la ficha ----------

console.log('\n== Trazos en la ficha ==');
await p.goto('https://paginas.test/articulo');
await esperar(p, () => Number(document.querySelector('kotonoha-overlay')?.dataset.kkRangos) > 0, undefined, 30000);
const punto = await p.evaluate(() => {
  const w = document.createTreeWalker(document.getElementById('p'), NodeFilter.SHOW_TEXT);
  w.nextNode();
  const i = w.currentNode.data.indexOf('天気');
  const r = document.createRange();
  r.setStart(w.currentNode, i);
  r.setEnd(w.currentNode, i + 1);
  const c = r.getBoundingClientRect();
  return { x: c.left + c.width / 2, y: c.top + c.height / 2 };
});
await p.mouse.click(punto.x, punto.y);
await esperar(p, () => document.querySelector('kotonoha-overlay')?.shadowRoot?.querySelector('.ficha-palabra'));
const pestana = await p.evaluate(() => {
  const b = [...document.querySelector('kotonoha-overlay').shadowRoot.querySelectorAll('.pestana')].find((x) => /Trazos/.test(x.textContent));
  b?.click();
  return !!b;
});
comprobar(pestana, 'La ficha tiene la pestaña de trazos');
const lienzos = await esperar(p, () => {
  const r = document.querySelector('kotonoha-overlay').shadowRoot;
  const l = [...r.querySelectorAll('.trazo-kanji svg')];
  return l.length ? l.map((s) => s.querySelectorAll('.trazo-fondo').length) : null;
}, undefined, 20000);
comprobar(lienzos?.length === 2, 'Enseña cada kanji de la palabra', JSON.stringify(lienzos));
comprobar(lienzos?.[0] === 4 && lienzos?.[1] === 6, 'Con sus trazos reales: 天 tiene 4 y 気 tiene 6', JSON.stringify(lienzos));

const estado = () => p.evaluate(() => {
  const r = document.querySelector('kotonoha-overlay').shadowRoot;
  return { hechos: r.querySelectorAll('.trazo-hecho').length, dibujando: r.querySelectorAll('.trazo-dibujando').length, cuenta: r.querySelector('.trazos-cuenta')?.textContent, numeros: r.querySelectorAll('.trazo-numero').length };
});
const e0 = await estado();
await p.waitForTimeout(1600);
const e1 = await estado();
comprobar(e1.hechos > e0.hechos, 'Se dibuja solo, trazo a trazo', `${e0.hechos} → ${e1.hechos}, ${e1.cuenta}`);
comprobar(e1.dibujando <= 1, 'De uno en uno', e1.dibujando);
await p.screenshot({ path: join(CAPTURAS, 'ficha-trazos.png') });
const animado = await p.evaluate(() => {
  const d = document.querySelector('kotonoha-overlay').shadowRoot.querySelector('.trazo-dibujando');
  return d ? getComputedStyle(d).animationName : '';
});
comprobar(animado === 'kk-trazo' || animado === '', 'El trazo en curso lleva su animación', animado);

// A mano: pausar, avanzar y retroceder.
const pulsar = (nombre) => p.evaluate((n) => document.querySelector('kotonoha-overlay').shadowRoot.querySelector(`.trazos-controles button[aria-label="${n}"]`)?.click(), nombre);
await pulsar('Pausar');
await p.waitForTimeout(150);
const quieto = await estado();
await p.waitForTimeout(1100);
const sigueQuieto = await estado();
comprobar(quieto.hechos === sigueQuieto.hechos && sigueQuieto.dibujando === 0, 'Se puede pausar', `${quieto.hechos} y ${sigueQuieto.hechos}`);
await pulsar('Trazo siguiente');
await p.waitForTimeout(100);
const adelante = await estado();
comprobar(adelante.hechos === sigueQuieto.hechos + 1, 'Y avanzar de uno en uno', `${sigueQuieto.hechos} → ${adelante.hechos}`);
await pulsar('Trazo anterior');
await p.waitForTimeout(100);
comprobar((await estado()).hechos === sigueQuieto.hechos, 'Y retroceder');
await pulsar('Reproducir');
await p.waitForTimeout(900);
comprobar((await estado()).hechos >= sigueQuieto.hechos, 'Y seguir');

// Vuelve a empezar solo, como un GIF: 10 trazos a velocidad doble y la pausa final.
await p.evaluate(() => [...document.querySelector('kotonoha-overlay').shadowRoot.querySelectorAll('.trazos-velocidad button')].find((b) => b.textContent === '2×')?.click());
await pulsar('Volver a empezar');
const volvio = await (async () => {
  let maximo = 0;
  const limite = Date.now() + 12000;
  while (Date.now() < limite) {
    const { hechos } = await estado();
    if (hechos > maximo) maximo = hechos;
    if (maximo >= 10 && hechos < 3) return maximo;
    await p.waitForTimeout(120);
  }
  return false;
})();
comprobar(volvio === 10, 'Termina y vuelve a empezar en bucle', volvio);

await p.keyboard.press('Escape');
await p.waitForTimeout(150);
const guardado = await sw.evaluate(async () => {
  const r = await chrome.runtime.sendMessage({ canal: 'motor', metodo: 'trazos', args: ['天'] });
  return r.ok ? r.valor?.trazos.length : r.error;
});
comprobar(guardado === 4, 'El motor los devuelve', guardado);

// Una palabra nueva vuelve a dibujarse aunque la anterior se quedara en pausa.
const otroPunto = await p.evaluate(() => {
  const w = document.createTreeWalker(document.getElementById('p'), NodeFilter.SHOW_TEXT);
  w.nextNode();
  const i = w.currentNode.data.indexOf('東京');
  const r = document.createRange();
  r.setStart(w.currentNode, i);
  r.setEnd(w.currentNode, i + 1);
  const c = r.getBoundingClientRect();
  return { x: c.left + c.width / 2, y: c.top + c.height / 2 };
});
await p.mouse.click(punto.x, punto.y);
await esperar(p, () => document.querySelector('kotonoha-overlay')?.shadowRoot?.querySelector('.ficha-palabra'));
await p.evaluate(() => [...document.querySelector('kotonoha-overlay').shadowRoot.querySelectorAll('.pestana')].find((x) => /Trazos/.test(x.textContent))?.click());
await esperar(p, () => document.querySelector('kotonoha-overlay')?.shadowRoot?.querySelector('.trazos-controles'));
await pulsar('Pausar');
await p.mouse.click(otroPunto.x, otroPunto.y);
const otraPalabra = await esperar(p, () => {
  const r = document.querySelector('kotonoha-overlay')?.shadowRoot;
  return r?.querySelectorAll('.trazo-kanji b')[0]?.textContent === '東' ? true : null;
});
comprobar(!!otraPalabra, 'Cambiar de palabra cambia los trazos');
const primero = await estado();
await p.waitForTimeout(1600);
const luego = await estado();
comprobar(luego.hechos > primero.hechos, 'Y la palabra nueva se dibuja aunque la anterior estuviera en pausa', `${primero.hechos} → ${luego.hechos}`);
await p.keyboard.press('Escape');
await p.waitForTimeout(150);
const inexistente = await sw.evaluate(async () => {
  const r = await chrome.runtime.sendMessage({ canal: 'motor', metodo: 'trazos', args: ['�'] });
  return r.ok ? r.valor : `error: ${r.error}`;
});
comprobar(inexistente === null, 'Un carácter sin datos no da error', String(inexistente));

// ---------- Lector en su pestaña ----------

console.log('\n== Cuaderno en su pestaña ==');
const TEXTO = '今日は図書館で本を読みます。天気がいいです。';
// El Cuaderno abre con lo que se le haya dejado escrito; escribir en su editor ya lo prueba pruebas/cuaderno.mjs.
await sw.evaluate(async (texto) => {
  await chrome.storage.local.set({ lectorTexto: texto });
  await chrome.storage.local.remove('notaCuaderno');
}, TEXTO);
const app = await contexto.newPage();
await app.goto(`chrome-extension://${id}/app.html#/lector`);
await app.waitForSelector('.ap-papel .pal', { timeout: 20000 });
const botonWeb = app.locator('button', { hasText: 'Modo web' }).first();
comprobar(await botonWeb.count() > 0, 'El Cuaderno de la app tiene el botón «Modo web»');
const nueva = contexto.waitForEvent('page', { timeout: 10000 }).catch(() => null);
await botonWeb.click();
const web = await nueva;
comprobar(!!web, 'Abre una pestaña');
await web.waitForLoadState('domcontentloaded');
web.on('pageerror', (e) => errores.push(e.message));
comprobar(web.url().endsWith('/lector.html'), 'Con dirección propia', web.url());
const conTexto = await esperar(web, () => document.querySelectorAll('.ap-papel .pal').length > 0, undefined, 15000);
comprobar(!!conTexto, 'Llega con el texto ya analizado');
const textoWeb = await web.evaluate(() => document.querySelector('.ap-papel')?.textContent ?? '');
comprobar(textoWeb.includes('図書館'), 'Es el mismo texto', textoWeb.slice(0, 30));
const titulo = await web.title();
comprobar(/Cuaderno/.test(titulo), 'La pestaña se llama como debe', titulo);
comprobar(await web.evaluate(() => !document.querySelector('.ap-lateral')), 'No lleva la barra lateral de la app');
await web.screenshot({ path: join(CAPTURAS, 'lector-web.png') });

// Otra vez el botón: no se abre una segunda.
const antesPestanas = contexto.pages().filter((x) => x.url().includes('lector.html')).length;
await app.bringToFront();
await botonWeb.click();
await app.waitForTimeout(700);
comprobar(contexto.pages().filter((x) => x.url().includes('lector.html')).length === antesPestanas, 'Si ya está abierta, no abre otra');

// La ficha, como en la app.
await web.bringToFront();
await web.locator('.ap-papel .pal').first().click();
const fichaWeb = await esperar(web, () => document.querySelector('.ap-lectura-ficha .ficha-palabra')?.textContent ?? null);
comprobar(!!fichaWeb, 'Un clic en una palabra abre su ficha', fichaWeb);
const trazosWeb = await web.evaluate(() => {
  const b = [...document.querySelectorAll('.ap-lectura-ficha .pestana')].find((x) => /Trazos/.test(x.textContent));
  b?.click();
  return !!b;
});
comprobar(trazosWeb, 'Con sus trazos también');
await web.keyboard.press('Escape');

// Se conserva al recargar.
await web.reload();
const trasRecargar = await esperar(web, () => document.querySelector('.ap-papel')?.textContent?.includes('図書館'), undefined, 15000);
comprobar(!!trasRecargar, 'El texto se conserva al recargar la pestaña');

// Estrecha, como en una vista dividida.
await web.setViewportSize({ width: 640, height: 800 });
await web.waitForTimeout(400);
const ancho = await web.evaluate(() => ({ scroll: document.documentElement.scrollWidth, cliente: document.documentElement.clientWidth, papel: document.querySelector('.ap-papel').getBoundingClientRect().width }));
comprobar(ancho.scroll <= ancho.cliente && ancho.papel > 400, 'A media pantalla cabe sin barra horizontal', JSON.stringify(ancho));
await web.locator('.ap-papel .pal').nth(1).click();
await web.waitForSelector('.ap-lectura-ficha .ficha', { timeout: 8000 }).catch(() => {});
await web.waitForTimeout(300);
const fichaEstrecha = await web.evaluate(() => {
  const c = document.querySelector('.ap-lectura-ficha')?.getBoundingClientRect();
  return c ? { left: c.left, right: c.right, ancho: innerWidth } : null;
});
comprobar(!!fichaEstrecha && fichaEstrecha.left >= -1 && fichaEstrecha.right <= fichaEstrecha.ancho + 1, 'Y la ficha cabe dentro', JSON.stringify(fichaEstrecha));
await web.screenshot({ path: join(CAPTURAS, 'lector-web-estrecho.png') });
await web.keyboard.press('Escape');
await web.setViewportSize({ width: 1280, height: 800 });

// ---------- Portapapeles ----------

console.log('\n== Seguir el portapapeles ==');
const copiar = async (texto) => {
  const hoja = await contexto.newPage();
  await hoja.goto('https://paginas.test/articulo');
  await hoja.evaluate((t) => navigator.clipboard.writeText(t), texto);
  await hoja.close();
};
await web.bringToFront();
await web.locator('.ap-web-seguir button, .ap-web-seguir [role="switch"]').first().click();
await web.waitForTimeout(1300);
const sinCambio = await web.evaluate(() => document.querySelector('.ap-papel')?.textContent ?? '');
await copiar('映画を見に行きました。');
const llego = await esperar(web, () => document.querySelector('.ap-papel')?.textContent?.includes('映画'), undefined, 6000);
comprobar(!!llego, 'Lo que se copia en japonés aparece aquí');
const conserva = await web.evaluate(() => document.querySelector('.ap-papel')?.textContent ?? '');
comprobar(conserva.includes('図書館') && conserva.length > sinCambio.length, 'Sin perder lo que ya había');
await copiar('This is not Japanese at all.');
await web.waitForTimeout(1800);
comprobar(!(await web.evaluate(() => document.querySelector('.ap-papel')?.textContent?.includes('This is not'))), 'Lo que no es japonés se ignora');
await web.locator('.ap-web-seguir button, .ap-web-seguir [role="switch"]').first().click();
await web.waitForTimeout(300);
await copiar('雨が降っています。');
await web.waitForTimeout(1800);
comprobar(!(await web.evaluate(() => document.querySelector('.ap-papel')?.textContent?.includes('雨が'))), 'Al apagarlo deja de seguirlo');

// ---------- Portapapeles con estructura ----------

console.log('\n== Portapapeles con estructura ==');
// Una página con título, negrita, un salto de línea, su propio furigana, una lista y una tabla. El furigana de la página
// es una lectura en katakana que el análisis nunca pondría: si aparece, se coló el de la página.
const HTML_COPIADO = [
  '<h2>旅の準備</h2>',
  '<p>明日は<strong>早く</strong>出発します。<br>駅で会いましょう。</p>',
  '<p><ruby>本気<rt>マジ</rt></ruby>で楽しみです。</p>',
  '<ul><li>切符を買う</li><li>弁当を作る</li></ul>',
  '<table><tr><th>時間</th><th>場所</th></tr><tr><td>八時</td><td>東京駅</td></tr></table>',
].join('');
const copiarConFormato = async (html, plano) => {
  const hoja = await contexto.newPage();
  await hoja.goto('https://paginas.test/articulo');
  await hoja.evaluate(([h, t]) => navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([h], { type: 'text/html' }), 'text/plain': new Blob([t], { type: 'text/plain' }) })]), [html, plano]);
  await hoja.close();
};
const leerPapel = () => {
  // Sin el furigana de Kotonoha y sin el carácter invisible que impide cortar la línea antes de un signo.
  const sinLecturas = (x) => {
    const c = x.cloneNode(true);
    c.querySelectorAll('rt').forEach((r) => r.remove());
    return c.textContent.replaceAll('⁠', '');
  };
  const papel = document.querySelector('.ap-papel');
  if (!papel) return null;
  return {
    titulos: [...papel.querySelectorAll('.ap-t')].map(sinLecturas),
    negritas: [...papel.querySelectorAll('b')].map(sinLecturas),
    saltos: papel.querySelectorAll('.ap-p br').length,
    elementos: [...papel.querySelectorAll('li')].map(sinLecturas),
    celdas: [...papel.querySelectorAll('.ap-tabla th, .ap-tabla td')].map(sinLecturas),
    texto: sinLecturas(papel),
  };
};
await web.bringToFront();
await web.locator('.ap-web-seguir button, .ap-web-seguir [role="switch"]').first().click();
await web.waitForTimeout(1300);
await copiarConFormato(HTML_COPIADO, '旅の準備 明日は早く出発します。駅で会いましょう。本気マジで楽しみです。切符を買う 弁当を作る 時間 場所 八時 東京駅');
const conFormato = await esperar(web, `(${leerPapel})()?.celdas.length ? (${leerPapel})() : null`, undefined, 8000);
comprobar(!!conFormato, 'Lo copiado de una página llega con su estructura');
if (conFormato) {
  comprobar(conFormato.titulos.includes('旅の準備'), 'Con su título', JSON.stringify(conFormato.titulos));
  comprobar(conFormato.negritas.includes('早く'), 'Con su negrita', JSON.stringify(conFormato.negritas));
  comprobar(conFormato.saltos >= 1, 'Con el salto de línea dentro del párrafo', String(conFormato.saltos));
  comprobar(JSON.stringify(conFormato.elementos.slice(-2)) === JSON.stringify(['切符を買う', '弁当を作る']), 'Con su lista', JSON.stringify(conFormato.elementos));
  comprobar(['時間', '場所', '八時', '東京駅'].every((c) => conFormato.celdas.includes(c)), 'Con su tabla', JSON.stringify(conFormato.celdas));
  comprobar(!conFormato.texto.includes('マジ') && conFormato.texto.includes('本気で楽しみ'), 'Sin el furigana de la página de origen', conFormato.texto.slice(0, 80));
}
await web.screenshot({ path: join(CAPTURAS, 'portapapeles-estructura.png') });

// Lo que se copia del chat de Claude llega como Markdown en texto plano.
await copiar('## 持ち物\n\n- 傘\n- 水筒');
const enMarkdown = await esperar(web, `(${leerPapel})()?.titulos.includes('持ち物') ? (${leerPapel})() : null`, undefined, 8000);
comprobar(!!enMarkdown && enMarkdown.elementos.includes('傘') && enMarkdown.elementos.includes('水筒'), 'El Markdown copiado se ve con su título y su lista', JSON.stringify(enMarkdown?.elementos));
await web.locator('.ap-web-seguir button, .ap-web-seguir [role="switch"]').first().click();
await web.waitForTimeout(300);

// Pegar con Ctrl+V en el editor del Cuaderno, con su estructura, lo prueba pruebas/cuaderno.mjs.

// Un EPUB de texto con un título, dos párrafos y su propio furigana, importado en la Ayuda de lectura: se abre en el
// visor con su propio formato. Lo demás de los EPUB de texto lo prueba pruebas/libros-texto.mjs.
console.log('\n== Libro EPUB con su estructura ==');
const EPUB = zipSync({
  mimetype: [strToU8('application/epub+zip'), { level: 0 }],
  'META-INF/container.xml': strToU8('<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'),
  'OEBPS/content.opf': strToU8('<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>prueba</dc:title><dc:language>ja</dc:language></metadata><manifest><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/></spine></package>'),
  'OEBPS/c1.xhtml': strToU8('<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>c1</title></head><body><h1>第一章</h1><p>春が来ました。\n    花が咲きました。</p><p><ruby>本気<rt>マジ</rt></ruby>で嬉しいです。</p></body></html>'),
});
await app.goto(`chrome-extension://${id}/app.html#/biblioteca`);
await app.reload();
const archivoLibro = 'input[type=file][aria-label="Importar archivos"]';
await app.waitForSelector(archivoLibro, { state: 'attached', timeout: 10000 });
await app.setInputFiles(archivoLibro, { name: 'prueba-estructura.epub', mimeType: 'application/epub+zip', buffer: Buffer.from(EPUB) });
const pestanaLibro = contexto.waitForEvent('page', { timeout: 15000 });
await app.locator('button.ap-tapa[aria-label*="prueba"]').first().click({ timeout: 10000 });
const visorLibro = await pestanaLibro;
let marcoLibro = null;
for (let i = 0; i < 150 && !marcoLibro; i++) {
  marcoLibro = visorLibro.frames().find((x) => x.url().includes('/libro.html') && !x.isDetached()) ?? null;
  if (marcoLibro && !(await marcoLibro.evaluate(() => /kk-(horizontal|vertical)/.test(document.documentElement.className)).catch(() => false))) marcoLibro = null;
  await visorLibro.waitForTimeout(100);
}
const libro = await marcoLibro?.evaluate(() => ({ titulos: [...document.querySelectorAll('h1')].map((h) => h.textContent), parrafos: document.querySelectorAll('p').length, ruby: document.querySelector('ruby rt')?.textContent }));
comprobar(!!libro && libro.titulos.includes('第一章'), 'Un EPUB de texto se abre en el visor, con sus títulos', JSON.stringify(libro?.titulos));
comprobar(!!libro && libro.parrafos >= 2, 'Cada párrafo del libro va en el suyo', String(libro?.parrafos));
comprobar(libro?.ruby === 'マジ', 'Y el furigana que trae el libro se ve como ruby', libro?.ruby);
await visorLibro.screenshot({ path: join(CAPTURAS, 'libro-estructura.png') });
await visorLibro.close();

// ---------- Vista dividida ----------

console.log('\n== Vista dividida ==');
await web.close();
const conPagina = await contexto.newPage();
await conPagina.goto('https://paginas.test/articulo');
await conPagina.bringToFront();
const conVistaDividida = await sw.evaluate(() => typeof chrome.tabs.createSplit === 'function');
const lanzar = await sw.evaluate(async () => {
  // Lo mismo que hace el botón del menú del icono.
  const url = chrome.runtime.getURL('lector.html');
  const v = await chrome.windows.getLastFocused({ windowTypes: ['normal'] });
  const [activa] = await chrome.tabs.query({ active: true, windowId: v.id });
  const t = await chrome.tabs.create({ url, windowId: v.id, splitWithTabId: activa.id });
  await new Promise((r) => setTimeout(r, 900));
  const a = await chrome.tabs.get(activa.id);
  const b = await chrome.tabs.get(t.id);
  return { split: b.splitViewId, otra: a.splitViewId, url: b.url };
}).catch((e) => ({ error: String(e) }));
if (conVistaDividida) {
  comprobar(lanzar.split > 0 && lanzar.split === lanzar.otra, 'El lector entra en la vista dividida con la pestaña que se esté viendo', JSON.stringify(lanzar));
} else {
  console.log('Este navegador aún no tiene vista dividida');
}

if (errores.length) console.log('\nErrores en la página:', [...new Set(errores)].slice(0, 6));
comprobar(errores.length === 0, 'Sin errores en las páginas');
console.log(`\n${fallos ? `${fallos} comprobaciones fallaron` : 'Todas las comprobaciones pasaron'}`);
await contexto.close();
process.exit(fallos ? 1 : 0);
