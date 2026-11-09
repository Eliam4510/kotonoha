// Prueba el modo Dictado sobre el video: oculta la frase, pausa al final, se escribe lo oído y se compara (en japonés,
// por la lectura: lo escrito en kana vale igual), y «Seguir» pasa a la próxima frase. La página y el video son los de
// pruebas/experiencia.mjs. No gasta nada.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/dictado-video.mjs

import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';
import { iniciarMock } from './mock-claude.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
// El perfil con diccionarios: así la comprobación conoce las otras lecturas de cada palabra (後: あと, のち, ご).
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-local'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'dictado-video');
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

await p.goto(`https://www.youtube.com/watch?v=${ID}`);
await hasta((r) => r.querySelector('.barra') != null, undefined, 30000);
await irA(1.5);
// Primero, que los subtítulos estén cargados y analizados; luego, el modo Dictado.
await hasta((r) => r.querySelector('.linea-sub.objetivo .pal') != null, undefined, 60000);
await sw.evaluate(async () => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ ajustes: { ...d.ajustes, modo: 'dictado' } });
});
await p.waitForTimeout(800);
// En el modo Dictado la frase no se ve mientras suena.
await p.evaluate(() => { const v = document.querySelector('#v'); v.currentTime = 0.6; v.play(); });
await p.waitForTimeout(700);
comprobar(!(await enOverlay((r) => !!r.querySelector('.subs-bloque:not(.saliendo) .linea-sub.objetivo .pal'))), 'Mientras suena, la frase no se ve');
const caja = await hasta((r) => r.querySelector('.dictado-video input') != null, undefined, 8000);
comprobar(!!caja, 'Al acabar la frase, el video se para y aparece el cuadro para escribir');
comprobar(await p.evaluate(() => document.querySelector('#v').paused), 'Con el video en pausa');
await p.screenshot({ path: join(CAPTURAS, '1-escribir.png') });

// Escrito en kana: se compara cómo se lee.
const campo = p.locator('.dictado-video input');
await campo.fill('じゅぎょうのあとはべんきょうします');
await campo.press('Enter');
const nota = await hasta((r) => r.querySelector('.dictado-nota')?.textContent ?? null, undefined, 10000);
comprobar(Number(String(nota).replace(/\D/g, '')) >= 90, 'Escrito en kana, la frase sale bien', nota);
const partes = await enOverlay((r) => [...r.querySelectorAll('.dictado-frase span')].map((s) => `${s.textContent}:${s.className.replace('dictado-', '')}`));
comprobar(partes.length > 3 && partes.join('').includes('授業'), 'Y se ve la frase de verdad, parte a parte', partes.join(' '));
await p.screenshot({ path: join(CAPTURAS, '2-resultado.png') });

// Repetir con tu voz: la práctica del acento con esa misma frase, en la ventana de Kotonoha.
const [ventana] = await Promise.all([contexto.waitForEvent('page', { timeout: 15000 }), p.locator('.dictado-video button', { hasText: 'Repetir con tu voz' }).click()]);
await ventana.waitForLoadState('domcontentloaded');
comprobar(decodeURIComponent(ventana.url()).includes('#/practicar?t=授業の後は勉強します'), 'Repetir con tu voz abre la práctica con esa frase', decodeURIComponent(ventana.url()).replace(/^.*#/, '#'));
const practica = await ventana.locator('.ap-practica').waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
// Con la frase partida en palabras y su acento esperado, y «Grabar» disponible.
const lista = await ventana.waitForFunction(() => !!document.querySelector('.ap-practica .ap-practica-moras, .ap-practica svg') && !document.querySelector('.ap-practica button[disabled]'), null, { timeout: 30000 }).then(() => true).catch(() => false);
comprobar(practica && lista && (await ventana.locator('.ap-practica').innerText()).includes('授業'), 'Con la frase lista para grabar');
await ventana.screenshot({ path: join(CAPTURAS, '3-repetir.png') });
await ventana.close();
await p.bringToFront();

// Lo que no se escribió queda marcado.
await p.locator('.dictado-video button', { hasText: 'Oír otra vez' }).click();
await hasta((r) => r.querySelector('.dictado-video input') != null, undefined, 8000);
await campo.fill('じゅぎょう');
await campo.press('Enter');
const nota2 = await hasta((r) => r.querySelector('.dictado-nota')?.textContent ?? null, undefined, 10000);
const mal = await enOverlay((r) => r.querySelectorAll('.dictado-frase .dictado-mal').length);
comprobar(Number(String(nota2).replace(/\D/g, '')) < 50 && mal >= 2, 'A medias, la nota baja y lo que falta queda marcado', `${nota2}, ${mal} partes sin oír`);

// Seguir pasa a la siguiente frase, que también se para al acabar.
await p.keyboard.press('Enter');
await p.waitForTimeout(300);
comprobar(!(await p.evaluate(() => document.querySelector('#v').paused)), 'Enter sigue con el video');
const otra = await hasta((r) => r.querySelector('.dictado-video input') != null, undefined, 8000);
comprobar(!!otra, 'Y la siguiente frase vuelve a pedir lo oído');

comprobar(errores.length === 0, 'Sin errores en la página', errores.join(' | '));
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
