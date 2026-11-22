import { describe, expect, it } from 'vitest';
import { elegirPrincipal } from './videoPrincipal';

const c = (x: string, area: number, enMarcha = false) => ({ x, area, enMarcha });

describe('elegirPrincipal', () => {
  it('sin ninguno visible, ninguno', () => {
    expect(elegirPrincipal([], null)).toBeNull();
    expect(elegirPrincipal([c('a', 0)], null)).toBeNull();
  });

  it('el mayor, y entre iguales el primero, como antes', () => {
    expect(elegirPrincipal([c('a', 100), c('b', 400)], null)).toBe('b');
    expect(elegirPrincipal([c('a', 400), c('b', 400)], null)).toBe('a');
  });

  it('el que está en marcha antes que uno del mismo tamaño en pausa, como el de un anuncio que acabó', () => {
    expect(elegirPrincipal([c('anuncio', 400), c('episodio', 400, true)], null)).toBe('episodio');
    expect(elegirPrincipal([c('anuncio', 400), c('episodio', 400, true)], 'anuncio')).toBe('episodio');
  });

  it('una miniatura que se reproduce sola no le quita el sitio al video', () => {
    expect(elegirPrincipal([c('video', 400), c('miniatura', 100, true)], null)).toBe('video');
  });

  it('en pausa sigue el de antes, aunque otro del mismo tamaño vaya antes en la página', () => {
    expect(elegirPrincipal([c('anuncio', 400), c('episodio', 400)], 'episodio')).toBe('episodio');
    // El de antes que ya no es de los grandes no cuenta.
    expect(elegirPrincipal([c('grande', 400), c('chico', 100)], 'chico')).toBe('grande');
  });
});
