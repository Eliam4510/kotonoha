import { strToU8, zipSync, type Zippable } from 'fflate';
import { describe, expect, it } from 'vitest';
import { atributos, leerLibro, resolverRuta, sinEntidades } from './libro';
import { fuenteDeBytes } from './zip';

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
