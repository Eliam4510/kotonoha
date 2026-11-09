// Estudiar alemán de principio a fin: elegir la lengua, instalar sus diccionarios de verdad, analizar, ver un video, leer
// una página y volver al japonés sin que se mezcle nada. Los diccionarios se descargan una vez y se quedan en el perfil.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/aleman.mjs

import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';
import { iniciarMock } from './mock-claude.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-aleman'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'aleman');
mkdirSync(CAPTURAS, { recursive: true });

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};

// Otro video en cada ejecución: de uno ya visto, sus correcciones están guardadas y no se vuelven a pedir.
const ID = `aleman${Date.now() % 1000000}`;
// Como los automáticos de YouTube: sin mayúsculas al principio ni puntuación.
const CUES = [
  [500, 3400, 'gestern ging ich mit den Kindern in die alten Häuser'],
  [3500, 6400, 'sie fängt morgen mit der neuen Arbeit an'],
  [6500, 9400, 'Das Essen war sehr gut, aber zu teuer.'],
  [9500, 12400, 'Wenn ich Zeit hätte, würde ich mehr lesen.'],
];
const json3 = JSON.stringify({ events: CUES.map(([a, b, t]) => ({ tStartMs: a, dDurationMs: b - a, segs: [{ utf8: t }] })) });
const ES = JSON.stringify({ events: CUES.map(([a, b], i) => ({ tStartMs: a, dDurationMs: b - a, segs: [{ utf8: `Línea traducida ${i + 1}` }] })) });

const PAGINA_VIDEO = `<!doctype html><html lang="de"><meta charset="utf-8"><title>Ein Spaziergang durch Berlin - YouTube</title>
<body style="margin:0;background:#0f0f0f;color:#fff;font-family:sans-serif">
<div style="height:56px"></div>
<div id="movie_player" style="position:relative;width:1280px;height:600px;margin:0 auto;background:#000"><video id="v" src="https://media.test/video.webm" muted style="width:100%;height:100%"></video></div>
<script>
  const pistas = [
    { languageCode: 'de', kind: 'asr', vssId: 'a.de', name: { simpleText: 'Deutsch (automatisch erzeugt)' } },
    { languageCode: 'es', vssId: '.es', name: { simpleText: 'Español' } },
  ].map((t) => ({ ...t, baseUrl: 'https://www.youtube.com/api/timedtext?v=${ID}&lang=' + t.languageCode, url: 'https://www.youtube.com/api/timedtext?v=${ID}&pot=x&lang=' + t.languageCode }));
  const j = document.getElementById('movie_player');
  const v = document.getElementById('v');
  j.getPlayerResponse = () => ({ videoDetails: { videoId: '${ID}', title: 'Ein Spaziergang durch Berlin' }, captions: { playerCaptionsTracklistRenderer: { captionTracks: pistas } } });
  j.getAudioTrack = () => ({ captionTracks: pistas });
  j.getVideoData = () => ({ video_id: '${ID}', title: 'Ein Spaziergang durch Berlin' });
  j.seekTo = (s) => { v.currentTime = s; };
  j.playVideo = () => v.play();
  j.pauseVideo = () => v.pause();
  j.loadModule = () => {};
  j.setOption = () => {};
</script>`;

const PAGINA_ALEMAN = `<!doctype html><html lang="de"><meta charset="utf-8"><title>Ein kurzer Artikel</title>
<style>body { margin: 0; font: 18px/1.7 Georgia, serif; color: #222; background: #fff; } main { padding: 30px 56px; max-width: 760px; }</style>
<main><h1>Die alte Bibliothek ist wieder offen</h1>
<p id="uno">Die alte Bibliothek der Stadt hat nach zwei Jahren Bauzeit endlich wieder geöffnet. Viele Besucher hatten sich darauf gefreut, und manche nahmen schon am ersten Tag ein Buch mit nach Hause.</p>
<p>„Wir haben nicht mit so vielen Menschen gerechnet“, sagte die Bibliothekarin.</p></main></html>`;

const mock = await iniciarMock();
const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1600, height: 900 },
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--autoplay-policy=no-user-gesture-required'],
});
const bytesVideo = readFileSync(join(RAIZ, 'pruebas', 'fixtures', 'video.webm'));
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
  if (u.pathname === '/watch') return r.fulfill({ status: 200, contentType: 'text/html', body: PAGINA_VIDEO });
  return r.fulfill({ status: 204 });
});
await contexto.route('https://aleman.test/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: PAGINA_ALEMAN }));

const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
for (const pg of contexto.pages()) if (pg.url().includes('app.html')) await pg.close();
await sw.evaluate(async (url) => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ urlBaseIA: url, claveAnthropic: 'clave-de-prueba', ajustes: { ...(d.ajustes ?? {}), idiomaInterfaz: 'es', bienvenidaVista: true, destino: 'memoria', ankiPuerto: 1, modo: 'normal', salto: 'no', navegadorAbierto: false, subsPosicion: null, idiomaSecundario: 'es', idiomaExplicaciones: 'español', idiomaTraduccion: 'español' } });
}, `http://127.0.0.1:${mock.puerto}`);
const leerAjustes = () => sw.evaluate(async () => (await chrome.storage.local.get('ajustes')).ajustes);

const app = await contexto.newPage();
const errores = [];
app.on('pageerror', (e) => errores.push(`app: ${e.message}`));
await app.goto(`chrome-extension://${id}/app.html#/ajustes`);
await app.waitForTimeout(1200);
const motor = async (metodo, ...args) => {
  const r = await app.evaluate(({ metodo, args }) => chrome.runtime.sendMessage({ canal: 'motor', metodo, args }), { metodo, args });
  if (!r?.ok) throw new Error(`${metodo}: ${r?.error ?? 'sin respuesta'}`);
  return r.valor;
};

// ---------- Elegir la lengua ----------

console.log('\n== Elegir la lengua ==');
const selector = app.locator('select[aria-label="Idioma que estudias"]');
const opciones = await selector.locator('option').allTextContents();
comprobar(opciones.join('|') === 'Japonés · 日本語|Inglés · English|Alemán · Deutsch', 'Se puede elegir el alemán', opciones.join(' | '));
if ((await selector.inputValue()) !== 'de') {
  await selector.selectOption('de');
  await app.waitForTimeout(800);
}
const a = await leerAjustes();
comprobar(a.idiomaObjetivo === 'de', 'Al elegir alemán se guarda');
comprobar(a.nivel === 'CEFR A2' && a.formatoLectura === 'de' && a.furigana === 'ninguna' && a.lectorActivo === false, 'Y empieza con sus propios ajustes', `${a.nivel}, ${a.formatoLectura}`);
comprobar((await motor('estadisticasPalabras')).conocidas === 0, 'El alemán no hereda las palabras de otra lengua');

// ---------- Diccionarios ----------

console.log('\n== Diccionarios de alemán ==');
const fuentes = await motor('fuentesDiccionario');
comprobar(fuentes.some((f) => f.id === 'wty-de-es-gloss') && !fuentes.some((f) => f.id.startsWith('jmdict') || f.id.startsWith('wty-en')), 'La biblioteca es la del alemán', `${fuentes.length} fuentes`);
const instalados = new Set((await motor('estado')).diccionarios.map((d) => d.id));
for (const d of ['wty-de-es', 'wty-de-es-gloss', 'wty-de-en', 'wty-de-ipa', 'frecuencia-subtitulos-de']) {
  if (instalados.has(d)) continue;
  const t0 = Date.now();
  await motor('instalarDiccionario', d);
  console.log(`  instalado ${d} en ${Math.round((Date.now() - t0) / 1000)} s`);
}
let estado = await motor('estado');
console.log('  ', estado.diccionarios.map((d) => `${d.id}: ${d.filas}`).join(', '));
comprobar(estado.diccionarios.find((d) => d.id === 'wty-de-ipa')?.tipo === 'acento', 'La pronunciación se reconoce como tal');
comprobar(estado.diccionarios.find((d) => d.id === 'frecuencia-subtitulos-de')?.tipo === 'frecuencia', 'Y la lista de frecuencia');
for (let i = 0; i < 60 && estado.terminosCargados <= 50000; i++) {
  await app.waitForTimeout(500);
  estado = await motor('estado');
}
comprobar(estado.terminosCargados > 50000, 'Los términos están en memoria', estado.terminosCargados);
const bases = await app.evaluate(async () => (await indexedDB.databases()).map((d) => `${d.name}:${d.version}`));
// La tabla de formas llegó con la versión 6 de la base (Dexie la multiplica por 10).
const versionDe = Number(bases.find((b) => b.startsWith('kikitori-de:'))?.split(':')[1] ?? 0);
comprobar(versionDe >= 60, 'El alemán tiene su base, con la tabla de formas', bases.join(', '));

// ---------- Análisis y diccionario ----------

console.log('\n== Análisis ==');
const frase = 'Gestern ging ich mit den Kindern in die schönen alten Häuser.';
const t0 = Date.now();
const [linea] = await motor('analizarTexto', frase);
console.log(`   analizada en ${Date.now() - t0} ms:`, linea.filter((x) => x.esPalabra).map((x) => `${x.superficie}→${x.lema}${x.rango ? `#${x.rango}` : ''}${x.glosa ? `(${x.glosa})` : ''}`).join(' '));
const pal = (s) => linea.find((x) => x.superficie === s);
comprobar(linea.map((x) => x.superficie).join('') === frase, 'Las palabras reproducen el texto');
comprobar(pal('ging')?.lema === 'gehen', 'ging es gehen', pal('ging')?.lema);
comprobar(pal('Gestern')?.lema === 'gestern', 'Al principio de la frase, Gestern es el adverbio, no das Gestern', pal('Gestern')?.lema);
comprobar(pal('ging')?.flexion?.includes('Präteritum'), 'En pretérito', pal('ging')?.flexion?.join(','));
comprobar(pal('Kindern')?.lema === 'Kind', 'Kindern es Kind', pal('Kindern')?.lema);
comprobar(pal('Häuser')?.lema === 'Haus', 'Häuser es Haus', pal('Häuser')?.lema);
comprobar(pal('schönen')?.lema === 'schön', 'schönen es el adjetivo schön, no el verbo', pal('schönen')?.lema);
comprobar(pal('die')?.lema === 'der' && pal('die')?.esGramatica, 'Los artículos van a der y se dan por conocidos');
comprobar(!!pal('Häuser')?.glosa, 'Tiene traducción bajo la palabra', pal('Häuser')?.glosa);
comprobar(pal('ging')?.rango > 0, 'Tiene frecuencia', pal('ging')?.rango);
comprobar(pal('Häuser')?.rango > 0 && pal('Kindern')?.rango > 0, 'También los sustantivos, aunque la lista venga en minúsculas', `${pal('Häuser')?.rango}, ${pal('Kindern')?.rango}`);
comprobar(/\//.test(pal('Häuser')?.furigana?.[0]?.lectura ?? ''), 'Sabe cómo suena', pal('Häuser')?.furigana?.[0]?.lectura);
comprobar(pal('Häuser')?.estado === 'desconocida', 'Las demás empiezan como desconocidas');

const gehen = await motor('buscar', 'gehen');
comprobar(gehen.entradas.length > 0, 'El diccionario responde', `${gehen.entradas.length} entradas`);
console.log('   definiciones:', gehen.entradas.flatMap((e) => e.glosas).slice(0, 4).join(' | ').slice(0, 200));
comprobar(gehen.pronunciaciones?.some((t) => t.zona === 'de'), 'Con su pronunciación', JSON.stringify(gehen.pronunciaciones));
comprobar(!gehen.entradas.flatMap((e) => e.glosas).some((g) => /Etymolog|Grammar|Etimolog/.test(g)), 'Las definiciones no arrastran etimologías ni la gramática');
const libre = await motor('buscarLibre', 'ging');
comprobar(libre.some((r) => r.lema === 'gehen' && r.entradas.length), 'La búsqueda libre entiende formas conjugadas', libre.map((r) => r.lema).join(', '));
const comp = await motor('compuestos', ['fängt', ' ', 'morgen', ' ', 'mit', ' ', 'der', ' ', 'Arbeit', ' ', 'an', '.']);
comprobar(comp.some((r) => r.lema === 'anfangen'), 'Encuentra el verbo separable con la partícula al final', comp.map((r) => r.lema).join(', '));
const audios = await motor('audiosPalabra', 'Haus', 'Haus');
comprobar(audios.length > 0, 'Hay grabaciones de la palabra', `${audios.length}: ${audios.slice(0, 2).map((x) => x.etiqueta).join(', ')}`);

// ---------- Un video ----------

console.log('\n== Un video en alemán ==');
const p = await contexto.newPage();
p.on('pageerror', (e) => errores.push(`video: ${e.message}`));
await p.goto(`https://www.youtube.com/watch?v=${ID}`);
const enOverlay = (fn, arg) => p.evaluate(({ fn, arg }) => {
  const r = (document.querySelector('kotonoha-overlay:not([popover])') ?? document.querySelector('kotonoha-overlay'))?.shadowRoot;
  return r ? new Function('r', 'arg', `return (${fn})(r, arg)`)(r, arg) : null;
}, { fn: fn.toString(), arg });
const hasta = async (fn, arg, ms = 20000) => {
  const limite = Date.now() + ms;
  for (;;) {
    const v = await enOverlay(fn, arg).catch(() => null);
    if (v) return v;
    if (Date.now() > limite) return null;
    await p.waitForTimeout(80);
  }
};
await hasta((r) => r.querySelector('.barra') != null, undefined, 30000);
await p.evaluate(() => { const v = document.querySelector('#v'); v.pause(); v.currentTime = 1; });
await hasta((r) => r.querySelector('.linea-sub.objetivo .pal') != null);
await p.waitForTimeout(1500);
const textoVisible = (e) => {
  const c = e.cloneNode(true);
  c.querySelectorAll('rt, .glosa').forEach((x) => x.remove());
  return c.textContent;
};
const texto = await enOverlay(`(r) => (${textoVisible})(r.querySelector('.linea-sub.objetivo'))`);
comprobar(/ging ich mit den Kindern/i.test(texto), 'Elige los subtítulos en alemán', texto);
comprobar((await enOverlay((r) => r.querySelector('.linea-sub.secundaria')?.textContent ?? '')).includes('Línea traducida'), 'Y los secundarios en el idioma de quien estudia');
await p.screenshot({ path: join(CAPTURAS, 'video.png') });
const pedidas = () => mock.peticiones.filter((x) => x.url.includes('/messages'));
comprobar(pedidas().some((x) => /subtítulos en alemán generados/.test(JSON.stringify(x.cuerpo.system ?? ''))), 'Corrige los subtítulos automáticos con el prompt del alemán');

const palabraEn = (s) => enOverlay(`(r, s) => {
  const e = [...r.querySelectorAll('.linea-sub.objetivo .pal')].find((x) => (${textoVisible})(x).trim().toLowerCase() === s);
  if (!e) return null;
  const c = e.getBoundingClientRect();
  return { x: c.left + c.width / 2, y: c.top + c.height / 2 };
}`, s);
const sitio = await palabraEn('ging');
comprobar(!!sitio, 'La palabra se puede señalar');
if (sitio) {
  await p.mouse.move(sitio.x, sitio.y);
  await hasta((r) => (r.querySelector('.ficha-palabra')?.textContent ?? '').length > 0, undefined, 6000);
  await p.waitForTimeout(600);
  const ficha = await enOverlay((r) => ({
    palabra: r.querySelector('.ficha-palabra')?.textContent,
    ipa: r.querySelector('.ficha-ipa')?.textContent,
    defs: [...r.querySelectorAll('.lista-defs li')].map((x) => x.textContent).slice(0, 3),
    pestanas: [...r.querySelectorAll('.ficha-dock .pestana')].map((x) => x.textContent.trim()),
    flexion: r.querySelector('.flexiones')?.textContent,
  }));
  console.log('  ', JSON.stringify(ficha).slice(0, 400));
  comprobar(ficha.palabra === 'gehen', 'La ficha abre su forma de diccionario', ficha.palabra);
  comprobar(/\/.+\//.test(ficha.ipa ?? ''), 'Con la pronunciación', ficha.ipa);
  comprobar(ficha.defs.length > 0, 'Con definiciones', ficha.defs[0]);
  comprobar(/Präteritum/.test(ficha.flexion ?? '') && /pretérito/.test(ficha.flexion ?? ''), 'Y dice qué forma es, en alemán y en el idioma de la interfaz', ficha.flexion);
  comprobar(!ficha.pestanas.includes('Trazos'), 'Sin la pestaña de trazos');
  await p.screenshot({ path: join(CAPTURAS, 'ficha.png') });
}
await p.close();

// ---------- Una página ----------

console.log('\n== Una página en alemán ==');
await sw.evaluate(async () => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ ajustes: { ...d.ajustes, lectorActivo: true } });
});
const w = await contexto.newPage();
w.on('pageerror', (e) => errores.push(`página: ${e.message}`));
await w.goto('https://aleman.test/artikel');
const marcadas = await w.waitForFunction(() => Number(document.querySelector('kotonoha-overlay')?.dataset.kkRangos) > 0, null, { timeout: 30000 }).then(() => true).catch(() => false);
comprobar(marcadas, 'El lector marca las palabras de la página');
await w.waitForTimeout(600);
const caja = await w.evaluate(() => {
  const t = document.createTreeWalker(document.getElementById('uno'), NodeFilter.SHOW_TEXT);
  t.nextNode();
  const i = t.currentNode.data.indexOf('Besucher');
  const r = document.createRange();
  r.setStart(t.currentNode, i + 2);
  r.setEnd(t.currentNode, i + 4);
  const c = r.getBoundingClientRect();
  return { x: c.left + c.width / 2, y: c.top + c.height / 2 };
});
await w.mouse.click(caja.x, caja.y);
const conFicha = await w.waitForFunction(() => document.querySelector('kotonoha-overlay')?.shadowRoot?.querySelector('.ficha-palabra'), null, { timeout: 15000 }).then(() => true).catch(() => false);
await w.waitForTimeout(700);
const fichaWeb = conFicha ? await w.evaluate(() => document.querySelector('kotonoha-overlay').shadowRoot.querySelector('.ficha-palabra')?.textContent ?? '') : '';
comprobar(fichaWeb === 'Besucher', 'Un clic en una palabra de la página abre su ficha', fichaWeb);
await w.screenshot({ path: join(CAPTURAS, 'pagina.png') });
await w.close();

// ---------- Vuelta al japonés ----------

// El perfil se reutiliza: el alemán vuelve a sus ajustes iniciales para la próxima vez.
await sw.evaluate(async () => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ ajustes: { ...d.ajustes, lectorActivo: false } });
});

console.log('\n== Vuelta al japonés ==');
await app.goto(`chrome-extension://${id}/app.html#/ajustes`);
await app.waitForTimeout(1000);
await app.locator('select[aria-label="Idioma que estudias"]').selectOption('ja');
await app.waitForTimeout(1500);
comprobar((await leerAjustes()).idiomaObjetivo === 'ja', 'Se vuelve al japonés');
const fuentesJa = await motor('fuentesDiccionario');
comprobar(fuentesJa.some((f) => f.id.startsWith('jmdict')) && !fuentesJa.some((f) => f.id.startsWith('wty-de')), 'Con su biblioteca, sin la del alemán');
const [lineaJa] = await motor('analizarTexto', '図書館で本を読む');
comprobar(lineaJa.some((x) => x.lema === '図書館' || x.lema === '読む'), 'Y su analizador', lineaJa.filter((x) => x.esPalabra).map((x) => x.lema).join(' '));

if (errores.length) console.log('Errores de página:', errores.slice(0, 8).join('\n'));
comprobar(!errores.length, 'Ningún error de página', errores.length);
console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien');
await contexto.close();
process.exit(fallos ? 1 : 0);
