// Service worker: comandos, captura y difusión de eventos. No guarda estado: Chrome puede detenerlo.

import { CLAVE_API, leerAjustes } from '../compartido/ajustes';
import { type ApiFondo, type EventoDifundido, HOST_AYUDANTE, PUERTO_AYUDANTE } from '../compartido/api';
import { atender, motor } from '../compartido/rpc';

const RUTA_MOTOR = 'motor.html';
let creando: Promise<void> | null = null;

async function asegurarMotor(): Promise<void> {
  const contextos = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT' as chrome.runtime.ContextType] });
  if (contextos.length) return;
  creando ??= chrome.offscreen
    .createDocument({
      url: RUTA_MOTOR,
      reasons: ['WORKERS', 'USER_MEDIA', 'BLOBS'] as chrome.offscreen.Reason[],
      justification: 'Tokenizador, base de datos, cliente de Claude y grabación de audio para tarjetas.',
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
      if (e || !id) mal(new Error(e?.message ?? 'Chrome no concedió la captura'));
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
  if (id === undefined) throw new Error('No hay pestaña activa');
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

const api: ApiFondo & { _: never } = {
  asegurarMotor,
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
  async capturaVisible() {
    return new Promise<string>((ok, mal) => {
      chrome.tabs.captureVisibleTab({ format: 'jpeg', quality: 90 }, (url) => {
        const e = chrome.runtime.lastError;
        if (e || !url) mal(new Error(e?.message ?? 'No se pudo capturar la pestaña'));
        else ok(url);
      });
    });
  },
  alternarCaptura: () => alternarCaptura(),
  capturaActiva: async () => (await pestanaCapturada()) !== null,
  abrirApp,
  difundir,
  async inyectarPagina() {
    // El último argumento de atender es el remitente; ver miPestana.
    const remitente = arguments[0] as chrome.runtime.MessageSender | undefined;
    const tabId = remitente?.tab?.id;
    if (tabId === undefined) return;
    await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', files: ['pagina.js'] });
  },
  async miPestana() {
    const remitente = arguments[0] as chrome.runtime.MessageSender | undefined;
    return remitente?.tab?.id;
  },
  _: undefined as never,
};

atender('fondo', api);

chrome.commands.onCommand.addListener((comando, pestana) => {
  if (comando === 'alternar-captura') {
    alternarCaptura(pestana?.id).catch((e) => console.error('Captura:', e));
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
  chrome.contextMenus.create({ id: 'kotonoha-buscar', title: 'Buscar «%s» en Kotonoha', contexts: ['selection'] }, () => void chrome.runtime.lastError);
  chrome.contextMenus.create({ id: 'kotonoha-leer', title: 'Abrir selección en el lector', contexts: ['selection'] }, () => void chrome.runtime.lastError);
  if (d.reason === 'install') abrirApp('inicio').catch(console.error);
});

chrome.contextMenus.onClicked.addListener((info) => {
  const texto = encodeURIComponent(info.selectionText ?? '');
  if (info.menuItemId === 'kotonoha-buscar') abrirApp(`diccionario?q=${texto}`).catch(console.error);
  if (info.menuItemId === 'kotonoha-leer') abrirApp(`lector?t=${texto}`).catch(console.error);
});

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
