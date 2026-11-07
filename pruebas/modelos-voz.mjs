// Qué modelo transcribe cada cosa, en la tarjeta gráfica y con un archivo propio: en automático, Haas-ja para la voz en japonés,
// Parakeet para la voz en inglés y Whisper Turbo para las canciones. La primera vez descarga cada modelo, de unos 1,3 GB.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/modelos-voz.mjs voz-en-japones.wav [voz-en-ingles.wav]

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';
import { iniciarMock } from './mock-claude.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-local'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'modelos');
const FFMPEG = existsSync('C:/ffmpeg/bin/ffmpeg.exe') ? 'C:/ffmpeg/bin/ffmpeg.exe' : 'ffmpeg';
const [audioJapones, audioIngles] = process.argv.slice(2);
let audio = audioJapones;
if (!audio) {
  console.error('Falta la muestra de voz: node pruebas/modelos-voz.mjs voz.wav');
  process.exit(2);
}
mkdirSync(CAPTURAS, { recursive: true });

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};

const mock = await iniciarMock();
const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1440, height: 900 },
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
const ponerAjustes = (cambios) => sw.evaluate(async (c) => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), ...c } });
}, cambios);
await sw.evaluate(async (url) => { await chrome.storage.local.set({ urlBaseIA: url, claveAnthropic: 'clave-de-prueba' }); }, `http://127.0.0.1:${mock.puerto}`);
await ponerAjustes({ idiomaInterfaz: 'es', bienvenidaVista: true, tema: 'oscuro', navegadorAbierto: false, modo: 'normal', salto: 'no', analisisAutomatico: false, whisperCorregir: false, whisperModelo: 'auto' });

const app = await contexto.newPage();
const errores = [];
app.on('pageerror', (e) => errores.push(e.message));
await app.goto(`chrome-extension://${id}/app.html#/ajustes`);
await app.waitForTimeout(1200);
const selector = app.locator('select[aria-label="Idioma que estudias"]');
const lenguaInicial = await selector.inputValue();
if (lenguaInicial !== 'ja') {
  await selector.selectOption('ja');
  await app.waitForTimeout(800);
}

// El mismo audio en un video con otro nombre cada vez: de uno ya transcrito, la extensión recupera su pista guardada.
let serie = 0;
const videoCon = (nombre) => {
  const ruta = join(CAPTURAS, `${Date.now()}-${serie++} ${nombre}.webm`);
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-stream_loop', '-1', '-i', join(RAIZ, 'pruebas', 'fixtures', 'video.webm'), '-i', audio, '-map', '0:v', '-map', '1:a', '-shortest', '-c:v', 'copy', '-c:a', 'libopus', ruta]);
  return ruta;
};

/** Transcribe un archivo y dice qué modelo aparece trabajando, qué se oyó y si dijo que descargaba. */
async function transcribir(nombre, { letra } = {}) {
  const video = videoCon(nombre);
  const r = await contexto.newPage();
  r.on('pageerror', (e) => errores.push(`reproductor: ${e.message}`));
  await r.goto(`chrome-extension://${id}/app.html#/reproductor`);
  await r.waitForTimeout(1200);
  await r.setInputFiles('input[type="file"]', video);
  await r.waitForFunction(() => document.querySelector('.ap-local video')?.readyState >= 2, undefined, { timeout: 30000 });
  await r.evaluate(() => document.querySelector('.ap-local video').pause());
  await r.waitForTimeout(800);
  await r.evaluate(() => document.querySelector('button[aria-label="Generar subtítulos"], button[data-tip^="Generar subtítulos"], button[title="Generar subtítulos"]')?.click());
  await r.waitForTimeout(500);
  if (letra) await r.locator('textarea[aria-label="Letra de la canción"]').fill(letra);
  let modelo = '';
  let descargando = false;
  const vigia = setInterval(() => r.evaluate(() => document.querySelector('.panel-generar .progreso-linea .ayuda')?.textContent ?? '').then((t) => {
    if (t) modelo = t;
  }).catch(() => {}), 100);
  const vigiaDescarga = setInterval(() => r.evaluate(() => /Descargando/.test(document.body.innerText)).then((si) => { descargando ||= si; }).catch(() => {}), 150);
  const inicio = Date.now();
  await r.locator('.panel-generar button', { hasText: letra ? 'Transcribir y ajustar la letra' : 'Transcribir el archivo' }).click();
  const limite = Date.now() + 600000;
  let acabado = false;
  await r.waitForTimeout(800);
  while (Date.now() < limite && !acabado) {
    await r.waitForTimeout(400);
    acabado = await r.evaluate(() => !document.querySelector('.panel-generar .progreso-linea') && !!document.querySelector('.panel-generar .bloque-generar button'));
  }
  clearInterval(vigia);
  clearInterval(vigiaDescarga);
  await r.waitForTimeout(1500);
  const segundos = Math.round((Date.now() - inicio) / 1000);
  const duracion = await r.evaluate(() => document.querySelector('.ap-local video').duration);
  const vistas = [];
  for (let s = 0.5; s < Math.min(duracion, 26); s += 1) {
    await r.evaluate((s) => { const v = document.querySelector('.ap-local video'); v.pause(); v.currentTime = s; }, s);
    await r.waitForTimeout(220);
    const l = await r.evaluate(() => {
      const e = document.querySelector('.linea-sub.objetivo');
      if (!e) return '';
      const c = e.cloneNode(true);
      c.querySelectorAll('rt, .glosa').forEach((x) => x.remove());
      return c.textContent.replaceAll('\u2060', '').trim();
    });
    if (l && vistas[vistas.length - 1] !== l) vistas.push(l);
  }
  await r.screenshot({ path: join(CAPTURAS, `${nombre}.png`) });
  await r.close();
  rmSync(video, { force: true });
  return { modelo, descargando, segundos, vistas };
}

console.log('== En automático, en japonés ==');
const yaEstaba = await app.evaluate(async () => (await (await caches.open('transformers-cache')).keys()).some((k) => k.url.includes('haas-ja-onnx') && k.url.endsWith('encoder.onnx.data')));
const voz = await transcribir('una charla');
console.log(`  ${voz.segundos} s, ${voz.modelo}${yaEstaba ? '' : ' (la primera vez, con descarga)'}`);
for (const l of voz.vistas) console.log(`    ${l}`);
comprobar(/Haas-ja/.test(voz.modelo), 'La voz hablada la transcribe Haas-ja', voz.modelo);
comprobar(/休みましょう/.test(voz.vistas.join('')), 'Y oye lo que se dice', voz.vistas[0]);
comprobar(voz.vistas.some((l) => /[。、]/.test(l)), 'Con puntuación');
comprobar(voz.vistas.every((l) => l.length <= 40), 'En líneas que se pueden leer', `la más larga tiene ${Math.max(...voz.vistas.map((l) => l.length))} caracteres`);
comprobar(yaEstaba ? !voz.descargando : voz.descargando, yaEstaba ? 'Sin decir que descarga lo que ya tiene' : 'Avisa de que descarga el modelo la primera vez');

const otraVez = await transcribir('otra charla');
comprobar(!otraVez.descargando, 'La segunda vez no descarga nada');
const guardado = await app.evaluate(async () => {
  const claves = (await (await caches.open('transformers-cache')).keys()).map((k) => k.url);
  return ['tokenizer.model', 'encoder.onnx', 'encoder.onnx.data', 'decoder_joint.onnx', 'decoder_joint.onnx.data'].every((n) => claves.some((u) => u.includes('haas-ja-onnx') && u.endsWith(`/${n}`)));
});
comprobar(guardado, 'Todas sus partes quedan en la caché');

const cancion = await transcribir('Mi canción MV');
comprobar(/Whisper Turbo/.test(cancion.modelo), 'Con un título de canción, Whisper Turbo', cancion.modelo);

const conLetra = await transcribir('sin pistas de que sea música', { letra: '今日はゆっくり休みましょう\n自分のペースで進めば大丈夫です' });
comprobar(/Whisper Turbo/.test(conLetra.modelo), 'Con una letra pegada, también', conLetra.modelo);

console.log('\n== Si se elige a mano ==');
await ponerAjustes({ whisperModelo: 'turbo' });
const aMano = await transcribir('otra charla más');
comprobar(/Whisper Turbo/.test(aMano.modelo), 'Se respeta el modelo elegido', aMano.modelo);
await ponerAjustes({ whisperModelo: 'haas' });
const aManoHaas = await transcribir('una MV en la que se habla');
comprobar(/Haas-ja/.test(aManoHaas.modelo), 'También si no es el que tocaría', aManoHaas.modelo);
await ponerAjustes({ whisperModelo: 'auto' });

if (audioIngles) {
  console.log('\n== En inglés ==');
  audio = audioIngles;
  await selector.selectOption('en');
  await app.waitForTimeout(800);
  await ponerAjustes({ whisperModelo: 'auto' });
  const yaEstabaEn = await app.evaluate(async () => (await (await caches.open('transformers-cache')).keys()).some((k) => k.url.includes('parakeet-tdt-0.6b-v3-onnx') && k.url.endsWith('encoder-model.fp16.onnx')));
  const charla = await transcribir('a talk');
  console.log(`  ${charla.segundos} s, ${charla.modelo}${yaEstabaEn ? '' : ' (la primera vez, con descarga)'}`);
  for (const l of charla.vistas) console.log(`    ${l}`);
  comprobar(/Parakeet/.test(charla.modelo), 'La voz en inglés la transcribe Parakeet', charla.modelo);
  comprobar(/library/i.test(charla.vistas.join(' ')) && /reopened/i.test(charla.vistas.join(' ')), 'Y oye lo que se dice', charla.vistas[0]);
  comprobar(charla.vistas.some((l) => /[.,]/.test(l)), 'Con puntuación');
  comprobar(/[a-z] [a-z]/i.test(charla.vistas[0] ?? ''), 'Las palabras llevan sus espacios');
  comprobar(charla.vistas.every((l) => l.length <= 90), 'En líneas que se pueden leer', `la más larga tiene ${Math.max(...charla.vistas.map((l) => l.length))} caracteres`);
  const cancionEn = await transcribir('My song (Official Video)');
  comprobar(/Whisper Turbo/.test(cancionEn.modelo), 'Una canción en inglés, con Whisper Turbo', cancionEn.modelo);
  await selector.selectOption('ja');
  await app.waitForTimeout(800);
  audio = audioJapones;
}

console.log('\n== En Ajustes ==');
await app.goto(`chrome-extension://${id}/app.html#/ajustes`);
await app.reload();
await app.waitForTimeout(1000);
const tarjetas = () => app.locator('.ap-whisper-modelo b').allTextContents();
comprobar((await tarjetas()).join('|') === 'Automático|Haas-ja|Whisper Turbo|Whisper Turbo ligero|Whisper Base', 'En japonés se ofrecen los suyos y los de Whisper', (await tarjetas()).join(', '));
await app.locator('#transcripcion').scrollIntoViewIfNeeded();
await app.screenshot({ path: join(CAPTURAS, 'ajustes.png') });
comprobar((await app.locator('#transcripcion').innerText()).includes('Haas-ja'), 'Y aparece entre los guardados');
await selector.selectOption('en');
await app.waitForTimeout(800);
comprobar(!(await tarjetas()).includes('Haas-ja'), 'En inglés no se ofrece un modelo de japonés', (await tarjetas()).join(', '));
comprobar((await tarjetas()).includes('Parakeet'), 'Y sí el suyo', (await tarjetas()).join(', '));
await selector.selectOption('ja');
await app.waitForTimeout(500);
if (lenguaInicial !== 'ja') {
  await selector.selectOption(lenguaInicial);
  await app.waitForTimeout(500);
}

comprobar(errores.length === 0, 'Ningún error de página', errores.slice(0, 3).join(' | '));
await contexto.close();
await mock.cerrar?.();
console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
