// Prueba real de ffmpeg.wasm dentro de la extensión: un MKV con varias pistas de audio y subtítulos.
// Uso: KK_SALIDA=.dist-whisper node build.mjs && node pruebas/medios.mjs ruta/haruka.wav

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { recargarExtension } from './extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-whisper'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-whisper'));
const FFMPEG = existsSync('C:/ffmpeg/bin/ffmpeg.exe') ? 'C:/ffmpeg/bin/ffmpeg.exe' : 'ffmpeg';
const [audio] = process.argv.slice(2);

const carpeta = join(RAIZ, 'capturas-e2e');
const srt = join(carpeta, 'prueba.ja.srt');
const ass = join(carpeta, 'prueba.es.ass');
const mkv = join(carpeta, 'prueba.mkv');
writeFileSync(srt, '1\n00:00:01,000 --> 00:00:03,000\n授業の後は\n\n2\n00:00:04,000 --> 00:00:06,000\n図書館で勉強します\n');
writeFileSync(ass, '[Script Info]\nScriptType: v4.00+\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,1,0,2,10,10,10,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,Después de clase\n');
execFileSync(FFMPEG, [
  '-y', '-loglevel', 'error', '-t', '20',
  '-i', join(RAIZ, 'pruebas', 'fixtures', 'video.webm'),
  '-i', audio, '-i', srt, '-i', ass,
  '-map', '0:v', '-map', '0:a', '-map', '1:a', '-map', '2:s', '-map', '3:s',
  '-c:v', 'copy', '-c:a:0', 'copy', '-c:a:1', 'aac', '-c:s:0', 'srt', '-c:s:1', 'ass',
  '-metadata:s:a:0', 'language=eng', '-metadata:s:a:0', 'title=Tono', '-metadata:s:a:1', 'language=jpn', '-metadata:s:a:1', 'title=Voz',
  '-metadata:s:s:0', 'language=jpn', '-metadata:s:s:1', 'language=spa',
  mkv,
]);

// Página de prueba con el módulo real, servida desde la propia extensión.
await build({
  stdin: { contents: `import * as m from './src/app/medios.ts'; globalThis.medios = m;`, resolveDir: RAIZ, loader: 'ts' },
  outfile: join(DIST, 'prueba-medios.js'),
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  logLevel: 'error',
});
writeFileSync(join(DIST, 'prueba-medios.html'), '<!doctype html><meta charset="utf-8"><input type="file" id="f"><script src="prueba-medios.js"></script>');

const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
const p = await contexto.newPage();
p.on('pageerror', (e) => console.log('[error]', e.message));
p.on('console', (m) => {
  if (m.type() === 'error') console.log('[consola]', m.text().slice(0, 300));
});
await p.goto(`chrome-extension://${id}/prueba-medios.html`);
await p.setInputFiles('#f', mkv);

const inicio = Date.now();
const informe = await p.evaluate(() => globalThis.medios.inspeccionarArchivo(document.querySelector('#f').files[0]));
console.log(`Informe (${Date.now() - inicio} ms):`, JSON.stringify(informe));

const t1 = await p.evaluate(({ pista }) => globalThis.medios.extraerSubtitulos(document.querySelector('#f').files[0], pista), { pista: informe.subtitulos[0] });
console.log('SRT incrustado:', JSON.stringify(t1).slice(0, 160));
const t2 = await p.evaluate(({ pista }) => globalThis.medios.extraerSubtitulos(document.querySelector('#f').files[0], pista), { pista: informe.subtitulos[1] });
console.log('ASS incrustado contiene el diálogo:', t2.includes('Después de clase'));

const r = await p.evaluate(async ({ pista }) => {
  const f = document.querySelector('#f').files[0];
  const t0 = Date.now();
  const url = await globalThis.medios.extraerPistaAudio(f, pista);
  const a = new Audio(url);
  await new Promise((ok, mal) => {
    a.onloadedmetadata = ok;
    a.onerror = () => mal(new Error('El navegador no puede reproducir la pista extraída'));
  });
  return { ms: Date.now() - t0, duracion: a.duration };
}, { pista: informe.audio[1] });
console.log('Pista de audio extraída y reproducible:', JSON.stringify(r));

const urlPcm = await p.evaluate(async ({ pista }) => {
  const f = document.querySelector('#f').files[0];
  const t0 = Date.now();
  const url = await globalThis.medios.extraerAudioParaWhisper(f, pista);
  const tam = (await (await fetch(url)).arrayBuffer()).byteLength;
  console.log('pcm', tam);
  return { url, tam, ms: Date.now() - t0 };
}, { pista: informe.audio[1] });
console.log('Audio para Whisper:', JSON.stringify({ ...urlPcm, url: undefined }), `(${(urlPcm.tam / 4 / 16000).toFixed(1)} s)`);

const lineas = await p.evaluate(async ({ url }) => {
  await chrome.runtime.sendMessage({ canal: 'fondo', metodo: 'asegurarMotor', args: [] });
  await new Promise((r) => setTimeout(r, 1500));
  const salida = [];
  await new Promise((ok, mal) => {
    const puerto = chrome.runtime.connect({ name: 'kotonoha-flujo' });
    let buffer = '';
    puerto.onMessage.addListener((m) => {
      if (m.tipo === 'parte') {
        buffer += m.texto;
        const i = buffer.lastIndexOf('\n');
        if (i < 0) return;
        for (const fila of buffer.slice(0, i).split('\n')) {
          const e = JSON.parse(fila);
          if (e.tipo === 'lineas') salida.push(...e.lineas);
        }
        buffer = buffer.slice(i + 1);
      } else if (m.tipo === 'fin') ok();
      else mal(new Error(m.error));
    });
    puerto.postMessage({ metodo: 'transcribirArchivo', args: [url, true] });
  });
  return salida;
}, { url: urlPcm.url });
console.log('Whisper sobre la pista elegida:');
for (const l of lineas) console.log(`  ${(l.inicio / 1000).toFixed(1).padStart(6)} → ${(l.fin / 1000).toFixed(1).padStart(6)}  ${l.texto}`);
console.log(`Tamaño de la prueba: ${(readFileSync(mkv).length / 1e6).toFixed(1)} MB`);
await contexto.close();
process.exit(0);
