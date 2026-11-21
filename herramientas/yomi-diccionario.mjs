// El diccionario de yomi para las pruebas (naist-jdic, BSD-3): se baja una vez, de la dirección fijada en el paquete del
// japonés y comprobado por SHA-256, a node_modules/.cache/kotonoha/. La extensión lo baja ella misma al instalar las voces.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';

const CACHE = resolve(import.meta.dirname, '..', 'node_modules', '.cache', 'kotonoha');
const huella = (datos) => createHash('sha256').update(datos).digest('hex');

/** El diccionario descomprimido. `fuente` es el `diccionario` de la voz de la lengua: { url, sha256 }. */
export async function diccionarioYomi(fuente) {
  const ruta = join(CACHE, `yomi-${fuente.sha256.slice(0, 16)}.jtd.gz`);
  let datos = existsSync(ruta) ? readFileSync(ruta) : null;
  if (!datos || huella(datos) !== fuente.sha256) {
    const r = await fetch(fuente.url);
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${fuente.url}`);
    datos = Buffer.from(await r.arrayBuffer());
    if (huella(datos) !== fuente.sha256) throw new Error('El diccionario de yomi no es el que se esperaba');
    mkdirSync(CACHE, { recursive: true });
    writeFileSync(ruta, datos);
  }
  return new Uint8Array(gunzipSync(datos));
}
