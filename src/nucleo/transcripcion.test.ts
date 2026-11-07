import { REGLAS_TRANSCRIPCION } from '../lenguas/japones/transcripcion';
import {
  describe,
  expect,
  it } from 'vitest';
import {
  AcumuladorAudio,
  colapsarRepeticiones,
  elegirCorte,
  esAlucinacion as esAlucinacionCon,
  esBucle,
  esSilencio,
  esTextoRecuperable as esTextoRecuperableCon,
  FRECUENCIA,
  fusionarLineas,
  huecosSinTexto as huecosSinTextoCon,
  ocupacionObjetivo,
  partirTexto as partirTextoCon,
  pausaTrasTrozo,
  segundosRestantes,
  segmentosALineas as segmentosALineasCon,
  ventanasDeHueco,
  videoEn,
  type SegmentoWhisper,
  type TramoTiempo,
} from './transcripcion';

const esAlucinacion = (t: string) => esAlucinacionCon(t, REGLAS_TRANSCRIPCION);
const partirTexto = (t: string) => partirTextoCon(t, REGLAS_TRANSCRIPCION);
const esTextoRecuperable = (t: string) => esTextoRecuperableCon(t, REGLAS_TRANSCRIPCION);
const huecosSinTexto = (s: SegmentoWhisper[], a: number, b: number) => huecosSinTextoCon(s, a, b, REGLAS_TRANSCRIPCION);
const segmentosALineas = (s: SegmentoWhisper[], m: TramoTiempo[], d: number, i: number) => segmentosALineasCon(s, m, d, i, REGLAS_TRANSCRIPCION);

const tono = (segundos: number, amplitud = 0.2) => {
  const a = new Float32Array(Math.floor(segundos * FRECUENCIA));
  for (let i = 0; i < a.length; i++) a[i] = amplitud * Math.sin(i / 8);
  return a;
};
const unir = (...t: Float32Array[]) => {
  const r = new Float32Array(t.reduce((n, x) => n + x.length, 0));
  let p = 0;
  for (const x of t) {
    r.set(x, p);
    p += x.length;
  }
  return r;
};

describe('corte de audio', () => {
  it('corta en el silencio, no en plena voz', () => {
    const pcm = unir(tono(18), tono(1, 0), tono(10));
    const corte = elegirCorte(pcm);
    expect(corte / FRECUENCIA).toBeGreaterThan(18);
    expect(corte / FRECUENCIA).toBeLessThan(19);
  });

  it('sin silencio corta dentro del límite de la ventana', () => {
    const corte = elegirCorte(tono(40));
    expect(corte / FRECUENCIA).toBeLessThanOrEqual(27);
  });

  it('distingue el silencio de la voz', () => {
    expect(esSilencio(tono(1, 0.001))).toBe(true);
    expect(esSilencio(tono(1, 0.2))).toBe(false);
  });
});

describe('tiempos de video', () => {
  it('interpola entre marcas y sigue la velocidad', () => {
    const mapa = [{ muestra: 0, videoMs: 1000 }, { muestra: FRECUENCIA, videoMs: 3000 }];
    expect(videoEn(mapa, FRECUENCIA / 2)).toBe(2000);
    expect(videoEn(mapa, FRECUENCIA * 2)).toBe(4000);
  });

  it('un salto en el video se refleja en los tiempos', () => {
    const a = new AcumuladorAudio();
    a.agregar(tono(5), 0);
    a.agregar(tono(5), 100000);
    const t = a.extraer(true)!;
    expect(videoEn(t.mapa, 6 * FRECUENCIA)).toBe(101000);
  });
});

describe('acumulador', () => {
  it('no entrega nada hasta tener suficiente audio', () => {
    const a = new AcumuladorAudio();
    a.agregar(tono(10), 0);
    expect(a.extraer()).toBeNull();
    expect(a.extraer(true)?.pcm.length).toBe(10 * FRECUENCIA);
    expect(a.muestras).toBe(0);
  });

  it('conserva el resto con su tiempo correcto', () => {
    const a = new AcumuladorAudio();
    a.agregar(unir(tono(18), tono(1, 0), tono(15)), 5000);
    const primero = a.extraer()!;
    const segundos = primero.pcm.length / FRECUENCIA;
    expect(segundos).toBeGreaterThan(18);
    expect(segundos).toBeLessThan(19);
    const resto = a.extraer(true)!;
    expect(videoEn(resto.mapa, 0)).toBeCloseTo(5000 + segundos * 1000, 0);
  });
});

describe('limpieza del texto', () => {
  it('reconoce lo que Whisper se inventa en los silencios', () => {
    expect(esAlucinacion('ご視聴ありがとうございました')).toBe(true);
    expect(esAlucinacion('チャンネル登録お願いします')).toBe(true);
    expect(esAlucinacion('字幕:山田太郎')).toBe(true);
    expect(esAlucinacion('今日は学校に行きました')).toBe(false);
  });

  it('colapsa los bucles de repetición', () => {
    expect(colapsarRepeticiones('はいはいはいはいはい')).toBe('はい');
    expect(colapsarRepeticiones('今日はいい天気です')).toBe('今日はいい天気です');
  });

  it('parte por la puntuación y limita la longitud', () => {
    expect(partirTexto('こんにちは。元気ですか?')).toEqual(['こんにちは。', '元気ですか?']);
    const largo = `${'あ'.repeat(25)}、${'い'.repeat(25)}、${'う'.repeat(10)}。`;
    for (const l of partirTexto(largo)) expect(l.length).toBeLessThanOrEqual(36);
  });

  it('sin puntuación corta por una partícula, no a mitad de palabra', () => {
    const t = '来年の春には東京の大学に入学するつもりですが今はまだ図書館で毎日勉強を続けています';
    const partes = partirTexto(t);
    expect(partes.join('')).toBe(t);
    expect(partes.length).toBeGreaterThan(1);
    for (const l of partes) expect(l.length).toBeLessThanOrEqual(34);
  });
});

describe('líneas de subtítulo', () => {
  const mapa = [{ muestra: 0, videoMs: 10000 }];

  it('convierte los segmentos a tiempo de video y descarta alucinaciones', () => {
    const l = segmentosALineas(
      [
        { texto: 'こんにちは。', inicio: 1, fin: 2.5 },
        { texto: 'ご視聴ありがとうございました', inicio: 3, fin: 4 },
        { texto: '元気です。', inicio: 5, fin: null },
      ],
      mapa,
      20,
      1
    );
    expect(l.map((x) => x.texto)).toEqual(['こんにちは。', '元気です。']);
    expect(l[0].inicio).toBe(11000);
    expect(l[0].fin).toBe(12500);
    expect(l[1].inicio).toBe(15000);
    expect(l[1].id).toBe(2);
  });

  it('reparte el tiempo al partir un segmento y evita solapes', () => {
    const l = segmentosALineas([{ texto: 'おはようございます。今日は晴れです。', inicio: 0, fin: 4 }], mapa, 20, 1);
    expect(l).toHaveLength(2);
    expect(l[0].fin).toBeLessThanOrEqual(l[1].inicio);
    expect(l[1].fin).toBeGreaterThan(l[1].inicio);
  });
});

describe('fusión de líneas', () => {
  const l = (id: number, inicio: number, fin: number, texto: string) => ({ id, inicio, fin, texto });

  it('reemplaza lo que ya había en el mismo tramo', () => {
    const r = fusionarLineas([l(1, 0, 1000, 'a'), l(2, 2000, 3000, 'b'), l(3, 9000, 9500, 'c')], [l(4, 1500, 5000, 'nueva')]);
    expect(r.map((x) => x.texto)).toEqual(['a', 'nueva', 'c']);
  });

  it('une una línea repetida entre dos trozos', () => {
    const r = fusionarLineas([l(1, 0, 1000, 'hola')], [l(2, 1200, 2000, 'hola')]);
    expect(r).toHaveLength(1);
    expect(r[0].fin).toBe(2000);
  });
});

describe('control de carga', () => {
  it('nunca ocupa toda la GPU', () => {
    for (const i of ['auto', 'suave', 'rapida'] as const) {
      for (const enUso of [true, false]) expect(ocupacionObjetivo(i, enUso)).toBeLessThan(1);
    }
  });

  it('en automático trabaja más si no estás usando el equipo', () => {
    expect(ocupacionObjetivo('auto', false)).toBeGreaterThan(ocupacionObjetivo('auto', true));
  });

  it('el descanso es proporcional a lo que tardó el trozo', () => {
    expect(pausaTrasTrozo(1000, 0.25)).toBe(3000);
    expect(pausaTrasTrozo(1000, 0.5)).toBe(1000);
  });

  it('si otra aplicación ocupa la GPU el trozo tarda más y descansa más', () => {
    expect(pausaTrasTrozo(4000, 0.25)).toBeGreaterThan(pausaTrasTrozo(1000, 0.25));
  });

  it('el descanso tiene un mínimo y un máximo', () => {
    expect(pausaTrasTrozo(1, 0.9)).toBe(200);
    expect(pausaTrasTrozo(600000, 0.2)).toBe(60000);
  });

  it('estima el tiempo restante con el ritmo real', () => {
    expect(segundosRestantes(600, 7200, 120)).toBe(1320);
    expect(segundosRestantes(0, 7200, 0)).toBeNull();
  });
});

describe('tramos que Whisper se salta', () => {
  const seg = (inicio: number, fin: number | null) => ({ texto: 'あいう', inicio, fin });

  it('encuentra los huecos al principio, en medio y al final', () => {
    expect(huecosSinTexto([seg(8, 10), seg(20, 21)], 0, 27)).toEqual([
      { desde: 0, hasta: 8 },
      { desde: 10, hasta: 20 },
      { desde: 21, hasta: 27 },
    ]);
  });

  it('una pausa normal no es un hueco', () => {
    expect(huecosSinTexto([seg(2, 10), seg(14, 24)], 0, 27)).toEqual([]);
  });

  it('sin segmentos, falta todo el tramo', () => {
    expect(huecosSinTexto([], 5, 27)).toEqual([{ desde: 5, hasta: 27 }]);
  });

  it('calcula un final desconocido por el largo del texto', () => {
    expect(huecosSinTexto([seg(0, null)], 0, 27)[0].desde).toBeCloseTo(0.51);
  });

  it('reparte un hueco en ventanas que se solapan', () => {
    expect(ventanasDeHueco({ desde: 70, hasta: 92 })).toEqual([
      { desde: 70, hasta: 80 },
      { desde: 79, hasta: 89 },
      { desde: 88, hasta: 92 },
    ]);
    expect(ventanasDeHueco({ desde: 0, hasta: 8 })).toEqual([{ desde: 0, hasta: 8 }]);
  });

  it('reconoce el decodificador atascado', () => {
    expect(esBucle('お前の'.repeat(40))).toBe(true);
    expect(esBucle('おやすみなさい'.repeat(4))).toBe(true);
    expect(esBucle('い'.repeat(100))).toBe(true);
    expect(esBucle('すごいすごいすごいすごい')).toBe(false);
    expect(esBucle('このあんが抜群に美味しいお肉の旨味がものすごく出てる')).toBe(false);
  });

  it('no acepta de un hueco lo que Whisper dice cuando solo oye música', () => {
    for (const t of ['音楽', 'BGM', 'ご視聴ありがとうございました', 'おやすみなさい', 'チャンネル登録をお願いいたします。', 'おはようございます', 'ごめんね', 'おわり', 'んんんん', 'わぁ', 'お?', 'イン']) {
      expect(esTextoRecuperable(t), t).toBe(false);
    }
  });

  it('acepta las frases reales que se saltó', () => {
    for (const t of ['すごいすごいシャキプリだよねホタテ選んで良かったんで', 'ここは食後にちょうどいいね', 'このモーニングこれで500円だもんね', 'モーニング']) {
      expect(esTextoRecuperable(t), t).toBe(true);
    }
  });

  it('un bucle no llega a los subtítulos', () => {
    const lineas = segmentosALineas([{ texto: 'お前の'.repeat(40), inicio: 0, fin: 5 }, { texto: 'こんにちは', inicio: 6, fin: 8 }], [], 27, 1);
    expect(lineas.map((l) => l.texto)).toEqual(['こんにちは']);
  });
});

