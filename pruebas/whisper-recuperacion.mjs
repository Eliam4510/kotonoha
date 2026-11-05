// Prueba la recuperación ante la pérdida de la GPU, sin provocar un fallo real del controlador:
// destruye el dispositivo WebGPU del trabajador, que produce el mismo evento que un reinicio del controlador.
// Uso: KK_SALIDA=.dist-carga node build.mjs && node pruebas/whisper-recuperacion.mjs audio.pcm [modelo]

import { createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';
import { iniciarMock } from './mock-claude.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-carga'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-whisper'));
const [pcm, modelo = 'turbo'] = process.argv.slice(2);

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok  ' : 'FALLO'} ${texto}${extra ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};

const servidor = createServer((req, res) => {
  res.setHeader('access-control-allow-origin', '*');
  createReadStream(pcm).pipe(res);
});
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
const url = `http://127.0.0.1:${servidor.address().port}/a.pcm`;

const mock = await iniciarMock();
const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
await sw.evaluate(
  async ({ m, u }) => {
    const d = await chrome.storage.local.get('ajustes');
    await chrome.storage.local.set({ urlBaseIA: u, claveAnthropic: 'clave-de-prueba', ajustes: { ...(d.ajustes ?? {}), whisperModelo: m, whisperIntensidad: 'auto' } });
  },
  { m: modelo, u: `http://127.0.0.1:${mock.puerto}` }
);
const p = await contexto.newPage();
await p.goto(`chrome-extension://${id}/popup.html`);
await p.waitForTimeout(800);
await p.evaluate(() => chrome.runtime.sendMessage({ canal: 'fondo', metodo: 'asegurarMotor', args: [] }));
await p.waitForTimeout(1500);
const motor = (metodo, ...args) =>
  p.evaluate(({ metodo, args }) => chrome.runtime.sendMessage({ canal: 'motor', metodo, args }), { metodo, args }).then((r) => {
    if (!r?.ok) throw new Error(r?.error ?? 'sin respuesta');
    return r.valor;
  });
const estado = () => p.evaluate(() => ({ lineas: globalThis.__lineas.length, eventos: globalThis.__eventos, fin: globalThis.__fin, ultima: globalThis.__lineas.at(-1)?.fin ?? 0 }));
const esperarA = async (cond, ms, cada = 300) => {
  const t = Date.now();
  while (Date.now() - t < ms) {
    const e = await estado();
    if (cond(e)) return e;
    await new Promise((r) => setTimeout(r, cada));
  }
  return estado();
};

await motor('whisperOcupacionPrueba', 0.5);
await p.evaluate((u) => {
  globalThis.__lineas = [];
  globalThis.__eventos = [];
  globalThis.__fin = null;
  const puerto = chrome.runtime.connect({ name: 'kotonoha-flujo' });
  globalThis.__puerto = puerto;
  let buffer = '';
  puerto.onMessage.addListener((m) => {
    if (m.tipo === 'parte') {
      buffer += m.texto;
      const i = buffer.lastIndexOf('\n');
      if (i < 0) return;
      for (const f of buffer.slice(0, i).split('\n')) {
        const e = JSON.parse(f);
        if (e.tipo === 'lineas') globalThis.__lineas.push(...e.lineas);
        else globalThis.__eventos.push(e.tipo);
      }
      buffer = buffer.slice(i + 1);
    } else if (m.tipo === 'fin') globalThis.__fin = { ok: m.texto };
    else globalThis.__fin = { error: m.error };
  });
  puerto.postMessage({ metodo: 'transcribirArchivo', args: [u, true, 0] });
}, url);

let e = await esperarA((x) => x.lineas >= 5, 90000);
comprobar(e.lineas >= 5, 'Empieza a transcribir', `${e.lineas} líneas`);

console.log('Primera pérdida de la GPU…');
await motor('whisperPerderGpuPrueba');
e = await esperarA((x) => x.eventos.includes('recuperando') || x.fin, 40000);
comprobar(e.eventos.includes('recuperando'), 'Detecta la pérdida y espera antes de reintentar', e.fin ? JSON.stringify(e.fin) : '');
const antes = e.lineas;
const t0 = Date.now();
e = await esperarA((x) => x.lineas > antes + 3 || x.fin, 120000);
comprobar(e.lineas > antes, 'Recarga el modelo y sigue transcribiendo', `${antes} → ${e.lineas} líneas, tras ${((Date.now() - t0) / 1000).toFixed(0)} s`);
const ordenadas = await p.evaluate(() => globalThis.__lineas.every((l, i, a) => i === 0 || l.inicio >= a[i - 1].inicio - 2000));
comprobar(ordenadas, 'No se pierde ni se desordena lo transcrito');

console.log('Segunda pérdida de la GPU…');
await motor('whisperPerderGpuPrueba');
e = await esperarA((x) => x.fin, 60000);
comprobar(/dos veces/.test(e.fin?.error ?? ''), 'Al segundo fallo se detiene, sin insistir', e.fin?.error);
comprobar(e.lineas >= antes, 'Conserva lo transcrito', `${e.lineas} líneas`);

await motor('whisperOcupacionPrueba', null);
console.log(`\n${fallos ? `${fallos} comprobaciones fallaron` : 'Todas las comprobaciones pasaron'}`);
await contexto.close();
mock.servidor.close();
servidor.close();
process.exit(fallos ? 1 : 0);
