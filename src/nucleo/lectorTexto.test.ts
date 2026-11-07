import { describe, expect, it } from 'vitest';
import { kanaARomaji, lecturaVisible } from './tokens';
import { alinearSuperficies, compresionLectura, esFondoVisible, interlineadoAbierto, interlineadoNecesario, contarEscrituras, esFondoOscuro, esTextoJapones, fraseAlrededor, partirEnFrases, proporcionDeKana, tamanoLectura, tramosConLectura } from './lectorTexto';

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
    expect(contarEscrituras('これはカタカナと漢字 abc')).toEqual({ kana: 8, kanji: 2 });
  });
});

describe('alinearSuperficies', () => {
  it('sitúa las palabras cuando coinciden con el texto', () => {
    expect(alinearSuperficies('今日は雨', ['今日', 'は', '雨'])).toEqual([{ inicio: 0, fin: 2 }, { inicio: 2, fin: 3 }, { inicio: 3, fin: 4 }]);
  });

  it('un desajuste no arrastra al resto', () => {
    const r = alinearSuperficies('今日、雨', ['今日', '雨']);
    expect(r[1]).toEqual({ inicio: 3, fin: 4 });
  });

  it('lo que no aparece queda sin sitio y el resto sigue', () => {
    const r = alinearSuperficies('今日は雨', ['今日', '雪', 'は', '雨']);
    expect(r[1]).toBeNull();
    expect(r[2]).toEqual({ inicio: 2, fin: 3 });
    expect(r[3]).toEqual({ inicio: 3, fin: 4 });
  });

  it('no salta muy lejos por una coincidencia casual', () => {
    const texto = `あ${'か'.repeat(60)}あ`;
    expect(alinearSuperficies(texto, ['あ', 'あ'])[1]).toBeNull();
  });
});

describe('fraseAlrededor', () => {
  const t = '最初の文です。次の文は「長い」です！最後';

  it('encuentra la frase de la palabra', () => {
    expect(fraseAlrededor(t, 8, 9).frase).toBe('次の文は「長い」です！');
  });

  it('la primera y la última también', () => {
    expect(fraseAlrededor(t, 0, 1).frase).toBe('最初の文です。');
    expect(fraseAlrededor(t, t.length - 1, t.length).frase).toBe('最後');
  });

  it('conserva las comillas de cierre', () => {
    expect(fraseAlrededor('彼は「行く。」と言った', 3, 4).frase).toBe('彼は「行く。」');
  });

  it('devuelve posiciones sin espacios alrededor', () => {
    const r = fraseAlrededor('  本です。', 3, 4);
    expect(r.frase).toBe('本です。');
    expect(r.inicio).toBe(2);
  });
});

describe('partirEnFrases', () => {
  it('parte y no pierde nada', () => {
    expect(partirEnFrases('一つ。二つ！三つ')).toEqual(['一つ。', '二つ！', '三つ']);
  });

  it('un texto sin puntuación es una frase', () => {
    expect(partirEnFrases('見出しの文字')).toEqual(['見出しの文字']);
  });

  it('un texto vacío no da nada, ni se queda colgado', () => {
    expect(partirEnFrases('')).toEqual([]);
    expect(partirEnFrases('   ')).toEqual([]);
  });
});

describe('tramosConLectura', () => {
  it('solo los kanji llevan lectura', () => {
    expect(tramosConLectura([{ texto: '食', lectura: 'た' }, { texto: 'べる' }])).toEqual([{ inicio: 0, fin: 1, lectura: 'た' }]);
  });

  it('una palabra con varios kanji separados', () => {
    expect(tramosConLectura([{ texto: '立', lectura: 'た' }, { texto: 'ち' }, { texto: '上', lectura: 'あ' }, { texto: 'がる' }])).toEqual([
      { inicio: 0, fin: 1, lectura: 'た' },
      { inicio: 2, fin: 3, lectura: 'あ' },
    ]);
  });
});

describe('compresionLectura', () => {
  it('no estrecha lo que cabe', () => {
    expect(compresionLectura(40, 2, 8)).toBe(1);
  });

  it('estrecha lo que no cabe, hasta un límite', () => {
    expect(compresionLectura(16, 3, 8)).toBeCloseTo(0.667, 2);
    expect(compresionLectura(10, 8, 8)).toBe(0.62);
  });
});

describe('tamanoLectura', () => {
  it('es la mitad de la letra si hay sitio', () => {
    expect(tamanoLectura(20, 12)).toBe(10);
  });

  it('nunca baja de lo legible', () => {
    expect(tamanoLectura(14, 0)).toBe(8);
    expect(tamanoLectura(12, 20)).toBe(9);
  });

  it('se ajusta al hueco cuando hay poco', () => {
    expect(tamanoLectura(24, 8)).toBe(10);
  });
});

describe('esFondoOscuro', () => {
  it('distingue claro y oscuro', () => {
    expect(esFondoOscuro('rgb(255, 255, 255)')).toBe(false);
    expect(esFondoOscuro('rgb(13, 18, 16)')).toBe(true);
  });

  it('un fondo transparente no dice nada', () => {
    expect(esFondoOscuro('rgba(0, 0, 0, 0)')).toBeNull();
    expect(esFondoOscuro('transparent')).toBeNull();
  });
});

describe('rōmaji', () => {
  it('convierte con Hepburn', () => {
    expect(kanaARomaji('たべる')).toBe('taberu');
    expect(kanaARomaji('しゃしん')).toBe('shashin');
    expect(kanaARomaji('がっこう')).toBe('gakkou');
    expect(kanaARomaji('まっちゃ')).toBe('matcha');
    expect(kanaARomaji('コーヒー')).toBe('kōhī');
    expect(kanaARomaji('ほんや')).toBe("hon'ya");
    expect(kanaARomaji('ふじさん')).toBe('fujisan');
  });

  it('muestra la lectura en el formato elegido', () => {
    expect(lecturaVisible('たべる', 'hiragana')).toBe('たべる');
    expect(lecturaVisible('たべる', 'katakana')).toBe('タベル');
    expect(lecturaVisible('たべる', 'romaji')).toBe('taberu');
    expect(lecturaVisible('たべる', undefined)).toBe('たべる');
  });
});

describe('interlineado para el furigana', () => {
  it('deja sitio a la lectura y al subrayado de la línea de arriba', () => {
    // 15 de letra, 9 de lectura y 3 de subrayado.
    expect(interlineadoNecesario(15) * 15).toBeCloseTo(27);
    expect(interlineadoNecesario(24) * 24).toBeCloseTo(39);
  });

  it('al abrir, deja un poco más de lo justo', () => {
    expect(interlineadoAbierto(15)).toBeCloseTo(interlineadoNecesario(15) * 1.05);
  });

  it('un fondo transparente no tapa', () => {
    expect(esFondoVisible('rgba(0, 0, 0, 0)')).toBe(false);
    expect(esFondoVisible('transparent')).toBe(false);
    expect(esFondoVisible('rgb(255, 255, 255)')).toBe(true);
    expect(esFondoVisible('rgba(0, 0, 0, 0.5)')).toBe(true);
  });
});
