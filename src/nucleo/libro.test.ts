import { strToU8, zipSync, type Zippable } from 'fflate';
import { describe, expect, it } from 'vitest';
import { atributos, leerEpubDeTexto, leerLibro, ordenDePaginas, resolverRuta, sinEntidades } from './libro';
import { fuenteDeBytes, leerIndiceZip } from './zip';

const CONTENEDOR = '<?xml version="1.0"?><container><rootfiles><rootfile full-path="item/standard.opf" media-type="application/oebps-package+xml"/></rootfiles></container>';
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

function epub(archivos: Zippable): Uint8Array {
  return zipSync({ mimetype: [strToU8('application/epub+zip'), { level: 0 }], 'META-INF/container.xml': strToU8(CONTENEDOR), ...archivos });
}

const paginaConImg = (src: string) => strToU8(`<html><head><title>p</title></head><body><div><img src="${src}" alt=""/></div></body></html>`);
const paginaConSvg = (src: string) =>
  strToU8(`<html><head><title>p</title></head><body><svg xmlns:xlink="http://www.w3.org/1999/xlink"><image width="844" height="1200" xlink:href="${src}"/></svg></body></html>`);

describe('un EPUB de imágenes, como el manga', () => {
  const opf = `<package><metadata><dc:title>推しの子 &amp; 1</dc:title><dc:language>ja</dc:language><meta property="rendition:layout">pre-paginated</meta></metadata>
    <manifest>
      <item id="nav" href="navigation-documents.xhtml" media-type="application/xhtml+xml" properties="nav"/>
      <item id="p1" href="xhtml/p-001.xhtml" media-type="application/xhtml+xml"/>
      <item id="p2" href="xhtml/p-002.xhtml" media-type="application/xhtml+xml"/>
      <item id="p3" href="xhtml/p-003.xhtml" media-type="application/xhtml+xml"/>
    </manifest>
    <spine page-progression-direction="rtl"><itemref idref="p1"/><itemref idref="p2" properties="page-spread-left"/><itemref idref="p3"/></spine></package>`;
  const datos = epub({
    'item/standard.opf': strToU8(opf),
    'item/navigation-documents.xhtml': strToU8('<nav epub:type="toc"><ol><li><a href="xhtml/p-001.xhtml">表紙</a></li><li><a href="xhtml/p-003.xhtml#c1">第一話</a></li></ol></nav>'),
    'item/xhtml/p-001.xhtml': paginaConSvg('../image/i-001.jpg'),
    'item/xhtml/p-002.xhtml': paginaConImg('../image/i-002.jpg'),
    'item/xhtml/p-003.xhtml': paginaConSvg('../image/i-003.jpg'),
    'item/image/i-001.jpg': JPG,
    'item/image/i-002.jpg': JPG,
    'item/image/i-003.jpg': JPG,
  });

  it('saca las páginas en orden, el título, el idioma y el sentido del propio archivo', async () => {
    const { libro } = await leerLibro(fuenteDeBytes(datos), 'manga.epub', 'ltr');
    expect(libro).toMatchObject({
      formato: 'epub',
      titulo: '推しの子 & 1',
      idioma: 'ja',
      direccion: 'rtl',
      direccionDelArchivo: true,
      paginas: ['item/image/i-001.jpg', 'item/image/i-002.jpg', 'item/image/i-003.jpg'],
    });
  });

  it('y el índice, con cada capítulo en su página', async () => {
    const { libro } = await leerLibro(fuenteDeBytes(datos), 'manga.epub', 'ltr');
    expect(libro?.indice).toEqual([{ titulo: '表紙', pagina: 0 }, { titulo: '第一話', pagina: 2 }]);
  });
});

describe('un EPUB de imágenes que no dice su sentido', () => {
  it('va de izquierda a derecha, como un libro de texto horizontal', async () => {
    const opf = '<package><metadata><dc:title>N2</dc:title></metadata><manifest><item id="p1" href="p1.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="p1"/></spine></package>';
    const datos = epub({ 'item/standard.opf': strToU8(opf), 'item/p1.xhtml': paginaConImg('i1.jpg'), 'item/i1.jpg': JPG });
    const { libro } = await leerLibro(fuenteDeBytes(datos), 'n2.epub', 'rtl');
    expect(libro).toMatchObject({ direccion: 'ltr', direccionDelArchivo: false, paginas: ['item/i1.jpg'] });
  });
});

describe('un EPUB de texto', () => {
  it('no es de páginas: se importa como texto', async () => {
    const opf = '<package><metadata><dc:title>小説</dc:title></metadata><manifest><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/></spine></package>';
    const datos = epub({ 'item/standard.opf': strToU8(opf), 'item/c1.xhtml': strToU8('<html><body><h1>第一章</h1><p>吾輩は猫である。名前はまだ無い。どこで生れたかとんと見当がつかぬ。</p><img src="ilustracion.jpg"/></body></html>'), 'item/ilustracion.jpg': JPG });
    const { libro } = await leerLibro(fuenteDeBytes(datos), 'novela.epub', 'rtl');
    expect(libro).toBeNull();
  });

  const capitulo = (titulo: string) => strToU8(`<html xmlns="http://www.w3.org/1999/xhtml"><body><h1 id="t">${titulo}</h1><p>本文です。</p></body></html>`);
  const novela = (opf: string, extra: Zippable = {}) =>
    epub({ 'item/standard.opf': strToU8(opf), 'item/text/c1.xhtml': capitulo('第一章'), 'item/text/c2.xhtml': capitulo('第二章'), 'item/img/tapa.jpg': JPG, ...extra });
  const abrir = async (datos: Uint8Array) => {
    const f = fuenteDeBytes(datos);
    return leerEpubDeTexto(f, await leerIndiceZip(f), 'novela');
  };

  it('se lee por capítulos, en el orden del libro, con su índice y su portada', async () => {
    const opf = `<package><metadata><dc:title>猫の本</dc:title><dc:language>ja</dc:language></metadata>
      <manifest>
        <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
        <item id="tapa" href="img/tapa.jpg" media-type="image/jpeg" properties="cover-image"/>
        <item id="c1" href="text/c1.xhtml" media-type="application/xhtml+xml"/>
        <item id="c2" href="text/c2.xhtml" media-type="application/xhtml+xml"/>
      </manifest>
      <spine page-progression-direction="rtl"><itemref idref="c1"/><itemref idref="c2"/></spine></package>`;
    const datos = novela(opf, { 'item/nav.xhtml': strToU8('<nav epub:type="toc"><ol><li><a href="text/c1.xhtml">第一章</a></li><li><a href="text/c2.xhtml#t">第二章</a></li></ol></nav>') });
    const libro = await abrir(datos);
    expect(libro).toMatchObject({
      titulo: '猫の本',
      idioma: 'ja',
      direccion: 'rtl',
      direccionDelArchivo: true,
      capitulos: ['item/text/c1.xhtml', 'item/text/c2.xhtml'],
      indice: [{ titulo: '第一章', capitulo: 0 }, { titulo: '第二章', capitulo: 1, fragmento: 't' }],
      portada: 'item/img/tapa.jpg',
    });
  });

  it('con el índice de EPUB 2 y la portada de su <meta>', async () => {
    const opf = `<package><metadata><dc:title>小説</dc:title><meta name="cover" content="tapa"/></metadata>
      <manifest>
        <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
        <item id="tapa" href="img/tapa.jpg" media-type="image/jpeg"/>
        <item id="c1" href="text/c1.xhtml" media-type="application/xhtml+xml"/>
        <item id="c2" href="text/c2.xhtml" media-type="application/xhtml+xml"/>
      </manifest>
      <spine toc="ncx"><itemref idref="c1"/><itemref idref="c2"/></spine></package>`;
    const ncx = '<ncx><navMap><navPoint id="a"><navLabel><text>二</text></navLabel><content src="text/c2.xhtml"/></navPoint></navMap></ncx>';
    const libro = await abrir(novela(opf, { 'item/toc.ncx': strToU8(ncx) }));
    expect(libro).toMatchObject({ direccion: 'ltr', direccionDelArchivo: false, indice: [{ titulo: '二', capitulo: 1 }], portada: 'item/img/tapa.jpg' });
  });
});

describe('un CBZ', () => {
  it('ordena las imágenes como se numeran, deja fuera lo de macOS y lee ComicInfo', async () => {
    const datos = zipSync({
      'Vol1/p10.jpg': JPG,
      'Vol1/p2.jpg': JPG,
      'Vol1/p1.jpg': JPG,
      '__MACOSX/Vol1/._p1.jpg': JPG,
      'ComicInfo.xml': strToU8('<ComicInfo><Title>Tomo 1</Title><Manga>YesAndRightToLeft</Manga></ComicInfo>'),
    });
    const { libro } = await leerLibro(fuenteDeBytes(datos), 'tomo.cbz', 'ltr');
    expect(libro).toMatchObject({ formato: 'cbz', titulo: 'Tomo 1', direccion: 'rtl', direccionDelArchivo: true, paginas: ['Vol1/p1.jpg', 'Vol1/p2.jpg', 'Vol1/p10.jpg'] });
  });

  it('sin ComicInfo, usa el sentido por defecto y el nombre del archivo', async () => {
    const { libro } = await leerLibro(fuenteDeBytes(zipSync({ 'a.png': JPG })), 'mi tomo.cbz', 'rtl');
    expect(libro).toMatchObject({ titulo: 'mi tomo', direccion: 'rtl', direccionDelArchivo: false });
  });

  it('pone la portada delante aunque el orden natural la deje al final', async () => {
    const { libro } = await leerLibro(fuenteDeBytes(zipSync({ '00002.jpg': JPG, 'cover.jpg': JPG, '00001.jpg': JPG })), '14巻.cbz', 'rtl');
    expect(libro?.paginas).toEqual(['cover.jpg', '00001.jpg', '00002.jpg']);
    expect(libro?.indice).toEqual([]);
  });

  it('con una carpeta por capítulo, cada una es una entrada del índice, y la portada de un capítulo abre su capítulo', async () => {
    const { libro } = await leerLibro(fuenteDeBytes(zipSync({ '第2話/001.jpg': JPG, '第1話/cover.jpg': JPG, '第1話/001.jpg': JPG, '第10話/001.jpg': JPG, 'cover.jpg': JPG })), 'tomo.cbz', 'rtl');
    expect(libro?.paginas).toEqual(['cover.jpg', '第1話/cover.jpg', '第1話/001.jpg', '第2話/001.jpg', '第10話/001.jpg']);
    expect(libro?.indice).toEqual([{ titulo: '第1話', pagina: 1 }, { titulo: '第2話', pagina: 3 }, { titulo: '第10話', pagina: 4 }]);
  });
});

describe('el orden de las páginas', () => {
  it('reconoce las portadas por su nombre, pero no la contraportada', () => {
    expect(ordenDePaginas(['p_001.jpg', 'cover_000.jpg'])).toEqual(['cover_000.jpg', 'p_001.jpg']);
    expect(ordenDePaginas(['001.jpg', '00_cover.png', '表紙.jpg'])).toEqual(['00_cover.png', '表紙.jpg', '001.jpg']);
    expect(ordenDePaginas(['001.jpg', 'back_cover.jpg'])).toEqual(['001.jpg', 'back_cover.jpg']);
    expect(ordenDePaginas(['_02.jpg', '0001.jpg', '_01.jpg'])).toEqual(['_01.jpg', '_02.jpg', '0001.jpg']);
  });
});

describe('las piezas del lector de libros', () => {
  it('resuelve rutas relativas, con «..», fragmentos y espacios codificados', () => {
    expect(resolverRuta('item/xhtml/p-001.xhtml', '../image/i%20001.jpg#x')).toBe('item/image/i 001.jpg');
    expect(resolverRuta('standard.opf', 'xhtml/p.xhtml')).toBe('xhtml/p.xhtml');
  });

  it('lee atributos con comillas de los dos tipos y entidades', () => {
    expect(atributos(`<image xlink:href='a&amp;b.jpg' width="10"/>`)).toEqual({ 'xlink:href': 'a&b.jpg', width: '10' });
    expect(sinEntidades('&#x6F22;&#23383;&lt;')).toBe('漢字<');
  });
});
