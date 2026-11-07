import { describe, expect, it } from 'vitest';
import { leerCombinacion, mostrarCombinacion, teclaLatina, textoCombinacion } from './teclas';
import { fuentesRecomendadas } from './diccionariosRecomendados';

describe('teclaLatina', () => {
  it('una letra normal se queda igual, en minúscula', () => {
    expect(teclaLatina({ key: 'Q', code: 'KeyQ' })).toBe('q');
    expect(teclaLatina({ key: 'e', code: 'KeyE' })).toBe('e');
  });

  it('respeta la distribución: una Z alemana es una z, aunque esté donde la Y', () => {
    expect(teclaLatina({ key: 'z', code: 'KeyY' })).toBe('z');
  });

  it('con el teclado en coreano, en kana o en ruso usa la posición', () => {
    expect(teclaLatina({ key: 'ㅂ', code: 'KeyQ' })).toBe('q');
    expect(teclaLatina({ key: 'た', code: 'KeyQ' })).toBe('q');
    expect(teclaLatina({ key: 'й', code: 'KeyQ' })).toBe('q');
  });

  it('con un método de entrada activo, también', () => {
    expect(teclaLatina({ key: 'Process', code: 'KeyE' })).toBe('e');
    expect(teclaLatina({ key: 'Process', code: 'Digit3' })).toBe('3');
  });

  it('las teclas con nombre se quedan como están', () => {
    expect(teclaLatina({ key: 'ArrowLeft', code: 'ArrowLeft' })).toBe('ArrowLeft');
    expect(teclaLatina({ key: 'Escape', code: 'Escape' })).toBe('Escape');
  });

  it('un Alt en Mac que da un símbolo se lee por la posición', () => {
    expect(teclaLatina({ key: '≈', code: 'KeyX' })).toBe('x');
    expect(teclaLatina({ key: 'Dead', code: 'KeyE' })).toBe('e');
  });

  it('los signos también', () => {
    expect(teclaLatina({ key: 'ー', code: 'Minus' })).toBe('-');
  });
});

describe('combinaciones', () => {
  it('se escriben y se leen', () => {
    const c = { k: 'm', alt: true, shift: true, ctrl: false };
    expect(textoCombinacion(c)).toBe('alt+shift+m');
    expect(leerCombinacion('alt+shift+m')).toEqual(c);
  });

  it('las flechas conservan su nombre', () => {
    expect(leerCombinacion('alt+arrowleft').k).toBe('ArrowLeft');
    expect(textoCombinacion({ k: 'ArrowLeft', alt: true, shift: false, ctrl: false })).toBe('alt+arrowleft');
  });

  it('se muestran bien', () => {
    expect(mostrarCombinacion('alt+shift+m')).toBe('Alt + Shift + M');
    expect(mostrarCombinacion('arrowleft')).toBe('←');
    expect(mostrarCombinacion('q')).toBe('Q');
  });

  it('el signo más también es una tecla', () => {
    expect(leerCombinacion('alt++').k).toBe('+');
    expect(leerCombinacion('alt++').alt).toBe(true);
  });
});

describe('fuentesRecomendadas', () => {
  const F = [
    { id: 'jmdict-es', tipo: 'terminos', idioma: 'es', recomendado: true },
    { id: 'jmdict-en', tipo: 'terminos', idioma: 'en', recomendado: true },
    { id: 'jmdict-de', tipo: 'terminos', idioma: 'de', recomendado: false },
    { id: 'nombres', tipo: 'terminos', idioma: 'en', recomendado: false },
    { id: 'acento', tipo: 'acento', recomendado: true },
    { id: 'frecuencia', tipo: 'frecuencia', recomendado: true },
  ];
  const ids = (idioma: string) => fuentesRecomendadas(F, idioma).map((f) => f.id);

  it('el diccionario propio va primero, y el inglés de respaldo', () => {
    expect(ids('es')).toEqual(['jmdict-es', 'jmdict-en', 'acento', 'frecuencia']);
    expect(ids('de')).toEqual(['jmdict-de', 'jmdict-en', 'acento', 'frecuencia']);
  });

  it('quien habla inglés no instala nada de más', () => {
    expect(ids('en')).toEqual(['jmdict-en', 'nombres', 'acento', 'frecuencia']);
  });

  it('sin diccionario propio, queda el inglés', () => {
    expect(ids('ko')).toEqual(['jmdict-en', 'acento', 'frecuencia']);
  });
});
