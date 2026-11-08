// Prueba lo que se anota en el visor con un PDF hecho aquí mismo, que trae su texto (así no hace falta el OCR): marcar una
// página, resaltar una línea y comentarla, subrayar una palabra, poner una nota sobre la página, el panel «Notas» (ir,
// editar, quitar, copiar), que todo siga ahí al volver a abrir el libro y que se vaya con él al eliminarlo.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/notas.mjs

import { mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-notas'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'notas');
rmSync(PERFIL, { recursive: true, force: true });
mkdirSync(CAPTURAS, { recursive: true });

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};

/** El texto en UCS-2, como lo pide la codificación UniJIS-UCS2-H: en hexadecimal, de dos en dos bytes. */
const ucs2 = (t) => `<${Buffer.from(t, 'utf16le').swap16().toString('hex')}>`;
/** La fuente japonesa sin incrustar que conoce cualquier lector de PDF, con la codificación Unicode de Adobe. */
const FUENTE_JA =
  '<< /Type /Font /Subtype /Type0 /BaseFont /HeiseiMin-W3 /Encoding /UniJIS-UCS2-H /DescendantFonts [<< /Type /Font /Subtype /CIDFontType0 /BaseFont /HeiseiMin-W3 /CIDSystemInfo << /Registry (Adobe) /Ordering (Japan1) /Supplement 2 >> /FontDescriptor << /Type /FontDescriptor /FontName /HeiseiMin-W3 /Flags 6 /FontBBox [-123 -257 1001 910] /ItalicAngle 0 /Ascent 723 /Descent -241 /CapHeight 709 /StemV 69 >> /DW 1000 >>] >>';

/** Un PDF escrito a mano: en cada página, dos renglones en japonés. */
function pdfDePrueba(total) {
  const objetos = ['<< /Type /Catalog /Pages 2 0 R >>', '', FUENTE_JA];
  const hijos = [];
  for (let n = 1; n <= total; n++) {
    const contenido = `BT /F1 26 Tf 72 690 Td ${ucs2(`第${n}章　酸と塩基の性質`)} Tj 0 -60 Td ${ucs2('酸は水に水素イオンを与える')} Tj ET`;
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

// ---------- El navegador ----------

const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1400, height: 900 },
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
for (const pg of contexto.pages()) if (pg.url().includes('app.html')) await pg.close();
await sw.evaluate(async () => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), bienvenidaVista: true, idiomaInterfaz: 'es', idiomaObjetivo: 'ja', destino: 'memoria', ankiPuerto: 1 } });
});
await contexto.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `chrome-extension://${id}` }).catch(() => {});

const errores = [];
const vigilar = (pg) => pg.on('pageerror', (e) => errores.push(e.message));
const esperar = async (pg, fn, arg, ms = 10000) => {
  const limite = Date.now() + ms;
  for (;;) {
    const v = await pg.evaluate(fn, arg).catch(() => null);
    if (v) return v;
    if (Date.now() > limite) return null;
    await pg.waitForTimeout(100);
  }
};
const app = await contexto.newPage();
vigilar(app);
await app.goto(`chrome-extension://${id}/app.html#/biblioteca`);
await app.waitForSelector('input[type=file][aria-label="Importar archivos"]', { state: 'attached' });
await app.setInputFiles('input[type=file][aria-label="Importar archivos"]', [{ name: 'acidos.pdf', mimeType: 'application/pdf', buffer: pdfDePrueba(3) }]);
await esperar(app, () => !!document.querySelector('button.ap-tapa[aria-label="Leer acidos"]'));

const abrir = async () => {
  const nueva = contexto.waitForEvent('page', { timeout: 15000 });
  await app.locator('button.ap-tapa[aria-label="Leer acidos"]').click();
  const v = await nueva;
  vigilar(v);
  await v.waitForSelector('.vs-pagina img', { timeout: 20000 });
  await v.waitForSelector('.vs-linea', { timeout: 20000 });
  return v;
};
const contar = (v, selector) => v.evaluate((s) => document.querySelectorAll(s).length, selector);
const idLibro = (v) => decodeURIComponent(new URL(v.url()).hash.slice(1));

// ---------- Marcar una página ----------

console.log('\n== Marcar una página ==');
let v = await abrir();
const libro = idLibro(v);
await v.click('[aria-label="Marcar esta página"]');
comprobar((await contar(v, '.vs-pagina .vs-cinta')) === 1, 'La página lleva su cinta');
comprobar((await v.getAttribute('[aria-label="Quitar el marcador de esta página"]', 'aria-pressed')) === 'true', 'Y el botón queda encendido, para quitarlo');

// ---------- Resaltar una línea y comentarla ----------

console.log('\n== Resaltar ==');
await v.locator('.vs-linea').first().click();
await v.waitForSelector('.vs-panel-linea .vs-resaltar');
await v.waitForSelector('.vs-linea-texto .pal.ap-elegida', { timeout: 15000 }).catch(() => {});
// Tocar la página elige la palabra tocada, pero lo que se resalta sigue siendo la línea.
comprobar((await v.textContent('.vs-resaltar-objetivo .activo').catch(() => '')) === 'La línea', 'Al tocar la línea, lo que se resalta es la línea entera');
await v.click('[aria-label="Resaltar en amarillo"]');
comprobar((await contar(v, '.vs-resaltado.fondo.amarillo')) === 1, 'La línea queda resaltada en amarillo sobre la página');
const linea = await v.evaluate(() => {
  const r = document.querySelector('.vs-resaltado')?.getBoundingClientRect();
  const l = document.querySelector('.vs-linea')?.getBoundingClientRect();
  return r && l ? Math.abs(r.width - l.width) < 2 && Math.abs(r.top - l.top) < 2 : false;
});
comprobar(linea, 'Y ocupa justo la línea');
await v.click('.vs-resaltado-linea button:has-text("Comentar")');
await v.fill('.vs-resaltado-linea textarea', 'Definición de Brønsted');
await v.click('.vs-resaltado-linea button:has-text("Guardar")');
comprobar((await v.textContent('.vs-resaltado-comentario')) === 'Definición de Brønsted', 'Con su comentario');

// ---------- Subrayar una palabra ----------

console.log('\n== Subrayar una palabra ==');
await v.locator('.vs-panel-linea [aria-label="Línea siguiente"]').click();
await v.waitForSelector('.vs-linea-texto .pal', { timeout: 15000 });
const palabra = v.locator('.vs-linea-texto .pal').nth(1);
const texto = (await palabra.textContent())?.trim();
await palabra.click();
const solo = v.locator('.vs-resaltar-objetivo button').nth(1);
const que = await solo.textContent();
comprobar(!!texto && que === `Solo «${texto}»`, 'Con una palabra elegida, se puede resaltar solo esa', que);
await solo.click();
await v.click('.vs-resaltar button:has-text("Subrayar")');
const tramo = await v.evaluate(() => {
  const s = document.querySelector('.vs-resaltado.subrayado')?.getBoundingClientRect();
  const l = document.querySelectorAll('.vs-linea')[1]?.getBoundingClientRect();
  return s && l ? { s: s.width, l: l.width } : null;
});
comprobar(!!tramo && tramo.s > 5 && tramo.s < tramo.l * 0.6, 'Subrayada solo la palabra, no la línea', JSON.stringify(tramo));
await v.screenshot({ path: join(CAPTURAS, 'panel-linea.png') });
await v.click('.vs-panel-linea [aria-label="Cerrar"]');
await v.screenshot({ path: join(CAPTURAS, 'resaltados.png') });

// ---------- Una nota sobre la página ----------

console.log('\n== Una nota sobre la página ==');
await v.click('[aria-label="Añadir una nota"]');
comprobar(await v.evaluate(() => document.querySelector('.vs-lienzo')?.classList.contains('colocando')), 'El siguiente toque pondrá la nota');
const hoja = await v.locator('.vs-pagina').first().boundingBox();
await v.mouse.click(hoja.x + hoja.width * 0.7, hoja.y + hoja.height * 0.6);
await v.waitForSelector('.vs-nota-pagina .vs-editor-nota textarea', { timeout: 5000 });
comprobar((await v.evaluate(() => document.querySelector('.vs-numero')?.value)) === '1', 'Sin pasar de página al ponerla');
await v.fill('.vs-nota-pagina textarea', 'Repasar antes del examen');
await v.press('.vs-nota-pagina textarea', 'Enter');
comprobar((await contar(v, '.vs-nota-pagina .vs-editor-nota')) === 0 && (await contar(v, '.vs-nota-icono')) === 1, 'Intro la guarda y queda el papelito');
await v.click('.vs-nota-icono');
comprobar((await v.inputValue('.vs-nota-pagina textarea')) === 'Repasar antes del examen', 'Al tocarlo, se abre con su texto');
await v.screenshot({ path: join(CAPTURAS, 'nota-abierta.png') });
await v.click('.vs-nota-pagina button:has-text("Cancelar")');
await v.screenshot({ path: join(CAPTURAS, 'nota.png') });

// ---------- El panel «Notas» ----------

console.log('\n== El panel Notas ==');
await v.keyboard.press('PageDown');
await v.waitForTimeout(300);
await v.click('button[aria-label="Notas y marcadores"]');
await v.waitForSelector('.vs-panel-notas');
const items = await v.evaluate(() => [...document.querySelectorAll('.vs-nota-item')].map((li) => [...li.classList].find((c) => ['marcador', 'resaltado', 'nota'].includes(c))));
comprobar(JSON.stringify(items) === JSON.stringify(['marcador', 'resaltado', 'resaltado', 'nota']), 'Todo, en el orden de la página: el marcador, lo resaltado y la nota', JSON.stringify(items));
comprobar((await v.textContent('.vs-panel-notas'))?.includes('Definición de Brønsted'), 'Con los comentarios');
await v.click('.vs-notas-pagina-ir');
await v.waitForTimeout(300);
comprobar((await v.evaluate(() => document.querySelector('.vs-numero')?.value)) === '1', 'Tocar una página del panel lleva a ella');
await v.click('.vs-panel-notas button:has-text("Copiar")');
const copiado = await v.evaluate(() => navigator.clipboard.readText()).catch(() => null);
if (copiado !== null) comprobar(copiado.startsWith('# acidos') && copiado.includes('## Página 1') && copiado.includes('Repasar antes del examen'), 'Copiar las pone en el portapapeles como texto', copiado.slice(0, 80));
await v.screenshot({ path: join(CAPTURAS, 'panel.png') });
await v.click('[aria-label="Miniaturas"]');
comprobar((await contar(v, '.vs-miniatura .vs-cinta')) === 1, 'La miniatura de la página marcada lleva su cinta');
await v.waitForTimeout(800);
await v.close();

// ---------- Al volver, sigue ahí ----------

console.log('\n== Al volver a abrirlo ==');
v = await abrir();
await esperar(v, () => document.querySelectorAll('.vs-resaltado').length === 2);
comprobar((await contar(v, '.vs-resaltado')) === 2 && (await contar(v, '.vs-nota-icono')) === 1 && (await contar(v, '.vs-pagina .vs-cinta')) === 1, 'Los resaltados, la nota y el marcador siguen en su sitio');
await v.click('button[aria-label="Notas y marcadores"]');
await v.locator('.vs-nota-item.nota [aria-label="Quitar"]').click({ force: true });
comprobar((await contar(v, '.vs-nota-icono')) === 0 && (await contar(v, '.vs-nota-item')) === 3, 'Quitar una nota desde el panel');
await v.click('[aria-label="Quitar el marcador de esta página"]');
comprobar((await contar(v, '.vs-pagina .vs-cinta')) === 0, 'Y el marcador, con su botón');
await v.waitForTimeout(800);
await v.close();

// ---------- Se van con el libro ----------

console.log('\n== Al eliminar el libro ==');
const cuantas = () =>
  app.evaluate(
    (l) =>
      new Promise((ok) => {
        const q = indexedDB.open('kikitori');
        q.onsuccess = () => {
          const db = q.result;
          const c = db.transaction('anotaciones').objectStore('anotaciones').index('libro').count(l);
          c.onsuccess = () => (ok(c.result), db.close());
          c.onerror = () => (ok(-1), db.close());
        };
        q.onerror = () => ok(-1);
      }),
    libro
  );
comprobar((await cuantas()) === 2, 'Los dos resaltados están guardados', String(await cuantas()));
await app.reload();
await app.locator('button[aria-label="Eliminar acidos"]').click({ force: true });
await app.waitForTimeout(800);
comprobar((await cuantas()) === 0, 'Se borran con el libro', String(await cuantas()));

if (errores.length) console.log('\nErrores en la página:', [...new Set(errores)].slice(0, 6));
comprobar(errores.length === 0, 'Sin errores en las páginas');
console.log(`\n${fallos ? `${fallos} comprobaciones fallaron` : 'Todas las comprobaciones pasaron'}`);
await contexto.close();
process.exit(fallos ? 1 : 0);
