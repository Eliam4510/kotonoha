// Prueba la voz local con un motor simulado que habla la API de VOICEVOX: Ajustes lo encuentra y enseña sus voces, «Probar»
// le pide una frase, la lectura en voz alta le manda la frase con el acento del diccionario corregido, la segunda vez sale
// de la caché, y con el motor cerrado se lee con la voz del navegador. El simulado da 橋を plano a propósito; el diccionario
// de acento del perfil base dice que es odaka.
// Uso: KK_SALIDA=.dist-whisper node build.mjs && node pruebas/voz-local.mjs [--real]
// Con --real, además mira el motor de verdad si está abierto (AivisSpeech en 10101) y guarda la imagen de Ajustes.

import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { recargarExtension } from './extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-whisper'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-base'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'voz-local');
mkdirSync(CAPTURAS, { recursive: true });
const REAL = process.argv.includes('--real');

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};

// ---------- El motor simulado ----------

/** Medio segundo de un tono, como el WAV que devuelve el motor. */
function wav() {
  const fs = 24000;
  const n = fs / 2;
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(fs, 24);
  b.writeUInt32LE(fs * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 220 * i) / fs) * 8000), 44 + i * 2);
  return b;
}

const moras = (kana) => Array.from(kana).map((text) => ({ text, consonant: null, consonant_length: 0, vowel: 'a', vowel_length: 0, pitch: 0 }));
const pedidas = [];
const servidor = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  let cuerpo = '';
  for await (const c of req) cuerpo += c;
  pedidas.push({ ruta: url.pathname, texto: url.searchParams.get('text'), cuerpo });
  const json = (v) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(v));
  };
  if (url.pathname === '/version') return json('9.9.9');
  if (url.pathname === '/engine_manifest') return json({ name: 'Motor de prueba' });
  if (url.pathname === '/speakers') return json([{ name: 'Voz de prueba', styles: [{ name: 'Normal', id: 7 }, { name: 'Suave', id: 8 }] }]);
  if (url.pathname === '/audio_query') {
    const texto = url.searchParams.get('text');
    // 橋を, plano a propósito: el diccionario dice odaka (2).
    const frases = texto === '橋を渡ります。' ? [{ moras: moras('ハシオ'), accent: 3 }, { moras: [...moras('ワタリマス'), { text: '.' }], accent: 4 }] : [{ moras: moras('アイウエオ'), accent: 1 }];
    return json({ accent_phrases: frases, speedScale: 1, pitchScale: 0, intonationScale: 1, volumeScale: 1, prePhonemeLength: 0.1, postPhonemeLength: 0.1, outputSamplingRate: 24000, kana: texto });
  }
  if (url.pathname === '/synthesis') {
    res.writeHead(200, { 'content-type': 'audio/wav' });
    return res.end(wav());
  }
  res.writeHead(404);
  res.end();
});
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
const URL_MOTOR = `http://127.0.0.1:${servidor.address().port}`;

// ---------- El navegador ----------

const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1280, height: 860 },
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--autoplay-policy=no-user-gesture-required'],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
const ajustar = (cambios) =>
  sw.evaluate(async (cambios) => {
    const d = await chrome.storage.local.get('ajustes');
    await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), ...cambios } });
  }, cambios);
await ajustar({
  idiomaInterfaz: 'es',
  idiomaObjetivo: 'ja',
  bienvenidaVista: true,
  tema: 'oscuro',
  avisarVersiones: false,
  azureClave: '',
  vozLocal: { activa: false, url: URL_MOTOR, estilo: null, acentoDiccionario: true },
});
const p = await contexto.newPage();
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));

// Ajustes encuentra el motor y enseña sus voces.
await p.goto(`chrome-extension://${id}/app.html#/ajustes`);
await p.locator('#voces').scrollIntoViewIfNeeded();
const seccion = p.locator('#voces');
await seccion.getByText('Motor de prueba 9.9.9').waitFor({ timeout: 10000 }).catch(() => {});
comprobar(await seccion.getByText(`Motor de prueba 9.9.9, en ${URL_MOTOR}`).isVisible(), 'Ajustes encuentra la voz local y dice cuál es');
const opciones = await seccion.getByRole('combobox', { name: 'Voz y estilo' }).locator('option').allInnerTexts();
comprobar(opciones.join(' | ') === 'Voz de prueba · Normal | Voz de prueba · Suave', 'Y enseña sus voces con sus estilos', opciones.join(' | '));
await seccion.getByRole('switch', { name: 'Leer las frases con la voz local' }).click();
await seccion.getByRole('combobox', { name: 'Voz y estilo' }).selectOption('8');
await p.waitForTimeout(500);
const guardados = await sw.evaluate(() => chrome.storage.local.get('ajustes').then((d) => d.ajustes.vozLocal));
comprobar(guardados.activa === true && guardados.estilo === 8, 'Activarla y elegir el estilo se guarda', JSON.stringify(guardados));
/** Espera hasta que el motor simulado reciba la síntesis de `texto` (va en `kana`), y la devuelve. */
async function sintesisDe(texto, ms = 15000) {
  for (const fin = Date.now() + ms; Date.now() < fin; ) {
    const s = pedidas.find((x) => x.ruta === '/synthesis' && JSON.parse(x.cuerpo || '{}').kana === texto);
    if (s) return JSON.parse(s.cuerpo);
    await new Promise((ok) => setTimeout(ok, 150));
  }
  return null;
}

pedidas.length = 0;
await seccion.getByRole('button', { name: 'Probar la voz local' }).click();
for (const fin = Date.now() + 15000; Date.now() < fin && !pedidas.some((x) => x.ruta === '/synthesis'); ) await p.waitForTimeout(150);
comprobar(pedidas.some((x) => x.ruta === '/audio_query') && pedidas.some((x) => x.ruta === '/synthesis'), '«Probar» le pide la frase a la voz local', pedidas.map((x) => x.ruta).join(' '));
await p.waitForTimeout(500);
comprobar(!(await seccion.locator('.texto-error').isVisible().catch(() => false)), 'Sin errores al probarla');
await seccion.screenshot({ path: join(CAPTURAS, '1-ajustes.png') });

// Leer en voz alta: la frase va con el acento del diccionario.
// El Cuaderno añade lo que llega al final de lo que ya hay: se empieza vacío.
await sw.evaluate(() => chrome.storage.local.remove(['lectorTexto', 'notaCuaderno']));
await p.goto(`chrome-extension://${id}/app.html#/lector?t=${encodeURIComponent('橋を渡ります。')}`);
await p.locator('.ap-papel .pal').first().waitFor({ timeout: 30000 });
await p.waitForTimeout(500);
pedidas.length = 0;
await p.locator('.ap-dock').getByRole('button', { name: 'Leer en voz alta' }).click();
const enviada = await sintesisDe('橋を渡ります。');
const acentos = enviada ? enviada.accent_phrases.map((a) => a.accent) : [];
comprobar(acentos.join(',') === '2,4', 'Leer en voz alta manda la frase con 橋を en odaka, como dice el diccionario', acentos.join(',') || 'sin síntesis');
await p.waitForTimeout(1500);
pedidas.length = 0;
const dock = p.locator('.ap-dock');
if (await dock.getByRole('button', { name: 'Detener' }).isVisible()) await dock.getByRole('button', { name: 'Detener' }).click();
await dock.getByRole('button', { name: 'Leer en voz alta' }).click();
await p.waitForTimeout(2500);
comprobar(!pedidas.some((x) => x.ruta === '/synthesis' || x.ruta === '/speakers'), 'La segunda vez sale de la caché, sin preguntar otra vez por el motor ni pedirla', pedidas.map((x) => x.ruta).join(' ') || 'nada');

// La ficha ofrece la voz local para la frase.
if (await dock.getByRole('button', { name: 'Detener' }).isVisible()) await dock.getByRole('button', { name: 'Detener' }).click();
await p.locator('.ap-papel .pal').first().click();
await p.locator('.ap-lectura-ficha .ficha').waitFor({ timeout: 10000 });
await p.locator('.ap-lectura-ficha').getByRole('tab', { name: 'Audio' }).click();
await p.locator('.ap-lectura-ficha .fila-audio').first().waitFor({ timeout: 10000 }).catch(() => {});
const filas = await p.locator('.ap-lectura-ficha .fila-audio').allInnerTexts();
const conVozLocal = await p.locator('.ap-lectura-ficha').getByRole('button', { name: 'Leer la frase con la voz local' }).count();
comprobar(conVozLocal === 1, 'La ficha ofrece leer la frase con la voz local', filas.join(' | ') || 'sin filas');
pedidas.length = 0;
await p.locator('.ap-lectura-ficha').getByRole('button', { name: 'Leer la frase con la voz local' }).click().catch(() => {});
await p.waitForTimeout(1500);
comprobar(!(await p.locator('.ap-lectura-ficha .texto-error').isVisible().catch(() => false)), 'Y la lee sin errores');
await p.keyboard.press('Escape');

// Con el motor cerrado, se lee con la voz del navegador y no hay errores.
await new Promise((ok) => servidor.close(ok));
servidor.closeAllConnections?.();
// El Cuaderno añade lo que llega al final de lo que ya hay: se empieza vacío.
await sw.evaluate(() => chrome.storage.local.remove(['lectorTexto', 'notaCuaderno']));
await p.goto(`chrome-extension://${id}/app.html#/lector?t=${encodeURIComponent('雨が好きです。')}`);
await p.locator('.ap-papel .pal').first().waitFor({ timeout: 30000 });
await p.locator('.ap-dock').getByRole('button', { name: 'Leer en voz alta' }).click();
await p.waitForTimeout(4000);
comprobar(errores.length === 0, 'Con la voz local cerrada se lee igual, sin errores', errores.join(' | '));

// ---------- El motor de verdad, si está abierto ----------

if (REAL) {
  await ajustar({ vozLocal: { activa: true, url: '', estilo: null, acentoDiccionario: true } });
  await p.setViewportSize({ width: 1280, height: 720 });
  await p.goto(`chrome-extension://${id}/app.html#/ajustes`);
  await p.locator('#voces').scrollIntoViewIfNeeded();
  const real = await p.locator('#voces').getByText(/AivisSpeech Engine .* en http:\/\/127\.0\.0\.1:10101/).waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
  comprobar(real, 'Encuentra AivisSpeech en su puerto, sin decirle dónde');
  if (real) {
    await p.locator('#voces').getByRole('button', { name: 'Probar la voz local' }).click();
    await p.waitForTimeout(5000);
    comprobar(!(await p.locator('#voces .texto-error').isVisible().catch(() => false)), 'Y lee el ejemplo sin errores');
    await p.evaluate(() => document.querySelector('#voces')?.scrollIntoView({ block: 'start' }));
    await p.waitForTimeout(600);
    await sharp(await p.screenshot()).png({ palette: true, quality: 92, effort: 10 }).toFile(join(CAPTURAS, '2-ajustes-real.png'));
  }
}

await contexto.close();
console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
