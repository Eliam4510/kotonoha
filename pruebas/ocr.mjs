// Prueba el reconocimiento de texto del visor con páginas hechas aquí: una de libro, con tres líneas horizontales; otra de
// manga, con un globo de texto vertical; y un PDF escaneado con la capa de texto de otro OCR, para «Texto del PDF». Usa la
// GPU y descarga los modelos la primera vez (unos 200 MB).
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/ocr.mjs

import { mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-ocr-prueba'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'ocr');
mkdirSync(CAPTURAS, { recursive: true });
// El perfil se conserva entre ejecuciones: así los modelos solo se descargan la primera vez.
const sharp = createRequire(join(RAIZ, 'package.json'))('sharp');

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};

// ---------- Las páginas ----------

const LETRA = "'Yu Gothic','Meiryo','MS Gothic',sans-serif";
const LINEAS_LIBRO = ['今日は図書館で本を読みます。', '天気がいいので散歩しました。', '明日は友達と映画を見ます。'];
/** El texto que se escribe a mano en la segunda línea, con «Editar». */
const EDITADA = '天気が良いので散歩した。';
const paginaLibro = await sharp(
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600"><rect width="100%" height="100%" fill="#fff"/>${LINEAS_LIBRO.map((l, i) => `<text x="120" y="${300 + i * 110}" font-size="56" font-family="${LETRA}" fill="#111">${l}</text>`).join('')}</svg>`
  )
)
  .jpeg({ quality: 92 })
  .toBuffer();

// El manga: un globo blanco sobre una trama gris, con dos columnas verticales que se leen de derecha a izquierda.
const COLUMNAS = ['まって！', 'いっしょに行こう'];
const columna = (texto, x) => [...texto].map((c, i) => `<text x="${x}" y="${330 + i * 62}" font-size="54" font-family="${LETRA}" text-anchor="middle" fill="#111">${c}</text>`).join('');
const paginaManga = await sharp(
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="844" height="1200"><rect width="100%" height="100%" fill="#9a9a9a"/><ellipse cx="420" cy="520" rx="210" ry="330" fill="#fff" stroke="#111" stroke-width="5"/>${columna(COLUMNAS[0], 470)}${columna(COLUMNAS[1], 390)}</svg>`
  )
)
  .jpeg({ quality: 92 })
  .toBuffer();

const cbz = (titulo, manga, imagen) =>
  zipSync({ 'ComicInfo.xml': strToU8(`<ComicInfo><Title>${titulo}</Title><Manga>${manga ? 'YesAndRightToLeft' : 'No'}</Manga></ComicInfo>`), 'p1.jpg': new Uint8Array(imagen) });
/** Un CBZ de varias páginas, todas con la misma imagen: para ver qué páginas lee el OCR y cuándo. */
const cbzDePaginas = (titulo, manga, imagen, n) =>
  zipSync({
    'ComicInfo.xml': strToU8(`<ComicInfo><Title>${titulo}</Title><Manga>${manga ? 'YesAndRightToLeft' : 'No'}</Manga></ComicInfo>`),
    ...Object.fromEntries(Array.from({ length: n }, (_, i) => [`p${String(i + 1).padStart(2, '0')}.jpg`, new Uint8Array(imagen)])),
  });
/** Cuántas páginas de un libro tiene ya leídas el OCR, mirando su base desde una página de la extensión. */
const leidasDe = (pg, libro) =>
  pg.evaluate(
    (id) =>
      new Promise((ok) => {
        const q = indexedDB.open('kotonoha-ocr');
        q.onerror = () => ok(-1);
        q.onsuccess = () => {
          const db = q.result;
          const c = db.transaction('paginas').objectStore('paginas').index('libro').count(id);
          c.onsuccess = () => (ok(c.result), db.close());
          c.onerror = () => (ok(-1), db.close());
        };
      }),
    libro
  );
const libroDe = (pg) => decodeURIComponent(new URL(pg.url()).hash.slice(1));
const indicador = (pg) => pg.evaluate(() => document.querySelector('.vs-numero')?.value ?? '');

// Un escaneo con la capa de texto de otro programa de OCR: la página es la imagen del libro de prueba y su texto, invisible
// (modo de pintado 3, como lo dejan esos programas), dice otra cosa. Con «Texto del PDF» se ve esa capa; sin él, lo que
// Kotonoha lee en la imagen.
const CAPA_VIEJA = 'Capa vieja de otro OCR';
function pdfConCapa(jpeg, ancho, alto) {
  const contenido = `q 600 0 0 800 0 0 cm /Im1 Do Q BT 3 Tr /F1 28 Tf 60 650 Td (${CAPA_VIEJA}) Tj ET`;
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [5 0 R] /Count 1 >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    [`<< /Type /XObject /Subtype /Image /Width ${ancho} /Height ${alto} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`, jpeg, '\nendstream'],
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Contents 6 0 R /Resources << /Font << /F1 3 0 R >> /XObject << /Im1 4 0 R >> >> >>',
    `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`,
  ];
  const partes = [Buffer.from('%PDF-1.4\n', 'latin1')];
  let largo = partes[0].length;
  const posiciones = objetos.map((o, i) => {
    const posicion = largo;
    for (const t of [`${i + 1} 0 obj\n`, ...(Array.isArray(o) ? o : [o]), '\nendobj\n']) {
      const b = typeof t === 'string' ? Buffer.from(t, 'latin1') : t;
      partes.push(b);
      largo += b.length;
    }
    return posicion;
  });
  const indice = `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n${posiciones.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('')}`;
  partes.push(Buffer.from(`${indice}trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${largo}\n%%EOF\n`, 'latin1'));
  return Buffer.concat(partes);
}

// ---------- El navegador ----------

const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1400, height: 900 },
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
for (const pg of contexto.pages()) if (pg.url().includes('app.html')) await pg.close();
await sw.evaluate(async () => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), bienvenidaVista: true, idiomaInterfaz: 'es', idiomaObjetivo: 'ja', destino: 'memoria', ankiPuerto: 1 } });
});
const errores = [];
const app = await contexto.newPage();
app.on('pageerror', (e) => errores.push(e.message));
await app.goto(`chrome-extension://${id}/app.html#/biblioteca`);
// De una ejecución anterior quedan los libros, con el OCR ya encendido, y lo leído: se quita todo para medir de nuevo. La
// estantería llega después de abrir la página: hasta ver sus libros o el aviso de que está vacía, no hay nada que contar.
await app.evaluate(async () => {
  await new Promise((ok) => {
    const q = indexedDB.deleteDatabase('kotonoha-ocr');
    q.onsuccess = q.onerror = q.onblocked = () => ok(true);
  });
});
await app.waitForSelector('.ap-libro, .ap-vacio', { timeout: 15000 });
const libros = () => app.locator('.ap-libro').count();
for (let n = await libros(); n > 0; n = await libros()) {
  await app.locator('.ap-libro-quitar').first().click({ force: true });
  await app.waitForFunction((antes) => document.querySelectorAll('.ap-libro').length < antes, n, { timeout: 15000 });
}
const ARCHIVO = 'input[type=file][aria-label="Importar archivos"]';
await app.waitForSelector(ARCHIVO, { state: 'attached' });
await app.setInputFiles(ARCHIVO, [
  { name: 'libro-ocr.cbz', mimeType: 'application/zip', buffer: Buffer.from(cbz('Libro de prueba', false, paginaLibro)) },
  { name: 'manga-ocr.cbz', mimeType: 'application/zip', buffer: Buffer.from(cbz('Manga de prueba', true, paginaManga)) },
  { name: 'capa-vieja.pdf', mimeType: 'application/pdf', buffer: pdfConCapa(paginaLibro, 1200, 1600) },
  { name: 'manga-largo.cbz', mimeType: 'application/zip', buffer: Buffer.from(cbzDePaginas('Manga largo', true, paginaManga, 9)) },
  { name: 'libro-procesar.cbz', mimeType: 'application/zip', buffer: Buffer.from(cbzDePaginas('Libro para procesar', false, paginaLibro, 3)) },
]);
await app.waitForFunction(() => document.querySelectorAll('.ap-libro').length === 5, null, { timeout: 20000 });

const abrir = async (titulo) => {
  // Con dos libros del mismo título se podría abrir uno viejo, con otras preferencias guardadas, y medir otra cosa.
  const tapas = app.locator(`button.ap-tapa[aria-label*="${titulo}"]`);
  const iguales = await tapas.count();
  if (iguales !== 1) throw new Error(`En la estantería hay ${iguales} libros «${titulo}»`);
  const nueva = contexto.waitForEvent('page', { timeout: 15000 });
  await tapas.click();
  const v = await nueva;
  v.on('pageerror', (e) => errores.push(e.message));
  await v.waitForSelector('.vs-pagina img', { timeout: 20000 });
  return v;
};
const lineasDe = (v, ms) =>
  v
    .waitForFunction(() => {
      const fallo = document.querySelector('.vs-estado.error')?.textContent;
      if (fallo) return { fallo };
      // Una página leída pinta su capa de texto aunque no haya encontrado nada: así un cero no espera hasta el final.
      const l = [...document.querySelectorAll('.vs-linea')].map((b) => b.getAttribute('aria-label'));
      return l.length || document.querySelector('.vs-texto') ? { lineas: l } : null;
    }, null, { timeout: ms, polling: 200 })
    .then((h) => h.jsonValue())
    .catch(() => ({ fallo: 'sin texto a tiempo' }));
const normal = (s) => s.normalize('NFKC').replace(/\s+/g, '');
function distancia(a, b) {
  const x = Array.from(a);
  const y = Array.from(b);
  let fila = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const nueva = [i];
    for (let j = 1; j <= y.length; j++) nueva[j] = Math.min(fila[j] + 1, nueva[j - 1] + 1, fila[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    fila = nueva;
  }
  return fila[y.length];
}
const error = (leido, esperado) => distancia(normal(leido), normal(esperado)) / [...normal(esperado)].length;

// ---------- Libro ----------

console.log('\n== Libro impreso ==');
let v = await abrir('Libro de prueba');
comprobar(await v.evaluate(() => !document.querySelector('.vs-linea')), 'Sin pedirlo, no se lee el texto');
await v.click('[aria-label="Leer el texto de las páginas"]');
const modo = () => v.evaluate(() => document.querySelector('.vs-modos button[aria-pressed="true"]')?.textContent ?? 'sin modos a la vista');
const modoLibro = await modo();
comprobar(modoLibro === 'Libro', 'Un libro de izquierda a derecha se lee en modo libro', modoLibro === 'Libro' ? '' : modoLibro);
const t0 = Date.now();
const libro = await lineasDe(v, 300000);
console.log(`  primera lectura, con la descarga de los modelos si hace falta: ${Date.now() - t0} ms`);
comprobar(!libro.fallo, 'Lee el texto de la página', libro.fallo ?? '');
if (libro.lineas) {
  console.log('  leído:', JSON.stringify(libro.lineas));
  comprobar(libro.lineas.length === 3, 'Una zona por renglón', String(libro.lineas.length));
  const e = error(libro.lineas.join(''), LINEAS_LIBRO.join(''));
  comprobar(e < 0.08, 'Con menos de un 8 % de error por carácter', `${(e * 100).toFixed(1)} %`);
  await v.locator('.vs-linea').nth(1).click();
  const panel = await v.waitForSelector('.vs-panel-linea .pal', { timeout: 15000 }).then(() => true).catch(() => false);
  comprobar(panel, 'Tocar un renglón abre su texto con las palabras para consultar');
  await v.locator('.vs-panel-linea .pal').first().click();
  const ficha = await v.waitForSelector('.vs-panel-linea .vs-ficha .ficha', { timeout: 15000 }).then(() => true).catch(() => false);
  comprobar(ficha, 'Y una palabra abre su ficha');
  await v.screenshot({ path: join(CAPTURAS, 'libro.png') });
  // Editar: la línea se cambia a mano, y se ve así en la página.
  await v.click('.vs-panel-linea button:has-text("Editar")');
  await v.fill('.vs-editar-campo', EDITADA);
  await v.click('.vs-editar-botones button:has-text("Guardar")');
  const editada = await v
    .waitForFunction((t) => [...document.querySelectorAll('.vs-linea')].some((b) => b.getAttribute('aria-label') === t), EDITADA, { timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  comprobar(editada, 'Editar cambia el texto de la línea en la página');
  comprobar(!!(await v.$('.vs-linea-acciones button:has-text("Restaurar")')), 'Y la línea editada se puede restaurar');
  await v.screenshot({ path: join(CAPTURAS, 'libro-editado.png') });
  await v.click('.vs-panel-linea [aria-label="Cerrar"]');
}
await v.waitForTimeout(900);
await v.close();

v = await abrir('Libro de prueba');
const t1 = Date.now();
const deNuevo = await lineasDe(v, 20000);
comprobar((deNuevo.lineas?.length ?? 0) > 0 && Date.now() - t1 < 3000, 'Al volver a abrirlo, el texto sale de lo ya leído, enseguida', `${Date.now() - t1} ms`);
comprobar((deNuevo.lineas ?? []).includes(EDITADA), 'Y con lo editado', JSON.stringify(deNuevo.lineas));
await v.locator('.vs-linea').nth(1).click();
await v.click('.vs-linea-acciones button:has-text("Restaurar")');
const restaurada = await v
  .waitForFunction((t) => [...document.querySelectorAll('.vs-linea')].map((b) => b.getAttribute('aria-label')).join('').includes(t), LINEAS_LIBRO[1].slice(0, 4), { timeout: 5000 })
  .then(() => true)
  .catch(() => false);
comprobar(restaurada, 'Restaurar vuelve al texto leído');
await v.waitForTimeout(500);
await v.close();

// ---------- Manga ----------

console.log('\n== Manga ==');
v = await abrir('Manga de prueba');
await v.click('[aria-label="Leer el texto de las páginas"]');
const modoManga = await modo();
comprobar(modoManga === 'Manga', 'Un manga se lee en modo manga', modoManga === 'Manga' ? '' : modoManga);
const t2 = Date.now();
const manga = await lineasDe(v, 300000);
console.log(`  primera lectura, con la descarga de los modelos si hace falta: ${Date.now() - t2} ms`);
comprobar(!manga.fallo, 'Lee el texto del globo', manga.fallo ?? '');
if (manga.lineas) {
  console.log('  leído:', JSON.stringify(manga.lineas));
  const e = error(manga.lineas.join(''), COLUMNAS.join(''));
  comprobar(e < 0.15, 'El globo entero, con sus dos columnas en orden', `${(e * 100).toFixed(1)} %`);
  await v.screenshot({ path: join(CAPTURAS, 'manga.png') });
}
await v.close();

// ---------- PDF con la capa de otro OCR ----------

console.log('\n== PDF con la capa de otro OCR ==');
/** Las líneas de la página cuando vienen de la capa del PDF («capa») o de lo que leyó Kotonoha («ocr»). */
const lineasDesde = (pagina, origen, ms) =>
  pagina
    .waitForFunction(
      ([o, capa]) => {
        const l = [...document.querySelectorAll('.vs-linea')].map((b) => b.getAttribute('aria-label') ?? '');
        return l.length && l.some((x) => x.includes(capa)) === (o === 'capa') ? l : null;
      },
      [origen, CAPA_VIEJA],
      { timeout: ms, polling: 200 }
    )
    .then((h) => h.jsonValue())
    .catch(() => null);
const botonPdf = (pagina) => pagina.locator('.vs-modos button:has-text("Texto del PDF")');
v = await abrir('capa-vieja');
const capa = await lineasDesde(v, 'capa', 20000);
comprobar(!!capa, 'Sin el OCR, el texto que trae el PDF', JSON.stringify(capa));
await v.click('[aria-label="Leer el texto de las páginas"]');
await botonPdf(v).waitFor({ timeout: 15000 }).catch(() => {});
comprobar((await botonPdf(v).getAttribute('aria-pressed').catch(() => null)) === 'true', 'Con el OCR aparece «Texto del PDF», encendido');
comprobar(!!(await lineasDesde(v, 'capa', 5000)), 'Y sigue a la vista el texto del PDF');
await botonPdf(v).click();
const propio = await lineasDesde(v, 'ocr', 120000);
const ePdf = propio ? error(propio.join(''), LINEAS_LIBRO.join('')) : 1;
comprobar(ePdf < 0.08, 'Apagado, Kotonoha lee la imagen con su OCR y no la capa vieja', `${(ePdf * 100).toFixed(1)} %`);
await v.screenshot({ path: join(CAPTURAS, 'pdf-ocr-propio.png') });
await v.waitForTimeout(900);
await v.close();
v = await abrir('capa-vieja');
await botonPdf(v).waitFor({ timeout: 15000 }).catch(() => {});
const recordado = await botonPdf(v).getAttribute('aria-pressed').catch(() => null);
const otraVez = await lineasDesde(v, 'ocr', 20000);
comprobar(recordado === 'false' && !!otraVez, 'Al volver a abrirlo, se acuerda de leerlo con el OCR', `${recordado}`);
await v.close();

// ---------- Leer por delante ----------

console.log('\n== Las páginas siguientes se leen antes de llegar ==');
v = await abrir('Manga largo');
await v.click('[aria-label="Leer el texto de las páginas"]');
const idManga = libroDe(v);
const primeraPagina = await lineasDe(v, 120000);
comprobar(!primeraPagina.fallo, 'Lee la página a la vista', primeraPagina.fallo ?? '');
let adelantadas = 0;
for (let espera = 0; espera < 60 && adelantadas < 9; espera++) {
  adelantadas = await leidasDe(v, idManga);
  await v.waitForTimeout(500);
}
comprobar(adelantadas >= 9, 'Sin pasar de página, el OCR ya ha leído las ocho siguientes', `${adelantadas} de 9`);
comprobar((await indicador(v)) === '1', 'Y sigue en la primera', await indicador(v));
comprobar(await v.evaluate(() => !document.querySelector('.vs-estado:not(.error)')), 'Lo que se lee por delante no se anuncia como espera');
await v.keyboard.press('ArrowLeft');
const t3 = Date.now();
const siguiente = await lineasDe(v, 20000);
comprobar((siguiente.lineas?.length ?? 0) > 0 && Date.now() - t3 < 1500, 'Al pasar de página, su texto ya está', `${Date.now() - t3} ms`);
await v.close();

// ---------- Procesar el libro entero desde la estantería ----------

console.log('\n== Procesar el libro entero ==');
const tarjeta = app.locator('.ap-libro', { has: app.locator('h3', { hasText: 'Libro para procesar' }) });
await tarjeta.locator('button.ap-procesar').click();
const listo = await tarjeta
  .locator('.ap-proceso.listo')
  .waitFor({ timeout: 180000 })
  .then(() => true)
  .catch(() => false);
comprobar(listo, 'Desde su tarjeta, el libro entero se lee con el OCR y queda listo', await tarjeta.locator('.ap-proceso').textContent().catch(() => ''));
await app.screenshot({ path: join(CAPTURAS, 'procesado.png') });
v = await abrir('Libro para procesar');
comprobar((await leidasDe(v, libroDe(v))) === 3, 'Con sus tres páginas leídas');
const t4 = Date.now();
const yaLeido = await lineasDe(v, 15000);
comprobar((yaLeido.lineas?.length ?? 0) === 3 && Date.now() - t4 < 2000, 'Al abrirlo, el OCR ya está encendido y el texto, a la vista', `${yaLeido.lineas?.length} líneas, ${Date.now() - t4} ms`);
await v.close();

if (errores.length) console.log('\nErrores en la página:', [...new Set(errores)].slice(0, 6));
comprobar(errores.length === 0, 'Sin errores en las páginas');
console.log(`\n${fallos ? `${fallos} comprobaciones fallaron` : 'Todas las comprobaciones pasaron'}`);
await contexto.close();
process.exit(fallos ? 1 : 0);
