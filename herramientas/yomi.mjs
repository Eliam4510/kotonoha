// Incorpora yomi (@hdae/yomi, de JSR, MIT): el OpenJTalk reescrito en TypeScript con que la voz neuronal del japonés
// saca la lectura, el acento y las frases acentuales. Se copia su código fuente tal cual, salvo dos cosas:
//   - las importaciones pierden la extensión (.js, .ts), que el tsconfig de Kotonoha no admite;
//   - su cargador (loader/) no se copia: usa @hdae/fetch-cache, y Kotonoha baja el diccionario con lo suyo.
// Uso: node herramientas/yomi.mjs <carpeta package/ del .tgz de npm.jsr.io/@jsr/hdae__yomi>
// Antes de actualizar, revisar el código nuevo (que no use red, procesos ni eval) y volver a medir el acento con
// herramientas/corpus-acento.mjs.

import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const RAIZ = resolve(import.meta.dirname, '..');
const DESTINO = join(RAIZ, 'src', 'lenguas', 'japones', 'voz', 'yomi');
const origen = process.argv[2];
if (!origen) throw new Error('Falta la carpeta package/ de yomi');

const paquete = JSON.parse(readFileSync(join(origen, 'package.json'), 'utf8'));
const fuentes = join(origen, 'src');

function recorrer(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const r = join(dir, e.name);
    return e.isDirectory() ? recorrer(r) : [r];
  });
}

rmSync(DESTINO, { recursive: true, force: true });
let archivos = 0;
for (const ruta of recorrer(fuentes)) {
  const rel = relative(fuentes, ruta).replace(/\\/g, '/');
  if (!rel.endsWith('.ts') || rel.endsWith('.d.ts') || rel.startsWith('loader/')) continue;
  const codigo = readFileSync(ruta, 'utf8').replace(/(from\s+["'])(\.\.?\/[^"']+?)\.(?:js|ts)(["'])/g, '$1$2$3');
  const salida = join(DESTINO, rel);
  mkdirSync(dirname(salida), { recursive: true });
  writeFileSync(salida, codigo);
  archivos++;
}
for (const f of ['LICENSE', 'NOTICE']) cpSync(join(origen, f), join(DESTINO, f));
writeFileSync(
  join(DESTINO, 'LEEME.md'),
  `# yomi ${paquete.version}

Código de [@hdae/yomi](https://jsr.io/@hdae/yomi) ${paquete.version} (MIT, ver LICENSE y NOTICE), incorporado con
\`herramientas/yomi.mjs\`. Cambios respecto al original: las importaciones van sin extensión y no está su cargador
(\`loader/\`). El diccionario (naist-jdic, BSD-3) no va aquí: Kotonoha lo baja al instalar las voces.
`
);
console.log(`yomi ${paquete.version}: ${archivos} archivos en ${relative(RAIZ, DESTINO)}`);
