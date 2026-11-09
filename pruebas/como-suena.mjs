// Prueba «Cómo suena» en la ficha de una palabra inglesa: la frase con su forma hablada encima (gonna, meechu, ge‿dit…)
// y la leyenda de lo que pasa en ella. En japonés la pestaña no aparece. No gasta nada.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/como-suena.mjs

import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-local'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'como-suena');
mkdirSync(CAPTURAS, { recursive: true });

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};

if (!existsSync(PERFIL) && existsSync(join(RAIZ, '.perfil-base', 'Default/IndexedDB'))) {
  cpSync(join(RAIZ, '.perfil-base', 'Default/IndexedDB'), join(PERFIL, 'Default/IndexedDB'), { recursive: true });
}
const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1440, height: 900 },
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
const previo = await sw.evaluate(async () => chrome.storage.local.get(['ajustes', 'lectorTexto', 'notaCuaderno']));
const preparar = (estudia, nota) =>
  sw.evaluate(
    async ({ estudia, nota }) => {
      const d = await chrome.storage.local.get('ajustes');
      await chrome.storage.local.set({ lectorTexto: nota, ajustes: { ...(d.ajustes ?? {}), idiomaInterfaz: 'es', idiomaObjetivo: estudia, bienvenidaVista: true, tema: 'oscuro', avisarVersiones: false } });
      await chrome.storage.local.remove('notaCuaderno');
    },
    { estudia, nota }
  );

const p = await contexto.newPage();
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));

await preparar('en', 'What are you going to do now? Nice to meet you. Get it out of here.');
await p.goto(`chrome-extension://${id}/app.html#/lector`);
await p.locator('.ap-papel .pal').first().waitFor({ timeout: 60000 });
await p.waitForTimeout(800);
await p.locator('.ap-papel .pal', { hasText: 'going' }).first().click();
const pestana = p.locator('.ficha [role="tab"]', { hasText: 'Cómo suena' });
await pestana.waitFor({ timeout: 15000 });
comprobar(await pestana.isVisible(), 'En inglés, la ficha tiene la pestaña «Cómo suena»');
await pestana.click();
await p.locator('.como-suena').waitFor({ timeout: 5000 });
const rubies = await p.locator('.como-suena-frase ruby').evaluateAll((rs) => rs.map((r) => `${r.firstChild.textContent}→${r.querySelector('rt').textContent}`));
comprobar(rubies.includes('What are you→Whaddaya') && rubies.includes('going to→gonna'), 'La frase con su forma hablada encima', rubies.join(' · '));
const leyenda = await p.locator('.como-suena-leyenda li').allTextContents();
comprobar(leyenda.some((l) => l.startsWith('Reducción')), 'Y la leyenda de lo que pasa en ella', leyenda.map((l) => l.split(' ')[0]).join(', '));
await p.locator('.ficha').first().screenshot({ path: join(CAPTURAS, '1-ficha.png') });

// Otra frase: la t con you y la t suave.
await p.keyboard.press('Escape');
await p.locator('.ap-papel .pal', { hasText: 'Nice' }).first().click();
await pestana.click();
const otra = await p.locator('.como-suena-frase ruby').evaluateAll((rs) => rs.map((r) => r.querySelector('rt').textContent));
comprobar(otra.includes('meechu'), 'meet you suena meechu', otra.join(' · '));

// En japonés no hay pestaña.
await preparar('ja', '吾輩は猫である。');
await p.reload();
await p.locator('.ap-papel .pal').first().waitFor({ timeout: 60000 });
await p.locator('.ap-papel .pal').first().click();
await p.locator('.ficha').first().waitFor({ timeout: 15000 });
comprobar(!(await p.locator('.ficha [role="tab"]', { hasText: 'Cómo suena' }).isVisible()), 'En japonés, la pestaña no aparece');

comprobar(errores.length === 0, 'Sin errores en la página', errores.join(' | '));
await sw.evaluate(async (previo) => {
  await chrome.storage.local.set({ ajustes: previo.ajustes, lectorTexto: previo.lectorTexto ?? '' });
  if (previo.notaCuaderno) await chrome.storage.local.set({ notaCuaderno: previo.notaCuaderno });
}, previo);
await contexto.close();
console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
