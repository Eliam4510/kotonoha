import { describe, expect, it } from 'vitest';
import type { PalabraToken } from '../../compartido/tipos';
import { frasesAcentuales, nucleosDeForma } from './practica';

const palabra = (superficie: string, lectura: string, o: Partial<PalabraToken> = {}): PalabraToken => ({
  superficie,
  lema: superficie,
  lectura,
  lecturaLema: lectura,
  clave: '',
  esPalabra: true,
  esGramatica: false,
  flexion: [],
  furigana: [],
  estado: 'desconocida',
  rastreada: false,
  ...o,
});
const particula = (superficie: string, lectura = superficie) => palabra(superficie, lectura, { esGramatica: true });
const signo = (superficie: string) => palabra(superficie, '', { esPalabra: false });

describe('dónde cae el tono en cada forma', () => {
  it('sin conjugar, la del diccionario; con varias, todas', () => {
    expect(nucleosDeForma(palabra('橋', 'はし', { acentos: [2] }))).toEqual([2]);
    expect(nucleosDeForma(palabra('今', 'いま', { acentos: [1, 0, 1] }))).toEqual([1, 0]);
    expect(nucleosDeForma(palabra('猫', 'ねこ'))).toBeNull();
  });

  it('las formas corteses, en la ま, también sin datos del diccionario', () => {
    const conjugada = (superficie: string, lectura: string) => palabra(superficie, lectura, { lema: '食べる', lecturaLema: 'たべる', flexion: ['ます'] });
    expect(nucleosDeForma(conjugada('食べます', 'たべます'))).toEqual([3]);
    expect(nucleosDeForma(conjugada('食べました', 'たべました'))).toEqual([3]);
    expect(nucleosDeForma(conjugada('食べません', 'たべません'))).toEqual([4]);
    expect(nucleosDeForma(conjugada('食べませんでした', 'たべませんでした'))).toEqual([4]);
    expect(nucleosDeForma(conjugada('食べましょう', 'たべましょう'))).toEqual([4]);
    expect(nucleosDeForma(palabra('勉強します', 'べんきょうします', { lema: '勉強', lecturaLema: 'べんきょう', flexion: ['し', 'ます'], acentos: [0] }))).toEqual([6]);
  });

  it('las demás conjugaciones no se juzgan', () => {
    expect(nucleosDeForma(palabra('食べた', 'たべた', { lema: '食べる', lecturaLema: 'たべる', flexion: ['た'], acentos: [2] }))).toBeNull();
  });
});

describe('las frases acentuales', () => {
  it('cada palabra con sus partículas, y la puntuación las separa', () => {
    const f = frasesAcentuales([palabra('橋', 'はし', { acentos: [2] }), particula('を'), palabra('渡る', 'わたる', { acentos: [0] }), signo('。')]);
    expect(f.map((x) => [x.texto, x.moras.join(''), x.morasPalabra, x.nucleos, x.pausaNatural])).toEqual([
      ['橋を', 'はしを', 2, [2], false],
      ['渡る', 'わたる', 3, [0], true],
    ]);
  });

  it('las moras agrupan las pequeñas', () => {
    const [f] = frasesAcentuales([palabra('今日', 'きょう', { acentos: [1] }), particula('は')]);
    expect(f.moras).toEqual(['きょ', 'う', 'は']);
  });

  it('la cópula pone su núcleo tras una palabra plana, y no tras una con núcleo', () => {
    const [plana] = frasesAcentuales([palabra('学生', 'がくせい', { acentos: [0] }), particula('です')]);
    expect(plana.nucleos).toEqual([5]);
    const [conNucleo] = frasesAcentuales([palabra('高い', 'たかい', { acentos: [2] }), particula('です')]);
    expect(conNucleo.nucleos).toEqual([2]);
  });

  it('marca las que acaban en una mora que suele perder la voz, como la su de です', () => {
    const f = frasesAcentuales([
      palabra('学生', 'がくせい', { acentos: [0] }),
      particula('です'),
      signo('、'),
      palabra('使います', 'つかいます', { lema: '使う', lecturaLema: 'つかう', flexion: ['ます'] }),
      signo('、'),
      palabra('雨', 'あめ', { acentos: [1] }),
      particula('が'),
    ]);
    expect(f.map((x) => !!x.ultimaSorda)).toEqual([true, true, false]);
  });

  it('una partícula al principio, sin palabra delante, es su propia frase sin juzgar', () => {
    const f = frasesAcentuales([particula('でも'), palabra('雨', 'あめ', { acentos: [1] })]);
    expect(f.map((x) => [x.texto, x.nucleos])).toEqual([
      ['でも', null],
      ['雨', [1]],
    ]);
  });
});
