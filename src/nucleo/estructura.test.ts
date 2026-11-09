import { describe, expect, it } from 'vitest';
import { type Bloque, estructuraDeNodo, frasesDeBloques, leerEstructura, leerLinea, type NodoHtml, normalizarTextoPlano, textoPlano } from './estructura';

const texto = (s: string): NodoHtml => ({ nodeType: 3, nodeName: '#text', nodeValue: s, childNodes: [] });
const el = (nombre: string, hijos: (NodoHtml | string)[] = [], atributos: Record<string, string> = {}): NodoHtml => ({
  nodeType: 1,
  nodeName: nombre.toUpperCase(),
  nodeValue: null,
  childNodes: hijos.map((h) => (typeof h === 'string' ? texto(h) : h)),
  getAttribute: (a) => atributos[a] ?? null,
});
const comentario: NodoHtml = { nodeType: 8, nodeName: '#comment', nodeValue: 'StartFragment', childNodes: [] };

const lineas = (b: Bloque) => ('lineas' in b ? b.lineas.map((l) => l.texto) : []);

describe('leer el texto con estructura', () => {
  it('un texto sin marcas conserva cada salto de línea y separa los párrafos por líneas en blanco', () => {
    const b = leerEstructura('一行目です。\n二行目です。\n\n次の段落。');
    expect(b.map((x) => x.tipo)).toEqual(['parrafo', 'parrafo']);
    expect(lineas(b[0])).toEqual(['一行目です。', '二行目です。']);
    expect(lineas(b[1])).toEqual(['次の段落。']);
  });

  it('la sangría japonesa de espacio ancho se queda; la de espacios normales no', () => {
    const b = leerEstructura('　昔々あるところに。\n   indented');
    expect(lineas(b[0])).toEqual(['　昔々あるところに。', 'indented']);
  });

  it('títulos de tres niveles como mucho', () => {
    const b = leerEstructura('# Uno\n## Dos\n#### Cuatro');
    expect(b).toEqual([
      { tipo: 'titulo', nivel: 1, linea: { texto: 'Uno', negritas: [] } },
      { tipo: 'titulo', nivel: 2, linea: { texto: 'Dos', negritas: [] } },
      { tipo: 'titulo', nivel: 3, linea: { texto: 'Cuatro', negritas: [] } },
    ]);
  });

  it('listas con viñetas, anidadas y numeradas, también las japonesas', () => {
    const [anidada] = leerEstructura('- a\n  - b\n    - c\n- d');
    expect(anidada.tipo === 'lista' && anidada.elementos.map((e) => [e.nivel, e.lineas[0].texto])).toEqual([[0, 'a'], [1, 'b'], [2, 'c'], [0, 'd']]);
    const [japonesa] = leerEstructura('・りんご\n・みかん');
    expect(japonesa.tipo === 'lista' && japonesa.elementos.map((e) => e.lineas[0].texto)).toEqual(['りんご', 'みかん']);
    const [numerada] = leerEstructura('１．はじめに\n２．つぎに');
    expect(numerada.tipo === 'lista' && numerada.elementos.map((e) => [e.ordenada, e.numero, e.lineas[0].texto])).toEqual([[true, 1, 'はじめに'], [true, 2, 'つぎに']]);
  });

  it('una lista de otro tipo es otra lista, y una línea sin sangría después de la lista es un párrafo', () => {
    const b = leerEstructura('- a\n1. uno\n2. dos\nPárrafo.');
    expect(b.map((x) => x.tipo)).toEqual(['lista', 'lista', 'parrafo']);
  });

  it('una línea con sangría continúa el elemento de la lista', () => {
    const [l] = leerEstructura('- primera línea\n  segunda línea');
    expect(l.tipo === 'lista' && l.elementos[0].lineas.map((x) => x.texto)).toEqual(['primera línea', 'segunda línea']);
  });

  it('citas, código y separadores', () => {
    const b = leerEstructura('> uno\n> dos\n\n```\n  x = 1\n\nfin\n```\n\n---');
    expect(b.map((x) => x.tipo)).toEqual(['cita', 'codigo', 'separador']);
    expect(lineas(b[0])).toEqual(['uno', 'dos']);
    expect(lineas(b[1])).toEqual(['  x = 1', '', 'fin']);
  });

  it('tablas con cabecera, sin ella y con una barra escapada dentro de una celda', () => {
    const [con] = leerEstructura('| 語 | 意味 |\n| --- | :-: |\n| 猫 | a\\|b |');
    expect(con.tipo === 'tabla' && [con.cabecera?.map((c) => c.texto), con.filas.map((f) => f.map((c) => c.texto))]).toEqual([['語', '意味'], [['猫', 'a|b']]]);
    const [sin] = leerEstructura('| --- | --- |\n| 1 | 2 |');
    expect(sin.tipo === 'tabla' && [sin.cabecera, sin.filas.map((f) => f.map((c) => c.texto))]).toEqual([null, [['1', '2']]]);
  });

  it('una línea escapada no es una marca', () => {
    const b = leerEstructura('\\# no es un título\n\\- ni una lista');
    expect(b.map((x) => x.tipo)).toEqual(['parrafo']);
    expect(lineas(b[0])).toEqual(['# no es un título', '- ni una lista']);
  });
});

describe('las marcas dentro de una línea', () => {
  it('negritas con su posición en el texto ya limpio', () => {
    expect(leerLinea('これは**大事**です')).toEqual({ texto: 'これは大事です', negritas: [[3, 5]] });
  });

  it('unas ** sin pareja son texto, y unas escapadas también', () => {
    expect(leerLinea('**注意')).toEqual({ texto: '**注意', negritas: [] });
    expect(leerLinea('a \\*\\* b')).toEqual({ texto: 'a ** b', negritas: [] });
  });

  it('enlaces, código y cursivas dejan solo su texto', () => {
    expect(leerLinea('[辞書](https://example.org/x)と`code`と*斜体*').texto).toBe('辞書とcodeと斜体');
  });
});

describe('las frases de cada línea', () => {
  it('cada frase sabe dónde empieza en su línea, y el código no se parte', () => {
    const b = leerEstructura('今日は晴れ。明日は雨。\n\n```\na。b。\n```');
    const { frases, deLinea } = frasesDeBloques(b, /(?<=[。！？!?])/);
    expect(frases).toEqual(['今日は晴れ。', '明日は雨。', 'a。b。']);
    const primera = (b[0] as { lineas: never[] }).lineas[0];
    expect(deLinea.get(primera)).toEqual([{ indice: 0, inicio: 0 }, { indice: 1, inicio: 6 }]);
  });
});

describe('el texto plano para Claude', () => {
  it('sin marcas, con las listas y las tablas legibles', () => {
    expect(textoPlano(leerEstructura('## 見出し\n\n- りんご\n- **みかん**\n\n| a | b |\n|---|---|\n| 1 | 2 |'))).toBe('見出し\n\n• りんご\n• みかん\n\na | b\n1 | 2');
  });
});

describe('del HTML copiado a la estructura', () => {
  it('títulos, párrafos con sus saltos, listas anidadas y el furigana de la página fuera', () => {
    const html = el('body', [
      comentario,
      el('h2', ['見出し']),
      el('p', ['一行目', el('br'), '二行目']),
      el('ul', [el('li', ['りんご']), el('li', ['みかん', el('ul', [el('li', ['温州'])])])]),
      el('p', [el('ruby', ['漢字', el('rp', ['(']), el('rt', ['かんじ']), el('rp', [')'])]), 'を読む']),
      el('script', ['alert(1)']),
      el('div', ['見えない'], { hidden: '' }),
    ]);
    expect(estructuraDeNodo(html)).toBe('## 見出し\n\n一行目\n二行目\n\n- りんご\n- みかん\n  - 温州\n\n漢字を読む');
  });

  it('los espacios del código fuente: entre japonés desaparecen, entre palabras quedan en uno', () => {
    expect(estructuraDeNodo(el('p', ['日本語の\n    文章です。']))).toBe('日本語の文章です。');
    expect(estructuraDeNodo(el('p', ['Hello\n    world'])).toString()).toBe('Hello world');
  });

  it('dos saltos seguidos son otro párrafo', () => {
    expect(estructuraDeNodo(el('p', ['a', el('br'), el('br'), 'b']))).toBe('a\n\nb');
  });

  it('negritas, también con estilo, y el envoltorio sin negrita de Google Docs', () => {
    expect(estructuraDeNodo(el('p', ['これは', el('strong', ['大事']), 'です']))).toBe('これは**大事**です');
    expect(estructuraDeNodo(el('p', [el('span', ['重要'], { style: 'font-weight: 700' })]))).toBe('**重要**');
    expect(estructuraDeNodo(el('b', [el('p', ['普通の文'])], { style: 'font-weight:normal;' }))).toBe('普通の文');
  });

  it('tablas con cabecera y una barra dentro de una celda, que se leen de vuelta igual', () => {
    const md = estructuraDeNodo(
      el('table', [el('tbody', [el('tr', [el('th', ['語']), el('th', ['意味'])]), el('tr', [el('td', ['猫']), el('td', ['a|b'])])])])
    );
    expect(md).toBe('| 語 | 意味 |\n| --- | --- |\n| 猫 | a\\|b |');
    const [t] = leerEstructura(md);
    expect(t.tipo === 'tabla' && t.filas[0].map((c) => c.texto)).toEqual(['猫', 'a|b']);
  });

  it('código tal cual, citas y separadores', () => {
    expect(estructuraDeNodo(el('pre', ['const a = 1;\n  b();\n']))).toBe('```\nconst a = 1;\n  b();\n```');
    expect(estructuraDeNodo(el('blockquote', [el('p', ['引用です'])]))).toBe('> 引用です');
    expect(estructuraDeNodo(el('div', [el('p', ['a']), el('hr'), el('p', ['b'])]))).toBe('a\n\n---\n\nb');
  });

  it('un párrafo que empieza como una marca se escapa, y vuelve a leerse como texto', () => {
    const md = estructuraDeNodo(el('p', ['# no es un título']));
    expect(md).toBe('\\# no es un título');
    expect(lineas(leerEstructura(md)[0])).toEqual(['# no es un título']);
  });

  it('unos asteriscos de verdad no se convierten en negrita', () => {
    const md = estructuraDeNodo(el('p', ['5**2 es 25']));
    expect(leerLinea(md)).toEqual({ texto: '5**2 es 25', negritas: [] });
  });
});

describe('el texto plano tal como llega', () => {
  it('normaliza los saltos y quita los espacios del final de cada línea', () => {
    expect(normalizarTextoPlano('a  \r\nb\r\n\r\n\r\n\r\nc')).toBe('a\nb\n\nc');
  });
});

describe('los dictados en el texto', () => {
  it('la marca es un bloque propio, encima del párrafo que salió de la grabación', () => {
    const b = leerEstructura('前の段落。\n<!-- dictado:abcd-1234 -->\n今日はいい天気ですね。');
    expect(b.map((x) => x.tipo)).toEqual(['parrafo', 'dictado', 'parrafo']);
    expect(b[1]).toEqual({ tipo: 'dictado', id: 'abcd-1234' });
    expect(lineas(b[2])).toEqual(['今日はいい天気ですね。']);
  });

  it('dentro de un bloque de código es texto', () => {
    const [codigo] = leerEstructura('```\n<!-- dictado:abcd-1234 -->\n```');
    expect(codigo.tipo).toBe('codigo');
    expect(lineas(codigo)).toEqual(['<!-- dictado:abcd-1234 -->']);
  });

  it('no da frases ni entra en el texto plano', () => {
    const b = leerEstructura('<!-- dictado:abcd-1234 -->\nHallo. Wie geht es dir?');
    expect(frasesDeBloques(b, /(?<=[.?!])\s+/).frases).toEqual(['Hallo.', 'Wie geht es dir?']);
    expect(textoPlano(b)).toBe('Hallo. Wie geht es dir?');
  });
});
