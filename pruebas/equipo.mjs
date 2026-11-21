// Prueba «Tu equipo»: el paso nuevo de la bienvenida, «Probar mi equipo» (el OCR de libros lee una página de muestra
// en la GPU, y la primera vez baja su modelo), el aviso de Inicio para quien ya usaba Kotonoha, que lleva a Ajustes, y
// un equipo sin gráfica para la web, fingido en la página, con sus avisos y «Usar Whisper Base». Nada se apaga.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/equipo.mjs

import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
// El perfil se conserva: así el modelo del OCR solo se baja la primera vez.
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-equipo'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'equipo');
mkdirSync(CAPTURAS, { recursive: true });

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};

const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1280, height: 900 },
  args: ['--mute-audio', `--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
for (const pg of contexto.pages()) if (pg.url().includes('app.html')) await pg.close();
const ajustes = (c) =>
  sw.evaluate(async (c) => {
    const d = await chrome.storage.local.get('ajustes');
    await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), ...c } });
  }, c);
const leerAjustes = () => sw.evaluate(async () => (await chrome.storage.local.get('ajustes')).ajustes ?? {});
// Como una instalación nueva: la bienvenida sin ver, nada medido y el aviso sin ver.
await ajustes({ bienvenidaVista: false, avisoEquipoVisto: false, equipoPrueba: null, idiomaInterfaz: 'es', idiomaObjetivo: 'ja', destino: 'memoria', ankiPuerto: 1, whisperModelo: 'auto' });
const errores = [];
const app = await contexto.newPage();
app.on('pageerror', (e) => errores.push(e.message));
await app.goto(`chrome-extension://${id}/app.html#/inicio`);

// ---------- La bienvenida ----------

console.log('\n== El paso «Tu equipo» de la bienvenida ==');
await app.waitForSelector('.ap-bienvenida', { timeout: 15000 });
for (let i = 0; i < 4; i++) await app.locator('.ap-bv-pie .btn.primario').click();
await app.waitForSelector('.ap-bienvenida .ap-equipo-pieza', { timeout: 15000 });
const paso = await app.evaluate(() => ({
  titulo: document.querySelector('.ap-bv-cuerpo h1')?.textContent,
  nivel: document.querySelector('.ap-equipo')?.getAttribute('data-nivel'),
  piezas: [...document.querySelectorAll('.ap-equipo-pieza')].map((p) => p.getAttribute('data-pieza')),
  datos: document.querySelector('.ap-equipo-datos')?.textContent,
}));
console.log('  ', JSON.stringify(paso));
comprobar(paso.titulo === 'Tu equipo', 'Tras los diccionarios, la bienvenida enseña «Tu equipo»');
comprobar(JSON.stringify(paso.piezas) === JSON.stringify(['voz', 'letras', 'ocr-libro', 'ocr-manga', 'practica']), 'Con una tarjeta por cada pieza pesada del japonés', JSON.stringify(paso.piezas));
comprobar(!!paso.datos?.startsWith('Gráfica:'), 'Y lo que el navegador dice del equipo', paso.datos);

// ---------- Probar mi equipo ----------

console.log('\n== Probar mi equipo ==');
const t0 = Date.now();
await app.locator('.ap-equipo-prueba .btn').click();
const leida = await app
  .waitForFunction(() => /Leyó la página|leyó mal/.test(document.querySelector('.ap-equipo-prueba .ayuda')?.textContent ?? ''), null, { timeout: 300000, polling: 250 })
  .then(() => true)
  .catch(() => false);
const prueba = (await leerAjustes()).equipoPrueba;
console.log(`   ${Date.now() - t0} ms en total; medido: ${JSON.stringify(prueba)}`);
comprobar(leida && !!prueba, 'La prueba lee la página de muestra y lo guarda', await app.textContent('.ap-equipo-prueba .ayuda'));
comprobar(prueba?.correcto === true && prueba?.dispositivo === 'webgpu', 'Con la gráfica, y la lee bien', JSON.stringify(prueba));
const tras = await app.evaluate(() => ({
  nivel: document.querySelector('.ap-equipo')?.getAttribute('data-nivel'),
  tiempos: [...document.querySelectorAll('.ap-equipo-tiempo')].map((t) => t.textContent),
  estados: [...document.querySelectorAll('.ap-equipo-pieza')].map((p) => p.querySelector('.ap-equipo-estado')?.className.split(' ').pop()),
}));
console.log('  ', JSON.stringify(tras));
comprobar(tras.tiempos.length === 5, 'Cada pieza dice cuánto tardaría aquí', JSON.stringify(tras.tiempos));
comprobar(tras.nivel === 'potente' && tras.estados.every((e) => e === 'bien'), 'Y en este equipo todo irá bien', `${tras.nivel} ${JSON.stringify(tras.estados)}`);
await app.screenshot({ path: join(CAPTURAS, 'bienvenida.png') });
// Hasta el final: quien pasó por «Tu equipo» no necesita el aviso de Inicio.
while (await app.locator('.ap-bienvenida').count()) {
  await app.locator('.ap-bv-pie .btn.primario').click();
  await app.waitForTimeout(150);
}
const visto = await leerAjustes();
comprobar(visto.bienvenidaVista === true && visto.avisoEquipoVisto === true, 'Al terminar, el aviso de Inicio ya no hace falta');
comprobar((await app.locator('.ap-aviso-equipo').count()) === 0, 'Y en Inicio no sale');

// ---------- Quien ya usaba Kotonoha ----------

console.log('\n== El aviso de Inicio, una vez ==');
await ajustes({ avisoEquipoVisto: false });
await app.reload();
const aviso = await app
  .waitForSelector('.ap-aviso-equipo', { timeout: 15000 })
  .then(() => true)
  .catch(() => false);
comprobar(aviso, 'Quien ya usaba Kotonoha ve un aviso en Inicio');
await app.locator('.ap-aviso-equipo .btn.primario').click();
await app.waitForSelector('#equipo .ap-equipo-pieza', { timeout: 15000 });
// Lo de arriba carga y crece: la sección vuelve a subir arriba, y la subnavegación la marca.
await app.waitForTimeout(2800);
const enAjustes = await app.evaluate(() => {
  const r = document.getElementById('equipo')?.getBoundingClientRect();
  return { url: location.hash, arriba: !!r && r.top >= -2 && r.top < 160, marcada: document.querySelector('.ap-subnav button.activa')?.textContent?.trim() };
});
comprobar(enAjustes.url.includes('ajustes?seccion=equipo') && enAjustes.arriba && enAjustes.marcada === 'Tu equipo', 'Que lleva a «Tu equipo», en Ajustes, arriba y marcada', JSON.stringify(enAjustes));
comprobar((await leerAjustes()).avisoEquipoVisto === true, 'Y no vuelve a salir');
await app.screenshot({ path: join(CAPTURAS, 'ajustes.png') });

// ---------- Un equipo sin gráfica para la web ----------

console.log('\n== Sin gráfica para la web ==');
await ajustes({ equipoPrueba: null });
const sinGpu = await contexto.newPage();
sinGpu.on('pageerror', (e) => errores.push(e.message));
await sinGpu.addInitScript(() => Object.defineProperty(Navigator.prototype, 'gpu', { get: () => undefined, configurable: true }));
await sinGpu.goto(`chrome-extension://${id}/app.html#/ajustes?seccion=equipo`);
await sinGpu.waitForSelector('#equipo .ap-equipo-pieza', { timeout: 15000 });
const basico = await sinGpu.evaluate(() => ({
  nivel: document.querySelector('#equipo .ap-equipo')?.getAttribute('data-nivel'),
  voz: document.querySelector('#equipo .ap-equipo-pieza[data-pieza="voz"] .ap-equipo-estado')?.className,
  libro: document.querySelector('#equipo .ap-equipo-pieza[data-pieza="ocr-libro"] .ap-equipo-estado')?.className,
  consejo: !!document.querySelector('#equipo .ap-equipo-pieza[data-pieza="voz"] .ap-equipo-consejo'),
}));
console.log('  ', JSON.stringify(basico));
comprobar(basico.nivel === 'basico', 'Sin WebGPU, el equipo es básico');
comprobar(!!basico.voz?.includes('muy-lento') && !!basico.libro?.includes('lento') && basico.consejo, 'La voz, muy lenta, con su consejo; el OCR de libros, lento');
await sinGpu.screenshot({ path: join(CAPTURAS, 'basico.png') });
await sinGpu.locator('#equipo .ap-equipo-pieza[data-pieza="voz"] .btn', { hasText: 'Usar Whisper Base' }).click();
await sinGpu.waitForTimeout(500);
comprobar((await leerAjustes()).whisperModelo === 'base', '«Usar Whisper Base» lo cambia, si se pulsa: nada se cambia solo');
await ajustes({ whisperModelo: 'auto' });
await sinGpu.close();

if (errores.length) console.log('\nErrores en la página:', [...new Set(errores)].slice(0, 6));
comprobar(errores.length === 0, 'Sin errores en las páginas');
console.log(`\n${fallos ? `${fallos} comprobaciones fallaron` : 'Todas las comprobaciones pasaron'}`);
await contexto.close();
process.exit(fallos ? 1 : 0);
