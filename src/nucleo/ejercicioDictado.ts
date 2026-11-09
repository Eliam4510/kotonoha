// El ejercicio de dictado sobre un video: se oye una frase sin verla, se escribe y se compara con la de verdad. En japonés
// se compara cómo se lee (lo escrito en kana vale igual que en kanji); en las demás lenguas, palabra a palabra.

/**
 * Qué elementos de `esperado` aparecen en `escrito`, en el mismo orden: la subsecuencia común más larga. Sirve igual para
 * caracteres que para palabras.
 */
export function coincidencias(esperado: readonly string[], escrito: readonly string[]): boolean[] {
  const n = esperado.length;
  const m = escrito.length;
  const tabla = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      tabla[i][j] = esperado[i] === escrito[j] ? tabla[i + 1][j + 1] + 1 : Math.max(tabla[i + 1][j], tabla[i][j + 1]);
    }
  }
  const salida = new Array<boolean>(n).fill(false);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (esperado[i] === escrito[j]) {
      salida[i] = true;
      i++;
      j++;
    } else if (tabla[i + 1][j] >= tabla[i][j + 1]) i++;
    else j++;
  }
  return salida;
}

/** Una parte de la frase (una palabra) con lo que se oye de ella, para decir si se acertó. */
export interface ParteDictado {
  texto: string;
  /** Lo que se compara: su lectura en kana, o la palabra en minúsculas y sin signos. Vacío para los signos. */
  clave: string;
}

export interface ResultadoDictado {
  /** Por cada parte, si se oyó bien: entera, a medias o nada. Los signos no cuentan. */
  partes: { texto: string; acierto: 'bien' | 'casi' | 'mal' | 'signo' }[];
  /** De 0 a 1: la parte de lo que se dice que se escribió bien. */
  nota: number;
}

/**
 * Compara lo escrito con la frase, unidad a unidad (caracteres de la lectura en japonés, palabras en las demás). Una
 * parte está bien si se escribieron todas sus unidades, casi si al menos la mitad, y mal si menos.
 */
export function evaluarDictado(partes: ParteDictado[], escrito: string[], unidades: (clave: string) => string[]): ResultadoDictado {
  const porParte = partes.map((p) => unidades(p.clave));
  const todas = porParte.flat();
  const acertadas = coincidencias(todas, escrito);
  let k = 0;
  let total = 0;
  let bien = 0;
  const salida = partes.map((p, i) => {
    const us = porParte[i];
    if (!us.length) return { texto: p.texto, acierto: 'signo' as const };
    const n = us.filter((_, x) => acertadas[k + x]).length;
    k += us.length;
    total += us.length;
    bien += n;
    return { texto: p.texto, acierto: n === us.length ? ('bien' as const) : n * 2 >= us.length ? ('casi' as const) : ('mal' as const) };
  });
  return { partes: salida, nota: total ? bien / total : 0 };
}

/** Las palabras de un texto con espacios, en minúsculas y sin signos: «Don't stop!» da don't y stop. */
export const palabrasDe = (texto: string): string[] =>
  texto
    .toLocaleLowerCase()
    .split(/[^\p{L}\p{N}'’]+/u)
    .map((p) => p.replace(/^['’]+|['’]+$/g, '').replace(/’/g, "'"))
    .filter(Boolean);

/**
 * Como evaluarDictado, pero una parte puede leerse de varias formas: si el analizador leyó 後 como «ご» y se escribió
 * «あと», que es como se lee ahí, cuenta como bien. Se prueba cada lectura posible de cada parte y se queda la que más
 * acierta; son pocas partes y pocas lecturas.
 */
export function evaluarConLecturas(partes: ParteDictado[], otras: (string[] | undefined)[], escrito: string[], unidades: (clave: string) => string[]): ResultadoDictado {
  const actuales = partes.map((p) => ({ ...p }));
  let mejor = evaluarDictado(actuales, escrito, unidades);
  otras.forEach((lecturas, i) => {
    for (const lectura of lecturas ?? []) {
      if (!lectura || lectura === actuales[i].clave) continue;
      const prueba = actuales.map((p, k) => (k === i ? { ...p, clave: lectura } : p));
      const r = evaluarDictado(prueba, escrito, unidades);
      if (r.nota > mejor.nota) {
        mejor = r;
        actuales[i] = prueba[i];
      }
    }
  });
  return mejor;
}
