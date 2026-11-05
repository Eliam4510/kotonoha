// Prueba de las tarjetas contra un AnkiConnect simulado, para no tocar tus mazos reales, y de la
// grabación de audio con un micrófono falso del navegador.
// Uso: KK_SALIDA=.dist-whisper node build.mjs && node pruebas/tarjetas.mjs ruta/haruka.wav

import { createServer } from 'node:http';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { iniciarMock } from './mock-claude.mjs';
import { recargarExtension } from './extension.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-whisper'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-whisper'));
const [audio] = process.argv.slice(2);

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok  ' : 'FALLO'} ${texto}${extra ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};

// ---------- AnkiConnect simulado ----------

const anki = { acciones: [], modelos: ['Basic'], mazos: ['Default'], notas: [] };
const servidorAnki = createServer((req, res) => {
  res.setHeader('access-control-allow-origin', '*');
  if (req.method === 'OPTIONS') return res.end();
  let cuerpo = '';
  req.on('data', (c) => (cuerpo += c));
  req.on('end', () => {
    const { action, params = {} } = JSON.parse(cuerpo || '{}');
    anki.acciones.push({ action, params });
    const r = {
      version: () => 6,
      requestPermission: () => ({ permission: 'granted' }),
      deckNames: () => anki.mazos,
      modelNames: () => anki.modelos,
      modelFieldNames: () => ['Front', 'Back'],
      createDeck: () => {
        if (!anki.mazos.includes(params.deck)) anki.mazos.push(params.deck);
        return 1;
      },
      createModel: () => {
        anki.modelos.push(params.modelName);
        return {};
      },
      addNote: () => {
        anki.notas.push(params.note);
        return 1700000000000 + anki.notas.length;
      },
      findNotes: () => (anki.notas.some((n) => JSON.stringify(n.fields).includes(params.query.replace(/"/g, ''))) ? [1] : []),
      guiBrowse: () => [1],
      findCards: () => [1, 2],
      cardsInfo: () => [
        { interval: 40, fields: { Palabra: { value: '<b>学校</b>' } } },
        { interval: 3, fields: { Palabra: { value: '勉強[べんきょう]' } } },
      ],
    }[action];
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(r ? { result: r(), error: null } : { result: null, error: `acción desconocida: ${action}` }));
  });
});
await new Promise((ok) => servidorAnki.listen(0, '127.0.0.1', ok));
const puertoAnki = servidorAnki.address().port;

// ---------- Navegador ----------

const mock = await iniciarMock();
const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  args: [
    `--disable-extensions-except=${DIST}`,
    `--load-extension=${DIST}`,
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${audio}%noloop`,
  ],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
await sw.evaluate(
  async ({ puerto, url }) => {
    const d = await chrome.storage.local.get('ajustes');
    await chrome.storage.local.set({
      urlBaseIA: url,
      claveAnthropic: 'clave-de-prueba',
      ajustes: { ...(d.ajustes ?? {}), ankiPuerto: puerto, ankiModelo: 'Kotonoha', ankiMazo: 'Pruebas Kotonoha', ankiEtiquetas: 'kotonoha prueba', destino: 'anki' },
    });
  },
  { puerto: puertoAnki, url: `http://127.0.0.1:${mock.puerto}` }
);
const p = await contexto.newPage();
await p.goto(`chrome-extension://${id}/app.html#/inicio`);
await p.waitForTimeout(1200);
const motor = (metodo, ...args) =>
  p.evaluate(({ metodo, args }) => chrome.runtime.sendMessage({ canal: 'motor', metodo, args }), { metodo, args }).then((r) => {
    if (!r?.ok) throw new Error(r?.error ?? 'sin respuesta');
    return r.valor;
  });

// ---------- Anki ----------

console.log('\n== Anki ==');
await motor('ankiPermiso');
const estado = await motor('anki');
comprobar(estado.conectado && estado.version === 6, 'Conecta con AnkiConnect', `versión ${estado.version}`);

const borrador = {
  tipo: 'frase',
  palabra: '星',
  lectura: 'ほし',
  frase: '赤い星と青い<b>星</b>を食べる夢を見た',
  fraseFurigana: '赤[あか]い星[ほし]と青[あお]い<b>星[ほし]</b>を食べる夢[ゆめ]を見[み]た',
  traduccion: 'Soñé que devoraba estrellas rojas y azules',
  definicion: '<b>sueños inalcanzables</b><br>estrella',
  audioFrase: [{ id: 'clip', nombre: 'kotonoha_frase.mp3', tipo: 'audio/mpeg', datos: 'QUJD', etiqueta: 'Video' }],
  audioPalabra: [{ id: 'a', nombre: 'kotonoha_palabra.mp3', tipo: 'audio/mpeg', datos: 'REVG' }],
  imagenes: [{ id: 'i', nombre: 'kotonoha_captura.jpg', tipo: 'image/jpeg', datos: 'R0hJ' }],
  ejemplos: '星がきれいだ',
  notas: 'Uso poético',
  fuente: 'Canción',
  url: 'https://ejemplo.test/video',
};
await motor('crearTarjeta', borrador, 'anki');
comprobar(anki.modelos.includes('Kotonoha'), 'Crea el tipo de nota Kotonoha');
const modelo = anki.acciones.find((a) => a.action === 'createModel')?.params;
comprobar(modelo?.inOrderFields?.includes('FraseFurigana') && /furigana:FraseFurigana/.test(modelo?.cardTemplates?.[0]?.Back ?? ''), 'La plantilla muestra el furigana en el reverso');
comprobar(/#F5F2E9/.test(modelo?.css ?? ''), 'La plantilla usa los colores de la marca');
comprobar(anki.mazos.includes('Pruebas Kotonoha'), 'Crea el mazo');
const nota = anki.notas[0];
comprobar(nota?.modelName === 'Kotonoha' && nota?.deckName === 'Pruebas Kotonoha', 'Añade la nota al mazo y modelo elegidos');
comprobar(nota?.fields?.Frase === borrador.frase, 'Rellena la frase con la palabra en negrita', nota?.fields?.Frase);
comprobar(nota?.fields?.FraseFurigana === borrador.fraseFurigana, 'Rellena el furigana');
comprobar(/sueños inalcanzables/.test(nota?.fields?.Definicion ?? ''), 'La definición lleva el sentido en contexto primero');
comprobar(/<a href="https:\/\/ejemplo\.test\/video">Canción<\/a>/.test(nota?.fields?.Fuente ?? ''), 'Enlaza la fuente', nota?.fields?.Fuente);
comprobar(nota?.audio?.length === 2 && nota.audio[0].fields[0] === 'AudioFrase' && nota.audio[0].data === 'QUJD', 'Adjunta los dos audios en sus campos');
comprobar(nota?.picture?.[0]?.fields?.[0] === 'Imagen', 'Adjunta la imagen');
comprobar(nota?.tags?.includes('kotonoha'), 'Añade las etiquetas', nota?.tags?.join(' '));
comprobar(nota?.options?.allowDuplicate === false, 'No permite duplicados');

comprobar((await motor('ankiTieneTarjeta', '星')).length === 1, 'Detecta que la palabra ya tiene tarjeta');
comprobar((await motor('ankiTieneTarjeta', '猫')).length === 0, 'Detecta que otra palabra no la tiene');

const importadas = await motor('importarConocidasAnki', 'deck:Prueba', 'Palabra');
comprobar(importadas >= 1, 'Importa como conocidas las palabras con intervalo largo', String(importadas));
const fila = (await motor('listarPalabras', { busqueda: '学校', limite: 5 })).filas[0];
comprobar(fila?.estado === 'conocida', 'Una tarjeta madura queda como conocida', fila?.estado);

// ---------- Memoria interna ----------

console.log('\n== Memoria interna ==');
const previo = await motor('memoriaResumen');
const idMemoria = await motor('crearTarjeta', { ...borrador, palabra: '月', frase: '月がきれいですね' }, 'memoria');
const resumen = await motor('memoriaResumen');
comprobar(resumen.total === previo.total + 1, 'Crea la tarjeta en la memoria', `${resumen.total} en total`);
const pendientes = await motor('memoriaPendientes', 100);
comprobar(pendientes.some((t) => t.id === idMemoria), 'La tarjeta nueva está pendiente de repaso');
await motor('memoriaResponder', idMemoria, 3);
const despues = await motor('memoriaPendientes', 100);
comprobar(!despues.some((t) => t.id === idMemoria), 'Tras responder «bien» se programa para más adelante');
await motor('memoriaEliminar', idMemoria);

// ---------- Grabación ----------

console.log('\n== Grabación de audio ==');
await motor('whisperCapturaPrueba');
await motor('empezarClip');
await new Promise((r) => setTimeout(r, 2500));
const clip = await motor('terminarClip');
const cabecera = clip ? Buffer.from(clip.datos.slice(0, 8), 'base64') : Buffer.alloc(0);
comprobar(clip?.tipo === 'audio/mpeg', 'Graba y convierte a MP3', clip?.tipo);
comprobar(cabecera[0] === 0xff && (cabecera[1] & 0xe0) === 0xe0, 'El resultado empieza por una trama MP3 válida', cabecera.subarray(0, 2).toString('hex'));
comprobar(clip && clip.datos.length > 10000, 'El clip contiene audio', clip ? `${Math.round((clip.datos.length * 0.75) / 1024)} KB` : '');
await motor('detenerCaptura');

// ---------- Recorte de captura ----------

console.log('\n== Captura de imagen ==');
const png = await p.evaluate(() => {
  const c = document.createElement('canvas');
  c.width = 400;
  c.height = 300;
  const x = c.getContext('2d');
  x.fillStyle = '#ff0000';
  x.fillRect(0, 0, 400, 300);
  return c.toDataURL('image/png');
});
const { url: recorte, negra } = await motor('recortarImagen', png, { x: 50, y: 50, w: 200, h: 100, anchoVentana: 400 });
comprobar(negra === false, 'Una imagen con contenido no se toma por un fotograma protegido');
const tam = await p.evaluate(async (u) => {
  const i = await createImageBitmap(await (await fetch(u)).blob());
  return [i.width, i.height];
}, recorte);
comprobar(recorte.startsWith('data:image/jpeg') && tam[0] === 200 && tam[1] === 100, 'Recorta la captura al rectángulo del video', tam.join('×'));

console.log(`\n${fallos ? `${fallos} comprobaciones fallaron` : 'Todas las comprobaciones pasaron'}`);
await contexto.close();
mock.servidor.close();
servidorAnki.close();
process.exit(fallos ? 1 : 0);
