// Lo que Whisper hace mal en chino, y cómo se parten sus frases en líneas de subtítulo.

import type { ReglasTranscripcion } from '../../nucleo/transcripcion';

export const REGLAS_TRANSCRIPCION: ReglasTranscripcion = {
  // Frases que Whisper se inventa en silencios y música porque abundan en sus datos de entrenamiento: los créditos de
  // los subtítulos de internet y las despedidas de los videos.
  alucinaciones: [
    /请不吝点赞|点赞.{0,6}订阅|订阅.{0,6}转发|打赏支持/,
    /字幕(由|来自|提供|制作)|Amara\.org/i,
    /明镜(与|和)点点|优优独播剧场|YoYo Television/i,
    /^(谢谢|感谢)(大家|观看|收看|收听)[。！!\s]*$/,
    /^(字幕|翻译|校对|制作|作词|作曲|编曲|中文字幕)[：:・\s]/,
    // Cuando solo oye música, a menudo lo dice.
    /^[（(\[]?(音乐|背景音乐|掌声|笑声?)[）)\]]?[。\s]*$/,
    /^[♪〜~\s]+$/,
  ],
  // Frases cortas de cortesía que aparecen de la nada sobre la música.
  comunesSobreMusica: /^(你好|谢谢|再见|好的|对不起|晚安|拜拜|嗯)[。！!\s]*$/,
  finDeFrase: /(?<=[。！？!?…])/u,
  pausa: /(?<=[，、,；;])/u,
  // Sin puntuación, se corta tras una partícula de final de frase seguida de otro ideograma.
  corteSinPuntuacion: /[了吗呢吧啊呀](?=\p{Script=Han})/gu,
  // Los subtítulos chinos son cortos: en Netflix, como mucho 16 caracteres por línea.
  maximoCaracteres: 24,
  msPorCaracter: 220,
};
