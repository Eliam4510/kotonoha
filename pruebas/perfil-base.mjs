// Crea .perfil-base: un perfil con los diccionarios instalados del que parten las pruebas de diseño.
// Uso: KK_SALIDA=.dist-base node build.mjs && node pruebas/perfil-base.mjs
// Si .perfil-e2e ya tiene diccionarios se reaprovechan; solo se vuelve a instalar la frecuencia.

import { createHash } from 'node:crypto';
import { cpSync, existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = join(RAIZ, '.dist-base');
const PERFIL = join(RAIZ, '.perfil-base');

// El identificador de una extensión con clave son los primeros 16 bytes del SHA-256 de la clave, en letras a-p.
const der = Buffer.from(readFileSync(join(RAIZ, 'pruebas', 'clave-extension-pruebas.txt'), 'utf8').trim(), 'base64');
const idPrueba = [...createHash('sha256').update(der).digest('hex').slice(0, 32)].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');

const origen = join(RAIZ, '.perfil-e2e', 'Default', 'IndexedDB', 'chrome-extension_oalgcmmceedcbncodijboeeojdndioof_0.indexeddb.leveldb');
const destino = join(PERFIL, 'Default', 'IndexedDB', `chrome-extension_${idPrueba}_0.indexeddb.leveldb`);
if (existsSync(origen) && !existsSync(destino)) cpSync(origen, destino, { recursive: true });

const c = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});
let sw = c.serviceWorkers()[0];
if (!sw) sw = await c.waitForEvent('serviceworker');
const id = new URL(sw.url()).host;
console.log('Identificador:', id, id === idPrueba ? '(esperado)' : `(se esperaba ${idPrueba})`);

const p = await c.newPage();
await p.goto(`chrome-extension://${id}/app.html#/inicio`);
await p.waitForTimeout(1500);
const motor = (metodo, ...args) =>
  p.evaluate(({ metodo, args }) => chrome.runtime.sendMessage({ canal: 'motor', metodo, args }), { metodo, args }).then((r) => {
    if (!r?.ok) throw new Error(r?.error ?? 'sin respuesta');
    return r.valor;
  });

const instalados = new Set((await motor('estado')).diccionarios.map((d) => d.id));
for (const d of ['jmdict-es', 'jmdict-en', 'kanjium-acento', 'jpdb-frecuencia']) {
  // La frecuencia se reinstala siempre: las copias antiguas guardaban el rango de la forma en kana.
  if (instalados.has(d) && d !== 'jpdb-frecuencia') continue;
  console.log('Instalando', d, '...');
  await motor('instalarDiccionario', d);
}
const estado = await motor('estado');
console.log(estado.diccionarios.map((d) => `${d.id}: ${d.filas}`).join(', '));
console.log('Términos en memoria:', estado.terminosCargados);
console.log('食べる:', JSON.stringify((await motor('buscar', '食べる', 'たべる')).frecuencias));
await c.close();
process.exit(0);
