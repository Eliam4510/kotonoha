import { describe, expect, it } from 'vitest';
import { caracteresDelNivel, clavesDe, type FilaCaracter, type FilaVocabulario, fraseConPatron, type PalabraGuardada, palabrasDelNivel, resumirNivel, significadoEn, trozosDePatron } from './niveles';

const guardada = (lema: string, lectura: string, estado: PalabraGuardada['estado'], rastreada = false): PalabraGuardada => ({ clave: `${lema}|${lectura}`, lema, lectura, estado, rastreada });

describe('palabras del nivel', () => {
  const filas: FilaVocabulario[] = [
    ['会う', 'あう', 'to meet'],
    ['川', 'かわ', 'river', ['河'], []],
    ['いい', 'いい', 'good', [], ['よい']],
    ['青い', 'あおい', 'blue'],
  ];

  it('prueba cada forma y cada lectura de la lista', () => {
    expect(clavesDe(filas[1])).toEqual(['川|かわ', '河|かわ']);
    expect(clavesDe(filas[2])).toEqual(['いい|いい', 'いい|よい']);
  });

  it('toma el estado guardado, también con otra forma, y por defecto la da por desconocida', () => {
    const g = new Map([guardada('会う', 'あう', 'conocida'), guardada('河', 'かわ', 'aprendiendo', true)].map((p) => [p.clave, p]));
    const r = palabrasDelNivel(filas, g);
    expect(r.map((p) => p.estado)).toEqual(['conocida', 'aprendiendo', 'desconocida', 'desconocida']);
    // La del río está guardada como 河: se cambia allí.
    expect(r[1]).toMatchObject({ clave: '河|かわ', lema: '河', rastreada: true, glosa: 'river' });
    expect(r[3]).toMatchObject({ clave: '青い|あおい', lema: '青い', lectura: 'あおい' });
  });

  it('si está guardada de dos formas, vale la más avanzada', () => {
    const g = new Map([guardada('川', 'かわ', 'aprendiendo'), guardada('河', 'かわ', 'conocida')].map((p) => [p.clave, p]));
    expect(palabrasDelNivel([filas[1]], g)[0].estado).toBe('conocida');
  });
});

describe('caracteres del nivel', () => {
  const filas: FilaCaracter[] = [
    ['日', 'ニチ、ジツ', 'ひ、-び', 'day, sun'],
    ['本', 'ホン', 'もと', 'book, origin'],
    ['雨', 'ウ', 'あめ', 'rain'],
  ];

  it('un carácter se conoce por las palabras conocidas o en aprendizaje que lo llevan', () => {
    const r = caracteresDelNivel(filas, [
      { lema: '日本', estado: 'conocida' },
      { lema: '本日', estado: 'aprendiendo' },
      { lema: '雨', estado: 'desconocida' },
      { lema: '本', estado: 'ignorada' },
    ]);
    expect(r.map((c) => [c.caracter, c.estado, c.palabras])).toEqual([
      ['日', 'conocida', 2],
      ['本', 'conocida', 2],
      ['雨', 'desconocida', 0],
    ]);
  });

  it('en aprendizaje si solo lo llevan palabras en aprendizaje', () => {
    expect(caracteresDelNivel([filas[2]], [{ lema: '大雨', estado: 'aprendiendo' }])[0].estado).toBe('aprendiendo');
  });
});

describe('resumen y gramática', () => {
  it('cuenta las conocidas y las que se están aprendiendo', () => {
    const palabras = palabrasDelNivel([['会う', 'あう', 'to meet'], ['青', 'あお', 'blue']], new Map([[`会う|あう`, guardada('会う', 'あう', 'conocida')]]));
    const r = resumirNivel('N5', palabras, caracteresDelNivel([['日', '', '', 'day']], [{ lema: '日', estado: 'aprendiendo' }]), 65);
    expect(r).toEqual({ nivel: 'N5', palabras: { total: 2, conocidas: 1, aprendiendo: 0 }, caracteres: { total: 1, conocidas: 0, aprendiendo: 1 }, gramatica: { total: 65 } });
  });

  it('el significado en el idioma de la interfaz, o en inglés', () => {
    const g = { patron: '〜ている', significado: { es: 'Acción en curso', en: 'Ongoing action' } };
    expect(significadoEn(g, 'es')).toBe('Acción en curso');
    expect(significadoEn(g, 'de')).toBe('Ongoing action');
  });

  it('busca los trozos fijos de un patrón en orden', () => {
    expect(trozosDePatron('〜ば〜ほど')).toEqual(['ば', 'ほど']);
    expect(trozosDePatron('〜そうだ（伝聞）')).toEqual(['そうだ']);
    expect(trozosDePatron('疑問詞＋か')).toEqual(['か']);
    expect(fraseConPatron('勉強すればするほど上手になる', trozosDePatron('〜ば〜ほど'))).toBe(true);
    expect(fraseConPatron('ほど遠いけれど行けば', trozosDePatron('〜ば〜ほど'))).toBe(false);
    // Una partícula suelta saldría en casi todas las frases.
    expect(fraseConPatron('猫が好き', trozosDePatron('〜が'))).toBe(false);
  });
});
