import { describe, expect, it } from 'vitest';
import { cuadraConTono, juzgarTonos, registroDeVoz, type SilabaTonal, tramosDeSilabas } from './practicaTonos';
import type { MarcoTono } from './tono';

/** La forma de cada tono en los cinco niveles de Chao: el primero, alto y llano; el segundo sube; el tercero, bajo; el cuarto cae. */
const FORMAS: Record<number, number[]> = { 1: [5, 5], 2: [3, 5], 3: [2, 1, 1], 4: [5, 1], 5: [3, 3] };

interface Sintetica {
  tono: number;
  /** Marcos con voz, de 10 ms. */
  voz?: number;
  /** Marcos sin voz delante: una consonante sorda. Con 0, la voz sigue desde la sílaba anterior (una m o una l). */
  sorda?: number;
}

/** Una frase sintética: cada sílaba con la curva de su tono, en una voz de 150 Hz que abarca de -5 a +5 semitonos. */
function frase(silabas: Sintetica[], base = 150): MarcoTono[] {
  const marcos: MarcoTono[] = [];
  const poner = (f0: number | null, energia: number) => marcos.push({ t: marcos.length * 0.01 + 0.005, f0, energia });
  for (let i = 0; i < 10; i++) poner(null, 0.002);
  for (const s of silabas) {
    const sorda = s.sorda ?? 6;
    const voz = s.voz ?? (s.tono === 5 ? 12 : 22);
    for (let i = 0; i < sorda; i++) poner(null, 0.01);
    const forma = FORMAS[s.tono];
    for (let i = 0; i < voz; i++) {
      const x = (i / (voz - 1)) * (forma.length - 1);
      const a = Math.floor(x);
      const nivel = forma[a] + (forma[Math.min(forma.length - 1, a + 1)] - forma[a]) * (x - a);
      // Sin consonante sorda, la energía baja en la frontera, como en una m o una l.
      const envolvente = sorda ? 1 : 0.25 + 0.75 * Math.sin((Math.PI * (i + 0.5)) / voz);
      poner(base * 2 ** (((nivel - 3) * 2.5) / 12), 0.1 * envolvente);
    }
  }
  for (let i = 0; i < 10; i++) poner(null, 0.002);
  return marcos;
}

const silaba = (tono: number, extra: Partial<SilabaTonal> = {}): SilabaTonal => ({ texto: '字', lectura: 'zi', tono, pausa: false, ...extra });

describe('dónde suena cada sílaba', () => {
  it('con consonantes sordas, cada frontera cae en su hueco sin voz', () => {
    const curva = frase([{ tono: 1 }, { tono: 2 }, { tono: 3 }, { tono: 4 }]);
    const tramos = tramosDeSilabas(curva, [1, 2, 3, 4].map((t) => silaba(t)))!;
    expect(tramos).toHaveLength(4);
    // Cada sílaba sintética ocupa 28 marcos (6 sin voz y 22 con ella), tras 10 de silencio.
    tramos.forEach((t, i) => {
      const inicioVoz = 0.1 + i * 0.28 + 0.06;
      expect(t.inicio).toBeLessThanOrEqual(inicioVoz);
      expect(t.fin).toBeGreaterThanOrEqual(inicioVoz + 0.21);
    });
  });

  it('con la voz seguida, parte donde baja la energía', () => {
    const curva = frase([{ tono: 1, sorda: 0 }, { tono: 4, sorda: 0 }, { tono: 1, sorda: 0 }]);
    const tramos = tramosDeSilabas(curva, [1, 4, 1].map((t) => silaba(t)))!;
    expect(tramos.map((t) => Math.round((t.fin - 0.1) / 0.22))).toEqual([1, 2, 3]);
  });

  it('sin voz para todas, nada', () => {
    expect(tramosDeSilabas(frase([{ tono: 1, voz: 3 }]), [silaba(1), silaba(2), silaba(3)])).toBeNull();
  });
});

describe('la forma de cada tono', () => {
  it('cada tono sintético cuadra con el suyo y con ninguno de los otros, salvo el tercero con el segundo', () => {
    const curva = frase([{ tono: 1 }, { tono: 2 }, { tono: 3 }, { tono: 4 }]);
    const r = juzgarTonos(curva, [1, 2, 3, 4].map((t) => silaba(t)))!;
    const aceptados = r.curvas.map((p) => [1, 2, 3, 4].filter((t) => cuadraConTono(p!, t, r.registro).veredicto === 'bien'));
    expect(aceptados).toEqual([[1], [2], [3], [4]]);
    expect(r.juicios.map((j) => j.veredicto)).toEqual(['bien', 'bien', 'bien', 'bien']);
  });

  it('lo que no cuadra dice qué se oye', () => {
    const curva = frase([{ tono: 4 }, { tono: 2 }, { tono: 1 }, { tono: 1 }]);
    const r = juzgarTonos(curva, [silaba(1), silaba(4), silaba(3), silaba(2)])!;
    expect(r.juicios).toEqual([
      { veredicto: 'revisar', oida: 'cae' },
      { veredicto: 'revisar', oida: 'sube' },
      { veredicto: 'revisar', oida: 'alto' },
      { veredicto: 'revisar', oida: 'llano' },
    ]);
  });

  it('el tercero que deprisa pasa al segundo vale de las dos formas, y el neutro no se juzga', () => {
    const curva = frase([{ tono: 2 }, { tono: 3 }, { tono: 5 }]);
    const r = juzgarTonos(curva, [silaba(3, { tambien: 2 }), silaba(3), silaba(5)])!;
    expect(r.juicios.map((j) => j.veredicto)).toEqual(['bien', 'bien', 'sin-juzgar']);
  });

  it('el registro se mide en la voz de quien habla, con un mínimo para quien casi no la mueve', () => {
    const r = registroDeVoz(frase([{ tono: 1 }, { tono: 1 }]));
    expect(r.alto - r.bajo).toBeCloseTo(5, 5);
    expect(r.referencia).toBeCloseTo(150 * 2 ** (5 / 12), 0);
  });
});
