// Opciones que se cruzan (0.31.0). Con la pausa al final de cada línea y «Reanudar tras un tiempo», la cuenta atrás
// seguía corriendo con una ficha abierta, y el video arrancaba en medio de la lectura. Ahora se detiene mientras la
// ficha está abierta y vuelve a empezar al cerrarla; con «Pausar al interactuar: al pasar por el subtítulo», también
// con el ratón sobre el subtítulo. El ratón encima sin esa opción no la detiene (suele quedarse ahí al cerrar una
// ficha), ni la ficha que abre sola «Consultar al pausar»: con esas opciones, el video sigue solo, como antes.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/opciones.mjs

import { cpSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { servidor } from './capturas/overlay.mjs';
import { recargarExtension } from './extension.mjs';
import { iniciarMock } from './mock-claude.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-opciones'));

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};

if (!existsSync(PERFIL) && existsSync(join(RAIZ, '.perfil-base', 'Default/IndexedDB'))) {
  cpSync(join(RAIZ, '.perfil-base', 'Default/IndexedDB'), join(PERFIL, 'Default/IndexedDB'), { recursive: true });
}

const mock = await iniciarMock();
const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1280, height: 720 },
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
});
const sw = await recargarExtension(contexto);
const previo = await sw.evaluate(async () => chrome.storage.local.get(['ajustes', 'urlBaseIA', 'claveAnthropic']));
const VELO_NO = { modo: 'no', revelarEnPausa: [], revelarPorEstado: [], revelarAlPasar: true };
const fijar = (cambios) =>
  sw.evaluate(async ({ c, url }) => {
    const d = await chrome.storage.local.get('ajustes');
    await chrome.storage.local.set({ urlBaseIA: url, claveAnthropic: 'clave-de-prueba', ajustes: { ...(d.ajustes ?? {}), ...c } });
  }, { c: cambios, url: `http://127.0.0.1:${mock.puerto}` });
await fijar({
  idiomaInterfaz: 'es', idiomaObjetivo: 'ja', bienvenidaVista: true, avisarVersiones: false, navegadorAbierto: false, salto: 'no', subsPosicion: null,
  analisisAutomatico: false, sentidoAutomatico: false, modo: 'personalizado',
  modoPersonalizado: { objetivosPausa: ['todas'], disparador: 'despues', velarObjetivo: VELO_NO, velarSecundario: VELO_NO },
  reanudarTras: true, reanudarSegundos: 2, reanudarDinamico: false, pausaInteraccion: 'nunca', autoConsultaAlPausar: false, popupAlPasar: false,
});

const s = await servidor(RAIZ);
const v = await contexto.newPage();
const errores = [];
v.on('pageerror', (e) => errores.push(e.message));
await v.goto(`http://127.0.0.1:${s.address().port}/`);
await v.waitForTimeout(700);
await sw.evaluate(async () => {
  const [t] = await chrome.tabs.query({ url: 'http://127.0.0.1/*' });
  for (let i = 0; i < 40; i++) {
    try {
      await chrome.tabs.sendMessage(t.id, { activarVideoAqui: true });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
});
await v.waitForFunction(() => document.querySelector('kotonoha-overlay')?.shadowRoot?.querySelector('.barra'), null, { timeout: 30000 });
const enSombra = (fn) => v.evaluate((f) => new Function('r', `return (${f})(r)`)(document.querySelector('kotonoha-overlay')?.shadowRoot), fn.toString());
const pausado = () => v.evaluate(() => document.querySelector('video').paused);
const cajaPalabra = () =>
  enSombra((r) => {
    const e = r.querySelector('.linea-sub.objetivo .pal');
    if (!e) return null;
    const c = e.getBoundingClientRect();
    return { x: c.left + c.width / 2, y: c.top + c.height / 2 };
  });
/** Desde un segundo dado, hasta la pausa automática al acabar esa línea. */
async function hastaLaPausa(desde) {
  await v.evaluate((t) => {
    const x = document.querySelector('video');
    x.currentTime = t;
    return x.play();
  }, desde);
  await v.waitForFunction((t) => document.querySelector('video').paused && document.querySelector('video').currentTime > t + 1, desde, { timeout: 20000 });
}
const fichaAbierta = () => enSombra((r) => !!r.querySelector('.ficha'));

try {
  // 1. Una ficha abierta durante la pausa.
  await hastaLaPausa(0);
  const caja = await cajaPalabra();
  await v.mouse.click(caja.x, caja.y);
  await v.waitForFunction(() => !!document.querySelector('kotonoha-overlay')?.shadowRoot?.querySelector('.ficha'), null, { timeout: 10000 });
  await v.waitForTimeout(3500);
  comprobar(await pausado(), 'Con la pausa automática y «Reanudar tras un tiempo», una ficha abierta detiene la cuenta atrás: el video no arranca con ella abierta');
  await v.keyboard.press('Escape');
  await v.waitForTimeout(300);
  if (await fichaAbierta()) await v.mouse.click(60, 60);
  await v.waitForTimeout(2700);
  comprobar(!(await pausado()), 'Al cerrarla, la cuenta vuelve a empezar y el video sigue solo, aunque el ratón se quede sobre el subtítulo');

  // 2. El ratón sobre el subtítulo, con «Pausar al interactuar: al pasar por el subtítulo».
  await v.mouse.move(60, 60, { steps: 4 });
  await fijar({ pausaInteraccion: 'alPasarSubtitulo' });
  await v.waitForTimeout(500);
  await hastaLaPausa(4.5);
  const otra = await cajaPalabra();
  await v.mouse.move(otra.x, otra.y + 2, { steps: 4 });
  await v.waitForTimeout(3500);
  comprobar(await pausado(), 'Con «Pausar al interactuar: al pasar por el subtítulo», el ratón sobre el subtítulo también la detiene');
  await v.mouse.move(60, 60, { steps: 4 });
  await v.waitForTimeout(2700);
  comprobar(!(await pausado()), 'Y al apartarlo, el video sigue tras la cuenta entera');

  // 3. «Consultar al pausar»: la ficha la abre Kotonoha, no quien mira, y no detiene nada.
  await fijar({ autoConsultaAlPausar: true, pausaInteraccion: 'nunca' });
  await v.waitForTimeout(500);
  await hastaLaPausa(9);
  await v.waitForTimeout(400);
  const sola = await fichaAbierta();
  await v.waitForTimeout(2600);
  comprobar(sola && !(await pausado()), 'Con «Consultar al pausar», la ficha que se abre sola no detiene la cuenta: el video sigue solo, como antes', sola ? '' : 'no se abrió la ficha');
} finally {
  comprobar(errores.length === 0, 'Sin errores en la página', [...new Set(errores)].join(' | '));
  await v.close();
  s.close();
  await sw.evaluate(async (previo) => {
    await chrome.storage.local.set({ ajustes: previo.ajustes });
    for (const clave of ['urlBaseIA', 'claveAnthropic']) {
      if (previo[clave] !== undefined) await chrome.storage.local.set({ [clave]: previo[clave] });
      else await chrome.storage.local.remove(clave);
    }
  }, previo);
  await contexto.close();
  mock.servidor.close();
}
console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
