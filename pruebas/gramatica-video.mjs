// Prueba la gramática con estados sobre el video: bajo la frase sale el punto que lleva (〜ことができる, por reglas), su
// globo tiene los tres estados y dónde se ha visto, «Aprendiendo» se ve en el chip y lo sabido deja de señalarse. Deja el
// punto como estaba. La página y el video son los de pruebas/dictado-video.mjs, con el Claude simulado. No gasta nada.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/gramatica-video.mjs

import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';
import { iniciarMock } from './mock-claude.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-local'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'gramatica-video');
const VIDEO = join(RAIZ, 'pruebas', 'fixtures', 'video.webm');
mkdirSync(CAPTURAS, { recursive: true });
if (!existsSync(PERFIL) && existsSync(join(RAIZ, '.perfil-base', 'Default/IndexedDB'))) {
  cpSync(join(RAIZ, '.perfil-base', 'Default/IndexedDB'), join(PERFIL, 'Default/IndexedDB'), { recursive: true });
}
const pedidas = process.argv.slice(2);
const quiere = (n) => !pedidas.length || pedidas.includes(n);

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};

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

const id = new URL(sw.url()).host;
// Los métodos del motor se llaman desde una página de la extensión: la del video no puede.
const app = await contexto.newPage();
await app.goto(`chrome-extension://${id}/app.html#/inicio`);
const motor = async (metodo, ...args) => {
  for (let intento = 0; ; intento++) {
    const r = await app.evaluate(({ metodo, args }) => chrome.runtime.sendMessage({ canal: 'motor', metodo, args }), { metodo, args }).catch(() => null);
    if (r?.ok) return r.valor;
    if (intento > 40 || r?.error) throw new Error(`${metodo}: ${r?.error ?? 'sin respuesta'}`);
    await app.waitForTimeout(250);
  }
};
const PATRON = '〜ことができる';
const previoEstado = (await motor('estadosGramatica'))[PATRON] ?? 'nuevo';
await motor('fijarEstadoGramatica', PATRON, 'nuevo');

await p.bringToFront();
await p.goto(`https://www.youtube.com/watch?v=${ID}`);
await hasta((r) => r.querySelector('.barra') != null, undefined, 30000);
await irA(3.5);
await hasta((r) => r.querySelector('.linea-sub.objetivo .pal') != null, undefined, 60000);
const chip = await hasta((r) => (r.querySelector('.fila-gram .chip-gram') ? [...r.querySelectorAll('.fila-gram .chip-gram')].map((b) => b.textContent).join(' ') : null), undefined, 15000);
comprobar(/ことができる/.test(chip ?? '') && !/ておく/.test(chip ?? ''), 'Bajo la frase, el punto de gramática que lleva, con su nivel, y no 〜ておく por できます', chip);

await enOverlay((r) => { [...r.querySelectorAll('.fila-gram .chip-gram')].find((b) => b.textContent.includes('ことができる'))?.click(); return true; });
const titulo = await hasta((r) => r.querySelector('.popup-gramatica h3')?.textContent ?? null, undefined, 8000);
comprobar(/ことができる/.test(titulo ?? ''), 'Al tocarlo se abre su globo', titulo);
const botones = await enOverlay((r) => [...r.querySelectorAll('.popup-gramatica .estado-gram button')].map((b) => `${b.textContent.trim()}:${b.getAttribute('aria-checked')}`));
comprobar(botones?.length === 3 && botones[0].endsWith(':true'), 'Con sus tres estados, y empieza como nuevo', botones?.join(' | '));
const visto = await hasta((r) => r.querySelector('.popup-gramatica .visto-en-titulo')?.textContent ?? null, undefined, 8000);
comprobar(/講義の動画/.test(visto ?? ''), 'Y dónde se ha visto: este video', visto);
const explicacion = await hasta((r) => { const t = r.querySelector('.popup-gramatica .panel-ia-texto')?.textContent ?? ''; return t.length > 40 && !r.querySelector('.popup-gramatica .cursor-ia') ? t : null; }, undefined, 10000);
comprobar(/ことができる/.test(explicacion ?? ''), 'Claude explica el punto en esa frase', (explicacion ?? '').slice(0, 60));

await enOverlay((r) => { r.querySelectorAll('.popup-gramatica .estado-gram button')[1]?.click(); return true; });
const aprendiendo = await hasta((r) => { const c = [...r.querySelectorAll('.fila-gram .chip-gram')].find((b) => b.textContent.includes('ことができる')); return c?.className.includes('estado-aprendiendo') ? c.className : null; }, undefined, 5000);
comprobar(!!aprendiendo, '«Aprendiendo» se ve en el chip', aprendiendo);
const marcado = await hasta((r) => (r.querySelectorAll('.popup-gramatica .estado-gram button')[1]?.getAttribute('aria-checked') === 'true' ? 'sí' : null), undefined, 3000);
comprobar(marcado === 'sí', 'Y en el globo', await enOverlay((r) => [...r.querySelectorAll('.popup-gramatica .estado-gram button')].map((x) => x.getAttribute('aria-checked')).join(',')));
await p.screenshot({ path: join(CAPTURAS, '1-globo.png') });

await enOverlay((r) => { r.querySelectorAll('.popup-gramatica .estado-gram button')[2]?.click(); return true; });
await p.waitForTimeout(900);
comprobar(!(await enOverlay((r) => [...r.querySelectorAll('.fila-gram .chip-gram')].some((b) => b.textContent.includes('ことができる')))), 'Lo sabido deja de señalarse bajo la frase');
comprobar((await motor('estadosGramatica'))[PATRON] === 'sabido', 'Y queda guardado');
comprobar(errores.length === 0, 'Sin errores en la página', errores.join(' | '));

// Como estaba.
await motor('fijarEstadoGramatica', PATRON, previoEstado);
await sw.evaluate(async (previo) => {
  await chrome.storage.local.set({ ajustes: previo.ajustes });
  for (const clave of ['urlBaseIA', 'claveAnthropic']) {
    if (previo[clave] !== undefined) await chrome.storage.local.set({ [clave]: previo[clave] });
    else await chrome.storage.local.remove(clave);
  }
}, previo);
await contexto.close();
mock.cerrar?.();
console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
