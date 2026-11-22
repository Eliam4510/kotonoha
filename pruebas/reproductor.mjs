// Prueba el reproductor de archivos (0.47.0): sus controles propios (Espacio, F, M, < >), la línea de cada momento al
// pasar por la barra, la pantalla completa con los subtítulos por encima de los controles, la lista en orden natural con
// los subtítulos repartidos por idioma, seguir donde se dejó, «Seguir viendo», abrir con un clic lo que tiene acceso
// guardado, una carpeta entera y un audio. Hace sus videos y su audio con ffmpeg, así que no depende de nada descargado.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/reproductor.mjs

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { olvidarReproductor, recargarExtension } from './extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-reproductor'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'reproductor');
const MEDIOS = join(CAPTURAS, 'medios');
mkdirSync(MEDIOS, { recursive: true });

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};

// ---------- Los medios ----------

const LINEAS = [
  [2, 5, '今日はいい天気ですね。', 'Hoy hace buen tiempo.'],
  [6, 9, '明日は雨が降るでしょう。', 'Mañana lloverá.'],
  [12, 15, '駅まで歩いて行きます。', 'Voy andando a la estación.'],
  [20, 24, '本を読むのが好きです。', 'Me gusta leer libros.'],
  [30, 34, '日本語を勉強しています。', 'Estoy estudiando japonés.'],
];
const hora = (s) => `00:00:${String(Math.floor(s)).padStart(2, '0')}.${String(Math.round((s % 1) * 1000)).padStart(3, '0')}`;
const vtt = (i) => `WEBVTT\n\n${LINEAS.map(([a, b, ...t]) => `${hora(a)} --> ${hora(b)}\n${t[i]}`).join('\n\n')}\n`;
const ffmpeg = (...args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
const video = (nombre, segundos, color) => {
  const ruta = join(MEDIOS, nombre);
  if (!existsSync(ruta)) {
    ffmpeg('-f', 'lavfi', '-i', `testsrc2=size=640x360:rate=25,drawbox=c=${color}@0.4:t=fill`, '-f', 'lavfi', '-i', 'sine=frequency=330:sample_rate=44100', '-t', String(segundos), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-c:a', 'aac', '-shortest', ruta);
  }
  return ruta;
};
const EP2 = video('Ep 2.mp4', 40, 'green');
const EP10 = video('Ep 10.mp4', 16, 'blue');
writeFileSync(join(MEDIOS, 'Ep 2.ja.vtt'), vtt(0));
writeFileSync(join(MEDIOS, 'Ep 2.es.vtt'), vtt(1));
const AUDIO = join(MEDIOS, 'podcast.mp3');
if (!existsSync(AUDIO)) ffmpeg('-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100', '-t', '12', '-c:a', 'libmp3lame', '-b:a', '64k', AUDIO);
// Una carpeta con una temporada: un capítulo con sus subtítulos y otro sin ellos.
const TEMPORADA = join(MEDIOS, 'Temporada 1');
mkdirSync(TEMPORADA, { recursive: true });
for (const n of ['Cap 1.mp4', 'Cap 2.mp4']) if (!existsSync(join(TEMPORADA, n))) cpSync(EP10, join(TEMPORADA, n));
writeFileSync(join(TEMPORADA, 'Cap 1.ja.vtt'), vtt(0));

// ---------- El navegador ----------

if (!existsSync(PERFIL) && existsSync(join(RAIZ, '.perfil-base', 'Default/IndexedDB'))) {
  cpSync(join(RAIZ, '.perfil-base', 'Default/IndexedDB'), join(PERFIL, 'Default/IndexedDB'), { recursive: true });
}
const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1440, height: 900 },
  args: ['--mute-audio', `--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--autoplay-policy=no-user-gesture-required'],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
await sw.evaluate(async () => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), idiomaInterfaz: 'es', idiomaObjetivo: 'ja', idiomaSecundario: 'es', bienvenidaVista: true, tema: 'oscuro', avisarVersiones: false, navegadorAbierto: false, activo: true } });
});
const p = await contexto.newPage();
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));
const REPRODUCTOR = `chrome-extension://${id}/app.html#/reproductor`;
await p.goto(`chrome-extension://${id}/app.html#/inicio`);
// Se empieza de cero: los archivos de una pasada anterior, y lo que recuerda el reproductor, con su velocidad y su
// volumen. Borrar su base no sirve: con la página abierta, el borrado queda bloqueado y la pasada anterior sigue ahí.
await p.evaluate(async () => {
  const raiz = await navigator.storage.getDirectory();
  await raiz.removeEntry('Guardado.mp4').catch(() => {});
});
await olvidarReproductor(p);
await p.goto(REPRODUCTOR);
await p.waitForTimeout(1200);

const v = () => p.evaluate(() => {
  const x = document.querySelector('.ap-local video');
  return { t: x.currentTime, pausado: x.paused, velocidad: x.playbackRate, volumen: x.volume, controles: x.controls, duracion: x.duration, src: !!x.src };
});
const esperar = (f, arg, ms = 15000) => p.waitForFunction(f, arg, { timeout: ms, polling: 100 }).then(() => true, () => false);

// ---------- Vacío ----------

comprobar(await p.getByRole('button', { name: 'Abrir una carpeta' }).isVisible(), 'Sin archivo, se puede elegir una carpeta entera');
comprobar((await p.locator('.ap-local-formatos').innerText()).includes('MP3'), 'Y dice que también lee audio');

// ---------- Una lista: dos videos, sus subtítulos en dos idiomas y un audio ----------

await p.setInputFiles('input[type="file"]', [EP10, join(MEDIOS, 'Ep 2.es.vtt'), AUDIO, EP2, join(MEDIOS, 'Ep 2.ja.vtt')]);
const cargado = await esperar(() => document.querySelector('.ap-local video')?.readyState >= 2);
comprobar(cargado, 'Abre el primer video de la lista');
const nombres = await p.locator('.ap-rep-elemento b').allInnerTexts();
comprobar(nombres.join(' | ') === 'Ep 2 | Ep 10 | podcast', 'La lista sale sola, en orden natural: «Ep 2» antes que «Ep 10»', nombres.join(' | '));
comprobar(!(await v()).controles, 'Sin los controles del navegador: van los de Kotonoha');
comprobar((await p.locator('.ap-rep-elemento.actual b').innerText()) === 'Ep 2', 'Empieza por el primero');
comprobar((await p.locator('.ap-rep-elemento.actual .ap-rep-con-subs').innerText()).includes('2'), 'Casa con «Ep 2» sus dos archivos de subtítulos');
// Los botones de saltar de línea solo salen con las líneas ya analizadas.
const conLineas = await esperar(() => !!document.querySelector('.ap-rep-controles [aria-label="Subtítulo siguiente"]'), undefined, 30000);
comprobar(conLineas, 'Con subtítulos, la barra ofrece saltar de línea');

// La línea del momento: el japonés como principal y el español, por su nombre, como traducción.
await p.evaluate(() => {
  const x = document.querySelector('.ap-local video');
  x.pause();
  x.currentTime = 13;
});
await esperar(() => !!document.querySelector('.linea-sub'), undefined, 8000);
await p.waitForTimeout(400);
// El furigana va en <rt> dentro del texto: se quita para leer la frase.
const textos = await p.evaluate(() => {
  const sinRuby = (el) => {
    if (!el) return '';
    const c = el.cloneNode(true);
    for (const x of c.querySelectorAll('rt, .glosa')) x.remove();
    return c.textContent ?? '';
  };
  return { principal: sinRuby(document.querySelector('.linea-sub .linea-texto')), todo: sinRuby(document.querySelector('.subs-contenido')) };
});
comprobar(textos.principal.replace(/\s/g, '').includes('駅まで歩いて行きます'), 'Los subtítulos en japonés son los principales', textos.principal);
comprobar(textos.todo.includes('Voy andando a la estación.'), 'Y los que dicen «.es» en el nombre, la traducción', textos.todo.slice(0, 80));

// ---------- Teclas ----------

// Si algo falla, los eventos del video desde aquí dicen qué pasó y cuándo.
const foco = await p.evaluate(() => {
  document.activeElement?.blur?.();
  const x = document.querySelector('.ap-local video');
  const t0 = performance.now();
  window.__eventos = [];
  for (const tipo of ['play', 'playing', 'pause', 'seeking', 'seeked', 'waiting']) x.addEventListener(tipo, () => window.__eventos.push(`${tipo}@${Math.round(performance.now() - t0)}`));
  window.addEventListener('keydown', (e) => window.__eventos.push(`tecla ${JSON.stringify(e.key)}${e.defaultPrevented ? ' ya atendida' : ''}@${Math.round(performance.now() - t0)}`), true);
  return `${document.activeElement?.tagName}.${document.activeElement?.className}`;
});
await p.keyboard.press(' ');
await p.waitForTimeout(300);
const eventos = async () => (await p.evaluate(() => window.__eventos)).join(' ');
comprobar(!(await v()).pausado, 'Espacio reproduce', `foco en ${foco}; ${await eventos()}`);
await p.keyboard.press(' ');
await p.waitForTimeout(300);
comprobar((await v()).pausado, 'Y pausa', await eventos());
await p.keyboard.press('>');
await p.waitForTimeout(200);
comprobar((await v()).velocidad === 1.1, '> sube la velocidad un paso', (await v()).velocidad);
comprobar((await p.locator('.ap-rep-boton.texto').innerText()).includes('1,1'), 'Y el botón la dice', await p.locator('.ap-rep-boton.texto').innerText());
await p.keyboard.press('<');
await p.keyboard.press('<');
await p.waitForTimeout(200);
comprobar((await v()).velocidad === 0.9, '< la baja', (await v()).velocidad);
await p.keyboard.press('m');
await p.waitForTimeout(200);
comprobar((await v()).volumen === 0, 'M silencia (baja a cero, también con otra pista de audio)');
await p.keyboard.press('m');
await p.waitForTimeout(200);
comprobar((await v()).volumen === 1, 'Y M devuelve el volumen de antes', (await v()).volumen);

// El menú de la velocidad.
await p.locator('.ap-rep-boton.texto').click();
await p.locator('.ap-rep-menu').waitFor({ timeout: 3000 });
await p.locator('.ap-rep-menu button', { hasText: 'Normal' }).click();
comprobar((await v()).velocidad === 1 && !(await p.locator('.ap-rep-menu').isVisible()), 'El menú de velocidad vuelve a Normal y se cierra');

// ---------- La barra: la línea de cada momento ----------

const barra = await p.locator('.ap-rep-barra').boundingBox();
const duracion = (await v()).duracion;
await p.mouse.move(barra.x + barra.width * (21.5 / duracion), barra.y + barra.height / 2);
await p.waitForTimeout(300);
const vista = await p.locator('.ap-rep-vista').innerText().catch(() => '');
comprobar(vista.includes('本を読むのが好きです') && vista.includes('0:21'), 'Al pasar por la barra se ve la línea de ese momento y su tiempo', vista.replace(/\s+/g, ' '));
await p.mouse.click(barra.x + barra.width * (31 / duracion), barra.y + barra.height / 2);
await p.waitForTimeout(400);
const tras = (await v()).t;
comprobar(Math.abs(tras - 31) < 1.2, 'Y un clic salta ahí', tras.toFixed(1));

// Saltar de línea con sus botones.
await p.evaluate(() => (document.querySelector('.ap-local video').currentTime = 7));
await p.waitForTimeout(300);
await p.getByRole('button', { name: 'Subtítulo siguiente' }).click();
await p.waitForTimeout(500);
const siguiente = (await v()).t;
comprobar(Math.abs(siguiente - 12) < 0.6, '«Subtítulo siguiente» va al principio de la siguiente línea', siguiente.toFixed(2));

// ---------- Pantalla completa ----------

await p.mouse.move(700, 400);
await p.keyboard.press('f');
const lleno = await esperar(() => document.fullscreenElement?.classList.contains('ap-local'), undefined, 4000);
comprobar(lleno, 'F pone en pantalla completa el reproductor entero, no solo el video');
await p.evaluate(() => (document.querySelector('.ap-local video').currentTime = 13));
await p.mouse.move(720, 420);
await p.waitForTimeout(900);
const sitio = await p.evaluate(() => {
  const b = document.querySelector('.subs-bloque')?.getBoundingClientRect();
  const k = document.querySelector('.ap-rep-controles')?.getBoundingClientRect();
  return b && k ? { subs: Math.round(b.bottom), controles: Math.round(k.top), visibles: document.querySelectorAll('.linea-sub').length } : null;
});
comprobar(!!sitio && sitio.visibles > 0 && sitio.subs <= sitio.controles + 1, 'En pantalla completa los subtítulos siguen ahí, por encima de los controles', JSON.stringify(sitio));
await p.screenshot({ path: join(CAPTURAS, '1-pantalla-completa.png') });
await p.keyboard.press('f');
const vuelta = await esperar(() => !document.fullscreenElement, undefined, 4000);
comprobar(vuelta, 'Y F la quita');

// ---------- Seguir donde se dejó ----------

await p.evaluate(() => {
  const x = document.querySelector('.ap-local video');
  x.currentTime = 22;
  x.play();
});
await p.waitForTimeout(1500);
await p.getByRole('button', { name: 'Archivo siguiente' }).click();
await esperar(() => document.querySelector('.ap-rep-elemento.actual b')?.textContent === 'Ep 10');
comprobar((await p.locator('.ap-rep-elemento.actual b').innerText()) === 'Ep 10', '«Archivo siguiente» pasa al siguiente de la lista');
await p.locator('.ap-rep-elemento-abrir', { hasText: 'Ep 2' }).click();
await esperar(() => document.querySelector('.ap-rep-elemento.actual b')?.textContent === 'Ep 2');
await esperar(() => document.querySelector('.ap-local video')?.currentTime > 15, undefined, 8000);
const vuelto = (await v()).t;
const avisos = await p.locator('.aviso').allInnerTexts();
comprobar(vuelto > 18 && vuelto < 24, 'Al volver a un video, sigue unos segundos antes de donde se dejó', vuelto.toFixed(1));
comprobar(avisos.some((a) => a.includes('Sigues donde lo dejaste') && a.includes('Desde el principio')), 'Y lo dice, con «Desde el principio»', avisos.join(' | '));

// ---------- Fin de un archivo: el siguiente ----------

await p.evaluate(() => {
  const x = document.querySelector('.ap-local video');
  x.currentTime = x.duration - 1;
  x.play();
});
const siguio = await esperar(() => document.querySelector('.ap-rep-elemento.actual b')?.textContent === 'Ep 10', undefined, 10000);
comprobar(siguio, 'Al terminar uno empieza el siguiente');
comprobar(await p.locator('.ap-rep-elemento', { hasText: 'Ep 2' }).evaluate((el) => el.classList.contains('terminado')), 'Y el terminado queda como visto en la lista');

// ---------- Un audio ----------

await p.locator('.ap-rep-elemento-abrir', { hasText: 'podcast' }).click();
const conPortada = await esperar(() => document.querySelector('.ap-rep-portada b')?.textContent === 'podcast', undefined, 8000);
comprobar(conPortada, 'Un audio suena con su portada');
comprobar(await p.getByRole('button', { name: 'Generar los subtítulos' }).isVisible(), 'Y, sin subtítulos, ofrece generarlos');

// ---------- Seguir viendo, y abrir con un clic lo que tiene acceso ----------

// Un archivo con acceso guardado, como los que llegan por el selector del sistema o al soltarlos: aquí, en el sistema de
// archivos privado del navegador, que da el mismo tipo de acceso. Es «Ep 2» (40 s), dejado en el segundo 20.
await p.evaluate(async (base64) => {
  const datos = new Blob([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], { type: 'video/mp4' });
  const raiz = await navigator.storage.getDirectory();
  const asa = await raiz.getFileHandle('Guardado.mp4', { create: true });
  const w = await asa.createWritable();
  await w.write(datos);
  await w.close();
  const f = await asa.getFile();
  const db = await new Promise((ok, mal) => {
    const r = indexedDB.open('kotonoha-reproductor', 1);
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
  await new Promise((ok, mal) => {
    const tx = db.transaction('vistos', 'readwrite');
    tx.objectStore('vistos').put({ clave: `${f.name}|${f.size}`, nombre: f.name, tamano: f.size, tipo: 'video', duracion: 40, posicion: 20, terminado: false, actualizado: Date.now() + 60000, asa });
    tx.oncomplete = () => ok();
    tx.onerror = () => mal(tx.error);
  });
  db.close();
}, readFileSync(EP2).toString('base64'));
await p.goto(`chrome-extension://${id}/app.html#/inicio`);
await p.waitForTimeout(800);
await p.goto(REPRODUCTOR);
await p.locator('.ap-rep-reciente').first().waitFor({ timeout: 8000 });
const recientes = await p.locator('.ap-rep-reciente b').allInnerTexts();
comprobar(recientes[0] === 'Guardado' && recientes.includes('Ep 2') && recientes.includes('podcast'), '«Seguir viendo» enseña lo último, lo más reciente primero', recientes.join(' | '));
const ep2 = await p.locator('.ap-rep-reciente', { hasText: 'Ep 2' }).innerText();
comprobar(ep2.includes('Visto'), 'Con lo ya terminado como visto', ep2.replace(/\s+/g, ' '));
comprobar((await p.locator('.ap-rep-reciente', { hasText: 'Guardado' }).locator('.ap-rep-sin-acceso').count()) === 0, 'Lo que tiene acceso guardado no pide elegirlo otra vez');
comprobar((await p.locator('.ap-rep-reciente', { hasText: 'Ep 10' }).locator('.ap-rep-sin-acceso').count()) === 1, 'Lo que llegó sin acceso lo avisa');
await p.locator('.ap-rep-reciente-abrir', { hasText: 'Guardado' }).click();
const reabierto = await esperar(() => document.querySelector('.ap-rep-titulo')?.textContent === 'Guardado' && document.querySelector('.ap-local video')?.currentTime > 10, undefined, 10000);
const tGuardado = (await v()).t;
comprobar(reabierto && tGuardado > 16.5 && tGuardado < 20, 'Un clic lo abre otra vez y sigue donde se dejó', tGuardado.toFixed(1));

// ---------- Una carpeta ----------

await p.locator('input[type="file"][webkitdirectory]').setInputFiles(TEMPORADA);
const carpeta = await esperar(() => [...document.querySelectorAll('.ap-rep-elemento b')].map((b) => b.textContent).join('|') === 'Cap 1|Cap 2', undefined, 10000);
const enLista = await p.locator('.ap-rep-elemento b').allInnerTexts();
comprobar(carpeta, 'Una carpeta abre su temporada en lugar de la lista anterior', enLista.join(' | '));
comprobar((await p.locator('.ap-rep-elemento.actual b').innerText().catch(() => '')) === 'Cap 1', 'Y empieza por el primer capítulo');
comprobar((await p.locator('.ap-rep-elemento', { hasText: 'Cap 1' }).locator('.ap-rep-con-subs').count()) === 1, 'Con los subtítulos de cada capítulo', `${await p.locator('.ap-rep-elemento', { hasText: 'Cap 2' }).locator('.ap-rep-con-subs').count()} en Cap 2`);
await p.screenshot({ path: join(CAPTURAS, '2-carpeta.png') });

// ---------- Vaciar ----------

await p.getByRole('button', { name: 'Vaciar la lista' }).click();
await p.waitForTimeout(500);
comprobar(await p.getByRole('button', { name: 'Elegir archivos' }).isVisible(), 'Vaciar la lista vuelve al principio');

// En otra pantalla, los atajos de los subtítulos ya no actúan, aunque sigan cargados los del último video.
await p.goto(`chrome-extension://${id}/app.html#/memoria`);
await p.waitForTimeout(1000);
await p.keyboard.press('g');
await p.waitForTimeout(500);
const navegador = await sw.evaluate(async () => (await chrome.storage.local.get('ajustes')).ajustes?.navegadorAbierto);
comprobar(navegador === false, 'Fuera del reproductor, G no abre el navegador de subtítulos', String(navegador));
comprobar(errores.length === 0, 'Sin errores en la página', errores.join(' | '));

// Lo de esta prueba no se queda en el perfil.
await p.evaluate(async () => {
  localStorage.removeItem('kk-reproductor-volumen');
  localStorage.removeItem('kk-reproductor-velocidad');
  const raiz = await navigator.storage.getDirectory();
  await raiz.removeEntry('Guardado.mp4').catch(() => {});
});
await contexto.close();
console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
