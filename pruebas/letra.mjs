// Colocar la letra de una canción sobre los tiempos de una transcripción. Sin argumentos usa una pista automática, y se
// comprueba sin tarjeta gráfica; con una muestra de voz en inglés, hace todo el camino con Whisper de verdad.
// Las letras de esta prueba son inventadas: en este repositorio no entra ninguna de verdad.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/letra.mjs [voz.wav [en|ja]]

import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { olvidarReproductor, recargarExtension } from './extension.mjs';
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
// Otra canción, que el reconocedor oye entera: el estribillo (los versos 2 y 3) suena dos veces. Las letras que se pegan
// lo escriben una sola vez, sin marcas o con su título donde se repite.
const ID2 = 'cancion2';
const VERSOS2 = ['春の海を渡る風', '夏の空に咲く花火', '秋の森で眠る鳥', '冬の街に灯る窓'];
const OIDO2 = [
  [1000, 4000, '春の海を渡る風'],
  [5000, 8000, '夏の空に咲く花火'],
  [9000, 12000, '秋の森で眠る鳥'],
  [14000, 17000, '冬の街に灯る窓'],
  [18000, 21000, '夏の空に咲く花火'],
  [22000, 25000, '秋の森で眠る鳥'],
];
const LETRA_CORTA = VERSOS2.join('\n');
const LETRA_MARCAS = `[Verse]\n${VERSOS2[0]}\n\n[サビ]\n${VERSOS2[1]}\n${VERSOS2[2]}\n\n[Verse 2]\n${VERSOS2[3]}\n\n[サビ]`;
const json3Por = { [ID]: json3, [ID2]: JSON.stringify({ events: OIDO2.map(([a, b, t]) => ({ tStartMs: a, dDurationMs: b - a, segs: [{ utf8: t }] })) }) };
const ES = JSON.stringify({ events: OIDO.map(([a, b], i) => ({ tStartMs: a, dDurationMs: b - a, segs: [{ utf8: `Línea oída ${i + 1}` }] })) });

const pagina = (ID) => `<!doctype html><html lang="ja"><meta charset="utf-8"><title>夜の川 - YouTube</title>
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
  args: ['--mute-audio', `--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--autoplay-policy=no-user-gesture-required', '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'],
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
  if (u.pathname.includes('/api/timedtext')) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: u.searchParams.get('lang') === 'es' ? ES : (json3Por[u.searchParams.get('v')] ?? json3) });
  if (u.pathname === '/watch') return r.fulfill({ status: 200, contentType: 'text/html', body: pagina(u.searchParams.get('v') ?? ID) });
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
      t.objectStore('generados').delete('cancion2|ja|letra');
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
/** Deja un archivo de este equipo en una caché del navegador, con la dirección de la que lo bajaría la extensión. */
async function guardarEnCache(pagina, cache, url, archivo) {
  const servidor = await new Promise((ok) => {
    const s = createServer((_, res) => {
      res.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': statSync(archivo).size, 'access-control-allow-origin': '*' });
      createReadStream(archivo).pipe(res);
    });
    s.listen(0, '127.0.0.1', () => ok(s));
  });
  await pagina.evaluate(
    async ([desde, cache, url]) => {
      const resp = await fetch(desde);
      await (await caches.open(cache)).put(url, new Response(resp.body, { headers: { 'content-type': 'application/octet-stream', 'content-length': resp.headers.get('content-length') } }));
    },
    [`http://127.0.0.1:${servidor.address().port}/modelo.onnx`, cache, url]
  );
  servidor.close();
}

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
  // «Traducir al…» la primera vez, «Volver a traducir al…» con una traducción ya hecha.
  await enOverlay(p, (r) => [...r.querySelectorAll('.panel-generar button')].find((b) => /traducir al/i.test(b.textContent))?.click());
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

// Casa con lo que se oyó (川 por 皮, 私 por 僕): se coloca letra a letra, sin preguntar a Claude.
comprobar(pedidasLetra().length === 0, 'Casa con lo que se oyó: la coloca sin preguntar a Claude', pedidasLetra().length);

const guardadas = await motor('subtitulosGenerados', ID);
const fila = guardadas.find((g) => g.origen === 'letra');
comprobar(!!fila, 'Queda guardada para este video');
const textos = fila?.lineas.map((l) => l.texto) ?? [];
comprobar(textos.join('|') === '夜の川を歩いて|月が私を見ている|朝はまだ来ないの|月が私を見ている', 'Las palabras son las de la letra, tal cual', textos.join(' | '));
comprobar(!textos.includes('[サビ]'), 'Sin lo que no se canta');
const cerca = (k, ms) => Math.abs((fila?.lineas[k]?.inicio ?? -1e9) - ms) <= 150;
comprobar(cerca(0, 2000), 'Los tiempos, los de lo que se oyó', fila?.lineas.map((l) => `${l.inicio}-${l.fin}`).join(' '));
comprobar(cerca(2, 14000), 'Se salta lo que el reconocedor se inventó en el pasaje instrumental');
comprobar(cerca(3, 18000), 'Y un verso repetido suena en su sitio');
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
comprobar(pedidasLetra().length === 0, 'Ajustar otra vez lo mismo tampoco pregunta a nadie', pedidasLetra().length);
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
comprobar(pedidasLetra().length === 0, 'Sin preguntar nada');
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
comprobar(pedidasLetra().length === antes + 1, 'Una letra que no casa con lo que se oye se le pregunta a Claude');
const pedida = pedidasLetra().at(-1);
comprobar(pedida?.cuerpo.model === 'claude-sonnet-5-5', 'A Sonnet, como las demás tareas de subtítulos', pedida?.cuerpo.model);
const sistema = JSON.stringify(pedida?.cuerpo.system ?? '');
comprobar(sistema.includes('Colocas la letra') && sistema.includes('japonesa'), 'Con la instrucción de su lengua');
const usuario = pedida?.cuerpo.messages?.[0]?.content ?? '';
comprobar(usuario.includes('2 [10.0-12.0] ご視聴ありがとうございました'), 'Lleva lo que se oyó con sus tiempos');
comprobar(usuario.includes('zzz inventado'), 'Y la letra');
comprobar(/no encontró esta letra/.test(await avisos(p)), 'Y lo dice en lugar de inventarse una pista', await avisos(p));
comprobar((await lineaEn(p, 7)) === '月が私を見ている', 'La pista de antes sigue intacta');
await p.close();

// ---------- Una letra que escribe el estribillo una vez ----------

console.log('\n== Una letra que escribe el estribillo una vez ==');
{
  const q = await contexto.newPage();
  q.on('pageerror', (e) => errores.push(`letra corta: ${e.message}`));
  await q.goto(`https://www.youtube.com/watch?v=${ID2}`);
  await hasta(q, (r) => r.querySelector('.barra') != null, undefined, 30000);
  await hasta(q, (r) => r.querySelectorAll('.nav-linea').length === 6, undefined, 30000);
  const colocar = async (letra) => {
    await abrirGenerar(q);
    await enOverlay(q, (r) => [...r.querySelectorAll('.aviso')].forEach((x) => x.remove()));
    await q.locator('kotonoha-overlay textarea[aria-label="Letra de la canción"]').fill(letra);
    await q.locator('kotonoha-overlay .panel-generar button', { hasText: 'Ajustar la letra a estos tiempos' }).click();
    await hasta(q, (r) => [...r.querySelectorAll('.aviso')].some((x) => /Letra ajustada/.test(x.textContent)), undefined, 20000);
    const fila = (await motor('subtitulosGenerados', ID2)).find((g) => g.origen === 'letra');
    return { textos: fila?.lineas.map((l) => l.texto) ?? [], inicios: fila?.lineas.map((l) => l.inicio) ?? [], aviso: await avisos(q) };
  };
  const pedidasAntes = pedidasLetra().length;
  const esperado = [...VERSOS2, VERSOS2[1], VERSOS2[2]];
  const enSuSitio = (inicios) => inicios.length === 6 && inicios.every((t, k) => Math.abs(t - OIDO2[k][0]) <= 150);
  const corta = await colocar(LETRA_CORTA);
  comprobar(corta.textos.join('|') === esperado.join('|'), 'Sin marcas: el estribillo sale las dos veces que se oye', corta.textos.join(' | '));
  comprobar(enSuSitio(corta.inicios), 'Cada vez en su sitio', corta.inicios.join(' '));
  comprobar(/2 se repiten donde la letra no los volvía a escribir/.test(corta.aviso), 'Y el aviso lo dice', corta.aviso);
  const marcas = await colocar(LETRA_MARCAS);
  comprobar(marcas.textos.join('|') === esperado.join('|'), 'Con su título donde se repite, igual, y sin los títulos', marcas.textos.join(' | '));
  comprobar(enSuSitio(marcas.inicios), 'También en su sitio', marcas.inicios.join(' '));
  comprobar(!/se repiten donde la letra/.test(marcas.aviso), 'Ahí la letra ya decía dónde: no hay nada que avisar', marcas.aviso);
  comprobar(pedidasLetra().length === pedidasAntes, 'Las dos, sin preguntar a Claude', pedidasLetra().length - pedidasAntes);
  await q.close();
}

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
  // Sin Demucs, para ver cómo se ofrece: una ejecución anterior lo dejaría guardado. narabas, en cambio, se deja en el
  // perfil desde este equipo (1,26 GB), con la dirección de la que se baja: así se coloca con la voz sin bajarlo.
  await app.evaluate(() => caches.delete('kotonoha-modelo-voz'));
  const NARABAS = join(RAIZ, 'contenido-de-prueba', 'modelos', 'narabas-v0.onnx');
  if (existsSync(NARABAS) && !(await app.evaluate(async () => !!(await (await caches.open('kotonoha-modelo-moras')).match('https://github.com/darashi/narabas-models/releases/download/v0/narabas-v0.onnx'))))) {
    await guardarEnCache(app, 'kotonoha-modelo-moras', 'https://github.com/darashi/narabas-models/releases/download/v0/narabas-v0.onnx', NARABAS);
  }
  const correccionesAntes =mock.peticiones.filter((x) => x.cuerpo.output_config?.format?.schema?.properties?.correcciones).length;
  const letraAntes = pedidasLetra().length;
  const r = await contexto.newPage();
  r.on('pageerror', (e) => errores.push(`reproductor: ${e.message}`));
  await r.goto(`chrome-extension://${id}/app.html#/reproductor`);
  await olvidarReproductor(r);
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
  // Con la voz (si narabas está en el disco) o letra a letra: Claude solo si apenas casa.
  let colocada = false;
  while (Date.now() < limite && !colocada) {
    await r.waitForTimeout(500);
    colocada = await r.evaluate(() => [...document.querySelectorAll('.aviso')].some((x) => /Letra ajustada|Letra colocada con la voz/.test(x.textContent)));
  }
  clearInterval(vigia);
  comprobar(colocada, 'Al terminar de transcribir, la ajusta sola', String(pedidasLetra().length - letraAntes));
  if (modeloEnDisco) comprobar(!dijoDescargando, 'No dice que descarga un modelo que ya tiene guardado');
  console.log(`  en ${Math.round((Date.now() - inicio) / 1000)} s`);

  // Con narabas en el disco y sin Demucs, se ofrece aislar la voz. El modelo se sirve desde este equipo, guardado en su
  // caché con la dirección de la publicación: así no se baja de GitHub.
  const conNarabas = await r.evaluate(async () => (await caches.has('kotonoha-modelo-moras')) && (await (await caches.open('kotonoha-modelo-moras')).keys()).length > 0);
  const MODELO_DEMUCS = join(RAIZ, 'contenido-de-prueba', 'modelos', 'htdemucs_embedded.onnx');
  if (conNarabas && existsSync(MODELO_DEMUCS)) {
    const avisosAhora = await r.evaluate(() => [...document.querySelectorAll('.aviso')].map((x) => x.textContent).join(' | '));
    comprobar(/Letra colocada con la voz: \d+ versos/.test(avisosAhora), 'Con narabas, la coloca con la voz', avisosAhora);
    comprobar(/Afinar aislando la voz \(181 MB\)/.test(avisosAhora), 'Sin Demucs, ofrece aislar la voz y dice cuánto se baja', avisosAhora);
    await guardarEnCache(r, 'kotonoha-modelo-voz', 'https://github.com/Eliam4510/kotonoha/releases/download/v0.50.0/htdemucs.onnx', MODELO_DEMUCS);
    const pasos = new Set();
    const vigiaVoz = setInterval(() => r.evaluate(() => [...document.querySelectorAll('.aviso')].map((x) => x.textContent)).then((t) => t.forEach((x) => pasos.add(x.replace(/\d+ %/, '%')))).catch(() => {}), 150);
    const afinar = r.locator('.aviso button', { hasText: 'Afinar aislando la voz' });
    if (await afinar.count()) await afinar.first().click();
    let aislada = false;
    const limiteVoz = Date.now() + 180000;
    while (Date.now() < limiteVoz && !aislada) {
      await r.waitForTimeout(400);
      aislada = await r.evaluate(() => [...document.querySelectorAll('.aviso')].some((x) => /colocada con la voz aislada/.test(x.textContent)));
    }
    clearInterval(vigiaVoz);
    comprobar(aislada, 'Con Demucs, la coloca sobre la voz aislada', [...pasos].join(' → '));
    comprobar([...pasos].some((x) => /Aislando la voz de la canción/.test(x)), 'Mientras, dice que aísla la voz');
    // Lo que sigue lee la letra colocada sobre la voz aislada.
  } else {
    console.log(`  sin probar Demucs: ${conNarabas ? 'falta el modelo en contenido-de-prueba/modelos' : 'narabas no está en este perfil'}`);
  }
  await r.waitForFunction(() => !document.querySelector('.panel-generar textarea')?.value, undefined, { timeout: 20000 }).catch(() => {});
  await r.waitForTimeout(1200);
  comprobar(mock.peticiones.filter((x) => x.cuerpo.output_config?.format?.schema?.properties?.correcciones).length === correccionesAntes, 'No se paga por corregir lo que oyó Whisper');
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
