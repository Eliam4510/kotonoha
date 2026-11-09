// Lo que no depende de los modelos en las voces neuronales del inglés (Kokoro) y del alemán (Piper): partir el texto en
// frases que se leen por separado, ajustar los fonemas de espeak-ng a los que aprendió Kokoro y convertirlos en los
// identificadores que espera su modelo. Sin red ni ONNX, para poder probarlo.

/** Kokoro admite como mucho 512 identificadores por lectura, contando el de apertura y el de cierre. */
export const MAXIMO_KOKORO = 510;
/** Lo que mide una frase leída de una vez: más larga, se parte por las comas. */
const LARGO_FRASE = 260;

/** El texto en frases que se leen por separado: por los signos de final de frase y, si alguna es muy larga, por las comas. */
export function frasesParaVoz(texto: string): string[] {
  const limpio = texto.replace(/\s+/g, ' ').trim();
  if (!limpio) return [];
  const frases = limpio.split(/(?<=[.!?…])\s+(?=\S)/u);
  return frases.flatMap((f) => {
    if (f.length <= LARGO_FRASE) return [f];
    const partes: string[] = [];
    let actual = '';
    for (const trozo of f.split(/(?<=[,;:])\s+/u)) {
      if (actual && (actual + ' ' + trozo).length > LARGO_FRASE) {
        partes.push(actual);
        actual = trozo;
      } else actual = actual ? `${actual} ${trozo}` : trozo;
    }
    if (actual) partes.push(actual);
    return partes;
  });
}

/** Como kokoro-js antes de pedir los fonemas: comillas rectas y los tratamientos que espeak-ng leería letra a letra. */
export function prepararTextoIngles(texto: string): string {
  return texto
    .replace(/[‘’]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/\bD[Rr]\.(?= [A-Z])/g, 'Doctor')
    .replace(/\b(?:Mr\.|MR\.(?= [A-Z]))/g, 'Mister')
    .replace(/\b(?:Ms\.|MS\.(?= [A-Z]))/g, 'Miss')
    .replace(/\b(?:Mrs\.|MRS\.(?= [A-Z]))/g, 'Mrs')
    .replace(/\betc\.(?! [A-Z])/gi, 'etc');
}

/**
 * Los fonemas de espeak-ng como los aprendió Kokoro, con los mismos cambios que hace kokoro-js: su «r» es «ɹ», sin «ʲ»,
 * «x» ni «ɬ», y en inglés americano «ninety» suena con «d».
 */
export function fonemasKokoro(ipa: string, americano: boolean): string {
  let f = ipa
    .replace(/kəkˈoːɹoʊ/g, 'kˈoʊkəɹoʊ')
    .replace(/kəkˈɔːɹəʊ/g, 'kˈəʊkəɹəʊ')
    .replace(/ʲ/g, 'j')
    .replace(/r/g, 'ɹ')
    .replace(/x/g, 'k')
    .replace(/ɬ/g, 'l')
    .replace(/(?<=[a-zɹː])(?=hˈʌndɹɪd)/g, ' ')
    .replace(/ z(?=[;:,.!?¡¿—…"«»“” ]|$)/g, 'z');
  if (americano) f = f.replace(/(?<=nˈaɪn)ti(?!ː)/g, 'di');
  return f.trim();
}

/**
 * Los identificadores de Kokoro para unos fonemas: uno por carácter, sin los que no conoce, entre dos «$» (el 0), y como
 * mucho MAXIMO_KOKORO por medio.
 */
export function idsKokoro(fonemas: string, vocabulario: ReadonlyMap<string, number>): number[] {
  const ids: number[] = [];
  for (const c of fonemas) {
    const id = vocabulario.get(c);
    if (id !== undefined) ids.push(id);
    if (ids.length >= MAXIMO_KOKORO) break;
  }
  return [0, ...ids, 0];
}

/** Une los trozos de audio de cada frase con un silencio corto entre ellos. */
export function unirAudio(trozos: Float32Array[], frecuencia: number, pausaS = 0.12): Float32Array {
  const pausa = Math.round(pausaS * frecuencia);
  const total = trozos.reduce((n, t) => n + t.length, 0) + Math.max(0, trozos.length - 1) * pausa;
  const salida = new Float32Array(total);
  let p = 0;
  trozos.forEach((t, i) => {
    salida.set(t, p);
    p += t.length + (i < trozos.length - 1 ? pausa : 0);
  });
  return salida;
}
