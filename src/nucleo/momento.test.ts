import { describe, expect, it } from 'vitest';
import { claveDeVideo, momentoLegible, urlEnMomento } from './momento';

describe('momentoLegible', () => {
  it('escribe minutos y segundos, y las horas si hacen falta', () => {
    expect(momentoLegible(7000)).toBe('0:07');
    expect(momentoLegible(754_900)).toBe('12:34');
    expect(momentoLegible(3_723_000)).toBe('1:02:03');
    expect(momentoLegible(-5)).toBe('0:00');
  });
});

describe('claveDeVideo', () => {
  it('reconoce el mismo video de YouTube aunque cambie la dirección', () => {
    const clave = 'yt:dQw4w9WgXcQ';
    expect(claveDeVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(clave);
    expect(claveDeVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL1&t=42s')).toBe(clave);
    expect(claveDeVideo('https://m.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(clave);
    expect(claveDeVideo('https://youtu.be/dQw4w9WgXcQ?t=10')).toBe(clave);
    expect(claveDeVideo('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe(clave);
  });

  it('un episodio de Netflix es su número, con o sin idioma en la dirección', () => {
    expect(claveDeVideo('https://www.netflix.com/watch/81234567?trackId=1')).toBe('nf:81234567');
    expect(claveDeVideo('https://www.netflix.com/es/watch/81234567')).toBe('nf:81234567');
  });

  it('en otros sitios, la dirección sin el ancla; lo que no es una página web no cuenta', () => {
    expect(claveDeVideo('https://www.crunchyroll.com/watch/GX1/ep?x=1#t')).toBe('url:https://www.crunchyroll.com/watch/GX1/ep?x=1');
    expect(claveDeVideo('chrome-extension://abc/app.html')).toBeNull();
    expect(claveDeVideo('no es una dirección')).toBeNull();
  });
});

describe('urlEnMomento', () => {
  it('en YouTube pone el minuto en la dirección, quitando el que hubiera', () => {
    expect(urlEnMomento('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5s', 754_900)).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=754s');
    expect(urlEnMomento('https://youtu.be/dQw4w9WgXcQ', 61_000)).toBe('https://youtu.be/dQw4w9WgXcQ?t=61s');
  });

  it('en los demás sitios la deja igual: el salto lo hace la extensión al cargar', () => {
    expect(urlEnMomento('https://www.netflix.com/watch/81234567', 60_000)).toBe('https://www.netflix.com/watch/81234567');
  });
});
