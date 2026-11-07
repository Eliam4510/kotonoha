// Detección de puntos gramaticales sin IA, para que funcione al instante y sin conexión. Como en japonés, es
// deliberadamente conservadora: mejor no marcar que marcar mal. Claude la sustituye cuando revisa la línea.

import { tm } from '../../compartido/i18n';
import { aplicarReglas, type ReglaGramatica } from '../reglasGramatica';
import type { PuntoGramatica } from '../tipos';

// Participios: los regulares en -ed y los irregulares más frecuentes. No se puede saber sin más que una palabra en -ed lo es.
const IRREGULARES = 'been|done|gone|seen|taken|given|known|made|said|gotten|got|had|come|become|written|eaten|broken|spoken|chosen|driven|fallen|forgotten|left|lost|found|thought|told|heard|kept|met|paid|put|read|run|sent|set|sold|spent|stood|understood|won|begun|drunk|flown|grown|hidden|ridden|risen|shown|sung|stolen|swum|thrown|worn|woken|bought|brought|caught|taught|felt|held|built|cut|hit|hurt|let|meant';
const PP = `(?:\\w+ed|${IRREGULARES})`;
const SER = `(?:am|is|are|was|were|'m|'re|'s)`;

const regla = (patron: string, nivel: string, significado: string, re: string): ReglaGramatica => ({ patron, nivel, significado, re: new RegExp(re, 'i') });

const REGLAS: ReglaGramatica[] = [
  // A1 y A2
  regla('there is / there are', 'A1', tm('Hay: presenta algo que existe'), `\\bthere\\s+(?:is|are|was|were|'s|'re)\\b`),
  regla("let's", 'A1', tm('Propone hacer algo juntos'), `\\blet's\\s+\\w+`),
  regla('be going to', 'A2', tm('Intención o futuro inmediato'), `\\b${SER}\\s+going\\s+to\\s+\\w+`),
  regla('gonna', 'A2', tm('Forma coloquial de going to'), `\\bgonna\\b`),
  regla('wanna', 'A2', tm('Forma coloquial de want to'), `\\bwanna\\b`),
  regla('gotta', 'A2', tm('Forma coloquial de have got to: tener que'), `\\bgotta\\b`),
  regla('have to', 'A2', tm('Obligación: tener que'), `\\b(?:have|has|had)\\s+to\\s+\\w+`),
  regla('should', 'A2', tm('Consejo: debería'), `\\bshould\\s+(?:not\\s+)?(?!have\\b)\\w+`),
  regla('be able to', 'A2', tm('Capacidad: poder'), `\\b(?:be|am|is|are|was|were|been|will\\s+be)\\s+able\\s+to\\b`),
  regla('would like', 'A2', tm('Deseo dicho con cortesía'), `\\b(?:would|'d)\\s+like\\s+to\\b`),
  regla('was / were + -ing', 'A2', tm('Acción en curso en el pasado'), `\\b(?:was|were)\\s+(?:not\\s+)?\\w+ing\\b`),
  regla('used to', 'A2', tm('Hábito del pasado que ya no se da'), `(?<!(?:\\b(?:be|am|is|are|was|were|get|got|getting)|'m|'re|'s)\\s)\\bused\\s+to\\s+\\w+`),
  regla('comparativo + than', 'A2', tm('Comparación: más… que'), `\\b(?:more\\s+\\w+|\\w+er)\\s+than\\b`),
  regla('the + superlativo', 'A2', tm('Superlativo: el más…'), `\\bthe\\s+(?:most\\s+\\w+|best|worst|\\w{3,}est)\\b`),
  regla('too … to', 'A2', tm('Demasiado… para'), `\\btoo\\s+\\w+\\s+to\\s+\\w+`),

  // B1
  regla('present perfect', 'B1', tm('Pasado que sigue teniendo que ver con el presente'), `\\b(?:have|has|'ve)\\s+(?:(?:already|just|never|ever|not|always|recently)\\s+)*(?!been\\s+\\w+ing)${PP}\\b`),
  regla('present perfect continuous', 'B1', tm('Algo que empezó antes y sigue hasta ahora'), `\\b(?:have|has|'ve|'s)\\s+been\\s+\\w+ing\\b`),
  regla('past perfect', 'B1', tm('Algo anterior a otro momento del pasado'), `\\bhad\\s+(?:(?:already|just|never|ever|not)\\s+)*${PP}\\b`),
  regla('voz pasiva', 'B1', tm('El sujeto recibe la acción'), `\\b(?:is|are|was|were|been|being)\\s+(?:(?:not|being)\\s+)*(?:called|named|built|made|used|based|known|born|killed|forced|asked|told|given|taken|seen|found|written|sold|sent)\\b`),
  regla('if + will', 'B1', tm('Condición real: si pasa, pasará'), `\\bif\\b[^.?!]*?\\b(?:will|'ll)\\b`),
  regla('if + would', 'B1', tm('Condición imaginaria: si pasara, pasaría'), `\\bif\\b[^.?!]*?\\b(?:would|'d)\\s+(?!have\\b)\\w+`),
  regla('be used to', 'B1', tm('Estar acostumbrado a'), `\\b(?:be|am|is|are|was|were|'m|'re|'s|get|got|getting)\\s+used\\s+to\\b`),
  regla('be supposed to', 'B1', tm('Lo que se espera o se acordó'), `\\b${SER}\\s+supposed\\s+to\\b`),
  regla('be about to', 'B1', tm('Estar a punto de'), `\\b${SER}\\s+about\\s+to\\s+\\w+`),
  regla('had better', 'B1', tm('Más vale que: consejo con advertencia'), `\\b(?:had|'d)\\s+better\\b`),
  regla('would rather', 'B1', tm('Preferencia: preferiría'), `\\b(?:would|'d)\\s+rather\\b`),
  regla('as … as', 'B1', tm('Comparación de igualdad: tan… como'), `\\bas\\s+\\w+\\s+as\\b`),
  regla('so … that', 'B1', tm('Tan… que: indica la consecuencia'), `\\bso\\s+\\w+\\s+(?:that)\\b`),
  regla('such a', 'B1', tm('Tan… enfatiza un sustantivo'), `\\bsuch\\s+(?:a|an)\\s+\\w+`),
  regla('enough to', 'B1', tm('Lo bastante… para'), `\\b\\w+\\s+enough\\s+to\\s+\\w+`),
  regla('in order to', 'B1', tm('Para: indica la finalidad'), `\\bin\\s+order\\s+to\\b`),
  regla('unless', 'B1', tm('A menos que'), `\\bunless\\b`),
  regla('even though', 'B1', tm('Aunque: contraste fuerte'), `\\b(?:even\\s+though|although)\\b`),
  regla('either … or', 'B1', tm('O… o: una de dos'), `\\b(?:either\\b.*?\\bor|neither\\b.*?\\bnor)\\b`),
  regla('will be + -ing', 'B1', tm('Acción en curso en un momento futuro'), `\\b(?:will|'ll)\\s+be\\s+\\w+ing\\b`),
  regla('coletilla', 'B1', tm('Pregunta de confirmación al final de la frase'), `,\\s*(?:is|are|was|were|do|does|did|will|can|would|could|should|have|has|had)(?:n't)?\\s+(?:it|he|she|they|you|we|I|there)\\s*\\?`),
  regla("ain't", 'B1', tm('Negación coloquial de be o have'), `\\bain't\\b`),
  regla('get + participio', 'B1', tm('Cambio de estado: acabar… o pasiva coloquial'), `\\b(?:get|gets|getting|got)\\s+(?:married|lost|hurt|fired|paid|tired|done|caught|stuck|killed|dressed|started)\\b`),

  // B2 y C1
  regla('modal + have + participio', 'B2', tm('Lo que pudo o debió pasar y no se sabe o no pasó'), `\\b(?:should|could|would|might|must|may)(?:n't)?\\s+(?:not\\s+)?have\\s+${PP}\\b`),
  regla('if + had + participio', 'B2', tm('Condición imposible: si hubiera pasado'), `\\bif\\b[^.?!]*?\\bhad\\s+${PP}\\b`),
  regla('will have + participio', 'B2', tm('Lo que ya habrá pasado en un momento futuro'), `\\b(?:will|'ll)\\s+have\\s+${PP}\\b`),
  regla('wish', 'B2', tm('Deseo sobre algo que no es así'), `\\bwish(?:es|ed)?\\s+(?:I|you|he|she|we|they|it)\\s+\\w+`),
  regla('have + algo + participio', 'B2', tm('Encargar que otro lo haga'), `\\b(?:have|has|had|get|got)\\s+(?:my|your|his|her|our|their)\\s+\\w+\\s+${PP}\\b`),
  regla('be likely to', 'B2', tm('Probabilidad: es probable que'), `\\b${SER}\\s+(?:un)?likely\\s+to\\b`),
  regla('as if', 'B2', tm('Como si'), `\\bas\\s+(?:if|though)\\b`),
  regla('no matter', 'B2', tm('No importa…: por mucho que'), `\\bno\\s+matter\\s+(?:what|how|who|where|when|if)\\b`),
  regla('despite', 'B2', tm('A pesar de'), `\\b(?:despite|in\\s+spite\\s+of)\\b`),
  regla('not only … but', 'B2', tm('No solo… sino también'), `\\bnot\\s+only\\b.*?\\bbut\\b`),
  regla('inversión', 'C1', tm('Orden invertido tras una negación, para enfatizar'), `\\b(?:never|rarely|seldom|hardly|little)\\s+(?:have|has|had|did|do|does|was|were)\\s+\\w+\\s+\\w+`),
  regla('it is … that', 'C1', tm('Frase partida para destacar una parte'), `\\bit\\s+(?:is|was)\\s+\\w+\\s+(?:who|that)\\b`),
  regla('be bound to', 'C1', tm('Certeza: seguro que'), `\\b${SER}\\s+bound\\s+to\\b`),
];

export const detectarGramatica = (texto: string): PuntoGramatica[] => aplicarReglas(REGLAS, texto.replace(/[’ʼ]/g, "'"));
