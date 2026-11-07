// Lo que Whisper hace mal en alemán, y cómo se parten sus frases en líneas de subtítulo.

import type { ReglasTranscripcion } from '../../nucleo/transcripcion';

export const REGLAS_TRANSCRIPCION: ReglasTranscripcion = {
  // Frases que Whisper se inventa en silencios y música porque abundan en sus datos de entrenamiento: los créditos de
  // los subtítulos de la televisión pública alemana, sobre todo.
  alucinaciones: [
    /untertitel (im auftrag|von|der|des|für)\b/i,
    /untertitelung\b/i,
    /\b(ZDF|ARD|SWR|WDR|NDR|BR|MDR|funk)\b.*\b(20\d\d|untertitel)/i,
    /vielen dank (fürs|für das|für's) (zuschauen|zusehen)/i,
    /danke (fürs|für das|für's) (zuschauen|zusehen)/i,
    /(abonniert|abonniere) (den|meinen|unseren) kanal/i,
    /bis zum nächsten (mal|video)/i,
    /amara\.org/i,
    /^(danke|vielen dank|tschüss)[.!\s]*$/i,
    // Cuando solo oye música, a menudo lo dice.
    /^[([]?(musik|applaus|lachen|stille)[)\]]?[.\s]*$/i,
    /^[♪~.\s]+$/,
  ],
  // Frases cortas que aparecen de la nada sobre la música.
  comunesSobreMusica: /^(okay|ok|ja|nein|oh|so|na|gut|hm|hmm|äh|ähm|mhm|tschüss|hallo|hi)[.!?,\s]*$/i,
  finDeFrase: /(?<=[.!?…])\s+/u,
  pausa: /(?<=[,;:]\s)/u,
  // Sin puntuación, se corta antes de una conjunción o una preposición, y si no hay, en cualquier espacio.
  corteSinPuntuacion: /\s(?=(?:und|aber|oder|denn|weil|dass|wenn|als|ob|damit|obwohl|während|bevor|nachdem|sondern|sowie|um|mit|für|von|bei|nach|auf|in|an)\b)/gi,
  corteDeReserva: /\s/g,
  partirClausulas: true,
  maximoCaracteres: 42,
  msPorCaracter: 70,
  espacios: true,
};
