import { describe, expect, it } from 'vitest';
import { extraerGlosas, leerBancoCaracteres, leerBancoMeta, leerBancoTerminos, leerKanjium } from './yomitan';

describe('banco de términos', () => {
  it('lee el formato sencillo de JMdict en español', () => {
    const f = leerBancoTerminos([['正午', 'しょうご', 'n adv', '', 1999800, ['mediodía'], 1377080, '⭐ ichi news2k']]);
    expect(f[0]).toEqual({
      termino: '正午',
      lectura: 'しょうご',
      tags: 'n adv ⭐ ichi news2k',
      reglas: '',
      puntuacion: 1999800,
      glosas: ['mediodía'],
      seq: 1377080,
    });
  });

  it('usa el término como lectura si viene vacía', () => {
    expect(leerBancoTerminos([['ねこ', '', '', '', 0, ['gato'], 1, '']])[0].lectura).toBe('ねこ');
  });

  it('descarta filas sin glosas', () => {
    expect(leerBancoTerminos([['x', 'x', '', '', 0, [], 1, '']])).toEqual([]);
  });
});

describe('banco de caracteres', () => {
  it('lee lecturas, etiquetas, significados y datos de KANJIDIC', () => {
    const [k] = leerBancoCaracteres([['日', 'ニチ ジツ', 'ひ -び -か', 'jouyou', ['día', 'sol', ''], { strokes: '4', freq: 1 }]]);
    expect(k).toEqual({
      caracter: '日',
      on: ['ニチ', 'ジツ'],
      kun: ['ひ', '-び', '-か'],
      etiquetas: ['jouyou'],
      significados: ['día', 'sol'],
      datos: { strokes: '4', freq: '1' },
    });
  });

  it('aguanta filas a medias y salta las que no traen carácter', () => {
    expect(leerBancoCaracteres([['', 'ア', '', '', [], {}], ['亜', '', '', '', null, null] as unknown[]])).toEqual([
      { caracter: '亜', on: [], kun: [], etiquetas: [], significados: [], datos: {} },
    ]);
  });
});

describe('contenido estructurado', () => {
  it('saca cada glosa y omite categorías, notas y atribución', () => {
    const g = extraerGlosas([
      {
        type: 'structured-content',
        content: [
          {
            tag: 'div',
            content: [
              { tag: 'span', data: { content: 'part-of-speech-info' }, content: 'Ichidan verb' },
              {
                tag: 'ul',
                data: { content: 'glossary' },
                content: [
                  { tag: 'li', content: 'to eat' },
                  { tag: 'li', content: ['to live on ', { tag: 'span', content: '(e.g. a salary)' }] },
                ],
              },
              { tag: 'div', data: { content: 'attribution' }, content: 'JMdict' },
            ],
          },
        ],
      },
    ]);
    expect(g).toEqual(['to eat', 'to live on (e.g. a salary)']);
  });

  it('los antónimos de JMdict siguen siendo una glosa, salvo que la lengua pida omitirlos', () => {
    const glosario = [
      {
        type: 'structured-content',
        content: [
          { tag: 'ul', data: { content: 'glossary' }, content: { tag: 'li', content: 'heterodont' } },
          { tag: 'ul', data: { content: 'antonyms' }, content: { tag: 'li', content: ['antonym: ', { tag: 'a', content: '同歯性' }, { tag: 'span', data: { content: 'refGlosses' }, content: ' homodont' }] } },
        ],
      },
    ];
    expect(extraerGlosas(glosario)).toEqual(['heterodont', 'antonym: 同歯性 homodont']);
    expect(extraerGlosas(glosario, new Set(['antonyms']))).toEqual(['heterodont']);
  });

  it('admite texto plano dentro del contenido', () => {
    expect(extraerGlosas([{ type: 'structured-content', content: 'hola' }])).toEqual(['hola']);
    expect(extraerGlosas([{ type: 'text', text: 'adiós' }, 'cadena'])).toEqual(['adiós', 'cadena']);
  });
});

describe('banco de metadatos', () => {
  it('lee frecuencias en sus tres formas', () => {
    const { frecuencias } = leerBancoMeta([
      ['猫', 'freq', 120],
      ['犬', 'freq', { value: 300, displayValue: '300㋕' }],
      ['食べる', 'freq', { reading: 'たべる', frequency: { value: 169, displayValue: '169' } }],
    ]);
    expect(frecuencias).toEqual([
      { termino: '猫', lectura: '', rango: 120, texto: undefined },
      { termino: '犬', lectura: '', rango: 300, texto: '300㋕' },
      { termino: '食べる', lectura: 'たべる', rango: 169, texto: '169' },
    ]);
  });

  it('lee acentos', () => {
    const { acentos } = leerBancoMeta([['花', 'pitch', { reading: 'はな', pitches: [{ position: 2 }] }]]);
    expect(acentos).toEqual([{ termino: '花', lectura: 'はな', posiciones: [2] }]);
  });
});

describe('Kanjium', () => {
  it('lee posiciones múltiples y con notas', () => {
    const a = leerKanjium('１０月\tじゅうがつ\t4,0\nねこ\t\t1\n茶\tちゃ\t(名)0,(副)1\n\nmala\n');
    expect(a).toEqual([
      { termino: '１０月', lectura: 'じゅうがつ', posiciones: [4, 0] },
      { termino: 'ねこ', lectura: 'ねこ', posiciones: [1] },
      { termino: '茶', lectura: 'ちゃ', posiciones: [0, 1] },
    ]);
  });
});
