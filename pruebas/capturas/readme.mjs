// Las imágenes del README en cada idioma de la interfaz: la ficha sobre el video, un EPUB de texto en el visor y una
// página leída con el OCR. Con la interfaz en japonés se estudia inglés, que es lo que tiene sentido para quien habla
// japonés. Los textos son de dominio público (Natsume Sōseki, Lewis Carroll) o están escritos para esto; la API de
// Claude es la simulada y los diccionarios, los del perfil base.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/capturas/readme.mjs [es en de zh ko ja]

import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, resolve } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { recargarExtension } from '../extension.mjs';
import { iniciarMock } from '../mock-claude.mjs';

const RAIZ = resolve(import.meta.dirname, '..', '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-readme'));
const IMAGENES = join(RAIZ, 'docs', 'img');
const IDIOMAS = process.argv.slice(2).length ? process.argv.slice(2) : ['es', 'en', 'zh', 'ko', 'de', 'ja'];

// La primera vez, el perfil parte de los diccionarios de japonés del perfil base: no hace falta descargarlos otra vez.
if (!existsSync(PERFIL) && existsSync(join(RAIZ, '.perfil-base', 'Default', 'IndexedDB'))) {
  cpSync(join(RAIZ, '.perfil-base', 'Default', 'IndexedDB'), join(PERFIL, 'Default', 'IndexedDB'), { recursive: true });
}

/** El nombre con que los ajustes guardan cada idioma de traducción y de explicaciones. */
const NOMBRE = { es: 'español', en: 'inglés', de: 'alemán', zh: 'chino simplificado', ko: 'coreano', ja: 'japonés' };
const tabla = (id) => (id === 'es' ? {} : JSON.parse(readFileSync(join(RAIZ, 'idiomas', `${id}.json`), 'utf8')));
const nombreArchivo = (base, id) => join(IMAGENES, id === 'es' ? `${base}.png` : `${base}.${id}.png`);

/** Guarda la captura como PNG de paleta: se ve igual y pesa varias veces menos. */
async function guardar(p, base, id) {
  const crudo = await p.screenshot();
  await sharp(crudo).png({ palette: true, quality: 92, effort: 10 }).toFile(nombreArchivo(base, id));
  console.log('  imagen:', nombreArchivo(base, id).slice(RAIZ.length + 1));
}

// ---------- Los textos ----------

const VTT = {
  ja: ['泥だらけの道でも花は咲いた', '授業の後は、たぶん日本語の勉強を続けると思います。', '赤い星と青い星を食べる夢を見た', '一日でも休むと、ペースが遅れてしまうので', 'できるだけ毎日やるようにしています', '私はまだ立ち上がることができます'],
  es: ['Incluso en un camino lleno de barro, la flor brotó', 'Después de clase, probablemente seguiré estudiando japonés.', 'Soñé que devoraba estrellas rojas y azules', 'Si descanso aunque sea un día, me atraso', 'Así que intento hacerlo todos los días', 'Todavía puedo volver a levantarme'],
  en: ['Even on a muddy road, the flower bloomed', 'After class, I think I’ll probably keep studying Japanese.', 'I dreamed I devoured red and blue stars', 'If I take even one day off, I fall behind', 'so I try to do it every day if I can', 'I can still get back up'],
  de: ['Selbst auf einem schlammigen Weg blühte die Blume', 'Nach dem Unterricht lerne ich wohl weiter Japanisch.', 'Ich träumte, ich verschlänge rote und blaue Sterne', 'Wenn ich auch nur einen Tag pausiere, falle ich zurück', 'deshalb versuche ich, es möglichst jeden Tag zu tun', 'Ich kann noch wieder aufstehen'],
  zh: ['即使在泥泞的路上，花也开了', '下课后，我想我大概会继续学日语。', '我梦见自己吞下了红色和蓝色的星星', '哪怕休息一天，进度也会落后', '所以我尽量每天都做', '我还能再站起来'],
  ko: ['진흙투성이 길에서도 꽃은 피었다', '수업이 끝나면 아마 일본어 공부를 계속할 것 같아요.', '빨간 별과 파란 별을 삼키는 꿈을 꿨다', '하루라도 쉬면 진도가 늦어져서', '되도록 매일 하려고 해요', '나는 아직 다시 일어설 수 있어요'],
};
const TIEMPOS = ['00:00:01.000 --> 00:00:04.000', '00:00:05.000 --> 00:00:08.000', '00:00:09.000 --> 00:00:12.000', '00:00:14.000 --> 00:00:17.000', '00:00:18.000 --> 00:00:21.000', '00:00:42.000 --> 00:00:48.000'];
const vtt = (lineas) => `WEBVTT\n\n${lineas.map((l, i) => `${TIEMPOS[i]}\n${l}`).join('\n\n')}\n`;

// Natsume Sōseki, «Wagahai wa neko de aru» (1905), de dominio público. Con ruby, como en un EPUB japonés.
const SOSEKI = [
  '<ruby>吾輩<rt>わがはい</rt></ruby>は猫である。名前はまだ無い。',
  'どこで生れたかとんと<ruby>見当<rt>けんとう</rt></ruby>がつかぬ。何でも<ruby>薄暗<rt>うすぐら</rt></ruby>いじめじめした所でニャーニャー泣いていた事だけは記憶している。吾輩はここで始めて人間というものを見た。しかもあとで聞くとそれは書生という人間中で一番<ruby>獰悪<rt>どうあく</rt></ruby>な種族であったそうだ。',
  'この書生というのは時々我々を<ruby>捕<rt>つかま</rt></ruby>えて煮て食うという話である。しかしその当時は何という考もなかったから別段恐しいとも思わなかった。ただ彼の<ruby>掌<rt>てのひら</rt></ruby>に載せられてスーと持ち上げられた時何だかフワフワした感じがあったばかりである。',
  '掌の上で少し落ちついて書生の顔を見たのがいわゆる人間というものの<ruby>見始<rt>みはじめ</rt></ruby>であろう。この時妙なものだと思った感じが今でも残っている。第一毛をもって装飾されべきはずの顔がつるつるしてまるで<ruby>薬缶<rt>やかん</rt></ruby>だ。',
  'その後猫にもだいぶ逢ったがこんな<ruby>片輪<rt>かたわ</rt></ruby>には一度も出会わした事がない。のみならず顔の真中があまりに突起している。そうしてその穴の中から時々ぷうぷうと煙を吹く。どうも咽せぽくて実に弱った。',
  'この書生の掌の裏でしばらくはよい心持に<ruby>坐<rt>すわ</rt></ruby>っておったが、しばらくすると非常な<ruby>速力<rt>そくりょく</rt></ruby>で運転し始めた。書生が動くのか自分だけが動くのか分らないが<ruby>無暗<rt>むやみ</rt></ruby>に眼が<ruby>廻<rt>まわ</rt></ruby>る。胸が悪くなる。<ruby>到底<rt>とうてい</rt></ruby>助からないと思っていると、どさりと音がして眼から火が出た。',
  'それまでは記憶しているがあとは何の事やらいくら考え出そうとしても分らない。ふと気が付いて見ると書生はいない。たくさんおった兄弟が一疋も見えぬ。<ruby>肝心<rt>かんじん</rt></ruby>の母親さえ姿を隠してしまった。',
  'その上今までの所とは違って無暗に明るい。眼を明いていられぬくらいだ。はてな何でも<ruby>容子<rt>ようす</rt></ruby>がおかしいと、のそのそ這い出して見ると非常に痛い。吾輩は<ruby>藁<rt>わら</rt></ruby>の上から急に<ruby>笹原<rt>ささはら</rt></ruby>の中へ棄てられたのである。',
  'ようやくの思いで笹原を這い出すと向うに大きな池がある。吾輩は池の前に坐ってどうしたらよかろうと考えて見た。別にこれという<ruby>分別<rt>ふんべつ</rt></ruby>も出ない。しばらくして泣いたら書生がまた迎に来てくれるかと考え付いた。',
  'ニャー、ニャーと試みにやって見たが誰も来ない。そのうち池の上をさらさらと風が渡って日が暮れかかる。腹が非常に減って来た。泣きたくても声が出ない。仕方がない、何でもよいから<ruby>食物<rt>くいもの</rt></ruby>のある所まであるこうと決心をしてそろりそろりと池を左りに廻り始めた。',
];
// Lewis Carroll, «Alice’s Adventures in Wonderland» (1865), de dominio público.
const CARROLL = [
  'Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, “and what is the use of a book,” thought Alice “without pictures or conversations?”',
  'So she was considering in her own mind (as well as she could, for the hot day made her feel very sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.',
  'There was nothing so very remarkable in that; nor did Alice think it so very much out of the way to hear the Rabbit say to itself, “Oh dear! Oh dear! I shall be late!” (when she thought it over afterwards, it occurred to her that she ought to have wondered at this, but at the time it all seemed quite natural).',
];

function epub({ titulo, autor, idioma, vertical, capitulo, parrafos }) {
  const css = vertical
    ? 'html.vrtl { -epub-writing-mode: vertical-rl; writing-mode: vertical-rl; } body { font-family: serif; line-height: 1.9; } h2 { font-size: 1.4em; margin: 0 0 0 1.5em; } p { margin: 0; text-indent: 1em; } rt { font-size: 0.5em; }'
    : 'body { font-family: Georgia, "Times New Roman", serif; line-height: 1.7; } h2 { font-size: 1.6em; margin: 0 0 1em; font-weight: normal; letter-spacing: 0.02em; } p { margin: 0 0 0.9em; text-indent: 1.5em; text-align: justify; } p:first-of-type::first-letter { font-size: 2.4em; float: left; line-height: 1; margin: 0.05em 0.08em 0 0; }';
  const xhtml = `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${idioma}"${vertical ? ' class="vrtl"' : ''}><head><title>${capitulo}</title><link rel="stylesheet" href="estilo.css"/></head><body><h2>${capitulo}</h2>${parrafos.map((p) => `<p>${p}</p>`).join('')}</body></html>`;
  return zipSync({
    mimetype: [strToU8('application/epub+zip'), { level: 0 }],
    'META-INF/container.xml': strToU8('<?xml version="1.0"?><container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>'),
    'OEBPS/content.opf': strToU8(`<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${titulo}</dc:title><dc:creator>${autor}</dc:creator><dc:language>${idioma}</dc:language></metadata><manifest><item id="css" href="estilo.css" media-type="text/css"/><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/></manifest><spine${vertical ? ' page-progression-direction="rtl"' : ''}><itemref idref="c1"/></spine></package>`),
    'OEBPS/estilo.css': strToU8(css),
    'OEBPS/c1.xhtml': strToU8(xhtml),
  });
}

/** Una página impresa, como la de un libro escaneado: papel claro, un título y unos renglones. */
async function pagina({ titulo, lineas, letra, numero }) {
  const ancho = 1240;
  const alto = 1754;
  const texto = (t, x, y, tam, peso = 400) => `<text x="${x}" y="${y}" font-size="${tam}" font-weight="${peso}" font-family="${letra}" fill="#26221d">${t}</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}"><rect width="100%" height="100%" fill="#f6f1e6"/>${texto(titulo, 150, 260, 64, 700)}<rect x="150" y="300" width="940" height="3" fill="#8b7f6a"/>${lineas.map((l, i) => texto(l, 150, 440 + i * 96, 40)).join('')}${texto(String(numero), ancho / 2 - 12, alto - 110, 30)}</svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
}
const cbz = (titulo, imagen) => zipSync({ 'ComicInfo.xml': strToU8(`<ComicInfo><Title>${titulo}</Title><Manga>No</Manga></ComicInfo>`), 'p001.jpg': new Uint8Array(imagen) });

const LIBROS = {
  ja: {
    epub: { titulo: '吾輩は猫である', archivo: 'soseki.epub', datos: epub({ titulo: '吾輩は猫である', autor: '夏目漱石', idioma: 'ja', vertical: true, capitulo: '一', parrafos: SOSEKI }) },
    pagina: {
      titulo: '町の図書館',
      archivo: 'biblioteca.cbz',
      lineas: ['日本の町には、小さな図書館がたくさんあります。', '週末になると、子どもから大人まで多くの人が本を', '借りに来ます。最近は、外国語の本や漫画を置く図', '書館も増えてきました。静かな部屋で新聞を読む人', 'もいれば、試験の勉強をする学生もいます。図書館', 'は、だれでも自由に使える大切な場所です。'],
      letra: "'Yu Mincho','MS Mincho',serif",
    },
    palabraEpub: '人間',
    palabraPagina: '週末',
  },
  en: {
    epub: { titulo: 'Alice’s Adventures in Wonderland', archivo: 'carroll.epub', datos: epub({ titulo: 'Alice’s Adventures in Wonderland', autor: 'Lewis Carroll', idioma: 'en', vertical: false, capitulo: 'Chapter I. Down the Rabbit-Hole', parrafos: CARROLL }) },
    pagina: {
      titulo: 'The Town Library',
      archivo: 'library.cbz',
      lineas: ['Every town in Japan has a small public library.', 'On weekends, people of all ages come to borrow', 'books. Recently, many libraries have added comics', 'and books in other languages. Some visitors read', 'the newspaper in a quiet room, while students', 'prepare for exams. A library is a place that', 'everyone can use freely.'],
      letra: "Georgia,'Times New Roman',serif",
    },
    palabraEpub: 'considering',
    palabraPagina: 'borrow',
  },
};

// ---------- El navegador ----------

const mock = await iniciarMock();
const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1280, height: 720 },
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--autoplay-policy=no-user-gesture-required', '--mute-audio', '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const sw = await recargarExtension(contexto);
const idExt = new URL(sw.url()).host;
for (const pg of contexto.pages()) if (pg.url().includes('app.html')) await pg.close();
// La ventana de la aplicación pone en marcha el motor; mientras arranca, no contesta.
const app = await contexto.newPage();
await app.goto(`chrome-extension://${idExt}/app.html#/inicio`);
const motor = async (metodo, ...args) => {
  for (let intento = 0; ; intento++) {
    const r = await app.evaluate(({ metodo, args }) => chrome.runtime.sendMessage({ canal: 'motor', metodo, args }), { metodo, args }).catch(() => null);
    if (r?.ok) return r.valor;
    if (intento > 40 || r?.error) throw new Error(`${metodo}: ${r?.error ?? 'sin respuesta'}`);
    await app.waitForTimeout(250);
  }
};
const ajustar = (cambios) =>
  sw.evaluate(async (c) => {
    const d = await chrome.storage.local.get('ajustes');
    await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), ...c } });
  }, cambios);
await sw.evaluate(async (url) => chrome.storage.local.set({ urlBaseIA: url, claveAnthropic: 'clave-de-prueba' }), `http://127.0.0.1:${mock.puerto}`);

/** Deja instalados justo estos diccionarios de términos, en este orden, además de los de acento y frecuencia. */
async function diccionarios(lengua, terminos, otros = []) {
  await motor('fijarLengua', lengua);
  const instalados = () => motor('estado').then((e) => e.diccionarios);
  for (const d of await instalados()) if (d.tipo === 'terminos' && !terminos.includes(d.id)) await motor('eliminarDiccionario', d.id);
  const ya = new Set((await instalados()).map((d) => d.id));
  for (const id of [...terminos, ...otros]) {
    if (ya.has(id)) continue;
    const t0 = Date.now();
    await motor('instalarDiccionario', id);
    console.log(`  instalado ${id} en ${Math.round((Date.now() - t0) / 1000)} s`);
  }
  await motor('ordenarDiccionarios', [...terminos, ...otros]).catch(() => {});
}

/** Sin respuestas ni análisis guardados: la ficha tiene que preguntar a la API simulada en el idioma de cada captura. */
const olvidarRespuestas = () =>
  sw.evaluate(async () => {
    for (const { name } of await indexedDB.databases()) {
      if (!/^kikitori/.test(name)) continue;
      await new Promise((ok) => {
        const q = indexedDB.open(name);
        q.onsuccess = () => {
          const d = q.result;
          const tablas = ['cacheIA', 'analisis'].filter((t) => d.objectStoreNames.contains(t));
          if (!tablas.length) {
            d.close();
            return ok();
          }
          const tx = d.transaction(tablas, 'readwrite');
          for (const t of tablas) tx.objectStore(t).clear();
          tx.oncomplete = () => {
            d.close();
            ok();
          };
        };
      });
    }
  });

// ---------- La ficha sobre el video ----------

async function video(id) {
  const servidor = await new Promise((ok) => {
    const s = createServer((req, res) => {
      res.setHeader('access-control-allow-origin', '*');
      if (req.url === '/') {
        res.setHeader('content-type', 'text/html; charset=utf-8');
        res.end(`<!doctype html><html lang="ja"><meta charset="utf-8"><title>夜明けの星</title><body style="margin:0;background:#0b0b0d"><video id="v" src="/video.webm" muted style="position:fixed;inset:0;width:100%;height:100%;object-fit:contain;background:#000"><track kind="subtitles" srclang="ja" label="日本語" src="/ja.vtt"><track kind="subtitles" srclang="${id}" label="${id}" src="/apoyo.vtt"></video></body></html>`);
      } else if (req.url === '/ja.vtt' || req.url === '/apoyo.vtt') {
        res.setHeader('content-type', 'text/vtt; charset=utf-8');
        res.end(vtt(req.url === '/ja.vtt' ? VTT.ja : VTT[id]));
      } else if (req.url === '/video.webm') {
        const datos = readFileSync(join(RAIZ, 'pruebas', 'fixtures', 'video.webm'));
        res.setHeader('content-type', 'video/webm');
        res.setHeader('accept-ranges', 'bytes');
        const r = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? '');
        if (r) {
          const ini = +r[1];
          const fin = r[2] ? +r[2] : datos.length - 1;
          res.statusCode = 206;
          res.setHeader('content-range', `bytes ${ini}-${fin}/${datos.length}`);
          res.end(datos.subarray(ini, fin + 1));
        } else res.end(datos);
      } else {
        res.statusCode = 404;
        res.end();
      }
    });
    s.listen(0, '127.0.0.1', () => ok(s));
  });
  const p = await contexto.newPage();
  await p.setViewportSize({ width: 1280, height: 720 });
  await p.goto(`http://127.0.0.1:${servidor.address().port}/`);
  await p.waitForTimeout(800);
  await sw.evaluate(async () => {
    const [t] = await chrome.tabs.query({ url: 'http://127.0.0.1/*' });
    for (let intento = 0; ; intento++) {
      try {
        await chrome.tabs.sendMessage(t.id, { activarVideoAqui: true });
        break;
      } catch (e) {
        if (intento > 40) throw e;
        await new Promise((r) => setTimeout(r, 250));
      }
    }
  });
  const enSombra = (fn, arg) => p.evaluate(({ fn, arg }) => new Function('r', 'arg', `return (${fn})(r, arg)`)(document.querySelector('kotonoha-overlay')?.shadowRoot, arg), { fn: fn.toString(), arg });
  await p.waitForFunction(() => document.querySelector('kotonoha-overlay')?.shadowRoot?.querySelector('.barra'), null, { timeout: 30000 });
  await p.evaluate(() => {
    const v = document.querySelector('#v');
    v.pause();
    v.currentTime = 10;
  });
  await p.waitForFunction(() => document.querySelector('kotonoha-overlay')?.shadowRoot?.querySelector('.linea-sub.objetivo .pal'), null, { timeout: 30000 });
  await p.waitForTimeout(3000);
  const caja = await enSombra((r) => {
    const e = [...r.querySelectorAll('.linea-sub.objetivo .pal')].find((x) => x.textContent.includes('食'));
    const c = e?.getBoundingClientRect();
    return c ? { x: c.left + c.width / 2, y: c.top + c.height / 2 } : null;
  });
  await p.mouse.move(caja.x, caja.y, { steps: 6 });
  await p.waitForFunction(() => document.querySelector('kotonoha-overlay')?.shadowRoot?.querySelector('.ficha'), null, { timeout: 15000 });
  await p.waitForTimeout(2200);
  await guardar(p, 'ficha', id);
  await p.close();
  servidor.close();
}

// ---------- Los libros ----------

async function biblioteca(datos) {
  const b = await contexto.newPage();
  await b.setViewportSize({ width: 1280, height: 800 });
  await b.goto(`chrome-extension://${idExt}/app.html#/biblioteca`);
  await b.waitForSelector('.ap-libro, .ap-vacio', { timeout: 20000 });
  // La estantería del perfil de capturas solo tiene los libros de muestra: se vacía y se importan de nuevo, como estén ahora.
  const libros = () => b.locator('.ap-libro').count();
  for (let n = await libros(); n > 0; n = await libros()) {
    await b.locator('.ap-libro-quitar').first().click({ force: true });
    await b.waitForFunction((antes) => document.querySelectorAll('.ap-libro').length < antes, n, { timeout: 15000 });
  }
  const imagen = await pagina({ ...datos.pagina, numero: 12 });
  await b.setInputFiles('input[type=file]', [
    { name: datos.epub.archivo, mimeType: 'application/epub+zip', buffer: Buffer.from(datos.epub.datos) },
    { name: datos.pagina.archivo, mimeType: 'application/zip', buffer: Buffer.from(cbz(datos.pagina.titulo, imagen)) },
  ]);
  await b.waitForFunction(() => document.querySelectorAll('.ap-libro').length >= 2, null, { timeout: 30000 });
  return b;
}

async function abrir(b, titulo) {
  const nueva = contexto.waitForEvent('page', { timeout: 20000 });
  await b.locator(`button.ap-tapa[aria-label*="${titulo}"]`).first().click();
  const v = await nueva;
  await v.setViewportSize({ width: 1280, height: 800 });
  return v;
}

async function libroDeTexto(b, datos, id) {
  const v = await abrir(b, datos.epub.titulo);
  let f = null;
  for (let i = 0; i < 150 && !f; i++) {
    f = v.frames().find((x) => x.url().includes('/libro.html') && !x.isDetached()) ?? null;
    if (f && !(await f.evaluate(() => Number(document.querySelector('kotonoha-overlay')?.dataset.kkAnalizados ?? 0) > 0).catch(() => false))) f = null;
    await v.waitForTimeout(100);
  }
  if (!f) throw new Error('El EPUB no llegó a analizarse');
  await v.waitForTimeout(1500);
  const marco = await v.locator('iframe.vs-libro').boundingBox();
  const punto = await f.evaluate((palabra) => {
    const recorrer = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = recorrer.nextNode(); n; n = recorrer.nextNode()) {
      const i = n.data.indexOf(palabra);
      if (i < 0 || n.parentElement?.closest('rt')) continue;
      const r = document.createRange();
      r.setStart(n, i);
      r.setEnd(n, i + palabra.length);
      const c = r.getBoundingClientRect();
      if (c.width && c.left > 0 && c.right < innerWidth) return { x: c.left + c.width / 2, y: c.top + c.height / 2 };
    }
    return null;
  }, datos.palabraEpub);
  if (!punto) throw new Error(`No se ve «${datos.palabraEpub}» en el EPUB`);
  await v.mouse.click(marco.x + punto.x, marco.y + punto.y);
  await f.waitForFunction(() => document.querySelector('kotonoha-overlay')?.shadowRoot?.querySelector('.popup-palabra .ficha'), null, { timeout: 15000 });
  await v.waitForTimeout(1500);
  await guardar(v, 'libro-texto', id);
  await v.close();
}

async function paginaConOcr(b, datos, id) {
  const v = await abrir(b, datos.pagina.titulo);
  await v.waitForSelector('.vs-pagina img', { timeout: 20000 });
  const t = tabla(id);
  const leer = t['Leer el texto de las páginas'] ?? 'Leer el texto de las páginas';
  if ((await v.getAttribute(`[aria-label="${leer}"]`, 'aria-pressed')) !== 'true') await v.click(`[aria-label="${leer}"]`);
  await v.waitForFunction(() => document.querySelectorAll('.vs-linea').length >= 3, null, { timeout: 400000 });
  const caja = await v.evaluate((palabra) => {
    // La palabra en un renglón del texto, no en el título: el más largo de los que la tienen.
    const l = [...document.querySelectorAll('.vs-linea')].filter((x) => x.getAttribute('aria-label')?.includes(palabra)).sort((a, b) => b.getAttribute('aria-label').length - a.getAttribute('aria-label').length)[0];
    if (!l) return null;
    const texto = l.getAttribute('aria-label');
    const c = l.getBoundingClientRect();
    const k = texto.indexOf(palabra) + palabra.length / 2;
    return { x: c.left + (c.width * k) / texto.length, y: c.top + c.height / 2 };
  }, datos.palabraPagina);
  if (!caja) throw new Error(`El OCR no leyó «${datos.palabraPagina}»: ${await v.evaluate(() => [...document.querySelectorAll('.vs-linea')].map((x) => x.getAttribute('aria-label')).join(' | '))}`);
  await v.mouse.click(caja.x, caja.y);
  await v.waitForSelector('.vs-panel-linea .vs-ficha .ficha', { timeout: 20000 });
  await v.mouse.move(640, 790);
  await v.waitForTimeout(1500);
  await guardar(v, 'ocr', id);
  await v.close();
}

// ---------- El Portapapeles en inglés, para quien habla japonés ----------

const PORTAPAPELES_EN =
  'Our town library has opened a new reading room with large windows. On sunny days, you can read a book while enjoying the view of the mountains.\n\nAccording to the librarian, there will be story time for children every Saturday starting next month. People in town are glad to have another quiet place to spend their time.';

async function portapapeles(id) {
  await sw.evaluate((t) => chrome.storage.local.set({ lectorTexto: t }), PORTAPAPELES_EN);
  const p = await contexto.newPage();
  await p.setViewportSize({ width: 1280, height: 720 });
  await p.goto(`chrome-extension://${idExt}/lector.html`);
  await p.waitForFunction(() => document.querySelectorAll('.pal').length > 20, null, { timeout: 30000 });
  await p.waitForTimeout(2000);
  await guardar(p, 'lector-web', id);
  await p.close();
}

// ---------- Cada idioma ----------

mkdirSync(IMAGENES, { recursive: true });
for (const id of IDIOMAS) {
  console.log(`\n== ${id} ==`);
  const estudia = id === 'ja' ? 'en' : 'ja';
  mock.control.idioma = id;
  await ajustar({
    bienvenidaVista: true,
    idiomaInterfaz: id,
    idiomaObjetivo: estudia,
    idiomaTraduccion: NOMBRE[id],
    idiomaExplicaciones: NOMBRE[id],
    // La segunda línea de subtítulos, en el idioma de quien lee.
    idiomaSecundario: id,
    tema: 'oscuro',
    navegadorAbierto: false,
    modo: 'normal',
    salto: 'no',
    desanclarBarra: false,
    subsPosicion: null,
    destino: 'memoria',
    ankiPuerto: 1,
  });
  // Los diccionarios que tendría quien usa la extensión en ese idioma: el suyo y, de respaldo, el inglés.
  if (estudia === 'ja') await diccionarios('ja', id === 'es' ? ['jmdict-es', 'jmdict-en'] : id === 'de' ? ['jmdict-de', 'jmdict-en'] : ['jmdict-en']);
  else await diccionarios('en', ['wty-en-ja', 'wty-en-ja-gloss'], ['wty-en-ipa', 'frecuencia-subtitulos']);
  await olvidarRespuestas();
  if (estudia === 'ja') await video(id);
  else await portapapeles(id);
  const datos = LIBROS[estudia];
  const b = await biblioteca(datos);
  await libroDeTexto(b, datos, id);
  await paginaConOcr(b, datos, id);
  await b.close();
}

await contexto.close();
mock.servidor.close();
process.exit(0);
