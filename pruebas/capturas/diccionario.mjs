// Las imágenes del diccionario del README en cada idioma de la interfaz que estudia japonés (en el README japonés se
// estudia inglés, que no tiene sinónimos ni categorías de JMdict): la página de はなす, con la lista de resultados, 話す
// con sus sentidos, las frases donde se vio con su minuto y, al lado, su kanji, las que significan lo mismo y las que se
// leen igual; la página del kanji 愛, con el diccionario de kanji instalado, y la práctica de escritura de 語, a medio
// escribir y con la pista del trazo que toca. Como en pruebas/capturas/readme.mjs, con los diccionarios que tendría quien
// lee cada README: el suyo y, de respaldo, el inglés. Las frases de ejemplo se añaden para la imagen y se borran al acabar.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/capturas/diccionario.mjs [es de en zh ko]

import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { recargarExtension } from '../extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..', '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-readme'));
const IMAGENES = join(RAIZ, 'docs', 'img');
// En este orden, los tres últimos comparten diccionarios y no hay que cambiarlos.
const IDIOMAS = process.argv.slice(2).length ? process.argv.slice(2) : ['es', 'de', 'en', 'zh', 'ko'];
const BUSQUEDA = 'はなす';
const KANJI = '愛';
/** El kanji de la imagen de la práctica, y cuántos trazos lleva ya escritos: los de 言, su radical. */
const PRACTICA = '語';
const TRAZOS_HECHOS = 7;
/** Las frases de ejemplo llevan esta fuente: con ella se borran al acabar. */
const FUENTE = '日本語の会話';

if (!existsSync(PERFIL) && existsSync(join(RAIZ, '.perfil-base', 'Default/IndexedDB'))) {
  cpSync(join(RAIZ, '.perfil-base', 'Default/IndexedDB'), join(PERFIL, 'Default/IndexedDB'), { recursive: true });
}
mkdirSync(IMAGENES, { recursive: true });
const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1600, height: 1000 },
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
const previo = await sw.evaluate(async () => chrome.storage.local.get(['ajustes']));
const fijar = (idioma) =>
  sw.evaluate(async (idioma) => {
    const d = await chrome.storage.local.get('ajustes');
    await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), idiomaInterfaz: idioma, idiomaObjetivo: 'ja', bienvenidaVista: true, tema: 'oscuro', avisarVersiones: false, guardarHistorial: true, diccionarioAncho: 'completo', diccionarioTamano: 100, diccionarioLetra: 'gotica' } });
  }, idioma);

const p = await contexto.newPage();
await p.goto(`chrome-extension://${id}/app.html#/inicio`);
// Al abrir la página, el motor puede tardar un poco en responder: se reintenta unos segundos, como en readme.mjs.
const motor = async (metodo, ...args) => {
  for (let intento = 0; ; intento++) {
    const r = await p.evaluate(({ metodo, args }) => chrome.runtime.sendMessage({ canal: 'motor', metodo, args }), { metodo, args }).catch(() => null);
    if (r?.ok) return r.valor;
    if (intento > 40 || r?.error) throw new Error(`${metodo}: ${r?.error ?? 'sin respuesta'}`);
    await p.waitForTimeout(250);
  }
};

/** Deja instalados justo estos diccionarios de términos de japonés, en este orden. */
async function diccionarios(terminos) {
  await motor('fijarLengua', 'ja');
  const instalados = () => motor('estado').then((e) => e.diccionarios);
  for (const d of await instalados()) if (d.tipo === 'terminos' && !terminos.includes(d.id)) await motor('eliminarDiccionario', d.id);
  const ya = new Set((await instalados()).map((d) => d.id));
  for (const t of terminos) {
    if (ya.has(t)) continue;
    const t0 = Date.now();
    await motor('instalarDiccionario', t);
    console.log(`  instalado ${t} en ${Math.round((Date.now() - t0) / 1000)} s`);
  }
  // El de kanji va con todos: es de los recomendados.
  if (!ya.has('kanji')) {
    await motor('instalarDiccionario', 'kanji');
    console.log('  instalado kanji');
  }
  const resto = (await instalados()).filter((d) => !terminos.includes(d.id)).map((d) => d.id);
  await motor('ordenarDiccionarios', [...terminos, ...resto]).catch(() => {});
}

/** Borra las frases de ejemplo de la base del japonés. */
const borrarFrases = () =>
  p.evaluate(
    (fuente) =>
      new Promise((ok) => {
        const r = indexedDB.open('kikitori');
        r.onsuccess = () => {
          const t = r.result.transaction('frases', 'readwrite');
          t.objectStore('frases').openCursor().onsuccess = (e) => {
            const c = e.target.result;
            if (!c) return;
            if (c.value.fuente === fuente) c.delete();
            c.continue();
          };
          t.oncomplete = () => {
            r.result.close();
            ok(true);
          };
        };
        r.onerror = () => ok(false);
      }),
    FUENTE
  );

const guardar = async (nombre, idioma, recorte) => {
  await p.mouse.move(5, 5);
  await p.waitForTimeout(1200);
  const archivo = join(IMAGENES, idioma === 'es' ? `${nombre}.png` : `${nombre}.${idioma}.png`);
  await sharp(await (recorte ?? p).screenshot()).png({ palette: true, quality: 92, effort: 10 }).toFile(archivo);
  console.log('imagen:', archivo.slice(RAIZ.length + 1));
};

/** Escribe con el ratón, en el lienzo de la práctica, los primeros trazos de un kanji tal como son. */
async function escribirTrazos(kanji, cuantos) {
  const lienzo = p.locator('.escritura-lienzo');
  const trazos = await p.evaluate(async (k) => {
    const r = await chrome.runtime.sendMessage({ canal: 'motor', metodo: 'trazos', args: [k] });
    return r.valor.trazos.map((d) => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      const largo = path.getTotalLength();
      return Array.from({ length: 12 }, (_, i) => {
        const pt = path.getPointAtLength((largo * i) / 11);
        return { x: pt.x, y: pt.y };
      });
    });
  }, kanji);
  for (const puntos of trazos.slice(0, cuantos)) {
    const c = await lienzo.boundingBox();
    const ps = puntos.map((q) => ({ x: c.x + (q.x / 109) * c.width, y: c.y + (q.y / 109) * c.height }));
    await p.mouse.move(ps[0].x, ps[0].y);
    await p.mouse.down();
    for (const q of ps.slice(1)) await p.mouse.move(q.x, q.y, { steps: 2 });
    await p.mouse.up();
    await p.waitForTimeout(120);
  }
}

for (const idioma of IDIOMAS) {
  // Primero los ajustes: el catálogo de diccionarios es el de la lengua que se estudia.
  await fijar(idioma);
  await p.waitForTimeout(500);
  await diccionarios(idioma === 'es' ? ['jmdict-es', 'jmdict-en'] : idioma === 'de' ? ['jmdict-de', 'jmdict-en'] : ['jmdict-en']);
  await borrarFrases();
  await motor('analizarLineas', [{ id: 'a', inicio: 754_000, fin: 757_000, texto: '友達と話すのが好きです。' }, { id: 'b', inicio: 1_261_000, fin: 1_264_000, texto: '先生とゆっくり話してみました。' }], { titulo: FUENTE, url: 'https://www.youtube.com/watch?v=kotonohaReadme', idVideo: 'kotonohaReadme' });

  await p.goto(`chrome-extension://${id}/app.html#/diccionario?q=${encodeURIComponent(BUSQUEDA)}`);
  await p.reload();
  await p.locator('.dic-ficha .ficha-palabra').waitFor({ timeout: 30000 });
  // El índice de los sinónimos se hace la primera vez con cada juego de diccionarios: unos segundos.
  await p.locator('.dic-seccion', { hasText: /./ }).locator('.dic-tarjeta').first().waitFor({ timeout: 90000 });
  await p.locator('.dic-lateral .dic-tarjeta-esqueleto').first().waitFor({ state: 'detached', timeout: 90000 }).catch(() => {});
  await p.locator('.dic-frase rt').first().waitFor({ timeout: 15000 }).catch(() => {});
  await guardar('diccionario', idioma);

  // Con menos movimiento, los trazos salen ya dibujados, con sus números: el kanji entero en la imagen.
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto(`chrome-extension://${id}/app.html#/diccionario?q=${encodeURIComponent(KANJI)}`);
  await p.reload();
  await p.locator('.dic-caracter').waitFor({ timeout: 30000 });
  await p.locator('.dic-pieza').first().waitFor({ timeout: 30000 }).catch(() => {});
  await p.locator('.dic-caracter .dic-tarjeta').first().waitFor({ timeout: 90000 });
  await p.locator('.dic-kanji').first().waitFor({ timeout: 30000 }).catch(() => {});
  await guardar('kanji', idioma);

  // La práctica: los trazos del radical ya escritos y la pista del que toca. Con menos movimiento, la pista sale entera.
  await p.evaluate(() => localStorage.setItem('kk-modoEscritura', '"calcar"'));
  await p.goto(`chrome-extension://${id}/app.html#/diccionario?q=${encodeURIComponent(PRACTICA)}`);
  await p.reload();
  await p.locator('.dic-trazos-vista').waitFor({ timeout: 30000 });
  await p.locator('.dic-pieza').first().waitFor({ timeout: 30000 }).catch(() => {});
  await p.locator('.dic-trazos-vista button').nth(1).click();
  await p.locator('.escritura-lienzo').waitFor({ timeout: 30000 });
  await escribirTrazos(PRACTICA, TRAZOS_HECHOS);
  await p.locator('.escritura-controles .btn').first().click();
  await guardar('escritura', idioma, p.locator('.dic-caracter-cab'));
  await p.evaluate(() => localStorage.removeItem('kk-modoEscritura'));
  await p.emulateMedia({ reducedMotion: 'no-preference' });
  await borrarFrases();
}

await sw.evaluate(async (previo) => chrome.storage.local.set({ ajustes: previo.ajustes }), previo);
await contexto.close();
process.exit(0);
