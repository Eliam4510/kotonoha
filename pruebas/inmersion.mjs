// Prueba la 0.20.0: «Kanji que ya conoces» en la pestaña de trazos de la ficha, y las horas de inmersión, contadas con
// un video propio que se reproduce de verdad y enseñadas en Inicio con días anteriores sembrados en la base.
// Uso: KK_SALIDA=.dist-whisper node build.mjs && node pruebas/inmersion.mjs [ruta/video.mkv]
// Sin ruta usa capturas-e2e/prueba.mkv, que crea pruebas/medios.mjs: un MKV con subtítulos incrustados en japonés.
// Usa el perfil de pruebas/local.mjs y deja su base como estaba: borra lo que siembra y lo que cuenta.

import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-whisper'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-local'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'inmersion');
const ARCHIVO = resolve(process.argv[2] ?? join(RAIZ, 'capturas-e2e', 'prueba.mkv'));
mkdirSync(CAPTURAS, { recursive: true });

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};

if (!existsSync(PERFIL) && existsSync(join(RAIZ, '.perfil-base', 'Default/IndexedDB'))) {
  cpSync(join(RAIZ, '.perfil-base', 'Default/IndexedDB'), join(PERFIL, 'Default/IndexedDB'), { recursive: true });
}

const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1360, height: 900 },
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
await sw.evaluate(async () => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), idiomaInterfaz: 'es', idiomaObjetivo: 'ja', bienvenidaVista: true, tema: 'oscuro', avisarVersiones: false, analisisAutomatico: false, modo: 'normal', salto: 'no' } });
});

const p = await contexto.newPage();
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));
await p.goto(`chrome-extension://${id}/app.html#/inicio`);
await p.waitForTimeout(1500);

// La base del japonés, desde la página (la política de la extensión no deja evaluar código hecho en cadena).
const escribir = (tabla, filas, borrar = false) =>
  p.evaluate(
    async ({ tabla, filas, borrar }) => {
      const db = await new Promise((ok, mal) => {
        const r = indexedDB.open('kikitori');
        r.onsuccess = () => ok(r.result);
        r.onerror = () => mal(r.error);
      });
      await new Promise((ok, mal) => {
        const tx = db.transaction(tabla, 'readwrite');
        for (const f of filas) borrar ? tx.objectStore(tabla).delete(f) : tx.objectStore(tabla).put(f);
        tx.oncomplete = () => ok();
        tx.onerror = () => mal(tx.error);
      });
      db.close();
    },
    { tabla, filas, borrar }
  );
const leerTabla = (tabla) =>
  p.evaluate(async (tabla) => {
    const db = await new Promise((ok, mal) => {
      const r = indexedDB.open('kikitori');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => mal(r.error);
    });
    const filas = await new Promise((ok, mal) => {
      const r = db.transaction(tabla).objectStore(tabla).getAll();
      r.onsuccess = () => ok(r.result);
      r.onerror = () => mal(r.error);
    });
    db.close();
    return filas;
  }, tabla);

// ---------- Kanji que ya conoces ----------

const ahora = Date.now();
const PALABRAS = [
  ['冷たい', 'つめたい', 'conocida'],
  ['金庫', 'きんこ', 'aprendiendo'],
  ['車庫', 'しゃこ', 'conocida'],
  ['冷蔵庫', 'れいぞうこ', 'conocida'],
].map(([lema, lectura, estado], i) => ({ clave: `${lema}|${lectura}`, lema, lectura, estado, rastreada: 0, creada: ahora, actualizada: ahora + i }));
const previas = (await leerTabla('palabras')).filter((f) => PALABRAS.some((x) => x.clave === f.clave));
await escribir('palabras', PALABRAS);

await p.goto(`chrome-extension://${id}/app.html#/diccionario?q=${encodeURIComponent('冷蔵庫')}`);
await p.waitForTimeout(2500);
const pestana = p.locator('.ficha [role="tab"], .ficha button').filter({ hasText: 'Trazos' }).first();
await pestana.click({ timeout: 10000 }).catch(() => {});
const seccion = p.locator('.trazos-conocidas');
await seccion.waitFor({ timeout: 15000 }).catch(() => {});
comprobar(await seccion.isVisible(), 'Junto a los trazos, las palabras que ya conoces con esos kanji');
const filas = await seccion.locator('.trazos-conocidas-fila').evaluateAll((els) =>
  els.map((el) => `${el.querySelector('.trazos-conocidas-caracter').textContent}: ${[...el.querySelectorAll('li')].map((li) => li.querySelector('span').textContent).join(' ')}`)
);
comprobar(filas.join(' | ') === '冷: 冷たい | 庫: 車庫 金庫', 'Una fila por kanji con palabras, las conocidas primero y sin la propia palabra', filas.join(' | '));
comprobar((await seccion.locator('li.aprendiendo').allInnerTexts()).join('').includes('金庫'), 'La que se está aprendiendo va marcada');
comprobar((await seccion.locator('li b').first().innerText()) === '冷', 'El kanji va resaltado dentro de la palabra');
await p.locator('.ficha').first().screenshot({ path: join(CAPTURAS, '1-kanji-conocidos.png') }).catch(() => {});

// ---------- Horas de inmersión: un video propio ----------

// Lo que otras pruebas contaron en este perfil (hoy mismo, con el Cuaderno o un video) descuadraría las sumas: se aparta
// y se devuelve al final.
const apartadas = await leerTabla('inmersion').catch(() => []);
if (apartadas.length) await escribir('inmersion', apartadas.map((f) => [f.dia, f.tipo, f.fuente]), true);
await p.goto(`chrome-extension://${id}/app.html#/reproductor`);
await p.waitForTimeout(1200);
await p.setInputFiles('input[type="file"]', ARCHIVO);
await p.waitForSelector('.linea-sub.objetivo .pal', { timeout: 30000 }).catch(() => {});
comprobar((await p.locator('.linea-sub.objetivo').count()) > 0, 'El video tiene subtítulos en la lengua que se estudia');
await p.evaluate(() => {
  const v = document.querySelector('.ap-local video');
  v.currentTime = 0;
  return v.play();
});
await p.waitForTimeout(16000);
await p.evaluate(() => document.querySelector('.ap-local video').pause());
// Tras la pausa, el siguiente tic manda lo contado.
await p.waitForTimeout(7000);
const titulo = 'prueba';
const hoyFilas = (await leerTabla('inmersion')).filter((f) => f.tipo === 'video' && f.fuente.endsWith('.mkv'));
const contados = hoyFilas.reduce((s, f) => s + f.segundos, 0);
comprobar(contados >= 10 && contados <= 25, 'Cuenta el tiempo del video en marcha, y nada en pausa', `${contados} s`);
comprobar(hoyFilas[0]?.titulo === titulo, 'Con el título del video', hoyFilas[0]?.titulo);

// ---------- Inicio, con días anteriores ----------

const dia = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const SEMBRADAS = [
  { dia: dia(1), tipo: 'video', fuente: 'prueba-inmersion-a', titulo: 'Un anime de prueba', segundos: 40 * 60, actualizada: ahora },
  { dia: dia(2), tipo: 'lectura', fuente: 'prueba-inmersion-b', titulo: 'Un libro de prueba', segundos: 25 * 60, actualizada: ahora },
  { dia: dia(3), tipo: 'lectura', fuente: 'portapapeles', titulo: '', segundos: 10 * 60, actualizada: ahora },
  { dia: dia(9), tipo: 'video', fuente: 'prueba-inmersion-a', titulo: 'Un anime de prueba', segundos: 60 * 60, actualizada: ahora - 1 },
];
await escribir('inmersion', SEMBRADAS);
await p.goto(`chrome-extension://${id}/app.html#/inicio`);
await p.waitForTimeout(2000);
const tarjeta = p.locator('.ap-inmersion');
comprobar(await tarjeta.isVisible(), 'Inicio enseña las horas de inmersión');
const texto = (await tarjeta.innerText()).replace(/\s+/g, ' ');
console.log(`      ${texto}`);
const hoyTexto = await tarjeta.locator('.ap-cifra-grande b').innerText();
comprobar(hoyTexto === '0 min', 'Hoy, con unos segundos de video', hoyTexto);
comprobar(/Últimos 7 días 1 h 15 min/.test(texto), 'Los últimos siete días suman lo de la semana', texto.match(/Últimos 7 días [^E]*/)?.[0]);
comprobar(/En total 2 h 15 min/.test(texto), 'Y el total, todo', texto.match(/En total [^R]*/)?.[0]);
comprobar(/Racha 3 días/.test(texto), 'La racha cuenta hasta ayer si hoy aún no llega a cinco minutos', texto.match(/Racha [^L]*/)?.[0]);
const barras = await tarjeta.locator('.ap-inmersion-dias li').evaluateAll((els) => els.map((el) => el.querySelector('i').style.height));
comprobar(barras.length === 7 && barras[5] === '100%' && barras[0] === '0px', 'Una barra por día, la más alta para el día con más tiempo', barras.join(' '));
const mas = await tarjeta.locator('.ap-inmersion-mas li').allInnerTexts();
comprobar(mas[0]?.includes('Un anime de prueba') && mas[0]?.includes('1 h 40 min'), 'Lo que más se vio primero, sumando sus días', mas[0]);
comprobar(mas.some((x) => x.includes('Un libro de prueba')), 'Con los libros', mas.join(' | '));
await tarjeta.screenshot({ path: join(CAPTURAS, '2-inicio-oscuro.png') });
await sw.evaluate(async () => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ ajustes: { ...d.ajustes, tema: 'claro' } });
});
await p.waitForTimeout(700);
await tarjeta.screenshot({ path: join(CAPTURAS, '3-inicio-claro.png') });
await p.setViewportSize({ width: 520, height: 900 });
await p.waitForTimeout(500);
await tarjeta.screenshot({ path: join(CAPTURAS, '4-inicio-estrecho.png') });

// ---------- Lo deja como estaba ----------

const despues = await leerTabla('inmersion');
await escribir('inmersion', despues.map((f) => [f.dia, f.tipo, f.fuente]), true);
if (apartadas.length) await escribir('inmersion', apartadas);
await escribir('palabras', PALABRAS.filter((x) => !previas.some((y) => y.clave === x.clave)).map((x) => x.clave), true);
if (previas.length) await escribir('palabras', previas);
await sw.evaluate(async () => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ ajustes: { ...d.ajustes, tema: 'oscuro' } });
});
comprobar(errores.length === 0, 'Sin errores en la página', errores.join(' | '));
await contexto.close();
console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
