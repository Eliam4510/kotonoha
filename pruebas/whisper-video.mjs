// La prueba que más se parece al uso real: un video reproduciéndose en una ventana visible mientras
// Whisper transcribe en el mismo navegador. Cuenta cuadros perdidos del video y saltos de animación.
//
// Uso: KK_SALIDA=.dist-carga node build.mjs && node pruebas/whisper-video.mjs video.mp4 audio.pcm "sin,0.6,0.9" [segundos]
// Abre una ventana pequeña de Edge en una esquina de la pantalla.

import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';
import { iniciarMock } from './mock-claude.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-carga'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-whisper'));
const [video, pcm, listaPerfiles = 'sin,0.6,0.9', segundosTexto = '30'] = process.argv.slice(2);
const SEGUNDOS = Number(segundosTexto);

function servirArchivo(ruta, tipo, res, req) {
  const tam = statSync(ruta).size;
  res.setHeader('content-type', tipo);
  res.setHeader('accept-ranges', 'bytes');
  res.setHeader('access-control-allow-origin', '*');
  const r = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? '');
  if (r) {
    const ini = +r[1];
    const fin = r[2] ? +r[2] : tam - 1;
    res.statusCode = 206;
    res.setHeader('content-range', `bytes ${ini}-${fin}/${tam}`);
    res.setHeader('content-length', fin - ini + 1);
    createReadStream(ruta, { start: ini, end: fin }).pipe(res);
  } else {
    res.setHeader('content-length', tam);
    createReadStream(ruta).pipe(res);
  }
}

const servidor = createServer((req, res) => {
  if (req.url === '/') {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end('<!doctype html><title>Prueba</title><body style="margin:0;background:#000"><video id="v" src="/v.mp4" muted loop style="width:100%;height:100%"></video><div id="c" style="position:fixed;left:8px;top:8px;width:30px;height:30px;background:#6c6"></div></body>');
  } else if (req.url.startsWith('/v.mp4')) servirArchivo(video, 'video/mp4', res, req);
  else servirArchivo(pcm, 'application/octet-stream', res, req);
});
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${servidor.address().port}`;

const mock = await iniciarMock();
const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: false,
  viewport: null,
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--enable-unsafe-webgpu', '--window-size=720,460', '--window-position=3000,1600', '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
await sw.evaluate(
  async ({ u }) => {
    const d = await chrome.storage.local.get('ajustes');
    await chrome.storage.local.set({ urlBaseIA: u, claveAnthropic: 'clave-de-prueba', ajustes: { ...(d.ajustes ?? {}), activo: false, whisperModelo: 'turbo', whisperIntensidad: 'auto' } });
  },
  { u: `http://127.0.0.1:${mock.puerto}` }
);

// Página del motor: desde aquí se lanza la transcripción, en segundo plano.
const motorP = await contexto.newPage();
await motorP.goto(`chrome-extension://${id}/popup.html`);
await motorP.waitForTimeout(800);
await motorP.evaluate(() => chrome.runtime.sendMessage({ canal: 'fondo', metodo: 'asegurarMotor', args: [] }));
await motorP.waitForTimeout(1500);
const motor = (metodo, ...args) =>
  motorP.evaluate(({ metodo, args }) => chrome.runtime.sendMessage({ canal: 'motor', metodo, args }), { metodo, args }).then((r) => {
    if (!r?.ok) throw new Error(r?.error ?? 'sin respuesta');
    return r.valor;
  });

const p = await contexto.newPage();
await p.goto(`${base}/`);
await p.bringToFront();
await p.evaluate(() => document.querySelector('#v').play());
await p.waitForTimeout(2500);

const medir = (segundos) =>
  p.evaluate(async (s) => {
    const v = document.querySelector('#v');
    const c = document.querySelector('#c');
    const q0 = v.getVideoPlaybackQuality();
    const saltos = [];
    let previo = performance.now();
    let seguir = true;
    const cuadro = (t) => {
      saltos.push(t - previo);
      previo = t;
      c.style.transform = `translateX(${(t / 8) % 200}px)`;
      if (seguir) requestAnimationFrame(cuadro);
    };
    requestAnimationFrame(cuadro);
    await new Promise((r) => setTimeout(r, s * 1000));
    seguir = false;
    const q1 = v.getVideoPlaybackQuality();
    const o = [...saltos].sort((a, b) => a - b);
    return {
      cuadrosVideo: q1.totalVideoFrames - q0.totalVideoFrames,
      perdidos: q1.droppedVideoFrames - q0.droppedVideoFrames,
      mediana: +o[o.length >> 1].toFixed(1),
      p99: +o[Math.floor(o.length * 0.99)].toFixed(1),
      max: +o[o.length - 1].toFixed(1),
      mayor33: saltos.filter((x) => x > 33).length,
      mayor100: saltos.filter((x) => x > 100).length,
      visible: document.visibilityState,
    };
  }, segundos);

const filas = [];
for (const perfil of listaPerfiles.split(',')) {
  let puerto = false;
  if (perfil !== 'sin') {
    await motor('whisperOcupacionPrueba', Number(perfil));
    await motorP.evaluate((u) => {
      globalThis.__ultimo = null;
      globalThis.__fin = null;
      const pu = chrome.runtime.connect({ name: 'kotonoha-flujo' });
      globalThis.__puerto = pu;
      let buffer = '';
      pu.onMessage.addListener((m) => {
        if (m.tipo === 'parte') {
          buffer += m.texto;
          const i = buffer.lastIndexOf('\n');
          if (i < 0) return;
          for (const f of buffer.slice(0, i).split('\n')) {
            const e = JSON.parse(f);
            if (e.tipo !== 'lineas') globalThis.__ultimo = e.tipo;
          }
          buffer = buffer.slice(i + 1);
        } else globalThis.__fin = m;
      });
      pu.postMessage({ metodo: 'transcribirArchivo', args: [u, true, 0] });
    }, `${base}/a.pcm`);
    puerto = true;
    for (let i = 0; i < 400; i++) {
      if ((await motorP.evaluate(() => globalThis.__ultimo)) === 'procesando') break;
      await new Promise((r) => setTimeout(r, 250));
    }
    await p.bringToFront();
  }
  const m = await medir(SEGUNDOS);
  filas.push({ whisper: perfil === 'sin' ? 'sin Whisper' : `ocupación ${perfil}`, ...m });
  console.log(JSON.stringify(filas.at(-1)));
  if (puerto) {
    await motorP.evaluate(() => globalThis.__puerto.disconnect());
    await new Promise((r) => setTimeout(r, 4000));
  }
}
await motor('whisperOcupacionPrueba', null);
await sw.evaluate(async () => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), activo: true } });
});
console.table(filas);
await contexto.close();
mock.servidor.close();
servidor.close();
process.exit(0);
