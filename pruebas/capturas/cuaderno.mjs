// La imagen del Cuaderno del README en cada idioma de la interfaz: una nota con título, párrafos y una lista, leída en su
// pestaña. Con la interfaz en japonés se estudia inglés, como en las demás imágenes del README. Los textos son de dominio
// público (Natsume Sōseki, «Wagahai wa neko de aru», 1905; Lewis Carroll, «Alice’s Adventures in Wonderland», 1865).
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/capturas/cuaderno.mjs [es en de zh ko ja]

import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { recargarExtension } from '../extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..', '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-local'));
const IMAGENES = join(RAIZ, 'docs', 'img');
const IDIOMAS = process.argv.slice(2).length ? process.argv.slice(2) : ['es', 'en', 'de', 'zh', 'ko', 'ja'];

const NOTA = {
  ja: '# 吾輩は猫である\n\n吾輩は猫である。名前はまだ無い。\nどこで生れたかとんと見当がつかぬ。何でも薄暗いじめじめした所でニャーニャー泣いていた事だけは記憶している。\n\n## 書生の掌の上で\n\n- 掌に載せられてスーと持ち上げられた\n  - フワフワした感じがあった\n- 書生の顔を見たのが人間というものの見始であろう',
  en: '# Down the Rabbit-Hole\n\nAlice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do.\nOnce or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it.\n\n## What Alice saw\n\n- A White Rabbit with pink eyes ran close by her\n  - It took a watch out of its waistcoat-pocket\n- She ran across the field after it',
};

if (!existsSync(PERFIL) && existsSync(join(RAIZ, '.perfil-base', 'Default/IndexedDB'))) {
  cpSync(join(RAIZ, '.perfil-base', 'Default/IndexedDB'), join(PERFIL, 'Default/IndexedDB'), { recursive: true });
}
mkdirSync(IMAGENES, { recursive: true });
const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1280, height: 720 },
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
const previo = await sw.evaluate(async () => chrome.storage.local.get(['ajustes', 'lectorTexto', 'notaCuaderno']));

for (const idioma of IDIOMAS) {
  const estudia = idioma === 'ja' ? 'en' : 'ja';
  await sw.evaluate(
    async ({ idioma, estudia, nota }) => {
      const d = await chrome.storage.local.get('ajustes');
      await chrome.storage.local.set({ lectorTexto: nota, ajustes: { ...(d.ajustes ?? {}), idiomaInterfaz: idioma, idiomaObjetivo: estudia, bienvenidaVista: true, tema: 'oscuro', avisarVersiones: false } });
      await chrome.storage.local.remove('notaCuaderno');
    },
    { idioma, estudia, nota: NOTA[estudia] }
  );
  const p = await contexto.newPage();
  await p.goto(`chrome-extension://${id}/lector.html`);
  await p.waitForFunction(() => document.querySelectorAll('.ap-papel .pal').length > 20, null, { timeout: 60000 });
  await p.waitForTimeout(2000);
  const archivo = join(IMAGENES, idioma === 'es' ? 'lector-web.png' : `lector-web.${idioma}.png`);
  await sharp(await p.screenshot()).png({ palette: true, quality: 92, effort: 10 }).toFile(archivo);
  console.log('imagen:', archivo.slice(RAIZ.length + 1));
  await p.close();
}

// Lo de antes, como estaba.
await sw.evaluate(async (previo) => {
  await chrome.storage.local.set({ ajustes: previo.ajustes, lectorTexto: previo.lectorTexto ?? '' });
  if (previo.notaCuaderno) await chrome.storage.local.set({ notaCuaderno: previo.notaCuaderno });
}, previo);
await contexto.close();
