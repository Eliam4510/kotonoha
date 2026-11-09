// Prueba la copia completa de Ajustes de ida y vuelta, sin diálogos: el selector de carpetas se sustituye por carpetas
// del almacenamiento privado de la extensión. Primero restaura una copia hecha a mano (palabras, un libro con su
// archivo, el texto de su OCR y un dictado) y después exporta: lo exportado tiene que traer lo mismo, y sin claves.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/copia-completa.mjs

import { mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-copia'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'copia-completa');
rmSync(PERFIL, { recursive: true, force: true });
mkdirSync(CAPTURAS, { recursive: true });

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};

const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1280, height: 900 },
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
await sw.evaluate(async () => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), idiomaInterfaz: 'es', bienvenidaVista: true, idiomaObjetivo: 'ja', azureClave: 'CLAVE-AZURE-DE-PRUEBA' } });
});

const p = await contexto.newPage();
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));
await p.goto(`chrome-extension://${id}/app.html#/ajustes`);
await p.waitForTimeout(1500);

// Una copia hecha a mano en el almacenamiento privado, con lo mínimo de cada cosa.
const LIBRO = 'libro-de-prueba';
const BYTES = 300_000;
await p.evaluate(
  async ({ LIBRO, BYTES }) => {
    const raiz = await navigator.storage.getDirectory();
    const copias = await raiz.getDirectoryHandle('prueba-copias', { create: true });
    const c = await copias.getDirectoryHandle('hecha-a-mano', { create: true });
    const escribir = async (dir, nombre, datos) => {
      const w = await (await dir.getFileHandle(nombre, { create: true })).createWritable();
      await w.write(datos);
      await w.close();
    };
    const ahora = Date.now();
    await escribir(
      c,
      'kotonoha.json',
      JSON.stringify({
        version: 2,
        ajustes: { idiomaObjetivo: 'ja' },
        lenguas: {
          ja: {
            palabras: [{ clave: '猫|ねこ', lema: '猫', lectura: 'ねこ', estado: 'aprendiendo', rastreada: 1, creada: ahora, actualizada: ahora }],
            biblioteca: [{ id: LIBRO, titulo: 'Libro de prueba', texto: '', origen: 'archivo', creado: ahora }],
          },
        },
      })
    );
    const bytes = new Uint8Array(BYTES);
    for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 31) % 251;
    await escribir(await c.getDirectoryHandle('documentos', { create: true }), LIBRO, bytes);
    await escribir(
      await c.getDirectoryHandle('ocr', { create: true }),
      `${LIBRO}.json`,
      JSON.stringify({ paginas: [{ clave: `${LIBRO}:libro:1`, libro: LIBRO, lineas: [{ texto: '吾輩は猫である', caja: [0, 0, 10, 10] }], creada: ahora, lectura: 1 }], ediciones: [] })
    );
    const dictados = await c.getDirectoryHandle('dictados', { create: true });
    await escribir(dictados, 'dictado-1.webm', new Uint8Array([26, 69, 223, 163, 1, 2, 3, 4]));
    await escribir(dictados, 'dictado-1.json', JSON.stringify({ id: 'dictado-1', duracionMs: 1200, creado: ahora, lengua: 'ja', archivo: 'dictado-1.webm', tipo: 'audio/webm;codecs=opus' }));
  },
  { LIBRO, BYTES }
);

const elegir = (ruta) =>
  p.evaluate((ruta) => {
    window.showDirectoryPicker = async () => {
      let d = await navigator.storage.getDirectory();
      for (const parte of ruta) d = await d.getDirectoryHandle(parte, { create: true });
      return d;
    };
  }, ruta);

const seccion = p.locator('#datos');
await seccion.scrollIntoViewIfNeeded();
const mensaje = () => seccion.locator('.mensaje, [role="status"]').allInnerTexts().then((t) => t.join(' | '));

// ---------- Restaurar ----------
await elegir(['prueba-copias', 'hecha-a-mano']);
await seccion.getByRole('button', { name: 'Restaurar de una carpeta' }).click();
await p.waitForFunction(() => document.querySelector('#datos')?.textContent?.includes('Copia completa restaurada'), null, { timeout: 30000 }).catch(() => {});
const textoRestaurada = await seccion.innerText();
comprobar(textoRestaurada.includes('Copia completa restaurada: libros: 1; libros con texto del OCR: 1; dictados: 1.'), 'Restaura y dice qué', (await mensaje()).slice(0, 120));
await p.screenshot({ path: join(CAPTURAS, 'restaurada.png') });

const enBases = await p.evaluate(async (LIBRO) => {
  const abrir = (nombre) => new Promise((ok, mal) => {
    const r = indexedDB.open(nombre);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
  const todo = (db, tabla) => new Promise((ok) => {
    const r = db.transaction(tabla).objectStore(tabla).getAll();
    r.onsuccess = () => ok(r.result);
  });
  const ocr = await abrir('kotonoha-ocr');
  const dictados = await abrir('kotonoha-dictados');
  const grabaciones = await todo(dictados, 'grabaciones');
  const archivo = await (await (await (await navigator.storage.getDirectory()).getDirectoryHandle('documentos')).getFileHandle(LIBRO)).getFile();
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  let bien = bytes.length === 300_000;
  for (let i = 0; bien && i < bytes.length; i++) bien = bytes[i] === (i * 31) % 251;
  return {
    paginas: (await todo(ocr, 'paginas')).length,
    grabacion: grabaciones[0] ? { id: grabaciones[0].id, tipo: grabaciones[0].audio.type, tam: grabaciones[0].audio.size } : null,
    libroBien: bien,
  };
}, LIBRO);
comprobar(enBases.libroBien, 'El archivo del libro queda en el almacenamiento, byte a byte');
comprobar(enBases.paginas === 1, 'El texto del OCR queda en su base', enBases.paginas);
comprobar(enBases.grabacion?.id === 'dictado-1' && enBases.grabacion.tipo === 'audio/webm;codecs=opus' && enBases.grabacion.tam === 8, 'El dictado queda con su audio', JSON.stringify(enBases.grabacion));
comprobar((await sw.evaluate(() => chrome.storage.local.get('ajustes').then((d) => d.ajustes.azureClave))) === 'CLAVE-AZURE-DE-PRUEBA', 'Restaurar no borra la clave que ya había');

// ---------- Exportar ----------
await elegir(['prueba-copias', 'exportadas']);
await seccion.getByRole('button', { name: 'Exportar a una carpeta' }).click();
await p.waitForFunction(() => document.querySelector('#datos')?.textContent?.includes('Copia completa guardada'), null, { timeout: 30000 }).catch(() => {});
const textoGuardada = await seccion.innerText();
comprobar(/Copia completa guardada en la carpeta «kotonoha-copia-\d{4}-\d{2}-\d{2}»: libros: 1; libros con texto del OCR: 1; dictados: 1\./.test(textoGuardada), 'Exporta a una carpeta con la fecha', (await mensaje()).slice(0, 140));

const exportado = await p.evaluate(async (LIBRO) => {
  const raiz = await (await (await navigator.storage.getDirectory()).getDirectoryHandle('prueba-copias')).getDirectoryHandle('exportadas');
  const nombres = [];
  for await (const [n] of raiz) nombres.push(n);
  const c = await raiz.getDirectoryHandle(nombres[0]);
  const leer = async (dir, n) => (await (await dir.getFileHandle(n)).getFile());
  const datos = JSON.parse(await (await leer(c, 'kotonoha.json')).text());
  const libro = await leer(await c.getDirectoryHandle('documentos'), LIBRO);
  const ocr = JSON.parse(await (await leer(await c.getDirectoryHandle('ocr'), `${LIBRO}.json`)).text());
  const dictados = [];
  for await (const [n] of await c.getDirectoryHandle('dictados')) dictados.push(n);
  return {
    carpetas: nombres,
    palabras: datos.lenguas?.ja?.palabras?.length ?? 0,
    biblioteca: datos.lenguas?.ja?.biblioteca?.length ?? 0,
    clave: 'azureClave' in (datos.ajustes ?? {}),
    texto: JSON.stringify(datos).includes('CLAVE-AZURE'),
    libro: libro.size,
    paginas: ocr.paginas.length,
    dictados: dictados.sort(),
    leeme: !!(await leer(c, 'LEEME.txt').catch(() => null)),
  };
}, LIBRO);
comprobar(exportado.carpetas.length === 1, 'Una carpeta por copia', exportado.carpetas.join(', '));
comprobar(exportado.palabras === 1 && exportado.biblioteca === 1, 'Lleva las palabras y la biblioteca', `${exportado.palabras} y ${exportado.biblioteca}`);
comprobar(!exportado.clave && !exportado.texto, 'Las claves de API no van en la copia');
comprobar(exportado.libro === BYTES, 'Lleva el archivo del libro', exportado.libro);
comprobar(exportado.paginas === 1, 'Lleva el texto del OCR', exportado.paginas);
comprobar(exportado.dictados.join(',') === 'dictado-1.json,dictado-1.webm', 'Lleva el dictado con su audio', exportado.dictados.join(', '));
comprobar(exportado.leeme, 'Y un LEEME que dice qué es cada cosa');
await p.screenshot({ path: join(CAPTURAS, 'exportada.png') });

// La copia de un solo archivo tampoco lleva la clave.
const json = await p.evaluate(async () => {
  const enlace = new Promise((ok) => {
    const original = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      HTMLAnchorElement.prototype.click = original;
      fetch(this.href).then((r) => r.text()).then(ok);
    };
  });
  [...document.querySelectorAll('#datos button')].find((b) => b.textContent.includes('Exportar') && !b.textContent.includes('carpeta'))?.click();
  return enlace;
});
comprobar(json.includes('"palabras"') && !json.includes('CLAVE-AZURE'), 'La copia de seguridad en JSON tampoco lleva la clave');

comprobar(errores.length === 0, 'Sin errores en la página', errores.join(' | ').slice(0, 200));
await contexto.close();
rmSync(PERFIL, { recursive: true, force: true });
console.log(`\n${fallos ? `${fallos} comprobaciones fallaron` : 'Todas las comprobaciones pasaron'}`);
process.exit(fallos ? 1 : 0);
