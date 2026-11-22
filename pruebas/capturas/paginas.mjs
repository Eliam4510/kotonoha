// El lector de páginas y los trazos, en cada idioma de la interfaz, sobre una página de verdad: 『羅生門』 de Akutagawa en el
// Aozora Bunko (dominio público), servida tal cual con su hoja de estilo (ver contenido-real.mjs). La foto del lector
// lleva su panel abierto; la de los trazos, la ficha de 下人 en su pestaña.
// Antes: node herramientas/contenido-readme.mjs.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/capturas/paginas.mjs [es en de zh ko ja]

import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { recargarExtension } from '../extension.mjs';
import { archivoLibre, RASHOMON } from './contenido-real.mjs';

const RAIZ = resolve(import.meta.dirname, '..', '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const SALIDA = join(RAIZ, 'docs', 'img');
const IDIOMAS = process.argv.slice(2).length ? process.argv.slice(2) : ['es', 'en', 'de', 'zh', 'ko', 'ja'];
const pagina = readFileSync(archivoLibre(RASHOMON.pagina));
const css = readFileSync(archivoLibre(RASHOMON.css));
const nombre = (id, t) => (id === 'es' ? t : JSON.parse(readFileSync(join(RAIZ, 'idiomas', `${id}.json`), 'utf8'))[t] ?? t);

const guardar = async (p, base, idioma) => {
  const ruta = join(SALIDA, idioma === 'es' ? `${base}.png` : `${base}.${idioma}.png`);
  await sharp(await p.screenshot()).png({ palette: true, quality: 92, effort: 10 }).toFile(ruta);
  console.log('  imagen:', ruta.slice(RAIZ.length + 1));
};

// Unas conocidas y otras no: una página toda subrayada no representa a nadie.
const NUEVAS = ['下人', '雨やみ', '朱雀大路', '丹塗', '蟋蟀', '揉烏帽子', '市女笠', '洛中', '衰微', '旧記', '辻風', '饑饉', '箔', '薪', '狐狸', '盗人', '引取り', '鴉', '鴟尾'];
const SEGUIDAS = ['羅生門'];

for (const idioma of IDIOMAS) {
  console.log(`\n== ${idioma} ==`);
  const perfil = mkdtempSync(join(tmpdir(), 'kk-paginas-'));
  const base = join(RAIZ, '.perfil-base', 'Default', 'IndexedDB');
  if (existsSync(base)) cpSync(base, join(perfil, 'Default', 'IndexedDB'), { recursive: true });
  const c = await chromium.launchPersistentContext(perfil, {
    channel: process.env.KK_CANAL ?? 'msedge',
    headless: true,
    viewport: { width: 1280, height: 720 },
    args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--mute-audio'],
  });
  // La página del Aozora Bunko, como la sirve él: en Shift_JIS y con su hoja de estilo.
  await c.route('https://www.aozora.gr.jp/**', (r) => {
    const u = new URL(r.request().url());
    if (u.pathname.endsWith('.css')) return r.fulfill({ status: 200, contentType: 'text/css', body: css });
    if (u.href === RASHOMON.url) return r.fulfill({ status: 200, contentType: 'text/html; charset=Shift_JIS', body: pagina });
    return r.fulfill({ status: 404 });
  });
  const sw = await recargarExtension(c);
  for (const pg of c.pages()) if (pg.url().includes('app.html')) await pg.close();
  const fijar = (a) =>
    sw.evaluate(async (a) => {
      const d = await chrome.storage.local.get('ajustes');
      await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), ...a } });
    }, a);
  await fijar({ idiomaInterfaz: idioma, idiomaObjetivo: 'ja', bienvenidaVista: true, ankiPuerto: 1, destino: 'memoria', lectorActivo: true, lectorFurigana: 'desconocidas', lectorColor: true, furigana: 'desconocidas' });

  const p = await c.newPage();
  await p.goto(RASHOMON.url);
  await p.waitForFunction(() => Number(document.querySelector('kotonoha-overlay')?.dataset.kkRangos) > 0, null, { timeout: 60000 });
  const texto = await p.evaluate(() => document.querySelector('.main_text')?.innerText ?? document.body.innerText);
  await sw.evaluate(
    async ({ t, NUEVAS, SEGUIDAS }) => {
      const r = await chrome.runtime.sendMessage({ canal: 'motor', metodo: 'analizarTexto', args: [t] });
      const palabras = new Map();
      for (const linea of r.valor) for (const k of linea) if (k.esPalabra) palabras.set(k.clave, k);
      const cambios = [...palabras.values()]
        .map((k) => {
          const base = { lema: k.lema, lectura: k.lecturaLema, clave: k.clave };
          if (SEGUIDAS.includes(k.lema)) return { ...base, rastreada: true };
          return NUEVAS.some((n) => k.lema.includes(n) || n.includes(k.lema)) ? null : { ...base, estado: 'conocida' };
        })
        .filter(Boolean);
      await chrome.runtime.sendMessage({ canal: 'motor', metodo: 'cambiarPalabras', args: [cambios] });
    },
    { t: texto, NUEVAS, SEGUIDAS }
  );
  await p.reload();
  await p.waitForFunction(() => Number(document.querySelector('kotonoha-overlay')?.dataset.kkRangos) > 0, null, { timeout: 60000 });
  await p.waitForTimeout(700);
  // El lector con su panel abierto.
  await p.evaluate(() => document.querySelector('kotonoha-overlay').shadowRoot.querySelector('.lector-boton')?.click());
  await p.waitForTimeout(500);
  await guardar(p, 'paginas', idioma);
  await p.evaluate(() => document.querySelector('kotonoha-overlay').shadowRoot.querySelector('.lector-boton')?.click());

  // Los trazos de 下人, a medio escribir.
  const sitio = await p.evaluate(() => {
    const w = document.createTreeWalker(document.querySelector('.main_text') ?? document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const i = n.data.indexOf('下人');
      if (i < 0 || n.parentElement?.closest('rt')) continue;
      const r = document.createRange();
      r.setStart(n, i);
      r.setEnd(n, i + 1);
      const b = r.getBoundingClientRect();
      if (b.width) return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    }
    return null;
  });
  if (!sitio) throw new Error('No se ve 下人 en la página');
  await p.mouse.click(sitio.x, sitio.y);
  await p.waitForFunction(() => document.querySelector('kotonoha-overlay')?.shadowRoot?.querySelector('.ficha-palabra'), null, { timeout: 15000 });
  await p.waitForTimeout(500);
  await p.evaluate((t) => [...document.querySelector('kotonoha-overlay').shadowRoot.querySelectorAll('.pestana')].find((x) => x.textContent.trim() === t)?.click(), nombre(idioma, 'Trazos'));
  await p.waitForFunction(() => document.querySelector('kotonoha-overlay').shadowRoot.querySelector('.trazo-kanji svg'), null, { timeout: 30000 });
  await p.waitForTimeout(5200);
  await guardar(p, 'trazos', idioma);
  await c.close();
  rmSync(perfil, { recursive: true, force: true });
}
process.exit(0);
