// El paquete del inglés, con el analizador de verdad: lo que importa es cómo sale cada frase, no cada función por separado.

import winkNLP from 'wink-nlp';
import modelo from 'wink-eng-lite-web-model';
import { beforeAll, describe, expect, it } from 'vitest';
import { fuentesRecomendadas } from '../../nucleo/diccionariosRecomendados';
import { partirTexto, segmentosALineas } from '../../nucleo/transcripcion';
import { leerBancoMeta, leerBancoTerminos } from '../../nucleo/yomitan';
import { ANALIZADOR, candidatosCompuestos, describirPalabra, fijarWink, type MotorWink } from './analizador';
import { contarEscrituras, esTextoIngles, paginaEnIngles, pareceFrase, SIGNOS_FRASE } from './escritura';
import { FUENTES, SECCIONES_OMITIDAS } from './diccionarios';
import { detectarGramatica } from './gramatica';
import { prepararFrecuencias, recortarGlosa } from './motor';
import { codigoAcento, dePronunciacion, elegirTranscripciones, filaPronunciacion, lecturaVisible, patronAcento } from './pronunciacion';
import { nombreFlexion, normalizarParaAnalisis, pegarSignos } from './tokens';
import { REGLAS_TRANSCRIPCION } from './transcripcion';

const leerBanco = (filas: unknown[][]) => leerBancoTerminos(filas, SECCIONES_OMITIDAS);
const analizar = (t: string, existe?: (x: string) => boolean) => ANALIZADOR.analizar(t, existe);
const palabras = (t: string, existe?: (x: string) => boolean) => analizar(t, existe).filter((x) => x.esPalabra);
const lemas = (t: string, existe?: (x: string) => boolean) => palabras(t, existe).map((x) => x.lema);
const de = (t: string, superficie: string) => palabras(t).find((x) => x.superficie === superficie);

beforeAll(() => {
  fijarWink(winkNLP(modelo) as unknown as MotorWink);
});

describe('forma de diccionario', () => {
  it('saca la de los irregulares', () => {
    expect(lemas('He went home and ate the mice.')).toEqual(['he', 'go', 'home', 'and', 'eat', 'the', 'mouse']);
    expect(de('The children were here.', 'children')?.lema).toBe('child');
    expect(de('The bigger they are.', 'bigger')?.lema).toBe('big');
    expect(de('It is the worst thing.', 'worst')?.lema).toBe('bad');
  });

  it('distingue por el sentido de la frase', () => {
    const sierra = palabras('He saw a saw on the table.');
    expect(sierra[1].lema).toBe('see');
    expect(sierra[3].lema).toBe('saw');
    const edificio = palabras('We were building a new building downtown.');
    expect(edificio[2].lema).toBe('build');
    expect(edificio[5].lema).toBe('building');
  });

  it('la clave de una palabra es la misma en todas sus formas', () => {
    expect(de('She runs fast.', 'runs')?.lema).toBe(de('She is running.', 'running')?.lema);
    expect(de('She ran fast.', 'ran')?.lema).toBe('run');
    // Una mayúscula al empezar la frase no hace otra palabra.
    expect(de('The cat.', 'The')?.lema).toBe('the');
  });

  it('el pronombre I siempre va en mayúscula', () => {
    expect(de('I am here.', 'I')?.lema).toBe('I');
    expect(de("I'm here.", "I'm")?.lema).toBe('I');
  });
});

describe('palabras y lo que hay entre ellas', () => {
  it('las superficies juntas dan el texto, con sus espacios y signos', () => {
    for (const t of [
      "It's the worst thing that's ever happened, isn't it?",
      'He said: "Don\'t go!"  Then   left.',
      'Line one\nLine two',
      '  empieza con espacios y acaba con ellos  ',
      'Tom’s dog can’t swim — really?',
      'Call 555-1234 at 3:30 p.m. or see https://example.com/a?b=1.',
      'ALL CAPS SUBTITLE, IT DOES HAPPEN',
      '日本語 mixed with English',
      '',
    ]) {
      expect(analizar(t).map((x) => x.superficie).join('')).toBe(t);
    }
  });

  it('las contracciones son una sola palabra', () => {
    const t = palabras("I don't know, she's gone and they won't come; can't you?");
    expect(t.map((x) => x.superficie)).toEqual(['I', "don't", 'know', "she's", 'gone', 'and', 'they', "won't", 'come', "can't", 'you']);
    expect(t[1].lema).toBe('do');
    expect(t[1].flexion).toContain("n't");
    expect(t[3].lema).toBe('she');
    expect(t[7].lema).toBe('will');
    expect(t[7].flexion).toEqual(["n't"]);
    expect(t[9].lema).toBe('can');
  });

  it('también con el apóstrofo tipográfico, sin cambiar lo que se ve', () => {
    const t = palabras('She can’t go');
    expect(t[1].superficie).toBe('can’t');
    expect(t[1].lema).toBe('can');
  });

  it('el posesivo se queda con su nombre', () => {
    const t = palabras("John's dog and the children's toys");
    expect(t[0].superficie).toBe("John's");
    expect(t[0].lema).toBe('John');
    expect(t.find((x) => x.superficie === "children's")?.lema).toBe('child');
  });

  it('los números, las direcciones y lo que no es inglés no son palabras', () => {
    expect(palabras('Room 42 costs $50').map((x) => x.superficie)).toEqual(['Room', 'costs']);
    expect(palabras('see https://example.com now').map((x) => x.superficie)).toEqual(['see', 'now']);
    expect(palabras('日本語 here').map((x) => x.superficie)).toEqual(['here']);
  });

  it('un subtítulo en mayúsculas se analiza como si no lo estuviera', () => {
    const t = palabras('HE WENT HOME');
    expect(t.map((x) => x.superficie)).toEqual(['HE', 'WENT', 'HOME']);
    expect(t[1].lema).toBe('go');
    expect(normalizarParaAnalisis('HELLO WORLD')).toBe('hello world');
    expect(normalizarParaAnalisis('Hello NASA')).toBe('Hello NASA');
    expect(normalizarParaAnalisis('A')).toBe('A');
  });

  it('las palabras gramaticales y los nombres se distinguen del vocabulario', () => {
    const t = palabras('The cat sat with John in Paris.');
    const gramatica = t.filter((x) => x.esGramatica).map((x) => x.superficie);
    expect(gramatica).toContain('The');
    expect(gramatica).toContain('with');
    expect(gramatica).toContain('John');
    expect(gramatica).toContain('Paris');
    expect(gramatica).not.toContain('cat');
    expect(gramatica).not.toContain('sat');
  });

  it('con diccionario, las palabras con guion que recoge son una sola', () => {
    const existe = (x: string) => x === 'well-known';
    const t = palabras('A well-known actor and a red-hot one.', existe);
    expect(t.map((x) => x.superficie)).toContain('well-known');
    expect(t.map((x) => x.superficie)).toContain('red');
    expect(analizar('A well-known actor.', existe).map((x) => x.superficie).join('')).toBe('A well-known actor.');
  });

  it('el diccionario corrige una palabra corriente que parecía un nombre', () => {
    const existe = (x: string) => x === 'bank';
    const t = analizar('Bank', existe).find((x) => x.esPalabra);
    expect(t?.lema).toBe('bank');
  });

  it('dice qué le pasó a cada palabra', () => {
    expect(de('She is running.', 'running')?.flexion).toEqual(['-ing']);
    expect(de('She walked.', 'walked')?.flexion).toEqual(['-ed']);
    expect(de('The dogs bark.', 'dogs')?.flexion).toEqual(['-s']);
    expect(de('It is bigger.', 'bigger')?.flexion).toEqual(['-er']);
    expect(de('He went.', 'went')?.flexion).toEqual(['went']);
    expect(nombreFlexion('-ing')).toBe('gerundio o participio');
    expect(nombreFlexion('went')).toBe('forma irregular');
  });

  it('la lectura es la propia palabra: la clave no depende de la pronunciación', () => {
    const t = de('He went.', 'went')!;
    expect(t.lectura).toBe('go');
    expect(ANALIZADOR.lecturaDeLema('go')).toBe('go');
    expect(t.furigana).toEqual([{ texto: 'went' }]);
  });

  it('a Claude se le enseña de qué forma sale cada palabra', () => {
    expect(describirPalabra(de('He went.', 'went')!)).toBe('went(go)');
    expect(describirPalabra(de('The cat.', 'The')!)).toBe('The');
  });

  it('una coma no queda sola al principio de una línea', () => {
    expect(pegarSignos(',')).toBe('⁠,');
    expect(pegarSignos('(')).toBe('(⁠');
    expect(pegarSignos(' ')).toBe(' ');
  });
});

describe('verbos con partícula y frases hechas', () => {
  it('busca el verbo con su partícula desde cualquier forma, también separados', () => {
    expect(candidatosCompuestos(['picked', ' ', 'it', ' ', 'up'])).toContain('pick up');
    expect(candidatosCompuestos(['gave', ' ', 'up'])).toContain('give up');
    expect(candidatosCompuestos(['looking', ' ', 'forward', ' ', 'to', ' ', 'it'])).toContain('look forward to');
  });

  it('y las frases hechas tal cual vienen', () => {
    expect(candidatosCompuestos(['Of', ' ', 'course', '!'])).toContain('of course');
    expect(candidatosCompuestos(['by', ' ', 'the', ' ', 'way'])).toContain('by the way');
  });

  it('lo más largo va primero, y una palabra sola no busca nada', () => {
    const c = candidatosCompuestos(['look', ' ', 'forward', ' ', 'to']);
    expect(c.indexOf('look forward to')).toBeLessThan(c.indexOf('look forward'));
    expect(candidatosCompuestos(['alone'])).toEqual([]);
  });
});

describe('reconocer el inglés', () => {
  const INGLES = 'The cat sat on the mat because it was tired, and that is what they would have done with their time.';
  const ESPANOL = 'El gato se sentó en la alfombra porque estaba cansado, y eso es lo que habrían hecho con su tiempo. Has visto a mi hermano no me lo dijo.';
  const ALEMAN = 'Die Katze saß auf der Matte, weil sie müde war, und das hätten sie mit ihrer Zeit gemacht. Was will man also.';

  it('con la página declarada en inglés, basta con que tenga letras', () => {
    expect(esTextoIngles('Home', 'en', false)).toBe(true);
    expect(esTextoIngles('Home', 'en-GB', false)).toBe(true);
    expect(esTextoIngles('こんにちは', 'en', false)).toBe(false);
    expect(esTextoIngles('42', 'en', false)).toBe(false);
  });

  it('en una página en otra lengua, solo si el texto lo parece por sí mismo', () => {
    expect(esTextoIngles(ESPANOL, 'es', false)).toBe(false);
    expect(esTextoIngles(ESPANOL, 'es', true)).toBe(false);
    expect(esTextoIngles(INGLES, 'es', false)).toBe(true);
    expect(esTextoIngles('Inicio', 'es', false)).toBe(false);
  });

  it('sin declarar, decide lo visto en la página', () => {
    expect(esTextoIngles('Home', undefined, true)).toBe(true);
    expect(esTextoIngles('Home', undefined, false)).toBe(false);
    expect(esTextoIngles(INGLES, undefined, false)).toBe(true);
    expect(esTextoIngles(ESPANOL, undefined, false)).toBe(false);
    expect(esTextoIngles(ALEMAN, undefined, false)).toBe(false);
  });

  it('una página está en inglés por cuánto se usan sus palabras más comunes', () => {
    expect(paginaEnIngles(contarEscrituras(INGLES.repeat(3)))).toBe(true);
    expect(paginaEnIngles(contarEscrituras(ESPANOL.repeat(3)))).toBe(false);
    expect(paginaEnIngles(contarEscrituras(ALEMAN.repeat(3)))).toBe(false);
    // Muy poco texto no basta.
    expect(paginaEnIngles(contarEscrituras('the cat'))).toBe(false);
  });

  it('una selección corta es una palabra, y una larga o con signos, una frase', () => {
    expect(pareceFrase('look up')).toBe(false);
    expect(pareceFrase('I want to go')).toBe(true);
    expect(pareceFrase('Really?')).toBe(true);
  });
});

describe('frases', () => {
  const partir = (t: string) => t.split(SIGNOS_FRASE.partir);

  it('corta tras el punto, y cada frase conserva su espacio', () => {
    const t = 'One thing. Another one! And a third? Yes.';
    expect(partir(t)).toEqual(['One thing. ', 'Another one! ', 'And a third? ', 'Yes.']);
    expect(partir(t).join('')).toBe(t);
  });

  it('no corta en las abreviaturas', () => {
    expect(partir('Mr. Smith left. He was sad.')).toEqual(['Mr. Smith left. ', 'He was sad.']);
  });

  it('las comillas de cierre se quedan con su frase', () => {
    expect(partir('He said "go." She left.')).toEqual(['He said "go." ', 'She left.']);
  });
});

describe('pronunciación', () => {
  const INGLATERRA = '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}';

  it('elige la primera americana y la primera británica, que son las más cuidadas', () => {
    const t = elegirTranscripciones([
      { ipa: '[ɡəʊ]', tags: ['British'] },
      { ipa: '[ɡoʊ]', tags: ['General-American'] },
      { ipa: '/gəʊ/', tags: ['🇬🇧'] },
      { ipa: '/ɡoʊ/', tags: ['🇺🇸'] },
    ]);
    expect(t).toEqual([{ zona: 'us', ipa: '/ɡoʊ/' }, { zona: 'uk', ipa: '/ɡəʊ/' }]);
  });

  it('reconoce la bandera de Inglaterra', () => {
    expect(elegirTranscripciones([{ ipa: '/dɒɡ/', tags: [INGLATERRA] }])).toEqual([{ zona: 'uk', ipa: '/dɒɡ/' }]);
  });

  it('deja como en los diccionarios para estudiantes', () => {
    expect(elegirTranscripciones([{ ipa: '/ˈdɪk.ʃə.nɛ.ɹi/', tags: ['🇺🇸'] }])[0].ipa).toBe('/ˈdɪkʃənɛri/');
    expect(elegirTranscripciones([{ ipa: '[ˈbɛɾɚ]', tags: ['General-American'] }])[0].ipa).toBe('/ˈbɛtɚ/');
    expect(elegirTranscripciones([{ ipa: '[pʰɪk]', tags: ['London'] }])[0].ipa).toBe('/pɪk/');
    // En una sílaba no hay dónde más cargar el acento.
    expect(elegirTranscripciones([{ ipa: '/ˈhiː/', tags: ['🇬🇧'] }])[0].ipa).toBe('/hiː/');
    expect(elegirTranscripciones([{ ipa: '/ˈrʌnɪŋ/', tags: ['🇺🇸'] }])[0].ipa).toBe('/ˈrʌnɪŋ/');
  });

  it('descarta otras notaciones, dialectos y formas débiles', () => {
    expect(elegirTranscripciones([
      { ipa: '/"lVn.d@n/', tags: ['🇺🇸'] },
      { ipa: '/ˈwɒtə/', tags: ['dialect', '🇺🇸'] },
      { ipa: '[ðə]', tags: ['weak form', '🇺🇸'] },
      { ipa: '[həʊmz]', tags: ['🇬🇧', 'pl'] },
    ])).toEqual([]);
  });

  it('sin zona, vale la primera legible', () => {
    expect(elegirTranscripciones([{ ipa: '/pɪk ʌp/', tags: [] }])).toEqual([{ zona: 'us', ipa: '/pɪk ʌp/' }]);
  });

  it('sabe dónde cae el acento', () => {
    expect(codigoAcento('/ɡoʊ/')).toBe(0);
    expect(codigoAcento('/ˈrʌnɪŋ/')).toBe(1);
    expect(codigoAcento('/fəˈtɑɡrəfi/')).toBe(2);
    expect(codigoAcento('/həˈloʊ/')).toBe(3);
    expect(codigoAcento('/water/')).toBe(0);
    expect(patronAcento(1)).toBe('atamadaka');
    expect(patronAcento(3)).toBe('odaka');
    expect(patronAcento(0)).toBeUndefined();
  });

  it('prepara lo que se guarda de cada palabra', () => {
    expect(filaPronunciacion({ termino: 'hello', lectura: 'hello', transcripciones: [{ ipa: '/həˈloʊ/', tags: ['🇺🇸'] }] })).toEqual({
      termino: 'hello',
      lectura: 'hello',
      posiciones: [3],
      transcripciones: [{ zona: 'us', ipa: '/həˈloʊ/' }],
    });
    expect(filaPronunciacion({ termino: 'x', lectura: 'x', transcripciones: [{ ipa: 'SAMPA', tags: [] }] })).toBeNull();
  });

  it('sobre la palabra se escribe la que se prefiera, y si falta, la otra', () => {
    const ambas = dePronunciacion([{ zona: 'us', ipa: '/ɡoʊ/' }, { zona: 'uk', ipa: '/ɡəʊ/' }]);
    expect(lecturaVisible(ambas, 'us')).toBe('/ɡoʊ/');
    expect(lecturaVisible(ambas, 'uk')).toBe('/ɡəʊ/');
    const soloUk = dePronunciacion([{ zona: 'uk', ipa: '/ɡəʊ/' }]);
    expect(lecturaVisible(soloUk, 'us')).toBe('/ɡəʊ/');
  });
});

describe('diccionarios de Wiktionary', () => {
  const backlink = { tag: 'div', data: { content: 'backlink' }, content: [{ tag: 'a', href: 'https://example.com', content: 'Wiktionary' }] };
  const preambulo = { tag: 'div', data: { content: 'preamble' }, content: [{ tag: 'details', data: { content: 'details-entry-Etymology' }, content: [{ tag: 'summary', content: 'Etimología' }, { tag: 'div', content: 'Del inglés medio' }] }] };

  it('de las definiciones solo se queda con las definiciones', () => {
    const [f] = leerBanco([['pick', '', 'v', 'v', 0, [{ type: 'structured-content', content: [{ tag: 'div', content: [preambulo] }, { tag: 'ol', data: { content: 'glosses' }, content: [{ tag: 'li', content: [{ tag: 'div', content: [{ tag: 'div', data: { content: 'tags' }, content: 'Bio' }, 'Elegir, seleccionar.'] }] }, { tag: 'li', content: [{ tag: 'div', content: ['Robar.'] }] }] }, backlink] }], 0, '']]);
    expect(f.termino).toBe('pick');
    expect(f.lectura).toBe('pick');
    expect(f.glosas).toEqual(['Elegir, seleccionar.', 'Robar.']);
  });

  it('de las dos escrituras del mandarín se queda la simplificada', () => {
    const sentido = (etiqueta: string, palabras: string[]) => ({ type: 'structured-content', content: { tag: 'div', content: [{ tag: 'div', data: { content: 'sense-label' }, content: etiqueta }, { tag: 'ul', data: { content: 'glossary' }, content: palabras.map((p) => ({ tag: 'li', content: p })) }] } });
    const [f] = leerBanco([['pick up', '', 'v', 'v', 0, [sentido('to lift', ['拾取', '撿 /捡', '舉起 /举起', 'and /or'])], 0, '']]);
    expect(f.glosas).toEqual(['拾取, 捡, 举起, and /or (to lift)']);
  });

  it('las traducciones de un sentido van juntas y con su sentido', () => {
    const sentido = (etiqueta: string, palabras: string[]) => ({ type: 'structured-content', content: { tag: 'div', content: [{ tag: 'div', data: { content: 'sense-label' }, content: etiqueta }, { tag: 'ul', data: { content: 'glossary' }, content: palabras.map((p) => ({ tag: 'li', content: p })) }] } });
    const [f] = leerBanco([['pick', '', 'n', 'n', 0, [sentido('pickaxe', ['pico', 'zapapico', 'pico', 'piqueta', 'sacho', 'otra']), sentido('choice', ['elección'])], 0, '']]);
    expect(f.glosas).toEqual(['pico, zapapico, piqueta, sacho (pickaxe)', 'elección (choice)']);
  });

  it('los ejemplos y los sinónimos no son parte de la definición', () => {
    const [f] = leerBanco([['know', '', 'v', 'v', 0, [{ type: 'structured-content', content: [{ tag: 'ol', data: { content: 'glosses' }, content: [{ tag: 'li', content: [{ tag: 'div', content: ['Conocer, saber.', { tag: 'details', data: { content: 'details-entry-examples' }, content: [{ tag: 'summary', data: { content: 'summary-entry' }, content: '2 ejemplos' }, { tag: 'div', data: { content: 'extra-info' }, content: 'I know.' }] }, { tag: 'div', data: { content: 'related-words' }, content: [{ tag: 'ul', content: [{ tag: 'li', content: 'understand' }] }] }] }] }] }] }], 0, '']]);
    expect(f.glosas).toEqual(['Conocer, saber.']);
  });

  it('las formas sin definición propia no se guardan', () => {
    expect(leerBanco([['went', '', 'non-lemma', 'v', 0, [['go', ['first-person indicative preterite']]], 0, '']])).toEqual([]);
  });

  it('lee las pronunciaciones', () => {
    const { pronunciaciones } = leerBancoMeta([['go', 'ipa', { reading: 'go', transcriptions: [{ ipa: '/ɡoʊ/', tags: ['🇺🇸'] }, { ipa: '[ɡəʊ]' }] }]]);
    expect(pronunciaciones).toEqual([{ termino: 'go', lectura: 'go', transcripciones: [{ ipa: '/ɡoʊ/', tags: ['🇺🇸'] }, { ipa: '[ɡəʊ]', tags: [] }] }]);
  });
});

describe('qué diccionarios se proponen', () => {
  const ids = (idioma: string) => fuentesRecomendadas(FUENTES, idioma).map((f) => f.id);

  it('los del idioma de la interfaz, con pronunciación y frecuencia', () => {
    expect(ids('es')).toEqual(['wty-en-es', 'wty-en-es-gloss', 'wty-en-ipa', 'frecuencia-subtitulos']);
    expect(ids('ja')).toEqual(['wty-en-ja', 'wty-en-ja-gloss', 'wty-en-ipa', 'frecuencia-subtitulos']);
  });

  it('el inglés-inglés, que pesa mucho, solo a quien tiene la interfaz en inglés', () => {
    expect(ids('en')).toEqual(['wty-en-en', 'wty-en-ipa', 'frecuencia-subtitulos']);
    for (const idioma of ['es', 'de', 'zh', 'ko', 'ja']) expect(ids(idioma)).not.toContain('wty-en-en');
  });

  it('las traducciones al chino salen del archivo de mandarín, que es donde están', () => {
    expect(FUENTES.find((f) => f.id === 'wty-en-zh-gloss')?.url).toMatch(/\/cmn\/wty-en-cmn-gloss\.zip$/);
    expect(FUENTES.find((f) => f.id === 'wty-en-zh')?.url).toMatch(/\/zh\/wty-en-zh\.zip$/);
    expect(FUENTES.find((f) => f.id === 'wty-en-zh-gloss')?.idioma).toBe('zh');
  });

  it('todos los idiomas de la interfaz tienen diccionario propio', () => {
    for (const idioma of ['es', 'en', 'de', 'zh', 'ko', 'ja']) {
      expect(FUENTES.some((f) => f.tipo === 'terminos' && f.idioma === idioma)).toBe(true);
    }
  });
});

describe('traducción bajo la palabra', () => {
  it('se queda con lo primero, en minúscula y sin notas', () => {
    expect(recortarGlosa('Conocer, saber.')).toBe('conocer');
    expect(recortarGlosa('Poder (tener capacidad de).')).toBe('poder');
    expect(recortarGlosa('pico, zapapico (pickaxe)')).toBe('pico');
    expect(recortarGlosa('(de él) Su, sus')).toBe('su');
    expect(recortarGlosa('ir (to move)')).toBe('ir');
    expect(recortarGlosa('ir (to move through space (especially from one place to another))')).toBe('ir');
  });
});

describe('lista de frecuencia', () => {
  it('cada palabra una vez, con su forma de diccionario y sin lo que no es palabra', async () => {
    const filas = await prepararFrecuencias(['you', "'s", 'a.d.a.', 'a-a-a', 'went', 'go', 'going', 'cat', 'cats'].map((termino, i) => ({ termino, lectura: termino, rango: i + 1 })));
    expect(filas.map((f) => f.termino)).toEqual(['you', 'go', 'cat']);
    expect(filas.map((f) => f.rango)).toEqual([1, 2, 3]);
    expect(filas[1].lectura).toBe('go');
  });
});

describe('gramática sin IA', () => {
  const patrones = (t: string) => detectarGramatica(t).map((p) => p.patron);

  it('reconoce los tiempos', () => {
    expect(patrones('She has already finished the book.')).toContain('present perfect');
    expect(patrones("I've been waiting for an hour.")).toContain('present perfect continuous');
    expect(patrones('He had gone before I arrived.')).toContain('past perfect');
    expect(patrones('We were talking.')).toContain('was / were + -ing');
    expect(patrones("I'm going to call her.")).toContain('be going to');
  });

  it('reconoce condicionales y modales', () => {
    expect(patrones('If it rains, we will stay.')).toContain('if + will');
    expect(patrones('If I had money, I would travel.')).toContain('if + would');
    expect(patrones('If I had gone, I would have seen it.')).toContain('if + had + participio');
    expect(patrones('You should have told me.')).toContain('modal + have + participio');
    expect(patrones('You should go.')).toContain('should');
    expect(patrones('You should have told me.')).not.toContain('should');
  });

  it('distingue used to de be used to', () => {
    expect(patrones('I used to live there.')).toContain('used to');
    expect(patrones("I'm used to it.")).not.toContain('used to');
    expect(patrones('I am used to it.')).toContain('be used to');
  });

  it('funciona con el apóstrofo tipográfico', () => {
    expect(patrones('You’d better go.')).toContain('had better');
  });

  it('da el fragmento exacto y el nivel', () => {
    const [p] = detectarGramatica('I used to swim.');
    expect(p.fragmento).toBe('used to swim');
    expect(p.nivel).toBe('A2');
    expect(p.fuente).toBe('regla');
  });

  it('lo normal no marca nada', () => {
    expect(patrones('The cat is on the table.')).toEqual([]);
    expect(patrones('I like green apples.')).toEqual([]);
  });
});

describe('líneas de subtítulo de Whisper', () => {
  it('una cláusula larga antes de una coma también se parte', () => {
    const trozos = partirTexto('The reading room is open from nine in the morning until six in the evening, and you do not need a reservation.', REGLAS_TRANSCRIPCION);
    for (const t of trozos) expect(t.length).toBeLessThanOrEqual(REGLAS_TRANSCRIPCION.maximoCaracteres);
    expect(trozos.join(' ')).toBe('The reading room is open from nine in the morning until six in the evening, and you do not need a reservation.');
  });

  const R = REGLAS_TRANSCRIPCION;

  it('corta por las frases', () => {
    expect(partirTexto('Hello there. How are you? Fine!', R)).toEqual(['Hello there.', 'How are you?', 'Fine!']);
  });

  it('una frase larga se corta por las comas sin perder los espacios', () => {
    const t = 'When I was young, my father used to take me to the river, and we would fish all day long.';
    const lineas = partirTexto(t, R);
    expect(lineas.join(' ')).toBe(t);
    for (const l of lineas) expect(l.length).toBeLessThanOrEqual(R.maximoCaracteres + 4);
  });

  it('sin puntuación se corta antes de una conjunción, nunca a mitad de palabra', () => {
    const t = 'so we went down to the river and then we walked along the bank for hours because the weather was really nice';
    const lineas = partirTexto(t, R);
    expect(lineas.join(' ')).toBe(t);
    for (const l of lineas) {
      expect(l).toBe(l.trim());
      expect(l.length).toBeLessThanOrEqual(R.maximoCaracteres);
    }
    expect(lineas.slice(1).some((l) => /^(and|because|for|to)\b/.test(l))).toBe(true);
  });

  it('un texto sin ninguno de esos sitios se corta en un espacio', () => {
    const t = 'supercalifragilistic expialidocious supercalifragilistic expialidocious supercalifragilistic';
    expect(partirTexto(t, R).join(' ')).toBe(t);
  });

  it('descarta lo que Whisper se inventa', () => {
    const lineas = (texto: string) => segmentosALineas([{ texto, inicio: 0, fin: 2 }], [], 30, 1, R).map((l) => l.texto);
    expect(lineas('Thanks for watching!')).toEqual([]);
    expect(lineas('Please subscribe to my channel')).toEqual([]);
    expect(lineas('[Music]')).toEqual([]);
    expect(lineas('Thank you.')).toEqual([]);
    expect(lineas('Thank you for coming to the party.')).toEqual(['Thank you for coming to the party.']);
  });
});
