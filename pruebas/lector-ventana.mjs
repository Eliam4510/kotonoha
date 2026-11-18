// Prueba la ventana flotante del visor con un PDF hecho aquí mismo, como uno de LaTeX: párrafos justificados cuyas frases
// cruzan renglones y una página en vertical, con texto de Sōseki, de dominio público. Tocar una palabra abre su frase con
// la palabra elegida; un toque entre renglones va al más cercano y no pasa de página; dos toques abren la frase; arrastrar
// selecciona entre renglones; resaltar y anotar lo seleccionado; fijar la ventana; Esc; un toque en el margen; las flechas;
// y en vertical, la ventana no tapa lo que queda por leer.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/lector-ventana.mjs

import { mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-lector-ventana'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'lector-ventana');
mkdirSync(CAPTURAS, { recursive: true });
rmSync(PERFIL, { recursive: true, force: true });

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
  viewport: { width: 1440, height: 900 },
  args: ['--mute-audio', `--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
for (const pg of contexto.pages()) if (pg.url().includes('app.html')) await pg.close();
await sw.evaluate(async () => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), bienvenidaVista: true, idiomaInterfaz: 'es', idiomaObjetivo: 'ja', destino: 'memoria', ankiPuerto: 1 } });
});
const errores = [];

// ---------- El libro ----------

const P1 = '吾輩は猫である。名前はまだ無い。';
const P2 = 'どこで生れたかとんと見当がつかぬ。何でも薄暗いじめじめした所でニャーニャー泣いていた事だけは記憶している。吾輩はここで始めて人間というものを見た。しかもあとで聞くとそれは書生という人間中で一番獰悪な種族であったそうだ。この書生というのは時々我々を捕えて煮て食うという話である。';
const P3 = 'しかしその当時は何という考もなかったから別段恐しいとも思わなかった。ただ彼の掌に載せられてスーと持ち上げられた時何だかフワフワした感じがあったばかりである。';
const hoja = await contexto.newPage();
await hoja.setContent(`<!doctype html><html lang="ja"><meta charset="utf-8"><style>
  @page { size: A5; margin: 18mm 16mm; }
  body { font-family: 'Yu Mincho','MS Mincho',serif; color: #111; margin: 0; }
  p { font-size: 15px; line-height: 1.85; margin: 0; text-indent: 1em; text-align: justify; }
  .tate { writing-mode: vertical-rl; height: 470px; font-size: 16px; line-height: 1.9; page-break-before: always; }
</style>
<p>${P1}</p><p>${P2}</p><p>${P3}</p>
<div class="tate"><p>${P2}</p><p>${P3}</p></div></html>`);
const PDF = await hoja.pdf({ format: 'A5', printBackground: true });
await hoja.close();

const app = await contexto.newPage();
app.on('pageerror', (e) => errores.push(e.message));
await app.goto(`chrome-extension://${id}/app.html#/biblioteca`);
const ARCHIVO = 'input[type=file][aria-label="Importar archivos"]';
await app.waitForSelector(ARCHIVO, { state: 'attached' });
await app.setInputFiles(ARCHIVO, [{ name: 'neko.pdf', mimeType: 'application/pdf', buffer: PDF }]);
await esperar(() => app.evaluate(() => document.querySelectorAll('.ap-libro').length === 1), 20000);
const nueva = contexto.waitForEvent('page', { timeout: 15000 });
await app.locator('button.ap-tapa').first().click();
const v = await nueva;
v.on('pageerror', (e) => errores.push(e.message));
const lineas = await esperar(() => v.evaluate(() => {
  const l = [...document.querySelectorAll('.vs-linea')].map((b) => b.getAttribute('aria-label'));
  return l.length >= 4 ? l : null;
}), 20000);
comprobar(!!lineas, 'El PDF abre con su texto, renglón a renglón', String(lineas?.length));
await v.waitForTimeout(500);

const pagina = () => v.evaluate(() => document.querySelector('.vs-numero')?.value);
const caja = (texto) => v.locator(`.vs-linea[aria-label="${texto}"]`).boundingBox();
const letraEn = async (texto, n) => {
  const c = await caja(texto);
  const vertical = c.height > c.width;
  const t = (n + 0.5) / [...texto].length;
  return { x: vertical ? c.x + c.width / 2 : c.x + c.width * t, y: vertical ? c.y + c.height * t : c.y + c.height / 2 };
};
/** Lo que enseña la ventana: qué es, su texto sin furigana ni signos de unión, la palabra elegida y dónde está. */
const ventana = () =>
  v.evaluate(() => {
    const w = document.querySelector('.vs-ventana');
    if (!w) return null;
    const limpio = (el) => {
      if (!el) return null;
      const c = el.cloneNode(true);
      for (const rt of c.querySelectorAll('rt')) rt.remove();
      return c.textContent.replace(/\p{Cf}/gu, '');
    };
    const elegida = w.querySelector('.vs-ventana-texto .ap-elegida');
    const r = w.getBoundingClientRect();
    const estados = w.querySelector('.estados');
    return {
      tipo: w.querySelector('.vs-ventana-que')?.textContent,
      texto: limpio(w.querySelector('.vs-ventana-texto')),
      elegida: limpio(elegida?.closest('.pal-partible') ?? elegida),
      estadosCaben: estados ? estados.scrollWidth <= estados.clientWidth + 1 : null,
      caja: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      fijada: w.classList.contains('fijada'),
      lado: [...w.classList].find((c) => /margen|encima|debajo|derecha|izquierda/.test(c)) ?? null,
    };
  });

// ---------- Tocar una palabra ----------

console.log('\n== Tocar ==');
const conMiken = lineas?.find((l) => l.includes('見当')) ?? '';
const p = await letraEn(conMiken, [...conMiken].indexOf('見'));
await v.mouse.click(p.x, p.y);
let w = await esperar(async () => {
  const x = await ventana();
  return x?.elegida ? x : null;
}, 20000);
comprobar(w?.elegida === '見当', 'Tocar una palabra la elige en la ventana flotante', w?.elegida);
comprobar(w?.texto === 'どこで生れたかとんと見当がつかぬ。', 'Con su frase entera', w?.texto);
comprobar(w?.lado === 'margen-derecho', 'Junto a la página, sin taparla', w?.lado);
comprobar(w?.estadosCaben === true, 'Y los estados de la ficha caben en su fila');
comprobar(await v.evaluate(() => document.querySelectorAll('.vs-unidad').length >= 1 && document.querySelectorAll('.vs-marca').length === 1), 'La frase se marca en la página, y la palabra encima');
await v.screenshot({ path: join(CAPTURAS, '1-palabra.png') });

// Antes, un toque en el hueco entre dos renglones en el lado derecho pasaba de página.
const siguiente = lineas?.[lineas.indexOf(conMiken) + 1] ?? '';
const ca = await caja(conMiken);
const cb = await caja(siguiente);
const antes = await pagina();
await v.mouse.click(ca.x + ca.width * 0.92, (ca.y + ca.height + cb.y) / 2);
await v.waitForTimeout(300);
comprobar((await pagina()) === antes, 'Un toque entre renglones, en el lado derecho, ya no pasa de página', `${antes} → ${await pagina()}`);
w = await esperar(async () => {
  const x = await ventana();
  return x?.elegida ? x : null;
}, 10000);
comprobar(!!w?.elegida, 'Y el imán elige la palabra más cercana', w?.elegida);

// ---------- Dos toques, arrastrar ----------

console.log('\n== Frase y selección ==');
const q = await letraEn(siguiente, 3);
await v.mouse.dblclick(q.x, q.y);
await v.waitForTimeout(300);
w = await ventana();
comprobar(w?.tipo === 'Frase' && !w?.elegida && !!w?.texto?.endsWith('記憶している。'), 'Dos toques abren la frase sin elegir palabra', w?.texto);
comprobar(await v.evaluate(() => document.querySelectorAll('.vs-unidad').length === 2), 'Una frase que cruza dos renglones se marca en los dos');

const d0 = await letraEn(conMiken, [...conMiken].indexOf('見'));
const d1 = await letraEn(siguiente, 4);
await v.mouse.move(d0.x, d0.y);
await v.mouse.down();
await v.mouse.move((d0.x + d1.x) / 2, (d0.y + d1.y) / 2, { steps: 6 });
await v.mouse.move(d1.x, d1.y, { steps: 6 });
const durante = await v.evaluate(() => document.querySelectorAll('.vs-seleccion').length);
await v.mouse.up();
await v.waitForTimeout(400);
w = await ventana();
comprobar(durante === 2, 'Al arrastrar, lo seleccionado se marca en sus dos renglones', durante);
comprobar(w?.tipo === 'Selección' && w?.texto === `${conMiken.slice(conMiken.indexOf('見'))}${siguiente.slice(0, 5)}`, 'Al soltar se abre lo seleccionado, con los renglones unidos', w?.texto);
await v.screenshot({ path: join(CAPTURAS, '2-seleccion.png') });

await v.locator('.vs-ventana .vs-accion', { hasText: 'Resaltar' }).click();
await v.locator('.vs-ventana .vs-color.amarillo').click();
await v.waitForTimeout(300);
const resaltadas = await v.evaluate(() => ({ cajas: document.querySelectorAll('.vs-resaltado').length, lista: document.querySelectorAll('.vs-ventana .vs-resaltado-linea').length }));
comprobar(resaltadas.cajas === 2 && resaltadas.lista === 1, 'Resaltar lo seleccionado lo pinta en sus dos renglones', JSON.stringify(resaltadas));
await v.locator('.vs-ventana .vs-accion', { hasText: 'Resaltar' }).click();
await v.locator('.vs-ventana .vs-color.verde').click();
await v.waitForTimeout(300);
const otraVez = await v.evaluate(() => ({ cajas: document.querySelectorAll('.vs-resaltado').length, verdes: document.querySelectorAll('.vs-resaltado.verde').length }));
comprobar(otraVez.cajas === 2 && otraVez.verdes === 2, 'Resaltarlo otra vez le cambia el color, sin duplicarlo', JSON.stringify(otraVez));
await v.locator('.vs-ventana .vs-accion', { hasText: 'Nota' }).click();
await v.locator('.vs-ventana .vs-editor-nota textarea').fill('Una frase que cruza dos renglones');
await v.locator('.vs-ventana .vs-editor-nota button', { hasText: 'Guardar' }).click();
await v.waitForTimeout(300);
comprobar(await v.evaluate(() => document.querySelectorAll('.vs-resaltado').length === 2 && document.querySelector('.vs-ventana .vs-resaltado-comentario')?.textContent === 'Una frase que cruza dos renglones'), 'Nota comenta el resaltado que ya había');

// ---------- Fijada, Esc y fuera del texto ----------

console.log('\n== Fijar y cerrar ==');
await v.locator('.vs-ventana button[aria-label="Fijar a un lado"]').click();
await v.waitForTimeout(300);
w = await ventana();
comprobar(!!w?.fijada && w.caja.x + w.caja.w >= 1439, 'Fijada, es un panel a la derecha', JSON.stringify(w?.caja));
await v.screenshot({ path: join(CAPTURAS, '3-fijada.png') });
await v.locator('.vs-ventana button[aria-label="Soltar la ventana"]').click();
await v.keyboard.press('Escape');
await v.waitForTimeout(200);
comprobar(!(await ventana()), 'Esc cierra la ventana');
const hojaCaja = await v.locator('.vs-pagina').first().boundingBox();
await v.mouse.click(hojaCaja.x + hojaCaja.width * 0.97, hojaCaja.y + hojaCaja.height * 0.6);
await v.waitForTimeout(200);
comprobar((await pagina()) === antes && !(await ventana()), 'Un toque en el margen no pasa de página ni abre nada', await pagina());

// ---------- Las flechas y el texto vertical ----------

console.log('\n== Flechas y vertical ==');
await v.locator('.vs-flecha.derecha').click();
await esperar(async () => (await pagina()) !== antes, 5000);
comprobar((await pagina()) === '2', 'La flecha de la derecha pasa de página', await pagina());
const columnas = await esperar(() => v.evaluate(() => {
  const l = [...document.querySelectorAll('.vs-linea')].filter((b) => b.offsetHeight > b.offsetWidth * 2).map((b) => b.getAttribute('aria-label'));
  return l.length >= 2 ? l : null;
}), 10000);
comprobar(!!columnas, 'La página vertical, en columnas', String(columnas?.length));
if (columnas) {
  const col = columnas[1];
  const r = await letraEn(col, 5);
  // Más estrecha la vista, para que la ventana no quepa al margen y tenga que ir sobre el texto.
  await v.setViewportSize({ width: 900, height: 900 });
  await v.waitForTimeout(500);
  const r2 = await letraEn(col, 5);
  await v.mouse.click(r2.x, r2.y);
  w = await esperar(() => ventana(), 10000);
  const cc = await caja(col);
  comprobar(w?.lado === 'derecha' && w.caja.x >= cc.x + cc.width, 'Sin margen, en vertical va a la derecha de la columna, sobre lo ya leído', `${w?.lado} x=${w?.caja.x}, columna hasta ${Math.round(cc.x + cc.width)}`);
  await v.screenshot({ path: join(CAPTURAS, '4-vertical.png') });
  comprobar(!!r, 'La columna se toca');
}

if (errores.length) console.log('\nErrores en la página:', [...new Set(errores)].slice(0, 6));
comprobar(errores.length === 0, 'Sin errores en las páginas');
console.log(`\n${fallos ? `${fallos} comprobaciones fallaron` : 'Todas las comprobaciones pasaron'}`);
await contexto.close();
process.exit(fallos ? 1 : 0);
