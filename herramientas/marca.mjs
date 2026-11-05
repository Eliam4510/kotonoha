// Genera la marca a partir de los SVG de herramientas/marca/:
// los PNG de la extensión en publico/ y las formas del logo para la interfaz en src/ui/marca-datos.ts.
// A 16 y 32 px el kanji 言 se empasta, así que esos tamaños usan la versión simplificada.
// Uso: node herramientas/marca.mjs

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FUENTE = join(RAIZ, 'herramientas', 'marca');
const hoja = readFileSync(join(FUENTE, 'hoja.svg'), 'utf8');
const pequena = readFileSync(join(FUENTE, 'hoja-pequena.svg'), 'utf8');

const interior = (svg) => svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/\n\s*/g, '').trim();

writeFileSync(
  join(RAIZ, 'src', 'ui', 'marca-datos.ts'),
  `// Generado por herramientas/marca.mjs. No editar a mano.\n\nexport const HOJA = ${JSON.stringify(interior(hoja))};\nexport const HOJA_PEQUENA = ${JSON.stringify(interior(pequena))};\n`
);

mkdirSync(join(RAIZ, 'publico'), { recursive: true });
const navegador = await chromium.launch({ channel: process.env.KK_CANAL ?? 'msedge', headless: true });
for (const t of [16, 32, 48, 128]) {
  const p = await navegador.newPage({ viewport: { width: t, height: t } });
  const svg = (t >= 48 ? hoja : pequena).replace('<svg ', `<svg width="${t}" height="${t}" `);
  await p.setContent(`<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block}</style>${svg}`);
  await p.screenshot({ path: join(RAIZ, 'publico', `icono${t}.png`), omitBackground: true });
  await p.close();
}
await navegador.close();
console.log('Marca generada.');
