// La instrucción para colocar una letra sobre los tiempos de una transcripción. Es la misma en todas las lenguas, salvo
// los ejemplos de lo que en cada una suena igual aunque se escriba distinto.

export const ESQUEMA_LETRA = {
  type: 'object',
  properties: {
    ajuste: {
      type: 'array',
      items: {
        type: 'object',
        properties: { v: { type: 'integer' }, de: { type: 'integer' }, a: { type: 'integer' } },
        required: ['v', 'de', 'a'],
        additionalProperties: false,
      },
    },
  },
  required: ['ajuste'],
  additionalProperties: false,
} as const;

export interface DetallesLetra {
  /** Lo que sigue a «una canción»: «japonesa», «en inglés». */
  cancion: string;
  /** Marcas de sección que suelen traer las letras publicadas. */
  marcas: string;
  /** Ejemplos de lo que suena igual aunque se escriba distinto. */
  sonidos: string;
  /** Qué líneas usar si la letra viene en varias escrituras o idiomas. */
  escritura: string;
}

export const promptLetra = ({ cancion, marcas, sonidos, escritura }: DetallesLetra) => `Colocas la letra de una canción ${cancion} sobre los tiempos de una transcripción automática. Recibes dos listas numeradas.

TRANSCRIPCIÓN es lo que un reconocedor de voz entendió al oír la canción, en orden y con sus tiempos en segundos. Los tiempos son buenos, pero el texto falla mucho: palabras mal oídas, frases inventadas en los pasajes instrumentales y partes que no recoge. Una línea puede contener varios versos, y un verso puede repartirse entre varias líneas.

LETRA es la letra verdadera, tal como la publicó alguien, normalmente verso a verso. Puede traer además cosas que no se cantan: el título, créditos, marcas de sección como ${marcas}, o la misma letra en otra escritura o traducida.

Di qué verso suena en cada momento, en el orden en que suena la canción. Devuelve una lista de entradas con:
- v: el número del verso en LETRA.
- de y a: la primera y la última línea de TRANSCRIPCIÓN sobre las que suena ese verso. Si se canta pero la transcripción no lo recoge, pon -1 en las dos.

Reglas:
- Compara por cómo suena, no por cómo se escribe: ${sonidos}. Aunque una línea solo se parezca a un verso en unos pocos sonidos, eso y el orden bastan para emparejarlos.
- Sigue el orden de la canción: de una entrada a la siguiente, «de» nunca retrocede.
- Las letras suelen escribir una sola vez lo que se canta varias. Si un verso o un estribillo se repite al cantarlo, repite su número tantas veces como suene, aunque en LETRA aparezca una sola vez.
- ${escritura}
- No incluyas lo que no se canta.
- Las líneas de TRANSCRIPCIÓN que no corresponden a ningún verso, como ruido, frases inventadas o voz hablada que no está en la letra, simplemente no se cubren.
- Si dos versos seguidos suenan dentro de una misma línea de TRANSCRIPCIÓN, da esa misma línea en los dos.
- No corrijas ni reescribas nada: solo devuelves números.
- Si la letra no tiene nada que ver con lo que se oye, devuelve la lista vacía.`;
