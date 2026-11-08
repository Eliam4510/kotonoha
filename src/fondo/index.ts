// Service worker: comandos, captura y difusión de eventos. No guarda estado: Chrome puede detenerlo.

import { alCambiarAjustes, CLAVE_API, leerAjustes } from '../compartido/ajustes';
import { type ApiFondo, type EventoDifundido, HOST_AYUDANTE, PUERTO_AYUDANTE } from '../compartido/api';
import { atender, motor, type ConRemitente } from '../compartido/rpc';
import { fijarIdioma, tr } from '../compartido/i18n';

const RUTA_MOTOR = 'motor.html';
let creando: Promise<void> | null = null;

async function asegurarMotor(): Promise<void> {
  const contextos = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT' as chrome.runtime.ContextType] });
  if (contextos.length) return;
  creando ??= chrome.offscreen
    .createDocument({
      url: RUTA_MOTOR,
      reasons: ['WORKERS', 'USER_MEDIA', 'BLOBS', 'CLIPBOARD'] as chrome.offscreen.Reason[],
      justification: 'Tokenizador, base de datos, cliente de Claude, grabación de audio para tarjetas y lectura del portapapeles para el lector.',
    })
    .finally(() => {
      creando = null;
    });
  await creando;
}

async function difundir(evento: EventoDifundido): Promise<void> {
  // A las páginas de la extensión.
  chrome.runtime.sendMessage({ evento }).catch(() => {});
  // A los content scripts de cada pestaña.
  const pestanas = await chrome.tabs.query({});
  for (const p of pestanas) {
    if (p.id !== undefined) chrome.tabs.sendMessage(p.id, { evento }).catch(() => {});
  }
}

const CAPTURA = 'capturaPestana';

async function pestanaCapturada(): Promise<number | null> {
  const d = await chrome.storage.session.get(CAPTURA);
  return (d[CAPTURA] as number | undefined) ?? null;
}

async function activarCaptura(idPestana: number): Promise<void> {
  await asegurarMotor();
  const streamId = await new Promise<string>((ok, mal) => {
    chrome.tabCapture.getMediaStreamId({ targetTabId: idPestana }, (id) => {
      const e = chrome.runtime.lastError;
      if (e || !id) mal(new Error(e?.message ?? tr('Chrome no concedió la captura')));
      else ok(id);
    });
  });
  await motor.iniciarCaptura(streamId);
  await chrome.storage.session.set({ [CAPTURA]: idPestana });
  await difundir({ tipo: 'captura', activa: true });
}

async function desactivarCaptura(): Promise<void> {
  await motor.detenerCaptura().catch(() => {});
  await chrome.storage.session.remove(CAPTURA);
  await difundir({ tipo: 'captura', activa: false });
}

async function alternarCaptura(idPestana?: number): Promise<boolean> {
  const id = idPestana ?? (await chrome.tabs.query({ active: true, currentWindow: true }))[0]?.id;
  if (id === undefined) throw new Error(tr('No hay pestaña activa'));
  const actual = await pestanaCapturada();
  if (actual !== null) {
    await desactivarCaptura();
    if (actual === id) return false;
  }
  await activarCaptura(id);
  return true;
}

async function abrirApp(ruta = 'inicio'): Promise<void> {
  const url = chrome.runtime.getURL(`app.html#/${ruta}`);
  const abiertas = await chrome.tabs.query({ url: chrome.runtime.getURL('app.html') + '*' });
  if (abiertas[0]?.id !== undefined) {
    await chrome.tabs.update(abiertas[0].id, { active: true, url });
    if (abiertas[0].windowId !== undefined) await chrome.windows.update(abiertas[0].windowId, { focused: true });
    return;
  }
  await chrome.windows.create({ url, type: 'popup', width: 1280, height: 900 });
}

/**
 * El lector en una pestaña normal. La ventana de la app no tiene pestañas: hay que ir a una ventana del navegador, y
 * solo ahí puede entrar en la vista dividida. Si ya está abierta no se duplica, porque compartirían el mismo texto.
 */
async function abrirLectorWeb(junto = false): Promise<void> {
  const url = chrome.runtime.getURL('lector.html');
  const enfocar = async (t: chrome.tabs.Tab) => {
    if (t.id !== undefined) await chrome.tabs.update(t.id, { active: true });
    if (t.windowId !== undefined) await chrome.windows.update(t.windowId, { focused: true });
  };
  const ventana = await chrome.windows.getLastFocused({ windowTypes: ['normal'] }).catch(() => null);
  if (!ventana?.id) {
    await chrome.windows.create({ url, type: 'normal' });
    return;
  }
  const [activa] = await chrome.tabs.query({ active: true, windowId: ventana.id });
  const [abierta] = await chrome.tabs.query({ url: `${url}*` });
  if (abierta) {
    if (junto && activa?.id !== undefined && abierta.id !== undefined && activa.id !== abierta.id && abierta.windowId === ventana.id) {
      // No se puede con una pestaña que ya está dividida: entonces basta con llevar a ella.
      await (chrome.tabs as unknown as { createSplit(ids: number[]): Promise<number> }).createSplit([activa.id, abierta.id]).catch(() => {});
    }
    await enfocar(abierta);
    return;
  }
  // El navegador rechaza la opción si es anterior a la vista dividida, o si esa pestaña no puede entrar en una.
  if (junto && activa?.id !== undefined) {
    try {
      const creada = await chrome.tabs.create({ url, windowId: ventana.id, splitWithTabId: activa.id } as chrome.tabs.CreateProperties);
      await enfocar(creada);
      return;
    } catch (e) {
      console.debug('Kotonoha: sin vista dividida', e);
    }
  }
  await enfocar(await chrome.tabs.create({ url, windowId: ventana.id }));
}

/** El visor de la Ayuda de lectura, en una pestaña normal: para leer a pantalla completa o en vista dividida. */
async function abrirVisor(id: string): Promise<void> {
  const url = chrome.runtime.getURL(`visor.html#${encodeURIComponent(id)}`);
  const ventana = await chrome.windows.getLastFocused({ windowTypes: ['normal'] }).catch(() => null);
  if (!ventana?.id) {
    await chrome.windows.create({ url, type: 'normal' });
    return;
  }
  await chrome.tabs.create({ url, windowId: ventana.id });
  await chrome.windows.update(ventana.id, { focused: true });
}

const api: ApiFondo & { _: never } = {
  asegurarMotor,
  abrirLectorWeb,
  abrirVisor,
  async claveIA() {
    const d = await chrome.storage.local.get(CLAVE_API);
    return (d[CLAVE_API] as string | undefined) ?? null;
  },
  // Solo para las pruebas automáticas: permite apuntar a un servidor falso de la API.
  async urlBaseIA() {
    const d = await chrome.storage.local.get('urlBaseIA');
    return (d.urlBaseIA as string | undefined) ?? null;
  },
  ajustesCompletos: () => leerAjustes(),
  // Sin tocar teclado ni ratón durante dos minutos se considera que no estás usando el equipo.
  estadoUso: () => chrome.idle.queryState(120),
  async capturaVisible(this: ConRemitente) {
    // La ventana de quien pide la captura: la que tenga el foco puede ser otra, como la del creador de tarjetas.
    const remitente = this.remitente;
    if (remitente?.tab && !remitente.tab.active) throw new Error(tr('La pestaña del video no está a la vista'));
    return new Promise<string>((ok, mal) => {
      chrome.tabs.captureVisibleTab(remitente?.tab?.windowId ?? chrome.windows.WINDOW_ID_CURRENT, { format: 'jpeg', quality: 90 }, (url) => {
        const e = chrome.runtime.lastError;
        if (e || !url) mal(new Error(e?.message ?? tr('No se pudo capturar la pestaña')));
        else ok(url);
      });
    });
  },
  // Como estilo de usuario: gana a cualquiera del sitio, incluso a los !important en línea de sus avisos.
  async soloVideo(this: ConRemitente, si: boolean) {
    const tabId = this.remitente?.tab?.id;
    if (tabId === undefined) return;
    const opciones = { target: { tabId, allFrames: true }, origin: 'USER' as const, css: '*{visibility:hidden!important}video{visibility:visible!important}' };
    await (si ? chrome.scripting.insertCSS(opciones) : chrome.scripting.removeCSS(opciones));
  },
  alternarCaptura: () => alternarCaptura(),
  // Es por pestaña: con la captura en otra, lo que se grabaría aquí es el silencio de aquella.
  async capturaActiva(this: ConRemitente) {
    const capturada = await pestanaCapturada();
    if (capturada === null) return false;
    const id = this.remitente?.tab?.id ?? (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]?.id;
    if (id !== capturada) return false;
    // El motor puede haberse reiniciado o la captura haberse cortado: el dato guardado no basta.
    const sigue = await motor.estado().then((e) => e.capturaActiva).catch(() => false);
    if (!sigue) await chrome.storage.session.remove(CAPTURA);
    return sigue;
  },
  // Una tecla que ya tenga otra extensión, aunque esté desactivada, Chrome no la asigna y tampoco avisa.
  async atajos() {
    const lista = await chrome.commands.getAll();
    return Object.fromEntries(lista.flatMap((c) => (c.name ? [[c.name, c.shortcut ?? '']] : [])));
  },
  async abrirAtajos() {
    await chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  },
  abrirApp,
  difundir,
  async inyectarPagina(this: ConRemitente) {
    const tabId = this.remitente?.tab?.id;
    if (tabId === undefined) return;
    await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', files: ['pagina.js'] });
  },
  async miPestana(this: ConRemitente) {
    return this.remitente?.tab?.id;
  },
  _: undefined as never,
};

atender('fondo', api);

chrome.commands.onCommand.addListener((comando, pestana) => {
  if (comando === 'alternar-captura') {
    // Con la barra escondida no se vería nada: quien pulsa la tecla tiene que saber qué ha pasado.
    alternarCaptura(pestana?.id).catch((e) => {
      console.error('Captura:', e);
      if (pestana?.id !== undefined) chrome.tabs.sendMessage(pestana.id, { evento: { tipo: 'capturaFallida', motivo: e instanceof Error ? e.message : String(e) } satisfies EventoDifundido }).catch(() => {});
    });
    return;
  }
  if (comando === 'abrir-app') {
    abrirApp().catch(console.error);
    return;
  }
  if (pestana?.id !== undefined) {
    chrome.tabs.sendMessage(pestana.id, { evento: { tipo: 'comando', comando } satisfies EventoDifundido }).catch(() => {});
  }
});

chrome.tabs.onRemoved.addListener(async (id) => {
  if ((await pestanaCapturada()) === id) await desactivarCaptura();
});

chrome.runtime.onInstalled.addListener((d) => {
  crearMenus().catch(console.error);
  if (d.reason === 'install') abrirApp('inicio').catch(console.error);
});

/** Los menús contextuales se rehacen al cambiar de idioma: una vez creados no se traducen solos. */
async function crearMenus() {
  await fijarIdioma((await leerAjustes()).idiomaInterfaz);
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({ id: 'kotonoha-buscar', title: tr('Buscar «%s» en Kotonoha'), contexts: ['selection'] }, () => void chrome.runtime.lastError);
  chrome.contextMenus.create({ id: 'kotonoha-leer', title: tr('Abrir selección en el Portapapeles'), contexts: ['selection'] }, () => void chrome.runtime.lastError);
}

let idiomaMenus: string | undefined;
alCambiarAjustes((a) => {
  if (a.idiomaInterfaz !== idiomaMenus) {
    idiomaMenus = a.idiomaInterfaz;
    crearMenus().catch(console.error);
  }
});

chrome.contextMenus.onClicked.addListener((info) => {
  const texto = encodeURIComponent(info.selectionText ?? '');
  if (info.menuItemId === 'kotonoha-buscar') abrirApp(`diccionario?q=${texto}`).catch(console.error);
  if (info.menuItemId === 'kotonoha-leer') abrirApp(`lector?t=${texto}`).catch(console.error);
});

// ---------- Actualización de la copia de desarrollo ----------
//
// Una extensión cargada desde una carpeta no se actualiza sola: tras cada compilación habría que pulsar
// «Recargar». Aquí se comprueba si la compilación cambió y se recarga, salvo que esté trabajando en algo.

const ALARMA_COMPILACION = 'kotonoha-compilacion';
const COMPILACION = 'compilacionCargada';
const esCopiaLocal = () => !('update_url' in chrome.runtime.getManifest());

async function leerCompilacion(): Promise<string | null> {
  try {
    const r = await fetch(chrome.runtime.getURL('compilacion.txt'), { cache: 'no-store' });
    return r.ok ? (await r.text()).trim() : null;
  } catch {
    // Durante una compilación el archivo aún no existe: se volverá a mirar.
    return null;
  }
}

async function anotarCompilacion() {
  const actual = await leerCompilacion();
  if (actual) await chrome.storage.session.set({ [COMPILACION]: actual });
}

async function comprobarCompilacion() {
  const actual = await leerCompilacion();
  if (!actual) return;
  const d = await chrome.storage.session.get(COMPILACION);
  if (!d[COMPILACION]) {
    await chrome.storage.session.set({ [COMPILACION]: actual });
    return;
  }
  if (d[COMPILACION] === actual) return;
  // Recargar cortaría una transcripción o una traducción en curso: se espera a que terminen.
  const ocupado = await motor.flujosActivos().catch(() => 0);
  if (!ocupado) chrome.runtime.reload();
}

if (esCopiaLocal()) {
  chrome.alarms.create(ALARMA_COMPILACION, { periodInMinutes: 0.5 });
  chrome.alarms.onAlarm.addListener((a) => {
    if (a.name === ALARMA_COMPILACION) comprobarCompilacion().catch(() => {});
  });
  chrome.runtime.onStartup.addListener(() => void anotarCompilacion());
  chrome.runtime.onInstalled.addListener(() => void anotarCompilacion());
}

// Puente con el ayudante local. El motor vive en un documento offscreen, que no puede hablar con
// programas nativos. Mientras la conexión siga abierta, Chrome no detiene este service worker.
chrome.runtime.onConnect.addListener((puerto) => {
  if (puerto.name !== PUERTO_AYUDANTE) return;
  const nativo = chrome.runtime.connectNative(HOST_AYUDANTE);
  nativo.onMessage.addListener((m) => puerto.postMessage(m));
  nativo.onDisconnect.addListener(() => {
    const motivo = chrome.runtime.lastError?.message ?? '';
    try {
      puerto.postMessage({ tipo: 'desconectado', mensaje: motivo });
      puerto.disconnect();
    } catch {
      // El motor ya había cerrado su lado.
    }
  });
  puerto.onMessage.addListener((m) => nativo.postMessage(m));
  puerto.onDisconnect.addListener(() => nativo.disconnect());
});

// Mantiene el motor con la clave vigente cuando cambia en Ajustes.
chrome.storage.onChanged.addListener((cambios, area) => {
  if (area === 'local' && (cambios[CLAVE_API] || cambios.urlBaseIA)) {
    chrome.storage.local.get([CLAVE_API, 'urlBaseIA']).then((d) => motor.fijarClaveIA((d[CLAVE_API] as string | undefined) ?? '', d.urlBaseIA as string | undefined)).catch(() => {});
  }
});
