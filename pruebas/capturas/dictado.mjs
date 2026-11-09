// La imagen del modo Dictado del README en cada idioma de la interfaz que estudia japonés (el README japonés presenta el
// inglés): la página y el video de pruebas/dictado-video.mjs, con una frase escrita con algún fallo para que se vea cómo
// se compara. No gasta nada.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/capturas/dictado.mjs [es en de zh ko]

import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { recargarExtension } from '../extension.mjs';
import { iniciarMock } from '../mock-claude.mjs';

const RAIZ = resolve(import.meta.dirname, '..', '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
// El perfil con diccionarios: así la comprobación conoce las otras lecturas de cada palabra (後: あと, のち, ご).
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-local'));
const IMAGENES = join(RAIZ, 'docs', 'img');
const IDIOMAS = process.argv.slice(2).length ? process.argv.slice(2) : ['es', 'en', 'de', 'zh', 'ko'];
const VIDEO = join(RAIZ, 'pruebas', 'fixtures', 'video.webm');
mkdirSync(IMAGENES, { recursive: true });
if (!existsSync(PERFIL) && existsSync(join(RAIZ, '.perfil-base', 'Default/IndexedDB'))) {
  cpSync(join(RAIZ, '.perfil-base', 'Default/IndexedDB'), join(PERFIL, 'Default/IndexedDB'), { recursive: true });
}

const LARGA = '今日はとても長い説明をしますので最後までゆっくり聞いてくださいそれから次の話題に移りますが難しいところは何度でも繰り返して確認しましょうそして最後に今日の内容をまとめてみなさんと一緒に振り返っていきたいと思いますよろしくお願いします';
const CUES = [
  [1000, 2000, '授業の後は勉強します'],
  [2050, 3000, '明日もまた会いましょう'],
  [3000, 4000, '私はまだ立ち上がることができます'],
  [7000, 8000, 'ここから先は静かです'],
  [20000, 24000, LARGA],
];
const json3 = JSON.stringify({ events: CUES.map(([a, b, t]) => ({ tStartMs: a, dDurationMs: b - a, segs: [{ utf8: t }] })) });
const ES = JSON.stringify({ events: CUES.map(([a, b], i) => ({ tStartMs: a, dDurationMs: b - a, segs: [{ utf8: `Traducción de la línea ${i + 1}` }] })) });

const ID = 'experiencia1';
const PAGINA = `<!doctype html><meta charset="utf-8"><title>講義の動画 - YouTube</title>
<body style="margin:0;background:#0f0f0f;color:#fff;font-family:sans-serif">
<div style="height:56px"></div>
<div id="movie_player" style="position:relative;width:1280px;height:600px;margin:0 auto;background:#000"><video id="v" src="https://media.test/video.webm" muted style="width:100%;height:100%"></video></div>
<div style="height:3000px;padding:20px">Comentarios</div>
<button id="fs" style="position:fixed;right:0;bottom:0;width:40px;height:20px" onclick="document.getElementById('movie_player').requestFullscreen()">FS</button>
<script>
  const pistas = [
    { languageCode: 'ja', vssId: '.ja', name: { simpleText: '日本語' } },
    { languageCode: 'es', vssId: '.es', name: { simpleText: 'Español' } },
  ].map((t) => ({ ...t, baseUrl: 'https://www.youtube.com/api/timedtext?v=${ID}&lang=' + t.languageCode, url: 'https://www.youtube.com/api/timedtext?v=${ID}&pot=x&lang=' + t.languageCode }));
  const j = document.getElementById('movie_player');
  const v = document.getElementById('v');
  j.getPlayerResponse = () => ({ videoDetails: { videoId: '${ID}', title: '講義の動画' }, captions: { playerCaptionsTracklistRenderer: { captionTracks: pistas } } });
  j.getAudioTrack = () => ({ captionTracks: pistas });
  j.getVideoData = () => ({ video_id: '${ID}', title: '講義の動画' });
  j.seekTo = (s) => { v.currentTime = s; };
  j.playVideo = () => v.play();
  j.pauseVideo = () => v.pause();
  j.loadModule = () => {};
  j.setOption = () => {};
</script>`;

const mock = await iniciarMock();
const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1600, height: 900 },
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--autoplay-policy=no-user-gesture-required'],
});
const bytesVideo = readFileSync(VIDEO);
await contexto.route('https://media.test/**', (r) => {
  const rango = /bytes=(\d+)-(\d*)/.exec(r.request().headers().range ?? '');
  if (!rango) return r.fulfill({ status: 200, body: bytesVideo, headers: { 'content-type': 'video/webm', 'accept-ranges': 'bytes' } });
  const desde = Number(rango[1]);
  const hasta = rango[2] ? Number(rango[2]) : bytesVideo.length - 1;
  return r.fulfill({ status: 206, body: bytesVideo.subarray(desde, hasta + 1), headers: { 'content-type': 'video/webm', 'accept-ranges': 'bytes', 'content-range': `bytes ${desde}-${hasta}/${bytesVideo.length}` } });
});
await contexto.route('https://www.youtube.com/**', (r) => {
  const u = new URL(r.request().url());
  if (u.pathname.includes('/api/timedtext')) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: u.searchParams.get('lang') === 'es' ? ES : json3 });
  if (u.pathname === '/watch') return r.fulfill({ status: 200, contentType: 'text/html', body: PAGINA });
  return r.fulfill({ status: 204 });
});

const sw = await recargarExtension(contexto);
const previo = await sw.evaluate(async () => chrome.storage.local.get(['ajustes', 'urlBaseIA', 'claveAnthropic']));
await sw.evaluate(async (url) => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ urlBaseIA: url, claveAnthropic: 'clave-de-prueba', ajustes: { ...(d.ajustes ?? {}), modo: 'normal', salto: 'no', navegadorAbierto: false, analisisAutomatico: false, idiomaObjetivo: 'ja', idiomaSecundario: 'es', subsPosicion: null, destino: 'memoria', ankiPuerto: 1 } });
}, `http://127.0.0.1:${mock.puerto}`);

const leerAjustes = () => sw.evaluate(async () => (await chrome.storage.local.get('ajustes')).ajustes);
const p = await contexto.newPage();
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));

const enOverlay = (fn, arg) =>
  p.evaluate(({ fn, arg }) => {
    const r = document.querySelector('kotonoha-overlay')?.shadowRoot;
    return r ? new Function('r', 'arg', `return (${fn})(r, arg)`)(r, arg) : null;
  }, { fn: fn.toString(), arg });

async function hasta(fn, arg, ms = 20000) {
  const limite = Date.now() + ms;
  for (;;) {
    const v = await enOverlay(fn, arg).catch(() => null);
    if (v) return v;
    if (Date.now() > limite) return null;
    await p.waitForTimeout(80);
  }
}

const irA = (s) => p.evaluate((x) => { const v = document.querySelector('#v'); v.pause(); v.currentTime = x; }, s);
const rectBloque = () => enOverlay((r) => { const b = r.querySelector('.subs-bloque:not(.saliendo)'); if (!b) return null; const c = b.getBoundingClientRect(); return { left: c.left, top: c.top, width: c.width, height: c.height, right: c.right, bottom: c.bottom }; });
const rectVideo = () => p.evaluate(() => { const c = document.querySelector('#v').getBoundingClientRect(); return { left: c.left, top: c.top, width: c.width, height: c.height, bottom: c.bottom, right: c.right }; });
const barraVisible = () => enOverlay((r) => !!r.querySelector('.barra.visible'));

for (const idioma of IDIOMAS) {
  await sw.evaluate(async (idioma) => {
    const d = await chrome.storage.local.get('ajustes');
    await chrome.storage.local.set({ ajustes: { ...d.ajustes, idiomaInterfaz: idioma, modo: 'normal' } });
  }, idioma);
  await p.goto(`https://www.youtube.com/watch?v=${ID}`);
  await hasta((r) => r.querySelector('.barra') != null, undefined, 30000);
  await irA(1.5);
  await hasta((r) => r.querySelector('.linea-sub.objetivo .pal') != null, undefined, 60000);
  await sw.evaluate(async () => {
    const d = await chrome.storage.local.get('ajustes');
    await chrome.storage.local.set({ ajustes: { ...d.ajustes, modo: 'dictado' } });
  });
  await p.waitForTimeout(800);
  await p.evaluate(() => { const v = document.querySelector('#v'); v.currentTime = 0.6; v.play(); });
  await hasta((r) => r.querySelector('.dictado-video input') != null, undefined, 8000);
  // Con un fallo al final y una partícula de menos: se ve lo oído, lo que no y la nota.
  const campo = p.locator('.dictado-video input');
  await campo.fill('じゅぎょうのあとべんきょうする');
  await campo.press('Enter');
  await hasta((r) => r.querySelector('.dictado-nota')?.textContent ?? null, undefined, 10000);
  await p.mouse.move(800, 300);
  await p.waitForTimeout(900);
  const archivo = join(IMAGENES, idioma === 'es' ? 'dictado.png' : `dictado.${idioma}.png`);
  const r = await rectVideo();
  await sharp(await p.screenshot({ clip: { x: r.left, y: r.top, width: r.width, height: r.height } })).png({ palette: true, quality: 92, effort: 10 }).toFile(archivo);
  console.log('imagen:', archivo.slice(RAIZ.length + 1), errores.length ? errores.join(' | ') : '');
}

await sw.evaluate(async (previo) => {
  await chrome.storage.local.set({ ajustes: previo.ajustes });
  for (const clave of ['urlBaseIA', 'claveAnthropic']) {
    if (previo[clave] !== undefined) await chrome.storage.local.set({ [clave]: previo[clave] });
    else await chrome.storage.local.remove(clave);
  }
}, previo);
await contexto.close();
mock.cerrar?.();
process.exit(0);
