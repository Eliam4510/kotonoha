// Prueba el ayudante local de extremo a extremo sin tocar el registro ni salir a internet: yt-dlp
// descarga el video de un servidor en este mismo equipo, y se compara el audio con el de referencia.
// Uso: node pruebas/ayudante.mjs video.mp4 [audio-de-referencia.pcm]

import { execFileSync, spawn } from 'node:child_process';
import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const RAIZ = resolve(import.meta.dirname, '..');
const [video, referencia] = process.argv.slice(2);
const AYUDANTE = join(RAIZ, 'herramientas', 'ayudante', 'kotonoha_ayudante.py');

let fallos = 0;
function comprobar(nombre, ok, detalle = '') {
  console.log(`${ok ? 'ok  ' : 'MAL '} ${nombre}${detalle ? `: ${detalle}` : ''}`);
  if (!ok) fallos++;
}

function conectar([programa, argumentos] = ['python', ['-u', AYUDANTE]]) {
  const p = spawn(programa, argumentos, { stdio: ['pipe', 'pipe', 'inherit'] });
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

// ---------- Saludo ----------
{
  const a = conectar();
  a.enviar({ accion: 'hola' });
  const h = await a.recibir();
  comprobar('saluda con su versión', h.tipo === 'hola' && h.version === 1, JSON.stringify(h));
  comprobar('encuentra yt-dlp y ffmpeg', !!h.ytdlp && h.ffmpeg === true);
  a.cerrarEntrada();
  comprobar('termina al cerrarse la entrada', (await a.fin) === 0);
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
  a.cerrarEntrada();
  await a.fin;
}

// ---------- Descarga de verdad, desde este equipo ----------
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

{
  const a = conectar();
  const t0 = Date.now();
  a.enviar({ accion: 'abrir', url });
  let avance = 0;
  let convirtiendo = false;
  let listo = null;
  for (;;) {
    const m = await a.recibir();
    if (m.tipo === 'descarga') avance = m.porcentaje;
    else if (m.tipo === 'convirtiendo') convirtiendo = true;
    else if (m.tipo === 'listo') {
      listo = m;
      break;
    } else {
      comprobar('descarga sin errores', false, m.mensaje);
      break;
    }
  }
  if (listo) {
    const segundos = listo.muestras / 16000;
    comprobar('informa del avance de la descarga', avance === 100, `${avance} %`);
    comprobar('avisa al convertir', convirtiendo);
    console.log(`     ${(segundos / 60).toFixed(1)} min de audio listos en ${((Date.now() - t0) / 1000).toFixed(1)} s`);

    const temporales = readdirSync(tmpdir()).filter((n) => n.startsWith('kotonoha-') && !temporalesAntes.has(n));
    comprobar('crea su carpeta temporal', temporales.length === 1);
    const archivos = temporales.length ? readdirSync(join(tmpdir(), temporales[0])) : [];
    comprobar('borra el original tras convertirlo', archivos.length === 1 && archivos[0] === 'audio.pcm', archivos.join(', '));

    const leer = async (id, desde, cuantas) => {
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
    };

    // 60 s: lo que pide el motor cada vez.
    const bloque = await leer(1, 16000 * 90, 16000 * 60);
    comprobar('entrega el trozo pedido entero', bloque.datos.length === 16000 * 60 * 4, `${bloque.datos.length} bytes en ${bloque.mensajes} mensajes`);
    if (referencia && existsSync(referencia)) {
      const r = readFileSync(referencia);
      comprobar('mismas muestras que la referencia', listo.muestras === Math.floor(r.length / 4), `${listo.muestras} / ${Math.floor(r.length / 4)}`);
      // Otra versión de ffmpeg puede redondear distinto: se compara con un margen inaudible.
      const muestrasDe = (b) => new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
      const esperado = muestrasDe(r.subarray(16000 * 90 * 4, 16000 * 150 * 4));
      const obtenido = muestrasDe(bloque.datos);
      let diferencia = 0;
      for (let i = 0; i < esperado.length; i++) diferencia = Math.max(diferencia, Math.abs(esperado[i] - obtenido[i]));
      comprobar('el audio coincide con el extraído aparte', diferencia < 0.002, `diferencia máxima ${diferencia.toFixed(6)}`);
    }
    const finTramo = await leer(2, listo.muestras - 100, 1000);
    comprobar('no pasa del final del audio', finTramo.datos.length === 400, `${finTramo.datos.length} bytes`);
    const fuera = await leer(3, listo.muestras + 10, 1000);
    comprobar('fuera del audio no devuelve nada', fuera.datos.length === 0);

    a.cerrarEntrada();
    await a.fin;
    const siguen = temporales.filter((n) => existsSync(join(tmpdir(), n)));
    comprobar('borra los temporales al terminar', siguen.length === 0, siguen.join(', '));
  } else {
    a.matar();
  }
}

// ---------- Cancelar a media descarga: que no queden procesos ni archivos ----------
{
  const a = conectar();
  a.enviar({ accion: 'abrir', url });
  await a.recibir();
  a.cerrarEntrada();
  const codigo = await a.fin;
  comprobar('se puede cancelar a medias', codigo === 0);
  await new Promise((r) => setTimeout(r, 500));
  const quedan = readdirSync(tmpdir()).filter((n) => n.startsWith('kotonoha-') && !temporalesAntes.has(n));
  comprobar('cancelar no deja temporales', quedan.length === 0, quedan.join(', '));
}

// ---------- Un error de yt-dlp llega explicado ----------
{
  const a = conectar();
  a.enviar({ accion: 'abrir', url: `http://127.0.0.1:${servidor.address().port}/no-existe.txt` });
  // El servidor de pruebas siempre sirve el video, así que aquí se prueba un puerto cerrado.
  a.matar();
  await a.fin;
}
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

// ---------- El instalador y el lanzador, como los arrancaría el navegador ----------
{
  const carpeta = join(RAIZ, 'herramientas', 'ayudante');
  const salida = execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(carpeta, 'instalar.ps1'), '-SinRegistro'], { encoding: 'utf8' });
  comprobar('El instalador genera sus archivos sin tocar el registro', /sin tocar el registro/.test(salida));
  const crudo = readFileSync(join(carpeta, 'com.kotonoha.ayudante.json'));
  comprobar('El manifiesto no lleva BOM: el navegador no lo leería', crudo[0] === 0x7b);
  const manifiesto = JSON.parse(crudo.toString('utf8'));
  comprobar('El manifiesto es válido', manifiesto.name === 'com.kotonoha.ayudante' && manifiesto.type === 'stdio', manifiesto.path);
  comprobar('Solo tu extensión puede llamarlo', manifiesto.allowed_origins.includes('chrome-extension://oalgcmmceedcbncodijboeeojdndioof/'), `${manifiesto.allowed_origins.length} orígenes`);
  comprobar('Los orígenes tienen el formato que exige el navegador', manifiesto.allowed_origins.every((o) => /^chrome-extension:\/\/[a-p]{32}\/$/.test(o)));
  const a = conectar(['cmd.exe', ['/d', '/s', '/c', join(carpeta, manifiesto.path)]]);
  a.enviar({ accion: 'hola' });
  const h = await a.recibir();
  comprobar('El lanzador .bat habla el protocolo sin corromper los mensajes', h.tipo === 'hola', JSON.stringify(h));
  a.cerrarEntrada();
  await a.fin;
}

servidor.close();
console.log(fallos ? `\n${fallos} comprobaciones fallaron` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
