import { describe, expect, it } from 'vitest';
import { AJUSTES_INICIALES, type Ajustes, completarAjustes } from './ajustes';

describe('ajustes guardados', () => {
  it('sin datos usa los valores iniciales', () => {
    expect(completarAjustes(undefined)).toEqual(AJUSTES_INICIALES);
  });

  it('un modelo de transcripción que ya no existe pasa al de siempre', () => {
    const viejos = { whisperModelo: 'kotoba' } as unknown as Partial<Ajustes>;
    expect(completarAjustes(viejos).whisperModelo).toBe(AJUSTES_INICIALES.whisperModelo);
  });

  it('conserva un modelo válido', () => {
    expect(completarAjustes({ whisperModelo: 'turbo-ligero' }).whisperModelo).toBe('turbo-ligero');
  });

  it('completa las opciones nuevas sin perder las guardadas', () => {
    const a = completarAjustes({ nivel: 'JLPT N2' });
    expect(a.nivel).toBe('JLPT N2');
    expect(a.corregirAutomaticos).toBe(true);
    expect(a.nombre).toBe('');
  });
});
