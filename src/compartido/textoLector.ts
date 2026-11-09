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

// La nota de la biblioteca en la que se guarda también lo que se escribe en el Cuaderno, si se guardó en ella.
const CLAVE_NOTA = 'notaCuaderno';

export async function leerNotaCuaderno(): Promise<string | null> {
  const d = await chrome.storage.local.get(CLAVE_NOTA);
  return (d[CLAVE_NOTA] as string | undefined) || null;
}

export function guardarNotaCuaderno(id: string | null): Promise<void> {
  return id ? chrome.storage.local.set({ [CLAVE_NOTA]: id }) : chrome.storage.local.remove(CLAVE_NOTA);
}

export function alCambiarNotaCuaderno(fn: (id: string | null) => void): () => void {
  const oyente = (c: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && c[CLAVE_NOTA]) fn((c[CLAVE_NOTA].newValue as string | undefined) || null);
  };
  chrome.storage.onChanged.addListener(oyente);
  return () => chrome.storage.onChanged.removeListener(oyente);
}
