// Cómo suena de verdad una frase en inglés: lo que pasa entre las palabras al hablar seguido. Las reducciones de siempre
// (going to → gonna), las formas débiles de las palabras pequeñas (to → tə), la consonante que se pega a la vocal
// siguiente (turn off → tur‿noff), la t o la d que se funden con «you» (meet you → meechu) y la t que suena como una d
// suave en americano (get it → ge‿dit). Son reglas: no hace falta IA, y lo que no reconocen lo dejan tal cual.

import { tm } from '../../compartido/i18n';
import type { TrozoHablado } from '../tipos';

export type Fenomeno = 'reduccion' | 'debil' | 'union' | 'fusion' | 'tSuave';

export const FENOMENOS: Record<Fenomeno, { nombre: string; explicacion: string }> = {
  reduccion: { nombre: tm('Reducción'), explicacion: tm('Dos o tres palabras se dicen como una sola, más corta: going to suena gonna.') },
  debil: { nombre: tm('Forma débil'), explicacion: tm('Las palabras pequeñas sin acento pierden su vocal, que queda en una «ə» muy breve: to suena tə.') },
  union: { nombre: tm('Unión'), explicacion: tm('La consonante del final se pega a la vocal de la palabra siguiente: turn off suena tur‿noff.') },
  fusion: { nombre: tm('t o d con you'), explicacion: tm('La t o la d delante de you se funden con ella y suenan ch o j: meet you suena meechu.') },
  tSuave: { nombre: tm('t suave'), explicacion: tm('En inglés americano, la t entre vocales suena casi como una d suave: get it suena ge‿dit.') },
};

/** Las reducciones de siempre, de la más larga a la más corta. `antesDeVerbo`: solo si sigue un verbo, no un sitio. */
const REDUCCIONES: { de: string; suena: string; antesDeVerbo?: boolean }[] = [
  { de: 'what are you', suena: 'whaddaya' },
  { de: 'what do you', suena: 'whaddaya' },
  { de: 'a lot of', suena: 'a lotta' },
  { de: 'going to', suena: 'gonna', antesDeVerbo: true },
  { de: 'want to', suena: 'wanna' },
  { de: 'wants to', suena: 'wantsta' },
  // «I got to the station» es llegar, no tener que: solo ante un verbo.
  { de: 'got to', suena: 'gotta', antesDeVerbo: true },
  { de: 'have to', suena: 'hafta' },
  { de: 'has to', suena: 'hasta' },
  { de: 'had to', suena: 'hadta' },
  { de: 'ought to', suena: 'oughta' },
  { de: 'used to', suena: 'useta' },
  { de: 'supposed to', suena: 'sposta' },
  { de: 'trying to', suena: 'tryna' },
  { de: 'kind of', suena: 'kinda' },
  { de: 'sort of', suena: 'sorta' },
  { de: 'out of', suena: 'outta' },
  { de: 'lot of', suena: 'lotta' },
  { de: 'let me', suena: 'lemme' },
  { de: 'give me', suena: 'gimme' },
  { de: "don't know", suena: 'dunno' },
  { de: 'did you', suena: 'didja' },
  { de: 'would you', suena: 'wouldja' },
  { de: 'could you', suena: 'couldja' },
  { de: "don't you", suena: 'doncha' },
  { de: "won't you", suena: 'woncha' },
  { de: 'got you', suena: 'gotcha' },
  { de: 'bet you', suena: 'betcha' },
  { de: 'what you', suena: 'whatcha' },
  { de: 'should have', suena: 'shoulda' },
  { de: 'could have', suena: 'coulda' },
  { de: 'would have', suena: 'woulda' },
  { de: 'must have', suena: 'musta' },
  { de: 'might have', suena: 'mighta' },
  { de: 'come on', suena: "c'mon" },
  { de: 'because', suena: "'cause" },
];

/** Lo que tras «going to» no es un verbo: un sitio o algo con artículo. «be» sí lo es: going to be → gonna be. */
const NO_VERBO = new Set(['the', 'a', 'an', 'my', 'your', 'his', 'her', 'our', 'their', 'this', 'that', 'these', 'those', 'school', 'work', 'bed', 'church', 'class', 'town', 'jail', 'college', 'him', 'me', 'us', 'them', 'it']);
/** Tras «going to», un nombre propio es un sitio (going to Paris); «I» no lo es. */
const esNombrePropio = (p: string) => /^[A-Z]/.test(p) && p !== 'I';

/** Las palabras pequeñas que, sin acento, se dicen con su forma débil. */
const DEBILES: Record<string, string> = { to: 'tə', for: 'fər', of: 'əv', and: 'ən', can: 'kən', you: 'yə', your: 'yər', at: 'ət', from: 'frəm', them: 'əm', than: 'ðən', was: 'wəz', were: 'wər', but: 'bət', some: 'səm', as: 'əz', or: 'ər' };

const VOCAL = /^[aeiou]/i;
/** Empiezan por vocal escrita, pero suenan con consonante: one, use, university. */
const VOCAL_QUE_NO = /^(one|once|use|used|usual|usually|uni|euro|ewe|you)/i;
/** Empiezan por h muda: hour, honest, honor, heir. */
const H_MUDA = /^(hour|honest|honor|honour|heir)/i;
const empiezaPorVocal = (p: string) => (VOCAL.test(p) && !VOCAL_QUE_NO.test(p)) || H_MUDA.test(p);
/** Las que acaban en una e tras consonante que sí suena. */
const E_QUE_SUENA = /^(maybe|recipe|cafe|karate|coyote|simile|acne|sesame|apostrophe|catastrophe|epitome|hyperbole|ukulele)$/i;
/** Una e muda tras consonante: tras una vocal (make, like, have, here) o en una palabra larga (change, since, else). La de
 * the, she, we o be sí suena. */
const eMuda = (p: string) =>
  /[^aeiouy]e$/i.test(p) && !E_QUE_SUENA.test(p) && (/[aeiouy][^aeiouy]e$/i.test(p) || (p.length >= 4 && /[aeiouy]/i.test(p.slice(0, -2))));
/** Termina en sonido consonante: en consonante escrita, o en una e muda (make, like). La ng de talking no pasa a la vocal
 * siguiente como una g. */
const acabaEnConsonante = (p: string) => (/[bcdfgjklmnpqstvxz]$/i.test(p) && !/ng$/i.test(p)) || eMuda(p);
/** Las que acaban en una s que suena z: is it → i‿zit. */
const S_SONORA = new Set(['is', 'his', 'has', 'does', 'as', 'was', 'goes', 'says', 'these', 'those', 'please', 'because']);

/** La consonante que pasa a la palabra siguiente, como se oye, y lo que queda delante: check → che + k, call → ca + l,
 * piece → pie + s. */
function consonanteFinal(escrita: string, muda: boolean, sonora: boolean): [string, string] {
  const base = muda ? escrita.slice(0, -1) : escrita;
  const doble = /(ck|([b-df-hj-np-tv-z])\2)$/i.exec(base);
  let delante = base.slice(0, -(doble?.[0].length ?? 1));
  let c = base.slice(-1).toLowerCase();
  // La c y la g ante una e muda suenan s y j: piece of → pie‿səv, change it → chan‿jit.
  if (muda && c === 'c') c = 's';
  if (muda && c === 'g') c = 'j';
  if (sonora && c === 's') c = 'z';
  if (!delante) delante = base.slice(0, -1);
  return [delante, c];
}
/** Termina en una t que puede sonar suave: tras vocal o r (get, but, start), no tras otra consonante (just, want). */
const acabaEnTSuave = (p: string) => /[aeiour]t$/i.test(p) || /tt$/i.test(p);

interface Palabra {
  texto: string;
  inicio: number;
  fin: number;
}

function palabras(frase: string): Palabra[] {
  return [...frase.matchAll(/[A-Za-z]+(?:['’][A-Za-z]+)*/g)].map((m) => ({ texto: m[0], inicio: m.index!, fin: m.index! + m[0].length }));
}

const normal = (p: string) => p.toLowerCase().replace(/’/g, "'");

/** Une la forma hablada de una reducción con las mayúsculas de lo escrito: Going to → Gonna. */
const conMayuscula = (escrito: string, suena: string) => (/^[A-Z]/.test(escrito) ? suena.replace(/^(['’]?)(\w)/, (_, a, c) => a + c.toUpperCase()) : suena);

export function comoSuena(frase: string): TrozoHablado[] {
  const ps = palabras(frase);
  const marcas: { desde: number; hasta: number; suena: string; fenomeno: Fenomeno }[] = [];
  const usada = new Array(ps.length).fill(false);

  // Las reducciones, de la más larga a la más corta.
  for (const r of REDUCCIONES) {
    const partes = r.de.split(' ');
    for (let i = 0; i + partes.length <= ps.length; i++) {
      if (usada.slice(i, i + partes.length).some(Boolean)) continue;
      if (!partes.every((x, k) => normal(ps[i + k].texto) === x)) continue;
      // Que no haya signos entre medias: «want, to» no se reduce.
      if (/[^\s]/.test(frase.slice(ps[i].fin, ps[i + partes.length - 1].inicio).replace(/[A-Za-z'’\s]/g, ''))) continue;
      const siguiente = ps[i + partes.length];
      if (r.antesDeVerbo && (!siguiente || NO_VERBO.has(normal(siguiente.texto)) || esNombrePropio(siguiente.texto))) continue;
      for (let k = 0; k < partes.length; k++) usada[i + k] = true;
      marcas.push({ desde: ps[i].inicio, hasta: ps[i + partes.length - 1].fin, suena: conMayuscula(ps[i].texto, r.suena), fenomeno: 'reduccion' });
    }
  }

  // Entre dos palabras seguidas: la t o la d con «you», la t suave y la unión de consonante con vocal.
  for (let i = 0; i + 1 < ps.length; i++) {
    if (usada[i] || usada[i + 1]) continue;
    const a = ps[i];
    const b = ps[i + 1];
    if (frase.slice(a.fin, b.inicio) !== ' ') continue;
    // El apóstrofo no se oye: lo que cuenta es cómo acaba al decirla (they're acaba en una e muda; didn't, en t).
    const na = normal(a.texto).replace(/'/g, '');
    const nb = normal(b.texto);
    const escritaA = a.texto.replace(/['’]/g, '');
    if (/[td]$/.test(na) && (nb === 'you' || nb === 'your' || nb === "you're")) {
      const ch = na.endsWith('t') ? 'ch' : 'j';
      marcas.push({ desde: a.inicio, hasta: b.fin, suena: `${escritaA.slice(0, -1)}${ch}${nb === 'you' ? 'u' : 'ur'}`, fenomeno: 'fusion' });
      usada[i] = usada[i + 1] = true;
    } else if (acabaEnTSuave(na) && empiezaPorVocal(nb)) {
      marcas.push({ desde: a.inicio, hasta: b.fin, suena: `${escritaA.replace(/t+$/i, '')}‿d${b.texto}`, fenomeno: 'tSuave' });
      usada[i] = usada[i + 1] = true;
    } else if (acabaEnConsonante(na) && empiezaPorVocal(nb) && !DEBILES[na]) {
      // La e muda no suena: make it → ma‿kit. Y si la segunda es una palabra pequeña, va con su forma débil: cup of → cu‿pəv.
      const [delante, consonante] = consonanteFinal(escritaA, eMuda(na), S_SONORA.has(na));
      const final = !frase.slice(b.fin).trim() || /^[.?!,;:]/.test(frase.slice(b.fin).trim());
      const segunda = !final && DEBILES[nb] ? DEBILES[nb] : b.texto;
      marcas.push({ desde: a.inicio, hasta: b.fin, suena: `${delante}‿${consonante}${segunda}`, fenomeno: 'union' });
      usada[i] = usada[i + 1] = true;
    }
  }

  // Las formas débiles: una palabra pequeña sin acento, que no cierra la frase (al final se dice entera: «Who is it for?»).
  ps.forEach((p, i) => {
    if (usada[i]) return;
    const debil = DEBILES[normal(p.texto)];
    if (!debil) return;
    const resto = frase.slice(p.fin).trim();
    if (!resto || /^[.?!,;:]/.test(resto)) return;
    marcas.push({ desde: p.inicio, hasta: p.fin, suena: debil, fenomeno: 'debil' });
  });

  // La frase entera, en orden, con lo que cambia marcado y lo demás tal cual.
  marcas.sort((x, y) => x.desde - y.desde);
  const salida: TrozoHablado[] = [];
  let pos = 0;
  for (const m of marcas) {
    if (m.desde > pos) salida.push({ texto: frase.slice(pos, m.desde) });
    salida.push({ texto: frase.slice(m.desde, m.hasta), suena: m.suena, fenomeno: m.fenomeno });
    pos = m.hasta;
  }
  if (pos < frase.length) salida.push({ texto: frase.slice(pos) });
  return salida;
}
