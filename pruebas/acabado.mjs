// Prueba el acabado (0.30.0): que lo escrito no quede pegado al borde de su caja ni cortado, con distintas mezclas de
// opciones. Tres partes:
//   1. Los subtítulos sobre el video. Con cada mezcla (tamaños, lecturas, glosas, sin traducción, sin fondo…) mide el
//      aire entre la tinta y el borde de la caja: arriba, donde va la lectura, abajo y a los lados; que el bloque quepa
//      en el video, y que ninguna lectura ni glosa pise otro texto.
//   2. Las pantallas de la aplicación, a dos anchos. Con pruebas/auditoria.mjs busca lecturas cortadas o al límite,
//      textos cortados o pegados a su caja y páginas que se salen a lo ancho.
//   3. Los detalles: que la lectura no toque la palabra con ninguna letra del diccionario (medido en la tinta), que una
//      frase larga no se parta dejando una sílaba suelta, que los modos de lectura valgan al leer como sobre el video,
//      que el texto lleve el mismo compás con y sin lecturas, que ningún punto empiece un renglón, que en una ventana
//      estrecha la ficha no tape lo que se lee, que lo que se borra pida confirmación, que el índice de Ajustes
//      marque la sección que se lee y que al pasar de una palabra a otra no se vea ni la anterior a medio quitar ni la
//      nueva a medio llegar.
// Con KK_INFORME=carpeta guarda una captura de cada pantalla con lo encontrado señalado, y el informe completo.
// Uso: KK_SALIDA=.dist-subs node build.mjs && node pruebas/acabado.mjs [subtitulos] [pantallas] [detalles]

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { auditar, quitarMarcas, resumen, tintaDeLectura } from './auditoria.mjs';
import { servidor } from './capturas/overlay.mjs';
import { confirmarBorrado, recargarExtension } from './extension.mjs';
import { iniciarMock } from './mock-claude.mjs';

const RAIZ = resolve(import.meta.dirname, '..');
const DIST = resolve(process.env.KK_DIST ?? join(RAIZ, '.dist-subs'));
const PERFIL = resolve(process.env.KK_PERFIL ?? join(RAIZ, '.perfil-local'));
const INFORME = process.env.KK_INFORME ? resolve(process.env.KK_INFORME) : null;
if (INFORME) mkdirSync(INFORME, { recursive: true });
const pedidas = process.argv.slice(2);
const quiere = (n) => pedidas.length === 0 || pedidas.includes(n);

let fallos = 0;
const comprobar = (cond, texto, extra = '') => {
  console.log(`${cond ? 'ok   ' : 'FALLO'} ${texto}${extra !== '' ? ` (${extra})` : ''}`);
  if (!cond) fallos++;
};

if (!existsSync(PERFIL) && existsSync(join(RAIZ, '.perfil-base', 'Default/IndexedDB'))) {
  cpSync(join(RAIZ, '.perfil-base', 'Default/IndexedDB'), join(PERFIL, 'Default/IndexedDB'), { recursive: true });
}

const ANCHO = 1440;
const ALTO = 900;
const mock = await iniciarMock();
const contexto = await chromium.launchPersistentContext(PERFIL, {
  channel: process.env.KK_CANAL ?? 'msedge',
  headless: true,
  viewport: { width: ANCHO, height: ALTO },
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
});
const sw = await recargarExtension(contexto);
const id = new URL(sw.url()).host;
const previo = await sw.evaluate(async () => chrome.storage.local.get(['ajustes', 'urlBaseIA', 'claveAnthropic']));
/** Lo que no depende de la mezcla. Cada mezcla parte de aquí: lo que no nombra vuelve a su valor. */
const BASE = {
  idiomaInterfaz: 'es', idiomaObjetivo: 'ja', idiomaSecundario: 'es', tema: 'oscuro', bienvenidaVista: true, avisarVersiones: false, guardarHistorial: true,
  navegadorAbierto: false, modo: 'normal', salto: 'no', subsPosicion: null, desanclarBarra: false, analisisAutomatico: false, sentidoAutomatico: false,
  sombra: true, furigana: 'todas', glosas: 'alPasar', formatoLectura: 'hiragana', mostrarEstado: true, colorAcento: 'siempre', mostrarGramatica: true,
  escalaObjetivo: 100, escalaSecundario: 100, ocultarObjetivo: false, ocultarSecundario: false,
  diccionarioAncho: 'completo', diccionarioTamano: 100, diccionarioLetra: 'gotica',
};
const fijar = (cambios) =>
  sw.evaluate(async ({ c, url }) => {
    const d = await chrome.storage.local.get('ajustes');
    await chrome.storage.local.set({ urlBaseIA: url, claveAnthropic: 'clave-de-prueba', ajustes: { ...(d.ajustes ?? {}), ...c } });
  }, { c: cambios, url: `http://127.0.0.1:${mock.puerto}` });
await fijar(BASE);

const errores = [];
const p = await contexto.newPage();
p.on('pageerror', (e) => errores.push(e.message));
const app = (r) => `chrome-extension://${id}/app.html#/${r}`;
await p.goto(app('inicio'));
const motor = async (metodo, ...args) => {
  for (let intento = 0; ; intento++) {
    const r = await p.evaluate(({ metodo, args }) => chrome.runtime.sendMessage({ canal: 'motor', metodo, args }), { metodo, args }).catch(() => null);
    if (r?.ok) return r.valor;
    if (intento > 60 || r?.error) throw new Error(`${metodo}: ${r?.error ?? 'sin respuesta'}`);
    await p.waitForTimeout(250);
  }
};

// ---------- 1. Los subtítulos sobre el video ----------

if (quiere('subtitulos')) {
  console.log('\n== Los subtítulos sobre el video ==');
  // Las palabras de las líneas de prueba, desconocidas mientras dura: así llevan lectura y glosa en todas las mezclas.
  const frases = ['赤い星と青い星を食べる夢を見た', '授業の後は、たぶん日本語の勉強を続けると思います。', '私はまだ立ち上がることができます'];
  const palabras = (await motor('analizarTexto', frases.join('\n'))).flat().filter((t) => t.esPalabra);
  const estadosPrevios = [...new Map(palabras.map((t) => [t.clave, { clave: t.clave, lema: t.lema, lectura: t.lectura, estado: t.estado }])).values()];
  await motor('cambiarPalabras', estadosPrevios.map((t) => ({ ...t, estado: 'desconocida' })));
  const s = await servidor(RAIZ);
  const v = await contexto.newPage();
  v.on('pageerror', (e) => errores.push(e.message));
  await v.goto(`http://127.0.0.1:${s.address().port}/`);
  await v.waitForTimeout(700);
  await sw.evaluate(async () => {
    const [t] = await chrome.tabs.query({ url: 'http://127.0.0.1/*' });
    // El script de la página puede tardar un poco en estar listo.
    for (let intento = 0; ; intento++) {
      try {
        await chrome.tabs.sendMessage(t.id, { activarVideoAqui: true });
        break;
      } catch (e) {
        if (intento > 40) throw e;
        await new Promise((r) => setTimeout(r, 250));
      }
    }
  });
  const esperar = (selector, tiempo = 30000) => v.waitForFunction((sel) => document.querySelector('kotonoha-overlay')?.shadowRoot?.querySelector(sel), selector, { timeout: tiempo }).catch(() => null);
  const segundo = async (t) => {
    await v.evaluate((x) => (document.querySelector('#v').currentTime = x), t);
    await v.waitForTimeout(900);
  };
  await esperar('.barra');
  await segundo(2);
  await esperar('.linea-sub.objetivo .pal');
  await v.waitForTimeout(1200);

  /** El aire del bloque: de la tinta de cada renglón al borde de la caja, y lo que se pisa dentro. */
  const medir = () =>
    v.evaluate(() => {
      const r = document.querySelector('kotonoha-overlay').shadowRoot;
      const bloque = r.querySelector('.subs-bloque:not(.saliendo)');
      if (!bloque) return null;
      const fondo = bloque.querySelector('.subs-fondo').getBoundingClientRect();
      const rango = document.createRange();
      const tinta = [];
      const andar = document.createTreeWalker(bloque, NodeFilter.SHOW_TEXT);
      for (let n = andar.nextNode(); n; n = andar.nextNode()) {
        if (!n.textContent.trim()) continue;
        const e = n.parentElement;
        const s = getComputedStyle(e);
        if (!e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
        rango.selectNodeContents(n);
        for (const c of rango.getClientRects()) {
          if (c.width < 1) continue;
          // La tinta de una letra: más o menos su tamaño, centrada en su renglón.
          const alto = Math.min(c.height, parseFloat(s.fontSize) * 1.02);
          const centro = (c.top + c.bottom) / 2;
          const rt = e.closest('rt');
          tinta.push({ top: centro - alto / 2, bottom: centro + alto / 2, left: c.left, right: c.right, lectura: !!rt && !rt.classList.contains('glosa-bajo'), glosa: !!rt?.classList.contains('glosa-bajo'), e, tam: parseFloat(s.fontSize) });
        }
      }
      if (!tinta.length) return null;
      const lecturas = tinta.filter((t) => t.lectura);
      const letras = tinta.filter((t) => !t.lectura && !t.glosa);
      // Una lectura o una glosa que se monta sobre otro texto que no es el suyo.
      let pisadas = 0;
      for (const a of tinta.filter((t) => t.lectura || t.glosa)) {
        const ruby = a.e.closest('ruby');
        for (const b of tinta) {
          if (a === b || a.e === b.e || ruby?.contains(b.e) || b.e.closest('ruby')?.contains(a.e)) continue;
          const ancho = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const alto = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (ancho > 2 && alto > 1.5) pisadas++;
        }
      }
      const uno = (x) => Math.round(x * 10) / 10;
      return {
        alto: Math.round(fondo.height),
        arriba: uno(Math.min(...tinta.map((t) => t.top)) - fondo.top),
        arribaLectura: lecturas.length ? uno(Math.min(...lecturas.map((t) => t.top)) - fondo.top) : null,
        abajo: uno(fondo.bottom - Math.max(...tinta.map((t) => t.bottom))),
        lados: uno(Math.min(Math.min(...tinta.map((t) => t.left)) - fondo.left, fondo.right - Math.max(...tinta.map((t) => t.right)))),
        letra: letras.length ? Math.max(...letras.map((t) => t.tam)) : 0,
        glosas: tinta.filter((t) => t.glosa).length,
        pisadas,
        dentro: fondo.left >= 0 && fondo.right <= innerWidth && fondo.top >= 0 && fondo.bottom <= innerHeight,
      };
    });

  // Cada mezcla: sus ajustes y, si cambia lo que se espera, qué. `sinObjetivo`: solo queda la traducción.
  const MEZCLAS = [
    ['Por omisión', {}],
    ['Sin traducción', { ocultarSecundario: true }],
    ['Sin lecturas', { furigana: 'ninguna' }],
    ['Lecturas en rōmaji', { formatoLectura: 'romaji' }],
    ['Lecturas al pasar el ratón', { furigana: 'alPasar' }],
    ['Glosas bajo las palabras desconocidas', { glosas: 'desconocidas' }, { glosas: true }],
    ['Glosas y sin lecturas', { glosas: 'desconocidas', furigana: 'ninguna' }, { glosas: true }],
    ['Sin estados ni gramática', { mostrarEstado: false, mostrarGramatica: false }],
    ['Sin fondo', { sombra: false }],
    ['Letra al 70 %', { escalaObjetivo: 70, escalaSecundario: 70 }],
    ['Letra al 150 %', { escalaObjetivo: 150, escalaSecundario: 120 }],
    ['Letra al 200 % con glosas', { escalaObjetivo: 200, escalaSecundario: 150, glosas: 'desconocidas' }, { glosas: true }],
    ['Letra al 250 %, lo más grande', { escalaObjetivo: 250, escalaSecundario: 250 }],
    ['Solo la traducción', { ocultarObjetivo: true }, { sinObjetivo: true }],
  ];
  // Las palabras de las líneas, desconocidas: así llevan glosa y lectura en todas las mezclas.
  const LINEAS = [[10, 'corta'], [6, 'con gramática'], [44, 'larga']];
  const medirMezclas = async (etiqueta) => {
    for (const [nombre, cambios, espera = {}] of MEZCLAS) {
      await fijar({ ...BASE, ...cambios });
      await v.waitForTimeout(600);
      const problemas = [];
      let medidas = 0;
      let conGlosas = 0;
      for (const [t, linea] of LINEAS) {
        await segundo(t);
        if (!espera.sinObjetivo) await esperar('.linea-sub.objetivo .pal', 8000);
        await v.waitForTimeout(300);
        const m = await medir();
        if (!m) {
          problemas.push(`${linea}: sin bloque`);
          continue;
        }
        medidas++;
        conGlosas += m.glosas;
        const letra = m.letra || 25;
        // Arriba: con lecturas, un tercio de la letra hasta la lectura; sin ellas, un cuarto hasta el texto.
        const minimoArriba = m.arribaLectura !== null ? letra * 0.3 : espera.sinObjetivo ? 11 : letra * 0.25;
        const arriba = m.arribaLectura ?? m.arriba;
        if (arriba < minimoArriba) problemas.push(`${linea}: ${arriba} px arriba (mínimo ${Math.round(minimoArriba * 10) / 10})`);
        if (m.abajo < 12) problemas.push(`${linea}: ${m.abajo} px abajo`);
        if (m.lados < 18) problemas.push(`${linea}: ${m.lados} px a los lados`);
        if (m.pisadas) problemas.push(`${linea}: ${m.pisadas} lecturas o glosas pisan otro texto`);
        if (!m.dentro || m.alto > innerAlto * 0.72) problemas.push(`${linea}: el bloque mide ${m.alto} px de alto${m.dentro ? '' : ' y se sale de la ventana'}`);
        if (INFORME && linea !== 'con gramática') await v.screenshot({ path: join(INFORME, `subs-${etiqueta}-${nombre.replace(/[^\p{L}\d]+/gu, '-')}-${linea}.png`) });
      }
      if (espera.glosas && !conGlosas) problemas.push('no se vio ninguna glosa');
      comprobar(medidas > 0 && !problemas.length, `${nombre}${etiqueta === 'ancho' ? '' : `, ventana ${etiqueta}`}: la lectura y el texto tienen aire hasta el borde`, problemas.join('; '));
    }
  };
  let innerAlto = ALTO;
  await medirMezclas('ancho');
  // En una ventana estrecha, las líneas se parten en dos renglones: la lectura del de abajo no debe tocar el de arriba.
  innerAlto = 1000;
  await v.setViewportSize({ width: 820, height: innerAlto });
  await v.waitForTimeout(600);
  await medirMezclas('estrecha');
  await v.setViewportSize({ width: ANCHO, height: ALTO });
  await v.close();
  s.close();
  await fijar(BASE);
  await motor('cambiarPalabras', estadosPrevios);
}

// ---------- 2. Las pantallas de la aplicación ----------

if (quiere('pantallas')) {
  console.log('\n== Las pantallas ==');
  const ir = async (ruta, esperar, tiempo = 900) => {
    await p.goto('about:blank');
    await p.goto(app(ruta));
    if (esperar) await p.locator(esperar).first().waitFor({ timeout: 60000 }).catch(() => {});
    await p.waitForTimeout(tiempo);
  };
  // Lo que cuenta como fallo. «Pegado» solo si de verdad toca: a 3 px de su caja o menos.
  const GRAVES = /cortad|al límite|lectura pegada|pisan|sobre otro texto|se sale a lo ancho|barra de desplazamiento de sobra/;
  const informe = [];
  /** Audita la pantalla tal como está: devuelve lo grave, y guarda la captura si se pidió el informe. */
  const revisar = async (nombre) => {
    await p.waitForTimeout(300);
    const hallazgos = await auditar(p, { minimo: 6, marcar: !!INFORME });
    if (INFORME) {
      await p.screenshot({ path: join(INFORME, `${nombre}.png`) });
      await quitarMarcas(p);
      informe.push(`== ${nombre}: ${hallazgos.length}`, ...resumen(hallazgos, 60));
    }
    return hallazgos.filter((h) => GRAVES.test(h.tipo) || (h.tipo === 'texto pegado a los lados' && h.aire < 3));
  };
  const TEXTO = '授業の後は、たぶん日本語の勉強を続けると思います。\n一日でも休むと、ペースが遅れてしまうので、できるだけ毎日やるようにしています。\n赤い星と青い星を食べる夢を見た。';
  const FUENTE = 'Video de prueba del acabado';
  await motor('analizarLineas', [{ id: 'a', inicio: 754_000, fin: 757_000, texto: '友達と話すのが好きです。' }], { titulo: FUENTE, url: 'https://www.youtube.com/watch?v=kotonohaAcabado', idVideo: 'kotonohaAcabado' }).catch(() => {});

  /** Las pantallas: su nombre, cómo llegar y, si hace falta, qué hacer antes de mirar. */
  const PANTALLAS = [
    ['El diccionario, con una lista de resultados', async () => ir(`diccionario?q=${encodeURIComponent('はなす')}`, '.dic-ficha .ficha-palabra', 3000)],
    ['El diccionario, buscando por significado', async () => ir('diccionario?q=perro', '.dic-ficha .ficha-palabra', 2500)],
    ['La página de un kanji', async () => ir(`diccionario?q=${encodeURIComponent('上')}`, '.dic-caracter .dic-tarjeta', 2500)],
    ['Una categoría del diccionario', async () => ir('diccionario?cat=onomatopeyas', '.ap-categoria-vista .dic-tarjeta', 1200)],
    ['El Cuaderno, leyendo', async () => ir(`lector?t=${encodeURIComponent(TEXTO)}`, '.pal', 1800)],
    ['El Cuaderno, con la ficha de una palabra', async () => {
      await p.locator('.pal').nth(3).click();
      await p.locator('.ap-lectura-ficha .ficha-dock').waitFor({ timeout: 20000 });
      await p.waitForTimeout(1200);
    }],
    ['La ficha, con cada pestaña abierta', async () => {}, async () => {
      // Cada pestaña del pie, una tras otra: se junta lo grave de todas.
      const pestanas = p.locator('.ap-lectura-ficha .ficha-dock .pestana');
      const graves = [];
      for (let i = 0; i < (await pestanas.count()); i++) {
        await pestanas.nth(i).click();
        await p.waitForTimeout(900);
        graves.push(...(await revisar(`ficha-pestana-${i + 1}`)));
      }
      return graves;
    }],
    ['El JLPT', async () => ir('niveles', '.ap-principal', 1800)],
    ['Los ajustes', async () => ir('ajustes', '.ap-subnav', 1500)],
  ];
  for (const [ancho, alto, etiqueta] of [[ANCHO, ALTO, ''], [820, 1000, ', en una ventana estrecha']]) {
    await p.setViewportSize({ width: ancho, height: alto });
    for (const [nombre, preparar, mirar] of PANTALLAS) {
      let graves = [];
      try {
        await preparar();
        graves = mirar ? await mirar() : await revisar(`${ancho}-${nombre.replace(/[^\p{L}\d]+/gu, '-')}`);
      } catch (e) {
        graves = [{ tipo: 'no se pudo abrir', aire: 0, n: 1, que: String(e.message ?? e).split('\n')[0].slice(0, 90), caja: '', texto: '' }];
      }
      comprobar(!graves.length, `${nombre}${etiqueta}: nada cortado ni pegado al borde`, graves.slice(0, 4).map((h) => `${h.tipo}: ${h.que} en ${h.caja} «${h.texto}» (${h.aire} px)`).join(' | '));
    }
  }
  if (INFORME) writeFileSync(join(INFORME, 'informe.txt'), `${informe.join('\n')}\n`);

  await borrarFrases(FUENTE);
}

/** Borra las frases de prueba de una fuente: el perfil queda como estaba. */
async function borrarFrases(fuente) {
  await p.evaluate(
    (fuente) =>
      new Promise((ok) => {
        const r = indexedDB.open('kikitori');
        r.onsuccess = () => {
          const t = r.result.transaction('frases', 'readwrite');
          t.objectStore('frases').openCursor().onsuccess = (e) => {
            const c = e.target.result;
            if (!c) return;
            if (c.value.fuente === fuente) c.delete();
            c.continue();
          };
          t.oncomplete = () => {
            r.result.close();
            ok(true);
          };
        };
        r.onerror = () => ok(false);
      }),
    fuente
  ).catch(() => {});
}

// ---------- 3. Los detalles ----------

if (quiere('detalles')) {
  console.log('\n== Los detalles ==');
  // Las frases que se añaden para mirar el cambio de palabra: se borran al acabar.
  const FUENTE_CAMBIO = 'Video de prueba del acabado (cambio de palabra)';
  await p.setViewportSize({ width: ANCHO, height: ALTO });
  const ir = async (ruta, esperar, tiempo = 900) => {
    await p.goto('about:blank');
    await p.goto(app(ruta));
    if (esperar) await p.locator(esperar).first().waitFor({ timeout: 60000 }).catch(() => {});
    await p.waitForTimeout(tiempo);
  };
  const uno = (x) => (x === null || x === undefined ? '—' : Math.round(x * 10) / 10);

  // La lectura sobre la palabra, con cada letra del diccionario y a dos tamaños. Se mide la tinta: las cajas se tocan
  // siempre, y lo que se ve depende de cuánto llena cada letra la suya.
  for (const letra of ['gotica', 'redondeada', 'libro', 'escuela']) {
    for (const tamano of [80, 100]) {
      await fijar({ ...BASE, diccionarioLetra: letra, diccionarioTamano: tamano });
      await ir(`diccionario?q=${encodeURIComponent('はなす')}`, '.dic-ficha .ficha-palabra', 1500);
      await p.locator('.dic-lateral .dic-tarjeta-palabra ruby').first().waitFor({ timeout: 30000 }).catch(() => {});
      const problemas = [];
      for (const [sitio, selector, caja, aireMinimo, arribaMinimo] of [
        ['la lista', '.dic-lista-items .dic-tarjeta:not(.activa) .dic-tarjeta-palabra ruby', '.dic-tarjeta', 2, 8],
        ['el lateral', '.dic-lateral .dic-tarjeta-palabra ruby', '.dic-tarjeta', 2, 8],
        ['la cabecera', '.dic-ficha .ficha-palabra ruby', '.ficha-cab', 3.5, 12],
      ]) {
        const t = await tintaDeLectura(p, p.locator(selector).first(), caja);
        if (!t) problemas.push(`${sitio}: sin lectura que medir`);
        else {
          if (t.letra < 9.9) problemas.push(`${sitio}: la lectura mide ${uno(t.letra)} px`);
          if (t.aire < aireMinimo) problemas.push(`${sitio}: ${uno(t.aire)} px entre la lectura y la palabra`);
          if (t.arriba !== null && t.arriba < arribaMinimo) problemas.push(`${sitio}: la lectura a ${uno(t.arriba)} px del borde`);
        }
      }
      comprobar(!problemas.length, `Diccionario con la letra «${letra}» al ${tamano} %: la lectura se lee y no toca la palabra ni el borde`, problemas.join('; '));
    }
  }
  await fijar(BASE);

  // Las frases largas (los refranes) se parten entre palabras, sin dejar un carácter solo en un renglón.
  await ir('diccionario?cat=refranes', '.ap-categoria-vista .dic-tarjeta', 1500);
  const partidas = await p.evaluate(() => {
    const r = document.createRange();
    return [...document.querySelectorAll('.dic-tarjeta-palabra.con-lectura')].map((e) => {
      const lineas = new Map();
      const andar = (n) => {
        if (n.nodeType === 3) {
          for (let i = 0; i < n.length; i++) {
            r.setStart(n, i);
            r.setEnd(n, i + 1);
            const y = Math.round(r.getBoundingClientRect().top / 10);
            lineas.set(y, (lineas.get(y) ?? '') + n.data[i]);
          }
        } else if (n.nodeName !== 'RT') n.childNodes.forEach(andar);
      };
      andar(e);
      return [...lineas.values()];
    });
  });
  const sueltas = partidas.filter((l) => l.length > 1 && l.some((x) => [...x].length === 1)).map((l) => l.join(' / '));
  comprobar(partidas.length >= 40 && !sueltas.length, 'Los refranes se parten entre palabras: ningún carácter queda solo en un renglón', `${partidas.length} tarjetas, ${partidas.filter((l) => l.length > 1).length} en dos renglones; ${sueltas.slice(0, 3).join(' | ')}`);

  // Los modos de lectura valen al leer en el Cuaderno como sobre el video, y el texto lleva el mismo compás.
  // La segunda línea no lleva ninguna lectura: su renglón tiene que medir lo mismo que los demás.
  const TEXTO = '授業の後は、たぶん日本語の勉強を続けると思います。\nそうですね、たぶんそうかもしれません。\n12月にJLPTがあるので、文法を毎日少しずつ進めているところです。\n一日でも休むと、ペースが遅れてしまうので、できるだけ毎日やるようにしています。\n赤い星と青い星を食べる夢を見た。';
  const conocidas = (await motor('analizarTexto', '日本語の勉強を続ける。毎日')).flat().filter((t) => t.esPalabra);
  const todas = (await motor('analizarTexto', TEXTO)).flat().filter((t) => t.esPalabra);
  const deAntes = [...new Map(todas.map((t) => [t.clave, { clave: t.clave, lema: t.lema, lectura: t.lectura, estado: t.estado }])).values()];
  const sabidas = new Set(conocidas.map((t) => t.clave));
  await motor('cambiarPalabras', deAntes.map((t) => ({ ...t, estado: sabidas.has(t.clave) ? 'conocida' : 'desconocida' })));
  const leer = () =>
    p.evaluate(() => {
      const papel = document.querySelector('.ap-papel');
      const lecturas = [...papel.querySelectorAll('rt')];
      const seVen = (e) => getComputedStyle(e).visibility !== 'hidden';
      // El compás: de la base de cada renglón a la del siguiente, dentro de cada párrafo (entre dos hay más aire).
      const saltos = [...papel.children].flatMap((parrafo) => {
        const bases = [...new Set([...parrafo.querySelectorAll('.pal')].map((e) => Math.round(e.getBoundingClientRect().bottom)))].sort((a, b) => a - b);
        return bases.slice(1).map((y, i) => y - bases[i]).filter((d) => d > 8);
      });
      return {
        lecturas: lecturas.length,
        visibles: lecturas.filter(seVen).length,
        deConocidas: lecturas.filter((e) => seVen(e) && e.closest('.pal.est-conocida')).length,
        subrayadas: [...papel.querySelectorAll('.pal.est-desconocida')].filter((e) => getComputedStyle(e, '::before').backgroundColor !== 'rgba(0, 0, 0, 0)').length,
        saltos,
        selector: document.querySelector('.ap-lectura-modo select')?.value,
      };
    });
  const compas = (m) => (m.saltos.length ? Math.max(...m.saltos) - Math.min(...m.saltos) : 99);
  try {
    await fijar({ ...BASE, furigana: 'todas' });
    await p.setViewportSize({ width: 1100, height: ALTO });
    await ir(`lector?t=${encodeURIComponent(TEXTO)}`, '.pal', 2000);
    let m = await leer();
    comprobar(m.lecturas > 10 && m.visibles === m.lecturas && m.selector === 'todas', 'Cuaderno, lecturas en todas las palabras: se ven todas', `${m.visibles} de ${m.lecturas}`);
    comprobar(m.saltos.length >= 4 && compas(m) <= 1.5, 'Los renglones llevan el mismo compás, con lecturas y sin ellas', m.saltos.join(' '));
    await fijar({ furigana: 'desconocidas' });
    await p.waitForTimeout(500);
    m = await leer();
    comprobar(m.visibles > 0 && m.visibles < m.lecturas && m.deConocidas === 0 && m.selector === 'desconocidas', 'Solo en las nuevas: las palabras conocidas se quedan sin lectura, como sobre el video', `${m.visibles} de ${m.lecturas}, ${m.deConocidas} de conocidas`);
    comprobar(compas(m) <= 1.5, 'Y el compás no cambia: la lectura escondida guarda su sitio', m.saltos.join(' '));
    await fijar({ furigana: 'alPasar' });
    await p.waitForTimeout(500);
    m = await leer();
    comprobar(m.lecturas > 10 && m.visibles === 0, 'Al pasar el ratón: ninguna a la vista', `${m.visibles} de ${m.lecturas}`);
    await p.locator('.ap-papel .pal.est-desconocida').first().hover();
    await p.waitForTimeout(250);
    comprobar((await leer()).visibles >= 1, 'Y sale la de la palabra bajo el ratón');
    await p.mouse.move(5, 5);
    await p.locator('.ap-lectura-modo select').selectOption('todas');
    await p.waitForTimeout(600);
    m = await leer();
    comprobar(m.visibles === m.lecturas && m.lecturas > 10, 'El selector de la barra cambia el modo sin salir del texto', `${m.visibles} de ${m.lecturas}`);
    comprobar((await sw.evaluate(async () => (await chrome.storage.local.get('ajustes')).ajustes.furigana)) === 'todas', 'Y queda guardado: es el mismo ajuste que sobre el video');
    const antes = m.subrayadas;
    await fijar({ mostrarEstado: false });
    await p.waitForTimeout(500);
    m = await leer();
    comprobar(antes > 5 && m.subrayadas === 0, 'Sin «Estado de aprendizaje», tampoco se subraya al leer', `${antes} → ${m.subrayadas}`);
    await fijar({ ...BASE, furigana: 'ninguna' });
    await p.waitForTimeout(500);
    m = await leer();
    comprobar(m.lecturas === 0 && compas(m) <= 1.5, 'Sin lecturas, el texto sigue parejo', m.saltos.join(' '));
  } finally {
    await motor('cambiarPalabras', deAntes);
    await fijar(BASE);
    await p.setViewportSize({ width: ANCHO, height: ALTO });
  }

  // Leyendo un texto largo: ningún signo de cierre se queda solo al principio de un renglón, a ningún ancho, y en una
  // ventana estrecha la ficha va debajo del texto y no tapa la palabra que se consulta.
  const LARGO = Array(3).fill('授業の後は、たぶん日本語の勉強を続けると思います。\n12月にJLPTがあるので、文法を毎日少しずつ進めているところです。\n一日でも休むと、ペースが遅れてしまうので、できるだけ毎日やるようにしています。\n「赤い星と青い星を食べる夢を見た」と言った。').join('\n\n');
  await motor('bibliotecaGuardar', { id: 'acabado-leer', titulo: 'Lectura de prueba del acabado', texto: LARGO, origen: 'pegado', creado: Date.now(), pagina: 0 });
  try {
    const alPrincipio = [];
    for (const ancho of [820, 1100, ANCHO]) {
      await p.setViewportSize({ width: ancho, height: 1000 });
      await ir('biblioteca?abrir=acabado-leer', '.ap-papel .pal', 1500);
      const malos = await p.evaluate(() => {
        const papel = document.querySelector('.ap-papel');
        const r = document.createRange();
        const filas = new Map();
        const andar = document.createTreeWalker(papel, NodeFilter.SHOW_TEXT);
        for (let n = andar.nextNode(); n; n = andar.nextNode()) {
          if (n.parentElement.closest('rt')) continue;
          for (let i = 0; i < n.length; i++) {
            r.setStart(n, i);
            r.setEnd(n, i + 1);
            const k = r.getBoundingClientRect();
            if (!k.width) continue;
            const y = Math.round(k.top / 12);
            if (!filas.has(y) || filas.get(y).x > k.left) filas.set(y, { c: n.data[i], x: k.left });
          }
        }
        return [...filas.values()].map((f) => f.c).filter((c) => /[、。，．,.!?！？」』）)】〉》…]/u.test(c)).length;
      });
      if (malos) alPrincipio.push(`${malos} a ${ancho} px`);
    }
    comprobar(!alPrincipio.length, 'Leyendo, ningún punto, coma ni comilla de cierre empieza un renglón, a ningún ancho', alPrincipio.join('; '));

    // En la Biblioteca y en el Cuaderno, que pone su propia altura a la ficha.
    await p.setViewportSize({ width: 820, height: 1000 });
    const tapadas = [];
    for (const [sitio, ruta, n] of [['Biblioteca', 'biblioteca?abrir=acabado-leer', 5], ['Biblioteca', null, 48], ['Cuaderno', `lector?t=${encodeURIComponent(LARGO)}`, 5], ['Cuaderno', null, 48]]) {
      if (ruta) await ir(ruta, '.ap-papel .pal', 1500);
      const palabra = p.locator('.ap-papel .pal').nth(n);
      await palabra.scrollIntoViewIfNeeded();
      await palabra.click();
      await p.locator('.ap-lectura-ficha').waitFor({ timeout: 15000 });
      await p.waitForTimeout(1300);
      const m = await p.evaluate(() => {
        const ficha = document.querySelector('.ap-lectura-ficha').getBoundingClientRect();
        const elegida = document.querySelector('.ap-elegida')?.getBoundingClientRect();
        const papel = document.querySelector('.ap-papel').getBoundingClientRect();
        return {
          aLaVista: !!elegida && elegida.top >= 0 && elegida.bottom <= ficha.top && elegida.bottom <= innerHeight,
          // A lo ancho del texto, pegada abajo y sin pasar de algo más de media ventana.
          debajo: ficha.left <= papel.left + 2 && ficha.right >= papel.right - 2 && ficha.bottom >= innerHeight - 2 && ficha.height <= innerHeight * 0.6,
          ficha: [Math.round(ficha.left), Math.round(ficha.top), Math.round(ficha.right), Math.round(ficha.bottom)],
          elegida: elegida ? [Math.round(elegida.top), Math.round(elegida.bottom)] : null,
        };
      });
      if (!m.aLaVista || !m.debajo) tapadas.push(`${sitio}, palabra ${n}: ficha ${m.ficha.join(',')}, palabra ${m.elegida?.join('–')}`);
      await p.locator('.ap-lectura-cerrar').click();
      await p.waitForTimeout(300);
    }
    comprobar(!tapadas.length, 'En una ventana estrecha, la ficha va debajo del texto y la palabra consultada queda a la vista', tapadas.join('; '));
  } finally {
    await motor('bibliotecaEliminar', 'acabado-leer').catch(() => {});
    await p.setViewportSize({ width: ANCHO, height: ALTO });
  }

  // Al pasar de una palabra a otra en el diccionario, quien mira ve la anterior y luego la nueva, entera: ni la página
  // vacía con esqueletos ni la nueva llegando a trozos. Se mira fotograma a fotograma lo que se ve.
  await motor('analizarLineas', [
    { id: 'a', inicio: 754_000, fin: 757_000, texto: '友達と話すのが好きです。' },
    { id: 'b', inicio: 1_261_000, fin: 1_264_000, texto: '先生とゆっくり話してみました。' },
  ], { titulo: FUENTE_CAMBIO, url: 'https://www.youtube.com/watch?v=kotonohaCambio', idVideo: 'kotonohaCambio' }).catch(() => {});
  const fotogramas = (pulsar) =>
    p.evaluate(
      () =>
        new Promise((listo) => {
          const vis = (e) => !!e && e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && !e.closest('[aria-hidden="true"], [inert]');
          const sinLecturas = (e) => {
            let t = '';
            const andar = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
            for (let n = andar.nextNode(); n; n = andar.nextNode()) if (!n.parentElement.closest('rt')) t += n.data;
            return t.trim();
          };
          const estados = [];
          const t0 = performance.now();
          const tomar = () => {
            const ficha = [...document.querySelectorAll('.dic-ficha .ficha-palabra')].find(vis);
            const caracter = [...document.querySelectorAll('.dic-caracter-cab')].find(vis);
            const lateral = [...document.querySelectorAll('.dic-lateral')].find(vis);
            const frases = [...document.querySelectorAll('.dic-frase')].filter(vis);
            const firma = [
              ficha ? sinLecturas(ficha) : caracter ? 'kanji' : '—',
              [...document.querySelectorAll('.esqueleto')].filter(vis).length,
              lateral ? [...lateral.querySelectorAll(':scope > .dic-seccion')].filter(vis).length : '—',
              `${frases.length}/${frases.filter((f) => f.querySelector('ruby')).length}`,
            ].join(' | ');
            if (estados.at(-1) !== firma) estados.push(firma);
            if (performance.now() - t0 < 2200) requestAnimationFrame(tomar);
            else listo(estados);
          };
          requestAnimationFrame(tomar);
        })
    ).then((x) => x);
  const cambios = [];
  for (const [nombre, pulsar] of [
    ['otro resultado de la lista', () => p.locator('.dic-lista-items .dic-tarjeta').nth(1).click()],
    ['una palabra de las que significan lo mismo', () => p.locator('.dic-lateral .dic-tarjetas .dic-tarjeta').first().click()],
    ['un kanji de la palabra', () => p.locator('.dic-lateral .dic-caracter-tarjeta').first().click()],
  ]) {
    await ir(`diccionario?q=${encodeURIComponent('はなす')}`, '.dic-ficha .ficha-palabra', 2500);
    const pendiente = fotogramas();
    await p.waitForTimeout(80);
    await pulsar();
    const estados = await pendiente;
    if (estados.length !== 2 || estados.some((e) => !e.split(' | ')[1].startsWith('0'))) cambios.push(`${nombre}: ${estados.join(' → ')}`);
  }
  comprobar(!cambios.length, 'Al pasar de una palabra a otra se ve la anterior y luego la nueva entera, sin esqueletos ni trozos', cambios.join(' ¦ '));
  // Desde abajo de la página, la palabra nueva se ve desde su principio.
  await ir(`diccionario?q=${encodeURIComponent('はなす')}`, '.dic-ficha .ficha-palabra', 2500);
  await p.evaluate(() => document.querySelector('.ap-principal').scrollTo(0, 99999));
  await p.waitForTimeout(300);
  await p.locator('.dic-lateral .dic-tarjetas .dic-tarjeta').last().click();
  await p.waitForTimeout(1200);
  const arriba = await p.evaluate(() => document.querySelector('.ap-principal').scrollTop);
  comprobar(arriba === 0, 'Y si se pulsa desde abajo de la página, la nueva se ve desde arriba', String(arriba));

  // El sendero de la portada: cada nivel con su raya en la pista y su rótulo debajo, sin tocarla.
  await ir('inicio', '.ap-sendero-pista', 1200);
  const sendero = await p.evaluate(() => {
    const pista = document.querySelector('.ap-sendero-pista').getBoundingClientRect();
    return [...document.querySelectorAll('.ap-hito')].map((h) => ({ raya: h.querySelector('i').getBoundingClientRect().height, aire: h.querySelector('b').getBoundingClientRect().top - pista.bottom }));
  });
  comprobar(sendero.length >= 3 && sendero.every((h) => h.raya >= 8 && h.aire >= 4), 'El sendero de niveles: cada uno con su raya y su rótulo despegado de la pista', sendero.map((h) => `${uno(h.raya)}/${uno(h.aire)}`).join(' '));

  // Lo que se borra y no vuelve pide confirmación.
  const ahora = Date.now();
  await motor('bibliotecaGuardar', { id: 'acabado-borrar', titulo: 'Libro de prueba del acabado', texto: TEXTO, origen: 'pegado', creado: ahora });
  try {
    await ir('biblioteca', '.ap-libro', 1000);
    const libros = () => p.locator('.ap-libro').count();
    const habia = await libros();
    await p.locator('button[aria-label="Eliminar Libro de prueba del acabado"]').click({ force: true });
    await p.locator('.ap-dialogo').waitFor({ timeout: 5000 });
    comprobar((await libros()) === habia && (await p.locator('.ap-dialogo').innerText()).includes('Libro de prueba del acabado'), 'Eliminar un libro pregunta antes, con su título');
    comprobar((await p.evaluate(() => document.activeElement?.textContent ?? '')).includes('Cancelar'), 'Con el foco en «Cancelar»: Intro no borra nada sin querer');
    await p.keyboard.press('Enter');
    await p.waitForTimeout(400);
    comprobar((await libros()) === habia && (await p.locator('.ap-dialogo').count()) === 0, 'Cancelar lo deja en su sitio');
    await p.locator('button[aria-label="Eliminar Libro de prueba del acabado"]').click({ force: true });
    await confirmarBorrado(p);
    await p.waitForFunction((n) => document.querySelectorAll('.ap-libro').length < n, habia, { timeout: 8000 }).catch(() => {});
    comprobar((await libros()) === habia - 1, 'Y al confirmar se elimina');
  } finally {
    await motor('bibliotecaEliminar', 'acabado-borrar').catch(() => {});
  }
  await ir('ajustes', '#diccionarios', 1500);
  const eliminar = p.locator('#diccionarios button[aria-label^="Eliminar "]');
  const instalados = await eliminar.count();
  if (instalados) {
    // Un doble clic no confirma: deja el botón preguntando, y Escape lo devuelve a como estaba.
    await eliminar.first().scrollIntoViewIfNeeded();
    await eliminar.first().dblclick();
    await p.waitForTimeout(300);
    comprobar((await p.locator('.confirmar-borrado').count()) === 1 && (await p.getByText('Eliminando…').count()) === 0, 'Eliminar un diccionario pide una segunda pulsación, y un doble clic no vale por las dos');
    await p.keyboard.press('Escape');
    await p.waitForTimeout(250);
    comprobar((await p.locator('.confirmar-borrado').count()) === 0 && (await eliminar.count()) === instalados, 'Escape lo deja como estaba, sin borrar nada');
  } else comprobar(false, 'Hay algún diccionario instalado para probar su borrado');

  // El índice de Ajustes marca la sección que se lee, también al saltar de golpe.
  const marca = () =>
    p.evaluate(() => {
      const cont = document.querySelector('.ap-principal');
      const k = cont.getBoundingClientRect();
      const [arriba, abajo] = [k.top + k.height * 0.1, k.top + k.height * 0.3];
      const secciones = [...document.querySelectorAll('.ap-ajuste-seccion')];
      const enFranja = secciones.find((s) => { const r = s.getBoundingClientRect(); return r.top < abajo && r.bottom > arriba; });
      const botones = [...document.querySelectorAll('.ap-subnav button')];
      return { marcada: document.querySelector('.ap-subnav .activa')?.textContent.trim(), esperada: botones[secciones.indexOf(enFranja)]?.textContent.trim(), alFondo: cont.scrollTop + cont.clientHeight >= cont.scrollHeight - 2 };
    });
  const altoAjustes = await p.evaluate(() => document.querySelector('.ap-principal').scrollHeight);
  const malas = [];
  const saltos = [];
  for (let y = 0; y < altoAjustes - ALTO; y += ALTO - 120) saltos.push(y);
  for (const y of [...saltos, Math.round(altoAjustes * 0.55), Math.round(altoAjustes * 0.2), 0]) {
    await p.evaluate((y) => document.querySelector('.ap-principal').scrollTo(0, y), y);
    await p.waitForTimeout(250);
    const m = await marca();
    if (!m.alFondo && m.marcada !== m.esperada) malas.push(`a ${y}: «${m.marcada}» por «${m.esperada}»`);
  }
  comprobar(saltos.length >= 5 && !malas.length, 'El índice de Ajustes marca la sección que se lee, también al saltar de golpe', malas.join('; '));
  await p.locator('.ap-subnav button').nth(-2).click();
  await p.waitForTimeout(1800);
  const penultima = await p.evaluate(() => [...document.querySelectorAll('.ap-subnav button')].at(-2).textContent.trim());
  comprobar((await marca()).marcada === penultima, 'Y la que se pulsa queda marcada aunque la página no pueda bajar más', (await marca()).marcada);

  // Añadir palabras conocidas dice cuántas entraron.
  const nueva = (await motor('analizarTexto', '蜃気楼')).flat().filter((t) => t.esPalabra).map((t) => ({ clave: t.clave, lema: t.lema, lectura: t.lectura, estado: t.estado }));
  try {
    await ir('palabras', '.ap-anadir-conocidas textarea', 800);
    await p.locator('.ap-anadir-conocidas textarea').fill('蜃気楼');
    await p.locator('.ap-anadir-conocidas button').click();
    await p.locator('.ap-anadir-conocidas .ap-mensaje').waitFor({ timeout: 8000 }).catch(() => {});
    const dicho = (await p.locator('.ap-anadir-conocidas .ap-mensaje').count()) ? await p.locator('.ap-anadir-conocidas .ap-mensaje').innerText() : '';
    comprobar(/\d/.test(dicho) && (await p.locator('.ap-anadir-conocidas textarea').inputValue()) === '', 'Añadir palabras conocidas dice cuántas entraron', dicho);
  } finally {
    await motor('cambiarPalabras', nueva).catch(() => {});
  }
  await borrarFrases(FUENTE_CAMBIO);
}

comprobar(errores.length === 0, 'Sin errores en las páginas', [...new Set(errores)].join(' | '));

await sw.evaluate(async (previo) => {
  await chrome.storage.local.set({ ajustes: previo.ajustes });
  for (const clave of ['urlBaseIA', 'claveAnthropic']) {
    if (previo[clave] !== undefined) await chrome.storage.local.set({ [clave]: previo[clave] });
    else await chrome.storage.local.remove(clave);
  }
}, previo);
await contexto.close();
mock.servidor.close();
console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien');
process.exit(fallos ? 1 : 0);
