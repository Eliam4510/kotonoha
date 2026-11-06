// Cuánto cuesta la interfaz en un navegador sin aceleración por hardware: todo lo pinta el procesador,
// y un desenfoque de fondo sobre un video en movimiento se recalcula en cada fotograma.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/sin-gpu.mjs

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-sin-gpu'));
const FIXTURES = join(RAIZ, 'pruebas', 'fixtures');
const FFMPEG = process.env.KK_FFMPEG ?? 'C:\\ffmpeg\\bin\\ffmpeg.exe';
const VIDEO = join(FIXTURES, 'video-1080.mp4');
const SEGUNDOS = Number(process.env.KK_SEGUNDOS ?? 8);

rmSync(PERFIL, { recursive: true, force: true });
mkdirSync(FIXTURES, { recursive: true });
if (!existsSync(VIDEO)) {
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=s=1920x1080:r=30:d=30', '-c:v', 'libx264', '-preset', 'veryfast', '-b:v', '5M', '-maxrate', '6M', '-bufsize', '6M', '-g', '60', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', VIDEO]);
}

const FRASE = '今日はとても大切な話をしますので最後までゆっくり聞いてください';
const CUES = Array.from({ length: 30 }, (_, i) => [i * 2000, i * 2000 + 1980, `${FRASE}${i}`]);
const json3 = JSON.stringify({ events: CUES.map(([a, b, t]) => ({ tStartMs: a, dDurationMs: b - a, segs: [{ utf8: t }] })) });
const ID = 'singpu00001';
const PAGINA = `<!doctype html><meta charset="utf-8"><title>Prueba sin GPU - YouTube</title>
<body style="margin:0;background:#000;overflow:hidden">
<div id="movie_player" style="position:relative;width:100vw;height:100vh;background:#000"><video id="v" src="https://media.test/video.mp4" muted loop style="width:100%;height:100%"></video></div>
<script>
  const pistas = [{ languageCode: 'ja', vssId: '.ja', name: { simpleText: '日本語' } }].map((t) => ({ ...t, baseUrl: 'https://www.youtube.com/api/timedtext?v=${ID}&lang=ja', url: 'https://www.youtube.com/api/timedtext?v=${ID}&pot=x&lang=ja' }));
  const j = document.getElementById('movie_player');
  const v = document.getElementById('v');
  j.getPlayerResponse = () => ({ videoDetails: { videoId: '${ID}', title: 'Prueba' }, captions: { playerCaptionsTracklistRenderer: { captionTracks: pistas } } });
  j.getAudioTrack = () => ({ captionTracks: pistas });
  j.getVideoData = () => ({ video_id: '${ID}', title: 'Prueba' });
  j.seekTo = (s) => { v.currentTime = s; };
  j.playVideo = () => v.play();
  j.pauseVideo = () => v.pause();
  j.loadModule = () => {};
  j.setOption = () => {};
</script>`;

const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1705, height: 1264 },
  deviceScaleFactor: 1.5,
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--autoplay-policy=no-user-gesture-required', '--disable-gpu-compositing', '--disable-gpu-rasterization', '--disable-accelerated-video-decode', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const bytesVideo = readFileSync(VIDEO);
await contexto.route('https://media.test/**', (r) => {
  const rango = /bytes=(\d+)-(\d*)/.exec(r.request().headers().range ?? '') ?? [];
  const desde = Number(rango[1] ?? 0);
  // Por trozos: el protocolo del navegador no admite un archivo entero de una vez.
  const hasta = Math.min(rango[2] ? Number(rango[2]) : bytesVideo.length - 1, desde + 4 * 1024 * 1024 - 1);
  return r.fulfill({ status: 206, body: bytesVideo.subarray(desde, hasta + 1), headers: { 'content-type': 'video/mp4', 'accept-ranges': 'bytes', 'content-range': `bytes ${desde}-${hasta}/${bytesVideo.length}` } });
});
await contexto.route('https://www.youtube.com/**', (r) => {
  const u = new URL(r.request().url());
  if (u.pathname.includes('/api/timedtext')) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: json3 });
  if (u.pathname === '/watch') return r.fulfill({ status: 200, contentType: 'text/html', body: PAGINA });
  return r.fulfill({ status: 204 });
});

const sw = await recargarExtension(contexto);
await sw.evaluate(async () => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), modo: 'normal', salto: 'no', navegadorAbierto: false, analisisAutomatico: false, idiomaObjetivo: 'ja', subsPosicion: null } });
});

const p = await contexto.newPage();
await p.goto(`https://www.youtube.com/watch?v=${ID}`);
await p.waitForFunction(() => !!document.querySelector('kotonoha-overlay')?.shadowRoot?.querySelector('.barra'), undefined, { timeout: 30000 });
await p.evaluate(() => document.querySelector('#v').play());
await p.waitForFunction(() => !!document.querySelector('kotonoha-overlay')?.shadowRoot?.querySelector('.subs-fondo'), undefined, { timeout: 30000 });
await p.mouse.move(40, 1200);

const gpu = await p.evaluate(async () => {
  const c = document.createElement('canvas').getContext('webgl');
  const ext = c?.getExtension('WEBGL_debug_renderer_info');
  const a = navigator.gpu ? await navigator.gpu.requestAdapter().catch(() => null) : null;
  return { webgl: c ? c.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : c.RENDERER) : 'sin WebGL', webgpu: !!a };
});
console.log('Navegador:', gpu);
await p.waitForFunction(() => document.querySelector('kotonoha-overlay').shadowRoot.querySelector('.kk-raiz').classList.contains('sin-gpu'), undefined, { timeout: 10000 }).catch(() => {});
const ligero = await p.evaluate(() => {
  const r = document.querySelector('kotonoha-overlay').shadowRoot;
  return { clase: r.querySelector('.kk-raiz').classList.contains('sin-gpu'), desenfoque: getComputedStyle(r.querySelector('.subs-fondo')).backdropFilter };
});
console.log('Detección:', ligero);
if (!ligero.clase || ligero.desenfoque !== 'none') {
  console.log('FALLO: sin GPU la interfaz debería quitar el desenfoque');
  process.exitCode = 1;
}

const tiempoCpu = () => Number(execFileSync('powershell', ['-NoProfile', '-Command', '(Get-Process msedge -ErrorAction SilentlyContinue | Measure-Object CPU -Sum).Sum'], { encoding: 'utf8' }).trim().replace(',', '.'));
const nucleos = Number(process.env.NUMBER_OF_PROCESSORS ?? 1);

async function medir(nombre, css) {
  await p.evaluate((css) => {
    const h = document.querySelector('kotonoha-overlay');
    const r = h.shadowRoot;
    r.getElementById('prueba-gpu')?.remove();
    h.style.display = css === 'sinInterfaz' ? 'none' : '';
    if (css && css !== 'sinInterfaz') {
      const e = document.createElement('style');
      e.id = 'prueba-gpu';
      e.textContent = css;
      r.appendChild(e);
    }
  }, css);
  await p.waitForTimeout(500);
  const c0 = tiempoCpu();
  const reloj0 = Date.now();
  const m = await p.evaluate(async (seg) => {
    const v = document.querySelector('#v');
    const q0 = v.getVideoPlaybackQuality();
    const r = document.querySelector('kotonoha-overlay').shadowRoot;
    const d = [];
    let conFondo = 0;
    await new Promise((ok) => {
      const t0 = performance.now();
      let prev = t0;
      const f = (t) => {
        d.push(t - prev);
        prev = t;
        if (r.querySelector('.subs-fondo')) conFondo++;
        if (t - t0 < seg * 1000) requestAnimationFrame(f);
        else ok();
      };
      requestAnimationFrame(f);
    });
    d.shift();
    const s = [...d].sort((a, b) => a - b);
    const q = (x) => +s[Math.floor(x * (s.length - 1))].toFixed(1);
    const q1 = v.getVideoPlaybackQuality();
    return { fps: +(d.length / seg).toFixed(1), p50: q(0.5), p95: q(0.95), max: q(1), largos: d.filter((x) => x > 34).length, cuadrosVideo: q1.totalVideoFrames - q0.totalVideoFrames, perdidos: q1.droppedVideoFrames - q0.droppedVideoFrames, conFondo: +(conFondo / d.length).toFixed(2) };
  }, SEGUNDOS);
  const cpu = ((tiempoCpu() - c0) / ((Date.now() - reloj0) / 1000)) / nucleos;
  console.log(`${nombre.padEnd(30)} procesador ${(cpu * 100).toFixed(1).padStart(5)} % | ${JSON.stringify(m)}`);
  return { cpu, ...m };
}

const CON_DESENFOQUE = '.kk-raiz.sin-gpu .subs-bloque.con-sombra .subs-fondo{backdrop-filter:blur(16px) saturate(1.35)!important}';
await p.evaluate(() => document.querySelector('kotonoha-overlay').shadowRoot.querySelector('[aria-label="Generar subtítulos"]').click());
await p.waitForTimeout(500);
const avisaWhisper = await p.evaluate(() => [...document.querySelector('kotonoha-overlay').shadowRoot.querySelectorAll('.nota-grupo')].some((n) => n.textContent.includes('aceleración por hardware')));
console.log(`${avisaWhisper ? 'ok   ' : 'FALLO'} El panel avisa de que Whisper correrá en el procesador`);
if (!avisaWhisper) process.exitCode = 1;
await p.evaluate(() => document.querySelector('kotonoha-overlay').shadowRoot.querySelector('[aria-label="Generar subtítulos"]').click());

const rondas = Number(process.env.KK_RONDAS ?? 2);
for (let i = 0; i < rondas; i++) {
  console.log(`\n-- Ronda ${i + 1}`);
  await medir('Sin interfaz', 'sinInterfaz');
  await medir('Interfaz tal cual', '');
  await medir('Forzando el desenfoque', CON_DESENFOQUE);
}

await contexto.close();
rmSync(PERFIL, { recursive: true, force: true });
process.exit(process.exitCode ?? 0);
