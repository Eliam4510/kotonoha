// El diccionario inglés-inglés, el más grande que se ofrece, de principio a fin y con un perfil limpio: instalarlo, arrancar
// con él dentro, consultarlo y quitarlo con el botón de Ajustes. Descarga unos 110 MB.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/ingles-grande.mjs

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { confirmarBorrado, recargarExtension } from './extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = mkdtempSync(join(tmpdir(), 'kk-grande-'));
const DICCIONARIO = 'wty-en-en';
const LIMITE_BORRADO_MS = 240000;

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

let contexto;
let app;
const errores = [];
const abrir = async () => {
  contexto = await chromium.launchPersistentContext(PERFIL, {
    channel: process.env.KK_CANAL ?? 'msedge',
    headless: true,
    viewport: { width: 1280, height: 800 },
    args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
  });
  const sw = await recargarExtension(contexto);
  const id = new URL(sw.url()).host;
  for (const pg of contexto.pages()) if (pg.url().includes('app.html')) await pg.close();
  app = await contexto.newPage();
  app.on('pageerror', (e) => errores.push(e.message));
  await app.goto(`chrome-extension://${id}/app.html#/ajustes`);
  await app.waitForTimeout(800);
};
const motor = async (metodo, ...args) => {
  for (let intento = 0; ; intento++) {
    const r = await app.evaluate(({ metodo, args }) => chrome.runtime.sendMessage({ canal: 'motor', metodo, args }), { metodo, args });
    if (r?.ok) return r.valor;
    // Recién abierto, el motor aún puede no estar escuchando.
    if (r || intento > 40) throw new Error(`${metodo}: ${r?.error ?? 'sin respuesta'}`);
    await dormir(500);
  }
};

await abrir();
await app.evaluate(async () => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), idiomaInterfaz: 'es', bienvenidaVista: true, ankiPuerto: 1 } });
});
await app.reload();
await app.waitForTimeout(1000);
await app.locator('select[aria-label="Idioma que estudias"]').selectOption('en');
await app.waitForTimeout(800);

let t = Date.now();
await motor('instalarDiccionario', DICCIONARIO);
console.log(`  instalado en ${Math.round((Date.now() - t) / 1000)} s`);
let estado = await motor('estado');
const fila = estado.diccionarios.find((d) => d.id === DICCIONARIO);
comprobar(fila?.filas > 500000, 'Se instala entero', fila?.filas);
console.log(`  disco: ${await app.evaluate(async () => Math.round((await navigator.storage.estimate()).usage / 1048576))} MB`);

// Con todo eso dentro, arrancar no debe hacer esperar al primer análisis.
await contexto.close();
await abrir();
t = Date.now();
const [linea] = await motor('analizarTexto', 'He went home.');
const primerAnalisis = Date.now() - t;
comprobar(linea.some((p) => p.lema === 'go'), 'Tras arrancar analiza');
comprobar(primerAnalisis < 5000, 'Sin esperar a cargar la lista de términos', `${primerAnalisis} ms`);
t = Date.now();
const resultado = await motor('buscar', 'serendipity');
comprobar(resultado.entradas.length > 0, 'Y consulta', `${Date.now() - t} ms`);

// Quitarlo con el botón, el camino de verdad: aquí se quedaba colgado. Antes termina de cargarse la lista de términos,
// como pasa siempre que alguien llega hasta Ajustes.
for (let i = 0; i < 120 && !(await motor('estado')).terminosCargados; i++) await dormir(500);
await app.locator('#diccionarios').scrollIntoViewIfNeeded().catch(() => {});
const boton = app.locator('button[aria-label="Eliminar Inglés–inglés"]');
comprobar((await boton.count()) === 1, 'Ajustes lo ofrece para quitarlo');
t = Date.now();
await boton.click();
await confirmarBorrado(app);
await app.waitForTimeout(300);
comprobar(await app.getByText('Eliminando…').isVisible(), 'Avisa de que está en ello');
const latencias = [];
let medidas = 0;
let peor = 0;
while ((await boton.count()) === 0 && (await app.getByText('Eliminando…').count()) > 0 && Date.now() - t < LIMITE_BORRADO_MS) {
  // Mientras tanto, lo demás ha de seguir funcionando.
  const t2 = Date.now();
  await motor('buscar', 'go');
  peor = Math.max(peor, Date.now() - t2);
  latencias.push(Date.now() - t2);
  medidas++;
  await dormir(2000);
}
const tarda = Date.now() - t;
estado = await motor('estado');
comprobar(!estado.diccionarios.some((d) => d.id === DICCIONARIO), 'Se quita', `${Math.round(tarda / 1000)} s`);
comprobar(tarda < LIMITE_BORRADO_MS, 'Sin quedarse colgado');
console.log(`  consultas durante el borrado, en ms: ${latencias.join(' ')}`);
comprobar(peor < 15000, 'Y el motor sigue atendiendo mientras tanto', `${medidas} consultas, la más lenta de ${peor} ms`);
comprobar((await motor('buscar', 'serendipity')).entradas.length === 0, 'No quedan filas suyas');
await app.waitForTimeout(500);
comprobar((await app.locator('button', { hasText: 'Instalar' }).count()) > 0, 'Y vuelve a la lista de disponibles');
comprobar(!errores.length, 'Ningún error de página', errores.slice(0, 3).join(' | '));

await contexto.close();
rmSync(PERFIL, { recursive: true, force: true, maxRetries: 3 });
console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
