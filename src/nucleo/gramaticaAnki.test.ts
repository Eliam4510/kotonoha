import { describe, expect, it } from 'vitest';
import { type FormasAnki, normalizarPatron, puntosEnNotas } from './gramaticaAnki';

/** Como las del japonés: べき y べきだ, y alternativas con punto medio. */
const JA: FormasAnki = { colas: ['', 'だ', 'です', 'な', 'に', 'の'], separadores: '・' };

describe('los puntos de gramática de unas tarjetas de Anki', () => {
  it('compara sin tildes, HTML ni espacios', () => {
    expect(normalizarPatron('<b>〜べき</b> ')).toBe('べき');
    expect(normalizarPatron('Used To')).toBe('usedto');
  });

  it('reconoce el patrón escrito de varias maneras, y sus alternativas', () => {
    const patrones = ['〜べき', '〜はず', '〜に過ぎない', '〜たい'];
    expect([...puntosEnNotas(patrones, ['べきだ', '<div>〜はず</div>', '〜にすぎない / 〜に過ぎない'], JA)].sort()).toEqual(['〜に過ぎない', '〜はず', '〜べき'].sort());
  });

  it('un patrón dentro de una frase no cuenta', () => {
    expect(puntosEnNotas(['〜たい'], ['食べたいです'], JA)).toEqual(new Set());
    expect(puntosEnNotas(['〜たい'], ['〜たい'], JA)).toEqual(new Set(['〜たい']));
    expect(puntosEnNotas(['〜うちに'], ['〜ないうちに・〜うちに<br>例文'], JA)).toEqual(new Set(['〜うちに']));
    expect(puntosEnNotas(['used to'], ['be used to'])).toEqual(new Set());
  });

  it('entiende las variantes con barra del patrón', () => {
    expect(puntosEnNotas(['there is / there are', 'used to'], ['There are', 'Used to'])).toEqual(new Set(['there is / there are', 'used to']));
  });

  it('lo que va entre paréntesis puede estar o no', () => {
    // En la lista, una aclaración: 〜そうだ（伝聞） es «そうだ» en la tarjeta.
    expect(puntosEnNotas(['〜そうだ（伝聞）'], ['〜そうだ'], JA)).toEqual(new Set(['〜そうだ（伝聞）']));
    // En la tarjeta, algo opcional: 〜際（に） vale por 〜際に y por 〜際.
    expect(puntosEnNotas(['〜際に'], ['〜際（に）'], JA)).toEqual(new Set(['〜際に']));
  });
});
