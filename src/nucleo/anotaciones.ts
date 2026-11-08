// Los marcadores, resaltados y notas de un libro de páginas, sin navegador: crear el resaltado de un tramo de una línea,
// saber qué resaltados son de cada línea, ordenarlo todo como se lee y pasarlo a texto para copiarlo.

import type { AnotacionLibro, ColorAnotacion } from '../compartido/tipos';
import { cajaDeTramo, type LineaTexto } from './capaTexto';
import { solape } from './ediciones';
import type { Caja } from './ocr';

/** Lo mínimo que tiene que solaparse la línea de un resaltado con una línea para ser suyo. */
const SOLAPE_MINIMO = 0.5;

/**
 * Un resaltado (o subrayado) de un tramo de una línea. Sin tramo, o si no se sabe dónde va cada letra (un globo de manga),
 * la línea entera.
 */
export function nuevoResaltado(o: {
  libro: string;
  pagina: number;
  linea: LineaTexto;
  tramo?: { inicio: number; fin: number } | null;
  porLetra: boolean;
  estilo: 'fondo' | 'subrayado';
  color: ColorAnotacion;
}): AnotacionLibro {
  const { linea } = o;
  const largo = linea.texto.length;
  const inicio = o.porLetra && o.tramo ? Math.max(0, Math.min(o.tramo.inicio, o.tramo.fin)) : 0;
  const fin = o.porLetra && o.tramo ? Math.min(largo, Math.max(o.tramo.inicio, o.tramo.fin)) : largo;
  const entera = inicio === 0 && fin === largo;
  return {
    id: crypto.randomUUID(),
    libro: o.libro,
    tipo: 'resaltado',
    pagina: o.pagina,
    cajas: [entera ? linea.caja : cajaDeTramo(linea, inicio, fin)],
    linea: linea.caja,
    texto: linea.texto.slice(inicio, fin),
    estilo: o.estilo,
    vertical: linea.vertical,
    color: o.color,
    creada: Date.now(),
  };
}

/** Los resaltados de una página que son de esta línea: los que se hicieron sobre la línea que ocupa ese sitio. */
export const resaltadosDe = (anotaciones: AnotacionLibro[], pagina: number, linea: Caja) =>
  anotaciones.filter((a) => a.tipo === 'resaltado' && a.pagina === pagina && !!a.linea && solape(a.linea, linea) >= SOLAPE_MINIMO);

/** Dónde empieza una anotación en su página, para ordenarlas como se lee: en vertical, de derecha a izquierda. */
function sitio(a: AnotacionLibro): number {
  if (a.tipo === 'marcador') return -1;
  if (a.punto) return a.punto.y;
  const c = a.cajas?.[0];
  if (!c) return 0;
  return a.vertical ? 1 - c.x1 : c.y0;
}

/** Todo, en el orden del libro: por páginas y, dentro de cada una, el marcador primero y lo demás por dónde está. */
export const ordenadas = (anotaciones: AnotacionLibro[]) => [...anotaciones].sort((a, b) => a.pagina - b.pagina || sitio(a) - sitio(b) || a.creada - b.creada);

/** Las anotaciones agrupadas por página, en orden. */
export function porPagina(anotaciones: AnotacionLibro[]): { pagina: number; anotaciones: AnotacionLibro[] }[] {
  const grupos: { pagina: number; anotaciones: AnotacionLibro[] }[] = [];
  for (const a of ordenadas(anotaciones)) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo?.pagina === a.pagina) ultimo.anotaciones.push(a);
    else grupos.push({ pagina: a.pagina, anotaciones: [a] });
  }
  return grupos;
}

/** Las palabras que hacen falta para escribir las notas como texto: vienen ya traducidas. */
export interface TextosNotas {
  pagina: (n: number) => string;
  marcador: string;
  nota: string;
}

/** Todo lo anotado de un libro como texto con formato Markdown, para copiarlo a otra parte. */
export function notasComoTexto(titulo: string, anotaciones: AnotacionLibro[], t: TextosNotas): string {
  const partes = [`# ${titulo}`];
  for (const g of porPagina(anotaciones)) {
    partes.push('', `## ${t.pagina(g.pagina + 1)}`, '');
    for (const a of g.anotaciones) {
      if (a.tipo === 'marcador') partes.push(`- ${t.marcador}`);
      else if (a.tipo === 'resaltado') partes.push(`> ${a.texto ?? ''}`, ...(a.nota ? ['', a.nota] : []), '');
      else partes.push(`- ${t.nota}: ${(a.nota ?? '').replace(/\n+/g, ' ')}`);
    }
  }
  return `${partes.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}
