// Prueba el Cuaderno (lo que antes era el Portapapeles): escribir con formato, con los atajos y con los botones; leer a todo
// lo ancho; la velocidad y el modo de la lectura en voz alta; practicar un trozo seleccionado; «Organizar» con el Claude
// simulado, y deshacerlo; guardar la nota en la biblioteca, que se sigue guardando allí, y abrirla otra vez desde la
// biblioteca. No gasta nada.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/cuaderno.mjs

import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';
import { iniciarMock } from './mock-claude.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-local'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'cuaderno');
mkdirSync(CAPTURAS, { recursive: true });

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

if (!existsSync(PERFIL) && existsSync(join(RAIZ, '.perfil-base', 'Default/IndexedDB'))) {
  cpSync(join(RAIZ, '.perfil-base', 'Default/IndexedDB'), join(PERFIL, 'Default/IndexedDB'), { recursive: true });
}

const mock = await iniciarMock();
const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1440, height: 900 },
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
await sw.evaluate(async ({ url }) => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ urlBaseIA: url, claveAnthropic: 'clave-de-prueba', ajustes: { ...(d.ajustes ?? {}), idiomaInterfaz: 'es', idiomaObjetivo: 'ja', bienvenidaVista: true, tema: 'oscuro', avisarVersiones: false } });
  await chrome.storage.local.remove(['lectorTexto', 'notaCuaderno']);
}, { url: `http://127.0.0.1:${mock.puerto}` });
const guardado = () => sw.evaluate(async () => (await chrome.storage.local.get('lectorTexto')).lectorTexto ?? '');

const p = await contexto.newPage();
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));
await p.goto(`chrome-extension://${id}/app.html#/lector`);
await p.waitForTimeout(1500);

// ---------- Escribir ----------

const editor = p.locator('.cu-editor');
comprobar(await editor.isVisible(), 'Vacío, el Cuaderno abre para escribir');
comprobar((await p.locator('.cu-editor .cu-vacio').getAttribute('data-ejemplo'))?.includes('# para un título'), 'Y dice cómo dar formato');
const ancho = await p.evaluate(() => [document.querySelector('.cu-hoja').getBoundingClientRect().width, document.querySelector('.ap-principal').getBoundingClientRect().width]);
comprobar(ancho[0] > ancho[1] - 140, 'La hoja ocupa todo lo ancho', `${Math.round(ancho[0])} de ${Math.round(ancho[1])} px`);

await editor.click();
await dormir(200);
const escribir = async (texto) => {
  await p.keyboard.type(texto);
  await dormir(60);
};
await escribir('# 今日の予定');
await p.keyboard.press('Enter');
await escribir('朝ご飯を食べてから、駅まで歩きます。');
await p.keyboard.press('Enter');
await escribir('- 図書館で勉強する');
await p.keyboard.press('Enter');
await p.keyboard.press('Tab');
await escribir('漢字の練習');
await p.keyboard.press('Enter');
await p.keyboard.press('Enter');
await p.keyboard.press('Enter');
await escribir('友達に会います。');
await dormir(1000);
const estructura = await editor.evaluate((el) => [...el.children].map((c) => c.tagName + (c.tagName === 'UL' ? `(${c.querySelectorAll('ul').length})` : '')).join(' '));
comprobar(estructura === 'H1 P UL(1) P', 'Los atajos dan título, lista y subpunto', estructura);
const md = await guardado();
comprobar(md === '# 今日の予定\n\n朝ご飯を食べてから、駅まで歩きます。\n\n- 図書館で勉強する\n  - 漢字の練習\n\n友達に会います。', 'Se guarda solo, como Markdown', JSON.stringify(md));

// Con los botones: la última línea, subtítulo; y en negrita.
await p.locator('.cu-editor > p').last().click();
await dormir(200);
await p.locator('.cu-bloque').selectOption('titulo2');
await dormir(300);
comprobar((await editor.locator('h2').count()) === 1, 'El selector cambia el tipo de bloque', await editor.locator('h2').innerText().catch(() => ''));
await p.locator('.cu-editor > p').first().click();
await dormir(200);
await p.keyboard.press('Home');
await p.keyboard.down('Shift');
for (let i = 0; i < 4; i++) await p.keyboard.press('ArrowRight');
await p.keyboard.up('Shift');
await p.getByRole('button', { name: 'Negrita' }).click();
await dormir(900);
comprobar((await guardado()).includes('**朝ご飯を**'), 'Y la negrita', (await guardado()).split('\n')[2]);
await p.screenshot({ path: join(CAPTURAS, '1-editar.png') });

// ---------- Leer ----------

await p.getByRole('radio', { name: 'Leer' }).click();
await p.locator('.ap-papel .pal').first().waitFor({ timeout: 30000 });
await dormir(500);
comprobar(await p.locator('.ap-lectura.completo').isVisible(), 'Leer, en la misma página y a todo lo ancho');
comprobar((await p.locator('.ap-papel h2.ap-t, .ap-papel h3.ap-t').count()) >= 1 && (await p.locator('.ap-papel ul ul').count()) === 1, 'Con los títulos y la lista con su subpunto');
await p.screenshot({ path: join(CAPTURAS, '2-leer.png') });

// La lectura en voz alta: la velocidad y el modo, que se recuerdan.
const velocidad = p.locator('.ap-dock-velocidad');
const antes = await velocidad.innerText();
await velocidad.click();
comprobar(antes === '1×' && (await velocidad.innerText()) === '1,2×', 'La velocidad de la voz cambia con un clic', `${antes} → ${await velocidad.innerText()}`);
await velocidad.click();
await velocidad.click();
await velocidad.click();
const modo = p.locator('.ap-dock button[aria-label^="Seguido"], .ap-dock button[aria-label^="Frase a frase"], .ap-dock button[aria-label^="Repetir"]');
await modo.click();
comprobar((await modo.getAttribute('aria-label'))?.startsWith('Frase a frase'), 'El modo pasa a frase a frase', await modo.getAttribute('aria-label'));
await modo.click();
comprobar((await modo.getAttribute('aria-label'))?.startsWith('Repetir'), 'Y a repetir la frase', await modo.getAttribute('aria-label'));
await modo.click();

// Practicar un trozo seleccionado.
await p.evaluate(() => {
  const pal = [...document.querySelectorAll('.ap-papel .pal')].find((x) => x.textContent.includes('駅'));
  const rango = document.createRange();
  rango.setStartBefore(pal);
  rango.setEndAfter(pal.nextElementSibling ?? pal);
  const s = getSelection();
  s.removeAllRanges();
  s.addRange(rango);
  pal.closest('.ap-papel').dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
});
const barrita = p.locator('.ap-seleccion');
await barrita.waitFor({ timeout: 3000 }).catch(() => {});
comprobar(await barrita.isVisible(), 'Al seleccionar un trozo, aparecen «Escuchar» y «Practicar»');
await barrita.getByRole('button', { name: 'Practicar' }).click();
await p.locator('.ap-practica').waitFor({ timeout: 5000 }).catch(() => {});
const practicado = await p.locator('.ap-practica-frase-texto').innerText().catch(() => '');
comprobar(practicado.startsWith('駅') && !/[ぁ-ん]{2}駅/.test(practicado), 'La práctica es la del trozo, sin el furigana', practicado);
await p.screenshot({ path: join(CAPTURAS, '3-practicar-trozo.png') });
await p.keyboard.press('Escape');

// ---------- Organizar ----------

await p.getByRole('button', { name: 'Nota nueva' }).click();
await dormir(600);
comprobar((await guardado()) === '' && (await editor.isVisible()), 'Una nota nueva empieza en blanco, para escribir');
await editor.click();
await dormir(200);
await p.evaluate(() => {
  const dt = new DataTransfer();
  dt.setData('text/plain', '今日の予定\n朝は忙しいです。\n午後は図書館に行きます。');
  document.querySelector('.cu-editor').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
});
await dormir(400);
comprobar((await editor.locator('p').count()) === 1, 'Pegado de corrido, es un párrafo');
await p.getByRole('button', { name: 'Organizar' }).click();
await p.locator('.cu-pagina .ap-mensaje').waitFor({ timeout: 15000 }).catch(() => {});
await dormir(400);
const organizado = await editor.evaluate((el) => [...el.children].map((c) => `${c.tagName}:${c.textContent}`).join(' | '));
comprobar(organizado === 'H1:今日の予定 | P:朝は忙しいです。 | P:午後は図書館に行きます。', 'Organizar le pone su título y sus párrafos', organizado);
comprobar((await p.locator('.cu-pagina .ap-mensaje').innerText()).startsWith('Organizado.'), 'Y dice que no cambió el texto', await p.locator('.cu-pagina .ap-mensaje').innerText());
await editor.click();
await p.keyboard.press('Control+z');
await dormir(400);
comprobar((await editor.locator('h1').count()) === 0 && (await editor.locator('p').count()) === 1, 'Ctrl+Z lo deja como estaba');
await p.keyboard.press('Control+y');
await dormir(800);

// ---------- La biblioteca ----------

await p.getByRole('button', { name: 'Guardar en la biblioteca' }).click();
await dormir(800);
comprobar(await p.locator('.cu-estado', { hasText: 'En la biblioteca' }).isVisible(), 'Guardada en la biblioteca, lo dice arriba');
const libro = await p.evaluate(async () => {
  const lista = await new Promise((ok) => chrome.runtime.sendMessage({ canal: 'motor', metodo: 'bibliotecaListar', args: [] }, (r) => ok(r?.valor ?? [])));
  return lista.find((e) => e.titulo === '今日の予定') ?? null;
});
comprobar(!!libro && libro.texto.startsWith('# 今日の予定'), 'Con su título y su texto', libro?.titulo);
// Lo que se escribe después se guarda también allí.
await p.locator('.cu-editor > p').last().click();
await dormir(200);
await p.keyboard.press('End');
await p.keyboard.press('Enter');
await escribir('夜は早く寝ます。');
await dormir(1200);
const despues = await p.evaluate(async (id) => (await new Promise((ok) => chrome.runtime.sendMessage({ canal: 'motor', metodo: 'bibliotecaObtener', args: [id] }, (r) => ok(r?.valor))))?.texto, libro?.id);
comprobar(despues?.includes('夜は早く寝ます。'), 'Lo escrito después se guarda también en la biblioteca');

// Una nota nueva no pierde la anterior; desde la biblioteca se vuelve a editar.
await p.getByRole('button', { name: 'Nota nueva' }).click();
await dormir(500);
await p.goto(`chrome-extension://${id}/app.html#/biblioteca?abrir=${libro?.id}`);
await p.waitForTimeout(2000);
const editarEn = p.getByRole('button', { name: 'Editar en el Cuaderno' });
comprobar(await editarEn.isVisible(), 'El texto de la biblioteca se puede editar en el Cuaderno');
await editarEn.click();
await p.locator('.cu-editor').waitFor({ timeout: 5000 }).catch(() => {});
await dormir(600);
comprobar((await p.locator('.cu-editor h1').innerText().catch(() => '')) === '今日の予定' && (await p.locator('.cu-estado', { hasText: 'En la biblioteca' }).isVisible()), 'Se abre para editar, enlazado a su nota');
await p.screenshot({ path: join(CAPTURAS, '4-desde-biblioteca.png') });

// Tema claro y pantalla estrecha.
await sw.evaluate(async () => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ ajustes: { ...d.ajustes, tema: 'claro' } });
});
await dormir(600);
await p.screenshot({ path: join(CAPTURAS, '5-claro.png') });
await p.setViewportSize({ width: 760, height: 900 });
await dormir(500);
await p.screenshot({ path: join(CAPTURAS, '6-estrecho.png') });
await sw.evaluate(async () => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ ajustes: { ...d.ajustes, tema: 'oscuro' } });
  await chrome.storage.local.remove(['lectorTexto', 'notaCuaderno']);
});
// Lo que la prueba guardó en la biblioteca se quita.
await p.evaluate(async () => {
  const lista = await new Promise((ok) => chrome.runtime.sendMessage({ canal: 'motor', metodo: 'bibliotecaListar', args: [] }, (r) => ok(r?.valor ?? [])));
  for (const e of lista.filter((x) => x.titulo === '今日の予定')) await new Promise((ok) => chrome.runtime.sendMessage({ canal: 'motor', metodo: 'bibliotecaEliminar', args: [e.id] }, ok));
});

comprobar(errores.length === 0, 'Sin errores en la página', errores.join(' | '));
await contexto.close();
mock.cerrar?.();
console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
