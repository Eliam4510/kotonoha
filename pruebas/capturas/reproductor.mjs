// La imagen del reproductor de archivos en los README (0.47.0): el discurso en la Dieta (contenido-real.mjs) abierto en el
// reproductor de Kotonoha, con sus subtítulos en japonés y la traducción en el idioma de la interfaz, y el ratón sobre la
// barra de tiempo, que enseña la frase de ese momento. En el README japonés, que presenta el inglés, el video de la NASA
// con su traducción japonesa.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/capturas/reproductor.mjs [es en de zh ko ja]
// Para el japonés de los cinco primeros basta una copia de .perfil-base (se hace en .perfil-captura-reproductor). Para el
// inglés del README japonés hace falta un perfil con los diccionarios del inglés y sus glosas en japonés: KK_PERFIL_INGLES.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { olvidarReproductor, recargarExtension } from '../extension.mjs';
import { iniciarMock } from '../mock-claude.mjs';
import { DIETA, NASA, archivoLibre, traduccionDieta, traduccionNasa, vtt } from './contenido-real.mjs';

const RAIZ = resolve(import.meta.dirname, '..', '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL_JA = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-captura-reproductor'));
const PERFIL_EN = process.env.KK_PERFIL_INGLES ? resolve(process.env.KK_PERFIL_INGLES) : null;
const IMAGENES = join(RAIZ, 'docs', 'img');
const TRABAJO = join(RAIZ, 'capturas-e2e', 'reproductor-readme');
mkdirSync(TRABAJO, { recursive: true });
const IDIOMAS = process.argv.slice(2).length ? process.argv.slice(2) : ['es', 'en', 'de', 'zh', 'ko', 'ja'];
const NOMBRE = { es: 'español', en: 'inglés', de: 'alemán', zh: 'chino', ko: 'coreano', ja: 'japonés' };

/** Qué se ve en cada README: el momento del video y el de la barra por el que pasa el ratón. */
const ESCENA = {
  ja: { archivo: 'dieta.webm', nombre: '施政方針演説 2026.webm', lineas: DIETA.lineas, momento: 59.2, encima: 34.2, objetivo: 'ja' },
  en: { archivo: 'nasa.webm', nombre: 'What’s Up November 2026.webm', lineas: NASA.lineas, momento: 23.6, encima: 44.6, objetivo: 'en' },
};

if (!existsSync(PERFIL_JA)) cpSync(join(RAIZ, '.perfil-base', 'Default/IndexedDB'), join(PERFIL_JA, 'Default/IndexedDB'), { recursive: true });
const mock = await iniciarMock();

async function fotografiar(idioma) {
  const objetivo = idioma === 'ja' ? 'en' : 'ja';
  const perfil = objetivo === 'en' ? PERFIL_EN : PERFIL_JA;
  if (!perfil) {
    console.log(`  ${idioma}: sin KK_PERFIL_INGLES, se salta`);
    return;
  }
  const e = ESCENA[objetivo];
  // Los archivos, con el nombre que tendrían en una carpeta propia; los subtítulos, con el idioma en el nombre.
  const base = e.nombre.replace(/\.[^.]+$/, '');
  const video = join(TRABAJO, e.nombre);
  cpSync(archivoLibre(e.archivo), video);
  const subs = join(TRABAJO, `${base}.${objetivo}.vtt`);
  writeFileSync(subs, vtt(e.lineas));
  const traduccion = join(TRABAJO, `${base}.${idioma}.vtt`);
  writeFileSync(traduccion, vtt(objetivo === 'ja' ? traduccionDieta(idioma) : traduccionNasa(idioma)));

  const contexto = await chromium.launchPersistentContext(perfil, {
    channel: process.env.KK_CANAL ?? 'msedge',
    headless: true,
    viewport: { width: 1280, height: 720 },
    args: ['--mute-audio', `--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--autoplay-policy=no-user-gesture-required'],
  });
  const sw = await recargarExtension(contexto);
  const id = new URL(sw.url()).host;
  const previo = await sw.evaluate(() => chrome.storage.local.get(['ajustes', 'urlBaseIA', 'claveAnthropic']));
  await sw.evaluate(async ({ url, idioma, objetivo, explicaciones }) => {
    const d = await chrome.storage.local.get('ajustes');
    await chrome.storage.local.set({
      urlBaseIA: url,
      claveAnthropic: 'clave-de-prueba',
      ajustes: { ...(d.ajustes ?? {}), idiomaInterfaz: idioma, idiomaObjetivo: objetivo, idiomaSecundario: idioma, idiomaExplicaciones: explicaciones, bienvenidaVista: true, tema: 'oscuro', avisarVersiones: false, navegadorAbierto: false, modo: 'normal', salto: 'no', subsPosicion: null, analisisAutomatico: false, activo: true },
    });
  }, { url: `http://127.0.0.1:${mock.puerto}`, idioma, objetivo, explicaciones: NOMBRE[idioma] });
  const p = await contexto.newPage();
  await p.goto(`chrome-extension://${id}/app.html#/inicio`);
  // Sin lo que recuerda de otra captura: abriría el archivo donde se dejó, con su aviso.
  await olvidarReproductor(p);
  await p.goto(`chrome-extension://${id}/app.html#/reproductor`);
  await p.waitForTimeout(1200);
  await p.setInputFiles('input[type="file"]', [video, subs, traduccion]);
  await p.waitForFunction(() => document.querySelector('.ap-local video')?.readyState >= 2, undefined, { timeout: 20000 });
  await p.waitForFunction(() => !!document.querySelector('.ap-rep-controles [aria-label]'), undefined, { timeout: 30000 });
  // Un poco más despacio que lo normal: así se ve que la velocidad se elige.
  await p.keyboard.press('<');
  await p.evaluate((t) => {
    const v = document.querySelector('.ap-local video');
    v.pause();
    v.currentTime = t;
  }, e.momento);
  await p.waitForFunction(() => document.querySelectorAll('.linea-sub').length > 0, undefined, { timeout: 20000 });
  // Los avisos de lo importado ya se fueron. Solo su botón de cerrar: el de su acción haría lo que dice.
  await p.evaluate(() => document.querySelectorAll('.aviso .btn-icono').forEach((b) => b.click()));
  await p.waitForTimeout(5000);
  const barra = await p.locator('.ap-rep-barra').boundingBox();
  const duracion = await p.evaluate(() => document.querySelector('.ap-local video').duration);
  await p.mouse.move(barra.x + barra.width * (e.encima / duracion), barra.y + barra.height / 2);
  await p.waitForTimeout(700);
  const archivo = join(IMAGENES, idioma === 'es' ? 'reproductor.png' : `reproductor.${idioma}.png`);
  await sharp(await p.screenshot()).png({ palette: true, quality: 92, effort: 10 }).toFile(archivo);
  console.log(`  imagen: ${archivo.slice(RAIZ.length + 1)}`);
  await sw.evaluate(async (d) => {
    await chrome.storage.local.remove(['urlBaseIA', 'claveAnthropic']);
    await chrome.storage.local.set(d);
  }, previo);
  await contexto.close();
}

for (const idioma of IDIOMAS) {
  console.log(`== ${idioma}`);
  await fotografiar(idioma);
}
await mock.cerrar?.();
process.exit(0);
