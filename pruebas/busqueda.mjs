// Prueba la búsqueda en el libro, la vista de texto y la revisión con Claude con un PDF hecho aquí mismo, que trae su
// texto (así no hace falta el OCR). En la página 2, el texto del PDF trae dos fallos típicos de un OCR (工ネルギー, イ才ン),
// y el servidor falso de Claude los cambia. No gasta nada.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/busqueda.mjs

import { mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';
import { iniciarMock } from './mock-claude.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-busqueda'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'busqueda');
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

// Página 1: un título y dos párrafos. Cada párrafo empieza con sangría y acaba en un renglón corto; los renglones enteros
// llegan hasta el mismo borde (20 letras de 16 puntos desde x = 72).
const T = '物質は原子からできている。原子は中心にある原子核とそのまわりの電子からなる。電子の数は元素によってちがう。';
const U = '酸は水にとけると水素イオンを出す。塩基は水酸化物イオンを出す。';
const PAGINAS = [
  [
    { texto: '第一章　化学の基礎', x: 72, y: 700, tam: 26 },
    { texto: T.slice(0, 19), x: 88, y: 640, tam: 16 },
    { texto: T.slice(19, 39), x: 72, y: 614, tam: 16 },
    { texto: T.slice(39, 48), x: 72, y: 588, tam: 16 },
    { texto: U.slice(0, 19), x: 88, y: 562, tam: 16 },
    { texto: U.slice(19), x: 72, y: 536, tam: 16 },
  ],
  [
    { texto: '第二章　エネルギー', x: 72, y: 700, tam: 26 },
    { texto: '熱や光は工ネルギーの一つである。', x: 72, y: 640, tam: 16 },
    { texto: '水にとけたイ才ンは電気を通す。', x: 72, y: 614, tam: 16 },
  ],
  [
    { texto: 'この家の台所には大きな白い冷蔵', x: 72, y: 640, tam: 16 },
    { texto: '庫とテレビがある。', x: 72, y: 614, tam: 16 },
  ],
];

/** Un PDF escrito a mano, con los renglones de cada página donde se dice. */
function pdfDePrueba() {
  const objetos = ['<< /Type /Catalog /Pages 2 0 R >>', '', FUENTE_JA];
  const hijos = [];
  for (const renglones of PAGINAS) {
    const contenido = renglones.map((r) => `BT /F1 ${r.tam} Tf ${r.x} ${r.y} Td ${ucs2(r.texto)} Tj ET`).join('\n');
    objetos.push(`<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`);
    objetos.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${objetos.length} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`);
    hijos.push(`${objetos.length} 0 R`);
  }
  objetos[1] = `<< /Type /Pages /Kids [${hijos.join(' ')}] /Count ${PAGINAS.length} >>`;
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

const mock = await iniciarMock();
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
await app.setInputFiles('input[type=file][aria-label="Importar archivos"]', [{ name: 'quimica.pdf', mimeType: 'application/pdf', buffer: pdfDePrueba() }]);
await esperar(app, () => !!document.querySelector('button.ap-tapa[aria-label="Leer quimica"]'));

const abrir = async () => {
  const nueva = contexto.waitForEvent('page', { timeout: 15000 });
  await app.locator('button.ap-tapa[aria-label="Leer quimica"]').click();
  const v = await nueva;
  vigilar(v);
  await v.waitForSelector('.vs-barra [aria-label="Buscar en el libro"]', { timeout: 20000 });
  return v;
};
const contar = (v, selector) => v.evaluate((s) => document.querySelectorAll(s).length, selector);
/**
 * El texto de un elemento sin el furigana, sin los caracteres invisibles que pegan los signos a la palabra de delante y
 * sin espacios.
 */
const limpio = (t) => t.replace(/\p{Cf}/gu, '').replace(/\s/g, '');
const sinFurigana = (v, selector) =>
  v.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const c = el.cloneNode(true);
    c.querySelectorAll('rt').forEach((r) => r.remove());
    return c.textContent.replace(/\p{Cf}/gu, '').replace(/\s/g, '');
  }, selector);
const paginaActual = (v) => v.inputValue('[aria-label="Ir a la página"]');
const irA = async (v, n) => {
  await v.fill('[aria-label="Ir a la página"]', String(n));
  await v.press('[aria-label="Ir a la página"]', 'Enter');
};

// ---------- Buscar en el libro ----------

console.log('\n== Buscar ==');
let v = await abrir();
await v.waitForSelector('.vs-linea', { timeout: 20000 });
await v.keyboard.press('Control+f');
await v.waitForSelector('.vs-panel-buscar input', { timeout: 5000 });
comprobar(!!(await esperar(v, () => document.activeElement?.closest('.vs-panel-buscar') != null, null, 3000)), 'Ctrl+F abre la búsqueda con el cursor en el campo');
await esperar(v, () => !document.querySelector('.vs-buscar-preparando'), null, 15000);
await v.keyboard.type('冷蔵庫');
await v.waitForSelector('.vs-resultado', { timeout: 8000 }).catch(() => {});
comprobar((await contar(v, '.vs-resultado')) === 1, 'Encuentra una palabra partida entre dos renglones');
comprobar((await v.textContent('.vs-buscar-estado'))?.includes('1 resultado.'), 'Y dice cuántos resultados hay', await v.textContent('.vs-buscar-estado'));
comprobar((await v.textContent('.vs-resultado mark')) === '冷蔵庫', 'Lo encontrado va marcado en el fragmento');
await v.keyboard.press('Enter');
await esperar(v, () => document.querySelectorAll('.vs-hallado').length > 0, null, 8000);
comprobar((await paginaActual(v)) === '3', 'Intro lleva a la página del resultado', await paginaActual(v));
comprobar((await contar(v, '.vs-hallado')) === 2, 'Y lo marca en la página, en los dos renglones', String(await contar(v, '.vs-hallado')));
const dentro = await v.evaluate(() => {
  const h = document.querySelector('.vs-hallado')?.getBoundingClientRect();
  const l = [...document.querySelectorAll('.vs-linea')].map((x) => x.getBoundingClientRect());
  return !!h && l.some((r) => h.left >= r.left - 2 && h.right <= r.right + 2 && Math.abs(h.top - r.top) < 3);
});
comprobar(dentro, 'La marca cae sobre su renglón');
await v.screenshot({ path: join(CAPTURAS, '1-buscar.png') });

await v.fill('.vs-panel-buscar input', 'てれび');
await esperar(v, () => document.querySelector('.vs-resultado mark')?.textContent === 'テレビ', null, 5000);
comprobar((await v.textContent('.vs-resultado mark')) === 'テレビ', 'Sin distinguir hiragana y katakana');
await v.fill('.vs-panel-buscar input', '原子');
await esperar(v, () => document.querySelectorAll('.vs-resultado').length === 3, null, 5000);
comprobar((await contar(v, '.vs-resultado')) === 3, 'Cada vez que aparece en la página', String(await contar(v, '.vs-resultado')));
comprobar((await v.textContent('.vs-resultados-pagina')) === 'Página 1', 'Agrupado por páginas');
comprobar((await v.textContent('.vs-buscar-estado'))?.includes('3 resultados en 1 página.'), 'Con el recuento', await v.textContent('.vs-buscar-estado'));
await v.keyboard.press('Enter');
await v.keyboard.press('Enter');
await esperar(v, () => document.querySelector('.vs-resultado.activo') === document.querySelectorAll('.vs-resultado')[1], null, 3000);
comprobar(await v.evaluate(() => document.querySelector('.vs-resultado.activo') === document.querySelectorAll('.vs-resultado')[1]), 'Intro pasa al siguiente resultado');
comprobar((await paginaActual(v)) === '1', 'En su página', await paginaActual(v));
await v.keyboard.press('Shift+Enter');
comprobar(await v.evaluate(() => document.querySelector('.vs-resultado.activo') === document.querySelectorAll('.vs-resultado')[0]), 'Y Mayúsculas+Intro, al anterior');
await v.fill('.vs-panel-buscar input', 'ありえない言葉');
await esperar(v, () => document.querySelector('.vs-buscar-estado')?.textContent?.includes('Sin resultados.'), null, 5000);
comprobar((await v.textContent('.vs-buscar-estado'))?.includes('Sin resultados.'), 'Y avisa si no hay nada');
comprobar((await contar(v, '.vs-buscar-aviso')) === 0, 'Todas las páginas tienen texto: no avisa de páginas sin leer');
comprobar((await contar(v, '.vs-hallado')) === 0, 'Al buscar otra cosa, se quita la marca de lo anterior');
await v.fill('.vs-panel-buscar input', '原子');
await esperar(v, () => document.querySelectorAll('.vs-resultado').length === 3, null, 5000);
await v.keyboard.press('Enter');
await esperar(v, () => document.querySelectorAll('.vs-hallado').length > 0, null, 5000);
await v.keyboard.press('Escape');
await esperar(v, () => !document.querySelector('.vs-panel-buscar') && !document.querySelector('.vs-hallado'), null, 3000);
comprobar((await contar(v, '.vs-panel-buscar')) === 0 && (await contar(v, '.vs-hallado')) === 0, 'Esc cierra la búsqueda y quita la marca');

// ---------- La vista de texto ----------

console.log('\n== Vista de texto ==');
await irA(v, 1);
await v.click('[aria-label="Ver como texto"]');
await v.waitForSelector('.vs-vista-texto .ap-papel .pal', { timeout: 20000 }).catch(() => {});
comprobar((await contar(v, '.vs-pagina img')) === 0, 'La imagen de la página deja paso a su texto');
comprobar((await sinFurigana(v, '.vs-vista-texto .ap-papel h3')) === '第一章化学の基礎', 'El título, aparte', await sinFurigana(v, '.vs-vista-texto .ap-papel h3'));
const parrafos = await v.evaluate(() =>
  [...document.querySelectorAll('.vs-vista-texto .ap-papel p.ap-p')].map((p) => {
    const c = p.cloneNode(true);
    c.querySelectorAll('rt').forEach((r) => r.remove());
    return c.textContent;
  })
);
comprobar(parrafos.length === 2, 'Los renglones, juntos en sus dos párrafos', String(parrafos.length));
comprobar(limpio(parrafos[0] ?? '') === T.slice(0, 48) && limpio(parrafos[1] ?? '') === U, 'Con el texto entero y sin cortes', JSON.stringify(parrafos.map(limpio)));
comprobar((await contar(v, '.vs-vista-texto .ap-comprension')) === 1, 'Con la comprensión del texto');
comprobar((await v.locator('.vs-vista-texto .ap-dock button', { hasText: 'Leer en voz alta' }).count()) === 1, 'Y la lectura en voz alta');
comprobar((await v.textContent('.vs-vista-texto .ap-lectura-titulo')) === 'Página 1', 'Dice de qué página es el texto');
comprobar((await contar(v, '[aria-label="Ajustar al ancho"]')) === 0 && (await contar(v, '[aria-label="Añadir una nota"]')) === 0, 'Sin el zoom ni las notas, que son de la imagen');
await v.locator('.vs-vista-texto .ap-papel .pal').nth(1).click();
await v.waitForSelector('.vs-vista-texto .ap-lectura-ficha', { timeout: 8000 }).catch(() => {});
comprobar((await contar(v, '.vs-vista-texto .ap-lectura-ficha')) === 1, 'Tocar una palabra abre su ficha');
await v.screenshot({ path: join(CAPTURAS, '2-vista-texto.png') });
await v.keyboard.press('Escape');
await v.click('.vs-barra .vs-titulo');
await v.keyboard.press('ArrowRight');
await esperar(v, () => document.querySelector('.vs-vista-texto .ap-lectura-titulo')?.textContent === 'Página 2', null, 5000);
comprobar((await v.textContent('.vs-vista-texto .ap-lectura-titulo')) === 'Página 2', 'Las flechas pasan de página también en el texto');
await v.waitForTimeout(900);
await v.close();
v = await abrir();
await v.waitForSelector('.vs-vista-texto', { timeout: 10000 }).catch(() => {});
comprobar((await contar(v, '.vs-vista-texto')) === 1, 'Al volver a abrir el libro, sigue en la vista de texto');
await v.click('[aria-label="Ver las páginas"]');
await v.waitForSelector('.vs-pagina img', { timeout: 10000 }).catch(() => {});
comprobar((await contar(v, '.vs-pagina img')) >= 1 && (await contar(v, '.vs-vista-texto')) === 0, 'Y «Ver las páginas» vuelve a la imagen');

// ---------- Revisar con Claude ----------

console.log('\n== Revisar con Claude ==');
await irA(v, 2);
await v.waitForSelector('.vs-linea', { timeout: 10000 });
const revisar = '[aria-label="Revisar el texto con Claude"]';
await v.click(revisar);
await v.waitForSelector('.vs-revision-error', { timeout: 10000 }).catch(() => {});
comprobar((await v.textContent('.vs-revision-error p').catch(() => ''))?.includes('Falta la clave de la API de Claude'), 'Sin clave, la revisión dice qué falta');
await sw.evaluate(async (url) => {
  await chrome.storage.local.set({ urlBaseIA: url, claveAnthropic: 'clave-de-prueba' });
}, `http://127.0.0.1:${mock.puerto}`);
await v.waitForTimeout(500);
const antes = mock.peticiones.length;
await v.click('.vs-revision-error button:has-text("Reintentar")');
await v.waitForSelector('.vs-propuesta', { timeout: 15000 }).catch(() => {});
comprobar((await contar(v, '.vs-propuesta')) === 2, 'Claude propone dos cambios', String(await contar(v, '.vs-propuesta')));
const peticion = mock.peticiones.slice(antes).find((p) => p.cuerpo.output_config?.format?.schema?.properties?.cambios)?.cuerpo;
const contenido = peticion?.messages?.[0]?.content ?? [];
comprobar(contenido[0]?.type === 'image' && contenido[0]?.source?.media_type === 'image/jpeg' && (contenido[0]?.source?.data?.length ?? 0) > 2000, 'Le llega la imagen de la página, en JPEG');
// pdf.js entrega el espacio ancho del título como un espacio normal.
comprobar(/Página 2\n\nRenglones leídos por el OCR, en el orden de lectura:\n0: 第二章\sエネルギー\n1: 熱や光は工ネルギーの一つである。\n2: 水にとけたイ才ンは電気を通す。$/.test(contenido[1]?.text ?? ''), 'Y el texto de la página, en líneas numeradas', contenido[1]?.text);
comprobar(peticion?.model === 'claude-haiku-5-5', 'Con el modelo de la tarea, Haiku 5.5', peticion?.model);
comprobar(JSON.stringify(peticion?.system ?? '').includes('Revisas el texto que un OCR leyó'), 'Y sus instrucciones');
comprobar((await v.textContent('.vs-propuesta-antes del')) === '工' && (await v.textContent('.vs-propuesta-despues ins')) === 'エ', 'Cada cambio se ve letra a letra: lo que se quita y lo que se pone');
await v.screenshot({ path: join(CAPTURAS, '3-revision.png') });
await v.locator('.vs-propuesta input[type=checkbox]').nth(1).uncheck();
comprobar((await v.textContent('.vs-revision-acciones button'))?.includes('Aplicar los elegidos'), 'Se eligen los cambios que se aplican');
await v.click('.vs-revision-acciones button');
await v.waitForSelector('.vs-revision-hecha', { timeout: 5000 }).catch(() => {});
comprobar((await v.textContent('.vs-revision-hecha'))?.includes('1 línea cambiada.'), 'Y se aplica solo el elegido');
// Tras aplicar, la lista ya no está: se abre la línea desde la página.
await v.locator('.vs-linea').nth(1).click();
await v.waitForSelector('.vs-panel-linea', { timeout: 5000 });
await esperar(v, () => document.querySelector('.vs-linea-texto .pal'), null, 15000);
comprobar((await sinFurigana(v, '.vs-linea-texto')) === '熱や光はエネルギーの一つである。', 'La línea queda con el texto revisado', await sinFurigana(v, '.vs-linea-texto'));
await v.screenshot({ path: join(CAPTURAS, '4-revisada.png') });
comprobar((await v.textContent('.vs-linea-acciones .ayuda').catch(() => '')) === 'Revisado con Claude', 'Y dice que la revisó Claude');
await v.locator('.vs-linea').nth(2).click();
await esperar(v, () => document.querySelector('.vs-linea-texto .pal'), null, 15000);
comprobar((await sinFurigana(v, '.vs-linea-texto')) === '水にとけたイ才ンは電気を通す。', 'La que no se eligió sigue como estaba');
await v.locator('.vs-linea').nth(1).click();
await v.click('.vs-linea-acciones button:has-text("Restaurar")');
await esperar(v, () => !document.querySelector('.vs-linea-acciones .ayuda'), null, 5000);
await esperar(v, () => document.querySelector('.vs-linea-texto .pal'), null, 15000);
comprobar((await sinFurigana(v, '.vs-linea-texto')) === '熱や光は工ネルギーの一つである。', '«Restaurar» la devuelve a como estaba');

// Con el mismo texto, la misma revisión: se lee de lo guardado y no se paga otra vez.
await v.click('.vs-panel-revision [aria-label="Cerrar"]');
const pedidas = mock.peticiones.length;
await v.click(revisar);
await v.waitForSelector('.vs-propuesta', { timeout: 10000 }).catch(() => {});
comprobar((await contar(v, '.vs-propuesta')) === 2 && mock.peticiones.length === pedidas, 'Revisar otra vez la misma página no vuelve a pedirla', `${mock.peticiones.length - pedidas} peticiones`);
await v.close();

if (errores.length) console.log('\nErrores en la página:', [...new Set(errores)].slice(0, 6));
comprobar(errores.length === 0, 'Sin errores en las páginas');
console.log(`\n${fallos ? `${fallos} comprobaciones fallaron` : 'Todas las comprobaciones pasaron'}`);
await contexto.close();
mock.servidor.close();
process.exit(fallos ? 1 : 0);
