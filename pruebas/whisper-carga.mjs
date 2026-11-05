// Mide cuánto traba Whisper el escritorio con un video real, a distintas intensidades.
// Sonda: tiempo entre composiciones del DWM de Windows. En reposo son 16,7 ms con un monitor de 60 Hz.
//
// Uso: KK_SALIDA=.dist-whisper node build.mjs && node pruebas/whisper-carga.mjs video.mp4 sonda.ps1 modelo "reposo,0.3,0.7" [segundos]
// Cada ocupación procesa hasta `segundos` de audio. El SRT completo, si se llega al final, va a capturas-e2e/whisper-real.

import { execFileSync, spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';
import { iniciarMock } from './mock-claude.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-whisper'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-whisper'));
const FFMPEG = existsSync('C:/ffmpeg/bin/ffmpeg.exe') ? 'C:/ffmpeg/bin/ffmpeg.exe' : 'ffmpeg';
const [video, sonda, modelo = 'turbo', listaPerfiles = 'reposo,0.3', segundosTexto = '150', desdeTexto = '0'] = process.argv.slice(2);
const SEGUNDOS = Number(segundosTexto);
const DESDE = Number(desdeTexto);
const SALIDA = join(RAIZ, 'capturas-e2e', 'whisper-real');
mkdirSync(SALIDA, { recursive: true });

// Audio extraído aparte: así se repite la prueba sin pasar por ffmpeg.wasm, que es otra medida.
const pcm = join(tmpdir(), `kk-audio-${basename(video).length}-${statSync(video).size}.pcm`);
if (!existsSync(pcm)) {
  console.log('Extrayendo el audio…');
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', video, '-vn', '-ac', '1', '-ar', '16000', '-f', 'f32le', pcm]);
}
const totalS = statSync(pcm).size / 4 / 16000;
console.log(`Audio: ${(totalS / 60).toFixed(1)} min. Modelo: ${modelo}.`);

const servidor = createServer((req, res) => {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('content-type', 'application/octet-stream');
  createReadStream(pcm).pipe(res);
});
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
const urlAudio = `http://127.0.0.1:${servidor.address().port}/audio.pcm`;

const sondaDwm = (segundos) =>
  new Promise((ok) => {
    let salida = '';
    const p = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', sonda, '-Segundos', String(segundos)]);
    p.stdout.on('data', (d) => (salida += d));
    p.on('close', () => {
      try {
        ok(JSON.parse(salida.trim().split('\n').pop()));
      } catch {
        ok(null);
      }
    });
  });

// Uso de la GPU: suma de los motores por proceso, muestreada aparte.
function muestrearGpu() {
  const p = spawn('powershell.exe', [
    '-NoProfile',
    '-Command',
    "while ($true) { $e = Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine; $v = ($e | Where-Object { $_.Name -match 'engtype_(3D|Compute)' -and $_.UtilizationPercentage -le 100 } | Measure-Object UtilizationPercentage -Sum).Sum; $m = (Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUAdapterMemory | Measure-Object DedicatedUsage -Maximum).Maximum; [Console]::Out.WriteLine(\"$v $m\"); [Console]::Out.Flush(); Start-Sleep -Milliseconds 800 }",
  ]);
  const uso = [];
  const memoria = [];
  p.stdout.on('data', (d) => {
    for (const l of d.toString().split(/\r?\n/)) {
      const m = /^(\d+)\s+(\d+)/.exec(l.trim());
      if (m) {
        uso.push(Number(m[1]));
        memoria.push(Number(m[2]) / 1024 ** 3);
      }
    }
  });
  return { uso, memoria, parar: () => p.kill() };
}

function eventosDriver(desde) {
  try {
    const s = desde.toISOString();
    return execFileSync('powershell.exe', ['-NoProfile', '-Command', `$d=[datetime]'${s}'; @(Get-WinEvent -FilterHashtable @{LogName='System'; Id=4101; StartTime=$d} -ErrorAction SilentlyContinue).Count`], { encoding: 'utf8' }).trim();
  } catch {
    return '?';
  }
}

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
const motor = (metodo, ...args) =>
  p.evaluate(({ metodo, args }) => chrome.runtime.sendMessage({ canal: 'motor', metodo, args }), { metodo, args }).then((r) => {
    if (!r?.ok) throw new Error(r?.error ?? 'sin respuesta');
    return r.valor;
  });

const filas = [];
for (const perfil of listaPerfiles.split(',')) {
  const inicioPrueba = new Date();
  if (perfil === 'reposo') {
    const gpu = muestrearGpu();
    const d = await sondaDwm(20);
    gpu.parar();
    filas.push({ perfil, 'GPU %': (gpu.uso.reduce((a, b) => a + b, 0) / Math.max(gpu.uso.length, 1)).toFixed(0), mediana: d?.mediana, p99: d?.p99, max: d?.max, '>33ms': d?.mayor33, '>50ms': d?.mayor50, '>100ms': d?.mayor100, 'x tiempo real': '-', 'TDR': eventosDriver(inicioPrueba) });
    continue;
  }
  const ocupacion = Number(perfil);
  await motor('whisperOcupacionPrueba', ocupacion);
  console.log(`\n== Ocupación ${ocupacion}`);

  await p.evaluate(
    ({ urlAudio, desdeMs }) => {
      globalThis.__lineas = [];
      globalThis.__ultimo = null;
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
            else globalThis.__ultimo = e;
          }
          buffer = buffer.slice(i + 1);
        } else if (m.tipo === 'fin') globalThis.__fin = { ok: m.texto };
        else globalThis.__fin = { error: m.error };
      });
      puerto.postMessage({ metodo: 'transcribirArchivo', args: [urlAudio, true, desdeMs] });
    },
    { urlAudio, desdeMs: DESDE * 1000 }
  );

  // Espera a que el modelo esté listo antes de medir: la carga no es lo que interesa aquí.
  for (let i = 0; i < 600; i++) {
    const e = await p.evaluate(() => globalThis.__ultimo?.tipo);
    if (e === 'procesando') break;
    await new Promise((r) => setTimeout(r, 250));
  }
  const gpu = muestrearGpu();
  const memoriaBase = gpu.memoria[0] ?? 0;
  const t0 = Date.now();
  const medida = sondaDwm(25);

  // Termina al llegar al audio pedido, o al final del archivo.
  let hecho = 0;
  for (;;) {
    await new Promise((r) => setTimeout(r, 500));
    const estado = await p.evaluate(() => ({ fin: globalThis.__fin, ultima: globalThis.__lineas.at(-1)?.fin ?? 0 }));
    hecho = estado.ultima / 1000 - DESDE;
    if (estado.fin || hecho >= SEGUNDOS) break;
  }
  const transcurrido = (Date.now() - t0) / 1000;
  const fin = await p.evaluate(() => globalThis.__fin);
  await p.evaluate(() => globalThis.__puerto.disconnect());
  const d = await medida;
  gpu.parar();
  const lineas = await p.evaluate(() => globalThis.__lineas);
  if (fin?.error) console.log('ERROR:', fin.error);
  console.log(`  ${lineas.length} líneas en ${transcurrido.toFixed(0)} s para ${hecho.toFixed(0)} s de audio`);

  const srt = lineas
    .map((l, i) => {
      const h = (ms) => new Date(ms).toISOString().slice(11, 23).replace('.', ',');
      return `${i + 1}\n${h(l.inicio)} --> ${h(l.fin)}\n${l.texto}\n`;
    })
    .join('\n');
  writeFileSync(join(SALIDA, `${basename(video).slice(0, 12).replace(/[^\p{L}\p{N}]+/gu, '_')}.${modelo}.${perfil}.srt`), srt);

  filas.push({
    perfil: `ocupación ${ocupacion}`,
    'GPU %': (gpu.uso.reduce((a, b) => a + b, 0) / Math.max(gpu.uso.length, 1)).toFixed(0),
    mediana: d?.mediana,
    p99: d?.p99,
    max: d?.max,
    '>33ms': d?.mayor33,
    '>50ms': d?.mayor50,
    '>100ms': d?.mayor100,
    'x tiempo real': (hecho / transcurrido).toFixed(1),
    'memoria GB': (Math.max(...gpu.memoria) - memoriaBase).toFixed(2),
    TDR: eventosDriver(inicioPrueba),
  });
  // Deja enfriar entre pruebas.
  await new Promise((r) => setTimeout(r, 8000));
}

await motor('whisperOcupacionPrueba', null);
console.log('\nTiempos entre composiciones del escritorio, en ms. En reposo: mediana 16,7, sin saltos.');
console.table(filas);
writeFileSync(join(SALIDA, `medida-${modelo}.json`), JSON.stringify(filas, null, 1));
await contexto.close();
mock.servidor.close();
servidor.close();
process.exit(0);
