// La imagen de la página de un hanzi para la sección del chino de los seis README: 河, con su pinyin, su radical 氵 con
// su nombre de clase (三点水), sus piezas, la que le da el sonido (可) y el orden de sus trazos, ya dibujados.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/capturas/hanzi.mjs [es en de zh ko ja]
// Usa .perfil-chino, que tiene CC-CEDICT y el diccionario de hanzi (los instala pruebas/chino.mjs), y deja sus ajustes
// como estaban. Los trazos de cada hanzi los baja Hanzi Writer la primera vez.

import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { recargarExtension } from '../extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..', '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-chino'));
const IMAGENES = join(RAIZ, 'docs', 'img');
const IDIOMAS = process.argv.slice(2).length ? process.argv.slice(2) : ['es', 'en', 'de', 'zh', 'ko', 'ja'];
const HANZI = '河';

const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1600, height: 1000 },
  args: ['--mute-audio', `--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
const previo = await sw.evaluate(() => chrome.storage.local.get('ajustes'));
const p = await contexto.newPage();
// Con menos movimiento, los trazos salen ya dibujados, con sus números: el hanzi entero en la imagen.
await p.emulateMedia({ reducedMotion: 'reduce' });
try {
  for (const idioma of IDIOMAS) {
    await sw.evaluate(async (idioma) => {
      const d = await chrome.storage.local.get('ajustes');
      await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), idiomaInterfaz: idioma, idiomaObjetivo: 'zh', idiomaSecundario: idioma, bienvenidaVista: true, tema: 'oscuro', avisarVersiones: false } });
    }, idioma);
    await p.goto(`chrome-extension://${id}/app.html#/diccionario?q=${encodeURIComponent(HANZI)}`);
    await p.reload();
    await p.locator('.dic-caracter .dic-lecturas').waitFor({ timeout: 30000 });
    await p.locator('.dic-pieza').first().waitFor({ timeout: 30000 }).catch(() => {});
    await p.locator('.dic-caracter-trazos svg path').first().waitFor({ timeout: 30000 }).catch(() => {});
    await p.locator('.dic-caracter .dic-tarjeta').first().waitFor({ timeout: 60000 }).catch(() => {});
    await p.mouse.move(5, 5);
    await p.waitForTimeout(1500);
    const archivo = join(IMAGENES, idioma === 'es' ? 'hanzi.png' : `hanzi.${idioma}.png`);
    await sharp(await p.screenshot()).png({ palette: true, quality: 92, effort: 10 }).toFile(archivo);
    console.log(`  imagen: ${archivo.slice(RAIZ.length + 1)}`);
  }
} finally {
  await sw.evaluate(async (d) => chrome.storage.local.set(d), previo);
  await contexto.close();
}
