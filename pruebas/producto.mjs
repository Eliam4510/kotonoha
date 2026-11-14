// Prueba los arreglos de producto de la 0.13.1: el aviso de versión nueva con GitHub simulado (se ve, se cierra, no se
// repite, se apaga y se busca a mano), el selector de lengua en Inicio y en la barra lateral, la orden del ayudante con
// el identificador de esta copia y la voz del navegador en Ajustes. No sale a internet: la API de GitHub se responde aquí.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/producto.mjs

import { mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-producto'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'producto');
rmSync(PERFIL, { recursive: true, force: true });
mkdirSync(CAPTURAS, { recursive: true });

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};

const API = 'https://api.github.com/repos/Eliam4510/kotonoha/releases/latest';
const PUBLICADA = { tag_name: 'v9.9.9', name: 'Kotonoha 9.9.9 · Prueba de avisos', html_url: 'https://github.com/Eliam4510/kotonoha/releases/tag/v9.9.9' };

const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1280, height: 900 },
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});
let consultas = 0;
await contexto.route(API, (r) => {
  consultas++;
  return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PUBLICADA) });
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
await sw.evaluate(async () => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), idiomaInterfaz: 'es', bienvenidaVista: true, tema: 'oscuro', idiomaObjetivo: 'ja' } });
});
const ajustes = () => sw.evaluate(() => chrome.storage.local.get('ajustes').then((d) => d.ajustes));
const version = await sw.evaluate(() => chrome.runtime.getManifest().version);

const p = await contexto.newPage();
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));
await p.goto(`chrome-extension://${id}/app.html#/inicio`);
await p.waitForTimeout(1500);

// ---------- Aviso de versión nueva ----------

const aviso = p.locator('.ap-aviso-version');
await aviso.waitFor({ timeout: 8000 }).catch(() => {});
const textoAviso = await aviso.innerText().catch(() => '');
comprobar(textoAviso.includes('Kotonoha 9.9.9 ya está disponible') && textoAviso.includes('Prueba de avisos'), 'Inicio avisa de la versión nueva con lo que trae', textoAviso.split('\n')[0]);
comprobar((await aviso.getByRole('link', { name: /Ver la versión/ }).getAttribute('href')) === PUBLICADA.html_url, 'Y enlaza a su página en GitHub');
comprobar(consultas === 1, 'Pregunta a GitHub una sola vez', consultas);
await p.screenshot({ path: join(CAPTURAS, '1-inicio.png') });
await aviso.getByRole('button', { name: 'Cerrar el aviso' }).click();
await p.waitForTimeout(300);
comprobar(!(await aviso.isVisible().catch(() => false)), 'El aviso se cierra');
await p.reload();
await p.waitForTimeout(1500);
comprobar(!(await aviso.isVisible().catch(() => false)), 'Y cerrado no vuelve con la misma versión');
comprobar(consultas === 1, 'Al volver a Inicio no pregunta otra vez en el mismo día', consultas);

// ---------- Lengua desde Inicio ----------

const selector = p.locator('.ap-lengua-segmentado');
comprobar((await selector.locator('button').count()) === 3, 'Inicio enseña las tres lenguas');
comprobar((await selector.locator('[aria-checked="true"]').innerText()).includes('日本語'), 'Con la que se estudia marcada, en su escritura');
comprobar((await selector.locator('svg.ap-bandera').count()) === 3, 'Cada una con su bandera');
await selector.locator('[data-lengua="en"]').click();
await p.waitForFunction(() => document.querySelector('.ap-lengua-segmentado [aria-checked="true"]')?.textContent?.includes('English'), null, { timeout: 8000 }).catch(() => {});
comprobar((await ajustes()).idiomaObjetivo === 'en', 'Elegir English pasa a estudiar inglés');
// La pantalla en la otra lengua se prepara junto a la de antes y entra cuando está lista: se lee la que queda.
await p.waitForFunction(() => document.querySelectorAll('.ap-principal').length === 1, null, { timeout: 8000 }).catch(() => {});
const saludo = await p.locator('.ap-principal:not(.ap-preparando) .ap-saludo h1').first().innerText();
comprobar(/^Good (morning|afternoon|evening)/.test(saludo), 'Y el saludo es en inglés', saludo);
await p.screenshot({ path: join(CAPTURAS, '2-ingles.png') });

// ---------- Lengua desde la barra lateral ----------

const menu = p.locator('.ap-lengua-menu');
comprobar((await menu.locator('.ap-lengua-actual').innerText()).includes('English'), 'La barra lateral dice qué se estudia');
await menu.locator('.ap-lengua-actual').click();
comprobar((await menu.locator('[role="menuitemradio"]').count()) === 3, 'Y abre un menú con las tres');
// Después de su animación de entrada, que empieza transparente.
await p.waitForTimeout(300);
await p.screenshot({ path: join(CAPTURAS, '3-menu.png') });
await menu.locator('[data-lengua="de"]').click();
await p.waitForTimeout(1200);
comprobar((await ajustes()).idiomaObjetivo === 'de', 'Desde el menú se pasa al alemán');
comprobar(!(await menu.locator('[role="menu"]').isVisible().catch(() => false)), 'Y el menú se cierra');
await menu.locator('.ap-lengua-actual').click();
await p.keyboard.press('Escape');
comprobar(!(await menu.locator('[role="menu"]').isVisible().catch(() => false)), 'Esc también lo cierra');

await p.setViewportSize({ width: 1000, height: 800 });
await p.waitForTimeout(400);
const compacta = await menu.locator('.ap-lengua-actual').innerText();
comprobar(compacta.trim() === '' && (await menu.locator('.ap-lengua-actual svg.ap-bandera').count()) === 1, 'Con la barra plegada queda solo la bandera');
await menu.locator('.ap-lengua-actual').click();
await menu.locator('[data-lengua="ja"]').click();
await p.waitForTimeout(1200);
comprobar((await ajustes()).idiomaObjetivo === 'ja', 'Y desde ahí se vuelve al japonés');
await p.setViewportSize({ width: 1280, height: 900 });

// ---------- Ajustes: el ayudante, la versión y la voz ----------

await p.goto(`chrome-extension://${id}/app.html#/ajustes`);
await p.waitForTimeout(1500);
// Si el ayudante está registrado en este equipo, Ajustes dice que está instalado y no hace falta la orden.
await p.waitForFunction(() => !document.querySelector('#transcripcion')?.textContent?.includes('Comprobando si está instalado'), null, { timeout: 15000 }).catch(() => {});
const transcripcion = await p.locator('#transcripcion').innerText();
if (transcripcion.includes('Instalado, con yt-dlp')) {
  comprobar(true, 'El ayudante está instalado en este equipo: Ajustes lo dice y no enseña la orden');
} else {
  const orden = await p.locator('.ap-orden-ayudante').innerText().catch(() => '');
  comprobar(orden === `powershell -ExecutionPolicy Bypass -File instalar.ps1 -Extension ${id}`, 'La orden del ayudante lleva el identificador de esta copia', orden);
  comprobar((await p.getByRole('link', { name: 'Descargar' }).getAttribute('href')) === 'https://github.com/Eliam4510/kotonoha/releases/latest', 'Y un enlace para descargarlo');
}

const seccion = p.locator('#version');
await seccion.scrollIntoViewIfNeeded();
comprobar((await seccion.innerText()).includes(`Tienes Kotonoha ${version}.`), 'Ajustes dice la versión instalada', version);
await seccion.getByRole('button', { name: 'Buscar', exact: true }).click();
await p.waitForTimeout(800);
comprobar((await seccion.innerText()).includes('Hay una versión nueva: 9.9.9.'), 'Buscar a mano pregunta ya y dice qué hay', consultas);
comprobar(consultas === 2, 'Esa búsqueda sí va a GitHub', consultas);
await p.screenshot({ path: join(CAPTURAS, '4-version.png') });

// Apagado, Inicio no pregunta ni avisa, aunque la versión sea otra.
await seccion.getByRole('switch', { name: 'Avisar de versiones nuevas' }).click();
await p.waitForTimeout(400);
comprobar((await ajustes()).avisarVersiones === false, 'Los avisos se apagan');
await sw.evaluate(() => chrome.storage.local.remove(['versionPublicada', 'avisoVersionCerrado']));
await p.goto(`chrome-extension://${id}/app.html#/inicio`);
await p.waitForTimeout(1500);
comprobar(!(await p.locator('.ap-aviso-version').isVisible().catch(() => false)) && consultas === 2, 'Y apagados no pregunta ni avisa', consultas);

// Encendidos otra vez, también avisa el menú de la extensión.
await sw.evaluate(async () => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ ajustes: { ...d.ajustes, avisarVersiones: true } });
});
const menuExt = await contexto.newPage();
await menuExt.goto(`chrome-extension://${id}/popup.html`);
await menuExt.waitForTimeout(1500);
const linea = await menuExt.locator('.ap-menu-version').innerText().catch(() => '');
comprobar(linea.includes('Kotonoha 9.9.9 ya está disponible'), 'El menú de la extensión también avisa', linea);
await menuExt.screenshot({ path: join(CAPTURAS, '5-menu-extension.png') });
await menuExt.close();

// La voz del navegador: la lista sale de lo que ofrezca el navegador, que en una prueba sin ventana puede estar vacía.
await p.goto(`chrome-extension://${id}/app.html#/ajustes`);
await p.waitForTimeout(1500);
const voz = p.getByRole('combobox', { name: 'Voz del navegador' });
await voz.scrollIntoViewIfNeeded();
const opciones = await voz.locator('option').allInnerTexts();
comprobar(opciones[0].startsWith('Automática'), 'La voz del navegador es automática por omisión', opciones.slice(0, 3).join(' | '));
if (opciones.length > 1) {
  const otra = await voz.locator('option').nth(opciones.length - 1).getAttribute('value');
  await voz.selectOption(otra);
  await p.waitForTimeout(300);
  comprobar((await ajustes()).vozNavegador === otra, 'Se puede elegir otra y se guarda', otra);
  await p.getByRole('button', { name: 'Probar', exact: true }).click();
  await p.waitForTimeout(500);
} else {
  comprobar((await p.locator('#voces').innerText()).includes('Este navegador no tiene voces para esta lengua.'), 'Sin voces, lo dice');
}
await p.screenshot({ path: join(CAPTURAS, '6-voces.png') });

comprobar(errores.length === 0, 'Sin errores en la página', errores.join(' | '));
await contexto.close();
console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
