import { describe, expect, it } from 'vitest';
import type { LineaTexto } from './capaTexto';
import { GUION_BLANDO, parrafosDe, separador, unirRenglones } from './parrafos';

/** Un renglón de un libro en horizontal: letras de 0,04 de ancho y 0,03 de alto, salvo que se diga otra cosa. */
const renglon = (texto: string, x0: number, x1: number, y0: number, alto = 0.03): LineaTexto => ({ texto, vertical: false, caja: { x0, x1, y0, y1: y0 + alto } });
/** Una columna de un libro en vertical, que se lee de arriba abajo. */
const columna = (texto: string, x0: number, y0: number, y1: number): LineaTexto => ({ texto, vertical: true, caja: { x0, x1: x0 + 0.03, y0, y1 } });

const veinte = '吾輩は猫である名前はまだ無いどこで生れたかとん';
const de = (n: number, desde = 0) => [...veinte].slice(desde, desde + n).join('');

describe('los párrafos de una página', () => {
  it('juntan los renglones de cada párrafo, que acaba en un renglón corto, y empiezan otro con sangría', () => {
    const lineas = [
      renglon(de(19), 0.14, 0.9, 0.1),
      renglon(de(20), 0.1, 0.9, 0.15),
      renglon(de(10), 0.1, 0.5, 0.2),
      renglon(de(19, 1), 0.14, 0.9, 0.25),
      renglon(de(5), 0.1, 0.3, 0.3),
    ];
    const p = parrafosDe(lineas);
    expect(p.map((x) => x.lineas)).toEqual([[0, 1, 2], [3, 4]]);
    expect(p[0].texto).toBe(de(19) + de(20) + de(10));
    expect(p.every((x) => !x.titulo)).toBe(true);
  });

  it('un renglón entero sin sangría detrás de otro entero sigue el párrafo; con un hueco grande, no', () => {
    const juntos = [renglon(de(20), 0.1, 0.9, 0.1), renglon(de(20), 0.1, 0.9, 0.15), renglon(de(20), 0.1, 0.9, 0.2)];
    expect(parrafosDe(juntos)).toHaveLength(1);
    const separados = [renglon(de(20), 0.1, 0.9, 0.1), renglon(de(20), 0.1, 0.9, 0.15), renglon(de(20), 0.1, 0.9, 0.3)];
    expect(parrafosDe(separados).map((x) => x.lineas)).toEqual([[0, 1], [2]]);
  });

  it('una línea mucho más gruesa que las del texto es un título, aparte', () => {
    const lineas = [
      renglon('第一章　はじめに', 0.1, 0.5, 0.03, 0.05),
      renglon(de(19), 0.14, 0.9, 0.12),
      renglon(de(20), 0.1, 0.9, 0.17),
      renglon(de(8), 0.1, 0.42, 0.22),
    ];
    const p = parrafosDe(lineas);
    expect(p).toHaveLength(2);
    expect(p[0]).toMatchObject({ texto: '第一章　はじめに', titulo: true, lineas: [0] });
    expect(p[1].titulo).toBe(false);
  });

  it('en vertical, las columnas se juntan de derecha a izquierda', () => {
    const lineas = [columna(de(19), 0.85, 0.14, 0.9), columna(de(20), 0.8, 0.1, 0.9), columna(de(10), 0.75, 0.1, 0.5), columna(de(19, 1), 0.7, 0.14, 0.9)];
    expect(parrafosDe(lineas).map((x) => x.lineas)).toEqual([[0, 1, 2], [3]]);
  });

  it('en inglés, con espacio entre renglones y sin el guion que parte una palabra', () => {
    const lineas = [
      renglon('The quick brown fox jumps over the lazy dog and keeps run-', 0.1, 0.9, 0.1, 0.025),
      renglon('ning through the field until the sun goes down at last.', 0.1, 0.86, 0.14, 0.025),
      renglon('Then it rests.', 0.1, 0.3, 0.18, 0.025),
      renglon('A new day begins and the fox wakes up early in the morning', 0.14, 0.9, 0.22, 0.025),
    ];
    const p = parrafosDe(lineas);
    expect(p.map((x) => x.lineas)).toEqual([[0, 1, 2], [3]]);
    expect(p[0].texto).toBe('The quick brown fox jumps over the lazy dog and keeps running through the field until the sun goes down at last. Then it rests.');
  });

  it('un número de página suelto no es un párrafo; unos puntos suspensivos sí', () => {
    const lineas = [renglon(de(20), 0.1, 0.9, 0.1), renglon(de(20), 0.1, 0.9, 0.15), renglon(de(6), 0.1, 0.34, 0.2), renglon('……', 0.1, 0.18, 0.4), renglon('- 12 -', 0.45, 0.55, 0.95)];
    expect(parrafosDe(lineas).map((x) => x.texto)).toEqual([de(20) + de(20) + de(6), '……']);
  });

  it('en un manga, cada globo es un párrafo', () => {
    const globos = [columna('待って！', 0.8, 0.1, 0.3), columna('一緒に行こうよ！', 0.76, 0.1, 0.4)];
    expect(parrafosDe(globos, { globos: true }).map((x) => x.texto)).toEqual(['待って！', '一緒に行こうよ！']);
  });

  it('cada elemento de una lista es un párrafo, con sus renglones de sangría francesa', () => {
    const lineas = [
      renglon('(1)' + de(17), 0.1, 0.9, 0.1),
      renglon(de(18), 0.18, 0.9, 0.15),
      renglon(de(5), 0.18, 0.38, 0.2),
      renglon('(2)' + de(17), 0.1, 0.9, 0.25),
      renglon('(3)' + de(4), 0.1, 0.38, 0.3),
    ];
    const p = parrafosDe(lineas);
    expect(p.map((x) => x.lineas)).toEqual([[0, 1, 2], [3], [4]]);
    expect(p[0].texto.startsWith('(1)')).toBe(true);
  });

  it('cada lengua añade sus marcas: quien habla en un diálogo abre párrafo y su texto sigue debajo con sangría', () => {
    const marca = /^\s*[^\s：]{1,6}：/;
    const lineas = [renglon('母親：' + de(17), 0.1, 0.9, 0.1), renglon(de(18), 0.22, 0.9, 0.15), renglon('息子：' + de(5), 0.1, 0.42, 0.2)];
    expect(parrafosDe(lineas, { marca }).map((x) => x.lineas)).toEqual([[0, 1], [2]]);
    // Sin la marca de la lengua, la sangría parte el primero y el segundo personaje se pega a él.
    expect(parrafosDe(lineas).map((x) => x.lineas)).toEqual([[0], [1, 2]]);
  });

  it('una letra suelta del margen, leída entre dos renglones, no parte el párrafo ni sale en el texto', () => {
    const lineas = [
      renglon(de(20), 0.1, 0.9, 0.1),
      renglon('C', 0.93, 0.95, 0.13, 0.01),
      renglon(de(20), 0.1, 0.9, 0.15),
      renglon('2', 0.93, 0.95, 0.18, 0.01),
      renglon('3', 0.93, 0.95, 0.19, 0.01),
      renglon('4', 0.93, 0.95, 0.2, 0.01),
      renglon(de(6), 0.1, 0.34, 0.2),
    ];
    expect(parrafosDe(lineas).map((x) => x.lineas)).toEqual([[0, 2, 6]]);
  });

  it('un renglón largo con algo en negrita no es un título aunque su caja sea más alta', () => {
    const lineas = [renglon(de(20) + de(10), 0.1, 0.9, 0.1, 0.045), renglon(de(20), 0.1, 0.9, 0.16), renglon(de(20), 0.1, 0.9, 0.21), renglon(de(5), 0.1, 0.3, 0.26)];
    const p = parrafosDe(lineas);
    expect(p.map((x) => x.lineas)).toEqual([[0, 1, 2, 3]]);
    expect(p[0].titulo).toBe(false);
  });

  it('dos renglones cortos seguidos no se juntan si la columna es más ancha', () => {
    const lineas = [renglon(de(20), 0.1, 0.9, 0.1), renglon(de(6), 0.1, 0.34, 0.15), renglon(de(5), 0.1, 0.3, 0.2), renglon(de(20), 0.1, 0.9, 0.25)];
    expect(parrafosDe(lineas).map((x) => x.lineas)).toEqual([[0, 1], [2], [3]]);
  });

  it('sin líneas, sin párrafos', () => {
    expect(parrafosDe([])).toEqual([]);
    expect(parrafosDe([renglon('   ', 0.1, 0.2, 0.1)])).toEqual([]);
  });
});

describe('unir renglones', () => {
  it('pone espacio solo entre palabras de lenguas que los usan', () => {
    expect(separador('猫だ', 'と思う')).toBe('');
    expect(separador('the', 'cat')).toBe(' ');
    expect(separador('pH', 'の値')).toBe('');
    expect(separador('the ', 'cat')).toBe('');
  });

  it('quita el guion de una palabra partida, pero no el de un compuesto con mayúscula', () => {
    expect(unirRenglones('das Verständ-', 'nis')).toBe('das Verständnis');
    expect(unirRenglones('in Baden-', 'Württemberg')).toBe('in Baden-Württemberg');
    expect(unirRenglones(`a soft${GUION_BLANDO}`, 'ware')).toBe('a software');
    expect(unirRenglones('漢字の', '読み方')).toBe('漢字の読み方');
  });
});
