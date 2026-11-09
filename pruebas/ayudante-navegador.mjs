// Prueba el camino completo del ayudante desde el panel: extensión, puente del service worker, el ayudante de
// PowerShell con su lanzador .cmd, yt-dlp, la conversión (con FFmpeg en el ayudante o, con KK_SIN_FFMPEG=1, con el
// FFmpeg de la extensión), Whisper en la GPU y los subtítulos en pantalla. No toca el registro ni sale a internet: lo
// único simulado es `connectNative`, que aquí lanza el mismo programa y le pasa los mismos mensajes, y el video se
// descarga de un servidor en este mismo equipo.
//
// Uso: KK_SALIDA=.dist-whisper node build.mjs && KK_HERRAMIENTAS=carpeta-con-yt-dlp-y-qjs node pruebas/ayudante-navegador.mjs video.mp4 [segundos]

import { copyFileSync, createReadStream, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';
import { iniciarMock } from './mock-claude.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-whisper'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-whisper'));
const SIN_FFMPEG = !!process.env.KK_SIN_FFMPEG;
const SALIDA = join(RAIZ, 'capturas-e2e', SIN_FFMPEG ? 'ayudante-sin-ffmpeg' : 'ayudante');
const [video, segundosTexto = '150'] = process.argv.slice(2);
mkdirSync(SALIDA, { recursive: true });

// El ayudante, preparado por su instalador en una carpeta temporal y sin tocar el registro.
const trabajo = mkdtempSync(join(tmpdir(), 'kkprueba-navegador-'));
const carpetaAyudante = join(trabajo, 'ayudante');
{
  const herramientas = process.env.KK_HERRAMIENTAS;
  execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(RAIZ, 'herramientas', 'ayudante', 'instalar.ps1'), '-Carpeta', carpetaAyudante, '-SinRegistro', '-SinExtension', ...(herramientas ? ['-SinDescargas'] : [])]);
  if (herramientas) {
    copyFileSync(join(herramientas, 'yt-dlp.exe'), join(carpetaAyudante, 'yt-dlp.exe'));
    copyFileSync(join(herramientas, 'qjs.exe'), join(carpetaAyudante, 'qjs.exe'));
    writeFileSync(join(carpetaAyudante, 'yt-dlp.comprobado'), new Date().toISOString());
  }
}

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};

// Un extracto: el camino es el mismo y la prueba tarda menos.
const extracto = join(SALIDA, `extracto-${segundosTexto}.mp4`);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', video, '-t', segundosTexto, '-c', 'copy', extracto]);
const tam = statSync(extracto).size;

const PAGINA = `<!doctype html><meta charset="utf-8"><title>心理学の講義</title>
<body style="margin:0;background:#111"><video id="v" src="/extracto.mp4" controls muted style="width:100vw;height:100vh"></video>`;

const sitio = createServer((peticion, respuesta) => {
  if (peticion.url.startsWith('/extracto.mp4')) {
    const rango = /bytes=(\d+)-(\d*)/.exec(peticion.headers.range ?? '');
    if (rango) {
      const desde = Number(rango[1]);
      const hasta = rango[2] ? Number(rango[2]) : tam - 1;
      respuesta.writeHead(206, { 'Content-Type': 'video/mp4', 'Content-Length': hasta - desde + 1, 'Content-Range': `bytes ${desde}-${hasta}/${tam}`, 'Accept-Ranges': 'bytes' });
      createReadStream(extracto, { start: desde, end: hasta }).pipe(respuesta);
    } else {
      respuesta.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': tam, 'Accept-Ranges': 'bytes' });
      if (peticion.method === 'HEAD') respuesta.end();
      else createReadStream(extracto).pipe(respuesta);
    }
    return;
  }
  respuesta.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  respuesta.end(PAGINA);
});
await new Promise((ok) => sitio.listen(0, '127.0.0.1', ok));
const urlSitio = `http://127.0.0.1:${sitio.address().port}/pagina.html`;

// ---------- Lo que haría el navegador con connectNative: lanzar el programa y hablar por sus tuberías ----------

const nativos = new Map();
let contador = 0;
const puente = createServer((peticion, respuesta) => {
  respuesta.setHeader('access-control-allow-origin', '*');
  respuesta.setHeader('access-control-allow-headers', '*');
  if (peticion.method === 'OPTIONS') return respuesta.end();
  const u = new URL(peticion.url, 'http://x');
  const id = Number(u.searchParams.get('id'));
  if (u.pathname === '/abrir') {
    const n = ++contador;
    const p = spawn('cmd.exe', ['/d', '/c', join(carpetaAyudante, 'kotonoha_ayudante.cmd'), 'chrome-extension://pldipbgollbhkjjigkgnojdjpfhanhhf/', '--parent-window=0'], {
      stdio: ['pipe', 'pipe', 'inherit'],
      env: { ...process.env, ...(SIN_FFMPEG ? { KOTONOHA_SIN_FFMPEG: '1' } : {}) },
    });
    const estado = { p, cola: [], fin: false, avisar: null, bufer: Buffer.alloc(0) };
    p.stdout.on('data', (d) => {
      estado.bufer = Buffer.concat([estado.bufer, d]);
      while (estado.bufer.length >= 4) {
        const largo = estado.bufer.readUInt32LE(0);
        if (estado.bufer.length < 4 + largo) break;
        estado.cola.push(JSON.parse(estado.bufer.toString('utf8', 4, 4 + largo)));
        estado.bufer = estado.bufer.subarray(4 + largo);
      }
      estado.avisar?.();
    });
    p.on('exit', () => {
      estado.fin = true;
      estado.avisar?.();
    });
    nativos.set(n, estado);
    return respuesta.end(JSON.stringify({ id: n }));
  }
  const estado = nativos.get(id);
  if (!estado) return respuesta.end('{}');
  if (u.pathname === '/recibir') {
    const contestar = () => {
      estado.avisar = null;
      const mensajes = estado.cola.splice(0);
      respuesta.end(JSON.stringify({ mensajes, fin: estado.fin && !mensajes.length }));
    };
    if (estado.cola.length || estado.fin) contestar();
    else estado.avisar = contestar;
    return;
  }
  if (u.pathname === '/cerrar') {
    estado.p.stdin.end();
    return respuesta.end('{}');
  }
  if (u.pathname === '/enviar') {
    let cuerpo = '';
    peticion.on('data', (c) => (cuerpo += c));
    peticion.on('end', () => {
      const datos = Buffer.from(cuerpo, 'utf8');
      const cabecera = Buffer.alloc(4);
      cabecera.writeUInt32LE(datos.length);
      estado.p.stdin.write(Buffer.concat([cabecera, datos]));
      respuesta.end('{}');
    });
  }
});
await new Promise((ok) => puente.listen(0, '127.0.0.1', ok));

const mock = await iniciarMock();
const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: 1280, height: 720 },
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const sw = await recargarExtension(contexto);
await sw.evaluate(
  async ({ url, base }) => {
    const d = await chrome.storage.local.get('ajustes');
    await chrome.storage.local.set({ urlBaseIA: url, claveAnthropic: 'clave-de-prueba', ajustes: { ...(d.ajustes ?? {}), navegadorAbierto: true, modo: 'normal', salto: 'no', whisperModelo: 'turbo', whisperIntensidad: 'auto', analisisAutomatico: false } });
    const simulado = () => {
      const alRecibir = [];
      const alCerrar = [];
      let cerrado = false;
      const abierto = fetch(`${base}/abrir`, { method: 'POST' }).then((r) => r.json()).then((r) => r.id);
      let cola = abierto;
      (async () => {
        const id = await abierto;
        for (;;) {
          const r = await (await fetch(`${base}/recibir?id=${id}`)).json();
          for (const m of r.mensajes) alRecibir.forEach((f) => f(m));
          if (r.fin) {
            if (!cerrado) alCerrar.forEach((f) => f());
            return;
          }
        }
      })();
      return {
        postMessage: (m) => {
          cola = cola.then(async (id) => {
            await fetch(`${base}/enviar?id=${id}`, { method: 'POST', body: JSON.stringify(m) });
            return id;
          });
        },
        disconnect: () => {
          cerrado = true;
          cola.then((id) => fetch(`${base}/cerrar?id=${id}`, { method: 'POST' }));
        },
        onMessage: { addListener: (f) => alRecibir.push(f) },
        onDisconnect: { addListener: (f) => alCerrar.push(f) },
      };
    };
    Object.defineProperty(chrome.runtime, 'connectNative', { value: simulado, configurable: true, writable: true });
  },
  { url: `http://127.0.0.1:${mock.puerto}`, base: `http://127.0.0.1:${puente.address().port}` }
);

const enOverlay = (p, fn, arg) =>
  p.evaluate(
    ({ fn, arg }) => {
      const r = document.querySelector('kotonoha-overlay')?.shadowRoot;
      return r ? new Function('r', 'arg', `return (${fn})(r, arg)`)(r, arg) : null;
    },
    { fn: fn.toString(), arg }
  );

async function hasta(p, fn, arg, ms) {
  const limite = Date.now() + ms;
  for (;;) {
    const v = await enOverlay(p, fn, arg).catch(() => null);
    if (v) return v;
    if (Date.now() > limite) return null;
    await p.waitForTimeout(150);
  }
}

const pulsar = (p, texto) =>
  enOverlay(
    p,
    (r, t) => {
      const b = [...r.querySelectorAll('.panel-generar button')].find((x) => x.textContent.includes(t) && !x.disabled);
      b?.click();
      return !!b;
    },
    texto
  );

const temporales = () => readdirSync(tmpdir()).filter((n) => n.startsWith('kotonoha-'));
const antes = new Set(temporales());

const p = await contexto.newPage();
await p.goto(urlSitio);
await p.waitForTimeout(1000);
await sw.evaluate(async () => {
  const [t] = await chrome.tabs.query({ url: 'http://127.0.0.1/*' });
  await chrome.tabs.sendMessage(t.id, { activarVideoAqui: true });
});
comprobar(!!(await hasta(p, (r) => r.querySelector('.barra') != null, undefined, 20000)), 'Se monta el overlay en la página');
await p.mouse.move(500, 2);
await p.waitForTimeout(300);
await enOverlay(p, (r) => r.querySelector('.barra-acciones button[aria-label="Generar subtítulos"]')?.click());

const detectado = await hasta(p, (r) => r.querySelector('.panel-generar')?.textContent.includes('Transcribir el video'), undefined, 15000);
comprobar(!!detectado, 'El panel detecta el ayudante y ofrece transcribir sin reproducir');
const textoPanel = await enOverlay(p, (r) => r.querySelector('.panel-generar')?.textContent ?? '');
comprobar(textoPanel.includes('Transcribir mientras se reproduce'), 'Y deja la opción de hacerlo al reproducir');
comprobar(!textoPanel.includes('Alt'), 'Ya no pide activar la captura de audio');
await p.screenshot({ path: join(SALIDA, 'panel-con-ayudante.png') });

const t0 = Date.now();
await pulsar(p, 'Transcribir el video');
const bajando = await hasta(p, (r) => /Bajando el audio|Extrayendo el audio|Preparando|Transcribiendo/.test(r.querySelector('.panel-generar .progreso-linea')?.textContent ?? ''), undefined, 15000);
comprobar(!!bajando, 'Muestra el avance en el panel', String(await enOverlay(p, (r) => r.querySelector('.panel-generar .progreso-linea')?.textContent ?? '')).slice(0, 60));

const primeras = await hasta(p, (r) => r.querySelectorAll('.nav-linea').length > 0, undefined, 120000);
comprobar(!!primeras, 'Los subtítulos van apareciendo sin reproducir el video', `a los ${((Date.now() - t0) / 1000).toFixed(0)} s`);
const enPausa = await p.evaluate(() => document.querySelector('#v').paused);
comprobar(enPausa, 'El video sigue parado');
await p.screenshot({ path: join(SALIDA, 'transcribiendo.png') });

const limite = Number(segundosTexto) * 1000;
const terminado = await hasta(p, (r) => !r.querySelector('.panel-generar .progreso-linea') && r.querySelectorAll('.nav-linea').length > 0, undefined, Math.max(limite, 120000));
const ms = Date.now() - t0;
comprobar(!!terminado, 'Termina la transcripción', `${(ms / 1000).toFixed(0)} s para ${segundosTexto} s de video: ${(Number(segundosTexto) / (ms / 1000)).toFixed(1)} veces más rápido`);
await p.waitForTimeout(1500);
const lineas = await enOverlay(p, (r) =>
  [...r.querySelectorAll('.nav-linea')].map((l) => {
    const c = l.cloneNode(true);
    c.querySelectorAll('rt, rp').forEach((x) => x.remove());
    return c.textContent;
  })
);
comprobar(lineas.length >= Number(segundosTexto) / 8, 'Hay líneas de todo el extracto', `${lineas.length} líneas`);
console.log('  ', lineas.slice(0, 4).join('\n   '));
comprobar(mock.peticiones.some((x) => x.cuerpo.output_config?.format?.schema?.properties?.correcciones), 'Al terminar, Claude corrige el resultado');
await p.screenshot({ path: join(SALIDA, 'terminado.png') });

await new Promise((r) => setTimeout(r, 1500));
const quedan = temporales().filter((n) => !antes.has(n));
comprobar(quedan.length === 0, 'Al terminar se borra el audio temporal', quedan.join(', '));
comprobar([...nativos.values()].every((n) => n.fin), 'Y el programa se cierra');

// ---------- Detener a medias ----------
const nativosAntes = nativos.size;
await enOverlay(p, (r) => r.querySelector('.panel-generar') == null && r.querySelector('.barra-acciones button[aria-label="Generar subtítulos"]')?.click());
await p.waitForTimeout(400);
await sw.evaluate(async () => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), whisperCorregir: false } });
});
await pulsar(p, 'Transcribir el video');
await hasta(p, (r) => /Transcribiendo|Preparando|Bajando|Extrayendo/.test(r.querySelector('.panel-generar .progreso-linea')?.textContent ?? ''), undefined, 15000);
await p.waitForTimeout(2500);
await enOverlay(p, (r) => [...r.querySelectorAll('.panel-generar .progreso-linea button')].find((x) => x.textContent.includes('Detener'))?.click());
await hasta(p, (r) => !r.querySelector('.panel-generar .progreso-linea'), undefined, 20000);
await new Promise((r) => setTimeout(r, 2000));
comprobar(nativos.size > nativosAntes, 'Volver a transcribir vuelve a usar el ayudante');
const trasDetener = temporales().filter((n) => !antes.has(n));
comprobar(trasDetener.length === 0, 'Detener no deja archivos temporales', trasDetener.join(', '));
comprobar([...nativos.values()].every((n) => n.fin), 'Ni procesos abiertos');

await sw.evaluate(async () => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), whisperCorregir: true } });
});
await contexto.close();
sitio.close();
puente.close();
rmSync(trabajo, { recursive: true, force: true });
console.log(`\n${fallos ? `${fallos} comprobaciones fallaron` : 'Todas las comprobaciones pasaron'}`);
process.exit(fallos ? 1 : 0);
