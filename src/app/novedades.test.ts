import { describe, expect, it } from 'vitest';
import { hayNovedades, NOVEDADES } from './novedades';

describe('lo nuevo de cada versión', () => {
  it('sale tras actualizar a la versión de las novedades, una vez', () => {
    expect(hayNovedades(NOVEDADES.version, '')).toBe(true);
    expect(hayNovedades(NOVEDADES.version, '0.38.1')).toBe(true);
    expect(hayNovedades(NOVEDADES.version, NOVEDADES.version)).toBe(false);
  });

  it('si no se cambiaron para la versión instalada, no cuenta lo de otra', () => {
    expect(hayNovedades('99.0.0', '')).toBe(false);
  });

  it('cuenta algo, en pocas frases', () => {
    expect(NOVEDADES.puntos.length).toBeGreaterThanOrEqual(1);
    expect(NOVEDADES.puntos.length).toBeLessThanOrEqual(5);
  });
});
