// Lo que Whisper hace mal en japonés, y cómo se parten sus frases en líneas de subtítulo.

import type { ReglasTranscripcion } from '../../nucleo/transcripcion';

export const REGLAS_TRANSCRIPCION: ReglasTranscripcion = {
  // Frases que Whisper se inventa en silencios y música porque abundan en sus datos de entrenamiento.
  alucinaciones: [
    /ご(視聴|清聴)(いただき|頂き)?ありがとうございま/,
    /チャンネル登録/,
    /高評価/,
    /次回の(動画|配信)/,
    /^(字幕|翻訳|提供|制作|作詞|作曲|編曲)[::・\s]/,
    /^(おやすみなさい|ありがとうございました)[。\s]*$/,
    // Cuando solo oye música, a menudo lo dice.
    /^[((\[]?(音楽|BGM|拍手|笑い?)[))\]]?[。\s]*$/i,
    /^[♪〜~\s]+$/,
  ],
  // Frases cortas de cortesía que aparecen de la nada sobre la música.
  comunesSobreMusica: /^(おはようございます|お(つかれ|疲れ)さまでした?|お疲れ様です|ごめん(ね|なさい)?|おわり|終わり|ごちそう(さま)?(でした)?)[。!!\s]*$/,
  finDeFrase: /(?<=[。!?!?…])/u,
  pausa: /(?<=[、,])/u,
  // Sin puntuación, se corta tras una partícula seguida de kanji o katakana.
  corteSinPuntuacion: /[はがをにでともへて](?=[\p{Script=Han}\p{Script=Katakana}])/gu,
  maximoCaracteres: 34,
  msPorCaracter: 170,
};
