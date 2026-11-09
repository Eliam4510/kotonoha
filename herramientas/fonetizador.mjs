// Prepara al compilar el fonetizador de las voces neuronales: piper-phonemize, con espeak-ng, en WebAssembly
// (@diffusionstudio/piper-wasm). Lo convierte en un módulo que se puede importar desde un trabajador y deja en sus datos
// solo los diccionarios de las lenguas que se leen con él, el inglés y el alemán: de 18 MB a unos 2.

import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ORIGEN = 'node_modules/@diffusionstudio/piper-wasm/build';
const LENGUAS = ['en', 'de'];
const LLAMADA = 'loadPackage(';

export async function prepararFonetizador(salida) {
  const destino = join(salida, 'voz');
  await mkdir(destino, { recursive: true });
  const js = await readFile(join(ORIGEN, 'piper_phonemize.js'), 'utf8');
  const datos = await readFile(join(ORIGEN, 'piper_phonemize.data'));

  // Los archivos del paquete de datos de Emscripten, con dónde empieza y acaba cada uno.
  const inicio = js.indexOf(`${LLAMADA}{"files":`);
  if (inicio < 0) throw new Error('piper_phonemize.js: no encuentro la lista de archivos de sus datos');
  const fin = js.indexOf('})', js.indexOf('"remote_package_size"', inicio)) + 1;
  const meta = JSON.parse(js.slice(inicio + LLAMADA.length, fin));

  const esDiccionario = (f) => /_dict$/.test(f.filename);
  const sirve = (f) => !esDiccionario(f) || LENGUAS.some((l) => f.filename.endsWith(`/${l}_dict`));
  const partes = [];
  let posicion = 0;
  const files = meta.files.filter(sirve).map((f) => {
    const trozo = datos.subarray(f.start, f.end);
    partes.push(trozo);
    const nuevo = { ...f, start: posicion, end: posicion + trozo.length };
    posicion += trozo.length;
    return nuevo;
  });
  if (files.filter(esDiccionario).length !== LENGUAS.length) throw new Error('piper_phonemize.data: faltan diccionarios');

  const modulo = `${js.slice(0, inicio + LLAMADA.length)}${JSON.stringify({ ...meta, files, remote_package_size: posicion })}${js.slice(fin)}\nexport default createPiperPhonemize;\n`;
  await writeFile(join(destino, 'piper_phonemize.mjs'), modulo);
  await writeFile(join(destino, 'piper_phonemize.data'), Buffer.concat(partes));
  await copyFile(join(ORIGEN, 'piper_phonemize.wasm'), join(destino, 'piper_phonemize.wasm'));
}
