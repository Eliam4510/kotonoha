// Capturas de la interfaz sobre el video: subtítulos, isla, ficha, gramática, paneles, navegador y lector web.

import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';

const VTT_JA = `WEBVTT

00:00:01.000 --> 00:00:04.000
泥だらけの道でも花は咲いた

00:00:05.000 --> 00:00:08.000
授業の後は、たぶん日本語の勉強を続けると思います。

00:00:09.000 --> 00:00:12.000
赤い星と青い星を食べる夢を見た

00:00:14.000 --> 00:00:17.000
一日でも休むと、ペースが遅れてしまうので

00:00:18.000 --> 00:00:21.000
できるだけ毎日やるようにしています

00:00:42.000 --> 00:00:48.000
私はまだ立ち上がることができます
`;

const VTT_ES = `WEBVTT

00:00:01.000 --> 00:00:04.000
Incluso en un camino lleno de barro, la flor brotó

00:00:05.000 --> 00:00:08.000
Después de clase, probablemente seguiré estudiando japonés.

00:00:09.000 --> 00:00:12.000
Soñé que devoraba estrellas rojas y azules

00:00:14.000 --> 00:00:17.000
Si descanso aunque sea un día, me atraso

00:00:18.000 --> 00:00:21.000
Así que intento hacerlo todos los días

00:00:42.000 --> 00:00:48.000
Todavía puedo volver a levantarme
`;

const ARTICULO = `<!doctype html><html lang="ja"><meta charset="utf-8"><title>夏目漱石について</title>
<body style="margin:0;background:#fbfaf7;color:#222;font-family:'Yu Gothic UI',Meiryo,sans-serif">
<main style="max-width:760px;margin:60px auto;line-height:2;font-size:19px">
<h1 style="font-size:30px;margin:0 0 20px">夏目漱石について</h1>
<p id="p1">吾輩は猫である。名前はまだ無い。どこで生れたかとんと見当がつかぬ。</p>
<p>何でも薄暗いじめじめした所でニャーニャー泣いていた事だけは記憶している。吾輩はここで始めて人間というものを見た。しかもあとで聞くとそれは書生という人間中で一番獰悪な種族であったそうだ。</p>
<p>この書生というのは時々我々を捕えて煮て食うという話である。しかしその当時は何という考もなかったから別段恐しいとも思わなかった。</p>
</main></body></html>`;

export function servidor(RAIZ) {
  const pagina = `<!doctype html><html lang="ja"><meta charset="utf-8"><title>夜明けの星 — Episodio 1</title>
    <body style="margin:0;background:#0b0b0d;color:#eee;font-family:sans-serif">
    <video id="v" src="/video.webm" muted crossorigin="anonymous" style="position:fixed;inset:0;width:100%;height:100%;object-fit:contain;background:#000">
      <track kind="subtitles" srclang="ja" label="日本語" src="/ja.vtt"><track kind="subtitles" srclang="es" label="Español" src="/es.vtt">
    </video>
    </body></html>`;
  return new Promise((ok) => {
    const s = createServer((req, res) => {
      res.setHeader('access-control-allow-origin', '*');
      if (req.url === '/') {
        res.setHeader('content-type', 'text/html; charset=utf-8');
        res.end(pagina);
      } else if (req.url === '/largo') {
        res.setHeader('content-type', 'text/html; charset=utf-8');
        res.end(pagina.replace('/ja.vtt', '/ja-largo.vtt'));
      } else if (req.url === '/ja-largo.vtt') {
        // Muchas líneas distintas: la revisión de Claude va por tandas y se ve su progreso.
        const dos = (n) => String(n).padStart(2, '0');
        const cues = Array.from({ length: 150 }, (_, i) => `00:${dos(Math.floor(i / 60))}:${dos(i % 60)}.000 --> 00:${dos(Math.floor(i / 60))}:${dos(i % 60)}.900\n第${i + 1}話の星を食べる`);
        res.setHeader('content-type', 'text/vtt; charset=utf-8');
        res.end(`WEBVTT\n\n${cues.join('\n\n')}\n`);
      } else if (req.url === '/sin-subs') {
        res.setHeader('content-type', 'text/html; charset=utf-8');
        res.end(pagina.replace(/<track[^>]*>/g, ''));
      } else if (req.url === '/articulo') {
        res.setHeader('content-type', 'text/html; charset=utf-8');
        res.end(ARTICULO);
      } else if (req.url === '/ja.vtt' || req.url === '/es.vtt') {
        res.setHeader('content-type', 'text/vtt; charset=utf-8');
        res.end(req.url === '/ja.vtt' ? VTT_JA : VTT_ES);
      } else if (req.url === '/video.webm') {
        const datos = readFileSync(join(RAIZ, 'pruebas', 'fixtures', 'video.webm'));
        res.setHeader('content-type', 'video/webm');
        res.setHeader('accept-ranges', 'bytes');
        const r = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? '');
        if (r) {
          const ini = +r[1];
          const fin = r[2] ? +r[2] : datos.length - 1;
          res.statusCode = 206;
          res.setHeader('content-range', `bytes ${ini}-${fin}/${datos.length}`);
          res.end(datos.subarray(ini, fin + 1));
        } else res.end(datos);
      } else {
        res.statusCode = 404;
        res.end();
      }
    });
    s.listen(0, '127.0.0.1', () => ok(s));
  });
}

const RAIZ_OVERLAY = `document.querySelector('kotonoha-overlay').shadowRoot`;

export async function capturarOverlay({ RAIZ, ANCHO, ALTO, contexto, sw, vigilar, foto }) {
  const s = await servidor(RAIZ);
  const p = await contexto.newPage();
  vigilar(p, 'overlay');
  const origen = `http://127.0.0.1:${s.address().port}`;

  const enOverlay = (codigo) => p.evaluate(`(() => { const r = ${RAIZ_OVERLAY}; ${codigo} })()`);
  const esperar = (selector, tiempo = 15000) =>
    p
      .waitForFunction((sel) => document.querySelector('kotonoha-overlay')?.shadowRoot?.querySelector(sel), selector, { timeout: tiempo })
      .catch(() => console.log('no apareció:', selector));
  /** Pulsa un botón de la barra o de un panel por su nombre accesible o su título. */
  const pulsar = (nombre) => enOverlay(`r.querySelector('button[aria-label="${nombre}"], button[title="${nombre}"], button[data-tip="${nombre}"]')?.click();`);
  const mostrarBarra = async () => {
    await p.mouse.move(ANCHO / 2, 3);
    await p.waitForTimeout(450);
  };
  const buscarSegundo = async (t) => {
    await p.evaluate((x) => (document.querySelector('#v').currentTime = x), t);
    await p.waitForTimeout(800);
  };
  const cajaDePalabra = (texto) => enOverlay(`const e = [...r.querySelectorAll('.linea-sub.objetivo .pal')].find((x) => x.textContent.includes('${texto}')); if (!e) return null; const c = e.getBoundingClientRect(); return { x: c.left + c.width / 2, y: c.top + c.height / 2 };`);

  // Las respuestas guardadas de la vez anterior cambiarían lo que se ve en cada captura.
  await sw.evaluate(async () => {
    if (!(await indexedDB.databases()).some((d) => d.name === 'kikitori')) return;
    await new Promise((ok) => {
      const q = indexedDB.open('kikitori');
      q.onsuccess = () => {
        const d = q.result;
        if (!d.objectStoreNames.contains('cacheIA')) {
          d.close();
          return ok();
        }
        const tx = d.transaction('cacheIA', 'readwrite');
        tx.objectStore('cacheIA').clear();
        tx.oncomplete = () => {
          d.close();
          ok();
        };
      };
    });
  });

  await p.goto(`${origen}/`);
  await p.waitForTimeout(700);
  await sw.evaluate(async () => {
    const [t] = await chrome.tabs.query({ url: 'http://127.0.0.1/*' });
    // El script de la página puede tardar un poco más en estar listo si el equipo está ocupado.
    for (let intento = 0; ; intento++) {
      try {
        await chrome.tabs.sendMessage(t.id, { activarVideoAqui: true });
        break;
      } catch (e) {
        if (intento > 40) throw e;
        await new Promise((r) => setTimeout(r, 250));
      }
    }
  });
  await esperar('.barra');
  await buscarSegundo(2);
  await esperar('.linea-sub.objetivo .pal', 30000);
  await p.waitForTimeout(2000); // Da tiempo al análisis profundo simulado

  await buscarSegundo(10);
  await esperar('.linea-sub.objetivo .pal');
  await foto(p, '01-subtitulos');

  await buscarSegundo(6);
  await foto(p, '01a-subtitulos-gramatica');

  await buscarSegundo(44);
  await foto(p, '01b-subtitulos-fondo-claro');

  const cajaLarga = await cajaDePalabra('立');
  if (cajaLarga) {
    await p.mouse.move(cajaLarga.x, cajaLarga.y);
    await p.waitForTimeout(1300);
    await foto(p, '01d-ficha-palabra-larga');
    await p.mouse.move(30, ALTO - 30);
    await p.waitForTimeout(500);
  }

  // Sin fondo: el texto debe seguir leyéndose sobre la escena clara.
  await sw.evaluate(async () => {
    const d = await chrome.storage.local.get('ajustes');
    await chrome.storage.local.set({ ajustes: { ...d.ajustes, sombra: false } });
  });
  await p.waitForTimeout(500);
  await foto(p, '01c-subtitulos-sin-fondo');
  await sw.evaluate(async () => {
    const d = await chrome.storage.local.get('ajustes');
    await chrome.storage.local.set({ ajustes: { ...d.ajustes, sombra: true } });
  });
  await p.waitForTimeout(300);

  // Arrastrar los subtítulos: a media maniobra se ven las guías.
  const bloque = await enOverlay(`const c = r.querySelector('.subs-bloque:not(.saliendo)').getBoundingClientRect(); return { x: c.left, y: c.top, w: c.width, h: c.height };`);
  await p.mouse.move(bloque.x + 6, bloque.y + bloque.h / 2);
  await p.waitForTimeout(150);
  await foto(p, '01d-subtitulos-asa');
  await p.mouse.down();
  await p.mouse.move(bloque.x - 60, bloque.y - 150, { steps: 8 });
  await p.waitForTimeout(120);
  await p.mouse.move(bloque.x + 6, bloque.y - 200, { steps: 4 });
  await p.waitForTimeout(150);
  await foto(p, '01e-subtitulos-moviendo');
  await p.mouse.up();
  await p.waitForTimeout(200);
  await foto(p, '01f-subtitulos-movidos');
  await sw.evaluate(async () => {
    const d = await chrome.storage.local.get('ajustes');
    await chrome.storage.local.set({ ajustes: { ...d.ajustes, subsPosicion: null } });
  });
  await p.mouse.move(30, ALTO - 30);
  await p.waitForTimeout(400);

  await buscarSegundo(10);
  await mostrarBarra();
  await foto(p, '02-barra');
  const cajaTraductor = await enOverlay(`const c = r.querySelector('button[aria-label="Traductor"]').getBoundingClientRect(); return { x: c.left + c.width / 2, y: c.top + c.height / 2 };`);
  await p.mouse.move(cajaTraductor.x, cajaTraductor.y);
  await p.waitForTimeout(600);
  await foto(p, '02b-barra-herramienta');
  await p.mouse.move(30, ALTO - 30);
  await p.waitForTimeout(700);
  await foto(p, '02c-barra-oculta');

  await buscarSegundo(2);
  const cajaFlexion = await cajaDePalabra('咲');
  if (cajaFlexion) {
    await p.mouse.move(cajaFlexion.x, cajaFlexion.y);
    await p.waitForTimeout(1300);
    await enOverlay(`const c = r.querySelector('.ficha-cuerpo'); c.scrollTop = 170;`);
    await foto(p, '03d-ficha-conjugacion');
    await p.mouse.move(30, ALTO - 30);
    await p.waitForTimeout(500);
  }
  await buscarSegundo(10);

  // Una palabra que Claude aún no ha visto: solo el diccionario, y un botón para preguntar.
  const cajaNueva = await cajaDePalabra('赤');
  await p.mouse.move(cajaNueva.x, cajaNueva.y);
  await esperar('.sentido-pedir', 2500);
  await foto(p, '03a-ficha-diccionario');
  await enOverlay(`r.querySelector('.sentido-pedir button').click();`);
  await esperar('.sentido.cargando', 2500);
  await foto(p, '03a2-ficha-cargando');
  await p.mouse.move(30, ALTO - 30);
  await p.waitForTimeout(500);

  const caja = await cajaDePalabra('食');
  await p.mouse.move(caja.x, caja.y);
  await esperar('.ficha');
  await p.waitForTimeout(1700);
  await foto(p, '03-ficha');
  await p.mouse.click(caja.x, caja.y); // Fija la ficha para poder recorrer las pestañas.
  await p.waitForTimeout(200);
  // La primera vez responde Claude; la segunda sale de lo guardado, y lo dice.
  await pulsar('Explicar con Claude');
  await p.waitForTimeout(1500);
  await foto(p, '03b-ficha-explicacion');
  await pulsar('Audio');
  await p.waitForTimeout(300);
  await pulsar('Explicar con Claude');
  await esperar('.panel-ia-guardada', 3000);
  await p.waitForTimeout(500);
  await foto(p, '03g-ficha-guardada');
  for (const [titulo, nombre] of [
    ['Desglose de la frase', '04-ficha-desglose'],
    ['Traducir la frase', '05-ficha-traduccion'],
    ['Audio', '06-ficha-audio'],
    ['Frases de ejemplo de lo que has visto', '06b-ficha-ejemplos'],
    ['Enlaces externos', '07-ficha-enlaces'],
  ]) {
    await pulsar(titulo);
    await p.waitForTimeout(900);
    await foto(p, nombre);
  }
  await pulsar('¿Lectura incorrecta?');
  await p.waitForTimeout(400);
  await foto(p, '07b-ficha-corregir');
  await pulsar('¿Lectura incorrecta?');
  // Pulsar 3 debe reflejarse en la ficha abierta.
  await p.keyboard.press('3');
  await p.waitForTimeout(500);
  console.log('estado tras pulsar 3:', await enOverlay(`return r.querySelector('.estado.activo')?.textContent;`));
  await p.keyboard.press('1');
  await p.waitForTimeout(500);
  await enOverlay(`r.querySelector('.estado.conocida')?.click();`);
  await p.waitForTimeout(260);
  await foto(p, '07c-ficha-conocida');
  await enOverlay(`r.querySelector('.estado.desconocida')?.click();`);
  await p.keyboard.press('Escape');
  await p.mouse.move(30, ALTO - 30);
  await p.waitForTimeout(500);

  await buscarSegundo(6);
  await enOverlay(`r.querySelector('.fila-gram .chip-gram')?.click();`);
  await p.waitForTimeout(900);
  await foto(p, '08-gramatica');
  await pulsar('Cerrar');

  for (const [titulo, nombre] of [
    ['Ajustes de visualización', '09-panel-visual'],
    ['Atajos de teclado', '11-panel-atajos'],
    ['Generar subtítulos', '12-panel-generar'],
    ['Traductor', '13-panel-traductor'],
  ]) {
    await mostrarBarra();
    await pulsar(titulo);
    await foto(p, nombre);
    await p.keyboard.press('Escape');
  }

  await mostrarBarra();
  await pulsar('Ajustes de video');
  for (const [pestana, nombre] of [
    ['Reproducción', '10a-video-reproduccion'],
    ['Subtítulos', '10b-video-subtitulos'],
    ['Sincronizar', '10c-video-sincronizar'],
    ['Interacción', '10d-video-interaccion'],
  ]) {
    await enOverlay(`[...r.querySelectorAll('.panel-pestanas button')].find((b) => b.textContent.includes('${pestana}'))?.click();`);
    await foto(p, nombre);
  }
  await enOverlay(`[...r.querySelectorAll('.panel-pestanas button')].find((b) => b.textContent.includes('Reproducción'))?.click();`);
  await enOverlay(`[...r.querySelectorAll('.modo')].find((b) => b.textContent.includes('Personalizado'))?.click();`);
  await foto(p, '10e-video-personalizado');
  await enOverlay(`[...r.querySelectorAll('.modo')].find((b) => b.textContent.includes('Normal'))?.click();`);
  await p.keyboard.press('Escape');

  await mostrarBarra();
  await pulsar('Comprensión');
  await foto(p, '14-panel-comprension');
  await p.keyboard.press('Escape');

  await p.keyboard.press('g');
  await p.waitForTimeout(900);
  await foto(p, '15-navegador');
  await enOverlay(`r.querySelector('button[aria-label="Filtros"]')?.click();`);
  await foto(p, '15b-navegador-filtros');
  await enOverlay(`r.querySelector('button[aria-label="Filtros"]')?.click();`);
  const cajaNav = await enOverlay(`const e = r.querySelector('.nav-linea.activa') ?? r.querySelector('.nav-linea'); const c = e.getBoundingClientRect(); return { x: c.left + c.width / 2, y: c.top + 30 };`);
  await p.mouse.move(cajaNav.x, cajaNav.y);
  await foto(p, '15c-navegador-hover');
  await enOverlay(`r.querySelector('.nav-linea.activa button[aria-label="Seleccionar"]')?.click(); r.querySelectorAll('.nav-linea')[2]?.querySelector('button[aria-label="Seleccionar"]')?.click();`);
  await foto(p, '15e-navegador-seleccion');
  await enOverlay(`[...r.querySelectorAll('.nav-pie button')].find((b) => b.textContent.includes('Limpiar'))?.click();`);
  const cajaConNav = await cajaDePalabra('授');
  if (cajaConNav) {
    await p.mouse.move(cajaConNav.x, cajaConNav.y);
    await p.waitForTimeout(1100);
    await foto(p, '15d-ficha-con-navegador');
  }
  await p.mouse.move(ANCHO / 3, ALTO / 3);
  await p.waitForTimeout(400);
  await p.keyboard.press('g');
  await p.waitForTimeout(300);

  // Aviso y zona de soltar.
  await p.keyboard.press('c');
  await p.waitForTimeout(400);
  await foto(p, '16-aviso');
  await p.evaluate(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(['1'], 'subtitulos.srt'));
    window.dispatchEvent(new DragEvent('dragenter', { dataTransfer: dt, bubbles: true }));
  });
  await foto(p, '17-zona-soltar');
  await p.evaluate(() => window.dispatchEvent(new DragEvent('dragleave', { bubbles: true })));

  // Sin conexión con Claude: la explicación debe ofrecer una salida.
  // (Antes: cambiar el tamaño de la ficha con el asa.)
  await buscarSegundo(10);
  const cajaAsa = await cajaDePalabra('青');
  await p.mouse.move(cajaAsa.x, cajaAsa.y);
  await p.waitForTimeout(1300);
  const asa = await enOverlay(`const c = r.querySelector('.ficha-asa').getBoundingClientRect(); return { x: c.left + c.width / 2, y: c.top + c.height / 2 };`);
  await p.mouse.move(asa.x, asa.y);
  await p.waitForTimeout(250);
  await foto(p, '03e-ficha-asa');
  await p.mouse.down();
  await p.mouse.move(asa.x + 160, asa.y + 90, { steps: 6 });
  await p.mouse.up();
  await p.waitForTimeout(250);
  await foto(p, '03f-ficha-redimensionada');
  console.log('tamaño de la ficha tras arrastrar:', await enOverlay(`const c = r.querySelector('.popup-palabra').getBoundingClientRect(); return Math.round(c.width) + 'x' + Math.round(c.height);`));
  await p.keyboard.press('Escape');
  await p.mouse.move(30, ALTO - 30);
  await p.waitForTimeout(400);

  const urlBuena = await sw.evaluate(async () => (await chrome.storage.local.get('urlBaseIA')).urlBaseIA);
  await sw.evaluate(async () => chrome.storage.local.set({ urlBaseIA: 'http://127.0.0.1:9' }));
  await p.waitForTimeout(400);
  await buscarSegundo(15);
  const cajaError = await cajaDePalabra('休');
  if (cajaError) {
    await p.mouse.move(cajaError.x, cajaError.y);
    await p.waitForTimeout(4000);
    await foto(p, '20-error-ia');
    await p.mouse.move(30, ALTO - 30);
    await p.waitForTimeout(400);
  }
  await sw.evaluate(async (u) => chrome.storage.local.set({ urlBaseIA: u }), urlBuena);

  await p.close();

  // Un video sin subtítulos: estados vacíos de la isla y del navegador.
  const v = await contexto.newPage();
  vigilar(v, 'sin-subtitulos');
  await v.goto(`${origen}/sin-subs`);
  await v.waitForTimeout(700);
  await sw.evaluate(async () => {
    const [t] = await chrome.tabs.query({ url: 'http://127.0.0.1/sin-subs' });
    await chrome.tabs.sendMessage(t.id, { activarVideoAqui: true });
  });
  await v.waitForTimeout(2500);
  await v.mouse.move(ANCHO / 2, 3);
  await v.waitForTimeout(500);
  await v.keyboard.press('g');
  await v.waitForTimeout(700);
  await foto(v, '19-sin-subtitulos');
  await v.keyboard.press('g');
  await v.close();

  // La revisión de Claude en marcha, con un guion largo y el simulador lento.
  if (process.env.KK_MOCK_RETARDO_ANALISIS) {
    const l = await contexto.newPage();
    vigilar(l, 'revision');
    await l.goto(`${origen}/largo`);
    await l.waitForTimeout(700);
    await sw.evaluate(async () => {
      const [t] = await chrome.tabs.query({ url: 'http://127.0.0.1/largo' });
      await chrome.tabs.sendMessage(t.id, { activarVideoAqui: true });
    });
    await l.mouse.move(ANCHO / 2, 3);
    await l.waitForFunction(() => document.querySelector('kotonoha-overlay')?.shadowRoot?.querySelector('.barra-proceso'), undefined, { timeout: 45000 }).catch(() => console.log('no apareció la revisión'));
    await foto(l, '02a-barra-revisando');
    await l.mouse.move(ANCHO / 2, ALTO / 2);
    await l.close();
  }

  // Lector de páginas web: Mayús + pasar el ratón sobre una palabra.
  const w = await contexto.newPage();
  vigilar(w, 'lector-web');
  await w.goto(`${origen}/articulo`);
  await w.waitForTimeout(900);
  const parrafo = await w.evaluate(() => {
    const c = document.querySelector('#p1').getBoundingClientRect();
    return { x: c.left + 60, y: c.top + 18 };
  });
  await w.keyboard.down('Shift');
  await w.mouse.move(parrafo.x, parrafo.y);
  await w.mouse.move(parrafo.x + 2, parrafo.y);
  await w.waitForTimeout(1500);
  await w.keyboard.up('Shift');
  await foto(w, '18-lector-web');
  await w.close();

  s.close();
}
