// Prueba las voces neuronales del inglés (Kokoro) y del alemán (Piper) desde Ajustes: la opción sale solo en esas
// lenguas, «Probar» lee la frase de ejemplo con el modelo en el propio navegador, el audio queda en la caché y la
// segunda vez sale de ella. La primera vez descarga los modelos (92 MB y 63 MB); el perfil se conserva para no repetirlo.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/voz-neuronal.mjs

import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-voz'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'voz-neuronal');
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
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
const fijarAjustes = (cambios) =>
  sw.evaluate(async (c) => {
    const d = await chrome.storage.local.get('ajustes');
    await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), idiomaInterfaz: 'es', bienvenidaVista: true, ...c } });
  }, cambios);

// Antes de abrir la app: con la bienvenida sin ver, enseñaría la bienvenida y no Ajustes.
await fijarAjustes({ idiomaObjetivo: 'ja', avisarVersiones: false, vozNeuronal: { activa: false, vozIngles: 'af_heart' } });
const p = await contexto.newPage();
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));
await p.goto(`chrome-extension://${id}/app.html#/inicio`);
await p.evaluate(() => caches.delete('kotonoha-voz-neuronal'));
const enCache = () => p.evaluate(async () => (await (await caches.open('kotonoha-voz-neuronal')).keys()).length);

async function abrirVoces() {
  // Se carga de nuevo: la sección de las voces depende de la lengua que se estudia.
  await p.goto(`chrome-extension://${id}/app.html#/ajustes`);
  await p.reload();
  await p.locator('#voces').waitFor({ timeout: 15000 });
  const seccion = p.locator('#voces');
  await seccion.scrollIntoViewIfNeeded().catch(() => {});
  return seccion;
}

/** Pulsa «Probar» y espera a que termine de leer; devuelve los milisegundos y el error, si lo hay. */
async function probar(seccion) {
  const boton = seccion.getByRole('button', { name: 'Probar la voz neuronal' });
  const t0 = Date.now();
  await boton.click();
  await p.waitForFunction(() => ![...document.querySelectorAll('#voces button')].some((b) => b.textContent.includes('Preparando')), null, { timeout: 300000 }).catch(() => {});
  return { ms: Date.now() - t0, error: (await seccion.locator('.texto-error').allInnerTexts()).join(' | ') };
}

// ---------- Japonés: la opción no sale ----------
await fijarAjustes({ idiomaObjetivo: 'ja', vozNeuronal: { activa: false, vozIngles: 'af_heart' } });
let seccion = await abrirVoces();
comprobar(!(await seccion.innerText()).includes('Voz neuronal en el navegador'), 'En japonés no se ofrece: ahí está la voz local');

// ---------- Inglés: Kokoro ----------
await fijarAjustes({ idiomaObjetivo: 'en' });
seccion = await abrirVoces();
const textoIngles = await seccion.innerText();
comprobar(textoIngles.includes('Voz neuronal en el navegador') && textoIngles.includes('Kokoro'), 'En inglés se ofrece Kokoro');
comprobar(await seccion.getByRole('button', { name: 'Probar la voz neuronal' }).isDisabled(), 'Apagada, «Probar» no se puede pulsar');
await seccion.getByRole('switch', { name: 'Leer las frases con la voz neuronal' }).click().catch(async () => seccion.getByLabel('Leer las frases con la voz neuronal').click());
await p.waitForTimeout(400);
comprobar((await sw.evaluate(() => chrome.storage.local.get('ajustes').then((d) => d.ajustes.vozNeuronal.activa))) === true, 'Se activa y se guarda');
const voces = await seccion.getByRole('combobox', { name: 'Voz de Kokoro' }).locator('option').allInnerTexts();
comprobar(voces.length === 6 && voces[0].startsWith('Heart'), 'Se puede elegir la voz', voces.join(', '));
const primera = await probar(seccion);
comprobar(!primera.error, 'Kokoro lee la frase de ejemplo', `${(primera.ms / 1000).toFixed(1)} s${primera.error ? `: ${primera.error}` : ''}`);
comprobar((await enCache()) === 1, 'Y la guarda en su caché');
const segunda = await probar(seccion);
comprobar(!segunda.error && segunda.ms < 2500, 'La segunda vez sale de la caché', `${segunda.ms} ms`);
await p.screenshot({ path: join(CAPTURAS, 'ingles.png') });

// ---------- Alemán: Piper ----------
await fijarAjustes({ idiomaObjetivo: 'de' });
seccion = await abrirVoces();
const textoAleman = await seccion.innerText();
comprobar(textoAleman.includes('Piper') && textoAleman.includes('Thorsten'), 'En alemán se ofrece Piper con la voz de Thorsten');
comprobar((await seccion.getByRole('combobox', { name: 'Voz de Kokoro' }).count()) === 0, 'Sin el selector de voces de Kokoro');
const aleman = await probar(seccion);
comprobar(!aleman.error, 'Piper lee la frase de ejemplo', `${(aleman.ms / 1000).toFixed(1)} s${aleman.error ? `: ${aleman.error}` : ''}`);
comprobar((await enCache()) === 2, 'Y también queda en la caché');
await p.screenshot({ path: join(CAPTURAS, 'aleman.png') });

comprobar(errores.length === 0, 'Sin errores en la página', errores.join(' | ').slice(0, 200));
await fijarAjustes({ idiomaObjetivo: 'ja', vozNeuronal: { activa: false, vozIngles: 'af_heart' } });
await contexto.close();
console.log(`\n${fallos ? `${fallos} comprobaciones fallaron` : 'Todas las comprobaciones pasaron'}`);
process.exit(fallos ? 1 : 0);
