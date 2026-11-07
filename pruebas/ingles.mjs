// Estudiar inglés de principio a fin: elegir la lengua, instalar sus diccionarios, ver un video, leer una página y volver
// al japonés sin que se mezcle nada. Los diccionarios se descargan una vez y se quedan en el perfil.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/ingles.mjs

import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';
import { iniciarMock } from './mock-claude.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-ingles'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'ingles');
mkdirSync(CAPTURAS, { recursive: true });

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};

const ID = 'ingles01';
// Como los automáticos de YouTube: sin mayúsculas ni puntuación, y con líneas que se solapan.
const CUES = [
  [500, 3400, "she picked it up and went home because she didn't want to wait"],
  [3500, 6400, 'we were building a new building downtown'],
  [6500, 9400, 'He saw a saw on the table.'],
  [9500, 12400, 'If I had known, I would have told you.'],
];
const json3 = JSON.stringify({ events: CUES.map(([a, b, t]) => ({ tStartMs: a, dDurationMs: b - a, segs: [{ utf8: t }] })) });
const ES = JSON.stringify({ events: CUES.map(([a, b], i) => ({ tStartMs: a, dDurationMs: b - a, segs: [{ utf8: `Línea traducida ${i + 1}` }] })) });
const JA = JSON.stringify({ events: CUES.map(([a, b]) => ({ tStartMs: a, dDurationMs: b - a, segs: [{ utf8: '図書館で本を読む' }] })) });

const PAGINA_VIDEO = `<!doctype html><html lang="en"><meta charset="utf-8"><title>An English lecture - YouTube</title>
<body style="margin:0;background:#0f0f0f;color:#fff;font-family:sans-serif">
<div style="height:56px"></div>
<div id="movie_player" style="position:relative;width:1280px;height:600px;margin:0 auto;background:#000"><video id="v" src="https://media.test/video.webm" muted style="width:100%;height:100%"></video></div>
<script>
  const pistas = [
    { languageCode: 'en', kind: 'asr', vssId: 'a.en', name: { simpleText: 'English (auto-generated)' } },
    { languageCode: 'es', vssId: '.es', name: { simpleText: 'Español' } },
    { languageCode: 'ja', vssId: '.ja', name: { simpleText: '日本語' } },
  ].map((t) => ({ ...t, baseUrl: 'https://www.youtube.com/api/timedtext?v=${ID}&lang=' + t.languageCode, url: 'https://www.youtube.com/api/timedtext?v=${ID}&pot=x&lang=' + t.languageCode }));
  const j = document.getElementById('movie_player');
  const v = document.getElementById('v');
  j.getPlayerResponse = () => ({ videoDetails: { videoId: '${ID}', title: 'An English lecture' }, captions: { playerCaptionsTracklistRenderer: { captionTracks: pistas } } });
  j.getAudioTrack = () => ({ captionTracks: pistas });
  j.getVideoData = () => ({ video_id: '${ID}', title: 'An English lecture' });
  j.seekTo = (s) => { v.currentTime = s; };
  j.playVideo = () => v.play();
  j.pauseVideo = () => v.pause();
  j.loadModule = () => {};
  j.setOption = () => {};
</script>`;

const PAGINA_INGLES = `<!doctype html><html lang="en"><meta charset="utf-8"><title>A short article</title>
<style>body { margin: 0; font: 18px/1.7 Georgia, serif; color: #222; background: #fff; } main { padding: 30px 56px; max-width: 760px; }</style>
<nav><a id="menu1" href="#" style="display:inline-block;padding:0 12px">Home</a><a id="menu2" href="#" style="display:inline-block;padding:0 12px">Level</a></nav>
<main><h1>The old library reopens</h1>
<p id="uno">The town's old library has finally reopened after two years of work. Visitors were looking forward to it, and many of them picked up a book on the very first day.</p>
<p>"We didn't expect so many people," said the librarian. It's the best thing that has happened here in years.</p></main></html>`;

const PAGINA_ESPANOL = `<!doctype html><html lang="es"><meta charset="utf-8"><title>Un artículo</title>
<main><h1>La biblioteca vuelve a abrir</h1><p id="uno">La vieja biblioteca del pueblo ha vuelto a abrir después de dos años de obras. Muchos visitantes se llevaron un libro el primer día.</p></main></html>`;

const PAGINA_JAPONES = `<!doctype html><html lang="ja"><meta charset="utf-8"><title>図書館</title>
<main><p id="uno">町の図書館に新しい読書室が完成しました。天気のいい日には山の景色を眺めながら本を読むことができます。</p></main></html>`;

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
  if (u.pathname.includes('/api/timedtext')) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: { es: ES, ja: JA }[u.searchParams.get('lang')] ?? json3 });
  if (u.pathname === '/watch') return r.fulfill({ status: 200, contentType: 'text/html', body: PAGINA_VIDEO });
  return r.fulfill({ status: 204 });
});
await contexto.route('https://ingles.test/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: PAGINA_INGLES }));
await contexto.route('https://espanol.test/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: PAGINA_ESPANOL }));
await contexto.route('https://japones.test/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: PAGINA_JAPONES }));

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
const lenguaActual = async () => (await leerAjustes()).idiomaObjetivo;

// ---------- Elegir la lengua ----------

console.log('\n== Elegir la lengua ==');
// Si una ejecución anterior se quedó en inglés, se vuelve al punto de partida.
await motor('fijarLengua', 'ja');
await sw.evaluate(async () => {
  const d = await chrome.storage.local.get('ajustes');
  const a = d.ajustes ?? {};
  if (a.idiomaObjetivo === 'en') await chrome.storage.local.set({ ajustes: { ...a, idiomaObjetivo: 'ja', porLengua: {}, nivel: 'JLPT N3', formatoLectura: 'hiragana', furigana: 'todas', lectorFurigana: 'desconocidas', lectorActivo: true, colorAcento: 'siempre', ankiMazo: 'Kotonoha' } });
});
await app.reload();
await app.waitForTimeout(1200);
await motor('cambiarPalabras', [{ clave: '図書館|としょかん', lema: '図書館', lectura: 'としょかん', estado: 'conocida' }]);
const japonesAntes = await motor('estadisticasPalabras');

const selector = app.locator('select[aria-label="Idioma que estudias"]');
comprobar((await selector.inputValue()) === 'ja', 'Se empieza estudiando japonés');
comprobar((await selector.locator('option').allTextContents()).join('|') === 'Japonés · 日本語|Inglés · English', 'Se puede elegir entre las dos', (await selector.locator('option').allTextContents()).join(' | '));
await selector.selectOption('en');
await app.waitForTimeout(600);
const a = await leerAjustes();
comprobar(a.idiomaObjetivo === 'en', 'Al elegir inglés se guarda');
comprobar(a.nivel === 'CEFR B1' && a.formatoLectura === 'us' && a.furigana === 'ninguna' && a.lectorActivo === false, 'Y empieza con sus propios ajustes', `${a.nivel}, ${a.formatoLectura}`);
comprobar(a.porLengua?.ja?.nivel === 'JLPT N3', 'Los del japonés quedan guardados', a.porLengua?.ja?.nivel);
await app.waitForTimeout(800);
const nivel = app.locator('select[aria-label="Nivel"]');
comprobar((await nivel.locator('option').allTextContents()).includes('CEFR B2'), 'La pantalla de ajustes ofrece los niveles del inglés');
comprobar((await motor('estadisticasPalabras')).conocidas === 0, 'El inglés no hereda las palabras del japonés');

// ---------- Diccionarios ----------

console.log('\n== Diccionarios de inglés ==');
const fuentes = await motor('fuentesDiccionario');
comprobar(fuentes.some((f) => f.id === 'wty-en-es-gloss') && !fuentes.some((f) => f.id.startsWith('jmdict')), 'La biblioteca es la del inglés', `${fuentes.length} fuentes`);
const instalados = new Set((await motor('estado')).diccionarios.map((d) => d.id));
for (const d of ['wty-en-es', 'wty-en-es-gloss', 'wty-en-ipa', 'frecuencia-subtitulos']) {
  if (instalados.has(d)) continue;
  const t0 = Date.now();
  await motor('instalarDiccionario', d);
  console.log(`  instalado ${d} en ${Math.round((Date.now() - t0) / 1000)} s`);
}
let estado = await motor('estado');
console.log('  ', estado.diccionarios.map((d) => `${d.id}: ${d.filas}`).join(', '));
comprobar(estado.diccionarios.find((d) => d.id === 'wty-en-ipa')?.tipo === 'acento', 'La pronunciación se reconoce como tal');
comprobar(estado.diccionarios.find((d) => d.id === 'frecuencia-subtitulos')?.tipo === 'frecuencia', 'Y la lista de frecuencia');
// El inglés no espera a tenerlos para analizar: se cargan aparte.
for (let i = 0; i < 40 && estado.terminosCargados <= 50000; i++) {
  await app.waitForTimeout(500);
  estado = await motor('estado');
}
comprobar(estado.terminosCargados > 50000, 'Los términos están en memoria', estado.terminosCargados);
const muestra = await motor('muestraEvaluacion');
comprobar(muestra.length >= 8 && muestra.every((p) => /^[a-z'-]+$/i.test(p.lema)), 'La evaluación de nivel pregunta palabras inglesas', muestra.map((p) => p.lema).join(', '));
comprobar(estado.tokenizadorListo, 'El analizador se ha cargado');
const bases = await app.evaluate(async () => (await indexedDB.databases()).map((d) => `${d.name}:${d.version}`));
comprobar(bases.includes('kikitori:50') && bases.includes('kikitori-en:50'), 'Cada lengua tiene su base', bases.join(', '));

// ---------- Análisis y diccionario ----------

console.log('\n== Análisis ==');
const [linea] = await motor('analizarTexto', "He went home, and she didn't pick it up.");
const pal = (s) => linea.find((x) => x.superficie === s);
console.log('  ', linea.filter((x) => x.esPalabra).map((x) => `${x.superficie}→${x.lema}${x.rango ? `#${x.rango}` : ''}${x.glosa ? `(${x.glosa})` : ''}`).join(' '));
comprobar(linea.map((x) => x.superficie).join('') === "He went home, and she didn't pick it up.", 'Las palabras reproducen el texto');
comprobar(pal('went')?.lema === 'go' && pal('went')?.clave === 'go|go', 'went es go, con la misma clave', pal('went')?.clave);
comprobar(pal("didn't")?.lema === 'do', "didn't es una sola palabra, de do");
comprobar(pal('went')?.rango > 0 && pal('went').rango < 200, 'Tiene frecuencia, la de su forma de diccionario', pal('went')?.rango);
comprobar(!!pal('home')?.glosa, 'Tiene traducción bajo la palabra', pal('home')?.glosa);
comprobar(!/[,(]/.test(pal('home')?.glosa ?? ''), 'Y es breve');
comprobar(/\|/.test(pal('went')?.furigana?.[0]?.lectura ?? ''), 'Sabe cómo suena esa forma', pal('went')?.furigana?.[0]?.lectura);
comprobar(pal('He')?.esGramatica && pal('He')?.estado === 'conocida', 'Las palabras gramaticales se dan por conocidas');
comprobar(pal('home')?.estado === 'desconocida', 'Las demás empiezan como desconocidas');

const go = await motor('buscar', 'go');
comprobar(go.clave === 'go|go' && go.entradas.length > 0, 'El diccionario responde', `${go.entradas.length} entradas`);
comprobar(go.pronunciaciones?.some((t) => t.zona === 'us') && go.pronunciaciones?.some((t) => t.zona === 'uk'), 'Da la pronunciación americana y la británica', JSON.stringify(go.pronunciaciones));
console.log('   definiciones:', go.entradas.flatMap((e) => e.glosas).slice(0, 4).join(' | ').slice(0, 200));
comprobar(!go.entradas.flatMap((e) => e.glosas).some((g) => /Etimolog|Wiktionary \|/.test(g)), 'Las definiciones no arrastran etimologías ni enlaces');
const libre = await motor('buscarLibre', 'running');
comprobar(libre.some((r) => r.entradas.length), 'La búsqueda libre entiende formas conjugadas', libre.map((r) => r.lema).join(', '));
const comp = await motor('compuestos', ['picked', ' ', 'it', ' ', 'up']);
comprobar(comp.some((r) => r.lema === 'pick up'), 'Encuentra el verbo con partícula aunque vaya separado', comp.map((r) => r.lema).join(', '));
const comp2 = await motor('compuestos', ['looking', ' ', 'forward', ' ', 'to', ' ', 'it']);
comprobar(comp2.some((r) => r.lema === 'look forward to'), 'Y los de tres palabras', comp2.map((r) => r.lema).join(', '));
// El audio de la palabra sale de sitios públicos: si alguno cae, esta comprobación avisa.
const audios = await motor('audiosPalabra', 'go', 'go');
comprobar(audios.some((x) => /commons|lingua libre/i.test(`${x.etiqueta} ${x.origen}`)), 'Hay grabaciones de la palabra', `${audios.length}: ${audios.slice(0, 2).map((x) => x.etiqueta).join(', ')}`);

// ---------- Un video ----------

console.log('\n== Un video en inglés ==');
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
comprobar(/picked it up and went home/i.test(texto), 'Elige los subtítulos en inglés', texto);
comprobar(/ /.test(texto) && !/pickedit/.test(texto), 'Con los espacios entre las palabras');
comprobar((await enOverlay((r) => r.querySelector('.linea-sub.secundaria')?.textContent ?? '')).includes('Línea traducida'), 'Y los secundarios en el idioma de quien estudia');
await p.screenshot({ path: join(CAPTURAS, 'video.png') });

const pedidas = () => mock.peticiones.filter((x) => x.url.includes('/messages'));
const correccion = pedidas().find((x) => /subtítulos en inglés generados/.test(JSON.stringify(x.cuerpo.system ?? '')));
comprobar(!!correccion, 'Corrige los subtítulos automáticos con el prompt del inglés');
await hasta(() => true, undefined, 500);

const palabraEn = (s) => enOverlay(`(r, s) => {
  const e = [...r.querySelectorAll('.linea-sub.objetivo .pal')].find((x) => (${textoVisible})(x).trim().toLowerCase() === s);
  if (!e) return null;
  const c = e.getBoundingClientRect();
  return { x: c.left + c.width / 2, y: c.top + c.height / 2 };
}`, s);
const sitio = await palabraEn('went');
comprobar(!!sitio, 'La palabra se puede señalar');
await p.mouse.move(sitio.x, sitio.y);
await hasta((r) => (r.querySelector('.ficha-palabra')?.textContent ?? '').length > 0, undefined, 6000);
await p.waitForTimeout(600);
const ficha = await enOverlay((r) => ({
  palabra: r.querySelector('.ficha-palabra')?.textContent,
  ipa: r.querySelector('.ficha-ipa')?.textContent,
  curva: !!r.querySelector('.ficha-tono'),
  defs: [...r.querySelectorAll('.lista-defs li')].map((x) => x.textContent).slice(0, 3),
  pestanas: [...r.querySelectorAll('.ficha-dock .pestana')].map((x) => x.textContent.trim()),
  corregir: !!r.querySelector('[aria-label="¿Lectura incorrecta?"]'),
  flexion: r.querySelector('.flexiones')?.textContent,
  compuestos: [...r.querySelectorAll('.lista-compuestos b')].map((x) => x.textContent),
}));
console.log('  ', JSON.stringify(ficha).slice(0, 400));
comprobar(ficha.palabra === 'go', 'La ficha abre su forma de diccionario', ficha.palabra);
comprobar(/US.*\/.*UK.*\//.test(ficha.ipa ?? ''), 'Con la pronunciación americana y la británica', ficha.ipa);
comprobar(!ficha.curva, 'Sin la curva tonal del japonés');
comprobar(ficha.defs.length > 0, 'Con definiciones');
comprobar(!ficha.pestanas.includes('Trazos'), 'Sin la pestaña de trazos');
comprobar(!ficha.corregir, 'Sin el botón de corregir lecturas');
comprobar(/went/.test(ficha.flexion ?? '') && /irregular/.test(ficha.flexion ?? ''), 'Dice que es una forma irregular', ficha.flexion);
await p.screenshot({ path: join(CAPTURAS, 'ficha.png') });

// Lo que se le pide a Claude.
const antes = pedidas().length;
await enOverlay((r) => { r.querySelector('.sentido-pedir button')?.click(); return true; });
await hasta((r) => !!r.querySelector('.sentido b'), undefined, 6000);
await enOverlay((r) => { [...r.querySelectorAll('.ficha-dock .pestana')].find((x) => x.textContent.includes('Explicar'))?.click(); return true; });
await hasta((r) => (r.querySelector('.panel-ia-texto')?.textContent ?? '').length > 5 && !r.querySelector('.cursor-ia'), undefined, 8000);
const nuevas = pedidas().slice(antes).map((x) => JSON.stringify(x.cuerpo.system ?? ''));
comprobar(nuevas.some((s) => s.includes('lexicógrafo experto en inglés')), 'Pregunta el sentido como experto en inglés');
comprobar(nuevas.some((s) => s.includes('profesor de inglés')), 'Explica como profesor de inglés');
comprobar(!nuevas.some((s) => /japon[eé]/i.test(s)), 'Y sin rastro del japonés en lo que se le pide');

// Una tarjeta de un clic, en el repaso integrado.
await p.keyboard.press('q');
let tarjeta = null;
for (let i = 0; i < 80 && !tarjeta; i++) {
  await p.waitForTimeout(250);
  tarjeta = (await motor('memoriaPendientes', 50)).find((t) => t.borrador.palabra === 'go');
}
comprobar(!!tarjeta, 'Q crea la tarjeta de la palabra', tarjeta?.borrador.palabra);
comprobar(/<b>went<\/b> home/.test(tarjeta?.borrador.frase ?? ''), 'Con la frase del video y la palabra resaltada', tarjeta?.borrador.frase);
comprobar(tarjeta?.borrador.lectura === '/ɡoʊ/', 'Con su pronunciación', tarjeta?.borrador.lectura);
comprobar(!tarjeta?.borrador.fraseFurigana, 'Y sin furigana');
comprobar((await motor('memoriaResumen')).total >= 1, 'En el repaso del inglés');
if (tarjeta) await motor('memoriaEliminar', tarjeta.id);
await p.keyboard.press('Escape');

// Los paneles hablan de inglés.
await p.mouse.move(800, 90);
await p.waitForTimeout(400);
await enOverlay((r) => { r.querySelector('.barra-acciones > button[aria-label="Ajustes de visualización"]')?.click(); return true; });
await p.waitForTimeout(400);
const visual = await enOverlay((r) => r.querySelector('.panel-flotante')?.textContent ?? '');
comprobar(/Pronunciación/.test(visual) && !/Furigana|Heiban/.test(visual), 'El panel de visualización habla de pronunciación', visual.slice(0, 80));
comprobar(/Primera sílaba/.test(visual), 'Y la leyenda del acento es la del inglés');
await p.screenshot({ path: join(CAPTURAS, 'visual.png') });
await enOverlay((r) => { r.querySelector('.barra-acciones > button[aria-label="Ajustes de visualización"]')?.click(); return true; });

// La pronunciación sobre las palabras y el color de la sílaba tónica, que empiezan apagados.
const ajustar = (cambios) => sw.evaluate(async (cambios) => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ ajustes: { ...d.ajustes, ...cambios } });
}, cambios);
const lecturasVisibles = () => enOverlay((r) => [...r.querySelectorAll('.linea-sub.objetivo rt')].map((x) => x.textContent));
await ajustar({ furigana: 'todas', colorAcento: 'siempre' });
await hasta((r) => r.querySelector('.linea-sub.objetivo rt') != null);
await p.waitForTimeout(400);
const americana = await lecturasVisibles();
comprobar(americana.includes('/hoʊm/'), 'Se puede pedir la pronunciación sobre cada palabra', americana.slice(0, 5).join(' '));
await p.screenshot({ path: join(CAPTURAS, 'pronunciacion.png') });
await ajustar({ formatoLectura: 'uk' });
await p.waitForTimeout(900);
const britanica = await lecturasVisibles();
comprobar(britanica.includes('/həʊm/'), 'Y puede ser la británica', britanica.slice(0, 5).join(' '));
await p.evaluate(() => { document.querySelector('#v').currentTime = 4; });
await p.waitForTimeout(900);
const centro = await enOverlay(`(r) => [...r.querySelectorAll('.linea-sub.objetivo .pal')].find((x) => (${textoVisible})(x).trim() === 'downtown')?.className ?? ''`);
comprobar(/\bac-atamadaka\b/.test(centro), 'Y el color de la sílaba tónica: downtown la lleva en la primera', centro);
await ajustar({ furigana: 'ninguna', colorAcento: 'ninguno', formatoLectura: 'us' });
await p.close();

// ---------- El lector ----------

console.log('\n== El lector de páginas ==');
const q = await contexto.newPage();
q.on('pageerror', (e) => errores.push(`lector: ${e.message}`));
await q.goto('https://ingles.test/articulo');
await q.waitForTimeout(2500);
const rangos = () => q.evaluate(() => Number(document.querySelector('kotonoha-overlay')?.dataset.kkRangos ?? 0));
comprobar((await rangos()) === 0, 'Apagado al empezar: el inglés está en todas partes');
await sw.evaluate(async () => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ ajustes: { ...d.ajustes, lectorActivo: true } });
});
await q.waitForFunction(() => Number(document.querySelector('kotonoha-overlay')?.dataset.kkRangos) > 0, null, { timeout: 30000 });
comprobar(true, 'Al encenderlo, marca las palabras sin recargar', await rangos());
await q.waitForTimeout(600);
await q.screenshot({ path: join(CAPTURAS, 'pagina.png') });
const sitioPagina = await q.evaluate(() => {
  const w = document.createTreeWalker(document.getElementById('uno'), NodeFilter.SHOW_TEXT);
  w.nextNode();
  const i = w.currentNode.data.indexOf('picked');
  const r = document.createRange();
  r.setStart(w.currentNode, i);
  r.setEnd(w.currentNode, i + 3);
  const b = r.getBoundingClientRect();
  return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
});
await q.mouse.click(sitioPagina.x, sitioPagina.y);
await q.waitForFunction(() => document.querySelector('kotonoha-overlay')?.shadowRoot?.querySelector('.ficha-palabra'), null, { timeout: 15000 });
await q.waitForTimeout(700);
const fichaPagina = await q.evaluate(() => {
  const r = document.querySelector('kotonoha-overlay').shadowRoot;
  return { palabra: r.querySelector('.ficha-palabra')?.textContent, compuestos: [...r.querySelectorAll('.lista-compuestos b')].map((x) => x.textContent) };
});
comprobar(fichaPagina.palabra === 'pick', 'Un clic abre la ficha de la palabra', fichaPagina.palabra);
comprobar(fichaPagina.compuestos.includes('pick up'), 'Y enseña el verbo con partícula', fichaPagina.compuestos.join(', '));
await q.screenshot({ path: join(CAPTURAS, 'pagina-ficha.png') });

// Los enlaces de un menú pegados entre sí son dos palabras, no una.
await q.keyboard.press('Escape');
await q.waitForTimeout(200);
const enlaceMenu = await q.evaluate(() => {
  const b = document.getElementById('menu2').getBoundingClientRect();
  return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
});
await q.mouse.move(5, 500);
await q.mouse.move(enlaceMenu.x, enlaceMenu.y);
let palabraMenu = null;
for (let i = 0; i < 40 && !palabraMenu; i++) {
  await q.waitForTimeout(100);
  palabraMenu = await q.evaluate(() => document.querySelector('kotonoha-overlay')?.shadowRoot?.querySelector('.ficha-palabra')?.textContent ?? null);
}
comprobar(palabraMenu === 'level', 'Los enlaces pegados de un menú son palabras distintas', palabraMenu);
await q.close();

const es = await contexto.newPage();
await es.goto('https://espanol.test/articulo');
await es.waitForTimeout(2500);
comprobar(!(Number(await es.evaluate(() => document.querySelector('kotonoha-overlay')?.dataset.kkRangos ?? 0)) > 0), 'Una página en español se deja en paz');
await es.close();

// ---------- Las palabras no se mezclan ----------

console.log('\n== Cada lengua, lo suyo ==');
await motor('cambiarPalabras', [{ clave: 'go|go', lema: 'go', lectura: 'go', estado: 'conocida' }]);
const [otra] = await motor('analizarTexto', 'He went home');
comprobar(otra.find((x) => x.superficie === 'went')?.estado === 'conocida', 'Marcar go como conocida vale para went');
const enIngles = await motor('estadisticasPalabras');
comprobar(enIngles.conocidas === 1, 'El inglés cuenta sus palabras', enIngles.conocidas);

// Con la pantalla de inicio abierta, cambiar de lengua la pone al día.
await app.goto(`chrome-extension://${id}/app.html#/inicio`);
await app.reload();
await app.waitForTimeout(900);
const saludo = await app.locator('.ap-saludo h1').textContent();
comprobar(/^Good (morning|afternoon|evening)/.test(saludo ?? ''), 'La pantalla de inicio saluda en inglés', saludo);
comprobar((await app.locator('.ap-sendero').textContent()).includes('B1'), 'Y el sendero es el de los niveles del inglés');
await app.screenshot({ path: join(CAPTURAS, 'inicio.png') });

await app.goto(`chrome-extension://${id}/app.html#/lector`);
await app.reload();
await app.waitForTimeout(800);
await app.locator('textarea').first().fill('She picked it up. Then she went home, because it was late.');
await app.locator('button.primario').first().click();
await app.waitForSelector('.ap-papel .pal', { timeout: 20000 });
await app.waitForTimeout(500);
const papel = (await app.locator('.ap-papel').textContent()).replaceAll('\u2060', '');
comprobar(papel.includes('She picked it up. Then she went home, because it was late.'), 'El lector conserva los espacios entre palabras y frases', papel.slice(0, 80));
await app.screenshot({ path: join(CAPTURAS, 'lector.png') });

// De vuelta al japonés.
await app.goto(`chrome-extension://${id}/app.html#/ajustes`);
await app.reload();
await app.waitForTimeout(900);
await app.locator('select[aria-label="Idioma que estudias"]').selectOption('ja');
await app.waitForTimeout(800);
const vuelta = await leerAjustes();
comprobar(vuelta.nivel === 'JLPT N3' && vuelta.formatoLectura === 'hiragana', 'Al volver, el japonés recupera sus ajustes', vuelta.nivel);
comprobar(vuelta.porLengua?.en?.lectorActivo === true, 'Y el inglés guarda los suyos');
const japonesDespues = await motor('estadisticasPalabras');
comprobar(japonesDespues.conocidas === japonesAntes.conocidas, 'Las palabras del japonés siguen ahí, y solo ellas', `${japonesDespues.conocidas} conocidas`);
comprobar((await motor('fuentesDiccionario')).some((f) => f.id === 'jmdict-es'), 'La biblioteca vuelve a ser la del japonés');
const [jp] = await motor('analizarTexto', '図書館で本を読む');
comprobar(jp.find((x) => x.superficie === '図書館')?.estado === 'conocida', 'Y el análisis vuelve a ser el japonés', jp.filter((x) => x.esPalabra).map((x) => x.lema).join(' '));

const pj = await contexto.newPage();
await pj.goto('https://japones.test/articulo');
await pj.waitForFunction(() => Number(document.querySelector('kotonoha-overlay')?.dataset.kkRangos) > 0, null, { timeout: 30000 }).catch(() => {});
comprobar(Number(await pj.evaluate(() => document.querySelector('kotonoha-overlay')?.dataset.kkRangos ?? 0)) > 0, 'El lector vuelve a marcar el japonés');
await pj.close();

// ---------- La copia de seguridad ----------

console.log('\n== La copia de seguridad ==');
const copia = JSON.parse(await motor('exportarDatos', await leerAjustes()));
comprobar(copia.lenguas?.en?.palabras.some((x) => x.lema === 'go') && copia.lenguas?.ja?.palabras.some((x) => x.lema === '図書館'), 'Lleva las palabras de las dos lenguas');
comprobar(copia.ajustes?.porLengua?.en?.nivel === 'CEFR B1', 'Y los ajustes de cada una');
comprobar(!JSON.stringify(copia).includes('clave-de-prueba'), 'Y nunca la clave de Claude');
const filaPalabra = (lema, lectura) => ({ clave: `${lema}|${lectura}`, lema, lectura, estado: 'conocida', rastreada: 0, creada: Date.now(), actualizada: Date.now() });
copia.lenguas.en.palabras.push(filaPalabra('wait', 'wait'));
const devueltos = await motor('importarDatos', JSON.stringify(copia));
comprobar(devueltos?.nivel === vuelta.nivel, 'Al restaurarla devuelve los ajustes', devueltos?.nivel);
comprobar((await motor('estadisticasPalabras')).conocidas === japonesAntes.conocidas, 'Lo del inglés no se cuela en el japonés');
await motor('importarDatos', JSON.stringify({ version: 1, palabras: [filaPalabra('猫', 'ねこ')] }));
comprobar((await motor('estadisticasPalabras')).conocidas === japonesAntes.conocidas + 1, 'Una copia antigua se lee como japonés');
await motor('cambiarPalabras', [{ clave: '猫|ねこ', lema: '猫', lectura: 'ねこ', estado: 'desconocida' }]);
await app.goto(`chrome-extension://${id}/app.html#/ajustes`);
await app.reload();
await app.waitForTimeout(900);
await app.locator('select[aria-label="Idioma que estudias"]').selectOption('en');
await app.waitForTimeout(800);
comprobar((await motor('estadisticasPalabras')).conocidas === enIngles.conocidas + 1, 'Y lo restaurado está en el inglés');
await motor('cambiarPalabras', [{ clave: 'wait|wait', lema: 'wait', lectura: 'wait', estado: 'desconocida' }]);
await app.locator('select[aria-label="Idioma que estudias"]').selectOption('ja');
await app.waitForTimeout(600);

// ---------- Alternar con un clic ----------

console.log('\n== Alternar desde el menú, con un video abierto ==');
const pv = await contexto.newPage();
pv.on('pageerror', (e) => errores.push(`alternar: ${e.message}`));
await pv.goto(`https://www.youtube.com/watch?v=${ID}`);
await pv.waitForFunction(() => document.querySelector('kotonoha-overlay')?.shadowRoot?.querySelector('.barra'), null, { timeout: 30000 });
await pv.evaluate(() => {
  window.sinRecargar = true;
  const v = document.querySelector('#v');
  v.pause();
  v.currentTime = 1;
});
const lineaVideo = () => pv.evaluate(() => {
  const l = (document.querySelector('kotonoha-overlay:not([popover])') ?? document.querySelector('kotonoha-overlay'))?.shadowRoot?.querySelector('.linea-sub.objetivo');
  if (!l) return '';
  const c = l.cloneNode(true);
  c.querySelectorAll('rt, .glosa').forEach((x) => x.remove());
  return c.textContent.replaceAll('⁠', '');
});
const esperaLinea = async (re) => {
  const limite = Date.now() + 15000;
  for (;;) {
    const l = await lineaVideo().catch(() => '');
    if (re.test(l) || Date.now() > limite) return l;
    await pv.waitForTimeout(150);
  }
};
const lineaJa = await esperaLinea(/図書館/);
comprobar(/図書館/.test(lineaJa), 'Estudiando japonés, el video muestra sus subtítulos en japonés', lineaJa);

const menu = await contexto.newPage();
menu.on('pageerror', (e) => errores.push(`menú: ${e.message}`));
await menu.goto(`chrome-extension://${id}/popup.html`);
await menu.waitForTimeout(700);
const botonMenu = (nombre) => menu.locator('.segmentado[aria-label="Idioma que estudias"] button', { hasText: nombre });
const conocidasMenu = async () => Number((await menu.locator('.ap-menu-conocidas b').innerText()).replace(/\D/g, ''));
comprobar((await botonMenu('Japonés').getAttribute('aria-checked')) === 'true', 'El menú dice qué idioma se estudia');
const conocidasJa = await conocidasMenu();

await botonMenu('Inglés').click();
await menu.waitForTimeout(900);
comprobar((await leerAjustes()).idiomaObjetivo === 'en', 'Un clic en el menú pasa al inglés');
comprobar((await botonMenu('Inglés').getAttribute('aria-checked')) === 'true', 'Y el menú lo refleja');
comprobar((await conocidasMenu()) === enIngles.conocidas, 'Con las palabras conocidas del inglés', await conocidasMenu());
const lineaEn = await esperaLinea(/picked it up/i);
comprobar(/picked it up/i.test(lineaEn), 'El video abierto pasa a sus subtítulos en inglés', lineaEn);

await botonMenu('Japonés').click();
await menu.waitForTimeout(900);
comprobar((await leerAjustes()).idiomaObjetivo === 'ja', 'Otro clic vuelve al japonés');
comprobar((await conocidasMenu()) === conocidasJa, 'Con sus palabras conocidas', await conocidasMenu());
const lineaVuelta = await esperaLinea(/図書館/);
comprobar(/図書館/.test(lineaVuelta), 'Y el video vuelve a sus subtítulos en japonés', lineaVuelta);
comprobar(await pv.evaluate(() => window.sinRecargar === true), 'Sin recargar la página');
await menu.close();
await pv.close();

if (errores.length) console.log('Errores de página:', errores.slice(0, 8).join('\n'));
comprobar(!errores.length, 'Ningún error de página', errores.length);
console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien');
await contexto.close();
process.exit(fallos ? 1 : 0);
