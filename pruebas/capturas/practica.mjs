// La imagen de la práctica del acento en los README que presentan el japonés: el Cuaderno con una frase del discurso en la
// Dieta (contenido-real.mjs), «スタートアップは、技術を実用化していく主要な担い手です。», y la práctica con la voz de ese
// mismo discurso, recortada del video, en el lugar de la propia: la curva del tono de quien habla sobre el acento esperado de
// cada palabra, con su veredicto. Es la frase de la ficha del README.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/capturas/practica.mjs
// Usa .perfil-local, que tiene JMdict, el diccionario de acento (Kanjium) y el modelo de voz japonés, como el equipo de quien
// estudia: sin JMdict, スタートアップ y 実用化 se parten y quedan sin juzgar. Devuelve al acabar sus ajustes y su Cuaderno,
// que comparte con otras pruebas. La voz se recorta con ffmpeg de contenido-libre/dieta.webm (node
// herramientas/contenido-readme.mjs) a contenido-libre/practica-dieta.wav.

import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { recargarExtension } from '../extension.mjs';
import { DIETA, archivoLibre } from './contenido-real.mjs';

const RAIZ = resolve(import.meta.dirname, '..', '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-local'));
/** Los idiomas de la interfaz cuyo README presenta el japonés. */
const IDIOMAS = ['es', 'en', 'de', 'zh', 'ko'];
const FRASE = 'スタートアップは、技術を実用化していく主要な担い手です。';
if (!DIETA.lineas.some(([, , t]) => t === FRASE)) throw new Error('La frase ya no está en el discurso de contenido-real.mjs');
/**
 * Su voz, de 57,3 a 63,1 s del recorte: entre dos pausas, medidas con silencedetect (−35 dB, 0,25 s). Delante, un segundo
 * de silencio, como en una grabación de verdad, y medio detrás.
 */
const VOZ = { desde: 57.3, dura: 5.8, antes: 1, despues: 0.5 };

// -ss y -t van delante de -i: recortan la entrada, y el silencio se añade después.
const wav = join(RAIZ, 'contenido-libre', 'practica-dieta.wav');
execFileSync('ffmpeg', [
  '-hide_banner', '-loglevel', 'error', '-y',
  '-ss', String(VOZ.desde), '-t', String(VOZ.dura), '-i', archivoLibre(DIETA.video),
  '-vn', '-ac', '1', '-ar', '48000',
  '-af', `adelay=${VOZ.antes * 1000}:all=1,apad=pad_dur=${VOZ.despues}`,
  '-c:a', 'pcm_s16le', wav,
]);
const segundos = VOZ.antes + VOZ.dura + VOZ.despues;

const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1360, height: 900 },
  args: [
    '--mute-audio',
    `--disable-extensions-except=${DIST}`,
    `--load-extension=${DIST}`,
    '--enable-unsafe-webgpu',
    '--enable-gpu',
    '--ignore-gpu-blocklist',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${wav}%noloop`,
  ],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
const previo = await sw.evaluate(() => chrome.storage.local.get(['ajustes', 'lectorTexto', 'notaCuaderno']));
const ajustar = (cambios) =>
  sw.evaluate(async (cambios) => {
    const d = await chrome.storage.local.get('ajustes');
    await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), ...cambios } });
  }, cambios);

try {
  await ajustar({ idiomaInterfaz: 'es', idiomaObjetivo: 'ja', whisperModelo: 'auto', bienvenidaVista: true, tema: 'oscuro', avisarVersiones: false, practicaMoras: false });
  const p = await contexto.newPage();
  await p.goto(`chrome-extension://${id}/app.html#/inicio`);
  await p.waitForTimeout(1500);
  const conAcento = await p.evaluate(async () => {
    const r = await chrome.runtime.sendMessage({ canal: 'motor', metodo: 'estado', args: [] });
    return r.valor.diccionarios.some((d) => d.tipo === 'acento');
  });
  if (!conAcento) throw new Error('El perfil no tiene el diccionario de acento: usar .perfil-local');

  // El Cuaderno añade lo que llega al final de lo que ya hay: se empieza vacío.
  await sw.evaluate(() => chrome.storage.local.remove(['lectorTexto', 'notaCuaderno']));
  await p.goto(`chrome-extension://${id}/app.html#/lector?t=${encodeURIComponent(FRASE)}`);
  await p.locator('.ap-papel .pal').first().waitFor({ timeout: 30000 });
  await p.waitForTimeout(600);
  await p.locator('.ap-dock').getByRole('button', { name: 'Practicar' }).click();
  const panel = p.locator('.ap-practica');
  await panel.waitFor({ timeout: 5000 });
  await p.waitForTimeout(1500);

  await panel.getByRole('button', { name: 'Grabar' }).click();
  await panel.locator('.ap-dictado.grabando').waitFor({ timeout: 15000 });
  await p.waitForTimeout(segundos * 1000 + 400);
  await panel.getByRole('button', { name: 'Terminar' }).click();
  const resultado = p.locator('.ap-practica-resultado');
  const fallo = p.locator('.ap-practica .ap-dictado.error');
  await Promise.race([resultado.waitFor({ timeout: 180000 }), fallo.waitFor({ timeout: 180000 })]).catch(() => {});
  if (!(await resultado.isVisible())) throw new Error(`Sin resultado: ${await fallo.innerText().catch(() => 'nada en 180 s')}`);
  await panel.locator('.ap-dictado[role="status"]').waitFor({ state: 'detached', timeout: 60000 }).catch(() => {});
  console.log(await p.locator('.ap-practica-resumen').innerText());
  for (const j of await p.locator('.ap-practica-juicios li').allInnerTexts()) console.log(`  ${j.replace(/\s+/g, ' ')}`);

  // Del ancho de las demás imágenes del README, guardadas igual (PNG de paleta), y tan alta como haga falta para ver el panel
  // entero: con seis palabras, la gráfica y los veredictos no caben en 720. Se mide en cada idioma, porque en alemán la
  // barra de arriba y los botones ocupan dos líneas.
  for (const idioma of IDIOMAS) {
    await ajustar({ idiomaInterfaz: idioma });
    await p.setViewportSize({ width: 1280, height: 720 });
    await p.waitForTimeout(1200);
    const alto = Math.max(720, await panel.evaluate((el) => Math.ceil(el.getBoundingClientRect().top + el.scrollHeight + 28)));
    await p.setViewportSize({ width: 1280, height: alto });
    await p.waitForTimeout(500);
    const archivo = join(RAIZ, 'docs', 'img', idioma === 'es' ? 'practica.png' : `practica.${idioma}.png`);
    await sharp(await p.screenshot()).png({ palette: true, quality: 92, effort: 10 }).toFile(archivo);
    console.log(`imagen: ${archivo.slice(RAIZ.length + 1)} (1280×${alto})`);
  }
} finally {
  await sw.evaluate(async (d) => {
    await chrome.storage.local.remove(['lectorTexto', 'notaCuaderno']);
    await chrome.storage.local.set(d);
  }, previo);
  await contexto.close();
}
