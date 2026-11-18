// Prueba la página aumentada de la 0.37.0 con un PDF hecho aquí mismo, con texto de Sōseki, de dominio público, y una
// página con furigana impreso: el subrayado por estado y el furigana sobre la página, en su sitio; que el furigana impreso
// no se tape; que una palabra que se marca como conocida pierda su furigana; la comprensión de la página; la traducción
// como un subtítulo, pedida una vez y leída después de lo guardado (con un Claude falso, sin gastar); la ficha con Mayús;
// los modos del furigana y la gramática; leer en voz alta siguiendo la frase; y Consultadas convertidas en tarjetas con
// un recorte de la página.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/lector-aumentado.mjs

import { mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';
import { iniciarMock } from './mock-claude.mjs';
import { estadoOrden, orden } from './ordenes.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-lector-aumentado'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'lector-aumentado');
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

const mock = await iniciarMock();
const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1440, height: 900 },
  args: ['--mute-audio', `--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});
// Una voz del navegador que termina cada frase al momento: la prueba no depende de las voces del equipo.
await contexto.addInitScript(() => {
  const falsa = {
    speaking: false,
    pending: false,
    paused: false,
    onvoiceschanged: null,
    getVoices: () => [],
    cancel() {},
    pause() {},
    resume() {},
    addEventListener() {},
    removeEventListener() {},
    speak(u) {
      window.__dichas = [...(window.__dichas ?? []), u.text];
      setTimeout(() => u.onend?.(new Event('end')), 300);
    },
  };
  Object.defineProperty(window, 'speechSynthesis', { value: falsa, configurable: true });
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
for (const pg of contexto.pages()) if (pg.url().includes('app.html')) await pg.close();
await sw.evaluate(async (url) => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), bienvenidaVista: true, idiomaInterfaz: 'es', idiomaObjetivo: 'ja', destino: 'memoria', ankiPuerto: 1 }, urlBaseIA: url, claveAnthropic: 'clave-de-prueba' });
}, `http://127.0.0.1:${mock.puerto}`);
const motor = async (metodo, ...args) => {
  const r = await sw.evaluate(({ metodo, args }) => chrome.runtime.sendMessage({ canal: 'motor', metodo, args }), { metodo, args });
  if (!r?.ok) throw new Error(`${metodo}: ${r?.error}`);
  return r.valor;
};
const errores = [];

// ---------- El libro: una página de texto y otra con furigana impreso ----------

const P1 = '吾輩は猫である。名前はまだ無い。';
const P2 = 'どこで生れたかとんと見当がつかぬ。何でも薄暗いじめじめした所でニャーニャー泣いていた事だけは記憶している。吾輩はここで始めて人間というものを見た。';
const hoja = await contexto.newPage();
await hoja.setContent(`<!doctype html><html lang="ja"><meta charset="utf-8"><style>
  @page { size: A5; margin: 18mm 16mm; }
  body { font-family: 'Yu Mincho','MS Mincho',serif; color: #111; margin: 0; }
  p { font-size: 15px; line-height: 2.1; margin: 0; text-indent: 1em; text-align: justify; }
  .salto { page-break-before: always; }
  rt { font-size: 7.5px; }
</style>
<p>${P1}</p><p>${P2}</p>
<p class="salto">今日は<ruby>図書館<rt>としょかん</rt></ruby>で本を読みます。天気がいいので公園を散歩しました。</p></html>`);
const PDF = await hoja.pdf({ format: 'A5', printBackground: true });
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

const lineaCon = async (trozo) => {
  const l = await v.evaluate((t) => [...document.querySelectorAll('.vs-linea')].map((b) => b.getAttribute('aria-label')).find((x) => x?.includes(t)) ?? '', trozo);
  return { texto: l, caja: await v.locator(`.vs-linea[aria-label="${l}"]`).first().boundingBox() };
};
/** El centro de una letra de un renglón horizontal. */
const letra = async (trozo, k = 0) => {
  const l = await lineaCon(trozo);
  const i = [...l.texto].indexOf([...trozo][0]) + k;
  return { x: l.caja.x + (l.caja.width * (i + 0.5)) / [...l.texto].length, y: l.caja.y + l.caja.height / 2, linea: l };
};
const rubi = (texto) =>
  v.evaluate((t) => {
    const r = [...document.querySelectorAll('.vs-rubi')].find((x) => x.textContent === t);
    if (!r) return null;
    const c = r.getBoundingClientRect();
    return { x: c.x + c.width / 2, abajo: c.bottom };
  }, texto);
const contar = (sel) => v.evaluate((s) => document.querySelectorAll(s).length, sel);
const elegida = () =>
  v.evaluate(() => {
    const e = document.querySelector('.vs-ventana .ap-elegida');
    const p = e?.closest('.pal-partible') ?? e;
    if (!p) return null;
    const c = p.cloneNode(true);
    for (const rt of c.querySelectorAll('rt')) rt.remove();
    return c.textContent.replace(/\p{Cf}/gu, '');
  });

// ---------- Sobre la página ----------

console.log('\n== La página aumentada ==');
comprobar(!!(await esperar(async () => (await contar('.vs-sub')) > 5 && (await contar('.vs-rubi')) > 5, 15000)), 'Las palabras nuevas, subrayadas y con su furigana sobre la página', `${await contar('.vs-sub')} subrayados, ${await contar('.vs-rubi')} lecturas`);
const kento = await letra('見当');
const r1 = await rubi('けんとう');
const finKento = (await letra('見当', 1)).x + kento.linea.caja.width / [...kento.linea.texto].length / 2;
comprobar(!!r1 && r1.abajo <= kento.linea.caja.y + 3 && r1.x > kento.x - 4 && r1.x < finKento, 'El furigana de 見当 va justo encima de sus dos kanji', JSON.stringify({ r1, linea: kento.linea.caja.y, desde: Math.round(kento.x), hasta: Math.round(finKento) }));
const comprension0 = await v.evaluate(() => parseInt(document.querySelector('.vs-comprension b')?.textContent ?? '-1'));
comprobar(comprension0 >= 0 && comprension0 < 100, 'La barra de estado dice cuánto se entiende de la página', `${comprension0} %`);
await v.screenshot({ path: join(CAPTURAS, '1-aumentada.png') });

// ---------- La traducción como un subtítulo ----------

console.log('\n== La traducción bajo la frase ==');
await v.mouse.click(kento.x, kento.y);
await esperar(async () => (await elegida()) === '見当', 15000);
comprobar((await elegida()) === '見当', 'Tocar 見当 la abre en la ventana');
const pedir = await esperar(() => v.$('.vs-subtitulo-pedir'), 8000);
comprobar(!!pedir, 'Sin traducción guardada, bajo la frase se ofrece traducirla, sin pedir nada todavía');
const antes = mock.peticiones.length;
await v.click('.vs-subtitulo-pedir');
const subtitulo = await esperar(() => v.evaluate(() => (document.querySelector('.vs-subtitulo')?.textContent.includes('Soñé') ? document.querySelector('.vs-subtitulo').getBoundingClientRect().top : null)), 15000);
comprobar(!!subtitulo && subtitulo >= kento.linea.caja.y + kento.linea.caja.height - 2, 'Al pedirla, la traducción sale como un subtítulo debajo de la frase', String(subtitulo));
comprobar(mock.peticiones.length === antes + 1, 'Con una sola petición a Claude', String(mock.peticiones.length - antes));
await v.screenshot({ path: join(CAPTURAS, '2-subtitulo.png') });

// ---------- Lo que se sabe cambia la página ----------

console.log('\n== Una palabra conocida ==');
await v.keyboard.press('3');
comprobar(!!(await esperar(async () => !(await rubi('けんとう')), 10000)), 'Marcada como conocida, 見当 pierde su furigana sobre la página');
const comprension1 = await esperar(async () => {
  const p = await v.evaluate(() => parseInt(document.querySelector('.vs-comprension b')?.textContent ?? '-1'));
  return p > comprension0 ? p : null;
}, 8000);
comprobar(!!comprension1, 'Y se entiende más de la página', `${comprension0} → ${comprension1}`);
await v.keyboard.press('Escape');
await v.mouse.click(kento.x, kento.y);
const deNuevo = await esperar(() => v.evaluate(() => document.querySelector('.vs-subtitulo')?.textContent.includes('Soñé') || null), 8000);
comprobar(!!deNuevo && mock.peticiones.length === antes + 1, 'Al volver a la frase, su traducción sale de lo guardado, sin pagarla otra vez');
await v.keyboard.press('Escape');

// ---------- La ficha con Mayús ----------

console.log('\n== La ficha al pasar el ratón ==');
const usugurai = await letra('薄暗い');
await v.mouse.move(usugurai.x, usugurai.y);
await v.keyboard.down('Shift');
comprobar((await esperar(async () => ((await elegida()) === '薄暗い' ? true : null), 10000)) === true, 'Con Mayús y el ratón encima, 薄暗い se abre sin hacer clic', String(await elegida()));
await v.keyboard.up('Shift');
await v.keyboard.press('Escape');

// ---------- Los modos ----------

console.log('\n== Los modos ==');
await v.mouse.click(30, 860);
await v.keyboard.press('a');
comprobar(!!(await esperar(async () => (await contar('.vs-sub')) === 0 && (await contar('.vs-rubi')) === 0, 3000)), 'A quita las ayudas de la página');
await v.keyboard.press('a');
const nuevas = await esperar(async () => {
  const n = await contar('.vs-rubi');
  return n > 0 ? n : null;
}, 5000);
comprobar(!!nuevas, 'Y otra vez las pone');
await orden(v, 'pfurigana-todas');
const todas = await contar('.vs-rubi');
comprobar(todas > nuevas, 'Con «Todas las palabras», también las conocidas llevan furigana', `${nuevas} → ${todas}`);
await orden(v, 'pfurigana-ninguna');
comprobar((await contar('.vs-rubi')) === 0 && (await contar('.vs-sub')) > 0, 'Con «Ninguna», sin furigana y con el subrayado');
await orden(v, 'pfurigana-desconocidas');
await orden(v, 'gramatica-pagina');
comprobar(!!(await esperar(async () => (await contar('.vs-gram')) > 0, 5000)), 'La gramática se marca bajo su forma, sobre la página', String(await contar('.vs-gram')));
await v.screenshot({ path: join(CAPTURAS, '3-gramatica.png') });
await orden(v, 'gramatica-pagina');

// ---------- Leer en voz alta ----------

console.log('\n== Leer en voz alta ==');
await v.keyboard.press('l');
comprobar(!!(await esperar(() => v.$('.vs-voz'), 5000)), 'L empieza a leer en voz alta, con sus mandos');
comprobar(!!(await esperar(async () => (await contar('.vs-leyendo')) > 0, 5000)), 'La frase que suena se marca en la página');
const segunda = await esperar(() => v.evaluate(() => (document.querySelector('.vs-voz')?.textContent.includes('Frase 2 de') ? true : null)), 12000);
comprobar(!!segunda, 'Y sigue con la siguiente frase al acabar una');
const dichas = await v.evaluate(() => window.__dichas ?? []);
comprobar(dichas[0] === P1.split('。')[0] + '。', 'Lee la página desde su primera frase', JSON.stringify(dichas.slice(0, 2)));
await v.screenshot({ path: join(CAPTURAS, '4-voz.png') });
await v.keyboard.press('Escape');
comprobar(!!(await esperar(async () => !(await v.$('.vs-voz')), 3000)), 'Esc la para');

// ---------- El furigana impreso ----------

console.log('\n== El furigana impreso ==');
await v.keyboard.press('ArrowRight');
await esperar(() => v.evaluate(() => [...document.querySelectorAll('.vs-linea')].some((b) => b.getAttribute('aria-label')?.includes('図書館'))), 10000);
await esperar(async () => (await contar('.vs-rubi')) > 0, 10000);
const impresas = await v.evaluate(() => [...document.querySelectorAll('.vs-rubi')].map((r) => r.textContent));
comprobar(!impresas.includes('としょかん') && impresas.length > 0, 'Donde el libro trae su furigana, no se le pone otro encima', JSON.stringify(impresas));
await v.screenshot({ path: join(CAPTURAS, '5-impreso.png') });

// ---------- Consultadas, a tarjetas ----------

console.log('\n== Consultadas ==');
const cuantas = await v.evaluate(() => parseInt(document.querySelector('.vs-consultadas-boton .vs-cuenta')?.textContent ?? '0'));
comprobar(cuantas >= 2, 'Lo consultado queda apuntado, y la barra de estado lo dice', String(cuantas));
await v.click('.vs-consultadas-boton');
await v.waitForSelector('.vs-panel-consultadas');
const palabras = await v.evaluate(() => [...document.querySelectorAll('.vs-consultada-palabra')].map((p) => p.firstChild?.textContent));
comprobar(palabras.includes('見当') && palabras.includes('薄暗い'), 'El panel las reúne, la última primero', JSON.stringify(palabras));
const total0 = (await motor('memoriaResumen')).total;
await v.locator('.vs-consultada', { hasText: '見当' }).locator('input[type=checkbox]').check();
await v.locator('.vs-consultadas-acciones .btn.primario').click();
comprobar(!!(await esperar(() => v.evaluate(() => (document.querySelector('.vs-consultadas-aviso')?.textContent.includes('tarjetas creadas') ? true : null)), 15000)), 'Crea la tarjeta de lo elegido');
const tarjetas = await motor('memoriaPendientes', 20);
const t = tarjetas.find((x) => x.borrador.palabra === '見当');
comprobar((await motor('memoriaResumen')).total === total0 + 1 && !!t, 'En Memoria, con su palabra');
comprobar(!!t?.borrador.frase.includes('<b>見当</b>') && t.borrador.fuente.includes('neko'), 'Con su frase, la palabra en negrita, y de qué libro y página sale', `${t?.borrador.frase} · ${t?.borrador.fuente}`);
const img = t?.borrador.imagenes?.[0];
comprobar(img?.tipo === 'image/jpeg' && img.datos?.startsWith('/9j/') && img.datos.length > 2000, 'Y un recorte de la página con la frase', `${img?.tipo} ${img?.datos?.length}`);
comprobar((await contar('.vs-consultada.hecha')) === 1, 'La consultada queda marcada como hecha');
await v.screenshot({ path: join(CAPTURAS, '6-consultadas.png') });

if (errores.length) console.log('\nErrores en la página:', [...new Set(errores)].slice(0, 6));
comprobar(errores.length === 0, 'Sin errores en las páginas');
console.log(`\n${fallos ? `${fallos} comprobaciones fallaron` : 'Todas las comprobaciones pasaron'}`);
await contexto.close();
mock.servidor.close();
rmSync(PERFIL, { recursive: true, force: true });
process.exit(fallos ? 1 : 0);
