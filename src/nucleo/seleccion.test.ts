import { describe, expect, it } from 'vitest';
import { SIGNOS_FRASE as INGLES } from '../lenguas/ingles/escritura';
import { SIGNOS_FRASE as JAPONES } from '../lenguas/japones/escritura';
import type { LineaTexto } from './capaTexto';
import { cajasDe, contextoDe, fraseEn, leerPagina, parrafoEn, posicionEn, seleccionEn, tramoEntre, trozosDe } from './seleccion';

/** Un renglón en horizontal: letras de 0,04 de ancho y 0,03 de alto, como en las pruebas de los párrafos. */
const renglon = (texto: string, x0: number, y0: number, paso = 0.04, alto = 0.03): LineaTexto => ({
  texto,
  vertical: false,
  caja: { x0, x1: x0 + paso * [...texto].length, y0, y1: y0 + alto },
});
/** Una columna en vertical, que se lee de arriba abajo. */
const columna = (texto: string, x0: number, y0: number, paso = 0.04): LineaTexto => ({
  texto,
  vertical: true,
  caja: { x0, x1: x0 + 0.03, y0, y1: y0 + paso * [...texto].length },
});

// Dos párrafos de un libro (Sōseki, de dominio público). La tercera frase empieza al final del primer renglón y acaba en
// el segundo; el tercer renglón es corto y cierra el párrafo.
const libro = [
  renglon('吾輩は猫である。名前はまだ無い。どこで', 0.14, 0.1),
  renglon('生れたかとんと見当がつかぬ。何でも薄暗い', 0.1, 0.15),
  renglon('じめじめした所で泣いた。', 0.1, 0.2),
  renglon('吾輩はここで始めて人間というものを見た。', 0.1, 0.25),
  renglon('しかもあとで聞くと', 0.1, 0.3),
];

describe('el imán: qué letra hay bajo el ratón', () => {
  it('dentro de un renglón, la letra que se toca', () => {
    expect(posicionEn(libro, 0.2, 0.165)).toEqual({ linea: 1, letra: 2 });
  });

  it('en el hueco entre dos renglones, la del más cercano', () => {
    expect(posicionEn(libro, 0.2, 0.145)?.linea).toBe(1);
    expect(posicionEn(libro, 0.2, 0.135)?.linea).toBe(0);
  });

  it('justo pasado el final de un renglón, su última letra; un poco más allá, nada', () => {
    expect(posicionEn(libro, 0.93, 0.165)).toEqual({ linea: 1, letra: 19 });
    expect(posicionEn(libro, 0.97, 0.165)).toBeNull();
  });

  it('lejos de todo texto no es un toque para el texto; arrastrando, la línea más cercana', () => {
    expect(posicionEn(libro, 0.5, 0.7)).toBeNull();
    expect(posicionEn(libro, 0.5, 0.7, { siempre: true })?.linea).toBe(4);
  });

  it('en vertical, la columna más cercana y la letra según la altura', () => {
    const columnas = [columna('吾輩は猫である', 0.8, 0.1), columna('名前はまだ無い', 0.75, 0.1)];
    // Entre las dos columnas, más cerca de la segunda, a la altura de su tercera letra.
    expect(posicionEn(columnas, 0.782, 0.21)).toEqual({ linea: 1, letra: 2 });
    expect(posicionEn(columnas, 0.4, 0.21)).toBeNull();
  });

  it('una letra fuera del plano básico se toca entera', () => {
    const l = [renglon('𠮟る', 0.1, 0.1)];
    // Las dos unidades del primer kanji empiezan en el mismo sitio.
    l[0].cortes = [0.1, 0.1, 0.14, 0.18];
    expect(posicionEn(l, 0.12, 0.115)).toEqual({ linea: 0, letra: 0 });
  });
});

describe('lo seleccionado arrastrando', () => {
  it('va en el orden de lectura aunque se arrastre hacia atrás, con las dos letras dentro', () => {
    const t = tramoEntre(libro, { linea: 1, letra: 3 }, { linea: 0, letra: 16 });
    expect(t).toEqual({ desde: { linea: 0, letra: 16 }, hasta: { linea: 1, letra: 4 } });
    expect(trozosDe(libro, t)).toEqual([
      { linea: 0, inicio: 16, fin: 19 },
      { linea: 1, inicio: 0, fin: 4 },
    ]);
  });

  it('ocupa una caja por renglón: parcial en los extremos y entera en medio', () => {
    const t = tramoEntre(libro, { linea: 0, letra: 16 }, { linea: 2, letra: 1 });
    const cajas = cajasDe(libro, t, true);
    expect(cajas).toHaveLength(3);
    expect(cajas[0].x0).toBeCloseTo(0.14 + 16 * 0.04);
    expect(cajas[1]).toEqual(libro[1].caja);
    expect(cajas[2].x1).toBeCloseTo(0.1 + 2 * 0.04);
    // Sin la posición de cada letra, como en un globo de manga, cada renglón entero.
    expect(cajasDe(libro, t, false)[0]).toEqual(libro[0].caja);
  });

  it('su texto une los renglones sin espacio en japonés, y con un salto entre dos párrafos', () => {
    const p = leerPagina(libro);
    expect(seleccionEn(p, tramoEntre(libro, { linea: 0, letra: 16 }, { linea: 1, letra: 13 })).texto).toBe('どこで生れたかとんと見当がつかぬ。');
    expect(seleccionEn(p, tramoEntre(libro, { linea: 2, letra: 4 }, { linea: 3, letra: 2 })).texto).toBe('した所で泣いた。\n吾輩は');
  });
});

describe('la frase y el párrafo de una letra', () => {
  const p = leerPagina(libro);

  it('la frase sigue en el renglón siguiente y lleva su sitio en la página', () => {
    const f = fraseEn(p, { linea: 1, letra: 2 }, JAPONES);
    expect(f?.texto).toBe('どこで生れたかとんと見当がつかぬ。');
    expect(f?.tramo).toEqual({ desde: { linea: 0, letra: 16 }, hasta: { linea: 1, letra: 14 } });
    // Tocar el punto que la cierra es tocar esa frase, no la siguiente.
    expect(fraseEn(p, { linea: 1, letra: 13 }, JAPONES)?.texto).toBe('どこで生れたかとんと見当がつかぬ。');
  });

  it('una frase no se sale de su párrafo aunque no acabe en punto', () => {
    expect(fraseEn(p, { linea: 4, letra: 1 }, JAPONES)?.texto).toBe('しかもあとで聞くと');
    expect(fraseEn(p, { linea: 3, letra: 0 }, JAPONES)?.texto).toBe('吾輩はここで始めて人間というものを見た。');
  });

  it('el párrafo entero, con todos sus renglones', () => {
    const u = parrafoEn(p, { linea: 1, letra: 5 });
    expect(u?.texto).toBe('吾輩は猫である。名前はまだ無い。どこで生れたかとんと見当がつかぬ。何でも薄暗いじめじめした所で泣いた。');
    expect(u?.tramo.desde).toEqual({ linea: 0, letra: 0 });
    expect(u?.tramo.hasta).toEqual({ linea: 2, letra: 12 });
  });

  it('para Claude, la frase entera y las de alrededor, sin pasar de la página', () => {
    const u = fraseEn(p, { linea: 1, letra: 2 }, JAPONES)!;
    const c = contextoDe(p, u, JAPONES);
    expect(c.frase).toBe('どこで生れたかとんと見当がつかぬ。');
    expect(c.antes).toEqual(['吾輩は猫である。', '名前はまだ無い。']);
    expect(c.despues).toEqual(['何でも薄暗いじめじめした所で泣いた。', '吾輩はここで始めて人間というものを見た。', 'しかもあとで聞くと']);
  });

  it('de un trozo de frase seleccionado, Claude recibe la frase que lo contiene', () => {
    const s = seleccionEn(p, tramoEntre(libro, { linea: 1, letra: 0 }, { linea: 1, letra: 5 }));
    expect(s.texto).toBe('生れたかとん');
    expect(contextoDe(p, s, JAPONES).frase).toBe('どこで生れたかとんと見当がつかぬ。');
  });
});

describe('en una lengua que separa las palabras', () => {
  const lineas = [renglon('The quick brown fox jum-', 0.1, 0.1, 0.0333), renglon('ped over the lazy dog. It', 0.1, 0.15, 0.032), renglon('was late.', 0.1, 0.2, 0.03)];
  const p = leerPagina(lineas);

  it('une los renglones con un espacio y sin el guion que partía la palabra', () => {
    expect(p.corrido.texto).toBe('The quick brown fox jumped over the lazy dog. It was late.');
  });

  it('la frase de una letra del segundo renglón empieza en el primero', () => {
    const f = fraseEn(p, { linea: 1, letra: 1 }, INGLES);
    expect(f?.texto).toBe('The quick brown fox jumped over the lazy dog.');
    expect(f?.tramo).toEqual({ desde: { linea: 0, letra: 0 }, hasta: { linea: 1, letra: 22 } });
    expect(contextoDe(p, f!, INGLES).despues).toEqual(['It was late.']);
  });
});
