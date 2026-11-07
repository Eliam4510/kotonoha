// Colocar la letra de una canción sobre los tiempos de una transcripción. Sin argumentos usa una pista automática, y se
// comprueba sin tarjeta gráfica; con una muestra de voz en inglés, hace todo el camino con Whisper de verdad.
// Las letras de esta prueba son inventadas: en este repositorio no entra ninguna de verdad.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/letra.mjs [voz.wav [en|ja]]

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';
import { iniciarMock } from './mock-claude.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-local'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'letra');
const FFMPEG = existsSync('C:/ffmpeg/bin/ffmpeg.exe') ? 'C:/ffmpeg/bin/ffmpeg.exe' : 'ffmpeg';
const voz = process.argv[2];
const lenguaVoz = process.argv[3] ?? 'en';
mkdirSync(CAPTURAS, { recursive: true });

// La letra verdadera de cada muestra de voz, con otro corte de versos que el que dará Whisper y marcas que no se cantan.
const MUESTRAS = {
  en: {
    base: 'kikitori-en',
    instruccion: 'en inglés',
    verso: 'The old library in our town has finally reopened after two years of work.',
    letra: `[Verse 1]
The old library in our town has finally reopened after two years of work.
Many visitors were looking forward to it,
and some of them picked up a book on the very first day.

[Chorus]
The librarian said that she did not expect so many people.`,
  },
  ja: {
    base: 'kikitori',
    instruccion: 'japonesa',
    verso: '今日はゆっくり休みましょう。自分のペースで進めば大丈夫です。',
    letra: `[Verse 1]
今日はゆっくり休みましょう。自分のペースで進めば大丈夫です。
一日に少しずつ勉強しましょう。

[Chorus]
疲れたら休んでください。
無理のないペースで続けましょう。`,
  },
};

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};

const ID = 'cancion1';
// Lo que oyó el reconocedor: tiempos buenos, palabras malas, y una frase que se inventa en el pasaje instrumental.
const OIDO = [
  [2000, 5000, '夜の皮を歩いて'],
  [6000, 9000, '月が僕を見ている'],
  [10000, 12000, 'ご視聴ありがとうございました'],
  [14000, 17000, '朝はまだ来ない'],
  [18000, 21000, '月が僕を見ている'],
];
const LETRA = `[サビ]

夜の川を歩いて
月が私を見ている

0:14 朝はまだ来ないの
月が私を見ている

♪♪♪`;
const json3 = JSON.stringify({ events: OIDO.map(([a, b, t]) => ({ tStartMs: a, dDurationMs: b - a, segs: [{ utf8: t }] })) });
const ES = JSON.stringify({ events: OIDO.map(([a, b], i) => ({ tStartMs: a, dDurationMs: b - a, segs: [{ utf8: `Línea oída ${i + 1}` }] })) });

const PAGINA = `<!doctype html><html lang="ja"><meta charset="utf-8"><title>夜の川 - YouTube</title>
<body style="margin:0;background:#0f0f0f;color:#fff;font-family:sans-serif">
<div style="height:56px"></div>
<div id="movie_player" style="position:relative;width:1280px;height:600px;margin:0 auto;background:#000"><video id="v" src="https://media.test/video.webm" muted style="width:100%;height:100%"></video></div>
<script>
  const pistas = [
    { languageCode: 'ja', kind: 'asr', vssId: 'a.ja', name: { simpleText: '日本語 (自動生成)' } },
  ].map((t) => ({ ...t, baseUrl: 'https://www.youtube.com/api/timedtext?v=${ID}&lang=' + t.languageCode, url: 'https://www.youtube.com/api/timedtext?v=${ID}&pot=x&lang=' + t.languageCode }));
  const j = document.getElementById('movie_player');
  const v = document.getElementById('v');
  j.getPlayerResponse = () => ({ videoDetails: { videoId: '${ID}', title: '夜の川' }, captions: { playerCaptionsTracklistRenderer: { captionTracks: pistas } } });
  j.getAudioTrack = () => ({ captionTracks: pistas });
  j.getVideoData = () => ({ video_id: '${ID}', title: '夜の川' });
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
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--autoplay-policy=no-user-gesture-required', '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'],
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
  if (u.pathname === '/watch') return r.fulfill({ status: 200, contentType: 'text/html', body: PAGINA });
  return r.fulfill({ status: 204 });
});

const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
for (const pg of contexto.pages()) if (pg.url().includes('app.html')) await pg.close();
const ponerAjustes = (cambios) => sw.evaluate(async (cambios) => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), ...cambios } });
}, cambios);
await sw.evaluate(async (url) => { await chrome.storage.local.set({ urlBaseIA: url, claveAnthropic: 'clave-de-prueba' }); }, `http://127.0.0.1:${mock.puerto}`);
await ponerAjustes({ idiomaInterfaz: 'es', bienvenidaVista: true, destino: 'memoria', ankiPuerto: 1, modo: 'normal', salto: 'no', navegadorAbierto: false, subsPosicion: null, corregirAutomaticos: false, analisisAutomatico: false, whisperModelo: 'turbo', whisperCorregir: true, idiomaSecundario: 'es', idiomaTraduccion: 'español', generarSecundariosAuto: false });

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
const selectorLengua = app.locator('select[aria-label="Idioma que estudias"]');
const lenguaInicial = (await selectorLengua.count()) ? await selectorLengua.inputValue() : 'ja';
if (lenguaInicial !== 'ja') {
  await selectorLengua.selectOption('ja');
  await app.waitForTimeout(800);
}
const pedidasLetra = () => mock.peticiones.filter((x) => x.cuerpo.output_config?.format?.schema?.properties?.ajuste);
// Lo de una ejecución anterior no debe contar: cada vez se empieza sin esa pista guardada.
await app.evaluate(async (ID) => {
  await new Promise((ok) => {
    const abrir = indexedDB.open('kikitori');
    abrir.onsuccess = () => {
      const t = abrir.result.transaction(['generados', 'cacheIA'], 'readwrite');
      t.objectStore('generados').delete(`${ID}|ja|letra`);
      t.objectStore('generados').delete(`${ID}|es`);
      t.objectStore('cacheIA').clear();
      t.oncomplete = () => ok();
    };
  });
}, ID).catch((e) => console.log('sin limpiar:', e.message));

// ---------- Sobre una pista automática ----------

console.log('\n== La letra sobre una pista automática ==');
const p = await contexto.newPage();
p.on('pageerror', (e) => errores.push(`video: ${e.message}`));
await p.goto(`https://www.youtube.com/watch?v=${ID}`);
const enOverlay = (pagina, fn, arg) => pagina.evaluate(({ fn, arg }) => {
  const r = (document.querySelector('kotonoha-overlay:not([popover])') ?? document.querySelector('kotonoha-overlay'))?.shadowRoot;
  return r ? new Function('r', 'arg', `return (${fn})(r, arg)`)(r, arg) : null;
}, { fn: fn.toString(), arg });
const hasta = async (pagina, fn, arg, ms = 20000) => {
  const limite = Date.now() + ms;
  for (;;) {
    const v = await enOverlay(pagina, fn, arg).catch(() => null);
    if (v) return v;
    if (Date.now() > limite) return null;
    await pagina.waitForTimeout(80);
  }
};
const lineaEn = async (pagina, segundos) => {
  await pagina.evaluate((s) => { const v = document.querySelector('video'); v.pause(); v.currentTime = s; }, segundos);
  await pagina.waitForFunction((s) => {
    const v = document.querySelector('video');
    return !v.seeking && Math.abs(v.currentTime - s) < 0.3;
  }, segundos, { timeout: 8000 }).catch(() => {});
  await pagina.waitForTimeout(500);
  return enOverlay(pagina, (r) => {
    const l = r.querySelector('.linea-sub.objetivo');
    // La última línea se desvanece al acabar: sigue en la página un momento, pero ya no se ve.
    if (!l || l.closest('.saliendo')) return '';
    const c = l.cloneNode(true);
    c.querySelectorAll('rt, .glosa').forEach((x) => x.remove());
    return c.textContent.replaceAll('\u2060', '').trim();
  });
};
const abrirGenerar = async (pagina) => {
  await pagina.keyboard.press('Escape');
  await pagina.mouse.move(800, 2);
  await pagina.waitForTimeout(250);
  await enOverlay(pagina, (r) => r.querySelector('.barra-acciones button[aria-label="Generar subtítulos"]')?.click());
  await pagina.waitForTimeout(350);
};
const avisos = (pagina) => enOverlay(pagina, (r) => [...r.querySelectorAll('.aviso')].map((x) => x.textContent).join(' | '));

await hasta(p, (r) => r.querySelector('.barra') != null, undefined, 30000);
await p.evaluate(() => { const v = document.querySelector('video'); v.pause(); v.currentTime = 3; });
await hasta(p, (r) => r.querySelector('.linea-sub.objetivo .pal') != null, undefined, 30000);
comprobar((await lineaEn(p, 3)).includes('夜の皮を歩いて'), 'Se empieza con lo que oyó el reconocedor', await lineaEn(p, 3));
// Una traducción de lo que oyó, para comprobar luego que no se mezcla con la de la letra.
const traducirPista = async () => {
  await abrirGenerar(p);
  await enOverlay(p, (r) => [...r.querySelectorAll('.aviso')].forEach((x) => x.remove()));
  await enOverlay(p, (r) => [...r.querySelectorAll('.panel-generar button')].find((b) => b.textContent.includes('Traducir al'))?.click());
  await hasta(p, (r) => [...r.querySelectorAll('.aviso')].some((x) => /Traducción lista/.test(x.textContent)), undefined, 15000);
  return (await motor('subtitulosGenerados', ID)).find((g) => g.idioma === 'es');
};
comprobar((await traducirPista())?.lineas.length === OIDO.length, 'Se puede traducir lo que oyó el reconocedor');
await abrirGenerar(p);
const area =p.locator('kotonoha-overlay textarea[aria-label="Letra de la canción"]');
const boton = p.locator('kotonoha-overlay .panel-generar button', { hasText: 'Ajustar la letra a estos tiempos' });
comprobar(await area.count() === 1, 'El panel tiene sitio para pegar la letra');
comprobar(await boton.isDisabled(), 'Sin letra, el botón espera');
await area.fill('♪♪♪\n\n');
comprobar(await boton.isDisabled(), 'Unos adornos no son una letra');
await area.fill(LETRA);
comprobar(await boton.isEnabled(), 'Con letra, se puede ajustar');
await area.scrollIntoViewIfNeeded();
await p.screenshot({ path: join(CAPTURAS, 'panel.png') });
await boton.click();
const ajustada = await hasta(p, (r) => [...r.querySelectorAll('.aviso')].some((x) => /Letra ajustada/.test(x.textContent)), undefined, 20000);
comprobar(!!ajustada, 'Avisa al terminar', await avisos(p));

const pedida = pedidasLetra()[0];
comprobar(pedidasLetra().length === 1, 'Se le pregunta a Claude una vez', pedidasLetra().length);
comprobar(pedida?.cuerpo.model === 'claude-sonnet-5-5', 'A Sonnet, como las demás tareas de subtítulos', pedida?.cuerpo.model);
const sistema = JSON.stringify(pedida?.cuerpo.system ?? '');
comprobar(sistema.includes('Colocas la letra') && sistema.includes('japonesa'), 'Con la instrucción de su lengua');
const usuario = pedida?.cuerpo.messages?.[0]?.content ?? '';
comprobar(usuario.includes('2 [10.0-12.0] ご視聴ありがとうございました'), 'Lleva lo que se oyó con sus tiempos');
comprobar(usuario.includes('夜の川を歩いて') && !usuario.includes('♪') && !usuario.includes('0:14'), 'Y la letra, sin adornos ni marcas de tiempo');

const guardadas = await motor('subtitulosGenerados', ID);
const fila = guardadas.find((g) => g.origen === 'letra');
comprobar(!!fila, 'Queda guardada para este video');
const textos = fila?.lineas.map((l) => l.texto) ?? [];
comprobar(textos.join('|') === '夜の川を歩いて|月が私を見ている|朝はまだ来ないの|月が私を見ている', 'Las palabras son las de la letra, tal cual', textos.join(' | '));
comprobar(!textos.includes('[サビ]'), 'Sin lo que no se canta');
comprobar(fila?.lineas[0]?.inicio === 2000, 'Los tiempos, los de la transcripción', fila?.lineas.map((l) => `${l.inicio}-${l.fin}`).join(' '));
comprobar(fila?.lineas[2]?.inicio === 14000, 'Se salta lo que el reconocedor se inventó en el pasaje instrumental');
comprobar(fila?.lineas[3]?.inicio === 18000, 'Y un verso repetido suena en su sitio');
comprobar((await lineaEn(p, 3)) === '夜の川を歩いて', 'Sobre el video se ve la letra verdadera', await lineaEn(p, 3));
comprobar((await lineaEn(p, 11)) === '', 'Y nada donde no se canta', await lineaEn(p, 11));
await p.screenshot({ path: join(CAPTURAS, 'video.png') });
comprobar((await area.inputValue()) === '', 'El panel se queda listo para otra');
// La traducción que había era de lo que oyó el reconocedor: se rehace sola con la letra.
let rehecha = null;
for (let i = 0; i < 30 && !rehecha; i++) {
  const es = (await motor('subtitulosGenerados', ID)).find((g) => g.idioma === 'es');
  if (es?.lineas.length && es.lineas.every((l) => l.id >= 1_000_000)) rehecha = es;
  else await p.waitForTimeout(500);
}
comprobar(rehecha?.lineas.length === 4, 'La traducción se rehace sola con la letra', rehecha?.lineas.length);

const opciones = () => enOverlay(p, (r) => [...r.querySelectorAll('.panel-flotante select[aria-label="Subtítulos en japonés"] option')].map((o) => o.textContent));
await p.keyboard.press('Escape');
await p.mouse.move(800, 2);
await p.waitForTimeout(250);
await enOverlay(p, (r) => r.querySelector('.barra-acciones button[aria-label="Ajustes de video"]')?.click());
await p.waitForTimeout(300);
await enOverlay(p, (r) => [...r.querySelectorAll('.panel-flotante [role="tab"], .panel-flotante button')].find((b) => b.textContent.trim() === 'Subtítulos')?.click());
await p.waitForTimeout(300);
const lista = await opciones();
comprobar(lista?.some((o) => o === 'Japonés (letra)'), 'Es una pista más, y se llama como lo que es', lista?.join(' | '));
comprobar(lista?.some((o) => o.includes('automáticos')), 'La de antes sigue ahí', lista?.join(' | '));
await p.screenshot({ path: join(CAPTURAS, 'pistas.png') });

// Volver a ajustar lo mismo sale de lo guardado.
await p.locator('kotonoha-overlay select[aria-label="Subtítulos en japonés"]').selectOption({ index: lista.findIndex((o) => o.includes('automáticos')) });
await p.waitForTimeout(800);
comprobar((await lineaEn(p, 3)).includes('夜の皮を歩いて'), 'Se puede volver a la que oyó el reconocedor');
await abrirGenerar(p);
await area.fill(LETRA);
await boton.click();
await hasta(p, (r) => !r.querySelector('.panel-generar textarea')?.value, undefined, 15000);
comprobar(pedidasLetra().length === 1, 'Ajustar otra vez lo mismo no se paga dos veces', pedidasLetra().length);
comprobar((await lineaEn(p, 3)) === '夜の川を歩いて', 'Y vuelve la letra');

// Traducirla no arrastra lo traducido de la otra pista.
const traducida = await traducirPista();
comprobar(traducida?.lineas.length === 4, 'La traducción tiene una línea por verso, ni una más', traducida?.lineas.length);
comprobar(traducida?.lineas.every((l) => l.id >= 1_000_000), 'Y es de la letra, no de lo que oyó el reconocedor');

// Al volver.
await p.reload();
await hasta(p, (r) => r.querySelector('.barra') != null, undefined, 30000);
await p.waitForTimeout(1200);
comprobar((await lineaEn(p, 7)) === '月が私を見ている', 'Al volver al video, es la letra lo que se ve', await lineaEn(p, 7));
comprobar(pedidasLetra().length === 1, 'Sin preguntar nada');
const copia = JSON.parse(await motor('exportarDatos', await sw.evaluate(async () => (await chrome.storage.local.get('ajustes')).ajustes)));
comprobar((copia.lenguas?.ja ?? copia).generados.some((g) => g.origen === 'letra' && g.idVideo === ID), 'La copia de seguridad la lleva');

// Sin clave no hay nada que hacer, y se dice.
await sw.evaluate(async () => { await chrome.storage.local.remove('claveAnthropic'); });
await p.waitForTimeout(600);
await abrirGenerar(p);
await area.fill('otra letra inventada');
await boton.click();
await hasta(p, (r) => [...r.querySelectorAll('.aviso')].some((x) => /clave de la API/.test(x.textContent)), undefined, 8000);
comprobar(/clave de la API/.test(await avisos(p)), 'Sin clave de Claude, lo avisa', await avisos(p));
comprobar((await area.inputValue()) === 'otra letra inventada', 'Y la letra no se pierde');
await sw.evaluate(async (url) => { await chrome.storage.local.set({ urlBaseIA: url, claveAnthropic: 'clave-de-prueba' }); }, `http://127.0.0.1:${mock.puerto}`);
await p.waitForTimeout(600);

// Una letra que no tiene nada que ver.
const antes = pedidasLetra().length;
await area.fill('zzz inventado que no suena en ningún sitio');
await boton.click();
await hasta(p, (r) => [...r.querySelectorAll('.aviso')].some((x) => /no encontró esta letra/.test(x.textContent)), undefined, 10000);
comprobar(pedidasLetra().length === antes + 1, 'Una letra que no es de esta canción también se pregunta');
comprobar(/no encontró esta letra/.test(await avisos(p)), 'Y lo dice en lugar de inventarse una pista', await avisos(p));
comprobar((await lineaEn(p, 7)) === '月が私を見ている', 'La pista de antes sigue intacta');
await p.close();

// ---------- Con Whisper de verdad ----------

if (voz) {
  const muestra = MUESTRAS[lenguaVoz];
  console.log(`\n== Con Whisper, en ${lenguaVoz} ==`);
  const video = join(CAPTURAS, 'voz.webm');
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-stream_loop', '-1', '-i', join(RAIZ, 'pruebas', 'fixtures', 'video.webm'), '-i', voz, '-map', '0:v', '-map', '1:a', '-shortest', '-c:v', 'copy', '-c:a', 'libopus', video]);
  await app.goto(`chrome-extension://${id}/app.html#/ajustes`);
  await app.reload();
  await app.waitForTimeout(1000);
  if (lenguaVoz !== 'ja') {
    await app.locator('select[aria-label="Idioma que estudias"]').selectOption(lenguaVoz);
    await app.waitForTimeout(800);
  }
  // Una ejecución anterior dejaría ya la transcripción y la letra de este archivo.
  await app.evaluate(async (base) => {
    await new Promise((ok) => {
      const abrir = indexedDB.open(base);
      abrir.onsuccess = () => {
        const t = abrir.result.transaction(['generados', 'cacheIA'], 'readwrite');
        t.objectStore('generados').clear();
        t.objectStore('cacheIA').clear();
        t.oncomplete = () => ok();
      };
    });
  }, muestra.base);
  const correccionesAntes =mock.peticiones.filter((x) => x.cuerpo.output_config?.format?.schema?.properties?.correcciones).length;
  const letraAntes = pedidasLetra().length;
  const r = await contexto.newPage();
  r.on('pageerror', (e) => errores.push(`reproductor: ${e.message}`));
  await r.goto(`chrome-extension://${id}/app.html#/reproductor`);
  await r.waitForTimeout(1200);
  await r.setInputFiles('input[type="file"]', video);
  await r.waitForFunction(() => document.querySelector('.ap-local video')?.readyState >= 2, undefined, { timeout: 20000 });
  await r.evaluate(() => document.querySelector('.ap-local video').pause());
  await r.waitForTimeout(800);
  await r.evaluate(() => document.querySelector('button[aria-label="Generar subtítulos"], button[data-tip^="Generar subtítulos"], button[title="Generar subtítulos"]')?.click());
  await r.waitForTimeout(500);
  await r.locator('textarea[aria-label="Letra de la canción"]').fill(muestra.letra);
  const transcribir =r.locator('.panel-generar button', { hasText: 'Transcribir y ajustar la letra' });
  comprobar(await transcribir.isEnabled(), 'Sin tiempos todavía, ofrece transcribir primero');
  // Con el modelo ya guardado, leerlo del disco no es descargarlo.
  const modeloEnDisco = await r.evaluate(async () => (await (await caches.open('transformers-cache')).keys()).some((k) => k.url.includes('whisper-large-v3-turbo') && k.url.includes('encoder_model_fp16.onnx')));
  let dijoDescargando = false;
  const vigia = setInterval(() => r.evaluate(() => /Descargando/.test(document.body.innerText)).then((si) => { dijoDescargando ||= si; }).catch(() => {}), 150);
  const inicio = Date.now();
  await transcribir.click();
  const leerEn = async (s) => {
    await r.evaluate((s) => { const v = document.querySelector('.ap-local video'); v.pause(); v.currentTime = s; }, s);
    await r.waitForTimeout(300);
    return r.evaluate(() => {
      const l = document.querySelector('.linea-sub.objetivo');
      if (!l) return '';
      const c = l.cloneNode(true);
      c.querySelectorAll('rt, .glosa').forEach((x) => x.remove());
      return c.textContent.replaceAll('\u2060', '').trim();
    });
  };
  await r.waitForTimeout(1500);
  comprobar(await r.evaluate(() => [...document.querySelectorAll('.panel-generar .nota-grupo')].some((x) => /se ajustará sola/.test(x.textContent))), 'Mientras transcribe, dice que la ajustará al terminar');
  await r.screenshot({ path: join(CAPTURAS, 'esperando.png') });
  const limite = Date.now() + 420000;
  while (Date.now() < limite && pedidasLetra().length === letraAntes) await r.waitForTimeout(500);
  clearInterval(vigia);
  comprobar(pedidasLetra().length === letraAntes + 1, 'Al terminar de transcribir, la ajusta sola');
  if (modeloEnDisco) comprobar(!dijoDescargando, 'No dice que descarga un modelo que ya tiene guardado');
  console.log(`  en ${Math.round((Date.now() - inicio) / 1000)} s`);
  await r.waitForFunction(() => !document.querySelector('.panel-generar textarea')?.value, undefined, { timeout: 20000 }).catch(() => {});
  await r.waitForTimeout(1200);
  comprobar(mock.peticiones.filter((x) => x.cuerpo.output_config?.format?.schema?.properties?.correcciones).length === correccionesAntes, 'No se paga por corregir lo que oyó Whisper');
  const pedidaEn = pedidasLetra().at(-1);
  comprobar(JSON.stringify(pedidaEn?.cuerpo.system ?? '').includes(muestra.instruccion), 'Con la instrucción de su lengua');
  const claves = await r.evaluate(() => document.querySelector('.ap-local video').duration);
  const vistas = [];
  for (let s = 0.5; s < Math.min(claves, 26); s += 1) {
    const l = await leerEn(s);
    if (l && vistas[vistas.length - 1] !== l) vistas.push(l);
  }
  console.log('  líneas:');
  for (const l of vistas) console.log(`    ${l}`);
  comprobar(vistas.includes(muestra.verso), 'Un verso que Whisper partió en varias líneas se ve entero', vistas[0]);
  comprobar(!vistas.some((l) => /Verse 1|Chorus/.test(l)), 'Sin las marcas de la letra');
  await r.screenshot({ path: join(CAPTURAS, 'whisper.png') });
  await r.close();
  if (lenguaVoz !== 'ja') {
    await app.goto(`chrome-extension://${id}/app.html#/ajustes`);
    await app.reload();
    await app.waitForTimeout(800);
    await app.locator('select[aria-label="Idioma que estudias"]').selectOption(lenguaInicial);
    await app.waitForTimeout(500);
  }
}

if (errores.length) console.log('Errores de página:', errores.slice(0, 8).join('\n'));
comprobar(!errores.length, 'Ningún error de página', errores.length);
console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien');
await contexto.close();
process.exit(fallos ? 1 : 0);
