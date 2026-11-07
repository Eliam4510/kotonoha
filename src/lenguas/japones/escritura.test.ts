import { describe, expect, it } from 'vitest';
import { contarEscrituras, esTextoJapones, proporcionDeKana } from './escritura';

describe('esTextoJapones', () => {
  it('el kana no deja dudas, diga lo que diga la página', () => {
    expect(esTextoJapones('これは本です', 'es', false)).toBe(true);
    expect(esTextoJapones('これは本です', undefined, false)).toBe(true);
  });

  it('no toca el chino ni el coreano', () => {
    expect(esTextoJapones('今天天气很好', 'zh-CN', false)).toBe(false);
    expect(esTextoJapones('한국어 문장입니다', 'ko', false)).toBe(false);
  });

  it('los ideogramas solos dependen del idioma de la página', () => {
    expect(esTextoJapones('東京都知事選', 'ja', false)).toBe(true);
    expect(esTextoJapones('東京都知事選', undefined, true)).toBe(true);
    expect(esTextoJapones('東京都知事選', undefined, false)).toBe(false);
  });

  it('el latín no se analiza', () => {
    expect(esTextoJapones('Hello world', 'ja', true)).toBe(false);
  });

  it('en un artículo en otro idioma, los ideogramas sueltos son japoneses si la página tiene kana', () => {
    expect(esTextoJapones('日本語', 'es', true)).toBe(true);
    expect(esTextoJapones('日本語', 'es', false)).toBe(false);
    expect(esTextoJapones('日本語', 'en-US', true)).toBe(true);
  });

  it('en chino o coreano, los ideogramas siguen sin serlo aunque la página tenga algo de kana', () => {
    expect(esTextoJapones('今天天气很好', 'zh-TW', true)).toBe(false);
    expect(esTextoJapones('大韓民國', 'ko', true)).toBe(false);
  });

  it('un の de adorno en una página china no es japonés, pero una frase de verdad sí', () => {
    expect(esTextoJapones('我の最愛', 'zh-TW', false)).toBe(false);
    expect(esTextoJapones('これは本です', 'zh-CN', false)).toBe(true);
  });
});

describe('proporcionDeKana', () => {
  it('distingue una página japonesa de una china con algún kana suelto', () => {
    expect(proporcionDeKana(400, 300)).toBe(true);
    expect(proporcionDeKana(12, 40)).toBe(true);
    expect(proporcionDeKana(3, 5000)).toBe(false);
    expect(proporcionDeKana(20, 5000)).toBe(false);
  });

  it('cuenta hiragana, katakana e ideogramas', () => {
    expect(contarEscrituras('これはカタカナと漢字 abc')).toEqual({ propios: 8, compartidos: 2 });
  });
});
