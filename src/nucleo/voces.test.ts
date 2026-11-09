import { describe, expect, it } from 'vitest';
import { nombreCorto, vocesDeLengua, vozParaLeer } from './voces';

const v = (name: string, lang: string, localService = true) => ({ name, lang, localService });

const EDGE = [
  v('Microsoft Haruka - Japanese (Japan)', 'ja-JP'),
  v('Microsoft Ayumi - Japanese (Japan)', 'ja-JP'),
  v('Microsoft David - English (United States)', 'en-US'),
  v('Microsoft Nanami Online (Natural) - Japanese (Japan)', 'ja-JP', false),
  v('Microsoft Keita Online (Natural) - Japanese (Japan)', 'ja-JP', false),
  v('Microsoft Sonia Online (Natural) - English (United Kingdom)', 'en-GB', false),
  v('Microsoft Aria Online (Natural) - English (United States)', 'en-US', false),
];

const CHROME = [
  v('Microsoft Haruka - Japanese (Japan)', 'ja-JP'),
  v('Google Deutsch', 'de-DE', false),
  v('Google 日本語', 'ja-JP', false),
  v('Microsoft Hedda - German (Germany)', 'de-DE'),
];

describe('las voces del navegador', () => {
  it('en Edge van primero las neuronales «Natural», en el orden del navegador', () => {
    expect(vocesDeLengua(EDGE, 'ja').map((x) => x.name)).toEqual([
      'Microsoft Nanami Online (Natural) - Japanese (Japan)',
      'Microsoft Keita Online (Natural) - Japanese (Japan)',
      'Microsoft Haruka - Japanese (Japan)',
      'Microsoft Ayumi - Japanese (Japan)',
    ]);
  });

  it('en Chrome, las de Google', () => {
    expect(vocesDeLengua(CHROME, 'ja')[0].name).toBe('Google 日本語');
    expect(vocesDeLengua(CHROME, 'de').map((x) => x.name)).toEqual(['Google Deutsch', 'Microsoft Hedda - German (Germany)']);
  });

  it('entre iguales, la variante pedida va antes', () => {
    expect(vocesDeLengua(EDGE, 'en', 'en-GB')[0].name).toBe('Microsoft Sonia Online (Natural) - English (United Kingdom)');
    expect(vocesDeLengua(EDGE, 'en', 'en-US')[0].name).toBe('Microsoft Aria Online (Natural) - English (United States)');
  });

  it('solo las de la lengua, también con el código escrito de otra forma', () => {
    expect(vocesDeLengua([v('Kyoko', 'ja_JP'), v('Anna', 'de_DE')], 'ja').map((x) => x.name)).toEqual(['Kyoko']);
    expect(vocesDeLengua(EDGE, 'de')).toEqual([]);
  });

  it('el nombre corto quita la marca y la lengua, que ya se saben', () => {
    expect(nombreCorto('Microsoft Nanami Online (Natural) - Japanese (Japan)')).toBe('Nanami (Natural)');
    expect(nombreCorto('Microsoft Haruka - Japanese (Japan)')).toBe('Haruka');
    expect(nombreCorto('Google 日本語')).toBe('Google 日本語');
  });

  it('la elegida en Ajustes manda mientras exista; si no, la mejor', () => {
    expect(vozParaLeer(EDGE, 'ja', 'Microsoft Ayumi - Japanese (Japan)')?.name).toBe('Microsoft Ayumi - Japanese (Japan)');
    expect(vozParaLeer(EDGE, 'ja', 'Una voz que ya no está')?.name).toBe('Microsoft Nanami Online (Natural) - Japanese (Japan)');
    expect(vozParaLeer(EDGE, 'ja', '')?.name).toBe('Microsoft Nanami Online (Natural) - Japanese (Japan)');
    expect(vozParaLeer([], 'ja', '')).toBeNull();
  });
});
