import { describe, expect, it } from 'vitest';
import { esMasNueva, novedadesDeTitulo, numerosDeVersion, versionLimpia } from './versiones';

describe('versiones', () => {
  it('lee las versiones con o sin la «v» de la etiqueta', () => {
    expect(numerosDeVersion('v0.13.1')).toEqual([0, 13, 1]);
    expect(numerosDeVersion(' 1.2.3 ')).toEqual([1, 2, 3]);
    expect(numerosDeVersion('0.13')).toBeNull();
    expect(numerosDeVersion('v0.14.0-beta')).toBeNull();
    expect(versionLimpia('v0.13.1')).toBe('0.13.1');
  });

  it('compara número a número, no como texto', () => {
    expect(esMasNueva('v0.13.1', '0.13.0')).toBe(true);
    expect(esMasNueva('0.14.0', '0.13.9')).toBe(true);
    expect(esMasNueva('0.10.0', '0.9.6')).toBe(true);
    expect(esMasNueva('1.0.0', '0.99.99')).toBe(true);
  });

  it('una versión igual o anterior no es nueva, ni lo que no es una versión', () => {
    expect(esMasNueva('0.13.0', '0.13.0')).toBe(false);
    expect(esMasNueva('0.12.0', '0.13.0')).toBe(false);
    expect(esMasNueva('nightly', '0.13.0')).toBe(false);
    expect(esMasNueva('0.14.0', 'dev')).toBe(false);
  });

  it('las novedades salen del título, sin el nombre del producto', () => {
    expect(novedadesDeTitulo('Kotonoha 0.13.0 · Dictar al Portapapeles')).toBe('Dictar al Portapapeles');
    expect(novedadesDeTitulo('Kotonoha 0.12.0 · Buscar en el libro · vista de texto')).toBe('Buscar en el libro · vista de texto');
    expect(novedadesDeTitulo('v0.13.1')).toBe('');
  });
});
