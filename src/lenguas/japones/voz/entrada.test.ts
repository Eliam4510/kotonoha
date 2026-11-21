import { beforeAll, describe, expect, it } from 'vitest';
import { diccionarioYomi } from '../../../../herramientas/yomi-diccionario.mjs';
import { tensoresSbv2 } from '../../../nucleo/sbv2';
import type { OracionVoz } from '../../tipos';
import { normalizarComoAivis, partirParaBert, repartir, tonosDeFrase } from './entrada';
import { VOZ_INTEGRADA as voz } from './index';
import { enlacesDeMas, REGLAS_ENLACE } from './reglas';
import type { NjdNode } from './yomi/njd/types';

beforeAll(async () => {
  voz.cargar(await diccionarioYomi(voz.diccionario));
}, 120000);

/** Las frases de unas oraciones con sus tonos: «デン¯シャ¯ガ¯ | オク¯…», lo agudo marcado. */
const dibujo = (os: OracionVoz[]) =>
  os
    .flatMap((o) => o.frases)
    .map((f) => {
      const t = tonosDeFrase(f.moras.length, f.nucleo);
      return f.moras.map((m, i) => (t[i] ? `${m}¯` : m)).join('');
    })
    .join(' | ');

describe('el texto, como lo normaliza AivisSpeech', () => {
  it('los signos pasan a los que conoce la voz', () => {
    expect(normalizarComoAivis('「こんにちは」…！')).toBe("'こんにちは'...!");
    expect(normalizarComoAivis('はい、そう。でも：ね・あ')).toBe('はい,そう.でも,ね,あ');
  });

  it('la tilde es raya larga, el espacio ancho es pausa, y lo que no se lee se va', () => {
    expect(normalizarComoAivis('あ〜　い～')).toBe('あー.いー');
    expect(normalizarComoAivis('★わあ♪ ok')).toBe('わあok');
    expect(normalizarComoAivis('ｶﾀｶﾅ１２')).toBe('カタカナ12');
  });
});

describe('los trozos que caben en el BERT', () => {
  it('lo corto se queda entero; lo largo se parte tras el punto, luego tras la coma, luego a la fuerza', () => {
    expect(partirParaBert('あいう.', 10)).toEqual(['あいう.']);
    // Se junta todo lo que cabe: dos oraciones de 5 caben en 10.
    expect(partirParaBert('あいうえ.かきくけ.さしす.', 10)).toEqual(['あいうえ.かきくけ.', 'さしす.']);
    expect(partirParaBert('あいうえ.かきくけ.さしす.', 6)).toEqual(['あいうえ.', 'かきくけ.', 'さしす.']);
    expect(partirParaBert('あいうえお,かきくけこ', 8)).toEqual(['あいうえお,', 'かきくけこ']);
    expect(partirParaBert('あいうえおかきくけこ', 4)).toEqual(['あいうえ', 'おかきく', 'けこ']);
  });
});

describe('tonos y reparto, como g2p.py', () => {
  it('el tono de cada mora según el núcleo', () => {
    expect(tonosDeFrase(1, 1)).toEqual([0]);
    expect(tonosDeFrase(3, 0)).toEqual([0, 1, 1]);
    expect(tonosDeFrase(3, 1)).toEqual([1, 0, 0]);
    expect(tonosDeFrase(4, 2)).toEqual([0, 1, 0, 0]);
    expect(tonosDeFrase(3, 3)).toEqual([0, 1, 1]);
  });

  it('los fonemas de una palabra, por igual entre sus caracteres, los primeros antes', () => {
    expect(repartir(9, 5)).toEqual([2, 2, 2, 2, 1]);
    expect(repartir(1, 3)).toEqual([1, 0, 0]);
  });
});

describe('las reglas de enlace de pyopenjtalk-plus', () => {
  const nodo = (surface: string, pos: string[]) => ({ surface, pos, chainFlag: undefined }) as unknown as NjdNode;

  it('enlazan el auxiliar tras て, する tras sustantivo y el sustantivo formal tras verbo', () => {
    expect(REGLAS_ENLACE.verboDependienteTrasTe(nodo('て', ['助詞', '接続助詞', '*', '*', '*', '*']), nodo('いる', ['動詞', '非自立', '*', '*', '一段', '基本形']))).toBe(true);
    expect(REGLAS_ENLACE.suruTrasSahen(nodo('勉強', ['名詞', 'サ変接続', '*', '*', '*', '*']), nodo('する', ['動詞', '自立', '*', '*', 'サ変・スル', '基本形']))).toBe(true);
    expect(REGLAS_ENLACE.formalTrasVerbo(nodo('する', ['動詞', '自立', '*', '*', 'サ変・スル', '基本形']), nodo('の', ['名詞', '非自立', '一般', '*', '*', '*']))).toBe(true);
    expect(REGLAS_ENLACE.formalTrasVerbo(nodo('猫', ['名詞', '一般', '*', '*', '*', '*']), nodo('の', ['名詞', '非自立', '一般', '*', '*', '*']))).toBe(false);
  });

  it('solo marcan; lo demás lo decide yomi después', () => {
    const nodos = [nodo('て', ['助詞', '接続助詞', '*', '*', '*', '*']), nodo('いる', ['動詞', '非自立', '*', '*', '一段', '基本形']), nodo('猫', ['名詞', '一般', '*', '*', '*', '*'])];
    enlacesDeMas(nodos);
    expect(nodos.map((n) => n.chainFlag)).toEqual([undefined, true, undefined]);
  });
});

describe('la entrada de la voz, con el diccionario de yomi', () => {
  it('こんにちは。 da lo mismo que g2p.py', () => {
    const [o, ...resto] = voz.analizar('こんにちは。');
    expect(resto).toHaveLength(0);
    expect(voz.entrada(o)).toEqual({
      fonemas: ['_', 'k', 'o', 'N', 'n', 'i', 'ch', 'i', 'w', 'a', '.', '_'],
      tonos: [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0],
      textoBert: 'こんにちは.',
      word2ph: [1, 2, 2, 2, 2, 1, 1, 1],
    });
  });

  it('encadena los auxiliares y する como AivisSpeech', () => {
    const os = voz.analizar('電車が遅れているので、少し遅刻します。');
    expect(dibujo(os)).toBe('デン¯シャ¯ガ¯ | オク¯レ¯テ¯イ¯ル¯ノデ | スコ¯シ | チコ¯ク¯シ¯マ¯ス');
    expect(voz.entrada(os[0]).textoBert).toBe('電車が遅れているので,少し遅刻します.');
  });

  it('los núcleos dados mandan sobre los suyos', () => {
    const [o] = voz.analizar('雨が降る。');
    const propios = voz.entrada(o).tonos;
    const otros = voz.entrada(o, o.frases.map(() => 0)).tonos;
    expect(otros).not.toEqual(propios);
  });

  it('cada línea es una oración, con su pausa delante', () => {
    const os = voz.analizar('おはよう。\nこんにちは。');
    expect(os.map((o) => o.pausaAntesS)).toEqual([0, 0.5]);
  });

  it('todo lo que sale cuadra para la voz, también con números, letras y signos raros', () => {
    for (const texto of ['3時に会おう！', 'ABCの歌…？', '「本当？」って聞いた。', '😀　えっと、その〜', '東京タワー（333m）へ行く']) {
      for (const o of voz.analizar(texto)) {
        const e = voz.entrada(o);
        expect(() => tensoresSbv2(e), texto).not.toThrow();
        expect(e.textoBert, texto).not.toMatch(/[！-～]/);
      }
    }
  });
});
