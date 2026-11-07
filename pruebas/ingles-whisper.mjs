// Whisper en inglés, en la tarjeta gráfica y con un archivo propio: que oiga inglés, que parta bien las líneas y que Claude
// corrija el resultado con el prompt del inglés. Whisper necesita voz: con un tono avisa de que no oyó nada.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/ingles-whisper.mjs ruta/voz-en-ingles.wav

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';
import { iniciarMock } from './mock-claude.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-local'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'ingles');
const FFMPEG = existsSync('C:/ffmpeg/bin/ffmpeg.exe') ? 'C:/ffmpeg/bin/ffmpeg.exe' : 'ffmpeg';
const audio = process.argv[2];
if (!audio) {
  console.error('Falta la muestra de voz: node pruebas/ingles-whisper.mjs voz.wav');
  process.exit(2);
}
mkdirSync(CAPTURAS, { recursive: true });

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};

// Un video sin subtítulos y con la voz como única pista de audio. Con otro nombre cada vez: de uno ya transcrito, la
// extensión recupera su pista guardada, y aquí se quiere ver transcribir.
const video = join(CAPTURAS, `voz-${Date.now()}.webm`);
execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-stream_loop', '-1', '-i', join(RAIZ, 'pruebas', 'fixtures', 'video.webm'), '-i', audio, '-map', '0:v', '-map', '1:a', '-shortest', '-c:v', 'copy', '-c:a', 'libopus', video]);

const mock = await iniciarMock();
const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1440, height: 900 },
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
await sw.evaluate(async (url) => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ urlBaseIA: url, claveAnthropic: 'clave-de-prueba', ajustes: { ...(d.ajustes ?? {}), idiomaInterfaz: 'es', bienvenidaVista: true, tema: 'oscuro', navegadorAbierto: false, modo: 'normal', salto: 'no', analisisAutomatico: false, whisperModelo: 'turbo', whisperCorregir: true } });
}, `http://127.0.0.1:${mock.puerto}`);

const p = await contexto.newPage();
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));
await p.goto(`chrome-extension://${id}/app.html#/ajustes`);
await p.waitForTimeout(1200);
const selector = p.locator('select[aria-label="Idioma que estudias"]');
const antes = await selector.inputValue();
await selector.selectOption('en');
await p.waitForTimeout(800);
comprobar((await sw.evaluate(async () => (await chrome.storage.local.get('ajustes')).ajustes.idiomaObjetivo)) === 'en', 'Se estudia inglés');

await p.goto(`chrome-extension://${id}/app.html#/reproductor`);
await p.waitForTimeout(1200);
await p.setInputFiles('input[type="file"]', video);
await p.waitForFunction(() => document.querySelector('.ap-local video')?.readyState >= 2, undefined, { timeout: 20000 });
await p.evaluate(() => document.querySelector('.ap-local video').pause());
await p.waitForTimeout(800);

await p.evaluate(() => {
  const b = document.querySelector('button[aria-label="Generar subtítulos"], button[data-tip^="Generar subtítulos"], button[title="Generar subtítulos"]');
  b?.click();
});
await p.waitForTimeout(500);
const inicio = Date.now();
const boton = await p.evaluateHandle(() => [...document.querySelectorAll('.panel-flotante button')].find((b) => b.textContent.trim() === 'Transcribir el archivo'));
comprobar(!!boton.asElement(), 'El panel ofrece transcribir con Whisper');
await boton.asElement()?.click();

const hasta = (fn, ms) => new Promise((listo) => {
  const limite = Date.now() + ms;
  const mirar = async () => {
    if (await fn()) return listo(true);
    if (Date.now() > limite) return listo(false);
    setTimeout(mirar, 500);
  };
  mirar();
});
const lineas = () => p.evaluate(() => {
  const v = document.querySelector('.ap-local video');
  return { actual: document.querySelector('.linea-sub.objetivo')?.textContent ?? '', t: v.currentTime, duracion: v.duration };
});
const pistaLista = await hasta(async () => {
  await p.evaluate(() => {
    const v = document.querySelector('.ap-local video');
    v.currentTime = 3;
  });
  await p.waitForTimeout(300);
  return /[a-z]{3}/i.test((await lineas()).actual);
}, 420000);
comprobar(pistaLista, 'Whisper genera la pista desde el audio');
console.log(`  primera línea a los ${Math.round((Date.now() - inicio) / 1000)} s`);

// La transcripción entera, leída línea a línea según avanza el video.
const { duracion } = await lineas();
await p.waitForTimeout(25000);
const vistas = [];
for (let t = 0.5; t < duracion; t += 1.5) {
  await p.evaluate((t) => {
    document.querySelector('.ap-local video').currentTime = t;
  }, t);
  await p.waitForTimeout(250);
  const { actual } = await lineas();
  if (actual && vistas[vistas.length - 1] !== actual) vistas.push(actual);
}
const todo = vistas.join(' ');
console.log('  líneas:');
for (const l of vistas) console.log(`    ${l}`);
comprobar(/library/i.test(todo) && /reopened|re-opened/i.test(todo), 'Oye lo que se dice en inglés');
comprobar(/[a-z] [a-z]/i.test(vistas[0] ?? ''), 'Las palabras llevan sus espacios');
comprobar(!/[\u3040-\u30ff\u3400-\u9fff]/.test(todo), 'Ni rastro de japonés');
comprobar(vistas.every((l) => l.length <= 90), 'Las líneas se pueden leer', `la más larga tiene ${Math.max(...vistas.map((l) => l.length))} caracteres`);
const palabras = await p.evaluate(() => document.querySelectorAll('.linea-sub.objetivo .pal').length);
comprobar(palabras > 0, 'Se analizan como cualquier subtítulo', palabras);
const corregida = await hasta(() => mock.peticiones.some((x) => JSON.stringify(x.cuerpo.system ?? '').includes('subtítulos al inglés') || /Corriges subtítulos[^"]*ingl/.test(JSON.stringify(x.cuerpo.system ?? ''))), 60000);
comprobar(corregida, 'Claude corrige el resultado con el prompt del inglés', mock.peticiones.map((x) => JSON.stringify(x.cuerpo.system ?? '').slice(0, 60)).slice(0, 2).join(' | '));
await p.screenshot({ path: join(CAPTURAS, 'whisper.png') });
comprobar(errores.length === 0, 'Ningún error de página', errores.slice(0, 3).join(' | '));
rmSync(video, { force: true });

// Se deja el perfil como estaba.
await p.goto(`chrome-extension://${id}/app.html#/ajustes`);
await p.waitForTimeout(1000);
await p.locator('select[aria-label="Idioma que estudias"]').selectOption(antes);
await p.waitForTimeout(600);
await contexto.close();
await mock.cerrar?.();
console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
