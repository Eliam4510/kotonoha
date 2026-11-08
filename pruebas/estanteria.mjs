// Prueba la estantería de la Ayuda de lectura con libros hechos aquí mismo: una carpeta con una serie de tres tomos, que
// entra como una colección; un PDF, que trae su portada desde que se importa; y después un cuarto tomo, que va solo a su
// colección. Colecciones (crear, editar, añadir, mover, portada, quitar), el progreso de lectura (porcentaje, «Seguir
// leyendo», «Terminado» al llegar al final y a mano, «Volver a empezar»), los filtros y «Usar esta página como portada».
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/estanteria.mjs

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-estanteria'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'estanteria');
const SERIE = 'Serie de prueba';
rmSync(PERFIL, { recursive: true, force: true });
rmSync(CAPTURAS, { recursive: true, force: true });
mkdirSync(CAPTURAS, { recursive: true });
const sharp = createRequire(join(RAIZ, 'package.json'))('sharp');

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};

// ---------- Los libros de prueba ----------

const COLORES = ['#e8d5c4', '#c4dce8', '#d9e8c4', '#e8c4dc', '#e8e2c4', '#c4e8e0'];
const imagen = (texto, n) =>
  sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="850"><rect width="100%" height="100%" fill="${COLORES[n % COLORES.length]}"/><text x="50%" y="55%" font-size="150" font-family="sans-serif" text-anchor="middle" fill="#333">${texto}</text></svg>`))
    .jpeg()
    .toBuffer();
/** Un tomo de seis páginas en la carpeta `raiz/SERIE/第0n巻`. */
async function tomo(raiz, n) {
  for (let p = 1; p <= 6; p++) {
    const ruta = join(raiz, SERIE, `第0${n}巻`, `${String(p).padStart(3, '0')}.jpg`);
    mkdirSync(join(ruta, '..'), { recursive: true });
    writeFileSync(ruta, await imagen(`${n}-${p}`, n + p));
  }
}
const PRIMERA = join(CAPTURAS, 'primera');
const SEGUNDA = join(CAPTURAS, 'segunda');
for (const n of [1, 2, 3]) await tomo(PRIMERA, n);
await tomo(SEGUNDA, 4);

/** Un PDF escrito a mano: cada página, un rectángulo de color y su número en Helvetica. */
function pdfDePrueba(total) {
  const objetos = ['<< /Type /Catalog /Pages 2 0 R >>', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const hijos = [];
  for (let n = 1; n <= total; n++) {
    const contenido = `0.2 0.45 0.85 rg 72 560 468 160 re f 0 0 0 rg BT /F1 64 Tf 200 380 Td (Tema ${n}) Tj ET`;
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
  viewport: { width: 1280, height: 860 },
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
const esperar = async (pg, fn, arg, ms = 15000) => {
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
const URL_ESTANTERIA = `chrome-extension://${id}/app.html#/biblioteca`;
await app.goto(URL_ESTANTERIA);
await app.waitForSelector('input[type=file][aria-label="Importar una carpeta"]', { state: 'attached' });

/** Las tarjetas a la vista: libros y colecciones, con lo que dicen. */
const tarjetas = () =>
  app.evaluate(() =>
    [...document.querySelectorAll('.ap-libro')].map((x) => ({
      titulo: x.querySelector('h3')?.textContent ?? '',
      coleccion: x.classList.contains('ap-coleccion'),
      faja: x.querySelector('.ap-obi .num')?.textContent ?? '',
      linea: x.querySelector('h3 + .ayuda')?.textContent?.trim() ?? '',
      portada: x.querySelector('.ap-tapa-imagen')?.getAttribute('src') ?? '',
    }))
  );
const tarjeta = async (titulo) => (await tarjetas()).find((t) => t.titulo === titulo);
const boton = (texto) => app.locator('button', { hasText: texto }).first();
const enDialogo = (texto) => app.locator('.ap-dialogo button', { hasText: texto }).first();
const abrirColeccion = async (nombre) => {
  await app.locator(`button.ap-tapa[aria-label="Abrir la colección ${nombre}"]`).click();
  await app.waitForSelector('.ap-vista-coleccion h1', { timeout: 10000 });
};
const volver = async () => {
  await app.locator('.ap-volver').click();
  await app.waitForSelector('.ap-estanteria-cab', { timeout: 10000 });
};
const menu = async (titulo, opcion) => {
  await app.locator(`[aria-label="Opciones de ${titulo}"]`).click({ force: true });
  await app.locator('.ap-menu-libro button', { hasText: opcion }).click();
  await app.waitForTimeout(400);
};
const abrirEnVisor = async (titulo) => {
  const nueva = contexto.waitForEvent('page', { timeout: 15000 });
  await app.locator(`button.ap-tapa[aria-label="Leer ${titulo}"]`).click();
  const v = await nueva;
  vigilar(v);
  await v.waitForSelector('.vs-pagina img', { timeout: 20000 }).catch(() => {});
  return v;
};
/** Cierra el visor después de que haya guardado por dónde se va, y vuelve a mirar la estantería. */
const cerrarVisor = async (v) => {
  await v.waitForTimeout(1200);
  await v.close();
  await app.reload();
  await app.waitForSelector('.ap-libro, .ap-vacio', { timeout: 10000 });
};

// ---------- Una serie en carpetas: una colección ----------

console.log('\n== Importar una serie en carpetas ==');
await app.setInputFiles('input[type=file][aria-label="Importar una carpeta"]', join(PRIMERA, SERIE));
const serie = await esperar(app, () => {
  const c = [...document.querySelectorAll('.ap-coleccion')].find((x) => x.querySelector('h3')?.textContent === 'Serie de prueba');
  return c && !document.querySelector('.ap-importando') ? { faja: c.querySelector('.ap-obi .num')?.textContent, linea: c.querySelector('h3 + .ayuda')?.textContent, portada: !!c.querySelector('.ap-tapa-imagen') } : null;
});
comprobar(serie?.faja === '3 tomos' && serie.portada, 'Los tres tomos entran en una colección de manga, con el nombre de la carpeta y la portada del primero', JSON.stringify(serie));
comprobar(serie?.linea === 'Sin empezar', 'Sin empezar', serie?.linea);
const aviso = await app.evaluate(() => document.querySelector('.ap-mensaje:not(.error)')?.textContent ?? '');
comprobar(aviso.includes('Nueva colección «Serie de prueba», con 3 tomos.'), 'Y lo dice al importar', aviso);
comprobar(!(await tarjetas()).some((t) => !t.coleccion && t.titulo.startsWith(SERIE)), 'Los tomos no se repiten sueltos en la estantería');

console.log('\n== Un PDF trae su portada desde que se importa ==');
await app.setInputFiles('input[type=file][aria-label="Importar archivos"]', [{ name: 'apuntes de química.pdf', mimeType: 'application/pdf', buffer: pdfDePrueba(3) }]);
const pdf = await esperar(app, () => {
  const l = [...document.querySelectorAll('.ap-libro')].find((x) => x.querySelector('h3')?.textContent === 'apuntes de química');
  return l ? { faja: l.querySelector('.ap-obi .num')?.textContent, portada: !!l.querySelector('.ap-tapa-imagen') } : null;
});
comprobar(pdf?.faja === '3 páginas' && pdf.portada, 'Con su portada y sus páginas, sin abrirlo', JSON.stringify(pdf));
await app.screenshot({ path: join(CAPTURAS, 'estanteria.png') });

// ---------- La colección por dentro ----------

console.log('\n== La colección ==');
await abrirColeccion(SERIE);
const cabecera = await app.evaluate(() => ({
  tipo: document.querySelector('.ap-coleccion-tipo')?.textContent,
  nombre: document.querySelector('.ap-vista-coleccion h1')?.textContent,
  seguir: document.querySelector('.ap-coleccion-seguir')?.textContent?.trim(),
  libros: [...document.querySelectorAll('.ap-vista-coleccion .ap-libro h3')].map((h) => h.textContent),
}));
comprobar(cabecera.tipo === 'Manga · 3 tomos' && cabecera.nombre === SERIE, 'Su cabecera: tipo, cuántos tomos y nombre', JSON.stringify(cabecera));
comprobar(JSON.stringify(cabecera.libros) === JSON.stringify(['Serie de prueba 第01巻', 'Serie de prueba 第02巻', 'Serie de prueba 第03巻']), 'Los tomos, en orden', JSON.stringify(cabecera.libros));
comprobar(cabecera.seguir === 'Empezar «Serie de prueba 第01巻»', 'Ofrece empezar por el primero', cabecera.seguir);
comprobar(app.url().includes('coleccion='), 'Tiene su propia dirección, para volver atrás', app.url());

await boton('Editar').click();
await app.fill('.ap-dialogo textarea', 'Tres tomos de prueba.');
await enDialogo('Guardar').click();
const descripcion = await esperar(app, () => document.querySelector('.ap-coleccion-descripcion')?.textContent);
comprobar(descripcion === 'Tres tomos de prueba.', 'Editar: la descripción', descripcion);

// ---------- Leer: progreso, terminado y seguir leyendo ----------

console.log('\n== El progreso de lectura ==');
let v = await abrirEnVisor('Serie de prueba 第01巻');
await v.keyboard.press('End');
await cerrarVisor(v);
await app.waitForSelector('.ap-vista-coleccion h1', { timeout: 10000 });
const primero = await tarjeta('Serie de prueba 第01巻');
comprobar(primero?.faja === 'Terminado' && primero.linea === 'Terminado', 'Al llegar a la última página, el tomo queda terminado', JSON.stringify(primero));

v = await abrirEnVisor('Serie de prueba 第02巻');
await v.keyboard.press('ArrowLeft');
await v.waitForTimeout(300);
await v.keyboard.press('ArrowLeft');
await cerrarVisor(v);
const segundo = await tarjeta('Serie de prueba 第02巻');
comprobar(segundo?.faja === 'Pág. 4 de 6' && segundo.linea === '66 % leído', 'A medias: por dónde va y cuánto lleva', JSON.stringify(segundo));
const avance = await app.evaluate(() => ({ texto: document.querySelector('.ap-coleccion-avance .ayuda')?.textContent, seguir: document.querySelector('.ap-coleccion-seguir')?.textContent?.trim() }));
comprobar(avance.texto === 'Tomo 2 de 3 · 1 de 3 terminados', 'La colección dice por qué tomo se va', JSON.stringify(avance));
comprobar(avance.seguir === 'Seguir con «Serie de prueba 第02巻»', 'Y ofrece seguir con él', avance.seguir);
await app.screenshot({ path: join(CAPTURAS, 'coleccion.png') });

// ---------- Usar una página como portada ----------

console.log('\n== Usar esta página como portada ==');
const antes = (await tarjeta('Serie de prueba 第03巻'))?.portada;
v = await abrirEnVisor('Serie de prueba 第03巻');
await v.keyboard.press('ArrowLeft');
await v.waitForTimeout(400);
await v.locator('[aria-label="Usar esta página como portada"]').click();
const hecha = await v.waitForSelector('[aria-label="Es la portada en la estantería"]', { timeout: 10000 }).then(() => true).catch(() => false);
comprobar(hecha, 'El botón dice que ya es la portada');
await cerrarVisor(v);
const despues = (await tarjeta('Serie de prueba 第03巻'))?.portada;
comprobar(!!despues && despues !== antes, 'La tarjeta del tomo lleva la portada nueva');

// ---------- La portada de la colección ----------

console.log('\n== La portada de la colección ==');
await boton('Portada').click();
await app.locator('.ap-portada-opcion[aria-label="La de Serie de prueba 第03巻"]').click();
const deLaColeccion = await esperar(app, (p) => (document.querySelector('.ap-coleccion-tapa .ap-tapa-imagen')?.getAttribute('src') === p ? true : null), despues);
comprobar(!!deLaColeccion, 'La colección lleva la portada elegida de uno de sus tomos');

// ---------- Terminado a mano y volver a empezar ----------

console.log('\n== Terminado a mano ==');
await menu('Serie de prueba 第02巻', 'Marcar como terminado');
comprobar((await tarjeta('Serie de prueba 第02巻'))?.linea === 'Terminado', 'Marcar como terminado');
await menu('Serie de prueba 第01巻', 'Volver a empezar');
const deNuevo = await tarjeta('Serie de prueba 第01巻');
comprobar(deNuevo?.faja === '6 páginas' && /^CBZ · /.test(deNuevo.linea), 'Volver a empezar lo deja como sin leer', JSON.stringify(deNuevo));

// ---------- Seguir leyendo y los filtros ----------

console.log('\n== Seguir leyendo y filtros ==');
await volver();
v = await abrirEnVisor('apuntes de química');
await v.keyboard.press('ArrowRight');
await cerrarVisor(v);
const enCurso = await app.evaluate(() => [...document.querySelectorAll('.ap-en-curso-libro b')].map((b) => b.textContent));
// El tomo 3 se quedó en la página 2 al elegir su portada; el 1 volvió a empezar y el 2 está terminado.
comprobar(JSON.stringify(enCurso.sort()) === JSON.stringify(['Serie de prueba 第03巻', 'apuntes de química']), '«Seguir leyendo» muestra lo que se lee a medias', JSON.stringify(enCurso));
comprobar((await tarjeta(SERIE))?.linea === 'Tomo 3 de 3', 'La colección dice por qué tomo se va', (await tarjeta(SERIE))?.linea);
const filtro = async (nombre) => {
  await app.locator('.ap-estanteria-cab .segmentado button', { hasText: nombre }).click();
  await app.waitForTimeout(300);
  return (await tarjetas()).map((t) => t.titulo).sort();
};
comprobar(JSON.stringify(await filtro('Terminados')) === JSON.stringify(['Serie de prueba 第02巻']), 'Terminados: los terminados, también dentro de las colecciones');
comprobar(JSON.stringify(await filtro('Leyendo')) === JSON.stringify(['Serie de prueba 第03巻', 'apuntes de química']), 'Leyendo: lo que va a medias');
comprobar(JSON.stringify(await filtro('Sin empezar')) === JSON.stringify(['Serie de prueba 第01巻']), 'Sin empezar');
await filtro('Todo');
await app.screenshot({ path: join(CAPTURAS, 'seguir-leyendo.png') });

// ---------- Una colección nueva, a mano ----------

console.log('\n== Crear una colección y añadirle libros ==');
await boton('Nueva colección').click();
await app.fill('.ap-dialogo input.campo', 'Química');
await app.locator('.ap-dialogo .segmentado button', { hasText: 'Estudio' }).click();
await enDialogo('Crear').click();
await app.waitForSelector('.ap-vista-coleccion h1', { timeout: 10000 });
comprobar((await app.textContent('.ap-vista-coleccion h1')) === 'Química' && (await app.textContent('.ap-coleccion-tipo')) === 'Estudio · 0 libros', 'Se crea y se abre, vacía', await app.textContent('.ap-coleccion-tipo'));
await boton('Añadir libros').click();
await app.locator('.ap-dialogo label', { hasText: 'apuntes de química' }).click();
await enDialogo('Añadir 1').click();
await esperar(app, () => (document.querySelector('.ap-vista-coleccion .ap-libro h3')?.textContent === 'apuntes de química' ? true : null));
comprobar((await tarjeta('apuntes de química')) !== undefined, 'Añadir libros de la estantería');
await app.screenshot({ path: join(CAPTURAS, 'quimica.png') });

console.log('\n== Mover un libro ==');
await menu('apuntes de química', 'Cambiar de colección');
await app.locator('.ap-dialogo-opcion', { hasText: SERIE }).click();
await app.waitForTimeout(500);
comprobar((await tarjetas()).length === 0, 'Cambiar de colección lo saca de esta');
await volver();
await abrirColeccion(SERIE);
comprobar((await tarjeta('apuntes de química')) !== undefined, 'Y lo lleva a la otra');
await menu('apuntes de química', 'Sacar de');
comprobar((await tarjeta('apuntes de química')) === undefined, 'Sacarlo de la colección');
await volver();
comprobar((await tarjeta('apuntes de química')) !== undefined, 'Vuelve a la estantería, suelto');

console.log('\n== Quitar una colección ==');
await abrirColeccion('Química');
await boton('Quitar la colección').click();
await app.waitForSelector('.ap-estanteria-cab', { timeout: 10000 });
comprobar((await tarjeta('Química')) === undefined, 'La colección se quita');
comprobar((await tarjeta('apuntes de química')) !== undefined, 'Y lo que tenía sigue en la estantería');

// ---------- Un tomo más, de la misma serie ----------

console.log('\n== Un tomo nuevo va a su colección ==');
await app.setInputFiles('input[type=file][aria-label="Importar una carpeta"]', join(SEGUNDA, SERIE));
const cuarto = await esperar(app, () => {
  const c = [...document.querySelectorAll('.ap-coleccion')].find((x) => x.querySelector('h3')?.textContent === 'Serie de prueba');
  return c?.querySelector('.ap-obi .num')?.textContent === '4 tomos' && !document.querySelector('.ap-importando') ? true : null;
});
const aviso2 = await app.evaluate(() => document.querySelector('.ap-mensaje:not(.error)')?.textContent ?? '');
comprobar(!!cuarto && aviso2.includes('Añadido a «Serie de prueba»: 1 tomo.'), 'Una carpeta con un tomo más de la serie lo añade a su colección', aviso2);

// ---------- Todo sigue ahí ----------

await app.goto(URL_ESTANTERIA);
await app.reload();
await app.waitForSelector('.ap-estanteria-cab', { timeout: 10000 });
await abrirColeccion(SERIE);
const guardada = await app.evaluate(() => ({ descripcion: document.querySelector('.ap-coleccion-descripcion')?.textContent, portada: !!document.querySelector('.ap-coleccion-tapa .ap-tapa-imagen') }));
comprobar(guardada.descripcion === 'Tres tomos de prueba.' && guardada.portada, 'Al volver, la colección sigue con su descripción y su portada', JSON.stringify(guardada));
await app.screenshot({ path: join(CAPTURAS, 'final.png') });

if (errores.length) console.log('\nErrores en la página:', [...new Set(errores)].slice(0, 6));
comprobar(errores.length === 0, 'Sin errores en las páginas');
console.log(`\n${fallos ? `${fallos} comprobaciones fallaron` : 'Todas las comprobaciones pasaron'}`);
await contexto.close();
process.exit(fallos ? 1 : 0);
