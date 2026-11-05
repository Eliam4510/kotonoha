// Prueba maneras de recuperar la voz que Whisper se salta cuando hay música de fondo.
// Uso: KK_SALIDA=.dist-whisper node build.mjs && node pruebas/whisper-huecos.mjs audio.pcm desde-hasta [desde-hasta...]
// Los tramos van en segundos. El detalle queda en capturas-e2e/whisper-real/huecos.txt.

import { mkdirSync, openSync, readSync, closeSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-whisper'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-whisper'));
const [archivo, ...tramos] = process.argv.slice(2);
const FRECUENCIA = 16000;
const RELLENO = Math.floor(FRECUENCIA * 0.4);

function leerTramo(desdeS, hastaS) {
  const fd = openSync(archivo, 'r');
  const muestras = Math.floor((hastaS - desdeS) * FRECUENCIA);
  const b = Buffer.alloc(muestras * 4);
  readSync(fd, b, 0, b.length, Math.floor(desdeS * FRECUENCIA) * 4);
  closeSync(fd);
  return new Float32Array(b.buffer, b.byteOffset, muestras);
}

function codificar(pcm) {
  const s = new Float32Array(RELLENO + pcm.length);
  s.set(pcm, RELLENO);
  return Buffer.from(s.buffer).toString('base64');
}

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

await p.evaluate(async (modelo) => {
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
  const listo = globalThis.__esperar('listo');
  t.postMessage(modelo);
  await listo;
}, process.env.KK_MODELO === 'kotoba'
  ? { tipo: 'cargar', modelo: 'onnx-community/kotoba-whisper-v2.2-ONNX', dtype: { encoder_model: 'q4f16', decoder_model_merged: 'q4f16' } }
  : { tipo: 'cargar', modelo: 'onnx-community/whisper-large-v3-turbo', dtype: { encoder_model: 'fp16', decoder_model_merged: 'q4f16' } });

const transcribir = (pcm) =>
  p.evaluate(
    async ({ base64 }) => {
      const a = new Float32Array(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)).buffer);
      const t0 = performance.now();
      const espera = globalThis.__esperar('resultado');
      globalThis.__t.postMessage({ tipo: 'transcribir', id: 1, pcm: a, idioma: 'japanese' }, [a.buffer]);
      const r = await espera;
      return { texto: r.texto.trim(), trozos: r.trozos, ms: performance.now() - t0 };
    },
    { base64: codificar(pcm) }
  );

/** Reparte un tramo en ventanas con un pequeño solape, para no cortar una frase justo por la mitad. */
function ventanas(a, b, tam, paso) {
  const v = [];
  for (let x = a; x < b; x += paso) {
    v.push([x, Math.min(x + tam, b)]);
    if (x + tam >= b) break;
  }
  return v;
}

const ESTRATEGIAS = {
  entero: (a, b) => [[a, b]],
  '10 s': (a, b) => ventanas(a, b, 10, 9),
};

// La primera pasada compila los sombreadores.
await transcribir(leerTramo(10, 15));

const salida = [];
const ms = {};
for (const tramo of tramos) {
  const [a, b] = tramo.split('-').map(Number);
  salida.push(`\n=== ${a} → ${b} s`);
  for (const [nombre, f] of Object.entries(ESTRATEGIAS)) {
    const v = f(a, b);
    const textos = [];
    for (const [x, y] of v) {
      const r = await transcribir(leerTramo(x, y));
      ms[nombre] = (ms[nombre] ?? 0) + r.ms;
      const marcas = r.trozos.map((c) => `${(c.timestamp[0] ?? 0).toFixed(1)}: ${c.text.trim()}`).join(' | ');
      textos.push(r.texto ? `[${x.toFixed(0)}] ${marcas || r.texto}` : `[${x.toFixed(0)}] ∅`);
    }
    salida.push(`-- ${nombre}: ${textos.join(' ')}`);
  }
  console.log(salida.slice(-5).join('\n'));
}
await contexto.close();
salida.push(`\nTiempo por estrategia (s): ${Object.entries(ms).map(([n, v]) => `${n} ${(v / 1000).toFixed(1)}`).join(', ')}`);
mkdirSync(join(RAIZ, 'capturas-e2e', 'whisper-real'), { recursive: true });
writeFileSync(join(RAIZ, 'capturas-e2e', 'whisper-real', 'huecos.txt'), salida.join('\n'));
console.log(salida.at(-1));
process.exit(0);
