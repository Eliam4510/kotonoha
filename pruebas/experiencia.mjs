// Prueba cómo se siente la interfaz sobre el video: lo que importa no es que funcione, sino lo que
// percibe quien la usa. Mide parpadeos, saltos y temblores fotograma a fotograma.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/experiencia.mjs

import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';
import { iniciarMock } from './mock-claude.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-experiencia'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'experiencia');
const VIDEO = join(RAIZ, 'pruebas', 'fixtures', 'video.webm');
mkdirSync(CAPTURAS, { recursive: true });
rmSync(PERFIL, { recursive: true, force: true });
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
await sw.evaluate(async (url) => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ urlBaseIA: url, claveAnthropic: 'clave-de-prueba', ajustes: { ...(d.ajustes ?? {}), modo: 'normal', salto: 'no', navegadorAbierto: false, analisisAutomatico: false, idiomaObjetivo: 'ja', idiomaSecundario: 'es', subsPosicion: null } });
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
comprobar(!!(await hasta((r) => r.querySelector('.linea-sub.objetivo .pal') != null, undefined, 30000)), 'Se ven los subtítulos');

// ---------- La barra superior ----------

if (quiere('barra')) {
  console.log('\n== Barra superior ==');
  await irA(1.5);
  await p.mouse.move(800, 500);
  await p.evaluate(() => {
    const b = document.querySelector('kotonoha-overlay').shadowRoot.querySelector('.barra');
    window.__cambios = 0;
    new MutationObserver(() => {
      const v = b.classList.contains('visible');
      if (v !== window.__ultimaBarra) {
        window.__cambios++;
        window.__ultimaBarra = v;
      }
    }).observe(b, { attributes: true, attributeFilter: ['class'] });
    window.__ultimaBarra = b.classList.contains('visible');
  });
  const cambios = () => p.evaluate(() => window.__cambios);

  await p.mouse.move(800, 6);
  await p.mouse.move(800, 300);
  await p.waitForTimeout(350);
  comprobar(!(await barraVisible()) && (await cambios()) === 0, 'Pasar de largo por arriba no la despierta');

  await p.mouse.move(120, 5);
  await p.waitForTimeout(300);
  comprobar(!(await barraVisible()), 'En la esquina, donde está el menú del sitio, tampoco');

  await p.mouse.move(800, 5);
  await p.waitForTimeout(260);
  comprobar(await barraVisible(), 'Al detenerse arriba, aparece');
  comprobar((await cambios()) === 1, 'Sin parpadeos al aparecer', `${await cambios()} cambios`);

  // Justo por el borde inferior, donde antes subía y bajaba.
  for (const [x, y] of [[800, 30], [800, 62], [800, 70], [800, 62], [800, 74], [800, 60], [800, 80], [800, 66], [800, 90], [800, 66], [640, 95], [950, 40], [800, 120]]) {
    await p.mouse.move(x, y);
    await p.waitForTimeout(60);
  }
  await p.waitForTimeout(400);
  comprobar(await barraVisible(), 'Se queda aunque el ratón ronde su borde inferior');
  comprobar((await cambios()) === 1, 'Y no sube y baja', `${await cambios()} cambios`);

  await p.mouse.move(800, 500);
  await p.waitForTimeout(350);
  comprobar(await barraVisible(), 'Al alejarse aguanta un momento, por si vuelves');
  await p.mouse.move(800, 60);
  await p.waitForTimeout(900);
  comprobar(await barraVisible() && (await cambios()) === 1, 'Y si vuelves sigue ahí, sin moverse');

  await p.mouse.move(800, 500);
  await p.waitForTimeout(1000);
  comprobar(!(await barraVisible()), 'Si no vuelves, se va');
  comprobar((await cambios()) === 2, 'En total, una vez aparecer y una irse', `${await cambios()} cambios`);

  await p.evaluate(() => window.scrollTo(0, 1200));
  await p.waitForTimeout(150);
  await p.mouse.move(800, 5);
  await p.waitForTimeout(350);
  comprobar(!(await barraVisible()), 'Con el video fuera de la pantalla no aparece');
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.mouse.move(800, 500);
  await p.waitForTimeout(200);
}

// ---------- Cambio de línea ----------

if (quiere('fluidez')) {
  console.log('\n== Cambio de línea ==');
  // Con el ratón encima de una palabra se abriría su ficha, y el video se pausa para consultarla.
  await p.mouse.move(100, 850);
  await irA(0.6);
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    const r = document.querySelector('kotonoha-overlay').shadowRoot;
    window.__m = [];
    const medir = () => {
      const v = document.querySelector('#v');
      const b = r.querySelector('.subs-bloque');
      const c = b && !b.classList.contains('saliendo') ? b.querySelector('.subs-fondo')?.getBoundingClientRect() : null;
      window.__m.push({
        t: v.currentTime * 1000,
        visible: !!c && getComputedStyle(b).visibility !== 'hidden',
        opacidad: b ? Number(getComputedStyle(b).opacity) : 0,
        texto: b?.querySelector('.linea-sub.objetivo .linea-texto')?.textContent ?? '',
        ancho: c?.width ?? 0,
        elemento: b,
      });
      if (!window.__parar) requestAnimationFrame(medir);
    };
    requestAnimationFrame(medir);
    document.querySelector('#v').play();
  });
  await p.waitForFunction(() => document.querySelector('#v').currentTime > 5.2, undefined, { timeout: 15000 }).catch(async () => {
    console.log('El video no avanzó:', await p.evaluate(() => { const v = document.querySelector('#v'); return { paused: v.paused, t: v.currentTime, ready: v.readyState, error: v.error?.message, red: v.networkState, buf: v.buffered.length ? v.buffered.end(0) : 0, dur: v.duration, n: window.__m?.length }; }));
  });
  const m = await p.evaluate(() => {
    window.__parar = true;
    document.querySelector('#v').pause();
    const primero = window.__m.find((x) => x.elemento)?.elemento;
    return window.__m.map((x) => ({ t: x.t, visible: x.visible, opacidad: x.opacidad, texto: x.texto, ancho: x.ancho, mismo: x.elemento === primero }));
  });
  const durante = m.filter((x) => x.t >= 1200 && x.t <= 3980); // La primera línea entra con un fundido breve.
  const apagados = durante.filter((x) => !x.visible || x.opacidad < 0.99 || !x.texto).length;
  comprobar(durante.length > 40, 'Se midieron suficientes fotogramas', `${durante.length}`);
  comprobar(apagados === 0, 'Entre líneas seguidas el fondo y el texto nunca se apagan', `${apagados} fotogramas apagados`);
  comprobar(durante.every((x) => x.mismo), 'El bloque es siempre el mismo: no se destruye ni se vuelve a crear');
  const textos = [...new Set(durante.map((x) => x.texto))];
  comprobar(textos.length === 3, 'Pasa por las tres líneas', textos.length);
  const anchos = durante.map((x) => x.ancho);
  const saltos = anchos.slice(1).map((a, i) => Math.abs(a - anchos[i]));
  comprobar(Math.max(...saltos) < Math.max(...anchos) * 0.5, 'El fondo cambia de tamaño con suavidad, sin saltos bruscos', `salto máximo ${Math.round(Math.max(...saltos))} px`);
  const tras = m.filter((x) => x.t > 4600 && x.t < 5200);
  comprobar(tras.length > 0 && tras.every((x) => !x.visible), 'En una pausa larga la pantalla queda libre');
  const cola = m.filter((x) => x.t > 4000 && x.t < 4150);
  comprobar(cola.length > 0 && cola.every((x) => x.visible), 'La última línea no se corta de golpe: aguanta un instante');
}

// ---------- El ratón quieto ----------

if (quiere('raton')) {
  console.log('\n== Un ratón quieto no pide nada ==');
  const hayFicha = () => enOverlay((r) => !!r.querySelector('.popup-palabra'));
  const titulo = () => enOverlay((r) => r.querySelector('.ficha-palabra')?.textContent ?? '');
  await p.mouse.move(100, 850);
  await irA(1.5);
  await hasta((r) => r.querySelector('.subs-bloque:not(.saliendo) .pal') != null);
  await p.waitForTimeout(300);
  const w = await enOverlay((r) => { const c = r.querySelector('.linea-sub.objetivo .pal').getBoundingClientRect(); return { x: c.left + c.width / 2, y: c.top + c.height / 2 }; });

  // El ratón espera justo donde va a aparecer la línea.
  await irA(0.4);
  await p.waitForTimeout(300);
  await p.mouse.move(w.x, w.y);
  await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('#v').play());
  await p.waitForFunction(() => document.querySelector('#v').currentTime > 1.5 || document.querySelector('#v').paused, undefined, { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(200);
  const bajoRaton = await enOverlay((r, q) => !!r.elementFromPoint(q.x, q.y)?.closest('.pal'), w);
  comprobar(bajoRaton, 'La línea apareció bajo el ratón');
  comprobar(!(await hayFicha()), 'Y no abre ninguna ficha por sí sola');
  comprobar(!(await p.evaluate(() => document.querySelector('#v').paused)), 'Ni pausa el video');
  await p.evaluate(() => document.querySelector('#v').pause());

  await p.mouse.move(w.x + 2, w.y);
  await hasta((r) => !!r.querySelector('.ficha-palabra'), undefined, 3000);
  await p.waitForTimeout(250);
  const uno = await titulo();
  comprobar(!!uno, 'En cuanto mueves el ratón, sí se abre', uno);

  await p.keyboard.press('n');
  await p.waitForTimeout(450);
  const dos = await titulo();
  await p.keyboard.press('n');
  await p.waitForTimeout(450);
  const tres = await titulo();
  comprobar(dos !== uno && tres !== dos, 'N avanza aunque el ratón siga encima de una palabra', `${uno}, ${dos}, ${tres}`);

  await p.keyboard.press('Escape');
  await p.waitForTimeout(350);
  await p.mouse.move(w.x + 3, w.y);
  await p.waitForTimeout(450);
  comprobar(!(await hayFicha()), 'Tras cerrarla con Esc, un temblor de la mano no la reabre');
  await p.mouse.move(100, 850);
  await p.waitForTimeout(350);
}

// ---------- Mover los subtítulos ----------

if (quiere('mover')) {
  console.log('\n== Mover los subtítulos ==');
  await irA(1.5);
  await hasta((r) => r.querySelector('.subs-bloque:not(.saliendo) .pal') != null);
  await p.waitForTimeout(300);
  const a = await rectBloque();
  const v = await rectVideo();
  comprobar(Math.abs(a.left + a.width / 2 - (v.left + v.width / 2)) < 2, 'Por omisión va centrado');

  // Desde el fondo, a un lado del texto.
  await p.mouse.move(a.left + 5, a.top + a.height / 2);
  await p.waitForTimeout(100);
  await p.mouse.down();
  await p.mouse.move(a.left - 100, a.top - 150, { steps: 8 });
  await p.waitForTimeout(60);
  await p.screenshot({ path: join(CAPTURAS, 'moviendo.png') });
  const enMedio = await rectBloque();
  await p.mouse.up();
  await p.waitForTimeout(250);
  const b = await rectBloque();
  // El puntero se movió desde el borde del bloque, a media altura.
  const dy = -150 - a.height / 2;
  comprobar(Math.abs(enMedio.top - (a.top + dy)) < 3, 'Sigue al ratón mientras se arrastra', `${Math.round(enMedio.top - a.top)} px, el puntero ${Math.round(dy)} px`);
  comprobar(Math.abs(b.left - a.left + 105) < 3 && Math.abs(b.top - a.top - dy) < 3, 'Queda donde se soltó', `${Math.round(b.left - a.left)}, ${Math.round(b.top - a.top)}`);
  const ajustes1 = await leerAjustes();
  comprobar(!!ajustes1.subsPosicion, 'La posición se guarda', JSON.stringify(ajustes1.subsPosicion));
  comprobar(!(await enOverlay((r) => !!r.querySelector('.popup-palabra'))), 'Arrastrar no abre ninguna ficha');
  await p.screenshot({ path: join(CAPTURAS, 'movido.png') });

  // La siguiente línea aparece en el mismo sitio.
  await irA(2.5);
  await p.waitForTimeout(350);
  const c = await rectBloque();
  comprobar(Math.abs(c.left + c.width / 2 - (b.left + b.width / 2)) < 3 && Math.abs(c.bottom - b.bottom) < 3, 'La siguiente línea sale en el mismo sitio');

  // Desde una palabra: un clic la abre, y un arrastre mueve.
  await irA(1.5);
  await p.waitForTimeout(300);
  const antesDelClic = await rectBloque();
  const palabra = await enOverlay((r) => { const e = r.querySelector('.linea-sub.objetivo .pal'); const x = e.getBoundingClientRect(); return { x: x.left + x.width / 2, y: x.top + x.height / 2 }; });
  await p.mouse.move(palabra.x, palabra.y);
  await p.mouse.down();
  await p.mouse.move(palabra.x + 3, palabra.y + 2);
  await p.mouse.up();
  await hasta((r) => r.querySelector('.popup-palabra') != null, undefined, 3000);
  comprobar(await enOverlay((r) => !!r.querySelector('.popup-palabra')), 'Un clic sobre una palabra, aunque tiemble un poco la mano, la abre');
  const trasElClic = await rectBloque();
  comprobar(Math.abs(trasElClic.top - antesDelClic.top) < 1 && Math.abs(trasElClic.left - antesDelClic.left) < 1, 'Y no mueve los subtítulos');
  await p.keyboard.press('Escape');
  await p.mouse.move(100, 850);
  await p.waitForTimeout(400);
  await enOverlay((r) => r.querySelector('.popup-palabra') && r.querySelector('.popup-palabra button[aria-label="Cerrar"]')?.click());
  await p.waitForTimeout(200);

  const antes = await rectBloque();
  await p.mouse.move(palabra.x, palabra.y);
  await p.waitForTimeout(40);
  await p.mouse.down();
  await p.mouse.move(palabra.x + 60, palabra.y - 40, { steps: 6 });
  await p.mouse.up();
  await p.waitForTimeout(300);
  const despues = await rectBloque();
  comprobar(Math.abs(despues.top - antes.top + 40) < 8, 'Arrastrar desde una palabra también mueve', `${Math.round(despues.top - antes.top)} px`);
  comprobar(!(await enOverlay((r) => !!r.querySelector('.popup-palabra'))), 'Y no deja la ficha abierta');

  // Límites.
  await p.mouse.move(despues.left + 5, despues.top + despues.height / 2);
  await p.mouse.down();
  await p.mouse.move(-500, -500, { steps: 5 });
  await p.mouse.up();
  await p.waitForTimeout(250);
  const limite = await rectBloque();
  comprobar(limite.left >= v.left - 1 && limite.top >= v.top - 1, 'No se puede sacar del video', `${Math.round(limite.left - v.left)}, ${Math.round(limite.top - v.top)}`);

  // Sobrevive a una recarga, y a otro tamaño de ventana.
  const guardada = (await leerAjustes()).subsPosicion;
  await p.reload();
  await hasta((r) => r.querySelector('.barra') != null, undefined, 30000);
  await irA(1.5);
  await hasta((r) => r.querySelector('.subs-bloque:not(.saliendo) .pal') != null);
  await p.waitForTimeout(300);
  const trasRecargar = await rectBloque();
  comprobar(Math.abs(trasRecargar.top - limite.top) < 3 && Math.abs(trasRecargar.left - limite.left) < 3, 'Al recargar sigue donde estaba', JSON.stringify(guardada));

  // Doble clic para volver.
  await p.mouse.move(trasRecargar.left + 5, trasRecargar.top + trasRecargar.height / 2);
  await p.mouse.dblclick(trasRecargar.left + 5, trasRecargar.top + trasRecargar.height / 2);
  await p.waitForTimeout(300);
  comprobar((await leerAjustes()).subsPosicion === null, 'Doble clic lo devuelve a su sitio');
  const vuelta = await rectBloque();
  comprobar(Math.abs(vuelta.left + vuelta.width / 2 - (v.left + v.width / 2)) < 2, 'Centrado otra vez');

  // Arrastrar cerca del sitio de siempre lo deja exactamente ahí.
  await p.mouse.move(vuelta.left + 5, vuelta.top + vuelta.height / 2);
  await p.mouse.down();
  await p.mouse.move(vuelta.left + 11, vuelta.top + vuelta.height / 2 + 6, { steps: 3 });
  await p.mouse.up();
  await p.waitForTimeout(200);
  comprobar((await leerAjustes()).subsPosicion === null, 'Soltarlo cerca de su sitio lo encaja ahí');
}

// ---------- Scroll ----------

if (quiere('scroll')) {
  console.log('\n== Scroll en la página ==');
  await irA(1.5);
  await hasta((r) => r.querySelector('.subs-bloque:not(.saliendo) .pal') != null);
  await p.waitForTimeout(300);
  const muestras = await p.evaluate(async () => {
    const r = document.querySelector('kotonoha-overlay').shadowRoot;
    const v = document.querySelector('#v');
    const b = r.querySelector('.subs-bloque');
    const salida = [];
    return new Promise((ok) => {
      const inicio = performance.now();
      const medir = () => {
        salida.push({ d: b.getBoundingClientRect().top - v.getBoundingClientRect().top, y: scrollY });
        if (performance.now() - inicio < 1400) requestAnimationFrame(medir);
        else ok(salida);
      };
      window.scrollTo({ top: 1200, behavior: 'smooth' });
      requestAnimationFrame(medir);
    });
  });
  const ds = muestras.map((x) => x.d);
  const variacion = Math.max(...ds) - Math.min(...ds);
  comprobar(muestras.at(-1).y > 900, 'La página se desplazó', `${muestras.at(-1).y} px`);
  comprobar(variacion < 1.5, 'Los subtítulos van pegados al video, sin temblar', `se separan ${variacion.toFixed(2)} px en ${muestras.length} fotogramas`);
  const fuera = await rectBloque();
  comprobar(fuera.bottom < 0, 'Al bajar a los comentarios se van con el video');
  await p.waitForTimeout(600);
  comprobar((await rectBloque()).bottom < 0, 'Y no vuelven a aparecer arriba');
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(300);
  const volvio = await rectBloque();
  const video = await rectVideo();
  comprobar(volvio.top > video.top && volvio.bottom <= video.bottom, 'Al subir vuelven a su sitio');
}

// ---------- Otros tamaños ----------

if (quiere('tamanos')) {
  console.log('\n== Pantalla completa y otros tamaños ==');
  const enSuSitio = async () => {
    const b = await rectBloque();
    const v = await rectVideo();
    return b && b.top >= v.top - 1 && b.bottom <= v.bottom + 1 && Math.abs(b.left + b.width / 2 - (v.left + v.width / 2)) < 3;
  };
  await p.mouse.move(100, 850);
  await irA(1.5);
  await hasta((r) => r.querySelector('.subs-bloque:not(.saliendo) .pal') != null);
  await p.waitForTimeout(300);

  await p.click('#fs');
  await p.waitForTimeout(700);
  const completa = await p.evaluate(() => { const h = document.querySelector('kotonoha-overlay'); return { fs: document.fullscreenElement?.id, dentro: !!document.fullscreenElement?.contains(h) }; });
  comprobar(completa.fs === 'movie_player', 'Entra en pantalla completa');
  comprobar(completa.dentro, 'La capa de Kotonoha va con él');
  comprobar(await enSuSitio(), 'Y los subtítulos siguen en su sitio', JSON.stringify(await rectBloque()));
  await p.screenshot({ path: join(CAPTURAS, 'completa.png') });

  // Arrastrar también funciona ahí, y la posición se conserva en proporción al salir.
  const a = await rectBloque();
  await p.mouse.move(a.left + 6, a.top + a.height / 2);
  await p.waitForTimeout(100);
  await p.mouse.down();
  await p.mouse.move(a.left + 6, a.top - 120, { steps: 8 });
  await p.mouse.up();
  await p.waitForTimeout(250);
  const b = await rectBloque();
  comprobar(b.top < a.top - 80, 'Se pueden arrastrar en pantalla completa', `${Math.round(b.top - a.top)} px`);
  await p.keyboard.press('Escape');
  await p.evaluate(() => (document.fullscreenElement ? document.exitFullscreen() : null));
  await p.waitForTimeout(700);
  const c = await rectBloque();
  const v = await rectVideo();
  comprobar(c.top >= v.top - 1 && c.bottom <= v.bottom + 1, 'Al salir, dentro del video', `${Math.round(c.top - v.top)} px bajo su borde`);
  await p.evaluate(() => null);
  await enOverlay((r) => r.querySelector('.subs-fondo')?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true })));
  await p.waitForTimeout(300);
  comprobar((await leerAjustes()).subsPosicion === null, 'Doble clic para volver');
  comprobar(await enSuSitio(), 'Y vuelve a su sitio');

  // Una ventana más estrecha.
  await p.setViewportSize({ width: 900, height: 700 });
  await p.waitForTimeout(500);
  await p.evaluate(() => { const j = document.getElementById('movie_player'); j.style.width = '860px'; j.style.height = '484px'; });
  await p.waitForTimeout(400);
  comprobar(await enSuSitio(), 'Al cambiar el tamaño del video, también', JSON.stringify(await rectBloque()));
  await p.evaluate(() => { const j = document.getElementById('movie_player'); j.style.width = '1280px'; j.style.height = '600px'; });
  await p.setViewportSize({ width: 1600, height: 900 });
  await p.waitForTimeout(400);
}

// ---------- Párrafos ----------

if (quiere('largos')) {
  console.log('\n== Párrafos largos ==');
  await irA(1.5);
  await p.waitForTimeout(300);
  const normal = await enOverlay((r) => parseFloat(r.querySelector('.linea-sub.objetivo').style.fontSize));
  await irA(21);
  await p.waitForTimeout(500);
  const larga = await rectBloque();
  const v = await rectVideo();
  const letra = await enOverlay((r) => parseFloat(r.querySelector('.linea-sub.objetivo').style.fontSize));
  await p.screenshot({ path: join(CAPTURAS, 'parrafo.png') });
  comprobar(letra < normal, 'Un párrafo usa una letra algo menor', `${letra.toFixed(1)} frente a ${normal.toFixed(1)} px`);
  comprobar(larga.height < v.height * 0.5, 'Y no tapa más de medio video', `${Math.round((larga.height / v.height) * 100)} %`);
}

// ---------- El gasto de la API ----------

if (quiere('gasto')) {
  console.log('\n== Lo que se le pide a Claude ==');
  const pedidas = () => mock.peticiones.filter((x) => x.url.includes('/messages')).length;
  const ficha = () => enOverlay((r) => r.querySelector('.ficha-palabra')?.textContent ?? '');
  const pulsar = (selector) => enOverlay((r, sel) => { const b = r.querySelector(sel); b?.click(); return !!b; }, selector);
  const pestana = (nombre) => enOverlay((r, n) => { const b = [...r.querySelectorAll('.ficha-dock .pestana')].find((x) => x.textContent.includes(n)); b?.click(); return !!b; }, nombre);

  await p.mouse.move(100, 850);
  await irA(1.5);
  await hasta((r) => r.querySelector('.subs-bloque:not(.saliendo) .pal') != null);
  await p.waitForTimeout(300);
  const palabras = await enOverlay((r) => [...r.querySelectorAll('.linea-sub.objetivo .pal')].map((e) => { const c = e.getBoundingClientRect(); return { x: c.left + c.width / 2, y: c.top + c.height / 2, t: e.textContent }; }));
  const [a, b] = palabras.filter((x) => /[一-龯]/.test(x.t));
  const abrir = async (w) => {
    await p.mouse.move(w.x, w.y);
    await hasta((r, t) => (r.querySelector('.ficha-palabra')?.textContent ?? '').length > 0, undefined, 4000);
    await p.waitForTimeout(350);
  };

  const inicio = pedidas();
  await abrir(a);
  comprobar(!!(await ficha()), 'Al pasar por una palabra se abre el diccionario', await ficha());
  comprobar(await enOverlay((r) => !!r.querySelector('.ficha-panel') && !r.querySelector('.panel-ia')), 'Ninguna pestaña de Claude abierta de entrada');
  await p.waitForTimeout(600);
  comprobar(pedidas() === inicio, 'Abrir una palabra no le pide nada a Claude', `${pedidas() - inicio} peticiones`);
  await abrir(b);
  await abrir(a);
  await abrir(b);
  comprobar(pedidas() === inicio, 'Ir y venir entre palabras tampoco', `${pedidas() - inicio} peticiones`);

  // Con el botón, una petición. Y nunca más para esa misma palabra en esa misma frase.
  await abrir(a);
  comprobar(await pulsar('.sentido-pedir button'), 'Hay un botón para preguntar qué significa aquí');
  await hasta((r) => !!r.querySelector('.sentido b'), undefined, 6000);
  comprobar(pedidas() === inicio + 1, 'Pulsarlo hace una petición', `${pedidas() - inicio}`);
  comprobar(await enOverlay((r) => !r.querySelector('.sentido-pedir')), 'Con la respuesta a la vista, el botón se va');
  await abrir(b);
  comprobar(await enOverlay((r) => !r.querySelector('.sentido')), 'La respuesta de una palabra no se queda en la siguiente');
  await abrir(a);
  await hasta((r) => !!r.querySelector('.sentido b'), undefined, 3000);
  comprobar(await enOverlay((r) => !!r.querySelector('.sentido b')), 'Al volver a esa palabra la respuesta sigue ahí');
  comprobar(pedidas() === inicio + 1, 'Y no se ha vuelto a pedir', `${pedidas() - inicio}`);

  // «Explicar» es otro botón: lo mismo.
  await pestana('Explicar');
  await hasta((r) => (r.querySelector('.panel-ia-texto')?.textContent ?? '').length > 20 && !r.querySelector('.cursor-ia'), undefined, 6000);
  comprobar(pedidas() === inicio + 2, 'Explicar hace una petición', `${pedidas() - inicio}`);
  await abrir(b);
  comprobar(await enOverlay((r) => !r.querySelector('.panel-ia')), 'Pasar a otra palabra no lo pregunta también para ella');
  comprobar(pedidas() === inicio + 2, 'Y no gasta', `${pedidas() - inicio}`);
  await abrir(a);
  await pestana('Explicar');
  await hasta((r) => !!r.querySelector('.panel-ia-guardada'), undefined, 3000);
  comprobar(await enOverlay((r) => !!r.querySelector('.panel-ia-guardada')), 'Volver a explicarla sale de lo guardado, y lo dice');
  comprobar(pedidas() === inicio + 2, 'Sin gastar', `${pedidas() - inicio}`);

  // Lo que más dolía: pedir, cambiar de palabra antes de que responda, y volver.
  mock.control.retardoFlujo = 1500;
  await abrir(b);
  await pestana('Traducir');
  await p.waitForTimeout(250);
  comprobar(pedidas() === inicio + 3, 'Traducir hace una petición', `${pedidas() - inicio}`);
  await abrir(a);
  await p.waitForTimeout(150);
  await abrir(b);
  await pestana('Traducir');
  await p.waitForTimeout(250);
  comprobar(pedidas() === inicio + 3, 'Si cambias de palabra y vuelves mientras responde, se engancha a la misma petición', `${pedidas() - inicio}`);
  await hasta((r) => (r.querySelector('.panel-ia-texto')?.textContent ?? '').length > 5 && !r.querySelector('.cursor-ia'), undefined, 6000);
  comprobar(await enOverlay((r) => (r.querySelector('.panel-ia-texto')?.textContent ?? '').length > 5), 'Y la respuesta llega');
  // Y si te vas y no vuelves, se termina y se guarda: ya estaba pagada.
  await abrir(a);
  await pestana('Desglose');
  await p.waitForTimeout(250);
  const conDesglose = pedidas();
  await abrir(b);
  await p.waitForTimeout(2200);
  mock.control.retardoFlujo = 0;
  await abrir(a);
  await pestana('Desglose');
  await hasta((r) => !!r.querySelector('.panel-ia-guardada'), undefined, 3000);
  comprobar(await enOverlay((r) => !!r.querySelector('.panel-ia-guardada')) && pedidas() === conDesglose, 'Una respuesta interrumpida se termina y se guarda', `${pedidas() - conDesglose} de más`);

  // Volver a generar vale una vez, y solo para esa pregunta.
  const antesDeRepetir = pedidas();
  await pulsar('.panel-ia-acciones button[aria-label="Volver a generar"]');
  await p.waitForTimeout(500);
  await hasta((r) => !r.querySelector('.cursor-ia'), undefined, 6000);
  comprobar(pedidas() === antesDeRepetir + 1, 'Volver a generar sí pregunta otra vez', `${pedidas() - antesDeRepetir}`);
  await abrir(b);
  await abrir(a);
  await pestana('Desglose');
  await hasta((r) => !!r.querySelector('.panel-ia-guardada'), undefined, 3000);
  comprobar(pedidas() === antesDeRepetir + 1, 'Pero después se sigue usando lo guardado', `${pedidas() - antesDeRepetir}`);
  const guion = mock.peticiones.filter((x) => JSON.stringify(x.cuerpo.system ?? '').includes('Texto completo')).length;
  comprobar(guion === 0, 'Ninguna consulta envía el video entero', `${guion} lo enviaron`);
  await p.keyboard.press('Escape');
  await p.mouse.move(100, 850);
  await p.waitForTimeout(500);

  // El registro.
  console.log('\n== El registro de gasto ==');
  const total = pedidas();
  const app = await contexto.newPage();
  await app.goto(`chrome-extension://${new URL(sw.url()).host}/app.html#/`);
  await app.waitForSelector('.ap-gasto', { timeout: 15000 });
  await app.waitForSelector('.ap-gasto .ap-cifra-grande b', { timeout: 15000 });
  const vista = await app.evaluate(() => ({
    cifra: document.querySelector('.ap-gasto .ap-cifra-grande b')?.textContent,
    peticiones: [...document.querySelectorAll('.ap-gasto-tokens > div')].find((d) => d.textContent.includes('Peticiones'))?.querySelector('dd')?.textContent,
    leyenda: document.querySelector('.ap-gasto-leyenda')?.textContent,
    tareas: [...document.querySelectorAll('.ap-gasto-tareas li span')].map((x) => x.textContent),
    registro: document.querySelectorAll('.ap-gasto-registro li').length,
    dias: document.querySelectorAll('.ap-gasto-dia').length,
    barras: document.querySelectorAll('.ap-gasto-pila i').length,
  }));
  console.log('  ', JSON.stringify(vista));
  comprobar(Number(vista.peticiones) === total, 'Cuenta cada petición', `${vista.peticiones} de ${total}`);
  // 1000 tokens de entrada y 20 de salida por petición, con el precio de Sonnet 5.5.
  comprobar(vista.cifra === `USD ${(total * 0.0022).toFixed(total * 0.0022 < 0.01 ? 4 : 2)}`, 'El dinero cuadra con los tokens', `${vista.cifra}, ${total} × 0.0022`);
  comprobar(/Sonnet 5\.5/.test(vista.leyenda ?? ''), 'Dice qué modelo se usó');
  comprobar(vista.tareas.length >= 3, 'Y en qué tareas', vista.tareas.join(', '));
  comprobar(vista.registro > 0, 'Hay registro');
  comprobar(vista.barras > 0 && vista.dias >= 28, 'La gráfica muestra el mes', `${vista.dias} días`);
  await app.screenshot({ path: join(CAPTURAS, 'gasto.png'), fullPage: true });
  await app.close();
}

if (errores.length) console.log('\nErrores en la página:', [...new Set(errores)].slice(0, 6));
console.log(`\n${fallos ? `${fallos} comprobaciones fallaron` : 'Todas las comprobaciones pasaron'}`);
await contexto.close();
mock.servidor.close();
process.exit(fallos ? 1 : 0);
