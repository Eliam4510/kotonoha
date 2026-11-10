// Prueba el visor de la Biblioteca con libros hechos aquí mismo: un manga EPUB de derecha a izquierda con índice,
// un CBZ que se lee de izquierda a derecha y un PDF. Importar, portadas, páginas (también con teclas seguidas), doble
// página, zoom, vistas, índice, miniaturas, sentido, memoria de la página, borrar y un archivo que falta.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/visor.mjs

import { mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { chromium } from 'playwright';
import { confirmarBorrado, recargarExtension } from './extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-visor'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'visor');
mkdirSync(CAPTURAS, { recursive: true });
rmSync(PERFIL, { recursive: true, force: true });
const sharp = createRequire(join(RAIZ, 'package.json'))('sharp');

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};

// ---------- Los libros de prueba ----------

const COLORES = ['#e8d5c4', '#c4dce8', '#d9e8c4', '#e8c4dc', '#e8e2c4'];
const pagina = (n, ancho = 600, alto = 850) =>
  sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}"><rect width="100%" height="100%" fill="${COLORES[n % COLORES.length]}"/><text x="50%" y="55%" font-size="220" font-family="sans-serif" text-anchor="middle" fill="#333">${n + 1}</text></svg>`))
    .png()
    .toBuffer();

const imagenes = await Promise.all([0, 1, 2, 3, 4].map((n) => pagina(n)));
const xhtml = (n) => strToU8(`<html><head><title>p${n}</title></head><body><svg xmlns:xlink="http://www.w3.org/1999/xlink"><image width="600" height="850" xlink:href="../image/p${n}.png"/></svg></body></html>`);
const EPUB = zipSync({
  mimetype: [strToU8('application/epub+zip'), { level: 0 }],
  'META-INF/container.xml': strToU8('<?xml version="1.0"?><container><rootfiles><rootfile full-path="item/standard.opf"/></rootfiles></container>'),
  'item/standard.opf': strToU8(`<package><metadata><dc:title>テスト漫画 1</dc:title><dc:language>ja</dc:language><meta property="rendition:layout">pre-paginated</meta></metadata>
    <manifest><item id="nav" href="nav.xhtml" properties="nav"/>${[0, 1, 2, 3, 4].map((n) => `<item id="p${n}" href="xhtml/p${n}.xhtml"/>`).join('')}</manifest>
    <spine page-progression-direction="rtl">${[0, 1, 2, 3, 4].map((n) => `<itemref idref="p${n}"/>`).join('')}</spine></package>`),
  'item/nav.xhtml': strToU8('<nav epub:type="toc"><ol><li><a href="xhtml/p0.xhtml">表紙</a></li><li><a href="xhtml/p3.xhtml">第一話</a></li></ol></nav>'),
  ...Object.fromEntries([0, 1, 2, 3, 4].map((n) => [`item/xhtml/p${n}.xhtml`, xhtml(n)])),
  ...Object.fromEntries(imagenes.map((b, n) => [`item/image/p${n}.png`, new Uint8Array(b)])),
});
const CBZ = zipSync({
  'ComicInfo.xml': strToU8('<ComicInfo><Title>Tomo de prueba</Title><Manga>No</Manga></ComicInfo>'),
  ...Object.fromEntries(imagenes.slice(0, 4).map((b, n) => [`paginas/p${n + 1}.png`, new Uint8Array(b)])),
});

/** Un PDF escrito a mano: cada página, un rectángulo y su número en Helvetica. */
function pdfDePrueba(total) {
  const objetos = ['<< /Type /Catalog /Pages 2 0 R >>', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const hijos = [];
  for (let n = 1; n <= total; n++) {
    const contenido = `0.85 0.45 0.2 rg 72 560 468 160 re f 0 0 0 rg BT /F1 64 Tf 200 380 Td (Pagina ${n}) Tj ET`;
    objetos.push(`<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`);
    objetos.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${objetos.length} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`);
    hijos.push(`${objetos.length} 0 R`);
  }
  objetos[1] = `<< /Type /Pages /Kids [${hijos.join(' ')}] /Count ${total} >>`;
  let pdf = '%PDF-1.4\n';
  const posiciones = objetos.map((o, i) => {
    const p = pdf.length;
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
    return p;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n${posiciones.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}
const PDF = pdfDePrueba(3);

// ---------- El navegador ----------

const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1280, height: 800 },
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
for (const pg of contexto.pages()) if (pg.url().includes('app.html')) await pg.close();
await sw.evaluate(async () => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), bienvenidaVista: true, idiomaInterfaz: 'es', destino: 'memoria', ankiPuerto: 1 } });
});

const errores = [];
const vigilar = (pg) => pg.on('pageerror', (e) => errores.push(e.message));
const esperar = async (pg, fn, arg, ms = 10000) => {
  const limite = Date.now() + ms;
  for (;;) {
    const v = await pg.evaluate(fn, arg).catch(() => null);
    if (v) return v;
    if (Date.now() > limite) return null;
    await pg.waitForTimeout(80);
  }
};
const indicador = (pg) => pg.evaluate(() => document.querySelector('.vs-numero')?.value ?? '');

// ---------- Importar ----------

console.log('\n== Importar libros de páginas ==');
const app = await contexto.newPage();
vigilar(app);
await app.goto(`chrome-extension://${id}/app.html#/biblioteca`);
const ARCHIVO = 'input[type=file][aria-label="Importar archivos"]';
await app.waitForSelector(ARCHIVO, { state: 'attached' });
await app.setInputFiles(ARCHIVO, [
  { name: 'manga-prueba.epub', mimeType: 'application/epub+zip', buffer: Buffer.from(EPUB) },
  { name: 'tomo.cbz', mimeType: 'application/zip', buffer: Buffer.from(CBZ) },
  { name: 'apuntes.pdf', mimeType: 'application/pdf', buffer: PDF },
]);
const estante = await esperar(app, () => {
  const l = [...document.querySelectorAll('.ap-libro')];
  return l.length === 3 ? l.map((x) => ({ titulo: x.querySelector('h3')?.textContent, faja: x.querySelector('.ap-obi .num')?.textContent, portada: !!x.querySelector('.ap-tapa-imagen'), formato: x.querySelector('.ayuda')?.textContent })) : null;
}, undefined, 20000);
comprobar(!!estante, 'Los tres libros entran en la estantería', JSON.stringify(estante));
const libro = (t) => estante?.find((x) => x.titulo?.includes(t));
comprobar(libro('テスト漫画')?.faja === '5 páginas' && libro('テスト漫画')?.portada, 'El EPUB, con su título, sus páginas y su portada', JSON.stringify(libro('テスト漫画')));
comprobar(libro('Tomo de prueba')?.faja === '4 páginas' && libro('Tomo de prueba')?.portada, 'El CBZ, con el título de su ComicInfo', JSON.stringify(libro('Tomo de prueba')));
comprobar(libro('apuntes')?.faja === '3 páginas' && libro('apuntes')?.portada && /^PDF ·/.test(libro('apuntes')?.formato ?? ''), 'El PDF, con su portada y sus páginas desde que se importa', JSON.stringify(libro('apuntes')));
await app.screenshot({ path: join(CAPTURAS, 'estanteria.png') });

const abrir = async (titulo) => {
  const nueva = contexto.waitForEvent('page', { timeout: 15000 });
  await app.locator(`button.ap-tapa[aria-label*="${titulo}"]`).first().click();
  const visor = await nueva;
  vigilar(visor);
  await visor.waitForSelector('.vs-pagina img', { timeout: 20000 }).catch(() => {});
  return visor;
};

// ---------- Manga ----------

console.log('\n== Manga de derecha a izquierda ==');
let v = await abrir('テスト漫画');
comprobar(v.url().includes('/visor.html#'), 'Se abre en el visor, en su pestaña', v.url());
comprobar((await v.title()).startsWith('テスト漫画 1'), 'La pestaña lleva el título del libro', await v.title());
comprobar((await v.evaluate(() => document.querySelector('.vs-lienzo')?.dataset.vista)) === 'doble', 'Un manga empieza a doble página');
comprobar((await indicador(v)) === '1', 'Con la portada sola', await indicador(v));
await v.keyboard.press('ArrowLeft');
await v.keyboard.press('ArrowLeft');
await v.waitForTimeout(500);
comprobar((await indicador(v)) === '4–5', 'Dos flechas seguidas a la izquierda avanzan dos pliegos', await indicador(v));
await v.keyboard.press('ArrowRight');
await v.waitForTimeout(500);
comprobar((await indicador(v)) === '2–3', 'La derecha vuelve atrás', await indicador(v));
const orden = await v.evaluate(() => {
  const x = (n) => document.querySelector(`.vs-pagina[data-pagina="${n}"]`)?.getBoundingClientRect().left ?? 0;
  return x(2) > x(3);
});
comprobar(orden, 'La página 2 va a la derecha de la 3, como en un tomo japonés');
await v.screenshot({ path: join(CAPTURAS, 'manga-doble.png') });

await v.click('[aria-label="Una página"]');
await v.keyboard.press('End');
await v.waitForTimeout(300);
comprobar((await indicador(v)) === '5', 'Fin lleva a la última página', await indicador(v));
await v.keyboard.press('Home');
await v.waitForTimeout(300);
comprobar((await indicador(v)) === '1', 'Inicio, a la primera', await indicador(v));
await v.fill('.vs-numero', '4');
await v.press('.vs-numero', 'Enter');
await v.waitForTimeout(300);
comprobar((await indicador(v)) === '4', 'Se puede ir a una página escribiendo su número', await indicador(v));

const zoomAntes = await v.evaluate(() => document.querySelector('.vs-zoom')?.textContent);
await v.click('[aria-label="Acercar"]');
await v.waitForTimeout(300);
const zoomDespues = await v.evaluate(() => document.querySelector('.vs-zoom')?.textContent);
comprobar(parseInt(zoomDespues ?? '0') > parseInt(zoomAntes ?? '0'), 'Acercar sube el zoom', `${zoomAntes} → ${zoomDespues}`);
await v.click('[aria-label="Ajustar al ancho"]');
await v.waitForTimeout(300);
const ancho = await v.evaluate(() => {
  const l = document.querySelector('.vs-lienzo');
  const p = document.querySelector('.vs-pagina');
  return Math.abs(p.getBoundingClientRect().width - (l.clientWidth - 32));
});
comprobar(ancho < 3, 'Ajustar al ancho llena el ancho', String(ancho));

await v.click('[aria-label="Desplazamiento continuo"]');
await v.waitForTimeout(500);
comprobar((await v.evaluate(() => document.querySelectorAll('.vs-pagina').length)) === 5, 'En continuo están todas las páginas');
await v.evaluate(() => document.querySelector('.vs-lienzo').scrollTo(0, 1e6));
await v.waitForTimeout(600);
comprobar((await indicador(v)) === '5', 'Al bajar, la página actual sigue al desplazamiento', await indicador(v));

await v.click('[aria-label="Índice"]');
const entradas = await v.evaluate(() => [...document.querySelectorAll('.vs-indice button')].map((b) => b.textContent));
comprobar(entradas.length === 2 && entradas[1].startsWith('第一話'), 'El índice del libro, con sus páginas', JSON.stringify(entradas));
await v.click('[aria-label="Una página"]');
await v.locator('.vs-indice button').nth(1).click();
await v.waitForTimeout(300);
comprobar((await indicador(v)) === '4', 'Una entrada del índice lleva a su página', await indicador(v));
await v.click('[aria-label="Miniaturas"]');
await v.waitForTimeout(800);
comprobar((await v.evaluate(() => document.querySelectorAll('.vs-miniatura').length)) === 5, 'Las miniaturas, una por página');
await v.locator('.vs-miniatura').nth(2).click();
await v.waitForTimeout(300);
comprobar((await indicador(v)) === '3', 'Una miniatura lleva a su página', await indicador(v));
await v.screenshot({ path: join(CAPTURAS, 'manga-miniaturas.png') });

await v.click('[aria-label="Se lee de derecha a izquierda"]');
await v.waitForTimeout(300);
comprobar(await v.evaluate(() => !!document.querySelector('[aria-label="Se lee de izquierda a derecha"]')), 'El sentido de lectura se puede cambiar');
await v.keyboard.press('ArrowRight');
await v.waitForTimeout(300);
comprobar((await indicador(v)) === '4', 'Y entonces la derecha avanza', await indicador(v));
await v.waitForTimeout(900);
await v.close();

v = await abrir('テスト漫画');
await v.waitForTimeout(300);
comprobar((await indicador(v)) === '4', 'Al volver a abrirlo, sigue en la misma página', await indicador(v));
comprobar((await v.evaluate(() => document.querySelector('.vs-lienzo')?.dataset.vista)) === 'una', 'Con la misma vista');
await v.close();

// ---------- CBZ ----------

console.log('\n== CBZ de izquierda a derecha ==');
v = await abrir('Tomo de prueba');
comprobar((await v.evaluate(() => document.querySelector('.vs-lienzo')?.dataset.vista)) === 'una', 'Se lee de una en una, como dice su ComicInfo');
await v.keyboard.press('ArrowRight');
await v.keyboard.press('ArrowRight');
await v.waitForTimeout(400);
comprobar((await indicador(v)) === '3', 'La derecha avanza', await indicador(v));
await v.close();

// ---------- PDF ----------

console.log('\n== PDF ==');
v = await abrir('apuntes');
const pdf = await v.evaluate(() => ({ total: document.querySelectorAll('.vs-pagina-actual .num')[1]?.textContent, imagen: document.querySelector('.vs-pagina img')?.naturalWidth }));
comprobar(pdf.total === '/ 3' && pdf.imagen > 600, 'El PDF se pinta, nítido, y sabe sus páginas', JSON.stringify(pdf));
await v.keyboard.press('ArrowRight');
await v.waitForTimeout(600);
comprobar((await indicador(v)) === '2', 'Y se pasa de página', await indicador(v));
await v.screenshot({ path: join(CAPTURAS, 'pdf.png') });
await v.waitForTimeout(900);
await v.close();
await app.reload();
const tras = await esperar(app, () => {
  const l = [...document.querySelectorAll('.ap-libro')].find((x) => x.querySelector('h3')?.textContent?.includes('apuntes'));
  return l?.querySelector('.ap-tapa-imagen') ? l.querySelector('.ap-obi .num')?.textContent : null;
});
comprobar(tras === 'Pág. 2 de 3', 'Tras abrirlo, la estantería sabe sus páginas, por dónde se va y tiene portada', tras);

// ---------- Borrar y archivo que falta ----------

console.log('\n== Borrar ==');
const archivos = () => app.evaluate(async () => {
  const d = await (await navigator.storage.getDirectory()).getDirectoryHandle('documentos');
  let n = 0;
  for await (const _ of d.keys()) n++;
  return n;
});
comprobar((await archivos()) === 3, 'Cada libro guarda su archivo aparte', String(await archivos()));
await app.locator('button[aria-label="Eliminar Tomo de prueba"]').click({ force: true });
await app.locator('.ap-dialogo').waitFor({ timeout: 5000 });
// La estantería quedó detrás de la pestaña del visor: las teclas van a la que está delante.
await app.bringToFront();
await app.keyboard.press('Escape');
await app.waitForTimeout(300);
comprobar((await archivos()) === 3 && (await app.locator('.ap-dialogo').count()) === 0, 'Eliminar un libro pregunta antes, y Escape lo deja como estaba', String(await archivos()));
await app.locator('button[aria-label="Eliminar Tomo de prueba"]').click({ force: true });
await confirmarBorrado(app);
await app.waitForTimeout(600);
comprobar((await archivos()) === 2, 'Al eliminar un libro se va también su archivo', String(await archivos()));

await app.evaluate(async () => {
  const d = await (await navigator.storage.getDirectory()).getDirectoryHandle('documentos');
  for await (const nombre of d.keys()) {
    await d.removeEntry(nombre);
    break;
  }
});
const sinArchivo = await (async () => {
  const titulos = await app.evaluate(() => [...document.querySelectorAll('.ap-libro h3')].map((h) => h.textContent));
  for (const t of titulos) {
    const nueva = contexto.waitForEvent('page', { timeout: 15000 });
    await app.locator('button.ap-tapa').nth(titulos.indexOf(t)).click();
    const pg = await nueva;
    const aviso = await esperar(pg, () => document.querySelector('.vs-aviso[role="alert"]')?.textContent ?? (document.querySelector('.vs-pagina img') ? 'abierto' : null));
    await pg.close();
    if (aviso && aviso !== 'abierto') return aviso;
  }
  return null;
})();
comprobar(!!sinArchivo && sinArchivo.includes('no está en este equipo'), 'Si falta el archivo, lo dice en vez de quedarse en blanco', sinArchivo);

if (errores.length) console.log('\nErrores en la página:', [...new Set(errores)].slice(0, 6));
comprobar(errores.length === 0, 'Sin errores en las páginas');
console.log(`\n${fallos ? `${fallos} comprobaciones fallaron` : 'Todas las comprobaciones pasaron'}`);
await contexto.close();
process.exit(fallos ? 1 : 0);
