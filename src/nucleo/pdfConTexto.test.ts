import { zlibSync } from 'fflate';
import { degrees, PDFDocument, rgb } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { cabeceraJpeg } from './imagenes';
import { actualizarConTexto, vistaDe } from './pdfActualizar';
import { aHex, capaDeTexto, Codificador, fuenteSinLetras, lineaEnPdf, mapaUnicode, PdfDeImagenes, sumaDeControl, tamanoDePagina, transformadorDeImagen, ultimaReferencia } from './pdfConTexto';

const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

type Linea = { caja: { x0: number; y0: number; x1: number; y1: number }; texto: string; vertical: boolean };
const linea = (x0: number, y0: number, x1: number, y1: number, texto: string, vertical = false): Linea => ({ caja: { x0, y0, x1, y1 }, texto, vertical });

/** Lo que pdf.js lee de cada página: su texto, con dónde empieza cada trozo en fracciones de la página tal como se ve. */
async function leerConPdfjs(datos: Uint8Array) {
  // pdf.js se queda con los datos: se le da una copia.
  const tarea = pdfjs.getDocument({ data: datos.slice(), verbosity: 0 });
  const doc = await tarea.promise;
  try {
    const paginas = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const p = await doc.getPage(n);
      const vista = p.getViewport({ scale: 1 });
      const contenido = await p.getTextContent();
      const trozos = contenido.items
        .filter((i): i is (typeof contenido.items)[number] & { str: string; transform: number[] } => 'str' in i && !!i.str)
        .map((i) => {
          const [x, y] = vista.convertToViewportPoint(i.transform[4], i.transform[5]);
          return { texto: i.str, fx: x / vista.width, fy: y / vista.height };
        });
      const ops = await p.getOperatorList();
      paginas.push({ trozos, ops: ops.fnArray as number[], vista });
    }
    return paginas;
  } finally {
    await tarea.destroy();
  }
}

describe('la fuente sin letras', () => {
  const f = fuenteSinLetras();
  const d = new DataView(f.buffer, f.byteOffset, f.byteLength);
  const tablas = Array.from({ length: d.getUint16(4) }, (_, i) => {
    const p = 12 + 16 * i;
    return { etiqueta: String.fromCharCode(...f.subarray(p, p + 4)), suma: d.getUint32(p + 4), desde: d.getUint32(p + 8), largo: d.getUint32(p + 12) };
  });

  it('es pequeña y lleva las tablas que piden los lectores, en orden', () => {
    expect(f.length).toBeLessThan(1000);
    expect(tablas.map((t) => t.etiqueta)).toEqual(['OS/2', 'cmap', 'glyf', 'head', 'hhea', 'hmtx', 'loca', 'maxp', 'name', 'post']);
  });

  it('cada tabla con su suma de control, y la de la fuente entera ajustada', () => {
    for (const t of tablas) {
      const datos = f.slice(t.desde, t.desde + t.largo);
      // La de head se calcula con su ajuste a cero.
      if (t.etiqueta === 'head') datos.fill(0, 8, 12);
      expect(sumaDeControl(datos), t.etiqueta).toBe(t.suma);
    }
    expect(sumaDeControl(f)).toBe(0xb1b0afba);
  });

  it('el mapa a Unicode cubre el plano básico en bloques de 100 como mucho', () => {
    const m = mapaUnicode();
    expect(m.match(/beginbfrange/g)).toHaveLength(3);
    expect(m).toContain('<3000> <30FF> <3000>');
    expect(m).toContain('<FF00> <FFFF> <FF00>');
    expect(m).not.toContain('<D800> <D8FF>');
  });

  it('los caracteres de fuera del plano básico llevan un código propio cada uno', () => {
    const c = new Codificador();
    expect(c.codificar('猫𠮟😺𠮟')).toEqual({ hex: '732BD800D801D800', n: 4 });
    const m = mapaUnicode(c);
    expect(m).toContain('<D800> <D842DF9F>');
    expect(m).toContain('<D801> <D83DDE3A>');
  });
});

describe('las líneas en la página', () => {
  const t = transformadorDeImagen(600, 800);

  it('una línea horizontal empieza abajo a la izquierda de su caja y llega a su derecha', () => {
    const l = lineaEnPdf(linea(0.1, 0.1, 0.5, 0.15, 'ABC'), t)!;
    expect(l.origen).toEqual([60, 680]);
    expect(l.avance[0]).toBeCloseTo(240);
    expect(l.arriba[1]).toBeCloseTo(40);
  });

  it('una vertical baja desde arriba a la izquierda, con lo de arriba de sus letras mirando a la derecha', () => {
    const l = lineaEnPdf(linea(0.8, 0.1, 0.85, 0.6, '縦書き', true), t)!;
    expect(l.origen).toEqual([480, 720]);
    expect(l.avance[1]).toBeCloseTo(-400);
    expect(l.arriba[0]).toBeCloseTo(30);
  });

  it('sin texto o sin caja, no hay línea', () => {
    expect(lineaEnPdf(linea(0.1, 0.1, 0.5, 0.15, '  \n'), t)).toBeNull();
    expect(lineaEnPdf(linea(0.5, 0.1, 0.5, 0.15, 'x'), t)).toBeNull();
  });

  it('el texto va en códigos de 16 bits', () => {
    expect(aHex('A猫')).toBe('0041732B');
    const capa = capaDeTexto([lineaEnPdf(linea(0, 0, 1, 0.1, 'AB'), t)!], 'F', new Codificador());
    expect(capa).toContain('3 Tr');
    expect(capa).toContain('<00410042> Tj');
  });

  it('el tamaño de la página sale de los puntos por pulgada de la imagen, o de 150', () => {
    expect(tamanoDePagina(1500, 3000, 300)).toEqual([360, 720]);
    expect(tamanoDePagina(1500, 3000)).toEqual([720, 1440]);
    expect(tamanoDePagina(1500, 3000, 1)).toEqual([720, 1440]);
  });
});

describe('la cabecera de un JPEG', () => {
  it('dice su tamaño, sus colores, si es de Adobe y sus puntos por pulgada', () => {
    const jfif = [0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 1, 0, 200, 0, 200, 0, 0];
    const adobe = [0xff, 0xee, 0, 14, 0x41, 0x64, 0x6f, 0x62, 0x65, 0, 100, 0, 0, 0, 0, 2];
    const sof = [0xff, 0xc0, 0, 17, 8, 0, 100, 0, 200, 4, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, 4, 0x11, 1];
    const c = cabeceraJpeg(Uint8Array.from([0xff, 0xd8, ...jfif, ...adobe, ...sof, 0xff, 0xd9]));
    expect(c).toEqual({ ancho: 200, alto: 100, componentes: 4, bits: 8, adobe: true, ppp: 200, comun: true });
  });
});

describe('un PDF nuevo con las imágenes de un libro', () => {
  it('lleva cada imagen como página y su texto donde estaba, en horizontal y en vertical', async () => {
    const libro = new PdfDeImagenes(2, { titulo: 'テストの漫画 第1巻', lengua: 'ja', derechaAIzquierda: true });
    const gris = new Uint8Array(30 * 40).fill(200);
    libro.pagina({ flujo: zlibSync(gris), filtro: 'FlateDecode', espacio: 'DeviceGray', ancho: 30, alto: 40 }, [linea(0.1, 0.1, 0.6, 0.15, 'ABC'), linea(0.1, 0.5, 0.9, 0.55, '日本語の文')], 72);
    const color = new Uint8Array(20 * 20 * 3).fill(90);
    libro.pagina({ flujo: zlibSync(color), filtro: 'FlateDecode', espacio: 'DeviceRGB', ancho: 20, alto: 20 }, [linea(0.8, 0.1, 0.85, 0.6, '縦書き😺', true)], 72);
    const datos = new Uint8Array(await libro.terminar().arrayBuffer());
    const [p1, p2] = await leerConPdfjs(datos);
    expect(p1.trozos.map((x) => x.texto)).toEqual(['ABC', '日本語の文']);
    expect(p1.trozos[0].fx).toBeCloseTo(0.1, 3);
    expect(p1.trozos[0].fy).toBeCloseTo(0.15, 3);
    expect(p2.trozos.map((x) => x.texto).join('')).toBe('縦書き😺');
    expect(p2.trozos[0].fx).toBeCloseTo(0.8, 3);
    expect(p2.trozos[0].fy).toBeCloseTo(0.1, 3);
    // Las imágenes se pintan: el texto no las tapa ni las sustituye.
    expect(p1.ops).toContain(pdfjs.OPS.paintImageXObject);
    expect(p2.ops).toContain(pdfjs.OPS.paintImageXObject);
    // Y otro lector lo abre igual, con el título y el sentido de lectura.
    const otro = await PDFDocument.load(datos);
    expect(otro.getPageCount()).toBe(2);
    expect(otro.getTitle()).toBe('テストの漫画 第1巻');
  });
});

/** Un PDF de dos páginas como los de cualquier programa: la segunda girada y con caja de recorte. */
async function pdfDePrueba(conFlujo: boolean) {
  const doc = await PDFDocument.create();
  const a = doc.addPage([600, 800]);
  a.drawRectangle({ x: 50, y: 50, width: 100, height: 100, color: rgb(0.2, 0.2, 0.2) });
  const b = doc.addPage([600, 800]);
  b.drawRectangle({ x: 300, y: 300, width: 100, height: 100, color: rgb(0.5, 0.5, 0.5) });
  b.setCropBox(50, 60, 500, 700);
  b.setRotation(degrees(90));
  return doc.save({ useObjectStreams: conFlujo });
}

describe('el texto añadido a un PDF que ya existe', () => {
  for (const conFlujo of [false, true]) {
    it(`va al final, sin tocar lo de antes, y en su sitio aunque la página esté girada (${conFlujo ? 'con flujo de referencias' : 'con tabla clásica'})`, async () => {
      const original = await pdfDePrueba(conFlujo);
      const lineas = [[linea(0.1, 0.1, 0.5, 0.15, 'テスト')], [linea(0.7, 0.1, 0.75, 0.5, '縦の行', true)]];
      const r = await actualizarConTexto(new Blob([original]), async (n) => lineas[n]);
      expect(r).toMatchObject({ paginas: 2, conTexto: 2 });
      const datos = new Uint8Array(await r.blob.arrayBuffer());
      // Lo de antes, byte a byte, y lo nuevo detrás.
      expect(datos.subarray(0, original.length)).toEqual(original);
      expect(ultimaReferencia(new TextDecoder('latin1').decode(datos.subarray(-200)))).toBeGreaterThan(original.length);
      const [p1, p2] = await leerConPdfjs(datos);
      expect(p1.trozos.map((x) => x.texto)).toEqual(['テスト']);
      expect(p1.trozos[0].fx).toBeCloseTo(0.1, 3);
      expect(p1.trozos[0].fy).toBeCloseTo(0.15, 3);
      expect(p2.trozos.map((x) => x.texto)).toEqual(['縦の行']);
      expect(p2.trozos[0].fx).toBeCloseTo(0.7, 3);
      expect(p2.trozos[0].fy).toBeCloseTo(0.1, 3);
      // La página sigue pintando lo suyo.
      expect(p1.ops).toContain(pdfjs.OPS.constructPath);
      // Y pdf-lib lo vuelve a abrir.
      expect((await PDFDocument.load(datos)).getPageCount()).toBe(2);
    });
  }

  it('las páginas sin texto no se tocan, y se puede añadir otra vez encima', async () => {
    const original = await pdfDePrueba(false);
    const r = await actualizarConTexto(new Blob([original]), async (n) => (n === 1 ? [linea(0.2, 0.2, 0.4, 0.25, 'Hola')] : null));
    expect(r.conTexto).toBe(1);
    const otra = await actualizarConTexto(r.blob, async (n) => (n === 0 ? [linea(0.2, 0.2, 0.4, 0.25, 'Adiós')] : null));
    const [p1, p2] = await leerConPdfjs(new Uint8Array(await otra.blob.arrayBuffer()));
    expect(p1.trozos.map((x) => x.texto)).toEqual(['Adiós']);
    expect(p2.trozos.map((x) => x.texto)).toEqual(['Hola']);
  });

  it('la caja visible es la de recorte dentro de la del papel', async () => {
    const doc = await PDFDocument.load(await pdfDePrueba(false));
    expect(vistaDe(doc.getPage(0))).toEqual([0, 0, 600, 800]);
    expect(vistaDe(doc.getPage(1))).toEqual([50, 60, 550, 760]);
  });
});
