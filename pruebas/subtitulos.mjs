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
  const pais = new URLSearchParams(location.search).get('r') ?? 'jp';
  const pistas = pais === 'jp'
    ? [{ trackId: 't-ja', displayName: '日本語', bcp47: 'ja' }, { trackId: 't-en', displayName: 'English', bcp47: 'en' }]
    : [{ trackId: 't-es', displayName: 'Español (Latinoamérica)', bcp47: 'es-419' }];
  const v = document.getElementById('v');
  const jugador = { getTimedTextTrackList: () => pistas, getTimedTextTrack: () => pistas[0], setTimedTextTrack: async () => {}, seek: (ms) => { v.currentTime = ms / 1000; }, play: () => v.play(), pause: () => v.pause(), getMovieId: () => 1 };
  window.netflix = { appContext: { state: { playerApp: {
    getAPI: () => ({ videoPlayer: { getAllPlayerSessionIds: () => ['watch1'], getVideoPlayerBySessionId: () => jugador }, getVideoMetadataByVideoId: () => ({ getCurrentVideo: () => ({ getTitle: () => 'Película de prueba' }) }) }),
    getState: () => ({ videoPlayer: { cadmiumPlayerRepository: { playersById: { watch1: { datos: pistas.map((p) => ({ type: 'timedtext', trackId: p.trackId, urls: [{ url: 'https://subs.test/' + p.trackId + '.vtt' }] })) } } } } }),
  } } } };
</script>`;
}

const PISTAS_YT = {
  autoauto001: [{ languageCode: 'ja', kind: 'asr', vssId: 'a.ja', name: { simpleText: '日本語 (自動生成)' } }],
  autoauto002: [{ languageCode: 'ja', kind: 'asr', vssId: 'a.ja', name: { simpleText: '日本語 (自動生成)' } }],
  autoauto003: [{ languageCode: 'ja', kind: 'asr', vssId: 'a.ja', name: { simpleText: '日本語 (自動生成)' } }],
  soloespanol: [{ languageCode: 'es', vssId: '.es', name: { simpleText: 'Español' } }],
  largolargo1: [{ languageCode: 'ja', vssId: '.ja', name: { simpleText: '日本語' } }],
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
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
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

  // Cancelar conserva lo hecho, y seguir no vuelve a pagarlo.
  const hechasAlCancelar = Number(/Traduciendo (\d+) de/.exec(await enOverlay(p, (r) => r.querySelector('.panel-generar .progreso-linea')?.textContent ?? ''))?.[1] ?? 0);
  await pulsar(p, 'Cancelar', '.panel-generar');
  await p.waitForTimeout(1500);
  const antesSeguir = mock.peticiones.length;
  await pulsar(p, 'Traducir al español', '.panel-generar');
  await hasta(p, (r) => !r.querySelector('.panel-generar .progreso-linea') && r.querySelector('.panel-generar'), undefined, 15000);
  await p.waitForTimeout(300);
  const nuevas = mock.peticiones.slice(antesSeguir).filter(esTraduccion).reduce((n, x) => n + lineasPedidas(x), 0);
  comprobar(hechasAlCancelar > 0 && nuevas === 300 - hechasAlCancelar, 'Al seguir solo pide las que faltan', `${hechasAlCancelar} hechas, pide ${nuevas}`);
  await irA(p, 1);
  await p.waitForTimeout(400);
  comprobar((await textoLinea(p, 'secundaria')).includes('traducción'), 'Y al final está todo');
  mock.control.retardoLineas = 0;
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
