// El diccionario de Kuromoji recortado (herramientas/kuromoji.mjs) tiene que analizar igual que el original: mismas
// palabras, categorías y lecturas, también con lo que no está en el diccionario (números, letras latinas, katakana
// nuevo, signos), que sale de los archivos unk.*.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { gunzipSync } from 'node:zlib';
import { beforeAll, describe, expect, it } from 'vitest';
import { archivoDiccionario } from '../../../herramientas/kuromoji.mjs';

const require = createRequire(import.meta.url);
const DictionaryLoader = require('kuromoji/src/loader/DictionaryLoader');
const Tokenizer = require('kuromoji/src/Tokenizer');
const DIC = 'node_modules/kuromoji/dict';

interface Token {
  surface_form: string;
  pos: string;
  pos_detail_1: string;
  reading?: string;
  basic_form: string;
  word_type: string;
}
interface Tokenizador {
  tokenize(texto: string): Token[];
}
interface Diccionario {
  unknown_dictionary: { character_definition: { invoke_definition_map: { map: unknown[] } } };
}

function cargar(recortado: boolean): Promise<{ t: Tokenizador; dic: Diccionario }> {
  const cargador = Object.create(DictionaryLoader.prototype);
  DictionaryLoader.apply(cargador, [DIC]);
  cargador.loadArrayBuffer = (archivo: string, cb: (e: unknown, b?: ArrayBuffer) => void) => {
    const nombre = archivo.split(/[\\/]/).pop() ?? '';
    const gz = readFileSync(archivo);
    const datos = gunzipSync(recortado ? archivoDiccionario(nombre, gz) : gz);
    cb(null, datos.buffer.slice(datos.byteOffset, datos.byteOffset + datos.byteLength));
  };
  return new Promise((ok, mal) => cargador.load((e: unknown, dic: Diccionario) => (e ? mal(e) : ok({ t: new Tokenizer(dic), dic }))));
}

const TEXTO = [
  '吾輩は猫である。名前はまだ無い。どこで生れたかとんと見当がつかぬ。',
  '環内にある炭素原子において、時計まわりと反時計まわりの構造が異なれば、異なる原子団とみなす。',
  'スマートフォンのアプリでＡＢＣとabc、１２３と123、3.14と½を入力した。',
  'ググってみたらエモいツイートがバズってた件ｗｗ　（笑）',
  '東京都千代田区丸の内1-9-1、〒100-0005。2026年11月14日（土）午前9時30分。',
  'Ωとαβγ、ПРИВЕТ、한국어、中文简体、😀👍、★☆♪→←↑↓',
  '彼女は「もう二度と来ない」と言いながら、ドアをバタンと閉めた。',
  'ﾊﾝｶｸｶﾀｶﾅとゐゑヰヱ、ヴァイオリンとヴィヴァルディ。',
].join('\n');

let original: { t: Tokenizador; dic: Diccionario };
let recortado: { t: Tokenizador; dic: Diccionario };

beforeAll(async () => {
  [original, recortado] = await Promise.all([cargar(false), cargar(true)]);
}, 60000);

describe('el diccionario de Kuromoji recortado', () => {
  it('analiza igual que el original', () => {
    const resumen = (t: Tokenizador) => t.tokenize(TEXTO).map((x) => [x.surface_form, x.pos, x.pos_detail_1, x.reading, x.basic_form, x.word_type].join('/'));
    expect(resumen(recortado.t)).toEqual(resumen(original.t));
  });

  it('no crea las clases de caracteres vacías del relleno', () => {
    expect(original.dic.unknown_dictionary.character_definition.invoke_definition_map.map.length).toBeGreaterThan(100000);
    expect(recortado.dic.unknown_dictionary.character_definition.invoke_definition_map.map.length).toBeLessThan(20);
  });
});
