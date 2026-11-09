import { describe, expect, it } from 'vitest';
import type { FraseAcentual } from './practicaAcento';
import { acentoVoicevox, claveDeAudio, type ConsultaVoz, corregirAcentos, emparejarFrases, morasDelMotor } from './vozLocal';

const frase = (moras: string, nucleos: number[] | null): FraseAcentual => ({ texto: moras, moras: Array.from(moras), morasPalabra: moras.length, nucleos, pausaNatural: false });
const delMotor = (kana: string, accent: number) => ({ moras: Array.from(kana).map((text) => ({ text, pitch: 0 })), accent });

describe('el acento de VOICEVOX', () => {
  it('la última mora alta: el plano es el número de moras', () => {
    expect(acentoVoicevox(0, 3)).toBe(3);
    expect(acentoVoicevox(1, 3)).toBe(1);
    expect(acentoVoicevox(2, 3)).toBe(2);
  });

  it('la «.» de la puntuación no es una mora', () => {
    expect(morasDelMotor(delMotor('ツカイマス.', 4))).toBe(5);
  });
});

describe('las frases que son la misma', () => {
  it('donde empiezan y acaban en las mismas moras', () => {
    expect(emparejarFrases([3, 5], [3, 5])).toEqual([
      [0, 0],
      [1, 1],
    ]);
    // El motor junta en una lo que Kotonoha parte en dos: esas no se emparejan, las demás sí.
    expect(emparejarFrases([3, 6, 2], [3, 2, 4, 2])).toEqual([
      [0, 0],
      [2, 3],
    ]);
  });
});

describe('el acento del diccionario', () => {
  const consulta = (): ConsultaVoz => ({
    accent_phrases: [delMotor('ハシオ', 3), delMotor('ワタリマス.', 4)],
    speedScale: 1,
  });

  it('corrige el del motor donde no coincide, y deja lo demás como estaba', () => {
    // 橋を es odaka (2); el motor lo leía plano.
    const { consulta: c, cambios } = corregirAcentos(consulta(), [frase('はしを', [2]), frase('わたります', [4])]);
    expect(c.accent_phrases.map((a) => a.accent)).toEqual([2, 4]);
    expect(cambios).toEqual([{ frase: 0, texto: 'はしを', antes: 3, despues: 2 }]);
    expect(c.speedScale).toBe(1);
  });

  it('no toca la consulta original, ni lo que el diccionario no sabe, ni un acento que es uno de los suyos', () => {
    const original = consulta();
    corregirAcentos(original, [frase('はしを', [2]), frase('わたります', null)]);
    expect(original.accent_phrases[0].accent).toBe(3);
    const { cambios } = corregirAcentos(consulta(), [frase('はしを', [0, 2]), frase('わたります', [4])]);
    expect(cambios).toEqual([]);
  });
});

describe('la caché de audios', () => {
  it('la misma clave para lo mismo, otra si cambia algo', () => {
    const a = claveDeAudio('http://127.0.0.1:10101', 1, true, '橋を渡ります。');
    expect(claveDeAudio('http://127.0.0.1:10101', 1, true, '橋を渡ります。')).toBe(a);
    expect(claveDeAudio('http://127.0.0.1:10101', 2, true, '橋を渡ります。')).not.toBe(a);
    expect(claveDeAudio('http://127.0.0.1:10101', 1, false, '橋を渡ります。')).not.toBe(a);
  });
});
