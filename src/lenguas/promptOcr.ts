// Lo que se le pide a Claude para revisar el texto que el OCR leyó de una página, con la imagen de la página delante.
// Es igual en todas las lenguas salvo qué letras se confunden en cada una y lo que no hay que tocar de su escritura.

export const ESQUEMA_REVISION_OCR = {
  type: 'object',
  properties: {
    cambios: {
      type: 'array',
      items: {
        type: 'object',
        properties: { i: { type: 'integer' }, t: { type: 'string' } },
        required: ['i', 't'],
        additionalProperties: false,
      },
    },
  },
  required: ['cambios'],
  additionalProperties: false,
} as const;

export function promptRevisionOcr(o: {
  /** El nombre de la lengua, como se dice en una frase: «japonés». */
  lengua: string;
  /** Las letras que el OCR confunde en esta lengua, en una enumeración. */
  confusiones: string;
  /** Lo propio de la escritura de la lengua que no hay que tocar, en viñetas que empiezan por «- ». */
  noTocar: string;
}): string {
  return `Revisas el texto que un OCR leyó de una página de un libro o de un manga en ${o.lengua}. Tienes la imagen de la página y su texto numerado: en un libro, los renglones en el orden de lectura; en un manga, un número por globo. Lo va a leer alguien que aprende ${o.lengua}, así que una letra equivocada le enseña algo falso.

Compara cada número con lo que se ve en la imagen y devuelve solo los que no coincidan, con su número y el texto tal como está impreso. Lo normal es que casi todos estén bien: si uno coincide con la imagen, no lo incluyas.

Qué cambiar:
- Letras leídas como otras de forma parecida: ${o.confusiones}.
- Letras que faltan o que sobran, y signos de puntuación leídos mal.

Qué no tocar:
- La división del texto: cada número conserva solo su propio texto. No pases texto de un número a otro, no juntes ni partas números y no añadas números nuevos.
${o.noTocar}
- Lo que la página dice tal cual, aunque parezca una errata o un uso poco común: copia la página, no la mejores.
- Lo que no se lea bien en la imagen: si no ves con claridad qué pone, deja ese número como está.

Ante la duda, deja el texto como está: un cambio equivocado es peor que ninguno.`;
}
