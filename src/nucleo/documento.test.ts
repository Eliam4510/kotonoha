import { describe, expect, it } from 'vitest';
import { aDocumento, aMarkdown } from './documento';
import { leerEstructura } from './estructura';

/** Lo que el lector ve de un Markdown: si dos se leen igual, el editor no perdió nada. */
const seLeeIgual = (a: string, b: string) => expect(leerEstructura(b)).toEqual(leerEstructura(a));
const idaYVuelta = (md: string) => aMarkdown(aDocumento(md));

describe('el Cuaderno, del Markdown al editor y de vuelta', () => {
  it('conserva títulos, párrafos con sus saltos de línea y negritas', () => {
    const md = '# Título\n\n## Subtítulo\n\nUna línea con **negrita**.\nY otra en su renglón.\n\nOtro párrafo.';
    expect(idaYVuelta(md)).toBe(md);
  });

  it('conserva las listas, con sus subpuntos y su numeración', () => {
    const md = '- uno\n- dos\n  - dos y medio\n    - más adentro\n- tres\n\n3. tercero\n4. cuarto';
    expect(idaYVuelta(md)).toBe(md);
  });

  it('conserva citas, código, separadores, tablas y la marca de un dictado', () => {
    const md = '> una cita\n> de dos líneas\n\n```\ncódigo **tal cual**\n```\n\n---\n\n| a | b |\n| --- | --- |\n| **c** | d |\n\n<!-- dictado:abc123 -->\n\nLo dictado.';
    seLeeIgual(md, idaYVuelta(md));
  });

  it('lee igual un texto de antes, con viñetas de otros signos y números de ancho completo', () => {
    const md = 'Lista:\n\n• uno\n• dos\n\n１．primero\n２．segundo';
    seLeeIgual(md, idaYVuelta(md));
  });

  it('escapa lo escrito que se leería como marca', () => {
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '# no es un título' }, { type: 'hard_break' }, { type: 'text', text: '- ni una viñeta, ni **esto**' }] }] };
    const md = aMarkdown(doc);
    const [bloque] = leerEstructura(md);
    expect(bloque).toEqual({ tipo: 'parrafo', lineas: [{ texto: '# no es un título', negritas: [] }, { texto: '- ni una viñeta, ni **esto**', negritas: [] }] });
  });

  it('un documento vacío es un párrafo vacío, y sin nada escrito no deja Markdown', () => {
    expect(aDocumento('')).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
    expect(aMarkdown({ type: 'doc', content: [{ type: 'paragraph' }, { type: 'heading', attrs: { level: 1 } }] })).toBe('');
  });

  it('pasa las negritas al documento como marcas', () => {
    expect(aDocumento('a **b** c').content![0]).toEqual({
      type: 'paragraph',
      content: [{ type: 'text', text: 'a ' }, { type: 'text', text: 'b', marks: [{ type: 'strong' }] }, { type: 'text', text: ' c' }],
    });
  });
});
