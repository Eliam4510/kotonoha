// Prepara lo que se publica con cada versión: la extensión compilada y el ayudante, en dos ZIP.
// Uso: npm run paquete. El resultado queda en release/, con sus sumas SHA-256.
// Con KK_PUBLICAR=carpeta compila ahí en lugar de en dist, para no recargar una copia que se esté usando desde dist.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { zipSync } from 'fflate';

const SALIDA = 'release';
const COMPILADO = process.env.KK_PUBLICAR ?? 'dist';
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));

execFileSync(process.execPath, ['build.mjs'], { stdio: 'inherit' });

const manifiesto = JSON.parse(readFileSync(join(COMPILADO, 'manifest.json'), 'utf8'));
if (manifiesto.version !== version) throw new Error(`El manifiesto dice ${manifiesto.version} y package.json ${version}`);
// Con clave, todas las copias compartirían identificador. La compilación normal no debe llevarla.
if (manifiesto.key) throw new Error('La compilación que se publica no debe llevar clave');

// Lo que ya viene comprimido no gana nada y tarda más.
const YA_COMPRIMIDO = new Set(['.png', '.gz', '.woff2']);

function listar(carpeta, prefijo = '') {
  return readdirSync(carpeta, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listar(join(carpeta, e.name), `${prefijo}${e.name}/`) : [[`${prefijo}${e.name}`, join(carpeta, e.name)]]
  );
}

function empaquetar(archivo, raiz, entradas) {
  const contenido = {};
  for (const [ruta, origen] of entradas) {
    contenido[`${raiz}/${ruta}`] = [new Uint8Array(readFileSync(origen)), { level: YA_COMPRIMIDO.has(extname(ruta)) ? 0 : 9 }];
  }
  const zip = zipSync(contenido);
  writeFileSync(join(SALIDA, archivo), zip);
  const suma = createHash('sha256').update(zip).digest('hex');
  console.log(`${archivo}: ${(zip.length / 1e6).toFixed(1)} MB, ${entradas.length} archivos`);
  return `${suma}  ${archivo}`;
}

rmSync(SALIDA, { recursive: true, force: true });
mkdirSync(SALIDA, { recursive: true });

// compilacion.txt va al final: al descomprimir encima de una copia en uso, la extensión se recarga
// cuando este archivo cambia, y para entonces todo lo demás ya está escrito.
const extension = listar(COMPILADO).sort(([a], [b]) => Number(a === 'compilacion.txt') - Number(b === 'compilacion.txt'));

// Solo estos archivos del ayudante: los que genera su instalador llevan las rutas de cada equipo, y yt-dlp y QuickJS
// los baja el instalador de sus páginas oficiales.
const ayudante = [
  ['Instalar.cmd', 'herramientas/ayudante/Instalar.cmd'],
  ['Desinstalar.cmd', 'herramientas/ayudante/Desinstalar.cmd'],
  ['LEEME.txt', 'herramientas/ayudante/LEEME.txt'],
  ['instalar.ps1', 'herramientas/ayudante/instalar.ps1'],
  ['kotonoha_ayudante.ps1', 'herramientas/ayudante/kotonoha_ayudante.ps1'],
  ['LICENSE.txt', 'LICENSE'],
];
// Windows PowerShell lee sin BOM en la página de códigos del sistema: los acentos saldrían rotos.
for (const [nombre, origen] of ayudante) {
  if (nombre.endsWith('.ps1') && readFileSync(origen).subarray(0, 3).toString('hex') !== 'efbbbf') throw new Error(`${origen} debe llevar BOM`);
}

const sumas = [
  empaquetar(`kotonoha-${version}-extension.zip`, 'kotonoha', extension),
  empaquetar(`kotonoha-${version}-ayudante.zip`, 'kotonoha-ayudante', ayudante),
];
writeFileSync(join(SALIDA, 'SHA256SUMS.txt'), `${sumas.join('\n')}\n`);
console.log(`Paquetes de la versión ${version} listos en ${SALIDA}/`);
