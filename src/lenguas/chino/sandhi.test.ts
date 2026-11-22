import { describe, expect, it } from 'vitest';
import { repartirPinyin } from './pinyin';
import { comoSuenaChino, esSilaba, frasesHabladas, type PalabraHablada, silabasParaPracticar } from './sandhi';

/** Una palabra con su lectura de diccionario, repartida sobre sus caracteres como la da el analizador. */
const p = (superficie: string, lectura: string): PalabraHablada => ({ superficie, esPalabra: true, furigana: repartirPinyin(superficie, lectura) });
/** Un signo, que no es palabra. */
const signo = (superficie: string): PalabraHablada => ({ superficie, esPalabra: false, furigana: [{ texto: superficie }] });

/** Cómo suena cada sílaba, separadas por espacios; lo demás tal cual. */
const suena = (...palabras: PalabraHablada[]) =>
  frasesHabladas(palabras)
    .map((t) => (esSilaba(t) ? t.suena : t.texto))
    .join(' ');

describe('dos terceros tonos', () => {
  it('el primero de dos pasa al segundo, dentro de una palabra y entre dos', () => {
    expect(suena(p('你好', 'nǐhǎo'))).toBe('ní hǎo');
    expect(suena(p('很', 'hěn'), p('好', 'hǎo'))).toBe('hén hǎo');
    expect(suena(p('可以', 'kěyǐ'), p('买', 'mǎi'))).toBe('ké yí mǎi');
  });

  it('en una palabra de tres terceros cambian los dos primeros', () => {
    expect(suena(p('展览馆', 'zhǎnlǎnguǎn'))).toBe('zhán lán guǎn');
  });

  it('entre palabras se va de la última a la primera, y lo que cambiaría deprisa también vale', () => {
    const t = frasesHabladas([p('我', 'wǒ'), p('很', 'hěn'), p('好', 'hǎo')]).filter(esSilaba);
    expect(t.map((s) => s.suena)).toEqual(['wǒ', 'hén', 'hǎo']);
    expect(t[0].tambien).toBe(2);
    expect(t[1].fenomeno).toBe('tercero');
    const tigre = frasesHabladas([p('小', 'xiǎo'), p('老虎', 'lǎohǔ')]).filter(esSilaba);
    expect(tigre.map((s) => s.suena)).toEqual(['xiǎo', 'láo', 'hǔ']);
    expect(tigre[0].tambien).toBe(2);
  });

  it('un neutro o una pausa cortan la racha', () => {
    expect(suena(p('姐姐', 'jiějie'))).toBe('jiě jie');
    expect(suena(p('你', 'nǐ'), signo('，'), p('好', 'hǎo'))).toBe('nǐ ， hǎo');
  });
});

describe('一 y 不', () => {
  it('不 pasa al segundo tono delante de un cuarto, y va sin tono entre dos iguales', () => {
    expect(suena(p('不是', 'bùshì'))).toBe('bú shì');
    expect(suena(p('不', 'bù'), p('好', 'hǎo'))).toBe('bù hǎo');
    expect(suena(p('是', 'shì'), p('不', 'bù'), p('是', 'shì'))).toBe('shì bu shì');
  });

  it('一 cambia según el tono siguiente: yí delante de un cuarto, yì delante de los demás', () => {
    expect(suena(p('一样', 'yīyàng'))).toBe('yí yàng');
    expect(suena(p('一起', 'yīqǐ'))).toBe('yì qǐ');
    expect(suena(p('一天', 'yītiān'))).toBe('yì tiān');
    expect(suena(p('一百', 'yībǎi'))).toBe('yì bǎi');
    // 个 va en neutro, pero es gè.
    expect(suena(p('一个', 'yīge'))).toBe('yí ge');
  });

  it('一 no cambia al contar, en las fechas, tras 第 ni al final de una palabra', () => {
    expect(suena(p('第一', 'dìyī'))).toBe('dì yī');
    expect(suena(p('十一', 'shíyī'), p('个', 'gè'))).toBe('shí yī gè');
    expect(suena(p('一九四九', 'yījiǔsìjiǔ'))).toBe('yī jiǔ sì jiǔ');
    expect(suena(p('一月', 'yīyuè'))).toBe('yī yuè');
    expect(suena(p('统一', 'tǒngyī'), p('了', 'le'))).toBe('tǒng yī le');
    expect(suena(p('一', 'yī'), signo('。'))).toBe('yī 。');
  });

  it('entre dos verbos iguales, 一 va sin tono', () => {
    expect(suena(p('看', 'kàn'), p('一', 'yī'), p('看', 'kàn'))).toBe('kàn yi kàn');
  });
});

describe('儿化 y el tono neutro', () => {
  it('el 儿 se pega a la sílaba de antes, que pierde una n o una i', () => {
    const t = frasesHabladas([p('一点儿', 'yīdiǎnr')]).filter(esSilaba);
    expect(t.map((s) => [s.texto, s.suena, s.fenomeno])).toEqual([
      ['一', 'yì', 'yi'],
      ['点儿', 'diǎr', 'erhua'],
    ]);
    expect(suena(p('一会儿', 'yīhuìr'))).toBe('yí huèr');
    expect(suena(p('玩儿', 'wánr'))).toBe('wár');
    expect(suena(p('哪儿', 'nǎr'))).toBe('nǎr');
    expect(suena(p('事儿', 'shìr'))).toBe('shèr');
    expect(suena(p('有空儿', 'yǒukòngr'))).toBe('yǒu kòngr');
  });

  it('las sílabas en neutro se señalan', () => {
    const t = frasesHabladas([p('我们', 'wǒmen')]).filter(esSilaba);
    expect(t.map((s) => s.fenomeno)).toEqual([undefined, 'neutro']);
  });
});

describe('cómo suena y la práctica', () => {
  it('cada sílaba lleva encima cómo se dice; los signos van tal cual', () => {
    expect(comoSuenaChino('你好！', [p('你好', 'nǐhǎo'), signo('！')])).toEqual([
      { texto: '你', suena: 'ní', fenomeno: 'tercero' },
      { texto: '好', suena: 'hǎo', fenomeno: undefined },
      { texto: '！' },
    ]);
  });

  it('las sílabas para practicar, con el tono que se oye y dónde hay pausa', () => {
    expect(silabasParaPracticar([p('你好', 'nǐhǎo'), signo('，'), p('我', 'wǒ'), p('很', 'hěn'), p('好', 'hǎo')])).toEqual([
      { texto: '你', lectura: 'ní', tono: 2, pausa: false },
      { texto: '好', lectura: 'hǎo', tono: 3, pausa: true },
      { texto: '我', lectura: 'wǒ', tono: 3, tambien: 2, pausa: false },
      { texto: '很', lectura: 'hén', tono: 2, pausa: false },
      { texto: '好', lectura: 'hǎo', tono: 3, pausa: true },
    ]);
  });
});
