// El paquete del chino (mandarín, en caracteres simplificados): lo que el programa necesita saber de esta lengua en
// cualquier pantalla.

import { idiomaActual, tm } from '../../compartido/i18n';
import type { PaqueteLengua } from '../tipos';
import { contarEscrituras, esTextoChino, paginaEnChino, pareceFrase, pegarSignos, SIGNOS_FRASE, tieneChino } from './escritura';
import { esSoloPinyin, normalizarPinyin, pinyinVisible, repartirPinyin, sinTonos, tonoDeSilaba } from './pinyin';
import { comoSuenaChino, FENOMENOS, silabasParaPracticar } from './sandhi';
import { TEXTOS } from './textos';
import { TEXTO_DE_EJEMPLO } from './ejemplo';

function saludo(hora: number, nombre: string): string {
  const base = hora >= 5 && hora < 11 ? '早上好' : hora >= 11 && hora < 18 ? '下午好' : '晚上好';
  return nombre ? `${nombre}，${base}` : base;
}

/** Las letras con glifos de China continental primero: con una japonesa delante, 直 o 骨 saldrían con su forma japonesa. */
const GOTICA = "'Microsoft YaHei UI', 'Microsoft YaHei', 'PingFang SC', 'Noto Sans SC', 'Source Han Sans SC', 'Noto Sans CJK SC', sans-serif";

export const CHINO: PaqueteLengua = {
  tituloDeCancion: /歌词|音乐|演唱|翻唱|主题曲|片尾曲|插曲/,
  // Las simplificadas primero; una en tradicionales se pasa a simplificados al analizarla (ver normalizarTexto).
  pistasPreferidas: ['zh-Hans', 'zh-CN', 'zh-SG', 'zh', 'zh-Hans-CN', 'zh-Hant', 'zh-TW', 'zh-HK'],
  id: 'zh',
  bcp47: 'zh-CN',
  nombrePropio: '中文',
  presentacion: tm('Subtítulos con pinyin, caracteres simplificados y CC-CEDICT'),
  letra: GOTICA,
  ajustes: {
    nivel: 'HSK 3',
    formatoLectura: 'marcas',
    furigana: 'desconocidas',
    lectorFurigana: 'desconocidas',
    // Cada sílaba, del color de su tono: es lo que más ayuda a recordarlos.
    colorAcento: 'siempre',
    particulasConocidas: true,
    vocesFrase: ['zh-CN-XiaoxiaoNeural', 'zh-CN-YunxiNeural'],
    prompts: {},
    ankiMazo: 'Kotonoha 中文',
  },
  // Las palabras compuestas se buscan pegadas, como en japonés.
  frasesEnLector: false,
  // CC-CEDICT define en inglés: con su glosa se encuentran más imágenes.
  consultaImagen: (_lema, entradas, definiciones) => entradas.find((e) => e.dic === 'cc-cedict')?.glosas[0] ?? definiciones[0],
  escritura: {
    tieneTexto: tieneChino,
    esDeLaLengua: esTextoChino,
    contar: contarEscrituras,
    paginaEnLengua: paginaEnChino,
    frase: SIGNOS_FRASE,
    pareceFrase,
    separadorLista: '、',
    comillar: (texto) => `“${texto}”`,
    pegarSignos,
    portadaVertical: false,
    // Los cómics chinos se leen de izquierda a derecha, con el lector de libros dentro de cada globo.
    globos: 'lector',
  },
  lectura: {
    distingue: true,
    formatos: [
      { id: 'marcas', muestra: 'ā' },
      { id: 'numeros', muestra: 'a1' },
    ],
    formatoInicial: 'marcas',
    visible: pinyinVisible,
    segmentar: repartirPinyin,
    normalizar: normalizarPinyin,
    esSoloLectura: esSoloPinyin,
    // Sin tonos, también si se escribieron con números: ni3hao3 y nihao buscan lo mismo.
    paraBuscar: (lectura) => sinTonos(normalizarPinyin(lectura)),
    // Las letras del pinyin miden unos 0,55 em, como el rōmaji, pero cada sílaba va sobre su carácter: contadas un 15 %
    // más anchas, se estrechan un poco más y dejan aire entre una y otra (sin él, en una página se lee «shūguǎnchóng»).
    anchoCaracter: () => 0.63,
    // Y las de cinco o seis letras (zhōng, chuáng) sobre un solo carácter necesitan estrecharse más que el kana.
    compresionMinima: 0.5,
  },
  // Los tonos van en el pinyin de cada carácter: no hace falta diccionario de acento. Con los colores del acento de la
  // paleta, en el orden más extendido entre quienes estudian chino (rojo, verde, azul y morado); el neutro, sin color.
  acento: {
    silaba: (lectura) => {
      const t = tonoDeSilaba(lectura);
      return t ? `tono${t}` : undefined;
    },
    nombreColor: tm('Color de los tonos'),
    tonos: { silabas: silabasParaPracticar },
    leyenda: [
      { clase: 'tono1', nombre: tm('Primer tono') },
      { clase: 'tono2', nombre: tm('Segundo tono') },
      { clase: 'tono3', nombre: tm('Tercer tono') },
      { clase: 'tono4', nombre: tm('Cuarto tono') },
    ],
  },
  nombreFlexion: () => undefined,
  letras: {
    gotica: GOTICA,
    libro: "'SimSun', 'NSimSun', 'Songti SC', 'Noto Serif SC', 'Source Han Serif SC', 'Noto Serif CJK SC', serif",
    // El kaiti, la letra de pincel con que se enseña a escribir en la escuela.
    escuela: "'KaiTi', 'STKaiti', 'Kaiti SC', 'AR PL UKai CN', 'KaiTi_GB2312', serif",
  },
  principiante: { valor: 'principiante absoluto', nombre: tm('Empiezo desde cero'), ayuda: tm('Aún no leo caracteres'), lectura: 'todas' },
  // Los niveles del HSK 3.0, con el temario revisado en 2025: el vocabulario acumulado de cada uno.
  niveles: [
    { valor: 'HSK 1', nombre: 'HSK 1', ayuda: tm('Saludos y frases muy sencillas'), lectura: 'todas', palabras: 300 },
    { valor: 'HSK 2', nombre: 'HSK 2', ayuda: tm('Conversaciones cotidianas sencillas'), lectura: 'todas', palabras: 500 },
    { valor: 'HSK 3', nombre: 'HSK 3', ayuda: tm('Entiendo textos cotidianos con ayuda'), lectura: 'desconocidas', palabras: 1000 },
    { valor: 'HSK 4', nombre: 'HSK 4', ayuda: tm('Entiendo lo esencial si hablan claro'), lectura: 'desconocidas', palabras: 2000 },
    { valor: 'HSK 5', nombre: 'HSK 5', ayuda: tm('Noticias y series, con alguna dificultad'), lectura: 'desconocidas', palabras: 3600 },
    { valor: 'HSK 6', nombre: 'HSK 6', ayuda: tm('Entiendo casi todo, incluso sin subtítulos'), lectura: 'desconocidas', palabras: 5400 },
    { valor: 'HSK 7-9', nombre: 'HSK 7–9', ayuda: tm('Leo casi de todo'), lectura: 'desconocidas', palabras: 11000 },
  ],
  nivelInicial: 'HSK 3',
  nombreNivel: (valor) => valor.replace('7-9', '7–9'),
  voces: [
    { id: 'zh-CN-XiaoxiaoNeural', nombre: 'Xiaoxiao' },
    { id: 'zh-CN-YunxiNeural', nombre: 'Yunxi' },
    { id: 'zh-CN-XiaoyiNeural', nombre: 'Xiaoyi' },
    { id: 'zh-CN-YunjianNeural', nombre: 'Yunjian' },
    { id: 'zh-CN-YunyangNeural', nombre: 'Yunyang' },
    { id: 'zh-CN-XiaochenNeural', nombre: 'Xiaochen' },
    { id: 'zh-CN-XiaohanNeural', nombre: 'Xiaohan' },
  ],
  vocesIniciales: ['zh-CN-XiaoxiaoNeural', 'zh-CN-YunxiNeural'],
  enlaces: [
    { nombre: 'MDBG', url: (p) => `https://www.mdbg.net/chinese/dictionary?page=worddict&wdqb=${encodeURIComponent(p)}` },
    { nombre: '汉典', url: (p) => `https://www.zdic.net/hans/${encodeURIComponent(p)}` },
    { nombre: tm('Wiktionary'), url: (p) => `https://${idiomaActual()}.wiktionary.org/wiki/${encodeURIComponent(p)}` },
    { nombre: 'YouGlish', url: (p) => `https://youglish.com/pronounce/${encodeURIComponent(p)}/chinese` },
    { nombre: tm('Forvo'), url: (p) => `https://forvo.com/search/${encodeURIComponent(p)}/zh/` },
    { nombre: tm('Imágenes'), url: (p) => `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(p)}` },
  ],
  sitiosLectura: [
    { nivel: tm('Principiante'), nombre: 'Mandarin Bean', url: 'https://mandarinbean.com/' },
    { nivel: tm('Principiante'), nombre: 'Chinese Reading Practice', url: 'https://chinesereadingpractice.com/' },
    { nivel: tm('Intermedio'), nombre: '慢速中文', url: 'https://www.slow-chinese.com/' },
    { nivel: tm('Intermedio'), nombre: 'BBC 中文', url: 'https://www.bbc.com/zhongwen/simp' },
    { nivel: tm('Avanzado'), nombre: tm('Wikipedia'), url: 'https://zh.wikipedia.org/zh-cn/' },
    { nivel: tm('Avanzado'), nombre: '人民网', url: 'http://www.people.com.cn/' },
  ],
  ejemplos: {
    palabra: '学习',
    lectura: 'xuéxí',
    busqueda: '学习、nihao、一会儿…',
    sugerencias: ['学习', '你好', '朋友', '星星'],
    pegarTexto: '请在这里粘贴中文文本',
    escribir: '请在这里书写',
    lista: '猫、狗、学习…',
    // El principio de 《故乡》, de Lu Xun (1921): de dominio público.
    texto: '我冒了严寒，回到相隔二千余里，别了二十余年的故乡去。\n时候既然是深冬；渐近故乡时，天气又阴晦了，冷风吹进船舱中，呜呜的响，从篷隙向外一望，苍黄的天底下，远近横着几个萧索的荒村，没有一些活气。',
    letra: '中',
  },
  textoDeEjemplo: TEXTO_DE_EJEMPLO,
  saludo,
  textos: TEXTOS,
  comoSuena: {
    analizar: comoSuenaChino,
    conPalabras: true,
    fenomenos: FENOMENOS,
    sinFenomenos: tm('Aquí ningún tono cambia al hablar: cada sílaba se dice con el suyo.'),
  },
  ideasRelato: [tm('Un gato que pasea por Pekín'), tm('Una tarde de lluvia en el tren'), tm('La fiesta de primavera del pueblo')],
};
