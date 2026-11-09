// Prueba la práctica del acento tonal con un micrófono falso que lee una frase con una voz del sistema: abrir la práctica
// desde la barra de la Ayuda de lectura, ver el acento esperado de cada palabra, grabar, y ver la curva del tono sobre la
// esperada con un veredicto por palabra. Después, que la práctica sigue a la frase en curso, que consultar una palabra la
// cierra y que en inglés no aparece. No gasta nada y no descarga nada: el perfil ya tiene el modelo de voz. El perfil no
// tiene el diccionario de acento: la prueba pone el de las palabras de la frase y lo quita al acabar.
// Uso: KK_SALIDA=.dist-whisper node build.mjs && node pruebas/practica.mjs voz.wav [--imagenes]
// La grabación dice «箸を使います。», con una voz del sistema y un segundo de silencio delante; no se publica.
// Con --imagenes, el diccionario de acento cuenta como instalado (sin el aviso de que falta) y, con el resultado a la
// vista, guarda la imagen del README en cada idioma de la interfaz que presenta el japonés: docs/img/practica[.id].png.

import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { recargarExtension } from './extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-whisper'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-whisper'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'practica');
mkdirSync(CAPTURAS, { recursive: true });
const [voz] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!voz) throw new Error('Falta la grabación');
const IMAGENES = process.argv.includes('--imagenes');
/** Los idiomas de la interfaz cuyo README presenta el japonés: el japonés presenta el inglés y el alemán. */
const IDIOMAS_README = ['es', 'en', 'de', 'zh', 'ko'];
const FRASE = '箸を使います。';
const SEGUNDA = '橋を渡ります。';
/** El acento de las palabras de las dos frases, como lo da el diccionario. */
const ACENTOS = [
  ['箸', 'はし', [1]],
  ['橋', 'はし', [2]],
];

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1360, height: 900 },
  args: [
    `--disable-extensions-except=${DIST}`,
    `--load-extension=${DIST}`,
    '--enable-unsafe-webgpu',
    '--enable-gpu',
    '--ignore-gpu-blocklist',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${resolve(voz)}%noloop`,
  ],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
const ajustar = (cambios) =>
  sw.evaluate(async (cambios) => {
    const d = await chrome.storage.local.get('ajustes');
    await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), ...cambios } });
  }, cambios);
await ajustar({ idiomaInterfaz: 'es', idiomaObjetivo: 'ja', whisperModelo: 'auto', bienvenidaVista: true, tema: 'oscuro', avisarVersiones: false, practicaMoras: false });

const p = await contexto.newPage();
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));
await p.goto(`chrome-extension://${id}/app.html#/inicio`);

/**
 * Pone o quita filas en la tabla de acentos del motor, la misma que llena el diccionario. Con `instalado`, también la ficha
 * del diccionario de acento, como si se hubiera instalado.
 */
const tablaAcentos = (borrar, instalado = false) =>
  p.evaluate(
    async ({ filas, borrar, instalado }) => {
      const db = await new Promise((ok, mal) => {
        const r = indexedDB.open('kikitori');
        r.onsuccess = () => ok(r.result);
        r.onerror = () => mal(r.error);
      });
      await new Promise((ok, mal) => {
        const tx = db.transaction(['acentos', 'diccionarios'], 'readwrite');
        for (const [termino, lectura, posiciones] of filas) {
          if (borrar) tx.objectStore('acentos').delete([termino, lectura]);
          else tx.objectStore('acentos').put({ termino, lectura, posiciones });
        }
        const ficha = { id: 'kanjium-acento', titulo: 'Acento tonal (Kanjium)', tipo: 'acento', orden: 99, filas: filas.length, fuente: 'prueba', instalado: Date.now() };
        if (borrar) tx.objectStore('diccionarios').delete(ficha.id);
        else if (instalado) tx.objectStore('diccionarios').put(ficha);
        tx.oncomplete = () => ok();
        tx.onerror = () => mal(tx.error);
      });
      db.close();
    },
    { filas: ACENTOS, borrar, instalado }
  );
await p.waitForTimeout(1500);
// Este perfil no tiene el diccionario de acento: si ya lo tuviera, la prueba no podría quitar lo que pone.
const yaInstalado = await p.evaluate(async () => {
  const r = await chrome.runtime.sendMessage({ canal: 'motor', metodo: 'estado', args: [] });
  return r.valor.diccionarios.some((d) => d.tipo === 'acento');
});
if (yaInstalado) throw new Error('El perfil ya tiene un diccionario de acento: la prueba espera uno sin él');
await tablaAcentos(false, IMAGENES);

// El Cuaderno añade lo que llega al final de lo que ya hay: se empieza vacío.
await sw.evaluate(() => chrome.storage.local.remove(['lectorTexto', 'notaCuaderno']));
await p.goto(`chrome-extension://${id}/app.html#/lector?t=${encodeURIComponent(FRASE + SEGUNDA)}`);
await p.locator('.ap-papel .pal').first().waitFor({ timeout: 30000 });
await p.waitForTimeout(600);

// ---------- Antes de grabar ----------

const practicar = p.locator('.ap-dock').getByRole('button', { name: 'Practicar' });
comprobar(await practicar.isVisible(), 'La barra de lectura tiene el botón «Practicar»');
await practicar.click();
const panel = p.locator('.ap-practica');
await panel.waitFor({ timeout: 5000 });
comprobar((await p.locator('.ap-practica-frase-texto').innerText()) === FRASE, 'Practica la primera frase', await p.locator('.ap-practica-frase-texto').innerText());
comprobar((await p.locator('.ap-papel .oracion-activa').innerText()).replace(/\s/g, '').includes('使'), 'Y la marca en el texto');
const palabras = await p.locator('.ap-practica-palabra').evaluateAll((els) =>
  els.map((el) => ({ moras: [...el.querySelectorAll('.ap-practica-moras span')].map((s) => s.textContent).join(''), puntos: el.querySelectorAll('circle').length }))
);
comprobar(
  palabras.map((w) => `${w.moras}·${w.puntos}`).join(' ') === 'はしを·3 つかいます·5',
  'Enseña el acento esperado de cada palabra, mora a mora',
  palabras.map((w) => `${w.moras}·${w.puntos}`).join(' ')
);
const aviso = p.locator('.ap-practica-aviso');
if (IMAGENES) {
  await p.waitForTimeout(1500);
  comprobar(!(await aviso.isVisible()), 'Con el diccionario de acento instalado, no avisa de nada');
} else {
  await aviso.waitFor({ timeout: 3000 }).catch(() => {});
  comprobar((await aviso.innerText().catch(() => '')).includes('Acento tonal (Kanjium)'), 'Sin el diccionario de acento instalado, dice cuál instalar');
  comprobar(await aviso.getByRole('button', { name: 'Abrir Ajustes' }).isVisible(), 'Con un botón a los Ajustes');
}
comprobar(await panel.getByRole('button', { name: 'Oír la frase' }).isVisible(), 'Se puede oír la frase');
await p.screenshot({ path: join(CAPTURAS, '1-antes.png') });

// ---------- Grabar ----------

await panel.getByRole('button', { name: 'Grabar' }).click();
await panel.locator('.ap-dictado.grabando').waitFor({ timeout: 15000 });
let barras = 0;
for (const fin = Date.now() + 4600; Date.now() < fin; ) {
  barras = Math.max(barras, await panel.locator('.ap-dictado-nivel i.on').count());
  await dormir(150);
}
comprobar(barras >= 2, 'Mientras graba, el nivel se enciende con la voz', `${barras} barras`);
await panel.getByRole('button', { name: 'Terminar' }).click();
const inicio = Date.now();
const resultado = p.locator('.ap-practica-resultado');
const fallo = p.locator('.ap-practica .ap-dictado.error');
await Promise.race([resultado.waitFor({ timeout: 180000 }), fallo.waitFor({ timeout: 180000 })]).catch(() => {});
const error = await fallo.innerText().catch(() => '');
comprobar(await resultado.isVisible(), 'Analiza la grabación', error || `${Math.round((Date.now() - inicio) / 1000)} s`);

if (await resultado.isVisible()) {
  const curvas = await p.locator('.ap-practica-grafica polyline.tuya').count();
  const esperadas = await p.locator('.ap-practica-grafica polyline.esperado').count();
  comprobar(curvas >= 1 && esperadas === 2, 'La gráfica pone la curva de la voz sobre el acento esperado', `${curvas} trozos de voz, ${esperadas} palabras`);
  const puntos = await p.locator('.ap-practica-grafica polyline.tuya').evaluateAll((els) => els.reduce((n, el) => n + el.getAttribute('points').split(' ').length, 0));
  comprobar(puntos > 50, 'La curva sigue la voz de verdad', `${puntos} puntos`);
  const juicios = await p.locator('.ap-practica-juicios li').evaluateAll((els) =>
    els.map((el) => ({ veredicto: el.querySelector('.ap-veredicto').textContent, texto: el.textContent.replace(/\s+/g, ' ') }))
  );
  for (const j of juicios) console.log(`      ${j.texto}`);
  comprobar(juicios.length === 2 && juicios.every((j) => j.veredicto === 'Bien'), 'Una voz de referencia saca bien las dos palabras', juicios.map((j) => j.veredicto).join(', '));
  comprobar(juicios[0]?.texto.includes('El tono cae después de «は», como debe.'), 'Y dice dónde cae el tono', juicios[0]?.texto);
  const resumen = await p.locator('.ap-practica-resumen').innerText();
  comprobar(resumen === '2 de 2 palabras con el tono en su sitio.', 'Dice cuántas palabras salieron bien', resumen);
  comprobar(await panel.getByRole('button', { name: 'Oír tu grabación' }).isVisible(), 'Se puede oír la grabación');
  comprobar(await panel.getByRole('button', { name: 'Volver a grabar' }).isVisible(), 'Y volver a grabar');

  // La segunda vez el modelo ya está cargado: el análisis no espera a leerlo del disco.
  await panel.getByRole('button', { name: 'Volver a grabar' }).click();
  await panel.locator('.ap-dictado.grabando').waitFor({ timeout: 15000 });
  await dormir(4600);
  await panel.getByRole('button', { name: 'Terminar' }).click();
  const otraVez = Date.now();
  await Promise.race([resultado.waitFor({ timeout: 120000 }), fallo.waitFor({ timeout: 120000 })]).catch(() => {});
  await panel.locator('.ap-dictado[role="status"]').waitFor({ state: 'detached', timeout: 120000 }).catch(() => {});
  const segundos = (Date.now() - otraVez) / 1000;
  comprobar(segundos < 10 && (await resultado.isVisible()), 'Una segunda grabación se analiza en unos segundos', `${segundos.toFixed(1)} s`);
  await p.screenshot({ path: join(CAPTURAS, '2-resultado.png') });
  await panel.screenshot({ path: join(CAPTURAS, '3-panel-oscuro.png') });
  await ajustar({ tema: 'claro' });
  await p.waitForTimeout(700);
  await panel.screenshot({ path: join(CAPTURAS, '4-panel-claro.png') });
  await ajustar({ tema: 'oscuro' });

  if (IMAGENES) {
    // Del tamaño de las demás imágenes del README, guardadas igual: PNG de paleta.
    await p.setViewportSize({ width: 1280, height: 720 });
    for (const id of IDIOMAS_README) {
      await ajustar({ idiomaInterfaz: id });
      await p.waitForTimeout(1200);
      const archivo = join(RAIZ, 'docs', 'img', id === 'es' ? 'practica.png' : `practica.${id}.png`);
      await sharp(await p.screenshot()).png({ palette: true, quality: 92, effort: 10 }).toFile(archivo);
      console.log('      imagen:', archivo.slice(RAIZ.length + 1));
    }
    await ajustar({ idiomaInterfaz: 'es' });
    await p.setViewportSize({ width: 1360, height: 900 });
    await p.waitForTimeout(800);
  }
}

// ---------- Sigue a la frase en curso ----------

await p.locator('.ap-dock').getByRole('button', { name: 'Frase siguiente' }).click();
await p.waitForTimeout(400);
comprobar((await p.locator('.ap-practica-frase-texto').innerText()) === SEGUNDA, 'Con «Frase siguiente» pasa a practicar la siguiente', await p.locator('.ap-practica-frase-texto').innerText().catch(() => ''));
comprobar(!(await resultado.isVisible()), 'Y empieza de cero');

// Escape cierra la práctica; consultar una palabra también, y «Practicar» cierra la consulta.
await p.keyboard.press('Escape');
await p.waitForTimeout(300);
const foco = await p.evaluate(() => `${document.activeElement?.tagName}.${document.activeElement?.className}`);
comprobar(!(await panel.isVisible()), 'Escape cierra la práctica', `foco en ${foco}`);
await practicar.click();
await panel.waitFor({ timeout: 5000 });
await p.locator('.ap-papel .pal').first().click();
await p.waitForTimeout(500);
comprobar(!(await panel.isVisible()) && (await p.locator('.ap-lectura-ficha').count()) === 1, 'Consultar una palabra cierra la práctica');
await practicar.click();
await panel.waitFor({ timeout: 5000 });
comprobar((await p.locator('.ap-lectura-ficha').count()) === 1, 'Y «Practicar» cierra la consulta');
await practicar.click();
await p.waitForTimeout(300);
comprobar(!(await panel.isVisible()), '«Practicar» otra vez la cierra');
// Escape nada más abrirla, con el foco en «Practicar»: el oyente ya está puesto.
await practicar.click();
await panel.waitFor({ timeout: 5000 });
await p.keyboard.press('Escape');
await p.waitForTimeout(300);
comprobar(!(await panel.isVisible()), 'Escape la cierra también nada más abrirla');

// ---------- En inglés no hay acento que practicar ----------

await ajustar({ idiomaObjetivo: 'en' });
// El Cuaderno añade lo que llega al final de lo que ya hay: se empieza vacío.
await sw.evaluate(() => chrome.storage.local.remove(['lectorTexto', 'notaCuaderno']));
await p.goto(`chrome-extension://${id}/app.html#/lector?t=${encodeURIComponent('It is going to rain today.')}`);
await p.reload();
await p.locator('.ap-papel .pal').first().waitFor({ timeout: 30000 });
await p.waitForTimeout(600);
comprobar((await practicar.count()) === 0, 'En inglés no aparece «Practicar»');
await ajustar({ idiomaObjetivo: 'ja' });

await tablaAcentos(true);
comprobar(errores.length === 0, 'Sin errores en la página', errores.join(' | '));
await contexto.close();
console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
