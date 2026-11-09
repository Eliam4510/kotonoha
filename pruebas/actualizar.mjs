// Prueba «Actualizar ahora» de punta a punta: el navegador carga una copia de la extensión desde una carpeta temporal,
// GitHub (simulado) anuncia la 9.9.9, y al pulsar el botón el ayudante registrado en este equipo baja el paquete de un
// servidor local, comprueba su SHA-256, lo pone en esa carpeta conservando la clave, y la extensión se recarga sola ya
// en la 9.9.9 y con el mismo identificador. El ayudante recibe la carpeta y el servidor por variables de entorno que
// hereda del navegador, así que no busca en los perfiles ni sale a internet.
//
// Necesita el ayudante registrado con el identificador de las pruebas (herramientas\ayudante\Instalar.cmd con
// «-Extension pldipbgollbhkjjigkgnojdjpfhanhhf»). Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/actualizar.mjs

import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { zipSync } from 'fflate';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};

const trabajo = mkdtempSync(join(tmpdir(), 'kkprueba-actualizar-'));
const copia = join(trabajo, 'kotonoha');
const perfil = join(trabajo, 'perfil');
cpSync(DIST, copia, { recursive: true });
const manifiestoAntes = JSON.parse(readFileSync(join(copia, 'manifest.json'), 'utf8'));

// La «versión publicada»: la misma compilación con otro número y sin clave, como sale el paquete de verdad.
const archivos = {};
const listar = (c) => readdirSync(c, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? listar(join(c, e.name)) : [join(c, e.name)]));
for (const ruta of listar(DIST)) {
  const r = relative(DIST, ruta).replaceAll('\\', '/');
  let datos = readFileSync(ruta);
  if (r === 'manifest.json') {
    const { key: _clave, ...m } = JSON.parse(datos.toString('utf8'));
    datos = Buffer.from(JSON.stringify({ ...m, version: '9.9.9' }, null, 2));
  }
  if (r === 'compilacion.txt') datos = Buffer.from('9.9.9 prueba de actualizar');
  archivos[`kotonoha/${r}`] = [new Uint8Array(datos), { level: 1 }];
}
const paquete = Buffer.from(zipSync(archivos));
const suma = createHash('sha256').update(paquete).digest('hex');
let descargas = 0;
const versiones = createServer((peticion, respuesta) => {
  const d = { '/v9.9.9/kotonoha-9.9.9-extension.zip': paquete, '/v9.9.9/SHA256SUMS.txt': Buffer.from(`${suma}  kotonoha-9.9.9-extension.zip\n`) }[peticion.url];
  if (peticion.url.endsWith('.zip')) descargas++;
  respuesta.writeHead(d ? 200 : 404, { 'Content-Length': d?.length ?? 0 });
  respuesta.end(d ?? '');
});
await new Promise((ok) => versiones.listen(0, '127.0.0.1', ok));
console.log(`   paquete de prueba: ${(paquete.length / 1e6).toFixed(1)} MB`);

const contexto = await chromium.launchPersistentContext(perfil, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1280, height: 900 },
  args: [`--disable-extensions-except=${copia}`, `--load-extension=${copia}`],
  env: { ...process.env, KOTONOHA_URL_VERSIONES: `http://127.0.0.1:${versiones.address().port}`, KOTONOHA_CARPETA_EXTENSION: copia },
});
await contexto.route('https://api.github.com/repos/Eliam4510/kotonoha/releases/latest', (r) =>
  r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ tag_name: 'v9.9.9', name: 'Kotonoha 9.9.9 · Prueba de actualizar', html_url: 'https://github.com/Eliam4510/kotonoha/releases/tag/v9.9.9' }) })
);
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
await sw.evaluate(async () => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), idiomaInterfaz: 'es', bienvenidaVista: true, idiomaObjetivo: 'ja', avisarVersiones: true }, marcaDePrueba: 'sigue aquí' });
});
comprobar((await sw.evaluate(() => chrome.runtime.getManifest().version)) === manifiestoAntes.version, 'Arranca en la versión compilada', manifiestoAntes.version);

const p = await contexto.newPage();
await p.goto(`chrome-extension://${id}/app.html#/inicio`);
const aviso = p.locator('.ap-aviso-version');
await aviso.waitFor({ timeout: 10000 }).catch(() => {});
const boton = aviso.getByRole('button', { name: 'Actualizar ahora' });
await boton.waitFor({ timeout: 15000 }).catch(() => {});
comprobar(await boton.isVisible().catch(() => false), 'Con el ayudante instalado, el aviso ofrece «Actualizar ahora»');
comprobar((await aviso.innerText().catch(() => '')).includes('comprueba su SHA-256'), 'Y explica qué hará');
await p.screenshot({ path: join(RAIZ, 'capturas-e2e', 'actualizar-aviso.png') }).catch(() => {});

await boton.click().catch(() => {});
// El service worker de MV3 también arranca por otras causas: se espera a que la carpeta cambie y a que arranque uno
// que ya sea la 9.9.9, no a cualquier arranque.
// compilacion.txt es lo último que escribe el ayudante: con él cambiado, la carpeta ya está entera.
const compilacion = () => {
  try {
    return readFileSync(join(copia, 'compilacion.txt'), 'utf8');
  } catch {
    return '';
  }
};
const limite = Date.now() + 90000;
while (compilacion() !== '9.9.9 prueba de actualizar' && Date.now() < limite) await new Promise((r) => setTimeout(r, 250));
const textoTras = await aviso.innerText().catch(() => '(la página ya se cerró)');
comprobar(descargas === 1, 'Baja el paquete una vez', descargas);
const manifiesto = JSON.parse(readFileSync(join(copia, 'manifest.json'), 'utf8'));
comprobar(manifiesto.version === '9.9.9', 'La carpeta queda en la 9.9.9', `${manifiesto.version}; ${textoTras.replace(/\s+/g, ' ').slice(0, 160)}`);
comprobar(manifiesto.key === manifiestoAntes.key, 'Conserva la clave de la copia');
comprobar(readFileSync(join(copia, 'compilacion.txt'), 'utf8') === '9.9.9 prueba de actualizar', 'compilacion.txt es el de la versión nueva');

let trabajador = null;
for (let i = 0; i < 240 && !trabajador; i++) {
  for (const w of contexto.serviceWorkers()) {
    if ((await w.evaluate(() => chrome.runtime.getManifest().version).catch(() => '')) === '9.9.9') trabajador = w;
  }
  if (!trabajador) await new Promise((r) => setTimeout(r, 250));
}
comprobar(!!trabajador, 'La extensión se recarga sola y arranca en la 9.9.9');
if (trabajador) {
  comprobar(new URL(trabajador.url()).host === id, 'Con el mismo identificador');
  comprobar((await trabajador.evaluate(() => chrome.storage.local.get('marcaDePrueba').then((d) => d.marcaDePrueba)).catch(() => null)) === 'sigue aquí', 'Y con sus datos');
}

await contexto.close();
versiones.close();
// Lo que tarda el navegador en soltar el perfil.
for (let i = 0; i < 10; i++) {
  try {
    rmSync(trabajo, { recursive: true, force: true });
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 500));
  }
}
console.log(`\n${fallos ? `${fallos} comprobaciones fallaron` : 'Todas las comprobaciones pasaron'}`);
process.exit(fallos ? 1 : 0);

