// El análisis del japonés corre con Kuromoji y su diccionario IPADIC.

import type { Analizador } from '../tipos';
import { kataAHira, type TokenCrudo, unirTokens } from './tokens';

interface Tokenizador {
  tokenize(texto: string): TokenCrudo[];
}

// Se carga como script clásico desde el documento del motor.
declare const kuromoji: {
  builder(o: { dicPath: string }): { build(cb: (e: Error | null, t: Tokenizador) => void): void };
};

let tokenizador: Tokenizador | null = null;
let cargando: Promise<void> | null = null;

export const ANALIZADOR: Analizador = {
  listo: () => tokenizador !== null,
  cargar() {
    if (tokenizador) return Promise.resolve();
    cargando ??= new Promise((ok, mal) => {
      // Ruta relativa al documento: Kuromoji rompe las URL absolutas al unirlas con path.join.
      kuromoji.builder({ dicPath: 'dict/' }).build((e, t) => {
        if (e) mal(e);
        else {
          tokenizador = t;
          ok();
        }
      });
    });
    return cargando;
  },
  analizar: (texto, existe) => unirTokens(tokenizador!.tokenize(texto), existe),
  // Un verbo conjugado no trae la lectura del lema: se tokeniza aparte.
  lecturaDeLema: (lema) =>
    tokenizador!
      .tokenize(lema)
      .map((x) => (x.reading && x.reading !== '*' ? kataAHira(x.reading) : kataAHira(x.surface_form)))
      .join(''),
};
