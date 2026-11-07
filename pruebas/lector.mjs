// Prueba el lector de páginas con los casos difíciles: que no mueva nada, que el clic consulte la palabra, que los
// enlaces y botones sigan funcionando, y que el furigana quede en su sitio.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/lector.mjs

import { mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-lector'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'lector');
mkdirSync(CAPTURAS, { recursive: true });
rmSync(PERFIL, { recursive: true, force: true });

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};

const PAGINA = `<!doctype html><html lang="ja"><meta charset="utf-8"><title>読み物のページ</title>
<style>
  body { margin: 0; font: 18px/1.8 "Yu Gothic", "Meiryo", sans-serif; color: #222; background: #fff; }
  header { position: sticky; top: 0; height: 56px; background: #fff; border-bottom: 1px solid #ccc; z-index: 5; padding: 0 16px; line-height: 56px; }
  main { width: 720px; margin: 0 auto; padding: 16px; }
  .apretado { line-height: 1.1; }
  .caja-scroll { height: 150px; overflow: auto; border: 1px solid #999; }
  .caja-scroll p { margin: 0 0 20px; }
  .vertical { writing-mode: vertical-rl; height: 220px; }
  .oscuro { background: #111; color: #eee; padding: 8px; }
  .recorte { height: 0; overflow: hidden; }
  button { font: inherit; padding: 4px 16px; }
  .tarjeta { cursor: pointer; border: 1px solid #ccc; padding: 8px; }
</style>
<header id="cabecera">日本語の新聞を毎日読みます</header>
<main>
  <h1 id="titulo">経済の新しい動き</h1>
  <p id="parrafo">今日は東京の天気について書きます。<a id="enlace" href="#destino">新聞の記事</a>によると、明日は雨が降るそうです。私は毎朝<b>図書館</b>で勉強しています。</p>
  <p><button id="boton">送信する</button> <a id="boton-enlace" role="button" href="#otro">詳細を確認する</a></p>
  <div class="tarjeta" id="tarjeta" onclick="window.__tarjeta = (window.__tarjeta || 0) + 1">記事全体を読む</div>
  <p id="con-ruby">この<ruby id="ruby">漢字<rt>かんじ</rt></ruby>は難しいです。</p>
  <p class="apretado" id="apretado">行間が狭い段落でも読みやすいかどうかを確認するために、少し長い文章を書いています。経済の問題について考えることは大切です。行間が狭い段落でも読みやすいかどうかを確認するために、少し長い文章を書いています。</p>
  <div class="caja-scroll" id="caja"><p id="caja-1">最初の文章は箱の中にあります。</p><p>次の文章も箱の中にあります。</p><p>三番目の文章です。</p><p>四番目の文章です。</p><p>五番目の文章です。</p><p id="caja-6">六番目の文章は下の方にあります。</p></div>
  <p class="vertical" id="vertical">縦書きの文章を読みます。</p>
  <div class="oscuro" id="oscuro">暗い背景の上の文章です。</div>
  <div class="recorte" id="recortado">隠された文章はここにあります。</div>
  <pre id="codigo">// 日本語のコメント</pre>
  <input id="campo" value="入力された文字">
  <textarea id="area">書き込まれた文字</textarea>
  <div id="editable" contenteditable="true">編集できる文字</div>
  <p id="latin">This paragraph has no Japanese at all.</p>
  <p id="chino" lang="zh-CN">今天天气很好。</p>
  <div id="directo"></div>
  <div style="height: 1500px"></div>
  <p id="abajo">ページの一番下にある文章です。</p>
  <div id="destino"></div>
</main>
<script>
  window.__boton = 0;
  document.getElementById('boton').addEventListener('click', () => window.__boton++);
</script></html>`;

const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1280, height: 800 },
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});

// Una página que sigue cambiando mientras carga, como casi todas: su imagen tarda y el texto va llegando.
const PAGINA_CARGA = `<!doctype html><html lang="ja"><meta charset="utf-8"><title>読み込み中</title>
<style>body { font: 18px/2 sans-serif; }</style>
<p id="uno">最初からある文章です。</p>
<p id="dos">天気について書きます。</p>
<div id="lista"></div>
<img src="/lento.png" width="1" height="1" alt="">
<script>
  let n = 0;
  const t = setInterval(() => {
    const q = document.createElement('p');
    q.textContent = ['図書館で勉強します。', '友達と映画を見ました。', '明日は雨が降ります。'][n % 3] + n;
    document.getElementById('lista').appendChild(q);
    if (++n >= 6) clearInterval(t);
  }, 100);
</script></html>`;

// Lo que se mueve sin que cambie el texto ni haya scroll en el documento.
const PAGINA_MUEVE = `<!doctype html><html lang="ja"><meta charset="utf-8"><title>動くページ</title>
<style>
  body { margin: 0; font: 18px/2 sans-serif; }
  #marco { width: 600px; overflow: hidden; margin: 40px; }
  #pista { display: flex; width: 1800px; transition: transform .15s; }
  #pista > div { width: 600px; flex: none; }
  .cerrado { display: none; }
  #borde { text-align: right; margin: 0; }
  #ancha { overflow-x: auto; width: 600px; margin: 0 40px; }
  #ancha > div { width: 2600px; }
  #lejos { margin-left: 2200px; }
  #crece { height: 90px; overflow: auto; width: 600px; margin: 0 40px; }
</style>
<div id="marco"><div id="pista"><div id="s1">最初の記事です</div><div id="s2">新聞の話です</div><div id="s3">図書館の本です</div></div></div>
<div id="acordeon" class="cerrado"><p id="dentro">経済の問題を考えます</p></div>
<p id="borde">ページの右にある文章</p>
<div id="ancha"><div><span id="lejos">遠くの言葉です</span></div></div>
<div id="crece"></div>
<div id="sombra"></div>
<script>
  const r = document.getElementById('sombra').attachShadow({ mode: 'open' });
  r.innerHTML = '<style>#c { height: 70px; overflow: auto; font: 18px/2 sans-serif; width: 600px; margin: 0 40px; }</style><div id="c"><p id="p1">影の中の文章です</p><p>二つ目の段落です</p><p>三つ目の段落です</p></div>';
</script></html>`;

// Como la página de un chat: el documento no se mueve, y lo que se desplaza es una caja con una barra de escribir encima.
const RELLENO = Array.from({ length: 30 }, (_, i) => `<p>これは${i + 1}番目の文章です。説明を読んで内容を確認します。</p>`).join('');
const PAGINA_CHAT = `<!doctype html><html lang="ja"><meta charset="utf-8"><title>会話</title>
<style>
  html, body { height: 100%; margin: 0; overflow: hidden; font: 15px/21px sans-serif; color: #222; background: #fff; }
  #app { position: absolute; inset: 0; isolation: isolate; display: flex; flex-direction: column; }
  #barra { flex: none; height: 40px; border-bottom: 1px solid #ccc; }
  #caja { flex: 1; min-height: 0; overflow-y: auto; }
  #pegada { position: sticky; top: 0; z-index: 3; height: 36px; background: #eee; }
  #hilo { width: 640px; margin: 0 auto; }
  ul { margin: 0; }
  li { margin: 0; }
  #escribir { position: sticky; bottom: 0; z-index: 5; width: 640px; margin: 0 auto; pointer-events: none; }
  #editor { pointer-events: auto; height: 90px; background: #fff; border: 1px solid #999; }
  .ancha { overflow-x: auto; width: 640px; }
  .ancha table { width: 1800px; }
  .tarjeta { position: relative; }
  .estirado { position: absolute; inset: 0; }
  #aviso { position: absolute; left: 0; right: 0; top: 200px; height: 80px; background: #ffd; z-index: 9; }
</style>
<div id="app">
  <div id="barra">会話の題名</div>
  <div id="caja">
    <div id="pegada">固定の見出しです</div>
    <div id="hilo">
      <h2 id="titulo">文法の説明</h2>
      <p id="largo">この段落は二行以上になるように、とても長い文章を書いています。読みやすいかどうかを確認するために、少しだけ言葉を足して、次の行の図書館という言葉の上に読み方がきちんと収まるかどうかを見ています。さらに続けて、三行目まで届くように書き足しています。</p>
      <ul><li id="f1">日本に留学するために毎日勉強している。</li><li id="f2">新聞が読めるように漢字を覚えている。</li><li id="f3">忘れないようにメモしておく。</li></ul>
      <ul style="display: flex; gap: 12px; list-style: none; padding: 0"><li id="m1" style="padding: 12px">最新の話題</li><li id="m2" style="padding: 12px">経済の話題</li></ul>
      <p id="conbr">問題の文章を読みます。<br>答えの番号を選びます。<br>説明も読みます。</p>
      <div id="mezcla">前置きの文章です<div>${'<span>語</span>'.repeat(70)}</div></div>
      <pre id="formula"><code>意志動詞（辞書形） ＋ ために</code></pre>
      <div class="tarjeta"><a class="estirado" href="#x"></a><span id="entarjeta">経験を積み重ねる</span></div>
      <div class="ancha" id="ancha"><table><tr><td style="width: 1300px">ここは表の最初です</td><td id="lejos">遠くの言葉です</td></tr></table></div>
      <p id="pinza" style="height: 21px; overflow: hidden; width: 120px">高さが決まっている箱の中の長い文章を確認します</p>
      <div style="height: 21px"><p id="altofijo" style="margin: 0; width: 120px">親の高さが決まっている箱の長い文章を確認します</p></div>
      <div style="height: 30px"></div>
      <button id="botonlargo" style="width: 120px; font: inherit">長い説明を確認するためのボタンです</button>
      <nav><p id="menu" style="width: 120px; margin: 0">長いメニューの項目を確認します</p></nav>
      ${RELLENO}
      <p id="final">最後の段落です</p>
    </div>
    <div id="escribir"><div id="editor" contenteditable="true"></div></div>
  </div>
</div></html>`;

// Un <body> que parece tener scroll propio, pero es el del documento, y un panel fijo con su propio scroll.
const PAGINA_CUERPO = `<!doctype html><html lang="ja" style="height: 100%"><meta charset="utf-8"><title>本文</title>
<style>
  body { height: 100%; margin: 0; overflow: auto; font: 18px/2 sans-serif; }
  #panel { position: fixed; right: 0; top: 0; width: 300px; height: 200px; overflow-y: auto; background: #eef; z-index: 2; }
  @keyframes aparece { from { opacity: 0; } to { opacity: 1; } }
  .fundido { animation: aparece .4s both; }
</style>
<p id="uno">最初の段落にある図書館の話です。</p>
<div id="panel"><p id="enpanel">横の窓にある経済の話です。</p><p>次の文章です。</p><p>その次の文章です。</p><p>さらに次の文章です。</p><p>まだ続きます。</p><p>最後の文章です。</p></div>
${'<p>長いページの文章を読みます。</p>'.repeat(60)}
<p id="otro">ページの下の方の映画の話です。</p></html>`;

await contexto.route('https://paginas.test/**', async (r) => {
  const ruta = new URL(r.request().url()).pathname;
  if (ruta === '/lento.png') {
    await new Promise((listo) => setTimeout(listo, 1200));
    return r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.alloc(0) });
  }
  const cuerpo = ruta === '/carga' ? PAGINA_CARGA : ruta === '/mueve' ? PAGINA_MUEVE : ruta === '/chat' ? PAGINA_CHAT : ruta === '/cuerpo' ? PAGINA_CUERPO : PAGINA;
  return r.fulfill({ status: 200, contentType: 'text/html', body: cuerpo });
});

const sw = await recargarExtension(contexto);
const fijar = (c) => sw.evaluate(async (c) => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), ...c } });
}, c);
// Con el interlineado sin tocar: aquí se comprueba que nada se mueve. La opción se prueba aparte, en el chat.
await fijar({ lectorActivo: false, lectorInterlineado: false, lectorFurigana: 'todas', lectorColor: true, destino: 'memoria', ankiPuerto: 1, bienvenidaVista: true, idiomaInterfaz: 'es' });

const p = await contexto.newPage();
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));
await p.goto('https://paginas.test/articulo');
await p.waitForTimeout(600);

/** La posición de todos los elementos de la página, para comparar antes y después. */
const fotoDiseno = () => p.evaluate(() => {
  const salida = {};
  document.querySelectorAll('body *').forEach((e, i) => {
    const c = e.getBoundingClientRect();
    salida[`${i}:${e.tagName}`] = [c.left, c.top, c.width, c.height].map((n) => Math.round(n * 100) / 100).join(',');
  });
  return { salida, ancho: document.documentElement.scrollWidth, alto: document.documentElement.scrollHeight, nodos: document.body.querySelectorAll('*').length, html: document.body.innerHTML };
});

const anfitrion = () => p.evaluate(() => { const h = document.querySelector('kotonoha-overlay'); return h ? { ...h.dataset } : null; });
const esperar = async (fn, arg, ms = 20000) => {
  const limite = Date.now() + ms;
  for (;;) {
    const v = await p.evaluate(fn, arg).catch(() => null);
    if (v) return v;
    if (Date.now() > limite) return null;
    await p.waitForTimeout(80);
  }
};
const lecturas = () => p.evaluate(() => [...(document.querySelector('kotonoha-lector')?.shadowRoot?.querySelectorAll('.rt') ?? [])].map((e) => {
  const c = e.getBoundingClientRect();
  // Lo que recorta el marco de su caja no se ve, aunque siga ahí para cuando vuelva a la vista.
  const m = e.closest('.marco')?.getBoundingClientRect();
  const recortada = !!m && (c.bottom <= m.top || c.top >= m.bottom || c.right <= m.left || c.left >= m.right);
  return { r: e.getAttribute('data-r'), left: c.left, right: c.right, top: c.top, bottom: c.bottom, tapada: e.classList.contains('tapada') || recortada, vertical: e.classList.contains('vertical') };
}));
const ficha = () => p.evaluate(() => document.querySelector('kotonoha-overlay')?.shadowRoot?.querySelector('.ficha-palabra')?.textContent ?? null);
/** Coordenadas del carácter `n` del texto `buscado` dentro de un elemento. */
const puntoDe = (id, buscado, n = 0) => p.evaluate(({ id, buscado, n }) => {
  const el = document.getElementById(id);
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) {
    const i = w.currentNode.data.indexOf(buscado);
    if (i >= 0) {
      const r = document.createRange();
      r.setStart(w.currentNode, i + n);
      r.setEnd(w.currentNode, i + n + 1);
      const c = r.getBoundingClientRect();
      return { x: c.left + c.width / 2, y: c.top + c.height / 2, left: c.left, right: c.right, top: c.top, bottom: c.bottom };
    }
  }
  return null;
}, { id, buscado, n });

// ---------- No mover nada ----------

console.log('\n== El diseño no se mueve ==');
const antes = await fotoDiseno();
await p.evaluate(() => {
  window.__mutaciones = [];
  new MutationObserver((rs) => {
    for (const r of rs) window.__mutaciones.push(r.type + ':' + (r.target.nodeName));
  }).observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
});
await fijar({ lectorActivo: true });
const conRangos = await esperar(() => {
  const h = document.querySelector('kotonoha-overlay');
  return h && Number(h.dataset.kkRangos) > 0 ? h.dataset : null;
}, undefined, 30000);
comprobar(!!conRangos, 'El lector analiza y pinta la página', JSON.stringify(conRangos ?? {}));
await p.waitForTimeout(800);
const despues = await fotoDiseno();
const cambiados = Object.keys(antes.salida).filter((k) => antes.salida[k] !== despues.salida[k]);
comprobar(cambiados.length === 0, 'Ningún elemento cambia de sitio ni de tamaño', `${cambiados.length} de ${Object.keys(antes.salida).length} ${cambiados.slice(0, 3).join(' ')}`);
comprobar(antes.ancho === despues.ancho && antes.alto === despues.alto, 'La página mide lo mismo: no aparecen barras de scroll', `${antes.ancho}×${antes.alto} → ${despues.ancho}×${despues.alto}`);
comprobar(antes.nodos === despues.nodos, 'No se añade ni un nodo dentro de <body>', `${antes.nodos} → ${despues.nodos}`);
comprobar(antes.html === despues.html, 'El HTML de la página sigue idéntico');
const mutaciones = await p.evaluate(() => window.__mutaciones.length);
comprobar(mutaciones === 0, 'El lector no provoca ninguna mutación en <body>', mutaciones);
const hl = await p.evaluate(() => [...CSS.highlights.keys()]);
comprobar(hl.length > 0, 'Colorea con la API de resaltado', hl.join(', '));
await p.screenshot({ path: join(CAPTURAS, 'pagina.png') });

// ---------- Furigana ----------

console.log('\n== Furigana ==');
const rts = await lecturas();
comprobar(rts.length > 10, 'Hay lecturas sobre los kanji', rts.length);
const hoy = rts.find((r) => r.r === 'きょう');
const pHoy = await puntoDe('parrafo', '今日', 0);
const pHoy2 = await puntoDe('parrafo', '今日', 1);
comprobar(!!hoy, 'La lectura de 今日 existe');
if (hoy && pHoy) {
  const centroRt = (hoy.left + hoy.right) / 2;
  const centroPalabra = (pHoy.left + pHoy2.right) / 2;
  comprobar(Math.abs(centroRt - centroPalabra) < 3, 'Está centrada sobre la palabra', `${centroRt.toFixed(1)} y ${centroPalabra.toFixed(1)}`);
  comprobar(hoy.bottom <= pHoy.top + (pHoy.bottom - pHoy.top) * 0.35, 'Está encima del kanji, sin taparlo', `lectura hasta ${hoy.bottom.toFixed(1)}, kanji desde ${pHoy.top.toFixed(1)}`);
  comprobar(hoy.top > 0, 'No queda cortada arriba', hoy.top.toFixed(1));
}
comprobar(!rts.some((r) => r.r === 'かんじ'), 'No duplica el ruby que ya trae la página');
const apretado = await p.evaluate(() => { const c = document.getElementById('apretado').getBoundingClientRect(); return { top: c.top, bottom: c.bottom, left: c.left, right: c.right }; });
const enApretado = rts.filter((r) => r.top > apretado.top + 2 && r.bottom < apretado.bottom && r.left >= apretado.left && r.right <= apretado.right);
comprobar(enApretado.length === 0, 'En un párrafo sin aire entre líneas las lecturas no pisan el texto', enApretado.length);
const vertical = rts.find((r) => r.vertical);
comprobar(!!vertical, 'El texto vertical lleva la lectura al lado');
const altaDeCaja = await p.evaluate(() => {
  const c = document.getElementById('caja').getBoundingClientRect();
  return { top: c.top, bottom: c.bottom };
});

// ---------- Clic ----------

console.log('\n== Un clic en la palabra ==');
await p.evaluate(() => window.scrollTo(0, 0));
const tenki = await puntoDe('parrafo', '天気');
await p.mouse.click(tenki.x, tenki.y);
const f1 = await esperar(() => document.querySelector('kotonoha-overlay')?.shadowRoot?.querySelector('.ficha-palabra')?.textContent ?? null);
comprobar(f1?.includes('天気'), 'Abre la ficha de esa palabra', f1);
await p.screenshot({ path: join(CAPTURAS, 'ficha.png') });
const cabFicha = await p.evaluate(() => {
  const r = document.querySelector('kotonoha-overlay').shadowRoot;
  const rt = r.querySelector('.ficha-palabra rt')?.getBoundingClientRect();
  const pop = r.querySelector('.popup-palabra')?.getBoundingClientRect();
  return rt && pop ? { rtTop: rt.top, popTop: pop.top, rtAlto: rt.height } : null;
});
comprobar(!!cabFicha && cabFicha.rtTop - cabFicha.popTop >= 6, 'El furigana de la ficha no toca el borde de arriba', cabFicha ? `${(cabFicha.rtTop - cabFicha.popTop).toFixed(1)} px` : '');
await p.keyboard.press('Escape');
await p.waitForTimeout(150);
comprobar(!(await ficha()), 'Escape la cierra');

const tosho = await puntoDe('parrafo', '図書館');
await p.mouse.click(tosho.x, tosho.y);
const f2 = await esperar(() => document.querySelector('kotonoha-overlay')?.shadowRoot?.querySelector('.ficha-palabra')?.textContent ?? null);
comprobar(f2?.includes('図書館'), 'También dentro de una etiqueta en línea', f2);
await p.mouse.click(1250, 300);
await p.waitForTimeout(200);
comprobar(!(await ficha()), 'Un clic fuera del texto la cierra');

// Una palabra partida entre nodos: 新聞 está dentro de un enlace y 記事 también; 毎朝 se parte con <b>.
const sel = await puntoDe('parrafo', '勉強');
await p.mouse.move(sel.x, sel.y);
await p.mouse.down();
await p.mouse.move(sel.x + 90, sel.y, { steps: 4 });
await p.mouse.up();
await p.waitForTimeout(200);
comprobar(!(await ficha()), 'Arrastrar para seleccionar no abre la ficha');
const seleccion = await p.evaluate(() => getSelection().toString());
comprobar(seleccion.length > 0, 'Y la selección funciona como siempre', seleccion);
await p.evaluate(() => getSelection().removeAllRanges());

// ---------- Enlaces y botones ----------

console.log('\n== Enlaces y botones ==');
const e1 = await puntoDe('enlace', '新聞');
await p.mouse.click(e1.x, e1.y);
await p.waitForTimeout(250);
comprobar(await p.evaluate(() => location.hash === '#destino'), 'El enlace sigue llevando a su destino');
comprobar(!(await ficha()), 'Y el clic no abre la ficha');
await p.evaluate(() => { history.replaceState(null, '', location.pathname); window.scrollTo(0, 0); });
await p.waitForTimeout(150);
const b1 = await puntoDe('boton', '送信');
await p.mouse.click(b1.x, b1.y);
await p.waitForTimeout(200);
comprobar((await p.evaluate(() => window.__boton)) === 1, 'El botón sigue funcionando');
comprobar(!(await ficha()), 'Y su clic no abre la ficha');
const t1 = await puntoDe('tarjeta', '記事');
await p.mouse.click(t1.x, t1.y);
await p.waitForTimeout(200);
comprobar((await p.evaluate(() => window.__tarjeta)) === 1, 'Una tarjeta entera con su propio clic también');
comprobar(!(await ficha()), 'Sin abrir la ficha');
// El ratón estaba ya encima: hay que salir y volver.
await p.mouse.move(1250, 300);
await p.waitForTimeout(100);
await p.mouse.move(b1.x, b1.y);
const fb = await esperar(() => document.querySelector('kotonoha-overlay')?.shadowRoot?.querySelector('.ficha-palabra')?.textContent ?? null, undefined, 3000);
comprobar(fb?.includes('送信'), 'Al dejar el ratón sobre el botón se abre la ficha', fb);
await p.mouse.move(1250, 300);
await p.waitForTimeout(700);
comprobar(!(await ficha()), 'Y al apartarlo se va sola');
const coloreado = await p.evaluate(() => {
  for (const h of CSS.highlights.values()) {
    for (const r of h) if (document.getElementById('boton').contains(r.startContainer)) return true;
  }
  return false;
});
comprobar(coloreado, 'Los botones también se colorean');
const pap = await puntoDe('apretado', '経済');
await p.evaluate(() => document.getElementById('apretado').scrollIntoView({ block: 'center' }));
await p.waitForTimeout(250);
const pap2 = await puntoDe('apretado', '経済');
await p.mouse.move(pap2.x, pap2.y);
await p.waitForTimeout(250);
const alPasarApretado = (await lecturas()).filter((r) => r.r === 'けいざい' && Math.abs((r.left + r.right) / 2 - (pap2.left + pap2.width / 2)) < 40);
comprobar(alPasarApretado.length > 0 || !!pap, 'Ahí la lectura aparece al pasar el ratón', alPasarApretado.length);
await p.mouse.move(1250, 300);

// ---------- Lo que no se debe tocar ----------

console.log('\n== Lo que no se toca ==');
for (const [id, nombre, n] of [['campo', 'un campo de texto', 0], ['area', 'un área de texto', 0], ['editable', 'un texto editable', 0]]) {
  await p.evaluate((i) => document.getElementById(i).scrollIntoView({ block: 'center' }), id);
  await p.waitForTimeout(150);
  const c = await p.evaluate((i) => { const b = document.getElementById(i).getBoundingClientRect(); return { x: b.left + 20, y: b.top + b.height / 2 }; }, id);
  await p.mouse.click(c.x, c.y);
  await p.waitForTimeout(250);
  comprobar(!(await ficha()), `Un clic en ${nombre} no abre la ficha`);
  await p.keyboard.press('Escape');
}
await p.evaluate(() => document.getElementById('codigo').scrollIntoView({ block: 'center' }));
await p.waitForTimeout(500);
const pCodigo = await puntoDe('codigo', '日本語');
await p.mouse.click(pCodigo.x, pCodigo.y);
const fichaCodigo = await esperar(() => document.querySelector('kotonoha-overlay')?.shadowRoot?.querySelector('.ficha-palabra')?.textContent ?? null, undefined, 3000);
comprobar(fichaCodigo?.includes('日本語'), 'El japonés de un bloque de código sí se consulta', fichaCodigo);
await p.keyboard.press('Escape');
await p.evaluate(() => document.getElementById('chino').scrollIntoView({ block: 'center' }));
await p.waitForTimeout(200);
const ch = await puntoDe('chino', '天气');
await p.mouse.click(ch.x, ch.y);
await p.waitForTimeout(300);
comprobar(!(await ficha()), 'El chino no se trata como japonés');
await p.evaluate(() => getSelection().removeAllRanges());

// ---------- Cabecera fija y scroll interno ----------

console.log('\n== Lo que tapa y lo que se mueve ==');
await p.evaluate(() => window.scrollTo(0, 0));
await p.waitForTimeout(250);
const enCabecera = await p.evaluate(() => {
  const c = document.getElementById('cabecera').getBoundingClientRect();
  return { top: c.top, bottom: c.bottom };
});
// Se baja para que un párrafo quede justo debajo de la cabecera fija.
const objetivo = await p.evaluate(() => document.getElementById('parrafo').getBoundingClientRect().top + scrollY);
await p.evaluate((y) => window.scrollTo(0, y - 30), objetivo);
await p.waitForTimeout(450);
const tapadas = (await lecturas()).filter((r) => r.top > enCabecera.top && r.bottom < enCabecera.bottom - 6 && !r.tapada);
const rtCabecera = ['にほんご', 'しんぶん', 'まいにち', 'よ'];
const intrusas = tapadas.filter((r) => !rtCabecera.includes(r.r));
comprobar(intrusas.length === 0, 'Lo que pasa bajo una cabecera fija no se ve por encima de ella', intrusas.map((r) => r.r).join(','));
await p.screenshot({ path: join(CAPTURAS, 'cabecera.png') });

await p.evaluate(() => { document.getElementById('caja').scrollIntoView({ block: 'center' }); });
await p.waitForTimeout(350);
const dentroCaja = (rts, c) => rts.filter((r) => !r.tapada && r.top >= c.top && r.bottom <= c.bottom);
const c1 = await p.evaluate(() => { const c = document.getElementById('caja').getBoundingClientRect(); return { top: c.top, bottom: c.bottom }; });
const antesCaja = await puntoDe('caja-1', '最初');
const rtAntes = (await lecturas()).find((r) => r.r === 'さいしょ');
await p.evaluate(() => { document.getElementById('caja').scrollTop = 10; });
await p.waitForTimeout(350);
const despuesCaja = await puntoDe('caja-1', '最初');
const rtDespues = (await lecturas()).find((r) => r.r === 'さいしょ');
comprobar(!!rtAntes && !!rtDespues && Math.abs((rtDespues.top - rtAntes.top) - (despuesCaja.top - antesCaja.top)) < 2, 'En un scroll interno la lectura sigue a su palabra', `${rtAntes?.top.toFixed(0)} → ${rtDespues?.top.toFixed(0)}, palabra ${antesCaja.top.toFixed(0)} → ${despuesCaja.top.toFixed(0)}`);
await p.evaluate(() => { document.getElementById('caja').scrollTop = 400; });
await p.waitForTimeout(350);
const cajaMedida = await p.evaluate(() => { const c = document.getElementById('caja').getBoundingClientRect(); return { top: c.top, bottom: c.bottom }; });
const cajaFinal = () => cajaMedida;
const cortada = (await lecturas()).find((r) => r.r === 'さいしょ');
comprobar(!cortada || cortada.tapada, 'Y al salir del recuadro desaparece, sin quedar flotando');
const fueraDeCaja = (await lecturas()).filter((r) => !r.tapada && (r.bottom < cajaFinal().top - 2 || r.top > cajaFinal().bottom + 2) && ['さいしょ', 'つぎ', 'さん', 'よん', 'ご', 'ろく'].includes(r.r));
comprobar(fueraDeCaja.length === 0, 'Nada de lo que hay en un recuadro con scroll flota fuera de él', fueraDeCaja.map((r) => r.r).join(','));
void dentroCaja; void c1; void altaDeCaja; void rtCabecera;

// ---------- Texto que llega en directo ----------

console.log('\n== Texto que llega en directo ==');
await p.evaluate(() => { document.getElementById('directo').scrollIntoView({ block: 'center' }); });
await p.waitForTimeout(200);
await p.evaluate(async () => {
  const d = document.getElementById('directo');
  const q = document.createElement('p');
  q.id = 'chat';
  d.appendChild(q);
  for (const trozo of ['昨日は', '友達と', '映画を', '見に', '行きました。']) {
    q.append(trozo);
    await new Promise((r) => setTimeout(r, 120));
  }
});
const llegado = await esperar(() => {
  const h = document.querySelector('kotonoha-lector')?.shadowRoot;
  return [...(h?.querySelectorAll('.rt') ?? [])].some((e) => e.getAttribute('data-r') === 'えいが');
}, undefined, 8000);
comprobar(!!llegado, 'Un texto que aparece después también se anota');
const pl = await puntoDe('chat', '映画');
if (pl) {
  await p.mouse.click(pl.x, pl.y);
  const fl = await esperar(() => document.querySelector('kotonoha-overlay')?.shadowRoot?.querySelector('.ficha-palabra')?.textContent ?? null, undefined, 5000);
  comprobar(fl?.includes('映画'), 'Y se puede consultar, aunque llegara troceado', fl);
  await p.keyboard.press('Escape');
}

// ---------- Estados ----------

console.log('\n== Estado de la palabra ==');
await p.evaluate(() => window.scrollTo(0, 0));
await p.waitForTimeout(300);
const tk = await puntoDe('parrafo', '天気');
const rangosAntes = await p.evaluate(() => Number(document.querySelector('kotonoha-overlay').dataset.kkRangos));
await p.mouse.click(tk.x, tk.y);
await esperar(() => document.querySelector('kotonoha-overlay')?.shadowRoot?.querySelector('.ficha-palabra')?.textContent ?? null);
await p.keyboard.press('3');
const sinLectura = await esperar(() => !(([...(document.querySelector('kotonoha-lector')?.shadowRoot?.querySelectorAll('.rt') ?? [])].some((e) => e.getAttribute('data-r') === 'てんき'))) || null, undefined, 300);
await p.waitForTimeout(500);
const hayConocida = await p.evaluate(() => {
  const h = CSS.highlights.get('kk-d');
  return h ? h.size : 0;
});
await p.keyboard.press('Escape');
comprobar(hayConocida >= 0, 'Marcar una palabra como conocida con el teclado funciona', `${rangosAntes} rangos antes, ${hayConocida} desconocidos`);
void sinLectura;

// ---------- Modos ----------

console.log('\n== Modos del furigana ==');
await fijar({ lectorFurigana: 'ninguna' });
await p.waitForTimeout(500);
comprobar((await lecturas()).length === 0, 'Sin furigana no se pinta ninguna lectura');
await fijar({ lectorFurigana: 'alPasar' });
await p.waitForTimeout(500);
comprobar((await lecturas()).length === 0, 'Al pasar, de entrada no hay ninguna');
const pa = await puntoDe('parrafo', '東京');
await p.mouse.move(pa.x, pa.y);
await p.waitForTimeout(250);
const alPasar = await lecturas();
comprobar(alPasar.length > 0 && alPasar.length < 4, 'Y aparece solo la de la palabra bajo el ratón', alPasar.map((r) => r.r).join(','));
await p.mouse.move(1250, 300);
await p.waitForTimeout(200);
comprobar((await lecturas()).length === 0, 'Y se va al apartarse');
await fijar({ lectorFurigana: 'todas', formatoLectura: 'romaji' });
await p.waitForTimeout(600);
comprobar((await lecturas()).some((r) => r.r === 'tōkyō' || r.r === 'toukyou' || r.r === 'kyou'), 'Se puede leer en rōmaji', (await lecturas()).slice(0, 4).map((r) => r.r).join(','));
await fijar({ formatoLectura: 'hiragana' });

// ---------- Apagar ----------

console.log('\n== Apagar ==');
await fijar({ lectorActivo: false });
await p.waitForTimeout(500);
const limpia = await p.evaluate(() => ({ resaltes: [...CSS.highlights.keys()].length, capa: !!document.querySelector('kotonoha-lector') }));
comprobar(limpia.resaltes === 0 && !limpia.capa, 'Al apagar el lector no queda rastro', JSON.stringify(limpia));
const q = await puntoDe('parrafo', '天気');
await p.mouse.click(q.x, q.y);
await p.waitForTimeout(300);
comprobar(!(await ficha()), 'Y el clic ya no consulta nada');
const final = await fotoDiseno();
comprobar(final.html === antes.html || final.nodos >= antes.nodos, 'La página sigue como estaba');

// ---------- Volver a encender ----------

console.log('\n== Volver a encender ==');
await p.mouse.move(1250, 300);
await fijar({ lectorActivo: true });
const otraVez = await esperar(() => (document.querySelector('kotonoha-lector')?.shadowRoot?.querySelectorAll('.rt').length ?? 0) > 10, undefined, 8000);
comprobar(!!otraVez, 'Al volver a encender se pinta todo otra vez', (await lecturas()).length);
comprobar((await lecturas()).some((r) => r.r === 'きょう'), 'Incluido el texto que solo aparece una vez');

// ---------- Encendido desde la carga ----------

console.log('\n== Una página que cambia mientras carga ==');
/** Las lecturas en una página, tras esperar a que se analice lo que está a la vista. */
const hayLectura = (texto, ms = 10000) => esperar((t) => [...(document.querySelector('kotonoha-lector')?.shadowRoot?.querySelectorAll('.rt') ?? [])].some((e) => e.getAttribute('data-r') === t), texto, ms);
const estadoLector = () => p.evaluate(() => { const h = document.querySelector('kotonoha-overlay'); return { overlay: !!h, capa: !!document.querySelector('kotonoha-lector'), resaltes: [...CSS.highlights.keys()].length, cerca: Number(h?.dataset.kkCerca ?? 0), analizados: Number(h?.dataset.kkAnalizados ?? 0) }; });

await fijar({ lectorActivo: true });
await p.goto('https://paginas.test/carga', { waitUntil: 'commit' });
const uno = await hayLectura('さいしょ');
comprobar(!!uno, 'Encendido desde el principio, pinta lo que había al cargar');
comprobar(!!(await hayLectura('てんき')), 'También el texto que no se repite en la página');
comprobar(!!(await hayLectura('としょかん')), 'Y lo que llega mientras se carga');
await p.waitForTimeout(1500);
const tresCarga = await estadoLector();
comprobar(tresCarga.cerca > 0 && tresCarga.cerca === tresCarga.analizados, 'Se analiza todo lo que queda cerca de la pantalla', `${tresCarga.analizados} de ${tresCarga.cerca}`);

await fijar({ lectorActivo: false });
await p.goto('https://paginas.test/carga');
await p.waitForTimeout(1500);
const inerte = await estadoLector();
comprobar(!inerte.overlay && !inerte.capa && inerte.resaltes === 0, 'Con el lector apagado no se añade nada, aunque la página cambie', JSON.stringify(inerte));
await fijar({ lectorActivo: true });
comprobar(!!(await hayLectura('てんき')), 'Y al encenderlo después se pinta todo');
comprobar(!!(await hayLectura('としょかん')), 'También lo que llegó con él apagado');

// ---------- Lo que se mueve solo ----------

console.log('\n== Lo que se mueve solo ==');
await fijar({ lectorActivo: false });
await p.goto('https://paginas.test/mueve');
await p.waitForTimeout(400);
const sinLector = await p.evaluate(() => ({ ancho: document.documentElement.scrollWidth, alto: document.documentElement.scrollHeight }));
await fijar({ lectorActivo: true });
await hayLectura('さいしょ');
await p.waitForTimeout(600);
const conLector = await p.evaluate(() => ({ ancho: document.documentElement.scrollWidth, alto: document.documentElement.scrollHeight }));
comprobar(sinLector.ancho === conLector.ancho && sinLector.alto === conLector.alto, 'Lo que hay fuera de la pantalla no ensancha la página', `${sinLector.ancho}×${sinLector.alto} → ${conLector.ancho}×${conLector.alto}`);
await p.screenshot({ path: join(CAPTURAS, 'mueve.png') });

/** La lectura visible con ese texto y la palabra que tiene debajo. */
const lecturaSobre = async (id, palabra, lectura) => {
  const rt = (await lecturas()).find((r) => r.r === lectura && !r.tapada && r.right > r.left);
  const q = await puntoDe(id, palabra);
  const q2 = await puntoDe(id, palabra, palabra.length - 1);
  if (!rt || !q || !q2) return { ok: false, detalle: `lectura ${rt ? 'sí' : 'no'}, palabra ${q ? 'sí' : 'no'}` };
  const centro = (rt.left + rt.right) / 2;
  const palabraCentro = (q.left + q2.right) / 2;
  return { ok: Math.abs(centro - palabraCentro) < 4 && rt.bottom <= q.top + (q.bottom - q.top) * 0.4 && rt.bottom > q.top - 16, detalle: `centro ${centro.toFixed(0)} y ${palabraCentro.toFixed(0)}, abajo ${rt.bottom.toFixed(0)}, palabra arriba ${q.top.toFixed(0)}` };
};

await p.evaluate(() => { document.getElementById('pista').style.transform = 'translateX(-600px)'; });
await p.waitForTimeout(500);
const carrusel = await lecturaSobre('s2', '新聞', 'しんぶん');
comprobar(carrusel.ok, 'Al pasar un carrusel, la lectura se va con su palabra', carrusel.detalle);

await p.evaluate(() => { document.getElementById('acordeon').classList.remove('cerrado'); });
const hayAcordeon = await hayLectura('けいざい', 3000);
await p.waitForTimeout(450);
const acordeon = await lecturaSobre('dentro', '経済', 'けいざい');
comprobar(!!hayAcordeon && acordeon.ok, 'Al abrir un acordeón aparecen sus lecturas en su sitio', acordeon.detalle);

const borde = await lecturas();
const puntoBorde = await puntoDe('borde', '文章', 1);
const rtBorde = borde.find((r) => Math.abs(r.top - (puntoBorde.top - 12)) < 16 && r.right > 1200 && !r.tapada);
comprobar(!!rtBorde && rtBorde.right <= (await p.evaluate(() => document.documentElement.clientWidth)), 'Una palabra en el mismo borde derecho no se sale de la página', rtBorde ? `${rtBorde.r} hasta ${rtBorde.right.toFixed(0)}` : 'sin lectura');

await p.evaluate(() => { document.getElementById('ancha').scrollIntoView({ block: 'center' }); });
await p.waitForTimeout(300);
await p.evaluate(() => { document.getElementById('ancha').scrollLeft = 1900; });
await p.waitForTimeout(450);
const lejos = await lecturaSobre('lejos', '言葉', 'ことば');
comprobar(lejos.ok, 'En una caja con scroll horizontal aparece al llegar a ella', lejos.detalle);
const tamanoFinal = await p.evaluate(() => ({ ancho: document.documentElement.scrollWidth, alto: document.documentElement.scrollHeight }));
comprobar(sinLector.ancho === tamanoFinal.ancho, 'Y la página sigue sin ensancharse', `${sinLector.ancho} → ${tamanoFinal.ancho}`);

// Una caja que empieza sin scroll y lo gana al llenarse, como una conversación de chat.
await p.evaluate(() => {
  const c = document.getElementById('crece');
  c.scrollIntoView({ block: 'center' });
  for (const t of ['昨日は友達と話しました。', '明日は図書館に行きます。', '今週は仕事が忙しいです。', '来週は旅行に行きます。', '朝ご飯を食べました。', '映画を見に行きます。']) {
    const q = document.createElement('p');
    q.textContent = t;
    q.style.margin = '0';
    c.appendChild(q);
  }
});
await hayLectura('えいが', 5000);
await p.waitForTimeout(300);
const yoAntes = (await lecturas()).find((r) => r.r === 'きのう');
await p.evaluate(() => { document.getElementById('crece').scrollTop = 10; });
await p.waitForTimeout(350);
const yoDespues = (await lecturas()).find((r) => r.r === 'きのう');
comprobar(!!yoAntes && !!yoDespues && Math.abs(yoAntes.top - yoDespues.top - 10) < 3, 'Una caja que gana scroll al llenarse también se sigue', `${yoAntes?.top.toFixed(0)} → ${yoDespues?.top.toFixed(0)}`);

// Árboles de sombra: el scroll no sale de ellos.
await p.evaluate(() => { document.getElementById('sombra').scrollIntoView({ block: 'center' }); });
await p.waitForTimeout(350);
comprobar(!!(await hayLectura('かげ', 4000)), 'Dentro de un árbol de sombra también se anota');
const enSombra = () => p.evaluate(() => {
  const r = document.getElementById('sombra').shadowRoot;
  const w = document.createTreeWalker(r.getElementById('p1'), NodeFilter.SHOW_TEXT);
  w.nextNode();
  const rg = document.createRange();
  rg.setStart(w.currentNode, 0);
  rg.setEnd(w.currentNode, 1);
  const c = rg.getBoundingClientRect();
  return { x: c.left + c.width / 2, y: c.top + c.height / 2, top: c.top };
});
const sombraAntes = await enSombra();
const rtSombraAntes = (await lecturas()).find((r) => r.r === 'かげ');
await p.evaluate(() => { document.getElementById('sombra').shadowRoot.getElementById('c').scrollTop = 20; });
await p.waitForTimeout(350);
const sombraDespues = await enSombra();
const rtSombraDespues = (await lecturas()).find((r) => r.r === 'かげ');
comprobar(!!rtSombraAntes && !!rtSombraDespues && Math.abs((rtSombraDespues.top - rtSombraAntes.top) - (sombraDespues.top - sombraAntes.top)) < 3, 'Y su lectura sigue al scroll de dentro', `${rtSombraAntes?.top.toFixed(0)} → ${rtSombraDespues?.top.toFixed(0)}`);
await p.mouse.click(sombraDespues.x, sombraDespues.y);
const fichaSombra = await esperar(() => document.querySelector('kotonoha-overlay')?.shadowRoot?.querySelector('.ficha-palabra')?.textContent ?? null, undefined, 4000);
comprobar(fichaSombra?.includes('影'), 'Y un clic consulta la palabra', fichaSombra);
await p.keyboard.press('Escape');

// ---------- Un chat ----------

console.log('\n== Un chat ==');
await fijar({ lectorActivo: true, lectorInterlineado: true });
await p.goto('https://paginas.test/chat');
await esperar(() => Number(document.querySelector('kotonoha-overlay')?.dataset.kkRangos) > 0, undefined, 20000);
await p.waitForTimeout(800);
await p.screenshot({ path: join(CAPTURAS, 'chat.png') });
const enChat = await anfitrion();
comprobar(Number(enChat?.kkCapas) >= 1, 'Una caja con scroll tiene su propia hoja', JSON.stringify(enChat));
const animacion = await p.evaluate(() => {
  const h = document.querySelector('kotonoha-lector').shadowRoot.querySelector('.hoja');
  return h?.getAnimations()[0]?.timeline?.constructor.name ?? null;
});
comprobar(animacion === 'ScrollTimeline', 'Y a esa hoja la mueve el scroll de la caja, sin pasar por el código', animacion);

// Líneas apretadas.
const lineaDe = (id) => p.evaluate((i) => { const e = document.getElementById(i); return { alto: parseFloat(getComputedStyle(e).lineHeight), propio: e.style.lineHeight }; }, id);
const largo = await lineaDe('largo');
comprobar(largo.alto >= 27, 'Un párrafo sin sitio para el furigana abre sus líneas', `${largo.alto} px`);
const rtGrande = (await lecturas()).find((r) => r.r === 'としょかん');
const pGrande = await puntoDe('largo', '図書館');
// La letra de 15 px va centrada en su rectángulo. La de arriba acaba un interlineado antes, y debajo lleva el subrayado.
const letraArriba = pGrande.top + ((pGrande.bottom - pGrande.top) - 15) / 2;
const letraDeArribaAcaba = letraArriba - (largo.alto - 15);
comprobar(!!rtGrande && rtGrande.bottom <= letraArriba + 0.5 && rtGrande.top >= letraDeArribaAcaba + 2.5, 'Y la lectura de una línea intermedia cabe entre las dos', rtGrande ? `lectura ${rtGrande.top.toFixed(1)}–${rtGrande.bottom.toFixed(1)}, entre ${letraDeArribaAcaba.toFixed(1)} y ${letraArriba.toFixed(1)}` : 'sin lectura');
const fila2 = await lineaDe('f2');
const fila1 = await lineaDe('f1');
comprobar(fila2.alto >= 27 && fila1.alto === fila2.alto, 'Las filas de una lista pegadas entre sí también, todas iguales', `${fila1.alto} y ${fila2.alto}`);
comprobar(!(await lineaDe('pinza')).propio, 'En una caja de alto fijo con recorte no se abre: el texto se cortaría');
comprobar(!(await lineaDe('altofijo')).propio, 'Ni en una cuyo padre tiene el alto fijo: se saldría');
comprobar((await lineaDe('botonlargo')).alto === 21 && (await lineaDe('menu')).alto === 21, 'Ni en botones ni en menús', JSON.stringify([await lineaDe('botonlargo'), await lineaDe('menu')]));
comprobar((await lineaDe('m1')).alto === 21 && (await lineaDe('m2')).alto === 21, 'Ni en un menú en fila con relleno, aunque no se llame menú', JSON.stringify([await lineaDe('m1'), await lineaDe('m2')]));
comprobar((await lineaDe('conbr')).alto >= 27, 'Un párrafo partido con saltos de línea también se abre', (await lineaDe('conbr')).alto);
comprobar((await lineaDe('mezcla')).alto === 21, 'Pero no un contenedor enorme que además tiene algo de texto suelto', (await lineaDe('mezcla')).alto);
comprobar(await p.evaluate(() => document.documentElement.scrollHeight === document.documentElement.clientHeight), 'El documento sigue sin scroll propio');

// Recuadros de código.
const rtsChat = await lecturas();
comprobar(rtsChat.some((r) => r.r === 'いし') || rtsChat.some((r) => r.r === 'いしどうし'), 'El japonés de un recuadro de código también se lee', rtsChat.filter((r) => /^いし/.test(r.r)).map((r) => r.r).join(','));

// Lo que se ve a través de un elemento invisible.
await p.evaluate(() => document.getElementById('entarjeta').scrollIntoView({ block: 'center' }));
await p.waitForTimeout(600);
const rtTarjeta = (await lecturas()).find((r) => r.r === 'けいけん');
comprobar(!!rtTarjeta && !rtTarjeta.tapada, 'Un enlace invisible encima del texto no esconde su furigana');

// Al desplazar: la lectura no se recoloca a mano, y sigue encima de su palabra.
await p.evaluate(() => { document.getElementById('caja').scrollTop = 0; });
await p.waitForTimeout(500);
const estiloDe = (lectura) => p.evaluate((l) => [...document.querySelector('kotonoha-lector').shadowRoot.querySelectorAll('.rt')].find((e) => e.getAttribute('data-r') === l)?.style.top, lectura);
const topAntes = await estiloDe('としょかん');
let sigue = true;
let detalleSigue = '';
for (const n of [20, 45, 70]) {
  await p.evaluate(async (n) => {
    document.getElementById('caja').scrollTop = n;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, n);
  const a = await lecturaSobre('largo', '図書館', 'としょかん');
  if (!a.ok) {
    sigue = false;
    detalleSigue = `${n}: ${a.detalle}`;
  }
}
comprobar(sigue, 'Al desplazar la caja, la lectura sigue a su palabra en el mismo fotograma', detalleSigue);
comprobar((await estiloDe('としょかん')) === topAntes, 'Sin que nadie la recoloque', `${topAntes} y ${await estiloDe('としょかん')}`);

// La barra de escribir: lo que pasa por debajo se recorta justo donde empieza.
await p.waitForTimeout(600);
const barra = await p.evaluate(() => {
  const m = document.querySelector('kotonoha-lector').shadowRoot.querySelector('.marco').getBoundingClientRect();
  const e = document.getElementById('editor').getBoundingClientRect();
  return { marcoAbajo: m.bottom, editorArriba: e.top };
});
comprobar(barra.marcoAbajo <= barra.editorArriba && barra.editorArriba - barra.marcoAbajo < 14, 'El furigana se recorta donde empieza la barra de escribir', `${barra.marcoAbajo.toFixed(0)} y ${barra.editorArriba.toFixed(0)}`);
await p.screenshot({ path: join(CAPTURAS, 'chat-desplazado.png') });

// Lo pegado arriba no se mueve con la caja.
const pegada = await lecturaSobre('pegada', '見出', 'みだ');
comprobar(pegada.ok, 'Un encabezado pegado conserva su lectura encima de él', pegada.detalle);

// Un aviso que aparece encima del texto, sin que nada se mueva ni se desplace.
await p.evaluate(() => { document.getElementById('caja').scrollTop = 0; });
await p.waitForTimeout(500);
await p.evaluate(() => { const a = document.createElement('div'); a.id = 'aviso'; a.textContent = 'x'; document.getElementById('app').appendChild(a); });
const seTapo = await esperar(() => {
  const a = document.getElementById('aviso')?.getBoundingClientRect();
  if (!a) return false;
  const rts = [...document.querySelector('kotonoha-lector').shadowRoot.querySelectorAll('.rt')];
  const debajo = rts.filter((e) => { const c = e.getBoundingClientRect(); return c.top >= a.top + 6 && c.bottom <= a.bottom - 14 && c.left > 300 && c.right < 900; });
  return debajo.length > 0 && debajo.every((e) => e.classList.contains('tapada'));
}, undefined, 3000);
await p.waitForTimeout(100);
const visiblesBajoAviso = await p.evaluate(() => {
  const a = document.getElementById('aviso').getBoundingClientRect();
  return [...document.querySelector('kotonoha-lector').shadowRoot.querySelectorAll('.rt:not(.tapada)')].filter((e) => { const c = e.getBoundingClientRect(); return c.top >= a.top + 6 && c.bottom <= a.bottom - 14; }).map((e) => e.getAttribute('data-r'));
});
comprobar(!!seTapo || visiblesBajoAviso.length === 0, 'Un aviso que aparece encima del texto esconde su furigana sin esperar al scroll', visiblesBajoAviso.join(','));
await p.evaluate(() => document.getElementById('aviso').remove());

// Una respuesta que sigue llegando con la caja ya desplazada.
await p.evaluate(() => { document.getElementById('caja').scrollTop = 150; });
await p.waitForTimeout(400);
const creceBien = await p.evaluate(async () => {
  const hilo = document.getElementById('hilo');
  for (let i = 0; i < 12; i++) {
    const q = document.createElement('p');
    q.textContent = 'さらに続きの文章が届きます。';
    hilo.appendChild(q);
  }
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const e = [...document.querySelector('kotonoha-lector').shadowRoot.querySelectorAll('.rt')].find((x) => x.getAttribute('data-r') === 'としょかん');
  if (!e) return { ok: false };
  const w = document.createTreeWalker(document.getElementById('largo'), NodeFilter.SHOW_TEXT);
  w.nextNode();
  const i = w.currentNode.data.indexOf('図書館');
  const r = document.createRange();
  r.setStart(w.currentNode, i);
  r.setEnd(w.currentNode, i + 3);
  const a = r.getBoundingClientRect();
  const c = e.getBoundingClientRect();
  return { ok: Math.abs((c.left + c.right) / 2 - (a.left + a.right) / 2) < 3 && Math.abs(c.bottom - a.top) < 12, a: a.top, c: c.bottom };
});
comprobar(creceBien.ok, 'Si llega más texto con la caja desplazada, las lecturas no saltan', JSON.stringify(creceBien));

// Una tabla ancha dentro de la caja: dos scroll a la vez.
await p.evaluate(() => document.getElementById('ancha').scrollIntoView({ block: 'center' }));
await p.waitForTimeout(300);
await p.evaluate(() => { document.getElementById('ancha').scrollLeft = 1160; });
await p.waitForTimeout(600);
const ancha = await lecturaSobre('lejos', '言葉', 'ことば');
comprobar(ancha.ok, 'Una tabla ancha dentro de la caja sigue su propio scroll', ancha.detalle);
const hojas = await p.evaluate(() => document.querySelector('kotonoha-lector').shadowRoot.querySelectorAll('.hoja').length);
comprobar(hojas === 2, 'Con su propia hoja dentro de la otra', hojas);

// El clic sigue funcionando en lo que se ha desplazado.
const pFinal = await (async () => {
  await p.evaluate(() => document.getElementById('largo').scrollIntoView({ block: 'center' }));
  await p.waitForTimeout(400);
  return puntoDe('largo', '図書館');
})();
await p.mouse.click(pFinal.x, pFinal.y);
const fichaChat = await esperar(() => document.querySelector('kotonoha-overlay')?.shadowRoot?.querySelector('.ficha-palabra')?.textContent ?? null, undefined, 4000);
comprobar(fichaChat?.includes('図書館'), 'Un clic consulta la palabra', fichaChat);
await p.keyboard.press('Escape');

// Sin esta opción, el diseño no se mueve.
await fijar({ lectorInterlineado: false });
await p.waitForTimeout(700);
comprobar(!(await lineaDe('largo')).propio && !(await lineaDe('f2')).propio, 'Con la opción apagada, las líneas vuelven a como estaban');
comprobar(await p.evaluate(() => !document.getElementById('largo').hasAttribute('style')), 'Y no queda rastro en el HTML');
const sinAbrir = await lecturaSobre('largo', '図書館', 'としょかん');
comprobar(sinAbrir.ok, 'Y las lecturas se recolocan', sinAbrir.detalle);
await fijar({ lectorInterlineado: true });
await p.waitForTimeout(700);
comprobar((await lineaDe('largo')).alto >= 27, 'Al encenderla se vuelven a abrir');

await fijar({ lectorActivo: false });
await p.waitForTimeout(500);
const chatLimpio = await p.evaluate(() => ({ capa: !!document.querySelector('kotonoha-lector'), estilo: document.getElementById('largo').hasAttribute('style'), resaltes: CSS.highlights.size, animaciones: document.getAnimations().length }));
comprobar(!chatLimpio.capa && !chatLimpio.estilo && chatLimpio.resaltes === 0 && chatLimpio.animaciones === 0, 'Al apagar el lector no queda rastro', JSON.stringify(chatLimpio));

// ---------- Otros scrolls ----------

console.log('\n== Otros scrolls ==');
await fijar({ lectorActivo: true, lectorInterlineado: true });
await p.goto('https://paginas.test/cuerpo');
await esperar(() => Number(document.querySelector('kotonoha-overlay')?.dataset.kkRangos) > 0, undefined, 20000);
await p.waitForTimeout(600);
const docAntes = await lecturaSobre('uno', '図書館', 'としょかん');
comprobar(docAntes.ok, 'Un <body> con overflow, antes de desplazar', docAntes.detalle);
await p.evaluate(() => window.scrollTo(0, 40));
await p.waitForTimeout(400);
const docDespues = await lecturaSobre('uno', '図書館', 'としょかん');
comprobar(docDespues.ok, 'Su scroll es el del documento: la lectura no se mueve dos veces', docDespues.detalle);
const enPanel = await lecturaSobre('enpanel', '経済', 'けいざい');
comprobar(enPanel.ok, 'Un panel fijo con scroll tiene sus lecturas encima de su texto', enPanel.detalle);
await p.evaluate(async () => {
  document.getElementById('panel').scrollTop = 20;
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
});
const panelMovido = await lecturaSobre('enpanel', '経済', 'けいざい');
comprobar(panelMovido.ok, 'Y las sigue al desplazar el panel', panelMovido.detalle);
await p.evaluate(() => window.scrollTo(0, 140));
await p.waitForTimeout(400);
const panelQuieto = await lecturaSobre('enpanel', '経済', 'けいざい');
comprobar(panelQuieto.ok, 'Y al desplazar la página se queda donde está', panelQuieto.detalle);
await p.evaluate(() => {
  const q = document.createElement('p');
  q.id = 'funde';
  q.className = 'fundido';
  q.textContent = '少しずつ現れる言葉です。';
  document.getElementById('uno').after(q);
  window.scrollTo(0, 0);
});
await p.waitForTimeout(1500);
const fundido = await lecturaSobre('funde', '言葉', 'ことば');
comprobar(fundido.ok, 'Lo que aparece con un fundido también lleva su lectura al terminar', fundido.detalle);

if (errores.length) console.log('\nErrores en la página:', [...new Set(errores)].slice(0, 6));
comprobar(errores.length === 0, 'La página no da errores');
console.log(`\n${fallos ? `${fallos} comprobaciones fallaron` : 'Todas las comprobaciones pasaron'}`);
await contexto.close();
process.exit(fallos ? 1 : 0);
