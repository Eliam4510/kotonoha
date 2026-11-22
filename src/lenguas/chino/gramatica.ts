// Detección de puntos gramaticales sin IA, para que funcione al instante y sin conexión. Como en las demás lenguas, es
// deliberadamente conservadora: mejor no marcar que marcar mal. Claude la sustituye cuando revisa la línea.
//
// Los niveles son los del temario del HSK de 2025 (publico/datos/hsk/gramatica.json): cada regla va en el nivel en que
// el temario enseña su punto. Los patrones se escriben como los pide el prompt de Claude (虽然…但是, 是…的), y casan con
// los del temario (虽然……，但是……) al compararlos sin puntos suspensivos ni comas.

import { tm } from '../../compartido/i18n';
import { aplicarReglas, type ReglaGramatica } from '../reglasGramatica';
import type { PuntoGramatica } from '../tipos';

/** Hasta el final de la frase, sin cruzar a la siguiente. */
const EN_LA_FRASE = '[^。！？!?]*?';
/** Hasta la coma, sin cruzarla. */
const HASTA_LA_COMA = '[^，。！？,!?；;]';

const regla = (patron: string, nivel: string, significado: string, re: string): ReglaGramatica => ({ patron, nivel, significado, re: new RegExp(re, 'u') });

const REGLAS: ReglaGramatica[] = [
  // HSK 1
  regla('了', 'HSK 1', tm('Algo ya hecho, o un cambio de situación'), '(?<![为除算罢受不])了(?!解)'),
  regla('吗', 'HSK 1', tm('Pregunta de sí o no'), '吗(?=[？?。！!\\s]|$)'),
  regla('A不A', 'HSK 1', tm('Pregunta con la forma afirmativa y la negativa juntas: 是不是, 好不好'), '(\\p{Script=Han})不\\1'),
  regla('正在', 'HSK 1', tm('Algo que está pasando ahora'), `正在|在${HASTA_LA_COMA}{1,8}呢`),
  // Sin 太阳 (el sol), 太太 (la esposa) ni 太极: «太阳出来了» no es «太…了».
  regla('太…了', 'HSK 1', tm('Demasiado, o muy: 太好了'), `太(?!阳|太|极|空|平|子)${HASTA_LA_COMA}{1,4}了`),

  // HSK 2
  regla('过', 'HSK 2', tm('Algo que se ha hecho alguna vez'), '(?:去|来|吃|喝|看|听|见|做|学|用|说|玩|住|到|读|写|买|试|坐|想)过(?![来去])'),
  regla('着', 'HSK 2', tm('Un estado que dura, o cómo se hace otra cosa'), '(?:坐|站|躺|穿|戴|拿|带|开|关|放|挂|写|笑|等|唱|跟|看|听|说)着'),
  regla('比', 'HSK 2', tm('Comparación: A 比 B y cómo es'), `比(?!较|赛|如|例)${HASTA_LA_COMA}{1,10}?(?:更|还|多|少|大|小|高|低|好|快|慢|长|短|贵|便宜|远|近|早|晚|冷|热|容易|难)`),
  regla('得', 'HSK 2', tm('Cómo se hace algo: verbo + 得 + cómo'), '(?<![觉记懂值获取显舍使认])得(?=很|非常|太|真|不|更|越|特别|挺|好|快|慢|多|早|晚|清楚|漂亮|不错)'),
  regla('是…的', 'HSK 2', tm('Subraya cuándo, dónde o cómo pasó algo'), `是${HASTA_LA_COMA}{0,6}(?:坐|来|去|在|从|跟|和|用)${HASTA_LA_COMA}{0,8}的(?=[。！？!?]|$)`),
  regla('因为…所以', 'HSK 2', tm('Porque… por eso'), `因为${EN_LA_FRASE}所以`),
  regla('虽然…但是', 'HSK 2', tm('Aunque… sin embargo'), `虽然${EN_LA_FRASE}(?:但是|可是|但|却)`),
  regla('一…就', 'HSK 2', tm('En cuanto pasa algo, pasa lo otro'), `一(?:到|回|看|听|说|下|进|出|有|开|放|起|上)${HASTA_LA_COMA}{0,4}就`),
  regla('要…了', 'HSK 2', tm('Algo que está a punto de pasar'), `(?:快要|就要|快)${HASTA_LA_COMA}{1,6}了`),
  regla('已经…了', 'HSK 2', tm('Ya: algo que ha ocurrido'), `已经${HASTA_LA_COMA}*?了`),
  regla('还是', 'HSK 2', tm('O, en una pregunta: elige entre dos'), `还是${HASTA_LA_COMA}*[？?]`),
  regla('还是…吧', 'HSK 2', tm('Mejor…: para sugerir'), `还是${HASTA_LA_COMA}{1,10}吧`),
  regla('别', 'HSK 2', tm('No hagas algo: una prohibición o un ruego'), '(?:^|[，。！？,!?]\\s*)(?:别|不要)'),
  regla('都…了', 'HSK 2', tm('Ya…: más de lo que se esperaba'), `都(?:[0-9]+|[一二三四五六七八九十百两几半]+)(?:点|年|岁|个|天|月|号|分|次|遍|小时|多)${HASTA_LA_COMA}{0,3}了`),
  regla('什么的', 'HSK 2', tm('Y cosas así, etcétera'), '什么的(?=[。！？!?，,]|$)'),
  regla('没有…那么', 'HSK 2', tm('No tan… como'), `没有${HASTA_LA_COMA}{1,8}(?:那么|这么)`),

  // HSK 3
  regla('把', 'HSK 3', tm('Lo que se hace con algo: 把 + objeto + verbo + resultado'), `把${HASTA_LA_COMA}{1,12}?(?:了|到|在|给|成|完|好|掉|走|起来|下来|出来|进去|上|开)`),
  regla('被', 'HSK 3', tm('Voz pasiva: alguien recibe la acción'), '被(?!子|告)'),
  regla('跟…一样', 'HSK 3', tm('Igual que'), `(?:跟|和)${HASTA_LA_COMA}{1,8}一样`),
  regla('一边…一边', 'HSK 3', tm('Dos cosas a la vez'), `一边${EN_LA_FRASE}一边`),
  regla('越来越', 'HSK 3', tm('Cada vez más'), '越来越'),
  regla('越…越', 'HSK 3', tm('Cuanto más… más'), `越(?!来越)${HASTA_LA_COMA}{1,6}越`),
  regla('如果…就', 'HSK 3', tm('Si…, entonces'), '如果'),
  regla('不但…而且', 'HSK 3', tm('No solo… sino también'), `不但${EN_LA_FRASE}(?:而且|也|还)`),
  regla('除了…以外', 'HSK 3', tm('Además de, o excepto'), `除了${EN_LA_FRASE}(?:以外|之外|还|也|都)`),
  regla('为了', 'HSK 3', tm('Para: la finalidad'), '为了'),
  regla('先…再', 'HSK 3', tm('Primero… y después'), `先${EN_LA_FRASE}(?:再|然后)`),
  regla('只要…就', 'HSK 3', tm('Con tal de que…, basta'), `只要${EN_LA_FRASE}就`),
  regla('只有…才', 'HSK 3', tm('Solo si…, entonces'), `只有${EN_LA_FRASE}才`),
  regla('对…来说', 'HSK 3', tm('Para alguien, desde su punto de vista'), `对${HASTA_LA_COMA}{1,8}来说`),
  regla('一点儿也不', 'HSK 3', tm('Nada, en absoluto'), '一点儿?(?:也|都)(?:不|没)'),
  regla('从…起', 'HSK 3', tm('A partir de…'), `从${HASTA_LA_COMA}{1,6}起(?=[，,]|就|开始|$)`),
  regla('该…了', 'HSK 3', tm('Ya es hora de…'), `(?<!应)该${HASTA_LA_COMA}{1,6}了`),
  regla('在…看来', 'HSK 3', tm('En opinión de…'), `在${HASTA_LA_COMA}{1,8}看来`),
  regla('看起来', 'HSK 3', tm('Parece, por lo que se ve'), '看起来|看上去'),
  regla('一般来说', 'HSK 3', tm('Por lo general'), '一般来说'),
  regla('不一会儿', 'HSK 3', tm('Al poco rato'), '不一会儿'),
  regla('或者…或者', 'HSK 3', tm('O…, o…'), `或者${EN_LA_FRASE}或者`),
  regla('又…又', 'HSK 3', tm('Las dos cosas a la vez: 又好又便宜'), `又${HASTA_LA_COMA}{1,6}[，,]?又`),
  regla('一会儿…一会儿', 'HSK 3', tm('Ahora…, luego…: algo que cambia'), `一会儿${EN_LA_FRASE}一会儿`),
  regla('的话', 'HSK 3', tm('Si…: una condición'), '(?<![说讲听])的话(?=[，,])'),
  regla('不是…吗', 'HSK 3', tm('¿No es…?: pregunta retórica, para afirmar'), `不是${EN_LA_FRASE}吗[？?]`),
  regla('…极了', 'HSK 3', tm('Muchísimo'), '极了'),

  // HSK 4
  regla('连…都', 'HSK 4', tm('Hasta, incluso: lo más extremo'), `连${HASTA_LA_COMA}{1,8}(?:都|也)`),
  regla('无论…都', 'HSK 4', tm('Sea como sea, siempre'), `(?:无论|不管)${EN_LA_FRASE}(?:都|也)`),
  regla('即使…也', 'HSK 4', tm('Aunque, incluso si'), `即使${EN_LA_FRASE}也`),
  regla('既然…就', 'HSK 4', tm('Ya que…, entonces'), `既然${EN_LA_FRASE}就`),
  regla('难道…吗', 'HSK 4', tm('¿Acaso…?: pregunta retórica'), `难道${EN_LA_FRASE}吗`),
  regla('不是…而是', 'HSK 4', tm('No es…, sino…'), `不是${EN_LA_FRASE}而是`),
  regla('不是…就是', 'HSK 4', tm('O…, o…: una de las dos'), `不是${EN_LA_FRASE}就是`),
  regla('既…又', 'HSK 4', tm('Tanto… como…'), `既(?!然)${HASTA_LA_COMA}{1,8}[，,]?(?:又|也)`),
  regla('一方面…另一方面', 'HSK 4', tm('Por un lado…, por otro…'), `一方面${EN_LA_FRASE}另一方面`),
  regla('首先…其次', 'HSK 4', tm('En primer lugar…, en segundo…'), `首先${EN_LA_FRASE}其次`),
  regla('首先…然后', 'HSK 4', tm('Primero…, después…'), `首先${EN_LA_FRASE}然后`),
  regla('尽管…但是', 'HSK 4', tm('Aunque… sin embargo'), `尽管${EN_LA_FRASE}(?:但是|可是|但|却|还是|也)`),
  regla('不仅…还', 'HSK 4', tm('No solo… sino también'), `(?:不仅|不光)${EN_LA_FRASE}(?:而且|还|也)`),
  regla('要是', 'HSK 4', tm('Si…: una condición'), '(?<![主只需重想])要是'),
  regla('否则', 'HSK 4', tm('Si no, de lo contrario'), '否则'),
  regla('于是', 'HSK 4', tm('Así que, entonces'), '于是'),
  regla('然而', 'HSK 4', tm('Sin embargo'), '然而'),
  regla('因此', 'HSK 4', tm('Por eso, por lo tanto'), '因此'),
  regla('再也不', 'HSK 4', tm('Nunca más…'), '再也(?:不|没)'),
  regla('怎么也不', 'HSK 4', tm('No hay manera de…'), '怎么(?:都|也)(?:不|没)'),
  regla('说不定', 'HSK 4', tm('Quizá, a lo mejor'), '说不定'),
  regla('来得及', 'HSK 4', tm('Llegar a tiempo, o no'), '来[得不]及'),
  regla('为了…而', 'HSK 4', tm('Hacer algo para…'), `为了${EN_LA_FRASE}而(?!且)`),
  regla('在…方面', 'HSK 4', tm('En el aspecto de…'), `在${HASTA_LA_COMA}{1,8}方面`),
  regla('拿…来说', 'HSK 4', tm('Tomemos… como ejemplo'), `拿${HASTA_LA_COMA}{1,8}来说`),
  regla('跟…相比', 'HSK 4', tm('Comparado con…'), `(?:跟|与|和|同)${HASTA_LA_COMA}{1,8}相比`),
  regla('A不如B', 'HSK 4', tm('A no es tan bueno como B'), '(?<!^|[，。！？,!?\\s])不如'),
  regla('…死了', 'HSK 4', tm('Muchísimo, a más no poder: 累死了'), '(?:累|饿|渴|困|热|冷|忙|急|气|笑|高兴|开心|吓|烦|疼|痛|难受|难过|无聊|担心|想|爱|讨厌)死了'),
  regla('够…的', 'HSK 4', tm('Bastante…, muy…'), `够${HASTA_LA_COMA}{1,4}的(?=[。！？!?，,]|$)`),

  // HSK 5
  regla('哪怕…也', 'HSK 5', tm('Aunque, incluso si'), `哪怕${EN_LA_FRASE}(?:也|都)`),
  regla('一旦…就', 'HSK 5', tm('En cuanto, una vez que…'), '一旦'),
  regla('假如', 'HSK 5', tm('Si, suponiendo que…'), '假如'),
  regla('万一', 'HSK 5', tm('Por si acaso, si llegara a…'), '万一'),
  regla('不然', 'HSK 5', tm('Si no, de lo contrario'), '要?不然'),
  regla('因而', 'HSK 5', tm('Por lo tanto'), '因而'),
  regla('可见', 'HSK 5', tm('Se ve que, lo que demuestra que'), '可见(?!光)'),
  regla('不但不…反而', 'HSK 5', tm('No solo no…, sino que al contrario…'), `不但(?:不|没)${EN_LA_FRASE}反而`),
  regla('以来', 'HSK 5', tm('Desde…: hasta ahora'), '以来'),
  regla('从…来看', 'HSK 5', tm('Visto desde…'), `从${HASTA_LA_COMA}{1,8}来看`),
  regla('由…组成', 'HSK 5', tm('Formado por…'), `由${HASTA_LA_COMA}{1,10}(?:组成|构成)`),
  regla('A来A去', 'HSK 5', tm('Una y otra vez, de aquí para allá: 走来走去'), '(\\p{Script=Han})来\\1去'),
  regla('为的是', 'HSK 5', tm('Con el fin de…'), '为的是'),
  regla('没有…就没有', 'HSK 5', tm('Sin…, no habría…'), `没有${EN_LA_FRASE}就没有`),
  regla('再…也', 'HSK 5', tm('Por mucho que…, igual…'), `再(?!也)${HASTA_LA_COMA}{1,6}也`),
  regla('…得不得了', 'HSK 5', tm('Muchísimo'), '得不得了'),
  regla('像…似的', 'HSK 5', tm('Como si…'), `(?:像|好像|仿佛|好似)${HASTA_LA_COMA}{1,10}似的`),
  regla('用不着', 'HSK 5', tm('No hace falta'), '用不着'),

  // HSK 6
  regla('要么…要么', 'HSK 6', tm('O…, o…'), `要么${EN_LA_FRASE}要么`),
  regla('凡是…都', 'HSK 6', tm('Todo lo que…'), `凡是${EN_LA_FRASE}都`),
  regla('除非…才', 'HSK 6', tm('Solo si…'), `除非${EN_LA_FRASE}才`),
  regla('除非…否则', 'HSK 6', tm('A menos que…, si no…'), `除非${EN_LA_FRASE}(?:否则|不然)`),
  regla('就算…也', 'HSK 6', tm('Aunque, incluso si'), `就算${EN_LA_FRASE}(?:也|都)`),
  regla('以便', 'HSK 6', tm('Para que, a fin de'), '以便'),
  regla('到…为止', 'HSK 6', tm('Hasta…'), `到${HASTA_LA_COMA}{1,8}为止`),
  regla('好不容易', 'HSK 6', tm('Con mucho esfuerzo, por fin'), '好不容易|好容易(?=才)'),
  regla('算了', 'HSK 6', tm('Déjalo, olvídalo'), '算了(?=[，。！？!?,吧]|$)'),
  regla('虽…但', 'HSK 6', tm('Aunque…: más escrito'), `虽(?!然)${EN_LA_FRASE}(?:但|可|却|也)`),
];

export const detectarGramatica = (texto: string): PuntoGramatica[] => aplicarReglas(REGLAS, texto);

/** Todos los puntos que se detectan, sin su expresión regular: para casarlos con tarjetas de Anki. */
export const puntosGramatica = () => REGLAS.map(({ patron, nivel, significado }) => ({ patron, nivel, significado }));
