// La imagen de la pantalla JLPT del README en cada idioma de la interfaz que estudia japonés (en el README japonés se
// estudia inglés, que no tiene listas por nivel). Para que se vea el avance, marca como conocidas o en aprendizaje unas
// cuantas palabras de N5, N4 y N3, y al terminar las devuelve a «Desconocida». Solo lo hace si esos niveles empiezan sin
// ninguna marcada, para no deshacer nada de nadie.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/capturas/niveles.mjs [es en de zh ko]

import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { recargarExtension } from '../extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..', '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-local'));
const IMAGENES = join(RAIZ, 'docs', 'img');
const IDIOMAS = process.argv.slice(2).length ? process.argv.slice(2) : ['es', 'en', 'de', 'zh', 'ko'];
/** Cuántas palabras se marcan en cada nivel: conocidas y en aprendizaje. */
const SEMILLA = { N5: [470, 90], N4: [210, 70], N3: [160, 120] };

if (!existsSync(PERFIL) && existsSync(join(RAIZ, '.perfil-base', 'Default/IndexedDB'))) {
  cpSync(join(RAIZ, '.perfil-base', 'Default/IndexedDB'), join(PERFIL, 'Default/IndexedDB'), { recursive: true });
}
mkdirSync(IMAGENES, { recursive: true });
const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1440, height: 900 },
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
const previo = await sw.evaluate(async () => chrome.storage.local.get(['ajustes']));
const fijar = (idioma) =>
  sw.evaluate(async (idioma) => {
    const d = await chrome.storage.local.get('ajustes');
    await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), idiomaInterfaz: idioma, idiomaObjetivo: 'ja', bienvenidaVista: true, tema: 'oscuro', avisarVersiones: false, nivel: 'JLPT N4' } });
  }, idioma);

await fijar('es');
const p = await contexto.newPage();
await p.goto(`chrome-extension://${id}/app.html#/niveles`);
await p.evaluate(() => {
  localStorage.removeItem('kk-nivelLista:ja');
  localStorage.removeItem('kk-pestanaNiveles');
});
await p.reload();
await p.locator('.ap-fila-palabra').first().waitFor({ timeout: 30000 });

const tarjeta = (n) => p.locator('.ap-nivel-examen', { hasText: n });
const contar = async (n) => Number((await tarjeta(n).locator('dd').first().textContent()).split('/')[0].replace(/\D/g, ''));
const elegirNivel = async (n) => {
  await tarjeta(n).click();
  await p.waitForFunction((n) => document.querySelector('.ap-nivel-examen.activo b')?.textContent === n, n);
  await p.locator('.ap-fila-palabra').first().waitFor();
};
/** Elige las palabras de la lista de la posición `desde` a `hasta` y les da un estado. */
async function marcar(desde, hasta, estado) {
  while (await p.getByRole('button', { name: /Ver más/ }).isVisible()) await p.getByRole('button', { name: /Ver más/ }).click();
  await p.evaluate(({ desde, hasta }) => {
    [...document.querySelectorAll('.ap-fila-palabra .ap-casilla')].slice(desde, hasta).forEach((c) => c.click());
  }, { desde, hasta });
  await p.waitForTimeout(400);
  console.log(`  ${estado}: ${await p.locator('.ap-seleccion b').textContent().catch(() => 'nada elegido')}`);
  await p.locator('.ap-seleccion').getByRole('button', { name: estado, exact: true }).click();
  await p.waitForTimeout(900);
}

let sembrado = false;
const vacios = await Promise.all(Object.keys(SEMILLA).map(contar));
if (vacios.every((n) => n === 0)) {
  for (const [nivel, [conocidas, aprendiendo]] of Object.entries(SEMILLA)) {
    await elegirNivel(nivel);
    await marcar(0, conocidas, 'Conocida');
    await marcar(conocidas, conocidas + aprendiendo, 'Aprendiendo');
  }
  sembrado = true;
} else {
  console.log('Hay palabras marcadas en esos niveles: la imagen sale con ellas, sin sembrar nada.');
}

for (const idioma of IDIOMAS) {
  await fijar(idioma);
  await p.evaluate(() => localStorage.setItem('kk-nivelLista:ja', JSON.stringify('N4')));
  await p.reload();
  await p.locator('.ap-fila-palabra').first().waitFor({ timeout: 30000 });
  await p.waitForTimeout(1200);
  const archivo = join(IMAGENES, idioma === 'es' ? 'niveles.png' : `niveles.${idioma}.png`);
  await sharp(await p.screenshot()).png({ palette: true, quality: 92, effort: 10 }).toFile(archivo);
  console.log('imagen:', archivo.slice(RAIZ.length + 1));
}

// Como estaba.
if (sembrado) {
  await fijar('es');
  await p.reload();
  await p.locator('.ap-fila-palabra').first().waitFor({ timeout: 30000 });
  for (const nivel of Object.keys(SEMILLA)) {
    await elegirNivel(nivel);
    for (const filtro of ['Conocidas', 'Aprendiendo']) {
      await p.locator('.ap-niveles-filtros [role="radio"]', { hasText: filtro }).click();
      await p.waitForTimeout(300);
      if (!(await p.locator('.ap-fila-palabra').count())) continue;
      while (await p.getByRole('button', { name: /Ver más/ }).isVisible()) await p.getByRole('button', { name: /Ver más/ }).click();
      await p.getByRole('button', { name: /Elegir las \d+ de la lista/ }).click();
      await p.locator('.ap-seleccion').getByRole('button', { name: 'Desconocida', exact: true }).click();
      await p.waitForTimeout(900);
    }
    await p.locator('.ap-niveles-filtros [role="radio"]', { hasText: 'Todas' }).click();
  }
  const quedan = await Promise.all(Object.keys(SEMILLA).map(contar));
  console.log('devueltas a «Desconocida»; conocidas que quedan:', quedan.join(', '));
}
await p.evaluate(() => {
  localStorage.removeItem('kk-nivelLista:ja');
  localStorage.removeItem('kk-pestanaNiveles');
});
await sw.evaluate(async (previo) => chrome.storage.local.set({ ajustes: previo.ajustes }), previo);
await contexto.close();
process.exit(0);
