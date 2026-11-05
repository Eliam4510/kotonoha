// Prueba real de la transcripción: descarga el modelo y transcribe un audio en japonés.
// Uso: KK_SALIDA=.dist-whisper node build.mjs && node pruebas/whisper.mjs ruta/audio.wav [modelo]
// Variables: KK_DIST, KK_PERFIL.

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-whisper'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-whisper'));
const [audio, modelo = 'base'] = process.argv.slice(2);

const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
await sw.evaluate(async (m) => {
  const d = await chrome.storage.local.get('ajustes');
  await chrome.storage.local.set({ ajustes: { ...(d.ajustes ?? {}), whisperModelo: m } });
}, modelo);

const p = await contexto.newPage();
p.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}]`, m.text().slice(0, 300));
});
await p.goto(`chrome-extension://${id}/app.html#/inicio`);
await p.waitForTimeout(1000);

console.log('WebGPU:', await p.evaluate(async () => {
  if (!navigator.gpu) return 'no disponible';
  const a = await navigator.gpu.requestAdapter();
  if (!a) return 'sin adaptador';
  const i = a.info ?? {};
  return `${i.vendor ?? ''} ${i.architecture ?? ''} ${i.description ?? ''}`.trim() || 'disponible';
}));

const base64 = readFileSync(audio).toString('base64');
const inicio = Date.now();
const resultado = await p.evaluate(
  ({ base64 }) =>
    new Promise((ok) => {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
      const lineas = [];
      const eventos = [];
      const puerto = chrome.runtime.connect({ name: 'kotonoha-flujo' });
      let buffer = '';
      puerto.onMessage.addListener((m) => {
        if (m.tipo === 'parte') {
          buffer += m.texto;
          const i = buffer.lastIndexOf('\n');
          if (i < 0) return;
          for (const f of buffer.slice(0, i).split('\n')) {
            const e = JSON.parse(f);
            if (e.tipo === 'lineas') lineas.push(...e.lineas);
            else eventos.push(e);
            if (e.tipo === 'descarga') globalThis.__progreso = e;
          }
          buffer = buffer.slice(i + 1);
        } else if (m.tipo === 'fin') ok({ lineas, eventos: eventos.filter((e) => e.tipo !== 'descarga').slice(-6) });
        else ok({ error: m.error, lineas, eventos });
      });
      puerto.postMessage({ metodo: 'transcribirArchivo', args: [url] });
    }),
  { base64 }
);
console.log(`Tiempo total: ${((Date.now() - inicio) / 1000).toFixed(1)} s`);
if (resultado.error) console.log('ERROR:', resultado.error);
console.log('Eventos:', JSON.stringify(resultado.eventos));
for (const l of resultado.lineas) console.log(`${(l.inicio / 1000).toFixed(1).padStart(6)} → ${(l.fin / 1000).toFixed(1).padStart(6)}  ${l.texto}`);
await contexto.close();
process.exit(0);
