// Prueba la llegada de alguien nuevo: el último paso de la bienvenida, «¿Por dónde quieres empezar?», con sus cuatro
// caminos; el texto de ejemplo, que va a la Biblioteca una sola vez y se abre en el visor; «Descubre Kotonoha», con lo que
// tiene cada lengua; las pistas de la primera vez, que se cierran para siempre y no salen a quien ya usaba Kotonoha; y
// «Lo nuevo», que sale una vez tras actualizar y no a quien acaba de instalar.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/primera-vez.mjs

import { mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
// Un perfil nuevo cada vez: es la primera vez de alguien.
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-primera-vez'));
rmSync(PERFIL, { recursive: true, force: true });
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'primera-vez');
mkdirSync(CAPTURAS, { recursive: true });

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};

const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1280, height: 900 },
  args: ['--mute-audio', `--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
for (const pg of contexto.pages()) if (pg.url().includes('app.html')) await pg.close();
const version = await sw.evaluate(() => chrome.runtime.getManifest().version);
const ajustes = (c) =>
  sw.evaluate(async (c) => {
    const d = await chrome.storage.local.get('ajustes');
    await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), ...c } });
  }, c);
const leerAjustes = () => sw.evaluate(async () => (await chrome.storage.local.get('ajustes')).ajustes ?? {});
await ajustes({ bienvenidaVista: false, idiomaInterfaz: 'es', idiomaObjetivo: 'ja', destino: 'memoria', ankiPuerto: 1 });
const errores = [];
const app = await contexto.newPage();
app.on('pageerror', (e) => errores.push(e.message));
await app.goto(`chrome-extension://${id}/app.html#/inicio`);
const motor = (metodo, ...args) =>
  app.evaluate(({ metodo, args }) => chrome.runtime.sendMessage({ canal: 'motor', metodo, args }), { metodo, args }).then((r) => {
    if (!r?.ok) throw new Error(r?.error ?? 'sin respuesta');
    return r.valor;
  });
// El texto de lo leído, sin el furigana que se le pone encima.
const textoVisor = (v) =>
  v.evaluate(() => {
    const t = document.querySelector('.vs-vista-texto')?.cloneNode(true);
    t?.querySelectorAll('rt, .ap-pista').forEach((x) => x.remove());
    return t?.textContent ?? '';
  });
const nuevaPestana = () => contexto.waitForEvent('page', { timeout: 15000 });

// ---------- La bienvenida ----------

console.log('\n== «¿Por dónde quieres empezar?» ==');
await app.waitForSelector('.ap-bienvenida', { timeout: 15000 });
for (let i = 0; i < 7; i++) await app.locator('.ap-bv-pie .btn.primario').click();
await app.waitForSelector('.ap-bv-camino', { timeout: 10000 });
const paso = await app.evaluate(() => ({
  titulo: document.querySelector('.ap-bv-cuerpo h1')?.textContent,
  caminos: [...document.querySelectorAll('.ap-bv-camino')].map((c) => c.getAttribute('data-camino')),
  ejemplo: document.querySelector('.ap-bv-camino[data-camino="ejemplo"]')?.textContent,
}));
console.log('  ', JSON.stringify(paso));
comprobar(paso.titulo === '¿Por dónde quieres empezar?', 'El último paso pregunta por dónde empezar');
comprobar(JSON.stringify(paso.caminos) === JSON.stringify(['ejemplo', 'video', 'libros', 'diccionario']), 'Con cuatro caminos', JSON.stringify(paso.caminos));
comprobar(/吾輩は猫である/.test(paso.ejemplo ?? '') && /夏目漱石/.test(paso.ejemplo ?? ''), 'El primero es el texto de ejemplo, con su título y su autor');
await app.screenshot({ path: join(CAPTURAS, 'bienvenida.png') });

// ---------- El texto de ejemplo ----------

console.log('\n== El texto de ejemplo ==');
let pestana = nuevaPestana();
await app.locator('.ap-bv-camino[data-camino="ejemplo"]').click();
let v = await pestana;
v.on('pageerror', (e) => errores.push(e.message));
await v.waitForSelector('.vs-vista-texto', { timeout: 20000 });
await v.waitForFunction(() => /名前/.test(document.querySelector('.vs-vista-texto')?.textContent ?? ''), null, { timeout: 30000 }).catch(() => {});
// Cada palabra va en lo suyo: sin los espacios que el texto lleve entre ellas, ni la unión invisible (U+2060) que no deja
// que el «。» empiece renglón.
const leido = (await textoVisor(v)).replace(/[\s⁠]+/g, '');
const desde = Math.max(0, leido.indexOf('名前') - 12);
comprobar(leido.includes('吾輩は猫である。名前はまだ無い。') && leido.includes('青空文庫'), 'Se abre en el visor, con su fuente', leido.slice(desde, desde + 40));
const tras = await leerAjustes();
comprobar(tras.bienvenidaVista === true && tras.pistas === true && tras.novedadesVistas === version, 'Al elegirlo, la bienvenida termina con las pistas encendidas y las novedades de esta versión ya vistas', JSON.stringify({ pistas: tras.pistas, novedadesVistas: tras.novedadesVistas }));
const pistaVisor = await v.waitForSelector('.ap-pista[data-pista="visor-texto"]', { timeout: 10000 }).then(() => true).catch(() => false);
comprobar(pistaVisor, 'Con la pista del visor: cómo ver la ficha y crear la primera tarjeta');
await v.screenshot({ path: join(CAPTURAS, 'ejemplo.png') });
await v.locator('.ap-pista[data-pista="visor-texto"] .btn').click();
await v.waitForTimeout(500);
comprobar((await v.locator('.ap-pista').count()) === 0 && (await leerAjustes()).pistasVistas?.includes('visor-texto'), '«Entendido» la cierra para siempre');
await v.close();

// ---------- Descubre Kotonoha ----------

console.log('\n== Descubre Kotonoha ==');
await app.bringToFront();
await app.waitForSelector('.ap-aviso-descubre', { timeout: 10000 });
comprobar((await app.locator('.ap-lo-nuevo').count()) === 0, 'Quien acaba de instalar no ve «Lo nuevo»');
await app.locator('.ap-aviso-descubre .btn').click();
await app.waitForSelector('.ap-familia', { timeout: 10000 });
const descubre = await app.evaluate(() => ({
  familias: [...document.querySelectorAll('.ap-familia')].map((f) => f.getAttribute('data-familia')),
  funciones: [...document.querySelectorAll('.ap-funcion')].map((f) => f.getAttribute('data-funcion')),
}));
console.log('  ', JSON.stringify(descubre));
comprobar(JSON.stringify(descubre.familias) === JSON.stringify(['ver', 'leer', 'repasar', 'consultar', 'practicar']), 'Inicio lleva a «Descubre Kotonoha», con sus cinco familias');
comprobar(['niveles', 'kanji', 'acento', 'voces'].every((f) => descubre.funciones.includes(f)) && !descubre.funciones.includes('como-suena'), 'En japonés, con el JLPT, los kanji, el acento y las voces de AivisHub, y sin «Cómo suena»');
// El cambio de pantalla funde una con otra: la captura, ya con la nueva sola.
await app.waitForTimeout(900);
await app.screenshot({ path: join(CAPTURAS, 'descubre.png'), fullPage: true });
pestana = nuevaPestana();
await app.locator('.ap-funcion[data-funcion="ejemplo"] .btn').click();
v = await pestana;
await v.waitForSelector('.vs-vista-texto', { timeout: 20000 });
const ejemplos = (await motor('bibliotecaListar')).filter((e) => e.id === 'ejemplo-ja');
comprobar(ejemplos.length === 1 && (await v.locator('.ap-pista').count()) === 0, 'Abrirlo otra vez abre el mismo, sin duplicarlo ni repetir la pista');
await v.close();
await app.bringToFront();
await app.locator('.ap-funcion[data-funcion="diccionario"] .btn').click();
await app.waitForFunction(() => location.hash.includes('diccionario?q='), null, { timeout: 5000 });
comprobar(decodeURIComponent(await app.evaluate(() => location.hash)).includes('食べる'), '«Probar» lleva a cada cosa: el diccionario, con una palabra');

// ---------- Las pistas ----------

console.log('\n== Las pistas de la primera vez ==');
const pista = async (ruta, idPista) => {
  await app.goto(`chrome-extension://${id}/app.html#/${ruta}`);
  return app
    .waitForSelector(`.ap-pista[data-pista="${idPista}"]`, { timeout: 8000 })
    .then(() => true)
    .catch(() => false);
};
comprobar(await pista('diccionario', 'diccionario'), 'El diccionario tiene la suya');
comprobar(await pista('memoria', 'memoria'), 'La Memoria, la suya');
comprobar(await pista('lector', 'cuaderno'), 'Y el Cuaderno, la suya');
await app.screenshot({ path: join(CAPTURAS, 'pista-cuaderno.png') });

// ---------- Quien ya usaba Kotonoha ----------

console.log('\n== Quien ya usaba Kotonoha ==');
await ajustes({ pistas: false, pistasVistas: [], novedadesVistas: '' });
await app.goto(`chrome-extension://${id}/app.html#/inicio`);
const nuevo = await app
  .waitForSelector('.ap-lo-nuevo', { timeout: 10000 })
  .then((e) => e.textContent())
  .catch(() => '');
comprobar(nuevo.includes(`Novedades de la ${version}`) && (await app.locator('.ap-lo-nuevo li').count()) >= 2, 'Tras actualizar, Inicio cuenta lo nuevo de esta versión', nuevo.slice(0, 60));
await app.screenshot({ path: join(CAPTURAS, 'lo-nuevo.png') });
await app.locator('.ap-lo-nuevo [aria-label="Cerrar"]').click();
await app.waitForTimeout(400);
await app.reload();
await app.waitForSelector('.ap-aviso-descubre', { timeout: 10000 });
comprobar((await app.locator('.ap-lo-nuevo').count()) === 0 && (await leerAjustes()).novedadesVistas === version, 'Una sola vez');
comprobar(!(await pista('memoria', 'memoria')) && !(await pista('lector', 'cuaderno')), 'Y no le salen pistas en pantallas que ya conoce');

// ---------- Otra lengua ----------

console.log('\n== En inglés ==');
await ajustes({ idiomaObjetivo: 'en' });
await app.goto(`chrome-extension://${id}/app.html#/descubre`);
await app.waitForSelector('.ap-familia', { timeout: 10000 });
const ingles = await app.evaluate(() => [...document.querySelectorAll('.ap-funcion')].map((f) => f.getAttribute('data-funcion')));
comprobar(ingles.includes('como-suena') && !ingles.includes('kanji') && !ingles.includes('acento') && !ingles.includes('voces'), 'En inglés, «Cómo suena», y ni kanji, ni acento, ni las voces de AivisHub', JSON.stringify(ingles));
pestana = nuevaPestana();
await app.locator('.ap-funcion[data-funcion="ejemplo"] .btn').click();
v = await pestana;
await v.waitForSelector('.vs-vista-texto', { timeout: 20000 });
await v.waitForFunction(() => /Alice/.test(document.querySelector('.vs-vista-texto')?.textContent ?? ''), null, { timeout: 30000 }).catch(() => {});
comprobar((await textoVisor(v)).includes('Alice was beginning to get very tired'), 'Su texto de ejemplo es Alice, en su base', (await textoVisor(v)).slice(0, 40));
await v.close();
await ajustes({ idiomaObjetivo: 'ja' });

if (errores.length) console.log('\nErrores en la página:', [...new Set(errores)].slice(0, 6));
comprobar(errores.length === 0, 'Sin errores en las páginas');
console.log(`\n${fallos ? `${fallos} comprobaciones fallaron` : 'Todas las comprobaciones pasaron'}`);
await contexto.close();
process.exit(fallos ? 1 : 0);
