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
