import { describe, expect, it } from 'vitest';
import {
  anadirDictado,
  grabacionesSinUso,
  idDeMarca,
  idsDeDictado,
  MARGEN_SIN_USO_MS,
  marcaDictado,
  minutosYSegundos,
  nivelDeVoz,
  nuevoIdDictado,
  textoDeLineas,
} from './dictado';

describe('la marca que une un párrafo con su grabación', () => {
  it('se escribe como un comentario de HTML y se vuelve a leer', () => {
    const marca = marcaDictado('mh7k2x1a-0f3z');
    expect(marca).toBe('<!-- dictado:mh7k2x1a-0f3z -->');
    expect(idDeMarca(marca)).toBe('mh7k2x1a-0f3z');
  });

  it('admite espacios alrededor, pero tiene que ocupar la línea entera', () => {
    expect(idDeMarca('  <!--dictado:abcd-->  ')).toBe('abcd');
    expect(idDeMarca('Texto <!-- dictado:abcd -->')).toBeNull();
    expect(idDeMarca('<!-- dictado:abcd --> y más')).toBeNull();
  });

  it('un comentario cualquiera o un id raro no son marcas', () => {
    expect(idDeMarca('<!-- nota: abcd -->')).toBeNull();
    expect(idDeMarca('<!-- dictado:ab -->')).toBeNull();
    expect(idDeMarca('<!-- dictado:ab cd -->')).toBeNull();
    expect(idDeMarca('<!-- dictado:../../x -->')).toBeNull();
  });

  it('las grabaciones de un texto salen en orden y sin repetir', () => {
    const texto = `${marcaDictado('aaaa-1')}\n一つ目。\n\n普通の段落。\n\n${marcaDictado('bbbb-2')}\n二つ目。\n\n${marcaDictado('aaaa-1')}\nコピー。`;
    expect(idsDeDictado(texto)).toEqual(['aaaa-1', 'bbbb-2']);
    expect(idsDeDictado('Sin dictados.')).toEqual([]);
  });

  it('los ids nuevos no se repiten y tienen la forma de la marca', () => {
    const a = nuevoIdDictado(1_762_600_000_000, 0);
    const b = nuevoIdDictado(1_762_600_000_000, 0.5);
    expect(a).not.toBe(b);
    expect(idDeMarca(marcaDictado(a))).toBe(a);
    expect(idDeMarca(marcaDictado(nuevoIdDictado()))).not.toBeNull();
  });
});

describe('el texto de un dictado', () => {
  it('en japonés, las líneas van seguidas con su puntuación', () => {
    expect(textoDeLineas(['今日はいい天気ですね。', '散歩に行きましょう。'], false)).toBe('今日はいい天気ですね。散歩に行きましょう。');
  });

  it('en inglés y en alemán, separadas por un espacio', () => {
    expect(textoDeLineas([' The weather is nice today, ', 'so let’s go for a walk.'], true)).toBe('The weather is nice today, so let’s go for a walk.');
  });

  it('las líneas vacías no cuentan', () => {
    expect(textoDeLineas(['', '  ', 'Hallo.'], true)).toBe('Hallo.');
    expect(textoDeLineas([], false)).toBe('');
  });

  it('se añade al final en su propio párrafo, con la marca delante', () => {
    expect(anadirDictado('', 'abcd', ' 一つ目。 ')).toBe('<!-- dictado:abcd -->\n一つ目。');
    expect(anadirDictado('前の文。\n\n\n', 'abcd', '一つ目。')).toBe('前の文。\n\n<!-- dictado:abcd -->\n一つ目。');
  });
});

describe('las grabaciones que se pueden borrar', () => {
  const ahora = 1_800_000_000_000;
  const viejo = ahora - MARGEN_SIN_USO_MS - 1;
  const grabaciones = [
    { id: 'usada', creado: viejo },
    { id: 'sin-uso', creado: viejo },
    { id: 'reciente', creado: ahora - 60_000 },
  ];

  it('solo las que ningún texto usa y llevan guardadas más del margen', () => {
    const textos = [`${marcaDictado('usada')}\nまだある。`, 'Otro texto.'];
    expect(grabacionesSinUso(grabaciones, textos, ahora)).toEqual(['sin-uso']);
  });

  it('sin textos, ninguna reciente', () => {
    expect(grabacionesSinUso(grabaciones, [], ahora)).toEqual(['usada', 'sin-uso']);
  });
});

describe('tiempos y nivel', () => {
  it('minutos y segundos', () => {
    expect(minutosYSegundos(0)).toBe('0:00');
    expect(minutosYSegundos(7_900)).toBe('0:07');
    expect(minutosYSegundos(65_000)).toBe('1:05');
    expect(minutosYSegundos(750_000)).toBe('12:30');
    expect(minutosYSegundos(-5)).toBe('0:00');
  });

  it('el silencio da 0, la voz normal queda en medio y lo muy fuerte llega a 1', () => {
    const tono = (amplitud: number) => Float32Array.from({ length: 1600 }, (_, i) => amplitud * Math.sin(i / 3));
    expect(nivelDeVoz(new Float32Array(1600))).toBe(0);
    expect(nivelDeVoz(new Float32Array(0))).toBe(0);
    const normal = nivelDeVoz(tono(0.05));
    expect(normal).toBeGreaterThan(0.3);
    expect(normal).toBeLessThan(0.8);
    expect(nivelDeVoz(tono(0.9))).toBe(1);
    expect(nivelDeVoz(tono(0.0005))).toBe(0);
  });
});
