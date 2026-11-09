import { describe, expect, it } from 'vitest';
import {
  caidaOida,
  cuadraConNucleo,
  type FraseAcentual,
  juzgarFrase,
  juzgarFrases,
  kanaConTiempo,
  pausasLargas,
  tonosEsperados,
  tramosConVoz,
  tramosDeFrases,
  trozosDeVoz,
  valoresPorMora,
} from './practicaAcento';
import { curvaDeTono, type MarcoTono, referenciaDeVoz } from './tono';

const frase = (moras: string, morasPalabra: number, nucleos: number[] | null, pausaNatural = false): FraseAcentual => ({
  texto: moras,
  moras: Array.from(moras),
  morasPalabra,
  nucleos,
  pausaNatural,
});

/** Una curva de 10 en 10 ms con voz (200 Hz, o lo que diga `tono`) donde `conVoz` lo diga. */
const curvaDe = (segundos: number, conVoz: (t: number) => boolean, tono: (t: number) => number = () => 200): MarcoTono[] =>
  Array.from({ length: Math.round(segundos * 100) }, (_, i) => {
    const t = i / 100;
    return { t, f0: conVoz(t) ? tono(t) : null, energia: 0.1 };
  });

describe('los tonos esperados', () => {
  it('heiban, atamadaka, nakadaka y odaka, con su partícula', () => {
    expect(tonosEsperados(4, 0)).toEqual(['bajo', 'alto', 'alto', 'alto']);
    expect(tonosEsperados(3, 1)).toEqual(['alto', 'bajo', 'bajo']);
    expect(tonosEsperados(4, 2)).toEqual(['bajo', 'alto', 'bajo', 'bajo']);
    // 橋を: odaka, la partícula ya baja.
    expect(tonosEsperados(3, 2)).toEqual(['bajo', 'alto', 'bajo']);
  });
});

describe('dónde cae el tono', () => {
  it('sin caída, tras la primera, en medio', () => {
    expect(caidaOida([-2, 2, 2.3, 1.8])).toBe(0);
    expect(caidaOida([3, 0, -0.5])).toBe(1);
    expect(caidaOida([-1, 2, 2, -2])).toBe(3);
  });

  it('la primera caída clara, no la mayor: tras el núcleo el tono sigue bajando', () => {
    // 箸を leído por una voz de síntesis: cae tras は y aún más tras し.
    expect(caidaOida([5.7, 1.6, -3.3])).toBe(1);
    // 橋を: la primera bajada es pequeña; la de verdad, tras し.
    expect(caidaOida([3.9, 3.3, 0.9])).toBe(2);
  });

  it('una caída repartida en dos moras cuenta tras la primera', () => {
    expect(caidaOida([-1, 2, 0.8, -0.6])).toBe(2);
    // La bajada lenta de toda frase no es una caída.
    expect(caidaOida([2, 1.4, 0.8, 0.2])).toBe(0);
  });

  it('sin voz en la mayoría de las moras no se juzga', () => {
    expect(caidaOida([1, null, null, null])).toBeNull();
    expect(caidaOida([1])).toBeNull();
  });
});

describe('si el tono cuadra con el núcleo', () => {
  it('atamadaka con el pico retrasado a la segunda mora, como lo dice una voz real, y no si antes subió', () => {
    // 雨が: あ ya alta, el pico en め y la caída antes de が.
    expect(cuadraConNucleo([4.2, 5.8, -0.9], 1)).toBe(true);
    // Si あ empieza baja y sube, el núcleo está en め: eso es otro acento.
    expect(cuadraConNucleo([-0.8, 4.6, -1], 1)).toBe(false);
  });

  it('sin núcleo: la bajada suave de la frase sí, una caída clara no', () => {
    expect(cuadraConNucleo([-0.8, 4.6, 3.4], 0)).toBe(true);
    expect(cuadraConNucleo([0.2, 0.5, -0.6, -1.8, -1.7], 0)).toBe(true);
    expect(cuadraConNucleo([-0.5, 3, 0], 0)).toBe(false);
  });

  it('una caída clara antes del núcleo es otro acento', () => {
    expect(cuadraConNucleo([3.9, 3.3, 0.9], 2)).toBe(true);
    expect(cuadraConNucleo([5.7, 1.6, -3.3], 2)).toBe(false);
  });
});

describe('el veredicto', () => {
  it('橋を con el tono que cae antes de la partícula, sin caer y cayendo antes', () => {
    const hashi = frase('はしを', 2, [2]);
    expect(juzgarFrase(hashi, [-2, 2, -1], 1, false)).toEqual({ veredicto: 'bien', caida: 2, esperado: 2 });
    expect(juzgarFrase(hashi, [-2, 2, 2], 1, false)).toEqual({ veredicto: 'revisar', caida: 0, esperado: 2 });
    expect(juzgarFrase(hashi, [2, -2, -2.5], 1, false)).toEqual({ veredicto: 'revisar', caida: 1, esperado: 2 });
  });

  it('si cae donde debe pero antes ya cayó, cuenta la caída de antes', () => {
    // La de antes (2,6) no llega a la mitad de la mayor, pero es clara.
    expect(juzgarFrase(frase('あいうえ', 4, [3]), [4, 1.4, 1.4, -7], 1, false)).toEqual({ veredicto: 'revisar', caida: 1, esperado: 3 });
  });

  it('al final de la frase no cuenta la última mora, y sin nada detrás odaka y heiban suenan igual', () => {
    // 橋を al final: sin la を no se oye si el tono cae antes de ella.
    const hashi = frase('はしを', 2, [2]);
    expect(juzgarFrase(hashi, [-2, 2, -3], 1, true)).toMatchObject({ veredicto: 'bien', esperado: 0 });
    const heiban = frase('あめが', 2, [0]);
    expect(juzgarFrase(heiban, [-2, 2, -3], 1, true).veredicto).toBe('bien');
  });

  it('lo que no se reconoció, lo que no se sabe y lo que no tiene datos', () => {
    expect(juzgarFrase(frase('あめ', 2, [1]), [2, -1], 0.3, false).veredicto).toBe('no-oida');
    // Tres de cada cuatro letras, como おります por ふります, todavía valen; menos, no.
    expect(juzgarFrase(frase('はしを', 2, [2]), [-2, 2, -1], 0.75, false).veredicto).toBe('bien');
    expect(juzgarFrase(frase('はしを', 2, [2]), [-2, 2, -1], 0.6, false).veredicto).toBe('no-oida');
    expect(juzgarFrase(frase('たべた', 3, null), [1, 2, 0], 1, false).veredicto).toBe('sin-juzgar');
    expect(juzgarFrase(frase('あめが', 2, [1]), [null, null, 1], 1, false).veredicto).toBe('sin-datos');
  });

  it('con dos acentos en el diccionario, vale cualquiera', () => {
    const dos = frase('いまは', 2, [0, 1]);
    expect(juzgarFrase(dos, [2, -1, -1.5], 1, false)).toMatchObject({ veredicto: 'bien', esperado: 1 });
    expect(juzgarFrase(dos, [-2, 1, 1.2], 1, false)).toMatchObject({ veredicto: 'bien', esperado: 0 });
  });
});

describe('dónde suena cada frase', () => {
  it('la lectura de lo oído, letra a letra con su instante', () => {
    const k = kanaConTiempo(
      [
        { texto: '橋を', t: 0 },
        { texto: '渡る', t: 0.5 },
      ],
      [
        { superficie: '橋', lectura: 'はし' },
        { superficie: 'を', lectura: 'を' },
        { superficie: '渡る', lectura: 'わたる' },
      ],
      1
    );
    expect(k.map((x) => x.kana).join('')).toBe('はしをわたる');
    expect(k[0].t).toBe(0);
    expect(k[1].t).toBeCloseTo(0.125, 3);
    expect(k[3].t).toBe(0.5);
    expect(k[5].t).toBeCloseTo(0.833, 2);
  });

  it('cada frase, de su primera letra a la siguiente frase; da igual kanji o kana', () => {
    const frases = [frase('はしを', 2, [2]), frase('わたる', 3, [0])];
    const oido = Array.from('はしをわたる').map((kana, i) => ({ kana, t: i * 0.15 }));
    const t = tramosDeFrases(frases, oido, 1)!;
    expect(t[0]).toMatchObject({ inicio: 0, oida: 1 });
    expect(t[0].fin).toBeCloseTo(0.45, 5);
    expect(t[1].inicio).toBeCloseTo(0.45, 5);
    expect(t[1].fin).toBe(1);
  });

  it('si no se reconoció su primera letra, la frase empieza antes de la primera que sí', () => {
    // ふります dicho, おります esperado: la お no está, pero la frase empieza una letra antes de la り.
    const frases = [frase('あめが', 2, [1]), frase('おります', 4, [3])];
    const oido = Array.from('あめがふります').map((kana, i) => ({ kana, t: i * 0.1 }));
    const t = tramosDeFrases(frases, oido, 0.8)!;
    expect(t[1].inicio).toBeCloseTo(0.3, 5);
    expect(t[1].oida).toBe(0.75);
  });

  it('una frase que no se oyó va entre sus vecinas, y sin nada en común no hay tramos', () => {
    const frases = [frase('はしを', 2, [2]), frase('わたる', 3, [0]), frase('ひと', 2, [0])];
    const oido = [...Array.from('はしを').map((kana, i) => ({ kana, t: i * 0.1 })), ...Array.from('ひと').map((kana, i) => ({ kana, t: 0.9 + i * 0.1 }))];
    const t = tramosDeFrases(frases, oido, 1.2)!;
    expect(t[1].oida).toBe(0);
    expect(t[1].inicio).toBeCloseTo(t[0].fin, 5);
    expect(t[1].fin).toBeCloseTo(0.9, 5);
    expect(tramosDeFrases(frases, [{ kana: 'ん', t: 0 }], 1)).toBeNull();
  });
});

describe('los trozos de voz', () => {
  it('un silencio corto queda dentro, una pausa parte, y el chasquido suelto del final no cuenta', () => {
    const curva = curvaDe(2.2, (t) => t < 0.5 || (t >= 0.7 && t < 1) || (t >= 1.5 && t < 1.8) || (t >= 1.95 && t < 1.99));
    const trozos = trozosDeVoz(curva);
    expect(trozos).toHaveLength(2);
    expect(trozos[0]).toEqual({ inicio: 0, fin: 0.99 });
    expect(trozos[1].inicio).toBe(1.5);
    expect(trozos[1].fin).toBeCloseTo(1.79, 5);
  });
});

describe('dónde suena cada frase, medido con la voz', () => {
  // Voz de 1 a 2 s, sin pausas: seis moras.
  const curva = curvaDe(3, (t) => t >= 1 && t < 2);

  it('las moras a partes iguales en el trozo, con la frontera a medio camino de la transcripción', () => {
    const frases = [frase('はしを', 2, [2]), frase('わたる', 3, [0])];
    // La transcripción pone わたる en 1,6 s; el reparto por moras, hacia 1,5.
    const aprox = [
      { inicio: 0.2, fin: 1.6, oida: 1 },
      { inicio: 1.6, fin: 2, oida: 1 },
    ];
    const t = tramosConVoz(frases, aprox, curva);
    expect(t[0].inicio).toBeCloseTo(0.94, 5);
    const uniforme = 0.94 + (1.99 + 0.04 - 0.94) / 2;
    expect(t[1].inicio).toBeCloseTo((uniforme + 1.6) / 2, 5);
    expect(t[1].fin).toBeCloseTo(2.03, 5);
    expect(t[0].antesDePausa).toBe(false);
    expect(t[1].antesDePausa).toBe(true);
  });

  it('una última mora sin voz queda fuera de la voz, y una frase no dicha no ocupa tiempo', () => {
    const desu = { ...frase('ですか', 2, [1]), moras: ['で', 'す'], ultimaSorda: true };
    const aprox = [
      { inicio: 1, fin: 1.5, oida: 1 },
      { inicio: 1.5, fin: 1.5, oida: 0 },
    ];
    const t = tramosConVoz([desu, frase('ね', 1, null)], aprox, curva);
    // Dos moras en 1,09 s de voz, de las que la segunda solo suena un 40 %.
    expect(t[0].fin - t[0].inicio).toBeCloseTo((1.09 / 1.4) * 2, 5);
    expect(t[1]).toEqual({ inicio: t[0].fin, fin: t[0].fin, oida: 0 });
  });
});

describe('el juicio de la grabación entera', () => {
  it('delante de una pausa la última mora no cuenta: el tono baja siempre ahí', () => {
    // 最近、 leído: plano y, al final, el descenso de antes de la coma.
    const curva = curvaDe(1, (t) => t < 0.8, (t) => (t < 0.6 ? 200 : 160));
    const tramos = [{ inicio: 0, fin: 0.8, oida: 1 }];
    expect(juzgarFrases([frase('さいきん', 4, [0], true)], tramos, curva, 200).juicios[0].veredicto).toBe('bien');
    expect(juzgarFrases([frase('さいきん', 4, [0]), frase('は', 1, null)], [...tramos, { inicio: 0.8, fin: 0.9, oida: 1 }], curva, 200).juicios[0].veredicto).toBe('revisar');
  });

  it('〜ます al final: el tono cae dentro de la ま, así que se lee al principio', () => {
    // たべます: alto hasta la mitad de la ま y luego bajo; la す no suena.
    const curva = curvaDe(0.8, (t) => t >= 0.15 && t < 0.62, (t) => (t < 0.52 ? 200 : 150));
    const tabemasu = { ...frase('たべます', 4, [3]), ultimaSorda: true };
    const tramos = [{ inicio: 0, fin: 0.8, oida: 1 }];
    const { juicios, valores } = juzgarFrases([tabemasu], tramos, curva, 200);
    expect(valores[0][2]).toBeCloseTo(0, 5);
    expect(juicios[0].veredicto).toBe('bien');
  });
});

describe('las pausas', () => {
  const curva = curvaDe(1.5, (t) => (t >= 0.2 && t < 0.5) || t >= 1.1);
  const tramos = [
    { inicio: 0.14, fin: 0.53, oida: 1 },
    { inicio: 1.04, fin: 1.5, oida: 1 },
  ];

  it('un silencio largo entre dos frases, salvo donde hay puntuación; antes de empezar no cuenta', () => {
    expect(pausasLargas(curva, tramos, [frase('はしを', 2, [2]), frase('わたる', 3, [0])])).toEqual([{ despuesDe: 0, antesDe: 1, duracion: 0.6 }]);
    expect(pausasLargas(curva, tramos, [frase('はしを', 2, [2], true), frase('わたる', 3, [0])])).toEqual([]);
  });

  it('salta las frases que no se dijeron', () => {
    const tres = [tramos[0], { inicio: 0.53, fin: 0.53, oida: 0 }, tramos[1]];
    expect(pausasLargas(curva, tres, [frase('はしを', 2, [2]), frase('ね', 1, null), frase('わたる', 3, [0])])).toEqual([{ despuesDe: 0, antesDe: 2, duracion: 0.6 }]);
  });
});

describe('de la voz al veredicto', () => {
  const FS = 16000;
  /** Una voz de juguete que dice tres moras de 150 ms con estos tonos. */
  function moras(tonos: number[]): Float32Array {
    const largo = Math.round(0.15 * FS);
    const x = new Float32Array(largo * tonos.length);
    let fase = 0;
    for (let i = 0; i < x.length; i++) {
      fase += (2 * Math.PI * tonos[Math.floor(i / largo)]) / FS;
      x[i] = 0.15 * (Math.sin(fase) + Math.sin(2 * fase) / 2 + Math.sin(3 * fase) / 3);
    }
    return x;
  }

  const juzgar = (tonos: number[], f: FraseAcentual) => {
    const curva = curvaDeTono(moras(tonos), FS);
    const valores = valoresPorMora(curva, { inicio: 0, fin: 0.15 * tonos.length }, tonos.length, referenciaDeVoz(curva));
    return juzgarFrase(f, valores, 1, false);
  };

  it('雨が, atamadaka, dicho como tal y dicho plano', () => {
    const ame = frase('あめが', 2, [1]);
    expect(juzgar([230, 170, 165], ame)).toEqual({ veredicto: 'bien', caida: 1, esperado: 1 });
    expect(juzgar([170, 230, 232], ame)).toEqual({ veredicto: 'revisar', caida: 0, esperado: 1 });
  });

  it('花が, odaka: el tono cae justo antes de la partícula', () => {
    const hana = frase('はなが', 2, [2]);
    expect(juzgar([170, 230, 165], hana)).toEqual({ veredicto: 'bien', caida: 2, esperado: 2 });
    expect(juzgar([170, 230, 235], hana).veredicto).toBe('revisar');
  });
});
