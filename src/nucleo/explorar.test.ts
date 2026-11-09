import { describe, expect, it } from 'vitest';
import { buscarGramatica, buscarPorSignificado, type EntradaBreve, encajeGlosa, ordenarEntradas, sinAcentos } from './explorar';

const entrada = (termino: string, lectura: string, glosas: string[], comun = false, puntuacion = 0): EntradaBreve => ({ termino, lectura, glosa: glosas[0], glosas, comun, puntuacion });

describe('buscar por significado', () => {
  it('compara sin tildes ni mayúsculas', () => {
    expect(sinAcentos('Canción')).toBe('cancion');
    expect(encajeGlosa('canción', 'CANCION')).toBe(3);
  });

  it('puntúa la glosa exacta, la que empieza por lo buscado y la que lo lleva como palabra', () => {
    expect(encajeGlosa('to eat', 'eat')).toBe(3);
    expect(encajeGlosa('perro (animal)', 'perro')).toBe(3);
    expect(encajeGlosa('perro guardián', 'perro')).toBe(2);
    expect(encajeGlosa('un perro grande', 'perro')).toBe(1);
    // Que forme parte de otra palabra no cuenta.
    expect(encajeGlosa('perrona', 'perro')).toBe(0);
  });

  it('ordena por encaje y, entre iguales, las comunes primero', () => {
    const r = buscarPorSignificado(
      [entrada('狗', 'いぬ', ['perro (arcaico)'], false), entrada('犬', 'いぬ', ['perro'], true, 5), entrada('番犬', 'ばんけん', ['perro guardián'], true), entrada('猫', 'ねこ', ['gato'], true)],
      'perro'
    );
    expect(r.map((e) => e.termino)).toEqual(['犬', '狗', '番犬']);
  });

  it('enseña la glosa que encajó', () => {
    const [r] = buscarPorSignificado([entrada('獅子', 'しし', ['león', 'perro león (estatua de los templos)'])], 'perro');
    expect(r.glosa).toBe('perro león (estatua de los templos)');
  });

  it('ordena una categoría: comunes primero, luego la puntuación', () => {
    expect(ordenarEntradas([entrada('ざあざあ', 'ざあざあ', ['a cántaros']), entrada('どきどき', 'どきどき', ['latir'], true), entrada('ふわふわ', 'ふわふわ', ['esponjoso'], false, 9)]).map((e) => e.termino)).toEqual(['どきどき', 'ふわふわ', 'ざあざあ']);
  });
});

describe('buscar gramática', () => {
  const puntos = [
    { nivel: 'N3', g: { patron: '〜わけではない', significado: { es: 'No es que…, no significa que…', en: "It's not that…" } } },
    { nivel: 'N3', g: { patron: '〜わけだ', significado: { es: 'Es lógico que…, por eso…', en: 'No wonder…' } } },
    { nivel: 'N2', g: { patron: '〜ものの', significado: { es: 'Aunque…, si bien…', en: 'Although…' } } },
    { nivel: 'N4', g: { patron: '〜ても', significado: { es: 'Aunque', en: 'Even if' } } },
  ];

  it('por su forma, con o sin 〜', () => {
    expect(buscarGramatica(puntos, 'わけ', 'es').map((p) => p.g.patron)).toEqual(['〜わけではない', '〜わけだ']);
    expect(buscarGramatica(puntos, '〜わけだ', 'es')[0].g.patron).toBe('〜わけだ');
  });

  it('en una frase que lo lleva', () => {
    expect(buscarGramatica(puntos, '嫌いなわけではない', 'es')[0].g.patron).toBe('〜わけではない');
  });

  it('por su significado, en el idioma de la interfaz', () => {
    expect(buscarGramatica(puntos, 'aunque', 'es').map((p) => p.g.patron)).toEqual(['〜ても', '〜ものの']);
    expect(buscarGramatica(puntos, 'although', 'de').map((p) => p.g.patron)).toEqual(['〜ものの']);
  });
});
