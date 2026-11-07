// Prueba del reproductor local con un MKV real: subtítulos incrustados, pista de audio y Whisper.
// Uso: KK_SALIDA=.dist-local node build.mjs && node pruebas/local.mjs [ruta/video.mkv]
// Sin ruta usa capturas-e2e/prueba.mkv, que crea pruebas/medios.mjs. Whisper necesita voz: si ese archivo
// se creó con un tono, avisa de que no oyó nada y las dos comprobaciones de transcripción fallan.

import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { iniciarMock } from './mock-claude.mjs';
import { recargarExtension } from './extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-local'));
const CAPTURAS = resolve(process.env.KK_CAPTURAS ?? join(RAIZ, 'capturas-e2e', 'local'));
const ARCHIVO = resolve(process.argv[2] ?? join(RAIZ, 'capturas-e2e', 'prueba.mkv'));
mkdirSync(CAPTURAS, { recursive: true });

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok  ' : 'FALLO'} ${texto}${extra ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};

if (!existsSync(PERFIL) && existsSync(join(RAIZ, '.perfil-base', 'Default/IndexedDB'))) {
  cpSync(join(RAIZ, '.perfil-base', 'Default/IndexedDB'), join(PERFIL, 'Default/IndexedDB'), { recursive: true });
}

const mock = await iniciarMock();
const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1440, height: 900 },
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
await sw.evaluate(
  async ({ url }) => {
    const d = await chrome.storage.local.get('ajustes');
    await chrome.storage.local.set({
      urlBaseIA: url,
      claveAnthropic: 'clave-de-prueba',
      ajustes: { ...(d.ajustes ?? {}), tema: 'oscuro', navegadorAbierto: false, modo: 'normal', salto: 'no', analisisAutomatico: false, whisperModelo: 'turbo', whisperCorregir: true },
    });
  },
  { url: `http://127.0.0.1:${mock.puerto}` }
);

const p = await contexto.newPage();
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));
p.on('console', (m) => {
  if (m.type() === 'error' && !/Failed to load resource|net::|favicon/.test(m.text())) errores.push(m.text().slice(0, 240));
});
await p.goto(`chrome-extension://${id}/app.html#/reproductor`);
await p.waitForTimeout(1200);
await p.setInputFiles('input[type="file"]', ARCHIVO);

const video = '.ap-local video';
await p.waitForFunction((s) => document.querySelector(s)?.readyState >= 2 || document.querySelector(s)?.error, video, { timeout: 15000 }).catch(() => {});
const v = await p.evaluate((s) => {
  const e = document.querySelector(s);
  return { listo: e.readyState, error: e.error?.message ?? null, duracion: e.duration, ancho: e.videoWidth };
}, video);
comprobar(!v.error && v.listo >= 2, 'El navegador reproduce el MKV', JSON.stringify(v));

await p.waitForSelector('.ap-local-audio select', { timeout: 20000 }).catch(() => {});
const audio = await p.evaluate(() => {
  const s = document.querySelector('.ap-local-audio select');
  return s ? { valor: s.value, opciones: [...s.options].map((o) => o.textContent), mudo: document.querySelector('.ap-local video').muted } : null;
});
comprobar(audio?.opciones.length === 2, 'Muestra las dos pistas de audio', audio?.opciones.join(' | '));
comprobar(audio?.valor === '1', 'Elige por sí solo la pista en japonés', `pista ${audio?.valor}`);
await p.waitForFunction(() => document.querySelector('.ap-local video')?.muted === true, undefined, { timeout: 10000 }).catch(() => {});
comprobar(await p.evaluate(() => document.querySelector('.ap-local video').muted), 'El video queda silenciado y suena la pista extraída');

await p.waitForFunction(() => {
  const v = document.querySelector('.ap-local video');
  return v && v.readyState >= 2;
});
await p.evaluate(() => {
  const v = document.querySelector('.ap-local video');
  v.pause();
  v.currentTime = 2;
});
await p.waitForSelector('.linea-sub.objetivo .pal', { timeout: 20000 }).catch(() => {});
const subtitulo = await p.evaluate(() => document.querySelector('.linea-sub.objetivo')?.textContent);
comprobar(/授業/.test(subtitulo ?? ''), 'Carga los subtítulos incrustados en japonés', subtitulo ?? 'sin línea');
await p.waitForTimeout(400);
await p.screenshot({ path: join(CAPTURAS, 'local-mkv.png') });

// Panel de generación: en un archivo propio no hace falta activar la captura.
const abrirPanel = await p.evaluate(() => {
  const b = document.querySelector('button[aria-label="Generar subtítulos"], button[data-tip^="Generar subtítulos"], button[title="Generar subtítulos"]');
  b?.click();
  return !!b;
});
if (abrirPanel) {
  await p.waitForTimeout(400);
  await p.screenshot({ path: join(CAPTURAS, 'local-panel-generar.png') });
  const boton = await p.evaluateHandle(() => [...document.querySelectorAll('.panel-flotante button')].find((b) => /whisper|transcrib/i.test(b.textContent) && !b.disabled));
  if (boton.asElement()) {
    await p.evaluate(() => {
      window.__avisos = new Set();
      setInterval(() => document.querySelectorAll('.aviso').forEach((a) => window.__avisos.add(a.textContent)), 200);
    });
    await boton.asElement().click();
    await p.waitForTimeout(2500);
    await p.screenshot({ path: join(CAPTURAS, 'local-whisper-curso.png') });
    await p.waitForFunction(() => {
      const r = document.querySelectorAll('.nav-linea, .linea-sub.objetivo');
      return r.length > 0 && !document.querySelector('[data-whisper-activo]');
    }, undefined, { timeout: 60000 }).catch(() => {});
    await p.waitForTimeout(12000);
    await p.evaluate(() => {
      const v = document.querySelector('.ap-local video');
      v.currentTime = 12;
    });
    await p.waitForTimeout(1500);
    // Whisper y la corrección tardan lo que tardan: se espera a que ocurran, con un límite.
    const hasta = (fn, ms) => new Promise((listo) => {
      const limite = Date.now() + ms;
      const mirar = async () => {
        if (await fn()) return listo(true);
        if (Date.now() > limite) return listo(false);
        setTimeout(mirar, 500);
      };
      mirar();
    });
    const leerLinea = () => p.evaluate(() => document.querySelector('.linea-sub.objetivo')?.textContent);
    await hasta(async () => /休|ペース|一日|1日/.test((await leerLinea()) ?? ''), 420000);
    const linea = await leerLinea();
    comprobar(/休|ペース|一日|1日/.test(linea ?? ''), 'Whisper genera la pista desde el audio del archivo', linea ?? 'sin línea');
    const corregida = await hasta(() => mock.peticiones.some((x) => JSON.stringify(x.cuerpo.system ?? '').includes('Corriges subtítulos')), 60000);
    comprobar(corregida, 'Claude corrige la transcripción');
    if (!corregida) {
      console.log(`Peticiones a Claude: ${mock.peticiones.length}`);
      for (const x of mock.peticiones.slice(0, 8)) console.log(' -', JSON.stringify(x.cuerpo.system ?? '').slice(0, 110));
      console.log('Avisos:', await p.evaluate(() => [...window.__avisos].join(' | ')));
    }
    await p.screenshot({ path: join(CAPTURAS, 'local-whisper-final.png') });
  } else {
    console.log('El panel no tiene aún el botón de Whisper');
  }
} else {
  console.log('No se encontró el botón del panel de generación');
}

if (errores.length) {
  console.log('\nErrores de consola:');
  for (const e of [...new Set(errores)].slice(0, 10)) console.log(' -', e);
}
console.log(`\n${fallos ? `${fallos} comprobaciones fallaron` : 'Todas las comprobaciones pasaron'}`);
await contexto.close();
mock.servidor.close();
process.exit(fallos ? 1 : 0);
