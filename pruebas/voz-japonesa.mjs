// Prueba las voces de AivisHub dentro de Kotonoha (0.42.0). En japonés, Ajustes, Voces, ofrece instalarlas: «Instalar
// las voces» baja lo que comparten (el BERT y el diccionario) y la voz inicial, con su progreso, y la deja activa.
// «Probar» lee la frase de ejemplo con ella (la primera vez carga los modelos), la segunda vez sale de la caché, y otro
// estilo se lee aparte; lo medido llega a «Tu equipo». El catálogo de AivisHub busca, filtra por licencia y enseña la
// licencia propia antes de instalar. «Modelos guardados» lista la voz, y el aviso de Inicio sale a quien usaba AivisSpeech.
// La primera vez baja unos 0,9 GB: el perfil (.perfil-voz) se conserva para no repetirlo; en cada pasada se vuelven a
// poner los ajustes como antes de instalar, así que «Instalar» se prueba siempre (con todo ya en el disco, sin bajar nada).
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/voz-japonesa.mjs

import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-voz'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'voz-japonesa');
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
  args: ['--mute-audio', `--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
const ajustes = () => sw.evaluate(() => chrome.storage.local.get('ajustes').then((d) => d.ajustes));
const fijarAjustes = (cambios) =>
  sw.evaluate(async (c) => {
    const d = await chrome.storage.local.get('ajustes');
    await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), idiomaInterfaz: 'es', bienvenidaVista: true, ...c } });
  }, cambios);
const SIN_VOCES = { activa: false, voz: null, hablante: 0, estilo: 0, instaladas: [] };

await fijarAjustes({ idiomaObjetivo: 'ja', avisarVersiones: false, vozIntegrada: SIN_VOCES, vozLocal: { activa: false, url: '', estilo: null, acentoDiccionario: true }, equipoUso: {} });
const p = await contexto.newPage();
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));
await p.goto(`chrome-extension://${id}/app.html#/inicio`);
await p.evaluate(async () => {
  const c = await caches.open('kotonoha-voz-neuronal');
  for (const k of await c.keys()) if (k.url.includes('/sbv2-')) await c.delete(k);
});
const frasesGuardadas = () => p.evaluate(async () => (await (await caches.open('kotonoha-voz-neuronal')).keys()).filter((k) => k.url.includes('/sbv2-')).length);

async function abrirVoces() {
  await p.goto(`chrome-extension://${id}/app.html#/ajustes?seccion=voces`);
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

// ---------- Instalar ----------
let seccion = await abrirVoces();
const texto = await seccion.innerText();
comprobar(texto.includes('Voces neuronales de AivisHub') && texto.includes('まお'), 'En japonés se ofrecen las voces de AivisHub, con la voz inicial');
const instalar = seccion.getByRole('button', { name: 'Instalar las voces' });
comprobar(await instalar.isVisible(), 'Sin voces, «Instalar las voces»');
const yaEnDisco = await p.evaluate(async () => (await (await caches.open('kotonoha-modelos-voz')).keys()).some((k) => k.url.includes('aivis-project.com')));
const t0 = Date.now();
await instalar.click();
if (!yaEnDisco) {
  await seccion.locator('.barra-progreso').first().waitFor({ timeout: 60000 }).catch(() => {});
  comprobar(await seccion.locator('.barra-progreso').first().isVisible().catch(() => false), 'Mientras baja, se ve cuánto lleva');
}
const interruptor = seccion.getByRole('switch', { name: 'Leer las frases con la voz neuronal' });
// Lo que salga antes: el interruptor (instalada) o un error, que no hay por qué esperar 45 minutos para ver.
const errorInstalar = seccion.locator('.texto-error, .ap-texto-error').first();
const instalado = await Promise.race([
  interruptor.waitFor({ timeout: 45 * 60 * 1000 }).then(() => ''),
  errorInstalar.waitFor({ timeout: 45 * 60 * 1000 }).then(async () => await errorInstalar.innerText()),
]).catch((e) => `sin respuesta: ${e.message.split('\n')[0]}`);
comprobar(!instalado, yaEnDisco ? 'Instala sin volver a bajar lo que ya está en el disco' : 'Baja e instala las voces', instalado || `${((Date.now() - t0) / 1000).toFixed(0)} s`);
if (instalado) {
  await p.screenshot({ path: join(CAPTURAS, 'error-instalar.png') });
  await contexto.close();
  console.log(`\n${fallos} comprobaciones fallaron`);
  process.exit(1);
}
let a = await ajustes();
comprobar(a.vozIntegrada.instaladas.length === 1 && a.vozIntegrada.instaladas[0].nombre === 'まお', 'Queda instalada まお', a.vozIntegrada.instaladas.map((v) => `${v.nombre} ${v.version} ${v.licencia}`).join(', '));
comprobar(a.vozIntegrada.activa && a.vozIntegrada.voz === a.vozIntegrada.instaladas[0]?.uuid, 'Y queda elegida y activa');
const estilos = await seccion.getByRole('combobox', { name: 'Voz y estilo' }).locator('option').allInnerTexts();
comprobar(estilos.length === 6 && estilos[0] === 'まお · ノーマル', 'Se puede elegir entre sus seis estilos', estilos.join(', '));
const estado = await sw.evaluate(() => chrome.runtime.sendMessage({ canal: 'motor', metodo: 'estadoVoces', args: [] }).then((r) => r?.valor));
comprobar(estado?.base.instalada && estado.voces[0]?.presente, 'Todo está en el disco', estado ? `${(estado.base.bytes / 1e6).toFixed(0)} MB compartidos, ${(estado.voces[0]?.bytes / 1e6).toFixed(0)} MB la voz` : 'sin estado');
await p.screenshot({ path: join(CAPTURAS, 'instalada.png') });

// ---------- Leer ----------
const primera = await probar(seccion);
comprobar(!primera.error, 'Lee la frase de ejemplo con まお', `${(primera.ms / 1000).toFixed(1)} s, cargando los modelos${primera.error ? `: ${primera.error}` : ''}`);
comprobar((await frasesGuardadas()) === 1, 'Y la guarda');
const segunda = await probar(seccion);
comprobar(!segunda.error && segunda.ms < 2500, 'La segunda vez sale de la caché', `${segunda.ms} ms`);
await seccion.getByRole('combobox', { name: 'Voz y estilo' }).selectOption({ index: 2 });
await p.waitForTimeout(400);
a = await ajustes();
comprobar(a.vozIntegrada.estilo === 2, 'Se cambia el estilo y se guarda');
const otroEstilo = await probar(seccion);
comprobar(!otroEstilo.error && (await frasesGuardadas()) === 2, 'Otro estilo se lee aparte, ya con los modelos cargados', `${(otroEstilo.ms / 1000).toFixed(1)} s`);
a = await ajustes();
const habla = a.equipoUso?.habla;
comprobar(habla && habla.velocidad > 1, '«Tu equipo» anota lo medido al leer, sin la primera vez', habla ? `${habla.velocidad} s de habla por segundo, en ${habla.dispositivo}` : 'nada');
const gpu = await p.evaluate(async () => !!(await navigator.gpu?.requestAdapter()));
if (gpu) comprobar(habla?.dispositivo === 'webgpu', 'Con WebGPU, la voz va en la gráfica');

// ---------- El catálogo ----------
await seccion.getByRole('button', { name: 'Ver el catálogo' }).click();
const catalogo = p.locator('.ap-catalogo');
await catalogo.locator('.ap-catalogo-voz').first().waitFor({ timeout: 30000 });
const tarjetas = await catalogo.locator('.ap-catalogo-voz').count();
comprobar(tarjetas >= 5, 'El catálogo de AivisHub enseña voces', `${tarjetas} en la primera página`);
comprobar(await catalogo.locator('.ap-catalogo-voz', { hasText: 'まお' }).locator('.ap-catalogo-instalada').isVisible(), 'まお sale como instalada');
await catalogo.getByRole('searchbox', { name: 'Buscar voces' }).fill('コハク');
await p.waitForFunction(() => [...document.querySelectorAll('.ap-catalogo-voz b')].some((b) => b.textContent === 'コハク') && document.querySelectorAll('.ap-catalogo-voz').length <= 3, null, { timeout: 15000 }).catch(() => {});
comprobar((await catalogo.locator('.ap-catalogo-voz b').allInnerTexts()).includes('コハク'), 'Busca por nombre');
await catalogo.getByRole('searchbox', { name: 'Buscar voces' }).fill('');
await catalogo.getByRole('combobox', { name: 'Licencia' }).selectOption('Custom');
await p.waitForFunction(() => {
  const tipos = [...document.querySelectorAll('.ap-catalogo-licencia-tipo')].map((t) => t.textContent);
  return tipos.length > 0 && tipos.every((t) => t === 'Propia');
}, null, { timeout: 15000 }).catch(() => {});
const tipos = await catalogo.locator('.ap-catalogo-licencia-tipo').allInnerTexts();
comprobar(tipos.length > 0 && tipos.every((t) => t === 'Propia'), 'Filtra por licencia', `${tipos.length} con licencia propia`);
const propia = catalogo.locator('.ap-catalogo-voz').first();
comprobar((await propia.getByRole('button', { name: 'Instalar' }).count()) === 0 && (await propia.getByRole('button', { name: 'Leer la licencia' }).isVisible()), 'Con licencia propia, primero se lee');
await propia.getByRole('button', { name: 'Leer la licencia' }).click();
await propia.locator('.ap-catalogo-licencia pre').waitFor({ timeout: 15000 }).catch(() => {});
const licencia = await propia.locator('.ap-catalogo-licencia pre').innerText().catch(() => '');
comprobar(licencia.length > 20 && (await propia.getByRole('button', { name: 'Instalar' }).isVisible()), 'Se lee su licencia, y entonces se puede instalar', `${licencia.length} caracteres`);
await p.screenshot({ path: join(CAPTURAS, 'catalogo.png') });

// ---------- Modelos guardados ----------
await p.goto(`chrome-extension://${id}/app.html#/ajustes?seccion=transcripcion`);
await p.reload();
await p.locator('#transcripcion').waitFor({ timeout: 15000 });
await p.waitForFunction(() => document.querySelector('#transcripcion')?.textContent?.includes('Voz まお'), null, { timeout: 15000 }).catch(() => {});
const transcripcion = await p.locator('#transcripcion').innerText();
comprobar(transcripcion.includes('Voz まお') && transcripcion.includes('lo que comparten todas'), '«Modelos guardados» lista la voz y lo que comparten');

// ---------- El aviso de Inicio ----------
await fijarAjustes({ vozIntegrada: SIN_VOCES, vozLocal: { activa: true, url: '', estilo: null, acentoDiccionario: true }, avisoVocesVisto: false });
await p.goto(`chrome-extension://${id}/app.html#/inicio`);
await p.reload();
const aviso = p.locator('.ap-aviso-voces');
await aviso.waitFor({ timeout: 15000 }).catch(() => {});
comprobar(await aviso.isVisible(), 'A quien leía con AivisSpeech, Inicio le cuenta que sus voces pueden ir dentro');
await aviso.getByRole('button', { name: 'Ver las voces' }).click().catch(() => {});
await p.waitForTimeout(900);
a = await ajustes();
comprobar(a.avisoVocesVisto === true && p.url().includes('ajustes?seccion=voces'), 'Lleva a las voces y no vuelve a salir');

comprobar(errores.length === 0, 'Sin errores en la página', errores.join(' | ').slice(0, 200));
// Como estaba: instalada y activa, para quien use el perfil después.
await fijarAjustes({ vozLocal: { activa: false, url: '', estilo: null, acentoDiccionario: true } });
await contexto.close();
console.log(`\n${fallos ? `${fallos} comprobaciones fallaron` : 'Todas las comprobaciones pasaron'}`);
process.exit(fallos ? 1 : 0);
