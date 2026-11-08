import { describe, expect, it } from 'vitest';
import { buscarEnPagina, consultaDe, fragmentoDe, indiceDe, letraDeBusqueda } from './busqueda';

const ja = { sinEspacios: true };
const en = { sinEspacios: false };
const lineas = (...t: string[]) => t.map((texto) => ({ texto }));
const buscar = (l: { texto: string }[], q: string, o = ja) => buscarEnPagina(4, l, consultaDe(q, o), o);

describe('las letras al buscar', () => {
  it('no distinguen anchos, mayúsculas ni hiragana y katakana', () => {
    expect(letraDeBusqueda('Ａ')).toBe('a');
    expect(letraDeBusqueda('ｶ')).toBe('か');
    expect(letraDeBusqueda('カ')).toBe('か');
    expect(letraDeBusqueda('ヴ')).toBe('ゔ');
    expect(letraDeBusqueda('ー')).toBe('ー');
    expect(consultaDe('  テ レ ビ ', ja)).toBe('てれび');
    expect(consultaDe('  Big   Dog ', en)).toBe('big dog');
  });
});

describe('buscar en una página', () => {
  it('encuentra una palabra partida entre dos renglones, con lo que ocupa en cada uno', () => {
    const h = buscar(lineas('今日は冷蔵', '庫を買った。'), '冷蔵庫');
    expect(h).toHaveLength(1);
    expect(h[0].pagina).toBe(4);
    expect(h[0].tramos).toEqual([
      { linea: 0, inicio: 3, fin: 5 },
      { linea: 1, inicio: 0, fin: 1 },
    ]);
    expect(h[0]).toMatchObject({ antes: '今日は', texto: '冷蔵庫', despues: 'を買った。' });
  });

  it('en japonés, sin espacios y sin distinguir hiragana y katakana', () => {
    expect(buscar(lineas('冷 蔵 庫'), '冷蔵庫')[0].tramos).toEqual([{ linea: 0, inicio: 0, fin: 5 }]);
    expect(buscar(lineas('テレビを見る'), 'てれび')).toHaveLength(1);
    expect(buscar(lineas('テレビを見る'), 'ＴＶ')).toHaveLength(0);
  });

  it('en inglés, con espacio entre renglones y la palabra partida con guion entera', () => {
    const l = lineas('The refri-', 'gerator is cold.');
    expect(buscar(l, 'refrigerator', en)[0].tramos).toEqual([
      { linea: 0, inicio: 4, fin: 9 },
      { linea: 1, inicio: 0, fin: 7 },
    ]);
    const h = buscar(lineas('the big', 'dog'), 'Big Dog', en);
    expect(h[0].tramos).toEqual([
      { linea: 0, inicio: 4, fin: 7 },
      { linea: 1, inicio: 0, fin: 3 },
    ]);
    expect(buscar(lineas('bigdog'), 'big dog', en)).toHaveLength(0);
  });

  it('cada vez que aparece, sin solaparse', () => {
    expect(buscar(lineas('ああああ'), 'ああ')).toHaveLength(2);
    expect(buscar(lineas('猫と猫', '猫'), '猫').map((h) => h.tramos[0])).toEqual([
      { linea: 0, inicio: 0, fin: 1 },
      { linea: 0, inicio: 2, fin: 3 },
      { linea: 1, inicio: 0, fin: 1 },
    ]);
  });

  it('con letras fuera del plano básico, que ocupan dos unidades', () => {
    expect(buscar(lineas('𠮷野家の牛丼'), '𠮷野')[0].tramos).toEqual([{ linea: 0, inicio: 0, fin: 3 }]);
  });

  it('nada si no se busca nada', () => {
    expect(buscar(lineas('猫'), '   ')).toEqual([]);
  });

  it('enseña un poco de texto a cada lado, con puntos suspensivos si sigue', () => {
    const largo = 'あいうえおかきくけこさしすせそたちつてとなにぬねの';
    const l = lineas(largo + '冷蔵庫' + largo);
    const f = fragmentoDe(l, buscar(l, '冷蔵庫')[0].tramos);
    expect(f.texto).toBe('冷蔵庫');
    expect(f.antes.startsWith('…')).toBe(true);
    expect(f.despues.endsWith('…')).toBe(true);
    expect([...f.antes].length).toBe(17);
  });

  it('el índice de una página se puede reutilizar para varias búsquedas', () => {
    const l = lineas('猫が好き', '犬も好き');
    const ind = indiceDe(l, ja);
    expect(ind.texto).toBe('猫が好き犬も好き');
    expect(buscarEnPagina(0, l, '好き', ja, ind)).toHaveLength(2);
    expect(buscarEnPagina(0, l, '好き', ja, ind, 1)).toHaveLength(1);
  });
});
