import { describe, expect, it } from 'vitest';
import { cantadoDelRenglon, desplegarMarcas } from './marcasLetra';

const lineas = (t: string) => t.split('\n').filter((l) => l.trim());

describe('desplegarMarcas', () => {
  it('un título que vuelve sin nada debajo trae sus versos', () => {
    const letra = '[Verse 1]\nuno\ndos\n\n[Chorus]\ncoro a\ncoro b\n\n[Verse 2]\ntres\n\n[Chorus]\n\n[Chorus]';
    expect(lineas(desplegarMarcas(letra))).toEqual(['uno', 'dos', 'coro a', 'coro b', 'tres', 'coro a', 'coro b', 'coro a', 'coro b']);
  });

  it('una letra completa con los títulos repetidos se queda igual, sin los títulos', () => {
    const letra = '[Chorus]\ncoro a\n\n[Verse]\nuno\n\n[Chorus]\ncoro a';
    expect(lineas(desplegarMarcas(letra))).toEqual(['coro a', 'uno', 'coro a']);
  });

  it('«(Repeat Chorus)» y «サビ繰り返し» repiten el estribillo, se llame como se llame', () => {
    expect(lineas(desplegarMarcas('[サビ]\n夜の川\n月の道\n\n二番の歌\n\n(Repeat Chorus)'))).toEqual(['夜の川', '月の道', '二番の歌', '夜の川', '月の道']);
    expect(lineas(desplegarMarcas('[Chorus]\nla luna\n\notra cosa\n\nサビ繰り返し'))).toEqual(['la luna', 'otra cosa', 'la luna']);
  });

  it('las veces: «(Repeat Chorus x2)», «[Chorus x2]» con sus versos y «×2» bajo una estrofa', () => {
    expect(lineas(desplegarMarcas('[Chorus]\nla luna\n\n(Repeat Chorus x2)'))).toEqual(['la luna', 'la luna', 'la luna']);
    expect(lineas(desplegarMarcas('[Chorus x2]\nla luna\nel sol\n\nfin'))).toEqual(['la luna', 'el sol', 'la luna', 'el sol', 'fin']);
    expect(lineas(desplegarMarcas('uno\ndos\n(×2)\n\ntres'))).toEqual(['uno', 'dos', 'uno', 'dos', 'tres']);
  });

  it('el bloque del ※ se repite donde dice «※くり返し»', () => {
    const letra = '最初の歌\n\n※夜の川を歩いて\n月が私を見ている\n\n二番\n\n※くり返し';
    expect(lineas(desplegarMarcas(letra))).toEqual(['最初の歌', '夜の川を歩いて', '月が私を見ている', '二番', '夜の川を歩いて', '月が私を見ている']);
  });

  it('una orden que no se puede cumplir y los versos cortos se quedan como están', () => {
    expect(lineas(desplegarMarcas('Repeat after me\nNo thanks ya\nOh oh'))).toEqual(['Repeat after me', 'No thanks ya', 'Oh oh']);
  });

  it('una segunda voz entre paréntesis es un verso, no un título, aunque se repita', () => {
    const letra = '(Shine, your future shine)\nuno\n\n(Shine, your future shine)\ndos';
    expect(lineas(desplegarMarcas(letra))).toEqual(['(Shine, your future shine)', 'uno', '(Shine, your future shine)', 'dos']);
    // Entre paréntesis, solo nombrando una sección es un título.
    expect(lineas(desplegarMarcas('(Chorus)\nla luna\n\nfin\n\n(Chorus)'))).toEqual(['la luna', 'fin', 'la luna']);
  });
});

describe('cantadoDelRenglon', () => {
  it('nada si es un título, una orden de repetir o un crédito', () => {
    for (const r of ['[Chorus]', '(Repeat Chorus)', 'サビ繰り返し', '※くり返し', '※', 'x2', '[サビ]', 'Chorus:', '作詞：ハチ']) expect(cantadoDelRenglon(r), r).toBe('');
  });

  it('un verso, sin el ※ que lo marca, la marca de delante ni su «×2»', () => {
    expect(cantadoDelRenglon('※君の名前を呼ぶ')).toBe('君の名前を呼ぶ');
    expect(cantadoDelRenglon('[Chorus] Shine on')).toBe('Shine on');
    expect(cantadoDelRenglon('La luna ×2')).toBe('La luna');
    // Una segunda voz entre paréntesis se canta.
    expect(cantadoDelRenglon('(Shine, your future shine)')).toBe('(Shine, your future shine)');
  });
});
