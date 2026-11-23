import { describe, expect, it } from 'vitest';
import { noSeCanta, versosDelRenglon } from './noSeCanta';

describe('noSeCanta', () => {
  it('un renglón entre corchetes es una marca', () => {
    for (const r of ['[サビ]', '[Chorus]', '【1番】', '［間奏］', '<Bridge>', '[Ado]']) expect(noSeCanta(r), r).toBe(true);
  });

  it('entre paréntesis, solo si nombra una sección o una repetición', () => {
    for (const r of ['(Chorus)', '(Pre-Chorus)', '（サビ）', '（間奏）', '(Verse 2)', '(x2)', '（×3）', '(Strophe 1)', '(후렴)']) expect(noSeCanta(r), r).toBe(true);
    for (const r of ['(oh oh)', '（あいしてる）', '(Hey!)']) expect(noSeCanta(r), r).toBe(false);
  });

  it('los créditos, con dos puntos o «by»', () => {
    for (const r of ['作詞：ハチ', '作詞・作曲：米津玄師', '作詞/作曲: ハチ', '編曲：ハチ', '歌：Ado', '词：方文山 曲：周杰伦', '작사: 누군가', 'Lyrics by Someone', 'Music: Someone', 'Text: Jemand', 'Musik/Text: Jemand']) {
      expect(noSeCanta(r), r).toBe(true);
    }
  });

  it('un verso corriente se canta', () => {
    for (const r of ['夜の川を歩いて', 'Text me when you get home', 'Musik liegt in der Luft', '曲がり角の向こう', '歌うよ', 'Words don’t come easy']) {
      expect(noSeCanta(r), r).toBe(false);
    }
  });
});

describe('versosDelRenglon', () => {
  it('quita la marca de sección de delante', () => {
    expect(versosDelRenglon('[Chorus] Camino por el río')).toEqual(['Camino por el río']);
    expect(versosDelRenglon('【サビ】月が私を見ている')).toEqual(['月が私を見ている']);
  });

  it('repite el verso las veces que dice', () => {
    expect(versosDelRenglon('月が私を見ている ×2')).toEqual(['月が私を見ている', '月が私を見ている']);
    expect(versosDelRenglon('la luna (x3)')).toEqual(['la luna', 'la luna', 'la luna']);
    // Demasiadas veces no es una repetición de verso: se canta una.
    expect(versosDelRenglon('otra x20')).toEqual(['otra']);
  });

  it('un verso sin marcas queda igual', () => {
    expect(versosDelRenglon('Max 2 veces')).toEqual(['Max 2 veces']);
    expect(versosDelRenglon('夜の川を　歩いて')).toEqual(['夜の川を　歩いて']);
  });
});
