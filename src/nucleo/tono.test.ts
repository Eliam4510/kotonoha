import { describe, expect, it } from 'vitest';
import { curvaDeTono, mediana, referenciaDeVoz, semitonos } from './tono';

const FS = 16000;

/** Una voz de juguete: cinco armónicos con el tono que diga `f0(t)`, que puede cambiar. */
function voz(segundos: number, f0: (t: number) => number, amplitud = 0.3): Float32Array {
  const n = Math.round(segundos * FS);
  const x = new Float32Array(n);
  let fase = 0;
  for (let i = 0; i < n; i++) {
    fase += (2 * Math.PI * f0(i / FS)) / FS;
    let v = 0;
    for (let h = 1; h <= 5; h++) v += Math.sin(h * fase) / h;
    x[i] = amplitud * v * 0.5;
  }
  return x;
}

const sonoros = (c: ReturnType<typeof curvaDeTono>) => c.filter((m) => m.f0 !== null);

describe('la curva del tono', () => {
  it('un tono fijo se mide con menos de un uno por ciento de error', () => {
    for (const hz of [95, 150, 230, 320]) {
      const c = curvaDeTono(voz(0.5, () => hz), FS);
      const s = sonoros(c);
      expect(s.length).toBeGreaterThan(c.length * 0.8);
      expect(Math.abs(mediana(s.map((m) => m.f0!)) - hz) / hz).toBeLessThan(0.01);
    }
  });

  it('sigue una subida y una bajada', () => {
    const c = curvaDeTono(voz(1, (t) => (t < 0.5 ? 140 + 160 * t : 220 - 160 * (t - 0.5))), FS);
    const en = (t: number) => sonoros(c).reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a)).f0!;
    expect(en(0.1)).toBeLessThan(en(0.45));
    expect(en(0.9)).toBeLessThan(en(0.55));
    expect(Math.abs(en(0.45) - 212)).toBeLessThan(6);
  });

  it('el silencio y el ruido no tienen tono', () => {
    expect(sonoros(curvaDeTono(new Float32Array(FS), FS))).toHaveLength(0);
    let semilla = 7;
    const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647) * 2 - 1;
    const ruido = Float32Array.from({ length: FS }, () => 0.2 * azar());
    const c = curvaDeTono(ruido, FS);
    expect(sonoros(c).length).toBeLessThan(c.length * 0.15);
  });

  it('los marcos van cada 10 ms y marcan el centro de su ventana', () => {
    const c = curvaDeTono(voz(0.3, () => 200), FS);
    expect(c[1].t - c[0].t).toBeCloseTo(0.01, 5);
    expect(c[0].t).toBeGreaterThan(0.01);
    expect(c[0].t).toBeLessThan(0.03);
  });

  it('una grabación a 48 kHz da el mismo tono', () => {
    const n = 48000 * 0.4;
    const x = Float32Array.from({ length: n }, (_, i) => 0.3 * Math.sin((2 * Math.PI * 180 * i) / 48000));
    const s = sonoros(curvaDeTono(x, 48000));
    expect(Math.abs(mediana(s.map((m) => m.f0!)) - 180)).toBeLessThan(2);
  });

  it('una voz con ruido sigue teniendo tono si empieza limpia, y el ruido solo no', () => {
    let semilla = 11;
    const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647) * 2 - 1;
    const limpia = voz(0.8, () => 150);
    // Desde 0,2 s, ruido casi tan fuerte como la voz: YIN ya no la ve periódica del todo, y sin seguirla desde la parte
    // limpia perdería cerca de la mitad de los marcos.
    const sucia = limpia.map((v, i) => (i < 0.2 * FS ? v : v + 0.24 * azar()));
    const c = curvaDeTono(sucia, FS);
    const tramo = c.filter((m) => m.t > 0.3 && m.t < 0.75);
    const conTono = tramo.filter((m) => m.f0 !== null);
    expect(conTono.length).toBeGreaterThan(tramo.length * 0.85);
    expect(Math.abs(mediana(conTono.map((m) => m.f0!)) - 150)).toBeLessThan(3);
    const ruido = curvaDeTono(Float32Array.from({ length: FS }, () => 0.24 * azar()), FS);
    expect(sonoros(ruido)).toHaveLength(0);
  });

  it('un salto de octava de unos marcos se corrige con el tono de alrededor, no con el de toda la grabación', () => {
    // Alta a 170 Hz y luego grave a 105, con 80 ms al doble en la parte grave: lo que YIN da a veces. Contra el tono medio
    // de la grabación (170 Hz), 210 no parece un salto de octava; contra el de alrededor, sí.
    const c = curvaDeTono(voz(0.62, (t) => (t < 0.4 ? 170 : t >= 0.5 && t < 0.58 ? 210 : 105)), FS);
    const salto = sonoros(c).filter((m) => m.t > 0.51 && m.t < 0.57);
    expect(salto.length).toBeGreaterThan(0);
    for (const m of salto) expect(m.f0!).toBeLessThan(120);
  });

  it('semitonos respecto a la voz de quien habla', () => {
    expect(semitonos(220, 110)).toBeCloseTo(12, 6);
    expect(semitonos(110, 110)).toBe(0);
    expect(referenciaDeVoz([{ t: 0, f0: 100, energia: 1 }, { t: 0.01, f0: null, energia: 0 }, { t: 0.02, f0: 300, energia: 1 }, { t: 0.03, f0: 200, energia: 1 }])).toBe(200);
  });
});
