import { describe, expect, it } from 'vitest';
import { leerDiccionarioKanji, listaDe, tablaKanjium } from './kanji';

/** Una fila de kanjidict.txt: 24 columnas, de las que se leen las 17 primeras. */
function kanjidict(c: Partial<Record<'kanji' | 'radical' | 'radvar' | 'phonetic' | 'type' | 'reg_on' | 'reg_kun' | 'onyomi' | 'kunyomi' | 'nanori' | 'strokes' | 'grade' | 'jlpt' | 'kanken' | 'frequency' | 'meaning', string>>) {
  return [c.kanji, c.radical, c.radvar, c.phonetic, '', c.type, c.reg_on, c.reg_kun, c.onyomi, c.kunyomi, c.nanori, c.strokes, c.grade, c.jlpt, c.kanken, c.frequency, c.meaning, '', '', '', '', '', '', '']
    .map((x) => x ?? '')
    .join('\t');
}

const TEXTOS = {
  kanjidict: [
    kanjidict({ kanji: '行', radical: '行', type: 'Pictograph', reg_on: 'コウ、ギョウ、アン*', reg_kun: 'い（く）、ゆ（く）、おこな（う）', onyomi: 'コウ(漢)、ギョウ(呉)、アン(唐)、ゴウ(呉)', kunyomi: 'い（く）、ゆ（く）、おこな（う）、おこ（なう）、みち', nanori: 'あきら、ゆき', strokes: '6', grade: 'Kyōiku-Jōyō (2nd grade of primary school)', jlpt: 'N5 (beginner)', kanken: '9', frequency: '10', meaning: 'going;journey' }),
    kanjidict({ kanji: '漢', radical: '水', radvar: '氵', type: 'Compound ideograph', reg_on: 'カン', onyomi: 'カン(呉)', kunyomi: 'おとこ、から', strokes: '13', grade: 'Kyōiku-Jōyō (3rd grade of primary school)', meaning: 'Sino-;China' }),
    kanjidict({ kanji: '晴', radical: '日', phonetic: '青', type: 'Phono-semantic compound', reg_on: 'セイ', onyomi: 'セイ(漢)', strokes: '12', meaning: 'clear up;(kokuji)' }),
    kanjidict({ kanji: '青', radical: '青', phonetic: '青', reg_on: 'セイ、ショウ*', onyomi: 'セイ(漢)、ショウ(呉)', strokes: '8', meaning: 'blue' }),
    kanjidict({ kanji: '水', radical: '水', strokes: '4', meaning: 'water' }),
    kanjidict({ kanji: '国', radical: '囗', strokes: '8', meaning: 'country;(kokuji)' }),
    kanjidict({ kanji: '鴎', radical: '鳥', onyomi: 'オウ(漢)、ウ(呉)', kunyomi: 'かもめ', grade: 'Hyōgaiji (former Jinmeiyō candidate)', kanken: 'pre-1', meaning: 'seagull' }),
    kanjidict({ kanji: '上', radical: '一', strokes: '3', meaning: 'above' }),
    kanjidict({ kanji: String.fromCodePoint(0xf765), meaning: 'private use' }),
  ].join('\n'),
  variants: ['国\t國,圀,𡈁\t國(C)\t国(C)\t\t国\t\t國', '晴\t晴\t\t\t\t\t\t'].join('\r\n'),
  elements: `${String.fromCharCode(0xfeff)}晴\t12\t1\t⿰\t月青土二日亠旺\t\t日,青,靑,月,土,二,亠\t\tclear up\n漢\t13\t1\t品l\t氵艹口一大\t\t氵,艹,口,大\t\tSino-`,
  radicals: ['水\t氵\t85\t4\tみず・したみず・さんずい\twater\tAlso 氺.', '青\t\t174\t8\tあお\tblue\t', '一\t\t1\t1\tいち\tone\t'].join('\n'),
  radicals_variants: ['氵\t水\t85\t3\tさんずい\twater\t', '氺\t水\t85\t5\tしたみず\twater\t'].join('\n'),
  phonetics: '青\tセイ\t9\tSingle-reading phonetic',
  antonyms: '上\t下',
  synonyms: '上\t登,乗',
  lookalikes: '晴\t睛,清',
  homonyms: ['3\t上\tあがる\t挙,揚\tSame pitch accents', '5\t上\tかみ\t神,紙,髪\tDifferent pitch accents'].join('\n'),
  pinyin: '行\txíng,háng',
  hangul: '行\t행',
};

const BANCOS = { 'kanjidic-es': [{ caracter: '行', on: [], kun: [], etiquetas: [], significados: ['ir', 'viaje'], datos: {} }] };

const fichas = leerDiccionarioKanji(TEXTOS, BANCOS);
const ficha = (c: string) => fichas.find((f) => f.caracter === c)!;

describe('diccionario de kanji de Kanjium', () => {
  it('separa las lecturas oficiales de las demás, con su época y si son poco usadas', () => {
    const k = ficha('行');
    expect(k.on.oficiales).toEqual([{ texto: 'コウ', origen: '漢' }, { texto: 'ギョウ', origen: '呉' }, { texto: 'アン', origen: '唐', poco: true }]);
    expect(k.on.otras).toEqual([{ texto: 'ゴウ', origen: '呉' }]);
    expect(k.kun.oficiales.map((x) => x.texto)).toEqual(['い.く', 'ゆ.く', 'おこな.う']);
    // おこ（なう） es おこな（う） con el okurigana partido de otra forma: no sale entre las otras.
    expect(k.kun.otras).toEqual([{ texto: 'みち' }]);
    expect(k.nombres).toEqual(['あきら', 'ゆき']);
  });

  it('guarda curso, nivel, kanken, frecuencia, trazos y cómo se formó', () => {
    expect(ficha('行')).toMatchObject({ lista: 'kyoiku-2', nivel: 'N5', kanken: '9', frecuencia: 10, trazos: 6, formacion: 'pictograma' });
    expect(ficha('鴎')).toMatchObject({ lista: 'hyogai', kanken: 'pre-1' });
    expect(ficha('鴎').on.oficiales).toEqual([]);
    expect(ficha('鴎').on.otras.map((x) => x.texto)).toEqual(['オウ', 'ウ']);
  });

  it('pone los significados en inglés sin las marcas de Kanjium, y los de KANJIDIC en español', () => {
    expect(ficha('行').significados).toEqual({ en: ['going', 'journey'], es: ['ir', 'viaje'] });
    expect(ficha('晴').significados).toEqual({ en: ['clear up'] });
  });

  it('da el radical con la forma que toma, su número y sus nombres', () => {
    expect(ficha('漢').radical).toEqual({ caracter: '水', forma: '氵', numero: 85, nombres: ['さんずい'], significado: 'water' });
    expect(ficha('水').formasComoPieza).toEqual(['氵', '氺']);
    expect(ficha('漢').formasComoPieza).toEqual([]);
  });

  it('sabe qué pieza da el sonido y a quién se lo da', () => {
    expect(ficha('晴').fonetico).toBe('青');
    expect(ficha('青').daSonido).toEqual({ lecturas: ['セイ'], tipo: 'casi' });
    expect(ficha('晴').piezas).toEqual(['日', '青', '靑', '月', '土', '二', '亠']);
  });

  it('separa las formas antiguas de las demás variantes y de las chinas', () => {
    expect(ficha('国').variantes).toEqual({ antiguas: ['國'], nuevas: [], otras: ['圀', '𡈁'], tradicional: '國' });
    expect(ficha('晴').variantes).toEqual({ antiguas: [], nuevas: [], otras: [] });
  });

  it('trae opuestos, sinónimos, parecidos y los que se leen igual', () => {
    const k = ficha('上');
    expect(k.opuestos).toEqual(['下']);
    expect(k.sinonimos).toEqual(['登', '乗']);
    expect(k.homonimos).toEqual([
      { lectura: 'あがる', caracteres: ['挙', '揚'], mismoAcento: true },
      { lectura: 'かみ', caracteres: ['神', '紙', '髪'], mismoAcento: false },
    ]);
    expect(ficha('晴').parecidos).toEqual(['睛', '清']);
    expect(ficha('行').enOtrasLenguas).toEqual({ zh: 'xíng,háng', ko: '행' });
  });

  it('salta los caracteres de uso privado', () => {
    expect(fichas.map((f) => f.caracter)).toEqual(['行', '漢', '晴', '青', '水', '国', '鴎', '上']);
  });
});

describe('tablas de Kanjium', () => {
  it('quita la marca de orden de bytes y las líneas vacías', () => {
    expect(tablaKanjium(`${String.fromCharCode(0xfeff)}亜\tア\r\n\r\n唖\tア\n`)).toEqual([['亜', 'ア'], ['唖', 'ア']]);
  });

  it('pasa los cursos a listas', () => {
    expect(listaDe('Kyōiku-Jōyō (1st grade of primary school)')).toBe('kyoiku-1');
    expect(listaDe('Jōyō (high school)')).toBe('joyo');
    expect(listaDe('Jinmeiyō (used in names)')).toBe('jinmeiyo');
    expect(listaDe('Jinmeiyō (traditional variant of Jōyō)')).toBe('jinmeiyo-antigua');
    expect(listaDe('Kyūjitai-Hyōgaiji')).toBe('hyogai-antigua');
    expect(listaDe('Hyōgaiji (tolerated Jōyō variant)')).toBe('hyogai');
    expect(listaDe('')).toBeUndefined();
  });
});
