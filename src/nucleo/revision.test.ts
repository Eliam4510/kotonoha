import { describe, expect, it } from 'vitest';
import { cambiosValidos, diferencias, mensajeRevision } from './revision';

describe('el mensaje de la revisión', () => {
  it('lleva el título, la página y las líneas numeradas desde 0', () => {
    expect(mensajeRevision({ titulo: 'Química', pagina: 11, globos: false, lineas: ['酸と塩基', '工ネルギー'] })).toBe(
      'Título: Química\n\nPágina 12\n\nRenglones leídos por el OCR, en el orden de lectura:\n0: 酸と塩基\n1: 工ネルギー'
    );
    expect(mensajeRevision({ pagina: 0, globos: true, lineas: ['待って！\nね'] })).toBe('Página 1\n\nGlobos de texto leídos por el OCR, uno por número:\n0: 待って！ ね');
  });
});

describe('lo que vale de lo que propone Claude', () => {
  const lineas = ['酸と塩基', '工ネルギー', 'イ才ン'];

  it('solo cambios de verdad, en líneas que existen, una vez cada una', () => {
    const cambios = [
      { i: 1, t: 'エネルギー' },
      { i: 0, t: '酸と塩基' },
      { i: 7, t: 'nada' },
      { i: -1, t: 'nada' },
      { i: 1.5, t: 'nada' },
      { i: 2, t: 'イオソ' },
      { i: 2, t: 'イオン\n' },
    ];
    expect(cambiosValidos(lineas, cambios)).toEqual([
      { indice: 1, antes: '工ネルギー', despues: 'エネルギー' },
      { indice: 2, antes: 'イ才ン', despues: 'イオン' },
    ]);
  });

  it('sin texto, o vuelta atrás a lo que había, no es un cambio', () => {
    expect(cambiosValidos(lineas, [{ i: 1, t: '   ' }])).toEqual([]);
    expect(cambiosValidos(lineas, [{ i: 1, t: 'エネルギー' }, { i: 1, t: '工ネルギー' }])).toEqual([]);
    expect(cambiosValidos(lineas, null)).toEqual([]);
  });
});

describe('las diferencias entre dos líneas', () => {
  it('letra a letra: lo que se quita, lo que se pone y lo que se queda', () => {
    expect(diferencias('工ネルギー', 'エネルギー')).toEqual([
      { tipo: 'quitado', texto: '工' },
      { tipo: 'puesto', texto: 'エ' },
      { tipo: 'igual', texto: 'ネルギー' },
    ]);
    expect(diferencias('水素イオ', '水素イオン')).toEqual([
      { tipo: 'igual', texto: '水素イオ' },
      { tipo: 'puesto', texto: 'ン' },
    ]);
    expect(diferencias('abc', 'abc')).toEqual([{ tipo: 'igual', texto: 'abc' }]);
    expect(diferencias('', 'x')).toEqual([{ tipo: 'puesto', texto: 'x' }]);
    expect(diferencias('𠮷野', '吉野')).toEqual([
      { tipo: 'quitado', texto: '𠮷' },
      { tipo: 'puesto', texto: '吉' },
      { tipo: 'igual', texto: '野' },
    ]);
  });

  it('dos textos enormes se enseñan enteros, sin compararlos letra a letra', () => {
    const a = 'あ'.repeat(600);
    const b = 'い'.repeat(600);
    expect(diferencias(a, b)).toEqual([
      { tipo: 'quitado', texto: a },
      { tipo: 'puesto', texto: b },
    ]);
  });
});
