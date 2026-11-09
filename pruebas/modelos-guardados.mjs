// La lista de modelos guardados en Ajustes: lo que dice que ocupa cada uno y lo que se borra de verdad al pulsar. La caché se
// llena con archivos diminutos que declaran el tamaño de los reales, así que no descarga nada ni usa la tarjeta gráfica.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/modelos-guardados.mjs

import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = mkdtempSync(join(tmpdir(), 'kk-modelos-'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'modelos');
mkdirSync(CAPTURAS, { recursive: true });

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};

const HF = 'https://huggingface.co/onnx-community';
const TURBO = `${HF}/whisper-large-v3-turbo/resolve/main`;
const MB = 1e6;
const ARCHIVOS = [
  [`${TURBO}/config.json`, 2000],
  [`${TURBO}/tokenizer.json`, 3 * MB],
  [`${TURBO}/onnx/encoder_model_fp16.onnx`, 1275 * MB],
  [`${TURBO}/onnx/encoder_model_q4f16.onnx`, 379 * MB],
  [`${TURBO}/onnx/decoder_model_merged_q4f16.onnx`, 190 * MB],
  // Un modelo que ya no se ofrece, o que se quedó a medias.
  [`${HF}/whisper-large-v3/resolve/main/onnx/encoder_model_fp16.onnx`, 800 * MB],
];

const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1280, height: 900 },
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
await sw.evaluate(async () => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), idiomaInterfaz: 'es', bienvenidaVista: true, tema: 'oscuro' } });
});

const p = await contexto.newPage();
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));
await p.goto(`chrome-extension://${id}/app.html#/ajustes`);
await p.waitForTimeout(800);

const sinModelos = await p.locator('#transcripcion').innerText();
comprobar(!sinModelos.includes('Modelos guardados'), 'Sin nada guardado, no hay lista');

await p.evaluate(async (archivos) => {
  const cache = await caches.open('transformers-cache');
  for (const [url, bytes] of archivos) await cache.put(url, new Response('x', { headers: { 'content-length': String(bytes) } }));
}, ARCHIVOS);

const abrir = async () => {
  await p.reload();
  await p.waitForTimeout(900);
  await p.locator('#transcripcion').scrollIntoViewIfNeeded();
};
const filas = () => p.locator('#transcripcion .ap-grupo').last().locator('.ap-opcion').evaluateAll((l) => l.map((x) => x.innerText.replace(/\s+/g, ' ').trim()));
const quedan = () => p.evaluate(async () => (await (await caches.open('transformers-cache')).keys()).map((k) => k.url.replace(/^.*onnx-community\//, '').replace('/resolve/main', '').replace('/onnx/', '/')).sort());
const TURBO_16 = 'whisper-large-v3-turbo/encoder_model_fp16.onnx';
const tarjeta = (nombre) => p.locator('.ap-whisper-modelo', { hasText: nombre }).first().innerText();

await abrir();
const texto = await p.locator('#transcripcion').innerText();
comprobar(texto.includes('Modelos guardados'), 'Con modelos, aparece la lista');
comprobar(/En total ocupan 2,6 GB/.test(texto), 'Dice lo que ocupan en total, sin contar dos veces lo compartido', texto.match(/En total ocupan [^.]*/)?.[0]);
let lista = await filas();
comprobar(lista.length === 3, 'Una fila por modelo, y una para lo que sobra', lista.join(' | '));
comprobar(lista.some((f) => f.includes('Whisper Turbo') && !f.includes('ligero') && f.includes('1,5 GB')), 'Whisper Turbo, con su tamaño');
comprobar(lista.some((f) => f.includes('Whisper Turbo ligero') && f.includes('572 MB')), 'Whisper Turbo ligero, con el suyo');
comprobar(lista.some((f) => f.includes('Archivos sueltos') && f.includes('800 MB')), 'Lo que no es de ningún modelo también se ve');
comprobar((await tarjeta('Whisper Turbo ligero')).includes('Descargado'), 'La tarjeta del modelo sigue diciendo que está descargado');
comprobar((await tarjeta('Whisper Base')).includes('165 MB'), 'Y la de uno sin bajar, lo que pesa la descarga');
await p.locator('#transcripcion .ap-grupo').last().scrollIntoViewIfNeeded();
await p.screenshot({ path: join(CAPTURAS, 'lista.png') });

// Turbo y Turbo ligero comparten decodificador, configuración y tokenizador.
await p.locator('button[aria-label="Borrar: Whisper Turbo"]').click();
await p.waitForTimeout(500);
let archivos = await quedan();
comprobar(!archivos.includes(TURBO_16), 'Borrar Turbo quita su codificador', archivos.join(' '));
comprobar(['decoder_model_merged_q4f16.onnx', 'encoder_model_q4f16.onnx', 'config.json', 'tokenizer.json'].every((a) => archivos.includes(`whisper-large-v3-turbo/${a}`)), 'Y deja intacto lo que usa Turbo ligero', archivos.join(' '));
comprobar(archivos.includes('whisper-large-v3/encoder_model_fp16.onnx'), 'Ni lo de otro repositorio con un archivo del mismo nombre');
lista = await filas();
comprobar(!lista.some((f) => f.includes('Whisper Turbo') && !f.includes('ligero')), 'Ya no aparece en la lista', lista.join(' | '));

await p.locator('button[aria-label="Borrar: Archivos sueltos"]').click();
await p.waitForTimeout(500);
archivos = await quedan();
comprobar(!archivos.includes('whisper-large-v3/encoder_model_fp16.onnx'), 'Los archivos sueltos se pueden quitar', archivos.join(' '));
lista = await filas();
comprobar(lista.length === 1 && lista[0].includes('Whisper Turbo ligero'), 'Sin tocar el modelo que queda', lista.join(' | '));
comprobar(!(await p.locator('#transcripcion').innerText()).includes('En total ocupan'), 'Con uno solo, el total sobra');

// El último de un repositorio se lleva lo común.
await p.locator('button[aria-label="Borrar: Whisper Turbo ligero"]').click();
await p.waitForTimeout(500);
comprobar((await quedan()).length === 0, 'Al borrar el último no queda nada', (await quedan()).join(' '));
comprobar(!(await p.locator('#transcripcion').innerText()).includes('Modelos guardados'), 'Y la lista desaparece');
comprobar((await tarjeta('Whisper Turbo ligero')).includes('MB'), 'La tarjeta vuelve a ofrecer la descarga');

// narabas, el modelo de las moras de la práctica, va en su propia caché: también se lista y se borra.
await p.evaluate(async () => {
  const cache = await caches.open('kotonoha-modelo-moras');
  await cache.put('https://github.com/darashi/narabas-models/releases/download/v0/narabas-v0.onnx', new Response('x', { headers: { 'content-length': '1262530407' } }));
});
await abrir();
lista = await filas();
comprobar(lista.length === 1 && lista[0].includes('narabas, para las moras de la práctica del acento') && lista[0].includes('1,3 GB'), 'El modelo de las moras de la práctica, con su tamaño', lista.join(' | '));
comprobar(!(await p.locator('#transcripcion').innerText()).includes('Archivos sueltos'), 'Sin tomarlo por un resto de otro modelo');
await p.locator('button[aria-label="Borrar: narabas"]').click();
await p.waitForTimeout(500);
comprobar(!(await p.evaluate(() => caches.has('kotonoha-modelo-moras'))), 'Borrarlo quita su caché');
comprobar(!(await p.locator('#transcripcion').innerText()).includes('Modelos guardados'), 'Y la lista vuelve a desaparecer');

// Otro idioma de la interfaz.
await sw.evaluate(async () => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ ajustes: { ...d.ajustes, idiomaInterfaz: 'en' } });
});
await p.evaluate(async ([url, bytes]) => {
  const cache = await caches.open('transformers-cache');
  await cache.put(url, new Response('x', { headers: { 'content-length': String(bytes) } }));
}, ARCHIVOS[5]);
await abrir();
const enIngles = await p.locator('#transcripcion').innerText();
comprobar(enIngles.includes('Saved models') && enIngles.includes('Leftover files'), 'También en otros idiomas');

comprobar(errores.length === 0, 'Ningún error de página', errores.slice(0, 3).join(' | '));
await contexto.close();
rmSync(PERFIL, { recursive: true, force: true });
console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
