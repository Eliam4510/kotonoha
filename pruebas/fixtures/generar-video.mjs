// Crea el video de prueba: dos paisajes dibujados, uno de noche y otro a pleno día, para comprobar
// que los subtítulos y la interfaz se leen sobre fondos oscuros y claros.
// Uso: node pruebas/fixtures/generar-video.mjs (necesita ffmpeg en el PATH o en C:\ffmpeg\bin).

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const AQUI = dirname(fileURLToPath(import.meta.url));
const FFMPEG = existsSync('C:/ffmpeg/bin/ffmpeg.exe') ? 'C:/ffmpeg/bin/ffmpeg.exe' : 'ffmpeg';

const montana = (y, amp, color, semilla) => {
  let d = `M0 720 L0 ${y}`;
  for (let x = 0; x <= 1280; x += 64) {
    const h = y - amp * (0.5 + 0.5 * Math.sin(x / 130 + semilla)) - amp * 0.35 * Math.sin(x / 47 + semilla * 2);
    d += ` L${x} ${h.toFixed(1)}`;
  }
  return `<path d="${d} L1280 720Z" fill="${color}"/>`;
};

const estrellas = Array.from({ length: 90 }, (_, i) => {
  const x = (i * 197.3) % 1280;
  const y = (i * 83.7) % 340;
  return `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${1 + (i % 3) * 0.5}" fill="#fff" opacity="${0.25 + (i % 5) * 0.14}"/>`;
}).join('');

const noche = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><defs>
<linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#101633"/><stop offset=".5" stop-color="#3A2A5C"/><stop offset=".78" stop-color="#A4506E"/><stop offset="1" stop-color="#F0A36B"/></linearGradient>
<radialGradient id="l" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFF4D6"/><stop offset=".5" stop-color="#FFE9B8" stop-opacity=".5"/><stop offset="1" stop-color="#FFE9B8" stop-opacity="0"/></radialGradient>
</defs><rect width="1280" height="720" fill="url(#c)"/>${estrellas}
<circle cx="980" cy="150" r="130" fill="url(#l)"/><circle cx="980" cy="150" r="44" fill="#FFF4D6"/>
${montana(500, 90, '#4A2F5E', 1.2)}${montana(560, 80, '#2A2144', 2.6)}${montana(630, 60, '#141431', 4.1)}</svg>`;

const dia = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><defs>
<linearGradient id="c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8CCBF2"/><stop offset=".62" stop-color="#E4F4FB"/><stop offset="1" stop-color="#FFFDF2"/></linearGradient>
<filter id="b"><feGaussianBlur stdDeviation="14"/></filter></defs>
<rect width="1280" height="720" fill="url(#c)"/>
<g fill="#fff" filter="url(#b)"><ellipse cx="260" cy="170" rx="170" ry="44"/><ellipse cx="350" cy="140" rx="110" ry="50"/><ellipse cx="900" cy="230" rx="210" ry="48"/><ellipse cx="1020" cy="196" rx="120" ry="46"/></g>
${montana(500, 70, '#A8D6A0', 0.6)}${montana(570, 60, '#7FC17A', 2.2)}${montana(650, 40, '#F4EFC2', 3.7)}</svg>`;

const dir = mkdtempSync(join(tmpdir(), 'kk-video-'));
const navegador = await chromium.launch({ channel: process.env.KK_CANAL ?? 'msedge', headless: true });
for (const [nombre, svg] of [['noche', noche], ['dia', dia]]) {
  const p = await navegador.newPage({ viewport: { width: 1280, height: 720 } });
  await p.setContent(`<!doctype html><style>html,body{margin:0}svg{display:block}</style>${svg}`);
  await p.screenshot({ path: join(dir, `${nombre}.png`) });
  await p.close();
}
await navegador.close();

const destino = resolve(AQUI, 'video.webm');
const zoom = "zoompan=z='1+0.00025*on':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=720:s=1280x720:fps=24,format=yuv420p";
execFileSync(FFMPEG, [
  '-y', '-loglevel', 'error',
  '-i', join(dir, 'noche.png'),
  '-i', join(dir, 'dia.png'),
  '-f', 'lavfi', '-i', 'sine=frequency=330:duration=60,volume=0.05',
  '-filter_complex', `[0]${zoom}[a];[1]${zoom}[b];[a][b]concat=n=2:v=1:a=0[v]`,
  '-map', '[v]', '-map', '2:a',
  '-c:v', 'libvpx-vp9', '-b:v', '350k', '-deadline', 'realtime', '-cpu-used', '8',
  '-c:a', 'libopus', '-b:a', '32k',
  '-t', '60',
  destino,
]);
rmSync(dir, { recursive: true, force: true });
console.log('Video generado:', destino);
