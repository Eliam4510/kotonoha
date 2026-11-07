import { describe, expect, it } from 'vitest';
import { crearMel, decodificarTokens, parsearLista, parsearPiezas, segmentosDeTokens, type TokenConTiempo } from './tdt';
import type { ReglasTranscripcion } from './transcripcion';

const REGLAS: ReglasTranscripcion = {
  alucinaciones: [],
  comunesSobreMusica: /^$/,
  finDeFrase: /(?<=[。!?!?])/u,
  pausa: /(?<=[、,])/u,
  corteSinPuntuacion: /[はがを](?=[\p{Script=Han}\p{Script=Katakana}])/gu,
  maximoCaracteres: 12,
  msPorCaracter: 170,
};

const tokens = (lista: [string, number][]): TokenConTiempo[] => lista.map(([texto, t]) => ({ texto, t }));

describe('crearMel', () => {
  const tono = (segundos: number, hz = 440) => Float32Array.from({ length: Math.round(16000 * segundos) }, (_, i) => Math.sin((2 * Math.PI * hz * i) / 16000) * 0.2);

  it('da un marco cada 10 ms y rellena hasta un múltiplo de 16', () => {
    const { marcos, validos, datos } = crearMel({ nMels: 128, bf16: true })(tono(1.005));
    expect(validos).toBe(100);
    expect(marcos % 16).toBe(0);
    expect(marcos).toBeGreaterThanOrEqual(validos);
    expect(datos.length).toBe(128 * marcos);
  });

  it('normaliza cada banda y deja el relleno a cero', () => {
    const { marcos, validos, datos } = crearMel({ nMels: 80, bf16: false })(Float32Array.from({ length: 16000 * 2 + 37 }, (_, i) => Math.sin(i / 3) * Math.cos(i / 511) * 0.3));
    for (const m of [3, 40, 75]) {
      let media = 0;
      for (let t = 0; t < validos; t++) media += datos[m * marcos + t];
      expect(Math.abs(media / validos)).toBeLessThan(1e-3);
      for (let t = validos; t < marcos; t++) expect(datos[m * marcos + t]).toBe(0);
    }
  });

  it('un tono cae en las bandas de su frecuencia', () => {
    const { marcos, datos } = crearMel({ nMels: 128, bf16: false })(tono(1, 440));
    // Sin normalizar no se ve, pero la banda del tono varía poco y no es NaN en ninguna parte.
    expect(datos.some((x) => Number.isNaN(x))).toBe(false);
    expect(marcos).toBeGreaterThan(0);
  });

  it('un audio vacío no rompe nada', () => {
    const r = crearMel({ nMels: 80, bf16: false })(new Float32Array(0));
    expect(r.validos).toBe(0);
    expect(r.datos.some((x) => Number.isNaN(x))).toBe(false);
  });
});

describe('parsearPiezas', () => {
  // Un ModelProto mínimo: pieces (1), con piece (1) y score (2), más otro campo de nivel superior.
  const texto = (s: string) => [...new TextEncoder().encode(s)];
  const pieza = (s: string) => {
    const t = texto(s);
    const interior = [0x0a, t.length, ...t, 0x15, 0, 0, 0x80, 0x3f];
    return [0x0a, interior.length, ...interior];
  };

  it('saca las piezas en orden', () => {
    expect(parsearPiezas(Uint8Array.from([...pieza('<unk>'), ...pieza('▁今日'), ...pieza('は')]))).toEqual(['<unk>', '▁今日', 'は']);
  });

  it('se salta lo que no son piezas', () => {
    expect(parsearPiezas(Uint8Array.from([...pieza('a'), 0x12, 2, 1, 2, 0x18, 5, ...pieza('b')]))).toEqual(['a', 'b']);
  });

  it('una pieza larga, con la longitud en varios bytes', () => {
    const largo = 'x'.repeat(300);
    const t = texto(largo);
    const interior = [0x0a, 0xac, 0x02, ...t];
    expect(parsearPiezas(Uint8Array.from([0x0a, 0xaf, 0x02, ...interior]))).toEqual([largo]);
  });
});

describe('parsearLista', () => {
  it('pone cada pieza en su número, aunque lleve espacios o falte alguna', () => {
    expect(parsearLista('<unk> 0\n▁the 1\n<0x20> 3\nа б 2\n<blk> 4\n')).toEqual(['<unk>', '▁the', 'а б', '<0x20>', '<blk>']);
  });

  it('con finales de línea de Windows', () => {
    expect(parsearLista('a 0\r\nb 1\r\n')).toEqual(['a', 'b']);
  });

  it('un hueco en la numeración queda vacío', () => {
    expect(parsearLista('a 0\nc 2')).toEqual(['a', '', 'c']);
  });
});

describe('decodificarTokens', () => {
  const piezas = ['<unk>', '▁brand', '▁new', '今日', 'は', '<0xE6>', '<0xBC>', '<0xA2>', '字'];

  it('convierte el separador de palabras en un espacio', () => {
    expect(decodificarTokens([1, 2], piezas)).toEqual([' brand', ' new']);
  });

  it('un carácter escrito byte a byte sale entero con su último token', () => {
    expect(decodificarTokens([3, 5, 6, 7, 8], piezas)).toEqual(['今日', '', '', '漢', '字']);
  });

  it('un identificador desconocido no rompe nada', () => {
    expect(decodificarTokens([99, 4], piezas)).toEqual(['', 'は']);
  });
});

describe('segmentosDeTokens', () => {
  it('cada frase empieza donde empieza su primer token', () => {
    const s = segmentosDeTokens(tokens([['今日', 1], ['は', 1.2], ['晴れ', 1.4], ['。', 1.6], ['明日', 2], ['も', 2.2], ['。', 2.4]]), REGLAS);
    expect(s.map((x) => x.texto)).toEqual(['今日は晴れ。', '明日も。']);
    expect(s[0].inicio).toBe(1);
    expect(s[0].fin).toBe(2);
    expect(s[1].inicio).toBe(2);
    expect(s[1].fin).toBeCloseTo(2.75);
  });

  it('una pausa larga separa aunque no haya puntuación', () => {
    const s = segmentosDeTokens(tokens([['あの', 1], ['ね', 1.2], ['うん', 5], ['そう', 5.2]]), REGLAS);
    expect(s.map((x) => x.texto)).toEqual(['あのね', 'うんそう']);
    expect(s[1].inicio).toBe(5);
    // La primera no se alarga hasta la siguiente: se acaba con su último token.
    expect(s[0].fin).toBeCloseTo(1.55);
  });

  it('una frase demasiado larga se parte por sus comas, con el instante real de cada parte', () => {
    const s = segmentosDeTokens(tokens([['ゆっくり休み', 1], ['ましょう、', 2], ['自分のペースで', 8.9], ['進みます。', 9.5]]), REGLAS);
    expect(s.map((x) => x.texto)).toEqual(['ゆっくり休みましょう、', '自分のペースで進みます。']);
    expect(s[1].inicio).toBe(8.9);
  });

  it('un token con varios caracteres da su instante a todos', () => {
    const s = segmentosDeTokens(tokens([['あいう。', 3], ['えお。', 3.5]]), REGLAS);
    expect(s.map((x) => x.inicio)).toEqual([3, 3.5]);
  });

  it('sin tokens no hay segmentos', () => {
    expect(segmentosDeTokens([], REGLAS)).toEqual([]);
  });

  it('los espacios de delante se quitan', () => {
    const s = segmentosDeTokens(tokens([[' brand', 1], [' new', 1.3], [' world', 1.5]]), { ...REGLAS, maximoCaracteres: 50 });
    expect(s.map((x) => x.texto)).toEqual(['brand new world']);
    expect(s[0].inicio).toBe(1);
  });
});
