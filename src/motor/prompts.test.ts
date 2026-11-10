import { describe, expect, it } from 'vitest';
import { PROMPTS_ALEMAN } from '../lenguas/aleman/prompts';
import { PROMPTS_INGLES } from '../lenguas/ingles/prompts';
import { PROMPTS_BASE } from '../lenguas/japones/prompts';
import { AVISO_SIN_FRASE, rellenar, sinFraseVacia } from './prompts';

const ajustes = { nivel: 'JLPT N3', idiomaExplicaciones: 'español' };

describe('sinFraseVacia', () => {
  it('quita la frase vacía al explicar una palabra suelta, en japonés', () => {
    const t = rellenar(sinFraseVacia(PROMPTS_BASE.explicar.usuario), ajustes, { palabra: '危ない', superficie: '危ない', lectura: 'あぶない' });
    expect(t).not.toMatch(/Frase|「」|en la frase aparece/);
    expect(t).toContain('Palabra: 危ない (lectura あぶない)');
    expect(t.endsWith(AVISO_SIN_FRASE)).toBe(true);
  });

  it('y al preguntar por ella', () => {
    const t = rellenar(sinFraseVacia(PROMPTS_BASE.preguntar.usuario), ajustes, { palabra: '危ない', pregunta: '¿Qué palabras parecidas hay?' });
    expect(t).not.toMatch(/Frase|「」/);
    expect(t).toContain('Palabra consultada: 危ない');
    expect(t).toContain('Pregunta: ¿Qué palabras parecidas hay?');
  });

  it('sirve para las plantillas del inglés y del alemán, con sus comillas', () => {
    for (const prompts of [PROMPTS_INGLES.base, PROMPTS_ALEMAN.base]) {
      const t = rellenar(sinFraseVacia(prompts.explicar.usuario), ajustes, { palabra: 'run', superficie: 'run', lectura: '' });
      expect(t).not.toMatch(/Frase|“”/);
      expect(t).toContain(AVISO_SIN_FRASE);
    }
  });

  it('deja el entorno y lo que no es la frase', () => {
    const t = sinFraseVacia('[ENTORNO]Frase: 「[FRASE]」\nPregunta: [PREGUNTA]');
    expect(t.startsWith('[ENTORNO]')).toBe(true);
    expect(t).toContain('Pregunta: [PREGUNTA]');
  });

  it('no toca una frase dentro de un texto más largo, como en un prompt personalizado', () => {
    const t = sinFraseVacia('Explica la palabra tal como aparece en esta frase: [FRASE], con detalle.');
    expect(t).toContain('[FRASE], con detalle.');
  });
});
