// Prueba el ayudante local de extremo a extremo sin tocar el registro ni salir a internet: el instalador lo prepara en
// una carpeta temporal, se arranca con su lanzador .cmd como lo haría el navegador, y yt-dlp descarga el video de un
// servidor en este mismo equipo. Prueba los dos modos (con FFmpeg entrega las muestras de Whisper; sin él, el archivo,
// que convierte la extensión) y la actualización de la extensión con un paquete de una versión servida aquí.
//
// Uso: node pruebas/ayudante.mjs [video.mp4]
// Sin video se genera uno de tres minutos con FFmpeg. yt-dlp.exe y qjs.exe los baja el instalador; con
// KK_HERRAMIENTAS=carpeta se copian de ahí y no hace falta conexión.

import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, createReadStream, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { zipSync } from 'fflate';

const RAIZ = resolve(import.meta.dirname, '..');
const ORIGEN_PRUEBAS = 'chrome-extension://pldipbgollbhkjjigkgnojdjpfhanhhf/';
const ID_FIJO = 'pndmalmeggkhpinfpnfebbknfbmafgep';
let [video] = process.argv.slice(2);

let fallos = 0;
function comprobar(nombre, ok, detalle = '') {
  console.log(`${ok ? 'ok  ' : 'MAL '} ${nombre}${detalle ? `: ${detalle}` : ''}`);
  if (!ok) fallos++;
}

// Lo que no empieza por «kotonoha-»: el ayudante borra sus carpetas temporales, y la prueba las cuenta.
const trabajo = mkdtempSync(join(tmpdir(), 'kkprueba-ayudante-'));
const carpeta = join(trabajo, 'ayudante');

// ---------- El instalador, sin registro ----------
{
  const herramientas = process.env.KK_HERRAMIENTAS;
  const argumentos = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(RAIZ, 'herramientas', 'ayudante', 'instalar.ps1'), '-Carpeta', carpeta, '-SinRegistro', '-SinExtension', '-Extension', 'pldipbgollbhkjjigkgnojdjpfhanhhf'];
  if (herramientas) argumentos.push('-SinDescargas');
  const salida = execFileSync('powershell.exe', argumentos, { encoding: 'utf8' });
  if (herramientas) {
    copyFileSync(join(herramientas, 'yt-dlp.exe'), join(carpeta, 'yt-dlp.exe'));
    copyFileSync(join(herramientas, 'qjs.exe'), join(carpeta, 'qjs.exe'));
    // Sin conexión no tiene sentido que se ponga al día.
    writeFileSync(join(carpeta, 'yt-dlp.comprobado'), new Date().toISOString());
  }
  comprobar('el instalador prepara sus archivos sin tocar el registro', /sin tocar el registro/.test(salida));
  comprobar('copia el ayudante, yt-dlp y QuickJS', ['kotonoha_ayudante.ps1', 'kotonoha_ayudante.cmd', 'yt-dlp.exe', 'qjs.exe'].every((a) => existsSync(join(carpeta, a))));
  const crudo = readFileSync(join(carpeta, 'com.kotonoha.ayudante.json'));
  comprobar('el manifiesto no lleva BOM: el navegador no lo leería', crudo[0] === 0x7b);
  const manifiesto = JSON.parse(crudo.toString('utf8'));
  comprobar('el manifiesto es válido', manifiesto.name === 'com.kotonoha.ayudante' && manifiesto.type === 'stdio' && manifiesto.path === 'kotonoha_ayudante.cmd', manifiesto.path);
  comprobar('admite la copia de identificador fijo y la pedida', manifiesto.allowed_origins.includes(`chrome-extension://${ID_FIJO}/`) && manifiesto.allowed_origins.includes(ORIGEN_PRUEBAS), `${manifiesto.allowed_origins.length} orígenes`);
  comprobar('los orígenes tienen el formato que exige el navegador', manifiesto.allowed_origins.every((o) => /^chrome-extension:\/\/[a-p]{32}\/$/.test(o)));
  const ps1 = readFileSync(join(carpeta, 'kotonoha_ayudante.ps1'));
  comprobar('el ayudante lleva BOM: sin él, Windows PowerShell rompería los acentos', ps1.subarray(0, 3).toString('hex') === 'efbbbf');
}

/** Arranca el ayudante con su lanzador, como el navegador: cmd, el .cmd, el origen y la ventana. */
function conectar(entorno = {}) {
  const p = spawn('cmd.exe', ['/d', '/c', join(carpeta, 'kotonoha_ayudante.cmd'), ORIGEN_PRUEBAS, '--parent-window=0'], {
    stdio: ['pipe', 'pipe', 'inherit'],
    env: { ...process.env, ...entorno },
  });
  let bufer = Buffer.alloc(0);
  const esperando = [];
  const recibidos = [];
  p.stdout.on('data', (d) => {
    bufer = Buffer.concat([bufer, d]);
    while (bufer.length >= 4) {
      const largo = bufer.readUInt32LE(0);
      if (bufer.length < 4 + largo) break;
      const m = JSON.parse(bufer.toString('utf8', 4, 4 + largo));
      bufer = bufer.subarray(4 + largo);
      const e = esperando.shift();
      if (e) e(m);
      else recibidos.push(m);
    }
  });
  const fin = new Promise((ok) => p.on('exit', ok));
  return {
    enviar(m) {
      const datos = Buffer.from(JSON.stringify(m), 'utf8');
      const cabecera = Buffer.alloc(4);
      cabecera.writeUInt32LE(datos.length);
      p.stdin.write(Buffer.concat([cabecera, datos]));
    },
    recibir: () => (recibidos.length ? Promise.resolve(recibidos.shift()) : new Promise((ok) => esperando.push(ok))),
    cerrarEntrada: () => p.stdin.end(),
    fin,
    matar: () => p.kill(),
  };
}

const temporalesAntes = new Set(readdirSync(tmpdir()).filter((n) => n.startsWith('kotonoha-')));
const temporalesNuevos = () => readdirSync(tmpdir()).filter((n) => n.startsWith('kotonoha-') && !temporalesAntes.has(n));

// ---------- Saludo ----------
{
  const a = conectar();
  const t0 = Date.now();
  a.enviar({ accion: 'hola' });
  const h = await a.recibir();
  comprobar('saluda con su versión', h.tipo === 'hola' && h.version === 2, `${JSON.stringify(h)} en ${Date.now() - t0} ms`);
  comprobar('encuentra yt-dlp y QuickJS', !!h.ytdlp && h.js === 'quickjs');
  comprobar('sabe actualizar la extensión', h.actualizar === true);
  a.cerrarEntrada();
  comprobar('termina al cerrarse la entrada', (await a.fin) === 0);
}
{
  const a = conectar({ KOTONOHA_SIN_FFMPEG: '1' });
  a.enviar({ accion: 'hola' });
  const h = await a.recibir();
  comprobar('sin FFmpeg lo dice', h.ffmpeg === false);
  a.cerrarEntrada();
  await a.fin;
}

// ---------- Direcciones no válidas ----------
{
  const a = conectar();
  a.enviar({ accion: 'abrir', url: 'file:///C:/Windows/win.ini' });
  const m = await a.recibir();
  comprobar('rechaza lo que no sea http', m.tipo === 'error', m.mensaje);
  a.enviar({ accion: 'abrir', url: '--exec calc' });
  const m2 = await a.recibir();
  comprobar('rechaza opciones disfrazadas de dirección', m2.tipo === 'error', m2.mensaje);
  a.enviar({ accion: 'leer', id: 1, desde: 0, cuantas: 10 });
  const m3 = await a.recibir();
  comprobar('no lee antes de tener audio', m3.tipo === 'error', m3.mensaje);
  a.cerrarEntrada();
  await a.fin;
}

// ---------- Descarga de verdad, desde este equipo ----------
if (!video) {
  video = join(trabajo, 'video.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=330:duration=180', '-f', 'lavfi', '-i', 'anoisesrc=d=180:a=0.05', '-f', 'lavfi', '-i', 'color=c=black:s=320x240:d=180', '-filter_complex', '[0][1]amix=inputs=2[a]', '-map', '2:v', '-map', '[a]', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', '-shortest', video]);
}
const referencia = join(trabajo, 'referencia.pcm');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', video, '-vn', '-ac', '1', '-ar', '16000', '-f', 'f32le', referencia]);
const tam = statSync(video).size;
const servidor = createServer((peticion, respuesta) => {
  const rango = /bytes=(\d+)-(\d*)/.exec(peticion.headers.range ?? '');
  if (rango) {
    const desde = Number(rango[1]);
    const hasta = rango[2] ? Number(rango[2]) : tam - 1;
    respuesta.writeHead(206, { 'Content-Type': 'video/mp4', 'Content-Length': hasta - desde + 1, 'Content-Range': `bytes ${desde}-${hasta}/${tam}`, 'Accept-Ranges': 'bytes' });
    createReadStream(video, { start: desde, end: hasta }).pipe(respuesta);
  } else {
    respuesta.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': tam, 'Accept-Ranges': 'bytes' });
    if (peticion.method === 'HEAD') respuesta.end();
    else createReadStream(video).pipe(respuesta);
  }
});
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
const url = `http://127.0.0.1:${servidor.address().port}/video.mp4`;

async function abrir(a) {
  a.enviar({ accion: 'abrir', url });
  let avance = 0;
  let convirtiendo = false;
  for (;;) {
    const m = await a.recibir();
    if (m.tipo === 'descarga') avance = m.porcentaje;
    else if (m.tipo === 'convirtiendo') convirtiendo = true;
    else return { m, avance, convirtiendo };
  }
}

async function leer(a, id, desde, cuantas) {
  a.enviar({ accion: 'leer', id, desde, cuantas });
  const partes = [];
  let mensajes = 0;
  for (;;) {
    const m = await a.recibir();
    if (m.tipo !== 'pcm' || m.id !== id) throw new Error(`Mensaje inesperado: ${JSON.stringify(m).slice(0, 200)}`);
    partes.push(Buffer.from(m.datos, 'base64'));
    mensajes++;
    if (m.fin) return { datos: Buffer.concat(partes), mensajes };
  }
}

// Con FFmpeg: las muestras de Whisper, leídas por partes.
{
  const a = conectar();
  const t0 = Date.now();
  const { m: listo, avance, convirtiendo } = await abrir(a);
  comprobar('descarga y convierte sin errores', listo.tipo === 'listo' && listo.muestras > 0, listo.mensaje ?? '');
  if (listo.tipo === 'listo') {
    comprobar('informa del avance de la descarga', avance === 100, `${avance} %`);
    comprobar('avisa al convertir', convirtiendo);
    console.log(`     ${(listo.muestras / 16000 / 60).toFixed(1)} min de audio listos en ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    const temporales = temporalesNuevos();
    comprobar('crea su carpeta temporal', temporales.length === 1, temporales.join(', '));
    const archivos = temporales.length ? readdirSync(join(tmpdir(), temporales[0])) : [];
    comprobar('borra el original tras convertirlo', archivos.length === 1 && archivos[0] === 'audio.pcm', archivos.join(', '));

    // 60 s: lo que pide el motor cada vez.
    const bloque = await leer(a, 1, 16000 * 90, 16000 * 60);
    comprobar('entrega el trozo pedido entero', bloque.datos.length === 16000 * 60 * 4, `${bloque.datos.length} bytes en ${bloque.mensajes} mensajes`);
    const r = readFileSync(referencia);
    comprobar('mismas muestras que la referencia', listo.muestras === Math.floor(r.length / 4), `${listo.muestras} / ${Math.floor(r.length / 4)}`);
    const muestrasDe = (b) => new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
    const esperado = muestrasDe(r.subarray(16000 * 90 * 4, 16000 * 150 * 4));
    const obtenido = muestrasDe(bloque.datos);
    let diferencia = 0;
    for (let i = 0; i < esperado.length; i++) diferencia = Math.max(diferencia, Math.abs(esperado[i] - obtenido[i]));
    comprobar('el audio coincide con el extraído aparte', diferencia < 0.002, `diferencia máxima ${diferencia.toFixed(6)}`);
    const finTramo = await leer(a, 2, listo.muestras - 100, 1000);
    comprobar('no pasa del final del audio', finTramo.datos.length === 400, `${finTramo.datos.length} bytes`);
    const fuera = await leer(a, 3, listo.muestras + 10, 1000);
    comprobar('fuera del audio no devuelve nada', fuera.datos.length === 0);
    a.cerrarEntrada();
    await a.fin;
    const siguen = temporales.filter((n) => existsSync(join(tmpdir(), n)));
    comprobar('borra los temporales al terminar', siguen.length === 0, siguen.join(', '));
  } else {
    a.matar();
  }
}

// Sin FFmpeg: el archivo tal cual, en bytes, para que lo convierta la extensión.
{
  const a = conectar({ KOTONOHA_SIN_FFMPEG: '1' });
  const { m: listo, convirtiendo } = await abrir(a);
  comprobar('sin FFmpeg entrega el archivo', listo.tipo === 'listo' && listo.bytes === tam && listo.formato === 'mp4', JSON.stringify(listo));
  comprobar('sin FFmpeg no convierte', !convirtiendo);
  if (listo.tipo === 'listo') {
    const partes = [];
    const BLOQUE = 8 * 1024 * 1024;
    for (let desde = 0, id = 1; desde < listo.bytes; desde += BLOQUE, id++) partes.push((await leer(a, id, desde, Math.min(BLOQUE, listo.bytes - desde))).datos);
    const unido = Buffer.concat(partes);
    comprobar('los bytes son los del video', unido.equals(readFileSync(video)), `${unido.length} bytes`);
  }
  a.cerrarEntrada();
  await a.fin;
}

// ---------- Cancelar a media descarga: que no queden procesos ni archivos ----------
{
  const a = conectar();
  a.enviar({ accion: 'abrir', url });
  await a.recibir();
  a.cerrarEntrada();
  const codigo = await a.fin;
  comprobar('se puede cancelar a medias', codigo === 0);
  await new Promise((r) => setTimeout(r, 800));
  const quedan = temporalesNuevos().filter((n) => existsSync(join(tmpdir(), n)));
  comprobar('cancelar no deja temporales', quedan.length === 0, quedan.join(', '));
  const procesos = execFileSync('tasklist', ['/FI', 'IMAGENAME eq yt-dlp.exe', '/FO', 'CSV', '/NH'], { encoding: 'utf8' });
  comprobar('cancelar no deja yt-dlp en marcha', !/yt-dlp\.exe/i.test(procesos), procesos.trim().slice(0, 120));
}

// ---------- Un error de yt-dlp llega explicado ----------
{
  const a = conectar();
  a.enviar({ accion: 'abrir', url: 'http://127.0.0.1:9/video.mp4' });
  let m;
  do m = await a.recibir();
  while (m.tipo === 'descarga');
  comprobar('un fallo de descarga llega como error', m.tipo === 'error', (m.mensaje ?? '').slice(0, 120));
  a.cerrarEntrada();
  await a.fin;
}

// ---------- Actualizar la extensión con el paquete de una versión servida aquí ----------
{
  const zipDe = (archivos) => zipSync(Object.fromEntries(Object.entries(archivos).map(([r, t]) => [`kotonoha/${r}`, new TextEncoder().encode(t)])));
  const locales = JSON.stringify({ descripcion: { message: 'Kotonoha' } });
  const paquete = zipDe({ 'manifest.json': JSON.stringify({ manifest_version: 3, name: 'Kotonoha', version: '9.9.9' }, null, 2), '_locales/en/messages.json': locales, 'nuevo.js': 'nuevo', 'compilacion.txt': '9.9.9 prueba' });
  const sha = createHash('sha256').update(paquete).digest('hex');
  const versiones = createServer((peticion, respuesta) => {
    const archivos = {
      '/v9.9.9/kotonoha-9.9.9-extension.zip': Buffer.from(paquete),
      '/v9.9.9/SHA256SUMS.txt': `${sha}  kotonoha-9.9.9-extension.zip\n`,
      // Otra «versión» con una suma que no cuadra: no debe tocar nada.
      '/v9.9.7/kotonoha-9.9.7-extension.zip': Buffer.from(paquete),
      '/v9.9.7/SHA256SUMS.txt': `${'0'.repeat(64)}  kotonoha-9.9.7-extension.zip\n`,
    };
    const d = archivos[peticion.url];
    respuesta.writeHead(d ? 200 : 404, { 'Content-Length': d ? Buffer.byteLength(d) : 0 });
    respuesta.end(d ?? '');
  });
  await new Promise((ok) => versiones.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${versiones.address().port}`;

  const copia = (nombre, manifiesto, extra = {}) => {
    const c = join(trabajo, nombre);
    mkdirSync(join(c, '_locales', 'en'), { recursive: true });
    writeFileSync(join(c, 'manifest.json'), JSON.stringify({ manifest_version: 3, name: 'Kotonoha', ...manifiesto }, null, 2));
    writeFileSync(join(c, '_locales', 'en', 'messages.json'), locales);
    writeFileSync(join(c, 'viejo.js'), 'viejo');
    writeFileSync(join(c, 'compilacion.txt'), `${manifiesto.version} antes`);
    for (const [r, t] of Object.entries(extra)) {
      mkdirSync(join(c, r, '..'), { recursive: true });
      writeFileSync(join(c, r), t);
    }
    return c;
  };
  const actualizar = async (carpetaCopia, version, actual) => {
    const a = conectar({ KOTONOHA_URL_VERSIONES: base, KOTONOHA_CARPETA_EXTENSION: carpetaCopia });
    a.enviar({ accion: 'actualizar', version, actual });
    let avance = 0;
    let m;
    for (;;) {
      m = await a.recibir();
      if (m.tipo === 'descarga') avance = m.porcentaje;
      else if (m.tipo !== 'convirtiendo') break;
    }
    a.cerrarEntrada();
    await a.fin;
    return { m, avance };
  };

  const conClave = copia('copia-con-clave', { version: '9.9.8', key: 'CLAVE-DE-PRUEBA' });
  const { m, avance } = await actualizar(conClave, '9.9.9', '9.9.8');
  comprobar('actualiza la copia', m.tipo === 'actualizado' && m.version === '9.9.9', JSON.stringify(m));
  comprobar('informa del avance', avance === 100, `${avance} %`);
  const nuevo = JSON.parse(readFileSync(join(conClave, 'manifest.json'), 'utf8'));
  comprobar('pone la versión nueva', nuevo.version === '9.9.9');
  comprobar('conserva la clave, y con ella el identificador y los datos', nuevo.key === 'CLAVE-DE-PRUEBA');
  comprobar('quita lo que ya no trae la versión nueva', !existsSync(join(conClave, 'viejo.js')) && existsSync(join(conClave, 'nuevo.js')));
  comprobar('escribe compilacion.txt para que la extensión se recargue', readFileSync(join(conClave, 'compilacion.txt'), 'utf8') === '9.9.9 prueba');

  const sinClave = copia('copia-sin-clave', { version: '9.9.8' });
  const r2 = await actualizar(sinClave, '9.9.9', '9.9.8');
  comprobar('una copia sin clave sigue sin clave', r2.m.tipo === 'actualizado' && !('key' in JSON.parse(readFileSync(join(sinClave, 'manifest.json'), 'utf8'))));

  const intacta = copia('copia-suma-mala', { version: '9.9.6' });
  const r3 = await actualizar(intacta, '9.9.7', '9.9.6');
  comprobar('un SHA-256 que no cuadra no cambia nada', r3.m.tipo === 'error' && JSON.parse(readFileSync(join(intacta, 'manifest.json'), 'utf8')).version === '9.9.6' && existsSync(join(intacta, 'viejo.js')), r3.m.mensaje);

  const repositorio = copia('copia-repositorio', { version: '9.9.8' }, { '.git/HEAD': 'ref: refs/heads/main' });
  const r4 = await actualizar(repositorio, '9.9.9', '9.9.8');
  comprobar('no toca una carpeta con .git', r4.m.tipo === 'error' && JSON.parse(readFileSync(join(repositorio, 'manifest.json'), 'utf8')).version === '9.9.8', r4.m.mensaje);

  const r5 = await actualizar(conClave, '9.9.9 & calc', '9.9.9');
  comprobar('rechaza una versión mal escrita', r5.m.tipo === 'error', r5.m.mensaje);

  // ---------- El instalador, con la extensión: la copia nueva lleva la clave fija ----------
  const api = createServer((_, respuesta) => {
    respuesta.writeHead(200, { 'Content-Type': 'application/json' });
    respuesta.end(JSON.stringify({ tag_name: 'v9.9.9', assets: [] }));
  });
  await new Promise((ok) => api.listen(0, '127.0.0.1', ok));
  const carpetaNueva = join(trabajo, 'instalada');
  const otraCarpeta = join(trabajo, 'ayudante-con-extension');
  // Sin bloquear: los servidores que contestan al instalador viven en este mismo proceso.
  const salida = await new Promise((ok) => {
    let texto = '';
    const p = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(RAIZ, 'herramientas', 'ayudante', 'instalar.ps1'), '-Carpeta', otraCarpeta, '-CarpetaExtension', carpetaNueva, '-SinRegistro', '-SinDescargas', '-ConExtension'], {
      env: { ...process.env, KOTONOHA_API_VERSIONES: `http://127.0.0.1:${api.address().port}/latest`, KOTONOHA_URL_VERSIONES: base },
    });
    p.stdout.on('data', (d) => (texto += d));
    p.stderr.on('data', (d) => (texto += d));
    p.on('exit', () => ok(texto));
  });
  api.close();
  const instalado = existsSync(join(carpetaNueva, 'manifest.json')) ? JSON.parse(readFileSync(join(carpetaNueva, 'manifest.json'), 'utf8')) : {};
  comprobar('el instalador pone la extensión con SHA-256 comprobado', instalado.version === '9.9.9' && /SHA-256 comprobado/.test(salida), salida.split(/\r?\n/).find((l) => l.includes('Kotonoha 9.9.9'))?.trim() ?? '');
  const ID = (clave) => [...createHash('sha256').update(Buffer.from(clave ?? '', 'base64')).digest('hex').slice(0, 32)].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
  comprobar('con la clave fija: el identificador es el de las instalaciones nuevas', ID(instalado.key) === ID_FIJO, ID(instalado.key));
  comprobar('y lo admite el ayudante', JSON.parse(readFileSync(join(otraCarpeta, 'com.kotonoha.ayudante.json'), 'utf8')).allowed_origins.includes(`chrome-extension://${ID_FIJO}/`));
  comprobar('explica cómo cargarla', /Cargar descomprimida/.test(salida));
  versiones.close();
}

servidor.close();
rmSync(trabajo, { recursive: true, force: true });
console.log(fallos ? `\n${fallos} comprobaciones fallaron` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
