// Llamadas entre contextos de la extensión.
//
// El motor vive en un documento offscreen y el service worker lo crea cuando hace falta.
// Los clientes (content script, app, popup) llaman al motor con chrome.runtime.sendMessage;
// las respuestas largas (Claude) usan un puerto para ir recibiendo el texto poco a poco.

import type { ApiMotor, ApiFondo, EventoDifundido } from './api';

export interface MensajeRpc {
  canal: 'motor' | 'fondo';
  metodo: string;
  args: unknown[];
}

interface RespuestaRpc {
  ok: boolean;
  valor?: unknown;
  error?: string;
}

const esErrorSinReceptor = (m: string) =>
  m.includes('Receiving end does not exist') || m.includes('message port closed') || m.includes('Could not establish connection');

async function enviar(canal: MensajeRpc['canal'], metodo: string, args: unknown[]): Promise<unknown> {
  const respuesta = (await chrome.runtime.sendMessage({ canal, metodo, args } satisfies MensajeRpc)) as RespuestaRpc | undefined;
  if (!respuesta) throw new Error('Receiving end does not exist');
  if (!respuesta.ok) throw new Error(respuesta.error ?? 'Error desconocido');
  return respuesta.valor;
}

let promesaMotor: Promise<void> | null = null;

export function asegurarMotor(): Promise<void> {
  promesaMotor ??= (enviar('fondo', 'asegurarMotor', []) as Promise<void>).finally(() => {
    promesaMotor = null;
  });
  return promesaMotor;
}

async function llamarMotor(metodo: string, args: unknown[]): Promise<unknown> {
  for (let intento = 0; ; intento++) {
    try {
      return await enviar('motor', metodo, args);
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : String(e);
      if (intento >= 3 || !esErrorSinReceptor(mensaje)) throw e;
      await asegurarMotor();
      await new Promise((r) => setTimeout(r, 150 * (intento + 1)));
    }
  }
}

export const motor = new Proxy({} as ApiMotor, {
  get: (_o, metodo: string) => (...args: unknown[]) => llamarMotor(metodo, args),
});

export const fondo = new Proxy({} as ApiFondo, {
  get: (_o, metodo: string) => (...args: unknown[]) => enviar('fondo', metodo, args),
});

/** Atiende las llamadas de un canal. El otro contexto ignora el mensaje sin responder. */
export function atender(canal: MensajeRpc['canal'], api: object): void {
  chrome.runtime.onMessage.addListener((mensaje: MensajeRpc, _remitente, responder) => {
    if (mensaje?.canal !== canal) return false;
    const fn = (api as Record<string, unknown>)[mensaje.metodo];
    if (typeof fn !== 'function') {
      responder({ ok: false, error: `Método desconocido: ${mensaje.metodo}` } satisfies RespuestaRpc);
      return false;
    }
    Promise.resolve()
      .then(() => (fn as (...a: unknown[]) => unknown).apply(api, [...mensaje.args, _remitente]))
      .then(
        (valor) => responder({ ok: true, valor } satisfies RespuestaRpc),
        (e) => responder({ ok: false, error: e instanceof Error ? e.message : String(e) } satisfies RespuestaRpc)
      );
    return true;
  });
}

// ---------- Flujos de texto (respuestas de Claude) ----------

const PUERTO_FLUJO = 'kotonoha-flujo';

export interface PeticionFlujo {
  metodo: string;
  args: unknown[];
}

type MensajeFlujo =
  | { tipo: 'parte'; texto: string }
  | { tipo: 'fin'; texto: string; aviso?: string }
  | { tipo: 'error'; error: string };

export interface FlujoCancelable extends Promise<string> {
  cancelar(): void;
}

export function flujoMotor(metodo: string, args: unknown[], alParte: (acumulado: string) => void): FlujoCancelable {
  let puerto: chrome.runtime.Port | null = null;
  let cancelado = false;
  const promesa = (async () => {
    await asegurarMotor();
    return new Promise<string>((ok, mal) => {
      if (cancelado) return ok('');
      puerto = chrome.runtime.connect({ name: PUERTO_FLUJO });
      let acumulado = '';
      let terminado = false;
      puerto.onMessage.addListener((m: MensajeFlujo) => {
        if (m.tipo === 'parte') {
          acumulado += m.texto;
          alParte(acumulado);
        } else if (m.tipo === 'fin') {
          terminado = true;
          ok(m.texto);
          puerto?.disconnect();
        } else {
          terminado = true;
          mal(new Error(m.error));
          puerto?.disconnect();
        }
      });
      puerto.onDisconnect.addListener(() => {
        void chrome.runtime.lastError;
        if (!terminado) {
          if (cancelado) ok(acumulado);
          else mal(new Error('Se perdió la conexión con el motor'));
        }
      });
      puerto.postMessage({ metodo, args } satisfies PeticionFlujo);
    });
  })() as FlujoCancelable;
  promesa.cancelar = () => {
    cancelado = true;
    puerto?.disconnect();
  };
  return promesa;
}

/** En el motor: atiende flujos. La función recibe un callback para ir emitiendo texto. */
export function atenderFlujos(
  api: Record<string, (emitir: (texto: string) => void, senal: AbortSignal, ...args: never[]) => Promise<string>>
): void {
  chrome.runtime.onConnect.addListener((puerto) => {
    if (puerto.name !== PUERTO_FLUJO) return;
    const cancelador = new AbortController();
    puerto.onDisconnect.addListener(() => cancelador.abort());
    puerto.onMessage.addListener((p: PeticionFlujo) => {
      const fn = api[p.metodo];
      const enviarSeguro = (m: MensajeFlujo) => {
        try {
          puerto.postMessage(m);
        } catch {
          // El cliente cerró el puerto; no hay nada más que hacer.
        }
      };
      if (!fn) {
        enviarSeguro({ tipo: 'error', error: `Flujo desconocido: ${p.metodo}` });
        return;
      }
      fn((texto) => enviarSeguro({ tipo: 'parte', texto }), cancelador.signal, ...(p.args as never[])).then(
        (texto) => enviarSeguro({ tipo: 'fin', texto }),
        (e) => enviarSeguro({ tipo: 'error', error: e instanceof Error ? e.message : String(e) })
      );
    });
  });
}

// ---------- Eventos difundidos ----------

export function alRecibirEvento(fn: (e: EventoDifundido) => void): () => void {
  const oyente = (m: { evento?: EventoDifundido }) => {
    if (m?.evento) fn(m.evento);
    return false;
  };
  chrome.runtime.onMessage.addListener(oyente);
  return () => chrome.runtime.onMessage.removeListener(oyente);
}
