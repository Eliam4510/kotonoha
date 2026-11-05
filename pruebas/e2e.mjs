// Pruebas de extremo a extremo con Chromium real y la extensión cargada.
// Uso: node pruebas/e2e.mjs [diccionarios] [local] [youtube] [app]

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, 'dist'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-e2e'));
const CAPTURAS = join(RAIZ, 'capturas-e2e');
const FIXTURES = join(RAIZ, 'pruebas', 'fixtures');
mkdirSync(CAPTURAS, { recursive: true });
mkdirSync(FIXTURES, { recursive: true });

const pedidas = process.argv.slice(2);
const quiere = (n) => pedidas.length === 0 || pedidas.includes(n);

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok  ' : 'FALLO'} ${texto}${extra ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};

function crearVideoPrueba() {
  const destino = join(FIXTURES, 'video.webm');
  if (existsSync(destino)) return;
  console.log('Generando video de prueba con ffmpeg...');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=24:duration=60', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=60', '-c:v', 'libvpx-vp9', '-b:v', '300k', '-deadline', 'realtime', '-cpu-used', '8', '-c:a', 'libopus', destino]);
}

const VTT_JA = `WEBVTT

00:00:01.000 --> 00:00:04.000
泥だらけの道でも花は咲いた

00:00:05.000 --> 00:00:08.000
授業の後は、たぶん日本語の勉強を続けると思います。

00:00:09.000 --> 00:00:12.000
赤い星と青い星を食べる夢を見た

00:00:30.000 --> 00:00:33.000
私はまだ立ち上がることができます
`;

const VTT_ES = `WEBVTT

00:00:01.000 --> 00:00:04.000
Incluso en un camino lleno de barro, la flor brotó

00:00:05.000 --> 00:00:08.000
Después de clase, probablemente seguiré estudiando japonés.

00:00:09.000 --> 00:00:12.000
Soñé que devoraba estrellas rojas y azules
`;

function servidor() {
  const pagina = `<!doctype html><html lang="ja"><meta charset="utf-8"><title>Video de prueba</title>
    <body style="margin:0;background:#111;color:#eee;font-family:sans-serif">
    <video id="v" src="/video.webm" controls muted crossorigin="anonymous" style="width:960px;display:block;margin:60px auto 0">
      <track kind="subtitles" srclang="ja" label="日本語" src="/ja.vtt"><track kind="subtitles" srclang="es" label="Español" src="/es.vtt">
    </video>
    <p id="texto" style="width:960px;margin:20px auto;font-size:20px">吾輩は猫である。名前はまだ無い。どこで生れたかとんと見当がつかぬ。</p>
    <img id="foto" width="64" height="64" alt="" style="display:block;margin:0 auto" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==">
    </body></html>`;
  return new Promise((ok) => {
    const s = createServer((req, res) => {
      if (req.url === '/') {
        res.setHeader('content-type', 'text/html; charset=utf-8');
        res.end(pagina);
      } else if (req.url === '/ja.vtt' || req.url === '/es.vtt') {
        res.setHeader('content-type', 'text/vtt; charset=utf-8');
        res.setHeader('access-control-allow-origin', '*');
        res.end(req.url === '/ja.vtt' ? VTT_JA : VTT_ES);
      } else if (req.url === '/video.webm') {
        const datos = readFileSync(join(FIXTURES, 'video.webm'));
        res.setHeader('content-type', 'video/webm');
        res.setHeader('accept-ranges', 'bytes');
        res.setHeader('access-control-allow-origin', '*');
        const rango = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? '');
        if (rango) {
          const ini = +rango[1];
          const fin = rango[2] ? +rango[2] : datos.length - 1;
          res.statusCode = 206;
          res.setHeader('content-range', `bytes ${ini}-${fin}/${datos.length}`);
          res.end(datos.subarray(ini, fin + 1));
        } else {
          res.end(datos);
        }
      } else {
        res.statusCode = 404;
        res.end();
      }
    });
    s.listen(0, '127.0.0.1', () => ok(s));
  });
}

const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1400, height: 900 },
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
});

const sw = await recargarExtension(contexto);
const idExtension = new URL(sw.url()).host;
console.log('Extensión cargada:', idExtension);

const errores = [];
const vigilar = (p, nombre) => {
  p.on('pageerror', (e) => errores.push(`${nombre}: ${e.message}`));
  p.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|ERR_|net::|favicon|GPU|WebGL/.test(m.text())) errores.push(`${nombre} [consola]: ${m.text().slice(0, 300)}`);
  });
};

const pagApp = await contexto.newPage();
vigilar(pagApp, 'app');
await pagApp.goto(`chrome-extension://${idExtension}/app.html`);

const motorRpc = (metodo, ...args) =>
  pagApp.evaluate(
    async ([m, a]) => {
      const llamar = async () => {
        const r = await chrome.runtime.sendMessage({ canal: 'motor', metodo: m, args: a });
        if (!r) throw new Error('sin respuesta');
        if (!r.ok) throw new Error(r.error);
        return r.valor;
      };
      for (let i = 0; ; i++) {
        try {
          return await llamar();
        } catch (e) {
          if (i > 20 || !/Receiving end|sin respuesta|port closed/.test(String(e))) throw e;
          await chrome.runtime.sendMessage({ canal: 'fondo', metodo: 'asegurarMotor', args: [] });
          await new Promise((r) => setTimeout(r, 300));
        }
      }
    },
    [metodo, args]
  );

async function esperarEn(p, fn, arg, tiempo = 20000) {
  return p.waitForFunction(fn, arg, { timeout: tiempo }).catch(() => null);
}

const dentroDelOverlay = (selector) => (s) => document.querySelector('kotonoha-overlay')?.shadowRoot?.querySelector(s ?? selector);

// ---------- Diccionarios ----------

if (quiere('diccionarios')) {
  console.log('\n== Diccionarios ==');
  const estado = await motorRpc('estado');
  const instalados = new Set(estado.diccionarios.map((d) => d.id));
  for (const id of ['jmdict-es', 'jmdict-en', 'kanjium-acento', 'jpdb-frecuencia']) {
    if (instalados.has(id)) {
      console.log('ya instalado:', id);
      continue;
    }
    const t0 = Date.now();
    await motorRpc('instalarDiccionario', id);
    console.log(`instalado ${id} en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }
  const final = await motorRpc('estado');
  for (const d of final.diccionarios) console.log(`  ${d.titulo}: ${d.filas} filas`);
  comprobar(final.diccionarios.length >= 4, 'Los cuatro diccionarios están instalados');
  let terminos = final.terminosCargados;
  for (let i = 0; i < 60 && terminos <= 100000; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    terminos = (await motorRpc('estado')).terminosCargados;
  }
  comprobar(terminos > 100000, 'Términos en memoria', String(terminos));

  const r = await motorRpc('buscar', '食べる', 'たべる');
  comprobar(r.entradas.some((e) => e.glosas.includes('comer')), 'Busca 食べる y encuentra «comer»', r.entradas[0]?.glosas.slice(0, 3).join(', '));
  comprobar(r.entradas.some((e) => e.glosas.some((g) => /to eat/.test(g))), 'Tiene la glosa en inglés', r.entradas.find((e) => e.dic === 'jmdict-en')?.glosas.slice(0, 2).join(' | '));
  comprobar(r.acentos.includes(2), 'Acento de 食べる en la posición 2', r.acentos.join(','));
  comprobar(r.patron === 'nakadaka', 'Patrón nakadaka', r.patron);
  comprobar(r.frecuencias.length > 0, 'Frecuencia de 食べる', JSON.stringify(r.frecuencias[0]));

  const director = await motorRpc('buscar', '監督', 'かんとく');
  const entrada = director.entradas.find((e) => e.dic.startsWith('jmdict') && e.seq);
  comprobar(entrada?.seq === 1213720, 'El número de entrada sirve para enlazar a JapanDict', String(entrada?.seq));

  const flor = await motorRpc('analizarTexto', '泥だらけの道でも花は咲いた');
  console.log('  tokens:', flor[0].map((p) => `${p.superficie}[${p.patron ?? '-'}|${p.rango ?? '-'}]`).join(' '));
  const hana = flor[0].find((p) => p.superficie === '花');
  comprobar(hana?.patron === 'odaka', '花 es odaka', hana?.patron);
  const saita = flor[0].find((p) => p.superficie === '咲いた');
  comprobar(saita?.patron === 'heiban' && saita.lecturaLema === 'さく', '咲いた se analiza como さく, heiban', `${saita?.lecturaLema} ${saita?.patron}`);
  comprobar(flor[0].some((p) => p.superficie === '泥だらけ'), 'Une el compuesto 泥だらけ con el diccionario');

  const libre = await motorRpc('buscarLibre', '食べました');
  comprobar(libre[0]?.lema === '食べる', 'La búsqueda libre reconoce formas conjugadas', libre[0]?.lema);
}

// ---------- Video local con el reproductor ----------

if (quiere('local')) {
  console.log('\n== Página con video ==');
  crearVideoPrueba();
  // Los ajustes persisten en el perfil: se parte de un estado conocido.
  await sw.evaluate(async () => {
    const d = await chrome.storage.local.get('ajustes');
    await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), navegadorAbierto: false, modo: 'normal', salto: 'no', desanclarBarra: false } });
  });
  const s = await servidor();
  const puerto = s.address().port;
  const p = await contexto.newPage();
  vigilar(p, 'video');
  await p.goto(`http://127.0.0.1:${puerto}/`);
  await p.waitForTimeout(800);

  // Equivale a pulsar «Usar el reproductor en el video de esta página» en el menú.
  // El content script puede tardar en cargar con el equipo ocupado: se insiste un rato.
  for (let intento = 0; intento < 40; intento++) {
    const entregado = await sw.evaluate(async () => {
      const [t] = await chrome.tabs.query({ url: 'http://127.0.0.1/*' });
      return chrome.tabs.sendMessage(t.id, { activarVideoAqui: true }).then(() => true, () => false);
    });
    if (entregado) break;
    await p.waitForTimeout(250);
  }

  const hayLineas = await esperarEn(p, () => document.querySelector('kotonoha-overlay')?.shadowRoot?.querySelector('.barra') != null, undefined, 15000);
  comprobar(!!hayLineas, 'Se monta el overlay');

  await p.evaluate(() => {
    const v = document.querySelector('#v');
    v.currentTime = 2;
    v.play();
  });
  const conSub = await esperarEn(p, () => document.querySelector('kotonoha-overlay')?.shadowRoot?.querySelector('.linea-sub.objetivo .pal') != null, undefined, 30000);
  comprobar(!!conSub, 'Aparece el subtítulo en japonés con palabras');

  // El análisis puede tardar más que la primera línea: se vuelve a ella ya en pausa.
  await p.evaluate(() => {
    const v = document.querySelector('#v');
    v.pause();
    v.currentTime = 2;
  });
  await esperarEn(p, () => document.querySelector('kotonoha-overlay')?.shadowRoot?.querySelector('.linea-sub.secundaria')?.textContent.includes('Incluso'), undefined, 8000);
  const datos = await p.evaluate(() => {
    const r = document.querySelector('kotonoha-overlay').shadowRoot;
    return {
      palabras: [...r.querySelectorAll('.linea-sub.objetivo .pal')].map((e) => ({ t: e.textContent, c: e.className })),
      secundaria: r.querySelector('.linea-sub.secundaria')?.textContent,
      rt: [...r.querySelectorAll('.linea-sub.objetivo rt')].map((e) => e.textContent),
    };
  });
  console.log('  palabras:', datos.palabras.map((x) => x.t).join(' / '));
  comprobar(datos.rt.length > 0, 'Hay furigana', datos.rt.join(','));
  comprobar(/Incluso/.test(datos.secundaria ?? ''), 'Aparece la pista secundaria', datos.secundaria);
  comprobar(datos.palabras.some((x) => /est-desconocida/.test(x.c)), 'Marca las palabras desconocidas');
  await p.screenshot({ path: join(CAPTURAS, 'video-subtitulos.png') });

  // Barra y navegador
  await p.evaluate(() => document.querySelector('#v').pause());
  await p.mouse.move(700, 2);
  await p.waitForTimeout(400);
  const barra = await p.evaluate(() => {
    const r = document.querySelector('kotonoha-overlay').shadowRoot;
    return { visible: r.querySelector('.barra')?.classList.contains('visible'), texto: r.querySelector('.barra-resumen')?.textContent };
  });
  comprobar(barra.visible, 'La barra aparece al acercar el ratón arriba', barra.texto);

  await p.keyboard.press('g');
  await p.waitForTimeout(400);
  const nav = await p.evaluate(() => document.querySelector('kotonoha-overlay').shadowRoot.querySelectorAll('.nav-linea').length);
  comprobar(nav === 4, 'El navegador lista las 4 líneas', String(nav));
  await p.screenshot({ path: join(CAPTURAS, 'video-navegador.png') });

  // Consulta de una palabra: pasar el ratón por encima
  const caja = await p.evaluate(() => {
    const e = [...document.querySelector('kotonoha-overlay').shadowRoot.querySelectorAll('.linea-sub.objetivo .pal')].find((x) => x.textContent.includes('花'));
    const r = e.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await p.mouse.move(caja.x, caja.y);
  const popup = await esperarEn(p, () => document.querySelector('kotonoha-overlay').shadowRoot.querySelector('.ficha-palabra') != null, undefined, 8000);
  comprobar(!!popup, 'Se abre la ventana de la palabra al pasar el ratón');
  await p.waitForTimeout(700);
  const ficha = await p.evaluate(() => {
    const r = document.querySelector('kotonoha-overlay').shadowRoot;
    return { titulo: r.querySelector('.ficha-palabra')?.textContent, defs: [...r.querySelectorAll('.lista-defs li')].map((l) => l.textContent), estado: r.querySelector('.estado.activo')?.textContent };
  });
  console.log('  ficha:', JSON.stringify(ficha).slice(0, 240));
  comprobar(/花/.test(ficha.titulo ?? ''), 'La ficha muestra 花');
  comprobar(ficha.defs.length > 0, 'La ficha muestra definiciones');
  await p.screenshot({ path: join(CAPTURAS, 'video-ficha.png') });

  // Cambio de estado con el teclado
  await p.keyboard.press('3');
  await p.waitForTimeout(700);
  const est = await p.evaluate(() => {
    const e = [...document.querySelector('kotonoha-overlay').shadowRoot.querySelectorAll('.linea-sub.objetivo .pal')].find((x) => x.textContent.includes('花'));
    return e?.className;
  });
  comprobar(/est-conocida/.test(est ?? ''), 'La tecla 3 marca la palabra como conocida', est);
  await motorRpc('cambiarPalabras', [{ clave: '花|はな', lema: '花', lectura: 'はな', estado: 'desconocida' }]);

  // Paneles
  await p.keyboard.press('Escape');
  await p.mouse.move(700, 450);
  await p.waitForTimeout(400);
  for (const [t, n] of [['Ajustes de visualización', 'visual'], ['Ajustes de video', 'video'], ['Atajos de teclado', 'atajos'], ['Generar subtítulos', 'generar']]) {
    await p.mouse.move(700, 2);
    await p.waitForTimeout(250);
    await p.evaluate((titulo) => document.querySelector('kotonoha-overlay').shadowRoot.querySelector(`.barra-acciones button[aria-label="${titulo}"]`).click(), t);
    await p.waitForTimeout(250);
    const abierto = await p.evaluate(() => !!document.querySelector('kotonoha-overlay').shadowRoot.querySelector('.panel-flotante'));
    comprobar(abierto, `Abre el panel «${t}»`);
    await p.screenshot({ path: join(CAPTURAS, `panel-${n}.png`) });
    await p.keyboard.press('Escape');
  }

  // Atajos de teclado que abren la consulta
  await p.evaluate(() => {
    const v = document.querySelector('#v');
    v.pause();
    v.currentTime = 6;
  });
  await p.mouse.move(700, 450);
  await p.waitForTimeout(700);
  const tituloFicha = () => p.evaluate(() => document.querySelector('kotonoha-overlay').shadowRoot.querySelector('.ficha-palabra')?.textContent ?? '');
  await p.keyboard.press('n');
  await esperarEn(p, () => document.querySelector('kotonoha-overlay').shadowRoot.querySelector('.ficha-palabra') != null, undefined, 5000);
  const primeraConN = await tituloFicha();
  comprobar(!!primeraConN, 'N abre la ficha de la primera palabra desconocida', primeraConN);
  await p.keyboard.press('n');
  await p.waitForTimeout(800);
  const segundaConN = await tituloFicha();
  const estadoLinea = await p.evaluate(() => [...document.querySelector('kotonoha-overlay').shadowRoot.querySelectorAll('.linea-sub.objetivo .pal')].map((e) => `${e.textContent}:${/est-(\w+)/.exec(e.className)?.[1] ?? '?'}`).join(' '));
  comprobar(segundaConN && segundaConN !== primeraConN, 'N avanza a la siguiente palabra desconocida', `${segundaConN} · ${estadoLinea}`);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(200);

  // Atajos sobre el contenido de la página
  const seleccionar = () =>
    p.evaluate(() => {
      const s = getSelection();
      s.removeAllRanges();
      const r = document.createRange();
      r.selectNodeContents(document.querySelector('#texto'));
      s.addRange(r);
    });
  // Una palabra sin marcar no tiene fila: eso es lo mismo que desconocida.
  const estadoDe = async (lema) => (await motorRpc('listarPalabras', { busqueda: lema, limite: 5 })).filas.find((f) => f.lema === lema)?.estado ?? 'desconocida';
  await seleccionar();
  await p.keyboard.press('Alt+KeyK');
  await p.waitForTimeout(900);
  comprobar((await estadoDe('吾輩')) === 'conocida', 'Alt+K marca como conocidas las palabras seleccionadas', await estadoDe('吾輩'));
  await p.keyboard.press('Alt+KeyU');
  await p.waitForTimeout(900);
  comprobar((await estadoDe('吾輩')) === 'desconocida', 'Alt+U las devuelve a desconocidas', await estadoDe('吾輩'));

  await p.keyboard.press('e');
  await esperarEn(pagApp, () => document.body.innerText.includes('吾輩は猫である'), undefined, 6000);
  comprobar(await pagApp.evaluate(() => document.body.innerText.includes('吾輩は猫である')), 'E envía la frase seleccionada al creador');
  await p.bringToFront();

  await p.evaluate(() => getSelection().removeAllRanges());
  const cajaFoto = await p.evaluate(() => {
    const r = document.querySelector('#foto').getBoundingClientRect();
    return { x: r.left + 30, y: r.top + 30 };
  });
  await p.mouse.move(cajaFoto.x, cajaFoto.y);
  await p.waitForTimeout(200);
  const imagenesAntes = await pagApp.evaluate(() => document.querySelectorAll('img').length);
  await p.keyboard.press('e');
  await pagApp.waitForFunction((n) => document.querySelectorAll('img').length > n, imagenesAntes, { timeout: 6000 }).catch(() => {});
  comprobar((await pagApp.evaluate(() => document.querySelectorAll('img').length)) > imagenesAntes, 'E con el ratón sobre una imagen la envía al creador');
  await p.bringToFront();
  await p.mouse.move(700, 450);

  // Modo de reproducción real: pausa automática tras la frase
  await p.evaluate(() => chrome === undefined);
  await p.evaluate(() => {
    const v = document.querySelector('#v');
    v.currentTime = 7;
  });
  await sw.evaluate(async () => {
    const d = await chrome.storage.local.get('ajustes');
    await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), modo: 'hibridoIntensivo' } });
  });
  await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector('#v').play());
  const pausa = await esperarEn(p, () => {
    const v = document.querySelector('#v');
    return v.paused && v.currentTime > 7.5;
  }, undefined, 6000);
  const t = await p.evaluate(() => document.querySelector('#v').currentTime);
  comprobar(!!pausa && t >= 7.7 && t <= 8.5, 'El modo híbrido pausa al final de la frase', `${t.toFixed(2)} s, fin 8.00`);
  await sw.evaluate(async () => {
    const d = await chrome.storage.local.get('ajustes');
    await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), modo: 'normal', navegadorAbierto: false } });
  });

  // Salto de escenas sin diálogo
  await sw.evaluate(async () => {
    const d = await chrome.storage.local.get('ajustes');
    await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), salto: '4' } });
  });
  await p.waitForTimeout(300);
  await p.evaluate(() => {
    const v = document.querySelector('#v');
    v.currentTime = 13;
    v.play();
  });
  await p.waitForTimeout(700);
  const velocidad = await p.evaluate(() => document.querySelector('#v').playbackRate);
  comprobar(velocidad === 4, 'Acelera el hueco sin diálogo', `${velocidad}x`);
  await sw.evaluate(async () => {
    const d = await chrome.storage.local.get('ajustes');
    await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), salto: 'no' } });
  });
  await p.waitForTimeout(200);
  const restaurada = await p.evaluate(() => {
    const v = document.querySelector('#v');
    v.pause();
    return v.playbackRate;
  });
  comprobar(restaurada === 1, 'Restaura la velocidad al desactivar el salto', `${restaurada}x`);

  await p.close();
  s.close();
}

// ---------- YouTube real ----------

if (quiere('youtube')) {
  console.log('\n== YouTube real ==');
  const p = await contexto.newPage();
  vigilar(p, 'youtube');
  await p.goto('https://www.youtube.com/watch?v=Jh2C7JlWGKU', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1500);
  const consent = await p.$('form[action*="consent"] button');
  if (consent) await consent.click().catch(() => {});

  await p.evaluate(() => {
    const m = document.querySelector('#movie_player');
    m?.mute?.();
    m?.playVideo?.();
  });
  const listas = await esperarEn(p, () => {
    const b = document.querySelector('kotonoha-overlay')?.shadowRoot?.querySelector('.barra-resumen')?.textContent ?? '';
    return /comprensión|Error|Sin subtítulos/i.test(b) ? b : null;
  }, undefined, 100000);
  const resumen = listas ? await listas.jsonValue() : null;
  console.log('  barra:', resumen);
  comprobar(/comprensión/i.test(resumen ?? ''), 'Carga los subtítulos reales de YouTube y calcula la comprensión', resumen);

  const conSub = await esperarEn(p, () => document.querySelector('kotonoha-overlay')?.shadowRoot?.querySelector('.linea-sub.objetivo .pal') != null, undefined, 45000);
  comprobar(!!conSub, 'Muestra la línea activa sobre el video');
  const d = await p.evaluate(() => {
    const r = document.querySelector('kotonoha-overlay').shadowRoot;
    return {
      obj: r.querySelector('.linea-sub.objetivo')?.textContent?.slice(0, 40),
      sec: r.querySelector('.linea-sub.secundaria')?.textContent?.slice(0, 40),
      nativos: [...document.querySelectorAll('.ytp-caption-segment')].filter((e) => e.offsetParent).length,
    };
  });
  console.log('  línea:', JSON.stringify(d));
  comprobar(d.nativos === 0, 'Los subtítulos nativos están ocultos');
  await p.screenshot({ path: join(CAPTURAS, 'youtube.png') });

  await p.keyboard.press('g');
  await p.waitForTimeout(1500);
  const n = await p.evaluate(() => document.querySelector('kotonoha-overlay').shadowRoot.querySelectorAll('.nav-linea').length);
  comprobar(n > 20, 'El navegador lista las líneas del video', String(n));
  const rects = await p.evaluate(() => {
    const v = document.querySelector('video').getBoundingClientRect();
    const a = document.querySelector('kotonoha-overlay').shadowRoot.querySelector('.navegador').getBoundingClientRect();
    return { videoDer: v.right, navIzq: a.left };
  });
  comprobar(rects.videoDer <= rects.navIzq + 2, 'El video deja sitio al navegador', JSON.stringify(rects));
  await p.screenshot({ path: join(CAPTURAS, 'youtube-navegador.png') });
  await p.keyboard.press('g');
  await p.close();
}

if (errores.length) {
  console.log('\nErrores de consola:');
  for (const e of [...new Set(errores)].slice(0, 20)) console.log(' -', e);
}

writeFileSync(join(CAPTURAS, 'ultimo.txt'), new Date().toISOString());
console.log(`\n${fallos ? `${fallos} comprobaciones fallaron` : 'Todas las comprobaciones pasaron'}`);
await contexto.close();
process.exit(fallos ? 1 : 0);
