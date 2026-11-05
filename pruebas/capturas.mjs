// Banco de capturas para revisar el diseño: recorre todas las pantallas y estados de la extensión,
// con datos reales de diccionario y una API de Claude simulada.
//
// Uso: node pruebas/capturas.mjs [overlay] [app]
// Variables: KK_DIST (carpeta compilada), KK_PERFIL (perfil del navegador), KK_CAPTURAS (salida),
//            KK_TEMA (claro u oscuro), KK_ANCHO y KK_ALTO (tamaño de ventana).

import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { capturarApp } from './capturas/app.mjs';
import { capturarOverlay } from './capturas/overlay.mjs';
import { iniciarMock } from './mock-claude.mjs';
import { recargarExtension } from './extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, 'dist'));
const CAPTURAS = resolve(process.env.KK_CAPTURAS ?? join(RAIZ, 'capturas-e2e', 'galeria'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-galeria'));
const ANCHO = Number(process.env.KK_ANCHO ?? 1440);
const ALTO = Number(process.env.KK_ALTO ?? 900);
const TEMA = process.env.KK_TEMA ?? 'oscuro';
mkdirSync(CAPTURAS, { recursive: true });

// Cada perfil nuevo parte de los diccionarios de .perfil-base para no volver a descargarlos.
// Esto solo funciona con compilaciones de prueba: KK_SALIDA=.dist-algo node build.mjs
const CARPETA_DICCIONARIOS = 'Default/IndexedDB';
if (!existsSync(PERFIL) && existsSync(join(RAIZ, '.perfil-base', CARPETA_DICCIONARIOS))) {
  cpSync(join(RAIZ, '.perfil-base', CARPETA_DICCIONARIOS), join(PERFIL, CARPETA_DICCIONARIOS), { recursive: true });
}

const pedidas = process.argv.slice(2);
const quiere = (n) => pedidas.length === 0 || pedidas.includes(n);

const mock = await iniciarMock();
const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: ANCHO, height: ALTO },
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
});
const sw = await recargarExtension(contexto);
const idExt = new URL(sw.url()).host;

await sw.evaluate(
  async ({ url, tema }) => {
    const d = await chrome.storage.local.get('ajustes');
    await chrome.storage.local.set({
      urlBaseIA: url,
      claveAnthropic: 'clave-de-prueba',
      ajustes: { ...(d.ajustes ?? {}), tema, navegadorAbierto: false, modo: 'normal', salto: 'no', desanclarBarra: false, subsPosicion: null },
    });
  },
  { url: `http://127.0.0.1:${mock.puerto}`, tema: TEMA }
);

const errores = [];
const ctx = {
  RAIZ,
  CAPTURAS,
  ANCHO,
  ALTO,
  contexto,
  sw,
  idExt,
  mock,
  errores,
  vigilar(p, n) {
    p.on('pageerror', (e) => errores.push(`${n}: ${e.message}`));
    p.on('console', (m) => {
      if (m.type() === 'error' && !/Failed to load resource|net::|favicon/.test(m.text())) errores.push(`${n}: ${m.text().slice(0, 240)}`);
    });
  },
  async foto(p, nombre) {
    await p.waitForTimeout(350);
    await p.screenshot({ path: join(CAPTURAS, `${nombre}.png`) });
    console.log('captura:', nombre);
  },
};

if (quiere('overlay')) await capturarOverlay(ctx);
if (quiere('app')) await capturarApp(ctx);

if (errores.length) {
  console.log('\nErrores de consola:');
  for (const e of [...new Set(errores)].slice(0, 15)) console.log(' -', e);
}
console.log(`\nPeticiones a la API simulada: ${mock.peticiones.length}`);
console.log(`Capturas en ${CAPTURAS}`);
await contexto.close();
mock.servidor.close();
process.exit(0);
