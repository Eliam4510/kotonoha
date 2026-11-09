import { describe, expect, it } from 'vitest';
import { detectarGramatica } from './gramatica';

const patrones = (t: string) => detectarGramatica(t).map((p) => p.patron);

describe('detección de gramática sin IA', () => {
  it.each([
    ['ペースが遅れてしまうので', '〜てしまう'],
    ['できるだけ毎日やるようにしています', '〜ようにする'],
    ['12月にJLPTがあるので', '〜ので'],
    ['全部終わらせたいです', '〜たい'],
    ['お金が欲しいわけではない', '〜わけではない'],
    ['もう行かなければなりません', '〜なければならない'],
    ['彼はもう来ているはずだ', '〜はずだ'],
    ['日本に行ったことがあります', '〜たことがある'],
    ['本を読みながら歩く', '〜ながら'],
    ['行くかもしれない', '〜かもしれない'],
    ['食べたばかりです', '〜たばかり'],
    ['やらざるを得ない', '〜ざるを得ない'],
    ['泣かずにはいられない', '〜ずにはいられない'],
    ['見たとたんに笑った', '〜たとたん'],
  ])('%s contiene %s', (texto, patron) => {
    expect(patrones(texto)).toContain(patron);
  });

  it('〜ておく con su お, y no できます ni 〜てくる', () => {
    expect(patrones('準備しておきます')).toContain('〜ておく');
    expect(patrones('買っておいた')).toContain('〜ておく');
    expect(patrones('言っとく')).toContain('〜ておく');
    expect(patrones('私はまだ立ち上がることができます')).not.toContain('〜ておく');
    expect(patrones('お土産を持ってきます')).not.toContain('〜ておく');
  });

  it('«hay que» no es «no se debe»: なくては y なくちゃ son 〜なければならない', () => {
    for (const f of ['勉強しなくてはならない', '行かなくちゃいけない', '気をつけなくっちゃいけません']) {
      expect(patrones(f)).toContain('〜なければならない');
      expect(patrones(f)).not.toContain('〜てはいけない');
    }
    expect(patrones('ここで写真を撮ってはいけません')).toContain('〜てはいけない');
  });

  it('palabras que se parecen a un patrón y no lo son', () => {
    // La interjección なるほど no es 〜ほど; sí lo es cuando sigue a un adjetivo o a に.
    expect(patrones('なるほど、そういうことか')).not.toContain('〜ほど');
    expect(patrones('「なるほど」と言った')).not.toContain('〜ほど');
    expect(patrones('暑くなるほど、水を飲む')).toContain('〜ほど');
    // 過ぎる de «pasar» no es 〜すぎる; el de «demasiado», sí.
    expect(patrones('三時を三十分過ぎた')).not.toContain('〜すぎる');
    expect(patrones('昼過ぎに会おう')).not.toContain('〜すぎる');
    expect(patrones('食べすぎた')).toContain('〜すぎる');
    expect(patrones('この服は高すぎる')).toContain('〜すぎる');
    // El adjetivo うまい no es 〜まい; tras un verbo, sí.
    expect(patrones('このラーメンはうまい。')).not.toContain('〜まい');
    expect(patrones('二度と言うまい。')).toContain('〜まい');
    expect(patrones('もう会うまいと決めた')).toContain('〜まい');
    // ようになる y ようにする son lo suyo, no 〜ようだ.
    expect(patrones('話せるようになった')).not.toContain('〜ようだ');
    expect(patrones('忘れないようにして')).not.toContain('〜ようだ');
    expect(patrones('雨が降るようだ')).toContain('〜ようだ');
  });

  it('no marca formas parecidas que no son gramática', () => {
    expect(patrones('出る')).not.toContain('〜ている');
    expect(patrones('私は学生です')).toEqual([]);
    expect(patrones('赤と青の星')).toEqual([]);
  });

  it('prefiere la forma más específica', () => {
    const p = patrones('お金が欲しいわけではない');
    expect(p).toContain('〜わけではない');
    expect(p).not.toContain('〜わけだ');
  });

  it('devuelve el fragmento, el significado y el nivel', () => {
    const [g] = detectarGramatica('やらざるを得ない');
    expect(g).toMatchObject({ fragmento: 'ざるを得', nivel: 'N2', fuente: 'regla' });
    expect(g.significado.length).toBeGreaterThan(5);
  });
});
