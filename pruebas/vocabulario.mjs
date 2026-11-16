// Prueba el vocabulario de un libro y de una colección, con libros hechos aquí mismo: un texto pegado, un EPUB de texto
// por capítulos, un PDF con su texto y un CBZ de imágenes con lo leído por el OCR y una línea editada a mano. Comprueba
// el recuento y su orden, las frases de ejemplo con la palabra marcada, que las partículas no estorben y los nombres
// propios vayan aparte, los cambios de estado, las metas de comprensión, las tarjetas de golpe en Memoria, la gramática,
// el aviso de las páginas sin leer, cada tomo de una colección, el botón del visor y el inglés.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/vocabulario.mjs

import { mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-vocabulario'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'vocabulario');
mkdirSync(CAPTURAS, { recursive: true });
rmSync(PERFIL, { recursive: true, force: true });
const sharp = createRequire(join(RAIZ, 'package.json'))('sharp');

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
const fijarAjustes = (c) =>
  sw.evaluate(async (c) => {
    const d = await chrome.storage.local.get('ajustes');
    await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), ...c } });
  }, c);
await fijarAjustes({ bienvenidaVista: true, idiomaInterfaz: 'es', idiomaObjetivo: 'ja', destino: 'memoria', ankiPuerto: 1, avisarVersiones: false, prellenado: { audioPalabraDiccionario: false } });
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

/** Lo que enseña la lista: cada fila con su palabra, sus veces, su estado y su frase. */
const filas = () =>
  app.evaluate(() =>
    [...document.querySelectorAll('.ap-voc-fila')].map((f) => ({
      lema: f.querySelector('.ap-voc-termino b')?.textContent,
      veces: f.querySelector('.ap-voc-veces b')?.textContent,
      estado: f.querySelector('select')?.value,
      nombre: !!f.querySelector('.ap-voc-etiqueta'),
      ejemplo: f.querySelector('.ap-voc-ejemplo span')?.textContent,
      marca: f.querySelector('.ap-voc-ejemplo mark')?.textContent,
      lugar: f.querySelector('.ap-voc-ejemplo small')?.textContent,
    }))
  );
const listaLista = () => esperar(() => app.evaluate(() => !!document.querySelector('.ap-voc-lista') && !document.querySelector('.ap-voc-contando')), 60000);
const cifra = (sel) => app.evaluate((s) => document.querySelector(s)?.textContent ?? '', sel);
const filtro = (nombre) => app.locator('.ap-voc-filtros .segmentado button', { hasText: nombre }).first().click();

// ---------- Un texto ----------

console.log('\n== Un texto ==');
// 猫 sale cinco veces, 犬 tres y 鳥 una; 今日 es la primera palabra; 東京 es un nombre propio; los diálogos van seguidos.
const TEXTO = ['今日は猫が好きです。猫は毎日寝ています。', '「猫だ」「犬だ」', '東京で犬を見ました。猫と犬と鳥。', '猫の名前はまだ無い。'].join('\n');
await motor('bibliotecaGuardar', { id: 'texto-gatos', titulo: '猫の話', texto: TEXTO, origen: 'pegado', creado: Date.now() });
await ir('biblioteca');
await app.locator('button[aria-label="Opciones de 猫の話"]').click({ force: true });
await app.locator('.ap-menu-libro button', { hasText: 'Vocabulario' }).click();
comprobar(!!(await esperar(() => app.evaluate(() => location.hash.includes('vocabulario?libro=texto-gatos')))), 'El menú de un libro lleva a su vocabulario');
comprobar(!!(await listaLista()), 'La lista sale tras contar');
let f = await filas();
console.log('  filas:', JSON.stringify(f.map((x) => `${x.lema}${x.veces}`)));
comprobar(f[0]?.lema === '猫' && f[0]?.veces === '×5', 'Primero, la que más sale, con sus veces', JSON.stringify(f[0]));
comprobar(f[0]?.marca === '猫' && !!f[0]?.ejemplo?.includes('猫'), 'Con una frase suya del libro y la palabra marcada en ella', f[0]?.ejemplo);
comprobar(f.find((x) => x.lema === '犬')?.veces === '×3', 'Cuenta cada palabra', JSON.stringify(f.find((x) => x.lema === '犬')));
comprobar(!f.some((x) => ['は', 'が', 'の', 'と'].includes(x.lema)), 'Las partículas cuentan como sabidas: no están entre las que aprender');
comprobar(!f.some((x) => x.ejemplo?.startsWith('」')), 'Ninguna frase empieza con la comilla de cierre de la anterior');
const citas = await motor('contarPalabras', [{ texto: '「猫だ」「犬だ」', lugar: 0 }]);
comprobar(citas.frases === 2 && citas.palabras.find((x) => x.lema === '犬')?.ejemplos[0]?.texto === '「犬だ」', 'Dos citas seguidas son dos frases', JSON.stringify(citas.palabras.map((x) => x.ejemplos[0]?.texto)));
comprobar(!f.some((x) => x.lema === '東京'), 'Los nombres propios van aparte');
const cabecera = await cifra('.ap-voc-cab');
comprobar(/\d+ palabras/.test(cabecera) && cabecera.includes('猫の話'), 'La cabecera dice cuántas palabras tiene', cabecera);
await app.screenshot({ path: join(CAPTURAS, 'texto.png') });

await app.locator('.ap-voc-nombres').click();
f = await filas();
comprobar(!!f.find((x) => x.lema === '東京' && x.nombre), 'Y se ven con su botón, marcados como nombre', JSON.stringify(f.map((x) => x.lema)));
await app.locator('.ap-voc-nombres').click();

const comprensionAntes = Number((await cifra('.ap-voc-comprension text')).replace(/\D/g, ''));
await app.locator('.ap-voc-fila', { hasText: '猫' }).first().locator('select').selectOption('conocida');
const sinGato = await esperar(async () => ((await filas()).some((x) => x.lema === '猫') ? null : true));
comprobar(!!sinGato, 'Marcar una como conocida la quita de las que aprender');
const comprensionDespues = Number((await cifra('.ap-voc-comprension text')).replace(/\D/g, ''));
comprobar(comprensionDespues > comprensionAntes, 'Y sube la comprensión', `${comprensionAntes} → ${comprensionDespues}`);
const guardado = await motor('datosPalabras', [{ clave: '猫|ねこ', lema: '猫', lectura: 'ねこ', categoria: '名詞' }], true);
comprobar(guardado[0]?.estado === 'conocida', 'Queda guardado', JSON.stringify(guardado));

await app.locator('.ap-voc-orden select').selectOption('aparicion');
f = await filas();
comprobar(f[0]?.lema === '今日', 'En orden de aparición, la primera del texto va primero', f[0]?.lema);
await app.locator('.ap-voc-orden select').selectOption('veces');

await app.locator('.ap-voc-filtros input').fill('鳥');
f = await filas();
comprobar(f.length === 1 && f[0].lema === '鳥', 'Se busca en la lista', JSON.stringify(f.map((x) => x.lema)));
await app.locator('.ap-voc-filtros input').fill('');

// Las metas: elegir las palabras que hacen falta para el 90 %.
const meta = app.locator('.ap-voc-metas li button').first();
const cuantas = Number((await meta.textContent()).replace(/\D/g, ''));
await meta.click();
const elegidas = await esperar(() => app.evaluate(() => document.querySelector('.ap-voc-seleccion b')?.textContent ?? null));
comprobar(!!elegidas && Number(elegidas.replace(/\D/g, '')) === cuantas, 'Una meta elige las palabras que hacen falta para llegar', `${cuantas} · ${elegidas}`);
await app.locator('.ap-voc-seleccion button[aria-label="Quitar la selección"]').click();

// Dos tarjetas de golpe en Memoria, con su frase del libro.
for (const lema of ['犬', '鳥']) await app.locator('.ap-voc-fila', { hasText: lema }).first().locator('input[type=checkbox]').check();
await app.locator('.ap-voc-seleccion button', { hasText: 'Crear 2 en Memoria' }).click();
const creadas = await esperar(() => app.evaluate(() => document.querySelector('.ap-mensaje:not(.error)')?.textContent?.includes('2 tarjetas creadas en Memoria') || null), 30000);
comprobar(!!creadas, 'Crea las tarjetas de las elegidas y lo dice');
const tarjetas = await motor('memoriaPendientes', 10);
const deInu = tarjetas.find((t) => t.borrador.palabra === '犬');
comprobar(tarjetas.length === 2 && !!deInu?.borrador.frase.includes('<b>犬</b>') && deInu.borrador.fuente === '猫の話', 'En Memoria, con su frase del libro, la palabra en negrita y el libro', JSON.stringify(deInu?.borrador ?? {}).slice(0, 200));
await filtro('Aprendiendo');
f = await filas();
comprobar(f.length === 2 && f.every((x) => x.estado === 'aprendiendo'), 'Y esas palabras pasan a «Aprendiendo»', JSON.stringify(f.map((x) => `${x.lema}:${x.estado}`)));
await filtro('Por aprender');

await app.locator('.ap-voc-pestanas button', { hasText: 'Gramática' }).click();
const patron = app.locator('.ap-voc-gramatica .ap-patron-cab', { hasText: 'ている' }).first();
comprobar((await patron.count()) > 0, 'La gramática del libro, con sus puntos');
await patron.click();
const ejemploGram = await esperar(() => app.evaluate(() => document.querySelector('.ap-voc-gramatica .ap-patron-detalle .ejemplo-texto')?.textContent ?? null));
comprobar(!!ejemploGram?.includes('寝て'), 'Con su frase del libro', ejemploGram ?? '');
await app.screenshot({ path: join(CAPTURAS, 'gramatica.png') });

// ---------- Libros con archivo: EPUB de texto, PDF y CBZ ----------

console.log('\n== EPUB de texto, PDF y CBZ ==');
const capitulo = (texto) => `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>c</title></head><body><p>${texto}</p></body></html>`;
const EPUB = zipSync({
  mimetype: [strToU8('application/epub+zip'), { level: 0 }],
  'META-INF/container.xml': strToU8('<?xml version="1.0"?><container><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'),
  'OEBPS/content.opf': strToU8(`<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>山と川 第1巻</dc:title><dc:language>ja</dc:language></metadata>
    <manifest><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="c2.xhtml" media-type="application/xhtml+xml"/></manifest>
    <spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>`),
  'OEBPS/c1.xhtml': strToU8(capitulo('山に<ruby>登<rt>のぼ</rt></ruby>りました。山は高い。')),
  'OEBPS/c2.xhtml': strToU8(capitulo('川で泳ぎました。川は広い。')),
});
const hoja = await contexto.newPage();
await hoja.setContent(`<!doctype html><html lang="ja"><meta charset="utf-8"><style>body { font-family: 'Yu Gothic','Meiryo',sans-serif; font-size: 22px; } .p { page-break-after: always; }</style>
  <p class="p">海が見えます。山も見えます。</p><p>海で魚を釣りました。</p></html>`);
const PDF = await hoja.pdf({ format: 'A5' });
await hoja.close();
const png = (texto) => sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="560"><rect width="100%" height="100%" fill="#eee"/><text x="50%" y="50%" font-size="60" text-anchor="middle">${texto}</text></svg>`)).png().toBuffer();
const CBZ = zipSync({ '001.png': new Uint8Array(await png('1')), '002.png': new Uint8Array(await png('2')), '003.png': new Uint8Array(await png('3')) });

await ir('biblioteca');
const ARCHIVO = 'input[type=file][aria-label="Importar archivos"]';
await app.waitForSelector(ARCHIVO, { state: 'attached' });
await app.setInputFiles(ARCHIVO, [
  { name: '山と川.epub', mimeType: 'application/epub+zip', buffer: Buffer.from(EPUB) },
  { name: '山と川 第2巻.pdf', mimeType: 'application/pdf', buffer: PDF },
  { name: '森の漫画.cbz', mimeType: 'application/zip', buffer: Buffer.from(CBZ) },
]);
const libros = await esperar(async () => {
  const l = await motor('bibliotecaListar');
  return l.filter((e) => e.documento).length === 3 ? l : null;
}, 30000);
const epub = libros?.find((e) => e.documento?.texto);
const pdf = libros?.find((e) => e.documento?.formato === 'pdf');
const cbz = libros?.find((e) => e.documento?.formato === 'cbz');
comprobar(!!epub && !!pdf && !!cbz, 'Se importan los tres libros', JSON.stringify(libros?.map((e) => e.titulo)));

await ir(`vocabulario?libro=${encodeURIComponent(epub.id)}`);
await listaLista();
f = await filas();
comprobar(f.find((x) => x.lema === '山')?.veces === '×2' && f.find((x) => x.lema === '川')?.lugar === 'cap. 2', 'Un EPUB de texto, por capítulos', JSON.stringify(f.map((x) => `${x.lema}${x.veces} ${x.lugar}`)));
comprobar(!f.some((x) => x.lema === 'のぼ' || x.ejemplo?.includes('のぼ')), 'Sin el furigana del libro');

await ir(`vocabulario?libro=${encodeURIComponent(pdf.id)}`);
await listaLista();
f = await filas();
comprobar(f.find((x) => x.lema === '魚')?.lugar === 'p. 2' && f.find((x) => x.lema === '海')?.veces === '×2', 'Un PDF con su texto, por páginas', JSON.stringify(f.map((x) => `${x.lema}${x.veces} ${x.lugar}`)));

// El CBZ: sin leer con el OCR no tiene texto, y lo dice.
await ir(`vocabulario?libro=${encodeURIComponent(cbz.id)}`);
const vacio = await esperar(() => app.evaluate(() => document.querySelector('.ap-vacio h3')?.textContent ?? null), 30000);
comprobar(vacio === 'Este libro aún no tiene texto' && (await app.locator('.ap-vacio button', { hasText: 'Leer el libro entero' }).count()) === 1, 'Un libro de imágenes sin leer lo dice, con el botón para leerlo', vacio ?? '');
// Lo leído con el OCR en dos de sus tres páginas, y una línea editada a mano.
const modo = cbz.documento.ocr?.modo ?? (cbz.documento.direccion === 'rtl' ? 'manga' : 'libro');
await app.evaluate(async ({ libro, modo }) => {
  const abrir = () => new Promise((ok, mal) => {
    const r = indexedDB.open('kotonoha-ocr');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
  const db = await abrir();
  const tx = db.transaction(['paginas', 'ediciones'], 'readwrite');
  const linea = (texto, y) => ({ texto, caja: { x0: 0.1, y0: y, x1: 0.9, y1: y + 0.05 }, vertical: false });
  tx.objectStore('paginas').put({ clave: `${libro}:${modo}:0`, libro, lineas: [linea('森へ行こう。', 0.1)], creada: Date.now(), lectura: 1 });
  tx.objectStore('paginas').put({ clave: `${libro}:${modo}:1`, libro, lineas: [linea('森は暗い。', 0.1), linea('鳥が鳴く。', 0.5)], creada: Date.now(), lectura: 1 });
  tx.objectStore('ediciones').put({ clave: `${libro}:1:a`, libro, pagina: 1, caja: { x0: 0.1, y0: 0.5, x1: 0.9, y1: 0.55 }, original: '鳥が鳴く。', texto: '蛙が鳴く。', creada: Date.now() });
  await new Promise((ok, mal) => {
    tx.oncomplete = ok;
    tx.onerror = () => mal(tx.error);
  });
  db.close();
}, { libro: cbz.id, modo });
await ir(`vocabulario?libro=${encodeURIComponent(cbz.id)}`);
await listaLista();
f = await filas();
const aviso = await cifra('.ap-voc-aviso');
comprobar(aviso.includes('2 de sus 3 páginas') && (await app.locator('.ap-voc-aviso button', { hasText: 'Leer el libro entero' }).count()) === 1, 'Con texto a medias, avisa de las páginas sin leer', aviso);
comprobar(f.find((x) => x.lema === '森')?.veces === '×2', 'Cuenta lo leído con el OCR', JSON.stringify(f.map((x) => `${x.lema}${x.veces}`)));
comprobar(f.some((x) => x.lema === '蛙') && !f.some((x) => x.lema === '鳥'), 'Con lo editado a mano encima');
await app.screenshot({ path: join(CAPTURAS, 'ocr.png') });

// ---------- Una colección ----------

console.log('\n== Una colección ==');
await motor('coleccionGuardar', { id: 'serie', nombre: '山と川', tipo: 'manga', creada: Date.now() });
for (const e of [epub, pdf]) await motor('bibliotecaCambiar', e.id, { coleccion: 'serie' });
await ir('biblioteca?coleccion=serie');
await app.locator('.ap-coleccion-acciones button', { hasText: 'Vocabulario' }).click();
comprobar(!!(await esperar(() => app.evaluate(() => location.hash.includes('vocabulario?coleccion=serie')))), 'Una colección tiene su vocabulario');
await listaLista();
f = await filas();
comprobar(f.find((x) => x.lema === '山')?.veces === '×3' && !!f.find((x) => x.lema === '海')?.lugar?.startsWith('Tomo 2 · p.') && !!f.find((x) => x.lema === '川')?.lugar?.startsWith('Tomo 1 · cap.'), 'Junta sus tomos, y cada frase dice de cuál es', JSON.stringify(f.map((x) => `${x.lema}${x.veces} ${x.lugar}`)));
await app.locator('.ap-voc-pestanas button', { hasText: 'Por tomo' }).click();
const tomos = await app.evaluate(() => [...document.querySelectorAll('.ap-voc-libro')].map((x) => x.textContent));
comprobar(tomos.length === 2 && tomos[0].includes('Tomo 1') && tomos[1].includes('nuevas en la serie'), 'Cada tomo, con lo que trae de nuevo', JSON.stringify(tomos));
await app.screenshot({ path: join(CAPTURAS, 'coleccion.png') });
await app.locator('.ap-voc-libro').nth(1).click();
comprobar(!!(await esperar(() => app.evaluate((idPdf) => location.hash.includes(`vocabulario?libro=${encodeURIComponent(idPdf)}`), pdf.id))), 'Y lleva al vocabulario de cada uno');

// ---------- Desde el visor ----------

console.log('\n== Desde el visor ==');
const visor = await contexto.newPage();
visor.on('pageerror', (e) => errores.push(e.message));
await visor.goto(`chrome-extension://${id}/visor.html#${encodeURIComponent(pdf.id)}`);
await visor.locator('button[aria-label="Vocabulario del libro"]').click({ timeout: 20000 });
const pedida = await esperar(() => sw.evaluate(async () => (await chrome.tabs.query({})).map((t) => t.pendingUrl || t.url).find((u) => u?.includes('#/vocabulario?libro=')) ?? null));
comprobar(!!pedida?.includes(encodeURIComponent(pdf.id)), 'El visor abre el vocabulario de su libro', pedida ?? '');
await visor.close();

// ---------- Inglés ----------

console.log('\n== Inglés ==');
await fijarAjustes({ idiomaObjetivo: 'en' });
await motor('fijarLengua', 'en');
await motor('bibliotecaGuardar', { id: 'texto-ingles', titulo: 'Cats', texto: 'The cats were running in Paris. A cat runs fast. My cats sleep.', origen: 'pegado', creado: Date.now() });
await ir('vocabulario?libro=texto-ingles');
await listaLista();
f = await filas();
console.log('  filas:', JSON.stringify(f.map((x) => `${x.lema}${x.veces}`)));
comprobar(f[0]?.lema === 'cat' && f[0]?.veces === '×3', 'En inglés cuenta cada palabra por su forma de diccionario', JSON.stringify(f[0]));
comprobar(f.find((x) => x.lema === 'run')?.veces === '×2' && !f.some((x) => x.lema === 'Paris'), 'Con los verbos juntos y los nombres propios aparte');
comprobar(f.find((x) => x.lema === 'cat')?.marca?.toLowerCase().startsWith('cat') ?? false, 'Y la palabra marcada en su frase', JSON.stringify(f[0]));

comprobar(errores.length === 0, 'Sin errores en las páginas', errores.join(' | '));
await contexto.close();
console.log(`\n${fallos ? `${fallos} FALLOS` : 'Todo bien'}`);
process.exit(fallos ? 1 : 0);
