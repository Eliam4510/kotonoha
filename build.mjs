// Empaqueta la extensión en dist/. Uso: node build.mjs [--watch]
import { createHash } from 'node:crypto';
import { build, context } from 'esbuild';
import { copyFile, cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { generarIconos } from './herramientas/iconos.mjs';
import { escribirLicencias } from './herramientas/licencias.mjs';
import { MENSAJES, manifiesto } from './manifiesto.mjs';

const vigilar = process.argv.includes('--watch');
// KK_SALIDA es para las pruebas: lleva clave fija y sin minificar. KK_PUBLICAR es igual que dist, pero en otra carpeta.
const SALIDA = process.env.KK_SALIDA ?? process.env.KK_PUBLICAR ?? 'dist';

const entradas = {
  pagina: 'src/pagina/index.ts',
  contenido: 'src/contenido/index.tsx',
  fondo: 'src/fondo/index.ts',
  motor: 'src/motor/index.ts',
  app: 'src/app/index.tsx',
  popup: 'src/popup/index.tsx',
  lector: 'src/lector/index.tsx',
};

const opciones = {
  entryPoints: entradas,
  outdir: SALIDA,
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  charset: 'utf8',
  jsx: 'automatic',
  jsxImportSource: 'preact',
  loader: { '.css': 'text' },
  // El content script corre en todas las páginas: la compilación normal va minificada.
  // Las de prueba y desarrollo conservan los nombres para poder depurar.
  sourcemap: vigilar || process.env.KK_SALIDA ? 'inline' : false,
  minify: !vigilar && !process.env.KK_SALIDA,
  logLevel: 'info',
  // El SDK de Anthropic detecta el entorno; en el navegador no necesita módulos de Node.
  define: { 'process.env.NODE_ENV': '"production"' },
};

// Whisper va aparte, como módulo: pesa mucho y se carga solo si se usa.
const opcionesWhisper = {
  ...opciones,
  entryPoints: { whisper: 'src/motor/whisperTrabajador.ts' },
  format: 'esm',
  sourcemap: false,
  minify: true,
};

async function estaticos() {
  await mkdir(join(SALIDA, 'dict'), { recursive: true });
  // Las compilaciones de prueba llevan una clave fija: así comparten identificador de extensión, y por
  // tanto diccionarios, sea cual sea su carpeta. La compilación normal no la lleva para conservar el
  // identificador, derivado de la ruta, con el que el navegador guarda tus datos.
  const clavePrueba = process.env.KK_SALIDA ? { key: (await readFile('pruebas/clave-extension-pruebas.txt', 'utf8')).trim() } : {};
  await writeFile(join(SALIDA, 'manifest.json'), JSON.stringify({ ...manifiesto, ...clavePrueba }, null, 2));

  for (const pagina of ['app', 'popup', 'motor', 'lector']) {
    await copyFile(`src/${pagina}/index.html`, join(SALIDA, `${pagina}.html`));
  }
  await cp('publico', SALIDA, { recursive: true });

  // Tipografía redondeada: Nunito para el latín y Zen Maru Gothic para el japonés.
  await mkdir(join(SALIDA, 'fuentes'), { recursive: true });
  for (const subconjunto of ['latin', 'latin-ext']) {
    await copyFile(`node_modules/@fontsource-variable/nunito/files/nunito-${subconjunto}-wght-normal.woff2`, join(SALIDA, 'fuentes', `nunito-${subconjunto}.woff2`));
  }
  for (const peso of [500, 700, 900]) {
    await copyFile(`node_modules/@fontsource/zen-maru-gothic/files/zen-maru-gothic-japanese-${peso}-normal.woff2`, join(SALIDA, 'fuentes', `japanese-${peso}.woff2`));
  }

  // El motor de ONNX para Whisper: la política de seguridad exige servirlo desde la propia extensión.
  await mkdir(join(SALIDA, 'ort'), { recursive: true });
  for (const archivo of ['ort-wasm-simd-threaded.asyncify.mjs', 'ort-wasm-simd-threaded.asyncify.wasm']) {
    await copyFile(`node_modules/onnxruntime-web/dist/${archivo}`, join(SALIDA, 'ort', archivo));
  }

  // ffmpeg.wasm para los archivos propios: subtítulos incrustados, pistas de audio y audio para Whisper.
  await cp('node_modules/@ffmpeg/ffmpeg/dist/esm', join(SALIDA, 'ffmpeg'), { recursive: true, filter: (f) => !f.endsWith('.d.ts') });
  for (const archivo of ['ffmpeg-core.js', 'ffmpeg-core.wasm']) {
    await copyFile(`node_modules/@ffmpeg/core/dist/esm/${archivo}`, join(SALIDA, 'ffmpeg', archivo));
  }

  // Kuromoji se carga como script clásico y sus diccionarios se leen con rutas relativas al documento.
  await copyFile('node_modules/kuromoji/build/kuromoji.js', join(SALIDA, 'kuromoji.js'));
  for (const archivo of await readdir('node_modules/kuromoji/dict')) {
    await copyFile(join('node_modules/kuromoji/dict', archivo), join(SALIDA, 'dict', archivo));
  }

  // Una tabla por idioma, aparte: el content script solo carga la que hace falta.
  for (const [idioma, textos] of Object.entries(MENSAJES)) {
    await mkdir(join(SALIDA, '_locales', idioma), { recursive: true });
    const mensajes = Object.fromEntries(Object.entries(textos).map(([clave, message]) => [clave, { message }]));
    await writeFile(join(SALIDA, '_locales', idioma, 'messages.json'), JSON.stringify(mensajes, null, 1));
  }
  await mkdir(join(SALIDA, 'idiomas'), { recursive: true });
  for (const archivo of await readdir('idiomas', { withFileTypes: true })) {
    if (archivo.isFile() && archivo.name.endsWith('.json')) await copyFile(join('idiomas', archivo.name), join(SALIDA, 'idiomas', archivo.name));
  }

  escribirLicencias(SALIDA);
}

generarIconos();
await rm(SALIDA, { recursive: true, force: true });
await mkdir(SALIDA, { recursive: true });

async function huella(carpeta) {
  const archivos = (await readdir(carpeta, { recursive: true, withFileTypes: true }))
    .filter((e) => e.isFile() && e.name !== 'compilacion.txt')
    .map((e) => join(e.parentPath, e.name))
    .sort();
  const suma = createHash('sha256');
  for (const ruta of archivos) {
    suma.update(ruta);
    suma.update(await readFile(ruta));
  }
  return suma.digest('hex');
}

if (vigilar) {
  const ctx = await context(opciones);
  await ctx.watch();
  const ctxWhisper = await context(opcionesWhisper);
  await ctxWhisper.watch();
  await estaticos();
  console.log('Vigilando cambios en src/ ...');
} else {
  await build(opciones);
  await build(opcionesWhisper);
  await estaticos();
  // Lo último de todo: la extensión se recarga sola al ver que cambia, y para entonces ya está todo escrito.
  // Sale del contenido: recargar sin motivo cortaría la captura de audio de la pestaña que se esté viendo.
  await writeFile(join(SALIDA, 'compilacion.txt'), await huella(SALIDA));
  console.log(`Compilación lista en ${SALIDA}/`);
}
