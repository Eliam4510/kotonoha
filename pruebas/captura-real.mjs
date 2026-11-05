// Prueba el creador de tarjetas con la captura de pestaña de verdad, sin simular nada: qué se graba, de qué
// tramo del video, qué sale en la imagen y qué ocurre si la captura está en otra pestaña.
//
// Abre un navegador visible, porque sin dispositivo de audio la captura sale muda. Suena muy bajo unos segundos.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/captura-real.mjs

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-captura'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'captura-real');
const FIXTURES = join(RAIZ, 'pruebas', 'fixtures');
const FFMPEG = existsSync('C:/ffmpeg/bin/ffmpeg.exe') ? 'C:/ffmpeg/bin/ffmpeg.exe' : 'ffmpeg';
// El de la clave de prueba: sin este permiso, Chrome solo concede la captura tras pulsar el icono o un atajo.
const ID_EXTENSION = process.env.KK_ID ?? 'pldipbgollbhkjjigkgnojdjpfhanhhf';
mkdirSync(CAPTURAS, { recursive: true });
rmSync(PERFIL, { recursive: true, force: true });

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};

// Cada segundo del video suena a una frecuencia distinta: 300 Hz el segundo 0, 400 Hz el 1, y así.
// Oír una frecuencia en el clip dice exactamente de qué momento del video viene.
const COLOR = [0x2f, 0x6f, 0xb0];
function generar(nombre, color) {
  const destino = join(FIXTURES, nombre);
  if (existsSync(destino)) return destino;
  console.log(`Generando ${nombre}...`);
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', `color=c=${color}:s=640x360:r=25:d=16`, '-f', 'lavfi', '-i', "aevalsrc='0.03*sin(2*PI*(300+100*floor(t))*t)':s=48000:d=16", '-c:v', 'libvpx', '-b:v', '150k', '-c:a', 'libopus', '-b:a', '96k', '-shortest', destino]);
  return destino;
}
const ARCHIVOS = { 'tonos.webm': readFileSync(generar('tonos.webm', '0x2f6fb0')), 'tonos-negro.webm': readFileSync(generar('tonos-negro.webm', 'black')) };

const CUES = [[3000, 4500, '授業の後は勉強します'], [7000, 8000, '明日もまた会いましょう'], [10000, 11500, '私はまだ立ち上がることができます']];
const json3 = JSON.stringify({ events: CUES.map(([a, b, t]) => ({ tStartMs: a, dDurationMs: b - a, segs: [{ utf8: t }] })) });

const pagina = (id, archivo) => `<!doctype html><meta charset="utf-8"><title>${id} - YouTube</title>
<body style="margin:0;background:#0f0f0f;color:#fff;font-family:sans-serif">
<div id="movie_player" style="position:relative;width:1000px;height:562px;margin:20px auto;background:#000"><video id="v" src="https://media.test/${archivo}" style="width:100%;height:100%"></video>
<div style="position:absolute;left:30px;top:30px;padding:20px 40px;background:#c00;color:#fff;font-size:30px;visibility:visible !important">CLASIFICACIÓN</div></div>
<script>
  const pistas = [{ languageCode: 'ja', vssId: '.ja', name: { simpleText: '日本語' } }].map((t) => ({ ...t, baseUrl: 'https://www.youtube.com/api/timedtext?v=${id}&lang=ja', url: 'https://www.youtube.com/api/timedtext?v=${id}&pot=x&lang=ja' }));
  const j = document.getElementById('movie_player');
  const v = document.getElementById('v');
  j.getPlayerResponse = () => ({ videoDetails: { videoId: '${id}', title: '${id}' }, captions: { playerCaptionsTracklistRenderer: { captionTracks: pistas } } });
  j.getAudioTrack = () => ({ captionTracks: pistas });
  j.getVideoData = () => ({ video_id: '${id}', title: '${id}' });
  j.seekTo = (s) => { v.currentTime = s; };
  j.playVideo = () => v.play();
  j.pauseVideo = () => v.pause();
  j.loadModule = () => {};
  j.setOption = () => {};
</script>`;

// La imagen oficial se sirve de verdad: el motor la descarga desde su propio documento.
const ESTILL = join(FIXTURES, 'still.jpg');
if (!existsSync(ESTILL)) execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=0xd07020:s=640x360:d=1', '-frames:v', '1', ESTILL]);
const servidorImagen = createServer((_, res) => {
  res.writeHead(200, { 'content-type': 'image/jpeg', 'access-control-allow-origin': '*' });
  res.end(readFileSync(ESTILL));
});
await new Promise((ok) => servidorImagen.listen(0, '127.0.0.1', ok));
const URL_ESTILL = `http://127.0.0.1:${servidorImagen.address().port}/still.jpg`;

const paginaNetflix = () => `<!doctype html><meta charset="utf-8"><title>Episodio de prueba - Netflix</title>
<body style="margin:0;background:#141414;overflow:hidden"><video id="v" src="https://media.test/tonos-negro.webm" style="display:block;width:100vw;height:100vh"></video>
<script>
  const pistas = [{ trackId: 't-ja', displayName: '日本語', bcp47: 'ja' }];
  const v = document.getElementById('v');
  const jugador = { getTimedTextTrackList: () => pistas, getTimedTextTrack: () => pistas[0], setTimedTextTrack: async () => {}, seek: (ms) => { v.currentTime = ms / 1000; }, play: () => v.play(), pause: () => v.pause(), getMovieId: () => 1 };
  window.netflix = { appContext: { state: { playerApp: {
    getAPI: () => ({ videoPlayer: { getAllPlayerSessionIds: () => ['watch1'], getVideoPlayerBySessionId: () => jugador }, getVideoMetadataByVideoId: () => ({ getCurrentVideo: () => ({ getTitle: () => 'Episodio de prueba', getLoadingImageUrl: () => '${URL_ESTILL}' }) }) }),
    getState: () => ({ videoPlayer: { cadmiumPlayerRepository: { playersById: { watch1: { datos: [{ type: 'timedtext', trackId: 't-ja', urls: [{ url: 'https://subs.test/t-ja.vtt' }] }] } } } } }),
  } } } };
</script>`;

const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: false,
  viewport: { width: 1280, height: 720 },
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, `--allowlisted-extension-id=${ID_EXTENSION}`, '--autoplay-policy=no-user-gesture-required'],
});
await contexto.route('https://media.test/**', (r) => {
  const nombre = new URL(r.request().url()).pathname.slice(1);
  const bytes = ARCHIVOS[nombre];
  const rango = /bytes=(\d+)-(\d*)/.exec(r.request().headers().range ?? '');
  if (!rango) return r.fulfill({ status: 200, body: bytes, headers: { 'content-type': 'video/webm', 'accept-ranges': 'bytes' } });
  const desde = Number(rango[1]);
  const hasta = rango[2] ? Number(rango[2]) : bytes.length - 1;
  return r.fulfill({ status: 206, body: bytes.subarray(desde, hasta + 1), headers: { 'content-type': 'video/webm', 'accept-ranges': 'bytes', 'content-range': `bytes ${desde}-${hasta}/${bytes.length}` } });
});
await contexto.route('https://www.youtube.com/**', (r) => {
  const u = new URL(r.request().url());
  if (u.pathname.includes('/api/timedtext')) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: json3 });
  if (u.pathname === '/watch') {
    const id = u.searchParams.get('v');
    return r.fulfill({ status: 200, contentType: 'text/html', body: pagina(id, id.startsWith('negro') ? 'tonos-negro.webm' : 'tonos.webm') });
  }
  return r.fulfill({ status: 204 });
});
await contexto.route('https://www.netflix.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: paginaNetflix() }));
await contexto.route('https://subs.test/**', (r) => r.fulfill({ status: 200, contentType: 'text/vtt', headers: { 'access-control-allow-origin': '*' }, body: `WEBVTT\n\n${CUES.map(([a, b, t]) => `${new Date(a).toISOString().slice(11, 23)} --> ${new Date(b).toISOString().slice(11, 23)}\n${t}\n`).join('\n')}` }));
await contexto.route('https://otra.test/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>otra</title><h1>Otra pestaña, sin sonido</h1>' }));

const sw = await recargarExtension(contexto);
await sw.evaluate(async () => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({
    ajustes: {
      ...(d.ajustes ?? {}),
      // Por partida doble, para no tocar jamás el Anki de quien ejecuta la prueba.
      destino: 'memoria',
      ankiPuerto: 1,
      modo: 'normal',
      salto: '4',
      navegadorAbierto: false,
      analisisAutomatico: false,
      corregirAutomaticos: false,
      idiomaObjetivo: 'ja',
      subsPosicion: null,
      popupAlPasar: true,
      rellenoInicioMs: 500,
      rellenoFinMs: 500,
      // Solo interesa lo que sale del video: nada de pedir nada a Claude ni descargar audios.
      prellenado: { fraseVideo: true, fraseIA: false, traduccionIA: false, traduccionSecundaria: false, definiciones: false, audioFraseVideo: true, audioFraseVoz: false, audioPalabraDiccionario: false, audioPalabraVoz: false, imagenCaptura: true, imagenBusqueda: false, ejemplos: false, explicacionIA: false },
    },
  });
});

const motor = async (metodo, ...args) => {
  const r = await sw.evaluate(({ metodo, args }) => chrome.runtime.sendMessage({ canal: 'motor', metodo, args }), { metodo, args });
  if (!r?.ok) throw new Error(`${metodo}: ${r?.error}`);
  return r.valor;
};

/** Lo que hace Alt+R en el navegador, salvo por el permiso de pulsar el atajo. */
const capturar = (url) =>
  sw.evaluate(async (u) => {
    // Una pestaña con la captura ya abierta no admite otra.
    await chrome.runtime.sendMessage({ canal: 'motor', metodo: 'detenerCaptura', args: [] });
    const [t] = await chrome.tabs.query({ url: u });
    const streamId = await new Promise((ok, mal) => chrome.tabCapture.getMediaStreamId({ targetTabId: t.id }, (s) => (chrome.runtime.lastError ? mal(new Error(chrome.runtime.lastError.message)) : ok(s))));
    const r = await chrome.runtime.sendMessage({ canal: 'motor', metodo: 'iniciarCaptura', args: [streamId] });
    if (!r?.ok) throw new Error(r?.error);
    await chrome.storage.session.set({ capturaPestana: t.id });
    for (const x of await chrome.tabs.query({})) chrome.tabs.sendMessage(x.id, { evento: { tipo: 'captura', activa: true } }).catch(() => {});
  }, url);

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
const estadoVideo = () => p.evaluate(() => { const v = document.querySelector('#v'); return { t: v.currentTime, pausado: v.paused, velocidad: v.playbackRate }; });
const micro = () => enOverlay((r) => r.querySelector('button[aria-label="Estado de la captura"]')?.classList.contains('en-marcha'));
const avisos = () => enOverlay((r) => [...r.querySelectorAll('.aviso')].map((a) => a.textContent).join(' | '));

async function abrir(id) {
  await p.goto(`https://www.youtube.com/watch?v=${id}`);
  await hasta((r) => r.querySelector('.barra') != null, undefined, 30000);
  await p.bringToFront();
  await irA(3.5);
  await hasta((r) => r.querySelector('.subs-bloque:not(.saliendo) .linea-sub.objetivo .pal') != null, undefined, 30000);
  await p.mouse.move(40, 700);
  await p.waitForTimeout(300);
}

/** Vigila cuándo se quita la interfaz, medido desde que se pulsa la tecla. */
const vigilarOverlay = () =>
  p.evaluate(() => {
    const h = document.querySelector('kotonoha-overlay');
    window.__cambios = [];
    window.__obs?.disconnect();
    window.__obs = new MutationObserver(() => window.__cambios.push({ ms: Math.round(performance.now() - window.__tecla), op: h.style.opacity }));
    window.__obs.observe(h, { attributes: true, attributeFilter: ['style'] });
    window.__tecla = performance.now();
  });

/** Pulsa Q y espera a que la tarjeta esté creada. Devuelve el borrador con el que se creó. */
async function crearConQ() {
  const antes = (await motor('memoriaResumen')).total;
  await vigilarOverlay();
  await p.keyboard.press('q');
  const limite = Date.now() + 30000;
  while ((await motor('memoriaResumen')).total === antes && Date.now() < limite) await p.waitForTimeout(100);
  const tarjetas = await motor('memoriaPendientes', 500);
  const ultima = tarjetas.sort((a, b) => b.creada - a.creada)[0];
  await p.waitForTimeout(300);
  if (!ultima || (await motor('memoriaResumen')).total === antes) {
    await p.screenshot({ path: join(CAPTURAS, 'sin-tarjeta.png') });
    throw new Error(`No se creó la tarjeta. Avisos: ${await avisos()}`);
  }
  return ultima.borrador;
}

/** Qué frecuencia suena en cada décima de segundo del clip. */
function tonosDe(base64) {
  const carpeta = mkdtempSync(join(tmpdir(), 'kk-clip-'));
  const mp3 = join(carpeta, 'clip.mp3');
  writeFileSync(mp3, Buffer.from(base64, 'base64'));
  const FREC = 8000;
  const bruto = execFileSync(FFMPEG, ['-loglevel', 'error', '-i', mp3, '-f', 's16le', '-ac', '1', '-ar', String(FREC), '-'], { maxBuffer: 1 << 26 });
  rmSync(carpeta, { recursive: true, force: true });
  const n = Math.floor(bruto.length / 2);
  const muestras = new Float64Array(n);
  for (let i = 0; i < n; i++) muestras[i] = bruto.readInt16LE(i * 2) / 32768;
  const ventana = FREC / 10;
  const tonos = [];
  for (let i = 0; i + ventana <= n; i += ventana) {
    let mejor = null;
    let energiaMejor = 1e-5;
    for (let f = 300; f <= 1800; f += 100) {
      let re = 0;
      let im = 0;
      for (let k = 0; k < ventana; k++) {
        re += muestras[i + k] * Math.cos((2 * Math.PI * f * k) / FREC);
        im += muestras[i + k] * Math.sin((2 * Math.PI * f * k) / FREC);
      }
      const e = (re * re + im * im) / (ventana * ventana);
      if (e > energiaMejor) {
        energiaMejor = e;
        mejor = f;
      }
    }
    tonos.push(mejor);
  }
  return { duracion: n / FREC, tonos };
}

const cuenta = (lista, f) => lista.filter((x) => x === f).length;

/** Qué parte de la imagen tiene un color: si hubiera interfaz encima, no sería casi toda. */
const parteDelColor = (datos, color = COLOR) =>
  p.evaluate(async ({ datos, color }) => {
    const b = await createImageBitmap(await (await fetch(`data:image/jpeg;base64,${datos}`)).blob());
    const c = new OffscreenCanvas(b.width, b.height);
    const x = c.getContext('2d');
    x.drawImage(b, 0, 0);
    const d = x.getImageData(0, 0, b.width, b.height).data;
    let dentro = 0;
    for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - color[0]) < 40 && Math.abs(d[i + 1] - color[1]) < 40 && Math.abs(d[i + 2] - color[2]) < 40) dentro++;
    return { parte: dentro / (d.length / 4), ancho: b.width, alto: b.height };
  }, { datos, color });

// ---------- La captura está en otra pestaña ----------

console.log('\n== La captura está en otra pestaña ==');
const otra = await contexto.newPage();
await otra.goto('https://otra.test/');
await abrir('tonos1');
await capturar('https://otra.test/*');
await p.waitForTimeout(400);
comprobar((await micro()) === false, 'El micrófono de esta pestaña no se muestra activo');
let b = await crearConQ();
comprobar(b.audioFrase.length === 0, 'La tarjeta no lleva una grabación muda');
comprobar(/Alt\+R/.test(await avisos()), 'Y avisa de que hay que pulsar Alt+R aquí', await avisos());
comprobar(b.imagenes.length === 1, 'La imagen sí sale');

// ---------- La captura está en esta pestaña, con la ficha abierta ----------

console.log('\n== Con la captura en esta pestaña y la ficha abierta ==');
await capturar('https://www.youtube.com/*');
await hasta((r) => r.querySelector('button[aria-label="Estado de la captura"]')?.classList.contains('en-marcha'), undefined, 3000);
comprobar((await micro()) === true, 'El micrófono se muestra activo');
await irA(3.5);
await p.waitForTimeout(400);
const palabra = await enOverlay((r) => { const c = r.querySelector('.linea-sub.objetivo .pal').getBoundingClientRect(); return { x: c.left + c.width / 2, y: c.top + c.height / 2 }; });
await p.mouse.move(palabra.x, palabra.y);
await hasta((r) => !!r.querySelector('.ficha-palabra'), undefined, 4000);
await p.waitForTimeout(300);
await p.screenshot({ path: join(CAPTURAS, 'ficha-abierta.png') });
const antes = await estadoVideo();
b = await crearConQ();
const cambios = await p.evaluate(() => window.__cambios);
console.log('   interfaz:', JSON.stringify(cambios));
comprobar(cambios[0]?.op === '0' && cambios[0].ms < 150, 'La interfaz se va en cuanto se pulsa la tecla', `${cambios[0]?.ms} ms`);
comprobar(cambios.at(-1)?.op === '1', 'Y vuelve al terminar');
comprobar(b.imagenes.length === 1, 'Lleva imagen');
if (b.imagenes[0]) {
  writeFileSync(join(CAPTURAS, 'imagen.jpg'), Buffer.from(b.imagenes[0].datos, 'base64'));
  const color = await parteDelColor(b.imagenes[0].datos);
  comprobar(color.parte > 0.97, 'En la imagen solo está el video: ni ficha, ni barra, ni subtítulos, ni avisos', `${Math.round(color.parte * 100)} % del color del video, ${color.ancho}×${color.alto}`);
}
comprobar(b.audioFrase.length === 1, 'Lleva audio');
if (b.audioFrase[0]) {
  const { duracion, tonos } = tonosDe(b.audioFrase[0].datos);
  console.log(`   clip: ${duracion.toFixed(2)} s, ${tonos.join(' ')}`);
  comprobar(Math.abs(duracion - 2.5) < 0.35, 'Dura la línea con sus márgenes: 2.5 s', `${duracion.toFixed(2)} s`);
  comprobar(tonos[0] !== null, 'Empieza con sonido, sin silencio delante');
  comprobar(tonos.slice(0, -1).every((t) => t !== null), 'Y sin huecos en medio');
  comprobar(tonos[0] === 500, 'Empieza donde debe: en el segundo 2.5 del video', `${tonos[0]} Hz`);
  comprobar(tonos.filter(Boolean).at(-1) >= 700, 'Y llega hasta el final: el segundo 5', `${tonos.filter(Boolean).at(-1)} Hz`);
  comprobar(Math.abs(cuenta(tonos, 600) - 10) <= 2, 'A velocidad normal: cada segundo del video dura un segundo', `${cuenta(tonos, 600)} décimas a 600 Hz`);
}
let despues = await estadoVideo();
comprobar(despues.pausado && Math.abs(despues.t - antes.t) < 0.5, 'El video queda pausado donde estaba', `${antes.t.toFixed(2)} → ${despues.t.toFixed(2)} s`);
comprobar(await enOverlay((r) => !!r.querySelector('.ficha-palabra')), 'Y la ficha sigue abierta');
await p.keyboard.press('Escape');
await p.mouse.move(40, 700);
await p.waitForTimeout(300);

// ---------- Mientras se reproduce, a otra velocidad ----------

console.log('\n== Mientras se reproduce, a otra velocidad ==');
await irA(6.6);
await p.waitForTimeout(300);
await p.evaluate(() => { const v = document.querySelector('#v'); v.playbackRate = 1.25; v.play(); });
await hasta((r) => (r.querySelector('.linea-sub.objetivo .linea-texto')?.textContent ?? '').includes('明日'), undefined, 4000);
b = await crearConQ();
if (b.audioFrase[0]) {
  const { duracion, tonos } = tonosDe(b.audioFrase[0].datos);
  console.log(`   clip: ${duracion.toFixed(2)} s, ${tonos.join(' ')}`);
  comprobar(Math.abs(duracion - 2) < 0.35, 'Graba a velocidad normal, sea cual sea la que se usa', `${duracion.toFixed(2)} s`);
  comprobar(tonos[0] === 900, 'Lo último que sonó antes de la grabación no se cuela en el clip', `${tonos[0]} Hz`);
  comprobar(Math.abs(cuenta(tonos, 1000) - 10) <= 2, 'Sin pasar por la aceleración de los huecos', `${cuenta(tonos, 1000)} décimas a 1000 Hz`);
} else {
  comprobar(false, 'Lleva audio');
}
despues = await estadoVideo();
comprobar(!despues.pausado && Math.abs(despues.velocidad - 1.25) < 0.01, 'El video sigue reproduciéndose a su velocidad', `${despues.velocidad}×`);
await irA(3.5);
await p.evaluate(() => { document.querySelector('#v').playbackRate = 1; });
await p.waitForTimeout(300);

// ---------- Video silenciado ----------

console.log('\n== Video silenciado ==');
await p.evaluate(() => { document.querySelector('#v').muted = true; });
b = await crearConQ();
comprobar(b.audioFrase.length === 0, 'Una grabación muda no se guarda');
comprobar(/muda/.test(await avisos()), 'Y lo dice', await avisos());
await p.evaluate(() => { document.querySelector('#v').muted = false; });
await p.waitForTimeout(300);

// ---------- Fotograma protegido ----------

console.log('\n== Fotograma protegido: la pantalla lo entrega en negro ==');
await abrir('negro1');
await capturar('https://www.youtube.com/*');
await p.waitForTimeout(400);
b = await crearConQ();
comprobar(b.imagenes.length === 0, 'No se guarda una imagen negra');
comprobar(/negro/.test(await avisos()), 'Y lo dice', await avisos());
comprobar(b.audioFrase.length === 1, 'El audio sí sale');
await irA(3.5);
await p.waitForTimeout(300);
await crearConQ();
await irA(3.5);
await p.waitForTimeout(300);
b = await crearConQ();
const tercera = await p.evaluate(() => window.__cambios.filter((c) => c.op === '0').length);
comprobar(tercera === 0, 'Comprobado dos veces, la interfaz ya no parpadea por nada', `${tercera} veces oculta`);
comprobar(b.audioFrase.length === 1, 'Y el audio sigue saliendo');

// ---------- Netflix: el fotograma protegido deja paso a la imagen oficial ----------

console.log('\n== Con la forma de Netflix: fotograma protegido e imagen oficial ==');
await p.goto('https://www.netflix.com/watch/1');
await hasta((r) => r.querySelector('.barra') != null, undefined, 30000);
await p.bringToFront();
await p.evaluate(() => { const v = document.querySelector('#v'); v.pause(); v.currentTime = 3.5; });
await hasta((r) => r.querySelector('.subs-bloque:not(.saliendo) .linea-sub.objetivo .pal') != null, undefined, 30000);
await p.mouse.move(40, 700);
await p.waitForTimeout(300);
b = await crearConQ();
comprobar(b.imagenes.length === 1, 'La tarjeta lleva la imagen oficial del episodio');
if (b.imagenes[0]) {
  writeFileSync(join(CAPTURAS, 'imagen-netflix.jpg'), Buffer.from(b.imagenes[0].datos, 'base64'));
  await p.screenshot({ path: join(CAPTURAS, 'pantalla-netflix.png') });
  const color = await parteDelColor(b.imagenes[0].datos, [0xd0, 0x70, 0x20]);
  comprobar(color.parte > 0.97, 'Es esa imagen, y no el fotograma negro', `${Math.round(color.parte * 100)} % de su color`);
}
comprobar(/imagen oficial/.test(await avisos()), 'Y lo dice', await avisos());

if (errores.length) console.log('\nErrores en la página:', [...new Set(errores)].slice(0, 6));
console.log(`\n${fallos ? `${fallos} comprobaciones fallaron` : 'Todas las comprobaciones pasaron'}`);
await contexto.close();
servidorImagen.close();
process.exit(fallos ? 1 : 0);
