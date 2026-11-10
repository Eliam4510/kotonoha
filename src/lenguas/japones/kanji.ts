// El diccionario de kanji. Junta los datos de Kanjium (Uros O., CC BY-SA 4.0), que amplían KANJIDIC y KRADFILE del
// EDRDG con las lecturas oficiales, de qué época viene cada on'yomi, la parte que da el sonido, las formas antiguas, los
// opuestos, los parecidos y los que se leen igual, con los significados en español de KANJIDIC (EDRDG, CC BY-SA 4.0).

import type { FichaCaracter, LecturaCaracter, LecturasCaracter } from '../../compartido/tipos';
import type { CaracterImportado } from '../../nucleo/yomitan';
import type { ArchivoDiccionario } from '../tipos';

const KANJIUM = 'https://raw.githubusercontent.com/mifunetoshiro/kanjium/master/data/source_files/';

const TABLAS_KANJIUM = ['kanjidict', 'variants', 'elements', 'radicals', 'radicals_variants', 'phonetics', 'antonyms', 'synonyms', 'lookalikes', 'homonyms', 'pinyin', 'hangul'];

/** Lo que se baja: las tablas de Kanjium, en texto, y KANJIDIC en español, en formato Yomitan. */
export const ARCHIVOS_KANJI: ArchivoDiccionario[] = [
  ...TABLAS_KANJIUM.map((nombre) => ({ nombre, url: `${KANJIUM}${nombre}.txt` })),
  { nombre: 'kanjidic-es', url: 'https://github.com/yomidevs/jmdict-yomitan/releases/latest/download/KANJIDIC_spanish.zip', zip: true },
];

const BOM = String.fromCharCode(0xfeff);

/** Las filas de una tabla de Kanjium: una por línea, con los campos separados por tabuladores y sin cabecera. */
export function tablaKanjium(texto: string | undefined): string[][] {
  if (!texto) return [];
  const limpio = texto.startsWith(BOM) ? texto.slice(1) : texto;
  return limpio
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => l.split('\t'));
}

const partir = (s: string | undefined, separador = '、') => (s ? s.split(separador).map((x) => x.trim()).filter(Boolean) : []);

/** Un solo carácter que se pueda enseñar: los de uso privado solo se ven con una letra propia de Kanjium. */
function caracterValido(c: string | undefined): c is string {
  if (!c || [...c].length !== 1 || !/\p{Script=Han}/u.test(c)) return false;
  const n = c.codePointAt(0)!;
  return n < 0xe000 || n > 0xf8ff;
}

const caracteres = (s: string | undefined, separador = ',') => [...new Set(partir(s, separador).filter(caracterValido))];

/** い（きる） → い.きる, como en KANJIDIC: lo que va tras el punto es el okurigana. */
const conPunto = (s: string) => s.replace(/（/g, '.').replace(/）/g, '');

/** ニチ(呉) o ギョウ*: la lectura, de qué época viene y si es oficial pero poco usada. */
function leerLectura(s: string, kun: boolean): LecturaCaracter {
  const m = /^(.+?)(?:\((.)\))?(\*)?$/.exec(s.trim());
  const texto = m ? m[1] : s.trim();
  return {
    texto: kun ? conPunto(texto) : texto,
    ...(m?.[2] ? { origen: m[2] } : {}),
    ...(m?.[3] ? { poco: true } : {}),
  };
}

/** Las lecturas de la lista oficial, en su orden, y las demás que se conocen, con su origen si lo traen. */
function lecturas(oficiales: string | undefined, todas: string | undefined, kun: boolean): LecturasCaracter {
  const conocidas = partir(todas).map((s) => leerLectura(s, kun));
  const deLista = partir(oficiales).map((s) => leerLectura(s, kun));
  // おこな.う y おこ.なう son la misma lectura con el okurigana partido de otra forma: no se repite.
  const entera = (t: string) => t.replace('.', '');
  const origen = (t: string) => conocidas.find((x) => entera(x.texto) === entera(t))?.origen;
  return {
    oficiales: deLista.map((x) => ({ ...x, ...(x.origen || !origen(x.texto) ? {} : { origen: origen(x.texto) }) })),
    otras: conocidas.filter((x, i) => !deLista.some((o) => entera(o.texto) === entera(x.texto)) && conocidas.findIndex((y) => entera(y.texto) === entera(x.texto)) === i),
  };
}

/** Kyōiku-Jōyō (4th grade of primary school) → kyoiku-4. */
export function listaDe(grado: string | undefined): string | undefined {
  if (!grado) return undefined;
  const primaria = /^Kyōiku-Jōyō \((\d)/.exec(grado);
  if (primaria) return `kyoiku-${primaria[1]}`;
  if (grado.startsWith('Jōyō')) return 'joyo';
  if (grado.startsWith('Jinmeiyō (traditional variant')) return 'jinmeiyo-antigua';
  if (grado.startsWith('Jinmeiyō')) return 'jinmeiyo';
  if (grado.startsWith('Kyūjitai')) return 'hyogai-antigua';
  if (grado.startsWith('Hyōgaiji')) return 'hyogai';
  return undefined;
}

const FORMACIONES: Record<string, string> = {
  Pictograph: 'pictograma',
  Ideograph: 'indicativo',
  'Compound ideograph': 'compuesto',
  'Phono-semantic compound': 'fonosemantico',
};

const TIPOS_FONETICO: Record<string, 'siempre' | 'casi' | 'varias'> = {
  'Absolute phonetic': 'siempre',
  'Single-reading phonetic': 'casi',
  'Mixed-reading phonetic': 'varias',
};

/** Las marcas que Kanjium añade al final de los significados: no son significados. */
const MARCAS = /^\((kokuji|extended shinjitai|ghost character|no known meaning)\)$/;

const significadosEn = (s: string | undefined) => partir(s, ';').filter((x) => !MARCAS.test(x));

const entero = (s: string | undefined) => {
  const n = parseInt(s ?? '', 10);
  return Number.isFinite(n) ? n : undefined;
};

/** Una tabla de dos columnas, un carácter y una lista: los opuestos, los sinónimos, los parecidos. */
const listaPorCaracter = (texto: string | undefined) => new Map(tablaKanjium(texto).map((f) => [f[0], caracteres(f[1])]));

/** Junta lo bajado en una ficha por kanji. `bancos` son los diccionarios de kanji en formato Yomitan, por nombre. */
export function leerDiccionarioKanji(textos: Record<string, string>, bancos: Record<string, CaracterImportado[]>): FichaCaracter[] {
  const variantes = new Map(tablaKanjium(textos.variants).map((f) => [f[0], f]));
  const elementos = new Map(tablaKanjium(textos.elements).map((f) => [f[0], f]));
  const opuestos = listaPorCaracter(textos.antonyms);
  const sinonimos = listaPorCaracter(textos.synonyms);
  const parecidos = listaPorCaracter(textos.lookalikes);
  const pinyin = new Map(tablaKanjium(textos.pinyin).map((f) => [f[0], f[1]]));
  const hangul = new Map(tablaKanjium(textos.hangul).map((f) => [f[0], f[1]]));
  const espanol = new Map((bancos['kanjidic-es'] ?? []).map((k) => [k.caracter, k.significados]));

  // Los 214 radicales, con sus nombres y su significado, y las formas que toman como pieza (氵 de 水).
  const radicales = new Map(tablaKanjium(textos.radicals).map((f) => [f[0], { numero: entero(f[2]) ?? 0, nombres: partir(f[4], '・'), significado: f[5] ?? '' }]));
  const nombresDeForma = new Map<string, string[]>();
  const formasDe = new Map<string, string[]>();
  const anotarForma = (radical: string, forma: string | undefined) => {
    if (!forma || forma === radical) return;
    const xs = formasDe.get(radical) ?? [];
    if (!xs.includes(forma)) formasDe.set(radical, [...xs, forma]);
  };
  for (const f of tablaKanjium(textos.radicals)) for (const forma of partir(f[1], ',')) anotarForma(f[0], forma);
  for (const f of tablaKanjium(textos.radicals_variants)) {
    anotarForma(f[1], f[0]);
    nombresDeForma.set(f[0], partir(f[4], '・'));
  }

  const foneticos = new Map(tablaKanjium(textos.phonetics).map((f) => [f[0], { lecturas: partir(f[1]), tipo: TIPOS_FONETICO[f[3]] ?? 'varias' }]));

  const homonimos = new Map<string, FichaCaracter['homonimos']>();
  for (const f of tablaKanjium(textos.homonyms)) {
    const xs = caracteres(f[3]);
    if (!f[1] || !f[2] || !xs.length) continue;
    homonimos.set(f[1], [...(homonimos.get(f[1]) ?? []), { lectura: f[2], caracteres: xs, mismoAcento: f[4] === 'Same pitch accents' }]);
  }

  const fichas: FichaCaracter[] = [];
  for (const f of tablaKanjium(textos.kanjidict)) {
    const [caracter, radical, formaRadical, fonetico, , formacion, onOficiales, kunOficiales, on, kun, nanori, trazos, grado, jlpt, kanken, frecuencia, significado] = f;
    if (!caracterValido(caracter)) continue;
    const v = variantes.get(caracter) ?? [];
    const antiguas = caracteres(v[7]);
    const nuevas = caracteres(v[6]);
    const chino = (s: string | undefined) => {
      const c = s?.replace(/\(C\)$/, '');
      return caracterValido(c) && c !== caracter ? c : undefined;
    };
    const r = radical ? radicales.get(radical) : undefined;
    const significados: Record<string, string[]> = { en: significadosEn(significado) };
    const es = espanol.get(caracter);
    if (es?.length) significados.es = es;
    const enOtrasLenguas: Record<string, string> = {};
    if (pinyin.get(caracter)) enOtrasLenguas.zh = pinyin.get(caracter)!;
    if (hangul.get(caracter)) enOtrasLenguas.ko = hangul.get(caracter)!;
    const tradicional = chino(v[2]);
    const simplificada = chino(v[3]);
    const nivel = /^N\d/.exec(jlpt ?? '')?.[0];
    const forma = formaRadical && formaRadical !== radical ? formaRadical : undefined;

    fichas.push({
      caracter,
      significados,
      on: lecturas(onOficiales, on, false),
      kun: lecturas(kunOficiales, kun, true),
      nombres: partir(nanori),
      ...(entero(trazos) ? { trazos: entero(trazos) } : {}),
      ...(listaDe(grado) ? { lista: listaDe(grado) } : {}),
      ...(nivel ? { nivel } : {}),
      ...(kanken ? { kanken } : {}),
      ...(entero(frecuencia) ? { frecuencia: entero(frecuencia) } : {}),
      ...(FORMACIONES[formacion ?? ''] ? { formacion: FORMACIONES[formacion] } : {}),
      // Los nombres del radical dependen de la forma: 心 se llama こころ, pero 忄 es りっしんべん. Sin otra forma, vale el
      // primero, que es el del radical tal cual.
      ...(r && radical
        ? { radical: { caracter: radical, ...(forma ? { forma } : {}), numero: r.numero, nombres: (forma && nombresDeForma.get(forma)) || r.nombres.slice(0, 1), significado: r.significado } }
        : {}),
      ...(caracterValido(fonetico) ? { fonetico } : {}),
      ...(foneticos.get(caracter) ? { daSonido: foneticos.get(caracter) } : {}),
      variantes: {
        antiguas,
        nuevas,
        otras: caracteres(v[1]).filter((x) => x !== caracter && !antiguas.includes(x) && !nuevas.includes(x)),
        ...(tradicional ? { tradicional } : {}),
        ...(simplificada ? { simplificada } : {}),
      },
      piezas: caracteres(elementos.get(caracter)?.[6]).filter((x) => x !== caracter),
      formasComoPieza: radicales.has(caracter) ? (formasDe.get(caracter) ?? []) : [],
      opuestos: opuestos.get(caracter) ?? [],
      sinonimos: sinonimos.get(caracter) ?? [],
      parecidos: parecidos.get(caracter) ?? [],
      homonimos: homonimos.get(caracter) ?? [],
      enOtrasLenguas,
    });
  }
  return fichas;
}
