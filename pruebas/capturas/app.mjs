// Capturas de la ventana de la app y del menú de la extensión.

import { join } from 'node:path';

const TEXTO_LECTOR ='授業の後は、たぶん日本語の勉強を続けると思います。\n12月にJLPTがあるので、文法を毎日少しずつ進めているところです。\n一日でも休むと、ペースが遅れてしまうので、できるだけ毎日やるようにしています。\n赤い星と青い星を食べる夢を見た。';

export async function capturarApp({ RAIZ, ANCHO, ALTO, contexto, idExt, vigilar, foto }) {
  const p = await contexto.newPage();
  vigilar(p, 'app');
  const app = (r) => `chrome-extension://${idExt}/app.html#/${r}`;
  const ir = async (r, espera = 900) => {
    // Se pasa por una página en blanco para que cada pantalla arranque de cero, con sus datos al día.
    await p.goto('about:blank');
    await p.goto(app(r));
    await p.waitForTimeout(espera);
  };
  const motor = (metodo, ...args) =>
    p.evaluate(({ metodo, args }) => chrome.runtime.sendMessage({ canal: 'motor', metodo, args }), { metodo, args }).then((r) => {
      if (!r?.ok) console.log('motor', metodo, r?.error);
      return r?.valor;
    });

  // Sin datos: como la verá alguien recién instalado.
  await ir('inicio', 1400);
  await foto(p, '20-inicio-vacio');
  await ir('memoria');
  await foto(p, '27b-memoria-vacia');
  await ir('palabras');
  await foto(p, '29b-palabras-vacia');
  await ir('biblioteca');
  await foto(p, '25b-biblioteca-vacia');

  await ir('diccionario', 700);
  await foto(p, '21a-diccionario-inicio');
  await ir('diccionario?q=食べる', 1500);
  await foto(p, '21b-diccionario');
  await ir('diccionario?q=ざぜずぞ', 900);
  await foto(p, '21c-diccionario-sin-resultados');

  await ir('lector', 600);
  await foto(p, '24-lector-vacio');
  await ir(`lector?t=${encodeURIComponent(TEXTO_LECTOR)}`, 1500);
  await foto(p, '22-lector');
  const pal = await p.$('.pal');
  if (pal) {
    await pal.click();
    await p.waitForTimeout(1400);
    await foto(p, '23-lector-ficha');
  }
  // Enviar al creador desde la ficha abre el panel sin salir de la lectura.
  await p.evaluate(() => {
    [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Enviar al creador'))?.click();
  });
  await p.waitForTimeout(900);
  await foto(p, '23b-lector-con-creador');

  // Datos de muestra para que las pantallas no salgan vacías.
  for (const e of [
    { id: 'e2e-1', titulo: '吾輩は猫である', texto: '吾輩は猫である。名前はまだ無い。どこで生れたかとんと見当がつかぬ。\n'.repeat(250), origen: 'archivo', creado: Date.now(), pagina: 3, abierto: Date.now() },
    { id: 'e2e-2', titulo: '猫の散歩', texto: '猫の散歩\n京都に猫がいました。猫は毎日、川の近くを歩きました。', origen: 'historia', creado: Date.now() },
    { id: 'e2e-3', titulo: '銀河鉄道の夜', texto: 'ではみなさんは、そういうふうに川だと云われたり、乳の流れたあとだと云われたりしていたこのぼんやりと白いものがほんとうは何かご承知ですか。\n'.repeat(60), origen: 'archivo', creado: Date.now(), pagina: 1 },
    { id: 'e2e-4', titulo: 'Kimi no Na wa - episodio 3', texto: 'お前は誰だ。\n'.repeat(200), origen: 'archivo', creado: Date.now() },
    { id: 'e2e-5', titulo: '雨ニモマケズ', texto: '雨ニモマケズ風ニモマケズ雪ニモ夏ノ暑サニモマケヌ丈夫ナカラダヲモチ', origen: 'pegado', creado: Date.now() },
    { id: 'e2e-6', titulo: '坊っちゃん', texto: '親譲りの無鉄砲で小供の時から損ばかりしている。\n'.repeat(180), origen: 'archivo', creado: Date.now() },
    { id: 'e2e-7', titulo: '夏の川のものがたり', texto: '夏の朝、子どもたちは川へ行きました。\n'.repeat(30), origen: 'historia', creado: Date.now() },
  ]) {
    await motor('bibliotecaGuardar', e);
  }
  await motor('cambiarPalabras', [
    { clave: '猫|ねこ', lema: '猫', lectura: 'ねこ', estado: 'conocida' },
    { clave: '犬|いぬ', lema: '犬', lectura: 'いぬ', estado: 'conocida' },
    { clave: '学校|がっこう', lema: '学校', lectura: 'がっこう', estado: 'conocida' },
    { clave: '勉強|べんきょう', lema: '勉強', lectura: 'べんきょう', estado: 'conocida' },
    { clave: '先生|せんせい', lema: '先生', lectura: 'せんせい', estado: 'conocida' },
    { clave: '星|ほし', lema: '星', lectura: 'ほし', estado: 'aprendiendo', rastreada: true },
    { clave: '食べる|たべる', lema: '食べる', lectura: 'たべる', estado: 'aprendiendo' },
    { clave: '泥|どろ', lema: '泥', lectura: 'どろ', estado: 'aprendiendo' },
    { clave: '言の葉|ことのは', lema: '言の葉', lectura: 'ことのは', estado: 'desconocida', rastreada: true },
    { clave: '名前|なまえ', lema: '名前', lectura: 'なまえ', estado: 'ignorada' },
  ]);
  await motor('anadirConocidas', '私 あなた 今日 明日 昨日 時間 電車 学生 友達 家族 仕事 会社 映画 音楽 写真 料理 天気 季節 春 夏 秋 冬 朝 昼 夜 山 川 海 空 花 木 鳥 魚 雨 雪 風');
  const tarjeta = (frase, palabra, lectura, traduccion, definicion, notas) => ({ tipo: 'frase', palabra, lectura, frase, traduccion, definicion, audioFrase: [], audioPalabra: [], imagenes: [], ejemplos: '', notas });
  const quedan = await motor('memoriaResumen');
  if (!quedan?.total) {
    await motor('crearTarjeta', tarjeta('赤い星と青い<b>星</b>を食べる夢を見た', '星', 'ほし', 'Soñé que devoraba estrellas rojas y azules', 'estrella', 'Uso poético.'), 'memoria');
    await motor('crearTarjeta', tarjeta('一日でも休むと、ペースが<b>遅れて</b>しまう', '遅れる', 'おくれる', 'Si descanso aunque sea un día, me atraso', 'retrasarse, quedarse atrás', ''), 'memoria');
    await motor('crearTarjeta', tarjeta('<b>泥</b>だらけの道でも花は咲いた', '泥', 'どろ', 'Incluso en un camino lleno de barro, la flor brotó', 'barro', ''), 'memoria');
  }

  await ir('inicio', 1200);
  await foto(p, '20b-inicio-con-datos');
  await p.evaluate(() => {
    const c = document.querySelector('.ap-principal');
    if (c) c.scrollTop = c.scrollHeight;
  });
  await foto(p, '20c-inicio-abajo');

  await ir('biblioteca');
  await foto(p, '25-biblioteca');
  await p.fill('input[aria-label="Tema del relato"]', 'Un gato que pasea por Kioto');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(250);
  await foto(p, '25c-biblioteca-relato');
  await p.waitForTimeout(1200);
  const libro = await p.$('button[aria-label="Leer 吾輩は猫である"]');
  if (libro) {
    await libro.click();
    await p.waitForTimeout(1600);
    await foto(p, '25d-libro-abierto');
  }

  await ir('reproductor', 600);
  await foto(p, '26-reproductor');
  await p.setInputFiles('input[aria-label="Elegir archivos"]', join(RAIZ, 'pruebas', 'fixtures', 'video.webm')).catch((e) => console.log('video local:', e.message));
  await p.waitForTimeout(1500);
  await foto(p, '26b-reproductor-video');

  await ir('memoria');
  await foto(p, '27-memoria');
  await p.getByText('Ver respuesta').click().catch(() => {});
  await foto(p, '28-memoria-respuesta');

  await ir('palabras');
  await foto(p, '29-palabras');
  await p.evaluate(() => {
    document.querySelectorAll('.ap-casilla').forEach((c, i) => {
      if (i < 3) c.click();
    });
  });
  await foto(p, '29c-palabras-seleccion');
  await ir('palabras?evaluar=1', 600);
  await foto(p, '29d-evaluacion-cargando');
  await p.waitForSelector('.ap-evaluacion-palabra', { timeout: 15000 }).catch(() => console.log('La evaluación no cargó'));
  await foto(p, '29e-evaluacion');
  // Responde a todas: conoce las cinco primeras, como alguien con un vocabulario inicial.
  for (let i = 0; i < 12; i++) {
    if (!(await p.$('.ap-evaluacion-palabra'))) break;
    await p.keyboard.press(i < 5 ? 'ArrowRight' : 'ArrowLeft');
    await p.waitForTimeout(60);
  }
  await p.waitForFunction(() => !document.querySelector('.ap-evaluacion-palabra') && document.querySelector('.ap-evaluacion h2'), null, { timeout: 30000 }).catch(() => console.log('La evaluación no terminó'));
  await foto(p, '29f-evaluacion-hecha');
  await ir('inicio', 1000);
  await foto(p, '20d-inicio-tras-evaluar');

  await ir('ajustes', 1000);
  await foto(p, '30-ajustes');
  // Cambiar de tema se aplica al momento.
  const temaAntes = await p.evaluate(() => document.querySelector('.kk-raiz').dataset.tema);
  await p.click(temaAntes === 'claro' ? 'button.ap-tema:has-text("Tinta")' : 'button.ap-tema:has-text("Papel")');
  await p.waitForTimeout(400);
  const temaDespues = await p.evaluate(() => document.querySelector('.kk-raiz').dataset.tema);
  console.log(temaAntes !== temaDespues ? 'cambio de tema: ok' : 'cambio de tema: FALLO');
  await p.click(temaAntes === 'claro' ? 'button.ap-tema:has-text("Papel")' : 'button.ap-tema:has-text("Tinta")');
  await p.waitForTimeout(300);
  const seccion = async (id, nombre) => {
    await p.evaluate((x) => document.getElementById(x)?.scrollIntoView(), id);
    await foto(p, nombre);
  };
  await seccion('claude', '31-ajustes-claude');
  await p.getByText('Probar la conexión').click().catch(() => {});
  await p.waitForTimeout(700);
  await foto(p, '31a-ajustes-conexion');
  await p.evaluate(() => document.querySelector('.ap-ajuste-seccion#claude .ap-modelo')?.scrollIntoView());
  await foto(p, '31b-ajustes-modelos');
  await seccion('diccionarios', '32-ajustes-diccionarios');
  await seccion('transcripcion', '32b-ajustes-transcripcion');
  await seccion('anki', '33-ajustes-anki');
  await p.evaluate(() => document.querySelector('.ap-prellenado')?.scrollIntoView({ block: 'center' }));
  await foto(p, '33b-ajustes-relleno');
  await seccion('voces', '33c-ajustes-voces');
  await seccion('prompts', '33d-ajustes-prompts');
  await seccion('datos', '33e-ajustes-datos');

  // Sin clave de Claude: lo que verá alguien que acaba de instalar.
  const claveGuardada = await p.evaluate(() => chrome.storage.local.get('claveAnthropic').then((d) => d.claveAnthropic));
  await p.evaluate(() => chrome.storage.local.remove('claveAnthropic'));
  await p.waitForTimeout(300);
  await ir('ajustes', 800);
  await seccion('claude', '31c-ajustes-sin-clave');
  await ir('inicio', 900);
  await foto(p, '20e-inicio-sin-clave');
  await p.evaluate((c) => chrome.storage.local.set({ claveAnthropic: c }), claveGuardada);
  await p.waitForTimeout(300);

  // El panel del creador con contenido, fijo y flotante.
  await p.goto('about:blank');
  await p.goto(app('diccionario?q=星'));
  await p.waitForTimeout(1200);
  await p.evaluate(() =>
    chrome.storage.local.set({
      borradorPendiente: {
        palabra: '星',
        lectura: 'ほし',
        frase: '赤い星と青い<b>星</b>を食べる夢を見た',
        traduccion: 'Soñé que devoraba estrellas rojas y azules',
        definicion: 'estrella<br>astro',
        audioFrase: [{ id: 'a1', nombre: 'frase.mp3', tipo: 'audio/mpeg', datos: 'AAAA', etiqueta: 'Audio del video' }],
        notas: 'Uso poético.',
        _sello: Date.now(),
      },
    })
  );
  await p.waitForTimeout(900);
  await foto(p, '35-creador-fijo');
  // El campo con formato debe aceptar texto sin perder la negrita ni mover el cursor.
  await p.click('#k-frase');
  await p.keyboard.press('End');
  await p.keyboard.type('テスト');
  await p.waitForTimeout(150);
  const frase = await p.evaluate(() => document.querySelector('#k-frase').innerHTML);
  console.log(frase.includes('<b>') && frase.endsWith('テスト') ? 'campo rico: ok' : `campo rico: FALLO (${frase})`);
  await p.click('button[aria-label="Dejar de fijar el panel"]').catch(() => {});
  await foto(p, '35b-creador-flotante');
  await p.evaluate(() => document.querySelector('.ap-creador-cuerpo')?.scrollTo(0, 9999));
  await foto(p, '35c-creador-abajo');
  await p.click('button[aria-label="Fijar el panel"]').catch(() => {});
  await p.click('button[aria-label="Cerrar el creador"]').catch(() => {});

  // Ventana estrecha: la barra lateral se pliega y las rejillas se reordenan.
  await p.setViewportSize({ width: 1040, height: 760 });
  await ir('inicio', 900);
  await foto(p, '36-estrecha-inicio');
  await p.hover('.ap-nav[aria-label="Diccionario"]').catch(() => {});
  await p.waitForTimeout(500);
  await foto(p, '36a-estrecha-info');
  await ir('ajustes', 900);
  await foto(p, '36b-estrecha-ajustes');
  await ir('diccionario?q=星', 1000);
  await p.click('button[aria-label="Crear tarjeta"]');
  await p.waitForTimeout(500);
  await foto(p, '36c-estrecha-creador');
  await p.setViewportSize({ width: ANCHO, height: ALTO });

  await p.setViewportSize({ width: 360, height: 560 });
  await p.goto('about:blank');
  await p.goto(`chrome-extension://${idExt}/popup.html`);
  await p.waitForTimeout(800);
  await foto(p, '34-menu-extension');
  // Abierto como pestaña, el menú se ve a sí mismo; se le simula un sitio web para ver esa fila.
  await p.addInitScript(() => {
    if (!globalThis.chrome?.tabs) return;
    const original = chrome.tabs.query.bind(chrome.tabs);
    Object.defineProperty(chrome.tabs, 'query', { value: async (q) => (q?.active ? [{ id: 1, url: 'https://matcha-jp.com/easy/read/1234' }] : original(q)) });
  });
  await p.goto('about:blank');
  await p.goto(`chrome-extension://${idExt}/popup.html`);
  await p.waitForTimeout(800);
  await foto(p, '34b-menu-en-un-sitio');
  await p.setViewportSize({ width: ANCHO, height: ALTO });
  await p.close();
}
