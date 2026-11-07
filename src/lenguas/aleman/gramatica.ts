// Detección de puntos gramaticales sin IA, para que funcione al instante y sin conexión. Como en japonés e inglés, es
// deliberadamente conservadora: mejor no marcar que marcar mal. Claude la sustituye cuando revisa la línea.

import { tm } from '../../compartido/i18n';
import { aplicarReglas, type ReglaGramatica } from '../reglasGramatica';
import type { PuntoGramatica } from '../tipos';

// Participios con ge-: los regulares en -t y los fuertes en -en. Los que no llevan ge- (studiert, verstanden) no se ven.
const PP = `ge\\p{L}{2,}(?:t|en)`;
// Los participios que forman el Perfekt con sein: verbos de movimiento y de cambio de estado.
const PP_SEIN = 'gegangen|gekommen|gefahren|geblieben|geworden|gewesen|gelaufen|geflogen|gefallen|gestorben|geschehen|gelungen|gereist|gewachsen|gesprungen|geschwommen|aufgestanden|eingeschlafen|angekommen|passiert';
const HABEN = '(?:habe|hast|hat|haben|habt|hab)';
const SEIN = '(?:bin|bist|ist|sind|seid)';
const HASTA_LA_COMA = `[^.?!,;]*?`;

/**
 * El \b de las expresiones regulares solo conoce las letras del inglés: entre un espacio y la ü de «über» no ve ningún
 * límite. Este sí conoce la ä, la ö, la ü y la ß.
 */
const LIMITE = '(?:(?<![\\p{L}\\p{N}])(?=[\\p{L}\\p{N}])|(?<=[\\p{L}\\p{N}])(?![\\p{L}\\p{N}]))';

const regla = (patron: string, nivel: string, significado: string, re: string): ReglaGramatica => ({ patron, nivel, significado, re: new RegExp(re.replaceAll('\\b', LIMITE), 'iu') });

const REGLAS: ReglaGramatica[] = [
  // A1 y A2
  regla('es gibt', 'A1', tm('Hay: presenta algo que existe'), `\\b(?:es\\s+gibt|gibt\\s+es|gibt's)\\b`),
  regla('möchte', 'A1', tm('Querría: un deseo dicho con cortesía'), `\\bmöchte(?:st|n|t)?\\b`),
  regla('Perfekt con haben', 'A2', tm('Pasado de la conversación: haben y el participio al final'), `\\b${HABEN}\\b${HASTA_LA_COMA}\\b${PP}\\b`),
  regla('Perfekt con sein', 'A2', tm('Pasado con verbos de movimiento o cambio: sein y el participio'), `\\b${SEIN}\\b${HASTA_LA_COMA}\\b(?:${PP_SEIN})\\b`),
  regla('Präteritum de sein y haben', 'A2', tm('Pasado de sein y haben, también en la conversación'), `\\b(?:war|warst|waren|wart|hatte|hattest|hatten|hattet)\\b`),
  regla('verbo modal', 'A2', tm('Poder, deber, querer…: el otro verbo va al final en infinitivo'), `\\b(?:kann|kannst|können|könnt|muss|musst|müssen|müsst|darf|darfst|dürfen|dürft|soll|sollst|sollen|sollt|will|willst|wollen|wollt)\\b${HASTA_LA_COMA}\\b\\p{L}+en\\b`),
  regla('comparativo + als', 'A2', tm('Comparación: más… que'), `\\b\\p{L}+er\\s+als\\b`),

  // B1
  regla('subordinada', 'B1', tm('Oración subordinada: el verbo conjugado va al final'), `\\b(?:weil|dass|ob|obwohl|damit|bevor|nachdem|sobald|seitdem|bis)\\b`),
  regla('Konjunktiv II', 'B1', tm('Lo hipotético o la cortesía: würde, hätte, wäre'), `\\b(?:würde|würdest|würden|würdet|hätte|hättest|hätten|hättet|wäre|wärst|wären|wärt|könnte|könntest|könnten|könntet|müsste|müssten|sollte|solltest|sollten|dürfte|dürften)\\b`),
  regla('voz pasiva', 'B1', tm('El sujeto recibe la acción: werden y el participio'), `\\b(?:wird|werden|wurde|wurden|worden)\\b${HASTA_LA_COMA}\\b${PP}\\b`),
  regla('Plusquamperfekt', 'B1', tm('Algo anterior a otro momento del pasado'), `\\b(?:hatte|hattest|hatten|hattet)\\b${HASTA_LA_COMA}\\b${PP}\\b`),
  regla('oración de relativo', 'B1', tm('Describe un sustantivo: el verbo va al final'), `,\\s*(?:der|die|das|dem|den|deren|dessen|denen)\\s+\\p{L}`),
  regla('um … zu', 'B1', tm('Para: indica la finalidad'), `\\bum\\b[^.?!;]*?\\bzu\\s+\\p{L}+en\\b`),
  regla('zu + infinitivo', 'B1', tm('Infinitivo con zu, tras otro verbo o un adjetivo'), `\\bzu\\s+\\p{L}{2,}en\\s*(?:[.,!?;]|$)`),
  regla('entweder … oder', 'B1', tm('O… o: una de dos'), `\\bentweder\\b[^.?!]*?\\boder\\b`),
  regla('wenn', 'B1', tm('Si o cuando: condición o momento que se repite'), `\\bwenn\\b`),

  // B2 y C1
  regla('Konjunktiv I', 'B2', tm('Discurso indirecto: lo que otro dijo'), `\\b(?:er|sie|es|man)\\s+(?:sei|habe|werde|könne|müsse|solle|wolle|dürfe)\\b`),
  regla('je … desto', 'B2', tm('Cuanto más… más'), `\\bje\\b[^.?!]*?\\b(?:desto|umso)\\b`),
  regla('nicht nur … sondern auch', 'B2', tm('No solo… sino también'), `\\bnicht\\s+nur\\b[^.?!]*?\\bsondern\\b`),
  regla('sowohl … als auch', 'B2', tm('Tanto… como'), `\\bsowohl\\b[^.?!]*?\\bals\\s+auch\\b`),
  regla('weder … noch', 'B2', tm('Ni… ni'), `\\bweder\\b[^.?!]*?\\bnoch\\b`),
  regla('als ob', 'B2', tm('Como si'), `\\bals\\s+(?:ob|wenn)\\b`),
  regla('lassen + infinitivo', 'B2', tm('Hacer que otro haga algo, o dejar que lo haga'), `\\b(?:lasse|lässt|lassen|lasst|ließ|ließen)\\b${HASTA_LA_COMA}\\b\\p{L}+en\\b`),
  regla('Futur II', 'C1', tm('Lo que ya habrá pasado, o una suposición sobre el pasado'), `\\b(?:werde|wirst|wird|werden|werdet)\\b${HASTA_LA_COMA}\\b${PP}\\s+(?:haben|sein)\\b`),
];

export const detectarGramatica = (texto: string): PuntoGramatica[] => aplicarReglas(REGLAS, texto.replace(/[’ʼ]/g, "'"));
