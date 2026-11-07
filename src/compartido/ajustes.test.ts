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

describe('idioma de la interfaz', () => {
  it('una instalación nueva sigue al navegador', () => {
    expect(completarAjustes(undefined).idiomaInterfaz).toBe('auto');
  });

  it('quien ya usaba la extensión sigue en español, aunque su navegador esté en otro idioma', () => {
    expect(completarAjustes({ nivel: 'JLPT N2' }).idiomaInterfaz).toBe('es');
  });

  it('lo elegido se respeta', () => {
    expect(completarAjustes({ idiomaInterfaz: 'ko' }).idiomaInterfaz).toBe('ko');
    expect(completarAjustes({ idiomaInterfaz: 'auto' }).idiomaInterfaz).toBe('auto');
  });
});

describe('la ficha abre con el diccionario', () => {
  it('quien tenía los valores de antes deja de gastar al abrir una palabra', () => {
    const a = completarAjustes({ diccionarioPestana: 'explicar', sentidoAutomatico: true, usarGuion: true } as never);
    expect(a.diccionarioPestana).toBe('ninguna');
    expect(a.sentidoAutomatico).toBe(false);
    expect(a.usarGuion).toBe(false);
    expect(a.migracion).toBe(1);
  });

  it('otra pestaña elegida a propósito se respeta', () => {
    expect(completarAjustes({ diccionarioPestana: 'audio' } as never).diccionarioPestana).toBe('audio');
  });

  it('lo que se vuelva a activar después se respeta', () => {
    const a = completarAjustes({ migracion: 1, diccionarioPestana: 'explicar', sentidoAutomatico: true, usarGuion: true } as never);
    expect(a.diccionarioPestana).toBe('explicar');
    expect(a.sentidoAutomatico).toBe(true);
    expect(a.usarGuion).toBe(true);
  });

  it('una instalación nueva parte de solo el diccionario', () => {
    const a = completarAjustes(undefined);
    expect(a.diccionarioPestana).toBe('ninguna');
    expect(a.sentidoAutomatico).toBe(false);
    expect(a.creditoMensual).toBe(0);
  });
});
