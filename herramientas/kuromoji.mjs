// Kuromoji para la extensión. El código se empaqueta desde sus fuentes con un cargador propio, que descomprime el
// diccionario con el navegador en vez de con zlibjs (src/lenguas/japones/kuromojiCargador.cjs). Y el diccionario va sin
// el relleno de ceros con que se guardaron varios de sus archivos: de 96 MB descomprimidos a 62, que el motor tiene en
// memoria todo el rato. Uno de ellos, unk_invoke.dat, hacía además que Kuromoji creara unas 150 000 clases de caracteres
// vacías, una por cada ocho ceros, en vez de las once que tiene.

import { build } from 'esbuild';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

/**
 * Los archivos que se pueden recortar: se leen por posiciones guardadas en otros (el diccionario y sus categorías) o en
 * un bucle hasta el final (los mapas y las clases de caracteres), y los ceros del final no son datos. Los mapas de
 * caracteres (unk_char, unk_compat) se leen con el código del carácter como índice y no se tocan.
 */
export const RECORTABLES = /^(tid|tid_pos|tid_map|unk|unk_pos|unk_map|unk_invoke)\.dat\.gz$/;

/** Sin los ceros del final, dejando 16 bytes de margen por si lo último de verdad acababa en ceros. */
export function recortarCeros(datos) {
  let fin = datos.length;
  while (fin > 0 && datos[fin - 1] === 0) fin--;
  return datos.subarray(0, Math.min(datos.length, Math.ceil((fin + 16) / 4) * 4));
}

/** El contenido que irá en la extensión de un archivo del diccionario, ya comprimido. */
export function archivoDiccionario(nombre, gz) {
  return RECORTABLES.test(nombre) ? gzipSync(recortarCeros(gunzipSync(gz)), { level: 9 }) : gz;
}

const DIC = 'node_modules/kuromoji/dict';

export async function prepararKuromoji(salida) {
  const cargador = resolve('src/lenguas/japones/kuromojiCargador.cjs');
  await build({
    entryPoints: ['node_modules/kuromoji/src/kuromoji.js'],
    bundle: true,
    format: 'iife',
    globalName: 'kuromoji',
    platform: 'browser',
    target: 'es2022',
    minify: true,
    legalComments: 'none',
    outfile: join(salida, 'kuromoji.js'),
    logLevel: 'warning',
    plugins: [
      {
        name: 'kuromoji-navegador',
        setup(b) {
          // El cargador propio en lugar del de Node o el de zlibjs.
          b.onResolve({ filter: /DictionaryLoader(\.js)?$/ }, (a) => (/(Node|Browser)DictionaryLoader/.test(a.path) ? { path: cargador } : undefined));
          // DictionaryLoader solo usa path.join para unir la carpeta y el nombre del archivo.
          b.onResolve({ filter: /^path$/ }, () => ({ path: 'path', namespace: 'kuromoji-path' }));
          b.onLoad({ filter: /.*/, namespace: 'kuromoji-path' }, () => ({
            contents: "module.exports = { join: (...p) => p.filter(Boolean).join('/').replace(/\\/{2,}/g, '/') };",
            loader: 'js',
          }));
        },
      },
    ],
  });
  await mkdir(join(salida, 'dict'), { recursive: true });
  for (const nombre of await readdir(DIC)) {
    await writeFile(join(salida, 'dict', nombre), archivoDiccionario(nombre, await readFile(join(DIC, nombre))));
  }
}
