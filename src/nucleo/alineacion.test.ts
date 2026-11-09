import { describe, expect, it } from 'vitest';
import { fonemasOidos, FONEMAS_NARABAS, morasEspecialesOidas, type TipoMoraEspecial } from './alineacion';

const fon = (s: string) => s.split(' ');
type Especiales = (TipoMoraEspecial | null)[];

describe('las moras especiales oídas', () => {
  // おばあさん: お / ば / あ (la mitad de la a larga) / さ / ん
  const obaasan = [fon('o'), fon('b a'), fon('a'), fon('s a'), fon('N')];
  const especialesObaasan: Especiales = [null, null, 'larga', null, 'hatsuon'];

  it('dicha bien, no avisa aunque cambie una consonante', () => {
    expect(morasEspecialesOidas(obaasan, especialesObaasan, fon('o b a a s a N')).errores).toEqual([]);
    expect(morasEspecialesOidas(obaasan, especialesObaasan, fon('o p a a s a N')).errores).toEqual([]);
  });

  it('ve la vocal larga que falta, se atribuya el borrado a una a o a la otra', () => {
    expect(morasEspecialesOidas(obaasan, especialesObaasan, fon('o b a s a N')).errores).toEqual([{ mora: 2, error: 'falta', tipo: 'larga' }]);
    // ビール dicho ビル: b i | i | r u
    expect(morasEspecialesOidas([fon('b i'), fon('i'), fon('r u')], [null, 'larga', null], fon('p i r u')).errores).toEqual([{ mora: 1, error: 'falta', tipo: 'larga' }]);
  });

  it('ve la っ y la ん que faltan', () => {
    expect(morasEspecialesOidas([fon('k i'), fon('cl'), fon('t e')], [null, 'sokuon', null], fon('k i t e')).errores).toEqual([{ mora: 1, error: 'falta', tipo: 'sokuon' }]);
    expect(morasEspecialesOidas([fon('k a'), fon('N'), fon('j i')], [null, 'hatsuon', null], fon('k a j i')).errores).toEqual([{ mora: 1, error: 'falta', tipo: 'hatsuon' }]);
  });

  it('no juzga la っ delante de una fricativa, que el modelo no marca', () => {
    // いっしょ: narabas oye «i sh o» aunque se diga bien.
    expect(morasEspecialesOidas([fon('i'), fon('cl'), fon('sh o')], [null, 'sokuon', null], fon('i sh o')).errores).toEqual([]);
  });

  it('ve la mora de más: una vocal alargada, una っ o una ん que no estaban', () => {
    // おばさん dicho おばあさん
    expect(morasEspecialesOidas([fon('o'), fon('b a'), fon('s a'), fon('N')], [null, null, null, 'hatsuon'], fon('o b a a s a N')).errores).toEqual([{ mora: 1, error: 'sobra', tipo: 'larga' }]);
    // きて dicho きって
    expect(morasEspecialesOidas([fon('k i'), fon('t e')], [null, null], fon('k i cl t e')).errores).toEqual([{ mora: 0, error: 'sobra', tipo: 'sokuon' }]);
    // びる dicho ビール
    expect(morasEspecialesOidas([fon('b i'), fon('r u')], [null, null], fon('b i i r u')).errores).toEqual([{ mora: 0, error: 'sobra', tipo: 'larga' }]);
  });

  it('entre dos frases, una mora de más es una pausa o un titubeo, no un error de la palabra', () => {
    // エリアンと | もうします, dicho con la と alargada y un golpe de glotis antes de la frase siguiente.
    const moras = [fon('t o'), fon('m o'), fon('u'), fon('sh i')];
    const especiales: Especiales = [null, null, 'larga', null];
    expect(morasEspecialesOidas(moras, especiales, fon('t o o m o o sh i'), [0, 1, 1, 1]).errores).toEqual([]);
    expect(morasEspecialesOidas(moras, especiales, fon('t o cl m o o sh i'), [0, 1, 1, 1]).errores).toEqual([]);
    // La misma vocal de más, dentro de una frase, sí cuenta.
    expect(morasEspecialesOidas(moras, especiales, fon('t o o m o o sh i'), [0, 0, 0, 0]).errores).toEqual([{ mora: 0, error: 'sobra', tipo: 'larga' }]);
  });

  it('no juzga una frase que se dijo de otra manera', () => {
    // 今 leído こん por el diccionario y dicho いま: la ん «falta», pero la frase entera es otra.
    const moras = [fon('k o'), fon('N'), fon('d a'), fon('i'), fon('g a'), fon('k u')];
    const especiales: Especiales = [null, 'hatsuon', null, null, null, null];
    expect(morasEspecialesOidas(moras, especiales, fon('i m a d a i g a k u'), [0, 0, 1, 1, 1, 1]).errores).toEqual([]);
    expect(morasEspecialesOidas(moras, especiales, fon('i m a d a i g a k u'), [0, 0, 1, 1, 1, 1]).juzgadas).toBe(1);
    // Si no se parece a nada, no se juzga ninguna.
    expect(morasEspecialesOidas(moras, especiales, fon('s o r e'), [0, 0, 1, 1, 1, 1])).toEqual({ errores: [], juzgadas: 0 });
    // Con la lectura que se dijo, la frase vale, y la ん que falta en だいがく... no hay: nada que avisar.
    expect(morasEspecialesOidas(moras, especiales, fon('k o d a i g a k u'), [0, 0, 1, 1, 1, 1]).errores).toEqual([{ mora: 1, error: 'falta', tipo: 'hatsuon' }]);
  });
});

describe('lo que oye el modelo', () => {
  it('toma el fonema más probable de cada marco, sin blancos, marcas, pausas ni repeticiones', () => {
    const C = FONEMAS_NARABAS.length;
    const marcos = ['[BOS]', '[PAD]', 'k', 'k', 'a', '[PAD]', 'pau', 'N', '[PAD]', 'N', '[EOS]'];
    const logits = new Float32Array(marcos.length * C).fill(-5);
    marcos.forEach((m, t) => (logits[t * C + FONEMAS_NARABAS.indexOf(m as (typeof FONEMAS_NARABAS)[number])] = 5));
    // Dos N separadas por un blanco son dos: una ん larga, o dos.
    expect(fonemasOidos(logits, marcos.length, C)).toEqual(['k', 'a', 'N', 'N']);
  });
});
