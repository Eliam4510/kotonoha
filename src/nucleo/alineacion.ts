// Las moras especiales de la práctica del acento (0.19.0), con narabas: un wav2vec2 que da, cada 20 ms, la probabilidad
// de cada fonema del japonés. Aquí va lo que no depende del modelo: sus símbolos, lo que oye por su cuenta y la
// comparación con la lectura esperada, que dice qué っ, ん o vocales largas faltan o sobran.

/** Los símbolos de narabas, en su orden: el índice es lo que da el modelo. */
export const FONEMAS_NARABAS = [
  '[PAD]', '[BOS]', '[EOS]', 'pau', 'N', 'a', 'b', 'by', 'ch', 'cl', 'd', 'dy', 'e', 'f', 'g', 'gw', 'gy', 'h', 'hy', 'i', 'j',
  'k', 'kw', 'ky', 'm', 'my', 'n', 'ny', 'o', 'p', 'py', 'r', 'ry', 's', 'sh', 't', 'ts', 'ty', 'u', 'v', 'w', 'y', 'z',
] as const;

/** Lo que oye narabas por su cuenta: el fonema más probable de cada marco, sin repetir y sin blancos, marcas ni pausas. */
export function fonemasOidos(logits: ArrayLike<number>, marcos: number, clases: number): string[] {
  const salida: string[] = [];
  let previo = -1;
  for (let t = 0; t < marcos; t++) {
    let mejor = 0;
    for (let k = 1; k < clases; k++) if (logits[t * clases + k] > logits[t * clases + mejor]) mejor = k;
    // 0 es el blanco; 1 y 2, el principio y el fin; 3, una pausa.
    if (mejor !== previo && mejor > 3) salida.push(FONEMAS_NARABAS[mejor]);
    previo = mejor;
  }
  return salida;
}

export type TipoMoraEspecial = 'larga' | 'sokuon' | 'hatsuon';

export interface MoraEspecialOida {
  /** Su índice entre todas las moras. */
  mora: number;
  /** «falta»: no se oye (おばさん por おばあさん). «sobra»: se oye una que no está (おばあさん por おばさん); va en la mora de delante. */
  error: 'falta' | 'sobra';
  /** La mora que falta, o la que sobra: una vocal alargada, una っ o una ん. */
  tipo: TipoMoraEspecial;
}

export interface ComparacionMoras {
  errores: MoraEspecialOida[];
  /** Cuántas frases se pudieron juzgar: las demás se dijeron de otra manera, o no se dijeron. */
  juzgadas: number;
}

/**
 * Delante de una fricativa, narabas no marca la っ aunque se diga bien: en いっしょ, けっして, ざっし e いっさい, con dos
 * voces, no la dio ninguna vez. Delante de p, t, k, ch o ts sí la oye. Ahí no se puede saber si falta.
 */
const FRICATIVAS = new Set(['s', 'sh', 'z', 'j', 'h', 'hy', 'f']);

/**
 * Lo que puede apartarse una frase de lo oído, por fonema esperado, para juzgar sus moras. Más, y se dijo otra cosa, o la
 * lectura esperada no es la que se usó (今 como こん en vez de いま): sus avisos serían falsos.
 */
export const DESAJUSTE_MAXIMO = 0.5;

const esVocal = (f: string) => /^[aiueo]$/.test(f);

/**
 * Qué moras especiales (っ, ん, la mitad de una vocal larga) faltan o sobran en lo que se oyó. Se emparejan los fonemas
 * esperados con los oídos por la distancia de edición: una sustitución (b por p) no importa, pero un fonema especial
 * borrado es una mora que falta, y uno insertado tras una vocal igual, o una っ o una ん de más, una que sobra.
 * `fraseDeMora` dice a qué frase acentual va cada mora: una mora de más entre dos frases es una pausa o un titubeo, no un
 * error de la palabra, y una frase que se aparta demasiado de lo oído no se juzga.
 */
export function morasEspecialesOidas(
  fonemasPorMora: string[][],
  especiales: (TipoMoraEspecial | null)[],
  oidos: string[],
  fraseDeMora: number[] = fonemasPorMora.map(() => 0)
): ComparacionMoras {
  const esperados: { f: string; mora: number }[] = fonemasPorMora.flatMap((fs, mora) => fs.map((f) => ({ f, mora })));
  const n = esperados.length;
  const m = oidos.length;
  // Cambiar una consonante por otra (b por p) o una vocal por otra es un error de oído; una vocal por una consonante, o
  // una っ o una ん por otra cosa, no: cuesta más que borrar e insertar, para que el camino no se lo invente.
  const clase = (f: string) => (esVocal(f) ? 'v' : f === 'cl' || f === 'N' ? f : 'c');
  const cambio = (a: string, b: string) => (a === b ? 0 : clase(a) === clase(b) ? 1 : 2.5);
  // Distancia de edición con el camino de vuelta.
  const d = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      d[i][j] = Math.min(d[i - 1][j - 1] + cambio(esperados[i - 1].f, oidos[j - 1]), d[i - 1][j] + 1, d[i][j - 1] + 1);
    }
  }
  const borrados = new Set<number>();
  const insertados: { tras: number; f: string }[] = [];
  // Lo que se aparta cada mora de lo oído; una inserción cuenta para la mora de delante.
  const coste = new Array<number>(fonemasPorMora.length).fill(0);
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + cambio(esperados[i - 1].f, oidos[j - 1])) {
      coste[esperados[i - 1].mora] += cambio(esperados[i - 1].f, oidos[j - 1]);
      i--;
      j--;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      borrados.add(i - 1);
      coste[esperados[i - 1].mora] += 1;
      i--;
    } else {
      insertados.push({ tras: i - 1, f: oidos[j - 1] });
      const mora = esperados[Math.max(i - 1, 0)]?.mora;
      if (mora !== undefined) coste[mora] += 1;
      j--;
    }
  }

  // Por frase: lo que se aparta, por fonema esperado.
  const frases = new Map<number, { coste: number; fonemas: number }>();
  fonemasPorMora.forEach((fs, mora) => {
    const f = frases.get(fraseDeMora[mora]) ?? { coste: 0, fonemas: 0 };
    f.coste += coste[mora];
    f.fonemas += fs.length;
    frases.set(fraseDeMora[mora], f);
  });
  const vale = (f?: { coste: number; fonemas: number }) => !!f && f.fonemas > 0 && f.coste / f.fonemas <= DESAJUSTE_MAXIMO;
  const juzgable = (mora: number) => vale(frases.get(fraseDeMora[mora]));

  const salida: MoraEspecialOida[] = [];
  const vistas = new Set<string>();
  const anotar = (mora: number, error: 'falta' | 'sobra', tipo: TipoMoraEspecial) => {
    const clave = `${mora}:${error}`;
    if (mora >= 0 && !vistas.has(clave) && juzgable(mora)) {
      vistas.add(clave);
      salida.push({ mora, error, tipo });
    }
  };
  // Una mora especial falta si se borró su fonema; en una vocal larga, también si se borró la vocal de delante, que es la misma.
  esperados.forEach((e, k) => {
    if (!borrados.has(k)) return;
    const tipo = especiales[e.mora];
    if (tipo === 'sokuon' && FRICATIVAS.has(esperados[k + 1]?.f ?? '')) return;
    if (tipo) anotar(e.mora, 'falta', tipo);
    else if (especiales[e.mora + 1] === 'larga' && k === esperados.findLastIndex((x) => x.mora === e.mora) && esperados[k + 1]?.f === e.f) anotar(e.mora + 1, 'falta', 'larga');
  });
  // Sobra una mora si se oye una っ o una ん que no estaba, o una vocal junto a la misma vocal (alargada), dentro de una
  // misma frase. Al final de una frase, eso es una pausa o un titubeo (わたしはー), no un error de la palabra.
  const mismaFrase = (a?: { mora: number }, b?: { mora: number }) => !!a && !!b && fraseDeMora[a.mora] === fraseDeMora[b.mora];
  for (const { tras, f } of insertados) {
    const anterior = esperados[tras];
    const siguiente = esperados[tras + 1];
    if (f === 'cl' || f === 'N') {
      if (mismaFrase(anterior, siguiente)) anotar(anterior.mora, 'sobra', f === 'cl' ? 'sokuon' : 'hatsuon');
      continue;
    }
    if (!esVocal(f)) continue;
    // La vocal alargada es la igual de al lado, que puede quedar a un lado u otro de la insertada; cuenta si su frase sigue.
    const k = anterior?.f === f ? tras : siguiente?.f === f ? tras + 1 : -1;
    if (k >= 0 && mismaFrase(esperados[k], esperados[k + 1])) anotar(esperados[k].mora, 'sobra', 'larga');
  }
  return { errores: salida.sort((a, b) => a.mora - b.mora), juzgadas: [...frases.values()].filter(vale).length };
}
