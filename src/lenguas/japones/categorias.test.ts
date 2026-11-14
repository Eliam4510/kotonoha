import { describe, expect, it } from 'vitest';
import { encajaCategoriaJapones, soloHiragana } from './categorias';

describe('encajaCategoriaJapones', () => {
  it('un verbo es una entrada con clase de verbo, no un sufijo de los textos antiguos', () => {
    expect(encajaCategoriaJapones('動詞', 'v5r vi ⭐ ichi news1k')).toBe(true);
    expect(encajaCategoriaJapones('動詞', '1 suf adj-f arch')).toBe(false);
    expect(encajaCategoriaJapones('動詞', 'vs-i vi vt suf aux-v ⭐ ichi')).toBe(true);
  });

  it('transitivo o intransitivo no hacen de una entrada un verbo', () => {
    expect(encajaCategoriaJapones('動詞', 'vt vi')).toBe(false);
  });

  it('un sustantivo no es una partícula, y los de IPADIC incluyen pronombres y adjetivos en -na', () => {
    expect(encajaCategoriaJapones('名詞', '1 prt ⭐ spec')).toBe(false);
    expect(encajaCategoriaJapones('名詞', 'n ⭐ ichi')).toBe(true);
    expect(encajaCategoriaJapones('名詞', 'pn ⭐')).toBe(true);
    expect(encajaCategoriaJapones('名詞', 'adj-na n')).toBe(true);
    expect(encajaCategoriaJapones('名詞', 'n-adv n-t ⭐')).toBe(true);
    // さん, ちゃん: IPADIC los da como sustantivos sufijos.
    expect(encajaCategoriaJapones('名詞', 'suf ⭐')).toBe(true);
  });

  it('las partículas, los auxiliares y los adjetivos, cada uno con lo suyo', () => {
    expect(encajaCategoriaJapones('助詞', 'prt ⭐ spec')).toBe(true);
    expect(encajaCategoriaJapones('助動詞', 'aux-adj ⭐')).toBe(true);
    expect(encajaCategoriaJapones('形容詞', 'adj-i ⭐')).toBe(true);
    expect(encajaCategoriaJapones('形容詞', 'adj-na')).toBe(false);
  });

  it('sin etiquetas o con una categoría sin clases, no encaja', () => {
    expect(encajaCategoriaJapones('名詞')).toBe(false);
    expect(encajaCategoriaJapones('フィラー', 'int')).toBe(false);
  });
});

describe('soloHiragana', () => {
  it('solo lo escrito todo en hiragana', () => {
    expect(soloHiragana('なる')).toBe(true);
    expect(soloHiragana('アイ')).toBe(false);
    expect(soloHiragana('成る')).toBe(false);
    expect(soloHiragana('')).toBe(false);
  });
});
