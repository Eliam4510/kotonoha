// Baja el contenido real de las imágenes del README a contenido-libre/, que no va en git. Todo es de uso libre:
// - un tramo del 施政方針演説 del 20 de febrero de 2026 en la Dieta, del canal de YouTube del 首相官邸, con su texto oficial
//   en japonés y en inglés: licencia PDL 1.0 (公共データ利用規約, compatible con CC BY 4.0), que cubre su web y sus cuentas;
// - el primer minuto de «What’s Up: November 2026 Skywatching Tips from NASA», con los subtítulos de la propia NASA:
//   obra del gobierno de EE. UU., de dominio público (crédito NASA/JPL-Caltech);
// - clásicos del Aozora Bunko, de dominio público: el Genji de Yosano Akiko (桐壺) y 『羅生門』, con su página y su hoja de
//   estilo;
// - la primera página del capítulo I de «Alice’s Adventures in Wonderland» en la edición de 1866, escaneada en Wikimedia
//   Commons, de dominio público.
// Los videos se bajan con el yt-dlp oficial que instala el ayudante (herramientas/ayudante/yt-dlp.exe, con QuickJS).
// Los subtítulos con sus tiempos y las traducciones están en pruebas/capturas/contenido-real.mjs.
// Uso: node herramientas/contenido-readme.mjs

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { unzipSync } from 'fflate';

const RAIZ = resolve(import.meta.dirname, '..');
const SALIDA = join(RAIZ, 'contenido-libre');
const AYUDANTE = join(RAIZ, 'herramientas', 'ayudante');
// Wikimedia pide que quien pide se identifique: con el proyecto basta.
const AGENTE = 'KotonohaDocs/1.0 (https://github.com/Eliam4510/kotonoha)';
mkdirSync(SALIDA, { recursive: true });

async function bajar(url, destino) {
  if (existsSync(destino)) return console.log('  ya está:', destino.slice(RAIZ.length + 1));
  const r = await fetch(url, { headers: { 'user-agent': AGENTE } });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${url}`);
  writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
  console.log('  bajado:', destino.slice(RAIZ.length + 1));
}

/** Un tramo de un video de YouTube, en 720p y en WebM, cortado justo en sus extremos. */
function tramo(id, desde, hasta, destino) {
  if (existsSync(destino)) return console.log('  ya está:', destino.slice(RAIZ.length + 1));
  const ytdlp = join(AYUDANTE, 'yt-dlp.exe');
  if (!existsSync(ytdlp)) throw new Error('Falta herramientas/ayudante/yt-dlp.exe: se instala con el ayudante (Instalar.cmd)');
  execFileSync(
    ytdlp,
    ['--js-runtimes', `quickjs:${join(AYUDANTE, 'qjs.exe')}`, '-f', 'bv*[height<=720]+ba/b[height<=720]', '--download-sections', `*${desde}-${hasta}`, '--force-keyframes-at-cuts', '--merge-output-format', 'webm', '-o', destino, `https://www.youtube.com/watch?v=${id}`],
    { stdio: 'inherit' }
  );
}

console.log('== Videos');
tramo('alk-cIHwTIU', '25:58', '27:30', join(SALIDA, 'dieta.webm'));
tramo('PN-iD6VTmyc', '0:00', '1:06', join(SALIDA, 'nasa.webm'));

console.log('== Aozora Bunko');
await bajar('https://www.aozora.gr.jp/cards/000052/files/5016_ruby_9746.zip', join(SALIDA, 'genji-kiritsubo.zip'));
await bajar('https://www.aozora.gr.jp/cards/000879/files/127_15260.html', join(SALIDA, 'rashomon.html'));
await bajar('https://www.aozora.gr.jp/cards/aozora.css', join(SALIDA, 'aozora.css'));
// El texto del Genji, de Shift_JIS a UTF-8: es el que lee pruebas/capturas/contenido-real.mjs.
const zip = unzipSync(new Uint8Array(readFileSync(join(SALIDA, 'genji-kiritsubo.zip'))));
const txt = Object.entries(zip).find(([n]) => n.endsWith('.txt'));
if (!txt) throw new Error('El zip del Genji no trae el texto');
writeFileSync(join(SALIDA, 'genji-kiritsubo.txt'), new TextDecoder('shift_jis').decode(txt[1]));

console.log('== Wikimedia Commons');
const api = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent("File:Carroll - Alice's adventures in Wonderland, 1866.djvu")}&prop=imageinfo&iiprop=url&iiurlwidth=1240&iiurlparam=page21-1240px&format=json`;
const info = await (await fetch(api, { headers: { 'user-agent': AGENTE } })).json();
const pagina = Object.values(info.query.pages)[0].imageinfo[0].thumburl;
await bajar(pagina, join(SALIDA, 'alice-1866-p21.jpg'));

console.log(`Listo en ${SALIDA.slice(RAIZ.length + 1)}`);
