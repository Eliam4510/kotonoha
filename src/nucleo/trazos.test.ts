import { describe, expect, it } from 'vitest';
import { hechosPorCaracter, leerTrazos } from './trazos';

const SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="109" height="109" viewBox="0 0 109 109" xmlns:kvg="https://kanjivg.tagaini.net/">
<g id="kvg:StrokePaths_04eba" style="fill:none;stroke:#000000;stroke-width:3;">
<g id="kvg:04eba" kvg:element="人">
  <path id="kvg:04eba-s2" kvg:type="㇏" d="M50.5,41.5c5,10,25.5,41,44,50.5"/>
  <path id="kvg:04eba-s1" kvg:type="㇒" d="M53.5,14.5c0,5-15,60-44,78.5"/>
</g>
</g>
<g id="kvg:StrokeNumbers_04eba" style="font-size:8;fill:#808080">
  <text transform="matrix(1 0 0 1 45.50 13.50)">1</text>
  <text transform="matrix(1 0 0 1 57.75 48.50)">2</text>
</g>
</svg>`;

describe('leerTrazos', () => {
  it('ordena los trazos por su número, no por su posición en el archivo', () => {
    const d = leerTrazos(SVG);
    expect(d?.trazos).toEqual(['M53.5,14.5c0,5-15,60-44,78.5', 'M50.5,41.5c5,10,25.5,41,44,50.5']);
  });

  it('saca dónde va cada número', () => {
    expect(leerTrazos(SVG)?.numeros).toEqual([{ x: 45.5, y: 13.5 }, { x: 57.75, y: 48.5 }]);
  });

  it('sin números, pone cada uno donde empieza su trazo', () => {
    const sinNumeros = SVG.replace(/<text[^>]*>\d+<\/text>/g, '');
    expect(leerTrazos(sinNumeros)?.numeros).toEqual([{ x: 53.5, y: 14.5 }, { x: 50.5, y: 41.5 }]);
  });

  it('un archivo sin trazos no da nada', () => {
    expect(leerTrazos('<svg></svg>')).toBeNull();
    expect(leerTrazos('Not found')).toBeNull();
  });

  it('descarta lo que no sean órdenes de trazado', () => {
    const malo = '<svg><path id="x-s1" d="M0,0"/><path id="x-s2" d="javascript:alert(1)"/><path id="x-s3" d="M1,1\\"onload=\\"x"/></svg>';
    expect(leerTrazos(malo)?.trazos).toEqual(['M0,0']);
  });
});

// El de KanjiVG para 愛, sin los trazados: lo que importa son sus grupos.
const AI = `<svg xmlns:kvg="https://kanjivg.tagaini.net/">
<g id="kvg:StrokePaths_0611b">
<g id="kvg:0611b" kvg:element="愛">
  <g id="kvg:0611b-g1" kvg:element="⺤" kvg:variant="true" kvg:original="爪" kvg:position="top" kvg:radical="nelson" kvg:phon="旡">
    <path id="kvg:0611b-s1" d="M1,1"/>
  </g>
  <g id="kvg:0611b-g2" kvg:position="bottom">
    <g id="kvg:0611b-g3" kvg:element="冖"><path id="kvg:0611b-s5" d="M2,2"/></g>
    <g id="kvg:0611b-g4" kvg:element="心" kvg:radical="tradit"><path id="kvg:0611b-s7" d="M3,3"/></g>
    <g id="kvg:0611b-g5" kvg:element="夂"><path id="kvg:0611b-s11" d="M4,4"/></g>
  </g>
</g>
</g>
</svg>`;

// 漢: la mitad derecha es la que da el sonido, y dentro lleva otras piezas.
const KAN = `<svg>
<g id="kvg:StrokePaths_06f22">
<g id="kvg:06f22" kvg:element="漢">
  <g id="kvg:06f22-g1" kvg:element="氵" kvg:variant="true" kvg:original="水" kvg:position="left" kvg:radical="general"><path id="kvg:06f22-s1" d="M1,1"/></g>
  <g id="kvg:06f22-g2" kvg:position="right" kvg:phon="𦰩">
    <g id="kvg:06f22-g3" kvg:element="艹" kvg:original="艸"><path id="kvg:06f22-s4" d="M2,2"/></g>
    <g id="kvg:06f22-g4" kvg:position="bottom">
      <g id="kvg:06f22-g5" kvg:element="口"><path id="kvg:06f22-s7" d="M3,3"/></g>
      <g id="kvg:06f22-g6" kvg:element="夫"><g id="kvg:06f22-g7" kvg:element="大"><path id="kvg:06f22-s11" d="M4,4"/></g></g>
    </g>
  </g>
</g>
</g>
</svg>`;

describe('piezas de un carácter', () => {
  it('saca las piezas atravesando los grupos sin nombre, con su forma original y el radical', () => {
    const d = leerTrazos(AI);
    expect(d?.componentes).toEqual([
      { caracter: '⺤', original: '爪', piezas: [] },
      { caracter: '冖', piezas: [] },
      { caracter: '心', radical: true, piezas: [] },
      { caracter: '夂', piezas: [] },
    ]);
    expect(d?.fonetico).toBe('旡');
  });

  it('guarda lo que lleva dentro cada pieza y la parte que da el sonido', () => {
    const d = leerTrazos(KAN);
    expect(d?.componentes?.map((p) => p.caracter)).toEqual(['氵', '艹', '口', '夫']);
    expect(d?.componentes?.[0]).toMatchObject({ original: '水', radical: true });
    expect(d?.componentes?.[3].piezas).toEqual([{ caracter: '大', piezas: [] }]);
    expect(d?.fonetico).toBe('𦰩');
  });

  it('una pieza repetida dentro de un grupo sin nombre cuenta una vez', () => {
    const tres = `<svg><g kvg:element="三"><g kvg:element="一" kvg:radical="general"><path id="t-s1" d="M1,1"/></g><g kvg:position="bottom"><g kvg:element="一"><path id="t-s2" d="M2,2"/></g><g kvg:element="一"><path id="t-s3" d="M3,3"/></g></g></g></svg>`;
    expect(leerTrazos(tres)?.componentes).toEqual([{ caracter: '一', radical: true, piezas: [] }]);
  });

  it('una pieza partida en dos cuenta una vez, y lo que no es un carácter se descarta', () => {
    const partida = `<svg><g kvg:element="衷"><g kvg:element="衣" kvg:part="1"><path id="a-s1" d="M1,1"/></g><g kvg:element="中"><path id="a-s2" d="M2,2"/></g><g kvg:element="衣" kvg:part="2"><path id="a-s3" d="M3,3"/></g><g kvg:element="&lt;b&gt;"><path id="a-s4" d="M4,4"/></g></g></svg>`;
    expect(leerTrazos(partida)?.componentes?.map((p) => p.caracter)).toEqual(['衣', '中']);
  });

  it('un carácter sin grupos no tiene piezas', () => {
    expect(leerTrazos(SVG)?.componentes).toEqual([]);
  });
});

describe('hechosPorCaracter', () => {
  it('reparte los trazos dibujados entre los caracteres', () => {
    expect(hechosPorCaracter([4, 6], 0)).toEqual([0, 0]);
    expect(hechosPorCaracter([4, 6], 3)).toEqual([3, 0]);
    expect(hechosPorCaracter([4, 6], 4)).toEqual([4, 0]);
    expect(hechosPorCaracter([4, 6], 7)).toEqual([4, 3]);
    expect(hechosPorCaracter([4, 6], 10)).toEqual([4, 6]);
  });
});
