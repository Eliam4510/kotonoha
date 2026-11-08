import { describe, expect, it } from 'vitest';
import { esInterna, estiloEnLinea, prepararCss, propiedadesEpub, type RecursosCss } from './cssLibro';

const recursos = (archivos: Record<string, string>): RecursosCss & { pedidos: string[] } => {
  const pedidos: string[] = [];
  return {
    pedidos,
    url: async (ruta) => {
      pedidos.push(ruta);
      return ruta in archivos ? `blob:libro/${ruta}` : null;
    },
    texto: async (ruta) => archivos[ruta] ?? null,
  };
};

describe('el CSS de un EPUB de texto', () => {
  it('traduce las propiedades -epub- de los libros japoneses', () => {
    expect(propiedadesEpub('.vrtl { -epub-writing-mode: vertical-rl; }')).toBe('.vrtl { writing-mode: vertical-rl; }');
    expect(propiedadesEpub('.tcy { -epub-text-combine: horizontal; }')).toBe('.tcy { text-combine-upright: all; }');
    expect(propiedadesEpub('.b { -epub-text-emphasis-style: filled sesame; -epub-text-orientation: sideways-right }')).toBe('.b { text-emphasis-style: filled sesame; text-orientation: sideways }');
  });

  it('sabe qué direcciones son del libro', () => {
    expect(esInterna('../image/a.png')).toBe(true);
    expect(esInterna('https://example.com/a.png')).toBe(false);
    expect(esInterna('//example.com/a.png')).toBe(false);
    expect(esInterna('data:image/png;base64,AAAA')).toBe(false);
    expect(esInterna('#filtro')).toBe(false);
  });

  it('las imágenes y las fuentes del libro, desde el libro; lo de fuera, anulado', async () => {
    const r = recursos({ 'item/image/fondo.png': '', 'item/font/mincho.woff': '' });
    const css = await prepararCss(
      `body { background: url("../image/fondo.png") } @font-face { font-family: m; src: url(../font/mincho.woff) } .x { background: url(https://example.com/rastreo.gif) } .y { filter: url(#f) } .z { background: url('../image/no-esta.png') }`,
      'item/style/libro.css',
      r
    );
    expect(css).toContain('url("blob:libro/item/image/fondo.png")');
    expect(css).toContain('url("blob:libro/item/font/mincho.woff")');
    expect(css).not.toContain('example.com');
    expect(css).toContain('url(#f)');
    expect(css).toContain('.z { background: none }');
    expect(r.pedidos).not.toContain('https://example.com/rastreo.gif');
  });

  it('pega los @import del libro y quita los de fuera, sin perder los @namespace', async () => {
    const r = recursos({ 'item/style/base.css': 'p { -epub-line-break: strict; }' });
    const css = await prepararCss(`@namespace epub "http://www.idpf.org/2007/ops";\n@import url("base.css");\n@import "https://example.com/x.css";\nh1 { color: red }`, 'item/style/libro.css', r);
    expect(css.startsWith('@namespace epub')).toBe(true);
    expect(css).toContain('p { line-break: strict; }');
    expect(css).not.toContain('@import');
    expect(css).toContain('h1 { color: red }');
  });

  it('un atributo style no carga nada', () => {
    expect(estiloEnLinea('-epub-writing-mode: vertical-rl; background: url(../a.png)')).toBe('writing-mode: vertical-rl; background: none');
  });
});
