// Las imágenes del README en cada idioma de la interfaz: la ficha sobre el video, el libro del visor (el Genji ilustrado
// de 1650, escaneado, en los README que presentan el japonés; un EPUB de texto en el japonés), una página leída con el
// OCR y una de manga. Con la interfaz en japonés se estudia inglés, que es lo que tiene sentido para
// quien habla japonés. Todo el contenido es real (ver contenido-real.mjs): el video es un discurso en la Dieta publicado
// por el 首相官邸, con su texto oficial; el EPUB, el Genji de Yosano Akiko o «Alice’s Adventures in Wonderland»; la
// página en inglés, la de la edición de 1866, y el texto del lector, el comienzo de «Pride and Prejudice». La API de
// Claude es la simulada y los diccionarios, los del perfil base. Antes: node herramientas/contenido-readme.mjs.
// Las páginas en japonés salen de libros que no están en el repositorio, con KK_ESCANEO="<pdf>|<página>|<palabra>" (un
// libro escaneado, en modo Libro) y KK_MANGA="<epub o pdf>|<página>|<palabra>" (en modo Manga): la página, contada
// desde 1 como en el visor, y la palabra cuya ficha se abre. Sin ellas no hay imagen del OCR ni del manga en japonés.
// El vocabulario es el del mismo EPUB, con las palabras más fáciles marcadas como conocidas mientras se fotografía.
// KK_SOLO="vocabulario" (o una lista separada por comas de video, libro, ocr, manga y vocabulario) rehace solo esas
// imágenes: así no se pierden las de los libros reales al rehacer otra.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/capturas/readme.mjs [es en de zh ko ja]

import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, resolve } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { confirmarBorrado, recargarExtension } from '../extension.mjs';
import { iniciarMock } from '../mock-claude.mjs';
import { estadoOrden, orden } from '../ordenes.mjs';
import { ALICE_1866, archivoLibre, AUSTEN, DIETA, GENJI, GENJI_1650, genji, servirVideo, traduccionDieta, vtt } from './contenido-real.mjs';

const RAIZ = resolve(import.meta.dirname, '..', '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-readme'));
const IMAGENES = join(RAIZ, 'docs', 'img');
const IDIOMAS = process.argv.slice(2).length ? process.argv.slice(2) : ['es', 'en', 'zh', 'ko', 'de', 'ja'];
const SOLO = process.env.KK_SOLO?.split(',').map((x) => x.trim());
const hacer = (captura) => !SOLO || SOLO.includes(captura);

// La primera vez, el perfil parte de los diccionarios de japonés del perfil base: no hace falta descargarlos otra vez.
if (!existsSync(PERFIL) && existsSync(join(RAIZ, '.perfil-base', 'Default', 'IndexedDB'))) {
  cpSync(join(RAIZ, '.perfil-base', 'Default', 'IndexedDB'), join(PERFIL, 'Default', 'IndexedDB'), { recursive: true });
}

/** El nombre con que los ajustes guardan cada idioma de traducción y de explicaciones. */
const NOMBRE = { es: 'español', en: 'inglés', de: 'alemán', zh: 'chino simplificado', ko: 'coreano', ja: 'japonés' };
const tabla = (id) => (id === 'es' ? {} : JSON.parse(readFileSync(join(RAIZ, 'idiomas', `${id}.json`), 'utf8')));
const nombreArchivo = (base, id) => join(IMAGENES, id === 'es' ? `${base}.png` : `${base}.${id}.png`);

/** Un libro real para una captura, de su variable: «ruta|página|palabra». */
function libroReal(variable, modo, base) {
  const valor = process.env[variable];
  if (!valor) return null;
  const [ruta, pagina, palabra] = valor.split('|');
  if (!existsSync(ruta) || !(Number(pagina) > 0) || !palabra) throw new Error(`${variable} tiene que ser «ruta|página|palabra», con un archivo que exista`);
  return { ruta: resolve(ruta), pagina: Number(pagina), palabra, modo, base };
}
const ESCANEO = libroReal('KK_ESCANEO', 'libro', 'ocr');
const MANGA = libroReal('KK_MANGA', 'manga', 'manga');

/** Guarda la captura como PNG de paleta: se ve igual y pesa varias veces menos. */
async function guardar(p, base, id) {
  const crudo = await p.screenshot();
  await sharp(crudo).png({ palette: true, quality: 92, effort: 10 }).toFile(nombreArchivo(base, id));
  console.log('  imagen:', nombreArchivo(base, id).slice(RAIZ.length + 1));
}

// ---------- Los textos ----------

// El Genji de Yosano Akiko: los primeros párrafos de 桐壺, con su ruby, como en un EPUB japonés.
const GENJI_PARRAFOS = genji(5);
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

const cbz = (titulo, imagen) => zipSync({ 'ComicInfo.xml': strToU8(`<ComicInfo><Title>${titulo}</Title><Manga>No</Manga></ComicInfo>`), 'p001.jpg': new Uint8Array(imagen) });

/** Un libro de imágenes de varias páginas, de derecha a izquierda como un libro japonés. */
const cbzDeDerechaAIzquierda = (titulo, imagenes) =>
  zipSync({
    'ComicInfo.xml': strToU8(`<ComicInfo><Title>${titulo}</Title><Manga>YesAndRightToLeft</Manga></ComicInfo>`),
    ...Object.fromEntries(imagenes.map((imagen, i) => [`p${String(i + 1).padStart(3, '0')}.jpg`, new Uint8Array(imagen)])),
  });

const LIBROS = {
  ja: {
    epub: { titulo: GENJI.titulo, archivo: 'genji.epub', datos: epub({ titulo: GENJI.titulo, autor: GENJI.autor, idioma: 'ja', vertical: true, capitulo: GENJI.capitulo, parrafos: GENJI_PARRAFOS }) },
    // El libro del visor en los README que presentan el japonés: el Genji ilustrado de 1650, escaneado.
    antiguo: GENJI_1650,
    // La página escaneada en japonés es la de KK_ESCANEO, de un libro de verdad: sin ella no hay imagen del OCR.
    pagina: null,
    texto: GENJI_PARRAFOS,
    palabraEpub: '後宮',
  },
  en: {
    epub: { titulo: 'Alice’s Adventures in Wonderland', archivo: 'carroll.epub', datos: epub({ titulo: 'Alice’s Adventures in Wonderland', autor: 'Lewis Carroll', idioma: 'en', vertical: false, capitulo: 'Chapter I. Down the Rabbit-Hole', parrafos: CARROLL }) },
    // La primera página del capítulo I en la edición de 1866, escaneada (Wikimedia Commons).
    // Un título que no contenga el del EPUB: las tapas se buscan por lo que contiene su etiqueta.
    pagina: { titulo: 'Wonderland · 1866', archivo: 'alice-1866.cbz', imagen: ALICE_1866.imagen },
    texto: CARROLL,
    palabraEpub: 'considering',
    palabraPagina: ALICE_1866.palabra,
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
        res.end(`<!doctype html><html lang="ja"><meta charset="utf-8"><title>${DIETA.titulo}</title><body style="margin:0;background:#0b0b0d"><video id="v" src="/video.webm" muted style="position:fixed;inset:0;width:100%;height:100%;object-fit:contain;background:#000"><track kind="subtitles" srclang="ja" label="日本語" src="/ja.vtt"><track kind="subtitles" srclang="${id}" label="${id}" src="/apoyo.vtt"></video></body></html>`);
      } else if (req.url === '/ja.vtt' || req.url === '/apoyo.vtt') {
        res.setHeader('content-type', 'text/vtt; charset=utf-8');
        res.end(vtt(req.url === '/ja.vtt' ? DIETA.lineas : traduccionDieta(id)));
      } else if (req.url === '/video.webm') {
        servirVideo(readFileSync(archivoLibre(DIETA.video)), req.headers.range, (estado, cuerpo, cabeceras) => {
          res.writeHead(estado, cabeceras);
          res.end(cuerpo);
        });
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
    // 「スタートアップは、技術を実用化していく主要な担い手です。」
    v.currentTime = 60;
  });
  await p.waitForFunction(() => document.querySelector('kotonoha-overlay')?.shadowRoot?.querySelector('.linea-sub.objetivo .pal'), null, { timeout: 30000 });
  await p.waitForTimeout(3000);
  const caja = await enSombra((r) => {
    const e = [...r.querySelectorAll('.linea-sub.objetivo .pal')].find((x) => x.textContent.includes('担'));
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

/** Las etiquetas de las tapas de la estantería («Leer …», en el idioma de la interfaz). */
const tapas = (b) => b.locator('button.ap-tapa').evaluateAll((l) => l.map((x) => x.getAttribute('aria-label')));

/** Importa unos archivos (rutas o contenidos) y devuelve las etiquetas de las tapas nuevas. */
async function importar(b, archivos) {
  const antes = await tapas(b);
  await b.setInputFiles('input[type=file][accept*=".epub"]', archivos);
  await b.waitForFunction((n) => document.querySelectorAll('button.ap-tapa').length >= n, antes.length + archivos.length, { timeout: 120000 });
  return (await tapas(b)).filter((t) => !antes.includes(t));
}

/** La estantería con los libros de esta captura: los de muestra y, si los hay, los reales. Devuelve la página y las
 *  etiquetas de las tapas de los reales, por su imagen («ocr», «manga»). */
async function biblioteca(datos, reales) {
  const b = await contexto.newPage();
  await b.setViewportSize({ width: 1280, height: 800 });
  await b.goto(`chrome-extension://${idExt}/app.html#/biblioteca`);
  await b.waitForSelector('.ap-libro, .ap-vacio', { timeout: 20000 });
  // La estantería del perfil de capturas solo tiene los libros de muestra: se vacía y se importan de nuevo, como estén ahora.
  const libros = () => b.locator('.ap-libro').count();
  for (let n = await libros(); n > 0; n = await libros()) {
    await b.locator('.ap-libro-quitar').first().click({ force: true });
    await confirmarBorrado(b);
    await b.waitForFunction((antes) => document.querySelectorAll('.ap-libro').length < antes, n, { timeout: 15000 });
  }
  const propios = [{ name: datos.epub.archivo, mimeType: 'application/epub+zip', buffer: Buffer.from(datos.epub.datos) }];
  if (datos.pagina && !reales.some((r) => r.base === 'ocr')) {
    const imagen = readFileSync(archivoLibre(datos.pagina.imagen));
    propios.push({ name: datos.pagina.archivo, mimeType: 'application/zip', buffer: Buffer.from(cbz(datos.pagina.titulo, imagen)) });
  }
  if (datos.antiguo) {
    const a = datos.antiguo;
    const imagenes = Array.from({ length: a.paginas }, (_, i) => readFileSync(archivoLibre(`${a.carpeta}/p${String(i + 1).padStart(3, '0')}.jpg`)));
    propios.push({ name: a.archivo, mimeType: 'application/zip', buffer: Buffer.from(cbzDeDerechaAIzquierda(a.titulo, imagenes)) });
  }
  await importar(b, propios);
  // Los reales, de uno en uno: así se sabe qué tapa es de cuál, se llame como se llame el libro.
  const etiquetas = {};
  for (const r of reales) {
    const [etiqueta] = await importar(b, [r.ruta]);
    if (!etiqueta) throw new Error(`No apareció en la estantería: ${r.ruta}`);
    etiquetas[r.base] = etiqueta;
  }
  return { b, etiquetas };
}

/** Abre en el visor el libro cuya tapa tiene ese título, o justo esa etiqueta. */
async function abrir(b, titulo, exacta = false) {
  const nueva = contexto.waitForEvent('page', { timeout: 20000 });
  await b.locator(`button.ap-tapa[aria-label${exacta ? '' : '*'}="${titulo}"]`).first().click();
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

/** El libro escaneado de 1650 en el visor: la doble página de la ilustración, elegida en el panel de miniaturas. */
async function libroAntiguo(b, datos, id) {
  const a = datos.antiguo;
  const v = await abrir(b, a.titulo);
  await v.waitForSelector('.vs-pagina img', { timeout: 30000 });
  if (!(await estadoOrden(v, 'miniaturas')).marcada) await orden(v, 'miniaturas');
  await v.waitForSelector('.vs-miniatura', { timeout: 15000 });
  await v.locator('.vs-miniatura').nth(a.abrir - 1).click();
  await v.waitForFunction((n) => [...document.querySelectorAll('.vs-miniatura')][n - 1]?.classList.contains('actual'), a.abrir, { timeout: 15000 });
  await v.waitForFunction(() => [...document.querySelectorAll('.vs-pagina img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 20000 });
  await v.mouse.move(640, 790);
  await v.waitForTimeout(1500);
  await guardar(v, 'libro-antiguo', id);
  await v.close();
}

async function paginaConOcr(b, datos, id) {
  const v = await abrir(b, datos.pagina.titulo);
  await v.waitForSelector('.vs-pagina img', { timeout: 20000 });
  // El OCR se enciende por la paleta (pruebas/ordenes.mjs), con el nombre de la orden, que no cambia con el idioma.
  if (!(await estadoOrden(v, 'ocr')).marcada) await orden(v, 'ocr');
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
  await v.waitForSelector('.vs-ventana .vs-ficha .ficha', { timeout: 20000 });
  await v.mouse.move(640, 790);
  await v.waitForTimeout(1500);
  await guardar(v, 'ocr', id);
  await v.close();
}

/** Una página de un libro real, leída con el OCR: la de un libro escaneado en modo Libro, ajustada al ancho para que se
 *  lea, o la de un manga en modo Manga, entera. Se abre el primer renglón o globo que tenga la palabra, y su ficha. */
async function paginaReal(b, etiqueta, real, id) {
  const t = tabla(id);
  const tr = (s) => t[s] ?? s;
  const v = await abrir(b, etiqueta, true);
  await v.waitForSelector('.vs-pagina img', { timeout: 60000 });
  const ir = v.locator(`input[aria-label="${tr('Ir a la página')}"]`);
  await ir.fill(String(real.pagina));
  await ir.press('Enter');
  const hoja = `.vs-pagina[data-pagina="${real.pagina}"]`;
  await v.waitForSelector(`${hoja} img`, { timeout: 60000 });
  // Las órdenes del visor van por la paleta (pruebas/ordenes.mjs): sus nombres no cambian con el idioma.
  const pulsar = async (id) => {
    if (!(await estadoOrden(v, id)).marcada) await orden(v, id);
  };
  await pulsar('vista-una');
  await pulsar(real.modo === 'libro' ? 'zoom-ancho' : 'zoom-pagina');
  await pulsar('ocr');
  await pulsar(real.modo === 'libro' ? 'ocr-libro' : 'ocr-manga');
  // La primera vez se descargan los modelos del modo: puede tardar.
  await v.waitForFunction((s) => document.querySelectorAll(s).length >= 3, `${hoja} .vs-linea`, { timeout: 900000 });
  await v.waitForTimeout(1000);
  const caja = await v.evaluate(
    ({ s, palabra, libro }) => {
      const l = [...document.querySelectorAll(s)].filter((x) => x.getAttribute('aria-label')?.includes(palabra)).sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
      if (!l) return null;
      const c = l.getBoundingClientRect();
      if (!libro) return { x: c.left + c.width / 2, y: c.top + c.height / 2 };
      // En un renglón horizontal, la palabra está más o menos donde le toca por su posición en el texto.
      const texto = l.getAttribute('aria-label');
      const k = texto.indexOf(palabra) + palabra.length / 2;
      return { x: c.left + (c.width * k) / texto.length, y: c.top + c.height / 2 };
    },
    { s: `${hoja} .vs-linea`, palabra: real.palabra, libro: real.modo === 'libro' },
  );
  if (!caja) throw new Error(`El OCR no leyó «${real.palabra}»: ${await v.evaluate((s) => [...document.querySelectorAll(s)].map((x) => x.getAttribute('aria-label')).join(' | '), `${hoja} .vs-linea`)}`);
  await v.mouse.click(caja.x, caja.y);
  await v.waitForSelector('.vs-ventana-texto .pal', { timeout: 20000 });
  if (real.modo === 'manga') {
    // Un globo se abre entero: la palabra se elige en la ventana, sin su furigana. Una palabra larga va partida en trozos.
    await v.waitForTimeout(500);
    const PALABRAS = '.vs-ventana-texto .pal:not(.trozo), .vs-ventana-texto .pal-partible';
    const indice = await v.evaluate(({ s, palabra }) => [...document.querySelectorAll(s)].findIndex((p) => {
      const copia = p.cloneNode(true);
      copia.querySelectorAll('rt, rp').forEach((r) => r.remove());
      return copia.textContent.trim() === palabra;
    }), { s: PALABRAS, palabra: real.palabra });
    if (indice < 0) throw new Error(`En el globo no está la palabra «${real.palabra}»`);
    await v.locator(PALABRAS).nth(indice).click();
  }
  await v.waitForSelector('.vs-ventana .vs-ficha .ficha', { timeout: 20000 });
  await v.mouse.move(640, 790);
  await v.waitForTimeout(2000);
  await guardar(v, real.base, id);
  await v.close();
}

// ---------- El vocabulario del EPUB ----------

/**
 * El vocabulario del EPUB de muestra, como lo vería quien ya sabe lo más básico: las palabras de N5 y N4, o las 1500
 * más comunes en inglés, se marcan como conocidas mientras se hace la foto, y después se dejan como estaban.
 */
async function vocabularioDeLibro(b, datos, estudia, id) {
  const libro = (await motor('bibliotecaListar')).find((e) => e.titulo === datos.epub.titulo);
  if (!libro) throw new Error(`No está en la estantería: ${datos.epub.titulo}`);
  const texto = datos.texto.map((p) => p.replace(/<rt>.*?<\/rt>/g, '').replace(/<[^>]+>/g, '')).join('\n');
  const cuenta = await motor('contarPalabras', [{ texto, lugar: 0 }]);
  const datosPalabras = await motor('datosPalabras', cuenta.palabras.map(({ clave, lema, lectura, categoria, gramatica }) => ({ clave, lema, lectura, categoria, gramatica })));
  const faciles = cuenta.palabras.filter((p, i) => {
    const d = datosPalabras[i];
    return d.estado === 'desconocida' && (estudia === 'ja' ? d.nivel === 'N5' || d.nivel === 'N4' : (d.rango ?? Infinity) <= 1500);
  });
  await motor('cambiarPalabras', faciles.map((p) => ({ clave: p.clave, lema: p.lema, lectura: p.lectura, estado: 'conocida' })));
  try {
    await b.setViewportSize({ width: 1280, height: 1080 });
    await b.goto('about:blank');
    await b.goto(`chrome-extension://${idExt}/app.html#/vocabulario?libro=${encodeURIComponent(libro.id)}`);
    await b.waitForSelector('.ap-voc-lista', { timeout: 60000 });
    await b.waitForFunction(() => !document.querySelector('.ap-voc-esqueleto'), null, { timeout: 30000 });
    // La primera palabra, abierta: con sus frases del libro.
    await b.locator('.ap-voc-termino').first().click();
    await b.waitForTimeout(1200);
    await guardar(b, 'vocabulario', id);
  } finally {
    await motor('cambiarPalabras', faciles.map((p) => ({ clave: p.clave, lema: p.lema, lectura: p.lectura, estado: 'desconocida' })));
    await b.setViewportSize({ width: 1280, height: 800 });
  }
}

// ---------- El Portapapeles en inglés, para quien habla japonés ----------

// El comienzo de «Pride and Prejudice» (1813), de dominio público.
const PORTAPAPELES_EN = AUSTEN;

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
  if (hacer('video')) {
    if (estudia === 'ja') await video(id);
    else await portapapeles(id);
  }
  const datos = LIBROS[estudia];
  const reales = estudia === 'ja' && (hacer('ocr') || hacer('manga')) ? [ESCANEO, MANGA].filter(Boolean) : [];
  const { b, etiquetas } = await biblioteca(datos, reales);
  if (hacer('libro')) await (datos.antiguo ? libroAntiguo(b, datos, id) : libroDeTexto(b, datos, id));
  if (hacer('ocr') && !etiquetas.ocr && datos.pagina) await paginaConOcr(b, datos, id);
  for (const r of reales) if (hacer(r.base)) await paginaReal(b, etiquetas[r.base], r, id);
  if (hacer('vocabulario')) await vocabularioDeLibro(b, datos, estudia, id);
  await b.close();
}

await contexto.close();
mock.servidor.close();
process.exit(0);
