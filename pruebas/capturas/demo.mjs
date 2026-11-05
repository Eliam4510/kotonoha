// Graba el GIF de demostración del README, con el video de prueba y la API de Claude simulada.
// Uso: KK_SALIDA=.dist-capturas node build.mjs && KK_DIST=.dist-capturas node pruebas/capturas/demo.mjs
// Necesita ffmpeg en el PATH y un perfil con diccionarios (KK_PERFIL, por omisión .perfil-galeria).

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from '../extension.mjs';
import { iniciarMock } from '../mock-claude.mjs';
import { servidor } from './overlay.mjs';

const RAIZ = resolve(import.meta.dirname, '..', '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-capturas'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-galeria'));
const SALIDA = join(RAIZ, 'docs', 'img', 'demo.gif');
const ANCHO = 1280;
const ALTO = 720;

const s = await servidor(RAIZ);
const mock = await iniciarMock();
const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: ANCHO, height: ALTO },
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
});
const sw = await recargarExtension(contexto);
await sw.evaluate(
  async (url) => {
    const d = await chrome.storage.local.get('ajustes');
    await chrome.storage.local.set({
      urlBaseIA: url,
      claveAnthropic: 'clave-de-prueba',
      ajustes: { ...(d.ajustes ?? {}), navegadorAbierto: false, modo: 'normal', salto: 'no', desanclarBarra: false, popupAlPasar: true },
    });
  },
  `http://127.0.0.1:${mock.puerto}`
);

const p = await contexto.newPage();
await p.goto(`http://127.0.0.1:${s.address().port}/`);
await p.waitForTimeout(800);
await sw.evaluate(async () => {
  const [t] = await chrome.tabs.query({ url: 'http://127.0.0.1/*' });
  await chrome.tabs.sendMessage(t.id, { activarVideoAqui: true });
});

const enOverlay = (fn, arg) =>
  p.evaluate(
    ({ fn, arg }) => {
      const r = document.querySelector('kotonoha-overlay').shadowRoot;
      return new Function('r', 'arg', `return (${fn})(r, arg)`)(r, arg);
    },
    { fn: fn.toString(), arg }
  );
const esperar = (sel, tiempo = 20000) => p.waitForFunction((x) => document.querySelector('kotonoha-overlay')?.shadowRoot?.querySelector(x), sel, { timeout: tiempo });
const caja = (texto) =>
  enOverlay((r, t) => {
    const e = [...r.querySelectorAll('.linea-sub.objetivo .pal')].find((x) => x.textContent.includes(t));
    if (!e) return null;
    const c = e.getBoundingClientRect();
    return { x: c.left + c.width / 2, y: c.top + c.height / 2 };
  }, texto);
const cajaBoton = (texto, ambito) =>
  enOverlay(
    (r, { texto, ambito }) => {
      const b = [...r.querySelectorAll(`${ambito} button`)].find((x) => x.textContent.includes(texto) || x.getAttribute('aria-label') === texto);
      if (!b) return null;
      const c = b.getBoundingClientRect();
      return { x: c.left + c.width / 2, y: c.top + c.height / 2 };
    },
    { texto, ambito }
  );
const ir = async (c, pasos = 28) => c && p.mouse.move(c.x, c.y, { steps: pasos });
const buscar = (t) => p.evaluate((x) => { const v = document.querySelector('#v'); v.pause(); v.currentTime = x; }, t);

await esperar('.barra');
await buscar(6);
await esperar('.linea-sub.objetivo .pal', 30000);
await p.waitForTimeout(3000); // Deja terminar la revisión simulada para que no cambie a mitad de la grabación.

// El navegador sin interfaz no pinta el puntero: se dibuja uno para que se vea qué ocurre.
await p.evaluate(() => {
  const c = document.createElement('div');
  c.style.cssText = 'position:fixed;left:0;top:0;width:24px;height:24px;z-index:2147483647;pointer-events:none;transform:translate(640px,430px)';
  c.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M5 2l14 12h-8l-3.6 7L5 2z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  document.documentElement.appendChild(c);
  addEventListener('mousemove', (e) => (c.style.transform = `translate(${e.clientX}px,${e.clientY}px)`), true);
});
await p.mouse.move(640, 430);

const cuadros = [];
const cdp = await contexto.newCDPSession(p);
cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
  cuadros.push({ data, t: metadata.timestamp });
  await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: ANCHO, maxHeight: ALTO, everyNthFrame: 1 });

// 1. Subtítulos con furigana, acento y estado.
await p.waitForTimeout(1600);
await buscar(10);
await p.waitForTimeout(1300);

// 2. La ficha da el sentido de la palabra en esta frase.
await ir(await caja('食'));
await esperar('.ficha');
await p.waitForTimeout(3200);

// 3. Marcarla como conocida cambia su subrayado.
await p.keyboard.press('3');
await p.waitForTimeout(900);
await p.mouse.move(640, 430, { steps: 20 });
await p.waitForTimeout(900);

// 4. El navegador de subtítulos.
await p.keyboard.press('g');
await p.waitForTimeout(1500);

// 5. Claude corrige los homófonos de los subtítulos.
await p.mouse.move(300, 4, { steps: 16 });
await p.waitForTimeout(350);
await ir(await cajaBoton('Generar subtítulos', '.barra-acciones'), 16);
await p.waitForTimeout(200);
await enOverlay((r) => r.querySelector('.barra-acciones button[aria-label="Generar subtítulos"]')?.click());
await p.waitForTimeout(1100);
await enOverlay((r) => {
  const b = [...r.querySelectorAll('.panel-generar button')].find((x) => x.textContent.includes('Corregir estos subtítulos'));
  b?.scrollIntoView({ block: 'center' });
});
await p.waitForTimeout(300);
const corregir = await cajaBoton('Corregir estos subtítulos', '.panel-generar');
await ir(corregir, 22);
await p.waitForTimeout(350);
await p.mouse.down();
await p.mouse.up();
await p.waitForFunction(() => document.querySelector('kotonoha-overlay').shadowRoot.querySelector('.nav-corregida'), undefined, { timeout: 15000 });
await p.waitForTimeout(2600);

await cdp.send('Page.stopScreencast');
await new Promise((r) => setTimeout(r, 200));
console.log(`${cuadros.length} cuadros, ${(cuadros.at(-1).t - cuadros[0].t).toFixed(1)} s`);

const carpeta = mkdtempSync(join(tmpdir(), 'kk-demo-'));
const lista = [];
cuadros.forEach((c, i) => {
  const archivo = `c${String(i).padStart(5, '0')}.jpg`;
  writeFileSync(join(carpeta, archivo), Buffer.from(c.data, 'base64'));
  // El navegador solo envía un cuadro si algo cambia: el último se queda un rato para ver el resultado.
  const dur = i + 1 < cuadros.length ? cuadros[i + 1].t - c.t : 3.5;
  lista.push(`file '${archivo}'`, `duration ${Math.max(dur, 0.01).toFixed(3)}`);
});
lista.push(`file 'c${String(cuadros.length - 1).padStart(5, '0')}.jpg'`);
writeFileSync(join(carpeta, 'lista.txt'), lista.join('\n'));
mkdirSync(join(RAIZ, 'docs', 'img'), { recursive: true });
execFileSync(
  'ffmpeg',
  ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', 'lista.txt', '-vf', 'fps=12,scale=1000:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle', SALIDA],
  { cwd: carpeta, stdio: 'inherit' }
);
rmSync(carpeta, { recursive: true, force: true });
console.log(`GIF: ${(statSync(SALIDA).size / 1e6).toFixed(1)} MB`);

await contexto.close();
s.close();
mock.servidor.close();
process.exit(0);
