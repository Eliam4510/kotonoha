import { describe, expect, it } from 'vitest';
import { fonemasDeMora, fonemasDeMoras, morasEspeciales } from './fonemas';

describe('los fonemas de cada mora', () => {
  it('escribe cada kana como OpenJTalk', () => {
    expect(fonemasDeMora('か', null)).toEqual(['k', 'a']);
    expect(fonemasDeMora('し', null)).toEqual(['sh', 'i']);
    expect(fonemasDeMora('ち', null)).toEqual(['ch', 'i']);
    expect(fonemasDeMora('つ', null)).toEqual(['ts', 'u']);
    expect(fonemasDeMora('ふ', null)).toEqual(['f', 'u']);
    expect(fonemasDeMora('を', null)).toEqual(['o']);
    expect(fonemasDeMora('っ', null)).toEqual(['cl']);
    expect(fonemasDeMora('ン', null)).toEqual(['N']);
  });

  it('une el kana con su pequeña', () => {
    expect(fonemasDeMora('きょ', null)).toEqual(['ky', 'o']);
    expect(fonemasDeMora('しゃ', null)).toEqual(['sh', 'a']);
    expect(fonemasDeMora('じゅ', null)).toEqual(['j', 'u']);
    expect(fonemasDeMora('ティ', null)).toEqual(['t', 'i']);
    expect(fonemasDeMora('ファ', null)).toEqual(['f', 'a']);
    expect(fonemasDeMora('ウィ', null)).toEqual(['w', 'i']);
  });

  it('alarga la vocal anterior con la raya, y no da nada para lo que no es kana', () => {
    expect(fonemasDeMora('ー', 'i')).toEqual(['i']);
    expect(fonemasDeMora('ー', null)).toEqual([]);
    expect(fonemasDeMora('A', null)).toEqual([]);
  });

  it('dice わ la は final de partícula, y え la へ', () => {
    expect(fonemasDeMoras({ texto: '私は', moras: ['わ', 'た', 'し', 'は'] }).at(-1)).toEqual(['w', 'a']);
    expect(fonemasDeMoras({ texto: '駅へ', moras: ['え', 'き', 'へ'] }).at(-1)).toEqual(['e']);
    // La は dentro de la palabra se queda: はは (母).
    expect(fonemasDeMoras({ texto: '母', moras: ['は', 'は'] })).toEqual([['h', 'a'], ['h', 'a']]);
  });

  it('sigue la vocal para la raya: ビール', () => {
    expect(fonemasDeMoras({ texto: 'ビール', moras: ['ビ', 'ー', 'ル'] })).toEqual([['b', 'i'], ['i'], ['r', 'u']]);
  });
});

describe('las moras especiales', () => {
  const especiales = (texto: string, moras: string[]) => morasEspeciales(fonemasDeMoras({ texto, moras }));

  it('marca la っ, la ん y la mitad de una vocal larga', () => {
    expect(especiales('切手', ['き', 'っ', 'て'])).toEqual([null, 'sokuon', null]);
    expect(especiales('漢字', ['か', 'ん', 'じ'])).toEqual([null, 'hatsuon', null]);
    expect(especiales('お婆さん', ['お', 'ば', 'あ', 'さ', 'ん'])).toEqual([null, null, 'larga', null, 'hatsuon']);
  });

  it('toma la い tras e y la う tras o por vocales largas', () => {
    expect(especiales('先生', ['せ', 'ん', 'せ', 'い'])).toEqual([null, 'hatsuon', null, 'larga']);
    expect(especiales('東京', ['と', 'う', 'きょ', 'う'])).toEqual([null, 'larga', null, 'larga']);
    // Pero no la い tras a: たいかい no tiene vocales largas.
    expect(especiales('大会', ['た', 'い', 'か', 'い'])).toEqual([null, null, null, null]);
  });
});
