import { describe, expect, it } from 'vitest';
import { remuestreador, remuestrear } from './remuestreo';

const tono = (hz: number, frecuencia: number, n: number, fase = 0) => Float32Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * hz * i) / frecuencia + fase));
const errorMaximo = (a: Float32Array, b: Float32Array, desde: number, hasta: number) => {
  let e = 0;
  for (let i = desde; i < hasta; i++) e = Math.max(e, Math.abs(a[i] - b[i]));
  return e;
};
const rms = (x: Float32Array, desde: number, hasta: number) => {
  let s = 0;
  for (let i = desde; i < hasta; i++) s += x[i] * x[i];
  return Math.sqrt(s / (hasta - desde));
};

describe('remuestrear', () => {
  it('un segundo sigue siendo un segundo', () => {
    expect(remuestrear(new Float32Array(16000), 16000, 44100).length).toBe(44100);
    expect(remuestrear(new Float32Array(44100), 44100, 16000).length).toBe(16000);
  });

  it('de 16 kHz a 44,1 kHz, un tono queda igual y en su sitio', () => {
    const y = remuestrear(tono(1000, 16000, 16000), 16000, 44100);
    expect(errorMaximo(y, tono(1000, 44100, 44100), 200, 44000)).toBeLessThan(2e-3);
  });

  it('de 44,1 kHz a 16 kHz, igual', () => {
    const y = remuestrear(tono(3000, 44100, 44100), 44100, 16000);
    expect(errorMaximo(y, tono(3000, 16000, 16000), 200, 15800)).toBeLessThan(2e-3);
  });

  it('al bajar, lo que no cabe en la frecuencia menor desaparece en vez de plegarse', () => {
    const y = remuestrear(tono(10000, 44100, 44100), 44100, 16000);
    expect(rms(y, 200, 15800)).toBeLessThan(0.003);
  });

  it('un tramo da lo mismo que el audio entero, también desde un trozo del original', () => {
    const x = tono(440, 16000, 16000, 0.3);
    const r = remuestreador(16000, 44100);
    const entero = r.tramo(x, 0, r.largo(x.length));
    expect(errorMaximo(r.tramo(x, 10000, 500), entero.subarray(10000, 10500), 0, 500)).toBe(0);
    const bajar = remuestreador(44100, 16000);
    const abajo = bajar.tramo(entero, 0, bajar.largo(entero.length));
    // Con el trozo 20000–30000 del de 44,1 kHz basta para las muestras de en medio.
    const trozo = bajar.tramo(entero.subarray(20000, 30000), 8000, 1000, 20000);
    expect(errorMaximo(trozo, abajo.subarray(8000, 9000), 0, 1000)).toBeLessThan(1e-6);
  });
});
