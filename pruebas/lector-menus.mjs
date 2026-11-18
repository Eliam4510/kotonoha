// Prueba la barra del visor de la 0.36.0 con un PDF hecho aquí mismo, con capítulos y texto de Sōseki, de dominio
// público: los menús con el ratón y con el teclado, los submenús, la paleta de acciones (Ctrl+K) con un número de página,
// los atajos («?»), ir a una página con G, el marcador con B, la mano, el resaltador, la nota y Esc, el menú contextual,
// «Atrás» tras un salto, el modo lectura, «Aa» (que guarda las ayudas para todo Kotonoha), el ancho del panel de la
// izquierda, la barra de estado y que un libro abierto no abre otra pestaña.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/lector-menus.mjs

import { mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';
import { estadoOrden, orden } from './ordenes.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-lector-menus'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'lector-menus');
mkdirSync(CAPTURAS, { recursive: true });
rmSync(PERFIL, { recursive: true, force: true });

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};
const esperar = async (fn, ms = 10000) => {
  const limite = Date.now() + ms;
  for (;;) {
    const r = await fn().catch(() => null);
    if (r) return r;
    if (Date.now() > limite) return null;
    await new Promise((x) => setTimeout(x, 100));
  }
};

const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1440, height: 900 },
  args: ['--mute-audio', `--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
for (const pg of contexto.pages()) if (pg.url().includes('app.html')) await pg.close();
await sw.evaluate(async () => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), bienvenidaVista: true, idiomaInterfaz: 'es', idiomaObjetivo: 'ja', destino: 'memoria', ankiPuerto: 1, furigana: 'todas' } });
});
const errores = [];

// ---------- El libro: cuatro páginas, con dos capítulos en su índice ----------

const P1 = '吾輩は猫である。名前はまだ無い。';
const P2 = 'どこで生れたかとんと見当がつかぬ。何でも薄暗いじめじめした所でニャーニャー泣いていた事だけは記憶している。吾輩はここで始めて人間というものを見た。しかもあとで聞くとそれは書生という人間中で一番獰悪な種族であったそうだ。';
const hoja = await contexto.newPage();
await hoja.setContent(`<!doctype html><html lang="ja"><meta charset="utf-8"><style>
  @page { size: A5; margin: 18mm 16mm; }
  body { font-family: 'Yu Mincho','MS Mincho',serif; color: #111; margin: 0; }
  h1 { font-size: 20px; margin: 0 0 12px; } p { font-size: 15px; line-height: 1.85; margin: 0; text-indent: 1em; text-align: justify; }
  .salto { page-break-before: always; }
</style>
<h1>第一章</h1><p>${P1}</p><p>${P2}</p><p>${P2}</p>
<h1 class="salto">第二章</h1><p>${P2}</p><p class="salto">${P2}</p><p class="salto">${P2}</p></html>`);
const PDF = await hoja.pdf({ format: 'A5', printBackground: true, outline: true, tagged: true });
await hoja.close();

const app = await contexto.newPage();
app.on('pageerror', (e) => errores.push(e.message));
await app.goto(`chrome-extension://${id}/app.html#/biblioteca`);
const ARCHIVO = 'input[type=file][aria-label="Importar archivos"]';
await app.waitForSelector(ARCHIVO, { state: 'attached' });
await app.setInputFiles(ARCHIVO, [{ name: 'neko.pdf', mimeType: 'application/pdf', buffer: PDF }]);
await esperar(() => app.evaluate(() => document.querySelectorAll('.ap-libro').length === 1), 20000);
const nueva = contexto.waitForEvent('page', { timeout: 15000 });
await app.locator('button.ap-tapa').first().click();
const v = await nueva;
v.on('pageerror', (e) => errores.push(e.message));
await esperar(() => v.evaluate(() => document.querySelectorAll('.vs-linea').length >= 3), 20000);
await v.waitForTimeout(500);

const pagina = () => v.evaluate(() => document.querySelector('.vs-numero')?.value);
const foco = () => v.evaluate(() => {
  const a = document.activeElement;
  return a?.dataset?.menu ?? a?.dataset?.orden ?? a?.className ?? '';
});
const visible = (sel) => v.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && getComputedStyle(el).visibility !== 'hidden';
}, sel);
const lineaCon = async (trozo) => {
  const l = await v.evaluate((t) => [...document.querySelectorAll('.vs-linea')].map((b) => b.getAttribute('aria-label')).find((x) => x?.includes(t)) ?? '', trozo);
  return { texto: l, caja: await v.locator(`.vs-linea[aria-label="${l}"]`).first().boundingBox() };
};

// ---------- La barra y la barra de estado ----------

console.log('\n== La barra ==');
const barra = await v.locator('.vs-barra').boundingBox();
comprobar(barra.height < 56, 'La barra de arriba es de una sola fila', `${Math.round(barra.height)} px`);
const nombres = await v.evaluate(() => [...document.querySelectorAll('.vs-menus-nombre')].map((b) => b.textContent));
comprobar(JSON.stringify(nombres) === JSON.stringify(['Libro', 'Ver', 'Ir', 'Texto', 'Ayudas', 'Anotar', 'Ayuda']), 'Con los menús por su nombre', JSON.stringify(nombres));
comprobar((await v.textContent('.vs-donde')) === 'Página 1 de 4' && (await v.textContent('.vs-origen')) === 'Texto del PDF', 'La barra de estado dice dónde se está y de dónde sale el texto', `${await v.textContent('.vs-donde')} · ${await v.textContent('.vs-origen')}`);
await v.screenshot({ path: join(CAPTURAS, '1-barra.png') });

// ---------- Los menús, con el ratón y con el teclado ----------

console.log('\n== Los menús ==');
await v.click('[data-menu="ver"]');
comprobar(await visible('.vs-menu [data-orden="vista-doble"]'), 'Un clic abre el menú Ver, con sus órdenes');
await v.hover('[data-menu="ir"]');
comprobar(await visible('.vs-menu [data-orden="primera"]') && !(await visible('[data-orden="vista-doble"]')), 'Con un menú abierto, pasar a otro nombre abre ese');
await v.keyboard.press('Escape');
comprobar(!(await visible('.vs-menu')) && (await foco()) === 'ir', 'Esc lo cierra y el foco vuelve a su nombre', await foco());
await v.keyboard.press('ArrowDown');
comprobar((await foco()) === 'primera', 'La flecha abajo lo abre con la primera orden elegida', await foco());
await v.keyboard.press('ArrowRight');
comprobar(await visible('.vs-menu [data-orden="ocr"]'), 'La flecha derecha pasa al menú de al lado');
await v.keyboard.press('Escape');
await v.click('[data-menu="ver"]');
await v.click('[data-submenu="Sentido de lectura"]');
comprobar(await visible('.vs-submenu [data-orden="sentido-rtl"]'), 'Un submenú se abre con un clic, a un lado');
await v.screenshot({ path: join(CAPTURAS, '2-submenu.png') });
await v.click('.vs-submenu [data-orden="sentido-rtl"]');
comprobar(!(await visible('.vs-menu')) && (await estadoOrden(v, 'sentido-rtl')).marcada, 'Elegir una opción la aplica y cierra el menú');
await orden(v, 'sentido-ltr');

// ---------- La paleta ----------

console.log('\n== La paleta ==');
await v.keyboard.press('Control+k');
await v.waitForSelector('.vs-paleta input');
await v.keyboard.type('doble');
const primera = await v.evaluate(() => document.querySelector('.vs-paleta-orden')?.dataset.orden);
comprobar(primera === 'vista-doble', 'Encuentra una orden por lo que hace, esté en el menú que esté', primera);
await v.keyboard.press('Enter');
comprobar(await esperar(() => v.evaluate(() => document.querySelector('.vs-lienzo')?.dataset.vista === 'doble'), 3000), 'Intro la ejecuta');
await orden(v, 'vista-una');
await v.keyboard.press('Control+k');
await v.waitForSelector('.vs-paleta input');
await v.keyboard.type('3');
comprobar((await v.evaluate(() => document.querySelector('.vs-paleta-orden .vs-menu-etiqueta')?.textContent)) === 'Ir a la página 3', 'Un número lleva a esa página');
await v.keyboard.press('Enter');
comprobar(await esperar(async () => (await pagina()) === '3', 3000), 'Y va', await pagina());

// ---------- Atrás ----------

console.log('\n== Atrás ==');
comprobar((await v.textContent('.vs-atras').catch(() => ''))?.includes('Volver a la página 1'), 'Tras un salto, la barra de estado ofrece volver', await v.textContent('.vs-atras').catch(() => ''));
await v.keyboard.press('Alt+ArrowLeft');
comprobar(await esperar(async () => (await pagina()) === '1', 3000), 'Alt+← vuelve a la página de antes del salto', await pagina());
comprobar(!(await visible('.vs-atras')), 'Y ya no hay adónde volver');
const indice = await v.$('.vs-carril [aria-label="Índice"]');
if (indice) {
  await indice.click();
  await v.locator('.vs-indice button').nth(1).click();
  comprobar(await esperar(async () => (await pagina()) === '2', 3000), 'Una entrada del índice lleva a su capítulo', await pagina());
  await v.click('.vs-atras');
  comprobar(await esperar(async () => (await pagina()) === '1', 3000), 'Y «Volver» deshace el salto', await pagina());
  await v.click('.vs-carril [aria-label="Índice"]');
} else console.log('  (el PDF salió sin índice: se salta el salto desde el índice)');

// ---------- Teclas sueltas: ?, G, B ----------

console.log('\n== Teclas ==');
await v.mouse.click(30, 860);
await v.keyboard.press('?');
comprobar(await esperar(() => visible('.vs-atajos'), 3000), '«?» enseña los atajos');
comprobar((await v.textContent('.vs-atajos'))?.includes('Ir a la página') && (await v.textContent('.vs-atajos'))?.includes('Modo lectura'), 'Con las teclas de cada orden');
await v.screenshot({ path: join(CAPTURAS, '3-atajos.png') });
await v.keyboard.press('Escape');
comprobar(!(await visible('.vs-atajos')), 'Esc los cierra');
await v.keyboard.press('g');
comprobar((await foco()).includes('vs-numero'), 'G lleva al número de página', await foco());
await v.keyboard.type('4');
await v.keyboard.press('Enter');
comprobar(await esperar(async () => (await pagina()) === '4', 3000), 'Y con Intro se va', await pagina());
await v.keyboard.press('Home');
await esperar(async () => (await pagina()) === '1', 3000);
await v.keyboard.press('b');
comprobar(await esperar(() => v.evaluate(() => document.querySelectorAll('.vs-pagina .vs-cinta').length === 1), 3000), 'B marca la página');
await v.keyboard.press('b');
comprobar(await esperar(() => v.evaluate(() => document.querySelectorAll('.vs-pagina .vs-cinta').length === 0), 3000), 'Y otra vez la desmarca');
await v.keyboard.press('F10');
comprobar((await foco()) === 'libro', 'F10 lleva a la barra de menús', await foco());
await v.keyboard.press('Escape');
await v.mouse.click(30, 860);

// ---------- Las herramientas ----------

console.log('\n== La mano ==');
await v.keyboard.press('h');
comprobar(await v.evaluate(() => document.querySelector('.vs-lienzo')?.classList.contains('mano')), 'H toma la mano');
await orden(v, 'zoom-ancho');
await orden(v, 'acercar');
await orden(v, 'acercar');
await v.waitForTimeout(400);
const larga = await lineaCon('見当');
const antesScroll = await v.evaluate(() => document.querySelector('.vs-lienzo').scrollTop + document.querySelector('.vs-lienzo').scrollLeft);
await v.mouse.move(larga.caja.x + 40, larga.caja.y + larga.caja.height / 2);
await v.mouse.down();
await v.mouse.move(larga.caja.x + 20, larga.caja.y - 120, { steps: 8 });
await v.mouse.up();
await v.waitForTimeout(200);
const despuesScroll = await v.evaluate(() => document.querySelector('.vs-lienzo').scrollTop + document.querySelector('.vs-lienzo').scrollLeft);
comprobar(despuesScroll > antesScroll + 60, 'Arrastrar con la mano mueve la página', `${antesScroll} → ${despuesScroll}`);
comprobar(!(await visible('.vs-ventana')) && !(await visible('.vs-seleccion')), 'Sin seleccionar ni abrir la ventana');
const tocada = await lineaCon('見当');
await v.mouse.click(tocada.caja.x + tocada.caja.width * 0.3, tocada.caja.y + tocada.caja.height / 2);
comprobar(!!(await esperar(() => visible('.vs-ventana'), 8000)), 'Tocar una palabra con la mano sigue abriendo su frase');
await v.keyboard.press('Escape');
await orden(v, 'zoom-pagina');
await v.keyboard.press('v');

console.log('\n== El resaltador ==');
await v.keyboard.press('r');
comprobar(await visible('.vs-carril-colores'), 'R toma el resaltador, con sus colores en el carril');
const resaltar = async () => {
  const l = await lineaCon('見当');
  await v.mouse.move(l.caja.x + l.caja.width * 0.1, l.caja.y + l.caja.height / 2);
  await v.mouse.down();
  await v.mouse.move(l.caja.x + l.caja.width * 0.6, l.caja.y + l.caja.height / 2, { steps: 6 });
  await v.mouse.up();
  await v.waitForTimeout(300);
};
await resaltar();
comprobar((await v.evaluate(() => document.querySelectorAll('.vs-resaltado.fondo.amarillo').length)) >= 1, 'Lo arrastrado queda resaltado en amarillo');
comprobar(!(await visible('.vs-ventana')), 'Sin abrir la ventana');
await v.click('.vs-carril-colores .vs-color.verde');
await resaltar();
comprobar((await v.evaluate(() => document.querySelectorAll('.vs-resaltado.verde').length)) === 1 && (await v.evaluate(() => document.querySelectorAll('.vs-resaltado').length)) === 1, 'Con otro color, lo mismo cambia de color en vez de duplicarse');
await v.screenshot({ path: join(CAPTURAS, '4-resaltador.png') });
await v.keyboard.press('v');

console.log('\n== La nota ==');
await v.keyboard.press('n');
comprobar(await visible('.vs-aviso-herramienta'), 'N espera el toque donde va la nota, y lo dice');
await v.keyboard.press('Escape');
comprobar(!(await visible('.vs-aviso-herramienta')) && (await estadoOrden(v, 'seleccionar')).marcada, 'Esc la deja sin poner y vuelve a seleccionar');

// ---------- El menú contextual ----------

console.log('\n== El menú contextual ==');
const h = await v.locator('.vs-pagina').first().boundingBox();
await v.mouse.click(h.x + h.width * 0.5, h.y + h.height * 0.85, { button: 'right' });
comprobar(await visible('.vs-contextual [data-orden="ctx-nota"]'), 'Un clic derecho en la página abre su menú');
await v.screenshot({ path: join(CAPTURAS, '5-contextual.png') });
await v.click('.vs-contextual [data-orden="ctx-copiar-pagina"]');
const copiado = await v.evaluate(() => navigator.clipboard.readText()).catch(() => null);
if (copiado !== null) comprobar(copiado.startsWith('第一章') && copiado.includes(P1) && copiado.includes('\n'), 'Copia el texto de la página, por párrafos', copiado.slice(0, 40));
await v.mouse.click(h.x + h.width * 0.5, h.y + h.height * 0.85, { button: 'right' });
await v.click('.vs-contextual [data-orden="ctx-nota"]');
comprobar(!!(await esperar(() => visible('.vs-nota-pagina .vs-editor-nota textarea'), 3000)), '«Añadir una nota aquí» la pone justo donde se pulsó');
await v.click('.vs-nota-pagina button:has-text("Cancelar")').catch(() => {});

// ---------- El modo lectura ----------

console.log('\n== El modo lectura ==');
await v.mouse.click(30, 860);
await v.keyboard.press('m');
await v.waitForTimeout(400);
const enLectura = await v.evaluate(() => ({ carril: !!document.querySelector('.vs-carril')?.getBoundingClientRect().width, pie: !!document.querySelector('.vs-pie')?.getBoundingClientRect().width, barra: document.querySelector('.vs-barra').getBoundingClientRect().bottom }));
comprobar(!enLectura.carril && !enLectura.pie && enLectura.barra <= 1, 'M deja solo la página, sin barras', JSON.stringify(enLectura));
await v.mouse.move(700, 8);
comprobar(await esperar(() => v.evaluate(() => document.querySelector('.vs-barra').getBoundingClientRect().top >= -1), 3000), 'La barra se asoma al llevar el ratón arriba');
await v.screenshot({ path: join(CAPTURAS, '6-modo-lectura.png') });
await v.mouse.move(700, 600);
comprobar(await esperar(() => v.evaluate(() => document.querySelector('.vs-barra').getBoundingClientRect().bottom <= 1), 3000), 'Y se va al bajarlo');
await v.keyboard.press('Escape');
comprobar(await esperar(() => visible('.vs-carril'), 3000), 'Esc sale del modo lectura');

// ---------- «Aa» ----------

console.log('\n== Aa ==');
await v.click('.vs-aa');
const aa = await v.textContent('.vs-aa-panel').catch(() => '');
comprobar(aa.includes('En todo Kotonoha') && aa.includes('Solo en este libro'), '«Aa» dice qué vale para todo y qué solo para este libro');
await v.screenshot({ path: join(CAPTURAS, '7-aa.png') });
await v.locator('.vs-aa-panel [role="radiogroup"]').first().locator('button', { hasText: 'Nada' }).click();
const furigana = await esperar(() => sw.evaluate(async () => {
  const d = await chrome.storage.local.get('ajustes');
  return d.ajustes?.furigana === 'ninguna' ? 'ninguna' : null;
}), 3000);
comprobar(furigana === 'ninguna', 'Cambiar la lectura sobre las palabras la guarda para todo Kotonoha');
await v.locator('.vs-aa-panel [role="radiogroup"]').first().locator('button', { hasText: 'Todo' }).click();
await v.keyboard.press('Escape');
comprobar(!(await visible('.vs-aa-panel')), 'Esc lo cierra');

// ---------- El panel de la izquierda se ensancha ----------

console.log('\n== Paneles ==');
await v.click('.vs-carril [aria-label="Miniaturas"]');
await v.waitForSelector('.vs-lateral');
const ancho0 = (await v.locator('.vs-lateral').boundingBox()).width;
const borde = await v.locator('.vs-lateral-borde').boundingBox();
await v.mouse.move(borde.x + borde.width / 2, borde.y + 200);
await v.mouse.down();
await v.mouse.move(borde.x + borde.width / 2 + 120, borde.y + 200, { steps: 6 });
await v.mouse.up();
const ancho1 = (await v.locator('.vs-lateral').boundingBox()).width;
comprobar(ancho1 > ancho0 + 100, 'Arrastrando su borde, el panel se ensancha', `${Math.round(ancho0)} → ${Math.round(ancho1)}`);
await v.waitForTimeout(900);

// ---------- Un libro, una pestaña ----------

console.log('\n== Una sola pestaña por libro ==');
const pestanas = contexto.pages().length;
await app.bringToFront();
await app.locator('button.ap-tapa').first().click();
await v.waitForTimeout(1500);
const activa = await sw.evaluate(async () => (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]?.url ?? '');
comprobar(contexto.pages().length === pestanas && activa.includes('visor.html'), 'Abrir otra vez el libro lleva a su pestaña, sin abrir otra', `${pestanas} → ${contexto.pages().length}`);
await v.reload();
await v.waitForSelector('.vs-carril');
await v.click('.vs-carril [aria-label="Miniaturas"]');
const ancho2 = (await v.locator('.vs-lateral').boundingBox()).width;
comprobar(Math.abs(ancho2 - ancho1) < 3, 'El ancho del panel se recuerda', `${Math.round(ancho2)}`);

if (errores.length) console.log('\nErrores en la página:', [...new Set(errores)].slice(0, 6));
comprobar(errores.length === 0, 'Sin errores en las páginas');
console.log(`\n${fallos ? `${fallos} comprobaciones fallaron` : 'Todas las comprobaciones pasaron'}`);
await contexto.close();
rmSync(PERFIL, { recursive: true, force: true });
process.exit(fallos ? 1 : 0);
