// Prueba los flujos de subtítulos en páginas que imitan a Netflix y YouTube, con el servidor falso de
// Claude: no sale a internet ni gasta nada. Lo que se comprueba es lo que haría una persona real.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/subtitulos.mjs

import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';
import { iniciarMock } from './mock-claude.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-subs'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'subtitulos');
const VIDEO = join(RAIZ, 'pruebas', 'fixtures', 'video.webm');
mkdirSync(CAPTURAS, { recursive: true });
rmSync(PERFIL, { recursive: true, force: true });
const pedidas = process.argv.slice(2);
const quiere = (n) => !pedidas.length || pedidas.includes(n);

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};

// ---------- Subtítulos de muestra ----------

const FRASES_JA = ['泥だらけの道でも花は咲いた', '授業の後は、たぶん日本語の勉強を続けると思います。', '自分の医師の弱さを認めることが大切です', '赤い星と青い星を食べる夢を見た', '私はまだ立ち上がることができます', '明日もまた会いましょう'];
const FRASES_ES = ['Incluso en un camino lleno de barro, la flor brotó', 'Después de clase seguiré estudiando japonés', 'Es importante reconocer la propia debilidad', 'Soñé que devoraba estrellas rojas y azules', 'Todavía puedo levantarme', 'Nos vemos mañana'];
const tiempo = (ms) => new Date(ms).toISOString().slice(11, 23);
const vtt = (frases, paso = 5000, dur = 4000) => `WEBVTT\n\n${frases.map((f, i) => `${tiempo(1000 + i * paso)} --> ${tiempo(1000 + i * paso + dur)}\n${f}\n`).join('\n')}`;
const json3 = (frases, paso = 5000, dur = 4000) => JSON.stringify({ events: frases.map((f, i) => ({ tStartMs: 1000 + i * paso, dDurationMs: dur, segs: [{ utf8: f }] })) });
const LARGA = Array.from({ length: 300 }, (_, i) => `これは${i}番目の文です`);

// ---------- Páginas falsas ----------

function paginaNetflix() {
  return `<!doctype html><meta charset="utf-8"><title>Película de prueba - Netflix</title>
<body style="margin:0;background:#000"><video id="v" src="https://media.test/video.webm" muted style="width:100vw;height:100vh"></video>
<script>
  const consulta = new URLSearchParams(location.search);
  const pais = consulta.get('r') ?? 'jp';
  const pistas = pais === 'jp'
    ? [{ trackId: 't-ja', displayName: '日本語', bcp47: 'ja' }, { trackId: 't-en', displayName: 'English', bcp47: 'en' }]
    : [{ trackId: 't-es', displayName: 'Español (Latinoamérica)', bcp47: 'es-419' }];
  const v = document.getElementById('v');
  // Con ?sobra, el <video> de un anuncio que acabó se queda en la página, en pausa, del mismo tamaño y antes que el del
  // episodio.
  if (consulta.has('sobra')) {
    const a = document.createElement('video');
    a.id = 'a';
    a.src = 'https://media.test/video.webm';
    a.muted = true;
    a.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh';
    a.addEventListener('loadedmetadata', () => { a.currentTime = 3; }, { once: true });
    v.before(a);
  }
  // Como el de Netflix, su reproductor cuenta el momento del episodio, y window.__adelanto hace que el video vaya por
  // delante, como tras un anuncio: seek y getCurrentTime van por el episodio. Con window.__sinReloj no da su momento, y
  // durante un anuncio que descuenta, su momento se queda en window.__congelado.
  const adelanto = () => window.__adelanto ?? 0;
  const momento = () => (window.__sinReloj ? undefined : window.__congelado ?? v.currentTime * 1000 - adelanto());
  const pelicula = Number(/\\/watch\\/(\\d+)/.exec(location.pathname)?.[1] ?? 1);
  const jugador = { getTimedTextTrackList: () => pistas, getTimedTextTrack: () => pistas[0], setTimedTextTrack: async () => {}, seek: (ms) => { v.currentTime = (ms + adelanto()) / 1000; }, getCurrentTime: momento, play: () => v.play(), pause: () => v.pause(), getMovieId: () => pelicula };
  // Con ?vieja, queda antes la sesión de otro episodio: su reloj, parado, y otras pistas.
  const pistasViejas = [{ trackId: 't-viejo', displayName: '한국어', bcp47: 'ko' }];
  const viejo = { getTimedTextTrackList: () => pistasViejas, getTimedTextTrack: () => pistasViejas[0], setTimedTextTrack: async () => {}, seek: () => {}, getCurrentTime: () => 777000, play() {}, pause() {}, getMovieId: () => 70000001 };
  const sesiones = consulta.has('vieja') ? ['watch-viejo', 'watch1'] : ['watch1'];
  const urls = (ps) => ({ datos: ps.map((p) => ({ type: 'timedtext', trackId: p.trackId, urls: [{ url: 'https://subs.test/' + p.trackId + '.vtt' }] })) });
  window.netflix = { appContext: { state: { playerApp: {
    getAPI: () => ({ videoPlayer: { getAllPlayerSessionIds: () => sesiones, getVideoPlayerBySessionId: (id) => (id === 'watch-viejo' ? viejo : jugador) }, getVideoMetadataByVideoId: () => ({ getCurrentVideo: () => ({ getTitle: () => 'Película de prueba' }) }) }),
    getState: () => ({ videoPlayer: { cadmiumPlayerRepository: { playersById: { watch1: urls(pistas), 'watch-viejo': urls(pistasViejas) } } } }),
  } } } };
</script>`;
}

const PISTAS_YT = {
  autoauto001: [{ languageCode: 'ja', kind: 'asr', vssId: 'a.ja', name: { simpleText: '日本語 (自動生成)' } }],
  autoauto002: [{ languageCode: 'ja', kind: 'asr', vssId: 'a.ja', name: { simpleText: '日本語 (自動生成)' } }],
  autoauto003: [{ languageCode: 'ja', kind: 'asr', vssId: 'a.ja', name: { simpleText: '日本語 (自動生成)' } }],
  soloespanol: [{ languageCode: 'es', vssId: '.es', name: { simpleText: 'Español' } }],
  largolargo1: [{ languageCode: 'ja', vssId: '.ja', name: { simpleText: '日本語' } }],
  cancion0001: [{ languageCode: 'ja', vssId: '.ja', name: { simpleText: '日本語' } }],
};

function paginaYouTube(id) {
  const pistas = (PISTAS_YT[id] ?? []).map((t) => {
    const base = `https://www.youtube.com/api/timedtext?v=${id}&lang=${t.languageCode}${t.kind ? `&kind=${t.kind}` : ''}`;
    return { ...t, baseUrl: base, url: `${base}&pot=prueba` };
  });
  return `<!doctype html><meta charset="utf-8"><title>講義の動画 - YouTube</title>
<body style="margin:0;background:#000"><div id="movie_player" style="position:fixed;inset:0"><video id="v" src="https://media.test/video.webm" muted style="width:100%;height:100%"></video></div>
<script>
  const pistas = ${JSON.stringify(pistas)};
  const j = document.getElementById('movie_player');
  const v = document.getElementById('v');
  j.getPlayerResponse = () => ({ videoDetails: { videoId: ${JSON.stringify(id)}, title: '講義の動画' }, captions: { playerCaptionsTracklistRenderer: { captionTracks: pistas } } });
  j.getAudioTrack = () => ({ captionTracks: pistas });
  j.getVideoData = () => ({ video_id: ${JSON.stringify(id)}, title: '講義の動画' });
  j.seekTo = (s) => { v.currentTime = s; };
  j.playVideo = () => v.play();
  j.pauseVideo = () => v.pause();
  j.loadModule = () => {};
  j.setOption = () => {};
</script>`;
}

// ---------- Arranque ----------

const mock = await iniciarMock();
const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1280, height: 720 },
  acceptDownloads: true,
  args: ['--mute-audio', `--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});

const CORS = { 'access-control-allow-origin': '*' };
const bytesVideo = readFileSync(VIDEO);
await contexto.route('https://media.test/**', (r) => {
  const rango = /bytes=(\d+)-(\d*)/.exec(r.request().headers().range ?? '');
  if (!rango) return r.fulfill({ status: 200, body: bytesVideo, headers: { 'content-type': 'video/webm', 'accept-ranges': 'bytes', ...CORS } });
  const desde = Number(rango[1]);
  const hasta = rango[2] ? Number(rango[2]) : bytesVideo.length - 1;
  return r.fulfill({ status: 206, body: bytesVideo.subarray(desde, hasta + 1), headers: { 'content-type': 'video/webm', 'accept-ranges': 'bytes', 'content-range': `bytes ${desde}-${hasta}/${bytesVideo.length}`, ...CORS } });
});
await contexto.route('https://subs.test/**', (r) => {
  const nombre = new URL(r.request().url()).pathname;
  const frases = nombre.includes('t-ja') ? FRASES_JA : nombre.includes('t-es') ? FRASES_ES : FRASES_ES.map((f) => `[en] ${f}`);
  return r.fulfill({ status: 200, contentType: 'text/vtt', headers: CORS, body: vtt(frases) });
});
await contexto.route('https://www.netflix.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: paginaNetflix() }));
await contexto.route('https://www.youtube.com/**', (r) => {
  const u = new URL(r.request().url());
  if (u.pathname.includes('/api/timedtext')) {
    const v = u.searchParams.get('v');
    const frases = v === 'largolargo1' ? LARGA : u.searchParams.get('lang') === 'es' ? FRASES_ES : FRASES_JA;
    const paso = v === 'largolargo1' ? 190 : 5000;
    return r.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: json3(frases, paso, paso === 190 ? 180 : 4000) });
  }
  if (u.pathname === '/watch') return r.fulfill({ status: 200, contentType: 'text/html', body: paginaYouTube(u.searchParams.get('v')) });
  return r.fulfill({ status: 204 });
});

const sw = await recargarExtension(contexto);
// Estas pruebas cubren lo que ve quien no tiene el ayudante, aunque en este equipo sí esté instalado.
await sw.evaluate(() => {
  Object.defineProperty(chrome.runtime, 'connectNative', {
    configurable: true,
    value: () => ({ onMessage: { addListener() {} }, onDisconnect: { addListener(f) { setTimeout(f, 10); } }, postMessage() {}, disconnect() {} }),
  });
});
const idExtension = new URL(sw.url()).host;
const fijarAjustes = (cambios) =>
  sw.evaluate(
    async (cambios) => {
      const d = await chrome.storage.local.get('ajustes');
      await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), ...cambios } });
    },
    cambios
  );
await sw.evaluate(async (url) => chrome.storage.local.set({ urlBaseIA: url, claveAnthropic: 'clave-de-prueba' }), `http://127.0.0.1:${mock.puerto}`);
await fijarAjustes({ navegadorAbierto: true, modo: 'normal', salto: 'no', idiomaObjetivo: 'ja', idiomaSecundario: 'es' });

// ---------- Ayudas para manejar la página ----------

const enOverlay = (p, fn, arg) =>
  p.evaluate(
    ({ fn, arg }) => {
      const r = document.querySelector('kotonoha-overlay')?.shadowRoot;
      return r ? new Function('r', 'arg', `return (${fn})(r, arg)`)(r, arg) : null;
    },
    { fn: fn.toString(), arg }
  );

async function hasta(p, fn, arg, ms = 15000) {
  const limite = Date.now() + ms;
  for (;;) {
    const v = await enOverlay(p, fn, arg).catch(() => null);
    if (v) return v;
    if (Date.now() > limite) return null;
    await p.waitForTimeout(100);
  }
}

const pulsar = (p, texto, ambito = '') =>
  enOverlay(
    p,
    (r, { texto, ambito }) => {
      const b = [...r.querySelectorAll(`${ambito} button`)].find((x) => x.textContent.includes(texto) && !x.disabled);
      b?.click();
      return !!b;
    },
    { texto, ambito }
  );

async function abrirPanel(p, etiqueta) {
  await p.keyboard.press('Escape');
  await p.mouse.move(600, 2);
  await p.waitForTimeout(200);
  await enOverlay(p, (r, e) => r.querySelector(`.barra-acciones button[aria-label="${e}"]`)?.click(), etiqueta);
  await p.waitForTimeout(250);
}

async function abrirSubtitulos(p) {
  await abrirPanel(p, 'Ajustes de video');
  await pulsar(p, 'Subtítulos', '.panel-flotante');
  await p.waitForTimeout(150);
}

const irA = (p, s) => p.evaluate((s) => { const v = document.querySelector('#v'); v.pause(); v.currentTime = s; }, s);
const textoLinea = (p, clase) =>
  enOverlay(
    p,
    (r, c) => {
      const l = r.querySelector(`.linea-sub.${c}`);
      if (!l) return '';
      const copia = l.cloneNode(true);
      copia.querySelectorAll('rt, rp').forEach((x) => x.remove());
      return copia.textContent;
    },
    clase
  );
const lineasNavegador = (p) =>
  enOverlay(p, (r) =>
    [...r.querySelectorAll('.nav-linea')].map((l) => {
      const copia = l.cloneNode(true);
      copia.querySelectorAll('rt, rp').forEach((x) => x.remove());
      return copia.textContent;
    })
  );
const elegida = (p, etiqueta) =>
  enOverlay(
    p,
    (r, e) => {
      const s = r.querySelector(`select[aria-label="${e}"]`);
      return s ? { valor: s.value, texto: s.selectedOptions[0]?.textContent ?? '', todas: [...s.options].map((o) => o.textContent) } : null;
    },
    etiqueta
  );
const avisos = (p) => enOverlay(p, (r) => r.querySelector('.avisos, .aviso')?.parentElement?.textContent ?? '');

const esCorreccion = (x) => !!x.cuerpo.output_config?.format?.schema?.properties?.correcciones;
const esAnalisis = (x) => !!x.cuerpo.output_config?.format?.schema?.properties?.lineas?.items?.properties?.lecturas;
const esTraduccion = (x) => !!x.cuerpo.output_config?.format?.schema?.properties?.lineas && !esAnalisis(x);
const cuantas = (filtro) => mock.peticiones.filter(filtro).length;
const textoPeticion = (x) => JSON.stringify(x.cuerpo.messages);
const sistemaPeticion = (x) => JSON.stringify(x.cuerpo.system ?? '');
const lineasPedidas = (x) => [...textoPeticion(x).matchAll(/(\d+): ([^\\]+)/g)].length;

const errores = [];
function abrir(p, nombre) {
  p.on('pageerror', (e) => errores.push(`${nombre}: ${e.message}`));
  p.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|ERR_|Failed to load resource/.test(m.text())) errores.push(`${nombre}: ${m.text()}`);
  });
  return p;
}

let srtExportado = '';

// ---------- Netflix Japón: traducir y exportar ----------

if (quiere('netflix')) {
  console.log('\n== Netflix Japón ==');
  const p = abrir(await contexto.newPage(), 'netflix-jp');
  await p.goto('https://www.netflix.com/watch/81234567?r=jp');
  comprobar(!!(await hasta(p, (r) => r.querySelectorAll('.nav-linea').length === 6, undefined, 30000)), 'Elige los subtítulos en japonés de Netflix y los lista');
  await irA(p, 6);
  await hasta(p, (r) => r.querySelector('.linea-sub.objetivo .pal') != null);
  comprobar((await textoLinea(p, 'objetivo')).includes('授業'), 'Muestra la línea actual', await textoLinea(p, 'objetivo'));

  await abrirPanel(p, 'Generar subtítulos');
  const panel = await enOverlay(p, (r) => r.querySelector('.panel-generar')?.textContent ?? '');
  comprobar(!/Whisper/.test(panel), 'En Netflix no se ofrece Whisper');
  comprobar(/Traducir al español/.test(panel), 'Hay un botón para traducir al español');
  await p.screenshot({ path: join(CAPTURAS, 'netflix-panel.png') });

  const antes = cuantas(esTraduccion);
  await pulsar(p, 'Traducir al español', '.panel-generar');
  const secundaria = await hasta(p, (r) => r.querySelector('.linea-sub.secundaria')?.textContent.includes('traducción'), undefined, 15000);
  comprobar(!!secundaria, 'Aparece la traducción de Claude como secundarios', await textoLinea(p, 'secundaria'));
  comprobar(cuantas(esTraduccion) > antes, 'La pidió a Claude');

  await abrirSubtitulos(p);
  await p.screenshot({ path: join(CAPTURAS, 'netflix-subtitulos.png') });
  const sec = await elegida(p, 'Subtítulos secundarios');
  comprobar(/Claude/.test(sec?.texto ?? ''), 'Queda elegida «Español (Claude)»', sec?.texto);

  const espera = p.waitForEvent('download', { timeout: 8000 });
  await enOverlay(p, (r) => [...r.querySelectorAll('.pista')].find((x) => x.textContent.includes('en japonés'))?.querySelector('.pista-acciones button:nth-child(2)')?.click());
  const descarga = await espera.catch(() => null);
  comprobar(!!descarga, 'Exportar SRT descarga un archivo', descarga?.suggestedFilename());
  if (descarga) {
    const ruta = await descarga.path();
    srtExportado = join(CAPTURAS, descarga.suggestedFilename());
    await descarga.saveAs(srtExportado);
    const srt = readFileSync(ruta, 'utf8');
    comprobar(/\.ja\.srt$/.test(descarga.suggestedFilename()), 'El nombre lleva el título y el idioma', descarga.suggestedFilename());
    comprobar(srt.includes('00:00:06,000 --> 00:00:10,000') && srt.includes('授業の後は'), 'El SRT tiene los tiempos y el texto');
    comprobar((srt.match(/-->/g) ?? []).length === 6, 'El SRT tiene todas las líneas');
  }
  await p.close();

  // ---------- La misma película en Netflix México ----------
  console.log('\n== La misma película en Netflix México, sin japonés ==');
  const pedidasAntes = cuantas(esTraduccion);
  const m = abrir(await contexto.newPage(), 'netflix-mx');
  await m.goto('https://www.netflix.com/watch/81234567?r=mx');
  comprobar(!!(await hasta(m, (r) => r.querySelectorAll('.nav-linea').length === 6, undefined, 30000)), 'El japonés de Netflix Japón sigue ahí');
  await irA(m, 6);
  await hasta(m, (r) => r.querySelector('.linea-sub.secundaria')?.textContent.length > 0);
  comprobar((await textoLinea(m, 'objetivo')).includes('授業'), 'Se ve el japonés guardado', await textoLinea(m, 'objetivo'));
  comprobar((await textoLinea(m, 'secundaria')).includes('Después de clase'), 'De secundarios, el español que ya tiene Netflix México', await textoLinea(m, 'secundaria'));
  await abrirSubtitulos(m);
  await m.screenshot({ path: join(CAPTURAS, 'netflix-mexico.png') });
  const ob = await elegida(m, 'Subtítulos en japonés');
  comprobar(/guardados/.test(ob?.texto ?? ''), 'Se ve que el japonés es uno guardado', ob?.texto);
  comprobar(cuantas(esTraduccion) === pedidasAntes, 'No se volvió a pagar ninguna traducción');
  await m.close();

  // ---------- Importar el SRT en otra película sin japonés ----------
  console.log('\n== Importar un SRT en una película sin japonés ==');
  const i = abrir(await contexto.newPage(), 'netflix-importar');
  await i.goto('https://www.netflix.com/watch/70000000?r=mx');
  await hasta(i, (r) => r.querySelector('.barra') != null, undefined, 30000);
  await i.waitForTimeout(1500);
  comprobar(((await lineasNavegador(i)) ?? []).length === 0, 'Empieza sin subtítulos en japonés');
  await abrirSubtitulos(i);
  if (srtExportado && existsSync(srtExportado)) {
    await i.locator('kotonoha-overlay input[aria-label="Importar Subtítulos en japonés"]').setInputFiles(srtExportado);
    comprobar(!!(await hasta(i, (r) => r.querySelectorAll('.nav-linea').length === 6)), 'El SRT importado se convierte en la pista de japonés');
    const imp = await elegida(i, 'Subtítulos en japonés');
    comprobar(/importados/.test(imp?.texto ?? ''), 'Queda marcado como importado', imp?.texto);
    const sec2 = await elegida(i, 'Subtítulos secundarios');
    comprobar(sec2?.valor === 't-es', 'Los secundarios siguen siendo los de Netflix', sec2?.texto);
    await irA(i, 6);
    await i.waitForTimeout(500);
    comprobar((await textoLinea(i, 'secundaria')).includes('Después de clase'), 'Se ven los dos a la vez', await textoLinea(i, 'secundaria'));
    await i.screenshot({ path: join(CAPTURAS, 'netflix-importado.png') });

    await i.reload();
    comprobar(!!(await hasta(i, (r) => r.querySelectorAll('.nav-linea').length === 6, undefined, 30000)), 'Lo importado sigue ahí al recargar');
    await abrirSubtitulos(i);
    const trasRecargar = await elegida(i, 'Subtítulos en japonés');
    comprobar(/importados/.test(trasRecargar?.texto ?? ''), 'Y sigue elegido', trasRecargar?.texto);
  } else {
    comprobar(false, 'No hay SRT que importar');
  }
  await i.close();
}

// ---------- Netflix: el reloj del video se va del de Netflix ----------

if (quiere('reloj')) {
  console.log('\n== Netflix: el reloj del video se va del de Netflix ==');
  const p = abrir(await contexto.newPage(), 'netflix-reloj');
  await p.goto('https://www.netflix.com/watch/81234567?r=jp');
  comprobar(!!(await hasta(p, (r) => r.querySelectorAll('.nav-linea').length === 6, undefined, 30000)), 'Carga los subtítulos de Netflix');
  const video = (f, arg) => p.evaluate(f, arg);
  const textoAvisos = () => enOverlay(p, (r) => [...r.querySelectorAll('.aviso-texto')].map((a) => a.textContent).join(' | '));
  const avisoCon = (texto, ms = 8000) => hasta(p, (r, t) => [...r.querySelectorAll('.aviso-texto')].some((a) => a.textContent.includes(t)), texto, ms);

  // Sin desfase, nada cambia: los subtítulos van por el video y no sale ningún aviso.
  await video(() => { const v = document.querySelector('#v'); v.currentTime = 11; return v.play(); });
  await p.waitForTimeout(2500);
  comprobar((await textoLinea(p, 'objetivo')).includes('自分'), 'Sin desfase, la línea es la del video', await textoLinea(p, 'objetivo'));
  comprobar(!(await textoAvisos()).includes('Netflix'), 'Sin desfase no avisa de nada', await textoAvisos());

  // Como tras un anuncio de 5 s: el video va 5 s por delante del episodio, y la línea de ahora es la anterior.
  await video(() => { window.__adelanto = 5000; const v = document.querySelector('#v'); v.pause(); v.currentTime = 11; return v.play(); });
  const corregido = await avisoCon('sincronizados con Netflix');
  comprobar(!!corregido, 'Se corrige solo y lo dice', await textoAvisos());
  await video(() => document.querySelector('#v').pause());
  await p.waitForTimeout(150);
  const t = await video(() => document.querySelector('#v').currentTime);
  comprobar((await textoLinea(p, 'objetivo')).includes('授業'), 'La línea es la del momento del episodio, no la del video', `video ${t.toFixed(1)} s: ${await textoLinea(p, 'objetivo')}`);

  await abrirPanel(p, 'Ajustes de video');
  await pulsar(p, 'Sincronizar', '.panel-flotante');
  await p.waitForTimeout(200);
  const panelReloj = await enOverlay(p, (r) => r.querySelector('.reloj-netflix')?.textContent ?? '');
  comprobar(/Ajustado/.test(panelReloj) && /5\s*s por delante/.test(panelReloj), 'El panel dice cuánto se corrige', panelReloj);
  comprobar(/Volver a sincronizar/.test(panelReloj), 'Y ofrece volver a sincronizar');
  await p.screenshot({ path: join(CAPTURAS, 'netflix-reloj.png') });
  await p.keyboard.press('Escape');

  // Un salto desde Kotonoha va al momento del episodio: la cuarta línea empieza a los 16 s del episodio.
  await enOverlay(p, (r) => r.querySelectorAll('.nav-linea')[3]?.click());
  await p.waitForTimeout(600);
  const tras = await video(() => document.querySelector('#v').currentTime);
  comprobar(Math.abs(tras - 21) < 0.3 && (await textoLinea(p, 'objetivo')).includes('赤い星'), 'Saltar a una línea lleva a su momento del episodio', `video ${tras.toFixed(2)} s: ${await textoLinea(p, 'objetivo')}`);

  // A mano: con el video en pausa, la medida queda para cuando siga.
  await p.waitForTimeout(3600);
  await video(() => { window.__adelanto = 0; });
  await p.keyboard.press('Alt+Shift+S');
  comprobar(!!(await avisoCon('en cuanto siga el video', 3000)), 'Alt+Shift+S en pausa: se medirá al seguir', await textoAvisos());
  await video(() => { const v = document.querySelector('#v'); v.currentTime = 11; return v.play(); });
  await p.waitForTimeout(2200);
  comprobar((await textoLinea(p, 'objetivo')).includes('自分'), 'Al volver a ir a la par, se quita la corrección', await textoLinea(p, 'objetivo'));
  await p.waitForTimeout(3600);
  await p.keyboard.press('Alt+Shift+S');
  comprobar(!!(await avisoCon('Ya iban a la par')), 'Alt+Shift+S con todo bien: lo dice', await textoAvisos());

  // Si Netflix no da su momento, todo sigue por el video, y se dice.
  await p.waitForTimeout(3600);
  await video(() => { window.__sinReloj = true; window.__adelanto = 5000; const v = document.querySelector('#v'); v.currentTime = 31; return v.play(); });
  await p.waitForTimeout(500);
  await p.keyboard.press('Alt+Shift+S');
  comprobar(!!(await avisoCon('no dio su posición', 7000)), 'Sin el momento de Netflix, avisa de que sigue por el video', await textoAvisos());
  await video(() => { const v = document.querySelector('#v'); v.pause(); v.currentTime = 23; });
  await p.waitForTimeout(400);
  const lineas = await lineasNavegador(p);
  const ahora = await textoLinea(p, 'objetivo');
  comprobar(!!ahora && (lineas[4] ?? '').startsWith(ahora), 'Y los subtítulos van por el video', ahora);
  await p.close();

  // Un anuncio del medio de 5 s, en el mismo <video>: mientras dura, el video corre y el episodio no. Con descuenta, el
  // reloj de Netflix lo descuenta, como se espera de él: se queda quieto mientras dura y luego va por el episodio. Sin,
  // cuenta como el video y hay que medir el anuncio.
  async function abrirNetflix(nombre, extra = '', episodio = 81234567) {
    const q = abrir(await contexto.newPage(), nombre);
    await q.goto(`https://www.netflix.com/watch/${episodio}?r=jp${extra}`);
    const ok = !!(await hasta(q, (r) => r.querySelectorAll('.nav-linea').length === 6, undefined, 30000));
    return { q, ok };
  }
  const reproducirDesde = (q, s) => q.evaluate((s) => { const v = document.querySelector('#v'); v.currentTime = s; return v.play(); }, s);
  const hastaVideo = (q, s) => q.waitForFunction((s) => document.querySelector('#v').currentTime >= s, s, { timeout: 30000 });
  const empezarAnuncio = (q, descuenta) =>
    q.evaluate((descuenta) => {
      const d = document.createElement('div');
      d.className = 'watch-video--modular-ads-container';
      document.body.append(d);
      const v = document.querySelector('#v');
      if (descuenta) window.__congelado = v.currentTime * 1000 - (window.__adelanto ?? 0);
      return v.currentTime;
    }, descuenta);
  /** Acaba el anuncio. Con descuenta, el reloj de Netflix vuelve a ir por el episodio; devuelve cuánto va por delante el video. */
  const acabarAnuncio = (q, desde, { descuenta, quitar = true }) =>
    q.evaluate(({ desde, descuenta, quitar }) => {
      if (quitar) document.querySelector('.watch-video--modular-ads-container')?.remove();
      if (descuenta) {
        window.__adelanto = (window.__adelanto ?? 0) + Math.round((document.querySelector('#v').currentTime - desde) * 1000);
        window.__congelado = undefined;
      }
      return window.__adelanto ?? 0;
    }, { desde, descuenta, quitar });
  const quitarContenedor = (q) => q.evaluate(() => document.querySelector('.watch-video--modular-ads-container')?.remove());
  const segundosDe = (texto) => Number(/\(([\d,.]+) s\)/.exec(texto ?? '')?.[1]?.replace(',', '.'));
  const avisosDe = (q) => enOverlay(q, (r) => [...r.querySelectorAll('.aviso-texto')].map((a) => a.textContent).join(' | '));
  /** El aviso que dice `re`; con `s`, solo si su cifra está a menos de 0,3 s de ella. */
  const avisoQue = (q, re, s = null, ms = 9000) =>
    hasta(
      q,
      (r, { f, s }) =>
        [...r.querySelectorAll('.aviso-texto')]
          .map((a) => a.textContent)
          .find((t) => new RegExp(f).test(t) && (s === null || Math.abs(Number(/\(([\d,.]+) s\)/.exec(t)?.[1]?.replace(',', '.')) - s) <= 0.3)),
      { f: re.source, s },
      ms
    );
  /** Todos los avisos que salen durante `ms`: uno breve se iría antes de mirarlo al final. */
  async function avisosDurante(q, ms) {
    const vistos = new Set();
    const fin = Date.now() + ms;
    while (Date.now() < fin) {
      for (const t of (await enOverlay(q, (r) => [...r.querySelectorAll('.aviso-texto')].map((a) => a.textContent))) ?? []) vistos.add(t);
      await q.waitForTimeout(200);
    }
    return [...vistos];
  }
  /** Alt+Shift+S, y lo que dice: tiene que medir y dar `s` segundos, y no repetir otra cifra. */
  async function sincronizarAMano(q, s, texto) {
    await q.keyboard.press('Alt+Shift+S');
    const vistos = await avisosDurante(q, 6000);
    comprobar(vistos.some((t) => /sincronizados con Netflix/.test(t) && Math.abs(segundosDe(t) - s) <= 0.3), texto, `${vistos.join(' | ') || 'sin avisos'} (va ${Math.round(s * 1000)} ms por delante)`);
  }

  async function anuncioDelMedio(nombre, descuenta) {
    const { q } = await abrirNetflix(nombre);
    await reproducirDesde(q, 6);
    await hastaVideo(q, 7);
    const desde = await empezarAnuncio(q, descuenta);
    await hastaVideo(q, 12);
    const adelanto = await acabarAnuncio(q, desde, { descuenta });
    const dicho = await avisoQue(q, /sincronizados con Netflix|ajustados por los anuncios/, null, 8000);
    await q.evaluate(() => document.querySelector('#v').pause());
    await q.waitForTimeout(150);
    const t = await q.evaluate(() => document.querySelector('#v').currentTime);
    const linea = await textoLinea(q, 'objetivo');
    return { q, dicho, t, linea, adelanto };
  }

  console.log('\n== Netflix: un anuncio del medio que su reloj descuenta ==');
  {
    const { q, dicho, t, linea, adelanto } = await anuncioDelMedio('netflix-anuncio', true);
    comprobar(/sincronizados con Netflix/.test(dicho ?? '') && Math.abs(segundosDe(dicho) - adelanto / 1000) <= 0.1, 'Al acabar el anuncio se sincroniza con el reloj de Netflix, al milisegundo', `${dicho} (va ${adelanto} ms por delante)`);
    comprobar(linea.includes('授業'), 'La línea es la del episodio, no la del video', `video ${t.toFixed(1)} s: ${linea}`);
    await abrirPanel(q, 'Ajustes de video');
    await pulsar(q, 'Sincronizar', '.panel-flotante');
    await q.waitForTimeout(200);
    const panel = await enOverlay(q, (r) => r.querySelector('.reloj-netflix')?.textContent ?? '');
    comprobar(/^Ajustado(?! por)/.test(panel), 'Manda el reloj de Netflix, no la medida del anuncio', panel.slice(0, 90));
    await q.close();
  }

  console.log('\n== Netflix: un anuncio del medio que su reloj no descuenta ==');
  {
    const { q, dicho, t, linea } = await anuncioDelMedio('netflix-anuncio-sin-reloj', false);
    const s = Number(/\(([\d,.]+) s\)/.exec(dicho ?? '')?.[1]?.replace(',', '.'));
    comprobar(Math.abs(s - 5) <= 0.5, 'Se corrige por lo que corrió el video durante el anuncio', dicho);
    comprobar(linea.includes('授業'), 'La línea es la del episodio, no la del video', `video ${t.toFixed(1)} s: ${linea}`);
    await abrirPanel(q, 'Ajustes de video');
    await pulsar(q, 'Sincronizar', '.panel-flotante');
    await q.waitForTimeout(200);
    const panel = await enOverlay(q, (r) => r.querySelector('.reloj-netflix')?.textContent ?? '');
    comprobar(/Ajustado por los anuncios/.test(panel), 'El panel dice que es por los anuncios', panel.slice(0, 120));
    await q.screenshot({ path: join(CAPTURAS, 'netflix-anuncio.png') });
    await q.keyboard.press('Escape');
    // Un salto desde Kotonoha se traduce al reloj del video, que es el que usa este seek: la cuarta línea, a los 16 s.
    await enOverlay(q, (r) => r.querySelectorAll('.nav-linea')[3]?.click());
    await q.waitForTimeout(600);
    const tras = await q.evaluate(() => document.querySelector('#v').currentTime);
    const despues = await textoLinea(q, 'objetivo');
    comprobar(despues.includes('赤い星') && Math.abs(tras - (16 + s)) < 0.6, 'Saltar a una línea lleva a su momento del episodio', `video ${tras.toFixed(2)} s: ${despues}`);
    await q.close();
  }

  // Lo que pasó en su Netflix (0.47.0): tras los anuncios, «Volver a sincronizar» repetía siempre la misma cifra y los
  // subtítulos no cuadraban hasta recargar la página.
  console.log('\n== Netflix: dos anuncios del medio, y sincronizar a mano mide de nuevo ==');
  {
    const { q } = await abrirNetflix('netflix-dos-anuncios');
    await reproducirDesde(q, 6);
    await hastaVideo(q, 7);
    let desde = await empezarAnuncio(q, true);
    await hastaVideo(q, 12);
    const uno = await acabarAnuncio(q, desde, { descuenta: true });
    comprobar(!!(await avisoQue(q, /sincronizados con Netflix/, uno / 1000)), 'Tras el primero, va por su reloj', await avisosDe(q));
    await hastaVideo(q, 15);
    desde = await empezarAnuncio(q, true);
    await hastaVideo(q, 20);
    const dos = await acabarAnuncio(q, desde, { descuenta: true });
    comprobar(!!(await avisoQue(q, /sincronizados con Netflix/, dos / 1000)), 'Tras el segundo, la cuenta sigue con los dos', `${await avisosDe(q)} (va ${dos} ms por delante)`);
    await q.waitForTimeout(3800);
    await sincronizarAMano(q, dos / 1000, 'Volver a sincronizar mide de nuevo y da la misma cuenta');
    await q.evaluate(() => document.querySelector('#v').pause());
    await enOverlay(q, (r) => r.querySelectorAll('.nav-linea')[3]?.click());
    await q.waitForTimeout(600);
    const tras = await q.evaluate(() => document.querySelector('#v').currentTime);
    const linea = await textoLinea(q, 'objetivo');
    comprobar(linea.includes('赤い星') && Math.abs(tras - (16 + dos / 1000)) < 0.4, 'Saltar a una línea lleva a su momento del episodio', `video ${tras.toFixed(2)} s: ${linea}`);
    await q.close();
  }

  console.log('\n== Netflix: su reloj contesta tarde tras el anuncio, y el descuento no se queda ==');
  {
    const { q } = await abrirNetflix('netflix-reloj-tarde');
    await reproducirDesde(q, 6);
    await hastaVideo(q, 7);
    const desde = await empezarAnuncio(q, true);
    await hastaVideo(q, 12);
    // Acaba el anuncio, pero su contenedor tarda dos segundos más en irse, y su reloj, en contestar.
    await q.evaluate(() => { window.__sinReloj = true; });
    const real = await acabarAnuncio(q, desde, { descuenta: true, quitar: false });
    await hastaVideo(q, 14);
    await quitarContenedor(q);
    const porAnuncios = await avisoQue(q, /ajustados por los anuncios/);
    comprobar(Math.abs(segundosDe(porAnuncios) - 7) <= 0.5, 'Sin su reloj, descuenta lo que corrió el video con el anuncio en pantalla', porAnuncios ?? (await avisosDe(q)));
    await q.evaluate(() => { window.__sinReloj = false; });
    const suyo = await avisoQue(q, /sincronizados con Netflix/, real / 1000);
    comprobar(!!suyo, 'En cuanto su reloj contesta, manda él: el descuento sobraba', `${suyo ?? (await avisosDe(q))} (va ${real} ms por delante)`);
    await q.waitForTimeout(3800);
    await sincronizarAMano(q, real / 1000, 'Volver a sincronizar mide de nuevo: no repite la cifra del anuncio');
    await q.close();
  }

  console.log('\n== Netflix: al acabar el anuncio, el video vuelve atrás ==');
  {
    const { q } = await abrirNetflix('netflix-vuelve-atras');
    await reproducirDesde(q, 6);
    await hastaVideo(q, 7);
    const desde = await empezarAnuncio(q, true);
    await hastaVideo(q, 12);
    await quitarContenedor(q);
    await q.waitForTimeout(300);
    // Devuelve lo que corrió durante el anuncio: su reloj y el del video vuelven a marcar lo mismo.
    await q.evaluate((desde) => { window.__congelado = undefined; document.querySelector('#v').currentTime = desde; }, desde);
    const vistos = await avisosDurante(q, 5000);
    comprobar(!vistos.some((t) => /ajustados por los anuncios|sincronizados con Netflix \(/.test(t)), 'No descuenta nada', vistos.join(' | ') || 'sin avisos');
    await q.evaluate(() => { const v = document.querySelector('#v'); v.pause(); v.currentTime = 23; });
    await q.waitForTimeout(400);
    comprobar((await textoLinea(q, 'objetivo')).includes('立ち上がる'), 'Y los subtítulos siguen al video', await textoLinea(q, 'objetivo'));
    await q.close();
  }

  console.log('\n== Netflix: sin su reloj, el ajuste por los anuncios se puede quitar ==');
  {
    const { q } = await abrirNetflix('netflix-quitar-ajuste');
    await q.evaluate(() => { window.__sinReloj = true; });
    await reproducirDesde(q, 6);
    await hastaVideo(q, 7);
    await empezarAnuncio(q, false);
    await hastaVideo(q, 12);
    await quitarContenedor(q);
    const dicho = await avisoQue(q, /ajustados por los anuncios/);
    comprobar(Math.abs(segundosDe(dicho) - 5) <= 0.5, 'Descuenta lo que corrió el video durante el anuncio', dicho ?? (await avisosDe(q)));
    await q.waitForTimeout(7300);
    await q.keyboard.press('Alt+Shift+S');
    const sinPosicion = await avisoQue(q, /no dio su posición: siguen ajustados por los anuncios/, null, 8000);
    comprobar(!!sinPosicion, 'A mano, sin su reloj, dice que sigue el ajuste por los anuncios', sinPosicion ?? (await avisosDe(q)));
    await pulsar(q, 'Quitar el ajuste', '.avisos');
    comprobar(!!(await avisoQue(q, /Ajuste por los anuncios quitado/, null, 3000)), 'Y se quita desde el aviso', await avisosDe(q));
    await q.evaluate(() => { const v = document.querySelector('#v'); v.pause(); v.currentTime = 23; });
    await q.waitForTimeout(400);
    comprobar((await textoLinea(q, 'objetivo')).includes('立ち上がる'), 'Sin el ajuste, los subtítulos siguen al video', await textoLinea(q, 'objetivo'));
    await q.close();
  }

  console.log('\n== Netflix: la sesión de otro episodio y el <video> de un anuncio que quedó ==');
  {
    // Otro episodio, sin subtítulos guardados de las pruebas de antes: las pistas tienen que salir de su sesión.
    const { q, ok } = await abrirNetflix('netflix-sesion-vieja', '&vieja&sobra', 81234568);
    comprobar(ok, 'Toma las pistas de la sesión del episodio, no de la que quedó de otro');
    await q.evaluate(() => { window.__adelanto = 5000; });
    await reproducirDesde(q, 11);
    const dicho = await avisoQue(q, /sincronizados con Netflix/, 5);
    comprobar(!!dicho, 'Mide con el reloj de esa sesión', dicho ?? (await avisosDe(q)));
    await q.evaluate(() => document.querySelector('#v').pause());
    await q.waitForTimeout(200);
    const t = await q.evaluate(() => document.querySelector('#v').currentTime);
    const linea = await textoLinea(q, 'objetivo');
    comprobar(linea.includes('授業'), 'Los subtítulos siguen al video del episodio, no al que quedó del anuncio', `video ${t.toFixed(1)} s: ${linea}`);
    const marcado = await q.evaluate(() => document.querySelector('video[data-kotonoha-video]')?.id);
    comprobar(marcado === 'v', 'El <video> marcado es el del episodio', marcado);
    await q.close();
  }
}

// ---------- YouTube con subtítulos automáticos ----------

if (quiere('youtube')) {
  console.log('\n== YouTube con subtítulos automáticos ==');
  const correccionesAntes = cuantas(esCorreccion);
  const inicioYouTube = mock.peticiones.length;
  const p = abrir(await contexto.newPage(), 'youtube');
  await p.goto('https://www.youtube.com/watch?v=autoauto001');
  const corregida = await hasta(p, (r) => [...r.querySelectorAll('.nav-linea')].some((l) => l.textContent.includes('多分')), undefined, 30000);
  comprobar(!!corregida, 'Corrige los homófonos sin que se lo pidas', (await lineasNavegador(p))?.[1]);
  const lineas = await lineasNavegador(p);
  comprobar(lineas?.some((l) => l.includes('意志の弱さ')), 'También el segundo error: 医師 → 意志');
  comprobar(lineas?.some((l) => l.includes('明日もまた会いましょう')), 'Deja el resto tal cual');
  const pc = mock.peticiones.filter(esCorreccion).slice(correccionesAntes);
  comprobar(pc.length > 0 && sistemaPeticion(pc[0]).includes('講義の動画'), 'Claude recibe el título del video', `${pc.length} peticiones`);
  comprobar(sistemaPeticion(pc[0]).includes('明日もまた会いましょう'), 'Y todo el texto como contexto');
  comprobar(pc[0]?.cuerpo.model?.includes('sonnet'), 'Con Sonnet, no con Opus', pc[0]?.cuerpo.model);
  comprobar(!!(await hasta(p, (r) => [...r.querySelectorAll('.nav-corregida')].length === 2)), 'El navegador marca las líneas corregidas');
  const titulo = await enOverlay(p, (r) => r.querySelector('.nav-corregida')?.getAttribute('title'));
  comprobar(/Antes: .*たぶん/.test(titulo ?? ''), 'Y deja ver qué decían antes', titulo);
  await p.screenshot({ path: join(CAPTURAS, 'youtube-corregido.png') });

  // La revisión de lecturas va después, para no analizar un texto con errores.
  await hasta(p, (r) => !r.querySelector('.barra-proceso'), undefined, 8000);
  await p.waitForTimeout(800);
  const analisisYT = mock.peticiones.slice(inicioYouTube).filter(esAnalisis);
  comprobar(analisisYT.some((x) => textoPeticion(x).includes('多分')), 'La revisión de Claude analiza el texto ya corregido');
  comprobar(!analisisYT.some((x) => textoPeticion(x).includes('たぶん日本語')), 'Y no gasta en analizar el texto con errores');

  await abrirPanel(p, 'Generar subtítulos');
  const panel = await enOverlay(p, (r) => r.querySelector('.panel-generar')?.textContent ?? '');
  comprobar(/Whisper/.test(panel), 'En YouTube sí se ofrece Whisper');
  comprobar(/Corregir estos subtítulos/.test(panel), 'Y corregir a mano');
  comprobar(!!(await hasta(p, (r) => r.querySelector('.panel-generar')?.textContent.includes('ayudante local'), undefined, 10000)), 'Sin el ayudante instalado, explica cómo tenerlo');
  await p.screenshot({ path: join(CAPTURAS, 'youtube-panel.png') });

  await p.reload();
  const pedidasAntes = cuantas(esCorreccion);
  const recordada = await hasta(p, (r) => [...r.querySelectorAll('.nav-linea')].some((l) => l.textContent.includes('多分')), undefined, 30000);
  comprobar(!!recordada, 'Al volver, las correcciones siguen aplicadas');
  await p.waitForTimeout(1200);
  comprobar(cuantas(esCorreccion) === pedidasAntes, 'Sin volver a pagarlas');
  comprobar((await enOverlay(p, (r) => r.querySelectorAll('.nav-corregida').length)) === 2, 'Y sin perder qué decían antes');

  await abrirPanel(p, 'Generar subtítulos');
  await pulsar(p, 'Corregir estos subtítulos', '.panel-generar');
  await p.waitForTimeout(800);
  comprobar(cuantas(esCorreccion) > pedidasAntes, 'El botón sí vuelve a revisar');
  await p.close();

  console.log('\n== Sin corrección automática ==');
  await fijarAjustes({ corregirAutomaticos: false });
  const s = abrir(await contexto.newPage(), 'youtube-sin');
  const pedidasSin = cuantas(esCorreccion);
  await s.goto('https://www.youtube.com/watch?v=autoauto002');
  await hasta(s, (r) => r.querySelectorAll('.nav-linea').length === 6, undefined, 30000);
  await s.waitForTimeout(1000);
  comprobar(cuantas(esCorreccion) === pedidasSin, 'Con la opción apagada no corrige nada');
  comprobar((await lineasNavegador(s))?.some((l) => l.includes('たぶん')), 'Y deja el texto original');
  await s.close();
  await fijarAjustes({ corregirAutomaticos: true });
}

// ---------- Español a japonés ----------

if (quiere('japones')) {
  console.log('\n== Video con subtítulos solo en español ==');
  const p = abrir(await contexto.newPage(), 'youtube-es');
  await p.goto('https://www.youtube.com/watch?v=soloespanol');
  await hasta(p, (r) => r.querySelector('.barra') != null, undefined, 30000);
  await irA(p, 6);
  await hasta(p, (r) => r.querySelector('.linea-sub.secundaria')?.textContent.includes('Después'), undefined, 20000);
  comprobar((await textoLinea(p, 'secundaria')).includes('Después'), 'Empieza con el español como secundarios');
  await abrirPanel(p, 'Generar subtítulos');
  await p.screenshot({ path: join(CAPTURAS, 'japones-panel.png') });
  const boton = await pulsar(p, 'al japonés', '.panel-generar');
  comprobar(boton, 'Hay un botón para traducir al japonés');
  const creados = await hasta(p, (r) => r.querySelectorAll('.nav-linea').length === 6, undefined, 20000);
  comprobar(!!creados, 'Crea las 6 líneas en japonés');
  const pet = mock.peticiones.filter((x) => esTraduccion(x) && sistemaPeticion(x).includes('al japonés'));
  comprobar(pet.length > 0, 'Pide a Claude adaptar, no traducir palabra por palabra', sistemaPeticion(pet[0] ?? { cuerpo: {} }).slice(0, 90));
  await irA(p, 7);
  await hasta(p, (r) => r.querySelector('.linea-sub.objetivo .pal') != null);
  comprobar((await textoLinea(p, 'objetivo')).includes('日本語'), 'Se ve en japonés, ya con palabras consultables', await textoLinea(p, 'objetivo'));
  comprobar((await textoLinea(p, 'secundaria')).includes('Después'), 'Con el español debajo', await textoLinea(p, 'secundaria'));
  await p.screenshot({ path: join(CAPTURAS, 'japones-traducido.png') });
  await p.reload();
  comprobar(!!(await hasta(p, (r) => r.querySelectorAll('.nav-linea').length === 6, undefined, 30000)), 'Se guarda para la próxima vez');
  await p.close();
}

// ---------- Cuando Claude no traduce una línea ----------

if (quiere('negativas')) {
  console.log('\n== Una línea que Claude no traduce no se guarda con su disculpa ==');
  const p = abrir(await contexto.newPage(), 'cancion');
  await p.goto('https://www.youtube.com/watch?v=cancion0001');
  comprobar(!!(await hasta(p, (r) => r.querySelectorAll('.nav-linea').length === 6, undefined, 30000)), 'Carga la canción');
  // El segundo 2, el 7… caen en cada una de las seis líneas.
  const secundarias = async () => {
    const textos = [];
    for (let k = 0; k < 6; k++) {
      await irA(p, 2 + k * 5);
      await p.waitForTimeout(250);
      textos.push(await textoLinea(p, 'secundaria'));
    }
    return textos;
  };
  const botonTraducir = () => enOverlay(p, (r) => [...r.querySelectorAll('.panel-generar button')].map((b) => b.textContent).find((t) => /traducir al/i.test(t)) ?? '');
  const traducir = async (texto) => {
    await enOverlay(p, (r) => [...r.querySelectorAll('.aviso')].forEach((x) => x.remove()));
    const antes = mock.peticiones.length;
    const pulsado = await pulsar(p, texto, '.panel-generar');
    await hasta(p, (r) => [...r.querySelectorAll('.aviso')].some((x) => /Traducción lista|no tradujo/.test(x.textContent)), undefined, 15000);
    const aviso = await enOverlay(p, (r) => [...r.querySelectorAll('.aviso')].map((x) => x.textContent).join(' | '));
    const pedidas = mock.peticiones.slice(antes).filter(esTraduccion);
    return { pulsado, aviso, pedidas, lineas: pedidas.reduce((n, x) => n + lineasPedidas(x), 0) };
  };
  await abrirPanel(p, 'Generar subtítulos');

  // Como con una canción de verdad: Claude escribe su disculpa en el sitio de dos versos.
  mock.control.negativa = 'disculpa';
  const primera = await traducir('Traducir al español');
  comprobar(primera.pulsado, 'Se pide la traducción');
  comprobar(/salvo 2 líneas que Claude no tradujo/.test(primera.aviso), 'El aviso dice cuántas líneas quedaron sin traducir', primera.aviso);
  comprobar(sistemaPeticion(primera.pedidas[0] ?? { cuerpo: {} }).includes('sin_traducir'), 'Se le pide dejar fuera lo que no traduzca, sin disculparse en su lugar');
  let vistas = await secundarias();
  comprobar(!vistas.some((t) => /Lo siento|derechos de autor/.test(t)), 'Ninguna disculpa se ve como traducción', vistas.join(' | '));
  comprobar(vistas.filter((t) => t.includes('traducción')).length === 4 && !vistas[0] && !vistas[3], 'Las otras cuatro, traducidas; esas dos, vacías', vistas.join(' | '));
  comprobar(/Volver a traducir al español/.test(await botonTraducir()), 'Con una traducción hecha, el botón dice «Volver a traducir»', await botonTraducir());

  // Esta vez las deja fuera y lo explica aparte.
  mock.control.negativa = 'aparte';
  const segunda = await traducir('Volver a traducir al español');
  comprobar(segunda.lineas === 6, 'Volver a traducir pide todas las líneas, desde cero', `${segunda.lineas} líneas`);
  comprobar(/salvo 2 líneas/.test(segunda.aviso), 'Y vuelve a avisar', segunda.aviso);

  // Y a la tercera las traduce todas.
  mock.control.negativa = null;
  const tercera = await traducir('Volver a traducir al español');
  comprobar(tercera.lineas === 6 && /Traducción lista\./.test(tercera.aviso), 'Otra vez desde cero, y esta vez sale entera', `${tercera.lineas} líneas · ${tercera.aviso}`);
  vistas = await secundarias();
  comprobar(vistas.every((t) => t.includes('traducción')), 'Las seis líneas, traducidas', vistas.join(' | '));

  // Un rechazo de la API en el único lote: no llega nada, y se queda lo que había.
  mock.control.negativa = 'rechazo';
  const cuarta = await traducir('Volver a traducir al español');
  comprobar(/no tradujo ninguna línea\. Se queda la traducción que había/.test(cuarta.aviso), 'Si Claude no traduce nada, lo dice', cuarta.aviso);
  vistas = await secundarias();
  comprobar(vistas.every((t) => t.includes('traducción')), 'Y la traducción anterior sigue ahí', vistas.join(' | '));
  mock.control.negativa = null;

  console.log('\n== Borrar lo guardado de un video ==');
  const pistasSecundarias = async () => {
    await abrirSubtitulos(p);
    return (await elegida(p, 'Subtítulos secundarios'))?.todas ?? [];
  };
  comprobar((await pistasSecundarias()).some((t) => /Claude/.test(t)), 'Antes, la traducción de Claude está entre las pistas');
  const pulsarBorrar = () =>
    enOverlay(p, (r) => {
      const b = [...r.querySelectorAll('.panel-flotante .fila')].find((f) => f.textContent.includes('De este video'))?.querySelector('button');
      b?.click();
      return b?.textContent.trim() ?? '';
    });
  comprobar((await pulsarBorrar()) === 'Borrar', 'En los subtítulos del video hay un botón para borrar lo guardado');
  await p.waitForTimeout(500);
  comprobar((await pulsarBorrar()) === 'Confirmar', 'Pide confirmarlo antes de borrar');
  const borrado = await hasta(p, (r) => [...r.querySelectorAll('.aviso')].some((x) => /Se borraron los subtítulos guardados de este video/.test(x.textContent)), undefined, 8000);
  comprobar(!!borrado, 'Avisa de que se borraron');
  comprobar(!(await pistasSecundarias()).some((t) => /Claude/.test(t)), 'La traducción de Claude ya no está', (await pistasSecundarias()).join(' | '));
  await p.reload();
  await hasta(p, (r) => r.querySelectorAll('.nav-linea').length === 6, undefined, 30000);
  await p.waitForTimeout(800);
  comprobar(!(await pistasSecundarias()).some((t) => /Claude/.test(t)), 'Tampoco al volver al video', (await pistasSecundarias()).join(' | '));
  await p.close();
}

// ---------- Traducción progresiva ----------

if (quiere('progresiva')) {
  console.log('\n== Traducción de un video largo, por donde vas ==');
  await fijarAjustes({ analisisAutomatico: false });
  mock.control.retardoLineas = 1500;
  const p = abrir(await contexto.newPage(), 'largo');
  await p.goto('https://www.youtube.com/watch?v=largolargo1');
  await hasta(p, (r) => r.querySelector('.barra-resumen')?.textContent.length > 0 && r.querySelectorAll('.nav-linea').length > 0, undefined, 30000);
  await irA(p, 30);
  await hasta(p, (r) => r.querySelector('.linea-sub.objetivo')?.textContent.length > 0);
  await abrirPanel(p, 'Generar subtítulos');
  const antes = mock.peticiones.length;
  const t0 = Date.now();
  await pulsar(p, 'Traducir al español', '.panel-generar');
  const primera = await hasta(p, (r) => r.querySelector('.linea-sub.secundaria')?.textContent.includes('traducción'), undefined, 8000);
  const msPrimera = Date.now() - t0;
  comprobar(!!primera, 'La línea que estás viendo se traduce enseguida', `${msPrimera} ms`);
  const enMarcha = await enOverlay(p, (r) => r.querySelector('.panel-generar .progreso-linea')?.textContent ?? '');
  comprobar(/Traduciendo/.test(enMarcha), 'Mientras, sigue con el resto', enMarcha.slice(0, 60));
  const primerPedido = mock.peticiones.slice(antes).find(esTraduccion);
  comprobar(/"?159: /.test(textoPeticion(primerPedido).replace(/\\n/g, ' ')) && !/\b10: /.test(textoPeticion(primerPedido)), 'Empezó por el tramo donde estás, no por el principio');
  await p.screenshot({ path: join(CAPTURAS, 'traduccion-progresiva.png') });

  // Cancelar conserva lo hecho, y volver a traducir empieza desde cero.
  const hechasAlCancelar = Number(/Traduciendo (\d+) de/.exec(await enOverlay(p, (r) => r.querySelector('.panel-generar .progreso-linea')?.textContent ?? ''))?.[1] ?? 0);
  await pulsar(p, 'Cancelar', '.panel-generar');
  await p.waitForTimeout(1500);
  comprobar((await textoLinea(p, 'secundaria')).includes('traducción'), 'Al cancelar, lo traducido se queda');
  const antesSeguir = mock.peticiones.length;
  comprobar(await pulsar(p, 'Volver a traducir al español', '.panel-generar'), 'Con algo traducido, el botón dice «Volver a traducir al español»');
  await hasta(p, (r) => !r.querySelector('.panel-generar .progreso-linea') && r.querySelector('.panel-generar'), undefined, 15000);
  await p.waitForTimeout(300);
  const nuevas = mock.peticiones.slice(antesSeguir).filter(esTraduccion).reduce((n, x) => n + lineasPedidas(x), 0);
  comprobar(hechasAlCancelar > 0 && nuevas === 300, 'Volver a traducir pide todas las líneas, desde cero', `${hechasAlCancelar} hechas al cancelar, pide ${nuevas}`);
  await irA(p, 1);
  await p.waitForTimeout(400);
  comprobar((await textoLinea(p, 'secundaria')).includes('traducción'), 'Y al final está todo');
  mock.control.retardoLineas = 0;

  console.log('\n== La revisión de Claude va por donde vas ==');
  await fijarAjustes({ analisisAutomatico: true });
  const inicioRevision = mock.peticiones.length;
  const pedidasRevision = () => mock.peticiones.slice(inicioRevision).filter(esAnalisis);
  const numeros = () => [...new Set(pedidasRevision().flatMap((x) => [...textoPeticion(x).matchAll(/(?:\\n|")(\d+): /g)].map((m) => Number(m[1]))))];
  await p.reload();
  await hasta(p, (r) => r.querySelectorAll('.nav-linea').length > 0, undefined, 30000);
  await irA(p, 1);
  for (let i = 0; i < 60 && !pedidasRevision().length; i++) await p.waitForTimeout(200);
  await p.waitForTimeout(1500);
  const alEmpezar = pedidasRevision().reduce((n, x) => n + lineasPedidas(x), 0);
  comprobar(alEmpezar > 0 && alEmpezar <= 120, 'Al abrir el video solo revisa el tramo que viene, no las 300 líneas', `${alEmpezar} líneas`);
  await p.screenshot({ path: join(CAPTURAS, 'revision-tramo.png') });
  // Saltar a otro punto revisa ese tramo, y lo ya revisado no se vuelve a pedir.
  await irA(p, 40);
  for (let i = 0; i < 40 && pedidasRevision().reduce((n, x) => n + lineasPedidas(x), 0) === alEmpezar; i++) await p.waitForTimeout(200);
  await p.waitForTimeout(1500);
  const trasSaltar = pedidasRevision().reduce((n, x) => n + lineasPedidas(x), 0);
  comprobar(trasSaltar > alEmpezar && trasSaltar <= 240, 'Al saltar más adelante revisa ese tramo', `${trasSaltar} líneas en total`);
  await irA(p, 1);
  await p.waitForTimeout(1500);
  comprobar(pedidasRevision().reduce((n, x) => n + lineasPedidas(x), 0) === trasSaltar, 'Volver atrás no pide nada', `${trasSaltar} líneas`);
  await fijarAjustes({ analisisAutomatico: false });
  await fijarAjustes({ analisisAutomatico: true });
  await p.close();
}

// ---------- Ajustes ----------

if (quiere('ajustes')) {
  console.log('\n== Ajustes ==');
  const p = abrir(await contexto.newPage(), 'ajustes');
  await p.goto(`chrome-extension://${idExtension}/app.html#/ajustes`);
  await p.waitForTimeout(1500);
  await p.evaluate(() => document.querySelector('#transcripcion')?.scrollIntoView());
  await p.waitForFunction(() => document.body.innerText.includes('Ayudante para YouTube'), undefined, { timeout: 15000 }).catch(() => {});
  const texto = await p.evaluate(() => document.body.innerText);
  comprobar(texto.includes('Ayudante para YouTube'), 'Aparece el ayudante');
  await p.waitForFunction(() => document.body.innerText.includes('instalar.ps1'), undefined, { timeout: 12000 }).catch(() => {});
  comprobar((await p.evaluate(() => document.body.innerText)).includes('instalar.ps1'), 'Sin instalar, dice qué ejecutar');
  await p.screenshot({ path: join(CAPTURAS, 'ajustes-ayudante.png') });
  // Si el puente del service worker no respondiera, la consulta tardaría los 8 s de su límite.
  const consulta = await p.evaluate(async () => {
    const t0 = performance.now();
    const r = await chrome.runtime.sendMessage({ canal: 'motor', metodo: 'ayudante', args: [] });
    return { ok: r?.ok, valor: r?.valor, ms: Math.round(performance.now() - t0) };
  });
  comprobar(consulta.ok && consulta.valor === null && consulta.ms < 3000, 'El puente responde enseguida que no está instalado', `${consulta.ms} ms`);
  await p.close();
}

if (errores.length) {
  console.log('\nErrores de consola:');
  for (const e of [...new Set(errores)].slice(0, 16)) console.log(' -', e.slice(0, 220));
}
console.log(`\n${fallos ? `${fallos} comprobaciones fallaron` : 'Todas las comprobaciones pasaron'}. Peticiones a Claude: ${mock.peticiones.length}`);
await contexto.close();
process.exit(fallos ? 1 : 0);
