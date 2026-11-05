import { describe, expect, it } from 'vitest';
import { type ConfigModo, MODOS, type ObjetivoFrase } from '../compartido/ajustes';
import type { LineaAnalizada, PalabraToken } from '../compartido/tipos';
import {
  aFuriganaAnki,
  calcularEstadisticas,
  clasificarFrase,
  esRecomendada,
  filtrarLineas,
  fraseConNegrita,
  nivelDe,
  palabrasPrioritarias,
} from './frases';
import { decidirSalto, duracionPausaDinamica, type LineaModo, MotorModos, visibilidadVelo } from './modos';

const pal = (lema: string, estado: PalabraToken['estado'], extra: Partial<PalabraToken> = {}): PalabraToken => ({
  superficie: lema,
  lema,
  lectura: lema,
  lecturaLema: lema,
  clave: `${lema}|${lema}`,
  esPalabra: true,
  esGramatica: false,
  flexion: [],
  furigana: [{ texto: lema }],
  estado,
  rastreada: false,
  ...extra,
});

const OPC = { frecuenciaMaxima: 20000 };

describe('clasificación de frases', () => {
  it('reconoce una sola palabra desconocida', () => {
    const f = [pal('猫', 'conocida'), pal('犬', 'conocida'), pal('鳥', 'desconocida', { rango: 500 })];
    const c = clasificarFrase(f, OPC);
    expect(c.has('1d')).toBe(true);
    expect(c.has('recomendadas')).toBe(true);
    expect(c.has('2mas')).toBe(false);
    expect(c.has('conocidas')).toBe(false);
  });

  it('no recomienda palabras raras ni frases muy cortas', () => {
    expect(esRecomendada([pal('a', 'conocida'), pal('b', 'conocida'), pal('c', 'desconocida', { rango: 50000 })], OPC)).toBe(false);
    expect(esRecomendada([pal('a', 'desconocida')], OPC)).toBe(false);
  });

  it('marca las frases totalmente conocidas', () => {
    expect(clasificarFrase([pal('猫', 'conocida')], OPC).has('conocidas')).toBe(true);
  });

  it('una línea sin palabras reales solo cuenta como «todas»', () => {
    expect([...clasificarFrase([pal('!', 'conocida', { esPalabra: false })], OPC)]).toEqual(['todas']);
  });
});

const linea = (id: number, palabras: PalabraToken[]): LineaAnalizada => ({ id, inicio: id * 1000, fin: id * 1000 + 500, texto: palabras.map((p) => p.superficie).join(''), palabras });

describe('estadísticas', () => {
  const lineas = [
    linea(0, [pal('猫', 'conocida'), pal('犬', 'conocida'), pal('鳥', 'desconocida', { rango: 100 })]),
    linea(1, [pal('猫', 'conocida'), pal('魚', 'desconocida'), pal('馬', 'desconocida')]),
    linea(2, [pal('猫', 'conocida'), pal('名前', 'ignorada')]),
  ];

  it('calcula comprensión y frases', () => {
    const e = calcularEstadisticas(lineas, OPC);
    expect(e.comprension).toBe(57);
    expect(e.nivel).toBe('dificil');
    expect(e.frases).toEqual({ conocidas: 1, unaDesconocida: 1, variasDesconocidas: 1 });
    expect(e.unicas).toEqual({ conocidas: 2, desconocidas: 3, ignoradas: 1 });
    expect(e.recomendadas).toBe(1);
    expect(e.frecuenciaMedia).toBe(100);
  });

  it('asigna los niveles', () => {
    expect(nivelDe(100)).toBe('excepcional');
    expect(nivelDe(91)).toBe('genial');
    expect(nivelDe(0)).toBe('ambiciosa');
  });

  it('prioriza las palabras más repetidas', () => {
    const r = palabrasPrioritarias([...lineas, linea(3, [pal('魚', 'desconocida')])]);
    expect(r[0].palabra.lema).toBe('魚');
    expect(r[0].veces).toBe(2);
  });

  it('filtra el navegador', () => {
    expect(filtrarLineas(lineas, '1d', OPC, new Set(), new Set()).map((l) => l.id)).toEqual([0]);
    expect(filtrarLineas(lineas, '2mas', OPC, new Set(), new Set()).map((l) => l.id)).toEqual([1]);
    expect(filtrarLineas(lineas, 'marcadas', OPC, new Set([2]), new Set()).map((l) => l.id)).toEqual([2]);
    const repetida = [...lineas, linea(3, [pal('猫', 'conocida'), pal('鳥', 'desconocida')])];
    expect(filtrarLineas(repetida, '1dUnicas', OPC, new Set(), new Set()).map((l) => l.id)).toEqual([0]);
  });
});

describe('formatos para Anki', () => {
  const f = [
    pal('食べる', 'desconocida', { furigana: [{ texto: '食', lectura: 'た' }, { texto: 'べる' }] }),
    pal('赤', 'conocida', { furigana: [{ texto: '赤', lectura: 'あか' }] }),
    pal('と', 'conocida'),
  ];

  it('genera furigana con espacios entre palabras', () => {
    expect(aFuriganaAnki(f)).toBe(' 食[た]べる 赤[あか]と'.trim());
  });

  it('marca la palabra objetivo', () => {
    expect(fraseConNegrita(f, '食べる|食べる')).toBe('<b>食べる</b>赤と');
    expect(aFuriganaAnki(f, '赤|赤')).toContain('<b> 赤[あか]</b>');
  });
});

const lineasModo = (clases: ObjetivoFrase[][]): LineaModo[] =>
  clases.map((c, i) => ({ inicio: 1000 + i * 3000, fin: 3000 + i * 3000, clases: new Set<ObjetivoFrase>(['todas', ...c]) }));

/** Simula la reproducción y anota lo que pide el motor. */
function simular(config: ConfigModo, lineas: LineaModo[], hasta: number) {
  const m = new MotorModos(config, lineas, 0);
  const acciones: { ms: number; tipo: string; indice: number }[] = [];
  for (let ms = 0; ms <= hasta; ms += 40) {
    const a = m.alAvanzar(ms);
    if (a) acciones.push({ ms, tipo: a.tipo === 'pausar' ? a.momento : 'rebobinar', indice: a.indice });
  }
  return acciones;
}

describe('motor de modos', () => {
  const lineas = lineasModo([[], ['1d'], []]);

  it('el modo normal nunca pausa', () => {
    expect(simular(MODOS.normal, lineas, 12000)).toEqual([]);
  });

  it('la lectura intensiva pausa antes de cada frase, una sola vez', () => {
    const a = simular(MODOS.lecturaIntensiva, lineas, 12000);
    expect(a.map((x) => [x.tipo, x.indice])).toEqual([['antes', 0], ['antes', 1], ['antes', 2]]);
    expect(a[0].ms).toBeGreaterThanOrEqual(920);
    expect(a[0].ms).toBeLessThan(1000);
  });

  it('la escucha intensiva pausa al final de cada frase', () => {
    const a = simular(MODOS.escuchaIntensiva, lineas, 12000);
    expect(a.map((x) => [x.tipo, x.indice])).toEqual([['despues', 0], ['despues', 1], ['despues', 2]]);
    expect(a[0].ms).toBeGreaterThanOrEqual(2940);
  });

  it('el enfoque 1D solo actúa en frases con una palabra desconocida, y rebobina', () => {
    const a = simular(MODOS.enfoque1d, lineas, 12000);
    expect(a).toEqual([expect.objectContaining({ tipo: 'rebobinar', indice: 1 })]);
  });

  it('vuelve a actuar tras un salto manual', () => {
    const m = new MotorModos(MODOS.escuchaIntensiva, lineas, 0);
    let n = 0;
    for (let ms = 2800; ms <= 3200; ms += 40) if (m.alAvanzar(ms)) n++;
    expect(n).toBe(1);
    for (let ms = 2800; ms <= 3200; ms += 40) if (m.alAvanzar(ms)) n++;
    expect(n).toBe(1); // Sin salto grande no se repite
    m.alAvanzar(10000);
    for (let ms = 2800; ms <= 3200; ms += 40) if (m.alAvanzar(ms)) n++;
    expect(n).toBe(2);
  });

  it('cuenta las pausas automáticas de cada línea', () => {
    const m = new MotorModos({ ...MODOS.lecturaIntensiva, disparador: 'antesYDespues' }, lineas, 0);
    for (let ms = 0; ms <= 3200; ms += 40) m.alAvanzar(ms);
    expect(m.pausasAutomaticas(0)).toBe(2);
  });
});

describe('velos', () => {
  const base = { pausado: false, tipoPausa: null, autoEnLinea: 0, clases: new Set<ObjetivoFrase>(['todas']), encima: false } as const;

  it('oculta y revela según la pausa', () => {
    const v = MODOS.escuchaIntensiva.velarObjetivo;
    expect(visibilidadVelo(v, base)).toBe('oculta');
    expect(visibilidadVelo(v, { ...base, pausado: true, tipoPausa: 'auto', autoEnLinea: 1 })).toBe('visible');
  });

  it('mostrar al pausar revela con cualquier pausa', () => {
    const v = MODOS.alPausar.velarObjetivo;
    expect(visibilidadVelo(v, { ...base, pausado: true, tipoPausa: 'manual' })).toBe('visible');
    expect(visibilidadVelo(v, base)).toBe('oculta');
  });

  it('revela por estado de la frase y al pasar el ratón', () => {
    const v = MODOS.enfoque1d.velarObjetivo;
    expect(visibilidadVelo(v, { ...base, clases: new Set<ObjetivoFrase>(['todas', '1d']) })).toBe('visible');
    expect(visibilidadVelo(v, { ...base, encima: true })).toBe('visible');
  });

  it('puede difuminar en vez de ocultar', () => {
    expect(visibilidadVelo({ modo: 'difuminar', revelarEnPausa: [], revelarPorEstado: [], revelarAlPasar: false }, base)).toBe('difuminada');
  });
});

describe('pausa dinámica', () => {
  it('depende de la longitud y respeta el mínimo', () => {
    expect(duracionPausaDinamica(20, 4, 2)).toBe(5000);
    expect(duracionPausaDinamica(2, 4, 2)).toBe(2000);
  });
});

describe('salto de escenas', () => {
  const l = [{ inicio: 10000, fin: 12000 }, { inicio: 30000, fin: 31000 }];

  it('acelera en un hueco largo y vuelve a velocidad normal antes de la frase', () => {
    expect(decidirSalto('4', 13000, l, false)).toEqual({ tipo: 'velocidad', valor: 4 });
    expect(decidirSalto('4', 20000, l, true)).toBeNull();
    expect(decidirSalto('4', 29600, l, true)).toEqual({ tipo: 'restaurar' });
    expect(decidirSalto('4', 30500, l, true)).toEqual({ tipo: 'restaurar' });
  });

  it('no acelera huecos cortos ni después de la última línea', () => {
    expect(decidirSalto('4', 9000, l, false)).toBeNull();
    expect(decidirSalto('4', 40000, l, false)).toBeNull();
  });

  it('el modo saltar va directo a la frase siguiente', () => {
    expect(decidirSalto('saltar', 13000, l, false)).toEqual({ tipo: 'saltar', ms: 29400 });
  });

  it('desactivado restaura la velocidad si estaba acelerando', () => {
    expect(decidirSalto('no', 13000, l, true)).toEqual({ tipo: 'restaurar' });
    expect(decidirSalto('no', 13000, l, false)).toBeNull();
  });
});
