// Compara variantes de Whisper en la GPU real: precisión con voz humana, velocidad y memoria de video.
// Uso: KK_SALIDA=.dist-whisper node build.mjs && node pruebas/whisper-comparar.mjs carpeta-corpus [variantes...]
// La carpeta contiene corpus.json, una lista de { fuente, descripcion, archivo, texto }, y los WAV a 16 kHz.
// Va directo al trabajador, sin el troceado del motor: se mide el modelo y nada más.
// El detalle de cada frase queda en capturas-e2e/whisper-comparacion.json.

import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-whisper'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-whisper'));
const [carpeta, ...elegidas] = process.argv.slice(2);

const KOTOBA = 'onnx-community/kotoba-whisper-v2.2-ONNX';
const TURBO = 'onnx-community/whisper-large-v3-turbo';
const LARGE = 'onnx-community/whisper-large-v3-ONNX';
const VARIANTES = {
  'kotoba-q4f16': { modelo: KOTOBA, dtype: { encoder_model: 'q4f16', decoder_model_merged: 'q4f16' } },
  'kotoba-fp16': { modelo: KOTOBA, dtype: { encoder_model: 'fp16', decoder_model_merged: 'fp16' } },
  'turbo-q4f16': { modelo: TURBO, dtype: { encoder_model: 'q4f16', decoder_model_merged: 'q4f16' } },
  'turbo-fp16': { modelo: TURBO, dtype: { encoder_model: 'fp16', decoder_model_merged: 'q4f16' } },
  'large-q4f16': { modelo: LARGE, dtype: { encoder_model: 'q4f16', decoder_model_merged: 'q4f16' } },
  'large-fp16': { modelo: LARGE, dtype: { encoder_model: 'fp16', decoder_model_merged: 'fp16' } },
};

/** Lee un WAV de 16 bits y le añade delante el mismo silencio que usa el motor. */
function leerWav(ruta) {
  const b = readFileSync(ruta);
  const relleno = Math.floor(16000 * 0.4);
  let p = 12;
  while (p < b.length) {
    const id = b.toString('latin1', p, p + 4);
    const tam = b.readUInt32LE(p + 4);
    if (id === 'data') {
      const n = Math.floor(tam / 2);
      const s = new Float32Array(relleno + n);
      for (let i = 0; i < n; i++) s[relleno + i] = b.readInt16LE(p + 8 + i * 2) / 32768;
      return { base64: Buffer.from(s.buffer).toString('base64'), segundos: n / 16000 };
    }
    p += 8 + tam + (tam % 2);
  }
  throw new Error(`WAV sin datos: ${ruta}`);
}

// Las cifras se escriben de muchas formas válidas (三十, 30, 30): se comparan sin ellas.
const normalizar = (t) =>
  t
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, '')
    .replace(/[0-9〇一二三四五六七八九十百千万億]/g, '');

function distancia(a, b) {
  const x = [...a];
  const y = [...b];
  let previa = Array.from({ length: y.length + 1 }, (_, i) => i);
  for (let i = 0; i < x.length; i++) {
    const fila = [i + 1];
    for (let j = 0; j < y.length; j++) fila.push(Math.min(previa[j + 1] + 1, fila[j] + 1, previa[j] + (x[i] === y[j] ? 0 : 1)));
    previa = fila;
  }
  return previa[y.length];
}

// Memoria dedicada de la tarjeta con más uso, muestreada aparte para no interferir.
function muestrearMemoria() {
  const proceso = spawn('powershell.exe', [
    '-NoProfile',
    '-Command',
    "while ($true) { $m = (Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUAdapterMemory | Measure-Object DedicatedUsage -Maximum).Maximum; [Console]::Out.WriteLine($m); [Console]::Out.Flush(); Start-Sleep -Milliseconds 600 }",
  ]);
  const muestras = [];
  proceso.stdout.on('data', (d) => {
    for (const l of d.toString().split(/\r?\n/)) if (/^\d+$/.test(l.trim())) muestras.push(Number(l) / 1024 ** 3);
  });
  return { muestras, parar: () => proceso.kill() };
}

const corpus = JSON.parse(readFileSync(join(carpeta, 'corpus.json'), 'utf8')).map((m) => ({ ...m, ...leerWav(join(carpeta, m.archivo)), referencia: normalizar(m.texto) }));
const fuentes = [...new Set(corpus.map((m) => m.fuente))];
console.log(`Corpus: ${corpus.length} frases, ${corpus.reduce((n, m) => n + m.segundos, 0).toFixed(0)} s de audio.`);

const filas = [];
const detalle = {};
for (const nombre of elegidas.length ? elegidas : Object.keys(VARIANTES)) {
  const v = VARIANTES[nombre];
  const contexto = await chromium.launchPersistentContext(PERFIL, {
    channel: process.env.KK_CANAL ?? 'msedge',
    headless: true,
    args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'],
  });
  const sw = await recargarExtension(contexto);
  const id = new URL(sw.url()).host;
  const p = await contexto.newPage();
  await p.goto(`chrome-extension://${id}/popup.html`);
  await p.waitForTimeout(800);

  const memoria = muestrearMemoria();
  await new Promise((r) => setTimeout(r, 2500));
  const base = memoria.muestras.length ? Math.min(...memoria.muestras) : 0;
  console.log(`\n== ${nombre} (memoria en uso antes: ${base.toFixed(2)} GB)`);

  const carga = await p.evaluate(async ({ v }) => {
    const t = new Worker(chrome.runtime.getURL('whisper.js'), { type: 'module' });
    globalThis.__esperar = (tipo) =>
      new Promise((ok, mal) => {
        const oyente = (e) => {
          if (e.data.tipo === 'error') {
            t.removeEventListener('message', oyente);
            mal(new Error(e.data.mensaje));
          } else if (e.data.tipo === tipo) {
            t.removeEventListener('message', oyente);
            ok(e.data);
          }
        };
        t.addEventListener('message', oyente);
      });
    globalThis.__t = t;
    const t0 = performance.now();
    const listo = globalThis.__esperar('listo');
    t.postMessage({ tipo: 'cargar', modelo: v.modelo, dtype: v.dtype, externos: v.externos });
    try {
      return { dispositivo: (await listo).dispositivo, ms: performance.now() - t0 };
    } catch (e) {
      return { error: e.message };
    }
  }, { v });
  if (carga.error) {
    console.log('ERROR:', carga.error);
    filas.push({ nombre, error: carga.error.slice(0, 60) });
    memoria.parar();
    await contexto.close();
    continue;
  }

  const transcribir = (m) =>
    p.evaluate(async ({ base64 }) => {
      const a = new Float32Array(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)).buffer);
      const t0 = performance.now();
      const espera = globalThis.__esperar('resultado');
      globalThis.__t.postMessage({ tipo: 'transcribir', id: 1, pcm: a, idioma: 'japanese' }, [a.buffer]);
      const r = await espera;
      return { texto: r.texto, ms: performance.now() - t0 };
    }, { base64: m.base64 });

  // La primera pasada compila los sombreadores: no cuenta para la velocidad.
  await transcribir(corpus[0]);
  const resultados = [];
  for (const m of corpus) {
    const r = await transcribir(m);
    const hipotesis = normalizar(r.texto);
    resultados.push({ fuente: m.fuente, referencia: m.texto, texto: r.texto.trim(), ms: r.ms, segundos: m.segundos, errores: distancia(hipotesis, m.referencia), largo: [...m.referencia].length });
  }
  await new Promise((res) => setTimeout(res, 800));
  const pico = memoria.muestras.length ? Math.max(...memoria.muestras) : 0;
  memoria.parar();
  await contexto.close();
  detalle[nombre] = resultados;

  const cer = (lista) => (100 * lista.reduce((n, x) => n + x.errores, 0)) / Math.max(lista.reduce((n, x) => n + x.largo, 0), 1);
  const fila = { nombre };
  for (const f of fuentes) fila[`% ${f}`] = cer(resultados.filter((x) => x.fuente === f)).toFixed(1);
  fila['% total'] = cer(resultados).toFixed(1);
  fila.exactas = `${resultados.filter((x) => x.errores === 0).length}/${resultados.length}`;
  fila.puntuadas = `${resultados.filter((x) => /[。、!?]/.test(x.texto)).length}`;
  fila['x tiempo real'] = (resultados.reduce((n, x) => n + x.segundos, 0) / (resultados.reduce((n, x) => n + x.ms, 0) / 1000)).toFixed(1);
  fila['memoria GB'] = (pico - base).toFixed(2);
  fila['carga s'] = (carga.ms / 1000).toFixed(1);
  filas.push(fila);
  console.log('Dispositivo:', carga.dispositivo, '| error total', fila['% total'], '%');
}

mkdirSync(join(RAIZ, 'capturas-e2e'), { recursive: true });
writeFileSync(join(RAIZ, 'capturas-e2e', 'whisper-comparacion.json'), JSON.stringify({ filas, detalle }, null, 1));
console.log('\nPorcentaje de error por caracteres; menos es mejor. Sin puntuación ni cifras, que admiten varias formas válidas.');
console.table(filas);
process.exit(0);
