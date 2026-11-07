// Recorre páginas reales con el lector: que no mueva nada, que pinte, que el clic consulte y que no rompa el sitio.
// Mira páginas públicas, sin iniciar sesión, con un perfil de pruebas. Guarda una captura de cada una.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/lector-real.mjs [parte-de-la-direccion...]
// Con KK_LENGUA=en, en páginas en inglés: una página en inglés tiene muchas más palabras que analizar.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const INGLES = process.env.KK_LENGUA === 'en';
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, INGLES ? '.perfil-lector-real-ingles' : '.perfil-lector-real'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', INGLES ? 'lector-real-ingles' : 'lector-real');
mkdirSync(CAPTURAS, { recursive: true });
rmSync(PERFIL, { recursive: true, force: true });

const SITIOS_INGLES = [
  ['Wikipedia', 'https://en.wikipedia.org/wiki/English_language'],
  ['Simple Wikipedia', 'https://simple.wikipedia.org/wiki/English_language'],
  ['Wiktionary', 'https://en.wiktionary.org/wiki/study'],
  ['Gutenberg', 'https://www.gutenberg.org/files/11/11-h/11-h.htm'],
  ['VOA Learning English', 'https://learningenglish.voanews.com/'],
  ['News in Levels', 'https://www.newsinlevels.com/'],
  ['BBC Learning English', 'https://www.bbc.co.uk/learningenglish'],
  ['BBC News', 'https://www.bbc.com/news'],
  ['The Guardian', 'https://www.theguardian.com/international'],
  ['NPR', 'https://www.npr.org/'],
  ['NASA', 'https://www.nasa.gov/'],
  ['Hacker News', 'https://news.ycombinator.com/'],
  ['MDN', 'https://developer.mozilla.org/en-US/docs/Web/HTML'],
  ['Python', 'https://docs.python.org/3/tutorial/index.html'],
  ['GitHub Docs', 'https://docs.github.com/en'],
  ['Amazon', 'https://www.amazon.com/'],
  // Estas no están en inglés: el lector no debe tocarlas.
  ['Wikipedia ES', 'https://es.wikipedia.org/wiki/Idioma_ingl%C3%A9s'],
  ['Wikipedia JA', 'https://ja.wikipedia.org/wiki/%E8%8B%B1%E8%AA%9E'],
];

const SITIOS_JAPONES = [
  ['Wikipedia', 'https://ja.wikipedia.org/wiki/%E6%97%A5%E6%9C%AC%E8%AA%9E'],
  ['Wikcionario', 'https://ja.wiktionary.org/wiki/%E5%8B%89%E5%BC%B7'],
  ['Aozora Bunko', 'https://www.aozora.gr.jp/cards/000148/files/789_14547.html'],
  ['NHK Easy', 'https://news.web.nhk/news/easy/'],
  ['NHK', 'https://www.nhk.or.jp/'],
  ['Yahoo Noticias', 'https://news.yahoo.co.jp/'],
  ['Asahi', 'https://www.asahi.com/'],
  ['Mainichi', 'https://mainichi.jp/'],
  ['Yomiuri', 'https://www.yomiuri.co.jp/'],
  ['Nikkei', 'https://www.nikkei.com/'],
  ['CNN Japón', 'https://www.cnn.co.jp/'],
  ['BBC Japonés', 'https://www.bbc.com/japanese'],
  ['ITmedia', 'https://www.itmedia.co.jp/news/'],
  ['Gigazine', 'https://gigazine.net/'],
  ['Qiita', 'https://qiita.com/'],
  ['Zenn', 'https://zenn.dev/'],
  ['note', 'https://note.com/'],
  ['Hatena', 'https://b.hatena.ne.jp/'],
  ['Syosetu', 'https://ncode.syosetu.com/n9669bk/1/'],
  ['Kakuyomu', 'https://kakuyomu.jp/'],
  ['MDN', 'https://developer.mozilla.org/ja/docs/Web/HTML'],
  ['Python', 'https://docs.python.org/ja/3/tutorial/index.html'],
  ['Jisho', 'https://jisho.org/search/%E5%8B%89%E5%BC%B7'],
  ['Weblio', 'https://www.weblio.jp/content/%E5%8B%89%E5%BC%B7'],
  ['Amazon', 'https://www.amazon.co.jp/'],
  ['Rakuten', 'https://www.rakuten.co.jp/'],
  ['Tabelog', 'https://tabelog.com/'],
  ['Shinjuku', 'https://www.city.shinjuku.lg.jp/'],
  ['Ameblo', 'https://ameblo.jp/'],
  ['Togetter', 'https://togetter.com/'],
  ['GitHub Docs', 'https://docs.github.com/ja'],
  ['Wikipedia ES', 'https://es.wikipedia.org/wiki/Idioma_japon%C3%A9s'],
];

const SITIOS = INGLES ? SITIOS_INGLES : SITIOS_JAPONES;
const pedidos = process.argv.slice(2);
const lista = pedidos.length ? SITIOS.filter(([n, u]) => pedidos.some((x) => (n + u).toLowerCase().includes(x.toLowerCase()))) : SITIOS;

const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1366, height: 860 },
  locale: INGLES ? 'en-US' : 'ja-JP',
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});
const sw = await recargarExtension(contexto);
const fijar = (c) => sw.evaluate(async (c) => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), ...c } });
}, c);
await fijar({ lectorActivo: false, lectorFurigana: 'todas', destino: 'memoria', ankiPuerto: 1, bienvenidaVista: true, idiomaInterfaz: 'es', lectorColor: true });

if (INGLES) {
  const id = new URL(sw.url()).host;
  const app = await contexto.newPage();
  await app.goto(`chrome-extension://${id}/app.html#/ajustes`);
  await app.waitForTimeout(1200);
  await app.locator('select[aria-label="Idioma que estudias"]').selectOption('en');
  await app.waitForTimeout(800);
  for (const d of ['wty-en-es', 'wty-en-es-gloss', 'wty-en-ipa', 'frecuencia-subtitulos']) {
    const r = await app.evaluate((d) => chrome.runtime.sendMessage({ canal: 'motor', metodo: 'instalarDiccionario', args: [d] }), d);
    if (!r?.ok) throw new Error(`${d}: ${r?.error ?? 'sin respuesta'}`);
  }
  await app.close();
  // En inglés, el peor caso: con la pronunciación sobre cada palabra.
  await fijar({ lectorFurigana: 'todas' });
}

// Cada elemento se compara consigo mismo, no con el que ocupe su lugar en la lista: un carrusel que reordena sus
// diapositivas descuadraría todo lo que va detrás, y parecería que se ha movido la página entera.
const fotoDiseno = (p) => p.evaluate(() => {
  const ids = (window.__kkIds ??= new WeakMap());
  window.__kkSiguiente ??= 0;
  const salida = {};
  const todos = document.querySelectorAll('body *');
  const paso = Math.max(1, Math.floor(todos.length / 1500));
  for (const e of todos) {
    let id = ids.get(e);
    if (id === undefined) {
      id = window.__kkSiguiente++;
      ids.set(e, id);
    }
    if (id % paso) continue;
    const c = e.getBoundingClientRect();
    salida[id] = `${Math.round(c.left)},${Math.round(c.top + scrollY)},${Math.round(c.width)},${Math.round(c.height)}`;
  }
  return { salida, ancho: document.documentElement.scrollWidth, alto: document.documentElement.scrollHeight, nodos: todos.length };
}).catch(() => null);

const distintos = (a, b) => (a && b ? Object.keys(a.salida).filter((k) => k in b.salida && a.salida[k] !== b.salida[k]).length : -1);
const ficha = (p) => p.evaluate(() => document.querySelector('kotonoha-overlay')?.shadowRoot?.querySelector('.ficha-palabra')?.textContent ?? null).catch(() => null);

/** Una palabra de un párrafo visible que no esté en un enlace, y otra en un enlace o botón. */
const buscarPuntos = (p) => p.evaluate((ingles) => {
  const KANJI = ingles ? /\b[A-Za-z]{5,}\b/ : /[㐀-鿿]{2,}/;
  const res = { texto: null, enlace: null };
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (w.nextNode() && !(res.texto && res.enlace)) {
    const n = w.currentNode;
    const el = n.parentElement;
    if (!el || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|INPUT|CODE|PRE|RT|RP)$/.test(el.tagName)) continue;
    const m = KANJI.exec(n.data);
    if (!m) continue;
    const r = document.createRange();
    r.setStart(n, m.index);
    r.setEnd(n, m.index + 1);
    const c = r.getBoundingClientRect();
    if (!c.width || c.top < 60 || c.bottom > innerHeight - 20 || c.left < 0 || c.right > innerWidth - 40) continue;
    const encima = document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2);
    if (encima !== el && !el.contains(encima)) continue;
    const interactivo = el.closest('a[href], button, [role="button"], [role="link"], summary, label') || getComputedStyle(el).cursor === 'pointer';
    const punto = { x: c.left + c.width / 2, y: c.top + c.height / 2, muestra: n.data.slice(m.index, m.index + 6) };
    if (interactivo && !res.enlace) res.enlace = punto;
    if (!interactivo && !res.texto) res.texto = punto;
  }
  return res;
}, INGLES).catch(() => ({ texto: null, enlace: null }));

const filas = [];
for (const [nombre, url] of lista) {
  const f = { sitio: nombre };
  const p = await contexto.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  try {
    await fijar({ lectorActivo: false, lectorInterlineado: false });
    await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await p.waitForLoadState('load', { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(2500);
    f.titulo = (await p.title()).slice(0, 30);
    // Lo que la página cambia sola, sin el lector: anuncios, carruseles. Sirve de referencia.
    const a0 = await fotoDiseno(p);
    await p.waitForTimeout(1200);
    const a1 = await fotoDiseno(p);
    f.ruidoPropio = distintos(a0, a1);
    const erroresAntes = errores.length;

    const t0 = Date.now();
    await fijar({ lectorActivo: true });
    let medidas = null;
    while (Date.now() - t0 < 15000) {
      medidas = await p.evaluate(() => { const h = document.querySelector('kotonoha-overlay'); return h ? { ...h.dataset } : null; }).catch(() => null);
      if (Number(medidas?.kkRangos) > 0 || Number(medidas?.kkLecturas) > 0) break;
      await p.waitForTimeout(150);
    }
    f.msPintar = Date.now() - t0;
    // Hasta que se haya analizado todo lo que queda cerca de la pantalla.
    while (Date.now() - t0 < 20000) {
      medidas = await p.evaluate(() => { const h = document.querySelector('kotonoha-overlay'); return h ? { ...h.dataset } : null; }).catch(() => null);
      if (medidas?.kkPendientes === '0' && medidas?.kkCerca === medidas?.kkAnalizados) break;
      await p.waitForTimeout(150);
    }
    f.msCompleto = Date.now() - t0;
    await p.waitForTimeout(700);
    medidas = await p.evaluate(() => { const h = document.querySelector('kotonoha-overlay'); return h ? { ...h.dataset } : null; }).catch(() => null);
    f.cerca = Number(medidas?.kkCerca ?? 0);
    f.analizados = Number(medidas?.kkAnalizados ?? 0);
    f.bloques = Number(medidas?.kkBloques ?? 0);
    f.rangos = Number(medidas?.kkRangos ?? 0);
    f.lecturas = Number(medidas?.kkLecturas ?? 0);
    f.tapadas = Number(medidas?.kkTapadas ?? 0);

    const a2 = await fotoDiseno(p);
    f.cambiosLector = distintos(a1, a2);
    f.anchoIgual = !!a1 && !!a2 && a1.ancho === a2.ancho;
    f.altoIgual = !!a1 && !!a2 && a1.alto === a2.alto;
    f.nodos = a1 && a2 ? a2.nodos - a1.nodos : null;
    await p.screenshot({ path: join(CAPTURAS, `${nombre.replace(/\W+/g, '-')}.png`) }).catch(() => {});

    // Lo mismo abriendo las líneas donde el furigana no cabe, que es lo que verá quien no toque nada.
    await fijar({ lectorInterlineado: true });
    await p.waitForTimeout(900);
    const a3 = await fotoDiseno(p);
    const m3a = await p.evaluate(() => { const h = document.querySelector('kotonoha-overlay'); return h ? { ...h.dataset } : null; }).catch(() => null);
    f.abiertos = Number(m3a?.kkAbiertos ?? 0);
    f.anchoAbierto = !!a2 && !!a3 && a2.ancho === a3.ancho;
    f.crece = a2 && a3 ? a3.alto - a2.alto : null;
    await p.screenshot({ path: join(CAPTURAS, `${nombre.replace(/\W+/g, '-')}-lineas.png`) }).catch(() => {});

    const puntos = await buscarPuntos(p);
    f.muestra = puntos.texto?.muestra ?? '';
    if (puntos.texto) {
      const urlAntes = p.url();
      await p.mouse.click(puntos.texto.x, puntos.texto.y);
      let fl = null;
      for (let i = 0; i < 40 && !fl; i++) {
        await p.waitForTimeout(100);
        fl = await ficha(p);
      }
      f.clic = fl ? fl.slice(0, 12) : 'NADA';
      f.navego = p.url() !== urlAntes;
      if (fl) await p.screenshot({ path: join(CAPTURAS, `${nombre.replace(/\W+/g, '-')}-ficha.png`) }).catch(() => {});
      await p.keyboard.press('Escape');
      await p.waitForTimeout(150);
      f.seCerro = !(await ficha(p));
    } else {
      f.clic = '(sin texto a la vista)';
    }
    if (puntos.enlace && !f.navego) {
      await p.mouse.move(5, 5);
      await p.waitForTimeout(100);
      await p.mouse.move(puntos.enlace.x, puntos.enlace.y);
      let fl = null;
      for (let i = 0; i < 40 && !fl; i++) {
        await p.waitForTimeout(100);
        fl = await ficha(p);
      }
      f.enlaceAlPasar = fl ? fl.slice(0, 10) : 'NADA';
      await p.mouse.move(5, 5);
      await p.waitForTimeout(450);
    }
    // Bajar: lo nuevo se pinta, y la página sigue respondiendo.
    await p.mouse.wheel(0, 1500);
    await p.waitForTimeout(1400);
    const m2 = await p.evaluate(() => { const h = document.querySelector('kotonoha-overlay'); return h ? { ...h.dataset } : null; }).catch(() => null);
    f.lecturasTrasScroll = Number(m2?.kkLecturas ?? 0);
    f.erroresNuevos = errores.length - erroresAntes;
    f.ok = f.cambiosLector <= Math.max(f.ruidoPropio, 0) + 5 && f.anchoIgual && f.anchoAbierto && (f.nodos === 0 || f.ruidoPropio > 0) && !f.navego;

    // El camino de un usuario real: el lector ya está encendido cuando la página empieza a cargar.
    const q = await contexto.newPage();
    const t1 = Date.now();
    await q.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    let m3 = null;
    while (Date.now() - t1 < 20000) {
      m3 = await q.evaluate(() => { const h = document.querySelector('kotonoha-overlay'); return h ? { ...h.dataset } : null; }).catch(() => null);
      if (Number(m3?.kkCerca) > 0 && m3?.kkPendientes === '0' && m3?.kkCerca === m3?.kkAnalizados) break;
      await q.waitForTimeout(150);
    }
    f.msCarga = Date.now() - t1;
    f.cercaCarga = Number(m3?.kkCerca ?? 0);
    f.analizadosCarga = Number(m3?.kkAnalizados ?? 0);
    await q.close().catch(() => {});
  } catch (e) {
    f.error = String(e.message ?? e).split('\n')[0].slice(0, 90);
  }
  filas.push(f);
  console.log(JSON.stringify(f));
  await p.close().catch(() => {});
}

writeFileSync(join(CAPTURAS, 'resultados.json'), JSON.stringify(filas, null, 1));
const conLector = filas.filter((f) => f.bloques > 0);
console.log(`\n${filas.length} sitios, ${conLector.length} con ${INGLES ? 'inglés' : 'japonés'} analizado`);
console.log(`Diseño intacto: ${filas.filter((f) => f.ok).length}, con dudas: ${filas.filter((f) => f.ok === false).map((f) => f.sitio).join(', ') || 'ninguno'}`);
console.log(`Con las líneas abiertas: ${filas.filter((f) => f.abiertos > 0).map((f) => `${f.sitio} ${f.abiertos} (+${f.crece} px)`).join(', ') || 'ninguno'}`);
console.log(`Clic que abre la ficha: ${filas.filter((f) => f.clic && f.clic !== 'NADA' && !f.clic.startsWith('(')).length}, sin respuesta: ${filas.filter((f) => f.clic === 'NADA').map((f) => f.sitio).join(', ') || 'ninguno'}`);
console.log(`Sin analizar del todo: ${filas.filter((f) => f.cerca !== f.analizados || f.cercaCarga !== f.analizadosCarga).map((f) => f.sitio).join(', ') || 'ninguno'}`);
const conEnlace = filas.filter((f) => f.enlaceAlPasar);
console.log(`Enlaces al pasar el ratón: ${conEnlace.filter((f) => f.enlaceAlPasar !== 'NADA').length} de ${conEnlace.length}, sin respuesta: ${conEnlace.filter((f) => f.enlaceAlPasar === 'NADA').map((f) => f.sitio).join(', ') || 'ninguno'}`);
console.log(`Errores al cargar: ${filas.filter((f) => f.error).map((f) => `${f.sitio}: ${f.error}`).join(' | ') || 'ninguno'}`);
await contexto.close();
process.exit(0);
