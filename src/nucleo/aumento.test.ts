import { describe, expect, it } from 'vitest';
import type { EstadoPalabra, PalabraToken } from '../compartido/tipos';
import { SIGNOS_FRASE } from '../lenguas/japones/escritura';
import type { SegmentoLectura } from '../lenguas/tipos';
import { comprensionDe, frasesEnPagina, gramaticaEnPagina, palabraEn, palabrasEnPagina } from './aumento';
import type { LineaTexto } from './capaTexto';
import { leerPagina } from './seleccion';

/** Un renglón horizontal de letras de 0,04 de ancho, desde x0, con sus cortes. */
function renglon(texto: string, x0: number, y0: number, extra: Partial<LineaTexto> = {}): LineaTexto {
  const n = texto.length;
  return { texto, vertical: false, caja: { x0, y0, x1: x0 + 0.04 * n, y1: y0 + 0.04 }, cortes: Array.from({ length: n + 1 }, (_, i) => x0 + 0.04 * i), ...extra };
}

function token(superficie: string, furigana: SegmentoLectura[], estado: EstadoPalabra = 'desconocida', esPalabra = true): PalabraToken {
  return { superficie, lema: superficie, lectura: '', lecturaLema: '', clave: superficie, esPalabra, esGramatica: !esPalabra, flexion: [], furigana, estado, rastreada: false };
}

// 母親は水を飲む。 en un renglón: 母親 (0-1), は (2), 水 (3), を (4), 飲む (5-6), 。 (7).
const TOKENS = [
  token('母親', [{ texto: '母親', lectura: 'ははおや' }]),
  token('は', [{ texto: 'は' }], 'conocida', false),
  token('水', [{ texto: '水', lectura: 'みず' }], 'conocida'),
  token('を', [{ texto: 'を' }], 'conocida', false),
  token('飲む', [{ texto: '飲', lectura: 'の' }, { texto: 'む' }], 'aprendiendo'),
  token('。', [{ texto: '。' }], 'conocida', false),
];

describe('las palabras en su sitio de la página', () => {
  const p = leerPagina([renglon('母親は水を飲む。', 0.1, 0.2)]);
  const palabras = palabrasEnPagina(p, TOKENS);

  it('cada palabra con su caja, y solo las palabras, no las partículas', () => {
    expect(palabras.map((w) => TOKENS[w.token].superficie)).toEqual(['母親', '水', '飲む']);
    const [c] = palabras[2].cajas;
    expect(c.x0).toBeCloseTo(0.1 + 0.04 * 5);
    expect(c.x1).toBeCloseTo(0.1 + 0.04 * 7);
  });

  it('la lectura va sobre su kanji, no sobre el okurigana', () => {
    const [l] = palabras[2].lecturas;
    expect(l.lectura).toBe('の');
    expect(l.cajas[0].x0).toBeCloseTo(0.1 + 0.04 * 5);
    expect(l.cajas[0].x1).toBeCloseTo(0.1 + 0.04 * 6);
    expect(l.impreso).toBe(false);
  });

  it('donde la página ya trae furigana impreso, se apunta para no ponerle otro', () => {
    const q = leerPagina([renglon('母親は水を飲む。', 0.1, 0.2, { rubi: [[0, 2]] })]);
    const w = palabrasEnPagina(q, TOKENS);
    expect(w[0].lecturas[0].impreso).toBe(true);
    expect(w[1].lecturas[0].impreso).toBe(false);
  });

  it('se sabe qué palabra hay en cada letra', () => {
    expect(palabraEn(p, palabras, { linea: 0, letra: 6 })).toBe(2);
    expect(palabraEn(p, palabras, { linea: 0, letra: 3 })).toBe(1);
    expect(palabraEn(p, palabras, { linea: 0, letra: 2 })).toBe(-1);
  });

  it('una palabra partida entre dos renglones lleva una caja en cada uno', () => {
    // El primer renglón llega al margen: el párrafo sigue en el siguiente.
    const q = leerPagina([renglon('今日は私と私の母', 0.1, 0.2), renglon('親は水を飲む。', 0.1, 0.25)]);
    const particula = (s: string) => token(s, [{ texto: s }], 'conocida', false);
    const t = [token('今日', [{ texto: '今日', lectura: 'きょう' }]), particula('は'), token('私', []), particula('と'), token('私', []), particula('の'), token('母親', [{ texto: '母親', lectura: 'ははおや' }]), ...TOKENS.slice(1)];
    const w = palabrasEnPagina(q, t);
    const madre = w.find((x) => t[x.token].superficie === '母親');
    expect(madre?.cajas).toHaveLength(2);
    expect(madre?.lecturas[0].cajas).toHaveLength(2);
  });
});

describe('cuánto se entiende de la página', () => {
  it('las palabras que no son nuevas, sin contar las partículas ni las ignoradas', () => {
    expect(comprensionDe(TOKENS)).toEqual({ total: 3, nuevas: 1, porcentaje: 67 });
    expect(comprensionDe([token('東京', [], 'ignorada')])).toEqual({ total: 0, nuevas: 0, porcentaje: 0 });
  });
});

describe('las frases y la gramática de la página', () => {
  const p = leerPagina([renglon('雨が降った。家に帰るしかな', 0.1, 0.2), renglon('い。', 0.1, 0.25)]);

  it('cada frase con sus cajas, también la que cruza renglones', () => {
    const f = frasesEnPagina(p, SIGNOS_FRASE);
    expect(f.map((x) => x.frase)).toEqual(['雨が降った。', '家に帰るしかない。']);
    expect(f[1].cajas).toHaveLength(2);
  });

  it('cada punto de gramática, donde aparece su forma dentro de la frase', () => {
    const f = frasesEnPagina(p, SIGNOS_FRASE);
    const g = gramaticaEnPagina(p, f, (frase) => (frase.includes('しかない') ? [{ patron: '〜しかない', fragmento: 'しかない', significado: 'no queda más que', fuente: 'regla' }] : []));
    expect(g).toHaveLength(1);
    expect(g[0].cajas).toHaveLength(2);
    expect(g[0].cajas[0].x0).toBeCloseTo(0.1 + 0.04 * 10);
  });
});
