// Prueba la pantalla de niveles (el JLPT en japonés): las tarjetas de N5 a N1 con lo que se conoce de cada nivel, el
// vocabulario con su estado y los cambios uno a uno y en grupo, los kanji con su ficha y la gramática con sus ejemplos
// y la explicación de Claude (simulado). En inglés no aparece. No gasta nada.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/niveles.mjs

import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';
import { iniciarMock } from './mock-claude.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-local'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'niveles');
mkdirSync(CAPTURAS, { recursive: true });

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

if (!existsSync(PERFIL) && existsSync(join(RAIZ, '.perfil-base', 'Default/IndexedDB'))) {
  cpSync(join(RAIZ, '.perfil-base', 'Default/IndexedDB'), join(PERFIL, 'Default/IndexedDB'), { recursive: true });
}

const mock = await iniciarMock();
const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1440, height: 900 },
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
const previo = await sw.evaluate(async () => chrome.storage.local.get(['ajustes', 'urlBaseIA', 'claveAnthropic']));
await sw.evaluate(async ({ url }) => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ urlBaseIA: url, claveAnthropic: 'clave-de-prueba', ajustes: { ...(d.ajustes ?? {}), idiomaInterfaz: 'es', idiomaObjetivo: 'ja', bienvenidaVista: true, tema: 'oscuro', avisarVersiones: false, nivel: 'JLPT N4' } });
}, { url: `http://127.0.0.1:${mock.puerto}` });

const p = await contexto.newPage();
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));
// Sin las respuestas guardadas de la vez anterior: la explicación de Claude tiene que pedirse.
await sw.evaluate(async () => {
  for (const { name } of await indexedDB.databases()) {
    await new Promise((ok) => {
      const q = indexedDB.open(name);
      q.onsuccess = () => {
        const d = q.result;
        if (!d.objectStoreNames.contains('cacheIA')) {
          d.close();
          return ok();
        }
        const tx = d.transaction('cacheIA', 'readwrite');
        tx.objectStore('cacheIA').clear();
        tx.oncomplete = () => {
          d.close();
          ok();
        };
      };
      q.onerror = () => ok();
    });
  }
});
await p.goto(`chrome-extension://${id}/app.html#/inicio`);
// Sin el nivel ni la pestaña de la vez anterior: la pantalla abre como la primera vez.
await p.evaluate(() => {
  localStorage.removeItem('kk-nivelLista:ja');
  localStorage.removeItem('kk-pestanaNiveles');
});
await p.reload();
await p.waitForTimeout(1200);

// ---------- La entrada en la barra lateral ----------

const entrada = p.locator('.ap-nav', { hasText: 'JLPT' });
comprobar(await entrada.isVisible(), 'En la barra lateral, «JLPT»');
await entrada.click();
await p.locator('.ap-nivel-examen').first().waitFor({ timeout: 15000 });
comprobar((await p.locator('.ap-nivel-examen').count()) === 5, 'Cinco tarjetas, de N5 a N1');
comprobar((await p.locator('.ap-nivel-examen.activo b').textContent()) === 'N4', 'Abre en el nivel de los ajustes (JLPT N4)', await p.locator('.ap-nivel-examen.activo b').textContent());
await p.locator('.ap-fila-palabra').first().waitFor({ timeout: 15000 });
await p.screenshot({ path: join(CAPTURAS, '1-vocabulario.png') });

// ---------- Vocabulario ----------

await p.locator('.ap-nivel-examen', { hasText: 'N5' }).click();
await p.waitForFunction(() => document.querySelector('.ap-nivel-examen.activo b')?.textContent === 'N5');
await p.waitForTimeout(600);
const pestanaVocab = p.getByRole('tab', { name: /Vocabulario/ });
comprobar((await pestanaVocab.textContent()).includes('666'), 'N5 tiene 666 palabras', await pestanaVocab.textContent());
comprobar((await p.locator('.ap-fila-palabra').count()) === 300, 'Se ven de 300 en 300', await p.locator('.ap-fila-palabra').count());
comprobar(await p.getByRole('button', { name: /Ver más \(366\)/ }).isVisible(), 'Con «Ver más» para el resto');

const resumenN5 = async () => (await p.locator('.ap-nivel-examen', { hasText: 'N5' }).locator('dd').first().textContent()).replace(/\s/g, '');
const antes = await resumenN5();
await p.getByRole('textbox', { name: 'Buscar en la lista' }).fill('青');
await p.waitForTimeout(300);
const filas = p.locator('.ap-fila-palabra');
comprobar((await filas.count()) >= 2, 'La búsqueda filtra la lista', await filas.count());
const estadosAntes = await filas.locator('select').evaluateAll((s) => s.map((x) => x.value));

// Una palabra, desde su fila.
await filas.first().locator('select').selectOption('conocida');
await p.waitForTimeout(800);
comprobar((await filas.first().locator('select').inputValue()) === 'conocida', 'Una palabra se marca como conocida desde su fila');
const despues = await resumenN5();
const n = (t) => Number(t.split('/')[0].replace(/\D/g, ''));
comprobar(n(despues) === n(antes) + (estadosAntes[0] === 'conocida' ? 0 : 1), 'Y la tarjeta de N5 lo cuenta', `${antes} → ${despues}`);

// Todas las de la lista, de una vez.
await p.getByRole('button', { name: /Elegir las \d+ de la lista/ }).click();
await p.locator('.ap-seleccion button', { hasText: 'Aprendiendo' }).click();
await p.waitForTimeout(800);
const estados = await filas.locator('select').evaluateAll((s) => s.map((x) => x.value));
comprobar(estados.every((e) => e === 'aprendiendo'), 'Todas las elegidas pasan a «Aprendiendo»', estados.join(','));
await p.locator('.ap-niveles-filtros [role="radio"]', { hasText: 'Aprendiendo' }).click();
await p.waitForTimeout(300);
comprobar((await filas.count()) === estados.length, 'El filtro «Aprendiendo» las enseña', await filas.count());
// Como estaban.
await p.locator('.ap-niveles-filtros [role="radio"]', { hasText: 'Todas' }).click();
await p.waitForTimeout(300);
for (let i = 0; i < estadosAntes.length; i++) {
  await filas.nth(i).locator('select').selectOption(estadosAntes[i]);
  await p.waitForTimeout(250);
}
await p.getByRole('textbox', { name: 'Buscar en la lista' }).fill('');

// ---------- Kanji ----------

await p.getByRole('tab', { name: /Kanji/ }).click();
await p.locator('.ap-caracter').first().waitFor({ timeout: 10000 });
comprobar((await p.locator('.ap-caracter').count()) === 79, 'N5 tiene 79 kanji', await p.locator('.ap-caracter').count());
await p.locator('.ap-caracter', { hasText: '日' }).first().click();
await p.locator('.ap-caracter-detalle').waitFor({ timeout: 5000 });
const detalle = await p.locator('.ap-caracter-detalle').innerText();
comprobar(detalle.includes('ニチ') && detalle.includes('day'), 'La ficha del kanji da sus lecturas y su significado', detalle.slice(0, 80).replace(/\n/g, ' | '));
await p.locator('.ap-caracter-detalle .trazos, .ap-caracter-detalle svg').first().waitFor({ timeout: 10000 }).catch(() => {});
comprobar((await p.locator('.ap-caracter-detalle svg').count()) > 0, 'Con el orden de los trazos');
comprobar((await p.locator('.ap-caracter-palabras .chip').count()) > 0, 'Y las palabras del nivel que lo llevan', await p.locator('.ap-caracter-palabras .chip').count());
await p.screenshot({ path: join(CAPTURAS, '2-kanji.png') });

// ---------- Gramática ----------

await p.getByRole('tab', { name: /Gramática/ }).click();
await p.locator('.ap-patron').first().waitFor({ timeout: 10000 });
comprobar((await p.locator('.ap-patron').count()) === 65, 'N5 tiene 65 puntos de gramática', await p.locator('.ap-patron').count());
const tePunto = p.locator('.ap-patron', { hasText: '〜ている' }).first();
comprobar((await tePunto.innerText()).includes('Acción en curso'), 'Cada punto con su significado en español');
await tePunto.locator('.ap-patron-cab').click();
await p.locator('.ap-patron.abierto .ap-patron-detalle').waitFor({ timeout: 5000 });
await p.waitForFunction(() => !document.querySelector('.ap-patron.abierto .ap-patron-detalle > .giro'), null, { timeout: 10000 });
const ejemplos = await p.locator('.ap-patron.abierto .ejemplo').count();
const sinEjemplos = await p.locator('.ap-patron.abierto .ayuda').count();
comprobar(ejemplos > 0 || sinEjemplos > 0, 'Al abrirlo, sus ejemplos entre las frases vistas, o un aviso de que aún no ha salido', `${ejemplos} ejemplos`);
await p.locator('.ap-patron.abierto button', { hasText: 'Explicar con Claude' }).click();
await p.locator('.ap-patron.abierto .panel-ia-texto').waitFor({ timeout: 10000 });
await p.waitForFunction(() => !document.querySelector('.ap-patron.abierto .cursor-ia'), null, { timeout: 15000 });
comprobar((await p.locator('.ap-patron.abierto .panel-ia-texto').innerText()).length > 20, 'Claude lo explica cuando se pide');
comprobar(mock.peticiones.some((x) => JSON.stringify(x.cuerpo?.messages ?? '').includes('Explica este punto de gramática') && JSON.stringify(x.cuerpo?.messages ?? '').includes('〜ている')), 'Y se le pregunta por ese patrón');
await p.screenshot({ path: join(CAPTURAS, '3-gramatica.png') });

// ---------- En inglés no hay listas ----------

await sw.evaluate(async () => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ ajustes: { ...d.ajustes, idiomaObjetivo: 'en' } });
});
await p.goto(`chrome-extension://${id}/app.html#/inicio`);
await p.waitForTimeout(1200);
comprobar(!(await p.locator('.ap-nav', { hasText: 'JLPT' }).isVisible()), 'Estudiando inglés, la entrada no aparece');

comprobar(errores.length === 0, 'Sin errores en la página', errores.join(' | '));

await sw.evaluate(async (previo) => {
  await chrome.storage.local.set({ ajustes: previo.ajustes });
  for (const clave of ['urlBaseIA', 'claveAnthropic']) {
    if (previo[clave] !== undefined) await chrome.storage.local.set({ [clave]: previo[clave] });
    else await chrome.storage.local.remove(clave);
  }
}, previo);
await contexto.close();
console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
