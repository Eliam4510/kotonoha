import { describe, expect, it } from 'vitest';
import { versosCantados } from './estructuraLetra';
import type { Linea } from './subtitulos';

// Versos inventados para estas pruebas, con kanji distintos para que casen sin dudas.
const A = '春の海を渡る風';
const B = '夏の空に咲く花火';
const C = '秋の森で眠る鳥';
const D = '冬の街に灯る窓';
const E = '朝焼けの駅で待つ';
const F = '夕暮れの橋を越えて';

/** Lo que oyó Whisper: cada texto en su línea de tres segundos, una detrás de otra. */
const oido = (...textos: string[]): Linea[] => textos.map((texto, k) => ({ id: k + 1, inicio: k * 3000, fin: k * 3000 + 2500, texto }));

describe('versosCantados', () => {
  it('un estribillo escrito una vez se repite donde lo oyó Whisper', () => {
    const r = versosCantados([A, B, C, D], oido(A, B, C, D, C, D, C, D));
    expect(r.versos).toEqual([A, B, C, D, C, D, C, D]);
    expect(r.repeticiones).toBe(2);
  });

  it('una letra completa queda como está', () => {
    const completa = [A, B, C, D, C, D, E, C, D];
    expect(versosCantados(completa, oido(...completa)).versos).toEqual(completa);
  });

  it('un verso que Whisper no oyó entra en su sitio', () => {
    expect(versosCantados([A, B, C, D], oido(A, B, D)).versos).toEqual([A, B, C, D]);
  });

  it('al pasar a otra parte de la canción no vuelve a meter lo que ya sonó', () => {
    // Se canta A B C D, el estribillo C D otra vez, y luego E F: entre D y E no se repiten A ni B.
    const r = versosCantados([A, B, C, D, E, F], oido(A, B, C, D, C, D, E, F));
    expect(r.versos).toEqual([A, B, C, D, C, D, E, F]);
  });

  it('el mismo verso dos veces seguidas', () => {
    expect(versosCantados([A, B, C], oido(A, A, B, C)).versos).toEqual([A, A, B, C]);
  });

  it('sin nada oído, o con un solo verso, no hay nada que deducir', () => {
    expect(versosCantados([A, B], []).versos).toEqual([A, B]);
    expect(versosCantados([A], oido(A, A)).versos).toEqual([A]);
  });

  it('cada verso de la letra sale al menos una vez, aunque nadie lo oyera', () => {
    const r = versosCantados([A, B, C, D], oido(C, D, C, D));
    expect(r.versos.slice(0, 2)).toEqual([A, B]);
    expect(r.versos.filter((v) => v === C)).toHaveLength(2);
  });
});
