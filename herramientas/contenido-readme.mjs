// Baja el contenido real de las imágenes del README a contenido-libre/, que no va en git. Todo es de uso libre:
// - un tramo del 施政方針演説 del 20 de febrero de 2026 en la Dieta, del canal de YouTube del 首相官邸, con su texto oficial
//   en japonés y en inglés: licencia PDL 1.0 (公共データ利用規約, compatible con CC BY 4.0), que cubre su web y sus cuentas;
// - el primer minuto de «What’s Up: November 2026 Skywatching Tips from NASA», con los subtítulos de la propia NASA:
//   obra del gobierno de EE. UU., de dominio público (crédito NASA/JPL-Caltech);
// - clásicos del Aozora Bunko, de dominio público: el Genji de Yosano Akiko (桐壺) y 『羅生門』, con su página y su hoja de
//   estilo;
// - la primera página del capítulo I de «Alice’s Adventures in Wonderland» en la edición de 1866, escaneada en Wikimedia
//   Commons, de dominio público;
// - la tapa y las primeras dobles páginas del volumen 1 de 『源氏物語』 en su edición ilustrada de 1650 (慶安3年, la de
//   山本春正), de la Biblioteca Nacional de la Dieta: dominio público (PDM), con el crédito 国立国会図書館デジタルコレクション.
// Los videos se bajan con el yt-dlp oficial que instala el ayudante (herramientas/ayudante/yt-dlp.exe, con QuickJS).
// Los subtítulos con sus tiempos y las traducciones están en pruebas/capturas/contenido-real.mjs.
// Uso: node herramientas/contenido-readme.mjs

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { unzipSync } from 'fflate';
import sharp from 'sharp';

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

/**
 * Lo que es libro en una foto de la Biblioteca Nacional de la Dieta: el libro abierto va sobre un fondo gris, con una regla
 * y su ficha debajo, y la tapa, con una carta de colores al lado. El papel viejo es casi tan claro como el fondo, pero
 * cálido (más rojo que azul) y el fondo, neutro: es libro lo cálido o lo muy distinto del fondo, como la tapa verde. Se
 * queda la franja más ancha de columnas y de filas que lo son, por encima de la regla, con un margen pequeño.
 */
async function soloElLibro(foto) {
  const { data, info } = await sharp(foto).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const px = (x, y) => (y * w + x) * 3;
  const muestras = [];
  for (let y = Math.round(h * 0.3); y < h * 0.6; y += 7) for (let x = 5; x < w * 0.04; x += 5) muestras.push(px(x, y));
  const fondo = [0, 1, 2].map((c) => muestras.map((i) => data[i + c]).sort((a, b) => a - b)[muestras.length >> 1]);
  const libro = (x, y) => {
    const i = px(x, y);
    const calido = data[i] - data[i + 2] - (fondo[0] - fondo[2]) > 10;
    return calido || Math.abs(data[i] - fondo[0]) + Math.abs(data[i + 1] - fondo[1]) + Math.abs(data[i + 2] - fondo[2]) > 90;
  };
  const alto = Math.round(h * 0.86);
  const franja = (valores) => {
    let mejor = [0, -1];
    let desde = -1;
    valores.forEach((v, i) => {
      if (v < 0.5) return void (desde = -1);
      if (desde < 0) desde = i;
      if (i - desde > mejor[1] - mejor[0]) mejor = [desde, i];
    });
    return mejor;
  };
  const columnas = Array.from({ length: w }, (_, x) => {
    let n = 0;
    for (let y = 0; y < alto; y += 4) n += libro(x, y);
    return n / Math.ceil(alto / 4);
  });
  const [x0, x1] = franja(columnas);
  const filas = Array.from({ length: alto }, (_, y) => {
    let n = 0;
    for (let x = x0; x <= x1; x += 4) n += libro(x, y);
    return n / Math.ceil((x1 - x0 + 1) / 4);
  });
  const [y0, y1] = franja(filas);
  const m = Math.round(w * 0.006);
  const left = Math.max(0, x0 - m);
  const top = Math.max(0, y0 - m);
  return { left, top, width: Math.min(w, x1 + m + 1) - left, height: Math.min(alto, y1 + m + 1) - top };
}

console.log('== Biblioteca Nacional de la Dieta');
// 『源氏物語』 de 1650, volumen 1 (https://dl.ndl.go.jp/pid/2579509), por IIIF: la tapa y las trece primeras dobles
// páginas, con las ilustraciones de las fotos 5 y 12. Aquí no hace falta que quien pide diga quién es.
const GENJI_1650 = join(SALIDA, 'genji-1650');
mkdirSync(join(GENJI_1650, 'fotos'), { recursive: true });
for (let k = 1; k <= 14; k++) {
  const nombre = `p${String(k).padStart(3, '0')}.jpg`;
  const foto = join(GENJI_1650, 'fotos', nombre);
  if (!existsSync(foto)) {
    const url = `https://dl.ndl.go.jp/api/iiif/2579509/R${String(k).padStart(7, '0')}/full/2400,/0/default.jpg`;
    const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; doc-capture/1.0)' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${url}`);
    writeFileSync(foto, Buffer.from(await r.arrayBuffer()));
    console.log('  bajado:', foto.slice(RAIZ.length + 1));
    await new Promise((ok) => setTimeout(ok, 800));
  }
  // El recorte se rehace siempre: es barato, y así se puede afinar sin volver a pedir las fotos.
  const datos = readFileSync(foto);
  await sharp(datos).extract(await soloElLibro(datos)).jpeg({ quality: 90 }).toFile(join(GENJI_1650, nombre));
}
console.log('  recortadas:', GENJI_1650.slice(RAIZ.length + 1));

console.log(`Listo en ${SALIDA.slice(RAIZ.length + 1)}`);
