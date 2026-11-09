import { describe, expect, it } from 'vitest';
import { buscarGramatica, buscarPorSignificado, clasesDe, type EntradaBreve, encajeGlosa, indiceDeSignificados, ordenarEntradas, significadosDe, sinAcentos, sinonimosDe } from './explorar';

const entrada = (termino: string, lectura: string, glosas: string[], comun = false, puntuacion = 0): EntradaBreve => ({ termino, lectura, glosa: glosas[0], glosas, comun, puntuacion });

describe('buscar por significado', () => {
  it('compara sin tildes ni mayúsculas', () => {
    expect(sinAcentos('Canción')).toBe('cancion');
    expect(encajeGlosa('canción', 'CANCION')).toBe(3);
  });

  it('puntúa la glosa exacta, la que empieza por lo buscado y la que lo lleva como palabra', () => {
    expect(encajeGlosa('to eat', 'eat')).toBe(3);
    expect(encajeGlosa('perro (animal)', 'perro')).toBe(3);
    expect(encajeGlosa('perro guardián', 'perro')).toBe(2);
    expect(encajeGlosa('un perro grande', 'perro')).toBe(1);
    // Que forme parte de otra palabra no cuenta.
    expect(encajeGlosa('perrona', 'perro')).toBe(0);
  });

  it('ordena por encaje y, entre iguales, las comunes primero', () => {
    const r = buscarPorSignificado(
      [entrada('狗', 'いぬ', ['perro (arcaico)'], false), entrada('犬', 'いぬ', ['perro'], true, 5), entrada('番犬', 'ばんけん', ['perro guardián'], true), entrada('猫', 'ねこ', ['gato'], true)],
      'perro'
    );
    expect(r.map((e) => e.termino)).toEqual(['犬', '狗', '番犬']);
  });

  it('enseña la glosa que encajó', () => {
    const [r] = buscarPorSignificado([entrada('獅子', 'しし', ['león', 'perro león (estatua de los templos)'])], 'perro');
    expect(r.glosa).toBe('perro león (estatua de los templos)');
  });

  it('ordena una categoría: comunes primero, luego la puntuación', () => {
    expect(ordenarEntradas([entrada('ざあざあ', 'ざあざあ', ['a cántaros']), entrada('どきどき', 'どきどき', ['latir'], true), entrada('ふわふわ', 'ふわふわ', ['esponjoso'], false, 9)]).map((e) => e.termino)).toEqual(['どきどき', 'ふわふわ', 'ざあざあ']);
  });
});

describe('sinónimos', () => {
  it('parte una glosa en sus significados, sin paréntesis, tildes ni el «to» inglés', () => {
    expect(significadosDe('Andar, marchar; caminar.')).toEqual(['andar', 'marchar', 'caminar']);
    expect(significadosDe('to live on (e.g. a salary)')).toEqual(['live on']);
    expect(significadosDe('comer (hon.)')).toEqual(['comer']);
  });

  /** Una entrada como las de JMdict: sus sentidos en español (diccionario 0) y en inglés (1), cada uno con sus glosas. */
  const conSentidos = (termino: string, lectura: string, es: string[][], en: string[][] = [], comun = true, puntuacion = 0): EntradaBreve => ({
    ...entrada(termino, lectura, [...es.flat(), ...en.flat()], comun, puntuacion),
    sentidos: [...es.map((glosas) => ({ dic: 0, glosas })), ...en.map((glosas) => ({ dic: 1, glosas }))],
  });

  it('las que comparten más significados primero; entre iguales, las comunes; nunca la propia', () => {
    const taberu = conSentidos('食べる', 'たべる', [['comer']], [['to eat'], ['to live on (e.g. a salary)', 'to live off']], true, 9);
    const kuu = conSentidos('食う', 'くう', [['comer (vulgar)']], [['to eat']], true, 5);
    const meshiagaru = conSentidos('召し上がる', 'めしあがる', [['comer (hon.)', 'beber (hon.)']], [['to eat (hon.)', 'to drink (hon.)']], true, 3);
    const kurau = conSentidos('食らう', 'くらう', [['comer (vulgar)']], [['to eat', 'to drink']], false, 1);
    // 頂く es comer solo en su segundo sentido: pesa menos.
    const itadaku = conSentidos('頂く', 'いただく', [['recibir'], ['comer (hum.)']], [['to receive'], ['to eat (hum.)']], true, 9);
    const nomu = conSentidos('飲む', 'のむ', [['beber']], [['to drink']], true, 9);
    const indice = indiceDeSignificados([taberu, kuu, meshiagaru, kurau, itadaku, nomu]);
    expect(sinonimosDe(indice, taberu).map((e) => e.termino)).toEqual(['食う', '召し上がる', '食らう', '頂く']);
  });

  it('un significado preciso pesa más que uno que comparten muchas', () => {
    const hacer = ['為る', '行う', 'やる', '致す'].map((t, i) => conSentidos(t, `よみ${i}`, [['hacer']]));
    const indice = indiceDeSignificados([...hacer, conSentidos('造る', 'つくる', [['hacer', 'fabricar']]), conSentidos('製造', 'せいぞう', [['fabricar']], [], false)]);
    // 造る comparte los dos; 製造, aunque no sea de uso común, el preciso; los demás, solo «hacer», que comparten muchas.
    expect(sinonimosDe(indice, conSentidos('作る', 'つくる', [['hacer', 'fabricar']])).map((e) => e.termino).slice(0, 2)).toEqual(['造る', '製造']);
  });

  it('de la palabra cuenta su sentido principal: 勉強 es estudiar, no hacer un descuento', () => {
    const indice = indiceDeSignificados([conSentidos('学習', 'がくしゅう', [['estudio', 'aprendizaje']]), conSentidos('値引き', 'ねびき', [['descuento']]), conSentidos('研究', 'けんきゅう', [['investigación'], ['estudio']])]);
    // 研究 es estudio solo en su segundo sentido: va detrás.
    expect(sinonimosDe(indice, conSentidos('勉強', 'べんきょう', [['estudio'], ['diligencia'], ['descuento', 'reducción']])).map((e) => e.termino)).toEqual(['学習', '研究']);
  });

  it('con dos diccionarios, un sinónimo coincide en los dos: los homónimos de una sola lengua no cuelan', () => {
    const neko = conSentidos('猫', 'ねこ', [['gato']], [['cat', 'feline'], ['shamisen']]);
    const indice = indiceDeSignificados([
      conSentidos('ジャッキ', 'じゃっき', [['gato (elevador de automóviles)']], [['jack']]),
      conSentidos('ニャンコ', 'にゃんこ', [['gato']], [['kitty', 'cat']]),
      conSentidos('三味線', 'しゃみせん', [['samisén']], [['shamisen']]),
      // Solo en inglés: coincide en «cat», pero cuenta la mitad.
      conSentidos('キャット', 'きゃっと', [], [['cat']]),
      // Solo en inglés y con un significado que comparten muchas (en JMdict, «head» lo tienen decenas): no llega.
      ...Array.from({ length: 15 }, (_, i) => conSentidos(`頭${i}`, `あたま${i}`, [], [['head']])),
    ]);
    expect(sinonimosDe(indice, neko).map((e) => e.termino)).toEqual(['ニャンコ', 'キャット']);
    expect(sinonimosDe(indice, conSentidos('行く', 'いく', [['ir']], [['to go', 'to head (towards)']])).map((e) => e.termino)).toEqual([]);
    // Las referencias a otra palabra no son significados.
    expect(significadosDe('see: 猫車 wheelbarrow')).toEqual([]);
  });

  it('un sinónimo es de la misma categoría: un nombre suelto no lo es de un verbo', () => {
    expect(clasesDe('v5s vt ⭐ ichi')).toEqual(['verbo']);
    expect(clasesDe('n vs vt vi ⭐')).toEqual(['nombre', 'verbo']);
    expect(clasesDe('adj-i ⭐')).toEqual(['adjetivo']);
    // vidg (videojuegos) y vulg (vulgar) no son verbos.
    expect(clasesDe('n vidg vulg')).toEqual(['nombre']);
    const con = (t: string, glosas: string[], clases: string[]) => ({ ...conSentidos(t, t, [], [glosas]), clases });
    const indice = indiceDeSignificados([con('喋る', ['to talk', 'to chat'], ['verbo']), con('会話', ['conversation', 'to converse'], ['nombre', 'verbo']), con('逆', ['reverse', 'converse'], ['nombre'])]);
    expect(sinonimosDe(indice, con('話す', ['to talk', 'to converse'], ['verbo'])).map((e) => e.termino)).toEqual(['喋る', '会話']);
  });

  it('un significado que tienen demasiadas palabras no cuenta', () => {
    const muchas = Array.from({ length: 5 }, (_, i) => conSentidos(`語${i}`, `ご${i}`, [['hacer']]));
    const indice = indiceDeSignificados([...muchas, conSentidos('製造', 'せいぞう', [['fabricar']])]);
    expect(sinonimosDe(indice, conSentidos('作る', 'つくる', [['hacer', 'fabricar']]), 12, 4).map((e) => e.termino)).toEqual(['製造']);
  });
});

describe('buscar gramática', () => {
  const puntos = [
    { nivel: 'N3', g: { patron: '〜わけではない', significado: { es: 'No es que…, no significa que…', en: "It's not that…" } } },
    { nivel: 'N3', g: { patron: '〜わけだ', significado: { es: 'Es lógico que…, por eso…', en: 'No wonder…' } } },
    { nivel: 'N2', g: { patron: '〜ものの', significado: { es: 'Aunque…, si bien…', en: 'Although…' } } },
    { nivel: 'N4', g: { patron: '〜ても', significado: { es: 'Aunque', en: 'Even if' } } },
  ];

  it('por su forma, con o sin 〜', () => {
    expect(buscarGramatica(puntos, 'わけ', 'es').map((p) => p.g.patron)).toEqual(['〜わけではない', '〜わけだ']);
    expect(buscarGramatica(puntos, '〜わけだ', 'es')[0].g.patron).toBe('〜わけだ');
  });

  it('en una frase que lo lleva', () => {
    expect(buscarGramatica(puntos, '嫌いなわけではない', 'es')[0].g.patron).toBe('〜わけではない');
  });

  it('por su significado, en el idioma de la interfaz', () => {
    expect(buscarGramatica(puntos, 'aunque', 'es').map((p) => p.g.patron)).toEqual(['〜ても', '〜ものの']);
    expect(buscarGramatica(puntos, 'although', 'de').map((p) => p.g.patron)).toEqual(['〜ものの']);
  });
});
