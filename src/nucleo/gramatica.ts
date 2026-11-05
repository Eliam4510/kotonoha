// Detección de puntos gramaticales sin IA, para que funcione al instante y sin conexión.
// Es deliberadamente conservadora: mejor no marcar que marcar mal. El análisis con Claude la
// sustituye cuando está disponible, porque entiende el contexto y conoce muchas más formas.

export type NivelJlpt = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

export interface PuntoGramatica {
  patron: string;
  nivel?: string;
  fragmento: string;
  significado: string;
  fuente: 'regla' | 'ia';
}

interface Regla {
  patron: string;
  nivel: NivelJlpt;
  significado: string;
  re: RegExp;
}

// Las formas en て/た se escriben con y sin sonorizar: 食べて, 読んで, 待って.
const TE = '[てで]';
const TA = '[ただ]';

export const REGLAS: Regla[] = [
  // N5
  { patron: '〜ている', nivel: 'N5', significado: 'Acción en curso o estado resultante', re: new RegExp(`${TE}(?:い(?:る|ます|た|ました|ない|ません|て)|る(?![ぁ-ん])|た(?![ぁ-ん])|ます)`) },
  { patron: '〜てください', nivel: 'N5', significado: 'Por favor, haz…', re: new RegExp(`${TE}(?:ください|下さい)`) },
  { patron: '〜たい', nivel: 'N5', significado: 'Querer hacer algo', re: /[いきしちにひみりぎじびえけせてねへめれげぜべ]たい(?:です|ん|の|と|な|ね|よ|か|。|、|$)/ },
  { patron: '〜ましょう', nivel: 'N5', significado: 'Hagamos…, invitación o propuesta', re: /ましょう/ },
  { patron: '〜から（理由）', nivel: 'N5', significado: 'Porque…, indica la causa', re: /(?:だ|です|ます|た|ない|る|い)から(?:[、。ね]|$)/ },
  { patron: '〜ないでください', nivel: 'N5', significado: 'Por favor, no hagas…', re: /ないで(?:ください|下さい)/ },
  { patron: '〜のが好き', nivel: 'N5', significado: 'Gustar hacer algo', re: /のが(?:好き|大好き|嫌い)/ },

  // N4
  { patron: '〜てしまう', nivel: 'N4', significado: 'Acabar haciendo algo, a menudo con pesar, o terminarlo del todo', re: new RegExp(`${TE}しま[うっいわえお]|ちゃ[うっいわえお]|じゃ[うっいわえお]`) },
  { patron: '〜ておく', nivel: 'N4', significado: 'Hacer algo de antemano', re: new RegExp(`${TE}(?:お|)[くいかきけこ](?:ます|た|て|う|な|ね|よ|。|$)|とく(?![ぁ-ん])|といて|どいて`) },
  { patron: '〜てみる', nivel: 'N4', significado: 'Intentar hacer algo para ver qué pasa', re: new RegExp(`${TE}み(?:る|た|て|ます|ました|よう|ない|たい)`) },
  { patron: '〜てもいい', nivel: 'N4', significado: 'Se puede hacer, hay permiso', re: new RegExp(`${TE}も(?:いい|良い|よい|よく|大丈夫|構わ)`) },
  { patron: '〜てはいけない', nivel: 'N4', significado: 'No se debe hacer', re: /(?:ては|では|ちゃ|じゃ)(?:いけ|だめ|ダメ|なら)/ },
  { patron: '〜なければならない', nivel: 'N4', significado: 'Tener que hacer algo', re: /なければ(?:なら|なり|いけ)|なきゃ|なくちゃ/ },
  { patron: '〜なくてもいい', nivel: 'N4', significado: 'No hace falta hacer', re: /なくても(?:いい|良い|大丈夫|構わ)/ },
  { patron: '〜たことがある', nivel: 'N4', significado: 'Haber hecho algo alguna vez', re: new RegExp(`${TA}ことが(?:ある|あり|あった|ない|なかった)`) },
  { patron: '〜ようと思う', nivel: 'N4', significado: 'Pensar hacer algo, intención', re: /[おこそとのほもよろごぞどぼ]うと(?:思|おも)/ },
  { patron: '〜つもり', nivel: 'N4', significado: 'Tener la intención de…', re: /(?:る|ない|た)つもり/ },
  { patron: '〜ので', nivel: 'N4', significado: 'Puesto que…, causa más suave que から', re: /(?:る|た|い|ない|な)ので/ },
  { patron: '〜のに', nivel: 'N4', significado: 'A pesar de que…, con sorpresa o reproche', re: /(?:る|た|い|ない|な)のに(?:[、。]|$|[ぁ-ん一-龯])/ },
  { patron: '〜ながら', nivel: 'N4', significado: 'Mientras hace otra cosa a la vez', re: /[いきしちにひみりぎじびえけせてねへめれげぜべ]ながら/ },
  { patron: '〜すぎる', nivel: 'N4', significado: 'Hacer o ser demasiado', re: /すぎ(?:る|た|て|ます|ました|ない)|過ぎ(?:る|た|て|ます)/ },
  { patron: '〜やすい', nivel: 'N4', significado: 'Fácil de hacer', re: /[いきしちにひみりぎじびえけせてねへめれげぜべ]やす(?:い|く|かった)/ },
  { patron: '〜にくい', nivel: 'N4', significado: 'Difícil de hacer', re: /[いきしちにひみりぎじびえけせてねへめれげぜべ]にく(?:い|く|かった)/ },
  { patron: '〜かもしれない', nivel: 'N4', significado: 'Puede que…, quizá', re: /かもしれ|かも(?:[。、ね]|$)/ },
  { patron: '〜そうだ（様態）', nivel: 'N4', significado: 'Parece que…, por lo que se ve', re: /[いきしちにひみりぎじびえけせてねへめれげぜべ]そう(?:だ|です|な|に)/ },
  { patron: '〜ようだ', nivel: 'N4', significado: 'Parece que…, por lo que deduzco', re: /(?:る|た|い|ない|の)よう(?:だ|です|な|に)/ },
  { patron: '〜らしい', nivel: 'N4', significado: 'Según parece, por lo que dicen', re: /(?:る|た|い|ない|だ)らしい/ },
  { patron: '〜と思う', nivel: 'N4', significado: 'Creo que…', re: /と(?:思|おも)[うっいわえ]/ },
  { patron: '〜ように', nivel: 'N4', significado: 'Para que…, de manera que…', re: /(?:る|ない)ように/ },
  { patron: '〜ようになる', nivel: 'N4', significado: 'Llegar a poder o a hacer algo, cambio gradual', re: /ように(?:なる|なった|なり|なって)/ },
  { patron: '〜ようにする', nivel: 'N4', significado: 'Procurar hacer algo', re: /ように(?:する|して|した|しま)/ },
  { patron: '〜ことにする', nivel: 'N4', significado: 'Decidir hacer algo', re: /ことに(?:する|した|して|しま)/ },
  { patron: '〜ことになる', nivel: 'N4', significado: 'Resultar que…, quedar decidido', re: /ことに(?:なる|なった|なって|なり)/ },
  { patron: '〜ことができる', nivel: 'N4', significado: 'Poder hacer algo', re: /ことが(?:でき|出来)/ },
  { patron: '〜てあげる', nivel: 'N4', significado: 'Hacer algo por alguien', re: new RegExp(`${TE}あげ(?:る|た|て|ます|ました)`) },
  { patron: '〜てくれる', nivel: 'N4', significado: 'Alguien hace algo por mí', re: new RegExp(`${TE}くれ(?:る|た|て|ます|ました|ない)?`) },
  { patron: '〜てもらう', nivel: 'N4', significado: 'Recibir el favor de que alguien haga algo', re: new RegExp(`${TE}もら[うっいわえ]`) },
  { patron: '〜たら', nivel: 'N4', significado: 'Si…, cuando…', re: new RegExp(`[っいんしきみりち]${TA}ら(?:[、。ぁ-ん一-龯]|$)`) },
  { patron: '〜ば（条件）', nivel: 'N4', significado: 'Si…, condición', re: /[えけせてねへめれげぜべ]ば(?:[、。]|$|[ぁ-ん一-龯])/ },

  // N3
  { patron: '〜ばかり', nivel: 'N3', significado: 'Solo…, no hacer otra cosa que…', re: /(?:る|て|で)ばかり/ },
  { patron: '〜わけだ', nivel: 'N3', significado: 'Es lógico que…, por eso…', re: /わけ(?:だ|です|で|か)/ },
  { patron: '〜わけではない', nivel: 'N3', significado: 'No es que…, no significa que…', re: /わけ(?:では|じゃ)(?:ない|なく|ありま)/ },
  { patron: '〜わけがない', nivel: 'N3', significado: 'Es imposible que…', re: /わけ(?:が|)(?:ない|ありま)/ },
  { patron: '〜はずだ', nivel: 'N3', significado: 'Debería ser que…, se espera que…', re: /はず(?:だ|です|で|な|が|は)/ },
  { patron: '〜べきだ', nivel: 'N3', significado: 'Se debería hacer', re: /べき(?:だ|です|で|じゃ|では|な|$|。)/ },
  { patron: '〜ところだ', nivel: 'N3', significado: 'A punto de, en medio de o acabar de hacer', re: /(?:る|た|て|いる)ところ(?:だ|です|で|に)/ },
  { patron: '〜ようとする', nivel: 'N3', significado: 'Intentar, estar a punto de', re: /[おこそとのほもよろごぞどぼ]うと(?:する|して|した|しま)/ },
  { patron: '〜たばかり', nivel: 'N3', significado: 'Acabar de hacer algo', re: new RegExp(`${TA}ばかり`) },
  { patron: '〜ために', nivel: 'N3', significado: 'Para…, por causa de…', re: /ため(?:に|の)/ },
  { patron: '〜によって', nivel: 'N3', significado: 'Por medio de, según, a causa de', re: /によ(?:って|り|る)/ },
  { patron: '〜について', nivel: 'N3', significado: 'Acerca de…', re: /につ(?:いて|き)/ },
  { patron: '〜にとって', nivel: 'N3', significado: 'Para…, desde el punto de vista de…', re: /にと(?:って|り)/ },
  { patron: '〜として', nivel: 'N3', significado: 'Como…, en calidad de…', re: /として/ },
  { patron: '〜たび', nivel: 'N3', significado: 'Cada vez que…', re: /(?:る|の)(?:たび|度)に/ },
  { patron: '〜うちに', nivel: 'N3', significado: 'Mientras aún…, antes de que cambie', re: /(?:る|い|ない|な|の|た)うちに/ },
  { patron: '〜ほど', nivel: 'N3', significado: 'Hasta el punto de…', re: /(?:る|い|ない|な|た)ほど/ },
  { patron: '〜くらい', nivel: 'N3', significado: 'Tanto que…, aproximadamente', re: /(?:る|い|ない|な|た)(?:くらい|ぐらい)/ },
  { patron: '〜さえ', nivel: 'N3', significado: 'Hasta, incluso…', re: /[ぁ-ん一-龯]さえ/ },
  { patron: '〜っぽい', nivel: 'N3', significado: 'Que parece…, con tendencia a…', re: /っぽ(?:い|く)/ },
  { patron: '〜みたい', nivel: 'N3', significado: 'Como…, parece…', re: /みたい/ },
  { patron: '〜ようがない', nivel: 'N3', significado: 'No hay manera de…', re: /ようが(?:ない|なく|なかった)/ },
  { patron: '〜とは限らない', nivel: 'N3', significado: 'No necesariamente…', re: /とは(?:限ら|かぎら)/ },
  { patron: '〜に違いない', nivel: 'N3', significado: 'Sin duda…, seguro que…', re: /に(?:違い|ちがい)(?:ない|あり)/ },
  { patron: '〜ずに', nivel: 'N3', significado: 'Sin hacer…', re: /ずに/ },
  { patron: '〜ことはない', nivel: 'N3', significado: 'No hace falta…', re: /ことは(?:ない|ありま)/ },
  { patron: '〜せいで', nivel: 'N3', significado: 'Por culpa de…', re: /せい(?:で|だ|か)/ },
  { patron: '〜おかげで', nivel: 'N3', significado: 'Gracias a…', re: /おかげ(?:で|だ|さま)/ },

  // N2
  { patron: '〜ざるを得ない', nivel: 'N2', significado: 'No queda más remedio que…', re: /ざるを(?:得|え)/ },
  { patron: '〜わけにはいかない', nivel: 'N2', significado: 'No puedo permitirme…', re: /わけには(?:いか|行か)/ },
  { patron: '〜ものだ', nivel: 'N2', significado: 'Es natural que…, solía…, con nostalgia o exclamación', re: /(?:る|た|い|ない)もの(?:だ|です|で|ね)/ },
  { patron: '〜ことだ', nivel: 'N2', significado: 'Lo mejor es…, consejo', re: /(?:る|ない)こと(?:だ|です)(?:[。ね]|$)/ },
  { patron: '〜に対して', nivel: 'N2', significado: 'Hacia…, en contraste con…', re: /に(?:対|たい)(?:して|する)/ },
  { patron: '〜に関して', nivel: 'N2', significado: 'En relación con…', re: /に(?:関|かん)(?:して|する)/ },
  { patron: '〜に基づいて', nivel: 'N2', significado: 'Basándose en…', re: /に(?:基|もと)づ(?:いて|く)/ },
  { patron: '〜に限らず', nivel: 'N2', significado: 'No solo…', re: /に(?:限|かぎ)らず/ },
  { patron: '〜たとたん', nivel: 'N2', significado: 'Justo en el momento en que…', re: new RegExp(`${TA}(?:とたん|途端)`) },
  { patron: '〜ばかりか', nivel: 'N2', significado: 'No solo… sino además…', re: /ばかりか/ },
  { patron: '〜どころか', nivel: 'N2', significado: 'Lejos de…, ni mucho menos', re: /どころか/ },
  { patron: '〜つつ', nivel: 'N2', significado: 'Mientras…, aunque…, registro culto', re: /[いきしちにひみりぎじびえけせてねへめれげぜべ]つつ/ },
  { patron: '〜がち', nivel: 'N2', significado: 'Con tendencia a…', re: /がち(?:だ|です|な|で|に|$|。)/ },
  { patron: '〜かねない', nivel: 'N2', significado: 'Podría llegar a…, con riesgo', re: /かねな/ },
  { patron: '〜かねる', nivel: 'N2', significado: 'Me resulta difícil…', re: /かね(?:る|ます|ません)/ },
  { patron: '〜に過ぎない', nivel: 'N2', significado: 'No es más que…', re: /に(?:過|す)ぎ(?:ない|ません|なかった)/ },
  { patron: '〜ようでは', nivel: 'N2', significado: 'Si se sigue así…', re: /ようでは/ },
  { patron: '〜ものの', nivel: 'N2', significado: 'Aunque…, si bien…', re: /(?:る|た|い|ない)ものの/ },
  { patron: '〜にもかかわらず', nivel: 'N2', significado: 'A pesar de…', re: /にも(?:かかわらず|関わらず|拘らず)/ },
  { patron: '〜ずにはいられない', nivel: 'N2', significado: 'No poder evitar…', re: /ずには(?:いられ|居られ)/ },

  // N1
  { patron: '〜ならでは', nivel: 'N1', significado: 'Propio de…, exclusivo de…', re: /ならでは/ },
  { patron: '〜をものともせず', nivel: 'N1', significado: 'Sin hacer caso de…, sin arredrarse', re: /をものともせず/ },
  { patron: '〜んばかり', nivel: 'N1', significado: 'Como si fuera a…', re: /[あかがさたなばまらわ]んばかり/ },
  { patron: '〜ずじまい', nivel: 'N1', significado: 'Acabar sin haber hecho…', re: /ずじまい/ },
  { patron: '〜といえども', nivel: 'N1', significado: 'Aunque sea…, registro formal', re: /といえども/ },
  { patron: '〜ごとし', nivel: 'N1', significado: 'Como…, forma literaria', re: /ごと(?:し|く|き)(?:[、。]|$|[ぁ-ん一-龯])/ },
  { patron: '〜まい', nivel: 'N1', significado: 'No hará…, determinación negativa', re: /[るう]まい(?:[、。]|$|と)/ },
];

/** Encuentra los puntos de gramática de una línea. Si dos se pisan se queda con el más largo. */
export function detectarGramatica(texto: string): PuntoGramatica[] {
  const halladas: (PuntoGramatica & { desde: number; hasta: number })[] = [];
  for (const r of REGLAS) {
    const m = r.re.exec(texto);
    if (!m) continue;
    halladas.push({
      patron: r.patron,
      nivel: r.nivel,
      fragmento: m[0],
      significado: r.significado,
      fuente: 'regla',
      desde: m.index,
      hasta: m.index + m[0].length,
    });
  }
  halladas.sort((a, b) => b.hasta - b.desde - (a.hasta - a.desde));
  const salida: typeof halladas = [];
  for (const h of halladas) {
    const contenida = salida.some((s) => h.desde >= s.desde && h.hasta <= s.hasta && s.patron !== h.patron);
    if (!contenida && !salida.some((s) => s.patron === h.patron)) salida.push(h);
  }
  return salida.sort((a, b) => a.desde - b.desde).map(({ desde: _d, hasta: _h, ...p }) => p);
}
