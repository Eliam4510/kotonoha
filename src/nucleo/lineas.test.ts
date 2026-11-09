import { describe, expect, it } from 'vitest';
import { partirLineas, tamanoQueCabe } from './lineas';

// Una letra de ancho fijo: cada carácter mide 1, o 2 si es de ancho completo, como en un terminal.
const medir = (s: string) => [...s].reduce((n, c) => n + (c.codePointAt(0)! > 0x2e7f ? 2 : 1), 0);
const textos = (texto: string, ancho: number, maximo?: number) => partirLineas(texto, medir, ancho, maximo).map((l) => l.texto);

describe('partirLineas', () => {
  it('parte el latín por palabras, sin el espacio del final', () => {
    expect(textos('Alice was beginning to get very tired', 16)).toEqual(['Alice was', 'beginning to get', 'very tired']);
  });

  it('parte el japonés entre caracteres', () => {
    expect(textos('吾輩は猫である名前はまだ無い', 10)).toEqual(['吾輩は猫で', 'ある名前は', 'まだ無い']);
  });

  it('no empieza una línea con un signo de cierre: cuelga de la anterior', () => {
    expect(textos('吾輩は猫である。名前', 14)).toEqual(['吾輩は猫である。', '名前']);
    expect(textos('ちょっと待って', 8)).toEqual(['ちょっと', '待って']);
    expect(textos('ちょっと', 6)).toEqual(['ちょっ', 'と']);
  });

  it('no termina una línea con una apertura', () => {
    expect(textos('彼は「猫だ」と言った', 6)).toEqual(['彼は', '「猫だ」', 'と言っ', 'た']);
  });

  it('respeta los saltos de línea del texto y sus posiciones', () => {
    const l = partirLineas('uno dos\ntres', medir, 20);
    expect(l.map((x) => [x.texto, x.inicio, x.fin])).toEqual([
      ['uno dos', 0, 7],
      ['tres', 8, 12],
    ]);
  });

  it('parte por caracteres una palabra más ancha que la línea', () => {
    expect(textos('Donaudampfschifffahrt ist lang', 10)).toEqual(['Donaudampf', 'schifffahr', 't ist lang']);
  });

  it('corta con «…» lo que no cabe en las líneas permitidas', () => {
    const l = partirLineas('Alice was beginning to get very tired of sitting', medir, 16, 2);
    expect(l.map((x) => x.texto)).toEqual(['Alice was', 'beginning to ge…']);
    expect(l[1].cortada).toBe(true);
    expect(l[1].ancho).toBeLessThanOrEqual(16);
  });

  it('mezcla latín y japonés', () => {
    expect(textos('Tシャツを買った', 8)).toEqual(['Tシャツ', 'を買った']);
  });
});

describe('tamanoQueCabe', () => {
  it('reduce la letra hasta que el texto cabe, sin bajar del mínimo', () => {
    expect(tamanoQueCabe((t) => t * 5, 300, 120, 40)).toBe(60);
    expect(tamanoQueCabe((t) => t * 50, 300, 120, 40)).toBe(40);
  });
});
