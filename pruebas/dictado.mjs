// Prueba el dictado del Portapapeles con un micrófono falso que reproduce una grabación con voz: grabar, ver el tiempo y
// el nivel, transcribir con el modelo de voz guardado en el perfil, leer el párrafo nuevo con su grabación encima,
// volver a oírla, guardarlo en la biblioteca y borrar las grabaciones que ya nadie usa. En japonés, en la ventana de la
// app; en inglés, en la pestaña del Portapapeles. No gasta nada y no descarga nada: el perfil ya tiene los modelos.
// Uso: KK_SALIDA=.dist-whisper node build.mjs && node pruebas/dictado.mjs voz-ja.wav [voz-en.wav]
// Las grabaciones, con una voz del sistema y un segundo de silencio delante; el perfil no se borra, porque guarda los modelos.

import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-whisper'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-whisper'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'dictado');
mkdirSync(CAPTURAS, { recursive: true });
const [vozJa, vozEn] = process.argv.slice(2).map((r) => resolve(r));
if (!vozJa) throw new Error('Falta la grabación en japonés');

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const DIA = 24 * 60 * 60 * 1000;

/** Un WAV de silencio, a 16 kHz y en 16 bits. */
function wavDeSilencio(segundos) {
  const datos = 16000 * 2 * segundos;
  const b = Buffer.alloc(44 + datos);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + datos, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(16000, 24);
  b.writeUInt32LE(32000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(datos, 40);
  return b;
}

/** El navegador, con el micrófono falso. Sin `conPermiso`, nadie contesta a la pregunta del permiso. */
async function abrir(voz, ajustes, conPermiso = true) {
  const contexto = await chromium.launchPersistentContext(PERFIL, {
    channel: process.env.KK_CANAL ?? 'msedge',
    headless: true,
    viewport: { width: 1280, height: 900 },
    args: [
      `--disable-extensions-except=${DIST}`,
      `--load-extension=${DIST}`,
      '--enable-unsafe-webgpu',
      '--enable-gpu',
      '--ignore-gpu-blocklist',
      ...(conPermiso ? ['--use-fake-ui-for-media-stream'] : []),
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${voz}%noloop`,
    ],
  });
  const sw = await recargarExtension(contexto);
  const id = new URL(sw.url()).host;
  await sw.evaluate(async (cambios) => {
    const d = await chrome.storage.local.get('ajustes');
    await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), ...cambios }, lectorTexto: '' });
  }, ajustes);
  return { contexto, id };
}

/** Llama al motor como lo hace la app. */
const llamarMotor = (p, metodo, ...args) =>
  p.evaluate(({ metodo, args }) => chrome.runtime.sendMessage({ canal: 'motor', metodo, args }), { metodo, args }).then((r) => {
    if (!r?.ok) throw new Error(r?.error ?? 'sin respuesta');
    return r.valor;
  });

/** Lo que hay en la base de las grabaciones: id, lengua, cuándo y cuánto ocupa. */
const grabaciones = (p) =>
  p.evaluate(async () => {
    // Abrir una base que no existe la crearía vacía, y la de la extensión debe crearla Dexie.
    if (!(await indexedDB.databases()).some((d) => d.name === 'kotonoha-dictados')) return [];
    const db = await new Promise((ok, mal) => {
      const r = indexedDB.open('kotonoha-dictados');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => mal(r.error);
    });
    const filas = await new Promise((ok) => {
      const r = db.transaction('grabaciones').objectStore('grabaciones').getAll();
      r.onsuccess = () => ok(r.result);
    });
    db.close();
    return filas.map((g) => ({ id: g.id, lengua: g.lengua, creado: g.creado, duracionMs: g.duracionMs, bytes: g.audio.size, tipo: g.audio.type }));
  });

/**
 * Pulsa «Dictar», deja sonar la grabación del micrófono falso y pulsa «Terminar». Devuelve lo visto mientras grababa: el
 * tiempo que marcó y cuántas barras del nivel llegó a encender.
 */
async function dictar(p, segundos, captura) {
  await p.getByRole('button', { name: 'Dictar' }).first().click();
  const grabando = p.locator('.ap-dictado.grabando');
  await grabando.waitFor({ timeout: 15000 });
  let barras = 0;
  const fin = Date.now() + segundos * 1000;
  let capturada = false;
  while (Date.now() < fin) {
    barras = Math.max(barras, await p.locator('.ap-dictado-nivel i.on').count());
    if (!capturada && barras >= 2) {
      await p.screenshot({ path: join(CAPTURAS, captura) });
      capturada = true;
    }
    await dormir(150);
  }
  const tiempo = await p.locator('.ap-dictado-tiempo').innerText();
  await p.locator('.ap-dictado').getByRole('button', { name: 'Terminar' }).click();
  return { barras, tiempo };
}

// ---------- Japonés, en la ventana de la app ----------

{
  const { contexto, id } = await abrir(vozJa, { idiomaInterfaz: 'es', idiomaObjetivo: 'ja', whisperModelo: 'auto', bienvenidaVista: true, tema: 'oscuro' });
  const p = await contexto.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  await p.goto(`chrome-extension://${id}/app.html#/lector`);
  await p.waitForTimeout(1200);
  const antes = await grabaciones(p);

  comprobar(await p.getByRole('button', { name: 'Dictar' }).isVisible(), 'El Portapapeles tiene el botón «Dictar»');
  await p.locator('.ap-hoja-escritura textarea').fill('最初の段落です。');

  const visto = await dictar(p, 11.5, '1-grabando.png');
  comprobar(/^0:1[0-2]$/.test(visto.tiempo), 'Mientras graba, el tiempo avanza', visto.tiempo);
  comprobar(visto.barras >= 3, 'El nivel se enciende con la voz', `${visto.barras} barras`);

  await p.locator('.ap-dictado[role="status"]').waitFor({ timeout: 5000 }).catch(() => {});
  const estado = await p.locator('.ap-dictado').innerText().catch(() => '');
  comprobar(/modelo de voz|Transcribiendo/.test(estado), 'Después dice en qué va', estado.replace(/\s+/g, ' '));
  await p.screenshot({ path: join(CAPTURAS, '2-transcribiendo.png') });

  const inicio = Date.now();
  await p.locator('.ap-papel .ap-grabacion:not(.cargando)').waitFor({ timeout: 180000 });
  await p.waitForTimeout(800);
  const papel = await p.locator('.ap-papel').innerText();
  const palabras = ['天気', '公園', '散歩', '友達', 'ご飯'].filter((w) => papel.includes(w));
  comprobar(palabras.length >= 4, 'El dictado se transcribe en japonés', `${palabras.join(' ')} · ${Math.round((Date.now() - inicio) / 1000)} s`);
  // Sin el furigana ni los signos invisibles que pegan la puntuación a su palabra.
  const leido = await p.locator('.ap-papel').evaluate((el) => {
    const copia = el.cloneNode(true);
    for (const rt of copia.querySelectorAll('rt')) rt.remove();
    return copia.textContent.replace(/\p{Cf}/gu, '');
  });
  const previo = leido.indexOf('最初の段落です。');
  comprobar(previo >= 0 && previo < leido.indexOf('公園'), 'Va al final, después de lo que ya había', leido.slice(0, 40));
  comprobar(!papel.includes('dictado:'), 'La marca no se ve al leer');
  const ficha = await p.locator('.ap-grabacion').innerText();
  comprobar(/0:1\d/.test(ficha) && ficha.includes('Tu grabación'), 'Encima del párrafo está su grabación, con lo que dura', ficha.replace(/\s+/g, ' '));
  comprobar((await p.locator('.ap-papel .pal').count()) > 5, 'El párrafo dictado se puede consultar palabra por palabra');
  comprobar((await p.locator('.ap-papel rt').count()) > 0, 'Y lleva furigana');
  await p.screenshot({ path: join(CAPTURAS, '3-leido.png') });

  // Se vuelve a oír.
  await p.locator('.ap-grabacion button').click();
  await p.waitForTimeout(1600);
  const sonando = await p.locator('.ap-grabacion').getAttribute('class');
  const enMarcha = await p.locator('.ap-grabacion-tiempo').innerText();
  comprobar(sonando.includes('sonando') && /^0:0[1-2] \/ 0:1\d$/.test(enMarcha), 'La grabación se vuelve a oír', enMarcha);
  await p.screenshot({ path: join(CAPTURAS, '4-sonando.png') });
  await p.locator('.ap-grabacion button').click();
  await p.waitForTimeout(300);
  comprobar(!(await p.locator('.ap-grabacion').getAttribute('class')).includes('sonando'), 'Y se pausa');

  const nuevas = (await grabaciones(p)).filter((g) => !antes.some((a) => a.id === g.id));
  comprobar(nuevas.length === 1 && nuevas[0].lengua === 'ja' && nuevas[0].bytes > 10000 && nuevas[0].tipo.startsWith('audio/webm'), 'La grabación queda guardada en Opus', JSON.stringify(nuevas[0] ?? {}));
  comprobar(nuevas[0]?.duracionMs > 11000 && nuevas[0]?.duracionMs < 13500, 'Con lo que duró de verdad', nuevas[0]?.duracionMs);

  // El texto que se edita lleva la marca, en su propia línea.
  await p.getByRole('button', { name: 'Editar el texto' }).click();
  const texto = await p.locator('.ap-hoja-escritura textarea').inputValue();
  const marca = new RegExp(`^<!-- dictado:${nuevas[0]?.id} -->$`, 'm');
  comprobar(marca.test(texto) && texto.startsWith('最初の段落です。\n\n<!-- dictado:'), 'Al editar, la marca va en su propia línea antes del párrafo', texto.split('\n').slice(0, 3).join(' ⏎ '));

  // Cancelar mientras graba no deja nada.
  await p.getByRole('button', { name: 'Dictar' }).click();
  await p.locator('.ap-dictado.grabando').waitFor({ timeout: 15000 });
  await p.waitForTimeout(1000);
  const aLaVista = await p.locator('.ap-hoja-pie button:visible').allInnerTexts();
  comprobar(!aLaVista.some((b) => /Leer|Pegar|Guardar/.test(b)), 'Mientras graba, los demás botones se apartan', aLaVista.join(' · '));
  await p.locator('.ap-dictado').getByRole('button', { name: 'Cancelar' }).click();
  await p.waitForTimeout(500);
  comprobar(await p.getByRole('button', { name: 'Dictar' }).isVisible(), 'Cancelar vuelve al botón «Dictar»');
  comprobar((await p.locator('.ap-hoja-escritura textarea').inputValue()) === texto, 'Y no cambia el texto');

  // Un dictado sin voz: el micrófono falso ya terminó su grabación.
  await p.getByRole('button', { name: 'Dictar' }).click();
  await p.locator('.ap-dictado.grabando').waitFor({ timeout: 15000 });
  await p.waitForTimeout(2500);
  await p.locator('.ap-dictado').getByRole('button', { name: 'Terminar' }).click();
  const aviso = p.locator('.ap-dictado.error');
  const resultado = await Promise.race([
    aviso.waitFor({ timeout: 90000 }).then(() => 'aviso'),
    p.locator('.ap-grabacion:not(.cargando)').nth(1).waitFor({ timeout: 90000 }).then(() => 'segundo'),
  ]).catch(() => 'nada');
  if (resultado === 'aviso') {
    const sinVoz = await aviso.innerText();
    comprobar(sinVoz.includes('No se oyó voz') && (await p.locator('.ap-hoja-escritura textarea').inputValue()) === texto, 'Sin voz, lo dice y no añade nada', sinVoz);
    await p.screenshot({ path: join(CAPTURAS, '5-sin-voz.png') });
    await p.getByRole('button', { name: 'Cerrar el aviso' }).click();
  } else {
    // El micrófono falso vuelve a empezar su grabación con cada captura: entonces sale un segundo dictado.
    comprobar(resultado === 'segundo', 'Un segundo dictado va en otro párrafo, con su grabación', resultado);
  }

  // Guardar en la biblioteca: la marca va con el texto y el título sale de lo que se lee.
  if (!(await p.locator('.ap-hoja-escritura textarea').isVisible().catch(() => false))) await p.getByRole('button', { name: 'Editar el texto' }).click();
  await p.getByRole('button', { name: 'Guardar en la biblioteca' }).click();
  await p.waitForTimeout(1200);
  const guardado = (await llamarMotor(p, 'bibliotecaListar')).find((e) => e.texto.includes(`dictado:${nuevas[0]?.id}`));
  comprobar(!!guardado, 'En la biblioteca, el texto lleva la marca');
  comprobar(guardado?.titulo.startsWith('最初の段落です。'), 'El título sale del texto, sin la marca', guardado?.titulo);

  // Limpieza: se borra lo viejo que nadie usa; lo viejo que usa la biblioteca y lo reciente se quedan.
  const viejo = Date.now() - 8 * DIA;
  await p.evaluate(async ({ viejo }) => {
    const db = await new Promise((ok) => {
      const r = indexedDB.open('kotonoha-dictados');
      r.onsuccess = () => ok(r.result);
    });
    const tx = db.transaction('grabaciones', 'readwrite');
    const audio = new Blob(['x'], { type: 'audio/webm' });
    for (const id of ['viejo-sin-uso', 'viejo-usado']) tx.objectStore('grabaciones').put({ id, audio, duracionMs: 1000, creado: viejo, lengua: 'ja' });
    tx.objectStore('grabaciones').put({ id: 'viejo-ingles', audio, duracionMs: 1000, creado: viejo, lengua: 'en' });
    await new Promise((ok) => (tx.oncomplete = ok));
    db.close();
  }, { viejo });
  await llamarMotor(p, 'bibliotecaGuardar', { id: 'prueba-dictado-viejo', titulo: 'Viejo', texto: '<!-- dictado:viejo-usado -->\n古い。', origen: 'pegado', creado: Date.now() });
  const borradas = await llamarMotor(p, 'limpiarDictados', [texto]);
  const quedan = (await grabaciones(p)).map((g) => g.id);
  comprobar(borradas >= 1 && !quedan.includes('viejo-sin-uso'), 'Lo viejo que nadie usa se borra', borradas);
  comprobar(quedan.includes('viejo-usado') && quedan.includes(nuevas[0]?.id), 'Lo que usa la biblioteca y lo reciente se quedan');
  comprobar(quedan.includes('viejo-ingles'), 'Lo de otra lengua lo mira la limpieza de esa lengua');
  await llamarMotor(p, 'bibliotecaEliminar', 'prueba-dictado-viejo');
  if (guardado) await llamarMotor(p, 'bibliotecaEliminar', guardado.id);

  comprobar(errores.length === 0, 'Sin errores en la página', errores.join(' | '));
  await contexto.close();
}

// ---------- Inglés, en la pestaña del Portapapeles ----------

if (vozEn) {
  const { contexto, id } = await abrir(vozEn, { idiomaInterfaz: 'es', idiomaObjetivo: 'en', whisperModelo: 'auto', bienvenidaVista: true, tema: 'claro' });
  const p = await contexto.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  await p.goto(`chrome-extension://${id}/lector.html`);
  await p.waitForTimeout(1500);
  const antes = await grabaciones(p).catch(() => []);

  const visto = await dictar(p, 10, '6-grabando-ingles.png');
  comprobar(visto.barras >= 3, 'En inglés también se oye el micrófono', `${visto.barras} barras`);
  const inicio = Date.now();
  await p.locator('.ap-papel .ap-grabacion:not(.cargando)').waitFor({ timeout: 180000 });
  await p.waitForTimeout(800);
  const papel = await p.locator('.ap-papel').innerText();
  comprobar(/park/i.test(papel) && /dinner/i.test(papel) && /friends/i.test(papel), 'El dictado se transcribe en inglés', `${Math.round((Date.now() - inicio) / 1000)} s`);
  await p.screenshot({ path: join(CAPTURAS, '7-leido-ingles.png') });

  const guardado = await p.evaluate(() => chrome.storage.local.get('lectorTexto').then((d) => d.lectorTexto));
  const nuevas = (await grabaciones(p)).filter((g) => !antes.some((a) => a.id === g.id));
  comprobar(nuevas.length === 1 && nuevas[0].lengua === 'en', 'La grabación se guarda con su lengua', JSON.stringify(nuevas[0] ?? {}));
  comprobar(guardado?.startsWith(`<!-- dictado:${nuevas[0]?.id} -->\n`), 'En la pestaña, el texto con su marca se conserva al recargar', guardado?.slice(0, 32));
  comprobar(/going for a walk in the park/i.test(guardado ?? ''), 'Con las palabras separadas, también donde la frase se parte', guardado?.split('\n')[1]);
  await p.reload();
  await p.locator('.ap-papel .ap-grabacion:not(.cargando)').waitFor({ timeout: 20000 }).catch(() => {});
  comprobar((await p.locator('.ap-grabacion').count()) === 1, 'Y al recargar sigue su grabación');

  comprobar(errores.length === 0, 'Sin errores en la página', errores.join(' | '));
  await contexto.close();
}

// ---------- Sin voz ----------

{
  const silencio = join(tmpdir(), 'kk-dictado-silencio.wav');
  writeFileSync(silencio, wavDeSilencio(5));
  const { contexto, id } = await abrir(silencio, { idiomaInterfaz: 'es', idiomaObjetivo: 'ja', whisperModelo: 'auto', bienvenidaVista: true, tema: 'oscuro' });
  const p = await contexto.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push(e.message));
  await p.goto(`chrome-extension://${id}/app.html#/lector`);
  await p.waitForTimeout(1200);
  const antes = await grabaciones(p);
  const visto = await dictar(p, 3, '5-grabando-sin-voz.png');
  comprobar(visto.barras === 0, 'Sin voz, el nivel no se enciende', `${visto.barras} barras`);
  const aviso = p.locator('.ap-dictado.error');
  const inicio = Date.now();
  await aviso.waitFor({ timeout: 60000 }).catch(() => {});
  const texto = await aviso.innerText().catch(() => '');
  comprobar(texto.includes('No se oyó voz'), 'Lo dice sin cargar el modelo', `${texto} · ${((Date.now() - inicio) / 1000).toFixed(1)} s`);
  comprobar((await p.locator('.ap-hoja-escritura textarea').inputValue()) === '', 'Y no añade nada al texto');
  comprobar((await grabaciones(p)).length === antes.length, 'Ni guarda la grabación');
  await p.screenshot({ path: join(CAPTURAS, '5-sin-voz.png') });
  await p.getByRole('button', { name: 'Cerrar el aviso' }).click();
  comprobar(await p.getByRole('button', { name: 'Dictar' }).isVisible(), 'Al cerrar el aviso vuelve el botón «Dictar»');
  comprobar(errores.length === 0, 'Sin errores en la página', errores.join(' | '));
  await contexto.close();
}

// ---------- Sin permiso ----------

{
  const { contexto, id } = await abrir(vozJa, { idiomaInterfaz: 'es', idiomaObjetivo: 'ja', bienvenidaVista: true, tema: 'oscuro' }, false);
  const p = await contexto.newPage();
  await p.goto(`chrome-extension://${id}/app.html#/lector`);
  await p.waitForTimeout(1200);
  await p.getByRole('button', { name: 'Dictar' }).click();
  const aviso = p.locator('.ap-dictado.error');
  const pidiendo = await p.locator('.ap-dictado[role="status"]').isVisible().catch(() => false);
  await aviso.waitFor({ timeout: 20000 }).catch(() => {});
  const texto = await aviso.innerText().catch(() => '');
  if (texto) {
    comprobar(texto.includes('no deja usar el micrófono'), 'Sin permiso, dice cómo darlo', texto);
    comprobar(await aviso.getByRole('button', { name: 'Abrir los permisos' }).isVisible(), 'Con un botón a los permisos de Kotonoha');
    await p.screenshot({ path: join(CAPTURAS, '8-sin-permiso.png') });
  } else {
    // Sin ventana que conteste, la pregunta se queda abierta: se ve que espera, y se puede cancelar.
    comprobar(pidiendo || (await p.locator('.ap-dictado[role="status"]').isVisible()), 'Mientras pregunta, dice que espera el permiso');
    await p.locator('.ap-dictado').getByRole('button', { name: 'Cancelar' }).click();
    comprobar(await p.getByRole('button', { name: 'Dictar' }).isVisible(), 'Y se puede cancelar');
  }
  await contexto.close();
}

console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
