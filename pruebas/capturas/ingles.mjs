// Las imágenes del inglés del README y de las guías, en cada idioma de la interfaz, con contenido real (ver
// contenido-real.mjs): los subtítulos de la NASA sobre su video «What’s Up: November 2026», con la ficha de refer en
// «Those names refer to the two areas in the constellation», y el capítulo I de «Alice’s Adventures in Wonderland» (1866)
// en Wikisource, con la ficha de getting en «getting up». También la bienvenida, en la pregunta del idioma.
// El momento del video es una carta del cielo de la propia NASA («Artist’s concept»), de dominio público: las fotos que
// la NASA mete en el video llevan el crédito de su autor («Credit: …») y no se usan.
// Sin la API de Claude: lo que se ve es el diccionario. Antes: node herramientas/contenido-readme.mjs.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/capturas/ingles.mjs [es de zh ko ja en]
// (KK_PERFIL, por omisión .perfil-ingles: el inglés-inglés pesa 110 MB y se instala una vez, al final.)

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { recargarExtension } from '../extension.mjs';
import { ALICE_WIKISOURCE, archivoLibre, json3, NASA, servirVideo, traduccionNasa } from './contenido-real.mjs';

const RAIZ = resolve(import.meta.dirname, '..', '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-ingles'));
const SALIDA = join(RAIZ, 'docs', 'img');
// El inglés-inglés, al final: instalarlo son 110 MB, y así no hay que borrarlo.
const IDIOMAS = process.argv.slice(2).length ? process.argv.slice(2) : ['es', 'de', 'zh', 'ko', 'ja', 'en'];

const guardar = async (p, base, idioma) => {
  const ruta = join(SALIDA, idioma === 'es' ? `${base}.png` : `${base}.${idioma}.png`);
  await sharp(await p.screenshot()).png({ palette: true, quality: 92, effort: 10 }).toFile(ruta);
  console.log('  imagen:', ruta.slice(RAIZ.length + 1));
};

const PAGINA_VIDEO = `<!doctype html><html lang="en"><meta charset="utf-8"><title>${NASA.titulo} - YouTube</title>
<body style="margin:0;background:#0f0f0f;color:#fff;font-family:sans-serif">
<div id="movie_player" style="position:relative;width:1280px;height:720px;margin:0 auto;background:#000"><video id="v" src="https://media.test/nasa.webm" muted style="width:100%;height:100%"></video></div>
<script>
  const pistas = [
    { languageCode: 'en', vssId: '.en', name: { simpleText: 'English' } },
    ...['es', 'de', 'zh', 'ko', 'ja'].map((c) => ({ languageCode: c, vssId: '.' + c, name: { simpleText: c } })),
  ].map((t) => ({ ...t, baseUrl: 'https://www.youtube.com/api/timedtext?v=${NASA.idVideo}&lang=' + t.languageCode, url: 'https://www.youtube.com/api/timedtext?v=${NASA.idVideo}&pot=x&lang=' + t.languageCode }));
  const j = document.getElementById('movie_player');
  const v = document.getElementById('v');
  j.getPlayerResponse = () => ({ videoDetails: { videoId: '${NASA.idVideo}', title: ${JSON.stringify(NASA.titulo)} }, captions: { playerCaptionsTracklistRenderer: { captionTracks: pistas } } });
  j.getAudioTrack = () => ({ captionTracks: pistas });
  j.getVideoData = () => ({ video_id: '${NASA.idVideo}', title: ${JSON.stringify(NASA.titulo)} });
  j.seekTo = (s) => { v.currentTime = s; };
  j.playVideo = () => v.play();
  j.pauseVideo = () => v.pause();
  j.loadModule = () => {};
  j.setOption = () => {};
</script>`;

const c = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1280, height: 720 },
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
});
const video = readFileSync(archivoLibre(NASA.video));
await c.route('https://media.test/**', (r) =>
  servirVideo(video, r.request().headers().range, (status, body, headers) => r.fulfill({ status, body, headers }))
);
await c.route('https://www.youtube.com/**', (r) => {
  const u = new URL(r.request().url());
  if (u.pathname.includes('/api/timedtext')) {
    const l = u.searchParams.get('lang');
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: json3(l === 'en' ? NASA.lineas : traduccionNasa(l)) });
  }
  if (u.pathname === '/watch') return r.fulfill({ status: 200, contentType: 'text/html', body: PAGINA_VIDEO });
  return r.fulfill({ status: 204 });
});

const sw = await recargarExtension(c);
const id = new URL(sw.url()).host;
for (const pg of c.pages()) if (pg.url().includes('app.html')) await pg.close();
const app = await c.newPage();
await app.goto(`chrome-extension://${id}/app.html#/ajustes`);
const conLimite = (pr, ms, que) => Promise.race([pr, new Promise((_, mal) => setTimeout(() => mal(new Error(`Sin respuesta en ${ms} ms: ${que}`)), ms))]);
const fijar = (a) =>
  conLimite(
    app.evaluate(async (a) => {
      const d = await chrome.storage.local.get('ajustes');
      await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), ...a } });
    }, a),
    30000,
    'fijar'
  );
// Sin la API de Claude: la ficha enseña el diccionario.
await app.evaluate(async () => chrome.storage.local.remove(['claveAnthropic']));
const motor = async (metodo, ...args) => {
  const r = await conLimite(app.evaluate(({ metodo, args }) => chrome.runtime.sendMessage({ canal: 'motor', metodo, args }), { metodo, args }), 300000, metodo);
  if (!r?.ok) throw new Error(`${metodo}: ${r?.error ?? 'sin respuesta'}`);
  return r.valor;
};
await fijar({ idiomaInterfaz: 'es', bienvenidaVista: true, ankiPuerto: 1, destino: 'memoria', navegadorAbierto: false, modo: 'normal', salto: 'no', subsPosicion: null });
await app.reload();
await app.waitForTimeout(1200);
await app.locator('select[aria-label="Idioma que estudias"]').selectOption('en').catch(() => {});
await app.waitForTimeout(800);
const instaladosAhora = async () => (await motor('estado')).diccionarios.map((d) => d.id);
// Borrar el inglés-inglés (110 MB) puede pasar de los 5 minutos que el service worker espera una respuesta: el motor
// sigue borrando aunque la respuesta se pierda, así que entonces se espera a que el diccionario desaparezca.
const quitarDiccionario = async (d) => {
  try {
    await motor('eliminarDiccionario', d);
  } catch (e) {
    console.log(`  ${d}: ${e.message}; se espera a que termine de borrarse`);
    const hasta = Date.now() + 30 * 60_000;
    while ((await instaladosAhora()).includes(d)) {
      if (Date.now() > hasta) throw new Error(`${d} no terminó de borrarse`);
      await app.waitForTimeout(15000);
    }
  }
};
for (const d of ['wty-en-ipa', 'frecuencia-subtitulos']) if (!(await instaladosAhora()).includes(d)) await motor('instalarDiccionario', d);

// Unas conocidas y otras no: una página toda subrayada no representa a nadie.
const NUEVAS = new Set(['refer', 'level', 'buffet', 'streak', 'pairing', 'supermoon', 'meteor', 'constellation', 'originate', 'handful', 'fireball', 'worthwhile', 'peep', 'daisy', 'remarkable', 'hedge', 'tunnel', 'curiosity', 'stupid', 'considering', 'pleasure']);
const marcar = async (texto) => {
  const lineas = await motor('analizarTexto', texto);
  const palabras = new Map();
  for (const linea of lineas) for (const k of linea) if (k.esPalabra) palabras.set(k.clave, k);
  // Las nuevas se dejan desconocidas a propósito: en un perfil ya usado pueden haber quedado como conocidas.
  const cambios = [...palabras.values()].map((k) => ({ lema: k.lema, lectura: k.lecturaLema, clave: k.clave, estado: NUEVAS.has(k.lema) ? 'desconocida' : 'conocida' }));
  await motor('cambiarPalabras', cambios);
};

for (const idioma of IDIOMAS) {
  console.log(`\n== ${idioma} ==`);
  const propios = idioma === 'en' ? ['wty-en-en'] : [`wty-en-${idioma}`, `wty-en-${idioma}-gloss`];
  for (const d of await instaladosAhora()) if (d.startsWith('wty-en-') && d !== 'wty-en-ipa' && !propios.includes(d)) await quitarDiccionario(d);
  for (const d of propios) if (!(await instaladosAhora()).includes(d)) await motor('instalarDiccionario', d);
  await motor('estado');
  const secundario = idioma === 'en' ? 'es' : idioma;
  await fijar({ idiomaInterfaz: idioma, idiomaSecundario: secundario, idiomaExplicaciones: idioma === 'es' ? 'español' : undefined, lectorActivo: true, lectorFurigana: 'ninguna', glosas: 'desconocidas', colorAcento: 'ninguno', bienvenidaVista: true });

  // Sobre el video de la NASA, en su carta del cielo de Tauro, con la ficha de refer abierta.
  const p = await c.newPage();
  await p.goto(`https://www.youtube.com/watch?v=${NASA.idVideo}`);
  const enOverlay = (fn, arg) =>
    p.evaluate(({ fn, arg }) => {
      const r = (document.querySelector('kotonoha-overlay:not([popover])') ?? document.querySelector('kotonoha-overlay'))?.shadowRoot;
      return r ? new Function('r', 'arg', `return (${fn})(r, arg)`)(r, arg) : null;
    }, { fn: fn.toString(), arg });
  const hasta = async (fn, arg, ms = 25000) => {
    const limite = Date.now() + ms;
    for (;;) {
      const v = await enOverlay(fn, arg).catch(() => null);
      if (v) return v;
      if (Date.now() > limite) return null;
      await p.waitForTimeout(100);
    }
  };
  await hasta((r) => r.querySelector('.barra') != null, undefined, 30000);
  if (idioma === IDIOMAS[0]) await marcar(NASA.lineas.map(([, , t]) => t).join('\n'));
  // «Those names refer to the two areas in the constellation»
  await p.evaluate(() => {
    const v = document.querySelector('#v');
    v.pause();
    v.currentTime = 23.6;
  });
  await hasta((r) => [...r.querySelectorAll('.linea-sub.objetivo .pal')].some((x) => x.textContent.includes('refer')) || null);
  await p.waitForTimeout(1600);
  const sitio = await enOverlay((r) => {
    const quitar = (e) => {
      const c = e.cloneNode(true);
      c.querySelectorAll('rt, .glosa').forEach((x) => x.remove());
      return c.textContent.trim().toLowerCase();
    };
    const e = [...r.querySelectorAll('.linea-sub.objetivo .pal')].find((x) => quitar(x) === 'refer');
    if (!e) return null;
    const c = e.getBoundingClientRect();
    return { x: c.left + c.width / 2, y: c.top + c.height / 2 };
  });
  if (!sitio) throw new Error(`Sin «refer» en los subtítulos (${idioma})`);
  await p.mouse.move(sitio.x, sitio.y);
  await hasta((r) => r.querySelector('.ficha-palabra') != null);
  await p.waitForTimeout(900);
  await guardar(p, 'ingles-subtitulos', idioma);
  await p.close();

  // El capítulo I de Alice en Wikisource, con el verbo con partícula en la ficha.
  const q = await c.newPage();
  await q.goto(ALICE_WIKISOURCE, { waitUntil: 'domcontentloaded' });
  await q.waitForFunction(() => Number(document.querySelector('kotonoha-overlay')?.dataset.kkRangos) > 0, null, { timeout: 60000 });
  if (idioma === IDIOMAS[0]) {
    await marcar(await q.evaluate(() => document.querySelector('.mw-parser-output')?.innerText ?? document.body.innerText));
    await q.reload({ waitUntil: 'domcontentloaded' });
    await q.waitForFunction(() => Number(document.querySelector('kotonoha-overlay')?.dataset.kkRangos) > 0, null, { timeout: 60000 });
  }
  const sitioPagina = await q.evaluate(() => {
    const raiz = document.querySelector('.mw-parser-output') ?? document.body;
    const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const i = n.data.indexOf('getting up');
      if (i < 0) continue;
      n.parentElement.scrollIntoView({ block: 'center' });
      const r = document.createRange();
      r.setStart(n, i);
      r.setEnd(n, i + 4);
      const b = r.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    }
    return null;
  });
  if (!sitioPagina) throw new Error('No está «getting up» en la página de Wikisource');
  await q.waitForTimeout(500);
  await q.mouse.click(sitioPagina.x, sitioPagina.y);
  await q.waitForFunction(() => document.querySelector('kotonoha-overlay')?.shadowRoot?.querySelector('.ficha-palabra'), null, { timeout: 15000 });
  await q.waitForTimeout(900);
  // Que se vea el verbo con partícula, que es de lo que habla esta imagen.
  await q.evaluate(() => document.querySelector('kotonoha-overlay').shadowRoot.querySelector('.lista-compuestos')?.scrollIntoView({ block: 'center' }));
  await q.waitForTimeout(400);
  await guardar(q, 'ingles-pagina', idioma);
  await q.close();

  // La bienvenida, en la pregunta del idioma que se estudia.
  await fijar({ bienvenidaVista: false });
  const a = await c.newPage();
  await a.goto(`chrome-extension://${id}/app.html#/inicio`);
  await a.waitForSelector('.ap-bienvenida', { timeout: 15000 });
  await a.waitForTimeout(600);
  await a.locator('.ap-bv-pie .btn.primario').click();
  await a.waitForTimeout(700);
  await guardar(a, 'ingles-idioma', idioma);
  await a.close();
  await fijar({ bienvenidaVista: true });
}
await c.close();
process.exit(0);
