// Los datos del chino para las pruebas: CC-CEDICT para Yomitan (CC BY-SA 4.0) y la lista de frecuencia de FrequencyWords
// (CC BY-SA 4.0), de direcciones fijadas y comprobados por SHA-256. Se bajan una vez a node_modules/.cache/kotonoha/. La
// extensión no los usa de aquí: los baja ella misma, en su versión más nueva, al instalar los diccionarios.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';

const CACHE = resolve(import.meta.dirname, '..', 'node_modules', '.cache', 'kotonoha');
const huella = (datos) => createHash('sha256').update(datos).digest('hex');

export const CC_CEDICT = {
  url: 'https://github.com/MarvNC/cc-cedict-yomitan/releases/download/2026-11-21/CC-CEDICT.zip',
  sha256: 'ecfe0737408d0b47b9ac10ea2899748fec7404970d15c625a25a3bb3a3abee0c',
};

export const FRECUENCIA = {
  url: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/f8a65e6ddc17e0baa2e366a909986798d8dbe55b/content/2018/zh_cn/zh_cn_50k.txt',
  sha256: '25599e00347b893e55c3058a748819b3fe19403291cd12f7c03af128e7f3fe45',
};

export async function bajar(fuente, nombre) {
  const ruta = join(CACHE, nombre);
  let datos = existsSync(ruta) ? readFileSync(ruta) : null;
  if (!datos || huella(datos) !== fuente.sha256) {
    const r = await fetch(fuente.url);
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${fuente.url}`);
    datos = Buffer.from(await r.arrayBuffer());
    if (huella(datos) !== fuente.sha256) throw new Error(`${nombre} no es el que se esperaba`);
    mkdirSync(CACHE, { recursive: true });
    writeFileSync(ruta, datos);
  }
  return datos;
}

/** Las lecturas de cada término de CC-CEDICT y el puesto de cada palabra en la lista de frecuencia. */
export async function datosChino() {
  const [zip, lista] = await Promise.all([bajar(CC_CEDICT, `cc-cedict-${CC_CEDICT.sha256.slice(0, 16)}.zip`), bajar(FRECUENCIA, `zh_cn-${FRECUENCIA.sha256.slice(0, 16)}.txt`)]);
  const lecturas = new Map();
  const archivos = unzipSync(new Uint8Array(zip), { filter: (f) => /^term_bank_\d+\.json$/.test(f.name) });
  for (const datos of Object.values(archivos)) {
    for (const [termino, lectura] of JSON.parse(strFromU8(datos))) {
      const previas = lecturas.get(termino);
      if (!previas) lecturas.set(termino, [lectura]);
      else if (!previas.includes(lectura)) previas.push(lectura);
    }
  }
  const rangos = new Map();
  lista
    .toString('utf8')
    .split(/\r?\n/)
    .forEach((l, i) => {
      const termino = l.split(' ')[0];
      if (termino && !rangos.has(termino)) rangos.set(termino, i + 1);
    });
  return { lecturas, rangos };
}
