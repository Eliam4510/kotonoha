// Saca el diccionario del reconocedor del modo Libro (la lista character_dict de inference.yml de PP-OCRv6 small, fijada
// a un commit) a publico/modelos/PP-OCRv6_small_rec.dict.json, que es lo que lee el trabajador del OCR. El modelo se
// descarga de Hugging Face al usarlo; el diccionario va en la extensión porque el trabajador no lee YAML.
// Sin dependencias: la lista lleva una entrada por línea, tal cual o entre comillas simples o dobles.
// Uso: node herramientas/diccionario-ocr.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RECONOCEDOR = { repositorio: 'PaddlePaddle/PP-OCRv6_small_rec_onnx', revision: 'b8f84f0b80c529de40b4fbb3544b84fa7233a513' };
const SALIDA = join(dirname(fileURLToPath(import.meta.url)), '..', 'publico', 'modelos', 'PP-OCRv6_small_rec.dict.json');

/** El valor de una entrada de la lista: entre comillas simples ('' es una), dobles (con escapes) o tal cual. */
function valor(v) {
  if (v.length >= 2 && v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) {
    const json = v
      .replace(/\\x([0-9a-fA-F]{2})/g, '\\u00$1')
      .replace(/\\U([0-9a-fA-F]{8})/g, (_, h) => {
        const c = String.fromCodePoint(parseInt(h, 16));
        return JSON.stringify(c).slice(1, -1);
      });
    return JSON.parse(json);
  }
  return v;
}

/** La lista character_dict de un inference.yml de PaddleOCR. */
export function diccionarioDeYaml(yml) {
  const lineas = yml.split(/\r?\n/);
  const inicio = lineas.findIndex((l) => /^\s*character_dict:\s*$/.test(l));
  if (inicio < 0) throw new Error('El YAML no trae character_dict');
  const salida = [];
  for (const l of lineas.slice(inicio + 1)) {
    const m = /^\s+- (.*)$/.exec(l);
    if (!m) break;
    salida.push(valor(m[1]));
  }
  return salida;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const url = `https://huggingface.co/${RECONOCEDOR.repositorio}/resolve/${RECONOCEDOR.revision}/inference.yml`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  const letras = diccionarioDeYaml(await r.text());
  mkdirSync(dirname(SALIDA), { recursive: true });
  writeFileSync(SALIDA, JSON.stringify(letras));
  console.log(`${letras.length} letras en ${SALIDA}`);
}
