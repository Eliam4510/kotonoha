// Prueba la comprobación de las moras especiales (っ, ん y vocales largas) en la práctica del acento, con narabas: que el
// interruptor sale apagado y se guarda, que la primera vez descarga el modelo, que una frase bien dicha no da avisos y que
// la misma frase con dos moras de menos da los dos, con la mora marcada. Al final, el trabajador directamente: en qué
// dispositivo corre (WebGPU solo si da lo mismo que el procesador) y que oye lo mismo que ONNX Runtime en Node.
// Uso: KK_SALIDA=.dist-whisper node build.mjs && node pruebas/practica-moras.mjs bien.wav mal.wav [fonemas de bien.wav]
// Las grabaciones dicen «おばあさんと切手を買いました。», con un segundo de silencio delante: bien.wav bien, y mal.wav como
// «おばさんときてをかいました». No se publican. La primera vez descarga narabas (1,26 GB) en el perfil.

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-whisper'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-whisper'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'practica-moras');
mkdirSync(CAPTURAS, { recursive: true });
const [bien, mal, fonemasBien] = process.argv.slice(2);
if (!bien || !mal) throw new Error('Faltan las grabaciones');
const FRASE = 'おばあさんと切手を買いました。';
const OPCION = 'Comprobar también っ, ん y vocales largas';

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const duracion = (wav) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav], { encoding: 'utf8' }));

/** Abre el navegador con el micrófono falso diciendo `wav`, y la práctica de la frase. */
async function abrir(wav, ajustesIniciales) {
  const contexto = await chromium.launchPersistentContext(PERFIL, {
    channel: process.env.KK_CANAL ?? 'msedge',
    headless: true,
    viewport: { width: 1360, height: 900 },
    args: [
      `--disable-extensions-except=${DIST}`,
      `--load-extension=${DIST}`,
      '--enable-unsafe-webgpu',
      '--enable-gpu',
      '--ignore-gpu-blocklist',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${resolve(wav)}%noloop`,
    ],
  });
  const sw = await recargarExtension(contexto);
  const id = new URL(sw.url()).host;
  const ajustar = (cambios) =>
    sw.evaluate(async (cambios) => {
      const d = await chrome.storage.local.get('ajustes');
      await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), ...cambios } });
    }, cambios);
  const leerAjustes = () => sw.evaluate(async () => (await chrome.storage.local.get('ajustes')).ajustes);
  await ajustar({ idiomaInterfaz: 'es', idiomaObjetivo: 'ja', whisperModelo: 'auto', bienvenidaVista: true, tema: 'oscuro', avisarVersiones: false, ...ajustesIniciales });
  const p = await contexto.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  await p.goto(`chrome-extension://${id}/app.html#/lector?t=${encodeURIComponent(FRASE)}`);
  await p.locator('.ap-papel .pal').first().waitFor({ timeout: 30000 });
  await p.waitForTimeout(600);
  await p.locator('.ap-dock').getByRole('button', { name: 'Practicar' }).click();
  const panel = p.locator('.ap-practica');
  await panel.waitFor({ timeout: 5000 });
  return { contexto, id, p, panel, errores, ajustar, leerAjustes };
}

/** Graba lo que dice el micrófono falso y espera el resultado; cuenta los pasos que enseña mientras tanto. */
async function grabar(p, panel, wav) {
  await panel.getByRole('button', { name: 'Grabar' }).click();
  await panel.locator('.ap-dictado.grabando').waitFor({ timeout: 15000 });
  await dormir(duracion(wav) * 1000 + 700);
  await panel.getByRole('button', { name: 'Terminar' }).click();
  const inicio = Date.now();
  const pasos = new Set();
  const resultado = p.locator('.ap-practica-resultado');
  const fallo = p.locator('.ap-practica .ap-dictado.error');
  // La primera vez se descargan 1,26 GB: hasta media hora.
  while (Date.now() - inicio < 30 * 60 * 1000) {
    if ((await resultado.isVisible()) || (await fallo.isVisible())) break;
    const paso = await panel.locator('.ap-dictado-texto').innerText().catch(() => '');
    if (paso) pasos.add(paso.replace(/\d+ %/, 'N %'));
    await dormir(500);
  }
  return { resultado, error: await fallo.innerText().catch(() => ''), segundos: Math.round((Date.now() - inicio) / 1000), pasos: [...pasos] };
}

const juicios = (p) => p.locator('.ap-practica-juicios li').evaluateAll((els) => els.map((el) => ({ veredicto: el.querySelector('.ap-veredicto').textContent, texto: el.textContent.replace(/\s+/g, ' ') })));

// ---------- Bien dicha ----------

let s = await abrir(bien, { practicaMoras: false });
const interruptor = s.panel.getByRole('switch', { name: OPCION });
comprobar(await interruptor.isVisible(), 'La práctica ofrece comprobar las moras');
comprobar((await interruptor.getAttribute('aria-checked')) === 'false', 'Sale apagado: descarga mucho');
comprobar((await s.panel.locator('.ap-practica-opcion').innerText()).includes('1,26 GB'), 'Y dice cuánto descarga');
await interruptor.click();
await s.p.waitForTimeout(300);
comprobar((await interruptor.getAttribute('aria-checked')) === 'true' && (await s.leerAjustes()).practicaMoras === true, 'Al encenderlo se guarda en los ajustes');
comprobar((await s.panel.locator('p.ayuda').first().innerText()).includes('También mira si faltan o sobran っ, ん o vocales largas.'), 'La explicación lo cuenta');
await s.p.screenshot({ path: join(CAPTURAS, '1-antes.png') });

const yaGuardado = await s.p.evaluate(async () => !!(await (await caches.open('kotonoha-modelo-moras')).match('https://github.com/darashi/narabas-models/releases/download/v0/narabas-v0.onnx')));
let r = await grabar(s.p, s.panel, bien);
console.log(`      pasos: ${r.pasos.join(' → ')}`);
comprobar(await r.resultado.isVisible(), 'Analiza la grabación bien dicha', r.error || `${r.segundos} s`);
if (!yaGuardado) comprobar(r.pasos.some((x) => x.startsWith('Descargando el modelo de las moras')) && r.pasos.includes('Comprobando la descarga…'), 'La primera vez descarga el modelo y lo comprueba', r.pasos.join(' → '));
let lista = await juicios(s.p);
for (const j of lista) console.log(`      ${j.texto}`);
comprobar(lista.some((j) => j.veredicto === 'Moras' && j.texto.includes('Ni faltan ni sobran っ, ん o vocales largas.')), 'Bien dicha, ni faltan ni sobran moras');
comprobar(!lista.some((j) => j.veredicto === 'Mora'), 'Y no avisa de ninguna');
await s.panel.screenshot({ path: join(CAPTURAS, '2-bien.png') });
comprobar(s.errores.length === 0, 'Sin errores en la página', s.errores.join(' | '));

// El modelo queda en Ajustes, con lo que ocupa y para borrarlo.
await s.p.goto(`chrome-extension://${s.id}/app.html#/ajustes`);
await s.p.waitForTimeout(1500);
const fila = s.p.locator('.ap-opcion', { hasText: 'narabas, para las moras de la práctica del acento' });
comprobar(await fila.isVisible(), 'Ajustes lista el modelo de las moras entre los guardados');
comprobar((await fila.innerText()).includes('1,3 GB') && (await fila.getByRole('button', { name: 'Borrar: narabas' }).isVisible()), 'Con su tamaño y un botón para borrarlo', await fila.innerText().catch(() => ''));

// El trabajador directamente: el dispositivo, y lo que oye en la grabación bien dicha, a 16 kHz, comparado con Node.
const pcm16 = (() => {
  const salida = join(CAPTURAS, 'bien-16k.raw');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', resolve(bien), '-ac', '1', '-ar', '16000', '-f', 'f32le', salida]);
  const b = readFileSync(salida);
  return Array.from(new Float32Array(b.buffer, b.byteOffset, b.length / 4));
})();
for (const cpu of [false, true]) {
  const directo = await s.p.evaluate(
    ({ muestras, cpu }) =>
      new Promise((ok) => {
        const w = new Worker(chrome.runtime.getURL('narabas.js'), { type: 'module' });
        w.onmessage = (e) => {
          if (e.data.tipo !== 'fonemas' && e.data.tipo !== 'error') return;
          w.terminate();
          ok(e.data);
        };
        w.postMessage({ tipo: 'oir', id: 1, muestras: Float32Array.from(muestras), cpu });
      }),
    { muestras: pcm16, cpu }
  );
  console.log(`      ${cpu ? 'procesador' : 'como se elige'}: ${directo.dispositivo}, ${directo.ms} ms: ${directo.fonemas?.join(' ') ?? directo.mensaje}`);
  if (!cpu) comprobar(['webgpu', 'wasm'].includes(directo.dispositivo), 'El trabajador elige un dispositivo que calcula bien', directo.dispositivo);
  if (fonemasBien) comprobar(directo.fonemas?.join(' ') === fonemasBien, `${cpu ? 'En el procesador' : 'En el dispositivo elegido'} oye lo mismo que ONNX Runtime en Node`, directo.fonemas?.join(' '));
}
await s.contexto.close();

// ---------- Con dos moras de menos ----------

s = await abrir(mal, {});
comprobar((await s.panel.getByRole('switch', { name: OPCION }).getAttribute('aria-checked')) === 'true', 'El interruptor sigue encendido en otra sesión');
r = await grabar(s.p, s.panel, mal);
console.log(`      pasos: ${r.pasos.join(' → ')}`);
comprobar(await r.resultado.isVisible(), 'Analiza la grabación con moras de menos', r.error || `${r.segundos} s`);
comprobar(!r.pasos.some((x) => x.startsWith('Descargando el modelo de las moras')), 'Ya no descarga nada');
lista = await juicios(s.p);
for (const j of lista) console.log(`      ${j.texto}`);
const moras = lista.filter((j) => j.veredicto === 'Mora').map((j) => j.texto);
comprobar(moras.some((t) => t.includes('En «ばあ» la vocal larga se oye corta: dura dos moras.')), 'Ve la vocal larga de おばあさん dicha corta', moras.join(' | '));
comprobar(moras.some((t) => t.includes('En «きって» no se oye la っ: es una pausa breve, del largo de una mora.')), 'Ve la っ de 切手 que falta', moras.join(' | '));
comprobar(moras.length === 2, 'Y nada más', `${moras.length} avisos`);
const marcadas = await s.panel.locator('.ap-practica-moras span.revisar').allInnerTexts();
comprobar(marcadas.join(' ') === 'あ っ', 'Marca esas moras en el acento esperado', marcadas.join(' '));
await s.panel.screenshot({ path: join(CAPTURAS, '3-mal.png') });
await s.ajustar({ tema: 'claro' });
await s.p.waitForTimeout(700);
await s.panel.screenshot({ path: join(CAPTURAS, '4-mal-claro.png') });
await s.ajustar({ tema: 'oscuro' });
comprobar(s.errores.length === 0, 'Sin errores en la página', s.errores.join(' | '));
await s.contexto.close();
console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
