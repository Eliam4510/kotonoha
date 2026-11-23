import { describe, expect, it } from 'vitest';
import { type CorrerDemucs, espectrograma, MUESTRAS_SEGMENTO, separarVoz, trozos, vozDelTrozo } from './demucs';

const N = MUESTRAS_SEGMENTO;
const CANAL = 2048 * 336;
/** Una señal de prueba con varios tonos que cambian: sin nada por encima de los 7 kHz. */
const senal = (frecuencia: number, n: number) =>
  Float32Array.from({ length: n }, (_, i) => {
    const t = i / frecuencia;
    return 0.3 * Math.sin(2 * Math.PI * (220 * t + 40 * t * t)) + 0.2 * Math.sin(2 * Math.PI * 1300 * t + 1) + 0.1 * Math.sin(2 * Math.PI * 5100 * t) * Math.sin(2 * Math.PI * 0.7 * t);
  });

describe('espectrograma', () => {
  it('cada banda de cada marco es la transformada del trozo con su ventana, como en htdemucs', () => {
    const x = senal(44100, N);
    const z = espectrograma(x);
    // El marco 5 que ve el modelo es el 7 de la STFT: empieza 7·1024 − 2048 muestras después del relleno de 1536.
    const reflejo = (i: number) => (i < 0 ? x[-i] : x[i]);
    for (const k of [0, 7, 300, 2047]) {
      let re = 0;
      let im = 0;
      for (let i = 0; i < 4096; i++) {
        const v = reflejo(7 * 1024 - 2048 - 1536 + i) * 0.5 * (1 - Math.cos((2 * Math.PI * i) / 4096));
        re += v * Math.cos((2 * Math.PI * k * i) / 4096);
        im -= v * Math.sin((2 * Math.PI * k * i) / 4096);
      }
      expect(z[k * 336 + 5]).toBeCloseTo(re / 64, 3);
      expect(z[CANAL + k * 336 + 5]).toBeCloseTo(im / 64, 3);
      // El otro canal es el mismo: el audio es mono.
      expect(z[2 * CANAL + k * 336 + 5]).toBe(z[k * 336 + 5]);
    }
  });
});

describe('vozDelTrozo', () => {
  it('la vuelta al tiempo deshace el espectrograma, lejos de los bordes', () => {
    const x = senal(44100, N);
    const z = espectrograma(x);
    const frecuencia = new Float32Array(4 * 4 * CANAL);
    frecuencia.set(z, 3 * 4 * CANAL);
    const voz = vozDelTrozo({ tiempo: new Float32Array(4 * 2 * N), frecuencia });
    let error = 0;
    for (let i = 8192; i < N - 8192; i++) error = Math.max(error, Math.abs(voz[i] - x[i]));
    expect(error).toBeLessThan(1e-4);
  });

  it('suma la rama del tiempo, con la media de sus dos canales', () => {
    const tiempo = new Float32Array(4 * 2 * N);
    tiempo[3 * 2 * N + 100] = 0.5;
    tiempo[3 * 2 * N + N + 100] = 0.3;
    // Lo de otra pista no es la voz.
    tiempo[2 * 2 * N + 100] = 9;
    const voz = vozDelTrozo({ tiempo, frecuencia: new Float32Array(4 * 4 * CANAL) });
    expect(voz[100]).toBeCloseTo(0.4, 6);
    expect(voz[101]).toBe(0);
  });
});

describe('separarVoz', () => {
  it('los trozos de 7,8 s se solapan una cuarta parte y llegan al final, como en Demucs', () => {
    expect(trozos(N - 1000)).toEqual([0, Math.floor(0.75 * N)]);
    expect(trozos(Math.floor(0.75 * N))).toEqual([0]);
    const t = trozos(3 * N);
    expect(t[1]).toBe(Math.floor(0.75 * N));
    expect(t.at(-1)! < 3 * N && t.at(-1)! + Math.floor(0.75 * N) >= 3 * N).toBe(true);
  });

  it('sin mover nada de sitio: si el modelo devolviera la mezcla como voz, saldría el mismo audio', async () => {
    const pcm = senal(16000, 16000 * 20);
    let llamadas = 0;
    const eco: CorrerDemucs = async (onda) => {
      llamadas++;
      const tiempo = new Float32Array(4 * 2 * N);
      tiempo.set(onda, 3 * 2 * N);
      return { tiempo, frecuencia: new Float32Array(4 * 4 * CANAL) };
    };
    const avances: number[] = [];
    const voz = await separarVoz(pcm, 16000, eco, (hechos) => avances.push(hechos));
    expect(voz.length).toBe(pcm.length);
    expect(llamadas).toBe(4);
    expect(avances).toEqual([1, 2, 3, 4]);
    let error = 0;
    for (let i = 400; i < pcm.length - 400; i++) error = Math.max(error, Math.abs(voz[i] - pcm[i]));
    expect(error).toBeLessThan(5e-3);
  });
});
