import { describe, expect, it } from 'vitest';
import { ANVERSO, ANVERSO_PLANTILLA_1, CSS_PLANTILLA_1, CSS_TARJETA, MARCA_PLANTILLA, mismoCss, REVERSO_PLANTILLA_1, reverso } from './plantillaAnki';

/** Cada sección {{#Campo}} o {{^Campo}} se cierra con su {{/Campo}}, en orden: si no, Anki no acepta la plantilla. */
function secciones(plantilla: string): string[] {
  const abiertas: string[] = [];
  for (const m of plantilla.matchAll(/\{\{([#^/])([^}]+)\}\}/g)) {
    if (m[1] === '/') {
      expect(abiertas.pop(), `cierra ${m[2]}`).toBe(m[2]);
    } else abiertas.push(m[2]);
  }
  return abiertas;
}

const CAMPOS = ['Palabra', 'Lectura', 'Frase', 'FraseFurigana', 'Traduccion', 'Definicion', 'AudioFrase', 'AudioPalabra', 'Imagen', 'Ejemplos', 'Notas', 'Fuente', 'Tags'];

describe('la plantilla de Anki', () => {
  it('cierra todas sus secciones y solo usa los campos del tipo de nota', () => {
    for (const p of [ANVERSO, reverso()]) {
      expect(secciones(p)).toEqual([]);
      for (const m of p.matchAll(/\{\{(?:[#^/]|furigana:)?([^}]+)\}\}/g)) expect(CAMPOS).toContain(m[1]);
    }
  });

  it('el ancla de la respuesta va arriba del reverso, y la frase se lee con su furigana', () => {
    const r = reverso();
    expect(r.indexOf('id="answer"')).toBeLessThan(r.indexOf('{{Imagen}}'));
    expect(r).toContain('{{furigana:FraseFurigana}}');
  });

  it('el CSS lleva su versión y el modo noche de Anki, de escritorio y de móvil', () => {
    expect(CSS_TARJETA).toContain(MARCA_PLANTILLA);
    expect(CSS_TARJETA).toContain('.nightMode');
    expect(CSS_TARJETA).toContain('.night_mode');
    expect(CSS_PLANTILLA_1).not.toContain(MARCA_PLANTILLA);
  });

  it('reconoce la plantilla de antes aunque Anki la guarde con otros saltos de línea', () => {
    expect(mismoCss(CSS_PLANTILLA_1.replace(/\n/g, '\r\n  '), CSS_PLANTILLA_1)).toBe(true);
    expect(mismoCss(`${CSS_PLANTILLA_1}\n.card { color: red; }`, CSS_PLANTILLA_1)).toBe(false);
    expect(mismoCss(ANVERSO_PLANTILLA_1, ANVERSO)).toBe(false);
    expect(REVERSO_PLANTILLA_1).toContain('<hr id="answer">');
  });
});
