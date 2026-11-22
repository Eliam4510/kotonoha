// Bilibili con páginas imitadas, hechas con lo que su reproductor da de verdad (window.player.getManifest(), la API
// x/player/wbi/v2 y el JSON de subtítulos de su CDN, que responde con Access-Control-Allow-Origin: *): sus pistas, la del
// autor antes que la de su IA, el nombre del video sin lo que añade la página, el título original aunque la página esté
// traducida, sus subtítulos ocultos, saltar con su reproductor, otra parte sin recargar, un episodio de bangumi, una
// canción por su zona y el aviso sin la sesión iniciada.
// Uso: KK_SALIDA=.dist-bili node build.mjs && node pruebas/bilibili.mjs

import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';
import { iniciarMock } from './mock-claude.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-bili'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-bilibili'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'bilibili');
mkdirSync(CAPTURAS, { recursive: true });

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};

const BV = 'BV1kk4y1c7Ts';
const BV_MUSICA = 'BV1Mx4y1c7Mu';
const EP = 779775;
/** Los subtítulos de cada parte (por su cid): el del autor, en zh-CN, y el de la IA, en ai-zh. */
const LINEAS = {
  2001: { autor: ['我们今天去银行取钱。', '天气越来越冷了。'], ia: ['我们今天去银行取钱', '天气越来越冷了'] },
  2002: { autor: ['第二部分开始了。', '你明天有空吗？'], ia: ['第二部分开始了', '你明天有空吗'] },
  3001: { autor: ['我想唱一首歌。'], ia: ['我想唱一首歌'] },
  4001: { autor: [], ia: ['冒险结束了。', '我们回家吧。'] },
};
const jsonSubtitulos = (lineas) => JSON.stringify({ font_size: 0.4, lang: 'zh', version: 'v1.6', body: lineas.map((t, i) => ({ from: 0.5 + i * 3, to: 3.3 + i * 3, sid: i + 1, location: 2, content: t, music: 0 })) });

/** La página de un video o de un episodio, con el reproductor de Bilibili imitado sobre un <video>. */
const pagina = ({ titulo, manifiesto }) => `<!doctype html><html lang="zh-Hans"><meta charset="utf-8"><title>${titulo}</title>
<body style="margin:0;background:#f1f2f3;font-family:sans-serif">
<div id="playerWrap" class="player-wrap" style="width:1280px;height:640px;margin:30px auto 0">
  <div id="bilibili-player" style="width:100%;height:100%">
    <div class="bpx-player-container" data-screen="normal" data-locale="es" style="position:relative;width:100%;height:100%;background:#000">
      <div class="bpx-player-primary-area" style="width:100%;height:100%"><div class="bpx-player-video-area" style="width:100%;height:100%">
        <div class="bpx-player-video-perch" style="width:100%;height:100%"><div class="bpx-player-video-wrap" style="width:100%;height:100%">
          <video id="v" src="https://media.test/video.webm" muted style="width:100%;height:100%"></video>
        </div></div>
        <div class="bpx-player-subtitle-wrap" style="position:absolute;left:0;right:0;bottom:60px;text-align:center;color:#fff;font-size:26px">原生字幕</div>
      </div></div>
    </div>
  </div>
</div>
<script>
  const v = document.getElementById('v');
  window.__llamadas = [];
  window.player = {
    getManifest: ${manifiesto},
    seek: (t) => { window.__llamadas.push('seek:' + Math.round(t)); v.currentTime = t; },
    play: () => { window.__llamadas.push('play'); return v.play(); },
    pause: () => { window.__llamadas.push('pause'); v.pause(); },
    getCurrentTime: () => v.currentTime,
  };
</script>`;

const PAGINA_VIDEO = pagina({
  // Bilibili traduce la página al idioma de quien la ve: su título no es el original.
  titulo: 'Un día en Pekín_Vlog',
  manifiesto: `() => { const p = Number(new URL(location.href).searchParams.get('p') || 1); return { aid: 1001, bvid: '${BV}', cid: p === 2 ? 2002 : 2001, p, episodeId: null, seasonId: null }; }`,
});
const PAGINA_MUSICA = pagina({ titulo: '我想唱一首歌_哔哩哔哩_bilibili', manifiesto: `() => ({ aid: 1003, bvid: '${BV_MUSICA}', cid: 3001, p: 1, episodeId: null, seasonId: null })` });
const PAGINA_EPISODIO = pagina({
  titulo: '葬送的芙莉莲-番剧-全集-高清正版在线观看-bilibili-哔哩哔哩',
  manifiesto: `() => ({ aid: 450096728, bvid: 'BV18j411i7iu', cid: 4001, p: 1, episodeId: ${EP}, seasonId: 46089 })`,
});

const mock = await iniciarMock();
const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1600, height: 900 },
  args: ['--mute-audio', `--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--autoplay-policy=no-user-gesture-required'],
});
const bytesVideo = readFileSync(join(RAIZ, 'pruebas', 'fixtures', 'video.webm'));
await contexto.route('https://media.test/**', (r) => {
  const rango = /bytes=(\d+)-(\d*)/.exec(r.request().headers().range ?? '');
  if (!rango) return r.fulfill({ status: 200, body: bytesVideo, headers: { 'content-type': 'video/webm', 'accept-ranges': 'bytes' } });
  const desde = Number(rango[1]);
  const hasta = rango[2] ? Number(rango[2]) : bytesVideo.length - 1;
  return r.fulfill({ status: 206, body: bytesVideo.subarray(desde, hasta + 1), headers: { 'content-type': 'video/webm', 'accept-ranges': 'bytes', 'content-range': `bytes ${desde}-${hasta}/${bytesVideo.length}` } });
});
await contexto.route('https://www.bilibili.com/**', (r) => {
  const u = new URL(r.request().url());
  const html = u.pathname.startsWith(`/video/${BV}`) ? PAGINA_VIDEO : u.pathname.startsWith(`/video/${BV_MUSICA}`) ? PAGINA_MUSICA : u.pathname.startsWith(`/bangumi/play/ep${EP}`) ? PAGINA_EPISODIO : null;
  return html ? r.fulfill({ status: 200, contentType: 'text/html', body: html }) : r.fulfill({ status: 204 });
});
/** Las peticiones a la API, con lo que llevaban: si la sesión (la cookie) fue con ellas y con qué parámetros. */
const peticiones = [];
await contexto.route('https://api.bilibili.com/**', (r) => {
  const u = new URL(r.request().url());
  const conSesion = /SESSDATA=prueba/.test(r.request().headers().cookie ?? '');
  peticiones.push({ ruta: u.pathname, q: Object.fromEntries(u.searchParams), conSesion });
  const responder = (cuerpo) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': 'https://www.bilibili.com', 'access-control-allow-credentials': 'true' }, body: JSON.stringify(cuerpo) });
  if (u.pathname === '/x/player/wbi/v2' || u.pathname === '/x/player/v2') {
    const cid = Number(u.searchParams.get('cid'));
    const l = LINEAS[cid];
    const subtitulos = !conSesion || !l ? [] : [
      ...(l.autor.length ? [{ id: cid * 10, id_str: `${cid}0`, lan: 'zh-CN', lan_doc: '中文（中国）', is_lock: false, subtitle_url: `//i0.hdslb.com/bfs/subtitle/${cid}-autor.json`, type: 0 }] : []),
      { id: cid * 10 + 1, id_str: `${cid}1`, lan: 'ai-zh', lan_doc: '中文', is_lock: false, subtitle_url: `//aisubtitle.hdslb.com/bfs/ai_subtitle/prod/${cid}-ia?auth_key=prueba`, type: 1, ai_type: 0, ai_status: 2 },
    ];
    return responder({ code: 0, message: '0', data: { need_login_subtitle: !conSesion, subtitle: { allow_submit: false, lan: '', lan_doc: '', subtitles: subtitulos } } });
  }
  if (u.pathname === '/x/web-interface/view') {
    const musica = u.searchParams.get('bvid') === BV_MUSICA;
    const data = musica
      ? { bvid: BV_MUSICA, title: '我想唱一首歌', tid: 31, pic: 'http://i0.hdslb.com/bfs/archive/musica.jpg', pages: [{ cid: 3001, page: 1, part: '我想唱一首歌' }] }
      : { bvid: BV, title: '北京一日游', tid: 171, pic: 'http://i0.hdslb.com/bfs/archive/portada.jpg', pages: [{ cid: 2001, page: 1, part: '上午' }, { cid: 2002, page: 2, part: '下午' }] };
    return responder({ code: 0, message: '0', data });
  }
  if (u.pathname === '/pgc/view/web/season') {
    return responder({ code: 0, message: 'success', result: { title: '葬送的芙莉莲', cover: 'http://i0.hdslb.com/bfs/bangumi/portada.jpg', episodes: [{ ep_id: EP, aid: 450096728, cid: 4001, title: '1', long_title: '冒险的结束' }] } });
  }
  return responder({ code: -404, message: '啥都木有' });
});
// Su CDN responde a cualquiera, sin cookies: con ellas, el navegador rechazaría la respuesta.
await contexto.route(/https:\/\/(i0|aisubtitle)\.hdslb\.com\/.*/, (r) => {
  const u = new URL(r.request().url());
  const m = /\/(\d+)-(autor|ia)/.exec(u.pathname);
  if (!m) return r.fulfill({ status: 404 });
  const l = LINEAS[Number(m[1])];
  return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: jsonSubtitulos(m[2] === 'autor' ? l.autor : l.ia) });
});

const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
for (const pg of contexto.pages()) if (pg.url().includes('app.html')) await pg.close();
await sw.evaluate(async (url) => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ urlBaseIA: url, claveAnthropic: 'clave-de-prueba', ajustes: { ...(d.ajustes ?? {}), idiomaInterfaz: 'es', idiomaObjetivo: 'zh', bienvenidaVista: true, avisarVersiones: false, destino: 'memoria', ankiPuerto: 1, modo: 'normal', salto: 'no', navegadorAbierto: false, subsPosicion: null, idiomaSecundario: 'es', generarSecundariosAuto: false } });
}, `http://127.0.0.1:${mock.puerto}`);
await contexto.addCookies([{ name: 'SESSDATA', value: 'prueba', domain: '.bilibili.com', path: '/', secure: true, httpOnly: true, sameSite: 'None' }]);
const errores = [];

/** Abre una página de Bilibili y espera a Kotonoha sobre su video. */
async function abrir(url) {
  const p = await contexto.newPage();
  p.on('pageerror', (e) => errores.push(`${url}: ${e.message}`));
  await p.goto(url);
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
      await p.waitForTimeout(100);
    }
  };
  /** Una orden al adaptador de la página, como las da el content script. */
  const orden = (nombre, ...args) =>
    p.evaluate(
      ({ nombre, args }) =>
        new Promise((ok) => {
          const n = Math.random();
          const oir = (e) => {
            if (e.data?.fuente !== 'kotonoha-pagina' || e.data.id !== n) return;
            window.removeEventListener('message', oir);
            ok(e.data.ok ? e.data.valor : { error: e.data.error });
          };
          window.addEventListener('message', oir);
          window.postMessage({ fuente: 'kotonoha-contenido', id: n, orden: nombre, args }, '*');
        }),
      { nombre, args }
    );
  await hasta((r) => r.querySelector('.barra') != null, undefined, 30000);
  await p.evaluate(() => { const v = document.querySelector('#v'); v.pause(); v.currentTime = 1; });
  return { p, enOverlay, hasta, orden };
}
const textoLinea = (r) => {
  const l = r.querySelector('.linea-sub.objetivo');
  if (!l) return '';
  const c = l.cloneNode(true);
  c.querySelectorAll('rt, .glosa').forEach((x) => x.remove());
  return c.textContent.replace(/⁠/g, '');
};

// ---------- Un video ----------

console.log('\n== Un video, con la sesión iniciada ==');
{
  const { p, enOverlay, hasta, orden } = await abrir(`https://www.bilibili.com/video/${BV}/?spm_id_from=333.1007.tianma.1-1-1.click&vd_source=4bdfb47109`);
  const info = await orden('info');
  console.log('  ', JSON.stringify(info));
  comprobar(info.sitio === 'bilibili', 'Bilibili tiene su adaptador', info.sitio);
  comprobar(info.idVideo === BV, 'El video se nombra por su BV, sin lo que añade la página', info.idVideo);
  const pistas = await orden('listarPistas');
  console.log('  ', JSON.stringify(pistas));
  comprobar(pistas.length === 2 && pistas.some((x) => x.idioma === 'zh-cn' && !x.automatica) && pistas.some((x) => x.idioma === 'zh' && x.automatica), 'Sus dos pistas: la del autor y la de su IA, marcada como automática y en chino', JSON.stringify(pistas.map((x) => [x.idioma, x.automatica ?? false])));
  const api = peticiones.find((x) => x.ruta === '/x/player/wbi/v2');
  comprobar(api?.q.aid === '1001' && api?.q.cid === '2001' && api.conSesion, 'La lista se pide a la API del reproductor, con la sesión', JSON.stringify(api));
  const linea = await hasta((r, f) => new Function('r', `return (${f})(r)`)(r).includes('银行') && new Function('r', `return (${f})(r)`)(r), textoLinea.toString());
  comprobar(linea === LINEAS[2001].autor[0], 'Kotonoha enseña la del autor antes que la de la IA, leída del CDN sin cookies', linea);
  const otra = await orden('info');
  comprobar(otra.titulo === '北京一日游 · P1 上午', 'Con su título original, y la parte, aunque la página esté traducida', otra.titulo);
  comprobar(otra.categoria === '', 'Un vlog no es una canción');
  const nativos = await p.evaluate(() => getComputedStyle(document.querySelector('.bpx-player-subtitle-wrap')).display);
  comprobar(nativos === 'none', 'Los subtítulos de Bilibili quedan ocultos', nativos);
  await p.screenshot({ path: join(CAPTURAS, 'video.png') });
  await orden('saltar', 7000);
  await orden('reproducir');
  await orden('pausar');
  const llamadas = await p.evaluate(() => window.__llamadas);
  comprobar(llamadas.includes('seek:7') && llamadas.includes('play') && llamadas.includes('pause'), 'Salta, reproduce y para con el reproductor de Bilibili', llamadas.join(' '));

  console.log('\n== Otra parte, sin recargar ==');
  await p.evaluate(() => { history.pushState({}, '', '?p=2'); document.querySelector('#v').currentTime = 1; });
  const segunda = await hasta((r, f) => {
    const t = new Function('r', `return (${f})(r)`)(r);
    return t.includes('第二部分') && t;
  }, textoLinea.toString(), 25000);
  comprobar(segunda === LINEAS[2002].autor[0], 'Al pasar a la segunda parte, sus subtítulos', segunda);
  const info2 = await orden('info');
  comprobar(info2.idVideo === `${BV}?p=2` && info2.titulo === '北京一日游 · P2 下午', 'Y su nombre y su título', `${info2.idVideo} · ${info2.titulo}`);
  await p.close();
}

console.log('\n== Una canción, por su zona ==');
{
  const { p, orden, hasta } = await abrir(`https://www.bilibili.com/video/${BV_MUSICA}/`);
  await hasta((r) => r.querySelector('.linea-sub.objetivo .pal') != null);
  const info = await orden('info');
  comprobar(info.categoria === 'Music' && info.titulo === '我想唱一首歌', 'Un video de la zona de música se trata como una canción', `${info.categoria} · ${info.titulo}`);
  await p.close();
}

console.log('\n== Un episodio de bangumi ==');
{
  const { p, orden, hasta } = await abrir(`https://www.bilibili.com/bangumi/play/ep${EP}?from_spmid=666.25.episode.0`);
  const linea = await hasta((r, f) => {
    const t = new Function('r', `return (${f})(r)`)(r);
    return t.includes('冒险') && t;
  }, textoLinea.toString());
  comprobar(linea === LINEAS[4001].ia[0], 'Sin la del autor, la de la IA', linea);
  const api = peticiones.filter((x) => x.ruta === '/x/player/wbi/v2').at(-1);
  comprobar(api?.q.ep_id === String(EP) && api?.q.season_id === '46089', 'La lista se pide con el episodio y la temporada', JSON.stringify(api?.q));
  const info = await orden('info');
  comprobar(info.idVideo === `ep${EP}` && info.titulo === '葬送的芙莉莲 第1话 冒险的结束', 'El episodio se nombra por su número, con el título de la serie y del episodio', `${info.idVideo} · ${info.titulo}`);
  await p.screenshot({ path: join(CAPTURAS, 'bangumi.png') });
  await p.close();
}

console.log('\n== Sin la sesión iniciada ==');
{
  await contexto.clearCookies();
  const { p, hasta } = await abrir(`https://www.bilibili.com/video/${BV}/`);
  const aviso = await hasta((r) => r.querySelector('.barra-estado.error')?.getAttribute('title'));
  comprobar(/sesión iniciada/.test(aviso ?? ''), 'Dice que Bilibili solo da sus subtítulos con la sesión iniciada', aviso);
  await p.screenshot({ path: join(CAPTURAS, 'sin-sesion.png') });
  await p.close();
}

if (errores.length) console.log('Errores de página:', errores.slice(0, 8).join('\n'));
comprobar(!errores.length, 'Ningún error de página', errores.length);
console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien');
await contexto.close();
await mock.cerrar?.();
process.exit(fallos ? 1 : 0);
