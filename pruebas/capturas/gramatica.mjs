// La imagen de la gramática con estados del README en un idioma de la interfaz que estudia japonés: el globo de
// 〜ために sobre un discurso en la Dieta del canal del 首相官邸 (PDL 1.0, ver contenido-real.mjs), marcado como
// «Aprendiendo», con la explicación del Claude simulado en ese idioma y la frase traducida debajo. Deja el punto como
// estaba. Un idioma por vez, como el Dictado. Antes: node herramientas/contenido-readme.mjs.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/capturas/gramatica.mjs es   (y en, de, zh, ko)

import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { recargarExtension } from '../extension.mjs';
import { iniciarMock } from '../mock-claude.mjs';
import { archivoLibre, DIETA, json3, traduccionDieta } from './contenido-real.mjs';

const RAIZ = resolve(import.meta.dirname, '..', '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-local'));
const IMAGENES = join(RAIZ, 'docs', 'img');
const IDIOMA = process.argv[2] ?? 'es';
/** El nombre con que los ajustes guardan el idioma de las explicaciones, como en readme.mjs. */
const NOMBRE = { es: 'español', en: 'inglés', de: 'alemán', zh: 'chino simplificado', ko: 'coreano' };
const VIDEO = archivoLibre(DIETA.video);
mkdirSync(IMAGENES, { recursive: true });
if (!existsSync(PERFIL) && existsSync(join(RAIZ, '.perfil-base', 'Default/IndexedDB'))) {
  cpSync(join(RAIZ, '.perfil-base', 'Default/IndexedDB'), join(PERFIL, 'Default/IndexedDB'), { recursive: true });
}

const PRINCIPAL = json3(DIETA.lineas);
const SECUNDARIA = json3(traduccionDieta(IDIOMA));

const ID = DIETA.idVideo;
const PAGINA = `<!doctype html><meta charset="utf-8"><title>${DIETA.titulo} - YouTube</title>
<body style="margin:0;background:#0f0f0f;color:#fff;font-family:sans-serif">
<div style="height:56px"></div>
<div id="movie_player" style="position:relative;width:1280px;height:600px;margin:0 auto;background:#000"><video id="v" src="https://media.test/video.webm" muted style="width:100%;height:100%"></video></div>
<div style="height:3000px;padding:20px">Comentarios</div>
<button id="fs" style="position:fixed;right:0;bottom:0;width:40px;height:20px" onclick="document.getElementById('movie_player').requestFullscreen()">FS</button>
<script>
  const pistas = [
    { languageCode: 'ja', vssId: '.ja', name: { simpleText: '日本語' } },
    { languageCode: '${IDIOMA}', vssId: '.${IDIOMA}', name: { simpleText: '${IDIOMA}' } },
  ].map((t) => ({ ...t, baseUrl: 'https://www.youtube.com/api/timedtext?v=${ID}&lang=' + t.languageCode, url: 'https://www.youtube.com/api/timedtext?v=${ID}&pot=x&lang=' + t.languageCode }));
  const j = document.getElementById('movie_player');
  const v = document.getElementById('v');
  j.getPlayerResponse = () => ({ videoDetails: { videoId: '${ID}', title: '${DIETA.titulo}' }, captions: { playerCaptionsTracklistRenderer: { captionTracks: pistas } } });
  j.getAudioTrack = () => ({ captionTracks: pistas });
  j.getVideoData = () => ({ video_id: '${ID}', title: '${DIETA.titulo}' });
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
  args: ['--mute-audio', `--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--autoplay-policy=no-user-gesture-required'],
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
  if (u.pathname.includes('/api/timedtext')) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: u.searchParams.get('lang') === IDIOMA ? SECUNDARIA : PRINCIPAL });
  if (u.pathname === '/watch') return r.fulfill({ status: 200, contentType: 'text/html', body: PAGINA });
  return r.fulfill({ status: 204 });
});

const sw = await recargarExtension(contexto);
const previo = await sw.evaluate(async () => chrome.storage.local.get(['ajustes', 'urlBaseIA', 'claveAnthropic']));
await sw.evaluate(async ({ url, IDIOMA, explicaciones }) => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ urlBaseIA: url, claveAnthropic: 'clave-de-prueba', ajustes: { ...(d.ajustes ?? {}), modo: 'normal', salto: 'no', navegadorAbierto: false, analisisAutomatico: false, idiomaObjetivo: 'ja', idiomaSecundario: IDIOMA, idiomaInterfaz: IDIOMA, diccionarioPestana: 'ninguna', idiomaExplicaciones: explicaciones, idiomaTraduccion: explicaciones, subsPosicion: null, destino: 'memoria', ankiPuerto: 1 } });
}, { url: `http://127.0.0.1:${mock.puerto}`, IDIOMA, explicaciones: NOMBRE[IDIOMA] });

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

mock.control.idioma = IDIOMA;
const id = new URL(sw.url()).host;
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
const PATRON = '〜ために';
const previoEstado = (await motor('estadosGramatica'))[PATRON] ?? 'nuevo';
await motor('fijarEstadoGramatica', PATRON, 'nuevo');

await p.bringToFront();
await p.goto(`https://www.youtube.com/watch?v=${ID}`);
await hasta((r) => r.querySelector('.barra') != null, undefined, 30000);
// 「投資を強力に促進していくための認定制度を創設します。」
await irA(54);
await hasta((r) => [...r.querySelectorAll('.fila-gram .chip-gram')].some((b) => b.textContent.includes('ために')) || null, undefined, 60000);
await enOverlay((r) => { [...r.querySelectorAll('.fila-gram .chip-gram')].find((b) => b.textContent.includes('ために'))?.click(); return true; });
await hasta((r) => r.querySelector('.popup-gramatica .estado-gram button') != null || null, undefined, 8000);
await enOverlay((r) => { r.querySelectorAll('.popup-gramatica .estado-gram button')[1]?.click(); return true; });
await hasta((r) => (r.querySelectorAll('.popup-gramatica .estado-gram button')[1]?.getAttribute('aria-checked') === 'true' ? true : null), undefined, 5000);
await hasta((r) => { const t = r.querySelector('.popup-gramatica .panel-ia-texto')?.textContent ?? ''; return t.length > 40 && !r.querySelector('.popup-gramatica .cursor-ia') ? true : null; }, undefined, 10000);
await hasta((r) => r.querySelector('.popup-gramatica .visto-en-titulo') != null || null, undefined, 8000);
await p.mouse.move(300, 120);
await p.waitForTimeout(900);
const archivo = join(IMAGENES, IDIOMA === 'es' ? 'gramatica.png' : `gramatica.${IDIOMA}.png`);
const r = await rectVideo();
await sharp(await p.screenshot({ clip: { x: r.left, y: r.top, width: r.width, height: r.height } })).png({ palette: true, quality: 92, effort: 10 }).toFile(archivo);
console.log('imagen:', archivo.slice(RAIZ.length + 1), errores.length ? errores.join(' | ') : '');

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
process.exit(0);
