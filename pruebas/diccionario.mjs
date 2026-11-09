// Prueba la página del diccionario (0.28.0): la lista de resultados y la palabra elegida, sus sentidos con su clase de
// palabra, lo que la rodea (sus kanji, sus opuestos, las que significan lo mismo, las que se leen igual), las frases
// donde la has visto con su minuto y el botón para volver a él, la página propia de un kanji, buscar por significado,
// la gramática, los ajustes a mano y las categorías para explorar. Claude va simulado: no gasta nada.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/diccionario.mjs

import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';
import { iniciarMock } from './mock-claude.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-local'));
const CAPTURAS = join(RAIZ, 'capturas-e2e', 'diccionario');
mkdirSync(CAPTURAS, { recursive: true });
/** Las frases de prueba llevan esta fuente: así se reconocen para borrarlas al acabar. */
const FUENTE = 'Video de prueba del diccionario';
const VIDEO = 'https://www.youtube.com/watch?v=kotonohaDic';
const OTRO_VIDEO = 'https://example.com/clase?video=7';

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};

if (!existsSync(PERFIL) && existsSync(join(RAIZ, '.perfil-base', 'Default/IndexedDB'))) {
  cpSync(join(RAIZ, '.perfil-base', 'Default/IndexedDB'), join(PERFIL, 'Default/IndexedDB'), { recursive: true });
}

const mock = await iniciarMock();
const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1600, height: 1000 },
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
const previo = await sw.evaluate(async () => chrome.storage.local.get(['ajustes', 'urlBaseIA', 'claveAnthropic']));
await sw.evaluate(async ({ url }) => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({
    urlBaseIA: url,
    claveAnthropic: 'clave-de-prueba',
    ajustes: { ...(d.ajustes ?? {}), idiomaInterfaz: 'es', idiomaObjetivo: 'ja', bienvenidaVista: true, tema: 'oscuro', avisarVersiones: false, guardarHistorial: true, diccionarioAncho: 'completo', diccionarioTamano: 100, diccionarioLetra: 'gotica' },
  });
}, { url: `http://127.0.0.1:${mock.puerto}` });

const p = await contexto.newPage();
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));
await p.goto(`chrome-extension://${id}/app.html#/inicio`);
const motor = async (metodo, ...args) => {
  for (let intento = 0; ; intento++) {
    const r = await p.evaluate(({ metodo, args }) => chrome.runtime.sendMessage({ canal: 'motor', metodo, args }), { metodo, args }).catch(() => null);
    if (r?.ok) return r.valor;
    if (intento > 40 || r?.error) throw new Error(`${metodo}: ${r?.error ?? 'sin respuesta'}`);
    await p.waitForTimeout(250);
  }
};
const instalados = (await motor('estado')).diccionarios.map((d) => d.id);
console.log('diccionarios del perfil:', instalados.join(', '));

/** Borra las frases de prueba de la base del japonés, para no dejar el perfil distinto de como estaba. */
const borrarFrases = () =>
  p.evaluate(
    (fuente) =>
      new Promise((ok) => {
        const r = indexedDB.open('kikitori');
        r.onsuccess = () => {
          const t = r.result.transaction('frases', 'readwrite');
          t.objectStore('frases').openCursor().onsuccess = (e) => {
            const c = e.target.result;
            if (!c) return;
            if (c.value.fuente === fuente) c.delete();
            c.continue();
          };
          t.oncomplete = () => {
            r.result.close();
            ok(true);
          };
        };
        r.onerror = () => ok(false);
      }),
    FUENTE
  );

const ir = async (q) => {
  await p.goto(`chrome-extension://${id}/app.html#/diccionario${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  await p.reload();
  if (q) await p.locator('.dic-ficha .ficha-palabra, .dic-caracter, .ap-vacio, .dic-gramatica .ap-dic-seccion').first().waitFor({ timeout: 90000 });
  await p.waitForTimeout(600);
};
/** La palabra abierta en el centro, sin su lectura. */
const palabraCentral = () =>
  p.locator('.dic-ficha .ficha-palabra').first().evaluate((x) => {
    const copia = x.cloneNode(true);
    copia.querySelectorAll('rt, rp').forEach((r) => r.remove());
    return copia.textContent.replace(/\s+/g, '');
  });
const tarjetas = (seccion) => p.locator('.dic-seccion', { hasText: seccion }).locator('.dic-tarjeta-palabra');
/** El texto de una palabra sin su lectura: lo que va dentro de <rt> no cuenta. */
const sinLectura = (loc) => loc.evaluateAll((xs) => xs.map((x) => [...x.childNodes].map((n) => (n.nodeType === 3 ? n.textContent : n.tagName === 'RUBY' ? [...n.childNodes].filter((h) => h.nodeType === 3).map((h) => h.textContent).join('') : n.textContent)).join('')));

// ---------- La portada ----------

await ir('');
await p.locator('.ap-categoria').first().waitFor({ timeout: 15000 });
comprobar((await p.locator('.ap-categoria').count()) === 7, 'Siete categorías para explorar', await p.locator('.ap-categoria').count());
comprobar((await p.locator('.ap-categoria').first().innerText()).includes('Onomatopeyas'), 'La primera, las onomatopeyas');
await p.screenshot({ path: join(CAPTURAS, '1-portada.png') });

// ---------- Por significado ----------

const inicio = Date.now();
await ir('perro');
const lista = p.locator('.dic-lista', { hasText: 'Palabras que significan «perro»' });
await lista.waitFor({ timeout: 90000 }).catch(() => {});
const terminos = await sinLectura(lista.locator('.dic-tarjeta-palabra'));
comprobar(terminos.includes('犬'), '«perro» encuentra 犬', `${terminos.slice(0, 6).join(' ')} · ${Math.round((Date.now() - inicio) / 1000)} s con el índice`);
comprobar(terminos[0] === '犬' && (await palabraCentral()).includes('犬'), 'Lo pone primero y lo abre en el centro', terminos[0]);
await p.screenshot({ path: join(CAPTURAS, '2-perro.png') });
const t2 = Date.now();
await ir('gato');
const gatos = await sinLectura(p.locator('.dic-lista', { hasText: 'Palabras que significan «gato»' }).locator('.dic-tarjeta-palabra'));
comprobar(gatos.includes('猫'), 'Con el índice ya hecho, «gato» encuentra 猫 al momento', `${Math.round(Date.now() - t2)} ms`);

// ---------- Gramática ----------

await ir('aunque');
const gramatica = p.locator('.ap-dic-seccion', { hasText: 'Gramática' });
const patrones = await gramatica.locator('.ap-patron-cab b').allTextContents();
comprobar(patrones[0]?.includes('〜ても') && patrones.length === 5, '«aunque» encuentra 〜ても y otros cuatro, con más debajo', patrones.join(' | '));
comprobar(await p.getByRole('button', { name: /Ver \d+ más/ }).first().isVisible(), 'Con «Ver más» para el resto');
await ir('わけではない');
const deForma = await p.locator('.ap-dic-seccion', { hasText: 'Gramática' }).locator('.ap-patron-cab b').first().textContent();
comprobar(deForma.includes('〜わけではない') && deForma.includes('N3'), 'Por su forma, con su nivel', deForma);
await p.locator('.ap-dic-seccion .ap-patron-cab').first().click();
await p.locator('.ap-dic-seccion .ap-patron-detalle').waitFor({ timeout: 10000 });
comprobar(await p.locator('.ap-dic-seccion .ap-patron-detalle button', { hasText: 'Explicar con Claude' }).isVisible(), 'Al abrirlo, sus ejemplos y la explicación de Claude');

// ---------- La palabra: sus sentidos y lo que la rodea ----------

// 橋 es un kanji suelto: abre su página de kanji, y como también es palabra, se puede ver como tal.
await ir('橋');
await p.locator('.dic-vista button', { hasText: 'Palabra' }).click();
await p.locator('.dic-ficha .ficha-palabra').waitFor({ timeout: 15000 });
comprobar((await palabraCentral()).includes('橋'), 'La palabra, en grande en el centro');
const sentidos = p.locator('.dic-ficha .lista-sentidos li');
comprobar((await sentidos.count()) >= 1, 'Sus sentidos, cada uno con sus glosas juntas', await sentidos.count());
const etiquetas = await p.locator('.dic-ficha .sentido-etiquetas span').allTextContents();
comprobar(etiquetas.includes('nombre'), 'Con su clase de palabra encima', etiquetas.join(' · '));
comprobar((await p.locator('.dic-ficha .ficha-panel').innerText()).trim() === '', 'Sin ninguna pestaña abierta de entrada: ni audio ni Claude');
const kanji = p.locator('.dic-lateral .dic-caracter-tarjeta').first();
await kanji.waitFor({ timeout: 15000 });
const textoKanji = await kanji.innerText();
comprobar(textoKanji.includes('橋') && /N\d/.test(textoKanji) && /bridge/i.test(textoKanji), 'A su lado, sus kanji con su nivel y su significado', textoKanji.replace(/\n/g, ' | '));
await tarjetas('Se leen igual').first().waitFor({ timeout: 15000 });
const homofonos = await sinLectura(tarjetas('Se leen igual'));
comprobar(homofonos.includes('箸') && homofonos.includes('端'), 'Y las palabras que se leen igual, en tarjetas: 箸 y 端', homofonos.join(' '));
await p.locator('.dic-lateral button', { hasText: 'Palabras parecidas' }).click();
await p.locator('.dic-lateral .panel-ia-texto').waitFor({ timeout: 15000 });
comprobar((await p.locator('.dic-lateral .panel-ia-texto').innerText()).length > 20, 'Claude explica las palabras parecidas cuando se pide');
await p.screenshot({ path: join(CAPTURAS, '3-palabra.png'), fullPage: true });

// Las que significan lo mismo salen del diccionario, sin Claude, con la lectura encima de la palabra.
await ir('食べる');
await tarjetas('Significan lo mismo').first().waitFor({ timeout: 90000 }).catch(() => {});
const sinonimos = await sinLectura(tarjetas('Significan lo mismo'));
comprobar(sinonimos.includes('食う') && !sinonimos.includes('食べる'), 'Y las que significan lo mismo, sin ella: 食う para 食べる', sinonimos.join(' '));
const kuu = p.locator('.dic-seccion', { hasText: 'Significan lo mismo' }).locator('.dic-tarjeta', { hasText: '食' }).first();
const [base, lectura] = await Promise.all([kuu.locator('ruby').first().boundingBox(), kuu.locator('rt').first().boundingBox()]);
comprobar(!!base && !!lectura && lectura.y + lectura.height <= base.y + base.height / 2, 'La lectura va encima de la palabra, no debajo', lectura && base ? `${Math.round(lectura.y)} sobre ${Math.round(base.y)}` : '');

// Escrito en kana: las palabras que se leen así, cada una por su lado, sin lo que solo empieza igual (野村).
await ir('のむ');
const nomu = await sinLectura(p.locator('.dic-lista .dic-tarjeta-palabra'));
comprobar(nomu[0] === '飲む' && nomu.includes('呑む'), 'のむ da 飲む y 呑む por separado, la común primero', nomu.join(' '));
comprobar(!nomu.some((x) => x.startsWith('野村')), 'Sin lo que solo empieza igual');
await p.locator('.dic-lista .dic-tarjeta', { hasText: '呑' }).first().click();
await p.waitForFunction(() => document.querySelector('.dic-ficha .ficha-palabra ruby')?.firstChild?.textContent === '呑', null, { timeout: 10000 }).catch(() => {});
comprobar((await palabraCentral()).includes('呑む'), 'Al tocar otra de la lista, se abre en el centro');

// Los opuestos salen de JMdict en inglés: solo si está instalado.
if (instalados.includes('jmdict-en')) {
  await ir('上手');
  await tarjetas('Opuestos').first().waitFor({ timeout: 15000 }).catch(() => {});
  const opuestos = await sinLectura(tarjetas('Opuestos'));
  comprobar(opuestos.includes('下手'), 'Sus opuestos: 下手 para 上手', opuestos.join(' '));
  const defs = await p.locator('.dic-ficha .sentidos').innerText();
  comprobar(!/antonym:/.test(defs), 'Y no se mezclan con las definiciones');
} else {
  console.log('(sin JMdict en inglés: no se prueban los opuestos)');
}

// ---------- Las frases donde la has visto, con su minuto ----------

// Una frase de un video de YouTube y otra de un video en una página cualquiera: las dos con su momento.
await motor('analizarLineas', [{ id: 'p1', inicio: 754_000, fin: 757_000, texto: '友達と話すのが好きです。' }], { titulo: FUENTE, url: VIDEO, idVideo: 'kotonohaDic' });
await motor('analizarLineas', [{ id: 'p2', inicio: 61_000, fin: 64_000, texto: '先生とゆっくり話してみました。' }], { titulo: FUENTE, url: OTRO_VIDEO, idVideo: 'otro' });
await p.waitForTimeout(800);
await ir('話す');
const frase = p.locator('.dic-frase', { hasText: '友達' }).first();
await frase.waitFor({ timeout: 15000 });
comprobar((await frase.locator('.dic-frase-momento').innerText()) === '12:34', 'Cada frase con el minuto en que sonó', await frase.locator('.dic-frase-momento').innerText());
comprobar((await frase.locator('.dic-resaltada').first().innerText()).includes('話'), 'La palabra buscada, resaltada en la frase');
comprobar((await frase.locator('rt').count()) > 0, 'Con la lectura encima de sus palabras');
const conjugada = p.locator('.dic-frase', { hasText: '先生' }).first();
comprobar((await conjugada.locator('.dic-resaltada').first().innerText().catch(() => '')).includes('話'), 'También donde va conjugada: 話して');
await p.screenshot({ path: join(CAPTURAS, '4-frases.png'), fullPage: true });

/** La pestaña que abrió «Volver a…»: se busca desde el servicio de fondo, con la dirección que pidió. */
const pestanaCon = (trozo) =>
  sw.evaluate(async (trozo) => {
    for (let i = 0; i < 40; i++) {
      const t = (await chrome.tabs.query({})).find((x) => (x.pendingUrl || x.url || '').includes(trozo));
      if (t) return { id: t.id, url: t.pendingUrl || t.url };
      await new Promise((r) => setTimeout(r, 150));
    }
    return null;
  }, trozo);
const cerrar = (t) => (t ? sw.evaluate((id) => chrome.tabs.remove(id).catch(() => {}), t.id) : null);

await frase.getByRole('button', { name: 'Volver a 12:34' }).click();
const enYoutube = await pestanaCon('kotonohaDic');
comprobar(!!enYoutube?.url.includes('t=754s'), '«Volver a 12:34» abre el video de YouTube en ese momento', enYoutube?.url ?? '');
await cerrar(enYoutube);
await p.bringToFront();
// Donde la dirección no lleva el momento, la pestaña lo pregunta al cargar: aquí se mira que quede dicho.
await conjugada.getByRole('button', { name: 'Volver a 1:01' }).click();
const enOtro = await pestanaCon('example.com');
const pendientes = await sw.evaluate(() => chrome.storage.session.get('momentosPendientes'));
const pendiente = enOtro ? pendientes.momentosPendientes?.[enOtro.id] : undefined;
comprobar(pendiente?.ms === 61_000, 'En otro sitio, abre el video y le deja dicho adónde saltar al cargar', JSON.stringify(pendiente ?? null));
await cerrar(enOtro);
await p.bringToFront();
await borrarFrases();

// ---------- La página de un kanji ----------

await ir('愛');
await p.locator('.dic-caracter').waitFor({ timeout: 20000 });
comprobar(/love/i.test(await p.locator('.dic-caracter-significado').innerText()), 'Un kanji suelto tiene su página: lo que significa');
comprobar((await p.locator('.dic-lecturas').innerText()).includes('アイ'), 'Sus lecturas');
await p.locator('.dic-pieza').first().waitFor({ timeout: 20000 }).catch(() => {});
const piezas = await p.locator('.dic-pieza b').allTextContents();
comprobar(piezas.includes('心') && (await p.locator('.dic-pieza.radical', { hasText: '心' }).count()) === 1, 'Sus piezas, con el radical señalado', piezas.join(' '));
comprobar((await p.locator('.trazos-lienzos.enormes svg').count()) === 1, 'Y cómo se escribe, trazo a trazo, en grande');
await tarjetas('Palabras con 愛').first().waitFor({ timeout: 90000 }).catch(() => {});
const conAi = await sinLectura(tarjetas('Palabras con 愛'));
comprobar(conAi.includes('恋愛') || conAi.includes('愛情'), 'Las palabras que lo llevan, las más usadas primero', conAi.slice(0, 6).join(' '));
comprobar((await p.locator('.dic-forma').count()) === 3, 'Y cómo se ve impreso, en letra de libro y a mano');
await p.screenshot({ path: join(CAPTURAS, '5-kanji.png'), fullPage: true });
await p.locator('.dic-vista button', { hasText: 'Palabra' }).click();
await p.locator('.dic-ficha .ficha-palabra').waitFor({ timeout: 10000 });
comprobar((await palabraCentral()).includes('愛'), 'Como también es palabra, se puede ver como tal');
await p.locator('.dic-vista button', { hasText: 'Kanji' }).click();
await p.locator('.dic-caracter').waitFor({ timeout: 10000 });

// ---------- Los ajustes a mano ----------

const escala = () => p.locator('.dic').evaluate((x) => getComputedStyle(x).getPropertyValue('--escala-dic').trim());
await p.getByRole('button', { name: 'Palabras más grandes' }).click();
await p.waitForFunction(() => getComputedStyle(document.querySelector('.dic')).getPropertyValue('--escala-dic').trim() === '1.1', null, { timeout: 5000 }).catch(() => {});
comprobar((await escala()) === '1.1', 'El tamaño de las palabras se cambia sin salir de la página', await escala());
await p.getByRole('button', { name: 'A todo el ancho' }).click();
await p.waitForTimeout(500);
comprobar(await p.locator('.dic.centrado').isVisible(), 'Y el ancho: a todo lo ancho o en una columna centrada');

// ---------- Categorías ----------

await ir('');
await p.locator('.ap-categoria', { hasText: 'Onomatopeyas' }).click();
await p.locator('.ap-categoria-vista .dic-tarjeta').first().waitFor({ timeout: 90000 });
const cuantas = await p.locator('.ap-categoria-vista .ayuda').first().textContent();
comprobar(Number(cuantas.replace(/\D/g, '')) > 500, 'Las onomatopeyas del diccionario, todas', cuantas);
comprobar((await p.locator('.ap-categoria-vista .dic-tarjeta').count()) === 100, 'De cien en cien, en tarjetas');
comprobar((await p.locator('.ap-categoria-vista .dic-tarjeta').first().locator('.dic-marca-comun').count()) === 1, 'Las de uso común primero');
await p.screenshot({ path: join(CAPTURAS, '6-onomatopeyas.png') });
const [primera] = await sinLectura(p.locator('.ap-categoria-vista .dic-tarjeta-palabra').first());
await p.locator('.ap-categoria-vista .dic-tarjeta').first().click();
await p.locator('.dic-ficha .ficha-palabra').first().waitFor({ timeout: 15000 });
comprobar(decodeURIComponent(p.url()).includes(`q=${primera}`), 'Al tocar una, se busca en el diccionario', primera);

comprobar(errores.length === 0, 'Sin errores en la página', errores.join(' | '));

await borrarFrases();
await sw.evaluate(async (previo) => {
  await chrome.storage.local.set({ ajustes: previo.ajustes });
  for (const clave of ['urlBaseIA', 'claveAnthropic']) {
    if (previo[clave] !== undefined) await chrome.storage.local.set({ [clave]: previo[clave] });
    else await chrome.storage.local.remove(clave);
  }
}, previo);
await contexto.close();
console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
