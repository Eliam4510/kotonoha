// Reúne las licencias de lo que se compila. Lo que se distribuye debe llevarlas: MIT, Apache y OFL piden
// acompañar sus avisos, y GPL y LGPL, además, el texto completo de la licencia.

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ARCHIVO_LICENCIA = /^(licen[cs]e|copying|notice)/i;
// Transformers.js los declara, pero solo se usan fuera del navegador: no llegan a la compilación.
const SOLO_NODE = new Set(['sharp', 'onnxruntime-node']);

function carpetaDe(nombre, desde) {
  const propia = join(desde, 'node_modules', nombre);
  if (existsSync(propia)) return propia;
  const comun = join('node_modules', nombre);
  return existsSync(comun) ? comun : null;
}

function componentes() {
  const vistos = new Map();
  const visitar = (nombre, desde) => {
    if (SOLO_NODE.has(nombre)) return;
    const carpeta = carpetaDe(nombre, desde);
    if (!carpeta || vistos.has(carpeta)) return;
    const paquete = JSON.parse(readFileSync(join(carpeta, 'package.json'), 'utf8'));
    vistos.set(carpeta, paquete);
    for (const dependencia of Object.keys(paquete.dependencies ?? {})) visitar(dependencia, carpeta);
  };
  const raiz = JSON.parse(readFileSync('package.json', 'utf8'));
  for (const dependencia of Object.keys(raiz.dependencies)) visitar(dependencia, '.');
  return [...vistos].sort(([, a], [, b]) => a.name.localeCompare(b.name));
}

function textoDe(carpeta, paquete) {
  const archivos = readdirSync(carpeta).filter((f) => ARCHIVO_LICENCIA.test(f) && statSync(join(carpeta, f)).isFile());
  const licencia = typeof paquete.license === 'string' ? paquete.license : (paquete.license?.type ?? 'sin indicar');
  const cuerpo = archivos.map((f) => readFileSync(join(carpeta, f), 'utf8').trim()).join('\n\n');
  return `${'='.repeat(78)}\n${paquete.name} ${paquete.version} (${licencia})\n${'='.repeat(78)}\n\n${cuerpo || 'El paquete no incluye el texto de su licencia: consúltese el indicado arriba.'}\n`;
}

export function escribirLicencias(salida) {
  const destino = join(salida, 'licencias');
  mkdirSync(destino, { recursive: true });
  copyFileSync('LICENSE', join(destino, 'LICENSE-kotonoha.txt'));
  copyFileSync('AVISOS.md', join(destino, 'AVISOS.md'));
  for (const archivo of readdirSync('herramientas/licencias')) copyFileSync(join('herramientas/licencias', archivo), join(destino, archivo));
  const partes = componentes().map(([carpeta, paquete]) => textoDe(carpeta, paquete));
  writeFileSync(join(destino, 'TERCEROS.txt'), `Componentes de terceros · Third-party components\n\n${partes.join('\n')}`);
}
