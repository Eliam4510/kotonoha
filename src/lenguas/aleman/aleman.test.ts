// El paquete del alemán. Las formas y los términos son de wty-de-en, tal como vienen: lo que importa es cómo sale cada
// frase con datos de verdad, no cada función por separado.

import { describe, expect, it } from 'vitest';
import { fuentesRecomendadas } from '../../nucleo/diccionariosRecomendados';
import { partirTexto, segmentosALineas } from '../../nucleo/transcripcion';
import { leerBancoFormas } from '../../nucleo/yomitan';
import type { ConsultasAnalisis, FormaFlexionada } from '../tipos';
import { ANALIZADOR, candidatosCompuestos, describirPalabra } from './analizador';
import { FUENTES } from './diccionarios';
import { contarEscrituras, esTextoAleman, paginaEnAleman, pareceFrase, SIGNOS_FRASE } from './escritura';
import { detectarGramatica } from './gramatica';
import { recortarGlosa } from './motor';
import { codigoAcento, elegirTranscripciones } from './pronunciacion';
import { colasDe, nombreFlexion, pegarSignos } from './tokens';
import { REGLAS_TRANSCRIPCION } from './transcripcion';

const TERMINOS = new Set([
  'gehen', 'Haus', 'schön', 'schönen', 'anfangen', 'fangen', 'bekannt', 'bekennen', 'der', 'die', 'das', 'ich', 'er', 'heute', 'Kind', 'essen',
  'Essen', 'morgen', 'Morgen', 'nach', 'ist', 'sein', 'hallo', 'Welt', 'zum', 'Beispiel', 'zum Beispiel', 'auf', 'jeden', 'Fall', 'auf jeden Fall',
]);
const forma = (lema: string, flexion: string, pos = 'v'): FormaFlexionada => ({ lema, flexion, pos });
const FORMAS = new Map<string, FormaFlexionada[]>([
  ['ging', [forma('gehen', 'first/third-person singular indicative preterite')]],
  ['gegangen', [forma('gehen', 'past participle')]],
  ['gehe', [forma('gehen', 'first-person singular present')]],
  ['Häuser', [forma('Haus', 'nominative/accusative/genitive plural', 'n')]],
  ['Hause', [forma('Haus', 'dative singular', 'n')]],
  ['schönen', [forma('schön', 'accusative singular masculine strong/weak/mixed', 'adj')]],
  ['schöner', [forma('schön', 'comparative degree', 'adj')]],
  ['fängt', [forma('fangen', 'third-person singular present indicative')]],
  ['Kinder', [forma('Kind', 'nominative/accusative/genitive plural', 'n')]],
  ['bekannt', [forma('bekennen', 'past participle')]],
  ['ist', [forma('sein', 'third-person singular present')]],
]);
const RANGOS = new Map([['schön', 300], ['schönen', 2500], ['bekannt', 900], ['bekennen', 20000], ['gehen', 150], ['fangen', 5000], ['das', 3], ['heute', 80]]);
const existe = (x: string) => TERMINOS.has(x);
const consultas: ConsultasAnalisis = { formas: (p) => FORMAS.get(p), rango: (t) => RANGOS.get(t) };

const analizar = (t: string) => ANALIZADOR.analizar(t, existe, consultas);
const palabras = (t: string) => analizar(t).filter((x) => x.esPalabra);
const lemas = (t: string) => palabras(t).map((x) => x.lema);
const de = (t: string, superficie: string) => palabras(t).find((x) => x.superficie === superficie);

describe('forma de diccionario', () => {
  it('sale de las formas que trae el diccionario', () => {
    expect(lemas('Ich ging nach Hause.')).toEqual(['ich', 'gehen', 'nach', 'Haus']);
    expect(lemas('Die Kinder sind gegangen.')).toEqual(['der', 'Kind', 'sein', 'gehen']);
  });

  it('entre dos palabras posibles, gana la más frecuente', () => {
    // schönen es también un verbo (maquillar unos datos), pero casi siempre es el adjetivo.
    expect(de('die schönen Häuser', 'schönen')?.lema).toBe('schön');
    // Y bekannt es el participio de bekennen, pero casi siempre es el adjetivo.
    expect(de('Er ist bekannt.', 'bekannt')?.lema).toBe('bekannt');
  });

  it('los artículos y las formas de sein, como en los lematizadores del alemán', () => {
    expect(lemas('Die Männer waren einen Tag da.')).toEqual(['der', 'Männer', 'sein', 'ein', 'Tag', 'da']);
    expect(de('Das war schön.', 'war')?.lema).toBe('sein');
  });

  it('al principio de la frase, la mayúscula no hace un sustantivo', () => {
    expect(lemas('Heute gehe ich. Das ist schön.')).toEqual(['heute', 'gehen', 'ich', 'der', 'sein', 'schön']);
    // Si existen las dos, la minúscula: «Morgen essen wir» es mañana, no la mañana.
    expect(de('Morgen essen wir.', 'Morgen')?.lema).toBe('morgen');
  });

  it('en medio de la frase sí: Essen es la comida y essen, el verbo', () => {
    expect(de('Wir mögen das Essen.', 'Essen')?.lema).toBe('Essen');
    expect(de('Wir essen heute.', 'essen')?.lema).toBe('essen');
    expect(de('Wir mögen das Essen.', 'Essen')?.categoria).toBe('NOUN');
  });

  it('en mayúsculas encuentra la palabra igual', () => {
    expect(lemas('HALLO WELT')).toEqual(['hallo', 'Welt']);
  });

  it('una palabra que no está en los diccionarios es su propia forma', () => {
    expect(de('Das Bundesverfassungsgericht entschied.', 'Bundesverfassungsgericht')?.lema).toBe('Bundesverfassungsgericht');
  });

  it('dice qué forma es, en el idioma de la interfaz', () => {
    expect(de('Ich ging.', 'ging')?.flexion).toEqual(['Präteritum']);
    expect(de('Sie sind gegangen.', 'gegangen')?.flexion).toEqual(['Partizip II']);
    expect(de('Die Häuser.', 'Häuser')?.flexion).toEqual(['Plural']);
    expect(de('Sie ist schöner.', 'schöner')?.flexion).toEqual(['Komparativ']);
    expect(nombreFlexion('Präteritum')).toBe('pretérito');
    expect(colasDe('first/third-person singular subjunctive II')).toEqual(['Konjunktiv II']);
    expect(colasDe('dative plural')).toEqual(['Plural', 'Dativ']);
  });

  it('los artículos, pronombres y preposiciones son gramaticales', () => {
    const t = palabras('Ich gehe mit dem Kind in das Haus.');
    expect(t.filter((x) => x.esGramatica).map((x) => x.superficie)).toEqual(['Ich', 'mit', 'dem', 'in', 'das']);
  });

  it('a Claude se le enseña de dónde sale cada forma', () => {
    expect(palabras('Ich ging.').map(describirPalabra)).toEqual(['Ich', 'ging(gehen)']);
  });
});

describe('palabras y lo que hay entre ellas', () => {
  it('las superficies juntas dan el texto tal cual', () => {
    for (const t of ["„Gibt's das?“, fragte er.", 'Schreib mir eine E-Mail!', 'Am 3. Mai, um 18:30 Uhr…', '  zwei  Leerzeichen ', 'Straße – Größe']) {
      expect(analizar(t).map((x) => x.superficie).join('')).toBe(t);
    }
  });

  it('gibt\'s y E-Mail son una sola palabra', () => {
    expect(palabras('Gibt\'s eine E-Mail?').map((x) => x.superficie)).toEqual(["Gibt's", 'eine', 'E-Mail']);
  });

  it('las comillas alemanas no quedan sueltas al cortar la línea', () => {
    expect(pegarSignos('„')).toBe('„⁠');
    expect(pegarSignos('“, ')).toBe('⁠“, ');
  });
});

describe('verbos separables y frases hechas', () => {
  const sup = (t: string) => analizar(t).map((x) => x.superficie);

  it('une la partícula del final con el verbo', () => {
    expect(candidatosCompuestos(sup('fängt morgen an.'), existe, consultas)).toContain('anfangen');
    expect(candidatosCompuestos(sup('fängt mit der Arbeit an'), existe, consultas)).toContain('anfangen');
  });

  it('solo dentro de la misma oración', () => {
    expect(candidatosCompuestos(sup('fängt Fische, und dann gehen wir an'), existe, consultas)).not.toContain('anfangen');
  });

  it('y prueba lo que viene detrás tal cual, de lo más largo a lo más corto', () => {
    const c = candidatosCompuestos(sup('auf jeden Fall'), existe, consultas);
    expect(c.indexOf('auf jeden Fall')).toBeLessThan(c.indexOf('auf jeden'));
  });
});

describe('reconocer el alemán', () => {
  it('una frase alemana lo parece, una inglesa o española no', () => {
    expect(esTextoAleman('Ich habe heute keine Zeit, aber morgen gerne.', undefined, false)).toBe(true);
    expect(esTextoAleman('I have no time today, but tomorrow is fine.', undefined, false)).toBe(false);
    expect(esTextoAleman('Hoy no tengo tiempo, pero mañana es mal día.', undefined, false)).toBe(false);
  });

  it('con la página declarada en alemán basta con que tenga letras', () => {
    expect(esTextoAleman('Startseite', 'de-DE', false)).toBe(true);
    expect(esTextoAleman('Startseite', 'en', false)).toBe(false);
  });

  it('una página con unas pocas palabras alemanas no está en alemán', () => {
    expect(paginaEnAleman(contarEscrituras('The word Fernweh has no English equivalent, and neither has gemütlich.'))).toBe(false);
    const texto = 'Die Stadt liegt an einem Fluss und ist für ihre alten Brücken bekannt. Im Sommer kommen viele Besucher, die sich die Altstadt ansehen wollen.';
    expect(paginaEnAleman(contarEscrituras(texto))).toBe(true);
  });

  it('una frase se corta tras el punto, pero no tras un ordinal ni una abreviatura', () => {
    const t = 'Am 3. Mai ging ich z. B. nach Hause. Dann kam er.';
    expect(t.split(SIGNOS_FRASE.partir)).toEqual(['Am 3. Mai ging ich z. B. nach Hause. ', 'Dann kam er.']);
    expect(pareceFrase('gehen')).toBe(false);
    expect(pareceFrase('Ich gehe nach Hause')).toBe(true);
  });
});

describe('pronunciación', () => {
  it('elige la del singular, no la del plural', () => {
    expect(elegirTranscripciones([{ ipa: '[haʊ̯s]', tags: ['Sing'] }, { ipa: '[ˈhɔʏ̯zɐ]', tags: ['pl'] }])).toEqual([{ zona: 'de', ipa: '/haʊs/' }]);
  });

  it('vale la que sirve para el singular y el plural, y descarta las regionales', () => {
    expect(elegirTranscripciones([{ ipa: '[ˈmɛːtçən]', tags: ['IPA', 'Sing', 'pl'] }])).toEqual([{ zona: 'de', ipa: '/ˈmɛːtçən/' }]);
    expect(elegirTranscripciones([{ ipa: '[ʃøːn]', tags: ['🇦🇹'] }, { ipa: '/ˈʃøːn/', tags: [] }])).toEqual([{ zona: 'de', ipa: '/ʃøːn/' }]);
  });

  it('sin el golpe de glotis ni las notaciones raras', () => {
    expect(elegirTranscripciones([{ ipa: '/"IC/', tags: ['XS'] }, { ipa: '[ʔɪç]', tags: [] }])).toEqual([{ zona: 'de', ipa: '/ɪç/' }]);
  });

  it('dice dónde cae el acento', () => {
    expect(codigoAcento('/ˈɡeːən/')).toBe(1);
    expect(codigoAcento('/fɛɐ̯ˈʃteːən/')).toBe(2);
    expect(codigoAcento('/hoˈtɛl/')).toBe(3);
    expect(codigoAcento('/haʊs/')).toBe(0);
  });
});

describe('diccionarios', () => {
  it('lee las formas tal como vienen en wty', () => {
    const formas = leerBancoFormas([
      ['ging', '', 'non-lemma', 'v', 0, [['gehen', ['first/third-person singular indicative preterite']], ['gehen', ['past']]], 0, ''],
      ['gehen', '', 'non-lemma', 'v', 0, [['gehen', ['first/third-person plural present']]], 0, ''],
      ['Haus', '', 'n neut', 'n', 0, [{ type: 'structured-content', content: 'house' }], 0, ''],
    ]);
    expect([...formas.values()]).toEqual([{ forma: 'ging', lemas: [{ lema: 'gehen', flexion: 'first/third-person singular indicative preterite', pos: 'v' }] }]);
  });

  it('a quien habla español le propone las del español, la del inglés por las formas, la pronunciación y la frecuencia', () => {
    expect(fuentesRecomendadas(FUENTES, 'es').map((f) => f.id)).toEqual(['wty-de-es', 'wty-de-es-gloss', 'wty-de-en', 'wty-de-ipa', 'frecuencia-subtitulos-de']);
  });

  it('la traducción bajo la palabra es la primera', () => {
    expect(recortarGlosa('to go, to walk')).toBe('to go');
    expect(recortarGlosa('(intransitive) to go; to walk')).toBe('to go');
  });
});

describe('gramática sin IA', () => {
  const patrones = (t: string) => detectarGramatica(t).map((p) => p.patron);

  it('reconoce los tiempos compuestos', () => {
    expect(patrones('Ich habe das Buch gelesen.')).toContain('Perfekt con haben');
    expect(patrones('Wir sind nach Berlin gefahren.')).toContain('Perfekt con sein');
    expect(patrones('Das Haus wurde 1900 gebaut.')).toContain('voz pasiva');
  });

  it('con las palabras que llevan ä, ö, ü o ß', () => {
    expect(patrones('Ich würde gern kommen.')).toContain('Konjunktiv II');
    expect(patrones('Er ließ das Auto reparieren.')).toContain('lassen + infinitivo');
    expect(patrones('Ich möchte einen Kaffee.')).toContain('möchte');
  });

  it('las subordinadas y las correlativas', () => {
    expect(patrones('Ich bleibe zu Hause, weil es regnet.')).toContain('subordinada');
    expect(patrones('Je mehr ich lerne, desto mehr weiß ich.')).toContain('je … desto');
  });

  it('no ve lo que no hay', () => {
    expect(patrones('Der Hund schläft.')).toEqual([]);
  });
});

describe('líneas de subtítulo', () => {
  it('una frase larga sin puntuación se corta antes de una conjunción, en líneas parecidas', () => {
    const t = 'ich bin heute sehr früh aufgestanden weil ich den ersten Zug nach Berlin nehmen wollte';
    const lineas = partirTexto(t, REGLAS_TRANSCRIPCION);
    expect(lineas.join(' ')).toBe(t);
    expect(lineas.every((l) => l.length <= REGLAS_TRANSCRIPCION.maximoCaracteres)).toBe(true);
    expect(lineas[1]?.startsWith('weil')).toBe(true);
  });

  it('una palabra que Whisper parte entre dos segmentos vuelve a juntarse', () => {
    const segmentos = [
      { texto: ' und quer über da', inicio: 0, fin: 2 },
      { texto: 's Zimmer ging hinter dem Ofen', inicio: 2, fin: 4.5 },
    ];
    expect(segmentosALineas(segmentos, [], 10, 1, REGLAS_TRANSCRIPCION).map((l) => l.texto)).toEqual(['und quer über das', 'Zimmer ging hinter dem Ofen']);
  });

  it('pero no si el segundo empieza con espacio, o hay una pausa entre los dos', () => {
    const conEspacio = [
      { texto: ' er sagte ja', inicio: 0, fin: 1 },
      { texto: ' gut so', inicio: 1, fin: 2 },
    ];
    expect(segmentosALineas(conEspacio, [], 10, 1, REGLAS_TRANSCRIPCION).map((l) => l.texto)).toEqual(['er sagte ja', 'gut so']);
    const conPausa = [
      { texto: ' er sagte ja', inicio: 0, fin: 1 },
      { texto: 'gut so', inicio: 2, fin: 3 },
    ];
    expect(segmentosALineas(conPausa, [], 10, 1, REGLAS_TRANSCRIPCION).map((l) => l.texto)).toEqual(['er sagte ja', 'gut so']);
  });

  it('descarta lo que Whisper se inventa en el silencio', () => {
    const inventada = (t: string) => REGLAS_TRANSCRIPCION.alucinaciones.some((r) => r.test(t));
    expect(inventada('Untertitel im Auftrag des ZDF, 2021')).toBe(true);
    expect(inventada('Vielen Dank fürs Zuschauen!')).toBe(true);
    expect(inventada('Ich gehe nach Hause.')).toBe(false);
  });
});
