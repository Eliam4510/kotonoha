// Lo que Whisper hace mal en inglés, y cómo se parten sus frases en líneas de subtítulo.

import type { ReglasTranscripcion } from '../../nucleo/transcripcion';

export const REGLAS_TRANSCRIPCION: ReglasTranscripcion = {
  // Frases que Whisper se inventa en silencios y música porque abundan en sus datos de entrenamiento.
  alucinaciones: [
    /thanks? for watching/i,
    /please (like|subscribe|share)/i,
    /subscribe to (my|our|the) channel/i,
    /see you (in the )?next (video|time|one)/i,
    /^(subtitles?|captions?|transcri(bed|ption)|translat(ed|ion))\b.*\b(by|from)\b/i,
    /amara\.org/i,
    /^(thank you|thanks|you)[.!\s]*$/i,
    // Cuando solo oye música, a menudo lo dice.
    /^[([]?(music|applause|laughter|silence|upbeat music)[)\]]?[.\s]*$/i,
    /^[♪~.\s]+$/,
  ],
  // Frases cortas que aparecen de la nada sobre la música.
  comunesSobreMusica: /^(okay|ok|yeah|yes|no|oh|so|right|well|hmm|hm|uh|um|mm|bye|hello|hi)[.!?,\s]*$/i,
  finDeFrase: /(?<=[.!?…])\s+/u,
  pausa: /(?<=[,;:]\s)/u,
  // Sin puntuación, se corta antes de una conjunción o una preposición, y si no hay, en cualquier espacio.
  corteSinPuntuacion: /\s(?=(?:and|but|or|so|because|that|which|who|when|while|if|to|for|with|in|on|at|of)\b)/gi,
  corteDeReserva: /\s/g,
  partirClausulas: true,
  maximoCaracteres: 42,
  msPorCaracter: 70,
};
