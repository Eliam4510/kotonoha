// Prueba otro proveedor de IA con un servidor simulado que habla la API de OpenAI, como DeepSeek: rechaza el esquema JSON
// y no da más de 8192 tokens, así que el adaptador tiene que reintentar. Ajustes enseña la tarjeta, sus modelos y la prueba
// de conexión; la explicación de una palabra llega en flujo con la clave; el significado en la frase, que pide JSON, se
// repite en modo JSON con el esquema en las instrucciones; y el gasto se anota con lo que dice el proveedor.
// La clave es de mentira y solo vive en el perfil de pruebas. No gasta nada.
// Uso: KK_SALIDA=.dist-whisper node build.mjs && node pruebas/proveedores.mjs

import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-whisper'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-base'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'proveedores');
mkdirSync(CAPTURAS, { recursive: true });
const CLAVE = 'clave-de-prueba';

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};

// ---------- El proveedor simulado ----------

const pedidas = [];
const SENTIDO = { significado: 'puente (de prueba)', uso: 'literal', nota: 'nota de prueba', definicion: 0 };
const servidor = createServer(async (req, res) => {
  let cuerpo = '';
  for await (const c of req) cuerpo += c;
  const url = new URL(req.url, 'http://x');
  const json = (estado, v) => {
    res.writeHead(estado, { 'content-type': 'application/json' });
    res.end(JSON.stringify(v));
  };
  if (req.headers.authorization !== `Bearer ${CLAVE}`) return json(401, { error: { message: 'bad key' } });
  if (url.pathname === '/v1/models') return json(200, { data: [{ id: 'modelo-b' }, { id: 'modelo-a' }] });
  if (url.pathname !== '/v1/chat/completions') return json(404, {});
  const b = JSON.parse(cuerpo);
  pedidas.push(b);
  if (b.response_format?.type === 'json_schema') return json(400, { error: { message: 'This response_format type is unavailable now' } });
  if ((b.max_tokens ?? 0) > 8192) return json(400, { error: { message: 'Invalid max_tokens value, the valid range of max_tokens is [1, 8192]' } });
  const usuario = typeof b.messages[1].content === 'string' ? b.messages[1].content : '';
  const texto = b.response_format?.type === 'json_object' ? JSON.stringify(SENTIDO) : usuario.includes('接続') ? '接続' : 'Explicación de prueba: un puente para cruzar un río.';
  res.writeHead(200, { 'content-type': 'text/event-stream' });
  res.write(': PROCESANDO\n\n');
  const partes = texto.match(/[\s\S]{1,12}/g);
  for (const [i, parte] of partes.entries()) {
    res.write(`data: ${JSON.stringify({ model: b.model, choices: [{ delta: { content: parte }, finish_reason: i === partes.length - 1 ? 'stop' : null }] })}\n\n`);
    await new Promise((ok) => setTimeout(ok, 20));
  }
  res.write(`data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 120, completion_tokens: 30, cost: 0.00042 } })}\n\n`);
  res.end('data: [DONE]\n\n');
});
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
const URL_PROVEEDOR = `http://127.0.0.1:${servidor.address().port}/v1`;

// ---------- El navegador ----------

const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1280, height: 900 },
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
await sw.evaluate(
  async ({ url, clave }) => {
    const d = await chrome.storage.local.get('ajustes');
    const a = d.ajustes ?? {};
    await chrome.storage.local.set({
      ajustes: {
        ...a,
        idiomaInterfaz: 'es',
        idiomaObjetivo: 'ja',
        bienvenidaVista: true,
        tema: 'oscuro',
        avisarVersiones: false,
        sentidoAutomatico: false,
        proveedores: [{ id: 'prueba', nombre: 'Proveedor de prueba', url, modelos: ['modelo-a'], esquemas: 'auto', conClave: true }],
        modelos: { ...(a.modelos ?? {}), explicar: 'prueba::modelo-a', sentido: 'prueba::modelo-a' },
      },
      clavesProveedores: { prueba: clave },
    });
    // Sin la clave de Claude: la IA va solo por el otro proveedor.
    await chrome.storage.local.remove(['claveAnthropic', 'urlBaseIA']);
  },
  { url: URL_PROVEEDOR, clave: CLAVE }
);
const p = await contexto.newPage();
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));

/** Vacía una tabla de la base japonesa: la caché de respuestas haría que una segunda pasada no preguntara nada. */
const vaciar = (tabla) =>
  p.evaluate(async (tabla) => {
    const db = await new Promise((ok, mal) => {
      const r = indexedDB.open('kikitori');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => mal(r.error);
    });
    await new Promise((ok) => {
      const tx = db.transaction(tabla, 'readwrite');
      tx.objectStore(tabla).clear();
      tx.oncomplete = ok;
    });
    db.close();
  }, tabla);
await p.goto(`chrome-extension://${id}/popup.html`);
await vaciar('cacheIA');

// Ajustes: la tarjeta, sus modelos y la prueba de conexión.
await p.goto(`chrome-extension://${id}/app.html#/ajustes`);
const tarjeta = p.locator('#proveedores').getByRole('group', { name: 'Proveedor de prueba' });
await tarjeta.waitFor({ timeout: 15000 });
comprobar(await tarjeta.isVisible(), 'Ajustes enseña la tarjeta del proveedor');
comprobar((await tarjeta.getByLabel('Clave de Proveedor de prueba').getAttribute('placeholder')) === 'Escribe otra para cambiarla', 'Sabe que tiene clave, sin enseñarla');
await tarjeta.getByRole('button', { name: 'Ver sus modelos' }).click();
await tarjeta.getByText('2 modelos disponibles').waitFor({ timeout: 10000 }).catch(() => {});
comprobar(await tarjeta.getByText(/2 modelos disponibles/).isVisible(), 'Busca sus modelos');
await tarjeta.getByLabel('Modelo que añadir').fill('modelo-b');
await tarjeta.getByRole('button', { name: 'Añadir', exact: true }).click();
await p.waitForTimeout(500);
const modelos = await sw.evaluate(() => chrome.storage.local.get('ajustes').then((d) => d.ajustes.proveedores[0].modelos));
comprobar(modelos.join(',') === 'modelo-a,modelo-b', 'Se le añade un modelo', modelos.join(','));
await tarjeta.getByRole('button', { name: 'Probar la conexión' }).click();
await tarjeta.getByText(/Conectado/).waitFor({ timeout: 15000 }).catch(() => {});
const conexion = await tarjeta.locator('.ap-mensaje, [role="status"]').allInnerTexts().catch(() => []);
comprobar(await tarjeta.getByText('Conectado: 接続 (modelo-a)').isVisible(), 'La prueba de conexión responde', conexion.join(' | '));
const selector = p.getByRole('combobox', { name: 'Modelo para Explicación de palabras' });
comprobar((await selector.inputValue()) === 'prueba::modelo-a', 'La explicación de palabras usa el modelo del proveedor', await selector.inputValue());
comprobar(await p.getByRole('combobox', { name: 'Esfuerzo para Explicación de palabras' }).isDisabled(), 'Y el esfuerzo, que es de Claude, queda apagado');
await p.locator('#proveedores').screenshot({ path: join(CAPTURAS, '1-ajustes.png') });

// La explicación de una palabra llega en flujo, con la clave.
pedidas.length = 0;
// El Cuaderno añade lo que llega al final de lo que ya hay: se empieza vacío.
await sw.evaluate(() => chrome.storage.local.remove(['lectorTexto', 'notaCuaderno']));
await p.goto(`chrome-extension://${id}/app.html#/lector?t=${encodeURIComponent('橋を渡ります。')}`);
await p.locator('.ap-papel .pal').first().waitFor({ timeout: 30000 });
await p.locator('.ap-papel .pal').first().click();
const ficha = p.locator('.ap-lectura-ficha');
await ficha.locator('.ficha').waitFor({ timeout: 10000 });
// La explicación sale cuando la ficha ya tiene lo del diccionario: la primera búsqueda carga los términos.
await ficha.locator('.ficha-panel').waitFor({ timeout: 60000 }).catch(() => {});
await ficha.getByRole('tab', { name: 'Explicar con Claude' }).click();
await ficha.getByText(/Explicación de prueba: un puente/).waitFor({ timeout: 60000 }).catch(() => {});
comprobar(await ficha.getByText(/Explicación de prueba: un puente/).isVisible(), 'La explicación llega del otro proveedor');
console.log('      peticiones:', pedidas.map((b) => `${b.max_tokens}${b.response_format ? ' ' + b.response_format.type : ''}`).join(', '));
const explicacion = [...pedidas].reverse().find((b) => !b.response_format);
comprobar(!!explicacion && explicacion.model === 'modelo-a' && explicacion.stream === true && JSON.stringify(explicacion.messages).includes('橋'), 'Con su modelo, en flujo y con la palabra', explicacion ? explicacion.model : 'sin petición');
comprobar(!!explicacion && explicacion.max_tokens === 8192, 'Tras el rechazo, con el máximo de tokens que admite', explicacion?.max_tokens);

// El significado en la frase pide JSON: rechazado el esquema, va en modo JSON con el esquema en las instrucciones.
pedidas.length = 0;
await ficha.getByRole('tab', { name: /Diccionario/ }).first().click().catch(() => {});
await ficha.locator('.sentido-pedir button').click({ timeout: 10000 });
await ficha.getByText('puente (de prueba)').waitFor({ timeout: 20000 }).catch(() => {});
comprobar(await ficha.getByText('puente (de prueba)').isVisible(), 'El significado en la frase llega como JSON');
const tipos = pedidas.map((b) => b.response_format?.type ?? 'texto');
comprobar(tipos.includes('json_schema') && tipos.includes('json_object'), 'Primero con esquema y, rechazado, en modo JSON', tipos.join(' → '));
const enModoJson = pedidas.find((b) => b.response_format?.type === 'json_object');
comprobar(!!enModoJson && enModoJson.messages[0].content.includes('"significado"'), 'Con el esquema en las instrucciones');
await p.screenshot({ path: join(CAPTURAS, '2-ficha.png') });

// El gasto, con el coste que dice el proveedor.
const gasto = await p.evaluate(async () => {
  const db = await new Promise((ok, mal) => {
    const r = indexedDB.open('kikitori');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
  const filas = await new Promise((ok) => {
    const r = db.transaction('consumo').objectStore('consumo').getAll();
    r.onsuccess = () => ok(r.result);
  });
  db.close();
  return filas.filter((f) => f.modelo.startsWith('prueba::')).map((f) => ({ tarea: f.tarea, coste: f.coste, entrada: f.entrada, salida: f.salida }));
});
comprobar(gasto.some((f) => f.tarea === 'explicar' && f.coste === 0.00042 && f.entrada === 120 && f.salida === 30), 'El gasto se anota con el coste y los tokens que dice el proveedor', JSON.stringify(gasto.slice(-2)));

comprobar(errores.length === 0, 'Sin errores en la página', errores.join(' | '));
await contexto.close();
servidor.close();
console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
