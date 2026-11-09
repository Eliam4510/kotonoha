// Prueba lo nuevo del diccionario: buscar por significado («perro» → 犬), la gramática que encaja con lo buscado, los kanji
// y los homófonos de una palabra, las palabras parecidas (Claude simulado) y las categorías para explorar (onomatopeyas…).
// Usa los diccionarios del perfil de pruebas. No gasta nada.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/diccionario.mjs

import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';
import { iniciarMock } from './mock-claude.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-local'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'diccionario');
mkdirSync(CAPTURAS, { recursive: true });

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};

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
  await chrome.storage.local.set({ urlBaseIA: url, claveAnthropic: 'clave-de-prueba', ajustes: { ...(d.ajustes ?? {}), idiomaInterfaz: 'es', idiomaObjetivo: 'ja', bienvenidaVista: true, tema: 'oscuro', avisarVersiones: false } });
}, { url: `http://127.0.0.1:${mock.puerto}` });

const p = await contexto.newPage();
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));
const ir = async (q) => {
  await p.goto(`chrome-extension://${id}/app.html#/diccionario${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  // Sin consulta, la portada: la página se recarga para no quedarse con los resultados de antes.
  if (!q) await p.reload();
  if (q) await p.locator('.ap-seccion-titulo, .ap-vacio').first().waitFor({ timeout: 90000 });
  await p.waitForTimeout(600);
};

// ---------- La portada ----------

await ir('');
await p.locator('.ap-categoria').first().waitFor({ timeout: 15000 });
comprobar((await p.locator('.ap-categoria').count()) === 7, 'Siete categorías para explorar', await p.locator('.ap-categoria').count());
comprobar((await p.locator('.ap-categoria').first().innerText()).includes('Onomatopeyas'), 'La primera, las onomatopeyas');
await p.screenshot({ path: join(CAPTURAS, '1-portada.png') });

// ---------- Por significado ----------

const inicio = Date.now();
await ir('perro');
const significados = p.locator('.ap-dic-seccion', { hasText: 'Palabras que significan «perro»' });
await significados.waitFor({ timeout: 90000 }).catch(() => {});
const terminos = await significados.locator('.ap-breve-termino b').allTextContents();
comprobar(terminos.includes('犬'), '«perro» encuentra 犬', `${terminos.slice(0, 6).join(' ')} · ${Math.round((Date.now() - inicio) / 1000)} s con el índice`);
comprobar(terminos[0] === '犬', 'Y lo pone primero', terminos[0]);
await p.screenshot({ path: join(CAPTURAS, '2-perro.png') });
const t2 = Date.now();
await ir('gato');
const gatos = await p.locator('.ap-dic-seccion', { hasText: 'Palabras que significan «gato»' }).locator('.ap-breve-termino b').allTextContents();
comprobar(gatos.includes('猫'), 'Con el índice ya hecho, «gato» encuentra 猫 al momento', `${Math.round(Date.now() - t2)} ms`);

// ---------- Gramática ----------

await ir('aunque');
const gramatica = p.locator('.ap-dic-seccion', { hasText: 'Gramática' });
const patrones = await gramatica.locator('.ap-patron-cab b').allTextContents();
comprobar(patrones[0]?.includes('〜ても') && patrones.length === 5, '«aunque» encuentra 〜ても y otros cuatro, con más debajo', patrones.join(' | '));
comprobar(await p.getByRole('button', { name: /Ver \d+ más/ }).first().isVisible(), 'Con «Ver más» para el resto');
await ir('わけではない');
const deForma = await p.locator('.ap-dic-seccion', { hasText: 'Gramática' }).locator('.ap-patron-cab b').first().textContent();
comprobar(deForma.includes('〜わけではない') && deForma.includes('N3'), 'Por su forma, con su nivel', deForma);
await p.locator('.ap-dic-seccion .ap-patron-cab').first().click();
await p.locator('.ap-dic-seccion .ap-patron-detalle').waitFor({ timeout: 10000 });
comprobar(await p.locator('.ap-dic-seccion .ap-patron-detalle button', { hasText: 'Explicar con Claude' }).isVisible(), 'Al abrirlo, sus ejemplos y la explicación de Claude');

// ---------- Kanji, homófonos y parecidas ----------

await ir('橋');
const resultado = p.locator('.ap-resultado').first();
await resultado.locator('.ap-kanji-ficha').first().waitFor({ timeout: 15000 });
const kanji = await resultado.locator('.ap-kanji-ficha').first().innerText();
comprobar(kanji.includes('橋') && /N\d/.test(kanji) && /bridge/i.test(kanji), 'Bajo la ficha, sus kanji con su nivel y su significado', kanji.replace(/\n/g, ' | '));
await resultado.locator('.ap-homofonos .chip').first().waitFor({ timeout: 15000 });
const homofonos = await resultado.locator('.ap-homofonos .chip').allTextContents();
comprobar(homofonos.includes('箸') && homofonos.includes('端'), 'Y las palabras que se leen igual: 箸 y 端', homofonos.join(' '));
await resultado.locator('.ap-mas-palabra button', { hasText: 'Palabras parecidas' }).click();
await resultado.locator('.ap-mas-palabra .panel-ia-texto').waitFor({ timeout: 15000 });
comprobar((await resultado.locator('.ap-mas-palabra .panel-ia-texto').innerText()).length > 20, 'Claude explica las palabras parecidas cuando se pide');
await p.screenshot({ path: join(CAPTURAS, '3-palabra.png'), fullPage: true });

// Las que significan lo mismo salen del diccionario, sin Claude.
await ir('食べる');
const conSinonimos = p.locator('.ap-resultado').first();
await conSinonimos.locator('.ap-sinonimos .chip').first().waitFor({ timeout: 20000 }).catch(() => {});
const sinonimos = await conSinonimos.locator('.ap-sinonimos .chip').allTextContents();
comprobar(sinonimos.includes('食う') && !sinonimos.includes('食べる'), 'Y las que significan lo mismo, sin ella: 食う para 食べる', sinonimos.join(' '));
const pista = await conSinonimos.locator('.ap-sinonimos .chip', { hasText: '食う' }).first().getAttribute('data-tip').catch(() => '');
comprobar(/くう/.test(pista ?? ''), 'Con su lectura y su significado al pasar el ratón', pista);
await conSinonimos.locator('.ap-mas-palabra').screenshot({ path: join(CAPTURAS, '4-sinonimos.png') }).catch(() => {});

// ---------- Categorías ----------

await ir('');
await p.locator('.ap-categoria', { hasText: 'Onomatopeyas' }).click();
await p.locator('.ap-categoria-vista .ap-breve').first().waitFor({ timeout: 90000 });
const cuantas = await p.locator('.ap-categoria-vista .ayuda').first().textContent();
comprobar(Number(cuantas.replace(/\D/g, '')) > 500, 'Las onomatopeyas del diccionario, todas', cuantas);
comprobar((await p.locator('.ap-categoria-vista .ap-breve').count()) === 100, 'De cien en cien');
comprobar((await p.locator('.ap-categoria-vista .ap-breve').first().locator('.ap-breve-comun').count()) === 1, 'Las de uso común primero');
await p.screenshot({ path: join(CAPTURAS, '4-onomatopeyas.png') });
const primera = await p.locator('.ap-categoria-vista .ap-breve-termino b').first().textContent();
await p.locator('.ap-categoria-vista .ap-breve').first().click();
await p.locator('.ap-resultado').first().waitFor({ timeout: 15000 });
comprobar(decodeURIComponent(p.url()).includes(`q=${primera}`), 'Al tocar una, se busca en el diccionario', primera);

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
