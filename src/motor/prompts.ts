// Cómo se rellenan los prompts de Claude. Los textos son de cada lengua: src/lenguas/<lengua>/prompts.ts.

import type { Ajustes, TareaIA } from '../compartido/ajustes';
import { tm } from '../compartido/i18n';
import type { TareaPrompt } from '../lenguas/tipos';

export interface VariablesPrompt {
  palabra?: string;
  superficie?: string;
  lectura?: string;
  frase?: string;
  entorno?: string;
  traduccion?: string;
  titulo?: string;
  pregunta?: string;
  idioma?: string;
}

export function rellenar(plantilla: string, a: Pick<Ajustes, 'nivel' | 'idiomaExplicaciones'>, v: VariablesPrompt): string {
  // En español el texto queda idéntico: si cambiara, las respuestas guardadas no servirían y se pagarían otra vez.
  const adaptada = a.idiomaExplicaciones === 'español' ? plantilla : plantilla.replaceAll('un estudiante hispanohablante', 'un estudiante que habla [IDIOMA]').replaceAll('un hispanohablante', 'alguien que habla [IDIOMA]');
  return adaptada
    .replaceAll('[NIVEL]', a.nivel)
    .replaceAll('[IDIOMA]', v.idioma ?? a.idiomaExplicaciones)
    .replaceAll('[PALABRA]', v.palabra ?? '')
    .replaceAll('[SUPERFICIE]', v.superficie ?? v.palabra ?? '')
    .replaceAll('[LECTURA]', v.lectura ?? '')
    .replaceAll('[FRASE]', v.frase ?? '')
    .replaceAll('[ENTORNO]', v.entorno ? `${v.entorno}\n` : '')
    .replaceAll('[TRADUCCION]', v.traduccion ? `Traducción automática de la frase, puede ser imprecisa: ${v.traduccion}\n` : '')
    .replaceAll('[TITULO]', v.titulo ?? '')
    .replaceAll('[PREGUNTA]', v.pregunta ?? '');
}

export const TAREAS_PERSONALIZABLES: { id: TareaPrompt; nombre: string }[] = [
  { id: 'explicar', nombre: tm('Explicación de palabra') },
  { id: 'desglosar', nombre: tm('Desglose de frase') },
  { id: 'traducir', nombre: tm('Traducción de frase') },
  { id: 'gramatica', nombre: tm('Explicación de gramática') },
  { id: 'generar', nombre: tm('Frase de ejemplo') },
  { id: 'preguntar', nombre: tm('Pregunta libre') },
  { id: 'historia', nombre: tm('Relato') },
];

export type { TareaIA };
