// Detección de puntos gramaticales sin IA, para que funcione al instante y sin conexión. Como en las demás lenguas, es
// deliberadamente conservadora: mejor no marcar que marcar mal. Claude la sustituye cuando revisa la línea.
//
// Los niveles son los del HSK 3.0, orientativos: el temario de 2025 agrupa la gramática por niveles, pero no da una
// lista cerrada con estos nombres.

import { tm } from '../../compartido/i18n';
import { aplicarReglas, type ReglaGramatica } from '../reglasGramatica';
import type { PuntoGramatica } from '../tipos';

/** Hasta el final de la frase, sin cruzar a la siguiente. */
const EN_LA_FRASE = '[^。！？!?]*?';
/** Hasta la coma, sin cruzarla. */
const HASTA_LA_COMA = '[^，。！？,!?；;]';

const regla = (patron: string, nivel: string, significado: string, re: string): ReglaGramatica => ({ patron, nivel, significado, re: new RegExp(re, 'u') });

const REGLAS: ReglaGramatica[] = [
  // HSK 1 y 2
  regla('了', 'HSK 1', tm('Algo ya hecho, o un cambio de situación'), '(?<![为除算罢受不])了(?!解)'),
  regla('吗', 'HSK 1', tm('Pregunta de sí o no'), '吗(?=[？?。！!\\s]|$)'),
  regla('A不A', 'HSK 2', tm('Pregunta con la forma afirmativa y la negativa juntas: 是不是, 好不好'), '(\\p{Script=Han})不\\1'),
  regla('过', 'HSK 2', tm('Algo que se ha hecho alguna vez'), '(?:去|来|吃|喝|看|听|见|做|学|用|说|玩|住|到|读|写|买|试|坐|想)过(?![来去])'),
  regla('着', 'HSK 2', tm('Un estado que dura, o cómo se hace otra cosa'), '(?:坐|站|躺|穿|戴|拿|带|开|关|放|挂|写|笑|等|唱|跟|看|听|说)着'),
  regla('正在', 'HSK 2', tm('Algo que está pasando ahora'), `正在|在${HASTA_LA_COMA}{1,8}呢`),
  regla('比', 'HSK 2', tm('Comparación: A 比 B y cómo es'), `比(?!较|赛|如|例)${HASTA_LA_COMA}{1,10}?(?:更|还|多|少|大|小|高|低|好|快|慢|长|短|贵|便宜|远|近|早|晚|冷|热|容易|难)`),
  regla('得', 'HSK 2', tm('Cómo se hace algo: verbo + 得 + cómo'), '(?<![觉记懂值获取显舍使认])得(?=很|非常|太|真|不|更|越|特别|挺|好|快|慢|多|早|晚|清楚|漂亮|不错)'),
  regla('是…的', 'HSK 2', tm('Subraya cuándo, dónde o cómo pasó algo'), `是${HASTA_LA_COMA}{0,6}(?:坐|来|去|在|从|跟|和|用)${HASTA_LA_COMA}{0,8}的(?=[。！？!?]|$)`),
  regla('因为…所以', 'HSK 2', tm('Porque… por eso'), `因为${EN_LA_FRASE}所以`),
  regla('一边…一边', 'HSK 2', tm('Dos cosas a la vez'), `一边${EN_LA_FRASE}一边`),
  regla('要…了', 'HSK 2', tm('Algo que está a punto de pasar'), `(?:快要|就要|快)${HASTA_LA_COMA}{1,6}了`),
  regla('已经…了', 'HSK 2', tm('Ya: algo que ha ocurrido'), `已经${HASTA_LA_COMA}*?了`),
  regla('跟…一样', 'HSK 2', tm('Igual que'), `(?:跟|和)${HASTA_LA_COMA}{1,8}一样`),
  regla('还是', 'HSK 2', tm('O, en una pregunta: elige entre dos'), `还是${HASTA_LA_COMA}*[？?]`),
  regla('别', 'HSK 2', tm('No hagas algo: una prohibición o un ruego'), '(?:^|[，。！？,!?]\\s*)(?:别|不要)'),

  // HSK 3 y 4
  regla('把', 'HSK 3', tm('Lo que se hace con algo: 把 + objeto + verbo + resultado'), `把${HASTA_LA_COMA}{1,12}?(?:了|到|在|给|成|完|好|掉|走|起来|下来|出来|进去|上|开)`),
  regla('被', 'HSK 3', tm('Voz pasiva: alguien recibe la acción'), '被(?!子|告)'),
  regla('越来越', 'HSK 3', tm('Cada vez más'), '越来越'),
  regla('虽然…但是', 'HSK 3', tm('Aunque… sin embargo'), `虽然${EN_LA_FRASE}(?:但是|可是|但|却)`),
  regla('如果…就', 'HSK 3', tm('Si…, entonces'), '如果'),
  regla('一…就', 'HSK 3', tm('En cuanto pasa algo, pasa lo otro'), `一(?:到|回|看|听|说|下|进|出|有|开|放|起|上)${HASTA_LA_COMA}{0,4}就`),
  regla('不但…而且', 'HSK 3', tm('No solo… sino también'), `(?:不但|不仅)${EN_LA_FRASE}(?:而且|也|还)`),
  regla('除了…以外', 'HSK 3', tm('Además de, o excepto'), `除了${EN_LA_FRASE}(?:以外|之外|还|也|都)`),
  regla('为了', 'HSK 3', tm('Para: la finalidad'), '为了'),
  regla('先…再', 'HSK 3', tm('Primero… y después'), `先${EN_LA_FRASE}(?:再|然后)`),
  regla('没有…那么', 'HSK 3', tm('No tan… como'), `没有${HASTA_LA_COMA}{1,8}(?:那么|这么)`),
  regla('连…都', 'HSK 4', tm('Hasta, incluso: lo más extremo'), `连${HASTA_LA_COMA}{1,8}(?:都|也)`),
  regla('越…越', 'HSK 4', tm('Cuanto más… más'), `越(?!来越)${HASTA_LA_COMA}{1,6}越`),
  regla('只要…就', 'HSK 4', tm('Con tal de que…, basta'), `只要${EN_LA_FRASE}就`),
  regla('只有…才', 'HSK 4', tm('Solo si…, entonces'), `只有${EN_LA_FRASE}才`),
  regla('对…来说', 'HSK 4', tm('Para alguien, desde su punto de vista'), `对${HASTA_LA_COMA}{1,8}来说`),
  regla('无论…都', 'HSK 4', tm('Sea como sea, siempre'), `(?:无论|不管)${EN_LA_FRASE}(?:都|也)`),

  // HSK 5 y más
  regla('即使…也', 'HSK 5', tm('Aunque, incluso si'), `即使${EN_LA_FRASE}也`),
  regla('既然…就', 'HSK 5', tm('Ya que…, entonces'), `既然${EN_LA_FRASE}就`),
];

export const detectarGramatica = (texto: string): PuntoGramatica[] => aplicarReglas(REGLAS, texto);

/** Todos los puntos que se detectan, sin su expresión regular: para casarlos con tarjetas de Anki. */
export const puntosGramatica = () => REGLAS.map(({ patron, nivel, significado }) => ({ patron, nivel, significado }));
