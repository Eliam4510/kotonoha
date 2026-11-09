// La imagen del diccionario del README en cada idioma de la interfaz que estudia japonés (en el README japonés se estudia
// inglés, que no tiene sinónimos ni categorías de JMdict): la ficha de 話す con su kanji, las palabras que significan lo
// mismo y las que se leen igual. Como en pruebas/capturas/readme.mjs, con los diccionarios que tendría quien lee cada
// README: el suyo y, de respaldo, el inglés. La ventana es más alta que la de las demás para que quepa todo.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/capturas/diccionario.mjs [es de en zh ko]

import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { recargarExtension } from '../extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..', '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-readme'));
const IMAGENES = join(RAIZ, 'docs', 'img');
// En este orden, los tres últimos comparten diccionarios y no hay que cambiarlos.
const IDIOMAS = process.argv.slice(2).length ? process.argv.slice(2) : ['es', 'de', 'en', 'zh', 'ko'];
const PALABRA = '話す';

if (!existsSync(PERFIL) && existsSync(join(RAIZ, '.perfil-base', 'Default/IndexedDB'))) {
  cpSync(join(RAIZ, '.perfil-base', 'Default/IndexedDB'), join(PERFIL, 'Default/IndexedDB'), { recursive: true });
}
mkdirSync(IMAGENES, { recursive: true });
const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1440, height: 1120 },
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
const previo = await sw.evaluate(async () => chrome.storage.local.get(['ajustes']));
const fijar = (idioma) =>
  sw.evaluate(async (idioma) => {
    const d = await chrome.storage.local.get('ajustes');
    await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), idiomaInterfaz: idioma, idiomaObjetivo: 'ja', bienvenidaVista: true, tema: 'oscuro', avisarVersiones: false } });
  }, idioma);

const p = await contexto.newPage();
await p.goto(`chrome-extension://${id}/app.html#/inicio`);
// Al abrir la página, el motor puede tardar un poco en responder: se reintenta unos segundos, como en readme.mjs.
const motor = async (metodo, ...args) => {
  for (let intento = 0; ; intento++) {
    const r = await p.evaluate(({ metodo, args }) => chrome.runtime.sendMessage({ canal: 'motor', metodo, args }), { metodo, args }).catch(() => null);
    if (r?.ok) return r.valor;
    if (intento > 40 || r?.error) throw new Error(`${metodo}: ${r?.error ?? 'sin respuesta'}`);
    await p.waitForTimeout(250);
  }
};

/** Deja instalados justo estos diccionarios de términos de japonés, en este orden. */
async function diccionarios(terminos) {
  await motor('fijarLengua', 'ja');
  const instalados = () => motor('estado').then((e) => e.diccionarios);
  for (const d of await instalados()) if (d.tipo === 'terminos' && !terminos.includes(d.id)) await motor('eliminarDiccionario', d.id);
  const ya = new Set((await instalados()).map((d) => d.id));
  for (const t of terminos) {
    if (ya.has(t)) continue;
    const t0 = Date.now();
    await motor('instalarDiccionario', t);
    console.log(`  instalado ${t} en ${Math.round((Date.now() - t0) / 1000)} s`);
  }
  const resto = (await instalados()).filter((d) => !terminos.includes(d.id)).map((d) => d.id);
  await motor('ordenarDiccionarios', [...terminos, ...resto]).catch(() => {});
}

for (const idioma of IDIOMAS) {
  // Primero los ajustes: el catálogo de diccionarios es el de la lengua que se estudia.
  await fijar(idioma);
  await p.waitForTimeout(500);
  await diccionarios(idioma === 'es' ? ['jmdict-es', 'jmdict-en'] : idioma === 'de' ? ['jmdict-de', 'jmdict-en'] : ['jmdict-en']);
  await p.goto(`chrome-extension://${id}/app.html#/diccionario?q=${encodeURIComponent(PALABRA)}`);
  await p.reload();
  const resultado = p.locator('.ap-resultado').first();
  await resultado.waitFor({ timeout: 30000 });
  // El índice de los sinónimos se hace la primera vez con cada juego de diccionarios: unos segundos.
  await resultado.locator('.ap-sinonimos .chip').first().waitFor({ timeout: 90000 });
  await resultado.locator('.ap-homofonos .chip').first().waitFor({ timeout: 15000 });
  await p.mouse.move(5, 5);
  await p.waitForTimeout(1200);
  const archivo = join(IMAGENES, idioma === 'es' ? 'diccionario.png' : `diccionario.${idioma}.png`);
  await sharp(await p.screenshot()).png({ palette: true, quality: 92, effort: 10 }).toFile(archivo);
  console.log('imagen:', archivo.slice(RAIZ.length + 1));
}

await sw.evaluate(async (previo) => chrome.storage.local.set({ ajustes: previo.ajustes }), previo);
await contexto.close();
process.exit(0);
