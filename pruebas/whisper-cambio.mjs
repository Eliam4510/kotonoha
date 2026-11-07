// Cambiar de idioma a mitad de una transcripción, en el reproductor local y desde el panel del propio video: la
// transcripción se corta, lo ya transcrito queda en su idioma y nada de lo que llegue después pasa al otro. El video sigue
// abierto, y al volver al japonés se sigue desde donde iba. Whisper necesita voz: con un tono no hay nada que cortar.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/whisper-cambio.mjs voz-en-japones.wav

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';
import { iniciarMock } from './mock-claude.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-local'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'cambio');
const FFMPEG = existsSync('C:/ffmpeg/bin/ffmpeg.exe') ? 'C:/ffmpeg/bin/ffmpeg.exe' : 'ffmpeg';
const audio = process.argv[2];
if (!audio) {
  console.error('Falta la muestra de voz: node pruebas/whisper-cambio.mjs voz.wav');
  process.exit(2);
}
mkdirSync(CAPTURAS, { recursive: true });

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};
const JAPONES = /[\u3040-\u30ff\u4e00-\u9fff]/;

const mock = await iniciarMock();
const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1440, height: 900 },
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
const leerAjustes = () => sw.evaluate(async () => (await chrome.storage.local.get('ajustes')).ajustes ?? {});
const ponerAjustes = (cambios) => sw.evaluate(async (c) => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), ...c } });
}, cambios);
await sw.evaluate(async (url) => { await chrome.storage.local.set({ urlBaseIA: url, claveAnthropic: 'clave-de-prueba' }); }, `http://127.0.0.1:${mock.puerto}`);
await ponerAjustes({ idiomaInterfaz: 'es', bienvenidaVista: true, tema: 'oscuro', navegadorAbierto: false, modo: 'normal', salto: 'no', analisisAutomatico: false, whisperCorregir: false, whisperModelo: 'auto' });

const errores = [];
const app = await contexto.newPage();
app.on('pageerror', (e) => errores.push(e.message));
await app.goto(`chrome-extension://${id}/app.html#/ajustes`);
await app.waitForTimeout(1200);
const selector = app.locator('select[aria-label="Idioma que estudias"]');
const lenguaInicial = await selector.inputValue();
if (lenguaInicial !== 'ja') {
  await selector.selectOption('ja');
  await app.waitForTimeout(800);
}
await app.close();

// La voz repetida hasta unos minutos: da tiempo a cambiar de idioma mientras aún transcribe.
const nombre = `${Date.now()} una charla larga.webm`;
const ruta = join(CAPTURAS, nombre);
execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-stream_loop', '-1', '-i', join(RAIZ, 'pruebas', 'fixtures', 'video.webm'), '-stream_loop', '11', '-i', audio, '-map', '0:v', '-map', '1:a', '-shortest', '-c:v', 'copy', '-c:a', 'libopus', ruta]);

const r = await contexto.newPage();
r.on('pageerror', (e) => errores.push(`reproductor: ${e.message}`));
await r.goto(`chrome-extension://${id}/app.html#/reproductor`);
await r.waitForTimeout(1200);
await r.setInputFiles('input[type="file"]', ruta);
await r.waitForFunction(() => document.querySelector('.ap-local video')?.readyState >= 2, undefined, { timeout: 30000 });
await r.evaluate(() => document.querySelector('.ap-local video').pause());
await r.waitForTimeout(800);

const abrirGenerar = async () => {
  if (await r.evaluate(() => !!document.querySelector('.panel-generar'))) return;
  await r.evaluate(() => document.querySelector('button[aria-label="Generar subtítulos"], button[data-tip^="Generar subtítulos"], button[title="Generar subtítulos"]')?.click());
  await r.waitForTimeout(500);
};
const lineasEnCurso = () => r.evaluate(() => {
  const t = document.querySelector('.panel-generar .progreso-linea .ayuda')?.textContent ?? '';
  return Number(t.match(/(\d+) líneas?/)?.[1] ?? -1);
});
const cambiarLengua = async (nombreLengua) => {
  if (!(await r.evaluate(() => !!document.querySelector('.panel-flotante .segmentado[aria-label="Idioma que estudias"]')))) {
    await r.evaluate(() => document.querySelector('.barra-acciones button[aria-label="Ajustes de video"]')?.click());
    await r.waitForTimeout(300);
    await r.evaluate(() => [...document.querySelectorAll('.panel-flotante [role="tab"]')].find((b) => b.textContent.trim() === 'Subtítulos')?.click());
    await r.waitForTimeout(300);
  }
  await r.evaluate((n) => [...document.querySelectorAll('.panel-flotante .segmentado[aria-label="Idioma que estudias"] button')].find((b) => b.textContent === n)?.click(), nombreLengua);
};
/** Lo guardado de este video en la base de una lengua, sin crearla si aún no existe. */
const guardado = (base) => r.evaluate(async ({ base, video }) => {
  if (!(await indexedDB.databases()).some((d) => d.name === base)) return [];
  const abierta = await new Promise((ok, mal) => {
    const p = indexedDB.open(base);
    p.onsuccess = () => ok(p.result);
    p.onerror = () => mal(p.error);
  });
  try {
    if (![...abierta.objectStoreNames].includes('generados')) return [];
    const todas = await new Promise((ok, mal) => {
      const q = abierta.transaction('generados').objectStore('generados').getAll();
      q.onsuccess = () => ok(q.result);
      q.onerror = () => mal(q.error);
    });
    return todas.filter((f) => f.idVideo === video).map((f) => ({ idioma: f.idioma, origen: f.origen, lineas: f.lineas.length, texto: f.lineas.map((l) => l.texto).join(' ') }));
  } finally {
    abierta.close();
  }
}, { base, video: nombre });

console.log('== Cambiar de idioma mientras transcribe ==');
await abrirGenerar();
await r.locator('.panel-generar button', { hasText: 'Transcribir el archivo' }).click();
let antes = -1;
for (const limite = Date.now() + 300000; Date.now() < limite && antes < 4; ) {
  await r.waitForTimeout(120);
  antes = await lineasEnCurso();
}
comprobar(antes >= 4, 'La transcripción está en marcha', `${antes} líneas`);
await cambiarLengua('Inglés');
await r.waitForTimeout(1500);
comprobar((await leerAjustes()).idiomaObjetivo === 'en', 'Un clic en el panel del video pasa al inglés');
comprobar(await r.evaluate(() => document.body.innerText.includes('La transcripción se detuvo al cambiar de video o de idioma')), 'Avisa de que la transcripción se detuvo');
comprobar(await r.evaluate(() => !!document.querySelector('.ap-local video')?.src), 'El video sigue abierto');
await r.screenshot({ path: join(CAPTURAS, 'cortada.png') });

// Lo que tardaría en terminar si siguiera: después no puede haber nada nuevo en ningún sitio.
await r.waitForTimeout(25000);
const enIngles = await guardado('kikitori-en');
comprobar(!enIngles.some((f) => JAPONES.test(f.texto)), 'Nada de lo transcrito pasa al inglés', enIngles.map((f) => `${f.idioma}/${f.origen}: ${f.lineas}`).join(', ') || 'nada guardado');
const enJapones = await guardado('kikitori');
const parcial = enJapones.find((f) => f.idioma === 'ja' && f.origen === 'whisper');
comprobar(!!parcial && parcial.lineas >= antes, 'Lo ya transcrito queda guardado en japonés', parcial ? `${parcial.lineas} líneas` : 'nada');
await abrirGenerar();
comprobar(await r.evaluate(() => !document.querySelector('.panel-generar .progreso-linea')), 'Y no sigue transcribiendo');

console.log('\n== De vuelta al japonés ==');
const vuelta = Date.now();
await cambiarLengua('Japonés');
await r.waitForTimeout(300);
comprobar((await leerAjustes()).idiomaObjetivo === 'ja', 'Otro clic vuelve al japonés');
comprobar(await r.evaluate(() => !!document.querySelector('.ap-local video')?.src), 'Con el mismo video abierto');
// Enseguida, mientras el motor aún carga el analizador japonés y la pista no ha terminado de cargarse.
await abrirGenerar();
await r.locator('.panel-generar button', { hasText: 'Transcribir el archivo' }).click();
let sigue = false;
for (const limite = Date.now() + 30000; Date.now() < limite && !sigue; ) {
  await r.waitForTimeout(150);
  sigue = await r.evaluate(() => document.body.innerText.includes('Sigo desde donde iba'));
}
comprobar(sigue, 'Al transcribir enseguida, espera a la pista y sigue desde donde iba');
const lineaA = (s) => r.evaluate((s) => {
  const v = document.querySelector('.ap-local video');
  v.pause();
  if (Math.abs(v.currentTime - s) > 0.05) v.currentTime = s;
  const e = document.querySelector('.linea-sub.objetivo');
  if (!e) return '';
  const c = e.cloneNode(true);
  c.querySelectorAll('rt, .glosa').forEach((x) => x.remove());
  return c.textContent.replaceAll('\u2060', '').trim();
}, s);
let linea = '';
for (const limite = Date.now() + 30000; Date.now() < limite && !JAPONES.test(linea); ) {
  await r.waitForTimeout(200);
  linea = await lineaA(3);
}
comprobar(JAPONES.test(linea), 'Y sus subtítulos en japonés', `${linea}, a los ${((Date.now() - vuelta) / 1000).toFixed(1)} s`);
let acabado = false;
for (const limite = Date.now() + 300000; Date.now() < limite && !acabado; ) {
  await r.waitForTimeout(400);
  acabado = await r.evaluate(() => !document.querySelector('.panel-generar .progreso-linea') && !!document.querySelector('.panel-generar .bloque-generar button'));
}
await r.waitForTimeout(1500);
const completa = (await guardado('kikitori')).find((f) => f.idioma === 'ja' && f.origen === 'whisper');
comprobar(!!completa && completa.lineas > (parcial?.lineas ?? 0), 'Y la termina', completa ? `${completa.lineas} líneas` : 'nada');
comprobar(!(await guardado('kikitori-en')).some((f) => JAPONES.test(f.texto)), 'Sin que nada pase al inglés');
await r.screenshot({ path: join(CAPTURAS, 'completa.png') });
await r.close();
rmSync(ruta, { force: true });

if (lenguaInicial !== 'ja') await ponerAjustes({ idiomaObjetivo: lenguaInicial });
if (errores.length) console.log('Errores de página:', errores.slice(0, 8).join('\n'));
comprobar(!errores.length, 'Ningún error de página', errores.length);
console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien');
await contexto.close();
await mock.cerrar?.();
process.exit(fallos ? 1 : 0);
