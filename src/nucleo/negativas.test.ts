import { describe, expect, it } from 'vitest';
import { pareceNegativa, traduccionesValidas } from './negativas';

describe('pareceNegativa', () => {
  it('reconoce a Claude diciendo que no traduce, en las lenguas de las traducciones', () => {
    for (const t of [
      'Lo siento, no puedo traducir la letra de esta canción porque está protegida por derechos de autor.',
      'Lo siento, no me es posible reproducir esta letra.',
      "I'm sorry, but I can't translate these song lyrics because they're copyrighted.",
      'I can’t help with translating the full lyrics.',
      'I am unable to translate this verse.',
      'Diesen Liedtext kann ich leider nicht übersetzen.',
      'Je ne peux pas traduire ces paroles.',
      '申し訳ありませんが、この歌詞は翻訳できません。',
      '죄송하지만 이 가사는 번역할 수 없습니다.',
      '抱歉，我无法翻译这段受版权保护的歌词。',
    ]) {
      expect(pareceNegativa(t), t).toBe(true);
    }
  });

  it('deja en paz los versos que se le parecen', () => {
    for (const t of ['Lo siento', 'No puedo dejar de pensar en ti', 'No puedo decírtelo', "I'm sorry, I can't stay", 'Todavía puedo levantarme', 'Soñé que devoraba estrellas rojas y azules', 'Ich kann dich nicht vergessen', '']) {
      expect(pareceNegativa(t), t).toBe(false);
    }
  });
});

describe('traduccionesValidas', () => {
  const originales = ['泥だらけの道でも花は咲いた', '授業の後は', '気持ちは翻訳できない', '赤い星', '明日も', 'また会おう'];

  it('quita las disculpas que Claude escribió en lugar de la traducción', () => {
    const disculpa = 'Lo siento, no puedo traducir esta letra.';
    const entradas = [
      { i: 0, t: disculpa },
      { i: 1, t: 'Después de clase' },
      { i: 3, t: disculpa },
      { i: 4, t: 'Mañana también' },
    ];
    expect(traduccionesValidas(entradas, originales, 0, 6)).toEqual([
      { i: 1, t: 'Después de clase' },
      { i: 4, t: 'Mañana también' },
    ]);
  });

  it('respeta la frase si el original ya habla de traducir', () => {
    expect(traduccionesValidas([{ i: 2, t: 'No puedo traducir lo que siento' }], originales, 0, 6)).toEqual([{ i: 2, t: 'No puedo traducir lo que siento' }]);
  });

  it('solo acepta los números del tramo pedido, una vez cada uno y con texto', () => {
    const entradas = [
      { i: 1, t: 'fuera del tramo' },
      { i: 2, t: '  Primera  ' },
      { i: 2, t: 'Repetida' },
      { i: 3, t: '   ' },
      { i: 4.5, t: 'No es un número de línea' },
      { i: 6, t: 'Más allá del final' },
      { i: 5, t: 'Última' },
    ];
    expect(traduccionesValidas(entradas, originales, 2, 6)).toEqual([
      { i: 2, t: 'Primera' },
      { i: 5, t: 'Última' },
    ]);
  });
});
