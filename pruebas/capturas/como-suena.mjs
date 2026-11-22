// La imagen de «Cómo suena» (音声変化) del README japonés, que presenta el inglés: el Cuaderno con lo que dice la NASA en
// «What’s Up: November 2026» (sus subtítulos, de dominio público: ver contenido-real.mjs) y la ficha de want abierta en
// esa pestaña, con la interfaz en japonés.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/capturas/como-suena.mjs

import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { recargarExtension } from '../extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..', '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-readme'));
const IMAGENES = join(RAIZ, 'docs', 'img');
// Lo que dice la NASA, con reducciones, formas débiles y uniones de verdad (want to, find a, take in).
const TEXTO = [
  '# What’s Up: November 2026',
  '',
  'November offers a buffet of opportunities to see a meteor streak across the sky!',
  '',
  'To level up your viewing experience, you will want to find a dark location, give your eyes about half an hour to adjust, and take in as much sky as you can.',
].join('\n');

if (!existsSync(PERFIL) && existsSync(join(RAIZ, '.perfil-base', 'Default/IndexedDB'))) {
  cpSync(join(RAIZ, '.perfil-base', 'Default/IndexedDB'), join(PERFIL, 'Default/IndexedDB'), { recursive: true });
}
mkdirSync(IMAGENES, { recursive: true });
const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1440, height: 900 },
  args: ['--mute-audio', `--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
const previo = await sw.evaluate(async () => chrome.storage.local.get(['ajustes', 'lectorTexto', 'notaCuaderno']));
await sw.evaluate(async (texto) => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ lectorTexto: texto, ajustes: { ...(d.ajustes ?? {}), idiomaInterfaz: 'ja', idiomaObjetivo: 'en', bienvenidaVista: true, tema: 'oscuro', avisarVersiones: false, furigana: 'ninguna', lectorFurigana: 'ninguna' } });
  await chrome.storage.local.remove('notaCuaderno');
}, TEXTO);

const p = await contexto.newPage();
await p.goto(`chrome-extension://${id}/app.html#/lector`);
await p.locator('.ap-papel .pal').first().waitFor({ timeout: 60000 });
await p.waitForTimeout(1500);
await p.locator('.ap-papel .pal', { hasText: 'want' }).first().click();
const pestana = p.locator('.ficha [role="tab"]', { hasText: '音声変化' });
await pestana.waitFor({ timeout: 15000 });
await pestana.click();
await p.locator('.como-suena-frase ruby').first().waitFor({ timeout: 5000 });
// Abrir la pestaña desplaza la página: se vuelve arriba para que se vea la cabecera del Cuaderno.
await p.evaluate(() => {
  for (const el of [document.scrollingElement, document.querySelector('.ap-principal'), document.querySelector('.ap-lienzo')]) el?.scrollTo(0, 0);
});
await p.mouse.move(5, 5);
await p.waitForTimeout(1200);
const archivo = join(IMAGENES, 'como-suena.ja.png');
await sharp(await p.screenshot()).png({ palette: true, quality: 92, effort: 10 }).toFile(archivo);
console.log('imagen:', archivo.slice(RAIZ.length + 1));

await sw.evaluate(async (previo) => {
  await chrome.storage.local.set({ ajustes: previo.ajustes, lectorTexto: previo.lectorTexto ?? '' });
  if (previo.notaCuaderno) await chrome.storage.local.set({ notaCuaderno: previo.notaCuaderno });
}, previo);
await contexto.close();
process.exit(0);
