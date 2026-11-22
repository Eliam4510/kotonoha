// Prueba de la Memoria (0.48.0): el repaso con teclas, deshacer, editar, suspender, el límite de nuevas por día, la lista
// de tarjetas con su búsqueda y sus acciones, el progreso con sus gráficas y la copia completa con los repasos. Siembra
// sus tarjetas por el motor, en un perfil propio que se borra al empezar: lo de hoy cuenta solo lo de esta pasada.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/memoria.mjs

import { mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-memoria'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'memoria');
mkdirSync(CAPTURAS, { recursive: true });
rmSync(PERFIL, { recursive: true, force: true });

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};

const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1280, height: 900 },
  args: ['--mute-audio', `--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
await sw.evaluate(async () => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), idiomaInterfaz: 'es', idiomaObjetivo: 'ja', idiomaSecundario: 'es', bienvenidaVista: true, avisarVersiones: false, tema: 'oscuro', destino: 'memoria', memoriaNuevasDia: 3, memoriaAudio: false } });
});
const p = await contexto.newPage();
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));
p.on('console', (m) => {
  if (m.type() === 'error' && !/favicon|ERR_|Failed to load resource/.test(m.text())) errores.push(m.text());
});
await p.goto(`chrome-extension://${id}/app.html#/inicio`);
await p.waitForTimeout(1200);
const motor = (metodo, ...args) =>
  p.evaluate(({ metodo, args }) => chrome.runtime.sendMessage({ canal: 'motor', metodo, args }), { metodo, args }).then((r) => {
    if (!r?.ok) throw new Error(r?.error ?? 'sin respuesta');
    return r.valor;
  });

// ---------- Cinco tarjetas nuevas, en este orden ----------

const PALABRAS = [
  ['猫', 'ねこ', '猫が窓の外を見ている', 'El gato mira por la ventana'],
  ['犬', 'いぬ', '犬と公園を走った', 'Corrí por el parque con el perro'],
  ['空', 'そら', '空がとても青い', 'El cielo está muy azul'],
  ['海', 'うみ', '夏は海で泳ぎたい', 'En verano quiero nadar en el mar'],
  ['山', 'やま', 'あの山は高い', 'Aquella montaña es alta'],
];
const borrador = ([palabra, lectura, frase, traduccion]) => ({
  tipo: 'frase',
  palabra,
  lectura,
  frase,
  fraseFurigana: '',
  traduccion,
  definicion: `<b>${palabra}</b>`,
  audioFrase: [],
  audioPalabra: [],
  imagenes: [],
  ejemplos: '',
  notas: '',
  fuente: '',
  url: '',
});
for (const w of PALABRAS) {
  await motor('crearTarjeta', borrador(w), 'memoria');
  await p.waitForTimeout(15);
}

// ---------- Ayudas ----------

await p.goto(`chrome-extension://${id}/app.html#/memoria`);
const hoy = () =>
  p.evaluate(() => Object.fromEntries([...document.querySelectorAll('.ap-memoria-hoy > div')].map((d) => [d.querySelector('dt')?.textContent ?? '', d.querySelector('dd')?.textContent ?? ''])));
const frente = () => p.evaluate(() => document.querySelector('.ap-naipe-frente')?.textContent ?? '');
const reverso = () => p.evaluate(() => document.querySelector('.ap-naipe-reverso')?.textContent ?? '');
const esperar = (f, arg, ms = 8000) => p.waitForFunction(f, arg, { timeout: ms, polling: 100 }).then(() => true, () => false);
const frenteCon = (texto) => esperar((t) => document.querySelector('.ap-naipe-frente')?.textContent.includes(t), texto);
const vista = async (nombre) => {
  await p.locator('.ap-memoria-vistas button', { hasText: nombre }).click();
  await p.waitForTimeout(400);
};
const tecla = async (k) => {
  await p.keyboard.press(k);
  await p.waitForTimeout(250);
};

// ---------- Repasar ----------

console.log('\n== Repasar ==');
comprobar(await frenteCon('猫が窓'), 'Empieza por la más antigua', await frente());
// Al pasar de pantalla, la app funde una con otra.
await p.waitForTimeout(900);
let h = await hoy();
comprobar(h['Por repasar'] === '3' && h['Nuevas hoy'] === '3' && h['Repasadas hoy'] === '0' && h['En total'] === '5', 'Con 3 nuevas al día, de 5 tarjetas salen 3', JSON.stringify(h));
comprobar(await p.locator('.ap-naipe-nueva').isVisible(), 'Dice que es nueva');
await p.screenshot({ path: join(CAPTURAS, 'repasar.png') });

await tecla(' ');
comprobar((await reverso()).includes('ねこ') && (await reverso()).includes('El gato mira por la ventana'), 'Espacio enseña la respuesta', (await reverso()).slice(0, 60));
await tecla('4');
comprobar(await frenteCon('犬と公園'), '4, «Fácil», y sale la siguiente', await frente());
h = await hoy();
comprobar(h['Repasadas hoy'] === '1' && h['Nuevas hoy'] === '2', 'Lo de hoy se pone al día', JSON.stringify(h));

await tecla('z');
comprobar(await frenteCon('猫が窓'), 'Z deshace: vuelve la de antes, delante', await frente());
h = await hoy();
comprobar(h['Repasadas hoy'] === '0' && h['Nuevas hoy'] === '3', 'Y se borra su repaso', JSON.stringify(h));

// E edita: la traducción nueva se ve en la respuesta.
await tecla('e');
const dialogo = p.locator('[role="dialog"][aria-label="Editar la tarjeta"]');
comprobar(await dialogo.isVisible(), 'E abre la edición');
comprobar(await p.evaluate(() => document.activeElement?.closest('[role="dialog"]') != null), 'Con el foco ya en sus campos');
const traduccion = dialogo.locator('label.ap-dialogo-campo', { hasText: 'Traducción' }).locator('textarea');
await traduccion.fill('El gato mira afuera');
await dialogo.locator('button[type="submit"]').click();
await esperar(() => !document.querySelector('[role="dialog"]'));
comprobar(await frenteCon('猫が窓'), 'Al guardar sigue la misma tarjeta', await frente());
await tecla(' ');
comprobar((await reverso()).includes('El gato mira afuera'), 'Con lo editado', (await reverso()).slice(0, 60));
await tecla('4');
await frenteCon('犬と公園');

// Escape cierra la edición sin tocar nada, y las teclas del repaso no actúan con ella abierta.
await tecla('e');
await tecla('4');
await tecla('Escape');
comprobar(!(await dialogo.isVisible()) && (await frente()).includes('犬と公園'), 'Escape cierra la edición, y lo tecleado en ella no responde a la tarjeta');

// Suspender con el ratón: después, Espacio sigue siendo del repaso y no vuelve a suspender.
await p.locator('.ap-repaso-herramientas button', { hasText: 'Suspender' }).click();
comprobar(await frenteCon('空がとても'), 'Suspender la quita del repaso', await frente());
await tecla(' ');
comprobar((await reverso()).includes('そら'), 'Tras pulsar un botón, Espacio sigue enseñando la respuesta', await p.evaluate(() => document.activeElement?.tagName));
await tecla('4');
comprobar(await frenteCon('夏は海'), 'Sigue la siguiente nueva');
await tecla(' ');
await tecla('4');

// Tres nuevas estrenadas hoy: 山, la quinta, no sale hasta mañana.
const fin = await esperar(() => document.querySelector('.ap-vacio h3')?.textContent.includes('Todo al día'));
comprobar(fin, 'Con las nuevas del día hechas, todo al día', await p.evaluate(() => document.querySelector('.ap-vacio')?.textContent ?? ''));
comprobar((await p.evaluate(() => document.querySelector('.ap-vacio')?.textContent ?? '')).includes('Hoy has repasado 3: 3 a la primera o casi'), 'Y dice cómo fue hoy');
await p.screenshot({ path: join(CAPTURAS, 'al-dia.png') });

// Con nuevas esperando por el límite, se pueden pedir unas cuantas más, solo por hoy (aquí, 山: 犬 está suspendida).
const mas = p.locator('.ap-memoria-fin button', { hasText: 'más hoy' });
comprobar((await mas.innerText().catch(() => '')).includes('Estudiar 1 nueva más hoy'), 'Ofrece estudiar la nueva que espera, solo por hoy', await mas.innerText().catch(() => 'no está'));
await mas.click();
comprobar(await frenteCon('あの山は'), 'Y sale ya', await frente());
const extra = await sw.evaluate(async () => (await chrome.storage.local.get('ajustes')).ajustes.memoriaExtra);
comprobar(extra?.n === 1, 'Lo pedido vale solo para hoy', JSON.stringify(extra));

// ---------- Tarjetas ----------

console.log('\n== Tarjetas ==');
await vista('Tarjetas');
const filas = () => p.locator('.ap-fila-tarjeta');
comprobar((await filas().count()) === 5, 'Las cinco, con su estado', String(await filas().count()));
const vuelven = await p.locator('.ap-fila-tarjeta-vuelve').allInnerTexts();
comprobar(vuelven.filter((v) => /^dentro de \d+ días$/.test(v)).length === 3, 'Cuándo vuelve cada una, en el idioma de la interfaz', vuelven.join(' | '));
comprobar((await filas().last().innerText()).includes('犬'), 'Por cuándo vuelven, la suspendida al final: no vuelve');
const cuenta = (filtro) => p.locator('.ap-filtros .segmentado button', { hasText: filtro }).locator('.num').innerText();
comprobar((await cuenta('Suspendidas')) === '1' && (await cuenta('En repaso')) === '3' && (await cuenta('Nuevas')) === '1', 'Cuántas hay de cada estado', `${await cuenta('Nuevas')} nuevas, ${await cuenta('En repaso')} en repaso, ${await cuenta('Suspendidas')} suspendidas`);
await p.getByLabel('Buscar tarjeta').fill('海');
await p.waitForTimeout(200);
comprobar((await filas().count()) === 1 && (await filas().first().innerText()).includes('夏は海'), 'Buscar por la palabra');
await p.getByLabel('Buscar tarjeta').fill('perro');
await p.waitForTimeout(200);
comprobar((await filas().count()) === 1 && (await filas().first().innerText()).includes('犬'), 'Y por la traducción');
await p.getByLabel('Buscar tarjeta').fill('');
await p.screenshot({ path: join(CAPTURAS, 'tarjetas.png') });

await p.locator('.ap-filtros .segmentado button', { hasText: 'Suspendidas' }).click();
await p.locator('.ap-fila-tarjeta button[aria-label="Reactivar"]').click();
await p.waitForTimeout(400);
comprobar((await cuenta('Suspendidas')) === '0' && (await cuenta('Nuevas')) === '2', 'Reactivar la devuelve como estaba: nueva');
await p.locator('.ap-filtros .segmentado button', { hasText: 'Todas' }).click();
const filaGato = p.locator('.ap-fila-tarjeta', { hasText: '猫' });
await filaGato.locator('button[aria-label="Empezar de cero"]').click();
await p.waitForTimeout(400);
comprobar((await cuenta('Nuevas')) === '3' && (await cuenta('En repaso')) === '2', 'Empezar de cero la vuelve nueva');

// ---------- Progreso ----------

console.log('\n== Progreso ==');
await vista('Progreso');
const cifras = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll('.ap-memoria-cifra')].map((c) => [c.querySelector('dt')?.textContent ?? '', c.querySelector('dd')?.textContent ?? ''])));
comprobar(cifras['Racha'] === '1 día' && cifras['Repasadas hoy'] === '3' && cifras['Tarjetas'] === '5', 'La racha, lo de hoy y cuántas hay', JSON.stringify(cifras));
comprobar(cifras['Aciertos en repaso'] === '—', 'Sin repasos de tarjetas ya aprendidas, no hay porcentaje que dar');
const graficas = p.locator('.ap-grafica');
comprobar((await graficas.count()) === 2, 'Dos gráficas');
const columnas = await p.evaluate(() => [...document.querySelectorAll('.ap-grafica')].map((g) => g.querySelectorAll('.ap-grafica-columna').length));
comprobar(columnas[0] === 30 && columnas[1] === 14, '30 días de repasos y 14 de lo que vence', columnas.join(' y '));
// La última columna de los repasos es hoy, con su cifra: es la más alta.
comprobar((await graficas.first().locator('.ap-grafica-cifra').innerText()) === '3', 'La columna de hoy lleva su cifra');
await graficas.first().locator('.ap-grafica-columna').last().hover();
const ayuda = await graficas.first().locator('.ap-grafica-ayuda').innerText().catch(() => '');
comprobar(/3 repasos/.test(ayuda) && /3 acertados/.test(ayuda), 'Al pasar por la columna, sus números', ayuda.replace(/\n/g, ' '));
await graficas.first().locator('summary').click();
const filasTabla = await graficas.first().locator('table tr').allInnerTexts();
comprobar(filasTabla.length === 30 && /3 repasos/.test(filasTabla.at(-1)), 'Y su tabla, para no depender del ratón', filasTabla.at(-1)?.replace(/\s+/g, ' '));
await p.screenshot({ path: join(CAPTURAS, 'progreso.png'), fullPage: true });

// ---------- Ajustes ----------

console.log('\n== Ajustes ==');
await p.goto(`chrome-extension://${id}/app.html#/ajustes`);
const nuevasDia = p.getByLabel('Tarjetas nuevas al día');
await nuevasDia.waitFor({ timeout: 10000 }).catch(() => {});
comprobar((await nuevasDia.inputValue().catch(() => '')) === '3', 'Ajustes dice cuántas nuevas al día', await nuevasDia.inputValue().catch(() => 'no está'));
await nuevasDia.fill('10');
await p.waitForTimeout(600);
await p.goto(`chrome-extension://${id}/app.html#/memoria`);
comprobar(await frenteCon('猫が窓'), 'Con más nuevas al día, vuelven a salir', await frente());
h = await hoy();
comprobar(h['Nuevas hoy'] === '3', 'Las que quedan: las nuevas que hay, dentro del límite nuevo', JSON.stringify(h));

// ---------- Copia completa ----------

console.log('\n== Copia completa ==');
const copia = JSON.parse(await motor('exportarDatos', await sw.evaluate(async () => (await chrome.storage.local.get('ajustes')).ajustes)));
comprobar(copia.lenguas?.ja?.repasos?.length === 3, 'La copia lleva los repasos', String(copia.lenguas?.ja?.repasos?.length));

console.log('');
comprobar(!errores.length, 'Sin errores en la página', errores.slice(0, 3).join(' | '));
await contexto.close();
console.log(fallos ? `\n${fallos} comprobaciones fallaron.` : '\nTodas las comprobaciones pasaron.');
process.exit(fallos ? 1 : 0);
