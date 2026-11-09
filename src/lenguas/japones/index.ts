// El paquete del japonés: lo que el programa necesita saber de esta lengua en cualquier pantalla.

import { idiomaActual, tm } from '../../compartido/i18n';
import type { PaqueteLengua } from '../tipos';
import { contarEscrituras, esTextoJapones, pareceFrase, proporcionDeKana, SIGNOS_FRASE } from './escritura';
import { TEXTOS } from './textos';
import { fonemasDeMoras, morasEspeciales } from './fonemas';
import { frasesAcentuales } from './practica';
import { alinearFurigana, kataAHira, lecturaVisible, nombreFlexion, patronAcento, pegarSignos, separarMoras, tieneJapones } from './tokens';
import { caracteresConTrazos } from './trazos';

function saludo(hora: number, nombre: string): string {
  const base = hora >= 5 && hora < 11 ? 'おはようございます' : hora >= 11 && hora < 18 ? 'こんにちは' : 'こんばんは';
  return nombre ? `${base}、${nombre}さん` : base;
}

export const JAPONES: PaqueteLengua = {
  tituloDeCancion: /ミュージックビデオ|歌ってみた|カラオケ|主題歌|歌詞|オリジナル曲/,
  id: 'ja',
  bcp47: 'ja-JP',
  nombrePropio: '日本語',
  presentacion: tm('Subtítulos con furigana, kanji y acento tonal'),
  letra: 'var(--letra-japones)',
  // Sus valores iniciales son los de los ajustes: es la lengua con la que se empieza.
  ajustes: {},
  frasesEnLector: false,
  // Con una glosa en inglés se encuentran más imágenes.
  consultaImagen: (_lema, entradas, definiciones) => entradas.find((e) => e.dic === 'jmdict-en')?.glosas[0] ?? definiciones[0],
  escritura: {
    tieneTexto: tieneJapones,
    esDeLaLengua: esTextoJapones,
    contar: contarEscrituras,
    paginaEnLengua: (r) => proporcionDeKana(r.propios, r.compartidos),
    frase: SIGNOS_FRASE,
    pareceFrase,
    separadorLista: '、',
    comillar: (texto) => `「${texto}」`,
    pegarSignos,
    portadaVertical: true,
    globos: 'manga-ocr',
    // El punto medio de las listas, los ejercicios numerados, los apartados con katakana o con números escritos en kanji, y
    // quien habla en un diálogo («母親：»), cuyo texto sigue debajo con sangría.
    marcaDeLista: /^\s*(?:・|問\s*[0-9０-９]+|[(（][ア-ン一二三四五六七八九十][)）]|[^\s：]{1,6}：)/,
  },
  lectura: {
    distingue: true,
    formatos: [
      { id: 'hiragana', muestra: 'あ' },
      { id: 'katakana', muestra: 'ア' },
      { id: 'romaji', muestra: 'a' },
    ],
    formatoInicial: 'hiragana',
    formatoSencillo: { id: 'romaji', pregunta: tm('Ver las lecturas en rōmaji, en lugar de kana'), etiqueta: tm('Lecturas en rōmaji') },
    visible: lecturaVisible,
    segmentar: alinearFurigana,
    normalizar: kataAHira,
    esSoloLectura: (texto) => !/[^぀-ヿー]/.test(texto),
    // El rōmaji es más estrecho que el kana.
    anchoCaracter: (formato) => (formato === 'romaji' ? 0.55 : 1),
  },
  acento: {
    patron: patronAcento,
    moras: separarMoras,
    practica: {
      frases: frasesAcentuales,
      moras: {
        fonemas: fonemasDeMoras,
        especiales: morasEspeciales,
        textos: {
          opcion: tm('Comprobar también っ, ん y vocales largas'),
          ayudaOpcion: tm('Con narabas, un modelo de fonemas del japonés. La primera vez se descargan {0} GB, que quedan guardados en el navegador.'),
          ayuda: tm('También mira si faltan o sobran っ, ん o vocales largas.'),
          bien: tm('Ni faltan ni sobran っ, ん o vocales largas.'),
          sinEspeciales: tm('No se oye ninguna っ, ん o vocal larga de más.'),
          falta: {
            larga: tm('En «{0}» la vocal larga se oye corta: dura dos moras.'),
            sokuon: tm('En «{0}» no se oye la っ: es una pausa breve, del largo de una mora.'),
            hatsuon: tm('En «{0}» no se oye la ん: es una mora entera.'),
          },
          sobra: {
            larga: tm('En «{0}» se oye una vocal larga que no está: es corta.'),
            sokuon: tm('En «{0}» se oye una pausa, como una っ, que no está.'),
            hatsuon: tm('En «{0}» se oye una ん que no está.'),
          },
        },
      },
      sinDiccionario: tm('Sin un diccionario de acento solo se juzgan las formas corteses, como 〜ます. Instala «{0}» en Ajustes, en Diccionarios.'),
    },
    leyenda: [
      { clase: 'heiban', nombre: tm('Heiban') },
      { clase: 'atamadaka', nombre: tm('Atamadaka') },
      { clase: 'nakadaka', nombre: tm('Nakadaka') },
      { clase: 'odaka', nombre: tm('Odaka') },
    ],
  },
  nombreFlexion,
  trazos: {
    caracteres: caracteresConTrazos,
    credito: { nombre: 'KanjiVG', url: 'https://kanjivg.tagaini.net', licencia: 'CC BY-SA 3.0' },
  },
  principiante: { valor: 'principiante absoluto', nombre: tm('Empiezo desde cero'), ayuda: tm('Aún no leo kana'), lectura: 'todas' },
  // Vocabulario que suele asociarse a cada nivel del JLPT. Son cifras orientativas, no oficiales.
  niveles: [
    { valor: 'JLPT N5', nombre: tm('N5'), ayuda: tm('Leo kana y frases muy sencillas'), lectura: 'todas', palabras: 800 },
    { valor: 'JLPT N4', nombre: tm('N4'), ayuda: tm('Conversaciones cotidianas sencillas'), lectura: 'todas', palabras: 1500 },
    { valor: 'JLPT N3', nombre: tm('N3'), ayuda: tm('Entiendo textos cotidianos con ayuda'), lectura: 'desconocidas', palabras: 3750 },
    { valor: 'JLPT N2', nombre: tm('N2'), ayuda: tm('Noticias y series, con alguna dificultad'), lectura: 'desconocidas', palabras: 6000 },
    { valor: 'JLPT N1', nombre: tm('N1'), ayuda: tm('Leo casi de todo'), lectura: 'desconocidas', palabras: 10000 },
  ],
  nivelInicial: 'JLPT N3',
  nombreNivel: (valor) => valor.replace('JLPT ', ''),
  voces: [
    { id: 'ja-JP-MasaruMultilingualNeural', nombre: tm('Masaru') },
    { id: 'ja-JP-KeitaNeural', nombre: tm('Keita') },
    { id: 'ja-JP-DaichiNeural', nombre: tm('Daichi') },
    { id: 'ja-JP-NanamiNeural', nombre: tm('Nanami') },
    { id: 'ja-JP-AoiNeural', nombre: tm('Aoi') },
    { id: 'ja-JP-MayuNeural', nombre: tm('Mayu') },
    { id: 'ja-JP-ShioriNeural', nombre: tm('Shiori') },
  ],
  vocesIniciales: ['ja-JP-MasaruMultilingualNeural', 'ja-JP-NanamiNeural'],
  enlaces: [
    { nombre: tm('Jisho'), url: (p) => `https://jisho.org/search/${encodeURIComponent(p)}` },
    // JapanDict usa los números de entrada de JMdict: así se abre justo la acepción, no una lista de homógrafos.
    {
      nombre: 'JapanDict',
      url: (p, entradas) => {
        const entrada = entradas.find((x) => x.dic.startsWith('jmdict') && x.seq)?.seq;
        return `https://www.japandict.com/${encodeURIComponent(p)}${entrada ? `#entry-${entrada}` : ''}`;
      },
    },
    { nombre: tm('Weblio'), url: (p) => `https://www.weblio.jp/content/${encodeURIComponent(p)}` },
    { nombre: tm('Goo 辞書'), url: (p) => `https://dictionary.goo.ne.jp/srch/all/${encodeURIComponent(p)}/m0u/` },
    { nombre: 'コトバンク', url: (p) => `https://kotobank.jp/gs/?q=${encodeURIComponent(p)}` },
    { nombre: tm('Wiktionary'), url: (p) => `https://${idiomaActual()}.wiktionary.org/wiki/${encodeURIComponent(p)}` },
    { nombre: tm('Forvo'), url: (p) => `https://forvo.com/search/${encodeURIComponent(p)}/ja/` },
    { nombre: tm('Massif'), url: (p) => `https://massif.la/ja/search?q=${encodeURIComponent(p)}` },
    { nombre: tm('Imágenes'), url: (p) => `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(p)}` },
  ],
  sitiosLectura: [
    { nivel: tm('Principiante'), nombre: tm('Matcha'), url: 'https://matcha-jp.com/easy' },
    { nivel: tm('Principiante'), nombre: tm('NHK Easy'), url: 'https://news.web.nhk/news/easy/' },
    { nivel: tm('Intermedio'), nombre: '多読道場', url: 'https://yomujp.com/' },
    { nivel: tm('Intermedio'), nombre: '旅色', url: 'https://tabiiro.jp/' },
    { nivel: tm('Avanzado'), nombre: tm('Wikipedia'), url: 'https://ja.wikipedia.org/' },
    { nivel: tm('Avanzado'), nombre: 'NHK', url: 'https://www3.nhk.or.jp/news/' },
  ],
  ejemplos: {
    palabra: '食べる',
    lectura: 'たべる',
    busqueda: '食べた、勉強する、一日でも…',
    sugerencias: ['食べる', '言の葉', '勉強', '星'],
    pegarTexto: 'ここに日本語の文章を貼り付けてください',
    escribir: 'ここに書いてください',
    lista: '猫、犬、食べる…',
    texto: '吾輩は猫である。名前はまだ無い。\nどこで生れたかとんと見当がつかぬ。何でも薄暗いじめじめした所でニャーニャー泣いていた事だけは記憶している。\n吾輩はここで始めて人間というものを見た。',
    letra: 'あ',
  },
  saludo,
  textos: TEXTOS,
  ideasRelato: [tm('Un gato que pasea por Kioto'), tm('Una tarde de lluvia en el tren'), tm('El festival de verano del barrio')],
};
