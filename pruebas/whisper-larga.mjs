// Prueba larga: simula una película repitiendo audio real hasta la duración pedida y comprueba que
// no se degrada con el tiempo. Vigila ritmo, memoria de video, RAM, traba del escritorio y controlador.
//
// Uso: KK_SALIDA=.dist-carga node build.mjs && node pruebas/whisper-larga.mjs modelo minutos limiteMin audio1.pcm [audio2.pcm...]
// Los .pcm son los que deja pruebas/whisper-carga.mjs: flotantes de 32 bits, mono, a 16 kHz.

import { execFileSync, spawn } from 'node:child_process';
import { createReadStream, createWriteStream, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';
import { iniciarMock } from './mock-claude.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-carga'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-whisper'));
const SONDA = join(RAIZ, 'pruebas', 'sonda-escritorio.ps1');
const SALIDA = join(RAIZ, 'capturas-e2e', 'whisper-real');
mkdirSync(SALIDA, { recursive: true });
const [modelo = 'turbo', minutosTexto = '120', limiteTexto = '60', ...audios] = process.argv.slice(2);
const MINUTOS = Number(minutosTexto);
const LIMITE_MIN = Number(limiteTexto);

// Película simulada: repite los audios hasta llegar a la duración.
const pelicula = join(tmpdir(), `kk-pelicula-${process.pid}.pcm`);
const objetivo = MINUTOS * 60 * 16000 * 4;
{
  const salida = createWriteStream(pelicula);
  let escrito = 0;
  while (escrito < objetivo) {
    for (const a of audios) {
      if (escrito >= objetivo) break;
      const datos = readFileSync(a);
      const parte = datos.subarray(0, Math.min(datos.length, objetivo - escrito) & ~3);
      if (!salida.write(parte)) await new Promise((r) => salida.once('drain', r));
      escrito += parte.length;
    }
  }
  await new Promise((r) => salida.end(r));
}
console.log(`Película simulada: ${(statSync(pelicula).size / 1e6).toFixed(0)} MB, ${MINUTOS} min. Modelo: ${modelo}.`);

const servidor = createServer((req, res) => {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('content-type', 'application/octet-stream');
  createReadStream(pelicula).pipe(res);
});
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));

const sondaDwm = (segundos) =>
  new Promise((ok) => {
    let salida = '';
    const p = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', SONDA, '-Segundos', String(segundos)]);
    p.stdout.on('data', (d) => (salida += d));
    p.on('close', () => {
      try {
        ok(JSON.parse(salida.trim().split('\n').pop()));
      } catch {
        ok(null);
      }
    });
  });

function recursos() {
  try {
    const s = execFileSync(
      'powershell.exe',
      ['-NoProfile', '-Command', "$m=(Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUAdapterMemory | Measure-Object DedicatedUsage -Maximum).Maximum; $r=(Get-Process msedge -ErrorAction SilentlyContinue | Measure-Object WorkingSet64 -Sum).Sum; $l=(Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory; \"$m $r $l\""],
      { encoding: 'utf8' }
    ).trim();
    const [m, r, l] = s.split(/\s+/).map(Number);
    return { vram: m / 1024 ** 3, ram: r / 1024 ** 3, libre: (l * 1024) / 1024 ** 3 };
  } catch {
    return { vram: 0, ram: 0, libre: 0 };
  }
}

const inicioPrueba = new Date();
const eventosDriver = () => {
  try {
    return execFileSync('powershell.exe', ['-NoProfile', '-Command', `$d=[datetime]'${inicioPrueba.toISOString()}'; @(Get-WinEvent -FilterHashtable @{LogName='System'; Id=4101; StartTime=$d} -ErrorAction SilentlyContinue).Count`], { encoding: 'utf8' }).trim();
  } catch {
    return '?';
  }
};

const mock = await iniciarMock();
const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
await sw.evaluate(
  async ({ m, url }) => {
    const d = await chrome.storage.local.get('ajustes');
    await chrome.storage.local.set({ urlBaseIA: url, claveAnthropic: 'clave-de-prueba', ajustes: { ...(d.ajustes ?? {}), whisperModelo: m, whisperIntensidad: 'auto' } });
  },
  { m: modelo, url: `http://127.0.0.1:${mock.puerto}` }
);
const p = await contexto.newPage();
await p.goto(`chrome-extension://${id}/popup.html`);
await p.waitForTimeout(800);
await p.evaluate(() => chrome.runtime.sendMessage({ canal: 'fondo', metodo: 'asegurarMotor', args: [] }));
await p.waitForTimeout(1500);
const antes = recursos();

await p.evaluate(
  ({ url }) => {
    globalThis.__lineas = 0;
    globalThis.__fin = null;
    globalThis.__ultimo = null;
    globalThis.__eventos = [];
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
          if (e.tipo === 'lineas') globalThis.__lineas += e.lineas.length;
          else if (e.tipo === 'procesando') globalThis.__ultimo = e;
          else globalThis.__eventos.push(e.tipo);
        }
        buffer = buffer.slice(i + 1);
      } else if (m.tipo === 'fin') globalThis.__fin = { ok: m.texto };
      else globalThis.__fin = { error: m.error };
    });
    puerto.postMessage({ metodo: 'transcribirArchivo', args: [url, true, 0] });
  },
  { url: `http://127.0.0.1:${servidor.address().port}/a.pcm` }
);

const t0 = Date.now();
const filas = [];
let siguienteSonda = 60000;
let finalizado = null;
while (Date.now() - t0 < LIMITE_MIN * 60000) {
  await new Promise((r) => setTimeout(r, 10000));
  finalizado = await p.evaluate(() => globalThis.__fin);
  if (finalizado) break;
  if (Date.now() - t0 >= siguienteSonda) {
    siguienteSonda += 5 * 60000;
    const d = await sondaDwm(20);
    const r = recursos();
    const e = await p.evaluate(() => ({ u: globalThis.__ultimo, l: globalThis.__lineas }));
    const fila = {
      min: ((Date.now() - t0) / 60000).toFixed(1),
      '%': e.u?.porcentaje ?? 0,
      lineas: e.l,
      'quedan min': e.u?.restanteS ? (e.u.restanteS / 60).toFixed(0) : '-',
      'VRAM GB': r.vram.toFixed(2),
      'RAM Edge GB': r.ram.toFixed(2),
      'RAM libre GB': r.libre.toFixed(1),
      p99: d?.p99,
      max: d?.max,
      '>33ms': d?.mayor33,
      '>100ms': d?.mayor100,
      TDR: eventosDriver(),
    };
    filas.push(fila);
    console.log(JSON.stringify(fila));
  }
}
const duracion = (Date.now() - t0) / 60000;
const final = await p.evaluate(() => ({ u: globalThis.__ultimo, l: globalThis.__lineas, ev: globalThis.__eventos, fin: globalThis.__fin }));
const despues = recursos();
console.table(filas);
console.log(`Antes de empezar: VRAM ${antes.vram.toFixed(2)} GB, RAM de Edge ${antes.ram.toFixed(2)} GB.`);
console.log(`Al terminar: VRAM ${despues.vram.toFixed(2)} GB, RAM de Edge ${despues.ram.toFixed(2)} GB.`);
console.log(`Tiempo: ${duracion.toFixed(1)} min para el ${final.u?.porcentaje ?? 0} % de ${MINUTOS} min. Líneas: ${final.l}. Reinicios del controlador: ${eventosDriver()}.`);
console.log('Otros eventos:', [...new Set(final.ev)].join(' '), '| Fin:', JSON.stringify(final.fin));
writeFileSync(join(SALIDA, `larga-${modelo}.json`), JSON.stringify({ filas, antes, despues, duracion, final }, null, 1));
await p.evaluate(() => globalThis.__puerto.disconnect());
await contexto.close();
mock.servidor.close();
servidor.close();
rmSync(pelicula, { force: true });
process.exit(0);
