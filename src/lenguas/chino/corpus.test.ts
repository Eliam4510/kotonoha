// Cómo parte y lee el chino el analizador, frente a jieba y pypinyin, con el corpus de herramientas/corpus-pinyin.py:
// 80 frases de hoy y 120 de 《故乡》, de Lu Xun. La referencia no es perfecta (lee 弹钢琴 como dàn y 这只猫 como zhǐ, y
// no pone el tono neutro de CC-CEDICT, 时候 shíhou), así que lo que se mide es el acuerdo: no puede bajar de lo medido;
// si una regla nueva lo mejora, se sube el suelo.

import { beforeAll, describe, expect, it } from 'vitest';
import { datosChino } from '../../../herramientas/chino-datos.mjs';
import corpus from './corpus-pinyin.json';
import { ANALIZADOR } from './analizador';
// Lo que en la extensión trae chino.js: pinyin-pro y las tablas de OpenCC.
import './bibliotecas';
import type { ConsultasAnalisis } from '../tipos';

/** Lo medido el 2026-11-21, con las reglas de 长得, 得, 只, 倒 y 穿着. */
const SUELO = { bordes: 0.912, silabas: 0.955 };

let existe: (t: string) => boolean;
let consultas: ConsultasAnalisis;

beforeAll(async () => {
  const { lecturas, rangos } = await datosChino();
  existe = (t) => lecturas.has(t);
  consultas = { rango: (t) => rangos.get(t), lecturas: (t) => lecturas.get(t) };
}, 120000);

const bordes = (palabras: string[]) => {
  const s = new Set<number>();
  let p = 0;
  for (const w of palabras) s.add((p += [...w].length));
  return s;
};

describe('partir y leer el chino, frente a jieba y pypinyin', () => {
  it(`parte igual al menos el ${SUELO.bordes * 100} % de los bordes de palabra y lee igual el ${SUELO.silabas * 100} % de las sílabas`, () => {
    let bordesIguales = 0;
    let bordesTotales = 0;
    let silabasIguales = 0;
    let silabasTotales = 0;
    for (const f of corpus.frases) {
      const tokens = ANALIZADOR.analizar(f.texto, existe, consultas);
      expect(tokens.map((t) => t.superficie).join('')).toBe(f.texto);
      const a = bordes(tokens.map((t) => t.superficie));
      const b = bordes(f.palabras);
      for (const x of a) if (b.has(x)) bordesIguales++;
      bordesTotales += Math.max(a.size, b.size);
      // La sílaba de cada ideograma, según el análisis.
      const silabas: string[] = [];
      for (const t of tokens) for (const s of t.furigana) for (const c of s.texto) silabas.push(s.lectura && [...s.texto].length === 1 ? s.lectura.toLowerCase() : c);
      [...f.texto].forEach((c, i) => {
        if (!/\p{Script=Han}/u.test(c)) return;
        silabasTotales++;
        if (silabas[i] === f.pinyin[i].toLowerCase()) silabasIguales++;
      });
    }
    const medido = { bordes: bordesIguales / bordesTotales, silabas: silabasIguales / silabasTotales };
    console.info(`Chino frente a jieba y pypinyin: ${(medido.bordes * 100).toFixed(1)} % de los bordes, ${(medido.silabas * 100).toFixed(1)} % de las sílabas`);
    expect(medido.bordes).toBeGreaterThanOrEqual(SUELO.bordes);
    expect(medido.silabas).toBeGreaterThanOrEqual(SUELO.silabas);
  });

  it('lee bien los casos que se arreglaron con reglas', () => {
    const lee = (texto: string) => ANALIZADOR.analizar(texto, existe, consultas).filter((t) => t.esPalabra).map((t) => `${t.superficie}:${t.lectura}`);
    // CC-CEDICT trae 长得 como palabra; sin ella, la regla lo lee igual: zhǎng y de.
    expect(lee('他长得很高。')).toContain('长得:zhǎngde');
    expect(lee('我只记得他很高兴。')).toContain('只:zhǐ');
    expect(lee('这只小猫很可爱。')).toContain('只:zhī');
    expect(lee('她穿着一件红色的大衣。')).toEqual(expect.arrayContaining(['穿:chuān', '着:zhe']));
    expect(lee('银行')).toEqual(['银行:yínháng']);
    expect(lee('这个意思')).toContain('意思:yìsi');
  });
});
