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

/** Lo que se le dice a Claude cuando la palabra se consulta suelta, sin la frase donde apareció. */
export const AVISO_SIN_FRASE = 'No hay frase: la palabra se consulta suelta, en el diccionario. Responde sobre su uso general, sin mencionar que falta la frase.';

/**
 * Sin frase (una palabra buscada en el diccionario), la plantilla quedaba con «Frase: 「」» y Claude empezaba avisando de
 * que la frase llegó vacía. Se quitan las líneas que solo dan la frase y la mención a cómo aparece en ella, y se le dice
 * que la palabra va suelta. Vale para las plantillas de cada lengua y para las personalizadas.
 */
export function sinFraseVacia(usuario: string): string {
  const lineas = usuario.split('\n').flatMap((l) => {
    // «Frase: 「[FRASE]」», «Frase: “[FRASE]”», «Traduce: [FRASE]»: un rótulo corto y la frase, nada más.
    const sola = /^\s*(\[ENTORNO\])?[^\n[\]]{0,24}:\s*[「“"«']?\[FRASE\][」”"»']?\s*$/.exec(l);
    if (!sola) return [l];
    return sola[1] ? [sola[1]] : [];
  });
  const texto = lineas
    .join('\n')
    .replace(/\s*\(en la frase aparece como [「“"«']?\[SUPERFICIE\][」”"»']?, lectura \[LECTURA\]\)/g, ' (lectura [LECTURA])');
  return `${texto.trim()}\n\n${AVISO_SIN_FRASE}`;
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
