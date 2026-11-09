// Las listas por nivel de un examen (el JLPT en japonés) cruzadas con lo que se sabe de cada palabra: qué palabras de un
// nivel ya se conocen, qué caracteres se conocen por las palabras que los llevan y cuánto falta de cada nivel.

import type { CaracterNivel, EstadoPalabra, GramaticaNivel, PalabraNivel, ResumenNivel } from '../compartido/tipos';

/** Una fila de vocabulario.json: palabra, lectura, glosa y, si las hay, otras formas de escribirla y otras lecturas. */
export type FilaVocabulario = [string, string, string, string[]?, string[]?];
/** Una fila de kanji.json: el carácter, sus lecturas on y kun separadas por «、», y su glosa. */
export type FilaCaracter = [string, string, string, string];
/** Una fila de gramatica.json: el patrón y su significado por idioma de la interfaz. */
export type FilaGramatica = [string, Record<string, string>];

export interface DatosNivel<T> {
  fuente: string;
  niveles: Record<string, T[]>;
}

/** Lo que el motor tiene guardado de una palabra. */
export interface PalabraGuardada {
  clave: string;
  lema: string;
  lectura: string;
  estado: EstadoPalabra;
  rastreada: boolean;
}

const claveDe = (lema: string, lectura: string) => `${lema}|${lectura}`;

/** Las claves con que puede estar guardada una palabra de la lista: con su forma y su lectura, o con las alternativas. */
export function clavesDe(f: FilaVocabulario): string[] {
  const formas = [f[0], ...(f[3] ?? [])];
  const lecturas = [f[1], ...(f[4] ?? [])];
  return formas.flatMap((forma) => lecturas.map((lectura) => claveDe(forma, lectura)));
}

const PRIORIDAD: Record<EstadoPalabra, number> = { conocida: 3, ignorada: 2, aprendiendo: 1, desconocida: 0 };

/** Cada palabra de la lista con su estado. Si está guardada con otra forma o lectura, se usa esa, para cambiarla allí. */
export function palabrasDelNivel(filas: FilaVocabulario[], guardadas: ReadonlyMap<string, PalabraGuardada>): PalabraNivel[] {
  return filas.map((f) => {
    let mejor: PalabraGuardada | undefined;
    for (const c of clavesDe(f)) {
      const g = guardadas.get(c);
      if (g && (!mejor || PRIORIDAD[g.estado] > PRIORIDAD[mejor.estado])) mejor = g;
    }
    return {
      clave: mejor?.clave ?? claveDe(f[0], f[1]),
      lema: mejor?.lema ?? f[0],
      lectura: mejor?.lectura ?? f[1],
      glosa: f[2],
      estado: mejor?.estado ?? 'desconocida',
      rastreada: mejor?.rastreada ?? false,
    };
  });
}

/**
 * Cada carácter de la lista con lo que se sabe de él: conocido si lo lleva alguna palabra conocida, en aprendizaje si
 * solo lo llevan palabras en aprendizaje. Es lo mismo que se ve en «Kanji que ya conoces».
 */
export function caracteresDelNivel(filas: FilaCaracter[], palabras: Iterable<Pick<PalabraGuardada, 'lema' | 'estado'>>): CaracterNivel[] {
  const enLista = new Set(filas.map((f) => f[0]));
  const cuenta = new Map<string, { conocidas: number; aprendiendo: number }>();
  for (const p of palabras) {
    if (p.estado !== 'conocida' && p.estado !== 'aprendiendo') continue;
    for (const c of new Set(p.lema)) {
      if (!enLista.has(c)) continue;
      const n = cuenta.get(c) ?? { conocidas: 0, aprendiendo: 0 };
      if (p.estado === 'conocida') n.conocidas++;
      else n.aprendiendo++;
      cuenta.set(c, n);
    }
  }
  return filas.map(([caracter, on, kun, glosa]) => {
    const n = cuenta.get(caracter);
    return { caracter, on, kun, glosa, estado: n?.conocidas ? 'conocida' : n?.aprendiendo ? 'aprendiendo' : 'desconocida', palabras: (n?.conocidas ?? 0) + (n?.aprendiendo ?? 0) };
  });
}

export const gramaticaDelNivel = (filas: FilaGramatica[]): GramaticaNivel[] => filas.map(([patron, significado]) => ({ patron, significado }));

export function resumirNivel(nivel: string, palabras: PalabraNivel[], caracteres: CaracterNivel[], gramatica: number): ResumenNivel {
  const contar = (xs: { estado: EstadoPalabra }[]) => ({
    total: xs.length,
    conocidas: xs.filter((x) => x.estado === 'conocida').length,
    aprendiendo: xs.filter((x) => x.estado === 'aprendiendo').length,
  });
  return { nivel, palabras: contar(palabras), caracteres: contar(caracteres), gramatica: { total: gramatica } };
}

/** El significado de un punto de gramática en el idioma de la interfaz; si no lo hay, en inglés. */
export const significadoEn = (g: GramaticaNivel, idioma: string): string => g.significado[idioma] ?? g.significado.en ?? Object.values(g.significado)[0] ?? '';

/**
 * Los trozos fijos de un patrón, en orden: 〜ば〜ほど da «ば» y «ほど». Sin las notas entre paréntesis y sin los trozos
 * que no se escriben tal cual (como «疑問詞＋»). Sirve para encontrar ejemplos en las frases que se han visto.
 */
export function trozosDePatron(patron: string): string[] {
  return patron
    .replace(/[（(][^）)]*[）)]/g, '')
    .split(/[〜～]/)
    .map((t) => t.replace(/^.*＋/, '').trim())
    .filter(Boolean);
}

/** Si una frase contiene los trozos de un patrón, en orden. Los patrones de un solo carácter no se buscan: saldría todo. */
export function fraseConPatron(frase: string, trozos: string[]): boolean {
  if (!trozos.length || trozos.join('').length < 2) return false;
  let desde = 0;
  for (const t of trozos) {
    const i = frase.indexOf(t, desde);
    if (i < 0) return false;
    desde = i + t.length;
  }
  return true;
}
