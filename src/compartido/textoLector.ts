// El texto del lector en su pestaña propia. Se guarda en el almacenamiento de la extensión: así llega desde la ventana
// de la app, se conserva al recargar la pestaña y no hace falta ponerlo en una dirección, donde no cabría un texto largo.

const CLAVE = 'lectorTexto';

export async function leerTextoLector(): Promise<string> {
  const d = await chrome.storage.local.get(CLAVE);
  return (d[CLAVE] as string | undefined) ?? '';
}

export function guardarTextoLector(texto: string): Promise<void> {
  return chrome.storage.local.set({ [CLAVE]: texto });
}

export function alCambiarTextoLector(fn: (texto: string) => void): () => void {
  const oyente = (c: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && c[CLAVE]) fn((c[CLAVE].newValue as string | undefined) ?? '');
  };
  chrome.storage.onChanged.addListener(oyente);
  return () => chrome.storage.onChanged.removeListener(oyente);
}
