// Aplica a las palabras de una línea lo que Claude averiguó sobre ella: lecturas corregidas y
// sentidos que no son el primero del diccionario. Lógica pura.

import { alinearFurigana, kataAHira, type TokenUnido } from './tokens';
import { tm } from '../compartido/i18n';

export interface LecturaCorregida {
  superficie: string;
  lectura: string;
  lema?: string;
  lectura_lema?: string;
}

export interface SentidoContexto {
  superficie: string;
  significado: string;
  uso?: string;
}

export interface GramaticaIA {
  fragmento: string;
  patron: string;
  nivel?: string;
  significado: string;
}

export interface AnalisisLinea {
  lecturas: LecturaCorregida[];
  sentidos: SentidoContexto[];
  gramatica: GramaticaIA[];
}

/** Devuelve los tokens con las correcciones aplicadas, uniendo los que el analizador partió mal. */
export function aplicarLecturas(tokens: TokenUnido[], correcciones: LecturaCorregida[]): (TokenUnido & { lecturaCorregida?: boolean; lecturaLemaCorregida?: string })[] {
  let salida: (TokenUnido & { lecturaCorregida?: boolean; lecturaLemaCorregida?: string })[] = [...tokens];
  for (const c of correcciones) {
    const lectura = kataAHira(c.lectura);
    let i = salida.findIndex((t) => t.superficie === c.superficie);
    if (i < 0) {
      // La palabra corregida puede abarcar varios tokens: 今日 + は escrito como una lectura especial.
      for (let a = 0; a < salida.length && i < 0; a++) {
        let trozo = '';
        for (let b = a; b < salida.length && trozo.length < c.superficie.length; b++) {
          trozo += salida[b].superficie;
          if (trozo === c.superficie && b > a) {
            const grupo = salida.slice(a, b + 1);
            salida = [
              ...salida.slice(0, a),
              {
                ...grupo[0],
                superficie: trozo,
                lema: c.lema ?? trozo,
                flexion: [],
                esPalabra: true,
                esGramatica: false,
                inflexionado: false,
              },
              ...salida.slice(b + 1),
            ];
            i = a;
            break;
          }
        }
      }
    }
    if (i < 0) continue;
    const t = salida[i];
    salida = [...salida];
    salida[i] = {
      ...t,
      lectura,
      lema: c.lema ?? t.lema,
      furigana: alinearFurigana(t.superficie, lectura),
      inflexionado: t.superficie !== (c.lema ?? t.lema),
      lecturaCorregida: true,
      lecturaLemaCorregida: c.lectura_lema ? kataAHira(c.lectura_lema) : t.inflexionado ? undefined : lectura,
    };
  }
  return salida;
}

/** Nombre legible del tipo de uso. */
export const NOMBRES_USO: Record<string, string> = {
  literal: tm('Uso literal'),
  figurado: tm('Uso figurado'),
  poetico: tm('Uso poético'),
  coloquial: tm('Coloquial'),
  formal: tm('Formal'),
  arcaico: tm('Arcaico'),
  expresion: tm('Expresión hecha'),
  jerga: tm('Jerga'),
};
