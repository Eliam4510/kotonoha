// La herramienta Área del visor: una zona de la página que se lee aparte con el OCR, como un diagrama o un cartel de un
// manga que la lectura de la página entera no ve. Aquí, sin navegador: qué trozo de la imagen se lee y cómo entra lo
// leído en el texto de la página.

import type { LineaTexto } from './capaTexto';
import type { Caja, LineaOcr } from './ocr';
import { unirRenglones } from './parrafos';

/** Una zona de una página leída aparte, con lo que se leyó en ella. Todo en fracciones de la página. */
export interface ZonaLeida {
  caja: Caja;
  lineas: LineaOcr[];
}

/** El trozo de la imagen que se lee, en píxeles, y dónde queda ese trozo en la página. */
export interface RecorteZona {
  x: number;
  y: number;
  ancho: number;
  alto: number;
  marco: Caja;
}

const PAGINA: Caja = { x0: 0, y0: 0, x1: 1, y1: 1 };

/** Menos de esto, en píxeles de la imagen, no es una zona sino una raya: ahí no cabe una letra. */
const MINIMO_PX = 8;

/**
 * El trozo de la imagen que lee el OCR para una zona de la página. La imagen ocupa `marco` en la página (un escaneo no
 * siempre la llena): se recorta lo que la zona tiene dentro de ella, a píxeles enteros, y el marco del recorte sale de
 * esos píxeles, para que lo leído caiga justo en su sitio. Null si la zona queda fuera de la imagen o es una raya.
 */
export function recorteDeZona(zona: Caja, ancho: number, alto: number, marco: Caja = PAGINA): RecorteZona | null {
  const mw = marco.x1 - marco.x0;
  const mh = marco.y1 - marco.y0;
  if (!(mw > 0 && mh > 0 && ancho > 0 && alto > 0)) return null;
  const aPx = (v: number, desde: number, medida: number, lado: number) => Math.min(lado, Math.max(0, ((v - desde) / medida) * lado));
  const x0 = Math.floor(aPx(zona.x0, marco.x0, mw, ancho));
  const x1 = Math.ceil(aPx(zona.x1, marco.x0, mw, ancho));
  const y0 = Math.floor(aPx(zona.y0, marco.y0, mh, alto));
  const y1 = Math.ceil(aPx(zona.y1, marco.y0, mh, alto));
  if (x1 - x0 < MINIMO_PX || y1 - y0 < MINIMO_PX) return null;
  return {
    x: x0,
    y: y0,
    ancho: x1 - x0,
    alto: y1 - y0,
    marco: { x0: marco.x0 + (x0 / ancho) * mw, y0: marco.y0 + (y0 / alto) * mh, x1: marco.x0 + (x1 / ancho) * mw, y1: marco.y0 + (y1 / alto) * mh },
  };
}

/** Si el centro de una caja cae dentro de otra. */
function centroDentro(c: Caja, z: Caja): boolean {
  const x = (c.x0 + c.x1) / 2;
  const y = (c.y0 + c.y1) / 2;
  return x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1;
}

/**
 * El texto de una página con lo leído en sus zonas, de la primera a la última: lo que había dentro de una zona (las
 * líneas con el centro dentro) se cambia por lo leído en ella, en el mismo sitio del orden de lectura; si dentro no había
 * nada, lo leído va al final. Una zona leída después manda sobre otra anterior en lo que tienen en común.
 */
export function conZonas(lineas: LineaTexto[], zonas: ZonaLeida[]): LineaTexto[] {
  let salida = lineas;
  for (const z of zonas) {
    const primera = salida.findIndex((l) => centroDentro(l.caja, z.caja));
    const quedan = salida.filter((l) => !centroDentro(l.caja, z.caja));
    // Antes de la primera que estaba dentro no se ha quitado nada: ahí mismo entra lo leído.
    const donde = primera < 0 ? quedan.length : primera;
    salida = [...quedan.slice(0, donde), ...z.lineas, ...quedan.slice(donde)];
  }
  return salida;
}

/**
 * Lo leído en una zona como un solo globo, que es como se lee un manga: cada globo es una línea. Los renglones o columnas
 * se unen en su orden, sin espacio en japonés y con uno donde se separan las palabras, y la caja es la de todos ellos. Sin
 * dónde va cada letra: en un globo no se usa.
 */
export function comoGlobo(lineas: LineaOcr[]): LineaOcr | null {
  const conTexto = lineas.filter((l) => l.texto.trim());
  if (!conTexto.length) return null;
  const caja = {
    x0: Math.min(...conTexto.map((l) => l.caja.x0)),
    y0: Math.min(...conTexto.map((l) => l.caja.y0)),
    x1: Math.max(...conTexto.map((l) => l.caja.x1)),
    y1: Math.max(...conTexto.map((l) => l.caja.y1)),
  };
  const verticales = conTexto.filter((l) => l.vertical).length;
  return { caja, texto: conTexto.map((l) => l.texto.trim()).reduce((a, b) => unirRenglones(a, b)), vertical: 2 * verticales > conTexto.length };
}

/** Las líneas de una página que son las leídas en una zona: las mismas cajas, que lo editado no cambia. */
export function lineasDeZona(lineas: LineaTexto[], leidas: LineaOcr[]): number[] {
  const misma = (a: Caja, b: Caja) => a.x0 === b.x0 && a.y0 === b.y0 && a.x1 === b.x1 && a.y1 === b.y1;
  return lineas.flatMap((l, i) => (leidas.some((x) => misma(x.caja, l.caja)) ? [i] : []));
}
