import { describe, expect, it } from 'vitest';
import type { ProbabilidadesCtc } from './alineacionForzada';
import { alinearConVoz, alinearPorLetras, aplicarAjuste, colocarConGuia, type GuiaLetra, guiaDeClaude, ID_LETRA, letraParaClaude, mensajeAjuste, sinMarcas, versosDeLetra, vozDeCanto } from './letra';
import type { Linea } from './subtitulos';

// Versos inventados para estas pruebas.
const VERSOS = ['Camino por el río de noche', 'La luna se queda conmigo', 'Vuelve la mañana sin avisar', 'Y yo sigo cantando'];
const lin = (id: number, inicio: number, fin: number, texto = `oído mal ${id}`): Linea => ({ id, inicio, fin, texto });
const LINEAS = [lin(1, 10000, 13000), lin(2, 14000, 17000), lin(3, 18000, 21000), lin(4, 22000, 25000), lin(5, 26000, 29000)];
const tiempos = (l: Linea[]) => l.map((x) => [x.inicio, x.fin]);
const textos = (l: Linea[]) => l.map((x) => x.texto);

describe('versosDeLetra', () => {
  it('un verso por línea, sin las vacías', () => {
    expect(versosDeLetra('uno\n\n  dos  \r\n\r\ntres')).toEqual(['uno', 'dos', 'tres']);
  });

  it('quita los adornos, que no se cantan', () => {
    expect(versosDeLetra('♪♪♪\n---\nverso\n～～\n* * *')).toEqual(['verso']);
  });

  it('quita la marca de tiempo que traen algunos comentarios', () => {
    expect(versosDeLetra('0:15 primer verso\n[1:02] segundo verso\n1:02:33 tercer verso')).toEqual(['primer verso', 'segundo verso', 'tercer verso']);
  });

  it('no toca lo que forma parte del verso', () => {
    expect(versosDeLetra('夜の川を　歩いて\n3 de mayo')).toEqual(['夜の川を　歩いて', '3 de mayo']);
    expect(versosDeLetra('palabra\u200b unida')).toEqual(['palabra unida']);
  });

  it('sin lo que no se canta: marcas de sección y créditos', () => {
    expect(versosDeLetra('[Coro]\nverso\n(Chorus)\n作詞：ハチ 作曲：ハチ\nLyrics by Someone\notro verso')).toEqual(['verso', 'otro verso']);
  });

  it('una letra en LRC pegada se lee en el orden de sus horas, sin ellas', () => {
    const lrc = '[ti:Una canción]\n[ar:Alguien]\n[00:12.34]primer verso\n[00:15.00][00:30.50]estribillo\n[00:18.20]\n[00:20.00]<00:20.00>pa<00:20.40>la<00:20.80>bras';
    expect(versosDeLetra(lrc)).toEqual(['primer verso', 'estribillo', 'palabras', 'estribillo']);
  });

  it('una marca con centésimas en un comentario se quita entera, sin tomar el resto por LRC', () => {
    expect(versosDeLetra('[01:02.50] un verso\notro verso\nel último')).toEqual(['un verso', 'otro verso', 'el último']);
  });

  it('un verso con «×2» va dos veces, y sin la marca que lleve delante', () => {
    expect(versosDeLetra('[Coro] la luna ×2\nfin')).toEqual(['la luna', 'la luna', 'fin']);
  });
});

describe('mensajeAjuste', () => {
  it('numera las dos listas, con los tiempos de la transcripción', () => {
    const m = mensajeAjuste([lin(7, 1500, 3000, 'hola')], ['verso'], 'Una canción');
    expect(m).toBe('Título: Una canción\n\nTRANSCRIPCIÓN:\n0 [1.5-3.0] hola\n\nLETRA:\n0: verso');
  });

  it('el número es la posición en la lista, no el identificador de la línea', () => {
    expect(mensajeAjuste([lin(40, 0, 1000, 'a'), lin(41, 1000, 2000, 'b')], ['v'])).toContain('0 [0.0-1.0] a\n1 [1.0-2.0] b');
  });
});

describe('aplicarAjuste', () => {
  it('el texto sale tal cual de la letra y los tiempos, de la transcripción', () => {
    const r = aplicarAjuste(VERSOS.slice(0, 2), LINEAS, [{ v: 0, de: 0, a: 0 }, { v: 1, de: 1, a: 1 }]);
    expect(textos(r.lineas)).toEqual([VERSOS[0], VERSOS[1]]);
    expect(tiempos(r.lineas)).toEqual([[10000, 13000], [14000, 17000]]);
    expect(r.conTiempo).toBe(2);
    expect(r.estimadas).toBe(0);
  });

  it('un verso que ocupa varias líneas va de la primera a la última', () => {
    const r = aplicarAjuste(VERSOS.slice(0, 1), LINEAS, [{ v: 0, de: 1, a: 3 }]);
    expect(tiempos(r.lineas)).toEqual([[14000, 25000]]);
  });

  it('un estribillo que la letra escribe una vez puede sonar varias', () => {
    const r = aplicarAjuste(VERSOS, LINEAS, [{ v: 1, de: -2, a: -2 }, { v: 3, de: -2, a: -2 }, { v: 2, de: 0, a: 0 }, { v: 0, de: 1, a: 1 }, { v: 2, de: 2, a: 2 }, { v: 2, de: 4, a: 4 }]);
    expect(textos(r.lineas)).toEqual([VERSOS[2], VERSOS[0], VERSOS[2], VERSOS[2]]);
    expect(r.lineas[3].inicio).toBe(26000);
  });

  it('dos versos en una sola línea se reparten su tiempo, sin pisarse', () => {
    const r = aplicarAjuste(['aaaa', 'bbbbbbbbbbbb'], LINEAS, [{ v: 0, de: 0, a: 0 }, { v: 1, de: 0, a: 0 }]);
    // Tres segundos a repartir entre 4 y 12 caracteres.
    expect(tiempos(r.lineas)).toEqual([[10000, 10750], [10750, 13000]]);
    expect(r.conTiempo).toBe(2);
  });

  it('también si solo comparten una parte', () => {
    const r = aplicarAjuste(['aaaa', 'aaaa'], LINEAS, [{ v: 0, de: 0, a: 1 }, { v: 1, de: 1, a: 2 }]);
    expect(tiempos(r.lineas)).toEqual([[10000, 15500], [15500, 21000]]);
  });

  it('un verso que no se oyó se coloca justo antes del siguiente', () => {
    const r = aplicarAjuste(['abcde', 'fghij', 'klmno'], LINEAS, [{ v: 0, de: 0, a: 0 }, { v: 1, de: -1, a: -1 }, { v: 2, de: 3, a: 3 }]);
    expect(textos(r.lineas)).toEqual(['abcde', 'fghij', 'klmno']);
    // 5 caracteres a 300 ms son 1,5 s, y la línea 3 empieza a los 22 s.
    expect(tiempos(r.lineas)[1]).toEqual([20500, 22000]);
    expect(r.conTiempo).toBe(2);
    expect(r.estimadas).toBe(1);
  });

  it('lo que no se canta no entra, ni se confunde con lo que no se oyó', () => {
    const r = aplicarAjuste(['Título', ...VERSOS.slice(0, 2)], LINEAS, [{ v: 0, de: -2, a: -2 }, { v: 1, de: 0, a: 0 }, { v: 2, de: 1, a: 1 }]);
    expect(textos(r.lineas)).toEqual([VERSOS[0], VERSOS[1]]);
    expect(r.estimadas).toBe(0);
  });

  it('un verso que Claude se salta no se pierde: va detrás del anterior de la letra', () => {
    const r = aplicarAjuste(VERSOS.slice(0, 4), LINEAS, [{ v: 0, de: 0, a: 0 }, { v: 2, de: 2, a: 2 }, { v: 3, de: 3, a: 3 }]);
    expect(textos(r.lineas)).toEqual(VERSOS.slice(0, 4));
    expect(r.conTiempo).toBe(3);
    expect(r.estimadas).toBe(1);
    expect(r.lineas[1].inicio).toBeGreaterThanOrEqual(r.lineas[0].fin);
    expect(r.lineas[1].fin).toBeLessThanOrEqual(r.lineas[2].inicio);
  });

  it('el primero también, delante de todo', () => {
    const r = aplicarAjuste(VERSOS.slice(0, 2), LINEAS, [{ v: 1, de: 1, a: 1 }]);
    expect(textos(r.lineas)).toEqual(VERSOS.slice(0, 2));
    expect(r.lineas[0].fin).toBeLessThanOrEqual(r.lineas[1].inicio);
  });

  it('con un estribillo repetido, lo saltado va tras su primera aparición', () => {
    const r = aplicarAjuste(['a', 'b', 'c'], LINEAS, [{ v: 0, de: 0, a: 0 }, { v: 2, de: 1, a: 1 }, { v: 0, de: 2, a: 2 }, { v: 2, de: 3, a: 3 }]);
    expect(textos(r.lineas)).toEqual(['a', 'b', 'c', 'a', 'c']);
  });

  it('si nada tiene tiempo no se completa: no es la letra de esta canción', () => {
    const r = aplicarAjuste(VERSOS.slice(0, 3), LINEAS, [{ v: 0, de: -1, a: -1 }]);
    expect(r.conTiempo).toBe(0);
    expect(textos(r.lineas)).toEqual([VERSOS[0]]);
  });

  it('un pasaje instrumental no estira el verso que no se oyó', () => {
    const lejos = [lin(1, 0, 3000), lin(2, 60000, 63000)];
    const largo = 'x'.repeat(100);
    const r = aplicarAjuste(['a', largo, 'b'], lejos, [{ v: 0, de: 0, a: 0 }, { v: 1, de: -1, a: -1 }, { v: 2, de: 1, a: 1 }]);
    expect(tiempos(r.lineas)[1]).toEqual([52000, 60000]);
  });

  it('el primer verso sin tiempo no empieza antes del video', () => {
    const r = aplicarAjuste(['larguísimo verso que no se oyó', 'b'], [lin(1, 2000, 4000)], [{ v: 0, de: -1, a: -1 }, { v: 1, de: 0, a: 0 }]);
    expect(r.lineas[0].inicio).toBe(0);
    expect(r.lineas[0].fin).toBe(2500);
  });

  it('el último sin tiempo va detrás del anterior', () => {
    const r = aplicarAjuste(['a', 'abcdefghij'], [lin(1, 2000, 4000)], [{ v: 0, de: 0, a: 0 }, { v: 1, de: -1, a: -1 }]);
    expect(tiempos(r.lineas)[1]).toEqual([4000, 7000]);
  });

  it('sin hueco, los versos sin tiempo toman lo que le sobra a una línea larga del reconocedor', () => {
    const larga = [lin(1, 10000, 12000), lin(2, 12000, 32000)];
    const r = aplicarAjuste(['aaaa', 'bbbb', 'cccc', 'dddd'], larga, [{ v: 0, de: 0, a: 0 }, { v: 1, de: -1, a: -1 }, { v: 2, de: -1, a: -1 }, { v: 3, de: 1, a: 1 }]);
    expect(textos(r.lineas)).toEqual(['aaaa', 'bbbb', 'cccc', 'dddd']);
    // Cada verso de cuatro caracteres necesita 1,5 s, así que no se aplastan en un instante.
    expect(r.lineas[1].fin - r.lineas[1].inicio).toBeGreaterThanOrEqual(1400);
    expect(r.lineas[2].fin - r.lineas[2].inicio).toBeGreaterThanOrEqual(1400);
    expect(r.lineas[3].fin).toBe(32000);
    expect(r.lineas[3].inicio).toBeGreaterThanOrEqual(r.lineas[2].fin);
  });

  it('y también lo que le sobra a la anterior', () => {
    const larga = [lin(1, 10000, 25000), lin(2, 25000, 28000)];
    const r = aplicarAjuste(['aaaa', 'bbbb', 'cccc'], larga, [{ v: 0, de: 0, a: 0 }, { v: 1, de: -1, a: -1 }, { v: 2, de: 1, a: 1 }]);
    expect(r.lineas[1].fin - r.lineas[1].inicio).toBeGreaterThanOrEqual(1400);
    expect(r.lineas[0].fin).toBeLessThan(25000);
    expect(r.lineas[2].inicio).toBe(25000);
  });

  it('a la línea anterior le quita lo que le sobra, y le deja lo suyo', () => {
    const pegadas = [lin(1, 0, 4000), lin(2, 4000, 8000)];
    const r = aplicarAjuste(['a', 'bbbbb', 'c'], pegadas, [{ v: 0, de: 0, a: 0 }, { v: 1, de: -1, a: -1 }, { v: 2, de: 1, a: 1 }]);
    expect(tiempos(r.lineas)).toEqual([[0, 2500], [2500, 4000], [4000, 8000]]);
  });

  it('una entrada fuera de orden pierde su tiempo, pero no se lleva por delante a las demás', () => {
    const r = aplicarAjuste(VERSOS, LINEAS, [{ v: 0, de: 0, a: 0 }, { v: 1, de: 4, a: 4 }, { v: 2, de: 1, a: 1 }, { v: 3, de: 2, a: 2 }]);
    expect(textos(r.lineas)).toEqual(VERSOS);
    expect(r.conTiempo).toBe(3);
    expect(r.estimadas).toBe(1);
    for (let i = 1; i < r.lineas.length; i++) expect(r.lineas[i].inicio).toBeGreaterThanOrEqual(r.lineas[i - 1].fin);
  });

  it('lo que no tiene sentido se descarta sin romper nada', () => {
    const r = aplicarAjuste(VERSOS.slice(0, 3), LINEAS, [
      { v: 99, de: 0, a: 0 },
      { v: -1, de: 0, a: 0 },
      { v: 1.5, de: 0, a: 0 },
      { v: 0, de: 0, a: 99 },
      { v: 1, de: 2, a: 1 },
      { v: 2, de: 99, a: 99 },
    ]);
    expect(textos(r.lineas)).toEqual([VERSOS[0], VERSOS[1], VERSOS[2]]);
    expect(tiempos(r.lineas)[0]).toEqual([10000, 13000]);
    expect(r.estimadas).toBe(1);
  });

  it('sin nada que colocar, no hay líneas', () => {
    expect(aplicarAjuste(VERSOS, LINEAS, []).lineas).toEqual([]);
    expect(aplicarAjuste([], LINEAS, [{ v: 0, de: 0, a: 0 }]).lineas).toEqual([]);
  });

  it('los identificadores no chocan con los de la transcripción', () => {
    const r = aplicarAjuste(VERSOS.slice(0, 2), LINEAS, [{ v: 0, de: 0, a: 0 }, { v: 1, de: 1, a: 1 }]);
    expect(r.lineas.map((l) => l.id)).toEqual([ID_LETRA, ID_LETRA + 1]);
    expect(LINEAS.some((l) => l.id >= ID_LETRA)).toBe(false);
  });

  it('una línea muy corta dura lo bastante para leerla, sin pisar la siguiente', () => {
    const cortas = [lin(1, 1000, 1100), lin(2, 1500, 1600), lin(3, 5000, 5100)];
    const r = aplicarAjuste(['a', 'b', 'c'], cortas, [{ v: 0, de: 0, a: 0 }, { v: 1, de: 1, a: 1 }, { v: 2, de: 2, a: 2 }]);
    expect(tiempos(r.lineas)).toEqual([[1000, 1500], [1500, 2200], [5000, 5700]]);
  });

  it('nunca se pisan y los tiempos son enteros, pase lo que pase', () => {
    const r = aplicarAjuste(['uno', 'dos', 'tres', 'cuatro', 'cinco'], LINEAS, [
      { v: 0, de: 0, a: 1 },
      { v: 1, de: 1, a: 1 },
      { v: 2, de: -1, a: -1 },
      { v: 3, de: 2, a: 2 },
      { v: 4, de: 2, a: 4 },
    ]);
    expect(r.lineas).toHaveLength(5);
    for (const [i, l] of r.lineas.entries()) {
      expect(Number.isInteger(l.inicio) && Number.isInteger(l.fin)).toBe(true);
      expect(l.fin).toBeGreaterThan(l.inicio);
      if (i) expect(l.inicio).toBeGreaterThanOrEqual(r.lineas[i - 1].fin);
    }
  });
});

describe('dónde se canta', () => {
  // Tramos de 2 s con la puntuación de «canto»: por encima de 0,02 hay voz.
  const canto = (puntos: number[]) => vozDeCanto({ pasoMs: 2000, puntos });

  it('los tramos con voz, con los huecos de un solo tramo rellenos y los más largos respetados', () => {
    const v = canto([0, 0.05, 0.01, 0.06, 0, 0, 0.03]);
    expect(v.tramos(0, 14000)).toEqual([[2000, 8000], [12000, 14000]]);
    expect(v.tramos(5000, 13000)).toEqual([[5000, 8000], [12000, 13000]]);
    expect(v.duracion).toBe(14000);
  });

  it('un verso rápido que no se oyó no cae en el pasaje instrumental que le sigue', () => {
    // Se canta hasta los 8 s, de 8 a 20 s solo hay música, y el siguiente verso se oyó a los 20 s.
    const lineas = [lin(1, 0, 3000), lin(2, 20000, 23000)];
    const ajuste = [{ v: 0, de: 0, a: 0 }, { v: 1, de: -1, a: -1 }, { v: 2, de: 1, a: 1 }];
    const versos = ['a', 'x'.repeat(20), 'b'];
    const voz = canto([0.1, 0.1, 0.1, 0.1, 0, 0, 0, 0, 0, 0, 0.1, 0.1]);
    // Sin la voz, pegado al siguiente: en plena música.
    expect(tiempos(aplicarAjuste(versos, lineas, ajuste).lineas)[1]).toEqual([14000, 20000]);
    // Con ella, donde se canta, antes del pasaje.
    expect(tiempos(aplicarAjuste(versos, lineas, ajuste, ID_LETRA, voz).lineas)[1]).toEqual([3000, 8000]);
  });

  it('si justo antes del siguiente se canta, queda igual que sin la voz', () => {
    const lineas = [lin(1, 0, 3000), lin(2, 20000, 23000)];
    const ajuste = [{ v: 0, de: 0, a: 0 }, { v: 1, de: -1, a: -1 }, { v: 2, de: 1, a: 1 }];
    const versos = ['a', 'x'.repeat(20), 'b'];
    const voz = canto(new Array(12).fill(0.1));
    expect(aplicarAjuste(versos, lineas, ajuste, ID_LETRA, voz).lineas).toEqual(aplicarAjuste(versos, lineas, ajuste).lineas);
  });

  it('con casi nada de voz en el hueco, se coloca como siempre', () => {
    const lineas = [lin(1, 0, 3000), lin(2, 20000, 23000)];
    const ajuste = [{ v: 0, de: 0, a: 0 }, { v: 1, de: -1, a: -1 }, { v: 2, de: 1, a: 1 }];
    const versos = ['a', 'x'.repeat(20), 'b'];
    const voz = canto([0.1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.1, 0.1]);
    expect(aplicarAjuste(versos, lineas, ajuste, ID_LETRA, voz).lineas).toEqual(aplicarAjuste(versos, lineas, ajuste).lineas);
  });

  it('el último verso sin oír, tras el anterior pero donde vuelve a cantarse', () => {
    // El anterior acaba a los 4 s; de 4 a 8 s, música; desde los 8 s se canta otra vez.
    const voz = canto([0.1, 0.1, 0, 0, 0.1, 0.1, 0.1, 0.1]);
    const r = aplicarAjuste(['a', 'abcdefghij'], [lin(1, 0, 4000)], [{ v: 0, de: 0, a: 0 }, { v: 1, de: -1, a: -1 }], ID_LETRA, voz);
    expect(tiempos(r.lineas)[1]).toEqual([8000, 11000]);
  });
});

describe('alinearPorLetras', () => {
  const versos = ['夜の川を歩いて', '月が私を見ている', '朝はまだ来ないの'];
  const oido: Linea[] = [
    { id: 0, inicio: 2000, fin: 5000, texto: '夜の皮を歩いて' },
    { id: 1, inicio: 6000, fin: 9000, texto: '月が僕を見ている' },
    { id: 2, inicio: 10000, fin: 12000, texto: 'ご視聴ありがとうございました' },
    { id: 3, inicio: 14000, fin: 17000, texto: '朝はまだ来ない' },
  ];

  it('una línea por verso, con el texto de la letra y su hora', () => {
    const r = alinearPorLetras(versos, oido);
    expect(r.lineas.map((l) => l.texto)).toEqual(versos);
    expect(r.lineas.map((l) => l.id)).toEqual([ID_LETRA, ID_LETRA + 1, ID_LETRA + 2]);
    expect(r.conTiempo).toBe(3);
    expect(r.lineas[0].inicio).toBe(2000);
    expect(Math.abs(r.lineas[2].inicio - 14000)).toBeLessThan(150);
  });

  it('lo que el reconocedor se inventó en un pasaje instrumental no se lleva ningún verso', () => {
    const r = alinearPorLetras(versos, oido);
    expect(r.lineas.every((l) => l.inicio < 10000 || l.inicio >= 12000)).toBe(true);
  });
});

describe('alinearConVoz', () => {
  // Un modelo de juguete: el blanco es la clase 0; cada verso tiene un fonema propio (1, 2, 3) que suena en un marco.
  function modelo(marcos: number, suenan: Record<number, number>): ProbabilidadesCtc {
    const clases = 4;
    const logp = new Float32Array(marcos * clases);
    for (let t = 0; t < marcos; t++) {
      const c = suenan[t] ?? 0;
      for (let k = 0; k < clases; k++) logp[t * clases + k] = Math.log(k === c ? 0.9 : 0.1 / 3);
    }
    return { logp, marcos, clases, blanco: 0 };
  }
  const versos = ['夜の川を歩いて', '月が私を見ている', '朝はまだ来ないの'];
  const oido: Linea[] = [
    { id: 0, inicio: 2000, fin: 5000, texto: '夜の皮を歩いて' },
    { id: 1, inicio: 6000, fin: 9000, texto: '月が僕を見ている' },
    { id: 2, inicio: 14000, fin: 17000, texto: '朝はまだ来ない' },
  ];

  it('cada verso empieza donde suena su primer fonema, con la precisión del modelo', () => {
    // A 20 ms por marco: 2,4 s, 6,62 s y 14,3 s, cerca de donde los pone lo que oyó Whisper.
    const p = modelo(1000, { 120: 1, 331: 2, 715: 3 });
    const r = alinearConVoz(versos, oido, [[1], [2], [3]], p, 20);
    expect(r.conVoz).toBe(3);
    expect(r.lineas.map((l) => l.inicio)).toEqual([2400, 6620, 14300]);
  });

  it('un verso sin fonemas se queda donde lo pone lo que oyó Whisper', () => {
    const p = modelo(1000, { 120: 1, 715: 3 });
    const r = alinearConVoz(versos, oido, [[1], [], [3]], p, 20);
    expect(r.conVoz).toBe(2);
    expect(Math.abs(r.lineas[1].inicio - 6000)).toBeLessThan(150);
  });

  it('si los fonemas no caben, todo se queda como lo pone lo que oyó Whisper', () => {
    const r = alinearConVoz(versos, oido, [[1, 2, 3, 1, 2, 3], [2], [3]], modelo(3, {}), 20);
    expect(r.conVoz).toBe(0);
    expect(r.lineas[0].inicio).toBe(2000);
  });
});

describe('letraParaClaude', () => {
  it('los renglones tal como se pegaron, con sus marcas, y lo que se canta de cada uno', () => {
    const l = letraParaClaude('[Verse]\nCamino por el río\n\n[Chorus]\nLa luna ×2\n(Repeat Chorus)\n作詞：ハチ');
    expect(l.renglones).toEqual(['[Verse]', 'Camino por el río', '[Chorus]', 'La luna ×2', '(Repeat Chorus)', '作詞：ハチ']);
    expect(l.cantados).toEqual(['', 'Camino por el río', '', 'La luna', '', '']);
  });

  it('dónde empieza cada estrofa: tras una línea en blanco o un adorno, aunque sean varios', () => {
    expect(letraParaClaude('\nuno\ndos\n\n\ntres\n♪♪♪\ncuatro').estrofas).toEqual([2, 3]);
    const conAsteriscos = letraParaClaude('uno\n* * *\ndos\n***\ntres');
    expect(conAsteriscos.renglones).toEqual(['uno', 'dos', 'tres']);
    expect(conAsteriscos.estrofas).toEqual([1, 2]);
  });

  it('sin la hora de un comentario ni caracteres invisibles; un ※ suelto se queda, que dice algo', () => {
    const l = letraParaClaude(`[1:02] primer verso\npalabra${String.fromCharCode(0x200b)} unida\n※`);
    expect(l.renglones).toEqual(['primer verso', 'palabra unida', '※']);
    expect(l.cantados).toEqual(['primer verso', 'palabra unida', '']);
  });

  it('una letra en LRC, en el orden de sus horas', () => {
    expect(letraParaClaude('[00:20.00]segundo\n[00:10.00]primero\n[00:30.00]tercero').renglones).toEqual(['primero', 'segundo', 'tercero']);
  });
});

describe('sinMarcas', () => {
  it('un renglón que no se canta no sale aunque Claude le dé un tiempo, ni vuelve como un verso olvidado', () => {
    const cantados = ['', 'uno', 'dos', ''];
    const ajuste = sinMarcas(
      [
        { v: 0, de: 0, a: 0 },
        { v: 1, de: 1, a: 1 },
        { v: 2, de: 2, a: 2 },
        { v: 9, de: 3, a: 3 },
      ],
      cantados
    );
    expect(ajuste).toEqual([
      { v: 1, de: 1, a: 1 },
      { v: 2, de: 2, a: 2 },
      { v: 0, de: -2, a: -2 },
      { v: 3, de: -2, a: -2 },
    ]);
    expect(textos(aplicarAjuste(cantados, LINEAS, ajuste).lineas)).toEqual(['uno', 'dos']);
  });

  it('un verso que Claude se salta va detrás del anterior que suena, no detrás de un título', () => {
    const cantados = ['uno', '', 'dos', 'tres'];
    const r = aplicarAjuste(cantados, LINEAS, sinMarcas([{ v: 0, de: 0, a: 0 }, { v: 3, de: 3, a: 3 }], cantados));
    expect(textos(r.lineas)).toEqual(['uno', 'dos', 'tres']);
  });
});

describe('mensajeAjuste con estrofas', () => {
  it('una línea en blanco delante de cada estrofa, salvo la primera', () => {
    expect(mensajeAjuste(LINEAS.slice(0, 1), ['uno', 'dos', 'tres'], undefined, [0, 2])).toContain('LETRA:\n0: uno\n1: dos\n\n2: tres');
  });
});

describe('guiaDeClaude', () => {
  it('los versos en el orden en que los oyó Claude, con lo que repite, y una línea tosca para cada uno', () => {
    const cantados = ['', VERSOS[0], VERSOS[1], ''];
    const ajuste = sinMarcas(
      [
        { v: 1, de: 0, a: 0 },
        { v: 2, de: 1, a: 1 },
        { v: 2, de: 3, a: 3 },
        { v: 3, de: -2, a: -2 },
      ],
      cantados
    );
    const g = guiaDeClaude(cantados, LINEAS, ajuste);
    expect(g.versos).toEqual([VERSOS[0], VERSOS[1], VERSOS[1]]);
    expect(g.toscas.lineas.map((l) => l.inicio)).toEqual([10000, 14000, 22000]);
    expect(g.ubicados).toEqual([true, true, true]);
  });

  it('un verso que Claude no encontró va sin oír, con su línea tosca entre los vecinos', () => {
    const g = guiaDeClaude(VERSOS.slice(0, 3), LINEAS, [
      { v: 0, de: 0, a: 0 },
      { v: 1, de: -1, a: -1 },
      { v: 2, de: 2, a: 2 },
    ]);
    expect(g.ubicados).toEqual([true, false, true]);
    expect(g.toscas.lineas).toHaveLength(3);
    expect(g.toscas.lineas[1].inicio).toBeGreaterThanOrEqual(13000);
    expect(g.toscas.lineas[1].fin).toBeLessThanOrEqual(18000);
  });
});

describe('colocarConGuia', () => {
  it('lo que casa letra a letra va donde se oyen sus letras, no al principio de la línea que nombra Claude', () => {
    const oido = [lin(1, 10000, 16000, `${VERSOS[0]} ${VERSOS[1]}`), lin(2, 18000, 21000, VERSOS[2])];
    const guia = guiaDeClaude(VERSOS.slice(0, 3), oido, [
      { v: 0, de: 0, a: 0 },
      { v: 1, de: 0, a: 0 },
      { v: 2, de: 1, a: 1 },
    ]);
    const r = colocarConGuia(guia, oido);
    expect(textos(r.lineas)).toEqual(VERSOS.slice(0, 3));
    expect(r.lineas[0].inicio).toBe(10000);
    // El segundo empieza donde se oye su primera letra, dentro de la línea que comparte con el primero.
    expect(r.lineas[1].inicio).toBeGreaterThan(12000);
    expect(r.conTiempo).toBe(3);
  });

  it('una letra que no casa en nada (en rōmaji, por ejemplo) va toda donde la puso Claude', () => {
    const versos = ['Yoru no kawa wo aruite', 'Tsuki ga watashi wo miteiru'];
    const oido = [lin(1, 2000, 5000, '夜の川を歩いて'), lin(2, 6000, 9000, '月が私を見ている')];
    const r = colocarConGuia(
      guiaDeClaude(versos, oido, [
        { v: 0, de: 0, a: 0 },
        { v: 1, de: 1, a: 1 },
      ]),
      oido
    );
    expect(r.lineas.map((l) => l.inicio)).toEqual([2000, 6000]);
    expect(r.conTiempo).toBe(2);
  });

  it('donde Claude pone algo que no cabe entre los versos oídos, se estima entre ellos', () => {
    const oido = [lin(1, 10000, 13000, VERSOS[0]), lin(2, 14000, 17000, 'nada que ver'), lin(3, 18000, 21000, VERSOS[2]), lin(4, 30000, 33000, 'otra cosa')];
    // Claude puso el segundo a 30 s, detrás del tercero, que se oye a 18 s: ahí no cabe.
    const guia: GuiaLetra = {
      versos: VERSOS.slice(0, 3),
      toscas: { lineas: [lin(1, 10000, 13000, VERSOS[0]), lin(2, 30000, 33000, VERSOS[1]), lin(3, 18000, 21000, VERSOS[2])], conTiempo: 3, estimadas: 0 },
      ubicados: [true, true, true],
    };
    const r = colocarConGuia(guia, oido);
    expect(r.lineas[1].inicio).toBeGreaterThan(10000);
    expect(r.lineas[1].inicio).toBeLessThan(18000);
    expect(r.estimadas).toBe(1);
  });
});

describe('alinearConVoz con lo que entendió Claude', () => {
  function modelo(marcos: number, suenan: Record<number, number>): ProbabilidadesCtc {
    const clases = 4;
    const logp = new Float32Array(marcos * clases);
    for (let t = 0; t < marcos; t++) {
      const c = suenan[t] ?? 0;
      for (let k = 0; k < clases; k++) logp[t * clases + k] = Math.log(k === c ? 0.9 : 0.1 / 3);
    }
    return { logp, marcos, clases, blanco: 0 };
  }

  it('un estribillo escrito una vez, sobre algo oído que no se le parece, suena en cada vuelta que dice Claude', () => {
    const versos = ['夜の川を歩いて', '月が私を見ている'];
    const malOido: Linea[] = [
      { id: 0, inicio: 2000, fin: 5000, texto: 'Sukiyaki' },
      { id: 1, inicio: 6000, fin: 9000, texto: 'Asahi' },
      { id: 2, inicio: 14000, fin: 17000, texto: 'Asahi' },
    ];
    // El fonema del estribillo (2) suena dos veces: a 6,62 s y a 14,3 s.
    const p = modelo(1000, { 120: 1, 331: 2, 715: 2 });
    const guia = guiaDeClaude(versos, malOido, [
      { v: 0, de: 0, a: 0 },
      { v: 1, de: 1, a: 1 },
      { v: 1, de: 2, a: 2 },
    ]);
    const r = alinearConVoz(guia.versos, malOido, [[1], [2], [2]], p, 20);
    expect(r.conVoz).toBe(3);
    expect(textos(r.lineas)).toEqual([versos[0], versos[1], versos[1]]);
    expect(r.lineas.map((l) => l.inicio)).toEqual([2400, 6620, 14300]);
  });
});
