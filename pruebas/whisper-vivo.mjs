// Prueba del modo en tiempo real: un micrófono falso reproduce el audio como si fuera la pestaña,
// mientras se informa de un video que empieza en el segundo 1000 y da un salto a mitad.
// Uso: KK_SALIDA=.dist-whisper node build.mjs && node pruebas/whisper-vivo.mjs ruta/audio.wav [modelo]

import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { iniciarMock } from './mock-claude.mjs';
import { recargarExtension } from './extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-whisper'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-whisper'));
const [audio, modelo = 'turbo'] = process.argv.slice(2);
const mock = await iniciarMock();

const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  args: [
    `--disable-extensions-except=${DIST}`,
    `--load-extension=${DIST}`,
    '--enable-unsafe-webgpu',
    '--enable-gpu',
    '--ignore-gpu-blocklist',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${audio}%noloop`,
  ],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
await sw.evaluate(
  async ({ m, url }) => {
    const d = await chrome.storage.local.get('ajustes');
    await chrome.storage.local.set({ urlBaseIA: url, claveAnthropic: 'clave-de-prueba', ajustes: { ...(d.ajustes ?? {}), whisperModelo: m } });
  },
  { m: modelo, url: `http://127.0.0.1:${mock.puerto}` }
);

const p = await contexto.newPage();
await p.goto(`chrome-extension://${id}/app.html#/inicio`);
await p.waitForTimeout(1000);
const motor = (metodo, ...args) =>
  p.evaluate(({ metodo, args }) => chrome.runtime.sendMessage({ canal: 'motor', metodo, args }), { metodo, args }).then((r) => {
    if (!r?.ok) throw new Error(r?.error ?? 'sin respuesta');
    return r.valor;
  });

await p.evaluate(() => {
  globalThis.__lineas = [];
  globalThis.__eventos = [];
  globalThis.__fin = null;
  const puerto = chrome.runtime.connect({ name: 'kotonoha-flujo' });
  let buffer = '';
  puerto.onMessage.addListener((m) => {
    if (m.tipo === 'parte') {
      buffer += m.texto;
      const i = buffer.lastIndexOf('\n');
      if (i < 0) return;
      for (const f of buffer.slice(0, i).split('\n')) {
        const e = JSON.parse(f);
        if (e.tipo === 'lineas') globalThis.__lineas.push(...e.lineas);
        else if (e.tipo !== 'descarga') globalThis.__eventos.push(e.tipo);
      }
      buffer = buffer.slice(i + 1);
    } else if (m.tipo === 'fin') globalThis.__fin = { ok: m.texto };
    else globalThis.__fin = { error: m.error };
  });
  globalThis.__puerto = puerto;
});

// La captura empieza justo antes de que el modelo termine de cargar: el audio se pierde si llega antes.
await motor('whisperMarca', 1000000, false, 1, false);
await p.evaluate(() => globalThis.__puerto.postMessage({ metodo: 'transcribirEnVivo', args: [] })).catch(() => {});
await motor('whisperCapturaPrueba').catch((e) => console.log('Captura:', e.message));
console.log('Micrófono falso activo. Reproduciendo…');

const inicio = Date.now();
const DURACION = 36000;
const SALTO_EN = 16000;
let salto = false;
const ahoraVideo = () => {
  const t = Date.now() - inicio;
  return t < SALTO_EN ? 1000000 + t : 2000000 + (t - SALTO_EN);
};
while (Date.now() - inicio < DURACION) {
  const esSalto = !salto && Date.now() - inicio >= SALTO_EN;
  if (esSalto) salto = true;
  await motor('whisperMarca', ahoraVideo(), true, 1, esSalto);
  await new Promise((r) => setTimeout(r, 250));
}
await motor('whisperDetener');
for (let i = 0; i < 240; i++) {
  if (await p.evaluate(() => globalThis.__fin)) break;
  await new Promise((r) => setTimeout(r, 250));
}
const fin = await p.evaluate(() => globalThis.__fin);
const lineas = await p.evaluate(() => globalThis.__lineas);
console.log('Fin:', JSON.stringify(fin));
console.log('Eventos:', (await p.evaluate(() => globalThis.__eventos)).join(' '));
for (const l of lineas) console.log(`${(l.inicio / 1000).toFixed(1).padStart(8)} → ${(l.fin / 1000).toFixed(1).padStart(8)}  ${l.texto}`);
await contexto.close();
mock.servidor.close();
process.exit(0);
