// Leer en voz alta con las voces del navegador, cuando no hay clave de Azure. La voz es la elegida en Ajustes para esta
// lengua o, si no hay ninguna o ya no está, la mejor que ofrezca el navegador (nucleo/voces.ts).

import { vocesDeLengua, vozParaLeer } from '../nucleo/voces';
import { formatoLectura, lengua, vozNavegador } from './lengua';

/** El navegador carga sus voces poco a poco: la primera vez la lista puede llegar vacía, y avisa cuando está. */
export function vocesDelNavegador(): Promise<SpeechSynthesisVoice[]> {
  const ya = speechSynthesis.getVoices();
  if (ya.length) return Promise.resolve(ya);
  return new Promise((ok) => {
    const listo = () => {
      speechSynthesis.removeEventListener('voiceschanged', listo);
      clearTimeout(reloj);
      ok(speechSynthesis.getVoices());
    };
    const reloj = setTimeout(listo, 1500);
    speechSynthesis.addEventListener('voiceschanged', listo);
  });
}

/** La variante de la lengua: el inglés británico si así se leen las pronunciaciones; si no, la de la lengua. */
const region = () => (lengua.value.id === 'en' && formatoLectura.value === 'uk' ? 'en-GB' : lengua.value.bcp47);

/** Las voces de la lengua que se estudia, de mejor a peor. */
export async function vocesDeLaLengua(): Promise<SpeechSynthesisVoice[]> {
  return vocesDeLengua(await vocesDelNavegador(), lengua.value.id, region());
}

/** Lee un texto con la voz elegida o, si no, con la mejor. Termina cuando acaba de sonar, o si falla. */
export async function decirConNavegador(texto: string, elegida = vozNavegador.value, velocidad = 1): Promise<void> {
  const voz = vozParaLeer(await vocesDelNavegador(), lengua.value.id, elegida, region());
  await new Promise<void>((ok) => {
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = voz?.lang ?? lengua.value.bcp47;
    if (voz) u.voice = voz;
    u.rate = velocidad;
    u.onend = () => ok();
    u.onerror = () => ok();
    speechSynthesis.speak(u);
  });
}
