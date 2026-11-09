import { describe, expect, it } from 'vitest';
import { coincidencias, evaluarConLecturas, evaluarDictado, palabrasDe } from './ejercicioDictado';

const caracteres = (s: string) => [...s];

describe('ejercicio de dictado', () => {
  it('encuentra lo común en orden', () => {
    expect(coincidencias([...'あいうえお'], [...'あうお'])).toEqual([true, false, true, false, true]);
    expect(coincidencias(['the', 'cat', 'sat'], ['a', 'cat', 'sat'])).toEqual([false, true, true]);
    expect(coincidencias([], ['x'])).toEqual([]);
  });

  it('en japonés compara la lectura: escrito en kana vale igual', () => {
    const partes = [
      { texto: '猫', clave: 'ねこ' },
      { texto: 'が', clave: 'が' },
      { texto: '好き', clave: 'すき' },
      { texto: '。', clave: '' },
    ];
    const r = evaluarDictado(partes, [...'ねこがすき'], caracteres);
    expect(r.nota).toBe(1);
    expect(r.partes.map((p) => p.acierto)).toEqual(['bien', 'bien', 'bien', 'signo']);
  });

  it('una palabra a medias queda «casi», y la nota cuenta lo acertado', () => {
    const partes = [
      { texto: '勉強', clave: 'べんきょう' },
      { texto: 'する', clave: 'する' },
    ];
    const r = evaluarDictado(partes, [...'べんきするう'], caracteres);
    expect(r.partes.map((p) => p.acierto)).toEqual(['casi', 'bien']);
    // べんきょうする: se acertaron べんき y する, cinco de siete.
    expect(r.nota).toBeCloseTo(5 / 7);
  });

  it('en inglés, palabra a palabra y sin mayúsculas ni signos', () => {
    expect(palabrasDe("Don't stop, Alice!")).toEqual(["don't", 'stop', 'alice']);
    const partes = ['Alice', 'was', 'very', 'tired', '.'].map((t) => ({ texto: t, clave: palabrasDe(t).join(' ') }));
    const r = evaluarDictado(partes, palabrasDe('alice was tired'), (c) => (c ? c.split(' ') : []));
    expect(r.partes.map((p) => p.acierto)).toEqual(['bien', 'bien', 'mal', 'bien', 'signo']);
    expect(r.nota).toBe(3 / 4);
  });

  it('acepta otra lectura de una palabra si es la que se escribió', () => {
    const partes = [
      { texto: '授業', clave: 'じゅぎょう' },
      { texto: 'の', clave: 'の' },
      { texto: '後', clave: 'ご' },
      { texto: 'は', clave: 'は' },
    ];
    const r = evaluarConLecturas(partes, [undefined, undefined, ['あと', 'のち', 'うしろ'], undefined], [...'じゅぎょうのあとは'], caracteres);
    expect(r.partes.map((p) => p.acierto)).toEqual(['bien', 'bien', 'bien', 'bien']);
    expect(r.nota).toBe(1);
  });
});
