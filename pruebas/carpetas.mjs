// Prueba la importación de carpetas de imágenes en la Ayuda de lectura con una carpeta hecha aquí mismo: una serie con
// dos tomos (uno con la portada llamada cover.jpg, que el orden natural dejaría al final, y una doble página apaisada;
// otro con su ComicInfo.xml), un archivo que no es imagen y unas imágenes sueltas. Comprueba la estantería, el orden de
// las páginas, la doble página que va sola, el sentido de lectura y que cada libro se guarda como un CBZ.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/carpetas.mjs

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-carpetas'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'carpetas');
const CARPETA = join(CAPTURAS, 'Serie de prueba');
rmSync(PERFIL, { recursive: true, force: true });
rmSync(CAPTURAS, { recursive: true, force: true });
mkdirSync(CAPTURAS, { recursive: true });
const sharp = createRequire(join(RAIZ, 'package.json'))('sharp');

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};

// ---------- La carpeta de prueba ----------

const COLORES = ['#e8d5c4', '#c4dce8', '#d9e8c4', '#e8c4dc', '#e8e2c4'];
const imagen = (texto, n, ancho = 600, alto = 850, formato = 'jpeg') =>
  sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}"><rect width="100%" height="100%" fill="${COLORES[n % COLORES.length]}"/><text x="50%" y="55%" font-size="160" font-family="sans-serif" text-anchor="middle" fill="#333">${texto}</text></svg>`))
    [formato]()
    .toBuffer();
const escribir = async (ruta, datos) => {
  mkdirSync(join(CARPETA, ruta, '..'), { recursive: true });
  writeFileSync(join(CARPETA, ruta), await datos);
};
// Tomo 1: la portada se llama cover.jpg y la página 2 es una doble página escaneada de una pieza.
await escribir('第01巻/00001.jpg', imagen('1', 1));
await escribir('第01巻/00002.jpg', imagen('2-3', 2, 1200, 850));
await escribir('第01巻/00003.jpg', imagen('4', 3));
await escribir('第01巻/00004.jpg', imagen('5', 4));
await escribir('第01巻/cover.jpg', imagen('T', 0));
// Tomo 2: en PNG y con su ficha, que dice su título y que se lee de izquierda a derecha.
await escribir('第02巻/001.png', imagen('A', 1, 600, 850, 'png'));
await escribir('第02巻/002.png', imagen('B', 2, 600, 850, 'png'));
await escribir('第02巻/ComicInfo.xml', Buffer.from('<ComicInfo><Title>Tomo con ficha</Title><Manga>No</Manga></ComicInfo>'));
// Lo que no es imagen no entra.
await escribir('notas.txt', Buffer.from('notas de la serie'));
const SUELTAS = [join(CAPTURAS, 'Suelta_001.jpg'), join(CAPTURAS, 'Suelta_002.jpg')];
writeFileSync(SUELTAS[0], await imagen('S1', 1));
writeFileSync(SUELTAS[1], await imagen('S2', 2));

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
const esperar = async (pg, fn, arg, ms = 15000) => {
  const limite = Date.now() + ms;
  for (;;) {
    const v = await pg.evaluate(fn, arg).catch(() => null);
    if (v) return v;
    if (Date.now() > limite) return null;
    await pg.waitForTimeout(100);
  }
};
const estanteria = (pg) =>
  pg.evaluate(() => [...document.querySelectorAll('.ap-libro')].map((x) => ({ titulo: x.querySelector('h3')?.textContent, faja: x.querySelector('.ap-obi .num')?.textContent, portada: !!x.querySelector('.ap-tapa-imagen'), formato: x.querySelector('.ayuda')?.textContent })));

// ---------- Importar la carpeta ----------

console.log('\n== Importar una carpeta de imágenes ==');
const app = await contexto.newPage();
vigilar(app);
await app.goto(`chrome-extension://${id}/app.html#/biblioteca`);
await app.waitForSelector('input[type=file][aria-label="Importar una carpeta"]', { state: 'attached' });
comprobar(await app.locator('button.ap-elegir-carpeta').isVisible(), 'Hay un botón para elegir una carpeta de imágenes');
comprobar(await app.evaluate(() => document.querySelector('input[aria-label="Importar una carpeta"]')?.webkitdirectory === true), 'Su selector elige carpetas');
await app.setInputFiles('input[type=file][aria-label="Importar una carpeta"]', CARPETA);
const libros = await esperar(app, async () => {
  const l = [...document.querySelectorAll('.ap-libro')];
  return l.length === 2 && l.every((x) => x.querySelector('.ap-tapa-imagen')) && !document.querySelector('.ap-importando') ? true : null;
});
const estante = await estanteria(app);
comprobar(!!libros, 'Los dos tomos entran en la estantería, cada uno con su portada', JSON.stringify(estante));
const libro = (t) => estante.find((x) => x.titulo === t);
comprobar(libro('Serie de prueba 第01巻')?.faja === '5 páginas', 'El tomo 1 lleva la serie delante de su número y sus cinco páginas', JSON.stringify(libro('Serie de prueba 第01巻')));
comprobar(libro('Tomo con ficha')?.faja === '2 páginas', 'El tomo 2 lleva el título de su ComicInfo', JSON.stringify(libro('Tomo con ficha')));
comprobar(/^CBZ · /.test(libro('Serie de prueba 第01巻')?.formato ?? ''), 'Se guarda como un CBZ', libro('Serie de prueba 第01巻')?.formato);
comprobar(!estante.some((x) => /notas/.test(x.titulo ?? '')), 'El archivo de texto de la carpeta no se importa como lectura');
const guardados = await app.evaluate(async () => {
  const d = await (await navigator.storage.getDirectory()).getDirectoryHandle('documentos');
  const salida = [];
  for await (const h of d.values()) salida.push((await h.getFile()).size);
  return salida;
});
comprobar(guardados.length === 2 && guardados.every((t) => t > 1000), 'Cada tomo se guarda como un solo archivo', JSON.stringify(guardados));
await app.screenshot({ path: join(CAPTURAS, 'estanteria.png') });

// ---------- Imágenes sueltas ----------

console.log('\n== Imágenes sueltas ==');
await app.setInputFiles('input[type=file][aria-label="Importar archivos"]', SUELTAS);
const suelta = await esperar(app, () => [...document.querySelectorAll('.ap-libro')].find((x) => x.querySelector('h3')?.textContent === 'Suelta')?.querySelector('.ap-obi .num')?.textContent);
comprobar(suelta === '2 páginas', 'Las imágenes sueltas son un libro con el nombre que comparten', suelta);

// ---------- El visor ----------

const abrir = async (titulo) => {
  const nueva = contexto.waitForEvent('page', { timeout: 15000 });
  await app.locator(`button.ap-tapa[aria-label="Leer ${titulo}"]`).click();
  const v = await nueva;
  vigilar(v);
  await v.waitForSelector('.vs-pagina img', { timeout: 20000 }).catch(() => {});
  return v;
};
const indicador = (v) => v.evaluate(() => document.querySelector('.vs-numero')?.value ?? '');
const anchos = (v) => v.evaluate(() => [...document.querySelectorAll('.vs-pagina img')].map((i) => i.naturalWidth));

console.log('\n== El tomo en el visor ==');
let v = await abrir('Serie de prueba 第01巻');
comprobar((await v.evaluate(() => document.querySelector('.vs-lienzo')?.dataset.vista)) === 'doble', 'Un manga en japonés empieza a doble página');
comprobar((await indicador(v)) === '1' && (await anchos(v)).length === 1, 'La portada va primero y sola', `${await indicador(v)} ${JSON.stringify(await anchos(v))}`);
await v.keyboard.press('ArrowLeft');
await v.waitForTimeout(500);
// La página que va antes de una doble se queda sola, como en el tomo impreso, donde la doble ocupa las dos caras.
comprobar((await indicador(v)) === '2' && JSON.stringify(await anchos(v)) === '[600]', 'La página de antes de la doble va sola', `${await indicador(v)} ${JSON.stringify(await anchos(v))}`);
await v.keyboard.press('ArrowLeft');
await v.waitForTimeout(500);
comprobar((await indicador(v)) === '3' && JSON.stringify(await anchos(v)) === '[1200]', 'La doble página apaisada va sola', `${await indicador(v)} ${JSON.stringify(await anchos(v))}`);
await v.screenshot({ path: join(CAPTURAS, 'doble-apaisada.png') });
await v.keyboard.press('ArrowLeft');
await v.waitForTimeout(500);
comprobar((await indicador(v)) === '4–5', 'Y las demás siguen de dos en dos', await indicador(v));
const orden = await v.evaluate(() => {
  const x = (n) => document.querySelector(`.vs-pagina[data-pagina="${n}"]`)?.getBoundingClientRect().left ?? 0;
  return x(4) > x(5);
});
comprobar(orden, 'De derecha a izquierda, como un tomo japonés');
await v.waitForTimeout(900);
await v.close();

console.log('\n== El tomo con ficha ==');
v = await abrir('Tomo con ficha');
comprobar((await v.evaluate(() => document.querySelector('.vs-lienzo')?.dataset.vista)) === 'una', 'Se lee de una en una y de izquierda a derecha, como dice su ComicInfo');
comprobar(!!(await v.$('[aria-label="Se lee de izquierda a derecha"]')), 'Con el sentido de su ficha');
await v.close();

if (errores.length) console.log('\nErrores en la página:', [...new Set(errores)].slice(0, 6));
comprobar(errores.length === 0, 'Sin errores en las páginas');
console.log(`\n${fallos ? `${fallos} comprobaciones fallaron` : 'Todas las comprobaciones pasaron'}`);
await contexto.close();
process.exit(fallos ? 1 : 0);
