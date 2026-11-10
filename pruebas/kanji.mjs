// Prueba el diccionario de kanji y la práctica de escritura (0.29.0): la invitación a instalarlo desde la página de un
// kanji, y con él sus lecturas (las oficiales, las otras, las de nombres y de qué época viene cada una), su radical, cómo
// se formó, sus formas antiguas, su familia por el sonido, los kanji que lo llevan dentro, los parecidos, los opuestos y
// los que se leen igual; las palabras de lectura especial; escribirlo trazo a trazo, calcando y de memoria; y que el
// índice del diccionario se guarda para no rehacerlo en cada arranque.
// Baja el diccionario de kanji (unos 3 MB) y los trazos de KanjiVG: necesita conexión. Deja el perfil como estaba.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/kanji.mjs

import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-local'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'kanji');
mkdirSync(CAPTURAS, { recursive: true });

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};

if (!existsSync(PERFIL) && existsSync(join(RAIZ, '.perfil-base', 'Default/IndexedDB'))) {
  cpSync(join(RAIZ, '.perfil-base', 'Default/IndexedDB'), join(PERFIL, 'Default/IndexedDB'), { recursive: true });
}

const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1600, height: 1000 },
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});
let sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
const previo = await sw.evaluate(async () => chrome.storage.local.get(['ajustes']));
await sw.evaluate(async () => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({
    ajustes: { ...(d.ajustes ?? {}), idiomaInterfaz: 'es', idiomaObjetivo: 'ja', bienvenidaVista: true, tema: 'oscuro', avisarVersiones: false, diccionarioAncho: 'completo', diccionarioTamano: 100, diccionarioLetra: 'gotica' },
  });
});

const p = await contexto.newPage();
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));
await p.goto(`chrome-extension://${id}/app.html#/inicio`);
const motor = async (metodo, ...args) => {
  for (let intento = 0; ; intento++) {
    const r = await p.evaluate(({ metodo, args }) => chrome.runtime.sendMessage({ canal: 'motor', metodo, args }), { metodo, args }).catch(() => null);
    if (r?.ok) return r.valor;
    if (intento > 60 || r?.error) throw new Error(`${metodo}: ${r?.error ?? 'sin respuesta'}`);
    await p.waitForTimeout(250);
  }
};
const instalados = (await motor('estado')).diccionarios.map((d) => d.id);
console.log('diccionarios del perfil:', instalados.join(', '));
const teniaKanji = instalados.includes('kanji');
if (teniaKanji) await motor('eliminarDiccionario', 'kanji');
const modoPrevio = await p.evaluate(() => localStorage.getItem('kk-modoEscritura'));
await p.evaluate(() => localStorage.removeItem('kk-modoEscritura'));

const ir = async (q) => {
  await p.goto(`chrome-extension://${id}/app.html#/diccionario?q=${encodeURIComponent(q)}`);
  await p.reload();
  await p.locator('.dic-caracter, .dic-ficha .ficha-palabra').first().waitFor({ timeout: 90000 });
  await p.waitForTimeout(500);
};
const seccion = (titulo) => p.locator('.dic-seccion', { has: p.locator('.dic-seccion-titulo', { hasText: titulo }) });
const kanjiDe = (titulo) => seccion(titulo).locator('.dic-kanji > b').allTextContents();
const fila = (rotulo) => p.locator('.dic-lecturas-fila', { has: p.locator('dt', { hasText: rotulo }) });
const titulo = () => p.locator('.dic-caracter-titulo').innerText();

// ---------- Sin el diccionario de kanji ----------

await ir('国');
comprobar(/country/i.test(await p.locator('.dic-caracter-significado').innerText()), 'Sin el diccionario de kanji, la página se queda con lo de las listas');
const invitacion = p.locator('.dic-instalar');
await invitacion.waitFor({ timeout: 15000 }).catch(() => {});
comprobar(await invitacion.isVisible(), 'Y ofrece instalarlo ahí mismo', (await invitacion.innerText().catch(() => '')).split('\n')[0].slice(0, 60));
await p.screenshot({ path: join(CAPTURAS, '1-sin-diccionario.png') });

// ---------- Instalarlo desde la página ----------

const t0 = Date.now();
await invitacion.getByRole('button', { name: 'Instalar' }).click();
await fila('En nombres').waitFor({ timeout: 180000 }).catch(() => {});
const dic = (await motor('estado')).diccionarios.find((d) => d.id === 'kanji');
comprobar(dic?.tipo === 'caracteres' && dic.filas > 6000, 'Se instala desde la página, con más de seis mil kanji', `${dic?.filas} en ${Math.round((Date.now() - t0) / 1000)} s`);
comprobar((await invitacion.count()) === 0, 'Y la página se completa sola, sin recargar');

// ---------- Lo que añade: 国 ----------

comprobar(/país/i.test(await p.locator('.dic-caracter-significado').innerText()), 'Lo que significa, en el idioma de la interfaz', await p.locator('.dic-caracter-significado').innerText());
const cabecera = await titulo();
comprobar(/Jōyō · 2\.º de primaria/.test(cabecera) && /Kanken 9級/.test(cabecera) && /N\.º \d+ en uso/.test(cabecera) && /8 trazos/.test(cabecera), 'En qué lista está, su nivel del examen de kanji, su puesto y sus trazos', cabecera.replace(/\n/g, ' | '));
const on = await fila("On'yomi").innerText();
comprobar(on.includes('コク') && on.includes('Go-on'), 'La on\'yomi, con la época de la que viene', on.replace(/\n/g, ' '));
const nombres = await fila('En nombres').locator('.dic-lectura').allTextContents();
comprobar(nombres.includes('くに') && nombres.includes('とき'), 'Las lecturas de nombres', nombres.join(' '));
const radical = await fila('Radical').innerText();
comprobar(radical.includes('囗') && /n\.º 31/.test(radical), 'Su radical, con su nombre y su número', radical.replace(/\n/g, ' '));
comprobar((await fila('Cómo se formó').innerText()).includes('Compuesto de ideas'), 'Cómo se formó');
const variantes = seccion('Formas antiguas y variantes');
const antigua = variantes.locator('.dic-variante', { hasText: '國' });
comprobar((await antigua.innerText().catch(() => '')).includes('Forma antigua'), 'Su forma antigua, 國', (await variantes.locator('.dic-variante').allInnerTexts()).map((x) => x.replace(/\n/g, ' ')).join(' | '));
await p.screenshot({ path: join(CAPTURAS, '2-kanji.png'), fullPage: true });
await antigua.click();
await p.locator('.dic-caracter-aviso').waitFor({ timeout: 20000 }).catch(() => {});
const aviso = await p.locator('.dic-caracter-aviso').innerText().catch(() => '');
comprobar(aviso.includes('forma antigua') && aviso.includes('国'), 'Al abrirla, avisa de que es una forma antigua y de cómo se escribe hoy', aviso.replace(/\n/g, ' '));
// El CDN no da los archivos que no tiene guardados (403): se piden al repositorio.
await p.locator('.trazos-lienzos.enormes svg .trazo-fondo').first().waitFor({ timeout: 30000 }).catch(() => {});
comprobar((await p.locator('.trazos-lienzos.enormes svg .trazo-fondo').count()) === 11, 'Y sus trazos llegan aunque el CDN no los tenga', await p.locator('.trazos-lienzos.enormes svg .trazo-fondo').count());

// ---------- Lecturas oficiales y las demás; opuestos, parecidos y los que se leen igual: 上 ----------

await ir('上');
await fila("Kun'yomi").waitFor({ timeout: 20000 });
const kun = fila("Kun'yomi");
const oficiales = await kun.locator('dd > .dic-lectura').allTextContents();
const otras = await kun.locator('.dic-lecturas-otras .dic-lectura').allTextContents();
comprobar(oficiales.includes('うえ') && oficiales.includes('あげる') && otras.includes('ほとり') && !oficiales.includes('ほとり'), 'Las lecturas oficiales, y aparte las que no están en la lista', `${oficiales.join(' ')} · otras: ${otras.join(' ')}`);
comprobar((await fila("On'yomi").locator('.dic-lectura.poco', { hasText: 'ショウ' }).count()) === 1, 'Las oficiales que casi no se usan, señaladas');
const masNombres = fila('En nombres').getByRole('button', { name: /más/ });
const antes = await fila('En nombres').locator('.dic-lectura').count();
await masNombres.click();
comprobar((await fila('En nombres').locator('.dic-lectura').count()) > antes, 'Las de nombres, unas pocas a la vista y el resto al pedirlas', `${antes} → ${await fila('En nombres').locator('.dic-lectura').count()}`);
await seccion('Kanji opuestos').waitFor({ timeout: 20000 }).catch(() => {});
comprobar((await kanjiDe('Kanji opuestos')).includes('下'), 'Su kanji opuesto', (await kanjiDe('Kanji opuestos')).join(' '));
comprobar((await kanjiDe('Kanji de significado parecido')).includes('登'), 'Los de significado parecido', (await kanjiDe('Kanji de significado parecido')).join(' '));
const igual = seccion('Kanji que se leen igual').locator('.dic-homonimo', { hasText: 'かみ' });
const kami = await igual.locator('.dic-kanji > b').allTextContents();
comprobar(['神', '紙', '髪'].every((k) => kami.includes(k)) && (await igual.innerText()).includes('Otro acento'), 'Los que se leen igual, y si se distinguen por el acento', kami.join(' '));
const opuesto = seccion('Kanji opuestos').locator('.dic-kanji').first();
comprobar(/debajo|abajo|inferior/i.test(await opuesto.innerText()), 'Cada uno con su lectura y lo que significa', (await opuesto.innerText()).replace(/\n/g, ' '));

// ---------- La familia por el sonido y los que lo llevan dentro: 青 y 晴 ----------

await ir('青');
await seccion('Da su sonido a').waitFor({ timeout: 20000 }).catch(() => {});
const hijos = await kanjiDe('Da su sonido a');
comprobar(['晴', '清', '精'].every((k) => hijos.includes(k)), 'El que da su sonido a otros los enseña', hijos.join(' '));
comprobar((await seccion('Da su sonido a').innerText()).includes('セイ'), 'Con el sonido que les da');
await seccion('Otros kanji que lo llevan dentro').waitFor({ timeout: 20000 }).catch(() => {});
const dentro = await kanjiDe('Otros kanji que lo llevan dentro');
comprobar(dentro.length > 0 && !dentro.some((k) => hijos.includes(k)), 'Y los demás que lo llevan dentro, sin repetir los de su familia', dentro.join(' '));
comprobar((await kanjiDe('Kanji parecidos')).includes('責'), 'Los que se le parecen', (await kanjiDe('Kanji parecidos')).join(' '));
await p.screenshot({ path: join(CAPTURAS, '3-familia.png'), fullPage: true });
await ir('晴');
await seccion('Familia por el sonido').waitFor({ timeout: 20000 }).catch(() => {});
const familia = await kanjiDe('Familia por el sonido');
comprobar(familia[0] === '青' && familia.includes('清') && !familia.includes('晴'), 'Quien recibe el sonido ve su familia, con la pieza que lo da primero', familia.join(' '));
await p.locator('.dic-pieza-fonetico').click();
await p.waitForFunction(() => decodeURIComponent(location.hash).includes('q=青'), null, { timeout: 10000 }).catch(() => {});
comprobar(decodeURIComponent(p.url()).includes('q=青'), 'La pieza que da el sonido lleva a su página');

// ---------- Lecturas especiales: 今 ----------

await ir('今');
await seccion('Lecturas especiales con 今').waitFor({ timeout: 30000 }).catch(() => {});
const especiales = await seccion('Lecturas especiales con 今').locator('.dic-tarjeta-palabra').evaluateAll((xs) =>
  xs.map((x) => {
    const copia = x.cloneNode(true);
    copia.querySelectorAll('rt, rp').forEach((r) => r.remove());
    return copia.textContent.replace(/\s+/g, '');
  })
);
comprobar(especiales.includes('今日') && especiales.includes('今朝'), 'Las palabras que no se leen como sus kanji', especiales.join(' '));

// ---------- En la página de una palabra, sus kanji en el idioma de la interfaz ----------

await ir('学校');
const tarjetaKanji = p.locator('.dic-lateral .dic-caracter-tarjeta').first();
await tarjetaKanji.waitFor({ timeout: 30000 });
await p.waitForFunction(() => /estudi|aprend/i.test(document.querySelector('.dic-lateral .dic-caracter-tarjeta')?.textContent ?? ''), null, { timeout: 10000 }).catch(() => {});
comprobar(/estudi|aprend/i.test(await tarjetaKanji.innerText()), 'Junto a una palabra, lo que significan sus kanji, en español', (await tarjetaKanji.innerText()).replace(/\n/g, ' | '));

// ---------- Practicar la escritura: 三 ----------

await ir('三');
comprobar((await p.locator('.trazos-lienzos.enormes svg').count()) === 1, 'Un kanji se abre enseñando cómo se escribe');
await p.getByRole('radio', { name: 'Practicar' }).click();
const lienzo = p.locator('.escritura-lienzo');
await lienzo.waitFor({ timeout: 20000 });
comprobar(await p.getByRole('radio', { name: 'Calcando' }).getAttribute('aria-checked') === 'true' && (await lienzo.locator('.trazo-fondo').count()) === 3, 'Al practicar, primero calcando: el kanji va de fondo');
// Los trazos de verdad, muestreados en la página, en unidades del lienzo de 109.
const trazos = await p.evaluate(async () => {
  const r = await chrome.runtime.sendMessage({ canal: 'motor', metodo: 'trazos', args: ['三'] });
  return r.valor.trazos.map((d) => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    const largo = path.getTotalLength();
    return Array.from({ length: 14 }, (_, i) => {
      const pt = path.getPointAtLength((largo * i) / 13);
      return { x: pt.x, y: pt.y };
    });
  });
});
const escribir = async (puntos, desplazar = { x: 0, y: 0 }) => {
  const c = await lienzo.boundingBox();
  const ps = puntos.map((q, i) => ({ x: c.x + ((q.x + desplazar.x + Math.sin(i * 1.7)) / 109) * c.width, y: c.y + ((q.y + desplazar.y + Math.cos(i * 2.3)) / 109) * c.height }));
  await p.mouse.move(ps[0].x, ps[0].y);
  await p.mouse.down();
  for (const q of ps.slice(1)) await p.mouse.move(q.x, q.y, { steps: 3 });
  await p.mouse.up();
  await p.waitForTimeout(150);
};
const avisoEscritura = async () => (await p.locator('.escritura-aviso').innerText()).trim();
const hechos = () => lienzo.locator('.trazo-hecho').count();

await escribir(trazos[0]);
comprobar((await hechos()) === 1 && (await avisoEscritura()) === 'Trazo 2 de 3', 'Un trazo bien escrito se queda, y se pasa al siguiente', await avisoEscritura());
await escribir(trazos[2]);
comprobar((await hechos()) === 1 && (await avisoEscritura()) === 'Ese es el trazo 3. Ahora toca el 2.', 'Si se escribe otro de los que faltan, lo dice', await avisoEscritura());
await p.screenshot({ path: join(CAPTURAS, '4-otro-trazo.png') });
await escribir([...trazos[1]].reverse());
comprobar((await hechos()) === 1 && (await avisoEscritura()).startsWith('Va al revés'), 'Si va al revés, también', await avisoEscritura());
comprobar((await lienzo.locator('.escritura-pista').count()) === 1, 'Al segundo fallo en el mismo trazo, enseña cómo va');
await escribir(trazos[1]);
comprobar((await hechos()) === 2 && (await lienzo.locator('.escritura-pista').count()) === 0, 'Al acertar, la pista se va');
await p.getByRole('button', { name: 'Deshacer el último trazo' }).click();
comprobar((await hechos()) === 1, 'Se puede deshacer el último trazo');
await escribir(trazos[1]);
await p.getByRole('button', { name: 'Pista' }).click();
comprobar((await avisoEscritura()) === 'Así va el trazo 3: empieza en el punto.' && (await lienzo.locator('.escritura-pista').count()) === 1, 'La pista también se puede pedir', await avisoEscritura());
await escribir(trazos[2]);
comprobar((await hechos()) === 3 && (await avisoEscritura()) === 'Hecho. Repasa los trazos 2, 3.', 'Al terminar, dice qué trazos conviene repasar', await avisoEscritura());
await p.screenshot({ path: join(CAPTURAS, '5-terminado.png') });

await p.getByRole('button', { name: 'Ahora de memoria' }).click();
await p.waitForTimeout(200);
comprobar((await lienzo.locator('.trazo-fondo').count()) === 0 && (await hechos()) === 0, 'De memoria, la cuadrícula está vacía');
// Un garabato no es ningún trazo.
await escribir([{ x: 20, y: 20 }, { x: 80, y: 85 }, { x: 25, y: 80 }, { x: 85, y: 25 }]);
comprobar((await hechos()) === 0 && (await avisoEscritura()).startsWith('Ese no es el trazo 1'), 'Un garabato no cuela', await avisoEscritura());
await p.getByRole('button', { name: 'Borrar y empezar de nuevo' }).click();
// Algo desplazado, como quien escribe sin guía.
for (const t of trazos) await escribir(t, { x: 4, y: 3 });
comprobar((await hechos()) === 3 && (await avisoEscritura()) === '¡Perfecto! Sin ningún fallo.', 'Escrito de memoria y sin fallos, lo celebra', await avisoEscritura());
await p.screenshot({ path: join(CAPTURAS, '6-de-memoria.png') });
await ir('口');
comprobar((await p.locator('.trazos-lienzos.enormes svg').count()) === 1 && (await p.locator('.escritura-lienzo').count()) === 0, 'El siguiente kanji vuelve a abrirse con sus trazos, no en la práctica');
await p.getByRole('radio', { name: 'Practicar' }).click();
comprobar(await p.getByRole('radio', { name: 'De memoria' }).getAttribute('aria-checked') === 'true', 'Pero recuerda si practicabas calcando o de memoria');

// ---------- Explorar: las de lectura especial ----------

await p.goto(`chrome-extension://${id}/app.html#/diccionario`);
await p.reload();
await p.locator('.ap-categoria', { hasText: 'Lecturas especiales' }).click();
await p.locator('.ap-categoria-vista .dic-tarjeta').first().waitFor({ timeout: 90000 });
const deCategoria = await p.locator('.ap-categoria-vista .dic-tarjeta-palabra').evaluateAll((xs) =>
  xs.map((x) => {
    const copia = x.cloneNode(true);
    copia.querySelectorAll('rt, rp').forEach((r) => r.remove());
    return copia.textContent.replace(/\s+/g, '');
  })
);
comprobar(deCategoria.length === 100 && deCategoria.every((t) => /\p{Script=Han}/u.test(t)), 'En Explorar, las palabras de lectura especial: todas con sus kanji', deCategoria.slice(0, 8).join(' '));

// ---------- Ajustes ----------

await p.goto(`chrome-extension://${id}/app.html#/ajustes`);
await p.reload();
const enAjustes = p.locator('.ap-opcion', { hasText: 'Kanji (Kanjium y KANJIDIC)' });
await enAjustes.first().waitFor({ timeout: 20000 }).catch(() => {});
comprobar(/6[.\s ]?8\d\d/.test(await enAjustes.first().innerText().catch(() => '')), 'En Ajustes, entre los diccionarios instalados', (await enAjustes.first().innerText().catch(() => '')).replace(/\n/g, ' '));

// ---------- El índice se guarda ----------

const guardado = await p.evaluate(
  () =>
    new Promise((ok) => {
      const r = indexedDB.open('kikitori');
      r.onsuccess = () => {
        const pedir = r.result.transaction('indices').objectStore('indices').get('explorar');
        pedir.onsuccess = () => {
          r.result.close();
          ok(pedir.result ? { firma: pedir.result.firma, comunes: pedir.result.datos.comunes.length } : null);
        };
        pedir.onerror = () => ok(null);
      };
      r.onerror = () => ok(null);
    })
);
comprobar(!!guardado && guardado.comunes > 10000, 'El índice del diccionario queda guardado', guardado ? `${guardado.comunes} palabras de uso común` : 'nada');
comprobar(errores.length === 0, 'Sin errores en la página', errores.join(' | '));
await p.evaluate((m) => (m === null ? localStorage.removeItem('kk-modoEscritura') : localStorage.setItem('kk-modoEscritura', m)), modoPrevio);

// Con el motor recién arrancado, las listas salen de lo guardado: no hay que recorrer los diccionarios otra vez. Al
// recargar la extensión se cierran sus páginas: se abre otra.
sw = await recargarExtension(contexto);
const p2 = await contexto.newPage();
await p2.goto(`chrome-extension://${id}/app.html#/inicio`);
const motor2 = async (metodo, ...args) => {
  for (let intento = 0; ; intento++) {
    const r = await p2.evaluate(({ metodo, args }) => chrome.runtime.sendMessage({ canal: 'motor', metodo, args }), { metodo, args }).catch(() => null);
    if (r?.ok) return r.valor;
    if (intento > 60 || r?.error) throw new Error(`${metodo}: ${r?.error ?? 'sin respuesta'}`);
    await p2.waitForTimeout(250);
  }
};
await motor2('estado');
const t1 = Date.now();
const conAi = await motor2('palabrasConCaracter', '愛', 24);
const tardo = Date.now() - t1;
comprobar(conAi.total > 20 && tardo < 4000, 'Y al arrancar de nuevo, las palabras con un kanji salen al momento', `${tardo} ms`);

// ---------- Dejarlo como estaba ----------

if (!teniaKanji) await motor2('eliminarDiccionario', 'kanji');
await sw.evaluate(async (previo) => {
  await chrome.storage.local.set({ ajustes: previo.ajustes });
}, previo);
await contexto.close();
console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
