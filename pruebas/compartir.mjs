// Prueba «Compartir como imagen» en la ficha: la tarjeta de una palabra con lo que significa en la frase (Claude simulado),
// copiada al portapapeles al pulsar, en los dos estilos y guardada como archivo; y la de un punto de gramática. Las
// imágenes quedan en capturas-e2e/compartir para mirarlas. No gasta nada.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/compartir.mjs

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { recargarExtension } from './extension.mjs';
import { iniciarMock } from './mock-claude.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-local'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'compartir');
mkdirSync(CAPTURAS, { recursive: true });

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};

if (!existsSync(PERFIL) && existsSync(join(RAIZ, '.perfil-base', 'Default/IndexedDB'))) {
  cpSync(join(RAIZ, '.perfil-base', 'Default/IndexedDB'), join(PERFIL, 'Default/IndexedDB'), { recursive: true });
}

const NOTA = '赤い星と青い星を食べる夢を見た。\n授業の後は、たぶん日本語の勉強を続けると思います。';

const mock = await iniciarMock();
const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1440, height: 900 },
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
const previo = await sw.evaluate(async () => chrome.storage.local.get(['ajustes', 'lectorTexto', 'notaCuaderno', 'estiloTarjeta']));
await sw.evaluate(async ({ url, nota }) => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ urlBaseIA: url, claveAnthropic: 'clave-de-prueba', lectorTexto: nota, ajustes: { ...(d.ajustes ?? {}), idiomaInterfaz: 'es', idiomaObjetivo: 'ja', bienvenidaVista: true, tema: 'oscuro', avisarVersiones: false, sentidoAutomatico: false } });
  await chrome.storage.local.remove(['notaCuaderno', 'estiloTarjeta']);
}, { url: `http://127.0.0.1:${mock.puerto}`, nota: NOTA });

const p = await contexto.newPage();
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));
await p.goto(`chrome-extension://${id}/app.html#/lector`);
await p.getByRole('radio', { name: 'Leer' }).click();
await p.locator('.ap-papel .pal').first().waitFor({ timeout: 30000 });
await p.waitForTimeout(800);

/** La imagen que hay en el portapapeles, como PNG. */
async function portapapeles() {
  const datos = await p.evaluate(async () => {
    const [item] = await navigator.clipboard.read();
    if (!item?.types.includes('image/png')) return { tipos: item?.types ?? [] };
    const b = await item.getType('image/png');
    const lector = new FileReader();
    const url = await new Promise((ok) => {
      lector.onload = () => ok(lector.result);
      lector.readAsDataURL(b);
    });
    return { tipos: item.types, base64: String(url).split(',')[1] };
  });
  return { tipos: datos.tipos, png: datos.base64 ? Buffer.from(datos.base64, 'base64') : null };
}

async function esperarCopia() {
  await p.locator('.compartir-estado.copiada, .compartir-estado.sin-copiar, .compartir-estado.error').waitFor({ timeout: 30000 });
  return (await p.locator('.compartir-estado').getAttribute('class')).includes('copiada');
}

async function guardarDelPortapapeles(nombre) {
  const { tipos, png } = await portapapeles();
  if (!png) return { tipos };
  const ruta = join(CAPTURAS, nombre);
  writeFileSync(ruta, png);
  const meta = await sharp(png).metadata();
  return { tipos, ruta, meta };
}

// ---------- Una palabra ----------

// Sin preguntar a Claude, la tarjeta lleva lo que dice el diccionario.
await p.locator('.ap-papel .pal').filter({ hasText: '夢' }).first().click();
const ficha = p.locator('.ficha').first();
const boton = ficha.locator('.ficha-herr button[aria-label="Compartir como imagen"]');
await boton.waitFor({ timeout: 15000 });
comprobar(await boton.isVisible(), 'Hay un botón «Compartir como imagen» junto a la frecuencia y la lectura');
await boton.click();
comprobar(await esperarCopia(), 'Sin preguntar a Claude, también se copia');
await guardarDelPortapapeles('palabra-diccionario.png');
await boton.click();

// Con lo que significa en la frase. Si ya se preguntó en otra prueba, está guardado y aparece solo.
await p.locator('.ap-papel .pal').filter({ hasText: '食' }).first().click();
await boton.waitFor({ timeout: 15000 });
await p.waitForTimeout(500);
if (await ficha.locator('.sentido-pedir button').isVisible()) await ficha.locator('.sentido-pedir button').click();
await ficha.locator('.sentido b').filter({ hasText: 'absorber' }).waitFor({ timeout: 15000 });
comprobar(true, 'La ficha de 食べる sabe qué significa en la frase');
await boton.click();
comprobar(await esperarCopia(), 'Al pulsarlo, la imagen queda copiada', await p.locator('.compartir-estado').textContent());
comprobar((await p.locator('.compartir-estado').textContent()).includes('Ctrl+V'), 'Y dice cómo pegarla');
let r = await guardarDelPortapapeles('palabra-oscuro.png');
comprobar(r.tipos?.includes('image/png'), 'En el portapapeles hay un PNG', r.tipos?.join(', '));
comprobar(r.meta?.width === 2160 && r.meta?.height > 900, 'De 2160 px de ancho, al doble para que se lea nítida', `${r.meta?.width}×${r.meta?.height}`);
comprobar(await p.locator('.compartir-vista img').isVisible(), 'Con la vista previa en la ficha');
await p.locator('.compartir').screenshot({ path: join(CAPTURAS, 'panel.png') });

// El otro estilo: se vuelve a copiar y se recuerda para la próxima vez.
await p.locator('.compartir .segmentado button', { hasText: 'Papel' }).click();
await p.waitForFunction(() => document.querySelector('.compartir .segmentado button.activo')?.textContent.includes('Papel'));
comprobar(await esperarCopia(), 'Con el estilo claro, copiada otra vez');
const oscuro = r.meta;
r = await guardarDelPortapapeles('palabra-claro.png');
comprobar(r.meta?.width === 2160, 'La tarjeta clara también está en el portapapeles', `${r.meta?.width}×${r.meta?.height}`);
const fondoClaro = r.ruta ? (await sharp(r.ruta).extract({ left: 400, top: 400, width: 10, height: 10 }).stats()).channels[0].mean : 0;
comprobar(fondoClaro > 200, 'Y es clara de verdad', Math.round(fondoClaro));
comprobar(oscuro?.height === r.meta?.height, 'Los dos estilos miden lo mismo');
comprobar((await sw.evaluate(async () => (await chrome.storage.local.get('estiloTarjeta')).estiloTarjeta)) === 'claro', 'El estilo elegido se recuerda');

// Guardarla como archivo.
const [descarga] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }), p.locator('.compartir button', { hasText: 'Guardar imagen' }).click()]);
comprobar(descarga.suggestedFilename() === 'kotonoha-食べる.png', 'Se guarda con el nombre de la palabra', descarga.suggestedFilename());

// Volver a pulsar el botón la cierra.
await boton.click();
comprobar(!(await p.locator('.compartir').isVisible()), 'Pulsar otra vez el botón cierra la vista previa');

// ---------- Un punto de gramática ----------

await p.keyboard.press('Escape');
await p.locator('.ap-papel .pal').filter({ hasText: '思' }).first().click();
const chip = p.locator('.ficha .chip-gram').filter({ hasText: '思う' }).first();
await chip.waitFor({ timeout: 15000 });
await chip.click();
await p.locator('.ficha-patron .panel-ia-texto').waitFor({ timeout: 15000 });
await p.waitForFunction(() => !document.querySelector('.ficha-patron .cursor-ia'), null, { timeout: 15000 });
const botonGramatica = p.locator('.ficha-patron button[aria-label="Compartir como imagen"]');
comprobar(await botonGramatica.isVisible(), 'Cada punto de gramática tiene su botón para compartir');
await botonGramatica.click();
comprobar(await esperarCopia(), 'La tarjeta del patrón queda copiada');
r = await guardarDelPortapapeles('gramatica-claro.png');
comprobar(r.meta?.width === 2160, 'En el portapapeles, la del patrón', `${r.meta?.width}×${r.meta?.height}`);
await p.locator('.compartir .segmentado button', { hasText: 'Tinta' }).click();
await p.waitForFunction(() => document.querySelector('.compartir .segmentado button.activo')?.textContent.includes('Tinta'));
await esperarCopia();
await guardarDelPortapapeles('gramatica-oscuro.png');

// ---------- En inglés ----------

await sw.evaluate(async () => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ lectorTexto: 'Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do.', ajustes: { ...d.ajustes, idiomaObjetivo: 'en' } });
});
await p.reload();
await p.getByRole('radio', { name: 'Leer' }).click();
await p.locator('.ap-papel .pal').filter({ hasText: 'tired' }).first().click();
await p.locator('.ficha').first().waitFor({ timeout: 15000 });
await p.waitForTimeout(600);
await p.locator('.ficha-herr button[aria-label="Compartir como imagen"]').click();
comprobar(await esperarCopia(), 'En inglés, la tarjeta también se copia');
r = await guardarDelPortapapeles('ingles.png');
comprobar(r.meta?.width === 2160, 'Con su imagen', `${r.meta?.width}×${r.meta?.height}`);

comprobar(errores.length === 0, 'Sin errores en la página', errores.join(' | '));

// Lo de antes, como estaba.
await sw.evaluate(async (previo) => {
  await chrome.storage.local.set({ ajustes: previo.ajustes, lectorTexto: previo.lectorTexto ?? '' });
  if (previo.notaCuaderno) await chrome.storage.local.set({ notaCuaderno: previo.notaCuaderno });
  if (previo.estiloTarjeta) await chrome.storage.local.set({ estiloTarjeta: previo.estiloTarjeta });
  else await chrome.storage.local.remove('estiloTarjeta');
}, previo);
await contexto.close();
mock.cerrar?.();
console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
