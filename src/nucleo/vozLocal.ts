// La voz local con el acento del diccionario. Los motores con la API de VOICEVOX (AivisSpeech, VOICEVOX) devuelven, para
// cada texto, sus frases acentuales con el acento que les da su propio análisis; aquí se cotejan con las de Kotonoha, que
// llevan el del diccionario (Kanjium), y se corrige el del motor donde no coincide. Así la voz dice lo que el diccionario
// dice, no lo que adivina. Sin navegador ni red: lo usa el motor y se prueba aparte.

import type { FraseAcentual } from './practicaAcento';

/** Lo que se usa de la consulta del motor (AudioQuery de VOICEVOX); lo demás se devuelve tal cual. */
export interface ConsultaVoz {
  accent_phrases: FraseDelMotor[];
  [otro: string]: unknown;
}

export interface FraseDelMotor {
  moras: { text: string; [otro: string]: unknown }[];
  /** La última mora alta: 1 en atamadaka; en una frase sin núcleo, el número de moras. */
  accent: number;
  [otro: string]: unknown;
}

/** Una corrección hecha, para decirla o comprobarla. */
export interface CambioAcento {
  frase: number;
  texto: string;
  antes: number;
  despues: number;
}

/** Las moras que se pronuncian, las que llevan alguna letra: el motor añade una «.» por la puntuación del final. */
export const morasDelMotor = (f: FraseDelMotor): number => f.moras.filter((m) => /\p{L}/u.test(m.text)).length;

/** El acento de VOICEVOX para un núcleo de Kotonoha (0, sin núcleo; 1, tras la primera mora). */
export const acentoVoicevox = (nucleo: number, moras: number): number => (nucleo === 0 ? moras : nucleo);

/**
 * Las frases del motor y las de Kotonoha que son la misma: las que empiezan y acaban en las mismas moras. Donde los dos
 * análisis parten distinto, no hay pareja y el motor se queda con su acento.
 */
export function emparejarFrases(delMotor: number[], nuestras: number[]): [number, number][] {
  const pares: [number, number][] = [];
  for (let i = 0, j = 0, a = 0, b = 0; i < delMotor.length && j < nuestras.length; ) {
    if (a === b && delMotor[i] === nuestras[j]) pares.push([i, j]);
    if (a + delMotor[i] <= b + nuestras[j]) a += delMotor[i++];
    else b += nuestras[j++];
  }
  return pares;
}

/**
 * La consulta con el acento del diccionario en las frases que se pueden emparejar y cuyo acento se sabe. Si el del motor
 * ya es uno de los del diccionario (hay palabras con dos), se respeta.
 */
export function corregirAcentos<C extends ConsultaVoz>(consulta: C, frases: FraseAcentual[]): { consulta: C; cambios: CambioAcento[] } {
  const corregida = structuredClone(consulta);
  const cambios: CambioAcento[] = [];
  const pares = emparejarFrases(
    consulta.accent_phrases.map(morasDelMotor),
    frases.map((f) => f.moras.length)
  );
  for (const [i, j] of pares) {
    const f = frases[j];
    if (!f.nucleos?.length) continue;
    const posibles = f.nucleos.map((n) => acentoVoicevox(n, f.moras.length));
    const antes = consulta.accent_phrases[i].accent;
    if (posibles.includes(antes)) continue;
    corregida.accent_phrases[i].accent = posibles[0];
    cambios.push({ frase: i, texto: f.texto, antes, despues: posibles[0] });
  }
  return { consulta: corregida, cambios };
}

/** Los puertos de siempre: AivisSpeech y VOICEVOX. */
export const MOTORES_CONOCIDOS = [
  { nombre: 'AivisSpeech', url: 'http://127.0.0.1:10101' },
  { nombre: 'VOICEVOX', url: 'http://127.0.0.1:50021' },
] as const;

/** La clave de un audio en la caché: el mismo texto con el mismo motor, voz y acento suena igual. */
export function claveDeAudio(url: string, estilo: number, acentoDiccionario: boolean, texto: string): string {
  let h = 0x811c9dc5;
  const s = `${url}\u0000${estilo}\u0000${acentoDiccionario ? 1 : 0}\u0000${texto}`;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return `${(h >>> 0).toString(36)}-${s.length}`;
}
