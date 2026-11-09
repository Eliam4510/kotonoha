// Las referencias que JMdict mete entre las definiciones (en su versión de Yomitan, y en inglés en todas las ediciones):
// «antonym: 下手（へた） 1. unskillful» es su opuesto, y «see: 天狗 1. tengu» otra palabra que conviene ver. Se sacan
// para enseñarlas aparte, cada una como palabra que se puede abrir.

import type { ReferenciaGlosa } from '../tipos';

const PREFIJO = /^(antonym|see):\s*(\S+)/;
/** 下手（へた）, 天狗・1 o 上手（じょうず）・2: la palabra, su lectura si la lleva y, detrás, el número de su sentido. */
const PALABRA = /^([^（・\s]+)(?:（([^）]+)）)?/;

export function referenciaEnGlosa(glosa: string): ReferenciaGlosa | null {
  const m = PREFIJO.exec(glosa.trim());
  if (!m) return null;
  const p = PALABRA.exec(m[2]);
  if (!p) return null;
  return { tipo: m[1] === 'antonym' ? 'opuesto' : 'ver', termino: p[1], ...(p[2] ? { lectura: p[2] } : {}) };
}
