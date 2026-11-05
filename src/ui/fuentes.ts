// Carga la tipografía: Nunito para el latín y Zen Maru Gothic para el japonés, las dos redondeadas.
// Se pasan como datos a FontFace para que la política de seguridad de cada sitio (font-src) no las
// bloquee. Los nombres de familia son propios para no chocar con los de la página anfitriona.

const LATIN = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const LATIN_EXT = 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF';

const ARCHIVOS: { familia: string; archivo: string; peso: string; rango?: string }[] = [
  { familia: 'Kotonoha Latin', archivo: 'nunito-latin', peso: '200 1000', rango: LATIN },
  { familia: 'Kotonoha Latin', archivo: 'nunito-latin-ext', peso: '200 1000', rango: LATIN_EXT },
  { familia: 'Kotonoha JP', archivo: 'japanese-500', peso: '500' },
  { familia: 'Kotonoha JP', archivo: 'japanese-700', peso: '700' },
  { familia: 'Kotonoha JP', archivo: 'japanese-900', peso: '900' },
];

let cargadas = false;

export async function cargarFuentes({ soloLatin = false }: { soloLatin?: boolean } = {}): Promise<void> {
  if (cargadas) return;
  cargadas = true;
  await Promise.all(
    ARCHIVOS.filter((f) => !soloLatin || f.familia === 'Kotonoha Latin').map(async ({ familia, archivo, peso, rango }) => {
      try {
        const datos = await (await fetch(chrome.runtime.getURL(`fuentes/${archivo}.woff2`))).arrayBuffer();
        const f = new FontFace(familia, datos, { weight: peso, display: 'swap', ...(rango ? { unicodeRange: rango } : {}) });
        await f.load();
        document.fonts.add(f);
      } catch (e) {
        // Sin la fuente la interfaz sigue funcionando con la tipografía del sistema.
        console.debug('Kotonoha: no se cargó la fuente', archivo, e);
      }
    })
  );
}
