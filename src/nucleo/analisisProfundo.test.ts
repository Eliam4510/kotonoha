import { describe, expect, it } from 'vitest';
import { JAPONES } from '../lenguas/japones';
import { alinearFurigana } from '../lenguas/japones/tokens';
import type { LecturaCorregida } from './analisisProfundo';
import { aplicarLecturas as aplicarCon } from './analisisProfundo';
import type { TokenUnido } from '../lenguas/tipos';
import { aplicarSincronia, sincroniaDesdePuntos } from './sincronia';

const aplicarLecturas = (tokens: TokenUnido[], correcciones: LecturaCorregida[]) => aplicarCon(tokens, correcciones, JAPONES.lectura);

const tk = (superficie: string, lema = superficie, lectura = superficie, extra: Partial<TokenUnido> = {}): TokenUnido => ({
  superficie,
  lema,
  lectura,
  categoria: '名詞',
  esPalabra: true,
  esGramatica: false,
  flexion: [],
  furigana: alinearFurigana(superficie, lectura),
  inflexionado: superficie !== lema,
  ...extra,
});

describe('lecturas corregidas por Claude', () => {
  it('corrige una lectura poética y su furigana', () => {
    const [t] = aplicarLecturas([tk('運命', '運命', 'うんめい')], [{ superficie: '運命', lectura: 'さだめ' }]);
    expect(t.lectura).toBe('さだめ');
    expect(t.furigana).toEqual([{ texto: '運命', lectura: 'さだめ' }]);
    expect(t.lecturaCorregida).toBe(true);
    expect(t.lecturaLemaCorregida).toBe('さだめ');
  });

  it('cambia el lema en verbos ambiguos', () => {
    const [t] = aplicarLecturas([tk('行った', '行く', 'いった')], [{ superficie: '行った', lectura: 'おこなった', lema: '行う', lectura_lema: 'おこなう' }]);
    expect(t).toMatchObject({ lema: '行う', lectura: 'おこなった', lecturaLemaCorregida: 'おこなう' });
    expect(t.furigana).toEqual([{ texto: '行', lectura: 'おこな' }, { texto: 'った' }]);
  });

  it('une tokens que el analizador partió', () => {
    const r = aplicarLecturas([tk('一'), tk('昨日'), tk('は')], [{ superficie: '一昨日', lectura: 'おととい' }]);
    expect(r.map((t) => t.superficie)).toEqual(['一昨日', 'は']);
    expect(r[0].lectura).toBe('おととい');
  });

  it('ignora correcciones que no encajan y no modifica los tokens originales', () => {
    const original = [tk('猫', '猫', 'ねこ')];
    const r = aplicarLecturas(original, [{ superficie: '犬', lectura: 'いぬ' }]);
    expect(r[0].lectura).toBe('ねこ');
    aplicarLecturas(original, [{ superficie: '猫', lectura: 'ニャー' }]);
    expect(original[0].lectura).toBe('ねこ');
  });
});

describe('sincronización', () => {
  const lineas = [{ inicio: 10000, fin: 12000 }, { inicio: 100000, fin: 102000 }];

  it('un punto da un desfase', () => {
    expect(sincroniaDesdePuntos([{ linea: 10000, video: 12500 }])).toEqual({ desfaseMs: 2500, escala: 1 });
  });

  it('dos puntos corrigen también la velocidad', () => {
    // Subtítulos a 25 fps sobre un video a 23,976 fps, con 1 s de retraso.
    const factor = 25 / 23.976;
    const s = sincroniaDesdePuntos([
      { linea: 10000, video: 10000 * factor + 1000 },
      { linea: 1000000, video: 1000000 * factor + 1000 },
    ]);
    expect(s.escala).toBeCloseTo(factor, 5);
    expect(s.desfaseMs).toBe(1000);
    const [l] = aplicarSincronia([{ inicio: 500000, fin: 501000 }], s);
    expect(l.inicio).toBeCloseTo(500000 * factor + 1000, -1);
  });

  it('descarta escalas absurdas o puntos demasiado cercanos', () => {
    expect(sincroniaDesdePuntos([{ linea: 1000, video: 1000 }, { linea: 2000, video: 9000 }]).escala).toBe(1);
    expect(sincroniaDesdePuntos([{ linea: 10000, video: 10000 }, { linea: 100000, video: 400000 }]).escala).toBe(1);
  });

  it('nunca da tiempos negativos', () => {
    expect(aplicarSincronia(lineas, { desfaseMs: -20000, escala: 1 })[0].inicio).toBe(0);
  });

  it('sin cambios devuelve la misma lista', () => {
    expect(aplicarSincronia(lineas, { desfaseMs: 0, escala: 1 })).toBe(lineas);
  });
});
