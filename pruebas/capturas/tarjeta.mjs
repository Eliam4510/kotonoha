// La tarjeta para compartir del README en cada idioma de la interfaz: la de 食べる en la frase del sueño, con lo que
// significa allí (Claude simulado), copiada al portapapeles con el botón de la ficha. Con la interfaz en japonés se estudia
// inglés, como en las demás imágenes del README. Los textos son de dominio público (Lewis Carroll, 1865).
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/capturas/tarjeta.mjs [es en de zh ko ja]

import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { recargarExtension } from '../extension.mjs';
import { iniciarMock } from '../mock-claude.mjs';

const RAIZ = resolve(import.meta.dirname, '..', '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-local'));
const IMAGENES = join(RAIZ, 'docs', 'img');
const IDIOMAS = process.argv.slice(2).length ? process.argv.slice(2) : ['es', 'en', 'de', 'zh', 'ko', 'ja'];

const NOTA = { ja: '赤い星と青い星を食べる夢を見た。', en: 'Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do.' };
const PALABRA = { ja: '食', en: 'tired' };
const nombreBoton = (idioma) => (idioma === 'es' ? 'Compartir como imagen' : JSON.parse(readFileSync(join(RAIZ, 'idiomas', `${idioma}.json`), 'utf8'))['Compartir como imagen']);

if (!existsSync(PERFIL) && existsSync(join(RAIZ, '.perfil-base', 'Default/IndexedDB'))) {
  cpSync(join(RAIZ, '.perfil-base', 'Default/IndexedDB'), join(PERFIL, 'Default/IndexedDB'), { recursive: true });
}
mkdirSync(IMAGENES, { recursive: true });
const mock = await iniciarMock();
const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1440, height: 900 },
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
const previo = await sw.evaluate(async () => chrome.storage.local.get(['ajustes', 'lectorTexto', 'notaCuaderno', 'estiloTarjeta', 'urlBaseIA', 'claveAnthropic']));

/** Las respuestas guardadas de otro idioma cambiarían lo que se ve. */
const olvidarRespuestas = () =>
  sw.evaluate(async () => {
    for (const { name } of await indexedDB.databases()) {
      await new Promise((ok) => {
        const q = indexedDB.open(name);
        q.onsuccess = () => {
          const d = q.result;
          if (!d.objectStoreNames.contains('cacheIA')) {
            d.close();
            return ok();
          }
          const tx = d.transaction('cacheIA', 'readwrite');
          tx.objectStore('cacheIA').clear();
          tx.oncomplete = () => {
            d.close();
            ok();
          };
        };
        q.onerror = () => ok();
      });
    }
  });

for (const idioma of IDIOMAS) {
  const estudia = idioma === 'ja' ? 'en' : 'ja';
  mock.control.idioma = idioma;
  await olvidarRespuestas();
  await sw.evaluate(
    async ({ idioma, estudia, nota, url }) => {
      const d = await chrome.storage.local.get('ajustes');
      await chrome.storage.local.set({ urlBaseIA: url, claveAnthropic: 'clave-de-prueba', lectorTexto: nota, estiloTarjeta: 'oscuro', ajustes: { ...(d.ajustes ?? {}), idiomaInterfaz: idioma, idiomaObjetivo: estudia, bienvenidaVista: true, tema: 'oscuro', avisarVersiones: false, sentidoAutomatico: true } });
      await chrome.storage.local.remove('notaCuaderno');
    },
    { idioma, estudia, nota: NOTA[estudia], url: `http://127.0.0.1:${mock.puerto}` }
  );
  const p = await contexto.newPage();
  await p.goto(`chrome-extension://${id}/app.html#/lector`);
  await p.locator('.ap-papel .pal').first().waitFor({ timeout: 60000 });
  await p.waitForTimeout(800);
  await p.locator('.ap-papel .pal').filter({ hasText: PALABRA[estudia] }).first().click();
  await p.locator('.ficha .sentido b').first().waitFor({ timeout: 20000 });
  await p.locator(`.ficha-herr button[aria-label="${nombreBoton(idioma)}"]`).click();
  await p.locator('.compartir-estado.copiada').waitFor({ timeout: 30000 });
  const base64 = await p.evaluate(async () => {
    const [item] = await navigator.clipboard.read();
    const b = await item.getType('image/png');
    return await new Promise((ok) => {
      const lector = new FileReader();
      lector.onload = () => ok(String(lector.result).split(',')[1]);
      lector.readAsDataURL(b);
    });
  });
  const archivo = join(IMAGENES, idioma === 'es' ? 'tarjeta.png' : `tarjeta.${idioma}.png`);
  await sharp(Buffer.from(base64, 'base64')).resize(1080).png({ palette: true, quality: 92, effort: 10 }).toFile(archivo);
  console.log('imagen:', archivo.slice(RAIZ.length + 1));
  await p.close();
}

// Lo de antes, como estaba.
await sw.evaluate(async (previo) => {
  await chrome.storage.local.set({ ajustes: previo.ajustes, lectorTexto: previo.lectorTexto ?? '' });
  for (const clave of ['notaCuaderno', 'estiloTarjeta', 'urlBaseIA', 'claveAnthropic']) {
    if (previo[clave] !== undefined) await chrome.storage.local.set({ [clave]: previo[clave] });
    else await chrome.storage.local.remove(clave);
  }
}, previo);
await contexto.close();
mock.cerrar?.();
process.exit(0);
