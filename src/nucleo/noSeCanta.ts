// Lo que trae una letra pegada y no se canta: las marcas de sección ([サビ], (Chorus)) y los créditos (作詞：…, Music by…).
// Desde que la letra se coloca sin Claude, un renglón así se convertía en un verso más con un tiempo inventado.

/** Un renglón entero entre corchetes: una marca de sección, un nombre o una acotación. */
const ENTRE_CORCHETES = /^[[【〔［〈《<＜{｛][^\]】〕］〉》>＞}｝]*[\]】〕］〉》>＞}｝]$/u;

/** Las secciones de una canción, que entre paréntesis también son marcas: «(Chorus)», «（間奏）», «(x2)». */
const SECCION = new RegExp(
  '^[(（]\\s*(?:' +
    [
      String.raw`(?:pre-?)?chorus|verse|bridge|hook|intro|outro|refrain|interlude|instrumental|solo|guitar solo|coda|repeat|strophe|refrain|zwischenspiel`,
      String.raw`サビ|大サビ|間奏|前奏|後奏|繰り返し|くり返し|リピート|[ABCＡＢＣ]メロ|[0-9０-９]+番|副歌|间奏|前奏|重复|후렴|간주|반복`,
      String.raw`[x×]\s*[0-9]+`,
    ].join('|') +
    ')(?:\\s*[0-9]+)?\\s*[)）]$',
  'iu'
);

/** Los créditos: quién la escribió, compuso, arregló o canta. Con dos puntos detrás, o «by» en inglés. */
const CREDITO = new RegExp(
  '^(?:' +
    [
      String.raw`作詞(?:・?作曲)?|作曲|編曲|作編曲|訳詞|歌唱|歌|唄|原曲|ボーカル`,
      String.raw`作词|编曲|演唱|原唱|填词|词|曲`,
      String.raw`작사|작곡|편곡|노래`,
      String.raw`lyrics?|words|music|compos(?:er|ed)|arrange(?:d|ment|r)?|vocals?|written|songwriters?|produc(?:ed|er)|text|musik|komponist|gesang`,
    ].join('|') +
    String.raw`)(?:\s+by\s+\S|\s*[:：／/]\s*\S)`,
  'iu'
);

/** Una repetición al final de un verso, «×2» o «(x3)»: el verso se canta esas veces. */
const REPETICION = /\s+[(（]?[x×]\s*([0-9]+)[)）]?$/iu;
/** Una marca de sección delante de un verso: «[Chorus] Camino por el río». */
const MARCA_DELANTE = /^[[【〔［][^\]】〕］]{1,24}[\]】〕］]\s*(?=\S)/u;
/** Más que esto no es una repetición de un verso: es otra cosa. */
const REPETICIONES_MAXIMAS = 4;

/**
 * Una lectura entre paréntesis detrás de unos kanji, como 人間(ひと) o 危険(リスク): se canta lo de dentro. Se construye
 * con los nombres de las escrituras; la raya larga del katakana (U+30FC) es común a las dos y va aparte.
 */
const LECTURA = new RegExp(`[\\p{Script=Han}]+[(（]([\\p{Script=Hiragana}\\p{Script=Katakana}${String.fromCharCode(0x30fc)}]+)[)）]`, 'gu');

/** Lo que se canta de un verso, para oírlo: con la lectura de los kanji que la llevan entre paréntesis. */
export function textoCantado(verso: string): string {
  return verso.replace(LECTURA, '$1');
}

/** Si un renglón de una letra no se canta: una marca de sección o un crédito. */
export function noSeCanta(renglon: string): boolean {
  const r = renglon.trim();
  return ENTRE_CORCHETES.test(r) || SECCION.test(r) || CREDITO.test(r);
}

/** Lo que se canta de un renglón: sin la marca de sección que lleve delante, y tantas veces como diga su «×2». */
export function versosDelRenglon(renglon: string): string[] {
  const sinMarca = renglon.replace(MARCA_DELANTE, '').trim();
  const repetido = REPETICION.exec(sinMarca);
  if (!repetido) return [sinMarca];
  const verso = sinMarca.slice(0, repetido.index).trim();
  const veces = Number(repetido[1]);
  return veces >= 1 && veces <= REPETICIONES_MAXIMAS ? Array<string>(veces).fill(verso) : [verso];
}
