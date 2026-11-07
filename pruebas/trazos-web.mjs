// Prueba el orden de los trazos en la ficha y el lector en su pestaña propia, también en vista dividida.
// Los trazos se piden de verdad a KanjiVG: necesita conexión la primera vez.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/trazos-web.mjs

import { mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
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

console.log('\n== Lector en su pestaña ==');
const TEXTO = '今日は図書館で本を読みます。天気がいいです。';
const app = await contexto.newPage();
await app.goto(`chrome-extension://${id}/app.html#/lector`);
await app.waitForSelector('.ap-hoja-escritura textarea', { timeout: 15000 });
await app.fill('.ap-hoja-escritura textarea', TEXTO);
const botonWeb = app.locator('button', { hasText: 'Modo web' }).first();
comprobar(await botonWeb.count() > 0, 'El lector de la app tiene el botón «Modo web»');
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
comprobar(/Lector/.test(titulo), 'La pestaña se llama como debe', titulo);
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
