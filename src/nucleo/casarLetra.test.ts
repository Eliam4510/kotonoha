import { describe, expect, it } from 'vitest';
import { alinearLetras, letrasComparables, versosOidos } from './casarLetra';
import type { Linea } from './subtitulos';

const letras = (t: string) => letrasComparables(t);
const linea = (inicio: number, fin: number, texto: string, id = 0): Linea => ({ id, inicio, fin, texto });

describe('letrasComparables', () => {
  it('sin signos ni espacios, katakana como hiragana y anchos igualados', () => {
    expect(letras('ハッピー、ラッキー！ ＡＢＣ')).toEqual([...'はっぴーらっきーabc']);
  });
});

describe('alinearLetras', () => {
  it('casa tramos seguidos aunque haya otras cosas entre medias', () => {
    const a = letras('なんかすごい良い感じ');
    const b = letras('どんなときなんかすごい感じ');
    const casadas = alinearLetras(a, b).map(([i]) => a[i]).join('');
    expect(casadas).toBe('なんかすごい感じ');
  });

  it('una letra suelta no casa: puede ser casualidad', () => {
    expect(alinearLetras(letras('あいう'), letras('あかいかう'))).toEqual([]);
  });

  it('un verso japonés oído entero vale más que unas letras latinas', () => {
    // El estribillo en inglés suena después de lo japonés en lo oído, pero va antes en la letra: no caben los dos.
    const a = [...letras('a beautiful star'), ...letras('なんかすごい良い感じ')];
    const b = [...letras('なんかすごい感じ'), ...letras('a beautiful day')];
    const casadas = alinearLetras(a, b).map(([i]) => a[i]).join('');
    expect(casadas).toBe('なんかすごい感じ');
  });
});

describe('versosOidos', () => {
  const versos = ['夜の川を歩いて', '月が私を見ている', '星が降る', '朝はまだ来ないの'];
  const lineas = [linea(2000, 5000, '夜の皮を歩いて'), linea(6000, 9000, '月が僕を見ている'), linea(14000, 17000, '朝はまだ来ない')];

  it('cada verso oído empieza donde se oye su primera letra', () => {
    const o = versosOidos(versos, lineas);
    expect(o[0]?.inicio).toBe(2000);
    expect(Math.abs((o[1]?.inicio ?? 0) - 6000)).toBeLessThan(150);
    expect(Math.abs((o[3]?.inicio ?? 0) - 14000)).toBeLessThan(150);
  });

  it('uno que no se oyó se queda sin tiempo', () => {
    expect(versosOidos(versos, lineas)[2]).toBeNull();
  });

  it('una letra de otra canción no casa en ninguna parte', () => {
    expect(versosOidos(['書いて書いて消してまた書いて', '目に脳に手書きの愛'], lineas).every((o) => o === null)).toBe(true);
  });

  it('dos versos que el reconocedor juntó en una línea, cada uno en su sitio', () => {
    const o = versosOidos(['小学生みたいに', '雨上がりの夜に'], [linea(20000, 24000, '小学生みたいに雨上がりの夜に')]);
    expect(o[0]?.inicio).toBe(20000);
    expect((o[1]?.inicio ?? 0) - 20000).toBeGreaterThan(1500);
  });
});
