// Envío de datos al creador de tarjetas. Se guardan en storage para que la ventana los reciba
// tanto si ya estaba abierta como si se abre ahora.

import { fondo } from '../compartido/rpc';
import type { BorradorTarjeta } from '../compartido/tipos';

const CLAVE = 'borradorPendiente';

export type ParcialBorrador = Partial<BorradorTarjeta> & { _sello?: number };

export async function enviarAlCreador(parcial: Partial<BorradorTarjeta>, abrir = true): Promise<void> {
  await chrome.storage.local.set({ [CLAVE]: { ...parcial, _sello: Date.now() } satisfies ParcialBorrador });
  // Dentro de la ventana de la app el creador es un panel que se abre solo: no hace falta cambiar de pantalla.
  const enLaApp = location.protocol === 'chrome-extension:' && location.pathname.endsWith('/app.html');
  if (abrir && !enLaApp) await fondo.abrirApp('diccionario');
}

export function alRecibirBorrador(fn: (b: ParcialBorrador) => void): () => void {
  chrome.storage.local.get(CLAVE).then((d) => {
    if (d[CLAVE]) {
      fn(d[CLAVE] as ParcialBorrador);
      chrome.storage.local.remove(CLAVE);
    }
  });
  const oyente = (c: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && c[CLAVE]?.newValue) {
      fn(c[CLAVE].newValue as ParcialBorrador);
      chrome.storage.local.remove(CLAVE);
    }
  };
  chrome.storage.onChanged.addListener(oyente);
  return () => chrome.storage.onChanged.removeListener(oyente);
}

export function borradorVacio(): BorradorTarjeta {
  return {
    tipo: 'frase',
    palabra: '',
    lectura: '',
    frase: '',
    traduccion: '',
    definicion: '',
    audioFrase: [],
    audioPalabra: [],
    imagenes: [],
    ejemplos: '',
    notas: '',
  };
}
