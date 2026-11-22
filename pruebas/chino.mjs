// Estudiar chino de principio a fin: elegir la lengua, instalar sus diccionarios de verdad, analizar con pinyin, buscar
// por pinyin, ver un video (con la pista simplificada antes que la tradicional, y una tradicional pasada a simplificados),
// con cada sílaba del color de su tono y «Cómo suena» en la ficha, leer una página, practicar los tonos con un micrófono
// falso que lee una voz sintética, y volver al japonés sin que se mezcle nada. Los diccionarios se descargan una vez y
// se quedan en el perfil.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/chino.mjs

import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';
import { iniciarMock } from './mock-claude.mjs';
import { wavDeTonos } from './voz-sintetica.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-chino'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'chino');
mkdirSync(CAPTURAS, { recursive: true });

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};

// Otros videos en cada ejecución: lo analizado de uno ya visto queda guardado.
const SUFIJO = Date.now() % 1000000;
const AMBAS = `zhambas${SUFIJO}`;
const TRADICIONAL = `zhtrad${SUFIJO}`;
const SIMPLIFICADAS = ['我们今天去银行取钱。', '他长得很高，是我们班的班长。', '你明天有空吗？我们一起去看电影吧。', '天气越来越冷了。'];
const TRADICIONALES = ['我們今天去銀行取錢。', '他長得很高，是我們班的班長。', '你明天有空嗎？我們一起去看電影吧。', '天氣越來越冷了。'];
const json3 = (lineas) => JSON.stringify({ events: lineas.map((t, i) => ({ tStartMs: 500 + i * 3000, dDurationMs: 2900, segs: [{ utf8: t }] })) });
const ES = json3(SIMPLIFICADAS.map((_, i) => `Línea traducida ${i + 1}`));

const paginaVideo = (id, pistas) => `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>北京一日游 - YouTube</title>
<body style="margin:0;background:#0f0f0f;color:#fff;font-family:sans-serif">
<div style="height:56px"></div>
<div id="movie_player" style="position:relative;width:1280px;height:600px;margin:0 auto;background:#000"><video id="v" src="https://media.test/video.webm" muted style="width:100%;height:100%"></video></div>
<script>
  const pistas = ${JSON.stringify(pistas)}.map((t) => ({ ...t, baseUrl: 'https://www.youtube.com/api/timedtext?v=${id}&lang=' + t.languageCode, url: 'https://www.youtube.com/api/timedtext?v=${id}&pot=x&lang=' + t.languageCode }));
  const j = document.getElementById('movie_player');
  const v = document.getElementById('v');
  j.getPlayerResponse = () => ({ videoDetails: { videoId: '${id}', title: '北京一日游' }, captions: { playerCaptionsTracklistRenderer: { captionTracks: pistas } } });
  j.getAudioTrack = () => ({ captionTracks: pistas });
  j.getVideoData = () => ({ video_id: '${id}', title: '北京一日游' });
  j.seekTo = (s) => { v.currentTime = s; };
  j.playVideo = () => v.play();
  j.pauseVideo = () => v.pause();
  j.loadModule = () => {};
  j.setOption = () => {};
</script>`;

const PISTAS = {
  // La tradicional va primero: tiene que ganar la simplificada.
  [AMBAS]: [
    { languageCode: 'zh-Hant', vssId: '.zh-Hant', name: { simpleText: '中文（繁體）' } },
    { languageCode: 'zh-Hans', vssId: '.zh-Hans', name: { simpleText: '中文（简体）' } },
    { languageCode: 'es', vssId: '.es', name: { simpleText: 'Español' } },
  ],
  [TRADICIONAL]: [
    { languageCode: 'zh-Hant', vssId: '.zh-Hant', name: { simpleText: '中文（繁體）' } },
    { languageCode: 'es', vssId: '.es', name: { simpleText: 'Español' } },
  ],
};

const PAGINA_CHINO = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>图书馆重新开放</title>
<style>body { margin: 0; font: 20px/1.9 'Microsoft YaHei', sans-serif; color: #222; background: #fff; } main { padding: 30px 56px; max-width: 760px; }</style>
<main><h1>老图书馆重新开放了</h1>
<p id="uno">经过两年的修缮，城里的老图书馆终于重新开放了。很多人第一天就来借书，有的人还带着孩子一起来。</p>
<p>“我们没想到会来这么多人。”图书馆的工作人员说。</p></main></html>`;

// La frase de la práctica de tonos y su grabación sintética: 天 (primero), 气 (cuarto), 很 (tercero, que pasa al segundo
// delante de otro) y 好 (tercero, al final).
const FRASE_TONOS = '天气很好。';
const VOZ_TONOS = join(CAPTURAS, 'tonos.wav');
wavDeTonos([1, 4, 2, '3f'], VOZ_TONOS);

const mock = await iniciarMock();
const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1600, height: 900 },
  args: [
    '--mute-audio',
    `--disable-extensions-except=${DIST}`,
    `--load-extension=${DIST}`,
    '--autoplay-policy=no-user-gesture-required',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${VOZ_TONOS}%noloop`,
  ],
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
  if (u.pathname.includes('/api/timedtext')) {
    const lang = u.searchParams.get('lang');
    const cuerpo = lang === 'es' ? ES : lang === 'zh-Hant' ? json3(TRADICIONALES) : json3(SIMPLIFICADAS);
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: cuerpo });
  }
  if (u.pathname === '/watch') {
    const v = u.searchParams.get('v');
    return r.fulfill({ status: 200, contentType: 'text/html', body: paginaVideo(v, PISTAS[v]) });
  }
  return r.fulfill({ status: 204 });
});
await contexto.route('https://chino.test/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: PAGINA_CHINO }));

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
comprobar(opciones.includes('Chino · 中文'), 'Se puede elegir el chino', opciones.join(' | '));
if ((await selector.inputValue()) !== 'zh') {
  await selector.selectOption('zh');
  await app.waitForTimeout(800);
}
const a = await leerAjustes();
comprobar(a.idiomaObjetivo === 'zh', 'Al elegir chino se guarda');
comprobar(a.nivel === 'HSK 3' && a.formatoLectura === 'marcas' && a.furigana === 'desconocidas', 'Y empieza con sus propios ajustes: HSK 3 y pinyin con marcas', `${a.nivel}, ${a.formatoLectura}, ${a.furigana}`);
comprobar((await motor('estadisticasPalabras')).conocidas === 0, 'El chino no hereda las palabras de otra lengua');

// ---------- Diccionarios ----------

console.log('\n== Diccionarios de chino ==');
const fuentes = await motor('fuentesDiccionario');
comprobar(['cc-cedict', 'wty-zh-es-gloss', 'frecuencia-subtitulos-zh'].every((f) => fuentes.some((x) => x.id === f)) && !fuentes.some((f) => f.id.startsWith('jmdict')), 'La biblioteca es la del chino', `${fuentes.length} fuentes`);
const instalados = new Set((await motor('estado')).diccionarios.map((d) => d.id));
for (const d of ['wty-zh-es-gloss', 'cc-cedict', 'frecuencia-subtitulos-zh']) {
  if (instalados.has(d)) continue;
  const t0 = Date.now();
  await motor('instalarDiccionario', d);
  console.log(`  instalado ${d} en ${Math.round((Date.now() - t0) / 1000)} s`);
}
let estado = await motor('estado');
console.log('  ', estado.diccionarios.map((d) => `${d.id}: ${d.filas}`).join(', '));
comprobar(estado.diccionarios.find((d) => d.id === 'frecuencia-subtitulos-zh')?.tipo === 'frecuencia', 'La lista de frecuencia se reconoce como tal');
for (let i = 0; i < 60 && estado.terminosCargados <= 100000; i++) {
  await app.waitForTimeout(500);
  estado = await motor('estado');
}
comprobar(estado.terminosCargados > 100000, 'Los términos de CC-CEDICT están en memoria', estado.terminosCargados);
const bases = await app.evaluate(async () => (await indexedDB.databases()).map((d) => `${d.name}:${d.version}`));
// La tabla de lecturas llegó con la versión 12 de la base (Dexie la multiplica por 10).
const versionZh = Number(bases.find((b) => b.startsWith('kikitori-zh:'))?.split(':')[1] ?? 0);
comprobar(versionZh >= 120, 'El chino tiene su base, con la tabla de lecturas', bases.join(', '));

// ---------- Análisis ----------

console.log('\n== Análisis ==');
const frase = '我们今天去银行取钱，他长得很高。';
const t0 = Date.now();
const [linea] = await motor('analizarTexto', frase);
console.log(`   analizada en ${Date.now() - t0} ms:`, linea.filter((x) => x.esPalabra).map((x) => `${x.superficie}(${x.lectura})${x.rango ? `#${x.rango}` : ''}${x.glosa ? `«${x.glosa}»` : ''}`).join(' '));
const pal = (s) => linea.find((x) => x.superficie === s);
comprobar(linea.map((x) => x.superficie).join('') === frase, 'Las palabras reproducen el texto');
comprobar(['我们', '今天', '银行'].every((w) => pal(w)?.esPalabra), 'Parte las palabras: 我们, 今天, 银行', linea.map((x) => x.superficie).join(' '));
comprobar(pal('银行')?.lectura === 'yínháng', 'Con el pinyin del diccionario', pal('银行')?.lectura);
comprobar(JSON.stringify(pal('银行')?.furigana) === JSON.stringify([{ texto: '银', lectura: 'yín' }, { texto: '行', lectura: 'háng' }]), 'Repartido sílaba a sílaba', JSON.stringify(pal('银行')?.furigana));
comprobar(pal('长得')?.lectura === 'zhǎngde' || pal('长')?.lectura === 'zhǎng', 'Elige la lectura en contexto: 长得 es zhǎng', pal('长得')?.lectura ?? pal('长')?.lectura);
comprobar(!!pal('银行')?.glosa, 'Tiene traducción bajo la palabra', pal('银行')?.glosa);
comprobar(pal('我们')?.rango > 0 && pal('我们').rango < 100, 'Y su frecuencia', pal('我们')?.rango);
comprobar(pal('银行')?.estado === 'desconocida', 'Las palabras empiezan como desconocidas');

const yinhang = await motor('buscar', '银行', 'yínháng');
comprobar(yinhang.entradas.length > 0, 'El diccionario responde', `${yinhang.entradas.length} entradas`);
console.log('   definiciones:', yinhang.entradas.flatMap((e) => e.glosas).slice(0, 4).join(' | ').slice(0, 200));
// Wiktionary escribe nǐ hǎo y CC-CEDICT nǐhǎo: al importar se igualan, y por eso manda la glosa en español.
const [saludoEs] = await motor('analizarTexto', '你好');
comprobar(saludoEs.find((x) => x.superficie === '你好')?.glosa === 'hola', 'Con glosa en español, sale esa antes que la inglesa', saludoEs.find((x) => x.superficie === '你好')?.glosa);
const porPinyin = await motor('resultadosDeBusqueda', 'nihao', 20);
comprobar(porPinyin.some((e) => e.termino === '你好'), 'Buscar «nihao», sin tonos, encuentra 你好', porPinyin.slice(0, 5).map((e) => e.termino).join(' '));
comprobar(porPinyin.filter((e) => e.termino === '你好').length === 1, 'Una sola vez, aunque esté en dos diccionarios', porPinyin.slice(0, 5).map((e) => `${e.termino}:${e.lectura}`).join(' '));
const conTonos = await motor('resultadosDeBusqueda', 'ni3hao3', 20);
comprobar(conTonos.some((e) => e.termino === '你好'), 'Y con números, ni3hao3', conTonos.slice(0, 5).map((e) => e.termino).join(' '));
const yh = await motor('resultadosDeBusqueda', 'yinhang', 20);
comprobar(yh.some((e) => e.termino === '银行') && !yh.some((e) => e.termino === '銀行'), 'Sin repetir la palabra en tradicionales', yh.slice(0, 6).map((e) => e.termino).join(' '));
const audios = await motor('audiosPalabra', '你好', 'nǐhǎo');
comprobar(audios.length > 0, 'Hay grabaciones de la palabra', `${audios.length}: ${audios.slice(0, 2).map((x) => x.etiqueta).join(', ')}`);

// ---------- Un video ----------

const enVideo = async (idVideo) => {
  const p = await contexto.newPage();
  p.on('pageerror', (e) => errores.push(`video: ${e.message}`));
  await p.goto(`https://www.youtube.com/watch?v=${idVideo}`);
  const enOverlay = (fn, arg) =>
    p.evaluate(({ fn, arg }) => {
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
  return { p, enOverlay, hasta };
};
const textoVisible = (e) => {
  const c = e.cloneNode(true);
  c.querySelectorAll('rt, .glosa').forEach((x) => x.remove());
  return c.textContent;
};

console.log('\n== Un video con pistas simplificada y tradicional ==');
{
  const { p, enOverlay, hasta } = await enVideo(AMBAS);
  const texto = await enOverlay(`(r) => (${textoVisible})(r.querySelector('.linea-sub.objetivo'))`);
  comprobar(/我们今天去银行/.test(texto ?? ''), 'Elige la pista simplificada, aunque la tradicional vaya antes', texto);
  const rt = await enOverlay((r) => [...r.querySelectorAll('.linea-sub.objetivo rt')].map((x) => x.textContent));
  comprobar(rt?.includes('yín') && rt?.includes('háng'), 'Con el pinyin sobre cada carácter', rt?.join(' '));
  const tonos = await enOverlay((r) =>
    [...r.querySelectorAll('.linea-sub.objetivo ruby')].map((x) => ({ c: x.firstChild?.textContent, clase: x.className, color: getComputedStyle(x).color }))
  );
  const deTono = (c) => tonos?.find((x) => x.c === c);
  comprobar(deTono('银')?.clase === 'ac-tono2' && deTono('我')?.clase === 'ac-tono3' && deTono('去')?.clase === 'ac-tono4' && deTono('天')?.clase === 'ac-tono1', 'Cada sílaba lleva el color de su tono', tonos?.map((x) => `${x.c}:${x.clase}`).join(' '));
  comprobar(deTono('们')?.clase === '' && deTono('们')?.color !== deTono('银')?.color && deTono('银')?.color !== deTono('去')?.color, 'El neutro va sin color, y cada tono tiene el suyo', tonos?.map((x) => `${x.c}:${x.color}`).slice(0, 4).join(' '));
  comprobar((await enOverlay((r) => r.querySelector('.linea-sub.secundaria')?.textContent ?? '')).includes('Línea traducida'), 'Y los secundarios en el idioma de quien estudia');
  await p.screenshot({ path: join(CAPTURAS, 'video.png') });
  const sitio = await enOverlay(`(r) => {
    const e = [...r.querySelectorAll('.linea-sub.objetivo .pal')].find((x) => (${textoVisible})(x).trim() === '银行');
    if (!e) return null;
    const c = e.getBoundingClientRect();
    return { x: c.left + c.width / 2, y: c.top + c.height / 2 };
  }`);
  comprobar(!!sitio, 'La palabra se puede señalar');
  if (sitio) {
    await p.mouse.move(sitio.x, sitio.y);
    await hasta((r) => (r.querySelector('.ficha-palabra')?.textContent ?? '').length > 0, undefined, 6000);
    await p.waitForTimeout(600);
    const ficha = await enOverlay(`(r) => {
      const p = r.querySelector('.ficha-palabra');
      return {
        palabra: p ? (${textoVisible})(p) : null,
        lectura: [...(p?.querySelectorAll('rt') ?? [])].map((x) => x.textContent).join(' '),
        defs: [...r.querySelectorAll('.lista-defs li')].map((x) => x.textContent).slice(0, 3),
        pestanas: [...r.querySelectorAll('.ficha-dock .pestana')].map((x) => x.textContent.trim()),
      };
    }`);
    console.log('  ', JSON.stringify(ficha).slice(0, 400));
    comprobar(ficha.palabra === '银行', 'La ficha abre la palabra', ficha.palabra);
    comprobar(ficha.lectura === 'yín háng', 'Con su pinyin sobre cada carácter', ficha.lectura);
    comprobar(ficha.defs.length > 0, 'Con definiciones', ficha.defs[0]);
    comprobar(ficha.defs.some((d) => d === '量词：家、个'), 'Y el clasificador como se enseña, en simplificado', ficha.defs.join(' | '));
    comprobar(ficha.pestanas.includes('Trazos'), 'La ficha tiene la pestaña de los trazos de sus hanzi', ficha.pestanas.join(' | '));
    await p.screenshot({ path: join(CAPTURAS, 'ficha.png') });
    comprobar(ficha.pestanas.includes('Cómo suena'), 'La ficha tiene «Cómo suena»', ficha.pestanas.join(' | '));
    await enOverlay((r) => [...r.querySelectorAll('.ficha-dock .pestana')].find((x) => x.textContent.trim() === 'Cómo suena')?.click());
    const suena = await hasta((r) => {
      const f = r.querySelector('.como-suena-frase');
      return f && f.querySelector('ruby') ? { rubies: [...f.querySelectorAll('ruby')].map((x) => `${x.firstChild?.textContent}:${x.querySelector('rt')?.textContent}:${x.className}`), leyenda: r.querySelector('.como-suena-leyenda')?.textContent ?? '' } : null;
    }, undefined, 10000);
    comprobar(suena?.rubies.join(' ').startsWith('我:wǒ:cs-igual 们:men:cs-neutro 今:jīn:cs-igual'), 'Cómo suena: el pinyin hablado sobre cada sílaba, con el neutro señalado', suena?.rubies.join(' '));
    comprobar(/Tono neutro/.test(suena?.leyenda ?? ''), 'Y la leyenda lo explica', suena?.leyenda.slice(0, 80));
    await p.screenshot({ path: join(CAPTURAS, 'como-suena.png') });
  }
  await p.close();
}

console.log('\n== Un video con solo la pista tradicional ==');
{
  const { p, enOverlay } = await enVideo(TRADICIONAL);
  const texto = await enOverlay(`(r) => (${textoVisible})(r.querySelector('.linea-sub.objetivo'))`);
  comprobar(/我们今天去银行取钱/.test(texto ?? ''), 'La tradicional se ve en caracteres simplificados', texto);
  await p.screenshot({ path: join(CAPTURAS, 'video-tradicional.png') });
  await p.close();
}

// ---------- Una página ----------

console.log('\n== Una página en chino ==');
const w = await contexto.newPage();
w.on('pageerror', (e) => errores.push(`página: ${e.message}`));
await w.goto('https://chino.test/articulo');
const marcadas = await w.waitForFunction(() => Number(document.querySelector('kotonoha-overlay')?.dataset.kkRangos) > 0, null, { timeout: 30000 }).then(() => true).catch(() => false);
comprobar(marcadas, 'El lector marca las palabras de la página');
await w.waitForTimeout(600);
const caja = await w.evaluate(() => {
  const t = document.createTreeWalker(document.getElementById('uno'), NodeFilter.SHOW_TEXT);
  t.nextNode();
  const i = t.currentNode.data.indexOf('图书馆');
  const r = document.createRange();
  r.setStart(t.currentNode, i + 1);
  r.setEnd(t.currentNode, i + 2);
  const c = r.getBoundingClientRect();
  return { x: c.left + c.width / 2, y: c.top + c.height / 2 };
});
await w.mouse.click(caja.x, caja.y);
const conFicha = await w.waitForFunction(() => document.querySelector('kotonoha-overlay')?.shadowRoot?.querySelector('.ficha-palabra'), null, { timeout: 15000 }).then(() => true).catch(() => false);
await w.waitForTimeout(700);
const fichaWeb = conFicha
  ? await w.evaluate(() => {
      const p = document.querySelector('kotonoha-overlay').shadowRoot.querySelector('.ficha-palabra')?.cloneNode(true);
      p?.querySelectorAll('rt').forEach((x) => x.remove());
      return p?.textContent ?? '';
    })
  : '';
comprobar(fichaWeb === '图书馆', 'Un clic en una palabra de la página abre su ficha', fichaWeb);
await w.screenshot({ path: join(CAPTURAS, 'pagina.png') });
await w.close();

// ---------- Los hanzi y el HSK ----------

console.log('\n== Los hanzi y el HSK ==');
if (!(await motor('estado')).diccionarios.some((d) => d.id === 'hanzi')) {
  const t1 = Date.now();
  await motor('instalarDiccionario', 'hanzi');
  console.log(`  instalado hanzi en ${Math.round((Date.now() - t1) / 1000)} s`);
}
const fichaDi = await motor('fichaCaracter', '地');
comprobar(fichaDi?.on.oficiales.map((l) => l.texto).slice(0, 2).join(' ') === 'dì de' && fichaDi.nivel === 'HSK 2', 'El diccionario de hanzi lleva las lecturas del HSK, la más usada primero, y su nivel', `${fichaDi?.on.oficiales.map((l) => l.texto).join(' ')} · ${fichaDi?.nivel}`);
const fichaJiang = await motor('fichaCaracter', '江');
comprobar(fichaJiang?.radical?.caracter === '水' && fichaJiang.radical.forma === '氵' && fichaJiang.radical.nombres.includes('三点水'), 'Su radical, con la forma que toma y su nombre de clase', JSON.stringify(fichaJiang?.radical));
comprobar(fichaJiang?.fonetico === '工' && fichaJiang.componentes?.some((p) => p.caracter === '氵'), 'La pieza que le da el sonido y sus piezas', `${fichaJiang?.fonetico} · ${fichaJiang?.componentes?.map((p) => p.caracter).join('')}`);
const trazosWo = await motor('trazos', '我');
comprobar(trazosWo?.trazos.length === 7 && trazosWo.trazos.every((d) => /^M[\d.]+,[\d.]+ C/.test(d)), 'Los trazos de Hanzi Writer: 我 tiene siete', trazosWo?.trazos.length);

await app.goto(`chrome-extension://${id}/app.html#/diccionario?q=${encodeURIComponent('妈')}`);
await app.waitForSelector('.dic-caracter .dic-lecturas', { timeout: 20000 }).catch(() => null);
await app.waitForTimeout(1500);
const paginaHanzi = await app.evaluate(() => {
  const t = (s) => document.querySelector(s)?.textContent?.trim() ?? '';
  return {
    tipo: t('.dic-caracter-tipo'),
    nivel: t('.dic-caracter-titulo .chip-nivel'),
    lecturas: t('.dic-lecturas-fila dd'),
    rotulos: [...document.querySelectorAll('.dic-lecturas-fila dt')].map((x) => x.textContent.trim()),
    formacion: t('.dic-formacion'),
    pista: t('.dic-formacion-pista'),
    piezas: [...document.querySelectorAll('.dic-pieza b')].map((x) => x.textContent),
    sonido: [...document.querySelectorAll('.dic-pieza-fonetico')].map((x) => x.textContent.trim()).join(' | '),
    trazos: document.querySelectorAll('.dic-caracter-trazos svg path').length,
    credito: t('.trazos-credito'),
  };
});
console.log('  ', JSON.stringify(paginaHanzi));
comprobar(paginaHanzi.tipo === 'Hanzi' && paginaHanzi.nivel === 'HSK 1', 'La página del hanzi, con su nivel del HSK', `${paginaHanzi.tipo} · ${paginaHanzi.nivel}`);
comprobar(paginaHanzi.lecturas.includes('mā') && paginaHanzi.rotulos[0] === 'Pinyin', 'Su pinyin', `${paginaHanzi.rotulos.join(' | ')} · ${paginaHanzi.lecturas}`);
comprobar(paginaHanzi.formacion === 'Fonosemántico' && paginaHanzi.pista.length > 0, 'Cómo se formó, con la pista del diccionario', `${paginaHanzi.formacion} · ${paginaHanzi.pista}`);
comprobar(
  paginaHanzi.piezas.includes('女') && paginaHanzi.piezas.includes('马') && /Da el sonido\s*马/.test(paginaHanzi.sonido) && /Da el significado\s*女/.test(paginaHanzi.sonido),
  'Sus piezas, la que le da el sonido y la que le da el significado',
  `${paginaHanzi.piezas.join(' ')} · ${paginaHanzi.sonido}`
);
comprobar(paginaHanzi.trazos > 0 && /Make Me a Hanzi/.test(paginaHanzi.credito), 'Con el orden de sus trazos y su crédito', `${paginaHanzi.trazos} trazados · ${paginaHanzi.credito}`);
await app.screenshot({ path: join(CAPTURAS, 'hanzi.png') });
await app.getByRole('radio', { name: 'Practicar' }).click();
comprobar(await app.waitForSelector('.escritura', { timeout: 10000 }).then(() => true).catch(() => false), 'Y se practica su escritura');

await app.goto(`chrome-extension://${id}/app.html#/niveles`);
await app.waitForSelector('.ap-nivel-examen', { timeout: 20000 }).catch(() => null);
await app.waitForTimeout(1200);
const tarjetas = await app.$$eval('.ap-nivel-examen-cab b', (xs) => xs.map((x) => x.textContent));
comprobar(tarjetas.join(' | ') === 'HSK 1 | HSK 2 | HSK 3 | HSK 4 | HSK 5 | HSK 6 | HSK 7–9', 'La pantalla del HSK tiene sus siete niveles', tarjetas.join(' | '));
const pestanasNiveles = await app.$$eval('.ap-niveles-filtros [role="tab"]', (xs) => xs.map((x) => x.textContent.trim()));
comprobar(pestanasNiveles.some((p) => p.startsWith('Vocabulario')) && pestanasNiveles.some((p) => p.startsWith('Hanzi')), 'Con su vocabulario y sus hanzi', pestanasNiveles.join(' | '));
await app.getByRole('radio', { name: /^HSK 2/ }).click();
await app.getByRole('tab', { name: /^Gramática/ }).click();
await app.waitForSelector('.ap-patron-cab', { timeout: 10000 }).catch(() => null);
const puntos = await app.$$eval('.ap-patron-cab b', (xs) => xs.map((x) => x.textContent.trim()));
comprobar(puntos.includes('因为……，所以……'), 'Y la gramática del temario, nivel a nivel', `${puntos.length} puntos`);
await app.getByRole('tab', { name: /^Hanzi/ }).click();
await app.locator('.ap-caracter').first().click();
await app.waitForSelector('.ap-caracter-detalle', { timeout: 10000 }).catch(() => null);
const rotulosDetalle = await app.$$eval('.ap-caracter-cab small', (xs) => xs.map((x) => x.textContent));
comprobar(rotulosDetalle.join(' ') === 'pinyin', 'El hanzi elegido, con su pinyin y sin on ni kun', rotulosDetalle.join(' '));
await app.screenshot({ path: join(CAPTURAS, 'niveles.png') });

// ---------- La práctica de los tonos ----------

console.log('\n== Practicar los tonos ==');
await app.goto(`chrome-extension://${id}/app.html#/practicar?t=${encodeURIComponent(FRASE_TONOS)}`);
await app.waitForSelector('.ap-practica-silaba', { timeout: 20000 }).catch(() => null);
const esperadas = await app.$$eval('.ap-practica-silaba', (xs) => xs.map((x) => `${x.querySelector('.ap-practica-caracter')?.textContent}:${x.querySelector('.ap-practica-pinyin')?.textContent}:${x.className.split(' ')[1]}`));
comprobar(esperadas.join(' ') === '天:tiān:ac-tono1 气:qì:ac-tono4 很:hén:ac-tono2 好:hǎo:ac-tono3', 'Las sílabas con el tono con que se dicen: 很 pasa al segundo delante de 好', esperadas.join(' '));
comprobar((await app.locator('.ap-practica-cab h3').textContent()) === 'Practicar los tonos', 'El panel es el de los tonos');
await app.getByRole('button', { name: 'Grabar' }).click();
await app.waitForSelector('.ap-dictado.grabando', { timeout: 10000 }).catch(() => null);
await app.waitForTimeout(3200);
await app.getByRole('button', { name: 'Terminar' }).click();
const resumen = await app.waitForSelector('.ap-practica-resumen', { timeout: 20000 }).then((e) => e.textContent()).catch(() => null);
comprobar(resumen === '4 de 4 sílabas con la forma de su tono.', 'La voz sintética, con cada tono en su sitio, sale bien entera', resumen ?? (await app.locator('.ap-dictado.error').textContent().catch(() => '')));
comprobar((await app.locator('.ap-practica-grafica polyline.tuya').count()) > 0 && (await app.locator('.ap-practica-grafica polyline.esperado').count()) === 4, 'Con la curva de la voz sobre la forma de cada tono');
await app.screenshot({ path: join(CAPTURAS, 'practica-tonos.png') });
await app.goto(`chrome-extension://${id}/app.html#/descubre`);
await app.waitForSelector('.ap-familia', { timeout: 10000 }).catch(() => null);
const descubre = await app.evaluate(() => [...document.querySelectorAll('.ap-funcion')].map((f) => f.getAttribute('data-funcion')));
comprobar(
  ['tonos', 'como-suena', 'kanji', 'niveles'].every((f) => descubre.includes(f)) && !descubre.includes('acento'),
  'Descubre Kotonoha enseña los tonos, «Cómo suena», los hanzi y el HSK, y no el acento',
  JSON.stringify(descubre)
);

// ---------- Vuelta al japonés ----------

console.log('\n== Vuelta al japonés ==');
await app.goto(`chrome-extension://${id}/app.html#/ajustes`);
await app.waitForTimeout(1000);
await app.locator('select[aria-label="Idioma que estudias"]').selectOption('ja');
await app.waitForTimeout(1500);
comprobar((await leerAjustes()).idiomaObjetivo === 'ja', 'Se vuelve al japonés');
const fuentesJa = await motor('fuentesDiccionario');
comprobar(fuentesJa.some((f) => f.id.startsWith('jmdict')) && !fuentesJa.some((f) => f.id === 'cc-cedict'), 'Con su biblioteca, sin la del chino');
const [lineaJa] = await motor('analizarTexto', '図書館で本を読む');
comprobar(lineaJa.some((x) => x.lema === '図書館' || x.lema === '読む'), 'Y su analizador', lineaJa.filter((x) => x.esPalabra).map((x) => x.lema).join(' '));

if (errores.length) console.log('Errores de página:', errores.slice(0, 8).join('\n'));
comprobar(!errores.length, 'Ningún error de página', errores.length);
console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien');
await contexto.close();
process.exit(fallos ? 1 : 0);
