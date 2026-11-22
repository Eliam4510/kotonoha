// Prueba el ritmo de la voz local en el uso real: un video propio que se transcribe más despacio de lo que se ve (con la
// ocupación de la gráfica forzada al mínimo), el aviso de que la transcripción no llega, «Esperar a la transcripción»,
// que pausa el video y lo reanuda solo en cuanto vuelve a ir por delante, y lo medido, que se guarda para «Tu equipo»,
// donde la tarjeta de la voz dice que sale de usarlo.
// Uso: KK_SALIDA=.dist-whisper node build.mjs && node pruebas/ritmo.mjs ruta/voz-ja.wav
// La voz se repite hasta formar un video de casi tres minutos. Transcribe con Haas-ja, guardado en .perfil-whisper.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { iniciarMock } from './mock-claude.mjs';
import { olvidarReproductor, recargarExtension } from './extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-whisper'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-whisper'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'ritmo');
const FFMPEG = existsSync('C:/ffmpeg/bin/ffmpeg.exe') ? 'C:/ffmpeg/bin/ffmpeg.exe' : 'ffmpeg';
const VOZ = process.argv[2];
if (!VOZ || !existsSync(VOZ)) {
  console.log('Falta la grabación con voz en japonés: node pruebas/ritmo.mjs ruta/voz-ja.wav');
  process.exit(1);
}
mkdirSync(CAPTURAS, { recursive: true });

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};

// Un video de 160 s: la imagen de siempre y la voz, una vez tras otra, para que haya varios trozos que transcribir.
const VIDEO = join(CAPTURAS, 'largo.webm');
execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-stream_loop', '-1', '-i', join(RAIZ, 'pruebas', 'fixtures', 'video.webm'), '-stream_loop', '-1', '-i', VOZ, '-map', '0:v', '-map', '1:a', '-t', '160', '-c:v', 'copy', '-c:a', 'libopus', VIDEO]);

const mock = await iniciarMock();
const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1280, height: 800 },
  args: ['--mute-audio', `--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
for (const pg of contexto.pages()) if (pg.url().includes('app.html')) await pg.close();
// Los ganchos de prueba del motor solo existen con la dirección de la IA de pruebas. Sin corrección ni análisis al
// terminar: lo que se prueba es la transcripción.
await sw.evaluate(async (url) => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({
    urlBaseIA: url,
    claveAnthropic: 'clave-de-prueba',
    ajustes: {
      ...(d.ajustes ?? {}),
      idiomaInterfaz: 'es',
      idiomaObjetivo: 'ja',
      bienvenidaVista: true,
      avisoEquipoVisto: true,
      whisperModelo: 'auto',
      whisperIntensidad: 'auto',
      whisperCorregir: false,
      analisisAutomatico: false,
      equipoUso: {},
      destino: 'memoria',
      ankiPuerto: 1,
    },
  });
}, `http://127.0.0.1:${mock.puerto}`);
const leerAjustes = () => sw.evaluate(async () => (await chrome.storage.local.get('ajustes')).ajustes ?? {});

const errores = [];
const r = await contexto.newPage();
r.on('pageerror', (e) => errores.push(e.message));
await r.goto(`chrome-extension://${id}/app.html#/reproductor`);
await olvidarReproductor(r);
await r.waitForTimeout(1200);
const motor = (metodo, ...args) =>
  r.evaluate(({ metodo, args }) => chrome.runtime.sendMessage({ canal: 'motor', metodo, args }), { metodo, args }).then((x) => {
    if (!x?.ok) throw new Error(x?.error ?? 'sin respuesta');
    return x.valor;
  });
// Una pasada anterior dejaría ya transcrito este archivo, y se seguiría desde donde iba.
await r.evaluate(
  () =>
    new Promise((ok) => {
      const abrir = indexedDB.open('kikitori');
      abrir.onsuccess = () => {
        const t = abrir.result.transaction(['generados'], 'readwrite');
        t.objectStore('generados').clear();
        t.oncomplete = () => ok();
      };
    })
);
const avisos = () => r.evaluate(() => [...document.querySelectorAll('.aviso')].map((a) => a.textContent?.trim() ?? ''));

await r.setInputFiles('input[type="file"]', VIDEO);
await r.waitForFunction(() => document.querySelector('.ap-local video')?.readyState >= 2, undefined, { timeout: 20000 });
await r.evaluate(() => document.querySelector('.ap-local video').pause());
// Tras cada trozo, descansa doscientas veces lo que tardó (hasta un minuto): así transcribe más despacio que el video.
await motor('whisperOcupacionPrueba', 0.005);

// ---------- Más despacio que el video ----------

console.log('\n== Más despacio que el video ==');
await r.evaluate(() => document.querySelector('button[aria-label="Generar subtítulos"], button[data-tip^="Generar subtítulos"], button[title="Generar subtítulos"]')?.click());
await r.waitForTimeout(500);
await r.locator('.panel-generar button', { hasText: 'Transcribir el archivo' }).click();
// En cuanto empieza a transcribir, se ve desde el principio.
const empezo = await r
  .waitForFunction(() => /Transcribiendo/.test(document.body.innerText), undefined, { timeout: 120000, polling: 200 })
  .then(() => true)
  .catch(() => false);
comprobar(empezo, 'Empieza a transcribir el video');
const t0 = Date.now();
await r.evaluate(() => {
  const v = document.querySelector('.ap-local video');
  v.currentTime = 0;
  return v.play();
});
const noLlega = await r
  .waitForFunction(() => [...document.querySelectorAll('.aviso')].some((a) => /más despacio que el video/.test(a.textContent ?? '')), undefined, { timeout: 90000, polling: 250 })
  .then(() => true)
  .catch(() => false);
console.log(`   a los ${Math.round((Date.now() - t0) / 1000)} s de verlo`);
comprobar(noLlega, 'Cuando lo que se ve alcanza a lo transcrito, dice que la transcripción va más despacio que el video', JSON.stringify(await avisos()));
comprobar((await avisos()).some((t) => /Whisper Base/.test(t)), 'Y propone Whisper Base, que va más rápido');
await r.screenshot({ path: join(CAPTURAS, 'no-llega.png') });

// ---------- Esperar a la transcripción ----------

console.log('\n== Esperar a la transcripción ==');
await r.locator('.aviso .btn', { hasText: 'Esperar a la transcripción' }).click();
await r.waitForTimeout(400);
const esperando = await r.evaluate(() => ({ pausado: document.querySelector('.ap-local video').paused, avisos: [...document.querySelectorAll('.aviso')].map((a) => a.textContent ?? '') }));
comprobar(
  esperando.pausado && esperando.avisos.some((t) => /Esperando a la transcripción/.test(t)) && !esperando.avisos.some((t) => /más despacio/.test(t)),
  '«Esperar a la transcripción» pausa el video y lo dice, en lugar del aviso',
  JSON.stringify(esperando.avisos)
);
await r.screenshot({ path: join(CAPTURAS, 'esperando.png') });
// Vuelve a su ritmo: en cuanto acabe el descanso en curso, va por delante del video en poco tiempo.
await motor('whisperOcupacionPrueba', null);
const t1 = Date.now();
const sigue = await r
  .waitForFunction(() => !document.querySelector('.ap-local video').paused, undefined, { timeout: 150000, polling: 500 })
  .then(() => true)
  .catch(() => false);
const tras = await r.evaluate(() => ({ visto: Math.round(document.querySelector('.ap-local video').currentTime), avisos: [...document.querySelectorAll('.aviso')].map((a) => a.textContent ?? '') }));
console.log(`   siguió a los ${Math.round((Date.now() - t1) / 1000)} s: ${JSON.stringify(tras)}`);
comprobar(sigue && !tras.avisos.some((t) => /Esperando/.test(t)), 'Y el video sigue solo en cuanto la transcripción va por delante');

// ---------- Lo medido ----------

console.log('\n== Lo medido, en «Tu equipo» ==');
const lista = await r
  .waitForFunction(() => [...document.querySelectorAll('.aviso')].some((a) => /Transcripción lista/.test(a.textContent ?? '')), undefined, { timeout: 180000, polling: 300 })
  .then(() => true)
  .catch(() => false);
comprobar(lista, 'La transcripción termina');
await r.waitForTimeout(1500);
const uso = (await leerAjustes()).equipoUso;
console.log('  ', JSON.stringify(uso));
comprobar(uso?.voz?.haas?.velocidad > 1 && uso.voz.haas.dispositivo === 'webgpu', 'Se guarda a cuántas veces el tiempo real calcula este equipo con Haas-ja, en la gráfica', JSON.stringify(uso?.voz));
const app = await contexto.newPage();
app.on('pageerror', (e) => errores.push(e.message));
await app.goto(`chrome-extension://${id}/app.html#/ajustes?seccion=equipo`);
await app.waitForSelector('#equipo .ap-equipo-pieza[data-pieza="voz"] .ap-equipo-tiempo', { timeout: 20000 });
const voz = await app.evaluate(() => document.querySelector('#equipo .ap-equipo-pieza[data-pieza="voz"]')?.textContent ?? '');
comprobar(/medido al usarlo/.test(voz), 'En «Tu equipo», la voz dice cuánto tarda aquí, medido al usarlo', voz.slice(0, 160));
await app.screenshot({ path: join(CAPTURAS, 'tu-equipo.png') });

if (errores.length) console.log('\nErrores en la página:', [...new Set(errores)].slice(0, 6));
comprobar(errores.length === 0, 'Sin errores en las páginas');
console.log(`\n${fallos ? `${fallos} comprobaciones fallaron` : 'Todas las comprobaciones pasaron'}`);
await contexto.close();
mock.servidor.close();
process.exit(fallos ? 1 : 0);
