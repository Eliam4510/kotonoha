import { describe, expect, it } from 'vitest';
import { librosDeImagenes } from './carpetas';

/** Rutas como las que llegan al elegir o soltar una carpeta; el «archivo» es la propia ruta, para ver qué va dónde. */
const rutas = (...l: string[]) => l.map((ruta) => ({ ruta, archivo: ruta }));
const paginas = (carpeta: string, n: number, nombre = (i: number) => `${String(i).padStart(3, '0')}.jpg`) => Array.from({ length: n }, (_, i) => `${carpeta}/${nombre(i + 1)}`);
const resumen = (l: ReturnType<typeof librosDeImagenes<string>>) => l.map((x) => `${x.titulo} (${x.paginas.length})`);

describe('las carpetas de imágenes como libros', () => {
  it('una carpeta con imágenes es un libro, con la portada delante aunque se llame cover.jpg', () => {
    const [libro, ...otros] = librosDeImagenes(rutas(...paginas('14巻', 3, (i) => `${String(i).padStart(5, '0')}.jpg`), '14巻/cover.jpg'), '');
    expect(otros).toEqual([]);
    expect(libro.titulo).toBe('14巻');
    expect(libro.paginas.map((p) => p.nombre)).toEqual(['cover.jpg', '00001.jpg', '00002.jpg', '00003.jpg']);
    expect(libro.paginas[0].archivo).toBe('14巻/cover.jpg');
  });

  it('una serie con un tomo por carpeta da un libro por tomo, con la serie delante si el tomo solo dice su número', () => {
    const l = librosDeImagenes(rutas(...paginas('MiSerie/14巻', 200), ...paginas('MiSerie/15巻', 210)), '');
    expect(resumen(l)).toEqual(['MiSerie 14巻 (200)', 'MiSerie 15巻 (210)']);
  });

  it('cada tomo sabe de qué carpeta es, para juntarlos en su colección; un libro suelto, no', () => {
    const tomos = librosDeImagenes(rutas(...paginas('Mangas/MiSerie/14巻', 200), ...paginas('Mangas/MiSerie/15巻', 210)), '');
    expect(tomos.map((t) => t.carpeta)).toEqual(['Mangas/MiSerie', 'Mangas/MiSerie']);
    expect(librosDeImagenes(rutas(...paginas('14巻', 3)), '')[0].carpeta).toBeUndefined();
    // Un tomo nuevo, solo en la carpeta de su serie: también es de ella.
    expect(librosDeImagenes(rutas(...paginas('MiSerie/16巻', 3)), '')[0].carpeta).toBe('MiSerie');
  });

  it('los tomos de una serie son de la serie, aunque vengan en subcarpetas; cada serie de una biblioteca, de la suya', () => {
    const serie = librosDeImagenes(rutas(...paginas('Ejemplo vol 01-03/Ejemplo v01', 200), ...paginas('Ejemplo vol 01-03/Ejemplo v02-03/第02巻', 190), ...paginas('Ejemplo vol 01-03/Ejemplo v02-03/第03巻', 180)), '');
    expect(serie.map((t) => t.carpeta)).toEqual(['Ejemplo vol 01-03', 'Ejemplo vol 01-03', 'Ejemplo vol 01-03']);
    const biblioteca = librosDeImagenes(rutas(...paginas('Mangas/Una/第01巻', 150), ...paginas('Mangas/Una/第02巻', 150), ...paginas('Mangas/Otra/第01巻', 150), ...paginas('Mangas/Otra/第02巻', 150)), '');
    expect(biblioteca.map((t) => t.carpeta)).toEqual(['Mangas/Otra', 'Mangas/Otra', 'Mangas/Una', 'Mangas/Una']);
  });

  it('salta las carpetas que solo envuelven a otras y se queda con el nombre más concreto', () => {
    const l = librosDeImagenes(
      rutas(
        ...paginas('Ejemplo vol 01-05/Ejemplo v01', 205, (i) => `Ejemplo_01_${String(i).padStart(3, '0')}.jpg`),
        ...paginas('Ejemplo vol 01-05/Ejemplo v02-03/[作者名] サンプル 第02巻', 192),
        ...paginas('Ejemplo vol 01-05/Ejemplo v02-03/[作者名] サンプル 第03巻', 171),
        ...paginas('Ejemplo vol 01-05/Ejemplo v04/サンプル（4）', 162)
      ),
      ''
    );
    expect(resumen(l)).toEqual(['Ejemplo v01 (205)', '[作者名] サンプル 第02巻 (192)', '[作者名] サンプル 第03巻 (171)', 'サンプル（4） (162)']);
  });

  it('reconoce los tomos por cómo se llaman, también con guiones bajos y paréntesis', () => {
    const l = librosDeImagenes(rutas(...paginas('Serie/Mi_Serie_v07s', 20), ...paginas('Serie/Mi Serie v08', 20), ...paginas('Serie/Vol. 3', 20)), '');
    expect(resumen(l)).toEqual(['Mi_Serie_v07s (20)', 'Mi Serie v08 (20)', 'Serie Vol. 3 (20)']);
  });

  it('sin pistas en los nombres, carpetas de unas doscientas imágenes son tomos', () => {
    const l = librosDeImagenes(rutas(...paginas('Serie/サンプル 1 - 作者名', 182), ...paginas('Serie/サンプル 2 - 作者名', 182)), '');
    expect(resumen(l)).toEqual(['サンプル 1 - 作者名 (182)', 'サンプル 2 - 作者名 (182)']);
  });

  it('las carpetas de capítulos son un solo libro, en orden, y cada capítulo una entrada de su índice', () => {
    const l = librosDeImagenes(rutas(...paginas('Tomo 1/第10話', 2), ...paginas('Tomo 1/第2話', 2), ...paginas('Tomo 1/第1話', 2)), '');
    expect(resumen(l)).toEqual(['Tomo 1 (6)']);
    expect(l[0].paginas.map((p) => p.nombre)).toEqual(['第1話/001.jpg', '第1話/002.jpg', '第2話/001.jpg', '第2話/002.jpg', '第10話/001.jpg', '第10話/002.jpg']);
  });

  it('sin pistas en los nombres, carpetas pequeñas son capítulos de un libro', () => {
    expect(resumen(librosDeImagenes(rutas(...paginas('Manga/a', 30), ...paginas('Manga/b', 25)), ''))).toEqual(['Manga (55)']);
  });

  it('una carpeta con páginas sueltas y subcarpetas es un libro: las subcarpetas son sus capítulos', () => {
    const l = librosDeImagenes(rutas('Tomo/cover.jpg', 'Tomo/001.jpg', 'Tomo/002.jpg', ...paginas('Tomo/Vol 1 extra', 100)), '');
    expect(resumen(l)).toEqual(['Tomo (103)']);
  });

  it('la serie va delante de todo nombre que empiece por el número del tomo, y fuera el dominio de la web de descarga', () => {
    const l = librosDeImagenes(rutas(...paginas('サンプル/第01巻', 150), ...paginas('サンプル/第01巻 (otra edición)', 150), ...paginas('サンプル/（2）', 150), ...paginas('Descargas.APP-月の物語/Descargas.APP-月の物語 1', 150)), '');
    expect(resumen(l)).toEqual(['月の物語 1 (150)', 'サンプル （2） (150)', 'サンプル 第01巻 (150)', 'サンプル 第01巻 (otra edición) (150)']);
  });

  it('la portada de una serie junto a sus tomos no se vuelve un libro', () => {
    const l = librosDeImagenes(rutas('Serie/folder.jpg', ...paginas('Serie/第01巻', 150), ...paginas('Serie/第02巻', 150)), '');
    expect(resumen(l)).toEqual(['Serie 第01巻 (150)', 'Serie 第02巻 (150)']);
  });

  it('deja fuera lo oculto, lo de macOS y lo que no es imagen, pero guarda el ComicInfo de la carpeta', () => {
    const [libro] = librosDeImagenes(rutas('Tomo/001.jpg', 'Tomo/.oculta.jpg', 'Tomo/__MACOSX/._001.jpg', 'Tomo/mimetype', 'Tomo/notas.txt', 'Tomo/ComicInfo.xml', 'Tomo/002.png'), '');
    expect(libro.paginas.map((p) => p.nombre)).toEqual(['001.jpg', '002.png']);
    expect(libro.info).toBe('Tomo/ComicInfo.xml');
  });

  it('cada carpeta soltada es su propio libro', () => {
    expect(resumen(librosDeImagenes(rutas(...paginas('14巻', 3), ...paginas('15巻', 4)), ''))).toEqual(['14巻 (3)', '15巻 (4)']);
  });

  it('las imágenes sueltas son un libro con lo que comparten sus nombres, o con el título que se le da', () => {
    expect(resumen(librosDeImagenes(rutas('Tomo_01_001.jpg', 'Tomo_01_002.jpg', 'Tomo_01_010.jpg'), 'Imágenes'))).toEqual(['Tomo_01 (3)']);
    expect(resumen(librosDeImagenes(rutas('foto.jpg'), 'Imágenes'))).toEqual(['foto (1)']);
    expect(resumen(librosDeImagenes(rutas('001.jpg', '002.jpg'), 'Imágenes'))).toEqual(['Imágenes (2)']);
  });

  it('sin imágenes no hay libros', () => {
    expect(librosDeImagenes(rutas('Carpeta/notas.txt', 'leeme.md'), '')).toEqual([]);
  });
});
