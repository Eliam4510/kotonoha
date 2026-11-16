// Prueba exportar un libro como PDF con el texto del OCR: un CBZ (con una página JPEG y dos PNG) que se convierte en un
// PDF nuevo, y un PDF «escaneado» (con una página girada) que recibe el texto al final. Comprueba con pdf.js, sobre los
// archivos descargados, que cada página lleva su texto en su sitio (también lo editado a mano y lo vertical), que la
// imagen se pinta, que el JPEG va tal cual, que el PDF original queda intacto y que un EPUB de texto no ofrece exportar.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/exportar-pdf.mjs

import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { degrees, PDFDocument, PDFName } from 'pdf-lib';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-exportar'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'exportar-pdf');
mkdirSync(CAPTURAS, { recursive: true });
rmSync(PERFIL, { recursive: true, force: true });
const sharp = createRequire(join(RAIZ, 'package.json'))('sharp');
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};
const esperar = async (fn, ms = 15000) => {
  const limite = Date.now() + ms;
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() > limite) return null;
    await new Promise((r) => setTimeout(r, 120));
  }
};

const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1360, height: 900 },
  args: ['--mute-audio', `--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
for (const pg of contexto.pages()) if (pg.url().includes('app.html')) await pg.close();
await sw.evaluate(async () => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), bienvenidaVista: true, idiomaInterfaz: 'es', idiomaObjetivo: 'ja', avisarVersiones: false } });
});
const errores = [];
const app = await contexto.newPage();
app.on('pageerror', (e) => errores.push(e.message));
const ir = async (ruta) => {
  await app.goto('about:blank');
  await app.goto(`chrome-extension://${id}/app.html#/${ruta}`);
};
await ir('biblioteca');
const motor = async (metodo, ...args) => {
  for (let intento = 0; ; intento++) {
    const r = await app.evaluate(({ metodo, args }) => chrome.runtime.sendMessage({ canal: 'motor', metodo, args }), { metodo, args }).catch(() => null);
    if (r?.ok) return r.valor;
    if (intento > 80 || r?.error) throw new Error(`${metodo}: ${r?.error ?? 'sin respuesta'}`);
    await app.waitForTimeout(250);
  }
};

/** Lo que pdf.js lee de un PDF: por página, sus trozos de texto (con dónde empiezan, en fracciones de la página tal como se ve) y si pinta una imagen. */
async function leerPdf(datos) {
  const tarea = pdfjs.getDocument({ data: new Uint8Array(datos), verbosity: 0 });
  const doc = await tarea.promise;
  try {
    const paginas = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const p = await doc.getPage(n);
      const vista = p.getViewport({ scale: 1 });
      const trozos = (await p.getTextContent()).items
        .filter((i) => i.str)
        .map((i) => {
          const [x, y] = vista.convertToViewportPoint(i.transform[4], i.transform[5]);
          return { texto: i.str, fx: Math.round((x / vista.width) * 1000) / 1000, fy: Math.round((y / vista.height) * 1000) / 1000 };
        });
      const ops = await p.getOperatorList();
      paginas.push({ trozos, imagen: ops.fnArray.some((f) => f === pdfjs.OPS.paintImageXObject || f === pdfjs.OPS.paintInlineImageXObject) });
    }
    return paginas;
  } finally {
    await tarea.destroy();
  }
}
const cerca = (a, b) => Math.abs(a - b) < 0.01;

// ---------- Los libros ----------

const imagen = async (texto, formato) => {
  const s = sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="560"><rect width="100%" height="100%" fill="#f2f2f2"/><text x="50%" y="50%" font-size="60" text-anchor="middle">${texto}</text></svg>`));
  return new Uint8Array(await (formato === 'jpg' ? s.jpeg({ quality: 85 }) : s.png()).toBuffer());
};
const JPEG = await imagen('1', 'jpg');
const CBZ = zipSync({ '001.jpg': JPEG, '002.png': await imagen('2', 'png'), '003.png': await imagen('3', 'png') });
// Un PDF como el de un escáner: una imagen por página, la segunda girada, con flujos de objetos (PDF 1.5).
const escaneo = await PDFDocument.create();
for (const [n, giro] of [[1, 0], [2, 90]]) {
  const img = await escaneo.embedJpg(await imagen(String(n), 'jpg'));
  const p = escaneo.addPage([400, 560]);
  p.drawImage(img, { x: 0, y: 0, width: 400, height: 560 });
  if (giro) p.setRotation(degrees(giro));
}
const PDF = await escaneo.save();
const EPUB = zipSync({
  mimetype: strToU8('application/epub+zip'),
  'META-INF/container.xml': strToU8('<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'),
  'OEBPS/content.opf': strToU8('<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>山の本</dc:title><dc:language>ja</dc:language></metadata><manifest><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/></spine></package>'),
  'OEBPS/c1.xhtml': strToU8('<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><body><p>山に登る。</p></body></html>'),
});

console.log('\n== Importar ==');
const ARCHIVO = 'input[type=file][aria-label="Importar archivos"]';
await app.waitForSelector(ARCHIVO, { state: 'attached' });
await app.setInputFiles(ARCHIVO, [
  { name: '森の漫画.cbz', mimeType: 'application/zip', buffer: Buffer.from(CBZ) },
  { name: '化学の問題.pdf', mimeType: 'application/pdf', buffer: Buffer.from(PDF) },
  { name: '山の本.epub', mimeType: 'application/epub+zip', buffer: Buffer.from(EPUB) },
]);
const libros = await esperar(async () => {
  const l = await motor('bibliotecaListar');
  return l.filter((e) => e.documento).length === 3 ? l : null;
}, 30000);
const cbz = libros?.find((e) => e.documento?.formato === 'cbz');
const pdf = libros?.find((e) => e.documento?.formato === 'pdf');
const epub = libros?.find((e) => e.documento?.texto);
comprobar(!!cbz && !!pdf && !!epub, 'Se importan los tres libros', JSON.stringify(libros?.map((e) => e.titulo)));

// Lo leído con el OCR: dos páginas del CBZ (una con una línea editada a mano) y las dos del PDF (la girada, en vertical).
// Antes, una pantalla que abra la base del OCR: en un perfil nuevo aún no existe.
await ir(`vocabulario?libro=${encodeURIComponent(cbz.id)}`);
await esperar(() => app.evaluate(() => document.querySelector('.ap-vacio h3')?.textContent ?? null), 30000);
const sembrar = (libro, modo, paginas, ediciones = []) =>
  app.evaluate(
    async ({ libro, modo, paginas, ediciones }) => {
      const db = await new Promise((ok, mal) => {
        const r = indexedDB.open('kotonoha-ocr');
        r.onsuccess = () => ok(r.result);
        r.onerror = () => mal(r.error);
      });
      const tx = db.transaction(['paginas', 'ediciones'], 'readwrite');
      for (const [n, lineas] of Object.entries(paginas)) tx.objectStore('paginas').put({ clave: `${libro}:${modo}:${n}`, libro, lineas, creada: Date.now(), lectura: 1 });
      for (const e of ediciones) tx.objectStore('ediciones').put({ ...e, libro, creada: Date.now() });
      await new Promise((ok, mal) => {
        tx.oncomplete = ok;
        tx.onerror = () => mal(tx.error);
      });
      db.close();
    },
    { libro, modo, paginas, ediciones }
  );
const linea = (texto, x0, y0, x1, y1, vertical = false) => ({ texto, caja: { x0, y0, x1, y1 }, vertical });
const modoDe = (e) => e.documento.ocr?.modo ?? (e.documento.direccion === 'rtl' ? 'manga' : 'libro');
await sembrar(cbz.id, modoDe(cbz), { 0: [linea('森へ行こう。', 0.1, 0.1, 0.9, 0.15)], 1: [linea('森は暗い。', 0.1, 0.1, 0.9, 0.15), linea('鳥が鳴く。', 0.1, 0.5, 0.9, 0.55)] }, [
  { clave: `${cbz.id}:1:a`, pagina: 1, caja: { x0: 0.1, y0: 0.5, x1: 0.9, y1: 0.55 }, original: '鳥が鳴く。', texto: '蛙が鳴く。' },
]);
await sembrar(pdf.id, modoDe(pdf), { 0: [linea('問題1 次の反応式を書け。', 0.1, 0.2, 0.8, 0.25)], 1: [linea('縦に書いた行', 0.7, 0.1, 0.75, 0.6, true)] });

// ---------- El CBZ, desde el menú del libro ----------

console.log('\n== Un CBZ, desde el menú del libro ==');
await ir('biblioteca');
const tarjeta = app.locator('.ap-libro', { hasText: '森の漫画' }).first();
await tarjeta.waitFor({ timeout: 15000 });
await tarjeta.locator('button[aria-haspopup="menu"]').click();
const opcion = app.locator('.ap-menu-libro button', { hasText: 'Exportar PDF con texto' });
comprobar((await opcion.count()) === 1, 'El menú del libro ofrece exportar el PDF con texto');
await opcion.click();
const dialogo = app.locator('.ap-modal[aria-label="Exportar PDF con texto"]');
await dialogo.waitFor({ timeout: 5000 });
comprobar((await dialogo.textContent()).includes('Aún no está leído entero con el OCR'), 'Avisa de que no está leído entero, con el botón para leerlo', (await dialogo.locator('button', { hasText: 'Leer el libro entero' }).count()) + ' botones');
await app.screenshot({ path: join(CAPTURAS, 'dialogo.png') });
const [descargaCbz] = await Promise.all([app.waitForEvent('download', { timeout: 60000 }), dialogo.locator('button', { hasText: 'Exportar con lo leído' }).click()]);
const datosCbz = readFileSync(await descargaCbz.path());
comprobar(descargaCbz.suggestedFilename() === '森の漫画 (OCR).pdf', 'Se descarga con el nombre del libro', descargaCbz.suggestedFilename());
const listo = await esperar(async () => ((await dialogo.textContent()).includes('Listo:') ? dialogo.textContent() : null), 15000);
comprobar(!!listo?.includes('Lleva texto en 2 de sus 3 páginas'), 'Dice que está listo y cuántas páginas llevan texto', listo?.slice(0, 160));
await app.screenshot({ path: join(CAPTURAS, 'listo.png') });
const pCbz = await leerPdf(datosCbz);
comprobar(pCbz.length === 3 && pCbz.every((p) => p.imagen), 'Tres páginas, cada una con su imagen', `${pCbz.length} páginas`);
comprobar(pCbz[0].trozos.map((t) => t.texto).join('') === '森へ行こう。' && cerca(pCbz[0].trozos[0].fx, 0.1) && cerca(pCbz[0].trozos[0].fy, 0.15), 'La primera lleva su texto, en su sitio', JSON.stringify(pCbz[0].trozos));
const textos2 = pCbz[1].trozos.map((t) => t.texto);
comprobar(textos2.includes('蛙が鳴く。') && !textos2.includes('鳥が鳴く。'), 'Con lo editado a mano encima de lo leído', JSON.stringify(textos2));
comprobar(pCbz[2].trozos.length === 0, 'La que no se leyó va sin texto');
const docCbz = await PDFDocument.load(datosCbz);
const filtroDe = (pagina) => {
  const recursos = pagina.node.Resources();
  const xobjetos = recursos.lookup(PDFName.of('XObject'));
  const img = docCbz.context.lookup(xobjetos.get(xobjetos.keys()[0]));
  return img.dict.get(PDFName.of('Filter'))?.toString();
};
comprobar(filtroDe(docCbz.getPage(0)) === '/DCTDecode' && filtroDe(docCbz.getPage(1)) === '/FlateDecode', 'El JPEG va tal cual y el PNG, sin perder nada', `${filtroDe(docCbz.getPage(0))} ${filtroDe(docCbz.getPage(1))}`);
const jpegDentro = docCbz.context.lookup(docCbz.getPage(0).node.Resources().lookup(PDFName.of('XObject')).values()[0]).contents;
comprobar(Buffer.from(jpegDentro).equals(Buffer.from(JPEG)), 'Byte a byte, el mismo JPEG del libro');
await dialogo.locator('button', { hasText: 'Cerrar' }).click();

// ---------- El PDF, desde el visor (biblioteca?exportar=ID) ----------

console.log('\n== Un PDF escaneado, como lo pide el visor ==');
await ir(`biblioteca?exportar=${encodeURIComponent(pdf.id)}`);
await dialogo.waitFor({ timeout: 15000 });
comprobar((await dialogo.textContent()).includes('化学の問題'), 'La dirección del visor abre el diálogo de ese libro');
comprobar((await dialogo.textContent()).includes('Las páginas no cambian'), 'En un PDF, explica que sus páginas no cambian');
const [descargaPdf] = await Promise.all([app.waitForEvent('download', { timeout: 60000 }), dialogo.locator('button', { hasText: 'Exportar' }).last().click()]);
const datosPdf = readFileSync(await descargaPdf.path());
comprobar(Buffer.from(datosPdf.subarray(0, PDF.length)).equals(Buffer.from(PDF)), 'El PDF original queda intacto, byte a byte; el texto va detrás', `${PDF.length} → ${datosPdf.length} bytes`);
const pPdf = await leerPdf(datosPdf);
comprobar(pPdf.length === 2 && pPdf.every((p) => p.imagen), 'Sus dos páginas, con su escaneo');
comprobar(pPdf[0].trozos.map((t) => t.texto).join('') === '問題1 次の反応式を書け。' && cerca(pPdf[0].trozos[0].fx, 0.1) && cerca(pPdf[0].trozos[0].fy, 0.25), 'La primera lleva su texto, en su sitio', JSON.stringify(pPdf[0].trozos));
comprobar(pPdf[1].trozos.map((t) => t.texto).join('') === '縦に書いた行' && cerca(pPdf[1].trozos[0].fx, 0.7) && cerca(pPdf[1].trozos[0].fy, 0.1), 'Y la girada, su línea vertical donde se ve', JSON.stringify(pPdf[1].trozos));
comprobar((await PDFDocument.load(datosPdf)).getPageCount() === 2, 'Otro programa lo abre igual');
await dialogo.locator('button', { hasText: 'Cerrar' }).click();

// ---------- Un EPUB de texto no se exporta ----------

console.log('\n== Un EPUB de texto ==');
const otra = app.locator('.ap-libro', { hasText: '山の本' }).first();
await otra.locator('button[aria-haspopup="menu"]').click();
comprobar((await app.locator('.ap-menu-libro button', { hasText: 'Exportar PDF con texto' }).count()) === 0, 'Su menú no ofrece exportar: ya tiene su texto');
await app.keyboard.press('Escape');

comprobar(errores.length === 0, 'Sin errores en la página', errores.join(' | '));
await contexto.close();
console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
